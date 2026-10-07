<?php

namespace App\Services;

class AccountDataDeletionService
{
    private const OWNERSHIP_FIELDS = [
        'userId', 'ownerId', 'createdBy', 'createdByUserId', 'creatorId',
        'authorId', 'buyerId', 'reporterId', 'submittedBy', 'requesterId',
        'memberUserId',
    ];

    private const REFERENCE_FIELDS = [
        ...self::OWNERSHIP_FIELDS,
        'sellerId', 'agentId', 'developerId', 'authUserId', 'accountId',
        'recipientUserId', 'forUserId', 'assignedAgentId', 'assignedToUserId',
        'targetUserId', 'subjectUserId', 'reportedUserId', 'contactUserId',
        'linkedUserId', 'actorId', 'senderId', 'senderUserId',
    ];

    private const PARTICIPANT_FIELDS = ['participantIds', 'participants', 'userIds'];
    private const USER_MAPS = ['savedProperties', 'notificationPreferences', 'userPreferences'];
    private const MESSAGE_COLLECTIONS = ['messages', 'chatMessages', 'conversationMessages'];

    private const DEVELOPER_OWNED_COLLECTIONS = [
        'developerProjects', 'inventoryBlocks', 'inventoryUnits', 'paymentPlans',
        'developerDocuments', 'developerTeam',
    ];

    private const DEVELOPER_CHILD_COLLECTIONS = [
        'inventoryBlocks', 'inventoryUnits', 'paymentPlans', 'developerDocuments',
        'developerTeam', 'developerLeads', 'developerSiteVisits',
    ];

    private const DEVELOPER_OWNER_FIELDS = [
        ...self::OWNERSHIP_FIELDS, 'developerId', 'sellerId',
    ];

    private const PROPERTY_OWNER_FIELDS = [
        'userId', 'ownerId', 'createdBy', 'createdByUserId', 'sellerId', 'developerId',
    ];

    private const PROPERTY_AGENT_FIELDS = [
        'agentId', 'assignedAgentId', 'listingAgentId', 'contactAgentId',
    ];

    private const PROPERTY_AGENT_DETAILS = [
        'agentName', 'agentEmail', 'agentPhone', 'agentPhoto', 'agentImage',
        'agentProfilePhoto', 'agentCoverPhoto', 'assignedAgentName',
        'assignedAgentEmail', 'assignedAgentPhone', 'contactAgentName',
        'contactAgentEmail', 'contactAgentPhone',
    ];

    /**
     * Remove private records belonging to the account, and unlink its identity
     * from shared records that still belong to other users.
     */
    public function removeFromDocument(array $document, string|int $userId): array
    {
        $targetId = (string) $userId;
        $user = collect($document['users'] ?? [])->first(
            fn ($candidate) => is_array($candidate) && $this->sameId($candidate['id'] ?? null, $targetId),
        );
        $identity = $this->collectIdentity(is_array($user) ? $user : []);

        $ownedProjects = collect($document['developerProjects'] ?? [])
            ->filter(fn ($project) => is_array($project)
                && $this->hasMatchingField($project, self::DEVELOPER_OWNER_FIELDS, $targetId));
        $deletedProjectIds = $ownedProjects
            ->pluck('id')
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (string) $id)
            ->flip()
            ->all();

        $document['users'] = array_values(array_filter(
            is_array($document['users'] ?? null) ? $document['users'] : [],
            fn ($candidate) => !is_array($candidate)
                || !$this->sameId($candidate['id'] ?? null, $targetId),
        ));
        $document['properties'] = $this->cleanProperties(
            $document['properties'] ?? [],
            $targetId,
            $identity,
            $deletedProjectIds,
        );
        $document['conversations'] = $this->cleanConversations(
            $document['conversations'] ?? [],
            $targetId,
            $identity,
        );

        foreach (['mobileAgents', 'cityAgents', 'agents', 'hiddenReactAgents'] as $key) {
            if (!is_array($document[$key] ?? null)) {
                continue;
            }
            $document[$key] = array_values(array_filter(
                $document[$key],
                fn ($item) => !is_array($item)
                    || (
                        !$this->hasMatchingField($item, ['authUserId', 'userId', 'accountId'], $targetId)
                        && !$this->hasMatchingIdentityField($item, $identity)
                    ),
            ));
            $document[$key] = array_map(
                fn ($item) => is_array($item) ? $this->scrubReferences($item, $targetId, $identity) : $item,
                $document[$key],
            );
        }

        foreach (self::USER_MAPS as $key) {
            $collection = $document[$key] ?? null;
            if (!is_array($collection)) {
                continue;
            }
            if (!array_is_list($collection)) {
                unset($collection[$targetId]);
                $document[$key] = $collection;
                continue;
            }
            $document[$key] = array_values(array_map(
                fn ($item) => is_array($item) ? $this->scrubReferences($item, $targetId, $identity) : $item,
                array_filter(
                    $collection,
                    fn ($item) => !is_array($item) || !$this->isOwnedRecord($item, $targetId),
                ),
            ));
        }

        foreach ($document as $key => $items) {
            if (!is_array($items) || !array_is_list($items) || in_array($key, [
                'users', 'properties', 'conversations', 'mobileAgents', 'cityAgents',
                'agents', 'hiddenReactAgents', ...self::USER_MAPS,
            ], true)) {
                continue;
            }

            if ($key === 'notificationEvents') {
                $document[$key] = array_values(array_filter(
                    $items,
                    fn ($event) => !is_string($event) || !str_starts_with($event, $targetId . ':'),
                ));
                continue;
            }

            $document[$key] = array_values(array_filter(array_map(
                function ($item) use ($key, $targetId, $identity, $deletedProjectIds) {
                    if (!is_array($item)) {
                        return $item;
                    }
                    $extraOwnerFields = in_array($key, self::DEVELOPER_OWNED_COLLECTIONS, true)
                        ? ['developerId', 'sellerId']
                        : [];
                    if ($this->isOwnedRecord($item, $targetId, $extraOwnerFields)) {
                        return null;
                    }
                    if (in_array($key, self::MESSAGE_COLLECTIONS, true)
                        && $this->hasMatchingField($item, ['senderId', 'senderUserId', 'authorId'], $targetId)) {
                        return null;
                    }
                    if (in_array($key, ['notifications', 'pushDevices'], true)
                        && $this->hasMatchingField($item, ['recipientUserId', 'forUserId'], $targetId)) {
                        return null;
                    }
                    if (in_array($key, self::DEVELOPER_CHILD_COLLECTIONS, true)
                        && isset($deletedProjectIds[(string) ($item['projectId'] ?? '')])) {
                        return null;
                    }

                    return $this->scrubReferences($item, $targetId, $identity);
                },
                $items,
            ), fn ($item) => $item !== null));
        }

        return $document;
    }

    private function cleanProperties(mixed $properties, string $targetId, array $identity, array $deletedProjectIds): array
    {
        if (!is_array($properties)) {
            return [];
        }

        $cleaned = [];
        foreach ($properties as $property) {
            if (!is_array($property)) {
                $cleaned[] = $property;
                continue;
            }
            if ($this->hasMatchingField($property, self::PROPERTY_OWNER_FIELDS, $targetId)
                || isset($deletedProjectIds[(string) ($property['projectId'] ?? '')])) {
                continue;
            }

            $assignedToDeletedAgent = $this->hasMatchingField($property, self::PROPERTY_AGENT_FIELDS, $targetId);
            $hasOtherOwner = false;
            foreach (self::PROPERTY_OWNER_FIELDS as $field) {
                $value = $property[$field] ?? null;
                if ($value !== null && !$this->sameId($value, $targetId)) {
                    $hasOtherOwner = true;
                    break;
                }
            }
            if ($assignedToDeletedAgent && !$hasOtherOwner) {
                continue;
            }

            $property = $this->scrubReferences($property, $targetId, $identity);
            if ($assignedToDeletedAgent) {
                foreach (self::PROPERTY_AGENT_DETAILS as $field) {
                    unset($property[$field]);
                }
            }
            $cleaned[] = $property;
        }

        return array_values($cleaned);
    }

    private function cleanConversations(mixed $conversations, string $targetId, array $identity): array
    {
        if (!is_array($conversations)) {
            return [];
        }

        $cleaned = [];
        foreach ($conversations as $conversation) {
            if (!is_array($conversation) || !$this->conversationReferencesUser($conversation, $targetId)) {
                $cleaned[] = $conversation;
                continue;
            }

            $primaryParticipants = $conversation['participantIds']
                ?? $conversation['participants']
                ?? $conversation['userIds']
                ?? [];
            $originalParticipants = is_array($primaryParticipants) ? array_values($primaryParticipants) : [];
            $keptIndexes = [];
            foreach ($originalParticipants as $index => $participant) {
                if (!$this->sameId($this->participantId($participant), $targetId)) {
                    $keptIndexes[] = $index;
                }
            }

            foreach (self::PARTICIPANT_FIELDS as $field) {
                if (is_array($conversation[$field] ?? null)) {
                    $conversation[$field] = array_values(array_filter(
                        $conversation[$field],
                        fn ($participant) => !$this->sameId($this->participantId($participant), $targetId),
                    ));
                }
            }

            if (is_array($conversation['participantNames'] ?? null)) {
                if (count($conversation['participantNames']) === count($originalParticipants)
                    && $originalParticipants !== []) {
                    $conversation['participantNames'] = array_map(
                        fn ($index) => $conversation['participantNames'][$index],
                        $keptIndexes,
                    );
                } else {
                    $conversation['participantNames'] = array_values(array_filter(
                        $conversation['participantNames'],
                        fn ($name) => !$this->isPersonalValue('name', $name, $identity),
                    ));
                }
            }

            if (is_array($conversation['messages'] ?? null)) {
                $conversation['messages'] = array_values(array_filter(
                    $conversation['messages'],
                    fn ($message) => !is_array($message)
                        || !$this->hasMatchingField($message, ['senderId', 'senderUserId', 'authorId', 'userId'], $targetId),
                ));
            }

            $conversation = $this->scrubReferences($conversation, $targetId, $identity);
            $remainingParticipants = [];
            foreach (self::PARTICIPANT_FIELDS as $field) {
                foreach (is_array($conversation[$field] ?? null) ? $conversation[$field] : [] as $participant) {
                    $participantId = $this->participantId($participant);
                    if ($participantId !== null && (string) $participantId !== '') {
                        $remainingParticipants[(string) $participantId] = true;
                    }
                }
            }
            foreach (is_array($conversation['messages'] ?? null) ? $conversation['messages'] : [] as $message) {
                if (!is_array($message)) {
                    continue;
                }
                $senderId = $message['senderId'] ?? $message['senderUserId'] ?? $message['authorId'] ?? null;
                if ($senderId !== null) {
                    $remainingParticipants[(string) $senderId] = true;
                }
            }

            if (count($remainingParticipants) < 2 || empty($conversation['messages'])) {
                continue;
            }
            $lastMessage = $conversation['messages'][array_key_last($conversation['messages'])];
            if (is_array($lastMessage)) {
                $conversation['lastMessage'] = $lastMessage['text'] ?? $lastMessage['message'] ?? '';
                $conversation['lastMessageAt'] = $lastMessage['createdAt'] ?? $lastMessage['timestamp'] ?? null;
            }
            $cleaned[] = $conversation;
        }

        return array_values($cleaned);
    }

    private function conversationReferencesUser(array $conversation, string $targetId): bool
    {
        if ($this->hasMatchingField($conversation, self::REFERENCE_FIELDS, $targetId)) {
            return true;
        }
        foreach (self::PARTICIPANT_FIELDS as $field) {
            if ($this->listContainsId($conversation[$field] ?? null, $targetId)) {
                return true;
            }
        }

        foreach (is_array($conversation['messages'] ?? null) ? $conversation['messages'] : [] as $message) {
            if (is_array($message)
                && $this->hasMatchingField($message, ['senderId', 'senderUserId', 'authorId', 'userId'], $targetId)) {
                return true;
            }
        }

        return false;
    }

    private function isOwnedRecord(array $record, string $targetId, array $extraFields = []): bool
    {
        return $this->hasMatchingField($record, [...self::OWNERSHIP_FIELDS, ...$extraFields], $targetId);
    }

    private function hasMatchingField(array $record, array $fields, string $targetId): bool
    {
        foreach ($fields as $field) {
            if (array_key_exists($field, $record) && $this->sameId($record[$field], $targetId)) {
                return true;
            }
        }

        return false;
    }

    private function listContainsId(mixed $value, string $targetId): bool
    {
        if (!is_array($value)) {
            return false;
        }
        foreach ($value as $participant) {
            if ($this->sameId($this->participantId($participant), $targetId)) {
                return true;
            }
        }

        return false;
    }

    private function participantId(mixed $participant): mixed
    {
        if (is_array($participant)) {
            return $participant['id'] ?? $participant['userId'] ?? $participant['accountId'] ?? null;
        }

        return $participant;
    }

    private function sameId(mixed $value, string $targetId): bool
    {
        return is_scalar($value) && (string) $value === $targetId;
    }

    private function collectIdentity(array $user): array
    {
        $exact = [];
        $text = [];
        foreach ([
            $user['name'] ?? null,
            $user['displayName'] ?? null,
            $user['username'] ?? null,
            $user['email'] ?? null,
            $user['phone'] ?? null,
            $user['mobile'] ?? null,
            $user['profilePhoto'] ?? null,
            $user['coverPhoto'] ?? null,
            $user['photo'] ?? null,
        ] as $value) {
            if (is_string($value) && trim($value) !== '') {
                $exact[strtolower(trim($value))] = true;
            }
        }
        foreach ([$user['email'] ?? null, $user['phone'] ?? null, $user['mobile'] ?? null] as $value) {
            if (is_string($value) && trim($value) !== '') {
                $text[] = trim($value);
            }
        }

        return ['exact' => $exact, 'text' => $text];
    }

    private function hasMatchingIdentityField(array $record, array $identity): bool
    {
        foreach (['email', 'phone', 'mobile'] as $field) {
            if ($this->isPersonalValue($field, $record[$field] ?? null, $identity)) {
                return true;
            }
        }

        return false;
    }

    private function isPersonalValue(string $key, mixed $value, array $identity): bool
    {
        $normalized = strtolower((string) preg_replace('/[^a-z0-9]/i', '', $key));
        $isPersonalField = preg_match('/name|email|phone|mobile|username|photo|image|avatar|pushtoken/', $normalized) === 1;

        return $isPersonalField
            && is_string($value)
            && isset($identity['exact'][strtolower(trim($value))]);
    }

    private function scrubReferences(array $record, string $targetId, array $identity): array
    {
        foreach ($record as $key => $value) {
            if (in_array($key, self::REFERENCE_FIELDS, true) && $this->sameId($value, $targetId)) {
                unset($record[$key]);
                continue;
            }
            if ($this->isPersonalValue((string) $key, $value, $identity)) {
                unset($record[$key]);
                continue;
            }
            if (is_array($value)) {
                $normalized = strtolower((string) preg_replace('/[^a-z0-9]/i', '', (string) $key));
                if ($normalized === 'messages') {
                    $value = array_values(array_filter(
                        $value,
                        fn ($message) => !is_array($message)
                            || !$this->hasMatchingField($message, ['senderId', 'senderUserId', 'authorId', 'userId'], $targetId),
                    ));
                } elseif (in_array($normalized, array_map(
                    fn ($field) => strtolower((string) preg_replace('/[^a-z0-9]/i', '', $field)),
                    self::PARTICIPANT_FIELDS,
                ), true)) {
                    $value = array_values(array_filter(
                        $value,
                        fn ($participant) => !$this->sameId($this->participantId($participant), $targetId),
                    ));
                } elseif ($normalized === 'participantnames') {
                    $value = array_values(array_filter(
                        $value,
                        fn ($name) => !$this->isPersonalValue('name', $name, $identity),
                    ));
                }
                $record[$key] = array_is_list($value)
                    ? array_map(
                        fn ($item) => is_array($item)
                            ? $this->scrubReferences($item, $targetId, $identity)
                            : (is_string($item) ? $this->redactKnownText($item, $identity) : $item),
                        $value,
                    )
                    : $this->scrubReferences($value, $targetId, $identity);
                continue;
            }
            if (is_string($value)) {
                $record[$key] = $this->redactKnownText($value, $identity);
            }
        }

        return $record;
    }

    private function redactKnownText(string $value, array $identity): string
    {
        foreach ($identity['text'] as $sensitive) {
            if (str_contains($sensitive, '@')) {
                $value = str_ireplace($sensitive, '[deleted]', $value);
                continue;
            }
            $digits = preg_replace('/\D/', '', $sensitive);
            if (strlen($digits) >= 7) {
                $value = preg_replace('/(?<!\d)' . preg_quote($digits, '/') . '(?!\d)/', '[deleted]', $value) ?? $value;
                $value = preg_replace('/(?<!\d)' . preg_quote($sensitive, '/') . '(?!\d)/', '[deleted]', $value) ?? $value;
            }
        }

        return $value;
    }
}
