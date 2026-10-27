<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function properties(Request $request, LegacyDataStore $store): JsonResponse
    {
        $properties = $store->read()['properties'] ?? [];
        $status = $request->query('approvalStatus');
        if ($status) $properties = array_values(array_filter($properties, fn (array $property): bool => ($property['approvalStatus'] ?? '') === $status));
        usort($properties, fn (array $a, array $b): int => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
        return response()->json(array_values($properties));
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

    public function moderateProperty(string $id, string $action, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:2000']]);
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

    public function mobileAgents(LegacyDataStore $store): JsonResponse
    {
        $agents = array_map(function (array $agent): array {
            unset($agent['password']);
            return $agent;
        }, $store->read()['mobileAgents'] ?? []);
        return response()->json(array_values($agents));
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
