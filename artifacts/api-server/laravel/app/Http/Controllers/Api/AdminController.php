<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use App\Services\PreviewPropertyMirror;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

final class AdminController extends Controller
{
    private const USER_ROLES = ['User', 'Buyer', 'Seller', 'Agent', 'Developer', 'Admin'];
    private const STAFF_PERMISSIONS = ['admin', 'agent', 'developer'];
    private const REPORT_STATUSES = ['Pending', 'Reviewed', 'Resolved', 'Dismissed'];

    public function users(Request $request, LegacyDataStore $store): JsonResponse
    {
        $users = array_values(array_filter($store->read()['users'] ?? [], 'is_array'));
        $role = trim((string) $request->query('role', ''));
        if ($role !== '') {
            $users = array_values(array_filter($users, fn (array $user): bool =>
                mb_strtolower(trim((string) ($user['role'] ?? ''))) === mb_strtolower($role)
            ));
        }
        usort($users, fn (array $a, array $b): int =>
            strcmp((string) ($b['joinedDate'] ?? ''), (string) ($a['joinedDate'] ?? ''))
        );
        if ($request->query->has('limit')) {
            $users = array_slice($users, 0, max(0, (int) $request->query('limit')));
        }
        foreach ($users as &$user) unset($user['password']);
        unset($user);

        return response()->json($users);
    }

    public function updateUserRole(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', 'in:'.implode(',', self::USER_ROLES)],
        ]);
        $admin = $request->attributes->get('legacyUser', []);
        $result = $store->mutate(function (array &$data) use ($id, $validated, $admin): ?array {
            foreach ($data['users'] ?? [] as $index => $user) {
                if ((string) ($user['id'] ?? '') !== $id) continue;
                $previousRole = (string) ($user['role'] ?? 'User');
                $previousPermissions = $this->normalizedPermissions($user['permissions'] ?? []);
                if ((string) ($admin['id'] ?? '') === (string) ($user['id'] ?? '')
                    && $this->hasAdminAccess($user)
                    && $validated['role'] !== 'Admin') {
                    return ['error' => 'You cannot remove your own admin access.', 'status' => 422];
                }
                $role = $validated['role'];
                $user['role'] = $role;
                $user['permissions'] = in_array(mb_strtolower($role), self::STAFF_PERMISSIONS, true)
                    ? [$this->staffPermissionForRole($role)]
                    : array_values(array_diff($previousPermissions, self::STAFF_PERMISSIONS));
                $data['users'][$index] = $user;
                $this->appendAdminAudit($data, $admin, 'user_role_updated', 'users', $user['id'] ?? $id, [
                    'fromRole' => $previousRole,
                    'toRole' => $role,
                    'fromPermissions' => $previousPermissions,
                    'toPermissions' => $user['permissions'],
                ]);
                unset($user['password']);
                return ['user' => $user];
            }
            return null;
        });
        if ($result === null) return response()->json(['error' => 'User not found'], 404);
        if (isset($result['error'])) return response()->json(['error' => $result['error']], $result['status']);

        return response()->json(['success' => true, 'user' => $result['user']]);
    }

    public function updateUser(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'nullable', 'email', 'max:320'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'status' => ['sometimes', 'string', 'in:Active,Inactive,Suspended'],
            'role' => ['sometimes', 'string', 'in:'.implode(',', self::USER_ROLES)],
        ]);
        $admin = $request->attributes->get('legacyUser', []);
        $result = $store->mutate(function (array &$data) use ($id, $validated, $admin): ?array {
            foreach ($data['users'] ?? [] as $index => $user) {
                if ((string) ($user['id'] ?? '') !== $id) continue;
                $previousRole = (string) ($user['role'] ?? 'User');
                $previousStatus = $user['status'] ?? null;
                $previousPermissions = $this->normalizedPermissions($user['permissions'] ?? []);
                if (isset($validated['role'])
                    && (string) ($admin['id'] ?? '') === (string) ($user['id'] ?? '')
                    && $this->hasAdminAccess($user)
                    && $validated['role'] !== 'Admin') {
                    return ['error' => 'You cannot remove your own admin access.', 'status' => 422];
                }
                $user = array_replace($user, array_diff_key($validated, ['role' => true]));
                if (isset($validated['role'])) {
                    $user['role'] = $validated['role'];
                    $user['permissions'] = in_array(mb_strtolower($validated['role']), self::STAFF_PERMISSIONS, true)
                        ? [$this->staffPermissionForRole($validated['role'])]
                        : array_values(array_diff($previousPermissions, self::STAFF_PERMISSIONS));
                }
                $user['updatedAt'] = now()->toISOString();
                $data['users'][$index] = $user;
                $this->appendAdminAudit($data, $admin, 'user_updated', 'users', $user['id'] ?? $id, [
                    'changedFields' => array_keys($validated),
                    'fromRole' => $previousRole,
                    'toRole' => $user['role'] ?? $previousRole,
                    'fromStatus' => $previousStatus,
                    'toStatus' => $user['status'] ?? $previousStatus,
                    'fromPermissions' => $previousPermissions,
                    'toPermissions' => $this->normalizedPermissions($user['permissions'] ?? []),
                ]);
                unset($user['password']);
                return ['user' => $user];
            }
            return null;
        });
        if ($result === null) return response()->json(['error' => 'User not found'], 404);
        if (isset($result['error'])) return response()->json(['error' => $result['error']], $result['status']);

        return response()->json($result['user']);
    }

    public function updateUserPermissions(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'permissions' => ['required', 'array', 'max:3'],
            'permissions.*' => ['required', 'string', 'distinct', 'in:admin,agent,developer'],
        ]);
        $permissions = array_values(array_unique($validated['permissions']));
        sort($permissions);
        $admin = $request->attributes->get('legacyUser', []);
        $result = $store->mutate(function (array &$data) use ($id, $permissions, $admin): ?array {
            foreach ($data['users'] ?? [] as $index => $user) {
                if ((string) ($user['id'] ?? '') !== $id) continue;
                $previous = $this->normalizedPermissions($user['permissions'] ?? []);
                if ((string) ($admin['id'] ?? '') === (string) ($user['id'] ?? '')
                    && $this->hasAdminAccess($user)
                    && ! in_array('admin', $permissions, true)) {
                    return ['error' => 'You cannot remove your own admin access.', 'status' => 422];
                }
                $user['permissions'] = $permissions;
                $data['users'][$index] = $user;
                $this->appendAdminAudit($data, $admin, 'user_permissions_updated', 'users', $user['id'] ?? $id, [
                    'fromPermissions' => $previous,
                    'toPermissions' => $permissions,
                ]);
                unset($user['password']);
                return ['user' => $user];
            }
            return null;
        });
        if ($result === null) return response()->json(['error' => 'User not found'], 404);
        if (isset($result['error'])) return response()->json(['error' => $result['error']], $result['status']);

        return response()->json(['success' => true, 'user' => $result['user']]);
    }

    public function deleteUser(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $admin = $request->attributes->get('legacyUser', []);
        $deleted = $store->mutate(function (array &$data) use ($id, $admin): ?array {
            foreach ($data['users'] ?? [] as $index => $user) {
                if ((string) ($user['id'] ?? '') !== $id) continue;
                if ((string) ($admin['id'] ?? '') === (string) ($user['id'] ?? '')) {
                    return ['error' => 'You cannot delete your own account.', 'status' => 422];
                }
                array_splice($data['users'], $index, 1);
                DB::table('auth_sessions')->where('user_id', $user['id'] ?? $id)->delete();
                $this->appendAdminAudit($data, $admin, 'user_deleted', 'users', $user['id'] ?? $id, [
                    'role' => $user['role'] ?? null,
                ]);
                return ['success' => true];
            }
            return null;
        });
        if ($deleted === null) return response()->json(['error' => 'User not found'], 404);
        if (isset($deleted['error'])) return response()->json(['error' => $deleted['error']], $deleted['status']);

        return response()->json(['success' => true]);
    }

    public function reports(Request $request, LegacyDataStore $store): JsonResponse
    {
        $reports = array_values(array_filter($store->read()['reports'] ?? [], 'is_array'));
        $status = (string) $request->query('status', '');
        if ($status !== '' && $status !== 'all') {
            $reports = array_values(array_filter($reports, fn (array $report): bool => ($report['status'] ?? null) === $status));
        }
        usort($reports, fn (array $a, array $b): int =>
            strcmp((string) ($b['reportedAt'] ?? ''), (string) ($a['reportedAt'] ?? ''))
        );

        return response()->json($reports);
    }

    public function updateReport(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['sometimes', 'required', 'string', 'in:'.implode(',', self::REPORT_STATUSES)],
            'adminNote' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);
        $admin = $request->attributes->get('legacyUser', []);
        $result = $store->mutate(function (array &$data) use ($id, $validated, $admin): ?array {
            foreach ($data['reports'] ?? [] as $index => $report) {
                if ((string) ($report['id'] ?? '') !== $id) continue;
                $previousStatus = $report['status'] ?? null;
                $previousNote = $report['adminNote'] ?? null;
                if (array_key_exists('status', $validated)) $report['status'] = $validated['status'];
                if (array_key_exists('adminNote', $validated)) $report['adminNote'] = $validated['adminNote'];
                $report['resolvedAt'] = now()->toISOString();
                $data['reports'][$index] = $report;
                $this->appendAdminAudit($data, $admin, 'report_updated', 'reports', $report['id'] ?? $id, [
                    'fromStatus' => $previousStatus,
                    'toStatus' => $report['status'] ?? null,
                    'adminNoteChanged' => $previousNote !== ($report['adminNote'] ?? null),
                ]);
                return $report;
            }
            return null;
        });
        if (! $result) return response()->json(['error' => 'Report not found'], 404);

        return response()->json(['success' => true, 'report' => $result]);
    }

    public function userActivity(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $data = $store->read();
        $user = collect($data['users'] ?? [])
            ->first(fn (array $candidate): bool => (string) ($candidate['id'] ?? '') === $id);
        if (! $user) return response()->json(['error' => 'User not found'], 404);
        $userId = (int) ($user['id'] ?? 0);
        $sources = [
            ['buyerRequests', $data['buyerRequests'] ?? []],
            ['agentLeads', $data['agentLeads'] ?? []],
            ['agentVisits', $data['agentVisits'] ?? []],
            ['developerProjects', $data['developerProjects'] ?? []],
            ['developerLeads', $data['developerLeads'] ?? []],
            ['promotions', $data['promotions'] ?? []],
            ['conversations', $data['conversations'] ?? []],
            ['notifications', $data['notifications'] ?? []],
            ['auditLog', $data['auditLog'] ?? []],
        ];
        $activity = [];
        foreach ($sources as [$resource, $records]) {
            foreach (is_array($records) ? $records : [] as $record) {
                if (! is_array($record)) continue;
                $ownedByUser = (int) ($record['userId'] ?? $record['ownerId'] ?? $record['developerId'] ?? $record['agentId'] ?? $record['adminId'] ?? 0) === $userId;
                $participants = is_array($record['participants'] ?? null) ? $record['participants'] : [];
                $isConversationParticipant = $resource === 'conversations'
                    && in_array($userId, array_map('intval', $participants), true);
                $isUserAudit = $resource === 'auditLog'
                    && ($record['resource'] ?? '') === 'users'
                    && (string) ($record['recordId'] ?? '') === (string) ($user['id'] ?? '');
                if (! $ownedByUser && ! $isConversationParticipant && ! $isUserAudit) continue;
                $record['resource'] = $resource;
                $record['activityAt'] = $record['updatedAt'] ?? $record['createdAt'] ?? $record['timestamp'] ?? $record['date'] ?? null;
                $activity[] = $record;
            }
        }
        usort($activity, fn (array $a, array $b): int =>
            strcmp((string) ($b['activityAt'] ?? ''), (string) ($a['activityAt'] ?? ''))
        );
        $total = count($activity);
        $limit = max(0, (int) $request->query('limit', 0));
        $page = max(1, (int) $request->query('page', 1));
        if ($limit > 0) $activity = array_slice($activity, ($page - 1) * $limit, $limit);

        return response()->json($activity)->header('X-Total-Count', (string) $total);
    }

    public function properties(Request $request, LegacyDataStore $store, PreviewPropertyMirror $mirror): JsonResponse
    {
        $mirror->syncIfStale($store);
        $properties = $store->read()['properties'] ?? [];
        $status = $request->query('approvalStatus');
        if ($status) $properties = array_values(array_filter($properties, fn (array $property): bool => ($property['approvalStatus'] ?? '') === $status));
        usort($properties, fn (array $a, array $b): int => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
        return response()->json(array_values($properties));
    }

    public function deleteProperty(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $admin = $request->attributes->get('legacyUser', []);
        $deleted = $store->mutate(function (array &$data) use ($id, $admin): ?array {
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;
                array_splice($data['properties'], $index, 1);
                $deletedIds = array_map('strval', $data['previewDeletedPropertyIds'] ?? []);
                $deletedIds[] = $id;
                $data['previewDeletedPropertyIds'] = array_values(array_unique($deletedIds));
                $this->appendAdminAudit($data, $admin, 'property_deleted', 'properties', $id, [
                    'title' => $property['title'] ?? '',
                    'city' => $property['city'] ?? '',
                ]);
                return $property;
            }
            return null;
        });
        if (! $deleted) return response()->json(['error' => 'Property not found.'], 404);
        return response()->json(['success' => true, 'deletedId' => $id]);
    }

    public function updateProperty(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'type' => ['nullable', 'string', 'max:160'],
            'purpose' => ['nullable', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:160'],
            'district' => ['nullable', 'string', 'max:160'],
            'tehsil' => ['nullable', 'string', 'max:160'],
            'locality' => ['nullable', 'string', 'max:200'],
            'society' => ['nullable', 'string', 'max:200'],
            'address' => ['nullable', 'string', 'max:1000'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'area' => ['nullable', 'string', 'max:100'],
            'areaUnit' => ['nullable', 'string', 'max:40'],
            'bedrooms' => ['nullable', 'numeric', 'min:0'],
            'bathrooms' => ['nullable', 'numeric', 'min:0'],
            'yearBuilt' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'furnishing' => ['nullable', 'string', 'max:100'],
            'availability' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:10000'],
            'amenities' => ['present', 'array', 'max:100'],
            'amenities.*' => ['string', 'max:200'],
            'assignedAgent' => ['present', 'nullable', 'array'],
            'assignedAgent.id' => ['nullable', 'string', 'max:100'],
            'assignedAgent.userId' => ['nullable', 'string', 'max:100'],
            'assignedAgent.city' => ['nullable', 'string', 'max:160'],
            'assignedAgent.name' => ['nullable', 'string', 'max:200'],
            'assignedAgent.phone' => ['nullable', 'string', 'max:80'],
            'assignedAgent.profileType' => ['nullable', 'string', 'max:40'],
        ]);

        $admin = $request->attributes->get('legacyUser', []);
        $property = $store->mutate(function (array &$data) use ($id, $validated, $admin): ?array {
            $assignedUserId = trim((string) ($validated['assignedAgent']['userId'] ?? ''));
            $validated['agentId'] = $assignedUserId !== '' ? $assignedUserId : null;
            if ($assignedUserId !== '') {
                $agentAccount = collect($data['users'] ?? [])->first(function (array $user) use ($assignedUserId): bool {
                    $permissions = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];
                    $isAgent = mb_strtolower((string) ($user['role'] ?? '')) === 'agent'
                        || in_array('agent', array_map(fn ($permission) => mb_strtolower((string) $permission), $permissions), true);
                    return (string) ($user['id'] ?? '') === $assignedUserId
                        && $isAgent
                        && mb_strtolower((string) ($user['status'] ?? 'active')) === 'active';
                });
                $agentProfile = collect($data['mobileAgents'] ?? [])->first(fn (array $agent): bool =>
                    (string) ($agent['userId'] ?? '') === $assignedUserId
                    && mb_strtolower((string) ($agent['approvalStatus'] ?? '')) === 'approved'
                    && mb_strtolower((string) ($agent['status'] ?? 'active')) === 'active'
                    && filter_var($agent['visible'] ?? true, FILTER_VALIDATE_BOOLEAN)
                );
                if (! $agentAccount || ! $agentProfile) {
                    return ['error' => 'Choose an active, approved Agent listed in the mobile app.', 'status' => 422];
                }
            }
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;

                $changedFields = [];
                foreach ($validated as $field => $value) {
                    if (! array_key_exists($field, $property) || $property[$field] !== $value) {
                        $changedFields[] = $field;
                    }
                }
                $property = array_replace($property, $validated);
                $property['updatedAt'] = now()->toISOString();
                $property['reviewHistory'] = is_array($property['reviewHistory'] ?? null)
                    ? $property['reviewHistory'] : [];
                $property['reviewHistory'][] = [
                    'action' => 'details_updated',
                    'by' => $admin['id'] ?? null,
                    'byName' => $admin['name'] ?? '',
                    'fields' => $changedFields,
                    'createdAt' => $property['updatedAt'],
                ];
                $data['properties'][$index] = $property;
                $this->appendAdminAudit($data, $admin, 'details_updated', 'properties', $id, [
                    'fields' => $changedFields,
                ]);
                return $property;
            }
            return null;
        });

        if (! $property) return response()->json(['error' => 'Property not found.'], 404);
        return response()->json(['success' => true, 'property' => $property]);
    }

    public function setPropertyVisibility(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'hidden' => ['required', 'boolean'],
        ]);
        $hidden = (bool) $validated['hidden'];
        $admin = $request->attributes->get('legacyUser', []);

        $property = $store->mutate(function (array &$data) use ($id, $hidden, $admin): ?array {
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;

                $wasHidden = filter_var($property['adminHidden'] ?? false, FILTER_VALIDATE_BOOLEAN);
                if ($wasHidden === $hidden) return $property;

                $updatedAt = now()->toISOString();
                $property['adminHidden'] = $hidden;
                $property['adminHiddenAt'] = $hidden ? $updatedAt : null;
                $property['adminHiddenBy'] = $hidden ? ($admin['id'] ?? null) : null;
                $property['updatedAt'] = $updatedAt;
                $property['reviewHistory'] = is_array($property['reviewHistory'] ?? null)
                    ? $property['reviewHistory'] : [];
                $action = $hidden ? 'listing_hidden' : 'listing_restored';
                $property['reviewHistory'][] = [
                    'action' => $action,
                    'by' => $admin['id'] ?? null,
                    'byName' => $admin['name'] ?? '',
                    'fromHidden' => $wasHidden,
                    'toHidden' => $hidden,
                    'createdAt' => $updatedAt,
                ];
                $data['properties'][$index] = $property;
                $this->appendAdminAudit($data, $admin, $action, 'properties', $id, [
                    'fromHidden' => $wasHidden,
                    'toHidden' => $hidden,
                ]);
                return $property;
            }
            return null;
        });

        if (! $property) return response()->json(['error' => 'Property not found.'], 404);
        return response()->json(['success' => true, 'property' => $property]);
    }

    public function setPropertyFeatured(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        return $this->updatePropertyPromotion($id, 'feature', $request, $store);
    }

    public function setPropertyRecommended(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        return $this->updatePropertyPromotion($id, 'recommend', $request, $store);
    }

    public function assignPropertyAgent(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate(['userId' => ['present', 'nullable', 'string', 'max:100']]);
        $userId = trim((string) ($validated['userId'] ?? ''));
        $admin = $request->attributes->get('legacyUser', []);
        $result = $store->mutate(function (array &$data) use ($id, $userId, $admin): array {
            $profile = null;
            $account = null;
            if ($userId !== '') {
                $account = collect($data['users'] ?? [])->first(function (array $user) use ($userId): bool {
                    $permissions = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];
                    $isAgent = mb_strtolower((string) ($user['role'] ?? '')) === 'agent'
                        || in_array('agent', array_map(fn ($permission) => mb_strtolower((string) $permission), $permissions), true);
                    return (string) ($user['id'] ?? '') === $userId
                        && $isAgent
                        && mb_strtolower((string) ($user['status'] ?? 'active')) === 'active';
                });
                $profile = collect($data['mobileAgents'] ?? [])->first(fn (array $agent): bool =>
                    (string) ($agent['userId'] ?? '') === $userId
                    && mb_strtolower((string) ($agent['approvalStatus'] ?? '')) === 'approved'
                    && mb_strtolower((string) ($agent['status'] ?? 'active')) === 'active'
                    && filter_var($agent['visible'] ?? true, FILTER_VALIDATE_BOOLEAN)
                );
                if (! $account || ! $profile) {
                    return ['error' => 'Choose an active, approved Agent listed in the mobile app.', 'status' => 422];
                }
            }
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;
                $previous = $property['agentId'] ?? null;
                $property['agentId'] = $userId !== '' ? $userId : null;
                $property['assignedAgent'] = $userId === '' ? null : [
                    'id' => (string) ($profile['id'] ?? $userId),
                    'userId' => $userId,
                    'name' => $profile['name'] ?? $account['name'] ?? 'Agent',
                    'phone' => $profile['phone'] ?? $account['phone'] ?? '',
                    'city' => $profile['city'] ?? $profile['cityName'] ?? '',
                    'profileType' => 'mobile',
                ];
                $property['updatedAt'] = now()->toISOString();
                $property['reviewHistory'] = is_array($property['reviewHistory'] ?? null) ? $property['reviewHistory'] : [];
                $property['reviewHistory'][] = [
                    'action' => $userId === '' ? 'agent_unassigned' : 'agent_assigned',
                    'by' => $admin['id'] ?? null,
                    'byName' => $admin['name'] ?? '',
                    'fromAgentId' => $previous,
                    'toAgentId' => $userId !== '' ? $userId : null,
                    'createdAt' => $property['updatedAt'],
                ];
                $data['properties'][$index] = $property;
                $this->appendAdminAudit($data, $admin, 'agent_assigned', 'properties', $id, [
                    'fromAgentId' => $previous, 'toAgentId' => $userId !== '' ? $userId : null,
                ]);
                return ['property' => $property];
            }
            return ['error' => 'Property not found.', 'status' => 404];
        });
        if (isset($result['error'])) return response()->json(['error' => $result['error']], $result['status']);
        return response()->json(['success' => true, 'property' => $result['property']]);
    }

    private function updatePropertyPromotion(string $id, string $promotion, Request $request, LegacyDataStore $store): JsonResponse
    {
        if (! in_array($promotion, ['feature', 'recommend'], true)) {
            return response()->json(['error' => 'Unsupported listing promotion.'], 404);
        }
        $field = $promotion === 'feature' ? 'featured' : 'recommended';
        $validated = $request->validate([$field => ['required', 'boolean']]);
        $enabled = (bool) $validated[$field];
        $admin = $request->attributes->get('legacyUser', []);

        $result = $store->mutate(function (array &$data) use ($id, $promotion, $field, $enabled, $admin): array {
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;

                $approval = mb_strtolower(trim((string) ($property['approvalStatus'] ?? '')));
                $listing = mb_strtolower(trim((string) ($property['listingStatus'] ?? '')));
                $eligible = in_array($approval, ['active', 'approved'], true)
                    && in_array($listing, ['active', 'approved'], true)
                    && ! filter_var($property['isDemo'] ?? false, FILTER_VALIDATE_BOOLEAN)
                    && ! filter_var($property['isProject'] ?? false, FILTER_VALIDATE_BOOLEAN);
                if ($enabled && ! $eligible) {
                    return ['error' => 'Only active, approved property listings can be promoted.', 'status' => 409];
                }

                $previous = (bool) ($property[$field] ?? false);
                $property[$field] = $enabled;
                $property['updatedAt'] = now()->toISOString();
                $property['reviewHistory'] = is_array($property['reviewHistory'] ?? null)
                    ? $property['reviewHistory'] : [];
                $action = $promotion === 'feature' ? 'featured_updated' : 'recommended_updated';
                $property['reviewHistory'][] = [
                    'action' => $action,
                    'by' => $admin['id'] ?? null,
                    'byName' => $admin['name'] ?? '',
                    'from' => $previous,
                    'to' => $enabled,
                    'createdAt' => $property['updatedAt'],
                ];
                $data['properties'][$index] = $property;
                $this->appendAdminAudit($data, $admin, $action, 'properties', $property['id'] ?? $id, [
                    'field' => $field,
                    'from' => $previous,
                    'to' => $enabled,
                ]);
                return ['property' => $property];
            }
            return ['error' => 'Property not found.', 'status' => 404];
        });

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']], $result['status']);
        }
        return response()->json(['success' => true, 'property' => $result['property']]);
    }

    public function propertyReview(string $id, LegacyDataStore $store): JsonResponse
    {
        $data = $store->read();
        $property = collect($data['properties'] ?? [])
            ->first(fn (array $candidate): bool => (string) ($candidate['id'] ?? '') === $id);
        if (! $property) return response()->json(['error' => 'Property not found.'], 404);

        $sellerId = $property['sellerId'] ?? $property['agentId'] ?? null;
        $seller = collect($data['users'] ?? [])
            ->first(fn (array $candidate): bool => (string) ($candidate['id'] ?? '') === (string) $sellerId);
        $audit = array_values(array_filter(
            $data['auditLog'] ?? [],
            fn (array $entry): bool => ($entry['resource'] ?? '') === 'properties'
                && (string) ($entry['recordId'] ?? '') === $id,
        ));

        return response()->json([
            'property' => $property,
            'seller' => $seller ? [
                'id' => $seller['id'] ?? null,
                'name' => $seller['name'] ?? '',
                'role' => $seller['role'] ?? '',
                'email' => $seller['email'] ?? '',
                'phone' => $seller['phone'] ?? '',
                'agencyName' => $seller['agencyName'] ?? $seller['agency'] ?? '',
            ] : null,
            'audit' => array_slice($audit, 0, 100),
        ]);
    }

    public function updatePropertyMedia(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $imagesInput = $request->input('images', '[]');
        if (is_string($imagesInput)) {
            $imagesInput = json_decode($imagesInput, true);
        }
        if (! is_array($imagesInput) || count($imagesInput) > 30) {
            throw ValidationException::withMessages([
                'images' => ['Images must be a list with no more than 30 photos.'],
            ]);
        }
        foreach ($imagesInput as $image) {
            if (! is_string($image) || mb_strlen(trim($image)) > 2000) {
                throw ValidationException::withMessages([
                    'images' => ['Each image URL must be a string of at most 2000 characters.'],
                ]);
            }
        }

        $videoUrl = $request->input('videoUrl');
        if ($videoUrl !== null && (! is_string($videoUrl) || mb_strlen(trim($videoUrl)) > 2000)) {
            throw ValidationException::withMessages([
                'videoUrl' => ['The video URL must be a string of at most 2000 characters.'],
            ]);
        }

        $newImages = $request->file('newImages', []);
        if (! is_array($newImages)) $newImages = [$newImages];
        $newImages = array_values(array_filter($newImages));
        $video = $request->file('video');
        if (count($imagesInput) + count($newImages) > 30) {
            throw ValidationException::withMessages([
                'images' => ['A property can have at most 30 images.'],
            ]);
        }

        foreach ($newImages as $image) {
            $this->validateListingMediaFile($image, 'image');
        }
        if ($video) $this->validateListingMediaFile($video, 'video');

        $storedPaths = [];
        try {
            foreach ($newImages as $image) {
                $path = $image->storePublicly('listing-media', 'public');
                if (! $path) throw new \RuntimeException('Could not store uploaded photo.');
                $storedPaths[] = $path;
                $imagesInput[] = $this->propertyMediaUrl(basename($path));
            }
            if ($video) {
                $path = $video->storePublicly('listing-media', 'public');
                if (! $path) throw new \RuntimeException('Could not store uploaded video.');
                $storedPaths[] = $path;
                $videoUrl = $this->propertyMediaUrl(basename($path));
            }

            $images = array_values(array_unique(array_filter(
                array_map(fn ($url): string => trim((string) $url), $imagesInput),
                fn (string $url): bool => $url !== '',
            )));
            $videoUrl = is_string($videoUrl) && trim($videoUrl) !== '' ? trim($videoUrl) : null;
            $admin = $request->attributes->get('legacyUser', []);
            $result = $store->mutate(function (array &$data) use ($id, $images, $videoUrl, $admin): ?array {
                foreach ($data['properties'] ?? [] as $index => $property) {
                    if ((string) ($property['id'] ?? '') !== $id) continue;
                    $previousImages = array_values(array_filter(array_map(
                        fn ($item): string => is_array($item) ? (string) ($item['url'] ?? '') : (string) $item,
                        is_array($property['images'] ?? null) ? $property['images'] : [],
                    )));
                    $previousVideo = $property['videoUrl'] ?? null;

                    $property['images'] = $images;
                    $property['coverImage'] = in_array($property['coverImage'] ?? null, $images, true)
                        ? $property['coverImage']
                        : ($images[0] ?? null);
                    $property['videoUrl'] = $videoUrl;
                    $property['media'] = array_replace(
                        is_array($property['media'] ?? null) ? $property['media'] : [],
                        [
                            'images' => array_map(fn (string $url): array => [
                                'url' => $url, 'propertyId' => $property['id'], 'type' => 'image',
                            ], $images),
                            'videos' => $videoUrl ? [[
                                'url' => $videoUrl, 'propertyId' => $property['id'], 'type' => 'video',
                            ]] : [],
                        ],
                    );
                    $property['updatedAt'] = now()->toISOString();
                    $detail = [
                        'addedImages' => count(array_diff($images, $previousImages)),
                        'removedImages' => count(array_diff($previousImages, $images)),
                        'videoChanged' => $previousVideo !== $videoUrl,
                    ];
                    $property['reviewHistory'] = is_array($property['reviewHistory'] ?? null)
                        ? $property['reviewHistory'] : [];
                    $property['reviewHistory'][] = [
                        'action' => 'media_updated',
                        'by' => $admin['id'] ?? null,
                        'byName' => $admin['name'] ?? '',
                        'detail' => $detail,
                        'createdAt' => $property['updatedAt'],
                    ];
                    $data['properties'][$index] = $property;
                    $this->appendAdminAudit($data, $admin, 'media_updated', 'properties', $id, $detail);
                    return [
                        'property' => $property,
                        'removedUrls' => [
                            ...array_values(array_diff($previousImages, $images)),
                            ...($previousVideo && $previousVideo !== $videoUrl ? [$previousVideo] : []),
                        ],
                    ];
                }
                return null;
            });
            if (! $result) {
                Storage::disk('public')->delete($storedPaths);
                return response()->json(['error' => 'Property not found.'], 404);
            }

            $this->deleteUnreferencedPropertyMedia($store->read(), $result['removedUrls']);
            return response()->json(['success' => true, 'property' => $result['property']]);
        } catch (\Throwable $error) {
            Storage::disk('public')->delete($storedPaths);
            throw $error;
        }
    }

    public function propertyMedia(string $filename, Request $request): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        $path = 'listing-media/'.basename($filename);
        if (! Storage::disk('public')->exists($path)) {
            return response()->json(['error' => 'Media not found.'], 404);
        }

        $size = Storage::disk('public')->size($path);
        $start = 0;
        $end = max(0, $size - 1);
        $status = 200;
        $range = $request->header('Range');
        if ($range !== null) {
            if (! preg_match('/^bytes=(\d*)-(\d*)$/', trim($range), $matches) || $size === 0) {
                return response()->json(['error' => 'Invalid byte range.'], 416)
                    ->header('Content-Range', "bytes */{$size}");
            }
            if ($matches[1] === '') {
                $suffixLength = (int) $matches[2];
                if ($suffixLength < 1) {
                    return response()->json(['error' => 'Invalid byte range.'], 416)
                        ->header('Content-Range', "bytes */{$size}");
                }
                $start = max(0, $size - $suffixLength);
            } else {
                $start = (int) $matches[1];
                if ($matches[2] !== '') $end = (int) $matches[2];
            }
            if ($start >= $size || $end < $start) {
                return response()->json(['error' => 'Invalid byte range.'], 416)
                    ->header('Content-Range', "bytes */{$size}");
            }
            $end = min($end, $size - 1);
            $status = 206;
        }

        $length = $end - $start + 1;
        $headers = [
            'Accept-Ranges' => 'bytes',
            'Content-Length' => (string) $length,
            'Content-Type' => Storage::disk('public')->mimeType($path) ?: 'application/octet-stream',
        ];
        if ($status === 206) $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";

        return response()->stream(function () use ($path, $start, $length): void {
            $stream = Storage::disk('public')->readStream($path);
            if (! is_resource($stream)) return;
            if ($start > 0) fseek($stream, $start);
            $remaining = $length;
            while ($remaining > 0 && ! feof($stream)) {
                $chunk = fread($stream, min(8192, $remaining));
                if ($chunk === false || $chunk === '') break;
                echo $chunk;
                $remaining -= strlen($chunk);
                flush();
            }
            fclose($stream);
        }, $status, $headers);
    }

    private function validateListingMediaFile(\Illuminate\Http\UploadedFile $file, string $kind): void
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $mime = strtolower((string) $file->getMimeType());
        $allowed = $kind === 'image'
            ? ['jpg', 'jpeg', 'png', 'webp']
            : ['mp4', 'mov'];
        $allowedMime = $kind === 'image'
            ? ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
            : ['video/mp4', 'video/quicktime'];
        $transportMime = in_array($mime, ['application/octet-stream', 'binary/octet-stream'], true);
        if (! in_array($extension, $allowed, true) || (! in_array($mime, $allowedMime, true) && ! $transportMime)) {
            throw ValidationException::withMessages([
                $kind === 'image' ? 'images' : 'video' => ['Allowed: JPG, PNG, WebP, MP4, MOV.'],
            ]);
        }
        if ($file->getSize() > 300 * 1024 * 1024) {
            throw ValidationException::withMessages([
                $kind === 'image' ? 'images' : 'video' => ['Media files must be 300 MB or smaller.'],
            ]);
        }
    }

    private function propertyMediaUrl(string $filename): string
    {
        return '/api/admin/property-media/'.rawurlencode($filename);
    }

    private function deleteUnreferencedPropertyMedia(array $data, array $removedUrls): void
    {
        $toStoragePath = static function (mixed $value): ?string {
            if (! is_string($value) || ! preg_match('~/api/admin/property-media/([A-Za-z0-9._-]+)$~', $value, $match)) {
                return null;
            }
            return 'listing-media/'.basename($match[1]);
        };
        $removedPaths = array_unique(array_filter(array_map($toStoragePath, $removedUrls)));
        foreach ($removedPaths as $path) {
            $stillUsed = false;
            foreach ($data['properties'] ?? [] as $property) {
                $references = [
                    ...(is_array($property['images'] ?? null) ? $property['images'] : []),
                    $property['videoUrl'] ?? null,
                ];
                foreach ($references as $reference) {
                    $url = is_array($reference) ? ($reference['url'] ?? null) : $reference;
                    if ($toStoragePath($url) === $path) {
                        $stillUsed = true;
                        break 2;
                    }
                }
            }
            if (! $stillUsed) Storage::disk('public')->delete($path);
        }
    }

    public function moderateProperty(string $id, string $action, Request $request, LegacyDataStore $store): JsonResponse
    {
        $reasonRule = in_array($action, ['reject', 'request-changes'], true) ? 'required' : 'nullable';
        $validated = $request->validate(['reason' => [$reasonRule, 'string', 'max:2000']]);
        if (! in_array($action, ['approve', 'reject', 'request-changes'], true)) {
            return response()->json(['error' => 'Unsupported moderation action.'], 404);
        }
        $admin = $request->attributes->get('legacyUser');
        $result = $store->mutate(function (array &$data) use ($id, $action, $validated, $admin): ?array {
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;
                $previous = $property['approvalStatus'] ?? 'Pending';
                $next = match ($action) {
                    'approve' => 'Active',
                    'reject' => 'Rejected',
                    default => 'Changes Requested',
                };
                $property['approvalStatus'] = $next;
                $property['listingStatus'] = $next === 'Active' ? 'Active' : $next;
                $property['rejectionReason'] = $action === 'reject' ? ($validated['reason'] ?? null) : null;
                $property['changeRequest'] = $action === 'request-changes' ? ($validated['reason'] ?? null) : null;
                $property['updatedAt'] = now()->toISOString();
                $property['reviewHistory'] ??= [];
                $property['reviewHistory'][] = [
                    'action' => $action, 'by' => $admin['id'], 'byName' => $admin['name'] ?? '',
                    'fromStatus' => $previous, 'toStatus' => $next,
                    'reason' => $validated['reason'] ?? null, 'createdAt' => now()->toISOString(),
                ];
                $data['properties'][$index] = $property;
                $data['adminAudit'] ??= [];
                $data['adminAudit'][] = [
                    'action' => 'property_'.$action, 'entityId' => $property['id'],
                    'actorId' => $admin['id'], 'createdAt' => now()->toISOString(),
                ];
                return $property;
            }
            return null;
        });
        if (! $result) return response()->json(['error' => 'Property not found.'], 404);
        return response()->json(['success' => true, 'property' => $result]);
    }

    public function bulkReviewProperties(Request $request, LegacyDataStore $store): JsonResponse
    {
        $reasonRule = $request->input('action') === 'reject' ? 'required' : 'nullable';
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'integer', 'distinct'],
            'action' => ['required', 'in:approve,reject'],
            'reason' => [$reasonRule, 'string', 'max:2000'],
        ]);

        $results = [];
        foreach ($validated['ids'] as $id) {
            $response = $this->moderateProperty((string) $id, $validated['action'], $request, $store);
            $payload = $response->getData(true);
            $property = $payload['property'] ?? null;
            $results[] = [
                'id' => $id,
                'title' => is_array($property) ? ($property['title'] ?? '') : '',
                'success' => $response->getStatusCode() < 400 && is_array($property),
                'property' => is_array($property) ? $property : null,
                'error' => $response->getStatusCode() >= 400 ? ($payload['error'] ?? 'Could not review listing.') : null,
            ];
        }

        $succeeded = count(array_filter($results, fn (array $item): bool => $item['success']));
        return response()->json([
            'results' => $results,
            'summary' => ['succeeded' => $succeeded, 'failed' => count($results) - $succeeded],
        ]);
    }

    public function mobileAgents(LegacyDataStore $store): JsonResponse
    {
        $agents = array_map(function (array $agent): array {
            unset($agent['password']);
            return $agent;
        }, $store->read()['mobileAgents'] ?? []);
        return response()->json(array_values($agents));
    }

    public function cityAgents(LegacyDataStore $store): JsonResponse
    {
        $agents = array_map(function (array $agent): array {
            unset($agent['password']);
            return $agent;
        }, $store->read()['cityAgents'] ?? []);

        return response()->json(array_values($agents));
    }

    public function developerProjects(LegacyDataStore $store): JsonResponse
    {
        return response()->json(array_values($store->read()['developerProjects'] ?? []));
    }

    public function mobileBanners(LegacyDataStore $store): JsonResponse
    {
        $banners = array_values($store->read()['mobileBanners'] ?? []);
        usort($banners, fn (array $a, array $b): int => (int) ($a['order'] ?? 0) <=> (int) ($b['order'] ?? 0));

        return response()->json($banners);
    }

    public function publicMobileBanners(LegacyDataStore $store): JsonResponse
    {
        $banners = array_values(array_filter(
            $store->read()['mobileBanners'] ?? [],
            fn (array $banner): bool => ($banner['active'] ?? true) !== false,
        ));
        usort($banners, fn (array $a, array $b): int => (int) ($a['order'] ?? 0) <=> (int) ($b['order'] ?? 0));

        return response()->json($banners);
    }

    public function createMobileAgent(Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'displayName' => ['sometimes', 'string', 'max:120'],
            'agency' => ['sometimes', 'nullable', 'string', 'max:120'],
            'city' => ['sometimes', 'nullable', 'string', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'email' => ['sometimes', 'nullable', 'email', 'max:160'],
            'years' => ['sometimes', 'integer', 'min:0', 'max:80'],
            'rating' => ['sometimes', 'numeric', 'min:0', 'max:5'],
            'reviewCount' => ['sometimes', 'integer', 'min:0'],
            'listings' => ['sometimes', 'integer', 'min:0'],
            'color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'verified' => ['sometimes', 'boolean'],
            'coverPhoto' => ['sometimes', 'nullable', 'string', 'max:500'],
            'photo' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'profilePhoto' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'areas' => ['sometimes', 'array'],
            'areas.*' => ['string', 'max:120'],
            'specialties' => ['sometimes', 'array'],
            'specialties.*' => ['string', 'max:120'],
            'about' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'sourcePreviewId' => ['sometimes', 'nullable', 'string', 'max:120'],
            'approvalStatus' => ['sometimes', 'in:Pending,Approved,Rejected'],
            'status' => ['sometimes', 'in:Active,Suspended'],
            'visible' => ['sometimes', 'boolean'],
        ]);
        $admin = $request->attributes->get('legacyUser', []);
        $agent = $store->mutate(function (array &$data) use ($validated, $admin): array {
            $sourcePreviewId = trim((string) ($validated['sourcePreviewId'] ?? ''));
            if ($sourcePreviewId !== '') {
                foreach ($data['mobileAgents'] ?? [] as $existingAgent) {
                    if ((string) ($existingAgent['sourcePreviewId'] ?? '') !== $sourcePreviewId) continue;
                    unset($existingAgent['password'], $existingAgent['authUserId']);
                    return $existingAgent;
                }
                $validated['sourcePreviewId'] = $sourcePreviewId;
            }
            $nextId = (int) ($data['nextId'] ?? 1000);
            foreach (['users', 'mobileAgents'] as $collection) {
                foreach ($data[$collection] ?? [] as $record) {
                    if (is_numeric($record['id'] ?? null)) {
                        $nextId = max($nextId, (int) $record['id']);
                    }
                }
            }
            $data['nextId'] = $nextId + 1;
            $now = now()->toISOString();
            $name = trim($validated['name']);
            $email = isset($validated['email']) ? mb_strtolower(trim($validated['email'])) : null;
            $linkedUser = $email === null ? null : collect($data['users'] ?? [])->first(
                fn (array $user): bool => mb_strtolower(trim((string) ($user['email'] ?? ''))) === $email
                    && mb_strtolower((string) ($user['role'] ?? '')) === 'agent'
            );
            $agent = array_replace([
                'id' => $data['nextId'],
                'name' => $name,
                'displayName' => $name,
                'initials' => mb_strtoupper(collect(preg_split('/\s+/', $name) ?: [])->map(
                    fn (string $part): string => mb_substr($part, 0, 1)
                )->implode('')),
                'agency' => '',
                'city' => '',
                'phone' => '',
                'email' => $email,
                'years' => 0,
                'rating' => 0,
                'reviewCount' => 0,
                'listings' => 0,
                'color' => '#0b1f3a',
                'verified' => true,
                'coverPhoto' => null,
                'photo' => null,
                'profilePhoto' => null,
                'areas' => [],
                'specialties' => [],
                'about' => '',
                'status' => 'Active',
                'approvalStatus' => 'Approved',
                'visible' => true,
                'createdAt' => $now,
                'updatedAt' => $now,
            ], $validated);
            $agent['name'] = $name;
            $agent['displayName'] = trim((string) ($validated['displayName'] ?? $name));
            $agent['email'] = $email;
            if ($linkedUser) $agent['authUserId'] = $linkedUser['id'];

            $data['mobileAgents'] ??= [];
            $data['mobileAgents'][] = $agent;
            $data['adminAudit'] ??= [];
            $data['adminAudit'][] = [
                'action' => 'mobile_agent_created',
                'entityId' => $agent['id'],
                'actorId' => $admin['id'] ?? null,
                'createdAt' => $now,
            ];
            unset($agent['password'], $agent['authUserId']);
            return $agent;
        });

        return response()->json(['success' => true, 'agent' => $agent], 201);
    }

    public function updateMobileAgent(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'displayName' => ['sometimes', 'string', 'max:120'],
            'agency' => ['sometimes', 'nullable', 'string', 'max:120'],
            'city' => ['sometimes', 'nullable', 'string', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'email' => ['sometimes', 'nullable', 'email', 'max:160'],
            'years' => ['sometimes', 'integer', 'min:0', 'max:80'],
            'rating' => ['sometimes', 'numeric', 'min:0', 'max:5'],
            'reviewCount' => ['sometimes', 'integer', 'min:0'],
            'listings' => ['sometimes', 'integer', 'min:0'],
            'color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'verified' => ['sometimes', 'boolean'],
            'coverPhoto' => ['sometimes', 'nullable', 'string', 'max:500'],
            'photo' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'profilePhoto' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'areas' => ['sometimes', 'array'],
            'areas.*' => ['string', 'max:120'],
            'specialties' => ['sometimes', 'array'],
            'specialties.*' => ['string', 'max:120'],
            'about' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'approvalStatus' => ['sometimes', 'in:Pending,Approved,Rejected'],
            'status' => ['sometimes', 'in:Active,Suspended'],
            'visible' => ['sometimes', 'boolean'],
            'rejectionReason' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);
        $admin = $request->attributes->get('legacyUser');
        $result = $store->mutate(function (array &$data) use ($id, $validated, $admin): ?array {
            foreach ($data['mobileAgents'] ?? [] as $index => $agent) {
                if ((string) ($agent['id'] ?? '') !== $id) continue;
                $previous = $agent;
                $agent = array_replace($agent, $validated);
                $agent['updatedAt'] = now()->toISOString();
                $data['mobileAgents'][$index] = $agent;
                $data['adminAudit'] ??= [];
                $data['adminAudit'][] = [
                    'action' => 'mobile_agent_updated', 'entityId' => $agent['id'],
                    'actorId' => $admin['id'],
                    'changes' => array_keys($validated),
                    'fromApprovalStatus' => $previous['approvalStatus'] ?? null,
                    'toApprovalStatus' => $agent['approvalStatus'] ?? null,
                    'createdAt' => now()->toISOString(),
                ];
                unset($agent['password'], $agent['authUserId']);
                return $agent;
            }
            return null;
        });
        if (! $result) return response()->json(['error' => 'Agent not found.'], 404);
        return response()->json(['success' => true, 'agent' => $result]);
    }

    public function deleteMobileAgent(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $admin = $request->attributes->get('legacyUser', []);
        $deleted = $store->mutate(function (array &$data) use ($id, $admin): bool {
            foreach ($data['mobileAgents'] ?? [] as $index => $agent) {
                if ((string) ($agent['id'] ?? '') !== $id) continue;
                $removed = $data['mobileAgents'][$index];
                array_splice($data['mobileAgents'], $index, 1);
                if (! empty($removed['sourcePreviewId'])) {
                    $data['mobileAgentPreviewHiddenIds'] ??= [];
                    $data['mobileAgentPreviewHiddenIds'][] = (string) $removed['sourcePreviewId'];
                    $data['mobileAgentPreviewHiddenIds'] = array_values(array_unique($data['mobileAgentPreviewHiddenIds']));
                }
                $data['adminAudit'] ??= [];
                $data['adminAudit'][] = [
                    'action' => 'mobile_agent_deleted',
                    'entityId' => $removed['id'],
                    'actorId' => $admin['id'] ?? null,
                    'createdAt' => now()->toISOString(),
                ];
                return true;
            }
            return false;
        });

        if (! $deleted) return response()->json(['error' => 'Agent not found.'], 404);
        return response()->json(['success' => true]);
    }

    public function hiddenMobileAgentPreviewIds(LegacyDataStore $store): JsonResponse
    {
        $ids = array_values(array_unique(array_map(
            'strval',
            $store->read()['mobileAgentPreviewHiddenIds'] ?? [],
        )));

        return response()->json($ids);
    }

    public function hideMobileAgentPreview(Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate([
            'id' => ['required', 'string', 'max:120'],
        ]);
        $admin = $request->attributes->get('legacyUser', []);
        $id = trim($validated['id']);
        if ($id === '') {
            return response()->json(['error' => 'Preview Agent ID is required.'], 422);
        }

        $store->mutate(function (array &$data) use ($id, $admin): void {
            $data['mobileAgentPreviewHiddenIds'] ??= [];
            $data['mobileAgentPreviewHiddenIds'][] = $id;
            $data['mobileAgentPreviewHiddenIds'] = array_values(array_unique(array_map(
                'strval',
                $data['mobileAgentPreviewHiddenIds'],
            )));
            $data['adminAudit'] ??= [];
            $data['adminAudit'][] = [
                'action' => 'mobile_agent_preview_hidden',
                'entityId' => $id,
                'actorId' => $admin['id'] ?? null,
                'createdAt' => now()->toISOString(),
            ];
        });

        return response()->json(['success' => true, 'id' => $id]);
    }

    private function normalizedPermissions(mixed $permissions): array
    {
        if (! is_array($permissions)) return [];
        return array_values(array_unique(array_filter(
            array_map(fn ($permission): string => mb_strtolower(trim((string) $permission)), $permissions),
            fn (string $permission): bool => in_array($permission, self::STAFF_PERMISSIONS, true),
        )));
    }

    private function staffPermissionForRole(string $role): string
    {
        return mb_strtolower($role);
    }

    private function hasAdminAccess(array $user): bool
    {
        return mb_strtolower(trim((string) ($user['role'] ?? ''))) === 'admin'
            || in_array('admin', $this->normalizedPermissions($user['permissions'] ?? []), true);
    }

    private function appendAdminAudit(array &$data, array $admin, string $action, string $resource, mixed $recordId, array $detail = []): void
    {
        $data['nextId'] = ((int) ($data['nextId'] ?? 1000)) + 1;
        $data['auditLog'] ??= [];
        array_unshift($data['auditLog'], [
            'id' => $data['nextId'],
            'userId' => $admin['id'] ?? null,
            'adminId' => $admin['id'] ?? null,
            'adminName' => $admin['name'] ?? '',
            'action' => $action,
            'resource' => $resource,
            'recordId' => (string) $recordId,
            'detail' => $detail,
            'createdAt' => now()->toISOString(),
        ]);
    }
}
