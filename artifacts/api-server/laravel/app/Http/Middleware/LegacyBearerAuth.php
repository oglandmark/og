<?php

namespace App\Http\Middleware;

use App\Services\LegacyDataStore;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        try {
            $session = DB::table('auth_sessions')
                ->where('token_hash', hash('sha256', $token))
                ->where('expires_at', '>', now())
                ->first();

            if (! $session) {
                return new JsonResponse(['error' => 'Authentication required. Please log in.'], 401);
            }

            $user = collect(app(LegacyDataStore::class)->read()['users'] ?? [])
                ->first(fn (array $candidate): bool => (string) ($candidate['id'] ?? '') === (string) $session->user_id);

            if (! $user || in_array($user['status'] ?? '', ['Inactive', 'Suspended'], true)) {
                return new JsonResponse(['error' => 'Authentication required. Please log in.'], 401);
            }

            $request->attributes->set('legacyUser', $user);
            return $next($request);
        } catch (Throwable) {
            return new JsonResponse(['error' => 'Authentication service is unavailable.'], 503);
        }
    }
}
