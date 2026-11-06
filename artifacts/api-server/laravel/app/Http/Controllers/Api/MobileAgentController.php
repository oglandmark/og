<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class MobileAgentController extends Controller
{
    public function index(Request $request, LegacyDataStore $store): JsonResponse
    {
        $data = $store->read();
        $adminCreatedIds = [];
        foreach ($data['adminAudit'] ?? [] as $entry) {
            if (($entry['action'] ?? '') === 'mobile_agent_created') {
                $adminCreatedIds[(string) ($entry['entityId'] ?? '')] = true;
            }
        }
        $agents = array_values(array_filter(
            $data['mobileAgents'] ?? [],
            fn (array $agent): bool => (($agent['createdByAdmin'] ?? false) === true
                    || isset($adminCreatedIds[(string) ($agent['id'] ?? '')]))
                && ($agent['visible'] ?? true) !== false
                && strtolower((string) ($agent['status'] ?? '')) === 'active'
                && strtolower((string) ($agent['approvalStatus'] ?? '')) === 'approved',
        ));

        if ($request->filled('city')) {
            $city = mb_strtolower(trim((string) $request->query('city')));
            $agents = array_values(array_filter($agents, fn (array $agent): bool =>
                collect($agent['areas'] ?? [])->contains(fn ($area): bool => mb_strtolower((string) $area) === $city)
            ));
        }

        $limit = min(100, max(1, (int) $request->query('limit', 100)));
        $agents = array_slice($agents, 0, $limit);

        // Keep the mobile directory's established safe response fields.
        $agents = array_map(function (array $agent): array {
            unset($agent['password'], $agent['email'], $agent['authUserId'], $agent['loginEmail'], $agent['createdByAdmin']);
            unset($agent['sourcePreviewId']);
            $agent['displayName'] = $agent['displayName'] ?? $agent['name'] ?? '';
            $agent['profilePhoto'] = $agent['photo'] ?? $agent['profilePhoto'] ?? null;
            $agent['coverPhoto'] = $agent['coverPhoto'] ?? null;
            $agent['title'] = $agent['title'] ?? $agent['agency'] ?? $agent['specialization'] ?? 'Property Consultant';
            $agent['specialization'] = $agent['specialization'] ?? implode(', ', $agent['specialties'] ?? []);
            $agent['propertiesCount'] = (int) ($agent['propertiesCount'] ?? $agent['listings'] ?? 0);
            return $agent;
        }, $agents);

        return response()->json($agents);
    }
}
