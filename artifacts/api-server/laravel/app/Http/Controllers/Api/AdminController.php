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
}
