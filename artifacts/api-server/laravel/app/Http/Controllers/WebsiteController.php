<?php

namespace App\Http\Controllers;

use App\Services\JsonStore;
use App\Services\SavedPropertyStore;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WebsiteController extends Controller
{
    public function home(Request $request)
    {
        $data = JsonStore::read();
        $properties = $this->publicProperties($data['properties'] ?? []);
        $agents = $this->directoryAgents($data);
        $articles = $this->publishedArticles($data['blogPosts'] ?? []);

        return view('home', [
            'featuredProperties' => $properties->filter(fn (array $item) => !empty($item['featured']))->take(6)->map($this->propertyForView(...)),
            'agents' => $agents->take(4)->map($this->agentForView(...)),
            'articles' => $articles->take(3)->map($this->articleForView(...)),
            'cities' => $properties->pluck('city')->filter()->unique()->sort()->values(),
            ...$this->buyerViewState($request, $data),
        ]);
    }

    public function properties(Request $request)
    {
        $data = JsonStore::read();
        $properties = $this->publicProperties($data['properties'] ?? []);
        $search = strtolower(trim((string) $request->input('search', $request->input('keyword', ''))));

        $properties = $properties->filter(function (array $property) use ($request, $search): bool {
            if ($search !== '' && !str_contains(strtolower(json_encode($property) ?: ''), $search)) {
                return false;
            }

            foreach (['type', 'city', 'status', 'purpose'] as $key) {
                if ($request->filled($key) && strtolower((string) ($property[$key] ?? '')) !== strtolower((string) $request->input($key))) {
                    return false;
                }
            }

            if ($request->filled('minPrice') && (float) ($property['price'] ?? 0) < (float) $request->input('minPrice')) {
                return false;
            }
            if ($request->filled('maxPrice') && (float) ($property['price'] ?? 0) > (float) $request->input('maxPrice')) {
                return false;
            }
            if ($request->filled('minBeds') && (float) ($property['bedrooms'] ?? 0) < (float) $request->input('minBeds')) {
                return false;
            }

            return true;
        })->values();

        $page = max(1, Paginator::resolveCurrentPage());
        $perPage = 12;
        $items = $properties->forPage($page, $perPage)->map($this->propertyForView(...))->values();
        $paginated = new Paginator($items, $properties->count(), $perPage, $page, [
            'path' => Paginator::resolveCurrentPath(),
            'query' => $request->query(),
        ]);

        return view('properties.index', [
            'properties' => $paginated,
            'filters' => $request->query(),
            'cities' => $this->publicProperties($data['properties'] ?? [])->pluck('city')->filter()->unique()->sort()->values(),
            ...$this->buyerViewState($request, $data),
        ]);
    }

    public function propertiesMap(Request $request)
    {
        $data = JsonStore::read();
        $properties = $this->publicProperties($data['properties'] ?? [])
            ->map($this->propertyForView(...))
            ->values();

        return view('properties.map', [
            'properties' => $properties,
            'filters' => $request->query(),
            ...$this->buyerViewState($request, $data),
        ]);
    }

    public function propertyDetail(Request $request, string $id)
    {
        $data = JsonStore::read();
        $property = $this->publicProperties($data['properties'] ?? [])
            ->first(fn (array $item) => (string) ($item['id'] ?? '') === $id || Str::slug((string) ($item['title'] ?? '')) === $id);

        abort_unless($property, 404);

        $property = $this->propertyForView($property);
        $related = $this->publicProperties($data['properties'] ?? [])
            ->filter(fn (array $item) => (string) ($item['id'] ?? '') !== (string) ($property->id ?? ''))
            ->take(3)
            ->map($this->propertyForView(...));

        return view('properties.show', [
            'property' => $property,
            'related' => $related,
            ...$this->buyerViewState($request, $data),
        ]);
    }

    public function agents()
    {
        return view('agents.index', ['agents' => $this->directoryAgents(JsonStore::read())->map($this->agentForView(...))]);
    }

    public function agentDetail(string $id)
    {
        $agent = $this->directoryAgents(JsonStore::read())
            ->first(fn (array $item) => (string) ($item['id'] ?? '') === $id || Str::slug((string) ($item['name'] ?? '')) === $id);

        abort_unless($agent, 404);

        $agent = $this->agentForView($agent);
        $properties = $this->publicProperties(JsonStore::read()['properties'] ?? [])
            ->filter(fn (array $property) => (string) ($property['agentId'] ?? '') === (string) ($agent->id ?? ''))
            ->take(6)
            ->map($this->propertyForView(...));

        return view('agents.show', compact('agent', 'properties'));
    }

    public function about()
    {
        return view('about');
    }

    public function contact()
    {
        return view('contact');
    }

    public function blog()
    {
        return view('blog.index', ['articles' => $this->publishedArticles(JsonStore::read()['blogPosts'] ?? [])->map($this->articleForView(...))]);
    }

    public function blogDetail(string $id)
    {
        $article = $this->publishedArticles(JsonStore::read()['blogPosts'] ?? [])
            ->first(fn (array $item) => (string) ($item['id'] ?? '') === $id || Str::slug((string) ($item['title'] ?? '')) === $id);

        abort_unless($article, 404);

        return view('blog.show', ['article' => $this->articleForView($article)]);
    }

    private function publicProperties(mixed $items): Collection
    {
        return collect(is_array($items) ? $items : [])
            ->filter(function ($item): bool {
                if (!is_array($item)) {
                    return false;
                }

                $approval = strtolower((string) ($item['approvalStatus'] ?? 'active'));
                $listing = strtolower((string) ($item['listingStatus'] ?? 'active'));

                return in_array($approval, ['active', 'approved'], true)
                    && in_array($listing, ['active', 'approved'], true);
            })
            ->sortByDesc(fn (array $item) => (string) ($item['createdAt'] ?? ''))
            ->values();
    }

    private function publishedArticles(mixed $items): Collection
    {
        return collect(is_array($items) ? $items : [])
            ->filter(fn ($item) => is_array($item) && ($item['published'] ?? true))
            ->sortByDesc(fn (array $item) => (string) ($item['createdAt'] ?? ''))
            ->values();
    }

    private function directoryAgents(array $data): Collection
    {
        $profiles = collect($data['mobileAgents'] ?? [])
            ->merge($data['cityAgents'] ?? [])
            ->merge(collect($data['users'] ?? [])->filter(
                fn ($user) => is_array($user) && strtolower((string) ($user['role'] ?? '')) === 'agent'
                    && !in_array(strtolower((string) ($user['status'] ?? 'active')), ['inactive', 'blocked', 'suspended'], true),
            ))
            ->filter(fn ($agent) => is_array($agent))
            ->map(function (array $agent): array {
                $photo = $agent['profilePhoto'] ?? $agent['photo'] ?? $agent['avatar'] ?? null;

                return [
                    'id' => $agent['id'] ?? $agent['userId'] ?? null,
                    'name' => $agent['name'] ?? $agent['fullName'] ?? 'OG Landmark agent',
                    'title' => $agent['title'] ?? $agent['designation'] ?? $agent['specialty'] ?? 'Property adviser',
                    'city' => $agent['city'] ?? $agent['location'] ?? null,
                    'profilePhoto' => $photo,
                    'bio' => $agent['bio'] ?? $agent['description'] ?? null,
                    'experienceYears' => $agent['experienceYears'] ?? $agent['experience'] ?? null,
                    'specialties' => $agent['specialties'] ?? [],
                    'publicPhone' => '03011484303',
                    'publicEmail' => $agent['publicEmail'] ?? null,
                ];
            })
            ->filter(fn (array $agent) => $agent['id'] !== null)
            ->unique(fn (array $agent) => (string) $agent['id'])
            ->values();

        return $profiles;
    }

    private function propertyForView(array $property): object
    {
        $images = is_array($property['images'] ?? null) ? $property['images'] : [];
        $cover = $property['coverImage'] ?? $property['image'] ?? $images[0] ?? null;
        if (is_array($cover)) {
            $cover = $cover['url'] ?? $cover['path'] ?? null;
        }

        foreach (['sellerEmail', 'sellerPhone', 'ownerEmail', 'ownerPhone', 'userEmail', 'userPhone'] as $privateField) {
            unset($property[$privateField]);
        }

        $property['coverImage'] = $cover;
        if ($images === [] && $cover) {
            $images = [$cover];
        }
        $property['images'] = $images;
        $property['propertyType'] = $property['propertyType'] ?? $property['type'] ?? null;
        $property['bedrooms'] = $property['bedrooms'] ?? $property['beds'] ?? null;
        $property['bathrooms'] = $property['bathrooms'] ?? $property['baths'] ?? null;

        return (object) $property;
    }

    private function buyerViewState(Request $request, array $data): array
    {
        $user = $this->sessionUser($request);
        $isBuyer = $user !== null && strtolower((string) ($user['role'] ?? '')) === 'buyer';

        return [
            'buyerSignedIn' => $isBuyer,
            'savedPropertyIds' => $isBuyer
                ? SavedPropertyStore::idsForUser($data, (string) ($user['id'] ?? ''))
                : [],
        ];
    }

    private function sessionUser(Request $request): ?array
    {
        $token = (string) $request->session()->get('api_token', '');
        if ($token === '') {
            return null;
        }

        try {
            $session = DB::table('auth_sessions')
                ->where('token_hash', hash('sha256', $token))
                ->where('expires_at', '>', now())
                ->first();
            if (!$session) {
                return null;
            }

            return collect(JsonStore::read()['users'] ?? [])
                ->first(fn ($candidate) => is_array($candidate) && (string) ($candidate['id'] ?? '') === (string) $session->user_id);
        } catch (\Throwable) {
            return null;
        }
    }

    private function agentForView(array $agent): object
    {
        return (object) $agent;
    }

    private function articleForView(array $article): object
    {
        $cover = $article['coverImage'] ?? $article['image'] ?? null;
        $article['coverImage'] = is_array($cover) ? ($cover['url'] ?? $cover['path'] ?? null) : $cover;

        return (object) $article;
    }
}