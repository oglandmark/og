<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AuthController extends Controller
{
    public function register(Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'firstName' => ['required', 'string', 'max:120'],
            'lastName' => ['nullable', 'string', 'max:120'],
            'username' => ['nullable', 'string', 'max:30', 'regex:/^[a-zA-Z][a-zA-Z0-9._-]{2,29}$/'],
            'email' => ['nullable', 'email', 'max:320'],
            'phone' => ['required', 'string', 'max:40', 'regex:/^[+0-9().\s-]+$/'],
            'password' => ['required', 'string', 'min:8', 'max:1024', 'regex:/^(?=.*[A-Za-z])(?=.*\d).+$/'],
            'confirmPassword' => ['nullable', 'string', 'max:1024'],
        ]);
        $password = $validated['password'];
        if (($validated['confirmPassword'] ?? $password) !== $password) {
            return response()->json(['error' => 'Passwords do not match.'], 400);
        }

        $email = mb_strtolower(trim((string) ($validated['email'] ?? '')));
        $requestedUsername = mb_strtolower(trim((string) ($validated['username'] ?? '')));
        $phone = trim($validated['phone']);
        $phoneKey = $this->normalizedPhone($phone);
        if (strlen($phoneKey) < 10 || strlen($phoneKey) > 15) {
            return response()->json(['error' => 'Please enter a valid mobile number.'], 400);
        }

        $token = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
        $ttlHours = max(1, (int) config('app.session_ttl_hours', env('SESSION_TTL_HOURS', 168)));
        $result = $store->mutate(function (array &$data) use (
            $validated, $password, $email, $requestedUsername, $phone, $phoneKey, $token, $ttlHours
        ): array {
            $data['users'] = array_values(array_filter($data['users'] ?? [], 'is_array'));
            foreach ($data['users'] as $existing) {
                if ($email !== '' && mb_strtolower(trim((string) ($existing['email'] ?? ''))) === $email) {
                    return ['error' => 'An account with this email already exists', 'status' => 409];
                }
                if ($requestedUsername !== '' && mb_strtolower(trim((string) ($existing['username'] ?? ''))) === $requestedUsername) {
                    return ['error' => 'This username is already in use. Please choose another.', 'status' => 409];
                }
                if ($this->normalizedPhone((string) ($existing['phone'] ?? '')) === $phoneKey) {
                    return ['error' => 'This mobile number is already registered.', 'status' => 409];
                }
            }

            $usernameBase = preg_replace('/[^a-z0-9._-]/', '', $requestedUsername !== ''
                ? $requestedUsername
                : explode('@', $email !== '' ? $email : mb_strtolower($validated['firstName']))[0]);
            $usernameBase = $usernameBase ?: 'user';
            if (! preg_match('/^[a-z]/', $usernameBase)) $usernameBase = 'user'.$usernameBase;
            $usernameBase = mb_substr($usernameBase, 0, 24);
            $username = $usernameBase;
            $suffix = 1;
            while (collect($data['users'])->contains(
                fn (array $existing): bool => mb_strtolower(trim((string) ($existing['username'] ?? ''))) === $username
            )) {
                $username = mb_substr($usernameBase, 0, 24 - strlen((string) $suffix)).$suffix;
                $suffix++;
            }

            $highestId = max(
                (int) ($data['nextId'] ?? 1000),
                ...array_map(static fn (array $existing): int => (int) ($existing['id'] ?? 0), $data['users'] ?: [['id' => 0]])
            );
            $id = $highestId + 1;
            $data['nextId'] = $id;
            $salt = bin2hex(random_bytes(16));
            $user = [
                'id' => $id,
                'name' => trim($validated['firstName'].' '.($validated['lastName'] ?? '')),
                'username' => $username,
                'email' => $email,
                'phone' => $phone,
                'accountType' => 'User',
                'permissions' => [],
                'role' => 'User',
                'status' => 'Active',
                'password' => 'pbkdf2:'.$salt.':'.hash_pbkdf2('sha512', $password, $salt, 100000, 128),
                'joinedDate' => now()->toDateString(),
                'createdAt' => now()->toIso8601String(),
            ];
            $data['users'][] = $user;

            DB::table('auth_sessions')->insert([
                'token_hash' => hash('sha256', $token),
                'user_id' => $id,
                'expires_at' => now()->addHours($ttlHours),
                'created_at' => now(),
            ]);

            return ['user' => $user];
        });

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']], $result['status']);
        }

        return response()->json([
            'user' => $this->publicUser($result['user']),
            'token' => $token,
        ], 201);
    }

    public function adminVerify(Request $request, LegacyDataStore $store): JsonResponse
    {
        if (! app()->environment('local')) {
            return response()->json(['error' => 'Local preview admin sign-in is unavailable.'], 404);
        }

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:320'],
            'password' => ['required', 'string', 'max:1024'],
        ]);
        $configuredPassword = getenv('LOCAL_PREVIEW_ADMIN_PASSWORD');
        if ($configuredPassword === false) {
            $configuredPassword = env('LOCAL_PREVIEW_ADMIN_PASSWORD', '');
        }
        $configuredPassword = (string) $configuredPassword;
        if ($configuredPassword === '') {
            return response()->json(['error' => 'Local preview admin password is not configured.'], 503);
        }
        $email = mb_strtolower(trim($validated['email']));
        if (
            ! hash_equals($configuredPassword, $validated['password'])
        ) {
            return response()->json(['error' => 'Invalid local preview credentials'], 401);
        }

        $user = $store->mutate(function (array &$data) use ($email, $configuredPassword): array {
            $data['users'] = is_array($data['users'] ?? null) ? $data['users'] : [];
            $user = collect($data['users'])->first(
                fn (array $candidate): bool => mb_strtolower(trim((string) ($candidate['email'] ?? ''))) === $email
            );
            $salt = bin2hex(random_bytes(16));
            $passwordHash = 'pbkdf2:'.$salt.':'.hash_pbkdf2('sha512', $configuredPassword, $salt, 100000, 128);
            if ($user) {
                $user['password'] = $passwordHash;
                $user['role'] = 'Admin';
                $user['status'] = 'Active';
                foreach ($data['users'] as $index => $existing) {
                    if ((string) ($existing['id'] ?? '') === (string) ($user['id'] ?? '')) {
                        $data['users'][$index] = $user;
                        break;
                    }
                }
                return $user;
            }

            $id = max(array_map(
                static fn (array $existing): int => (int) ($existing['id'] ?? 0),
                $data['users'] ?: [['id' => 0]]
            )) + 1;
            $user = [
                'id' => $id,
                'name' => 'Local Preview Admin',
                'email' => $email,
                'username' => 'local_preview_admin',
                'password' => $passwordHash,
                'role' => 'Admin',
                'status' => 'Active',
                'approvalStatus' => 'Approved',
                'verificationStatus' => 'verified',
                'createdAt' => now()->toIso8601String(),
            ];
            $data['users'][] = $user;
            return $user;
        });

        $token = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
        $ttlHours = max(1, (int) config('app.session_ttl_hours', env('SESSION_TTL_HOURS', 168)));
        DB::table('auth_sessions')->insert([
            'token_hash' => hash('sha256', $token),
            'user_id' => (int) $user['id'],
            'expires_at' => now()->addHours($ttlHours),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'user' => $this->publicUser($user),
            'token' => $token,
        ]);
    }

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

    private function normalizedPhone(string $value): string
    {
        $digits = preg_replace('/\D+/', '', $value) ?? '';
        if (str_starts_with($digits, '0092')) return '92'.substr($digits, 4);
        if (str_starts_with($digits, '0') && strlen($digits) >= 10) return '92'.substr($digits, 1);
        return $digits;
    }

    private function publicUser(array $user): array
    {
        unset($user['password'], $user['resetToken'], $user['resetTokenHash'], $user['otp'], $user['secret']);
        return $user;
    }
}
