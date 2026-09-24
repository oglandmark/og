<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class NotificationDeliveryService
{
    /**
     * Create one durable notification per eligible user and send immediate
     * Expo pushes using the user's registered devices and preferences.
     */
    public function deliver(array &$data, array $recipientIds, array $payload): array
    {
        $this->ensureCollections($data);

        $created = [];
        $userIds = [];
        foreach ($recipientIds as $recipientId) {
            if (!is_numeric($recipientId)) {
                continue;
            }

            $numericId = (float) $recipientId;
            if (!is_finite($numericId) || floor($numericId) !== $numericId) {
                continue;
            }

            $userIds[(string) (int) $numericId] = (int) $numericId;
        }

        foreach ($userIds as $userId) {
            $category = $this->category((string) ($payload['type'] ?? ''), $payload['category'] ?? null);
            $preferences = (array) ($data['notificationPreferences'][(string) $userId] ?? []);
            if (($payload['mandatory'] ?? false) !== true && ($preferences[$category] ?? null) === false) {
                continue;
            }

            $item = $this->createRecord($data, $userId, array_merge($payload, ['category' => $category]));
            if ($item === null) {
                continue;
            }

            $created[] = $item;
            if (($payload['mandatory'] ?? false) === true
                || empty($preferences['frequency'])
                || $preferences['frequency'] === 'immediate') {
                $this->sendExpoPushToUser($data, $userId, $item);
            }
        }

        return $created;
    }

    private function ensureCollections(array &$data): void
    {
        if (!is_array($data['notifications'] ?? null)) {
            $data['notifications'] = [];
        }
        if (!is_array($data['pushDevices'] ?? null)) {
            $data['pushDevices'] = [];
        }
        if (!is_array($data['notificationPreferences'] ?? null)) {
            $data['notificationPreferences'] = [];
        }
        if (!is_array($data['notificationEvents'] ?? null)) {
            $data['notificationEvents'] = [];
        }
    }

    private function category(string $type, mixed $explicitCategory = null): string
    {
        $allowed = ['properties', 'projects', 'announcements', 'promotional', 'account', 'system'];
        if (is_string($explicitCategory) && in_array($explicitCategory, $allowed, true)) {
            return $explicitCategory;
        }

        $type = strtoupper($type);
        if (str_contains($type, 'PROJECT')) {
            return 'projects';
        }
        if (str_contains($type, 'PROPERTY')) {
            return 'properties';
        }
        if (str_contains($type, 'ANNOUNCEMENT')) {
            return $type === 'PROMOTIONAL_ANNOUNCEMENT' ? 'promotional' : 'announcements';
        }
        if (str_contains($type, 'ACCOUNT') || str_contains($type, 'PROFILE') || str_contains($type, 'SECURITY')) {
            return 'account';
        }

        return 'system';
    }

    private function createRecord(array &$data, int $recipientUserId, array $payload): ?array
    {
        $this->ensureCollections($data);
        $type = strtoupper((string) ($payload['type'] ?? 'SYSTEM_UPDATE'));
        $entityType = $payload['entityType'] ?? null;
        $entityId = $payload['entityId'] ?? null;
        $eventName = (string) ($payload['eventKey'] ?? "{$type}:{$entityType}:{$entityId}");
        $eventKey = "{$recipientUserId}:{$eventName}";

        if (in_array($eventKey, $data['notificationEvents'], true)) {
            return null;
        }

        $id = JsonStore::nextId($data);
        $timestamp = now()->toISOString();
        $item = [
            'id' => $id,
            'notificationId' => (string) $id,
            'recipientUserId' => $recipientUserId,
            'userId' => $recipientUserId,
            'type' => $type,
            'category' => $payload['category'],
            'title' => (string) ($payload['title'] ?? 'OG Landmark Update'),
            'message' => (string) ($payload['message'] ?? $payload['body'] ?? ''),
            'body' => (string) ($payload['body'] ?? $payload['message'] ?? ''),
            'imageUrl' => $payload['imageUrl'] ?? null,
            'entityType' => $entityType,
            'entityId' => $entityId,
            'propertyId' => $payload['propertyId'] ?? ($entityType === 'property' ? $entityId : null),
            'projectId' => $payload['projectId'] ?? ($entityType === 'project' ? $entityId : null),
            'announcementId' => $payload['announcementId'] ?? ($entityType === 'announcement' ? $entityId : null),
            'deepLink' => $payload['deepLink'] ?? $payload['actionUrl'] ?? null,
            'actionUrl' => $payload['actionUrl'] ?? $payload['deepLink'] ?? null,
            'priority' => $payload['priority'] ?? 'NORMAL',
            'isRead' => false,
            'read' => false,
            'readAt' => null,
            'userDeletedAt' => null,
            'createdAt' => $timestamp,
            'timestamp' => $timestamp,
            'expiresAt' => $payload['expiresAt'] ?? null,
            'metadata' => $payload['metadata'] ?? [],
            'eventKey' => $eventKey,
            'forPortal' => $payload['forPortal'] ?? null,
        ];

        array_unshift($data['notifications'], $item);
        $data['notificationEvents'][] = $eventKey;
        if (count($data['notificationEvents']) > 10000) {
            $data['notificationEvents'] = array_slice($data['notificationEvents'], -10000);
        }

        return $item;
    }

    private function sendExpoPushToUser(array $data, int $userId, array $item): void
    {
        $tokens = [];
        foreach ($data['pushDevices'] ?? [] as $device) {
            if (!is_array($device)
                || (int) ($device['userId'] ?? 0) !== $userId
                || ($device['isActive'] ?? true) === false) {
                continue;
            }
            $token = (string) ($device['pushToken'] ?? '');
            if (str_starts_with($token, 'ExponentPushToken')) {
                $tokens[$token] = true;
            }
        }

        foreach ($data['users'] ?? [] as $user) {
            if (is_array($user) && (int) ($user['id'] ?? 0) === $userId) {
                $legacyToken = (string) ($user['pushToken'] ?? '');
                if (str_starts_with($legacyToken, 'ExponentPushToken')) {
                    $tokens[$legacyToken] = true;
                }
                break;
            }
        }

        $pushData = [
            'type' => $item['type'],
            'category' => $item['category'],
            'notificationId' => $item['notificationId'],
            'entityType' => $item['entityType'],
            'entityId' => $item['entityId'],
            'propertyId' => $item['propertyId'],
            'projectId' => $item['projectId'],
            'announcementId' => $item['announcementId'],
            'deepLink' => $item['deepLink'],
        ];

        foreach (array_keys($tokens) as $token) {
            try {
                $response = Http::timeout(8)
                    ->acceptJson()
                    ->post('https://exp.host/--/api/v2/push/send', [
                        'to' => $token,
                        'title' => $item['title'],
                        'body' => $item['body'],
                        'data' => $pushData,
                        'channelId' => $item['category'] ?: 'system',
                        'sound' => 'default',
                    ]);

                if ($response->failed()) {
                    Log::warning('Expo push request failed for a scheduled announcement.', [
                        'status' => $response->status(),
                        'notificationId' => $item['notificationId'],
                    ]);
                }
            } catch (Throwable $exception) {
                Log::warning('Expo push request failed for a scheduled announcement.', [
                    'error' => $exception->getMessage(),
                    'notificationId' => $item['notificationId'],
                ]);
            }
        }
    }
}