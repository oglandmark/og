<?php

namespace App\Http\Controllers;

use App\Services\JsonStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PortalActionController extends Controller
{
    public function saveProperty(Request $request, string $id): RedirectResponse
    {
        return $this->setSavedProperty($request, $id, true);
    }

    public function removeSavedProperty(Request $request, string $id): RedirectResponse
    {
        return $this->setSavedProperty($request, $id, false);
    }

    public function storeInquiry(Request $request, string $id): RedirectResponse
    {
        $user = $this->sessionUser($request);
        if (!$user) {
            return redirect()->route('auth.login')->with('auth_message', 'Please sign in to send and track your enquiry.');
        }
        abort_unless(in_array(strtolower((string) ($user['role'] ?? '')), ['user', 'buyer', 'seller'], true), 403);

        $validated = $request->validate([
            'message' => ['required', 'string', 'min:5', 'max:5000'],
        ]);
        $property = $this->publicProperty($id);
        if (!$property) {
            return back()->withInput()->withErrors(['property' => 'This listing is no longer available for enquiries.']);
        }

        $result = $this->api($request, 'inquiries', 'POST', [
            'propertyId' => $property['id'],
            'clientName' => (string) ($user['name'] ?? ''),
            'clientEmail' => (string) ($user['email'] ?? ''),
            'message' => trim($validated['message']),
        ]);
        if ($result['status'] < 200 || $result['status'] >= 300) {
            return back()->withInput()->withErrors([
                'inquiry' => $result['data']['error'] ?? 'Your enquiry could not be sent. Please try again.',
            ]);
        }

        return redirect()->route('properties.show', $id)
            ->with('success', 'Your enquiry has been sent and saved to My inquiries.');
    }
    public function storeProperty(Request $request): RedirectResponse
    {
        $user = $this->sessionUser($request);
        if (!$user) {
            return redirect()->route('auth.login')->with('auth_message', 'Please sign in to continue.');
        }
        abort_unless(in_array(strtolower((string) ($user['role'] ?? '')), ['user', 'buyer', 'seller', 'developer'], true), 403);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'type' => ['required', 'string', 'max:80'],
            'purpose' => ['required', 'in:For Sale,For Rent'],
            'city' => ['required', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:240'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'area' => ['nullable', 'string', 'max:80'],
            'bedrooms' => ['nullable', 'integer', 'min:0', 'max:50'],
            'bathrooms' => ['nullable', 'integer', 'min:0', 'max:50'],
            'description' => ['nullable', 'string', 'max:5000'],
            'image_urls' => ['nullable', 'string', 'max:4000'],
        ]);

        $images = collect(preg_split('/[\r\n,]+/', (string) ($validated['image_urls'] ?? '')) ?: [])
            ->map(fn ($url) => trim($url))
            ->filter()
            ->values();
        foreach ($images as $image) {
            if (!filter_var($image, FILTER_VALIDATE_URL) || !in_array(strtolower((string) parse_url($image, PHP_URL_SCHEME)), ['http', 'https'], true)) {
                return back()->withInput()->withErrors(['image_urls' => 'Enter valid http or https image links, one per line.']);
            }
        }

        $payload = [
            'title' => trim($validated['title']),
            'type' => $validated['type'],
            'purpose' => $validated['purpose'],
            'city' => trim($validated['city']),
            'address' => trim((string) ($validated['address'] ?? '')),
            'price' => filled($validated['price'] ?? null) ? (float) $validated['price'] : null,
            'area' => trim((string) ($validated['area'] ?? '')),
            'bedrooms' => filled($validated['bedrooms'] ?? null) ? (int) $validated['bedrooms'] : null,
            'bathrooms' => filled($validated['bathrooms'] ?? null) ? (int) $validated['bathrooms'] : null,
            'description' => trim((string) ($validated['description'] ?? '')),
            'images' => $images->all(),
        ];

        $result = $this->api($request, 'properties', 'POST', $payload);
        if ($result['status'] < 200 || $result['status'] >= 300) {
            return back()->withInput()->withErrors([
                'property' => $result['data']['error'] ?? 'Your listing could not be submitted.',
            ]);
        }

        return redirect()->route('portal.page', ['role' => 'user', 'page' => 'listings'])
            ->with('success', 'Your property has been submitted for review.');
    }

    public function moderateProperty(Request $request, string $id, string $action): RedirectResponse
    {
        $user = $this->sessionUser($request);
        if (!$user) {
            return redirect()->route('auth.login', ['role' => 'admin'])->with('auth_message', 'Please sign in to continue.');
        }
        abort_unless(strtolower((string) ($user['role'] ?? '')) === 'admin', 403);
        abort_unless(in_array($action, ['approve', 'reject', 'request-changes', 'verify', 'feature'], true), 404);

        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $result = $this->api($request, 'properties/' . rawurlencode($id) . '/' . $action, 'POST', $validated);
        if ($result['status'] < 200 || $result['status'] >= 300) {
            return back()->withErrors([
                'property' => $result['data']['error'] ?? 'This property could not be updated.',
            ]);
        }

        return back()->with('success', match ($action) {
            'approve', 'verify' => 'The property listing has been approved.',
            'reject' => 'The property listing has been rejected.',
            'request-changes' => 'A correction request has been sent to the seller.',
            default => 'The property listing has been updated.',
        });
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

    private function api(Request $request, string $path, string $method, array $payload): array
    {
        $token = (string) $request->session()->get('api_token', '');
        $apiRequest = Request::create('/api/' . $path, $method, $payload);
        $apiRequest->headers->set('Authorization', 'Bearer ' . $token);

        try {
            $response = app(ApiController::class)->handle($apiRequest, $path);
        } catch (\Throwable $exception) {
            report($exception);
            return ['status' => 503, 'data' => ['error' => 'The portal service is temporarily unavailable.']];
        }

        if (!$response instanceof JsonResponse) {
            return ['status' => 500, 'data' => ['error' => 'The portal service returned an unexpected response.']];
        }

        return ['status' => $response->getStatusCode(), 'data' => $response->getData(true) ?? []];
    }
    private function setSavedProperty(Request $request, string $id, bool $shouldBeSaved): RedirectResponse
    {
        $user = $this->sessionUser($request);
        if (!$user) {
            return redirect()->route('auth.login')->with('auth_message', 'Please sign in to save homes.');
        }
        abort_unless(in_array(strtolower((string) ($user['role'] ?? '')), ['user', 'buyer', 'seller'], true), 403);

        if (!ctype_digit($id) || (int) $id < 1 || !$this->publicProperty($id)) {
            return back()->withErrors(['property' => 'This listing is no longer available to save.']);
        }

        $userId = (string) $user['id'];
        $listPath = 'saved/' . rawurlencode($userId);
        $result = $this->api($request, $listPath, 'GET', []);
        if ($result['status'] < 200 || $result['status'] >= 300 || !is_array($result['data'])) {
            return back()->withErrors(['saved' => 'Your saved homes could not be loaded. Please try again.']);
        }

        $savedIds = collect($result['data'])
            ->map(fn ($savedId) => (string) $savedId)
            ->all();
        $isSaved = in_array($id, $savedIds, true);

        if ($isSaved !== $shouldBeSaved) {
            $result = $this->api(
                $request,
                $listPath . '/' . rawurlencode($id),
                'POST',
                [],
            );
            if ($result['status'] < 200 || $result['status'] >= 300 || (bool) ($result['data']['saved'] ?? false) !== $shouldBeSaved) {
                return back()->withErrors(['saved' => 'Your saved homes could not be updated. Please try again.']);
            }
        }

        return back()->with('success', $shouldBeSaved ? 'Home saved to your shortlist.' : 'Home removed from your saved homes.');
    }

    private function publicProperty(string $id): ?array
    {
        return collect(JsonStore::read()['properties'] ?? [])->first(function ($property) use ($id): bool {
            if (!is_array($property) || (string) ($property['id'] ?? '') !== $id) {
                return false;
            }

            return in_array(strtolower((string) ($property['approvalStatus'] ?? 'active')), ['active', 'approved'], true)
                && in_array(strtolower((string) ($property['listingStatus'] ?? 'active')), ['active', 'approved'], true);
        });
    }
}