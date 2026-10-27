<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AuthController extends Controller
{
    public function login(Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['nullable', 'string', 'max:320'],
            'email' => ['sometimes', 'string', 'max:320'],
            'password' => ['required', 'string', 'max:1024'],
        ]);
        $identifier = trim((string) ($validated['identifier'] ?? $validated['email'] ?? ''));
        if ($identifier === '') {
            return response()->json(['error' => 'Email, username or mobile number and password are required'], 400);
        }
        $users = $store->read()['users'] ?? [];
        $user = collect($users)->first(fn (array $candidate): bool => $this->matchesIdentifier($candidate, $identifier));

        if (! $user || ! $this->verifyLegacyPassword((string) $validated['password'], (string) ($user['password'] ?? ''))) {
            return response()->json(['error' => 'Invalid email, username, mobile number or password'], 401);
        }
        if (in_array($user['status'] ?? '', ['Inactive', 'Suspended'], true)) {
            return response()->json(['error' => 'Account is suspended. Please contact admin.'], 403);
        }
        if (($user['role'] ?? '') === 'Agent' && in_array($user['approvalStatus'] ?? '', ['Pending', 'Rejected'], true)) {
            $pending = $user['approvalStatus'] === 'Pending';
            return response()->json([
                'error' => $pending
                    ? 'Your agent account is pending admin approval. You will be notified once approved.'
                    : 'Your agent account application was not approved. Please contact admin.',
                'code' => $pending ? 'AGENT_PENDING' : 'AGENT_REJECTED',
            ], 403);
        }

        $token = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
        $ttlHours = max(1, (int) config('app.session_ttl_hours', env('SESSION_TTL_HOURS', 168)));
        DB::table('auth_sessions')->insert([
            'token_hash' => hash('sha256', $token),
            'user_id' => (int) $user['id'],
            'expires_at' => now()->addHours($ttlHours),
            'created_at' => now(),
        ]);

        return response()->json(['user' => $this->publicUser($user), 'token' => $token]);
    }

    public function logout(Request $request): JsonResponse
    {
        if ($token = $request->bearerToken()) {
            DB::table('auth_sessions')->where('token_hash', hash('sha256', $token))->delete();
        }

        return response()->json(['success' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->publicUser($request->attributes->get('legacyUser', []))]);
    }

    private function matchesIdentifier(array $user, string $identifier): bool
    {
        $needle = mb_strtolower(trim($identifier));
        $phone = preg_replace('/\D+/', '', $identifier);
        if (str_starts_with($phone, '0092')) {
            $phone = '92'.substr($phone, 4);
        } elseif (str_starts_with($phone, '0') && strlen($phone) >= 10) {
            $phone = '92'.substr($phone, 1);
        }

        $email = mb_strtolower(trim((string) ($user['email'] ?? '')));
        $username = mb_strtolower(trim((string) ($user['username'] ?? '')));
        $storedPhone = preg_replace('/\D+/', '', (string) ($user['phone'] ?? ''));
        if (str_starts_with($storedPhone, '0') && strlen($storedPhone) >= 10) {
            $storedPhone = '92'.substr($storedPhone, 1);
        }

        return ($email !== '' && $email === $needle)
            || ($username !== '' && $username === $needle)
            || ($phone !== '' && $phone === $storedPhone);
    }

    private function verifyLegacyPassword(string $plain, string $stored): bool
    {
        $parts = explode(':', $stored);
        if (count($parts) !== 3 || $parts[0] !== 'pbkdf2') {
            return false;
        }
        $candidate = hash_pbkdf2('sha512', $plain, $parts[1], 100000, 128);
        return hash_equals($parts[2], $candidate);
    }

    private function publicUser(array $user): array
    {
        unset($user['password'], $user['resetToken'], $user['resetTokenHash'], $user['otp'], $user['secret']);
        return $user;
    }
}
