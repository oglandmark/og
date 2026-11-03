<?php

namespace App\Http\Controllers\Api;

use App\Mail\SignupVerificationOtp;
use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

final class AuthController extends Controller
{
    public function register(Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'firstName' => ['required', 'string', 'max:120'],
            'lastName' => ['nullable', 'string', 'max:120'],
            'username' => ['nullable', 'string', 'max:30', 'regex:/^[a-zA-Z][a-zA-Z0-9._-]{2,29}$/'],
            'email' => ['required', 'email', 'max:320'],
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
        $otp = (string) random_int(100000, 999999);
        $salt = bin2hex(random_bytes(16));
        $passwordHash = 'pbkdf2:'.$salt.':'.hash_pbkdf2('sha512', $password, $salt, 100000, 128);
        $pending = $store->mutate(function (array &$data) use (
            $validated, $email, $requestedUsername, $phone, $phoneKey, $passwordHash, $otp
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

            $data['pendingRegistrations'] = is_array($data['pendingRegistrations'] ?? null) ? $data['pendingRegistrations'] : [];
            $data['pendingRegistrations'][$email] = [
                'firstName' => trim($validated['firstName']),
                'lastName' => trim((string) ($validated['lastName'] ?? '')),
                'username' => $username,
                'email' => $email,
                'phone' => $phone,
                'password' => $passwordHash,
                'createdAt' => now()->toIso8601String(),
                'lastSentAt' => now()->toIso8601String(),
            ];
            DB::table('auth_challenges')->updateOrInsert(
                ['email' => $email, 'purpose' => 'signup'],
                ['code_hash' => hash('sha256', $otp), 'attempts' => 0, 'expires_at' => now()->addMinutes(10)]
            );
            return ['email' => $email];
        });

        if (isset($pending['error'])) {
            return response()->json(['error' => $pending['error']], $pending['status']);
        }

        try {
            $this->sendRegistrationOtp($pending['email'], $otp);
        } catch (Throwable $error) {
            $store->mutate(function (array &$data) use ($pending): void {
                unset($data['pendingRegistrations'][$pending['email']]);
                DB::table('auth_challenges')->where('email', $pending['email'])->where('purpose', 'signup')->delete();
            });
            report($error);
            return response()->json(['error' => 'Unable to send the verification email. Please try again later.'], 503);
        }

        return response()->json([
            'verificationRequired' => true,
            'email' => $pending['email'],
            'message' => 'A verification code has been sent to your email address.',
        ], 202);
    }

    public function verifyRegistrationEmail(Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:320'],
            'otp' => ['required', 'digits:6'],
        ]);
        $email = mb_strtolower(trim($validated['email']));
        $token = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
        $ttlHours = max(1, (int) config('app.session_ttl_hours', env('SESSION_TTL_HOURS', 168)));
        $result = $store->mutate(function (array &$data) use ($email, $validated, $token, $ttlHours): array {
            $challenge = DB::table('auth_challenges')
                ->where('email', $email)->where('purpose', 'signup')->lockForUpdate()->first();
            $pending = $data['pendingRegistrations'][$email] ?? null;
            if (! $challenge || ! is_array($pending) || now()->greaterThan($challenge->expires_at)) {
                return ['error' => 'The verification code expired. Request a new one.', 'status' => 410];
            }
            if ((int) $challenge->attempts >= 5) {
                return ['error' => 'Too many incorrect codes. Request a new one.', 'status' => 429];
            }
            if (! hash_equals((string) $challenge->code_hash, hash('sha256', $validated['otp']))) {
                DB::table('auth_challenges')->where('email', $email)->where('purpose', 'signup')
                    ->update(['attempts' => (int) $challenge->attempts + 1]);
                return ['error' => 'The verification code is incorrect.', 'status' => 422];
            }
            foreach ($data['users'] ?? [] as $existing) {
                $sameEmail = mb_strtolower(trim((string) ($existing['email'] ?? ''))) === $email;
                $sameUsername = mb_strtolower(trim((string) ($existing['username'] ?? ''))) === mb_strtolower((string) $pending['username']);
                $samePhone = $this->normalizedPhone((string) ($existing['phone'] ?? '')) === $this->normalizedPhone((string) $pending['phone']);
                if ($sameEmail || $sameUsername || $samePhone) {
                    unset($data['pendingRegistrations'][$email]);
                    DB::table('auth_challenges')->where('email', $email)->where('purpose', 'signup')->delete();
                    return ['error' => 'The registration details are already in use. Start registration again with different details.', 'status' => 409];
                }
            }
            $highestId = max(
                (int) ($data['nextId'] ?? 1000),
                ...array_map(static fn (array $existing): int => (int) ($existing['id'] ?? 0), $data['users'] ?: [['id' => 0]])
            );
            $id = $highestId + 1;
            $data['nextId'] = $id;
            $user = [
                'id' => $id,
                'name' => trim($pending['firstName'].' '.$pending['lastName']),
                'username' => $pending['username'],
                'email' => $email,
                'phone' => $pending['phone'],
                'accountType' => 'User',
                'permissions' => [],
                'role' => 'User',
                'status' => 'Active',
                'password' => $pending['password'],
                'emailVerifiedAt' => now()->toIso8601String(),
                'verificationStatus' => 'verified',
                'joinedDate' => now()->toDateString(),
                'createdAt' => now()->toIso8601String(),
            ];
            $data['users'][] = $user;
            unset($data['pendingRegistrations'][$email]);
            DB::table('auth_challenges')->where('email', $email)->where('purpose', 'signup')->delete();
            DB::table('auth_sessions')->insert([
                'token_hash' => hash('sha256', $token), 'user_id' => $id,
                'expires_at' => now()->addHours($ttlHours), 'created_at' => now(),
            ]);
            return ['user' => $user];
        });
        if (isset($result['error'])) return response()->json(['error' => $result['error']], $result['status']);
        return response()->json(['user' => $this->publicUser($result['user']), 'token' => $token]);
    }

    public function resendRegistrationEmail(Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate(['email' => ['required', 'email', 'max:320']]);
        $email = mb_strtolower(trim($validated['email']));
        $otp = (string) random_int(100000, 999999);
        $pending = $store->mutate(function (array &$data) use ($email, $otp): array {
            $record = $data['pendingRegistrations'][$email] ?? null;
            if (! is_array($record)) return ['error' => 'No pending registration was found.', 'status' => 404];
            if (now()->parse($record['lastSentAt'] ?? $record['createdAt'] ?? now())->addSeconds(60)->isFuture()) {
                return ['error' => 'Please wait before requesting another code.', 'status' => 429];
            }
            $record['lastSentAt'] = now()->toIso8601String();
            $data['pendingRegistrations'][$email] = $record;
            DB::table('auth_challenges')->updateOrInsert(
                ['email' => $email, 'purpose' => 'signup'],
                ['code_hash' => hash('sha256', $otp), 'attempts' => 0, 'expires_at' => now()->addMinutes(10)]
            );
            return ['email' => $email];
        });
        if (isset($pending['error'])) return response()->json(['error' => $pending['error']], $pending['status']);
        try {
            $this->sendRegistrationOtp($email, $otp);
        } catch (Throwable $error) {
            report($error);
            return response()->json(['error' => 'Unable to send the verification email. Please try again later.'], 503);
        }
        return response()->json(['verificationRequired' => true, 'email' => $email, 'message' => 'A new verification code has been sent.']);
    }

    private function sendRegistrationOtp(string $email, string $otp): void
    {
        $smtp = config('mail.mailers.smtp');
        if (! filter_var($smtp['username'] ?? '', FILTER_VALIDATE_EMAIL) || empty($smtp['password'])) {
            throw new RuntimeException('SMTP credentials are not configured.');
        }
        $from = (string) config('mail.from.address');
        if (! filter_var($from, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid SMTP sender address is not configured.');
        }
        Mail::mailer('smtp')->to($email)->send(
            (new SignupVerificationOtp($otp))->from($from, (string) config('mail.from.name', 'OG Landmark'))
        );
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
