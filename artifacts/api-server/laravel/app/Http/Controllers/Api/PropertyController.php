<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class PropertyController extends Controller
{
    public function index(Request $request, LegacyDataStore $store): JsonResponse
    {
        $user = $request->attributes->get('legacyUser');
        $properties = array_values(array_filter($store->read()['properties'] ?? [], function (array $property) use ($user, $request): bool {
            $owner = $user && (
                (string) ($property['sellerId'] ?? '') === (string) ($user['id'] ?? '')
                || (string) ($property['agentId'] ?? '') === (string) ($user['id'] ?? '')
                || ($user['role'] ?? '') === 'Admin'
            );
            if (! $owner && (
                ($property['approvalStatus'] ?? '') !== 'Active'
                || ($property['listingStatus'] ?? 'Active') !== 'Active'
                || ($property['visible'] ?? true) === false
            )) {
                return false;
            }

            foreach (['city', 'type', 'purpose'] as $field) {
                $queryValue = $request->query($field);
                if ($queryValue && mb_strtolower((string) ($property[$field] ?? '')) !== mb_strtolower((string) $queryValue)) {
                    return false;
                }
            }
            $keyword = mb_strtolower(trim((string) $request->query('keyword', $request->query('search', ''))));
            if ($keyword !== '') {
                $haystack = mb_strtolower(implode(' ', [
                    $property['title'] ?? '', $property['city'] ?? '', $property['address'] ?? '',
                    $property['description'] ?? '', $property['society'] ?? '', $property['sellerName'] ?? '',
                ]));
                if (! str_contains($haystack, $keyword) && (string) ($property['id'] ?? '') !== $keyword) {
                    return false;
                }
            }
            return true;
        }));

        usort($properties, fn (array $a, array $b): int => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
        $total = count($properties);
        $offset = max(0, (int) $request->query('offset', 0));
        $limit = min(100, max(1, (int) $request->query('limit', 50)));
        $items = array_slice($properties, $offset, $limit);

        if ($request->query('response') === 'page' || $request->boolean('paginated')) {
            return response()->json([
                'items' => $items, 'total' => $total, 'offset' => $offset,
                'limit' => $limit, 'hasMore' => $offset + count($items) < $total,
            ])->header('X-Total-Count', (string) $total);
        }
        return response()->json($items)->header('X-Total-Count', (string) $total);
    }

    public function show(string $id, LegacyDataStore $store): JsonResponse
    {
        $property = collect($store->read()['properties'] ?? [])->first(fn (array $item): bool => (string) ($item['id'] ?? '') === $id);
        if (! $property) return response()->json(['error' => 'Property not found.'], 404);
        if (($property['approvalStatus'] ?? '') !== 'Active' || ($property['listingStatus'] ?? 'Active') !== 'Active') {
            return response()->json(['error' => 'Property not found.'], 404);
        }
        return response()->json($property);
    }

    public function mine(Request $request, LegacyDataStore $store): JsonResponse
    {
        $user = $request->attributes->get('legacyUser');
        $properties = array_values(array_filter($store->read()['properties'] ?? [], fn (array $property): bool =>
            ($user['role'] ?? '') === 'Admin'
            || (string) ($property['sellerId'] ?? '') === (string) ($user['id'] ?? '')
            || (string) ($property['agentId'] ?? '') === (string) ($user['id'] ?? '')
        ));
        usort($properties, fn (array $a, array $b): int => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
        return response()->json($properties);
    }

    public function store(Request $request, LegacyDataStore $store): JsonResponse
    {
        $user = $request->attributes->get('legacyUser');
        if (! in_array($user['role'] ?? '', ['User', 'Buyer', 'Seller', 'Agent', 'Admin'], true)) {
            return response()->json(['error' => 'Your account is not allowed to submit a property listing.'], 403);
        }
        $draft = strtolower((string) $request->input('submissionState', $request->input('approvalStatus'))) === 'draft';
        $validated = $request->validate([
            'title' => [$draft ? 'nullable' : 'required', 'string', 'max:500'],
            'city' => [$draft ? 'nullable' : 'required', 'string', 'max:160'],
            'price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $property = $store->mutate(function (array &$data) use ($request, $user, $validated, $draft): array {
            $id = (int) ($data['nextId'] ?? 1000) + 1;
            $data['nextId'] = $id;
            $payload = array_replace($validated, $request->except(['sellerId', 'agentId', 'approvalStatus', 'listingStatus', 'id']));
            $payload['id'] = $id;
            $payload['sellerId'] = ($user['role'] ?? '') === 'Agent' ? null : $user['id'];
            $payload['agentId'] = ($user['role'] ?? '') === 'Agent' ? $user['id'] : null;
            $payload['approvalStatus'] = $draft ? 'Draft' : 'Pending';
            $payload['listingStatus'] = $draft ? 'Draft' : 'Pending';
            $payload['submissionState'] = $draft ? 'draft' : 'submitted';
            $payload['featured'] = false;
            $payload['views'] = 0;
            $payload['inquiryCount'] = 0;
            $payload['createdAt'] = now()->toISOString();
            $payload['updatedAt'] = now()->toISOString();
            $payload['reviewHistory'] = [[
                'action' => $draft ? 'draft_saved' : 'submitted',
                'by' => $user['id'], 'fromStatus' => null,
                'toStatus' => $payload['approvalStatus'], 'createdAt' => now()->toISOString(),
            ]];
            $data['properties'] ??= [];
            $data['properties'][] = $payload;
            return $payload;
        });

        return response()->json($property, 201);
    }

    public function update(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $user = $request->attributes->get('legacyUser');
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:500'],
            'city' => ['sometimes', 'required', 'string', 'max:160'],
            'price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);
        $property = $store->mutate(function (array &$data) use ($id, $request, $user, $validated): ?array {
            foreach ($data['properties'] ?? [] as $index => $candidate) {
                if ((string) ($candidate['id'] ?? '') !== $id) continue;
                if (($user['role'] ?? '') !== 'Admin'
                    && (string) ($candidate['sellerId'] ?? '') !== (string) $user['id']
                    && (string) ($candidate['agentId'] ?? '') !== (string) $user['id']) {
                    return ['_forbidden' => true];
                }
                $merged = array_replace($candidate, $validated, $request->except(['id', 'sellerId', 'agentId', 'approvalStatus', 'listingStatus']));
                if (($user['role'] ?? '') !== 'Admin') {
                    $merged['approvalStatus'] = 'Pending';
                    $merged['listingStatus'] = 'Pending';
                }
                $merged['updatedAt'] = now()->toISOString();
                $data['properties'][$index] = $merged;
                return $merged;
            }
            return null;
        });
        if ($property === null) return response()->json(['error' => 'Property not found.'], 404);
        if (isset($property['_forbidden'])) return response()->json(['error' => 'You are not authorised to edit this property.'], 403);
        return response()->json($property);
    }

    public function destroy(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $user = $request->attributes->get('legacyUser');
        $result = $store->mutate(function (array &$data) use ($id, $user): string {
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;
                if (($user['role'] ?? '') !== 'Admin'
                    && (string) ($property['sellerId'] ?? '') !== (string) $user['id']
                    && (string) ($property['agentId'] ?? '') !== (string) $user['id']) return 'forbidden';
                array_splice($data['properties'], $index, 1);
                return 'deleted';
            }
            return 'missing';
        });
        if ($result === 'missing') return response()->json(['error' => 'Property not found.'], 404);
        if ($result === 'forbidden') return response()->json(['error' => 'You are not authorised to delete this property.'], 403);
        return response()->json(['success' => true]);
    }

    public function setListingStatus(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $validated = $request->validate(['listingStatus' => ['required', 'in:Active,Paused,Sold,Rented']]);
        $user = $request->attributes->get('legacyUser');
        $result = $store->mutate(function (array &$data) use ($id, $validated, $user): array {
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;
                if (($user['role'] ?? '') !== 'Admin'
                    && (string) ($property['sellerId'] ?? '') !== (string) $user['id']
                    && (string) ($property['agentId'] ?? '') !== (string) $user['id']) return ['code' => 403];
                if ($validated['listingStatus'] === 'Active' && ($property['approvalStatus'] ?? '') !== 'Active') return ['code' => 409];
                $property['listingStatus'] = $validated['listingStatus'];
                $property['updatedAt'] = now()->toISOString();
                $data['properties'][$index] = $property;
                return ['code' => 200, 'property' => $property];
            }
            return ['code' => 404];
        });
        if ($result['code'] !== 200) return response()->json(['error' => 'Listing status update is not permitted.'], $result['code']);
        return response()->json($result['property']);
    }

    public function resubmit(string $id, Request $request, LegacyDataStore $store): JsonResponse
    {
        $user = $request->attributes->get('legacyUser');
        $result = $store->mutate(function (array &$data) use ($id, $user): array {
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((string) ($property['id'] ?? '') !== $id) continue;
                if (($user['role'] ?? '') !== 'Admin'
                    && (string) ($property['sellerId'] ?? '') !== (string) $user['id']
                    && (string) ($property['agentId'] ?? '') !== (string) $user['id']) return ['code' => 403];
                $previousStatus = $property['approvalStatus'] ?? 'Rejected';
                $property['approvalStatus'] = 'Pending';
                $property['listingStatus'] = 'Pending';
                $property['submissionState'] = 'submitted';
                $property['changeRequest'] = null;
                $property['rejectionReason'] = null;
                $property['updatedAt'] = now()->toISOString();
                $property['reviewHistory'] ??= [];
                $property['reviewHistory'][] = [
                    'action' => 'resubmitted', 'by' => $user['id'],
                    'fromStatus' => $previousStatus,
                    'toStatus' => 'Pending', 'createdAt' => now()->toISOString(),
                ];
                $data['properties'][$index] = $property;
                return ['code' => 200, 'property' => $property];
            }
            return ['code' => 404];
        });
        if ($result['code'] !== 200) return response()->json(['error' => 'Property could not be resubmitted.'], $result['code']);
        return response()->json(['success' => true, 'property' => $result['property']]);
    }
}
