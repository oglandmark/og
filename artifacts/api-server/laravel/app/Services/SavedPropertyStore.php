<?php

namespace App\Services;

class SavedPropertyStore
{
    /**
     * Return only the property IDs owned by this user from the existing
     * mobile-compatible savedProperties document.
     */
    public static function idsForUser(array $data, string $userId): array
    {
        return collect(self::recordsForUser($data, $userId))
            ->pluck('propertyId')
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (string) $id)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Normalize both the current userId => property ID list and legacy
     * user-owned record lists without treating unscoped IDs as anyone's data.
     */
    public static function recordsForUser(array $data, string $userId): array
    {
        $saved = $data['savedProperties'] ?? [];
        if (!is_array($saved)) {
            return [];
        }

        $records = [];
        if (isset($saved[$userId]) && is_array($saved[$userId])) {
            foreach ($saved[$userId] as $item) {
                $record = is_array($item) ? $item : ['propertyId' => $item];
                $ownerId = $record['userId'] ?? $record['buyerId'] ?? $userId;
                if ((string) $ownerId !== $userId) {
                    continue;
                }

                $propertyId = $record['propertyId'] ?? $record['id'] ?? null;
                if ($propertyId !== null && $propertyId !== '') {
                    $records[] = $record + ['propertyId' => $propertyId, 'userId' => $userId];
                }
            }

            return $records;
        }

        foreach ($saved as $item) {
            if (!is_array($item)) {
                continue;
            }
            $ownerId = $item['userId'] ?? $item['buyerId'] ?? null;
            $propertyId = $item['propertyId'] ?? null;
            if ((string) $ownerId === $userId && $propertyId !== null && $propertyId !== '') {
                $records[] = $item;
            }
        }

        return $records;
    }
}