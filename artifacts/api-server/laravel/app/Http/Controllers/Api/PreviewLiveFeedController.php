<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Services\LegacyDataStore;

final class PreviewLiveFeedController extends Controller
{
    private const LIVE_API = 'https://www.oglandmark.com/api';

    public function mobileSettings(): JsonResponse
    {
        return $this->forward('mobile/settings');
    }

    public function mobileBanners(): JsonResponse
    {
        return $this->forward('mobile/banners');
    }

    public function properties(Request $request): JsonResponse
    {
        $allowedQueryKeys = [
            'type', 'city', 'status', 'purpose', 'minPrice', 'maxPrice',
            'minBeds', 'featured', 'recommended', 'search', 'keyword', 'limit', 'offset',
            'sort', 'minLat', 'maxLat', 'minLng', 'maxLng', 'lat', 'lng',
            'radiusKm', 'response', 'paginated',
        ];

        return $this->forward('properties', $request->only($allowedQueryKeys));
    }

    public function property(int $id): JsonResponse
    {
        return $this->forward("properties/{$id}");
    }

    public function mobileAgents(Request $request, LegacyDataStore $store): JsonResponse
    {
        $previewRecords = $this->localPreviewPublicAgents();
        $liveResponse = $previewRecords === null
            ? $this->forward('mobile-agents', $request->only(['city', 'limit']))
            : response()->json($previewRecords);
        $data = $store->read();
        $adminCreatedIds = [];
        foreach ($data['adminAudit'] ?? [] as $entry) {
            if (($entry['action'] ?? '') === 'mobile_agent_created') {
                $adminCreatedIds[(string) ($entry['entityId'] ?? '')] = true;
            }
        }
        $localRecords = array_values(array_filter(
            $data['mobileAgents'] ?? [],
            fn (array $agent): bool => (($agent['createdByAdmin'] ?? false) === true
                    || isset($adminCreatedIds[(string) ($agent['id'] ?? '')]))
                && ($agent['visible'] ?? true) !== false
                && strtolower((string) ($agent['status'] ?? '')) === 'active'
                && strtolower((string) ($agent['approvalStatus'] ?? '')) === 'approved',
        ));

        $hiddenIds = array_fill_keys(array_map(
            'strval',
            $data['mobileAgentPreviewHiddenIds'] ?? [],
        ), true);
        $overriddenIds = array_fill_keys(array_values(array_filter(array_map(
            fn (array $agent): string => trim((string) ($agent['sourcePreviewId'] ?? '')),
            $localRecords,
        ))), true);
        $livePayload = $liveResponse->getData(true);
        $liveRecords = $liveResponse->getStatusCode() < 300 && is_array($livePayload)
            ? array_values(array_filter($livePayload, 'is_array'))
            : [];

        $city = mb_strtolower(trim((string) $request->query('city', '')));
        if ($city !== '') {
            $liveRecords = array_values(array_filter($liveRecords, function (array $agent) use ($city): bool {
                $locations = array_merge(
                    [(string) ($agent['city'] ?? '')],
                    is_array($agent['areas'] ?? null) ? $agent['areas'] : [],
                );

                return collect($locations)->contains(
                    fn ($location): bool => mb_strtolower(trim((string) $location)) === $city
                );
            }));
        }
        if ($city !== '') {
            $localRecords = array_values(array_filter($localRecords, function (array $agent) use ($city): bool {
                $locations = array_merge(
                    [(string) ($agent['city'] ?? '')],
                    is_array($agent['areas'] ?? null) ? $agent['areas'] : [],
                );

                return collect($locations)->contains(
                    fn ($location): bool => mb_strtolower(trim((string) $location)) === $city
                );
            }));
        }

        $localContactKeys = [];
        foreach ($localRecords as $agent) {
            $phone = preg_replace('/\D+/', '', (string) ($agent['phone'] ?? ''));
            $name = mb_strtolower(trim((string) ($agent['displayName'] ?? $agent['name'] ?? '')));
            if ($phone !== '' && $name !== '') $localContactKeys[$phone.'|'.$name] = true;
        }

        $liveRecords = array_values(array_filter($liveRecords, function (array $agent) use ($hiddenIds, $overriddenIds, $localContactKeys): bool {
            $id = (string) ($agent['id'] ?? '');
            if (isset($hiddenIds[$id]) || isset($overriddenIds[$id])) return false;

            $phone = preg_replace('/\D+/', '', (string) ($agent['phone'] ?? ''));
            $name = mb_strtolower(trim((string) ($agent['displayName'] ?? $agent['name'] ?? '')));
            $contactKey = $phone !== '' && $name !== '' ? $phone.'|'.$name : '';

            return $contactKey === '' || ! isset($localContactKeys[$contactKey]);
        }));

        $liveIds = array_fill_keys(array_map(
            fn (array $agent): string => (string) ($agent['id'] ?? ''),
            $liveRecords,
        ), true);
        $localRecords = array_map(function (array $agent) use ($liveIds): array {
            if (isset($liveIds[(string) ($agent['id'] ?? '')])) {
                $agent['id'] = 'local-agent-'.(string) $agent['id'];
            }

            unset($agent['password'], $agent['email'], $agent['authUserId'], $agent['loginEmail'], $agent['sourcePreviewId'], $agent['createdByAdmin']);
            $agent['displayName'] = $agent['displayName'] ?? $agent['name'] ?? '';
            $agent['profilePhoto'] = $agent['photo'] ?? $agent['profilePhoto'] ?? null;
            $agent['coverPhoto'] = $agent['coverPhoto'] ?? null;
            $agent['title'] = $agent['title'] ?? $agent['agency'] ?? $agent['specialization'] ?? 'Property Consultant';
            $agent['specialization'] = $agent['specialization'] ?? implode(', ', $agent['specialties'] ?? []);
            $agent['propertiesCount'] = (int) ($agent['propertiesCount'] ?? $agent['listings'] ?? 0);

            return $agent;
        }, $localRecords);

        $agents = array_merge($localRecords, $liveRecords);
        if ($liveResponse->getStatusCode() >= 400 && $agents === []) return $liveResponse;

        $limit = min(100, max(1, (int) $request->query('limit', 100)));
        return response()->json(array_slice($agents, 0, $limit));
    }

    private function forward(string $path, array $query = []): JsonResponse
    {
        abort_unless(config('app.env') === 'local', 404);

        try {
            $response = Http::acceptJson()
                ->timeout(12)
                ->get(self::LIVE_API . '/' . $path, $query);
        } catch (ConnectionException) {
            return response()->json(['error' => 'Live preview data is temporarily unavailable.'], 502);
        }

        $payload = $response->json();
        if (! is_array($payload)) {
            return response()->json(['error' => 'Live preview returned an invalid response.'], 502);
        }

        return response()->json($payload, $response->status());
    }

    private function localPreviewPublicAgents(): ?array
    {
        if (
            config('app.env') !== 'local'
            || getenv('APP_ENV') === 'testing'
            || defined('PHPUNIT_COMPOSER_INSTALL')
        ) return null;

        $snapshotPath = public_path('data/live-agents.json');
        if (! is_file($snapshotPath)) return null;

        $snapshot = json_decode((string) file_get_contents($snapshotPath), true);
        if (! is_array($snapshot) || ! is_array($snapshot['items'] ?? null)) return null;

        $absoluteMedia = static function (mixed $url): mixed {
            if (! is_string($url) || $url === '' || preg_match('/^https?:\/\//i', $url) || str_starts_with($url, '//')) {
                return $url;
            }
            return 'https://api.oglandmark.com/' . ltrim($url, '/');
        };

        return array_values(array_map(static function (array $agent) use ($absoluteMedia): array {
            foreach (['photo', 'profilePhoto', 'coverPhoto'] as $field) {
                if (array_key_exists($field, $agent)) $agent[$field] = $absoluteMedia($agent[$field]);
            }
            return $agent;
        }, array_filter($snapshot['items'], static fn ($agent): bool =>
            is_array($agent)
            && ($agent['visible'] ?? true) !== false
            && strtolower((string) ($agent['status'] ?? '')) === 'active'
            && strtolower((string) ($agent['approvalStatus'] ?? '')) === 'approved'
        )));
    }
}
