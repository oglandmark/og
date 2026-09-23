<?php

namespace App\Http\Controllers;

use App\Services\JsonStore;
use App\Services\MediaStorage;
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

        return $this->json([
            'status' => $database === 'connected' && $productionMediaReady ? 'ok' : 'degraded',
            'database' => $database,
            'databaseProvider' => 'mysql',
            'framework' => 'laravel',
            'smtp' => config('mail.mailers.smtp.username') && config('mail.mailers.smtp.password')
                ? 'configured'
                : 'not_configured',
            'mediaBaseUrl' => $this->mediaBaseUrl(),
            'mediaStorage' => $media,
        ]);
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

        if ($action === 'register' && $method === 'POST') {
            $input = $request->all();
            $validator = Validator::make($input, [
                'email' => ['required', 'email', 'max:320'],
                'password' => ['required', 'min:8'],
                'role' => ['nullable', 'in:buyer,agent,Buyer,Agent'],
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
            $role = strtolower((string) ($input['role'] ?? 'buyer')) === 'agent' ? 'Agent' : 'Buyer';
            $user = [
                'id' => JsonStore::nextId($data),
                'name' => $name !== '' ? $name : 'OG Landmark User',
                'email' => $email,
                'username' => $input['username'] ?? null,
                'phone' => $input['phone'] ?? null,
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
            $this->invalidateSessions($user['id']);
            return $this->json(['success' => true]);
        }

        if ($action === 'admin-verify' && $method === 'POST') {
            $user = $this->findUserByEmail((string) $request->input('email'));
            if (!$user || !$this->isAdmin($user) || !$this->verifyLegacyPassword((string) $request->input('password'), (string) ($user['password'] ?? ''))) {
                return $this->json(['error' => 'Invalid admin credentials.'], 401);
            }
            return $this->json(['success' => true, 'message' => 'Admin verification successful.']);
        }

        if ($action === 'admin-otp' && $method === 'POST') {
            return $this->json(['error' => 'Admin OTP is not configured in this environment.'], 503);
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
            JsonStore::write($data);
            return $this->json($data['properties'][$index]);
        }

        $current = $this->currentUser($request, true);
        if (!$this->isAdmin($current) && (string) ($property['sellerId'] ?? $property['userId'] ?? '') !== (string) ($current['id'] ?? '')) {
            return $this->json(['error' => 'Forbidden'], 403);
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
                'totalViews' => array_sum(array_map(fn ($p) => (int) ($p['views'] ?? 0), $properties)),
            ]);
        }
        if ($resource === 'properties' && $method === 'GET' && $id === null) return $this->json($data['properties'] ?? []);
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
        if ($resource === 'users' && $method === 'GET' && $id === null) return $this->json(array_map(fn ($u) => $this->safeUser($u), $data['users'] ?? []));
        if ($resource === 'users' && $id !== null && $method === 'PATCH' && ($parts[2] ?? '') === 'role') {
            $index = $this->indexById($data['users'] ?? [], $id);
            if ($index === null) return $this->json(['error' => 'User not found'], 404);
            $data['users'][$index]['role'] = $request->input('role', $data['users'][$index]['role']);
            JsonStore::write($data);
            return $this->json($this->safeUser($data['users'][$index]));
        }
        if ($resource === 'users' && $id !== null && $method === 'DELETE') {
            $index = $this->indexById($data['users'] ?? [], $id);
            if ($index === null) return $this->json(['error' => 'User not found'], 404);
            array_splice($data['users'], $index, 1); JsonStore::write($data); return response()->noContent();
        }
        if ($resource === 'reports') return $this->crudNamed($request, $data, 'reports', $id, $method);
        if ($resource === 'announcements') return $this->crudNamed($request, $data, 'announcements', $id, $method);
        return $this->json(['error' => 'Not found'], 404);
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
            $key = $photo === 'profile-photo' ? 'profilePhoto' : 'coverPhoto';
            if ($method === 'GET') return $this->json(['url' => $data['users'][$index][$key] ?? null]);
            if ($method === 'DELETE') { $data['users'][$index][$key] = null; JsonStore::write($data); return response()->noContent(); }
            if ($method === 'PUT') { $data['users'][$index][$key] = $request->input('url'); JsonStore::write($data); return $this->json(['url' => $data['users'][$index][$key]]); }
        }
        if ($method === 'GET') return $this->json($this->safeUser($data['users'][$index]));
        if ($method === 'DELETE') { array_splice($data['users'], $index, 1); JsonStore::write($data); $this->destroySession($request); return response()->noContent(); }
        if ($method === 'PUT') {
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
        $items = collect($data['notifications'] ?? [])->filter(fn ($n) => (string) ($n['recipientUserId'] ?? $n['userId'] ?? $n['forUserId'] ?? '') === (string) $user['id'])->values();
        $id = $segments[1] ?? null;
        if ($id === 'unread-count') return $this->json(['unreadCount' => $items->filter(fn ($n) => empty($n['read']) && empty($n['isRead']))->count()]);
        if ($id === 'mark-all-read' && $method === 'PATCH') {
            foreach ($data['notifications'] ?? [] as $index => $notification) if ((string) ($notification['recipientUserId'] ?? $notification['userId'] ?? '') === (string) $user['id']) { $data['notifications'][$index]['read'] = true; $data['notifications'][$index]['isRead'] = true; $data['notifications'][$index]['readAt'] = now()->toISOString(); }
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
            if ($method === 'PATCH') { $data['notifications'][$index]['read'] = true; $data['notifications'][$index]['isRead'] = true; JsonStore::write($data); return $this->json($data['notifications'][$index]); }
            if ($method === 'DELETE') { array_splice($data['notifications'], $index, 1); JsonStore::write($data); return response()->noContent(); }
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
        $data = JsonStore::read();
        if ($resource === 'settings') {
            $settings = $data['mobileSettings'] ?? [
                'verificationBadgeEnabled' => true, 'pushNotificationsEnabled' => true,
                'darkModeEnabled' => true, 'maintenanceMode' => false, 'maintenanceMessage' => '',
                'appVersion' => '1.0.0', 'minAppVersion' => '1.0.0', 'content' => [],
            ];
            if ($method === 'GET') return $this->json($settings);
            $admin = $this->currentUser($request, true); if (!$this->isAdmin($admin)) return $this->json(['error' => 'Forbidden'], 403);
            $settings = $this->deepMerge($settings, $request->all()); $data['mobileSettings'] = $settings; JsonStore::write($data);
            return $this->json(['success' => true, 'settings' => $settings]);
        }
        if ($resource === 'banners') {
            $all = $data['banners'] ?? [];
            if ($method === 'GET' && ($parts[1] ?? '') !== 'all') return $this->json(array_values(array_filter($all, fn ($b) => ($b['active'] ?? true) === true)));
            $admin = $this->currentUser($request, true); if (!$this->isAdmin($admin)) return $this->json(['error' => 'Forbidden'], 403);
            if ($method === 'GET') return $this->json($all);
            $id = $parts[1] ?? null;
            if ($method === 'POST') { $banner = array_merge($request->except(['media']), ['id' => JsonStore::nextId($data), 'active' => $request->has('active') ? $request->boolean('active') : true, 'order' => (int) $request->input('order', count($all))]); $data['banners'][] = $banner; JsonStore::write($data); return $this->json(['success' => true, 'banner' => $banner], 201); }
            $index = $this->indexById($all, $id); if ($index === null) return $this->json(['error' => 'Banner not found'], 404);
            if ($method === 'DELETE') { array_splice($data['banners'], $index, 1); JsonStore::write($data); return $this->json(['success' => true]); }
            if ($method === 'PATCH' && ($parts[2] ?? '') === 'toggle') { $data['banners'][$index]['active'] = !($data['banners'][$index]['active'] ?? false); JsonStore::write($data); return $this->json(['success' => true, 'active' => $data['banners'][$index]['active']]); }
            $data['banners'][$index] = array_merge($data['banners'][$index], $request->all()); JsonStore::write($data); return $this->json(['success' => true, 'banner' => $data['banners'][$index]]);
        }
        if ($resource === 'push' && $method === 'POST') {
            $admin = $this->currentUser($request, true); if (!$this->isAdmin($admin)) return $this->json(['error' => 'Forbidden'], 403);
            return $this->json(['success' => true, 'sent' => 0, 'totalRecipients' => count($data['users'] ?? []), 'title' => $request->input('title'), 'body' => $request->input('body'), 'sentAt' => now()->toISOString()]);
        }
        if ($resource === 'stats' && $method === 'GET') return $this->adminStats($data);
        if ($resource === 'developer-analytics' && $method === 'GET') return $this->json(['projects' => count($data['developerProjects'] ?? []), 'leads' => count($data['developerLeads'] ?? []), 'units' => count($data['inventoryUnits'] ?? []), 'generatedAt' => now()->toISOString()]);
        return $this->json(['error' => 'Not found'], 404);
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
        return $this->crudNamed($request, JsonStore::read(), $key, $segments[1] ?? null, $method);
    }

    private function conversations(Request $request, array $parts, string $method)
    {
        $user = $this->currentUser($request, true);
        $data = JsonStore::read(); $items = $data['conversations'] ?? []; $id = $parts[0] ?? null;
        if ($method === 'GET' && $id === null) return $this->json($items);
        $index = $this->indexById($items, $id); if ($index === null) return $this->json(['error' => 'Conversation not found'], 404);
        if (($parts[1] ?? '') === 'messages') {
            if ($method === 'GET') return $this->json($items[$index]['messages'] ?? []);
            if ($method === 'POST') { $message = array_merge($request->all(), ['id' => JsonStore::nextId($data), 'senderId' => $user['id'], 'createdAt' => now()->toISOString(), 'timestamp' => now()->toISOString()]); $data['conversations'][$index]['messages'][] = $message; JsonStore::write($data); return $this->json($message, 201); }
        }
        if ($method === 'DELETE') { array_splice($data['conversations'], $index, 1); JsonStore::write($data); return response()->noContent(); }
        return $this->json($items[$index]);
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
            if ($user && !$this->isAdmin($user)) return $this->json(collect($data[$key])->filter(fn ($x) => (string) ($x['userId'] ?? $x['developerId'] ?? '') === (string) $user['id'])->values());
            return $this->json($data[$key]);
        }
        if ($method === 'POST') {
            $user ??= $this->currentUser($request, true);
            $item = array_merge($request->all(), ['id' => JsonStore::nextId($data, $key), 'userId' => $user['id'], 'createdAt' => now()->toISOString()]);
            $data[$key][] = $item; JsonStore::write($data); return $this->json($item, 201);
        }
        $index = $this->indexById($data[$key], $id); if ($index === null) return $this->json(['error' => 'Not found'], 404);
        if ($method === 'DELETE') { array_splice($data[$key], $index, 1); JsonStore::write($data); return response()->noContent(); }
        if (in_array($method, ['PUT', 'PATCH'], true)) { $data[$key][$index] = array_merge($data[$key][$index], $request->all()); JsonStore::write($data); return $this->json($data[$key][$index]); }
        return $this->json($data[$key][$index]);
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

    private function invalidateSessions($userId): void
    {
        try { DB::table('auth_sessions')->where('user_id', $userId)->delete(); } catch (\Throwable $exception) {
            Log::warning('Laravel auth sessions could not be invalidated.', ['error' => $exception->getMessage()]);
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

    private function safeUser(array $user): array { unset($user['password']); return $user; }
    private function findUserByEmail(string $email): ?array { return collect(JsonStore::read()['users'] ?? [])->first(fn ($u) => strtolower((string) ($u['email'] ?? '')) === strtolower(trim($email))); }
    private function isAdmin(?array $user): bool { return $user !== null && strtolower((string) ($user['role'] ?? '')) === 'admin'; }
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