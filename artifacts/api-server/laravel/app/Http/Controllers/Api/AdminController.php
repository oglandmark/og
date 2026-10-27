<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AdminController extends Controller
{
    public function properties(Request $request, LegacyDataStore $store): JsonResponse
    {
        $properties = $store->read()['properties'] ?? [];
        $status = $request->query('approvalStatus');
        if ($status) $properties = array_values(array_filter($properties, fn (array $property): bool => ($property['approvalStatus'] ?? '') === $status));
        usort($properties, fn (array $a, array $b): int => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
        return response()->json(array_values($properties));
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
}
