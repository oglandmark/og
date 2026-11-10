<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LegacyDataStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class UserDashboardController extends Controller
{
    public function account(Request $request, LegacyDataStore $store): JsonResponse
    {
        return response()->json($this->publicUser($this->user($request)));
    }

    public function updateAccount(Request $request, LegacyDataStore $store): JsonResponse
    {
        $values = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'city' => ['nullable', 'string', 'max:100'],
        ]);
        $userId = $this->userId($request);
        $updated = $store->mutate(function (array &$data) use ($userId, $values): ?array {
            foreach ($data['users'] ?? [] as $index => $user) {
                if ((string) ($user['id'] ?? '') !== $userId) continue;
                foreach (['name', 'phone', 'city'] as $key) {
                    $user[$key] = trim((string) ($values[$key] ?? ''));
                }
                $user['updatedAt'] = now()->toIso8601String();
                $data['users'][$index] = $user;
                return $user;
            }
            return null;
        });
        abort_unless($updated, 404, 'Account not found.');
        return response()->json($this->publicUser($updated));
    }

    public function saved(Request $request, string $userId, LegacyDataStore $store): JsonResponse
    {
        abort_unless($userId === $this->userId($request), 403, 'Forbidden.');
        $data = $store->read();
        $values = $data['savedProperties'][$userId] ?? [];
        return response()->json(is_array($values) ? array_values($values) : []);
    }

    public function toggleSaved(Request $request, string $userId, string $propertyId, LegacyDataStore $store): JsonResponse
    {
        abort_unless($userId === $this->userId($request), 403, 'Forbidden.');
        abort_unless(ctype_digit($propertyId) && (int) $propertyId > 0, 404, 'Property not found.');
        $saved = $store->mutate(function (array &$data) use ($userId, $propertyId): bool {
            $property = collect($data['properties'] ?? [])->first(fn (array $item): bool =>
                (int) ($item['id'] ?? 0) === (int) $propertyId && ($item['approvalStatus'] ?? '') === 'Active'
            );
            if (! $property) return false;
            $data['savedProperties'] = is_array($data['savedProperties'] ?? null) ? $data['savedProperties'] : [];
            $ids = array_values(array_map('intval', $data['savedProperties'][$userId] ?? []));
            $id = (int) $propertyId;
            if (in_array($id, $ids, true)) {
                $data['savedProperties'][$userId] = array_values(array_diff($ids, [$id]));
                return false;
            }
            $data['savedProperties'][$userId] = [...$ids, $id];
            return true;
        });
        return response()->json(['saved' => $saved]);
    }

    public function comparison(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        $records = array_values(array_filter($store->read()['comparisons'] ?? [], fn (array $item): bool =>
            (string) ($item['userId'] ?? '') === $userId
        ));
        $ids = [];
        foreach ($records as $record) {
            $ids = [...$ids, ...(is_array($record['propertyIds'] ?? null)
                ? $record['propertyIds']
                : (isset($record['propertyId']) ? [$record['propertyId']] : []))];
        }
        return response()->json(array_slice(array_values(array_unique(array_filter(array_map('intval', $ids)))), -3));
    }

    public function saveComparison(Request $request, LegacyDataStore $store): JsonResponse
    {
        $values = $request->validate(['propertyIds' => ['required', 'array', 'max:3'], 'propertyIds.*' => ['required', 'integer', 'min:1']]);
        $userId = $this->userId($request);
        $ids = array_values(array_unique(array_map('intval', $values['propertyIds'])));
        $store->mutate(function (array &$data) use ($userId, $ids): void {
            $data['comparisons'] = array_values(array_filter($data['comparisons'] ?? [], fn (array $item): bool =>
                (string) ($item['userId'] ?? '') !== $userId
            ));
            if ($ids) {
                $data['comparisons'][] = [
                    'id' => 'comparison_'.$userId,
                    'userId' => is_numeric($userId) ? (int) $userId : $userId,
                    'propertyIds' => $ids,
                    'updatedAt' => now()->toIso8601String(),
                ];
            }
        });
        return response()->json($ids);
    }

    public function clearComparison(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        $store->mutate(fn (array &$data) => $data['comparisons'] = array_values(array_filter(
            $data['comparisons'] ?? [],
            fn (array $item): bool => (string) ($item['userId'] ?? '') !== $userId
        )));
        return response()->json(null, 204);
    }

    public function appointments(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        $items = array_values(array_filter($store->read()['appointments'] ?? [], fn (array $item): bool =>
            (string) ($item['buyerId'] ?? '') === $userId
        ));
        usort($items, fn (array $a, array $b): int => strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? '')));
        return response()->json($items);
    }

    public function requestAppointment(Request $request, LegacyDataStore $store): JsonResponse
    {
        $values = $request->validate([
            'propertyId' => ['required', 'integer', 'min:1'],
            'date' => ['required', 'date', 'after_or_equal:today'],
            'time' => ['required', 'date_format:H:i'],
            'type' => ['nullable', 'string', 'max:40'],
        ]);
        $user = $this->user($request);
        $item = $store->mutate(function (array &$data) use ($values, $user): ?array {
            $property = collect($data['properties'] ?? [])->first(fn (array $row): bool =>
                (int) ($row['id'] ?? 0) === (int) $values['propertyId']
                && ($row['approvalStatus'] ?? '') === 'Active'
                && ($row['listingStatus'] ?? 'Active') === 'Active'
            );
            if (! $property) return null;
            $id = $this->nextId($data);
            $appointment = [
                'id' => $id, 'propertyId' => (int) $values['propertyId'],
                'propertyTitle' => $property['title'] ?? 'Property visit',
                'date' => $values['date'], 'time' => $values['time'],
                'type' => $values['type'] ?? 'Site Visit', 'status' => 'Upcoming',
                'buyerId' => $user['id'], 'sellerId' => $property['sellerId'] ?? null,
                'agentId' => $property['agentId'] ?? null, 'createdAt' => now()->toIso8601String(),
            ];
            $data['appointments'][] = $appointment;
            return $appointment;
        });
        abort_unless($item, 404, 'This property is no longer available.');
        return response()->json($item, 201);
    }

    public function cancelAppointment(Request $request, string $id, LegacyDataStore $store): JsonResponse
    {
        $request->validate(['status' => ['required', 'in:Cancelled,Canceled']]);
        $userId = $this->userId($request);
        $result = $store->mutate(function (array &$data) use ($id, $userId): array {
            foreach ($data['appointments'] ?? [] as $index => $item) {
                if ((string) ($item['id'] ?? '') !== $id) continue;
                if ((string) ($item['buyerId'] ?? '') !== $userId) return ['status' => 403];
                if (preg_match('/cancel|complete|reject/i', (string) ($item['status'] ?? ''))) return ['status' => 409];
                $item['status'] = 'Cancelled';
                $item['updatedAt'] = now()->toIso8601String();
                $data['appointments'][$index] = $item;
                return ['status' => 200, 'item' => $item];
            }
            return ['status' => 404];
        });
        if ($result['status'] !== 200) return response()->json(['error' => 'Appointment could not be cancelled.'], $result['status']);
        return response()->json($result['item']);
    }

    public function offers(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        return response()->json(array_values(array_filter($store->read()['offers'] ?? [], fn (array $item): bool =>
            (string) ($item['buyerId'] ?? '') === $userId
        )));
    }

    public function inquiries(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        return response()->json(array_values(array_filter($store->read()['inquiries'] ?? [], fn (array $item): bool =>
            (string) ($item['buyerId'] ?? '') === $userId
        )));
    }

    public function submitInquiry(Request $request, LegacyDataStore $store): JsonResponse
    {
        $values = $request->validate([
            'propertyId' => ['required', 'integer', 'min:1'],
            'clientName' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:180'],
            'phone' => ['required', 'string', 'max:40'],
            'message' => ['required', 'string', 'max:5000'],
        ]);
        $user = $this->user($request);
        $item = $store->mutate(function (array &$data) use ($values, $user): ?array {
            $propertyIndex = null;
            foreach ($data['properties'] ?? [] as $index => $property) {
                if ((int) ($property['id'] ?? 0) === (int) $values['propertyId']) {
                    $propertyIndex = $index;
                    break;
                }
            }
            if ($propertyIndex === null) return null;

            $property = $data['properties'][$propertyIndex];
            $item = [
                'id' => $this->nextId($data),
                'date' => now()->toDateString(),
                'status' => 'Pending',
                'reply' => null,
                'replyDate' => null,
                'propertyId' => (int) $values['propertyId'],
                'propertyTitle' => $property['title'] ?? 'Property inquiry',
                'clientName' => trim($values['clientName']),
                'buyerName' => $user['name'] ?? trim($values['clientName']),
                'email' => $values['email'] ?? null,
                'phone' => trim($values['phone']),
                'message' => trim($values['message']),
                'buyerId' => $user['id'],
                'sellerId' => $property['sellerId'] ?? null,
                'agentId' => $property['agentId'] ?? null,
            ];
            $data['inquiries'] = is_array($data['inquiries'] ?? null) ? $data['inquiries'] : [];
            $data['inquiries'][] = $item;
            $data['properties'][$propertyIndex]['inquiryCount'] =
                (int) ($property['inquiryCount'] ?? 0) + 1;
            return $item;
        });
        abort_unless($item, 404, 'This property is no longer available.');
        return response()->json($item, 201);
    }

    public function notifications(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        return response()->json(array_values(array_filter($store->read()['notifications'] ?? [], fn (array $item): bool =>
            (string) ($item['userId'] ?? $item['recipientId'] ?? '') === $userId
        )));
    }

    public function markNotificationRead(Request $request, string $id, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        $item = $store->mutate(function (array &$data) use ($id, $userId): ?array {
            foreach ($data['notifications'] ?? [] as $index => $notification) {
                if ((string) ($notification['id'] ?? '') !== $id) continue;
                if ((string) ($notification['userId'] ?? $notification['recipientId'] ?? '') !== $userId) return null;
                $notification['read'] = true;
                $notification['isRead'] = true;
                $notification['readAt'] = now()->toIso8601String();
                $data['notifications'][$index] = $notification;
                return $notification;
            }
            return null;
        });
        abort_unless($item, 404, 'Notification not found.');
        return response()->json($item);
    }

    public function notificationPreferences(Request $request, LegacyDataStore $store): JsonResponse
    {
        $data = $store->read();
        $preferences = $data['notificationPreferences'][$this->userId($request)] ?? [];
        return response()->json(array_merge([
            'properties' => true, 'projects' => true, 'announcements' => true,
            'promotional' => true, 'account' => true, 'system' => true, 'frequency' => 'immediate',
        ], is_array($preferences) ? $preferences : []));
    }

    public function updateNotificationPreferences(Request $request, LegacyDataStore $store): JsonResponse
    {
        $values = $request->validate([
            'properties' => ['sometimes', 'boolean'], 'projects' => ['sometimes', 'boolean'],
            'announcements' => ['sometimes', 'boolean'], 'promotional' => ['sometimes', 'boolean'],
            'account' => ['sometimes', 'boolean'], 'system' => ['sometimes', 'boolean'],
            'propertyAlerts' => ['sometimes', 'boolean'], 'newProjects' => ['sometimes', 'boolean'],
            'frequency' => ['sometimes', 'in:immediate,daily,weekly'],
            'cities' => ['sometimes', 'array', 'max:30'], 'cities.*' => ['string', 'max:100'],
            'propertyTypes' => ['sometimes', 'array', 'max:20'], 'propertyTypes.*' => ['string', 'max:100'],
        ]);
        $userId = $this->userId($request);
        $preferences = $store->mutate(function (array &$data) use ($userId, $values): array {
            $data['notificationPreferences'] = is_array($data['notificationPreferences'] ?? null) ? $data['notificationPreferences'] : [];
            $data['notificationPreferences'][$userId] = array_merge(
                $data['notificationPreferences'][$userId] ?? [],
                $values
            );
            return $data['notificationPreferences'][$userId];
        });
        return response()->json($preferences);
    }

    public function savedSearches(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        return response()->json(array_values(array_filter($store->read()['savedSearches'] ?? [], fn (array $item): bool =>
            (string) ($item['userId'] ?? '') === $userId
        )));
    }

    public function createSavedSearch(Request $request, LegacyDataStore $store): JsonResponse
    {
        $values = $request->validate([
            'label' => ['required', 'string', 'max:80'],
            'query' => ['required', 'string', 'max:200'],
            'filters' => ['nullable', 'array'],
        ]);
        $user = $this->user($request);
        $item = $store->mutate(function (array &$data) use ($values, $user): array {
            $data['savedSearches'] = is_array($data['savedSearches'] ?? null) ? $data['savedSearches'] : [];
            $item = [
                ...$values, 'id' => 'search_'.bin2hex(random_bytes(10)),
                'userId' => $user['id'], 'savedAt' => now()->toIso8601String(),
            ];
            $data['savedSearches'][] = $item;
            return $item;
        });
        return response()->json($item, 201);
    }

    public function deleteSavedSearch(Request $request, string $id, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        $deleted = $store->mutate(function (array &$data) use ($id, $userId): bool {
            $before = $data['savedSearches'] ?? [];
            $data['savedSearches'] = array_values(array_filter($before, fn (array $item): bool =>
                ! ((string) ($item['id'] ?? '') === $id && (string) ($item['userId'] ?? '') === $userId)
            ));
            return count($data['savedSearches']) < count($before);
        });
        abort_unless($deleted, 404, 'Saved search not found.');
        return response()->json(null, 204);
    }

    public function visitHistory(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        return response()->json(array_values(array_filter($store->read()['visitHistory'] ?? [], fn (array $item): bool =>
            (string) ($item['userId'] ?? '') === $userId
        )));
    }

    public function conversations(Request $request, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        $items = array_values(array_filter($store->read()['conversations'] ?? [], fn (array $item): bool =>
            $this->isParticipant($item, $userId)
        ));
        usort($items, fn (array $a, array $b): int => strcmp(
            (string) ($b['lastUpdated'] ?? $b['lastMessageAt'] ?? $b['createdAt'] ?? ''),
            (string) ($a['lastUpdated'] ?? $a['lastMessageAt'] ?? $a['createdAt'] ?? '')
        ));
        return response()->json($items);
    }

    public function messages(Request $request, string $id, LegacyDataStore $store): JsonResponse
    {
        $userId = $this->userId($request);
        $conversation = collect($store->read()['conversations'] ?? [])->first(fn (array $item): bool =>
            (string) ($item['id'] ?? '') === $id
        );
        abort_unless($conversation, 404, 'Conversation not found.');
        abort_unless($this->isParticipant($conversation, $userId), 403, 'Forbidden.');
        $messages = array_map(fn (array $message): array => [
            ...$message,
            'conversationId' => $conversation['id'],
            'createdAt' => $message['createdAt'] ?? $message['timestamp'] ?? null,
        ], $conversation['messages'] ?? []);
        return response()->json($messages);
    }

    public function sendMessage(Request $request, string $id, LegacyDataStore $store): JsonResponse
    {
        $values = $request->validate(['text' => ['required', 'string', 'max:2000']]);
        $user = $this->user($request);
        $result = $store->mutate(function (array &$data) use ($id, $values, $user): array {
            foreach ($data['conversations'] ?? [] as $index => $conversation) {
                if ((string) ($conversation['id'] ?? '') !== $id) continue;
                if (! $this->isParticipant($conversation, (string) $user['id'])) return ['status' => 403];
                $message = [
                    'id' => $this->nextId($data),
                    'conversationId' => $conversation['id'],
                    'senderId' => $user['id'],
                    'senderName' => $user['name'] ?? 'User',
                    'text' => trim($values['text']),
                    'createdAt' => now()->toIso8601String(),
                ];
                $conversation['messages'] = is_array($conversation['messages'] ?? null) ? $conversation['messages'] : [];
                $conversation['messages'][] = $message;
                $conversation['lastMessage'] = $message['text'];
                $conversation['lastMessageAt'] = $message['createdAt'];
                $conversation['lastUpdated'] = $message['createdAt'];
                $data['conversations'][$index] = $conversation;
                return ['status' => 201, 'message' => $message];
            }
            return ['status' => 404];
        });
        if ($result['status'] !== 201) return response()->json(['error' => 'Conversation not found or access denied.'], $result['status']);
        return response()->json($result['message'], 201);
    }

    private function isParticipant(array $conversation, string $userId): bool
    {
        foreach ($conversation['participants'] ?? [] as $participant) {
            if ((string) $participant === $userId) return true;
        }
        return false;
    }

    private function user(Request $request): array
    {
        return (array) $request->attributes->get('legacyUser', []);
    }

    private function userId(Request $request): string
    {
        return (string) ($this->user($request)['id'] ?? '');
    }

    private function publicUser(array $user): array
    {
        unset($user['password'], $user['passwordResetToken'], $user['verificationCode']);
        return $user;
    }

    private function nextId(array &$data): int
    {
        $next = max((int) ($data['nextId'] ?? 1), 1);
        $data['nextId'] = $next + 1;
        return $next;
    }
}
