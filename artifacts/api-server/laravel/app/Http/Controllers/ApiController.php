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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ApiController extends Controller
{
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

        if (($segments[0] ?? '') === 'my-properties') {
            return $this->myProperties($request);
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
        if (!$this->isAdmin($user)) return $this->json(['error' => 'Admin access required.'], 403);

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
            return $this->json([
                'error' => 'Social sign-in is unavailable until this app is configured to verify the provider token.',
                'code' => 'SOCIAL_AUTH_NOT_CONFIGURED',
            ], 501);
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
                'role' => ['nullable', 'in:buyer,agent,seller,developer,Buyer,Agent,Seller,Developer'],
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
            $role = match (strtolower((string) ($input['role'] ?? 'buyer'))) {
                'agent' => 'Agent',
                'seller' => 'Seller',
                'developer' => 'Developer',
                default => 'Buyer',
            };
            $user = [
                'id' => JsonStore::nextId($data),
                'name' => $name !== '' ? $name : 'OG Landmark User',
                'email' => $email,
                'username' => $input['username'] ?? null,
                'phone' => trim((string) $input['phone']),
                'city' => $input['city'] ?? null,
                'role' => $role,
                'status' => 'Active',
                'password' => $this->hashLegacyPassword($input['password']),
                'joinedDate' => now()->toISOString(),
            ];
            $data['users'][] = $user;
            JsonStore::write($data);

            if ($role === 'Agent') {
                return $this->json(['pending' => true, 'message' => 'Your agent account is awaiting approval.'], 201);
            }
            return $this->json(['user' => $this->safeUser($user), 'token' => $this->createSession($user)], 201);
        }

        if (in_array($action, ['forgot-password', 'request-reset'], true) && $method === 'POST') {
            $email = strtolower(trim((string) $request->input('email')));
            if ($email === '') return $this->json(['error' => 'Email is required'], 400);
            $user = $this->findUserByEmail($email);
            if (!$user) {
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
            try {
                if (!config('mail.mailers.smtp.username') || !config('mail.mailers.smtp.password')) {
                    $smtpOff = true;
                } else {
                    Mail::raw("Your OG Landmark password reset code is {$code}. It expires in 15 minutes. Do not share this code.", function ($message) use ($email) {
                        $message->to($email)
                            ->subject('OG Landmark — Password Reset Code');
                    });
                }
            } catch (\Throwable $exception) {
                $smtpOff = true;
                Log::error('Password reset email could not be sent.', ['error' => $exception->getMessage()]);
            }

            return $this->json([
                'success' => true,
                'smtpOff' => $smtpOff,
                'message' => $smtpOff
                    ? 'Email service is not configured. Please contact admin to get your reset code.'
                    : 'Reset code sent. Check your email.',
            ]);
        }

        if (in_array($action, ['reset-password', 'confirm-reset'], true) && $method === 'POST') {
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
            if (!$user) return $this->json(['error' => 'Invalid or expired reset code'], 400);
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
                Mail::raw("Your OG Landmark admin sign-in code is {$code}. It expires in 10 minutes. Do not share this code.", function ($message) use ($email) {
                    $message->to($email)->subject('OG Landmark — Admin Sign-in Code');
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
            return $this->json([
                'success' => true,
                'user' => $this->safeUser($user),
                'token' => $this->createSession($user),
            ]);
        }

        return $this->json(['error' => 'Not found'], 404);
    }

    private function properties(Request $request, array $parts, string $method)
    {
        $id = $parts[0] ?? null;
        $action = $parts[1] ?? null;
        $user = $this->currentUser($request);
        $data = JsonStore::read();

        if ($method === 'GET' && $id === null) {
            $items = collect($data['properties'] ?? [])
                ->filter(fn ($p) => $this->propertyVisible($p, $user))
                ->filter(fn ($p) => $this->propertyMatches($p, $request))
                ->values();

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

        $adminAction = in_array($action, ['approve', 'reject', 'request-changes', 'verify', 'feature'], true);
        if ($adminAction) {
            $admin = $this->currentUser($request, true);
            if (!$this->isAdmin($admin)) {
                return $this->json(['error' => 'Forbidden'], 403);
            }
            $from = $property['approvalStatus'] ?? $property['listingStatus'] ?? null;
            $previousApprovalStatus = strtolower((string) ($property['approvalStatus'] ?? $property['listingStatus'] ?? ''));
            $previousListingStatus = strtolower((string) ($property['listingStatus'] ?? $property['approvalStatus'] ?? ''));
            $wasPubliclyListed = in_array($previousApprovalStatus, ['active', 'approved'], true)
                && in_array($previousListingStatus, ['active', 'approved'], true);
            if ($action === 'approve' || $action === 'verify') {
                $data['properties'][$index]['approvalStatus'] = 'Active';
                $data['properties'][$index]['listingStatus'] = 'Active';
            } elseif ($action === 'reject') {
                $data['properties'][$index]['approvalStatus'] = 'Rejected';
                $data['properties'][$index]['rejectionReason'] = $request->input('reason');
            } elseif ($action === 'request-changes') {
                $data['properties'][$index]['approvalStatus'] = 'Changes Requested';
                $data['properties'][$index]['changeRequest'] = $request->input('reason');
            } elseif ($action === 'feature') {
                $data['properties'][$index]['featured'] = $request->has('featured') ? $request->boolean('featured') : !(bool) ($property['featured'] ?? false);
            }
            $data['properties'][$index]['reviewedAt'] = now()->toISOString();
            $data['properties'][$index]['reviewHistory'][] = [
                'action' => $action, 'reason' => $request->input('reason'), 'by' => $admin['id'],
                'fromStatus' => $from, 'toStatus' => $data['properties'][$index]['approvalStatus'] ?? null,
                'createdAt' => now()->toISOString(),
            ];
            if (in_array($action, ['approve', 'verify'], true) && !$wasPubliclyListed) {
                $this->notifyUsersOfPublishedProperty($data, $data['properties'][$index]);
            }
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

    private function myProperties(Request $request)
    {
        $user = $this->currentUser($request, true);
        return $this->json(collect(JsonStore::read()['properties'] ?? [])->filter(fn ($p) => (string) ($p['sellerId'] ?? $p['userId'] ?? '') === (string) $user['id'])->values());
    }

    private function admin(Request $request, array $parts, string $method)
    {
        $admin = $this->currentUser($request, true);
        if (!$this->isAdmin($admin)) return $this->json(['error' => 'Forbidden'], 403);
        $data = JsonStore::read();
        $resource = $parts[0] ?? '';
        $id = $parts[1] ?? null;
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
        if ($resource === 'properties' && $id !== null && ($parts[2] ?? '') === 'verify' && $method === 'PATCH') {
            return $this->properties($request, [$id, 'verify'], 'PATCH');
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
            $limit = max(1, min(500, (int) $request->input('limit', 500)));
            return $this->json($properties->take($limit)->values());
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
            $roles = ['buyer' => 'Buyer', 'seller' => 'Seller', 'agent' => 'Agent', 'developer' => 'Developer', 'admin' => 'Admin'];
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
            if ($requestedRole !== 'agent' || $previousRole !== 'agent') {
                $data['users'][$index]['agentCoverUploadEnabled'] = false;
            }
            JsonStore::write($data);
            return $this->json($this->safeUser($data['users'][$index]));
        }
        if ($resource === 'users' && $id !== null && $method === 'DELETE') {
            $index = $this->indexById($data['users'] ?? [], $id);
            if ($index === null) return $this->json(['error' => 'User not found'], 404);
            if (strtolower((string) ($data['users'][$index]['role'] ?? '')) === 'admin') {
                $adminCount = collect($data['users'] ?? [])->filter(fn ($user) => strtolower((string) ($user['role'] ?? '')) === 'admin')->count();
                if ((string) $data['users'][$index]['id'] === (string) $admin['id'] || $adminCount <= 1) {
                    return $this->json(['error' => 'The signed-in or final admin account cannot be deleted.'], 409);
                }
            }
            array_splice($data['users'], $index, 1); JsonStore::write($data); return response()->noContent();
        }
        if ($resource === 'reports') {
            if ($method === 'GET' && $id === null && $request->filled('status')) {
                return $this->json(collect($data['reports'] ?? [])
                    ->filter(fn ($report) => strtolower((string) ($report['status'] ?? 'pending')) === strtolower((string) $request->input('status'))
                    )->values());
            }
            return $this->crudNamed($request, $data, 'reports', $id, $method, $admin);
        }
        if ($resource === 'announcements') return $this->adminAnnouncements($request, $data, $parts, $method, $admin);
        $adminCollections = [
            'developer-projects' => 'developerProjects',
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
        if ($id === null || (string) $id !== (string) $user['id']) {
            if (!$this->isAdmin($user)) return $this->json(['error' => 'Forbidden'], 403);
        }
        $data = JsonStore::read();
        $index = $this->indexById($data['users'] ?? [], $id);
        if ($index === null) return $this->json(['error' => 'User not found'], 404);
        if ($method === 'PUT') {
            if ($request->has('coverPhoto') && !$this->canManageAgentCover($data['users'][$index])) {
                return $this->json(['error' => 'Only admin-enabled Agent accounts can manage a cover photo.'], 403);
            }
            $allowed = ['name', 'phone', 'email', 'agencyName', 'companyName', 'city', 'profilePhoto', 'coverPhoto'];
            foreach ($allowed as $key) if ($request->has($key)) $data['users'][$index][$key] = $request->input($key);
            JsonStore::write($data); return $this->json($this->safeUser($data['users'][$index]));
        }
        if ($method === 'PATCH' && ($parts[1] ?? '') === 'push-token') {
            $data['users'][$index]['pushToken'] = $request->input('pushToken');
            JsonStore::write($data); return $this->json(['success' => true]);
        }
        return $this->json($this->safeUser($data['users'][$index]));
    }

    private function account(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read();
        $index = $this->indexById($data['users'] ?? [], $user['id']);
        if ($index === null) return $this->json(['error' => 'Account not found'], 404);
        $photo = $parts[0] ?? null;
        if ($photo && in_array($photo, ['profile-photo', 'cover-photo'], true)) {
            if ($photo === 'cover-photo' && !$this->canManageAgentCover($data['users'][$index])) {
                return $this->json(['error' => 'Only admin-enabled Agent accounts can manage a cover photo.'], 403);
            }
            $key = $photo === 'profile-photo' ? 'profilePhoto' : 'coverPhoto';
            if ($method === 'GET') return $this->json(['url' => $data['users'][$index][$key] ?? null]);
            if ($method === 'DELETE') { $data['users'][$index][$key] = null; JsonStore::write($data); return response()->noContent(); }
            if ($method === 'PUT') { $data['users'][$index][$key] = $request->input('url'); JsonStore::write($data); return $this->json(['url' => $data['users'][$index][$key]]); }
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
            foreach (['name', 'phone', 'city', 'agencyName', 'companyName', 'profilePhoto', 'coverPhoto'] as $key) if ($request->has($key)) $data['users'][$index][$key] = $request->input($key);
            JsonStore::write($data); return $this->json($this->safeUser($data['users'][$index]));
        }
        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function saved(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read();
        $userId = $parts[0] ?? $user['id'];
        if ((string) $userId !== (string) $user['id'] && !$this->isAdmin($user)) return $this->json(['error' => 'Forbidden'], 403);
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
        $field = ($parts[0] ?? '') === 'video' ? 'video' : (($parts[0] ?? '') === 'single' ? 'image' : 'images');
        $files = $request->file($field);
        $files = is_array($files) ? $files : ($files ? [$files] : []);
        if (!$files) return $this->json(['error' => 'No upload received.'], 422);
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
        foreach ($files as $file) {
            if (!$file->isValid() || !in_array(strtolower($file->getClientOriginalExtension()), ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'], true)) {
                return $this->json(['error' => 'Allowed: JPG, PNG, WebP, MP4, MOV'], 422);
            }
            $name = now()->format('YmdHis') . '-' . Str::random(24) . '.' . strtolower($file->getClientOriginalExtension());
            $file->move($directory, $name);
            $path = '/images/uploads/' . $name;
            $url = $mediaStorage->url($path);
            $urls[] = $url;
            $media[] = [
                'url' => $url,
                'path' => $path,
                'mimeType' => $file->getMimeType(),
                'bytes' => filesize($directory . DIRECTORY_SEPARATOR . $name) ?: 0,
                'kind' => str_starts_with((string) $file->getMimeType(), 'video/') ? 'video' : 'image',
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
            ];
            $settings = array_merge(
                $defaultSettings,
                is_array($data['mobileSettings'] ?? null) ? $data['mobileSettings'] : [],
            );
            if (!is_array($settings['hiddenDemoPropertyIds'] ?? null)) {
                $settings['hiddenDemoPropertyIds'] = [];
            }
            if ($method === 'GET') return $this->json($settings);
            $admin = $this->currentUser($request, true); if (!$this->isAdmin($admin)) return $this->json(['error' => 'Forbidden'], 403);
            $settings = $this->deepMerge($settings, $request->all()); $data['mobileSettings'] = $settings; JsonStore::write($data);
            return $this->json(['success' => true, 'settings' => $settings]);
        }
        if ($resource === 'push' && $method === 'POST') {
            $admin = $this->currentUser($request, true);
            if (!$this->isAdmin($admin)) return $this->json(['error' => 'Forbidden'], 403);
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
            if (!$this->isAdmin($admin)) return $this->json(['error' => 'Forbidden'], 403);
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
            return $this->json(array_values(array_filter(
                $all,
                fn ($banner) => filter_var($banner['active'] ?? true, FILTER_VALIDATE_BOOLEAN),
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
            $changes = $request->except(['media', 'id', 'type']);
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
            $data['mobileBanners'][$index] = array_merge($banner, $changes);
            JsonStore::write($data);
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
        $banner = array_merge($metadata, ['id' => JsonStore::nextId($data)]);
        $data['mobileBanners'][] = $banner;
        JsonStore::write($data);
        return $this->json(['success' => true, 'banner' => $banner], 201);
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
        $items = $segments[0] === 'agents' ? ($data['cityAgents'] ?? []) : ($data['mobileAgents'] ?? []);
        if ($method === 'GET') return $this->json(collect($items)->filter(fn ($a) => !$request->filled('city') || strtolower((string) ($a['city'] ?? '')) === strtolower((string) $request->input('city')))->values());
        return $this->json(['error' => 'Method not allowed'], 405);
    }

    private function simpleCollection(Request $request, array $segments, string $method)
    {
        $key = match ($segments[0]) { 'inquiries' => 'inquiries', 'offers' => 'offers', default => 'appointments' };
        $user = $this->currentUser($request, true);
        if ($key === 'inquiries' && $method === 'POST') {
            return $this->createInquiry($request, $user);
        }
        return $this->crudNamed($request, JsonStore::read(), $key, $segments[1] ?? null, $method, $user);
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

    private function conversations(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read(); $items = $data['conversations'] ?? []; $id = $parts[0] ?? null;
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
        $id = $segments[0] === 'mobile' ? ($segments[2] ?? null) : ($segments[1] ?? null);
        return $this->crudNamed($request, $data, $key, $id, $method, $user);
    }

    private function crudNamed(Request $request, array $data, string $key, ?string $id, string $method, ?array $user = null)
    {
        $data[$key] ??= [];
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
            $data[$key][] = $item; JsonStore::write($data); return $this->json($item, 201);
        }
        $index = $this->indexById($data[$key], $id); if ($index === null) return $this->json(['error' => 'Not found'], 404);
        if ($user && !$this->isAdmin($user) && !$this->collectionRecordBelongsToUser($key, $data[$key][$index], $user, $data)) {
            return $this->json(['error' => 'Not found'], 404);
        }
        if ($method === 'DELETE') { array_splice($data[$key], $index, 1); JsonStore::write($data); return response()->noContent(); }
        if (in_array($method, ['PUT', 'PATCH'], true)) {
            $patch = $request->all();
            if ($user && !$this->isAdmin($user)) {
                $protectedKeys = ['id', 'userId', 'developerId', 'ownerId', 'createdBy', 'sellerId', 'buyerId', 'reporterId'];
                if ($key === 'agentVisits') $protectedKeys[] = 'agentId';
                foreach ($protectedKeys as $protectedKey) {
                    unset($patch[$protectedKey]);
                }
            }
            $data[$key][$index] = array_merge($data[$key][$index], $patch, ['updatedAt' => now()->toISOString()]);
            JsonStore::write($data);
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

    private function safeUser(array $user): array { unset($user['password']); return $user; }
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
    private function propertyVisible(array $property, ?array $user): bool { if ($this->isAdmin($user)) return true; $owner = $user && (string) ($property['sellerId'] ?? $property['userId'] ?? '') === (string) $user['id']; if ($owner) return true; return in_array(strtolower((string) ($property['approvalStatus'] ?? 'active')), ['active', 'approved'], true) && in_array(strtolower((string) ($property['listingStatus'] ?? 'active')), ['active', 'approved'], true); }
    private function propertyMatches(array $p, Request $r): bool { $text = strtolower((string) ($r->input('search', $r->input('keyword', '')))); if ($text !== '' && !str_contains(strtolower(json_encode($p)), $text)) return false; foreach (['type', 'city', 'status', 'purpose', 'constructionAge', 'furnishing', 'availability'] as $key) if ($r->filled($key) && strtolower((string) ($p[$key] ?? '')) !== strtolower((string) $r->input($key))) return false; if ($r->filled('minPrice') && (float) ($p['price'] ?? 0) < (float) $r->input('minPrice')) return false; if ($r->filled('maxPrice') && (float) ($p['price'] ?? 0) > (float) $r->input('maxPrice')) return false; if ($r->filled('minBeds') && (float) ($p['bedrooms'] ?? 0) < (float) $r->input('minBeds')) return false; foreach (['minLat' => 0, 'maxLat' => 0, 'minLng' => 0, 'maxLng' => 0] as $key => $fallback) if ($r->filled($key)) { $value = str_contains($key, 'Lat') ? $this->propertyLat($p) : $this->propertyLng($p); if ($value === null || ($key === 'minLat' && $value < (float) $r->input($key)) || ($key === 'maxLat' && $value > (float) $r->input($key)) || ($key === 'minLng' && $value < (float) $r->input($key)) || ($key === 'maxLng' && $value > (float) $r->input($key))) return false; } return true; }
    private function propertyLat(array $p): ?float { return isset($p['lat']) ? (float) $p['lat'] : (isset($p['location']['latitude']) ? (float) $p['location']['latitude'] : null); }
    private function propertyLng(array $p): ?float { return isset($p['lng']) ? (float) $p['lng'] : (isset($p['location']['longitude']) ? (float) $p['location']['longitude'] : null); }
    private function distanceKm(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2): ?float { if ($lat1 === null || $lng1 === null || $lat2 === null || $lng2 === null) return null; $dLat = deg2rad($lat2 - $lat1); $dLng = deg2rad($lng2 - $lng1); $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2; return round(6371 * 2 * asin(min(1, sqrt($a))), 3); }
    private function adminStats(array $data) { return $this->json(['projects' => count($data['developerProjects'] ?? []), 'leads' => count($data['developerLeads'] ?? []), 'units' => count($data['inventoryUnits'] ?? []), 'generatedAt' => now()->toISOString()]); }
    private function deepMerge(array $base, array $patch): array { foreach ($patch as $key => $value) $base[$key] = is_array($value) && is_array($base[$key] ?? null) ? $this->deepMerge($base[$key], $value) : $value; return $base; }
    private function isGenericCollection(array $segments): bool { return in_array($segments[0] ?? '', ['buyer-requests', 'agent-leads', 'agent-visits', 'recent-searches', 'comparisons', 'visit-history', 'promotions', 'verification-requests', 'measurements'], true) || (($segments[0] ?? '') === 'mobile' && isset($segments[1])); }
    private function json($data, int $status = 200) { return response()->json($data, $status)->withHeaders(['Access-Control-Allow-Origin' => '*', 'Access-Control-Allow-Headers' => 'Authorization, Content-Type', 'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS']); }
}