<?php

namespace App\Http\Middleware;

use App\Services\LegacyDataStore;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class LegacyBearerAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if (! $token) {
            return new JsonResponse(['error' => 'Authentication required. Please log in.'], 401);
        }

        $user = null;
        try {
            $session = DB::table('auth_sessions')
                ->where('token_hash', hash('sha256', $token))
                ->where('expires_at', '>', now())
                ->first();

            if ($session) {
                $user = collect(app(LegacyDataStore::class)->read()['users'] ?? [])
                    ->first(fn (array $candidate): bool => (string) ($candidate['id'] ?? '') === (string) $session->user_id);
            }
        } catch (Throwable) {
            if (! app()->environment('local')) {
                return new JsonResponse(['error' => 'Authentication service is unavailable.'], 503);
            }
        }

        // Website preview sessions are held by its local Express process rather
        // than Laravel's auth_sessions table. Ask that process to validate the
        // existing bearer token; LegacyAdminAuth still checks its returned
        // server-owned role and permissions before any admin route runs.
        if (! $user && app()->environment('local')) {
            try {
                $response = Http::acceptJson()
                    ->withToken($token)
                    ->timeout(2)
                    ->get((string) config('services.og_landmark.website_auth_url'));
                if ($response->successful()) {
                    $payload = $response->json();
                    $user = is_array($payload['user'] ?? null)
                        ? $payload['user']
                        : (is_array($payload) ? $payload : null);
                }
            } catch (Throwable) {
                // The response below remains the same as an invalid/expired session.
            }
        }

        if (! is_array($user) || in_array($user['status'] ?? '', ['Inactive', 'Suspended'], true)) {
            return new JsonResponse(['error' => 'Authentication required. Please log in.'], 401);
        }

        $request->attributes->set('legacyUser', $user);
        return $next($request);
    }
}
