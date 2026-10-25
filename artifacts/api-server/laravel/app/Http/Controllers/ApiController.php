<?php

namespace App\Http\Controllers;

use App\Services\JsonStore;
use App\Services\MediaStorage;
use App\Services\AccountDataDeletionService;
use App\Services\DeveloperApiService;
use App\Services\NotificationDeliveryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ApiController extends Controller
{
    private const ADMIN_TRUSTED_DEVICE_COOKIE = 'og_admin_trusted_device';
    private const ADMIN_TRUSTED_DEVICE_TTL_DAYS = 30;

    public function handle(Request $request, ?string $path = null)
    {
        $path = trim((string) ($path ?? ''), '/');
        $segments = $path === '' ? [] : explode('/', $path);
        $method = strtoupper($request->method());

        if (($segments[0] ?? '') === 'health' || ($segments[0] ?? '') === 'healthz') {
            return $this->health();
        }

        if (app()->environment('production') && !$this->databaseReady()) {
            return $this->json([
                'error' => 'Database is not ready. Check the MySQL settings and app_data import.',
                'code' => 'DB_NOT_READY',
            ], 503);
        }

        if (($segments[0] ?? '') === 'auth') {
            return $this->auth($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'properties') {
            return $this->properties($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'projects') {
            return app(DeveloperApiService::class)->publicProjects($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'developer') {
            $user = $this->currentUser($request, true);
            if ($this->isAdmin($user)) {
                $permission = ($segments[1] ?? '') === 'analytics' && $method === 'GET'
                    ? 'reports.view'
                    : 'content.manage';
                if (!$this->adminHasPermission($user, $permission, JsonStore::read())) {
                    return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => $permission], 403);
                }
            }
            return app(DeveloperApiService::class)->handle($request, array_slice($segments, 1), $method, $user);
        }

        if (($segments[0] ?? '') === 'saved-searches') {
            return $this->savedSearches($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'announcements') {
            return $this->publicAnnouncement($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'admin') {
            return $this->admin($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'users') {
            return $this->users($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'account') {
            return $this->account($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'saved') {
            return $this->saved($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'notifications' || ($segments[0] ?? '') === 'notification-preferences') {
            return $this->notifications($request, $segments, $method);
        }

        if (($segments[0] ?? '') === 'upload') {
            return $this->upload($request, array_slice($segments, 1));
        }

        if (($segments[0] ?? '') === 'mobile') {
            return $this->mobile($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'blog') {
            return $this->blog($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'site-content' && count($segments) === 1) {
            return $this->siteContent($method);
        }

        if (($segments[0] ?? '') === 'settings' && ($segments[1] ?? '') === 'hidden-react-agents') {
            return $this->hiddenReactAgents($request, $method);
        }

        if (($segments[0] ?? '') === 'mobile-agents' || ($segments[0] ?? '') === 'agents') {
            return $this->agents($request, $segments, $method);
        }

        if (($segments[0] ?? '') === 'offers' || ($segments[0] ?? '') === 'inquiries' || ($segments[0] ?? '') === 'appointments') {
            return $this->simpleCollection($request, $segments, $method);
        }

        if (($segments[0] ?? '') === 'conversations') {
            return $this->conversations($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'agent-admin-messages') {
            return $this->agentAdminMessages($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'agent-progress') {
            return $this->agentProgress($request, array_slice($segments, 1), $method);
        }

        if (($segments[0] ?? '') === 'my-properties') {
            return $this->myProperties($request);
        }

        if (($segments[0] ?? '') === 'comparison') {
            return $this->comparison($request, $method);
        }

        if (($segments[0] ?? '') === 'search' && ($segments[1] ?? '') === 'ai') {
            return $this->json(['answer' => 'Search suggestions are available through the property filters.', 'filters' => $request->all()]);
        }

        if ($this->isGenericCollection($segments)) {
            return $this->genericCollection($request, $segments, $method);
        }

        return $this->json(['error' => 'Not found'], 404);
    }

    private function health()
    {
        $database = $this->databaseReady() ? 'connected' : 'not_connected';
        $media = app(MediaStorage::class)->health();
        $productionMediaReady = !app()->environment('production') || $media['status'] === 'ready';
        $normalizedStorage = $this->normalizedCoreStorageStatus();
        $productionNormalizedReady = !app()->environment('production') || $normalizedStorage === 'ready';
        $ready = $database === 'connected' && $productionMediaReady && $productionNormalizedReady;
        return $this->json([
            'status' => $ready ? 'ok' : 'degraded',
            'database' => $database,
            'databaseProvider' => 'mysql',
            'framework' => 'laravel',
            'normalizedCoreStorage' => $normalizedStorage,
            'smtp' => config('mail.mailers.smtp.username') && config('mail.mailers.smtp.password')
                ? 'configured'
                : 'not_configured',
            'mediaBaseUrl' => $this->mediaBaseUrl(),
            'mediaStorage' => $media,
        ], $ready ? 200 : 503);
    }

    private function siteContent(string $method)
    {
        if ($method !== 'GET') return $this->json(['error' => 'Method not allowed'], 405);

        $content = JsonStore::read()['siteContent'] ?? null;
        return $this->json(is_array($content) && $content !== [] ? $content : false);
    }

    private function hiddenReactAgents(Request $request, string $method)
    {
        $data = JsonStore::read();
        $hiddenAgents = collect(is_array($data['hiddenReactAgents'] ?? null) ? $data['hiddenReactAgents'] : [])
            ->filter(fn ($name) => is_string($name) && trim($name) !== '')
            ->values();

        if ($method === 'GET') return $this->json($hiddenAgents);

        if ($method !== 'POST') return $this->json(['error' => 'Method not allowed'], 405);

        $user = $this->currentUser($request, true);
        if (!$this->isAdmin($user) || !$this->adminHasPermission($user, 'settings.manage', $data)) {
            return $this->json(['error' => 'Admin settings access required.'], 403);
        }

        $name = trim((string) $request->input('name', ''));
        if ($name === '') return $this->json(['error' => 'name required'], 400);

        if ($request->boolean('hidden')) {
            if (!$hiddenAgents->contains($name)) $hiddenAgents->push($name);
        } else {
            $hiddenAgents = $hiddenAgents->reject(fn ($item) => $item === $name)->values();
        }

        $data['hiddenReactAgents'] = $hiddenAgents->all();
        JsonStore::write($data);

        return $this->json(['success' => true, 'hiddenReactAgents' => $data['hiddenReactAgents']]);
    }

    private function normalizedCoreStorageStatus(): string
    {
        try {
            return app(\App\Services\NormalizedCoreStore::class)->isActive()
                ? 'ready'
                : 'not_active';
        } catch (\Throwable) {
            return 'not_ready';
        }
    }

    private function databaseReady(): bool
    {
        try {
            DB::select('SELECT 1');
            if (!app()->environment('production')) return true;
            foreach (['app_data', 'auth_sessions', 'auth_challenges'] as $table) {
                DB::select("SELECT 1 FROM `{$table}` LIMIT 0");
            }
            return DB::table('app_data')->where('id', 1)->exists();
        } catch (\Throwable) {
            // Keep healthz available so deployment configuration can be fixed.
            return false;
        }
    }

    private function auth(Request $request, array $parts, string $method)
    {
        $action = $parts[0] ?? '';

        if ($action === 'me' && $method === 'GET') {
            $user = $this->currentUser($request, true);
            return $this->json($this->safeUser($user));
        }

        if ($action === 'logout' && $method === 'POST') {
            $this->destroySession($request);
            return $this->json(['success' => true]);
        }

        if ($action === 'login' && $method === 'POST') {
            $input = $request->all();
            $identifier = strtolower(trim((string) ($input['identifier'] ?? $input['email'] ?? $input['username'] ?? $input['phone'] ?? '')));
            $password = (string) ($input['password'] ?? '');
            $data = JsonStore::read();
            $user = collect($data['users'] ?? [])->first(function ($candidate) use ($identifier) {
                return strtolower((string) ($candidate['email'] ?? '')) === $identifier
                    || strtolower((string) ($candidate['username'] ?? '')) === $identifier
                    || strtolower((string) ($candidate['phone'] ?? '')) === $identifier;
            });

            if (!$user || !$this->verifyLegacyPassword($password, (string) ($user['password'] ?? ''))) {
                return $this->json(['error' => 'Invalid login credentials.'], 401);
            }
            if (in_array(strtolower((string) ($user['status'] ?? 'active')), ['inactive', 'suspended', 'blocked'], true)) {
                return $this->json(['error' => 'This account is not active.'], 403);
            }

            return $this->json(['user' => $this->safeUser($user), 'token' => $this->createSession($user)]);
        }

        if ($action === 'social' && $method === 'POST') {
            return $this->socialAuth($request);
        }

        if ($action === 'register' && $method === 'POST') {
            $input = $request->all();
            $validator = Validator::make($input, [
                'email' => ['required', 'email', 'max:320'],
                'phone' => [
                    'required',
                    'string',
                    'regex:/^[+0-9().\s-]+$/',
                    function ($attribute, $value, $fail) {
                        $digits = preg_replace('/\D/', '', (string) $value) ?? '';
                        if (strlen($digits) < 10 || strlen($digits) > 15) {
                            $fail('Please enter a valid mobile number.');
                        }
                    },
                ],
                'password' => ['required', 'min:8'],
            ]);
            if ($validator->fails()) {
                return $this->json(['error' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
            }

            $data = JsonStore::read();
            $email = strtolower(trim((string) $input['email']));
            if (collect($data['users'] ?? [])->contains(fn ($u) => strtolower((string) ($u['email'] ?? '')) === $email)) {
                return $this->json(['error' => 'An account with this email already exists.'], 409);
            }
            $name = trim((string) ($input['name'] ?? trim(($input['firstName'] ?? '') . ' ' . ($input['lastName'] ?? ''))));
            $user = [
                'id' => JsonStore::nextId($data),
                'name' => $name !== '' ? $name : 'OG Landmark User',
                'email' => $email,
                'username' => $input['username'] ?? null,
                'phone' => trim((string) $input['phone']),
                'city' => $input['city'] ?? null,
                'accountType' => 'User',
                'permissions' => [],
                'role' => 'User',
                'status' => 'Active',
                'password' => $this->hashLegacyPassword($input['password']),
                'joinedDate' => now()->toISOString(),
            ];
            $data['users'][] = $user;
            $this->notifyAccountUpdate(
                $data,
                (int) $user['id'],
                'ACCOUNT_WELCOME',
                'Welcome to OG Landmark',
                'Your account is ready. You can save properties and receive listing and service updates.',
                false,
                'account:created:' . $user['id'],
            );
            JsonStore::write($data);

            return $this->json(['user' => $this->safeUser($user), 'token' => $this->createSession($user)], 201);
        }

        $adminResetRequest = in_array($action, ['admin-forgot-password', 'admin-request-reset'], true);
        if (in_array($action, ['forgot-password', 'request-reset', 'admin-forgot-password', 'admin-request-reset'], true) && $method === 'POST') {
            $email = strtolower(trim((string) $request->input('email')));
            if ($email === '') return $this->json(['error' => 'Email is required'], 400);
            $user = $this->findUserByEmail($email);
            if (!$user || ($adminResetRequest && !$this->isAdmin($user))) {
                return $this->json(['success' => true, 'message' => 'If an account exists with this email, a reset code has been sent.']);
            }

            $code = (string) random_int(100000, 999999);
            try {
                DB::table('auth_challenges')->updateOrInsert(
                    ['email' => $email, 'purpose' => 'password-reset'],
                    [
                        'code_hash' => hash('sha256', $code),
                        'attempts' => 0,
                        'expires_at' => now()->addMinutes(15),
                    ],
                );
            } catch (\Throwable $exception) {
                Log::error('Password reset challenge could not be stored.', ['error' => $exception->getMessage()]);
                return $this->json(['error' => 'Password reset is temporarily unavailable.'], 503);
            }

            $smtpOff = false;
            $smtpUsernameConfigured = (bool) config('mail.mailers.smtp.username');
            $smtpPasswordConfigured = (bool) config('mail.mailers.smtp.password');
            if (!$smtpUsernameConfigured || !$smtpPasswordConfigured) {
                $smtpOff = true;
                Log::warning('Password reset email skipped because SMTP credentials are unavailable.', [
                    'usernameConfigured' => $smtpUsernameConfigured,
                    'passwordConfigured' => $smtpPasswordConfigured,
                    'mailer' => config('mail.default'),
                ]);
            } else {
                try {
                    $fromAddress = $this->mailFromAddress();
                    if ($fromAddress === null) {
                        throw new \RuntimeException('No valid mail sender address is configured.');
                    }
                    Mail::raw("Your OG Landmark password reset code is {$code}. It expires in 15 minutes. Do not share this code.", function ($message) use ($email, $fromAddress) {
                        $message->from($fromAddress)
                            ->to($email)
                            ->subject('OG Landmark — Password Reset Code');
                    });
                } catch (\Throwable $exception) {
                    $smtpOff = true;
                    Log::error('Password reset email could not be sent.', ['error' => $exception->getMessage()]);
                }
            }

            if ($smtpOff) {
                DB::table('auth_challenges')
                    ->where('email', $email)
                    ->where('purpose', 'password-reset')
                    ->delete();
            }

            return $this->json([
                'success' => true,
                'smtpOff' => $smtpOff,
                'message' => $smtpOff
                    ? 'Email delivery is unavailable right now. Please contact support to get your reset code.'
                    : 'Reset code sent. Check your email.',
            ]);
        }

        $adminResetConfirmation = in_array($action, ['admin-reset-password', 'admin-confirm-reset'], true);
        if (in_array($action, ['reset-password', 'confirm-reset', 'admin-reset-password', 'admin-confirm-reset'], true) && $method === 'POST') {
            $email = strtolower(trim((string) $request->input('email')));
            $code = trim((string) ($request->input('code') ?? $request->input('otp')));
            $newPassword = (string) $request->input('newPassword');
            if ($email === '' || $code === '' || $newPassword === '') {
                return $this->json(['error' => 'Email, code and new password are required'], 400);
            }
            if (strlen($newPassword) < 8) {
                return $this->json(['error' => 'Password must be at least 8 characters'], 400);
            }

            $user = $this->findUserByEmail($email);
            if (!$user || ($adminResetConfirmation && !$this->isAdmin($user))) {
                return $this->json(['error' => 'Invalid or expired reset code'], 400);
            }
            $challenge = $this->consumeChallenge($email, 'password-reset', $code);
            if (!$challenge['ok']) {
                return $this->json([
                    'error' => $challenge['reason'] === 'expired'
                        ? 'Reset code has expired. Please request a new one.'
                        : 'Incorrect reset code. Please try again.',
                ], 400);
            }

            $data = JsonStore::read();
            $index = $this->indexById($data['users'] ?? [], $user['id']);
            if ($index === null) return $this->json(['error' => 'Invalid or expired reset code'], 400);
            $data['users'][$index]['password'] = $this->hashLegacyPassword($newPassword);
            unset($data['users'][$index]['trustedDevices']);
            $this->notifyAccountUpdate(
                $data,
                (int) $user['id'],
                'ACCOUNT_PASSWORD_CHANGED',
                'Password changed',
                'Your OG Landmark account password was changed. If you did not make this change, contact support.',
                true,
                'account:password-reset:' . Str::uuid(),
            );
            JsonStore::write($data);
            $this->invalidateSessions($user['id'], $user['email'] ?? null);
            return $this->json(['success' => true]);
        }

        if ($action === 'admin-verify' && $method === 'POST') {
            $email = strtolower(trim((string) $request->input('email')));
            $user = $this->findUserByEmail($email);
            if (!$user || !$this->isAdmin($user) || !$this->verifyLegacyPassword((string) $request->input('password'), (string) ($user['password'] ?? ''))) {
                return $this->json(['error' => 'Invalid admin credentials.'], 401);
            }
            if (config('app.env') === 'local') {
                return $this->json([
                    'success' => true,
                    'user' => $this->safeUser($user),
                    'token' => $this->createSession($user),
                ]);
            }
            $trustedDeviceToken = (string) $request->cookie(self::ADMIN_TRUSTED_DEVICE_COOKIE, '');
            if ($this->isTrustedAdminDevice($user, $trustedDeviceToken)) {
                return $this->json([
                    'success' => true,
                    'user' => $this->safeUser($user),
                    'token' => $this->createSession($user),
                ]);
            }
            if (!config('mail.mailers.smtp.username') || !config('mail.mailers.smtp.password')) {
                return $this->json(['error' => 'Admin verification email is not configured.'], 503);
            }
            $code = (string) random_int(100000, 999999);
            try {
                DB::table('auth_challenges')->updateOrInsert(
                    ['email' => $email, 'purpose' => 'admin-login'],
                    [
                        'code_hash' => hash('sha256', $code),
                        'attempts' => 0,
                        'expires_at' => now()->addMinutes(10),
                    ],
                );
                $fromAddress = $this->mailFromAddress();
                if ($fromAddress === null) {
                    throw new \RuntimeException('No valid mail sender address is configured.');
                }
                Mail::raw("Your OG Landmark admin sign-in code is {$code}. It expires in 10 minutes. Do not share this code.", function ($message) use ($email, $fromAddress) {
                    $message->from($fromAddress)
                        ->to($email)
                        ->subject('OG Landmark — Admin Sign-in Code');
                });
            } catch (\Throwable $exception) {
                Log::error('Admin sign-in code could not be delivered.', ['error' => $exception->getMessage()]);
                return $this->json(['error' => 'Admin verification email could not be sent.'], 503);
            }
            return $this->json(['success' => true, 'message' => 'Verification code sent.']);
        }

        if ($action === 'admin-otp' && $method === 'POST') {
            $email = strtolower(trim((string) $request->input('email')));
            $code = trim((string) $request->input('otp'));
            $user = $this->findUserByEmail($email);
            if (!$user || !$this->isAdmin($user) || $code === '') {
                return $this->json(['error' => 'Invalid or expired admin verification code.'], 400);
            }
            $challenge = $this->consumeChallenge($email, 'admin-login', $code);
            if (!$challenge['ok']) {
                return $this->json([
                    'error' => $challenge['reason'] === 'expired'
                        ? 'Admin verification code has expired. Please sign in again.'
                        : 'Incorrect admin verification code.',
                ], 400);
            }
            $response = $this->json([
                'success' => true,
                'user' => $this->safeUser($user),
                'token' => $this->createSession($user),
            ]);
            if ($request->boolean('rememberDevice')) {
                $trustedDeviceToken = bin2hex(random_bytes(32));
                try {
                    if ($this->storeTrustedAdminDevice((int) $user['id'], $trustedDeviceToken)) {
                        $response->withCookie(cookie(
                            self::ADMIN_TRUSTED_DEVICE_COOKIE,
                            $trustedDeviceToken,
                            self::ADMIN_TRUSTED_DEVICE_TTL_DAYS * 24 * 60,
                            '/api/auth',
                            null,
                            app()->environment('production') || $request->isSecure(),
                            true,
                            false,
                            'strict',
                        ));
                    }
                } catch (\Throwable $exception) {
                    Log::warning('Trusted admin device could not be saved.', ['error' => $exception->getMessage()]);
                }
            }
            return $response;
        }

        return $this->json(['error' => 'Not found'], 404);
    }

    private function properties(Request $request, array $parts, string $method)
    {
        $id = $parts[0] ?? null;
        $action = $parts[1] ?? null;
        $user = $this->currentUser($request);
        $data = JsonStore::read();
        if ($this->isAdmin($user)) {
            $permission = $method === 'GET' ? 'property.view' : ($action === 'views' ? null : 'property.manage');
            if ($permission !== null && !$this->adminHasPermission($user, $permission, $data)) {
                return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => $permission], 403);
            }
        }

        if ($method === 'GET' && $id === null) {
            $items = collect($data['properties'] ?? [])
                ->filter(fn ($p) => $this->propertyVisible($p, $user))
                ->filter(fn ($p) => $this->propertyMatches($p, $request))
                ->values();

            if ($request->input('sort') === 'latest') {
                $items = $items
                    ->filter(fn ($property) => in_array(strtolower((string) ($property['approvalStatus'] ?? 'active')), ['active', 'approved'], true)
                        && in_array(strtolower((string) ($property['listingStatus'] ?? 'active')), ['active', 'approved'], true))
                    ->sort(function ($left, $right) {
                    $dateOrder = strcmp(
                        (string) ($right['createdAt'] ?? ''),
                        (string) ($left['createdAt'] ?? ''),
                    );
                    return $dateOrder !== 0
                        ? $dateOrder
                        : ((int) ($right['id'] ?? 0) <=> (int) ($left['id'] ?? 0));
                    })->values();
            }

            $nearby = $request->filled(['lat', 'lng', 'radiusKm']);
            if ($nearby) {
                $lat = (float) $request->input('lat');
                $lng = (float) $request->input('lng');
                $radius = (float) $request->input('radiusKm');
                $items = $items->map(function ($p) use ($lat, $lng) {
                    $p['distanceKm'] = $this->distanceKm($lat, $lng, $this->propertyLat($p), $this->propertyLng($p));
                    return $p;
                })->filter(fn ($p) => $p['distanceKm'] !== null && $p['distanceKm'] <= $radius)
                    ->sortBy('distanceKm')->values();
            }

            $offset = max(0, (int) $request->input('offset', 0));
            $limit = min(100, max(1, (int) $request->input('limit', 50)));
            $total = $items->count();
            $page = $items->slice($offset, $limit)->values()->all();
            if ($request->boolean('paginated') || $request->input('response') === 'page') {
                return $this->json(['items' => $page, 'total' => $total, 'offset' => $offset, 'limit' => $limit, 'hasMore' => $offset + count($page) < $total]);
            }
            return $this->json($page);
        }

        if ($method === 'GET' && $id !== null) {
            $property = $this->findById($data['properties'] ?? [], $id);
            if (!$property || !$this->propertyVisible($property, $user)) {
                return $this->json(['error' => 'Property not found'], 404);
            }
            return $this->json($property);
        }

        if ($method === 'POST' && $id === null) {
            $user = $this->currentUser($request, true);
            $payload = $request->all();
            $property = array_merge($payload, [
                'id' => JsonStore::nextId($data),
                'sellerId' => $user['id'],
                'sellerName' => $user['name'] ?? null,
                'recommended' => false,
                'createdAt' => now()->toISOString(),
                'approvalStatus' => 'Pending',
                'listingStatus' => ($payload['submissionState'] ?? 'submitted') === 'draft' ? 'Draft' : 'Pending',
                'views' => 0,
                'inquiryCount' => 0,
                'images' => array_values($payload['images'] ?? []),
            ]);
            $data['properties'][] = $property;
            if (strtolower((string) ($property['listingStatus'] ?? '')) !== 'draft') {
                $this->notifyAdminsForPropertySubmission($data, $property, 'submitted');
            }
            JsonStore::write($data);
            return $this->json($property, 201);
        }

        if ($id === null) {
            return $this->json(['error' => 'Property id is required.'], 400);
        }
        $index = $this->indexById($data['properties'] ?? [], $id);
        if ($index === null) {
            return $this->json(['error' => 'Property not found'], 404);
        }
        $property = $data['properties'][$index];

        if ($action === 'views' && $method === 'PATCH') {
            $data['properties'][$index]['views'] = ((int) ($property['views'] ?? 0)) + 1;
            JsonStore::write($data);
            return $this->json(['success' => true]);
        }

        $adminAction = in_array($action, ['approve', 'reject', 'request-changes', 'verify', 'feature', 'recommend'], true);
        if ($adminAction) {
            $admin = $this->currentUser($request, true);
            if (!$this->isAdmin($admin)) {
                return $this->json(['error' => 'Forbidden'], 403);
            }
            if (in_array($action, ['feature', 'recommend'], true)) {
                $flag = $action === 'feature' ? 'featured' : 'recommended';
                $turningOn = $request->has($flag)
                    ? $request->boolean($flag)
                    : !(bool) ($property[$flag] ?? false);
                $approvalStatus = strtolower((string) ($property['approvalStatus'] ?? $property['listingStatus'] ?? ''));
                $listingStatus = strtolower((string) ($property['listingStatus'] ?? $property['approvalStatus'] ?? ''));
                if ($turningOn
                    && (!in_array($approvalStatus, ['active', 'approved'], true)
                        || !in_array($listingStatus, ['active', 'approved'], true))) {
                    return $this->json(['error' => 'Approve the listing before featuring or recommending it.'], 422);
                }
            }
            $this->applyPropertyAdminAction(
                $data,
                $index,
                $action,
                $request->input('reason'),
                $admin,
                $request,
            );
            JsonStore::write($data);
            return $this->json($data['properties'][$index]);
        }

        $current = $this->currentUser($request, true);
        if (!$this->isAdmin($current) && (string) ($property['sellerId'] ?? $property['userId'] ?? '') !== (string) ($current['id'] ?? '')) {
            return $this->json(['error' => 'Forbidden'], 403);
        }
        if ($method === 'PATCH' && $action === 'resubmit') {
            $reviewStatus = strtolower((string) ($property['approvalStatus'] ?? $property['listingStatus'] ?? ''));
            if (!in_array($reviewStatus, ['rejected', 'changes requested', 'draft', 'needs changes', 'needs updates'], true)) {
                return $this->json(['error' => 'Only a draft or listing needing corrections can be resubmitted.'], 409);
            }
            $data['properties'][$index]['approvalStatus'] = 'Pending';
            $data['properties'][$index]['listingStatus'] = 'Pending';
            $data['properties'][$index]['submissionState'] = 'submitted';
            $data['properties'][$index]['submittedAt'] = now()->toISOString();
            $data['properties'][$index]['updatedAt'] = now()->toISOString();
            unset($data['properties'][$index]['rejectionReason'], $data['properties'][$index]['changeRequest']);
            $data['properties'][$index]['submissionHistory'][] = [
                'action' => 'resubmitted',
                'by' => $current['id'],
                'createdAt' => now()->toISOString(),
            ];
            JsonStore::write($data);
            return $this->json($data['properties'][$index]);
        }
        if ($method === 'DELETE') {
            array_splice($data['properties'], $index, 1);
            JsonStore::write($data);
            return response()->noContent();
        }
        if ($method === 'PATCH' && $action === 'listing-status') {
            $data['properties'][$index]['listingStatus'] = $request->input('listingStatus');
            JsonStore::write($data);
            return $this->json($data['properties'][$index]);
        }
        if (in_array($method, ['PUT', 'PATCH'], true)) {
            $data['properties'][$index] = array_merge($property, $request->all());
            JsonStore::write($data);
            return $this->json($data['properties'][$index]);
        }

        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function applyPropertyAdminAction(
        array &$data,
        int $index,
        string $action,
        mixed $reason,
        array $admin,
        Request $request,
    ): array {
        $property = $data['properties'][$index];
        $reasonText = is_scalar($reason) ? trim((string) $reason) : '';
        $from = $property['approvalStatus'] ?? $property['listingStatus'] ?? null;
        $previousApprovalStatus = strtolower((string) ($property['approvalStatus'] ?? $property['listingStatus'] ?? ''));
        $previousListingStatus = strtolower((string) ($property['listingStatus'] ?? $property['approvalStatus'] ?? ''));
        $reviewNotificationType = null;
        $wasPubliclyListed = in_array($previousApprovalStatus, ['active', 'approved'], true)
            && in_array($previousListingStatus, ['active', 'approved'], true);
        if ($action === 'approve' || $action === 'verify') {
            $data['properties'][$index]['approvalStatus'] = 'Active';
            $data['properties'][$index]['listingStatus'] = 'Active';
            if (!$wasPubliclyListed) $reviewNotificationType = 'PROPERTY_LISTING_APPROVED';
        } elseif ($action === 'reject') {
            $data['properties'][$index]['approvalStatus'] = 'Rejected';
            $data['properties'][$index]['rejectionReason'] = $reason;
            if ($previousApprovalStatus !== 'rejected') $reviewNotificationType = 'PROPERTY_LISTING_REJECTED';
        } elseif ($action === 'request-changes') {
            $data['properties'][$index]['approvalStatus'] = 'Changes Requested';
            $data['properties'][$index]['changeRequest'] = $reason;
            if ($previousApprovalStatus !== 'changes requested') $reviewNotificationType = 'PROPERTY_CHANGES_REQUESTED';
        } elseif ($action === 'feature') {
            $data['properties'][$index]['featured'] = $request->has('featured')
                ? $request->boolean('featured')
                : !(bool) ($property['featured'] ?? false);
        } elseif ($action === 'recommend') {
            $data['properties'][$index]['recommended'] = $request->has('recommended')
                ? $request->boolean('recommended')
                : !(bool) ($property['recommended'] ?? false);
        }
        $data['properties'][$index]['reviewedAt'] = now()->toISOString();
        $data['properties'][$index]['reviewHistory'][] = [
            'action' => $action,
            'reason' => $reason,
            'by' => $admin['id'],
            'fromStatus' => $from,
            'toStatus' => $data['properties'][$index]['approvalStatus'] ?? null,
            'createdAt' => now()->toISOString(),
        ];
        if (in_array($action, ['approve', 'verify'], true) && !$wasPubliclyListed) {
            $this->notifyUsersOfPublishedProperty($data, $data['properties'][$index]);
        }
        if ($reviewNotificationType !== null) {
            $this->notifyPropertyOwnerOfReview(
                $data,
                $data['properties'][$index],
                $reviewNotificationType,
                $reasonText,
            );
        }
        return $data['properties'][$index];
    }

    private function myProperties(Request $request)
    {
        $user = $this->currentUser($request, true);
        return $this->json(collect(JsonStore::read()['properties'] ?? [])->filter(fn ($p) => (string) ($p['sellerId'] ?? $p['userId'] ?? '') === (string) $user['id'])->values());
    }

    private function admin(Request $request, array $parts, string $method)
    {
        $admin = $this->currentUser($request, true);
        if (!$this->isAdmin($admin)) return $this->json(['error' => 'Forbidden'], 403);
        $response = $this->adminRequest($request, $parts, $method, $admin);
        if (!in_array($method, ['GET', 'HEAD'], true) && $response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
            $data = JsonStore::read();
            $resource = $parts[0] ?? 'data';
            $action = $resource === 'developer-projects' && ($parts[2] ?? '') === 'restore'
                ? 'admin.restore.developer-projects'
                : match ($resource) {
                'system' => 'system.settings.updated',
                'staff' => 'staff.permissions.updated',
                default => 'admin.' . strtolower($method) . '.' . $resource,
                };
            $this->recordAdminActivity($data, $admin, $action, $resource, [
                'resourceId' => $parts[1] ?? null,
            ]);
            JsonStore::write($data);
        }
        return $response;
    }

    private function adminRequest(Request $request, array $parts, string $method, array $admin)
    {
        $data = JsonStore::read();
        $resource = $parts[0] ?? '';
        $id = $parts[1] ?? null;
        if ($resource === 'users' && ($parts[2] ?? '') === 'role' && $method === 'PATCH') {
            $target = $this->findById($data['users'] ?? [], $id);
            if (strtolower((string) ($target['role'] ?? '')) === 'admin'
                || strtolower((string) $request->input('role', '')) === 'admin') {
                if (!$this->adminHasPermission($admin, 'staff.manage', $data)) {
                    return $this->json(['error' => 'Only staff managers can grant or remove admin access.'], 403);
                }
            }
        }
        $requiredPermission = $this->adminPermissionForRequest($resource, $parts, $method);
        if ($requiredPermission !== null && !$this->adminHasPermission($admin, $requiredPermission, $data)) {
            return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => $requiredPermission], 403);
        }
        if ($resource === 'analytics' && $method === 'GET') {
            return $this->adminAnalytics($request, $data);
        }
        if ($resource === 'staff') {
            return $this->adminStaff($request, $data, $parts, $method, $admin);
        }
        if ($resource === 'permissions' && $method === 'GET') {
            return $this->json($this->staffRoleCatalog());
        }
        if ($resource === 'system') {
            return $this->adminSystem($request, $data, $parts, $method, $admin);
        }
        if ($resource === 'stats' && $method === 'GET') {
            $properties = $data['properties'] ?? [];
            return $this->json([
                'totalProperties' => count($properties), 'totalUsers' => count($data['users'] ?? []),
                'totalAgents' => count($data['mobileAgents'] ?? []), 'totalInquiries' => count($data['inquiries'] ?? []),
                'pendingApprovals' => count(array_filter($properties, fn ($p) => in_array($p['approvalStatus'] ?? '', ['Pending', 'Changes Requested'], true))),
                'activeListings' => count(array_filter($properties, fn ($p) => ($p['listingStatus'] ?? $p['approvalStatus'] ?? '') === 'Active')),
                'featuredListings' => count(array_filter($properties, fn ($p) => !empty($p['featured']))),
                'pendingReports' => count(array_filter($data['reports'] ?? [], fn ($report) => strtolower((string) ($report['status'] ?? 'pending')) === 'pending')),
                'totalReports' => count($data['reports'] ?? []),
                'totalViews' => array_sum(array_map(fn ($p) => (int) ($p['views'] ?? 0), $properties)),
            ]);
        }
        if ($resource === 'properties' && $id === 'bulk-review' && $method === 'POST') {
            $validator = Validator::make($request->all(), [
                'ids' => ['required', 'array', 'min:1', 'max:100'],
                'ids.*' => ['required', 'integer', 'min:1', 'distinct'],
                'action' => ['required', 'in:approve,reject'],
                'reason' => ['nullable', 'string', 'max:1000'],
            ]);
            if ($validator->fails()) {
                return $this->json([
                    'error' => 'Provide up to 100 unique property IDs and choose approve or reject.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $action = (string) $request->input('action');
            $reason = trim((string) $request->input('reason', ''));
            $results = [];
            $succeeded = 0;
            foreach ($request->input('ids') as $propertyId) {
                $index = $this->indexById($data['properties'] ?? [], $propertyId);
                if ($index === null) {
                    $results[] = [
                        'id' => $propertyId,
                        'success' => false,
                        'error' => 'Property not found.',
                    ];
                    continue;
                }

                $property = $data['properties'][$index];
                $status = strtolower((string) ($property['approvalStatus'] ?? $property['listingStatus'] ?? $property['status'] ?? ''));
                if (!empty($property['isDemo']) || !empty($property['isProject'])) {
                    $error = 'Only real property listings can be reviewed.';
                } elseif (!in_array($status, ['pending', 'changes requested', 'in progress', 'under review'], true)) {
                    $error = 'This listing is no longer waiting for review.';
                } else {
                    $error = null;
                }
                if ($error !== null) {
                    $results[] = [
                        'id' => $propertyId,
                        'title' => $property['title'] ?? null,
                        'success' => false,
                        'error' => $error,
                    ];
                    continue;
                }

                try {
                    $candidateData = $data;
                    $updatedProperty = $this->applyPropertyAdminAction(
                        $candidateData,
                        $index,
                        $action,
                        $reason,
                        $admin,
                        $request,
                    );
                    $data = $candidateData;
                    $succeeded++;
                    $results[] = [
                        'id' => $propertyId,
                        'title' => $updatedProperty['title'] ?? null,
                        'success' => true,
                        'property' => $updatedProperty,
                    ];
                } catch (\Throwable $exception) {
                    Log::warning('Bulk property review failed for a listing.', [
                        'property_id' => $propertyId,
                        'error' => $exception->getMessage(),
                    ]);
                    $results[] = [
                        'id' => $propertyId,
                        'title' => $property['title'] ?? null,
                        'success' => false,
                        'error' => 'Could not review this listing. Try again.',
                    ];
                }
            }

            if ($succeeded > 0) JsonStore::write($data);
            return $this->json([
                'action' => $action,
                'summary' => [
                    'succeeded' => $succeeded,
                    'failed' => count($results) - $succeeded,
                ],
                'results' => $results,
            ]);
        }
        if ($resource === 'demo-projects' && $method === 'DELETE' && $id !== null) {
            $projectId = trim((string) $id);
            if ($projectId === '' || strlen($projectId) > 180) {
                return $this->json(['error' => 'A valid bundled project ID is required.'], 422);
            }
            $settings = is_array($data['mobileSettings'] ?? null) ? $data['mobileSettings'] : [];
            $deletedIds = collect($settings['deletedDemoProjectIds'] ?? [])
                ->filter(fn ($value) => is_string($value) && $value !== '')
                ->unique()
                ->values()
                ->all();
            $deletedIds[] = $projectId;
            $settings['deletedDemoProjectIds'] = array_values(array_unique($deletedIds));
            $data['mobileSettings'] = $settings;
            JsonStore::write($data);
            return $this->json(['deletedDemoProjectIds' => $settings['deletedDemoProjectIds']]);
        }
        if ($resource === 'demo-properties' && $method === 'DELETE' && $id !== null) {
            if (!ctype_digit((string) $id) || (int) $id < 1) {
                return $this->json(['error' => 'A valid bundled demo property ID is required.'], 422);
            }
            $settings = is_array($data['mobileSettings'] ?? null) ? $data['mobileSettings'] : [];
            $deletedIds = collect($settings['deletedDemoPropertyIds'] ?? [])
                ->filter(fn ($value) => is_numeric($value) && (int) $value > 0)
                ->map(fn ($value) => (int) $value)
                ->unique()
                ->values()
                ->all();
            $demoId = (int) $id;
            $deletedIds[] = $demoId;
            $settings['deletedDemoPropertyIds'] = array_values(array_unique($deletedIds));
            $settings['hiddenDemoPropertyIds'] = array_values(array_diff(
                collect($settings['hiddenDemoPropertyIds'] ?? [])->map(fn ($value) => (int) $value)->all(),
                [$demoId],
            ));
            $data['mobileSettings'] = $settings;
            JsonStore::write($data);
            return $this->json(['deletedDemoPropertyIds' => $settings['deletedDemoPropertyIds']]);
        }
        if ($resource === 'demo-properties' && $method === 'PATCH' && $id === null) {
            $validator = Validator::make($request->all(), [
                'ids' => ['required', 'array', 'min:1', 'max:500'],
                'ids.*' => ['required', 'integer', 'min:1'],
                'hidden' => ['required', 'boolean'],
            ]);
            if ($validator->fails()) {
                return $this->json([
                    'error' => 'A list of demo property IDs and a valid hidden value are required.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $settings = is_array($data['mobileSettings'] ?? null) ? $data['mobileSettings'] : [];
            $hiddenIds = collect($settings['hiddenDemoPropertyIds'] ?? [])
                ->filter(fn ($demoId) => is_numeric($demoId) && (int) $demoId > 0)
                ->map(fn ($demoId) => (int) $demoId)
                ->unique()
                ->values()
                ->all();
            $requestedIds = collect($request->input('ids'))
                ->map(fn ($demoId) => (int) $demoId)
                ->unique()
                ->values()
                ->all();
            $hiddenIds = $request->boolean('hidden')
                ? array_values(array_unique(array_merge($hiddenIds, $requestedIds)))
                : array_values(array_diff($hiddenIds, $requestedIds));
            sort($hiddenIds);

            $data['mobileSettings'] = array_merge($settings, [
                'hiddenDemoPropertyIds' => $hiddenIds,
            ]);
            JsonStore::write($data);
            return $this->json(['hiddenDemoPropertyIds' => $hiddenIds]);
        }
        if ($resource === 'properties' && $id !== null && ($parts[2] ?? '') === 'feature' && $method === 'PATCH') {
            return $this->properties($request, [$id, 'feature'], 'PATCH');
        }
        if ($resource === 'properties' && $id !== null && ($parts[2] ?? '') === 'recommend' && $method === 'PATCH') {
            return $this->properties($request, [$id, 'recommend'], 'PATCH');
        }
        if ($resource === 'properties' && $id !== null && ($parts[2] ?? '') === 'verify' && $method === 'PATCH') {
            return $this->properties($request, [$id, 'verify'], 'PATCH');
        }
        if ($resource === 'properties' && $id !== null && in_array($parts[2] ?? '', ['approve', 'reject', 'request-changes'], true) && $method === 'PATCH') {
            return $this->properties($request, [$id, $parts[2]], 'PATCH');
        }
        if ($resource === 'properties' && $id !== null && in_array($method, ['PUT', 'PATCH'], true)) {
            $index = $this->indexById($data['properties'] ?? [], $id);
            if ($index === null) return $this->json(['error' => 'Property not found'], 404);

            $validator = Validator::make($request->all(), [
                'title' => ['sometimes', 'required', 'string', 'max:180'],
                'type' => ['sometimes', 'nullable', 'string', 'max:80'],
                'purpose' => ['sometimes', 'nullable', 'string', 'max:40'],
                'status' => ['sometimes', 'nullable', 'string', 'max:40'],
                'city' => ['sometimes', 'required', 'string', 'max:120'],
                'district' => ['sometimes', 'nullable', 'string', 'max:120'],
                'tehsil' => ['sometimes', 'nullable', 'string', 'max:120'],
                'locality' => ['sometimes', 'nullable', 'string', 'max:120'],
                'society' => ['sometimes', 'nullable', 'string', 'max:160'],
                'address' => ['sometimes', 'nullable', 'string', 'max:240'],
                'lat' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
                'lng' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
                'price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
                'area' => ['sometimes', 'nullable', 'string', 'max:80'],
                'areaUnit' => ['sometimes', 'nullable', 'string', 'max:40'],
                'bedrooms' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:50'],
                'bathrooms' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:50'],
                'yearBuilt' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:3000'],
                'furnishing' => ['sometimes', 'nullable', 'string', 'max:80'],
                'availability' => ['sometimes', 'nullable', 'string', 'max:80'],
                'videoUrl' => ['sometimes', 'nullable', 'string', 'max:2000'],
                'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
                'amenities' => ['sometimes', 'array', 'max:50'],
                'amenities.*' => ['string', 'max:120'],
                'images' => ['sometimes', 'array', 'max:30'],
                'images.*' => ['string', 'max:2000'],
                'assignedAgent' => ['sometimes', 'nullable', 'array'],
                'assignedAgent.id' => ['nullable', 'string', 'max:100'],
                'assignedAgent.userId' => ['nullable', 'string', 'max:100'],
                'assignedAgent.name' => ['nullable', 'string', 'max:120'],
                'assignedAgent.phone' => ['nullable', 'string', 'max:40'],
                'assignedAgent.city' => ['nullable', 'string', 'max:120'],
                'assignedAgent.profileType' => ['nullable', 'string', 'max:40'],
            ]);
            if ($validator->fails()) {
                return $this->json(['error' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
            }

            $editable = [
                'title', 'type', 'purpose', 'status', 'city', 'district', 'tehsil',
                'locality', 'society', 'address', 'price', 'area', 'areaUnit',
                'lat', 'lng', 'bedrooms', 'bathrooms', 'yearBuilt', 'furnishing', 'availability',
                'videoUrl', 'description', 'amenities', 'images', 'assignedAgent',
            ];
            $beforeData = $data;
            $before = $data['properties'][$index];
            $changes = array_intersect_key($validator->validated(), array_flip($editable));
            $previousAgentId = trim((string) ($before['agentId'] ?? ''));
            $assignedAgent = $changes['assignedAgent'] ?? null;
            $targetAgentId = is_array($assignedAgent) ? trim((string) ($assignedAgent['userId'] ?? '')) : '';
            if ($targetAgentId !== '') {
                $targetAgent = $this->findById($data['users'] ?? [], $targetAgentId);
                if (!$targetAgent
                    || strtolower((string) ($targetAgent['role'] ?? '')) !== 'agent'
                    || strtolower((string) ($targetAgent['status'] ?? 'active')) !== 'active') {
                    return $this->json(['error' => 'Select an active Agent account for referral.'], 422);
                }
            }
            $data['properties'][$index] = array_merge($before, $changes, ['updatedAt' => now()->toISOString()]);
            $location = is_array($before['location'] ?? null) ? $before['location'] : [];
            $locationChanged = false;
            foreach ([
                'address' => 'address',
                'city' => 'city',
                'district' => 'district',
                'tehsil' => 'tehsil',
                'locality' => 'locality',
            ] as $propertyField => $locationField) {
                if (array_key_exists($propertyField, $changes)) {
                    $location[$locationField] = $changes[$propertyField];
                    $locationChanged = true;
                }
            }
            if (array_key_exists('lat', $changes) || array_key_exists('lng', $changes)) {
                $lat = array_key_exists('lat', $changes)
                    ? ($changes['lat'] === null ? null : (float) $changes['lat'])
                    : $this->propertyLat($before);
                $lng = array_key_exists('lng', $changes)
                    ? ($changes['lng'] === null ? null : (float) $changes['lng'])
                    : $this->propertyLng($before);
                $data['properties'][$index]['lat'] = $lat;
                $data['properties'][$index]['lng'] = $lng;
                $data['properties'][$index]['latitude'] = $lat;
                $data['properties'][$index]['longitude'] = $lng;
                $location['latitude'] = $lat;
                $location['longitude'] = $lng;
                $locationChanged = true;
            }
            if ($locationChanged) $data['properties'][$index]['location'] = $location;
            if (array_key_exists('images', $changes)) {
                $images = array_values($changes['images']);
                $oldCover = $before['coverImage'] ?? null;
                $data['properties'][$index]['coverImage'] = $oldCover && in_array($oldCover, $images, true)
                    ? $oldCover
                    : ($images[0] ?? null);
                $media = is_array($before['media'] ?? null) ? $before['media'] : [];
                $media['images'] = array_map(
                    fn ($url) => ['url' => $url, 'propertyId' => $data['properties'][$index]['id'], 'type' => 'image'],
                    $images,
                );
                $data['properties'][$index]['media'] = $media;
            }
            if (array_key_exists('videoUrl', $changes)) {
                $media = is_array($data['properties'][$index]['media'] ?? null)
                    ? $data['properties'][$index]['media']
                    : [];
                if (!empty($changes['videoUrl'])) {
                    $media['video'] = [
                        'url' => $changes['videoUrl'],
                        'propertyId' => $data['properties'][$index]['id'],
                        'type' => 'video',
                    ];
                } else {
                    unset($media['video']);
                }
                $data['properties'][$index]['media'] = $media;
            }
            if (array_key_exists('assignedAgent', $changes)) {
                $agent = $changes['assignedAgent'];
                $data['properties'][$index]['assignedAgentId'] = is_array($agent) ? ($agent['id'] ?? null) : null;
                $data['properties'][$index]['assignedAgentName'] = is_array($agent) ? ($agent['name'] ?? null) : null;
                $data['properties'][$index]['assignedAgentPhone'] = is_array($agent) ? ($agent['phone'] ?? null) : null;
                $data['properties'][$index]['assignedAgentCity'] = is_array($agent) ? ($agent['city'] ?? null) : null;
                $data['properties'][$index]['agentId'] = $targetAgentId !== '' ? $targetAgentId : null;
                if ($targetAgentId !== '' && $targetAgentId !== $previousAgentId) {
                    $property = $data['properties'][$index];
                    $propertyTitle = trim((string) ($property['title'] ?? ''));
                    $city = trim((string) ($property['city'] ?? ''));
                    $message = ($propertyTitle !== '' ? $propertyTitle : 'A property listing')
                        . ($city !== '' ? " in {$city}" : '')
                        . ' has been referred to you for follow-up.';
                    app(NotificationDeliveryService::class)->deliver($data, [(int) $targetAgentId], [
                        'type' => 'PROPERTY_LISTING_ASSIGNED',
                        'category' => 'properties',
                        'title' => 'New property referral',
                        'message' => $message,
                        'body' => $message,
                        'imageUrl' => $property['coverImage'] ?? ($property['images'][0] ?? null),
                        'entityType' => 'property',
                        'entityId' => $property['id'] ?? null,
                        'propertyId' => $property['id'] ?? null,
                        'deepLink' => '/property/' . ($property['id'] ?? ''),
                        'eventKey' => 'property:' . ($property['id'] ?? 'unknown') . ':agent-referral:' . $targetAgentId . ':' . Str::uuid(),
                        'metadata' => ['propertyCity' => $city],
                    ]);
                }
            }
            $data['properties'][$index]['managementHistory'] = is_array($before['managementHistory'] ?? null)
                ? $before['managementHistory']
                : [];
            $data['properties'][$index]['managementHistory'][] = [
                'action' => 'admin_updated',
                'by' => $admin['id'],
                'createdAt' => now()->toISOString(),
                'fields' => array_keys($changes),
            ];
            $this->writeWithMediaCleanup(
                $beforeData,
                $data,
                $before,
                $data['properties'][$index],
                ['images', 'videoUrl', 'coverImage', 'media'],
            );
            return $this->json($data['properties'][$index]);
        }
        if ($resource === 'properties' && $id !== null && $method === 'DELETE') {
            return $this->properties($request, [$id], 'DELETE');
        }
        if ($resource === 'properties' && $method === 'GET' && $id === null) {
            $properties = collect($data['properties'] ?? []);
            if ($request->filled('status') && strtolower((string) $request->input('status')) !== 'all') {
                $status = strtolower((string) $request->input('status'));
                $properties = $properties->filter(fn ($property) =>
                    strtolower((string) ($property['approvalStatus'] ?? $property['listingStatus'] ?? '')) === $status
                );
            }
            if ($request->filled('limit')) {
                $limit = max(1, min(5000, (int) $request->input('limit')));
                $properties = $properties->take($limit);
            }
            return $this->json($properties->values());
        }
        if ($resource === 'properties' && $id !== null && ($parts[2] ?? '') === 'review' && $method === 'GET') {
            $property = $this->findById($data['properties'] ?? [], $id);
            if (!$property) return $this->json(['error' => 'Property not found'], 404);
            $seller = $this->findById($data['users'] ?? [], $property['sellerId'] ?? $property['userId'] ?? null);
            return $this->json([
                'property' => $property,
                'seller' => $seller ? $this->safeUser($seller) : null,
                'audit' => $property['reviewHistory'] ?? [],
            ]);
        }
        if ($resource === 'users' && $method === 'GET' && $id === null) {
            $users = collect($data['users'] ?? []);
            if ($request->filled('role') && strtolower((string) $request->input('role')) !== 'all') {
                $role = strtolower((string) $request->input('role'));
                $users = $users->filter(fn ($user) => strtolower((string) ($user['role'] ?? '')) === $role);
            }
            $limit = max(1, min(500, (int) $request->input('limit', 500)));
            return $this->json($users->take($limit)->map(fn ($user) => $this->safeUser($user))->values());
        }
        if ($resource === 'users' && $id !== null && ($parts[2] ?? '') === 'agent-cover-access' && $method === 'PATCH') {
            $index = $this->indexById($data['users'] ?? [], $id);
            if ($index === null) return $this->json(['error' => 'User not found'], 404);
            if (strtolower((string) ($data['users'][$index]['role'] ?? '')) !== 'agent') {
                return $this->json(['error' => 'Agent cover access can only be set for Agent accounts.'], 422);
            }
            $validator = Validator::make($request->all(), ['enabled' => ['required', 'boolean']]);
            if ($validator->fails()) {
                return $this->json(['error' => 'A valid enabled value is required.', 'errors' => $validator->errors()], 422);
            }
            $data['users'][$index]['agentCoverUploadEnabled'] = $request->boolean('enabled');
            JsonStore::write($data);
            return $this->json($this->safeUser($data['users'][$index]));
        }
        if ($resource === 'users' && $id !== null && $method === 'PATCH' && ($parts[2] ?? '') === 'role') {
            $index = $this->indexById($data['users'] ?? [], $id);
            if ($index === null) return $this->json(['error' => 'User not found'], 404);
            $roles = ['user' => 'User', 'agent' => 'Agent', 'developer' => 'Developer', 'admin' => 'Admin'];
            $requestedRole = strtolower(trim((string) $request->input('role', '')));
            if (!isset($roles[$requestedRole])) return $this->json(['error' => 'Unsupported account role.'], 422);
            $targetIsAdmin = strtolower((string) ($data['users'][$index]['role'] ?? '')) === 'admin';
            if ($targetIsAdmin && $requestedRole !== 'admin') {
                $adminCount = collect($data['users'] ?? [])->filter(fn ($user) => strtolower((string) ($user['role'] ?? '')) === 'admin')->count();
                if ((string) $data['users'][$index]['id'] === (string) $admin['id'] || $adminCount <= 1) {
                    return $this->json(['error' => 'The signed-in or final admin account cannot be demoted.'], 409);
                }
            }
            $previousRole = strtolower((string) ($data['users'][$index]['role'] ?? ''));
            $data['users'][$index]['role'] = $roles[$requestedRole];
            $data['users'][$index]['accountType'] = 'User';
            $data['users'][$index]['permissions'] = in_array($requestedRole, ['agent', 'developer', 'admin'], true)
                ? [$requestedRole]
                : [];
            if ($requestedRole === 'admin' && $previousRole !== 'admin') {
                $data['users'][$index]['staffRole'] = 'custom';
                $data['users'][$index]['staffPermissions'] = [];
            } elseif ($previousRole === 'admin' && $requestedRole !== 'admin') {
                unset($data['users'][$index]['staffRole'], $data['users'][$index]['staffPermissions']);
            }
            if ($requestedRole !== 'agent' || $previousRole !== 'agent') {
                $data['users'][$index]['agentCoverUploadEnabled'] = false;
            }
            if ($previousRole !== $requestedRole) {
                $this->notifyAccountUpdate(
                    $data,
                    (int) $data['users'][$index]['id'],
                    'ACCOUNT_ROLE_UPDATED',
                    'Account access updated',
                    'Your OG Landmark account access is now set to ' . $roles[$requestedRole] . '.',
                    true,
                    'account:role:' . Str::uuid(),
                );
            }
            JsonStore::write($data);
            return $this->json($this->safeUser($data['users'][$index]));
        }
        if ($resource === 'users' && $id !== null && $method === 'DELETE') {
            $index = $this->indexById($data['users'] ?? [], $id);
            if ($index === null) return $this->json(['error' => 'User not found'], 404);
            $target = $data['users'][$index];
            if (strtolower((string) ($target['role'] ?? '')) === 'admin') {
                $adminCount = collect($data['users'] ?? [])->filter(fn ($user) => strtolower((string) ($user['role'] ?? '')) === 'admin')->count();
                if ((string) $target['id'] === (string) $admin['id'] || $adminCount <= 1) {
                    return $this->json(['error' => 'The signed-in or final admin account cannot be deleted.'], 409);
                }
            }
            $updatedData = app(AccountDataDeletionService::class)
                ->removeFromDocument($data, (string) $target['id']);
            $mediaStorage = app(MediaStorage::class);
            $removedMediaPaths = array_values(array_diff(
                $mediaStorage->referencedPaths($data),
                $mediaStorage->referencedPaths($updatedData),
            ));
            JsonStore::write($updatedData);
            $mediaStorage->deleteUnreferencedPaths($removedMediaPaths, $updatedData);
            $this->invalidateSessions($target['id'], $target['email'] ?? null);
            return response()->noContent();
        }
        if ($resource === 'reports') {
            if ($method === 'GET' && $id === null && $request->filled('status')) {
                return $this->json(collect($data['reports'] ?? [])
                    ->filter(fn ($report) => strtolower((string) ($report['status'] ?? 'pending')) === strtolower((string) $request->input('status'))
                    )->values());
            }
            return $this->crudNamed($request, $data, 'reports', $id, $method, $admin);
        }
        if ($resource === 'locations') {
            return $this->adminLocations($request, $data, $id, $method);
        }
        if ($resource === 'announcements') return $this->adminAnnouncements($request, $data, $parts, $method, $admin);
        if ($resource === 'developer-projects') {
            return app(DeveloperApiService::class)->handle(
                $request,
                array_merge(['projects'], array_slice($parts, 1)),
                $method,
                $admin,
            );
        }
        $adminCollections = [
            'developer-blocks' => 'inventoryBlocks',
            'developer-units' => 'inventoryUnits',
            'developer-leads' => 'developerLeads',
            'developer-team' => 'developerTeam',
            'developer-documents' => 'developerDocuments',
            'developer-payment-plans' => 'paymentPlans',
            'developer-site-visits' => 'developerSiteVisits',
            'verification-requests' => 'verificationRequests',
            'buyer-requests' => 'buyerRequests',
            'agent-leads' => 'agentLeads',
            'agent-visits' => 'agentVisits',
            'promotions' => 'promotions',
            'conversations' => 'conversations',
            'notifications' => 'notifications',
            'mobile-agents' => 'mobileAgents',
            'city-agents' => 'cityAgents',
        ];
        if (isset($adminCollections[$resource])) {
            return $this->crudNamed($request, $data, $adminCollections[$resource], $id, $method, $admin);
        }
        return $this->json(['error' => 'Not found'], 404);
    }

    private function staffRoleCatalog(): array
    {
        return [
            'owner' => [
                'label' => 'Owner',
                'permissions' => ['reports.view', 'property.view', 'property.manage', 'users.view', 'users.manage', 'content.manage', 'notifications.manage', 'support.manage', 'settings.view', 'settings.manage', 'system.view', 'staff.manage', 'operations.manage'],
            ],
            'analyst' => [
                'label' => 'Reports analyst',
                'permissions' => ['reports.view', 'property.view', 'users.view', 'system.view'],
            ],
            'content_manager' => [
                'label' => 'Content manager',
                'permissions' => ['content.manage', 'notifications.manage', 'settings.view'],
            ],
            'operations' => [
                'label' => 'Operations',
                'permissions' => ['property.view', 'property.manage', 'users.view', 'users.manage', 'content.manage', 'notifications.manage', 'support.manage', 'settings.view', 'system.view'],
            ],
            'support' => [
                'label' => 'Support',
                'permissions' => ['users.view', 'support.manage', 'system.view'],
            ],
            'custom' => [
                'label' => 'Custom',
                'permissions' => [],
            ],
        ];
    }

    private function adminLocations(Request $request, array $data, ?string $id, string $method)
    {
        $serviceAreas = ['Okara', 'Depalpur', 'Renala Khurd', 'Hujra Shah Muqeem', 'Basir Pur', 'Haveli Lakha'];
        if (!array_key_exists('locations', $data)) {
            $data['locations'] = collect($serviceAreas)->map(fn ($name) => [
                'id' => 'service-area-' . Str::slug($name),
                'name' => $name,
                'status' => 'Active',
            ])->all();
            JsonStore::write($data);
        }
        $data['locations'] = is_array($data['locations']) ? $data['locations'] : [];

        if ($method === 'GET' && $id === null) return $this->json($data['locations']);
        if ($method === 'POST' && $id === null) {
            $validator = Validator::make($request->all(), [
                'name' => ['required', 'string', 'max:120'],
                'status' => ['sometimes', 'required', 'in:Active,Inactive'],
            ]);
            if ($validator->fails()) return $this->json(['error' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
            $name = $validator->validated()['name'];
            if (collect($data['locations'])->contains(fn ($item) => strcasecmp((string) ($item['name'] ?? ''), $name) === 0)) {
                return $this->json(['error' => 'This service location already exists.'], 409);
            }
            $location = [
                'id' => JsonStore::nextId($data, 'location'),
                'name' => $name,
                'status' => $validator->validated()['status'] ?? 'Active',
                'createdAt' => now()->toISOString(),
                'updatedAt' => now()->toISOString(),
            ];
            $data['locations'][] = $location;
            JsonStore::write($data);
            return $this->json($location, 201);
        }

        $index = $this->indexById($data['locations'], $id);
        if ($index === null) return $this->json(['error' => 'Location not found'], 404);
        if ($method === 'GET') return $this->json($data['locations'][$index]);
        if ($method === 'DELETE') {
            array_splice($data['locations'], $index, 1);
            JsonStore::write($data);
            return response()->noContent();
        }
        if (in_array($method, ['PUT', 'PATCH'], true)) {
            $validator = Validator::make($request->all(), [
                'name' => ['sometimes', 'required', 'string', 'max:120'],
                'status' => ['sometimes', 'required', 'in:Active,Inactive'],
            ]);
            if ($validator->fails()) return $this->json(['error' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
            $changes = $validator->validated();
            $name = $changes['name'] ?? null;
            if ($name !== null && collect($data['locations'])->contains(
                fn ($item, $candidateIndex) => $candidateIndex !== $index && strcasecmp((string) ($item['name'] ?? ''), $name) === 0,
            )) {
                return $this->json(['error' => 'This service location already exists.'], 409);
            }
            $data['locations'][$index] = array_merge($data['locations'][$index], $changes, ['updatedAt' => now()->toISOString()]);
            JsonStore::write($data);
            return $this->json($data['locations'][$index]);
        }
        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function adminPermissionForRequest(string $resource, array $parts, string $method): ?string
    {
        if ($resource === 'analytics' || $resource === 'stats') return 'reports.view';
        if (in_array($resource, ['staff', 'permissions'], true)) return 'staff.manage';
        if ($resource === 'system') {
            return in_array($method, ['PUT', 'PATCH', 'POST', 'DELETE'], true) ? 'settings.manage' : 'system.view';
        }
        if ($resource === 'properties') return in_array($method, ['GET', 'HEAD'], true) ? 'property.view' : 'property.manage';
        if ($resource === 'users') return in_array($method, ['GET', 'HEAD'], true) ? 'users.view' : 'users.manage';
        if ($resource === 'reports') return 'support.manage';
        if ($resource === 'locations') return 'content.manage';
        if (in_array($resource, ['announcements', 'notifications'], true)) return 'notifications.manage';
        if (in_array($resource, ['mobile-agents', 'city-agents', 'developer-projects', 'developer-blocks', 'developer-units', 'developer-payment-plans'], true)) return 'content.manage';
        if (in_array($resource, ['conversations', 'agent-leads', 'agent-visits', 'verification-requests', 'buyer-requests'], true)) return 'support.manage';
        return 'operations.manage';
    }

    private function adminHasPermission(array $admin, string $permission, array $data): bool
    {
        $user = $this->findById($data['users'] ?? [], $admin['id'] ?? null) ?? $admin;
        if (!array_key_exists('staffRole', $user) && !array_key_exists('staffPermissions', $user)) {
            // Existing admin accounts retain their full access until an owner assigns a staff role.
            return true;
        }
        $role = strtolower((string) ($user['staffRole'] ?? 'custom'));
        $catalog = $this->staffRoleCatalog();
        $permissions = $role === 'custom'
            ? (array) ($user['staffPermissions'] ?? [])
            : (array) ($catalog[$role]['permissions'] ?? []);
        return in_array($permission, $permissions, true);
    }

    private function adminStaff(Request $request, array &$data, array $parts, string $method, array $admin)
    {
        $data['users'] = is_array($data['users'] ?? null) ? $data['users'] : [];
        $id = $parts[1] ?? null;
        if ($method === 'GET' && $id === null) {
            $catalog = $this->staffRoleCatalog();
            $staff = collect($data['users'])
                ->filter(fn ($user) => is_array($user) && strtolower((string) ($user['role'] ?? '')) === 'admin')
                ->map(function ($user) use ($catalog) {
                    $role = strtolower((string) ($user['staffRole'] ?? 'owner'));
                    return [
                        'id' => $user['id'] ?? null,
                        'name' => $user['name'] ?? 'Admin',
                        'email' => $user['email'] ?? '',
                        'status' => $user['status'] ?? 'Active',
                        'staffRole' => isset($catalog[$role]) ? $role : 'custom',
                        'permissions' => $role === 'custom'
                            ? array_values((array) ($user['staffPermissions'] ?? []))
                            : (array) ($catalog[$role]['permissions'] ?? []),
                    ];
                })->values();
            return $this->json(['staff' => $staff, 'roles' => $catalog]);
        }

        if ($method !== 'PATCH' || $id === null || ($parts[2] ?? '') !== 'permissions') {
            return $this->json(['error' => 'Method not allowed'], 405);
        }
        $index = $this->indexById($data['users'], $id);
        if ($index === null || strtolower((string) ($data['users'][$index]['role'] ?? '')) !== 'admin') {
            return $this->json(['error' => 'Admin staff account not found.'], 404);
        }
        $role = strtolower(trim((string) $request->input('role', '')));
        $catalog = $this->staffRoleCatalog();
        if (!isset($catalog[$role])) return $this->json(['error' => 'Choose a supported staff role.'], 422);
        $permissions = $role === 'custom' ? $request->input('permissions', []) : $catalog[$role]['permissions'];
        $allowed = collect($catalog)->flatMap(fn ($item) => $item['permissions'])->unique()->values()->all();
        if (!is_array($permissions) || count($permissions) > count($allowed)
            || collect($permissions)->contains(fn ($permission) => !is_string($permission) || !in_array($permission, $allowed, true))) {
            return $this->json(['error' => 'The permission list contains unsupported values.'], 422);
        }
        $permissions = array_values(array_unique($permissions));
        $target = &$data['users'][$index];
        $target['staffRole'] = $role;
        $target['staffPermissions'] = $permissions;

        $remainingManagers = collect($data['users'])
            ->filter(function ($user) use ($catalog) {
                if (strtolower((string) ($user['role'] ?? '')) !== 'admin') return false;
                if (!array_key_exists('staffRole', $user) && !array_key_exists('staffPermissions', $user)) return true;
                $currentRole = strtolower((string) ($user['staffRole'] ?? 'custom'));
                $currentPermissions = $currentRole === 'custom'
                    ? (array) ($user['staffPermissions'] ?? [])
                    : (array) ($catalog[$currentRole]['permissions'] ?? []);
                return in_array('staff.manage', $currentPermissions, true);
            })->count();
        if ($remainingManagers < 1) {
            return $this->json(['error' => 'At least one admin must retain staff-management access.'], 409);
        }
        unset($target);
        JsonStore::write($data);
        return $this->json([
            'id' => $data['users'][$index]['id'],
            'staffRole' => $role,
            'permissions' => $permissions,
        ]);
    }

    private function adminAnalytics(Request $request, array $data)
    {
        $type = strtolower((string) $request->query('type', 'properties'));
        $sources = [
            'properties' => $data['properties'] ?? [],
            'users' => collect($data['users'] ?? [])->map(fn ($user) => $this->safeUser((array) $user))->all(),
            'agents' => collect($data['users'] ?? [])
                ->filter(fn ($user) => strtolower((string) ($user['role'] ?? '')) === 'agent')
                ->map(fn ($user) => $this->safeUser((array) $user))->values()->all(),
            'leads' => $data['inquiries'] ?? [],
            'appointments' => $data['appointments'] ?? [],
            'activity' => $data['adminActivity'] ?? [],
        ];
        if (!isset($sources[$type])) return $this->json(['error' => 'Choose a supported report type.'], 422);
        $dateFrom = trim((string) $request->query('dateFrom', ''));
        $dateTo = trim((string) $request->query('dateTo', ''));
        $city = strtolower(trim((string) $request->query('city', '')));
        $status = strtolower(trim((string) $request->query('status', '')));
        $allRecords = collect($sources[$type])->filter(function ($record) use ($dateFrom, $dateTo, $city, $status, $type) {
            if (!is_array($record)) return false;
            $recordDate = (string) ($record['createdAt'] ?? $record['createdDate'] ?? $record['joinedDate'] ?? $record['timestamp'] ?? $record['date'] ?? $record['submittedAt'] ?? '');
            if ($dateFrom !== '' && ($recordDate === '' || substr($recordDate, 0, 10) < $dateFrom)) return false;
            if ($dateTo !== '' && ($recordDate === '' || substr($recordDate, 0, 10) > $dateTo)) return false;
            if ($city !== '' && !str_contains(strtolower((string) ($record['city'] ?? $record['location'] ?? '')), $city)) return false;
            if ($status !== '') {
                $recordStatus = strtolower((string) ($record['status'] ?? $record['approvalStatus'] ?? $record['listingStatus'] ?? ''));
                if ($recordStatus !== $status) return false;
            }
            return true;
        })->values();
        $total = $allRecords->count();
        $limit = max(1, min(5000, (int) $request->query('limit', 100)));
        $offset = max(0, min($total, (int) $request->query('offset', 0)));
        $records = $allRecords->slice($offset, $limit)->values();
        $summary = [
            'total' => $total,
            'active' => $allRecords->filter(fn ($record) => strtolower((string) ($record['status'] ?? $record['approvalStatus'] ?? $record['listingStatus'] ?? '')) === 'active')->count(),
            'pending' => $allRecords->filter(fn ($record) => str_contains(strtolower((string) ($record['status'] ?? $record['approvalStatus'] ?? '')), 'pending'))->count(),
            'cities' => $allRecords->pluck('city')->filter()->unique()->count(),
        ];
        return $this->json([
            'type' => $type,
            'generatedAt' => now()->toISOString(),
            'filters' => ['dateFrom' => $dateFrom, 'dateTo' => $dateTo, 'city' => $city, 'status' => $status],
            'summary' => $summary,
            'offset' => $offset,
            'limit' => $limit,
            'hasMore' => $offset + $records->count() < $total,
            'records' => $records,
        ]);
    }

    private function adminSystem(Request $request, array &$data, array $parts, string $method, array $admin)
    {
        $view = $parts[1] ?? 'status';
        if ($view === 'status' && $method === 'GET') {
            $databaseReady = $this->databaseReady();
            $media = app(MediaStorage::class)->health();
            $normalized = $this->normalizedCoreStorageStatus();
            $health = [
                'status' => $databaseReady && $media['status'] === 'ready' && $normalized === 'ready' ? 'ok' : 'degraded',
                'checkedAt' => now()->toISOString(),
                'database' => $databaseReady ? 'connected' : 'not_connected',
                'databaseProvider' => config('database.default'),
                'framework' => 'laravel',
                'normalizedCoreStorage' => $normalized,
                'smtp' => config('mail.mailers.smtp.username') && config('mail.mailers.smtp.password') ? 'configured' : 'not_configured',
                'mediaStorage' => $media,
                'environment' => app()->environment(),
                'phpVersion' => PHP_VERSION,
                'laravelVersion' => app()->version(),
            ];
            return $this->json($health);
        }
        if ($view === 'settings') {
            $defaults = [
                'verificationBadgeEnabled' => true,
                'pushNotificationsEnabled' => true,
                'darkModeEnabled' => true,
                'maintenanceMode' => false,
                'maintenanceMessage' => '',
                'appVersion' => '1.0.0',
                'minAppVersion' => '1.0.0',
                'content' => [],
                'hiddenDemoPropertyIds' => [],
                'deletedDemoPropertyIds' => [],
                'deletedDemoProjectIds' => [],
            ];
            $settings = array_merge($defaults, is_array($data['mobileSettings'] ?? null) ? $data['mobileSettings'] : []);
            if ($method === 'GET') return $this->json($settings);
            if (!in_array($method, ['PUT', 'PATCH'], true)) return $this->json(['error' => 'Method not allowed'], 405);
            $allowed = array_intersect_key($request->all(), $defaults);
            $validator = Validator::make($allowed, [
                'verificationBadgeEnabled' => ['sometimes', 'boolean'],
                'pushNotificationsEnabled' => ['sometimes', 'boolean'],
                'darkModeEnabled' => ['sometimes', 'boolean'],
                'maintenanceMode' => ['sometimes', 'boolean'],
                'maintenanceMessage' => ['sometimes', 'nullable', 'string', 'max:500'],
                'appVersion' => ['sometimes', 'string', 'max:40'],
                'minAppVersion' => ['sometimes', 'string', 'max:40'],
                'content' => ['sometimes', 'array'],
            ]);
            if ($validator->fails()) return $this->json(['error' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
            $settings = array_merge($settings, $validator->validated());
            $data['mobileSettings'] = $settings;
            JsonStore::write($data);
            return $this->json(['success' => true, 'settings' => $settings]);
        }
        if ($view === 'logs' && $method === 'GET') {
            $limit = max(1, min(200, (int) $request->query('limit', 100)));
            return $this->json([
                'applicationLogs' => $this->recentApplicationLogs($limit),
                'activityLogs' => collect($data['adminActivity'] ?? [])->reverse()->take($limit)->values(),
                'failedJobs' => $this->recentFailedJobs($limit),
                'checkedAt' => now()->toISOString(),
            ]);
        }
        return $this->json(['error' => 'Not found'], 404);
    }

    private function recentApplicationLogs(int $limit): array
    {
        $path = config('logging.channels.single.path', storage_path('logs/laravel.log'));
        if (!is_string($path) || !is_file($path) || !is_readable($path)) return [];
        $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) return [];
        $entries = [];
        foreach (array_reverse($lines) as $line) {
            if (preg_match('/^\[(.*?)\]\s+\w+\.(EMERGENCY|ALERT|CRITICAL|ERROR|WARNING|NOTICE|INFO|DEBUG):\s*(.*)$/', $line, $matches)) {
                $message = preg_replace('/(password|token|secret|authorization|cookie|api[_-]?key)\s*["\']?\s*[:=]\s*["\']?[^"\s,;}]+/i', '$1=[redacted]', $matches[3]);
                $entries[] = [
                    'timestamp' => $matches[1],
                    'level' => strtolower($matches[2]),
                    'message' => mb_substr((string) $message, 0, 500),
                ];
                if (count($entries) >= $limit) break;
            }
        }
        return $entries;
    }

    private function recentFailedJobs(int $limit): ?array
    {
        try {
            if (!Schema::hasTable('failed_jobs')) return null;
            return DB::table('failed_jobs')->orderByDesc('failed_at')->limit($limit)
                ->get(['uuid', 'connection', 'queue', 'failed_at'])
                ->map(fn ($job) => [
                    'id' => $job->uuid,
                    'connection' => $job->connection,
                    'queue' => $job->queue,
                    'failedAt' => $job->failed_at,
                ])->all();
        } catch (\Throwable $exception) {
            Log::warning('Failed job status could not be read.', ['error' => $exception->getMessage()]);
            return null;
        }
    }

    private function recordAdminActivity(array &$data, array $admin, string $action, string $entity, array $details = []): void
    {
        $records = is_array($data['adminActivity'] ?? null) ? $data['adminActivity'] : [];
        $records[] = [
            'id' => (string) Str::uuid(),
            'timestamp' => now()->toISOString(),
            'actorId' => $admin['id'] ?? null,
            'actorName' => $admin['name'] ?? $admin['email'] ?? 'Admin',
            'action' => $action,
            'entity' => $entity,
            'details' => $details,
        ];
        $data['adminActivity'] = array_slice($records, -500);
    }

    private function adminAnnouncements(Request $request, array $data, array $parts, string $method, array $admin)
    {
        $data['announcements'] = is_array($data['announcements'] ?? null) ? $data['announcements'] : [];
        $id = $parts[1] ?? null;
        $action = $parts[2] ?? null;

        if ($method === 'GET' && $id === null) {
            return $this->json($data['announcements']);
        }

        if ($method === 'POST' && $id === null) {
            $payload = $request->only([
                'title', 'message', 'imageUrl', 'type', 'priority', 'audience',
                'scheduleAt', 'expiresAt',
            ]);
            $sendNow = $request->boolean('sendNow');
            $scheduleAt = $payload['scheduleAt'] ?? null;
            $isScheduled = !$sendNow && $scheduleAt && strtotime((string) $scheduleAt) > now()->timestamp;
            $announcement = array_merge($payload, [
                'id' => JsonStore::nextId($data),
                'status' => $isScheduled ? 'scheduled' : 'draft',
                'createdAt' => now()->toISOString(),
                'createdBy' => $admin['id'],
                'recipientCount' => 0,
            ]);
            $data['announcements'][] = $announcement;
            if ($sendNow) {
                $index = count($data['announcements']) - 1;
                $this->deliverAnnouncement($data, $index);
                $announcement = $data['announcements'][$index];
            }
            JsonStore::write($data);
            return $this->json($announcement, 201);
        }

        $index = $this->indexById($data['announcements'], $id);
        if ($index === null) return $this->json(['error' => 'Announcement not found'], 404);
        if ($method === 'POST' && $action === 'send') {
            if (($data['announcements'][$index]['status'] ?? '') === 'sent') {
                return $this->json($data['announcements'][$index]);
            }
            $this->deliverAnnouncement($data, $index);
            JsonStore::write($data);
            return $this->json($data['announcements'][$index]);
        }
        if ($method === 'DELETE') {
            array_splice($data['announcements'], $index, 1);
            JsonStore::write($data);
            return response()->noContent();
        }
        if (in_array($method, ['PUT', 'PATCH'], true)) {
            $data['announcements'][$index] = array_merge(
                $data['announcements'][$index],
                $request->except(['id', 'createdBy', 'createdAt', 'sentAt', 'recipientCount']),
                ['updatedAt' => now()->toISOString()],
            );
            JsonStore::write($data);
            return $this->json($data['announcements'][$index]);
        }
        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function publicAnnouncement(Request $request, array $parts, string $method)
    {
        if ($method !== 'GET') return $this->json(['error' => 'Method not allowed'], 405);
        $items = collect(JsonStore::read()['announcements'] ?? [])
            ->filter(fn ($item) =>
                ($item['status'] ?? '') === 'sent'
                && (empty($item['expiresAt']) || strtotime((string) $item['expiresAt']) > now()->timestamp)
            );
        $id = $parts[0] ?? null;
        if ($id === null) return $this->json($items->values());
        $item = $items->first(fn ($announcement) => (string) ($announcement['id'] ?? '') === (string) $id);
        return $item ? $this->json($item) : $this->json(['error' => 'Announcement not found'], 404);
    }

    private function deliverAnnouncement(array &$data, int $index): void
    {
        $announcement = $data['announcements'][$index];
        $audience = (array) ($announcement['audience'] ?? []);
        $role = strtolower((string) ($audience['role'] ?? ''));
        $city = strtolower(trim((string) ($audience['city'] ?? '')));
        $recipientIds = collect($data['users'] ?? [])
            ->filter(function ($user) use ($role, $city) {
                if (!is_array($user) || in_array(strtolower((string) ($user['status'] ?? 'active')), ['inactive', 'suspended', 'blocked'], true)) {
                    return false;
                }
                if ($role !== '' && strtolower((string) ($user['role'] ?? '')) !== $role) return false;
                if ($city !== '' && strtolower(trim((string) ($user['city'] ?? ''))) !== $city) return false;
                return true;
            })
            ->pluck('id')->all();
        $type = match (strtolower((string) ($announcement['type'] ?? 'general'))) {
            'important' => 'IMPORTANT_ANNOUNCEMENT',
            'promotional' => 'PROMOTIONAL_ANNOUNCEMENT',
            'system' => 'SYSTEM_ANNOUNCEMENT',
            default => 'GENERAL_ANNOUNCEMENT',
        };
        $created = app(NotificationDeliveryService::class)->deliver($data, $recipientIds, [
            'type' => $type,
            'category' => strtolower((string) ($announcement['type'] ?? '')) === 'promotional' ? 'promotional' : 'announcements',
            'title' => $announcement['title'] ?? 'OG Landmark Update',
            'message' => $announcement['message'] ?? '',
            'body' => $announcement['message'] ?? '',
            'imageUrl' => $announcement['imageUrl'] ?? null,
            'entityType' => 'announcement',
            'entityId' => $announcement['id'],
            'announcementId' => $announcement['id'],
            'eventKey' => 'announcement:' . $announcement['id'],
            'priority' => $announcement['priority'] ?? 'NORMAL',
            'deepLink' => '/announcements/' . $announcement['id'],
            'expiresAt' => $announcement['expiresAt'] ?? null,
            'metadata' => ['audience' => $audience],
        ]);
        $data['announcements'][$index]['status'] = 'sent';
        $data['announcements'][$index]['sentAt'] = now()->toISOString();
        $data['announcements'][$index]['recipientCount'] = count($created);
    }

    private function users(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $id = $parts[0] ?? null;
        $data = JsonStore::read();
        if ($this->isAdmin($user)) {
            $permission = $method === 'GET' ? 'users.view' : 'users.manage';
            if ($id !== null && (string) $id === (string) $user['id'] && $method === 'PUT') {
                $permission = null;
            }
            if ($permission !== null && !$this->adminHasPermission($user, $permission, $data)) {
                return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => $permission], 403);
            }
            if ($id !== null && (string) $id !== (string) $user['id']) {
                $target = $this->findById($data['users'] ?? [], $id);
                if (strtolower((string) ($target['role'] ?? '')) === 'admin'
                    && !$this->adminHasPermission($user, 'staff.manage', $data)) {
                    return $this->json(['error' => 'Only staff managers can change another admin account.'], 403);
                }
            }
        }
        if ($id === null && $method === 'GET') {
            if (!$this->isAdmin($user)) return $this->json(['error' => 'Forbidden'], 403);
            $limit = max(1, min(500, (int) $request->input('limit', 500)));
            return $this->json(collect($data['users'] ?? [])
                ->take($limit)
                ->map(fn ($account) => $this->safeUser($account))
                ->values());
        }
        if ($id === null && $method === 'POST') {
            if (!$this->isAdmin($user)) return $this->json(['error' => 'Forbidden'], 403);
            $validator = Validator::make($request->all(), [
                'name' => ['required', 'string', 'max:160'],
                'email' => ['required', 'email', 'max:320'],
                'phone' => ['nullable', 'string', 'max:40'],
                'password' => ['required', 'string', 'min:8', 'max:256'],
                'role' => ['required', 'in:User,Agent,Developer,Admin'],
                'status' => ['nullable', 'in:Active,Suspended'],
            ]);
            if ($validator->fails()) {
                return $this->json(['error' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
            }
            if ($request->input('role') === 'Admin' && !$this->adminHasPermission($user, 'staff.manage', $data)) {
                return $this->json(['error' => 'Only staff managers can create admin accounts.'], 403);
            }
            $email = strtolower(trim((string) $request->input('email')));
            if (collect($data['users'] ?? [])->contains(fn ($account) => strtolower((string) ($account['email'] ?? '')) === $email)) {
                return $this->json(['error' => 'An account with this email already exists.'], 409);
            }
            $role = $request->input('role');
            $permission = strtolower($role);
            $newUser = [
                'id' => JsonStore::nextId($data),
                'name' => trim((string) $request->input('name')),
                'email' => $email,
                'phone' => trim((string) $request->input('phone', '')),
                'city' => trim((string) $request->input('city', '')),
                'agencyName' => trim((string) $request->input('agencyName', '')),
                'companyName' => trim((string) $request->input('companyName', '')),
                'accountType' => 'User',
                'permissions' => in_array($permission, ['agent', 'developer', 'admin'], true) ? [$permission] : [],
                'role' => $role,
                'status' => $request->input('status', 'Active'),
                'password' => $this->hashLegacyPassword((string) $request->input('password')),
                'joinedDate' => now()->toISOString(),
                'createdByAdmin' => true,
            ];
            if ($role === 'Admin') {
                $newUser['staffRole'] = 'custom';
                $newUser['staffPermissions'] = [];
            }
            $data['users'][] = $newUser;
            $this->notifyAccountUpdate(
                $data,
                (int) $newUser['id'],
                'ACCOUNT_WELCOME',
                'Welcome to OG Landmark',
                'Your account is ready. You can save properties and receive listing and service updates.',
                false,
                'account:created:' . $newUser['id'],
            );
            JsonStore::write($data);
            return $this->json($this->safeUser($newUser), 201);
        }
        if ($id === null || (string) $id !== (string) $user['id']) {
            if (!$this->isAdmin($user)) return $this->json(['error' => 'Forbidden'], 403);
        }
        $originalData = $data;
        $index = $this->indexById($data['users'] ?? [], $id);
        if ($index === null) return $this->json(['error' => 'User not found'], 404);
        if ($method === 'PUT') {
            if ($request->has('coverPhoto') && !$this->canManageAgentCover($data['users'][$index])) {
                return $this->json(['error' => 'Only admin-enabled Agent accounts can manage a cover photo.'], 403);
            }
            $isAdmin = $this->isAdmin($user);
            if (!$isAdmin && ($request->has('status') || $request->has('password'))) {
                return $this->json(['error' => 'Only an admin can change account status or password.'], 403);
            }
            if ($request->has('email')) {
                $email = strtolower(trim((string) $request->input('email')));
                if ($email !== '' && collect($data['users'] ?? [])->contains(fn ($account) =>
                    (string) ($account['id'] ?? '') !== (string) $id
                    && strtolower((string) ($account['email'] ?? '')) === $email
                )) {
                    return $this->json(['error' => 'An account with this email already exists.'], 409);
                }
                $request->merge(['email' => $email]);
            }
            if ($request->has('status') && !in_array($request->input('status'), ['Active', 'Suspended'], true)) {
                return $this->json(['error' => 'Status must be Active or Suspended.'], 422);
            }
            if ($request->has('password') && strlen((string) $request->input('password')) < 8) {
                return $this->json(['error' => 'Password must be at least 8 characters.'], 422);
            }
            if ($isAdmin && $request->input('status') === 'Suspended'
                && strtolower((string) ($data['users'][$index]['role'] ?? '')) === 'admin') {
                $activeAdmins = collect($data['users'] ?? [])->filter(fn ($account) =>
                    strtolower((string) ($account['role'] ?? '')) === 'admin'
                    && ($account['status'] ?? 'Active') === 'Active'
                )->count();
                if ((string) $data['users'][$index]['id'] === (string) $user['id'] || $activeAdmins <= 1) {
                    return $this->json(['error' => 'The signed-in or final active admin account cannot be suspended.'], 409);
                }
            }
            $originalAccount = $data['users'][$index];
            $changedFields = [];
            $allowed = ['name', 'phone', 'email', 'agencyName', 'companyName', 'city', 'profilePhoto', 'coverPhoto'];
            foreach ($allowed as $key) {
                if (!$request->has($key)) continue;
                $newValue = $request->input($key);
                if (($originalAccount[$key] ?? null) !== $newValue) $changedFields[] = $key;
                $data['users'][$index][$key] = $newValue;
            }
            if ($isAdmin && $request->has('status')) $data['users'][$index]['status'] = $request->input('status');
            if ($isAdmin && $request->has('password')) {
                $data['users'][$index]['password'] = $this->hashLegacyPassword((string) $request->input('password'));
            }
            if ($isAdmin && $request->has('status') && ($originalAccount['status'] ?? null) !== $request->input('status')) {
                $changedFields[] = 'status';
            }
            if ($isAdmin && $request->has('password')) $changedFields[] = 'password';
            if ($isAdmin
                && (string) ($data['users'][$index]['id'] ?? '') !== (string) ($user['id'] ?? '')
                && $changedFields !== []) {
                $target = $data['users'][$index];
                $hasSecurityChange = in_array('status', $changedFields, true) || in_array('password', $changedFields, true);
                $this->notifyAccountUpdate(
                    $data,
                    (int) $target['id'],
                    'ACCOUNT_ADMIN_UPDATED',
                    $hasSecurityChange ? 'Account security update' : 'Account details updated',
                    in_array('status', $changedFields, true)
                        ? 'Your OG Landmark account status was changed to ' . (string) ($target['status'] ?? 'Active') . '.'
                        : (in_array('password', $changedFields, true)
                            ? 'An administrator changed your account password. If you did not expect this, contact support.'
                            : 'OG Landmark support updated your account details.'),
                    $hasSecurityChange,
                    'account:admin-update:' . Str::uuid(),
                );
            }
            $this->writeWithMediaCleanup(
                $originalData,
                $data,
                $originalAccount,
                $data['users'][$index],
                ['profilePhoto', 'coverPhoto'],
            );
            return $this->json($this->safeUser($data['users'][$index]));
        }
        if ($method === 'PATCH' && ($parts[1] ?? '') === 'push-token') {
            $data['users'][$index]['pushToken'] = $request->input('pushToken');
            JsonStore::write($data); return $this->json(['success' => true]);
        }
        if ($method === 'DELETE') {
            if (!$this->isAdmin($user)) return $this->json(['error' => 'Forbidden'], 403);
            $target = $data['users'][$index];
            if (strtolower((string) ($target['role'] ?? '')) === 'admin') {
                $adminCount = collect($data['users'] ?? [])->filter(fn ($account) => strtolower((string) ($account['role'] ?? '')) === 'admin')->count();
                if ((string) $target['id'] === (string) $user['id'] || $adminCount <= 1) {
                    return $this->json(['error' => 'The signed-in or final admin account cannot be deleted.'], 409);
                }
            }
            $updatedData = app(AccountDataDeletionService::class)
                ->removeFromDocument($data, (string) $target['id']);
            $mediaStorage = app(MediaStorage::class);
            $removedMediaPaths = array_values(array_diff(
                $mediaStorage->referencedPaths($data),
                $mediaStorage->referencedPaths($updatedData),
            ));
            JsonStore::write($updatedData);
            $mediaStorage->deleteUnreferencedPaths($removedMediaPaths, $updatedData);
            $this->invalidateSessions($target['id'], $target['email'] ?? null);
            return response()->noContent();
        }
        return $this->json($this->safeUser($data['users'][$index]));
    }

    private function account(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read();
        $originalData = $data;
        $index = $this->indexById($data['users'] ?? [], $user['id']);
        if ($index === null) return $this->json(['error' => 'Account not found'], 404);
        $photo = $parts[0] ?? null;
        if ($photo && in_array($photo, ['profile-photo', 'cover-photo'], true)) {
            if ($photo === 'cover-photo' && !$this->canManageAgentCover($data['users'][$index])) {
                return $this->json(['error' => 'Only admin-enabled Agent accounts can manage a cover photo.'], 403);
            }
            $key = $photo === 'profile-photo' ? 'profilePhoto' : 'coverPhoto';
            if ($method === 'GET') return $this->json(['url' => $data['users'][$index][$key] ?? null]);
            if ($method === 'DELETE') {
                $originalUser = $data['users'][$index];
                $data['users'][$index][$key] = null;
                $this->writeWithMediaCleanup($originalData, $data, $originalUser, $data['users'][$index], [$key]);
                return response()->noContent();
            }
            if ($method === 'PUT') {
                $originalUser = $data['users'][$index];
                $data['users'][$index][$key] = $request->input('url');
                $this->writeWithMediaCleanup($originalData, $data, $originalUser, $data['users'][$index], [$key]);
                return $this->json(['url' => $data['users'][$index][$key]]);
            }
        }
        if ($method === 'GET') return $this->json($this->safeUser($data['users'][$index]));
        if ($method === 'DELETE') {
            $deletion = app(AccountDataDeletionService::class);
            $updatedData = $deletion->removeFromDocument($data, (string) $user['id']);
            $mediaStorage = app(MediaStorage::class);
            $removedMediaPaths = array_values(array_diff(
                $mediaStorage->referencedPaths($data),
                $mediaStorage->referencedPaths($updatedData),
            ));
            JsonStore::write($updatedData);
            $failedMediaDeletes = $mediaStorage->deleteUnreferencedPaths($removedMediaPaths, $updatedData);
            if ($failedMediaDeletes !== []) {
                Log::warning('Account deletion could not remove some unreferenced uploads.', [
                    'count' => count($failedMediaDeletes),
                ]);
            }
            $this->invalidateSessions($user['id'], $user['email'] ?? null);
            return response()->noContent();
        }
        if ($method === 'PUT') {
            if ($request->has('coverPhoto') && !$this->canManageAgentCover($data['users'][$index])) {
                return $this->json(['error' => 'Only admin-enabled Agent accounts can manage a cover photo.'], 403);
            }
            $originalUser = $data['users'][$index];
            foreach (['name', 'phone', 'city', 'agencyName', 'companyName', 'profilePhoto', 'coverPhoto'] as $key) if ($request->has($key)) $data['users'][$index][$key] = $request->input($key);
            $this->writeWithMediaCleanup($originalData, $data, $originalUser, $data['users'][$index], ['profilePhoto', 'coverPhoto']);
            return $this->json($this->safeUser($data['users'][$index]));
        }
        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function saved(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read();
        $userId = $parts[0] ?? $user['id'];
        if ((string) $userId !== (string) $user['id']) {
            if (!$this->isAdmin($user)) return $this->json(['error' => 'Forbidden'], 403);
            $permission = $method === 'GET' ? 'users.view' : 'users.manage';
            if (!$this->adminHasPermission($user, $permission, $data)) {
                return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => $permission], 403);
            }
        }
        $saved = $data['savedProperties'] ?? [];
        if (is_array($saved) && array_is_list($saved)) $saved = [$userId => $saved];
        $saved[(string) $userId] = array_values($saved[(string) $userId] ?? []);
        if ($method === 'GET' && count($parts) === 1) return $this->json($saved[(string) $userId]);
        $propertyId = $parts[1] ?? null;
        if ($method === 'POST' && $propertyId !== null) {
            $key = array_search((int) $propertyId, array_map('intval', $saved[(string) $userId]), true);
            if ($key === false) { $saved[(string) $userId][] = (int) $propertyId; $isSaved = true; }
            else { array_splice($saved[(string) $userId], $key, 1); $isSaved = false; }
            $data['savedProperties'] = $saved; JsonStore::write($data); return $this->json(['saved' => $isSaved]);
        }
        return $this->json(['error' => 'Not found'], 404);
    }

    private function savedSearches(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $userId = (string) $user['id'];
        $data = JsonStore::read();
        $data['savedSearches'] = array_values(array_filter(
            is_array($data['savedSearches'] ?? null) ? $data['savedSearches'] : [],
            'is_array',
        ));
        $items = collect($data['savedSearches']);
        $id = $parts[0] ?? null;

        if ($method === 'GET' && $id === null) {
            return $this->json($items->filter(fn ($item) => (string) ($item['userId'] ?? '') === $userId)->values());
        }

        if ($method === 'POST' && $id === null) {
            $item = array_merge($request->all(), [
                'id' => JsonStore::nextId($data, 'savedSearches'),
                'userId' => $user['id'],
                'createdAt' => now()->toISOString(),
                'updatedAt' => now()->toISOString(),
            ]);
            $data['savedSearches'][] = $item;
            JsonStore::write($data);
            return $this->json($item, 201);
        }

        if ($method === 'DELETE' && $id === null) {
            $data['savedSearches'] = $items
                ->reject(fn ($item) => (string) ($item['userId'] ?? '') === $userId)
                ->values()->all();
            JsonStore::write($data);
            return response()->noContent();
        }

        $index = $this->indexById($data['savedSearches'], $id);
        if ($index === null) return $this->json(['error' => 'Saved search not found'], 404);
        if ((string) ($data['savedSearches'][$index]['userId'] ?? '') !== $userId) {
            return $this->json(['error' => 'Forbidden'], 403);
        }
        if ($method === 'DELETE') {
            array_splice($data['savedSearches'], $index, 1);
            JsonStore::write($data);
            return response()->noContent();
        }
        if (in_array($method, ['PUT', 'PATCH'], true)) {
            $data['savedSearches'][$index] = array_merge(
                $data['savedSearches'][$index],
                $request->except(['id', 'userId', 'createdAt']),
                ['updatedAt' => now()->toISOString()],
            );
            JsonStore::write($data);
            return $this->json($data['savedSearches'][$index]);
        }
        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function notifications(Request $request, array $segments, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read();
        if (($segments[0] ?? '') === 'notification-preferences') {
            $key = 'notificationPreferences';
            $preferences = $data[$key][(string) $user['id']] ?? [
                'properties' => true, 'projects' => true, 'announcements' => true,
                'promotional' => true, 'account' => true, 'system' => true, 'frequency' => 'immediate',
            ];
            if ($method === 'PUT') { $preferences = array_merge($preferences, $request->all()); $data[$key][(string) $user['id']] = $preferences; JsonStore::write($data); }
            return $this->json($preferences);
        }
        $category = strtolower((string) $request->input('category', 'all'));
        $items = collect($data['notifications'] ?? [])
            ->filter(fn ($n) =>
                (string) ($n['recipientUserId'] ?? $n['userId'] ?? $n['forUserId'] ?? '') === (string) $user['id']
                && empty($n['userDeletedAt'])
                && empty($n['deletedAt'])
            );
        if ($category !== '' && $category !== 'all') {
            $items = $items->filter(fn ($n) => strtolower((string) ($n['category'] ?? 'system')) === $category);
        }
        $items = $items->values();
        $id = $segments[1] ?? null;
        if ($id === 'unread-count') return $this->json(['unreadCount' => $items->filter(fn ($n) => empty($n['read']) && empty($n['isRead']))->count()]);
        if ($id === 'mark-all-read' && $method === 'PATCH') {
            $visibleIds = $items->pluck('id')->map(fn ($itemId) => (string) $itemId)->all();
            foreach ($data['notifications'] ?? [] as $index => $notification) {
                if ((string) ($notification['recipientUserId'] ?? $notification['userId'] ?? $notification['forUserId'] ?? '') !== (string) $user['id']
                    || !in_array((string) ($notification['id'] ?? ''), $visibleIds, true)) continue;
                $data['notifications'][$index]['read'] = true;
                $data['notifications'][$index]['isRead'] = true;
                $data['notifications'][$index]['readAt'] = now()->toISOString();
            }
            JsonStore::write($data); return $this->json(['success' => true]);
        }
        if ($method === 'GET') {
            $page = max(1, (int) $request->input('page', 1)); $limit = min(100, max(1, (int) $request->input('limit', 25)));
            $pageItems = $items->forPage($page, $limit)->values()->all();
            return $this->json(['items' => $pageItems, 'page' => $page, 'limit' => $limit, 'total' => $items->count(), 'hasMore' => $page * $limit < $items->count(), 'unreadCount' => $items->filter(fn ($n) => empty($n['read']) && empty($n['isRead']))->count()]);
        }
        if ($id !== null) {
            $index = $this->indexById($data['notifications'] ?? [], $id);
            if ($index === null) return $this->json(['error' => 'Notification not found'], 404);
            if ((string) ($data['notifications'][$index]['recipientUserId'] ?? $data['notifications'][$index]['userId'] ?? $data['notifications'][$index]['forUserId'] ?? '') !== (string) $user['id']) {
                return $this->json(['error' => 'Notification not found'], 404);
            }
            if ($method === 'PATCH') { $data['notifications'][$index]['read'] = true; $data['notifications'][$index]['isRead'] = true; JsonStore::write($data); return $this->json($data['notifications'][$index]); }
            if ($method === 'DELETE') { $data['notifications'][$index]['userDeletedAt'] = now()->toISOString(); JsonStore::write($data); return response()->noContent(); }
        }
        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function upload(Request $request, array $parts)
    {
        $user = $this->currentUser($request, true);
        $projectMedia = $this->isAdmin($user) && $request->input('context') === 'project';
        if ($this->isAdmin($user)) {
            $permission = ($parts[0] ?? '') === 'single' || $projectMedia ? 'content.manage' : 'property.manage';
            if (!$this->adminHasPermission($user, $permission, JsonStore::read())) {
                return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => $permission], 403);
            }
        }
        $field = ($parts[0] ?? '') === 'video' ? 'video' : (($parts[0] ?? '') === 'single' ? 'image' : 'images');
        $files = $request->file($field);
        $files = is_array($files) ? $files : ($files ? [$files] : []);
        if (!$files) return $this->json(['error' => 'No upload received.'], 422);
        if ($projectMedia) {
            foreach ($files as $file) {
                $extension = strtolower($file->getClientOriginalExtension());
                if (!$file->isValid()) {
                    return $this->json(['error' => 'The selected file could not be read. Please choose it again.', 'code' => 'UPLOAD_FILE_INVALID'], 422);
                }
                if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'm4v', 'webm'], true)) {
                    return $this->json(['error' => 'Project media must be JPG, PNG, WebP, MP4, MOV, M4V, or WebM.'], 422);
                }
                $maxBytes = in_array($extension, ['mp4', 'mov', 'm4v', 'webm'], true) ? 300 * 1024 * 1024 : 20 * 1024 * 1024;
                if ((int) $file->getSize() > $maxBytes) {
                    return $this->json(['error' => 'Project images are limited to 20 MiB and project videos to 300 MiB.'], 413);
                }
            }
        }
        $mediaStorage = app(MediaStorage::class);
        try {
            $mediaStorage->ensureReady();
        } catch (\Throwable $exception) {
            Log::error('Media storage is not ready for upload.', ['error' => $exception->getMessage()]);

            return $this->json([
                'error' => 'Media storage is not available. Contact the administrator.',
                'code' => 'MEDIA_STORAGE_NOT_READY',
            ], 503);
        }
        $directory = $mediaStorage->directory();
        $urls = [];
        $media = [];
        $writtenPaths = [];
        foreach ($files as $file) {
            if (!$file->isValid()) {
                $uploadError = $file->getError();
                if (in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
                    return $this->json([
                        'error' => 'This file is too large for the server. Choose a smaller photo or shorter video.',
                        'code' => 'UPLOAD_FILE_TOO_LARGE',
                    ], 413);
                }

                return $this->json([
                    'error' => 'The selected file could not be read. Please choose it again.',
                    'code' => 'UPLOAD_FILE_INVALID',
                ], 422);
            }
            if (!in_array(strtolower($file->getClientOriginalExtension()), [
                'jpg', 'jpeg', 'png', 'webp',
                'mp4', 'mov', 'm4v', '3gp', 'webm', 'avi',
            ], true)) {
                return $this->json([
                    'error' => 'This file format is not supported. Photos are converted to JPEG; videos can be MP4, MOV, M4V, 3GP, WebM, or AVI.',
                    'code' => 'UPLOAD_FORMAT_NOT_SUPPORTED',
                ], 422);
            }
            $name = now()->format('YmdHis') . '-' . Str::random(24) . '.' . strtolower($file->getClientOriginalExtension());
            $mimeType = $file->getMimeType();
            $kind = str_starts_with((string) $mimeType, 'video/') ? 'video' : 'image';
            try {
                $file->move($directory, $name);
                $writtenPaths[] = $directory . DIRECTORY_SEPARATOR . $name;
            } catch (\Throwable $exception) {
                foreach (array_merge($writtenPaths, [$directory . DIRECTORY_SEPARATOR . $name]) as $writtenPath) {
                    if (is_file($writtenPath)) @unlink($writtenPath);
                }
                Log::error('Uploaded media could not be written to storage.', [
                    'filename' => $name,
                    'error' => $exception->getMessage(),
                ]);

                return $this->json([
                    'error' => 'The uploaded file could not be saved. Please contact support.',
                    'code' => 'MEDIA_STORAGE_WRITE_FAILED',
                ], 503);
            }
            $path = '/images/uploads/' . $name;
            $url = $mediaStorage->url($path);
            $urls[] = $url;
            $media[] = [
                'url' => $url,
                'path' => $path,
                'mimeType' => $mimeType,
                'bytes' => filesize($directory . DIRECTORY_SEPARATOR . $name) ?: 0,
                'kind' => $kind,
            ];
        }
        return $this->json(count($urls) === 1
            ? ['url' => $urls[0], 'media' => $media[0]]
            : ['urls' => $urls, 'media' => $media]);
    }

    private function mobile(Request $request, array $parts, string $method)
    {
        $resource = $parts[0] ?? '';
        if ($resource === 'banners') {
            return $this->mobileBanners($request, $parts, $method);
        }
        $data = JsonStore::read();
        if ($resource === 'settings') {
            $defaultSettings = [
                'verificationBadgeEnabled' => true, 'pushNotificationsEnabled' => true,
                'darkModeEnabled' => true, 'maintenanceMode' => false, 'maintenanceMessage' => '',
                'appVersion' => '1.0.0', 'minAppVersion' => '1.0.0', 'content' => [],
                'hiddenDemoPropertyIds' => [],
                'deletedDemoPropertyIds' => [],
                'deletedDemoProjectIds' => [],
            ];
            $settings = array_merge(
                $defaultSettings,
                is_array($data['mobileSettings'] ?? null) ? $data['mobileSettings'] : [],
            );
            if (!is_array($settings['hiddenDemoPropertyIds'] ?? null)) {
                $settings['hiddenDemoPropertyIds'] = [];
            }
            if ($method === 'GET') return $this->json($settings);
            $admin = $this->currentUser($request, true);
            if (!$this->isAdmin($admin) || !$this->adminHasPermission($admin, 'settings.manage', $data)) return $this->json(['error' => 'Forbidden'], 403);
            $settings = $this->deepMerge($settings, $request->all()); $data['mobileSettings'] = $settings; JsonStore::write($data);
            return $this->json(['success' => true, 'settings' => $settings]);
        }
        if ($resource === 'push' && $method === 'POST') {
            $admin = $this->currentUser($request, true);
            if (!$this->isAdmin($admin) || !$this->adminHasPermission($admin, 'notifications.manage', $data)) return $this->json(['error' => 'Forbidden'], 403);
            $title = trim((string) $request->input('title', ''));
            $body = trim((string) $request->input('body', ''));
            if ($title === '' || $body === '') return $this->json(['error' => 'Title and message are required.'], 422);
            $recipientIds = collect($data['users'] ?? [])
                ->filter(fn ($user) => is_array($user)
                    && !in_array(strtolower((string) ($user['status'] ?? 'active')), ['inactive', 'suspended', 'blocked'], true))
                ->pluck('id')->all();
            if (!$recipientIds) return $this->json(['error' => 'There are no active accounts to notify.'], 409);

            $notificationData = $request->input('data', []);
            $created = app(NotificationDeliveryService::class)->deliver($data, $recipientIds, [
                'type' => strtoupper((string) ($notificationData['type'] ?? 'SYSTEM_UPDATE')),
                'category' => $notificationData['category'] ?? 'system',
                'title' => $title,
                'message' => $body,
                'body' => $body,
                'eventKey' => 'admin-broadcast:' . Str::uuid(),
                'priority' => $notificationData['priority'] ?? 'NORMAL',
                'deepLink' => $notificationData['deepLink'] ?? null,
                'metadata' => is_array($notificationData) ? $notificationData : [],
            ]);
            JsonStore::write($data);
            return $this->json([
                'success' => true,
                'sent' => count($created),
                'notificationsCreated' => count($created),
                'totalRecipients' => count($recipientIds),
                'title' => $title,
                'body' => $body,
                'sentAt' => now()->toISOString(),
            ]);
        }
        if ($resource === 'stats' && $method === 'GET') return $this->adminStats($data);
        if ($resource === 'developer-analytics' && $method === 'GET') return $this->json(['projects' => count($data['developerProjects'] ?? []), 'leads' => count($data['developerLeads'] ?? []), 'units' => count($data['inventoryUnits'] ?? []), 'generatedAt' => now()->toISOString()]);
        return $this->json(['error' => 'Not found'], 404);
    }

    private function mobileBanners(Request $request, array $parts, string $method)
    {
        $adminRead = ($parts[1] ?? '') === 'all';
        if ($method !== 'GET' || $adminRead) {
            $admin = $this->currentUser($request, true);
            $data = JsonStore::read();
            if (!$this->isAdmin($admin) || !$this->adminHasPermission($admin, 'content.manage', $data)) {
                return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => 'content.manage'], 403);
            }
        }

        $data = JsonStore::read();
        $usingLegacyBanners = !array_key_exists('mobileBanners', $data) && array_key_exists('banners', $data);
        $banners = $data['mobileBanners'] ?? $data['banners'] ?? [];
        $banners = is_array($banners) ? array_values($banners) : [];
        $data['mobileBanners'] = $banners;
        unset($data['banners']);

        if ($method === 'GET' && empty($data['mobileBannersSeeded'])) {
            $data['mobileBanners'] = $this->seedMobileBanners($data);
            $data['mobileBannersSeeded'] = true;
            JsonStore::write($data);
        } elseif ($method === 'GET' && $usingLegacyBanners) {
            JsonStore::write($data);
        }

        $all = $this->sortMobileBanners($data['mobileBanners']);
        if ($method === 'GET') {
            if ($adminRead) return $this->json($all);
            $today = now()->toDateString();
            return $this->json(array_values(array_filter(
                $all,
                fn ($banner) => filter_var($banner['active'] ?? true, FILTER_VALIDATE_BOOLEAN)
                    && (empty($banner['startDate']) || $banner['startDate'] <= $today)
                    && (empty($banner['endDate']) || $banner['endDate'] >= $today),
            )));
        }

        $id = $parts[1] ?? null;
        if ($method === 'POST') {
            return $this->createMobileBanner($request, $data, $all);
        }

        $index = $this->indexById($data['mobileBanners'], $id);
        if ($index === null) return $this->json(['error' => 'Banner not found'], 404);
        $banner = $data['mobileBanners'][$index];

        if ($method === 'DELETE') {
            array_splice($data['mobileBanners'], $index, 1);
            JsonStore::write($data);
            $this->deleteUnreferencedBannerMedia($banner, $data);
            return $this->json(['success' => true]);
        }

        if ($method === 'PATCH' && ($parts[2] ?? '') === 'toggle') {
            $data['mobileBanners'][$index]['active'] = array_key_exists('active', $request->all())
                ? $request->boolean('active')
                : !filter_var($banner['active'] ?? false, FILTER_VALIDATE_BOOLEAN);
            JsonStore::write($data);
            return $this->json(['success' => true, 'active' => $data['mobileBanners'][$index]['active']]);
        }

        if ($method === 'PUT' || ($method === 'PATCH' && ($parts[2] ?? '') === '')) {
            $changes = $request->except(['media', 'id', 'type', '_method']);
            $schedule = $this->mobileBannerSchedule($request->all(), $banner, true);
            if (isset($schedule['error'])) {
                return $this->json($schedule, 422);
            }
            $changes = array_merge($changes, $schedule);
            if (array_key_exists('ctaParams', $changes) && is_string($changes['ctaParams'])) {
                $decodedParams = json_decode($changes['ctaParams'], true);
                if (json_last_error() !== JSON_ERROR_NONE || !is_array($decodedParams)) {
                    return $this->json(['error' => 'ctaParams must be a JSON object.'], 422);
                }
                $changes['ctaParams'] = $decodedParams;
            } elseif (array_key_exists('ctaParams', $changes) && !is_array($changes['ctaParams'])) {
                return $this->json(['error' => 'ctaParams must be a JSON object.'], 422);
            }
            if (array_key_exists('category', $changes)) {
                if (($banner['type'] ?? 'image') === 'image' && !in_array($changes['category'], ['homes', 'commercial', 'agriculture', 'plots', 'projects'], true)) {
                    return $this->json(['error' => 'Invalid image banner category.'], 422);
                }
                if (($banner['type'] ?? 'image') === 'image' && $this->hasImageBannerCategory($data['mobileBanners'], $changes['category'], $id)) {
                    return $this->json(['error' => 'An image banner already exists for this category.'], 409);
                }
            }
            $type = strtolower((string) ($banner['type'] ?? 'image'));
            $mediaField = $type === 'video' ? 'videoUrl' : 'imageUrl';
            $otherMediaField = $type === 'video' ? 'imageUrl' : 'videoUrl';
            unset($changes[$otherMediaField]);

            $upload = $request->file('media');
            if ($upload) {
                $extension = strtolower($upload->getClientOriginalExtension());
                $allowed = $type === 'video' ? ['mp4', 'mov'] : ['jpg', 'jpeg', 'png', 'webp'];
                $maxBytes = $type === 'video' ? 300 * 1024 * 1024 : 20 * 1024 * 1024;
                if (!$upload->isValid() || !in_array($extension, $allowed, true) || (int) $upload->getSize() > $maxBytes) {
                    return $this->json([
                        'error' => $type === 'video'
                            ? 'Video uploads must be MP4 or MOV and no larger than 300 MiB.'
                            : 'Image uploads must be JPG, PNG or WebP and no larger than 20 MiB.',
                    ], 422);
                }

                $storage = app(MediaStorage::class);
                try {
                    $storage->ensureReady();
                    $filename = now()->format('YmdHis') . '-' . Str::random(32) . '.' . $extension;
                    $upload->move($storage->directory(), $filename);
                    $path = $storage->publicPath($filename);
                    $mediaUrl = $storage->url($path);
                    $filePath = $storage->fileForPublicPath($path);
                    $changes[$mediaField] = $mediaUrl;
                    $changes['media'] = [
                        'url' => $mediaUrl,
                        'path' => $path,
                        'mimeType' => $upload->getMimeType(),
                        'bytes' => $filePath && is_file($filePath) ? (filesize($filePath) ?: 0) : 0,
                        'kind' => $type,
                    ];
                } catch (\Throwable $exception) {
                    Log::error('Banner media storage is not ready for replacement.', ['error' => $exception->getMessage()]);
                    return $this->json(['error' => 'Media storage is not available. Contact the administrator.', 'code' => 'MEDIA_STORAGE_NOT_READY'], 503);
                }
            }

            $mediaChanged = $upload !== null
                || (array_key_exists($mediaField, $changes)
                    && ($changes[$mediaField] ?? null) !== ($banner[$mediaField] ?? null));
            if (!$upload && $mediaChanged) $changes['media'] = null;
            $previousBanner = $banner;
            $data['mobileBanners'][$index] = array_merge($banner, $changes);
            JsonStore::write($data);
            if ($mediaChanged) $this->deleteUnreferencedBannerMedia($previousBanner, $data);
            return $this->json(['success' => true, 'banner' => $data['mobileBanners'][$index]]);
        }

        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function seedMobileBanners(array &$data): array
    {
        $banners = $data['mobileBanners'] ?? [];
        $seed = [
            ['homes', 'Homes', 'House', 'Find your place', 'Homes that feel like home', 'Explore verified homes across Pakistan.', 'Explore homes'],
            ['commercial', 'Commercial', 'Commercial', 'Make your next move', 'Commercial spaces with potential', 'Discover shops, offices and commercial properties.', 'Explore commercial'],
            ['agriculture', 'Agriculture Land', 'Agriculture Land', 'Room to grow', 'Agricultural land for tomorrow', 'Find fertile land and investment opportunities.', 'Explore land'],
            ['plots', 'Plots', 'Plot', 'Build what’s next', 'The right plot starts here', 'Explore plots in the locations you love.', 'Explore plots'],
            ['projects', 'Projects', 'Project', 'A better way forward', 'Discover exceptional projects', 'Explore thoughtfully selected developments.', 'Explore projects'],
        ];

        foreach ($seed as $order => [$category, $ctaCategory, $propertyType, $eyebrow, $title, $subtitle, $cta]) {
            $exists = collect($banners)->contains(fn ($banner) =>
                (string) ($banner['category'] ?? '') === $category
                && strtolower((string) ($banner['type'] ?? 'image')) === 'image'
            );
            if ($exists) continue;
            $banners[] = [
                'id' => JsonStore::nextId($data),
                'type' => 'image',
                'category' => $category,
                'imageUrl' => '/images/mobile-banners/' . $category . '.jpg',
                'eyebrow' => $eyebrow,
                'title' => $title,
                'subtitle' => $subtitle,
                'cta' => $cta,
                'route' => '/explore',
                'ctaParams' => ['category' => $ctaCategory, 'propertyType' => $propertyType],
                'active' => true,
                'order' => $order,
            ];
        }

        return array_values($banners);
    }

    private function sortMobileBanners(array $banners): array
    {
        $indexed = [];
        foreach (array_values($banners) as $position => $banner) {
            $indexed[] = ['position' => $position, 'banner' => $banner];
        }
        usort($indexed, fn ($left, $right) =>
            ((int) ($left['banner']['order'] ?? 0) <=> (int) ($right['banner']['order'] ?? 0))
            ?: ($left['position'] <=> $right['position'])
        );

        return array_values(array_map(fn ($item) => $item['banner'], $indexed));
    }

    private function createMobileBanner(Request $request, array $data, array $banners)
    {
        $existingImage = null;
        if (strtolower(trim((string) $request->input('type', ''))) === 'image') {
            $category = trim((string) $request->input('category', ''));
            foreach ($data['mobileBanners'] as $existing) {
                if ((string) ($existing['category'] ?? '') === $category
                    && strtolower((string) ($existing['type'] ?? 'image')) === 'image') {
                    $existingImage = $existing;
                    break;
                }
            }
        }
        $schedule = $this->mobileBannerSchedule($request->all(), $existingImage ?? [], true);
        if (isset($schedule['error'])) {
            return $this->json($schedule, 422);
        }

        $type = strtolower(trim((string) $request->input('type', '')));
        if (!in_array($type, ['image', 'video'], true)) {
            return $this->json(['error' => 'Banner type must be image or video.'], 422);
        }
        $category = trim((string) $request->input('category', $type === 'video' ? 'video' : ''));
        if ($type === 'image' && !in_array($category, ['homes', 'commercial', 'agriculture', 'plots', 'projects'], true)) {
            return $this->json(['error' => 'A valid image banner category is required.'], 422);
        }
        if ($type === 'video' && !in_array($category, ['video', 'homes', 'commercial', 'agriculture', 'plots', 'projects'], true)) {
            return $this->json(['error' => 'A valid video category is required.'], 422);
        }

        $upload = $request->file('media');
        $imageUrl = trim((string) $request->input('imageUrl', ''));
        $videoUrl = '';
        $mediaInfo = null;
        if ($upload) {
            $extension = strtolower($upload->getClientOriginalExtension());
            $allowed = $type === 'image' ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp4', 'mov'];
            $maxBytes = $type === 'image' ? 20 * 1024 * 1024 : 300 * 1024 * 1024;
            if (!$upload->isValid() || !in_array($extension, $allowed, true) || (int) $upload->getSize() > $maxBytes) {
                return $this->json([
                    'error' => $type === 'image'
                        ? 'Image uploads must be JPG, PNG or WebP and no larger than 20 MiB.'
                        : 'Video uploads must be MP4 or MOV and no larger than 300 MiB.',
                ], 422);
            }
            $storage = app(MediaStorage::class);
            try {
                $storage->ensureReady();
                $filename = now()->format('YmdHis') . '-' . Str::random(32) . '.' . $extension;
                $upload->move($storage->directory(), $filename);
                $path = $storage->publicPath($filename);
                $mediaUrl = $storage->url($path);
                if ($type === 'video') $videoUrl = $mediaUrl;
                else $imageUrl = $mediaUrl;
                $filePath = $storage->fileForPublicPath($path);
                $mediaInfo = [
                    'url' => $mediaUrl,
                    'path' => $path,
                    'mimeType' => $upload->getMimeType(),
                    'bytes' => $filePath && is_file($filePath) ? (filesize($filePath) ?: 0) : 0,
                    'kind' => $type,
                ];
            } catch (\Throwable $exception) {
                Log::error('Banner media storage is not ready for upload.', ['error' => $exception->getMessage()]);
                return $this->json(['error' => 'Media storage is not available. Contact the administrator.', 'code' => 'MEDIA_STORAGE_NOT_READY'], 503);
            }
        } elseif ($imageUrl === '') {
            return $this->json(['error' => 'A media upload or imageUrl is required.'], 422);
        }
        if ($type === 'video' && !$upload) {
            return $this->json(['error' => 'Video banners require a media upload.'], 422);
        }

        $ctaParams = $request->input('ctaParams');
        if (is_string($ctaParams) && $ctaParams !== '') {
            $ctaParams = json_decode($ctaParams, true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($ctaParams)) {
                return $this->json(['error' => 'ctaParams must be a JSON object.'], 422);
            }
        } elseif ($ctaParams !== null && !is_array($ctaParams)) {
            return $this->json(['error' => 'ctaParams must be a JSON object.'], 422);
        }

        $metadata = [];
        foreach (['eyebrow', 'title', 'subtitle', 'cta', 'route'] as $field) {
            if (array_key_exists($field, $request->all())) $metadata[$field] = $request->input($field);
        }
        $metadata['type'] = $type;
        $metadata['category'] = $category;
        if ($type === 'image') $metadata['imageUrl'] = $imageUrl;
        else $metadata['videoUrl'] = $videoUrl;
        if ($mediaInfo !== null) $metadata['media'] = $mediaInfo;
        if ($ctaParams !== null) $metadata['ctaParams'] = $ctaParams;
        if ($request->has('active')) $metadata['active'] = $request->boolean('active');
        if ($request->has('order')) $metadata['order'] = (int) $request->input('order');
        $metadata = array_merge($metadata, $schedule);

        if ($type === 'image') {
            $existingIndex = null;
            foreach ($data['mobileBanners'] as $position => $existing) {
                if ((string) ($existing['category'] ?? '') === $category
                    && strtolower((string) ($existing['type'] ?? 'image')) === 'image') {
                    $existingIndex = $position;
                    break;
                }
            }
            if ($existingIndex !== null) {
                $previousBanner = $data['mobileBanners'][$existingIndex];
                $metadata['id'] = $previousBanner['id'] ?? JsonStore::nextId($data);
                $data['mobileBanners'][$existingIndex] = array_merge($data['mobileBanners'][$existingIndex], $metadata);
                JsonStore::write($data);
                $this->deleteUnreferencedBannerMedia($previousBanner, $data);
                return $this->json(['success' => true, 'banner' => $data['mobileBanners'][$existingIndex]]);
            }
        }

        if (!array_key_exists('active', $metadata)) $metadata['active'] = true;
        if (!array_key_exists('order', $metadata)) $metadata['order'] = count($banners);
        $metadata['startDate'] ??= null;
        $metadata['endDate'] ??= null;
        $banner = array_merge($metadata, ['id' => JsonStore::nextId($data)]);
        $data['mobileBanners'][] = $banner;
        JsonStore::write($data);
        return $this->json(['success' => true, 'banner' => $banner], 201);
    }

    /**
     * Normalize optional campaign dates while preserving omitted fields on updates.
     */
    private function mobileBannerSchedule(array $input, array $current = [], bool $partial = false): array
    {
        $dates = [];
        $errors = [];
        foreach (['startDate', 'endDate'] as $field) {
            $provided = array_key_exists($field, $input);
            if ($partial && !$provided) {
                continue;
            }

            $value = $provided ? $input[$field] : ($current[$field] ?? null);
            $value = is_string($value) ? trim($value) : $value;
            if ($value === '') $value = null;

            if ($value !== null && (
                !is_string($value)
                || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)
                || !checkdate((int) substr($value, 5, 2), (int) substr($value, 8, 2), (int) substr($value, 0, 4))
            )) {
                $label = $field === 'startDate' ? 'Start date' : 'End date';
                $errors[$field] = $label . ' must be a valid date in YYYY-MM-DD format.';
                continue;
            }
            $dates[$field] = $value;
        }

        $startDate = array_key_exists('startDate', $dates) ? $dates['startDate'] : ($current['startDate'] ?? null);
        $endDate = array_key_exists('endDate', $dates) ? $dates['endDate'] : ($current['endDate'] ?? null);
        if ($startDate !== null && $endDate !== null && $startDate > $endDate) {
            $errors['endDate'] = 'End date must be the same as or later than the start date.';
        }

        return $errors
            ? ['error' => 'The banner campaign dates are invalid.', 'errors' => $errors]
            : $dates;
    }

    private function hasImageBannerCategory(array $banners, string $category, $exceptId = null): bool
    {
        foreach ($banners as $banner) {
            if ((string) ($banner['id'] ?? '') === (string) $exceptId) continue;
            if ((string) ($banner['category'] ?? '') === $category
                && strtolower((string) ($banner['type'] ?? 'image')) === 'image') return true;
        }
        return false;
    }

    private function deleteUnreferencedBannerMedia(array $banner, array $data): void
    {
        $storage = app(MediaStorage::class);
        foreach ($storage->referencedPaths($banner) as $path) {
            if (in_array($path, $storage->referencedPaths($data), true)) continue;
            $file = $storage->fileForPublicPath($path);
            if ($file !== null && is_file($file)) @unlink($file);
        }
    }

    /**
     * Persist a profile/media record before removing files that it no longer uses.
     * On a failed write, only newly supplied paths are candidates for cleanup;
     * both paths are checked against the canonical document before deletion.
     */
    private function writeWithMediaCleanup(
        array $beforeData,
        array $afterData,
        array $beforeRecord,
        array $afterRecord,
        array $mediaFields,
    ): void {
        $storage = app(MediaStorage::class);
        $removedPaths = [];
        $addedPaths = [];

        foreach ($mediaFields as $field) {
            $beforeValue = $beforeRecord[$field] ?? null;
            $afterValue = $afterRecord[$field] ?? null;
            if ($beforeValue === $afterValue) {
                continue;
            }

            $removedPaths = array_merge($removedPaths, $storage->referencedPaths($beforeValue));
            $addedPaths = array_merge($addedPaths, $storage->referencedPaths($afterValue));
        }

        try {
            JsonStore::write($afterData);
        } catch (\Throwable $exception) {
            $failedDeletes = $storage->deleteUnreferencedPaths($addedPaths, $beforeData);
            if ($failedDeletes !== []) {
                Log::warning('Failed profile save could not remove some unreferenced uploads.', [
                    'count' => count($failedDeletes),
                ]);
            }

            throw $exception;
        }

        $failedDeletes = $storage->deleteUnreferencedPaths($removedPaths, $afterData);
        if ($failedDeletes !== []) {
            Log::warning('Profile media update could not remove some unreferenced uploads.', [
                'count' => count($failedDeletes),
            ]);
        }
    }

    private function blog(Request $request, array $parts, string $method)
    {
        $posts = JsonStore::read()['blogPosts'] ?? [];
        if ($method !== 'GET') return $this->json(['error' => 'Method not allowed'], 405);
        $id = $parts[0] ?? null;
        if ($id === null) return $this->json(collect($posts)->filter(fn ($p) => $p['published'] ?? true)->take((int) $request->input('limit', 50))->values());
        $post = $this->findById($posts, $id);
        return $post ? $this->json($post) : $this->json(['error' => 'Post not found'], 404);
    }

    private function agents(Request $request, array $segments, string $method)
    {
        $data = JsonStore::read();
        $itemsByIdentity = [];
        $mobileOnly = ($segments[0] ?? '') === 'mobile-agents';
        $sourceDirectories = $mobileOnly
            ? ['mobile' => $data['mobileAgents'] ?? []]
            : [
                'website' => $data['cityAgents'] ?? [],
                'mobile' => $data['mobileAgents'] ?? [],
            ];
        $phoneCounts = [];
        foreach ($sourceDirectories as $source => $sourceItems) {
            foreach ($sourceItems as $agent) {
                $phone = preg_replace('/\D+/', '', (string) ($agent['phone'] ?? $agent['mobile'] ?? ''));
                if (strlen($phone) === 12 && str_starts_with($phone, '92')) $phone = '0' . substr($phone, 2);
                elseif (strlen($phone) === 10 && str_starts_with($phone, '3')) $phone = '0' . $phone;
                if ($phone !== '') $phoneCounts[$source][$phone] = ($phoneCounts[$source][$phone] ?? 0) + 1;
            }
        }
        foreach ($sourceDirectories as $source => $sourceItems) {
            foreach ($sourceItems as $agent) {
                if (!is_array($agent)) continue;
                $email = strtolower(trim((string) ($agent['email'] ?? $agent['loginEmail'] ?? '')));
                $phone = preg_replace('/\D+/', '', (string) ($agent['phone'] ?? $agent['mobile'] ?? ''));
                if (strlen($phone) === 12 && str_starts_with($phone, '92')) $phone = '0' . substr($phone, 2);
                elseif (strlen($phone) === 10 && str_starts_with($phone, '3')) $phone = '0' . $phone;
                $userId = trim((string) ($agent['userId'] ?? $agent['accountId'] ?? ''));
                $nameKey = strtolower(trim((string) ($agent['displayName'] ?? $agent['name'] ?? '')));
                $sharedPhone = $phone !== '' && (($phoneCounts['website'][$phone] ?? 0) > 1 || ($phoneCounts['mobile'][$phone] ?? 0) > 1);
                $identity = $userId !== '' ? "user:{$userId}"
                    : ($email !== '' ? "email:{$email}"
                    : ($phone !== '' ? ($sharedPhone ? "phone-name:{$phone}:{$nameKey}" : "phone:{$phone}") : "{$source}:" . (string) ($agent['id'] ?? count($itemsByIdentity))));

                if (isset($itemsByIdentity[$identity])) {
                    $existing = $itemsByIdentity[$identity];
                    foreach ($agent as $field => $value) {
                        if (!array_key_exists($field, $existing) || $existing[$field] === null || $existing[$field] === '' || $existing[$field] === []) {
                            $existing[$field] = $value;
                        }
                    }
                    $itemsByIdentity[$identity] = $existing;
                    continue;
                }
                $name = trim((string) ($agent['displayName'] ?? $agent['name'] ?? ''));
                $photo = $agent['photo'] ?? $agent['profilePhoto'] ?? null;
                $agent['name'] = $name;
                $agent['displayName'] = trim((string) ($agent['displayName'] ?? $name));
                if ($photo !== null && $photo !== '') {
                    $agent['photo'] = $photo;
                    $agent['profilePhoto'] = $agent['profilePhoto'] ?? $photo;
                }
                if ($source === 'website') {
                    $directoryIsActive = ($agent['active'] ?? true) !== false;
                    $agent['status'] = $agent['status'] ?? ($directoryIsActive ? 'Active' : 'Suspended');
                    $agent['approvalStatus'] = $agent['approvalStatus'] ?? ($directoryIsActive ? 'Approved' : 'Rejected');
                    $agent['visible'] = $agent['visible'] ?? $directoryIsActive;
                }
                $agent['status'] = $agent['status'] ?? 'Active';
                $agent['visible'] = $agent['visible'] ?? true;
                $agent['approvalStatus'] = $agent['approvalStatus'] ?? 'Approved';
                $agent['title'] = $agent['title'] ?? $agent['agency'] ?? 'Property Consultant';
                $agent['specialization'] = $agent['specialization']
                    ?? (isset($agent['specialties']) && is_array($agent['specialties']) ? implode(', ', $agent['specialties']) : '');
                $agent['propertiesCount'] = (int) ($agent['propertiesCount'] ?? $agent['listings'] ?? 0);
                $itemsByIdentity[$identity] = $agent;
            }
        }
        $items = array_values($itemsByIdentity);
        if ($method === 'GET') {
            if ($mobileOnly) {
                $items = array_values(array_filter($items, function ($agent) {
                    $status = strtolower(trim((string) ($agent['status'] ?? 'active')));
                    $approval = strtolower(trim((string) ($agent['approvalStatus'] ?? 'approved')));
                    $visible = filter_var($agent['visible'] ?? true, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                    return $status === 'active' && $approval === 'approved' && $visible !== false;
                }));
            }
            if ($request->filled('approvalStatus')) {
                $approvalStatus = (string) $request->input('approvalStatus');
                $items = array_values(array_filter($items, fn ($agent) =>
                    ($agent['approvalStatus'] ?? null) === $approvalStatus
                    && ($approvalStatus !== 'Approved' || (($agent['status'] ?? 'Active') === 'Active' && ($agent['visible'] ?? true) !== false))
                ));
            }
            return $this->json(collect($items)->filter(fn ($a) => !$request->filled('city') || strtolower((string) ($a['city'] ?? '')) === strtolower((string) $request->input('city')))->values());
        }
        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function simpleCollection(Request $request, array $segments, string $method)
    {
        $key = match ($segments[0]) { 'inquiries' => 'inquiries', 'offers' => 'offers', default => 'appointments' };
        $user = $this->currentUser($request, true);
        $data = JsonStore::read();
        if ($this->isAdmin($user) && !$this->adminHasPermission($user, 'support.manage', $data)) {
            return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => 'support.manage'], 403);
        }
        if ($key === 'inquiries' && $method === 'POST') {
            return $this->createInquiry($request, $user);
        }
        return $this->crudNamed($request, $data, $key, $segments[1] ?? null, $method, $user);
    }

    private function createInquiry(Request $request, array $user)
    {
        $data = JsonStore::read();
        $payload = $request->all();
        $property = $this->findById($data['properties'] ?? [], $payload['propertyId'] ?? null);
        $sellerId = $property['sellerId'] ?? $property['userId'] ?? null;
        $agentId = $property['agentId'] ?? null;
        $inquiry = array_merge($payload, [
            'id' => JsonStore::nextId($data, 'inquiries'),
            'userId' => $user['id'],
            'buyerId' => $user['id'],
            'sellerId' => $sellerId,
            'agentId' => $agentId,
            'createdAt' => now()->toISOString(),
        ]);
        if ($property) {
            $inquiry['propertyTitle'] = $property['title'] ?? $inquiry['propertyTitle'] ?? null;
        }

        $recipientIds = collect([$agentId, $sellerId])
            ->filter(fn ($id) => $id !== null && (string) $id !== (string) $user['id'])
            ->map(fn ($id) => (string) $id)
            ->unique()
            ->values()
            ->all();
        $propertyId = $payload['propertyId'] ?? null;
        $messageText = trim((string) ($payload['message'] ?? ''));

        if ($property && $recipientIds && $messageText !== '') {
            $data['conversations'] ??= [];
            $conversationIndex = null;
            foreach ($data['conversations'] as $index => $conversation) {
                $participantIds = collect($conversation['participantIds'] ?? $conversation['participants'] ?? [])
                    ->map(fn ($participant) => (string) (is_array($participant) ? ($participant['id'] ?? '') : $participant))
                    ->all();
                $matchesProperty = (string) ($conversation['propertyId'] ?? '') === (string) $propertyId;
                $hasBuyer = in_array((string) $user['id'], $participantIds, true);
                $hasRecipient = count(array_intersect($recipientIds, $participantIds)) > 0;
                if ($matchesProperty && $hasBuyer && $hasRecipient) {
                    $conversationIndex = $index;
                    break;
                }
            }

            if ($conversationIndex === null) {
                $participants = array_values(array_unique(array_merge([(string) $user['id']], $recipientIds)));
                $data['conversations'][] = [
                    'id' => JsonStore::nextId($data, 'conversations'),
                    'participants' => array_map(fn ($id) => is_numeric($id) ? (int) $id : $id, $participants),
                    'participantIds' => $participants,
                    'userId' => $user['id'],
                    'propertyId' => $propertyId,
                    'propertyTitle' => $property['title'] ?? $payload['propertyTitle'] ?? null,
                    'messages' => [],
                    'createdAt' => now()->toISOString(),
                    'updatedAt' => now()->toISOString(),
                ];
                $conversationIndex = array_key_last($data['conversations']);
            }

            $conversationId = $data['conversations'][$conversationIndex]['id'];
            $createdAt = now()->toISOString();
            $message = [
                'id' => count($data['conversations'][$conversationIndex]['messages'] ?? []) + 1,
                'conversationId' => $conversationId,
                'senderId' => $user['id'],
                'senderName' => $user['name'] ?? 'User',
                'text' => $messageText,
                'createdAt' => $createdAt,
                'timestamp' => $createdAt,
            ];
            $data['conversations'][$conversationIndex]['messages'][] = $message;
            $data['conversations'][$conversationIndex]['lastMessage'] = $messageText;
            $data['conversations'][$conversationIndex]['lastMessageAt'] = $createdAt;
            $data['conversations'][$conversationIndex]['updatedAt'] = $createdAt;
            $inquiry['conversationId'] = $conversationId;
        }

        $data['inquiries'] ??= [];
        $data['inquiries'][] = $inquiry;
        JsonStore::write($data);

        return $this->json($inquiry, 201);
    }

    private function agentAdminMessages(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $isAdmin = $this->isAdmin($user);
        $isAgent = strtolower((string) ($user['role'] ?? '')) === 'agent';
        if (!$isAdmin && !$isAgent) return $this->json(['error' => 'Only Agents and Admins can use this inbox.'], 403);

        $data = JsonStore::read();
        if ($isAdmin && !$this->adminHasPermission($user, 'support.manage', $data)) {
            return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => 'support.manage'], 403);
        }
        $data['agentAdminThreads'] = is_array($data['agentAdminThreads'] ?? null) ? $data['agentAdminThreads'] : [];
        $threadId = (string) ($parts[0] ?? '');
        if ($method === 'GET' && $threadId === '') {
            $threads = collect($data['agentAdminThreads']);
            if ($isAgent) $threads = $threads->filter(fn ($thread) => (string) ($thread['agentUserId'] ?? '') === (string) $user['id']);
            return $this->json($threads->sortByDesc('updatedAt')->values());
        }

        if ($isAgent && $method === 'POST' && $threadId === '') {
            $validator = Validator::make($request->all(), ['text' => ['required', 'string', 'max:4000']]);
            if ($validator->fails()) return $this->json(['error' => $validator->errors()->first()], 422);
            $threadIndex = collect($data['agentAdminThreads'])->search(
                fn ($thread) => (string) ($thread['agentUserId'] ?? '') === (string) $user['id'],
            );
            if ($threadIndex === false) {
                $data['agentAdminThreads'][] = [
                    'id' => 'agent-' . $user['id'],
                    'agentUserId' => $user['id'],
                    'agentName' => $user['name'] ?? 'Agent',
                    'agentEmail' => $user['email'] ?? '',
                    'messages' => [],
                    'status' => 'open',
                    'createdAt' => now()->toISOString(),
                ];
                $threadIndex = array_key_last($data['agentAdminThreads']);
            }
        } elseif ($isAdmin && $method === 'POST' && $threadId !== '') {
            $validator = Validator::make($request->all(), ['text' => ['required', 'string', 'max:4000']]);
            if ($validator->fails()) return $this->json(['error' => $validator->errors()->first()], 422);
            $threadIndex = $this->indexById($data['agentAdminThreads'], $threadId);
            if ($threadIndex === null) return $this->json(['error' => 'Agent thread not found.'], 404);
        } else {
            return $this->json(['error' => 'Method not allowed.'], 405);
        }

        $thread = &$data['agentAdminThreads'][$threadIndex];
        $message = [
            'id' => (string) JsonStore::nextId($data, 'agentAdminMessages'),
            'senderId' => $user['id'],
            'senderRole' => $isAdmin ? 'Admin' : 'Agent',
            'senderName' => $user['name'] ?? ($isAdmin ? 'Admin' : 'Agent'),
            'text' => trim((string) $request->input('text')),
            'createdAt' => now()->toISOString(),
        ];
        $thread['messages'][] = $message;
        $thread['lastMessage'] = $message['text'];
        $thread['updatedAt'] = $message['createdAt'];
        $thread['status'] = 'open';
        $recipientIds = $isAdmin
            ? [(int) ($thread['agentUserId'] ?? 0)]
            : collect($data['users'] ?? [])->filter(fn ($candidate) =>
                strtolower((string) ($candidate['role'] ?? '')) === 'admin'
                && !in_array(strtolower((string) ($candidate['status'] ?? 'active')), ['inactive', 'suspended', 'blocked'], true)
            )->pluck('id')->all();
        app(NotificationDeliveryService::class)->deliver($data, $recipientIds, [
            'type' => 'AGENT_ADMIN_MESSAGE',
            'category' => 'system',
            'title' => $isAdmin ? 'Message from Admin' : 'New Agent message',
            'message' => mb_substr($message['text'], 0, 160),
            'entityType' => 'agent_admin_message',
            'entityId' => $thread['id'],
            'eventKey' => 'agent-admin-message:' . $thread['id'] . ':' . $message['id'],
            'priority' => 'HIGH',
            'deepLink' => $isAdmin ? '/agent/communications' : '/admin/agent-communications',
            'forPortal' => $isAdmin ? 'agent' : 'admin',
        ]);
        JsonStore::write($data);
        return $this->json($thread, 201);
    }

    private function agentProgress(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $isAdmin = $this->isAdmin($user);
        $isAgent = strtolower((string) ($user['role'] ?? '')) === 'agent';
        if (!$isAdmin && !$isAgent) return $this->json(['error' => 'Only Agents and Admins can access progress reports.'], 403);

        $data = JsonStore::read();
        if ($isAdmin && !$this->adminHasPermission($user, 'support.manage', $data)) {
            return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => 'support.manage'], 403);
        }
        $data['agentProgress'] = is_array($data['agentProgress'] ?? null) ? $data['agentProgress'] : [];
        $id = $parts[0] ?? null;
        if ($method === 'GET' && $id === null) {
            $reports = collect($data['agentProgress']);
            if ($isAgent) $reports = $reports->filter(fn ($report) => (string) ($report['agentUserId'] ?? '') === (string) $user['id']);
            return $this->json($reports->sortByDesc('submittedAt')->values());
        }
        if ($method === 'POST' && $id === null && $isAgent) {
            $validator = Validator::make($request->all(), [
                'date' => ['required', 'date_format:Y-m-d'],
                'summary' => ['required', 'string', 'max:2500'],
                'leadsContacted' => ['required', 'integer', 'min:0', 'max:10000'],
                'visitsCompleted' => ['required', 'integer', 'min:0', 'max:10000'],
                'followUps' => ['required', 'integer', 'min:0', 'max:10000'],
                'blockers' => ['nullable', 'string', 'max:1500'],
            ]);
            if ($validator->fails()) return $this->json(['error' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
            if (collect($data['agentProgress'])->contains(
                fn ($report) => (string) ($report['agentUserId'] ?? '') === (string) $user['id'] && ($report['date'] ?? '') === $request->input('date'),
            )) return $this->json(['error' => 'A daily progress report has already been submitted for this date.'], 409);

            $report = [
                'id' => JsonStore::nextId($data, 'agentProgress'),
                'agentUserId' => $user['id'],
                'agentName' => $user['name'] ?? 'Agent',
                'date' => $request->input('date'),
                'summary' => trim((string) $request->input('summary')),
                'leadsContacted' => (int) $request->input('leadsContacted'),
                'visitsCompleted' => (int) $request->input('visitsCompleted'),
                'followUps' => (int) $request->input('followUps'),
                'blockers' => trim((string) $request->input('blockers', '')),
                'status' => 'submitted',
                'submittedAt' => now()->toISOString(),
            ];
            $data['agentProgress'][] = $report;
            $adminIds = collect($data['users'] ?? [])->filter(fn ($candidate) =>
                strtolower((string) ($candidate['role'] ?? '')) === 'admin'
                && !in_array(strtolower((string) ($candidate['status'] ?? 'active')), ['inactive', 'suspended', 'blocked'], true)
            )->pluck('id')->all();
            app(NotificationDeliveryService::class)->deliver($data, $adminIds, [
                'type' => 'AGENT_PROGRESS_SUBMITTED',
                'category' => 'system',
                'title' => 'Agent daily progress submitted',
                'message' => ($report['agentName'] . ' submitted progress for ' . $report['date'] . '.'),
                'entityType' => 'agent_progress',
                'entityId' => $report['id'],
                'eventKey' => 'agent-progress:' . $report['id'],
                'priority' => 'NORMAL',
                'deepLink' => '/admin/agent-progress',
                'forPortal' => 'admin',
            ]);
            JsonStore::write($data);
            return $this->json($report, 201);
        }
        if ($method === 'PATCH' && $id !== null && $isAdmin) {
            $index = $this->indexById($data['agentProgress'], $id);
            if ($index === null) return $this->json(['error' => 'Progress report not found.'], 404);
            $validator = Validator::make($request->all(), [
                'status' => ['required', 'in:reviewed,needs_follow_up'],
                'adminNote' => ['nullable', 'string', 'max:1200'],
            ]);
            if ($validator->fails()) return $this->json(['error' => $validator->errors()->first()], 422);
            $data['agentProgress'][$index]['status'] = $request->input('status');
            $data['agentProgress'][$index]['adminNote'] = trim((string) $request->input('adminNote', ''));
            $data['agentProgress'][$index]['reviewedAt'] = now()->toISOString();
            $report = $data['agentProgress'][$index];
            app(NotificationDeliveryService::class)->deliver($data, [(int) $report['agentUserId']], [
                'type' => 'AGENT_PROGRESS_REVIEWED',
                'category' => 'system',
                'title' => 'Daily progress reviewed',
                'message' => 'Your report for ' . ($report['date'] ?? 'today') . ' was ' . str_replace('_', ' ', $report['status']) . '.',
                'entityType' => 'agent_progress',
                'entityId' => $report['id'],
                'eventKey' => 'agent-progress-review:' . $report['id'] . ':' . $report['status'],
                'priority' => 'NORMAL',
                'deepLink' => '/agent/progress',
                'forPortal' => 'agent',
            ]);
            JsonStore::write($data);
            return $this->json($report);
        }
        return $this->json(['error' => 'Method not allowed.'], 405);
    }

    private function conversations(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read(); $items = $data['conversations'] ?? []; $id = $parts[0] ?? null;
        if ($this->isAdmin($user) && !$this->adminHasPermission($user, 'support.manage', $data)) {
            return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => 'support.manage'], 403);
        }
        if ($method === 'GET' && $id === null) {
            $conversations = collect($items)
                ->filter(fn ($item) => $this->conversationBelongsToUser($item, $user))
                ->map(fn ($item) => $this->presentConversation($item, $data, $user))
                ->sortByDesc(fn ($item) => $item['lastMessageAt'] ?? $item['updatedAt'] ?? $item['createdAt'] ?? '')
                ->values();
            return $this->json($conversations);
        }
        if ($method === 'POST' && $id === null) {
            $payload = $request->all();
            $participants = collect($payload['participantIds'] ?? $payload['participants'] ?? [])
                ->map(fn ($participant) => is_array($participant) ? (string) ($participant['id'] ?? '') : (string) $participant)
                ->filter(fn ($participantId) => $participantId !== '')
                ->push((string) $user['id'])->unique()->values()->all();
            $conversation = array_merge($payload, [
                'id' => JsonStore::nextId($data, 'conversations'),
                'participantIds' => $participants,
                'userId' => $user['id'],
                'messages' => [],
                'createdAt' => now()->toISOString(),
                'updatedAt' => now()->toISOString(),
            ]);
            $data['conversations'][] = $conversation;
            JsonStore::write($data);
            return $this->json($conversation, 201);
        }
        $index = $this->indexById($items, $id); if ($index === null) return $this->json(['error' => 'Conversation not found'], 404);
        if (!$this->conversationBelongsToUser($items[$index], $user)) return $this->json(['error' => 'Conversation not found'], 404);
        if (($parts[1] ?? '') === 'messages') {
            if ($method === 'GET') return $this->json($items[$index]['messages'] ?? []);
            if ($method === 'POST') { $message = array_merge($request->all(), ['id' => JsonStore::nextId($data), 'senderId' => $user['id'], 'createdAt' => now()->toISOString(), 'timestamp' => now()->toISOString()]); $data['conversations'][$index]['messages'][] = $message; JsonStore::write($data); return $this->json($message, 201); }
        }
        if ($method === 'DELETE') { array_splice($data['conversations'], $index, 1); JsonStore::write($data); return response()->noContent(); }
        return $this->json($items[$index]);
    }

    private function presentConversation(array $conversation, array $data, array $user): array
    {
        $participantIds = collect($conversation['participantIds'] ?? $conversation['participants'] ?? $conversation['userIds'] ?? [])
            ->map(fn ($participant) => (string) (is_array($participant) ? ($participant['id'] ?? '') : $participant))
            ->filter(fn ($id) => $id !== '')
            ->values();
        $otherUser = collect($data['users'] ?? [])->first(fn ($candidate) =>
            is_array($candidate)
            && (string) ($candidate['id'] ?? '') !== (string) $user['id']
            && $participantIds->contains((string) ($candidate['id'] ?? ''))
        );
        $lastMessage = collect($conversation['messages'] ?? [])->last();

        $conversation['participants'] = $participantIds
            ->map(fn ($id) => is_numeric($id) ? (int) $id : $id)
            ->all();
        if ($otherUser) {
            $conversation['otherUserName'] = $otherUser['name'] ?? null;
            $conversation['otherUserPhone'] = $otherUser['phone'] ?? null;
        }
        if (is_array($lastMessage)) {
            $conversation['lastMessage'] = $lastMessage['text'] ?? $conversation['lastMessage'] ?? null;
            $conversation['lastMessageAt'] = $lastMessage['createdAt'] ?? $lastMessage['timestamp'] ?? $conversation['lastMessageAt'] ?? null;
        }

        return $conversation;
    }

    private function genericCollection(Request $request, array $segments, string $method)
    {
        $map = [
            'buyer-requests' => 'buyerRequests', 'agent-leads' => 'agentLeads', 'agent-visits' => 'agentVisits',
            'recent-searches' => 'recentSearches', 'comparisons' => 'comparisons', 'visit-history' => 'visitHistory',
            'promotions' => 'promotions', 'verification-requests' => 'verificationRequests', 'measurements' => 'measurements',
        ];
        $key = $map[$segments[0]] ?? null;
        if ($segments[0] === 'mobile' && isset($segments[1])) $key = Str::camel($segments[1]);
        if ($key === null) return $this->json(['error' => 'Not found'], 404);
        $user = $this->currentUser($request, true); $data = JsonStore::read(); $data[$key] ??= [];
        if ($this->isAdmin($user)) {
            $permission = match ($key) {
                'promotions' => 'content.manage',
                'buyerRequests', 'agentLeads', 'agentVisits', 'verificationRequests' => 'support.manage',
                'recentSearches', 'comparisons', 'visitHistory', 'measurements' => 'users.view',
                default => 'operations.manage',
            };
            if (!$this->adminHasPermission($user, $permission, $data)) {
                return $this->json(['error' => 'Your staff role does not allow this action.', 'permission' => $permission], 403);
            }
        }
        $id = $segments[0] === 'mobile' ? ($segments[2] ?? null) : ($segments[1] ?? null);
        return $this->crudNamed($request, $data, $key, $id, $method, $user);
    }

    private function comparison(Request $request, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read();
        $data['comparisons'] = is_array($data['comparisons'] ?? null) ? $data['comparisons'] : [];
        $index = null;
        foreach ($data['comparisons'] as $candidateIndex => $record) {
            if (is_array($record) && (string) ($record['userId'] ?? '') === (string) $user['id']) {
                $index = $candidateIndex;
                break;
            }
        }

        if ($method === 'GET') {
            return $this->json(array_values($data['comparisons'][$index]['propertyIds'] ?? []));
        }

        if ($method === 'PUT') {
            $validator = Validator::make($request->all(), [
                'propertyIds' => ['required', 'array', 'max:3'],
                'propertyIds.*' => ['required', 'integer', 'min:1', 'distinct'],
            ]);
            if ($validator->fails()) {
                return $this->json(['error' => 'Choose up to three distinct property IDs.', 'errors' => $validator->errors()], 422);
            }

            $propertyIds = array_map('intval', $request->input('propertyIds'));
            $record = [
                'id' => $index === null
                    ? JsonStore::nextId($data, 'comparison')
                    : $data['comparisons'][$index]['id'],
                'userId' => $user['id'],
                'propertyIds' => $propertyIds,
                'updatedAt' => now()->toISOString(),
            ];
            if ($index === null) {
                $data['comparisons'][] = $record;
            } else {
                $data['comparisons'][$index] = array_merge($data['comparisons'][$index], $record);
            }
            JsonStore::write($data);
            return $this->json($propertyIds);
        }

        if ($method === 'DELETE') {
            if ($index !== null) {
                array_splice($data['comparisons'], $index, 1);
                JsonStore::write($data);
            }
            return response()->noContent();
        }

        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function crudNamed(Request $request, array $data, string $key, ?string $id, string $method, ?array $user = null)
    {
        $originalData = $data;
        $data[$key] ??= [];
        if ($key === 'mobileAgents' && $method === 'GET' && $id === null && $user && $this->isAdmin($user)
            && empty($data['legacySampleAgentProfilesImportedV4'])) {
            $legacyAgents = [
                ['legacySampleKey' => 'sa1', 'name' => 'Ahmed Property Consultants', 'initials' => 'AC', 'agency' => 'Ahmed Real Estate', 'verified' => true, 'rating' => 4.9, 'reviewCount' => 126, 'years' => 12, 'listings' => 48, 'areas' => ['Okara City', 'Depalpur'], 'color' => '#183B60', 'phone' => '03011484303', 'specialties' => ['Residential', 'Agricultural Land', 'Plots'], 'about' => 'Residential plots, houses, and agricultural land in Okara City and Depalpur.', 'photo' => '/images/agent-1.jpg'],
                ['legacySampleKey' => 'sa2', 'name' => 'Malik Properties', 'initials' => 'MP', 'agency' => 'Malik & Sons Real Estate', 'verified' => true, 'rating' => 4.8, 'reviewCount' => 94, 'years' => 8, 'listings' => 32, 'areas' => ['Renala Khurd', 'Okara City'], 'color' => '#0B1F3A', 'phone' => '03011484303', 'specialties' => ['Commercial', 'Residential', 'Rentals'], 'about' => 'Commercial and residential properties, including rentals, in Renala Khurd and Okara City.', 'photo' => '/images/agent-2.jpg'],
                ['legacySampleKey' => 'sa3', 'name' => 'Ch. Property Services', 'initials' => 'CS', 'agency' => 'Chaudhry Property Group', 'verified' => true, 'rating' => 4.9, 'reviewCount' => 173, 'years' => 15, 'listings' => 61, 'areas' => ['Depalpur', 'Hujra Shah Muqeem'], 'color' => '#8b6c2a', 'phone' => '03011484303', 'specialties' => ['Agricultural Land', 'Plots', 'Commercial', 'Investment'], 'about' => 'Agricultural land, plots, and commercial properties in Depalpur and Hujra Shah Muqeem.', 'photo' => '/images/agent-3.jpg'],
                ['legacySampleKey' => 'sa4', 'name' => 'Baig Property Advisors', 'initials' => 'BA', 'agency' => 'Baig & Associates', 'verified' => true, 'rating' => 4.7, 'reviewCount' => 68, 'years' => 5, 'listings' => 21, 'areas' => ['Okara City', 'Renala Khurd'], 'color' => '#4a2d6b', 'phone' => '03011484303', 'specialties' => ['Residential', 'Rentals', 'Plots'], 'about' => 'Residential rentals and plots in Okara City and Renala Khurd.'],
                ['legacySampleKey' => 'sa5', 'name' => 'Raza Industrial & Commercial', 'initials' => 'RI', 'agency' => 'Raza Enterprises Real Estate', 'verified' => true, 'rating' => 4.8, 'reviewCount' => 82, 'years' => 9, 'listings' => 27, 'areas' => ['Okara City', 'Depalpur', 'Renala Khurd'], 'color' => '#374151', 'phone' => '03011484303', 'specialties' => ['Commercial', 'Industrial', 'Investment'], 'about' => 'Commercial shops, offices, warehouses, and industrial plots across Okara District.'],
            ];
            $existingNames = [];
            foreach ([...($data['mobileAgents'] ?? []), ...($data['cityAgents'] ?? [])] as $existingAgent) {
                $existingName = strtolower(trim((string) ($existingAgent['displayName'] ?? $existingAgent['name'] ?? '')));
                if ($existingName !== '') $existingNames[$existingName] = true;
            }
            foreach ($legacyAgents as $agent) {
                $nameKey = strtolower($agent['name']);
                if (isset($existingNames[$nameKey])) continue;
                $agent['id'] = JsonStore::nextId($data);
                $agent['displayName'] = $agent['name'];
                $agent['profilePhoto'] = $agent['photo'] ?? null;
                $agent['status'] = 'Active';
                $agent['approvalStatus'] = 'Approved';
                $agent['visible'] = true;
                $agent['createdAt'] = now()->toISOString();
                $data['mobileAgents'][] = $agent;
                $existingNames[$nameKey] = true;
            }
            $data['legacySampleAgentProfilesImportedV4'] = true;
            $data = JsonStore::write($data);
        }
        $mediaFields = in_array($key, ['mobileAgents', 'cityAgents'], true)
            ? ['photo', 'profilePhoto', 'coverPhoto', 'avatar']
            : [];
        if ($method === 'GET' && $id === null) {
            if ($user && !$this->isAdmin($user)) {
                return $this->json(collect($data[$key])
                    ->filter(fn ($item) => $this->collectionRecordVisibleToUser($key, $item, $user, $data))
                    ->values());
            }
            return $this->json($data[$key]);
        }
        if ($method === 'POST') {
            $user ??= $this->currentUser($request, true);
            $payload = $request->all();
            if (!$this->isAdmin($user)) {
                foreach (['id', 'userId', 'developerId', 'ownerId', 'createdBy', 'sellerId', 'buyerId', 'reporterId'] as $protectedKey) {
                    unset($payload[$protectedKey]);
                }
                if ($key === 'agentVisits' && strtolower((string) ($user['role'] ?? '')) === 'agent') {
                    $payload['agentId'] = $user['id'];
                }
            }
            $item = array_merge($payload, [
                'id' => JsonStore::nextId($data, $key),
                'userId' => $this->isAdmin($user) ? ($payload['userId'] ?? $user['id']) : $user['id'],
                'createdAt' => now()->toISOString(),
            ]);
            $data[$key][] = $item;
            if ($mediaFields !== []) {
                $this->writeWithMediaCleanup($originalData, $data, [], $item, $mediaFields);
            } else {
                JsonStore::write($data);
            }
            return $this->json($item, 201);
        }
        $index = $this->indexById($data[$key], $id); if ($index === null) return $this->json(['error' => 'Not found'], 404);
        if ($user && !$this->isAdmin($user) && !$this->collectionRecordBelongsToUser($key, $data[$key][$index], $user, $data)) {
            return $this->json(['error' => 'Not found'], 404);
        }
        if ($method === 'DELETE') {
            $removedRecord = $data[$key][$index];
            array_splice($data[$key], $index, 1);
            if ($mediaFields !== []) {
                $this->writeWithMediaCleanup($originalData, $data, $removedRecord, [], $mediaFields);
            } else {
                JsonStore::write($data);
            }
            return response()->noContent();
        }
        if (in_array($method, ['PUT', 'PATCH'], true)) {
            $patch = $request->all();
            if ($user && !$this->isAdmin($user)) {
                $protectedKeys = ['id', 'userId', 'developerId', 'ownerId', 'createdBy', 'sellerId', 'buyerId', 'reporterId'];
                if ($key === 'agentVisits') $protectedKeys[] = 'agentId';
                foreach ($protectedKeys as $protectedKey) {
                    unset($patch[$protectedKey]);
                }
            }
            $originalRecord = $data[$key][$index];
            $data[$key][$index] = array_merge($originalRecord, $patch, ['updatedAt' => now()->toISOString()]);
            if ($mediaFields !== []) {
                $this->writeWithMediaCleanup($originalData, $data, $originalRecord, $data[$key][$index], $mediaFields);
            } else {
                JsonStore::write($data);
            }
            return $this->json($data[$key][$index]);
        }
        return $this->json($data[$key][$index]);
    }

    private function collectionRecordBelongsToUser(string $key, array $item, array $user, array $data): bool
    {
        if ($key === 'agentVisits' && strtolower((string) ($user['role'] ?? '')) === 'agent') {
            $agentIds = $this->linkedAgentIds($data, $user);
            foreach (['agentId', 'agentUserId', 'agentProfileId'] as $field) {
                if (isset($item[$field]) && in_array((string) $item[$field], $agentIds, true)) return true;
            }
        }

        return $this->recordBelongsToUser($item, $user);
    }

    private function collectionRecordVisibleToUser(string $key, array $item, array $user, array $data): bool
    {
        if ($key === 'agentVisits' && strtolower((string) ($user['role'] ?? '')) === 'agent') {
            $agentIds = $this->linkedAgentIds($data, $user);
            foreach (['agentId', 'agentUserId', 'agentProfileId'] as $field) {
                if (isset($item[$field]) && in_array((string) $item[$field], $agentIds, true)) return true;
            }
        }

        return (string) ($item['userId'] ?? $item['developerId'] ?? '') === (string) ($user['id'] ?? '');
    }

    private function linkedAgentIds(array $data, array $user): array
    {
        $userId = (string) ($user['id'] ?? '');
        $email = strtolower(trim((string) ($user['email'] ?? '')));
        $ids = [$userId];
        foreach ($data['mobileAgents'] ?? [] as $agent) {
            if (!is_array($agent)) continue;
            $linkedById = (string) ($agent['authUserId'] ?? '') === $userId;
            $linkedByEmail = strtolower((string) ($user['role'] ?? '')) === 'agent'
                && $email !== ''
                && strtolower(trim((string) ($agent['email'] ?? ''))) === $email;
            if ($linkedById || $linkedByEmail) $ids[] = (string) ($agent['id'] ?? '');
        }
        return array_values(array_unique(array_filter($ids, fn ($id) => $id !== '')));
    }

    private function recordBelongsToUser(array $item, array $user): bool
    {
        foreach (['userId', 'developerId', 'ownerId', 'createdBy', 'sellerId', 'buyerId', 'reporterId'] as $key) {
            if (isset($item[$key]) && (string) $item[$key] === (string) $user['id']) return true;
        }
        return false;
    }

    private function conversationBelongsToUser(array $item, array $user): bool
    {
        if ($this->isAdmin($user) || $this->recordBelongsToUser($item, $user)) return true;
        foreach (['participantIds', 'participants', 'userIds'] as $key) {
            foreach ((array) ($item[$key] ?? []) as $participant) {
                $participantId = is_array($participant) ? ($participant['id'] ?? null) : $participant;
                if ((string) $participantId === (string) $user['id']) return true;
            }
        }
        return false;
    }

    private function currentUser(Request $request, bool $required = false): ?array
    {
        $header = (string) $request->header('Authorization', '');
        $token = preg_replace('/^Bearer\s+/i', '', $header);
        if (!$token) {
            if ($required) abort(response()->json(['error' => 'Authentication required.'], 401));
            return null;
        }
        try {
            $session = DB::table('auth_sessions')->where('token_hash', hash('sha256', $token))->where('expires_at', '>', now())->first();
            if ($session) {
                $user = $this->findById(JsonStore::read()['users'] ?? [], $session->user_id);
                if ($user) return $user;
            }
        } catch (\Throwable $exception) {
            Log::warning('Laravel auth session lookup failed.', ['error' => $exception->getMessage()]);
        }
        if ($required) abort(response()->json(['error' => 'Invalid or expired session.'], 401));
        return null;
    }

    private function isTrustedAdminDevice(array $user, string $token): bool
    {
        if (!$this->isAdmin($user) || $token === '') return false;
        $tokenHash = hash('sha256', $token);
        foreach ((array) ($user['trustedDevices'] ?? []) as $device) {
            if (!is_array($device) || empty($device['tokenHash']) || empty($device['expiresAt'])) continue;
            try {
                if (\Illuminate\Support\Carbon::parse($device['expiresAt'])->isFuture()
                    && hash_equals((string) $device['tokenHash'], $tokenHash)) {
                    return true;
                }
            } catch (\Throwable) {
                continue;
            }
        }
        return false;
    }

    private function storeTrustedAdminDevice(int $userId, string $token): bool
    {
        $data = JsonStore::read();
        $index = $this->indexById($data['users'] ?? [], $userId);
        if ($index === null || !$this->isAdmin($data['users'][$index])) return false;

        $validDevices = array_values(array_filter(
            (array) ($data['users'][$index]['trustedDevices'] ?? []),
            function ($device): bool {
                if (!is_array($device) || empty($device['tokenHash']) || empty($device['expiresAt'])) return false;
                try { return \Illuminate\Support\Carbon::parse($device['expiresAt'])->isFuture(); }
                catch (\Throwable) { return false; }
            },
        ));
        $validDevices[] = [
            'tokenHash' => hash('sha256', $token),
            'createdAt' => now()->toISOString(),
            'expiresAt' => now()->addDays(self::ADMIN_TRUSTED_DEVICE_TTL_DAYS)->toISOString(),
        ];
        $data['users'][$index]['trustedDevices'] = array_slice($validDevices, -10);
        JsonStore::write($data);
        return true;
    }

    private function createSession(array $user): string
    {
        $token = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
        try {
            DB::table('auth_sessions')->updateOrInsert(
                ['token_hash' => hash('sha256', $token)],
                ['user_id' => $user['id'], 'expires_at' => now()->addHours((int) env('SESSION_TTL_HOURS', 168)), 'created_at' => now()],
            );
        } catch (\Throwable $exception) {
            Log::warning('Laravel auth session could not be persisted.', ['error' => $exception->getMessage()]);
        }
        return $token;
    }

    private function socialAuth(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'provider' => ['required', 'in:facebook'],
            'accessToken' => ['required', 'string', 'max:4096'],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);
        if ($validator->fails()) {
            return $this->json(['error' => 'Invalid social sign-in request.', 'errors' => $validator->errors()], 422);
        }

        $appId = trim((string) config('services.facebook.app_id'));
        $appSecret = trim((string) config('services.facebook.app_secret'));
        if ($appId === '' || $appSecret === '') {
            return $this->json([
                'error' => 'Facebook sign-in is not configured on the server.',
                'code' => 'SOCIAL_AUTH_NOT_CONFIGURED',
            ], 503);
        }

        $accessToken = (string) $request->input('accessToken');
        try {
            $debugResponse = Http::timeout(8)->get('https://graph.facebook.com/debug_token', [
                'input_token' => $accessToken,
                'access_token' => "{$appId}|{$appSecret}",
            ]);
            $tokenData = $debugResponse->json('data');
            if (!$debugResponse->successful()
                || !is_array($tokenData)
                || !($tokenData['is_valid'] ?? false)
                || (string) ($tokenData['app_id'] ?? '') !== $appId
                || ((int) ($tokenData['expires_at'] ?? 0) > 0 && (int) $tokenData['expires_at'] <= time())) {
                return $this->json(['error' => 'Facebook access token is invalid or expired.'], 401);
            }

            $profileResponse = Http::timeout(8)
                ->withToken($accessToken)
                ->get('https://graph.facebook.com/me', [
                    'fields' => 'id,name,email',
                    'appsecret_proof' => hash_hmac('sha256', $accessToken, $appSecret),
                ]);
            $profile = $profileResponse->json();
            if (!$profileResponse->successful()
                || !is_array($profile)
                || empty($profile['id'])
                || (string) ($tokenData['user_id'] ?? '') !== (string) $profile['id']) {
                return $this->json(['error' => 'Unable to verify the Facebook account.'], 401);
            }
        } catch (\Throwable $exception) {
            Log::warning('Facebook token verification failed.', ['error' => $exception->getMessage()]);
            return $this->json(['error' => 'Facebook sign-in is temporarily unavailable.'], 503);
        }

        $email = strtolower(trim((string) ($profile['email'] ?? '')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->json(['error' => 'Facebook must provide a valid email address for this account.'], 422);
        }

        $data = JsonStore::read();
        $data['users'] = is_array($data['users'] ?? null) ? $data['users'] : [];
        $facebookId = (string) $profile['id'];
        $index = null;
        foreach ($data['users'] as $userIndex => $candidate) {
            if (!is_array($candidate)) continue;
            $sameFacebookId = (string) ($candidate['facebookId'] ?? '') === $facebookId;
            $sameEmail = strtolower(trim((string) ($candidate['email'] ?? ''))) === $email;
            if ($sameFacebookId || $sameEmail) {
                $index = $userIndex;
                break;
            }
        }

        if ($index === null) {
            $phone = preg_replace('/\D+/', '', (string) $request->input('phone', ''));
            if (strlen($phone) < 10 || strlen($phone) > 15) {
                return $this->json([
                    'error' => 'A valid mobile number is required to create an account.',
                    'code' => 'MOBILE_REQUIRED_FOR_SOCIAL_SIGNUP',
                ], 422);
            }
            $user = [
                'id' => JsonStore::nextId($data),
                'name' => trim((string) ($profile['name'] ?? '')) ?: 'Facebook User',
                'email' => $email,
                'phone' => $phone,
                'role' => 'User',
                'accountType' => 'User',
                'status' => 'Active',
                'authProvider' => 'facebook',
                'facebookId' => $facebookId,
                'verificationStatus' => 'verified',
                'joinedDate' => now()->toISOString(),
            ];
            $data['users'][] = $user;
        } else {
            $user = $data['users'][$index];
            if (in_array(strtolower((string) ($user['status'] ?? 'active')), ['inactive', 'suspended', 'blocked'], true)) {
                return $this->json(['error' => 'This account is not active.'], 403);
            }
            $existingFacebookId = (string) ($user['facebookId'] ?? '');
            if ($existingFacebookId !== '' && $existingFacebookId !== $facebookId) {
                return $this->json(['error' => 'This email is already linked to another Facebook account.'], 409);
            }
            $user['facebookId'] = $facebookId;
            $user['authProvider'] = 'facebook';
            $user['verificationStatus'] = $user['verificationStatus'] ?? 'verified';
            if (empty($user['phone']) && $request->filled('phone')) {
                $user['phone'] = preg_replace('/\D+/', '', (string) $request->input('phone'));
            }
            $data['users'][$index] = $user;
        }

        JsonStore::write($data);
        return $this->json(['user' => $this->safeUser($user), 'token' => $this->createSession($user)]);
    }

    private function destroySession(Request $request): void
    {
        $header = (string) $request->header('Authorization', '');
        $token = preg_replace('/^Bearer\s+/i', '', $header);
        if (!$token) return;
        try { DB::table('auth_sessions')->where('token_hash', hash('sha256', $token))->delete(); } catch (\Throwable) {}
    }

    private function invalidateSessions($userId, ?string $email = null): void
    {
        try { DB::table('auth_sessions')->where('user_id', $userId)->delete(); } catch (\Throwable $exception) {
            Log::warning('Laravel auth sessions could not be invalidated.', ['error' => $exception->getMessage()]);
        }
        if (is_string($email) && trim($email) !== '') {
            try {
                DB::table('auth_challenges')
                    ->whereRaw('LOWER(email) = ?', [strtolower(trim($email))])
                    ->delete();
            } catch (\Throwable $exception) {
                Log::warning('Laravel account verification challenges could not be removed.', [
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function consumeChallenge(string $email, string $purpose, string $code): array
    {
        try {
            $challenge = DB::table('auth_challenges')
                ->where('email', $email)
                ->where('purpose', $purpose)
                ->first();
            if (!$challenge || now()->greaterThan($challenge->expires_at)) return ['ok' => false, 'reason' => 'expired'];
            if ((int) $challenge->attempts >= 3) return ['ok' => false, 'reason' => 'attempts'];
            if (!hash_equals((string) $challenge->code_hash, hash('sha256', $code))) {
                DB::table('auth_challenges')->where('email', $email)->where('purpose', $purpose)->increment('attempts');
                return ['ok' => false, 'reason' => 'invalid'];
            }
            DB::table('auth_challenges')->where('email', $email)->where('purpose', $purpose)->delete();
            return ['ok' => true];
        } catch (\Throwable $exception) {
            Log::warning('Laravel auth challenge lookup failed.', ['error' => $exception->getMessage()]);
            return ['ok' => false, 'reason' => 'expired'];
        }
    }

    private function mediaBaseUrl(): string
    {
        return rtrim((string) env('MEDIA_PUBLIC_BASE_URL', ''), '/');
    }

    private function notifyAdminsForPropertySubmission(array &$data, array $property, string $event): void
    {
        $adminIds = collect($data['users'] ?? [])
            ->filter(fn ($user) => is_array($user)
                && strtolower((string) ($user['role'] ?? '')) === 'admin'
                && strtolower((string) ($user['status'] ?? 'active')) === 'active')
            ->pluck('id')
            ->all();
        if (!$adminIds) return;

        $propertyId = $property['id'] ?? null;
        $title = trim((string) ($property['title'] ?? ''));
        $listingTitle = $title !== '' ? $title : 'A property listing';
        $city = trim((string) ($property['city'] ?? $property['location']['city'] ?? ''));
        $message = $city !== ''
            ? "{$listingTitle} in {$city} was submitted for review."
            : "{$listingTitle} was submitted for review.";
        app(NotificationDeliveryService::class)->deliver($data, $adminIds, [
            'type' => 'PROPERTY_LISTING_SUBMITTED',
            'category' => 'properties',
            'title' => 'New property listing for review',
            'message' => $message,
            'body' => $message,
            'imageUrl' => $property['coverImage'] ?? ($property['images'][0] ?? null),
            'entityType' => 'property',
            'entityId' => $propertyId,
            'propertyId' => $propertyId,
            'deepLink' => $propertyId !== null ? "/property/{$propertyId}" : null,
            'eventKey' => "property:{$propertyId}:{$event}",
            'metadata' => ['city' => $city],
        ]);
    }

    private function notifyAccountUpdate(
        array &$data,
        int $recipientId,
        string $type,
        string $title,
        string $message,
        bool $mandatory = false,
        ?string $eventKey = null,
    ): void {
        app(NotificationDeliveryService::class)->deliver($data, [$recipientId], [
            'type' => $type,
            'category' => 'account',
            'title' => $title,
            'message' => $message,
            'body' => $message,
            'entityType' => 'account',
            'entityId' => $recipientId,
            'deepLink' => '/(tabs)/profile',
            'mandatory' => $mandatory,
            'eventKey' => $eventKey ?? "account:{$recipientId}:" . Str::uuid(),
        ]);
    }

    private function notifyPropertyOwnerOfReview(array &$data, array $property, string $type, string $reason = ''): void
    {
        $ownerId = $property['sellerId'] ?? $property['userId'] ?? null;
        if (!is_numeric($ownerId)) return;

        $title = trim((string) ($property['title'] ?? 'Your property listing'));
        $listingTitle = $title !== '' ? $title : 'Your property listing';
        if ($type === 'PROPERTY_LISTING_APPROVED') {
            $message = "{$listingTitle} is approved and now visible to users.";
            $notificationTitle = 'Listing approved';
        } elseif ($type === 'PROPERTY_LISTING_REJECTED') {
            $message = "{$listingTitle} was not approved.";
            if ($reason !== '') $message .= " Admin note: {$reason}";
            $notificationTitle = 'Listing not approved';
        } else {
            $message = "Changes are needed before {$listingTitle} can be approved.";
            if ($reason !== '') $message .= " Admin note: {$reason}";
            $notificationTitle = 'Listing changes requested';
        }

        $propertyId = $property['id'] ?? null;
        app(NotificationDeliveryService::class)->deliver($data, [(int) $ownerId], [
            'type' => $type,
            'category' => 'account',
            'title' => $notificationTitle,
            'message' => $message,
            'body' => $message,
            'entityType' => 'property',
            'entityId' => $propertyId,
            'propertyId' => $propertyId,
            'deepLink' => $propertyId !== null ? "/property/{$propertyId}" : null,
            'eventKey' => 'property:' . $propertyId . ':review:' . strtolower($type) . ':' . Str::uuid(),
        ]);
    }

    private function notifyUsersOfPublishedProperty(array &$data, array $property): void
    {
        $city = trim((string) ($property['city'] ?? $property['location']['city'] ?? ''));
        $normalizedCity = strtolower($city);
        $recipientIds = collect($data['users'] ?? [])
            ->filter(function ($user) use ($data, $normalizedCity) {
                if (!is_array($user)
                    || strtolower((string) ($user['status'] ?? 'active')) !== 'active') {
                    return false;
                }

                $userId = (string) ($user['id'] ?? '');
                $preferences = (array) ($data['notificationPreferences'][$userId] ?? []);
                $selectedCities = $preferences['cities'] ?? [];
                if (is_string($selectedCities)) $selectedCities = [$selectedCities];
                if (!is_array($selectedCities)) $selectedCities = [];
                $selectedCities = collect($selectedCities)
                    ->map(fn ($selectedCity) => strtolower(trim((string) $selectedCity)))
                    ->filter()
                    ->values()
                    ->all();

                return $normalizedCity === ''
                    || !$selectedCities
                    || in_array($normalizedCity, $selectedCities, true);
            })
            ->pluck('id')
            ->all();
        if (!$recipientIds) return;

        $propertyId = $property['id'] ?? null;
        $title = trim((string) ($property['title'] ?? ''));
        $listingTitle = $title !== '' ? $title : 'A new property';
        $message = $city !== ''
            ? "{$listingTitle} in {$city} is now available."
            : "{$listingTitle} is now available.";
        app(NotificationDeliveryService::class)->deliver($data, $recipientIds, [
            'type' => 'NEW_PROPERTY_LISTING',
            'category' => 'properties',
            'title' => 'New property listing',
            'message' => $message,
            'body' => $message,
            'imageUrl' => $property['coverImage'] ?? ($property['images'][0] ?? null),
            'entityType' => 'property',
            'entityId' => $propertyId,
            'propertyId' => $propertyId,
            'deepLink' => $propertyId !== null ? "/property/{$propertyId}" : null,
            'eventKey' => "property:{$propertyId}:published",
            'metadata' => ['city' => $city],
        ]);
    }

    private function safeUser(array $user): array
    {
        unset($user['password']);
        unset($user['trustedDevices']);
        $legacyRole = strtolower((string) ($user['role'] ?? 'user'));
        $permissions = array_values(array_unique(array_filter(
            (array) ($user['permissions'] ?? []),
            fn ($permission) => in_array(strtolower((string) $permission), ['admin', 'agent', 'developer'], true),
        )));
        if (in_array($legacyRole, ['admin', 'agent', 'developer'], true)) {
            $permissions[] = $legacyRole;
        }
        $user['permissions'] = array_values(array_unique($permissions));
        $user['accountType'] = 'User';
        if (in_array($legacyRole, ['buyer', 'seller', 'user'], true)) {
            $user['role'] = 'User';
        }
        return $user;
    }
    private function mailFromAddress(): ?string
    {
        foreach ([config('mail.from.address'), config('mail.mailers.smtp.username')] as $candidate) {
            if (!is_string($candidate)) {
                continue;
            }

            $candidate = trim($candidate);
            if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_EMAIL) !== false) {
                return $candidate;
            }
        }

        return null;
    }

    private function findUserByEmail(string $email): ?array { return collect(JsonStore::read()['users'] ?? [])->first(fn ($u) => strtolower((string) ($u['email'] ?? '')) === strtolower(trim($email))); }
    private function isAdmin(?array $user): bool { return $user !== null && strtolower((string) ($user['role'] ?? '')) === 'admin'; }
    private function canManageAgentCover(array $user): bool
    {
        return strtolower((string) ($user['role'] ?? '')) === 'agent'
            && filter_var($user['agentCoverUploadEnabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
    }
    private function findById(array $items, $id): ?array { return collect($items)->first(fn ($item) => (string) ($item['id'] ?? '') === (string) $id); }
    private function indexById(array $items, $id): ?int { foreach ($items as $index => $item) if ((string) ($item['id'] ?? '') === (string) $id) return $index; return null; }
    private function hashLegacyPassword(string $password): string { $salt = bin2hex(random_bytes(16)); return 'pbkdf2:' . $salt . ':' . hash_pbkdf2('sha512', $password, $salt, 100000, 128, false); }
    private function verifyLegacyPassword(string $plain, string $stored): bool { if (!str_starts_with($stored, 'pbkdf2:')) return Hash::check($plain, $stored); [, $salt, $hash] = array_pad(explode(':', $stored, 3), 3, ''); return $hash !== '' && hash_equals($hash, hash_pbkdf2('sha512', $plain, $salt, 100000, 128, false)); }
    private function propertyVisible(array $property, ?array $user): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        if ($this->isDemoProperty($property)) {
            return false;
        }

        $owner = $user && (string) ($property['sellerId'] ?? $property['userId'] ?? '') === (string) $user['id'];
        if ($owner) {
            return true;
        }

        return in_array(strtolower((string) ($property['approvalStatus'] ?? 'active')), ['active', 'approved'], true)
            && in_array(strtolower((string) ($property['listingStatus'] ?? 'active')), ['active', 'approved'], true);
    }

    private function isDemoProperty(array $property): bool
    {
        if (!empty($property['isDemo'])) {
            return true;
        }

        // Older imported seed rows predate the isDemo flag. Keep these known
        // sample listings out of public feeds without deleting their records.
        return in_array(trim((string) ($property['title'] ?? '')), [
            'Modern Commercial Plaza in Clifton',
            'Affordable 2-Bed Apartment in E-11',
        ], true);
    }
    private function propertyMatches(array $p, Request $r): bool { $text = strtolower((string) ($r->input('search', $r->input('keyword', '')))); if ($text !== '' && !str_contains(strtolower(json_encode($p)), $text)) return false; foreach (['type', 'city', 'status', 'purpose', 'constructionAge', 'furnishing', 'availability'] as $key) if ($r->filled($key) && strtolower((string) ($p[$key] ?? '')) !== strtolower((string) $r->input($key))) return false; if ($r->filled('minPrice') && (float) ($p['price'] ?? 0) < (float) $r->input('minPrice')) return false; if ($r->filled('maxPrice') && (float) ($p['price'] ?? 0) > (float) $r->input('maxPrice')) return false; if ($r->filled('minBeds') && (float) ($p['bedrooms'] ?? 0) < (float) $r->input('minBeds')) return false; foreach (['minLat' => 0, 'maxLat' => 0, 'minLng' => 0, 'maxLng' => 0] as $key => $fallback) if ($r->filled($key)) { $value = str_contains($key, 'Lat') ? $this->propertyLat($p) : $this->propertyLng($p); if ($value === null || ($key === 'minLat' && $value < (float) $r->input($key)) || ($key === 'maxLat' && $value > (float) $r->input($key)) || ($key === 'minLng' && $value < (float) $r->input($key)) || ($key === 'maxLng' && $value > (float) $r->input($key))) return false; } return true; }
    private function propertyLat(array $p): ?float { return isset($p['lat']) ? (float) $p['lat'] : (isset($p['location']['latitude']) ? (float) $p['location']['latitude'] : null); }
    private function propertyLng(array $p): ?float { return isset($p['lng']) ? (float) $p['lng'] : (isset($p['location']['longitude']) ? (float) $p['location']['longitude'] : null); }
    private function distanceKm(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2): ?float { if ($lat1 === null || $lng1 === null || $lat2 === null || $lng2 === null) return null; $dLat = deg2rad($lat2 - $lat1); $dLng = deg2rad($lng2 - $lng1); $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2; return round(6371 * 2 * asin(min(1, sqrt($a))), 3); }
    private function adminStats(array $data) { return $this->json(['projects' => count($data['developerProjects'] ?? []), 'leads' => count($data['developerLeads'] ?? []), 'units' => count($data['inventoryUnits'] ?? []), 'generatedAt' => now()->toISOString()]); }
    private function deepMerge(array $base, array $patch): array { foreach ($patch as $key => $value) $base[$key] = is_array($value) && is_array($base[$key] ?? null) ? $this->deepMerge($base[$key], $value) : $value; return $base; }
    private function isGenericCollection(array $segments): bool { return in_array($segments[0] ?? '', ['buyer-requests', 'agent-leads', 'agent-visits', 'recent-searches', 'comparisons', 'visit-history', 'promotions', 'verification-requests', 'measurements'], true) || (($segments[0] ?? '') === 'mobile' && isset($segments[1])); }
    private function json($data, int $status = 200) { return response()->json($data, $status)->withHeaders(['Access-Control-Allow-Origin' => '*', 'Access-Control-Allow-Headers' => 'Authorization, Content-Type', 'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS']); }
}