<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class AccountMediaController extends Controller
{
    public function updateProfilePhoto(Request $request, LegacyDataStore $store): JsonResponse
    {
        return $this->updatePhoto($request, $store, 'profile');
    }

    public function updateCoverPhoto(Request $request, LegacyDataStore $store): JsonResponse
    {
        return $this->updatePhoto($request, $store, 'cover');
    }

    private function updatePhoto(Request $request, LegacyDataStore $store, string $kind): JsonResponse
    {
        $validated = $request->validate(['url' => ['required', 'string', 'max:2048']]);
        $url = trim($validated['url']);
        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path) || ! preg_match('#^/api/admin/property-media/[A-Za-z0-9._-]+$#', $path)) {
            throw ValidationException::withMessages([
                'url' => ['Choose a photo uploaded to this account.'],
            ]);
        }

        $user = $request->attributes->get('legacyUser', []);
        $userId = (string) ($user['id'] ?? '');
        $saved = $store->mutate(function (array &$data) use ($kind, $url, $userId): bool {
            foreach ($data['users'] ?? [] as $index => $account) {
                if ((string) ($account['id'] ?? '') !== $userId) continue;
                if ($kind === 'profile') {
                    $account['profilePhoto'] = $url;
                    $account['avatarUrl'] = $url;
                } else {
                    $account['coverPhoto'] = $url;
                }
                $account['updatedAt'] = now()->toISOString();
                $data['users'][$index] = $account;
                return true;
            }
            return false;
        });

        abort_unless($saved, 404, 'Account not found.');
        return response()->json(['url' => $url]);
    }
}
