<?php

namespace App\Http\Controllers;

use App\Services\JsonStore;
use App\Services\SavedPropertyStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PortalController extends Controller
{
    private const NAVIGATION = [
        'buyer' => [
            ['label' => 'Overview', 'page' => 'dashboard'],
            ['label' => 'Saved homes', 'page' => 'saved-homes'],
            ['label' => 'My inquiries', 'page' => 'inquiries'],
            ['label' => 'Offers', 'page' => 'offers'],
            ['label' => 'Visits', 'page' => 'visits'],
            ['label' => 'Account', 'page' => 'account'],
        ],
        'seller' => [
            ['label' => 'Overview', 'page' => 'dashboard'],
            ['label' => 'My listings', 'page' => 'listings'],
            ['label' => 'Add a property', 'page' => 'add-property'],
            ['label' => 'Buyer inquiries', 'page' => 'leads'],
            ['label' => 'Offers', 'page' => 'offers'],
            ['label' => 'Account', 'page' => 'account'],
        ],
        'agent' => [
            ['label' => 'Overview', 'page' => 'dashboard'],
            ['label' => 'My clients', 'page' => 'clients'],
            ['label' => 'Listings', 'page' => 'listings'],
            ['label' => 'Leads', 'page' => 'leads'],
            ['label' => 'Calendar', 'page' => 'calendar'],
            ['label' => 'Performance', 'page' => 'performance'],
            ['label' => 'Account', 'page' => 'account'],
        ],
        'admin' => [
            ['label' => 'Overview', 'page' => 'dashboard'],
            ['label' => 'Properties', 'page' => 'properties'],
            ['label' => 'Inquiries', 'page' => 'inquiries'],
            ['label' => 'Website leads', 'page' => 'website-leads'],
            ['label' => 'Users', 'page' => 'users'],
            ['label' => 'Agents', 'page' => 'agents'],
            ['label' => 'Journal', 'page' => 'blog'],
        ],
    ];

    public function show(Request $request, string $role, ?string $page = null)
    {
        $role = strtolower($role);
        $page = trim((string) ($page ?: 'dashboard'), '/');
        abort_unless(array_key_exists($role, self::NAVIGATION), 404);

        $user = $this->sessionUser($request);
        if (!$user) {
            $request->session()->forget(['portal_user', 'api_token']);
            return redirect()->route('auth.login', ['role' => $role])
                ->with('auth_message', 'Please sign in to continue.');
        }
        unset($user['password']);

        $userRole = strtolower((string) ($user['role'] ?? 'buyer'));
        $roleMatches = $role === 'admin'
            ? $userRole === 'admin'
            : $userRole === $role || ($role === 'seller' && $userRole === 'developer');

        abort_unless($roleMatches, 403, 'You do not have access to this portal.');

        $data = JsonStore::read();
        $userId = (string) ($user['id'] ?? '');
        $properties = collect($data['properties'] ?? [])->filter(fn ($item) => is_array($item));
        $inquiries = collect($data['inquiries'] ?? [])->filter(fn ($item) => is_array($item));
        $offers = collect($data['offers'] ?? [])->filter(fn ($item) => is_array($item));
        $appointments = collect($data['appointments'] ?? [])->filter(fn ($item) => is_array($item));
        $websiteLeads = collect($data['websiteLeads'] ?? [])->filter(fn ($item) => is_array($item));
        $savedHomes = collect(SavedPropertyStore::recordsForUser($data, $userId));

        $ownedProperties = $properties->filter(fn (array $item) => $this->matchesUser($item, $userId, ['sellerId', 'userId', 'ownerId']));
        $userInquiries = $inquiries->filter(fn (array $item) => $this->matchesUser($item, $userId, ['buyerId', 'userId', 'sellerId', 'agentId']));
        $buyerInquiries = $inquiries->filter(fn (array $item) => $this->isBuyerInquiryFor($item, $userId));
        $userOffers = $offers->filter(fn (array $item) => $this->matchesUser($item, $userId, ['buyerId', 'userId', 'sellerId', 'agentId']));
        $userAppointments = $appointments->filter(fn (array $item) => $this->matchesUser($item, $userId, ['buyerId', 'userId', 'sellerId', 'agentId']));
        $agentLeads = collect($data['agentLeads'] ?? [])->filter(
            fn ($item) => is_array($item) && $this->matchesUser($item, $userId, ['agentId', 'userId', 'assignedTo']),
        );

        $rows = $this->rowsForPage($role, $page, $data, [
            'properties' => $ownedProperties,
            'inquiries' => $userInquiries,
            'buyerInquiries' => $buyerInquiries,
            'offers' => $userOffers,
            'appointments' => $userAppointments,
            'saved' => $savedHomes,
            'agentLeads' => $agentLeads,
            'websiteLeads' => $websiteLeads,
        ], $userId);

        $stats = match ($role) {
            'buyer' => [
                ['label' => 'Saved homes', 'value' => $savedHomes->count()],
                ['label' => 'Inquiries', 'value' => $buyerInquiries->count()],
                ['label' => 'Offers', 'value' => $userOffers->count()],
                ['label' => 'Upcoming visits', 'value' => $userAppointments->count()],
            ],
            'seller' => [
                ['label' => 'My listings', 'value' => $ownedProperties->count()],
                ['label' => 'Active listings', 'value' => $ownedProperties->filter(fn ($item) => strtolower((string) ($item['listingStatus'] ?? '')) === 'active')->count()],
                ['label' => 'Buyer inquiries', 'value' => $userInquiries->count()],
                ['label' => 'Offers received', 'value' => $userOffers->count()],
            ],
            'agent' => [
                ['label' => 'Assigned listings', 'value' => $properties->filter(fn ($item) => $this->matchesUser($item, $userId, ['agentId']))->count()],
                ['label' => 'Client leads', 'value' => $agentLeads->count()],
                ['label' => 'Visits', 'value' => $userAppointments->count()],
                ['label' => 'Inquiries', 'value' => $userInquiries->count()],
            ],
            default => [
                ['label' => 'Properties', 'value' => $properties->count()],
                ['label' => 'Users', 'value' => count($data['users'] ?? [])],
                ['label' => 'Inquiries', 'value' => $inquiries->count()],
                ['label' => 'Website leads', 'value' => $websiteLeads->count()],
            ],
        };

        $navigation = collect(self::NAVIGATION[$role])->map(fn (array $item) => [
            ...$item,
            'url' => route('portal.page', ['role' => $role, 'page' => $item['page']]),
            'active' => $page === $item['page'],
        ])->all();

        return view('portal.show', [
            'portalRole' => $role,
            'portalPage' => $page,
            'portalTitle' => $this->pageTitle($role, $page),
            'portalUser' => (object) $user,
            'portalStats' => $stats,
            'portalRows' => $rows->take(30)->map(fn (array $item) => (object) $item)->values()->all(),
            'navigation' => $navigation,
        ]);
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

    private function rowsForPage(string $role, string $page, array $data, array $sets, string $userId)
    {
        if ($role === 'admin') {
            return (match ($page) {
                'properties' => collect($data['properties'] ?? []),
                'inquiries' => $sets['inquiries'],
                'website-leads' => $sets['websiteLeads'],
                'users' => collect($data['users'] ?? [])->map(fn ($user) => is_array($user) ? array_diff_key($user, ['password' => true]) : $user),
                'agents' => collect($data['mobileAgents'] ?? [])->merge($data['cityAgents'] ?? []),
                'blog' => collect($data['blogPosts'] ?? []),
                default => collect($data['properties'] ?? [])->take(8),
            })->filter(fn ($item) => is_array($item))->values();
        }

        if ($role === 'buyer') {
            return match ($page) {
                'saved-homes' => $sets['saved']->map(fn ($item) => $this->attachProperty($item, $data)),
                'inquiries' => $sets['inquiries'],
                'offers' => $sets['offers'],
                'visits' => $sets['appointments'],
                default => $sets['buyerInquiries']->take(8),
            };
        }

        if ($role === 'seller') {
            return match ($page) {
                'listings', 'add-property' => $sets['properties'],
                'leads' => $sets['inquiries'],
                'offers' => $sets['offers'],
                default => $sets['properties']->take(8),
            };
        }

        return (match ($page) {
            'clients', 'leads' => $sets['agentLeads']->merge($sets['inquiries']),
            'listings' => collect($data['properties'] ?? [])->filter(fn ($item) => is_array($item) && $this->matchesUser($item, $userId, ['agentId'])),
            'calendar' => $sets['appointments'],
            'performance' => $sets['agentLeads']->take(8),
            default => $sets['agentLeads']->take(8),
        })->filter(fn ($item) => is_array($item))->values();
    }

    private function attachProperty(array $saved, array $data): array
    {
        $propertyId = $saved['propertyId'] ?? $saved['id'] ?? null;
        $property = collect($data['properties'] ?? [])->first(
            fn ($item) => is_array($item) && (string) ($item['id'] ?? '') === (string) $propertyId,
        );

        return $property
            ? array_merge($property, ['savedAt' => $saved['createdAt'] ?? $saved['savedAt'] ?? null])
            : $saved;
    }

    private function matchesUser(array $item, string $userId, array $fields): bool
    {
        foreach ($fields as $field) {
            if (isset($item[$field]) && (string) $item[$field] === $userId) {
                return true;
            }
        }

        return false;
    }

    private function isBuyerInquiryFor(array $item, string $userId): bool
    {
        if (isset($item['buyerId'])) {
            return (string) $item['buyerId'] === $userId;
        }

        return isset($item['userId']) && (string) $item['userId'] === $userId;
    }

    private function pageTitle(string $role, string $page): string
    {
        foreach (self::NAVIGATION[$role] as $item) {
            if ($item['page'] === $page) {
                return $item['label'];
            }
        }

        return ucwords(str_replace(['-', '_'], ' ', $page));
    }
}