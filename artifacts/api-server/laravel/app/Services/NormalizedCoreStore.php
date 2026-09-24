<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * Relational projection for OG Landmark's users, properties, agents and media.
 *
 * app_data remains a compatibility/rollback copy. Once the one-time
 * normalization command activates this store, API reads use these tables and
 * writes update both representations in the same database transaction.
 */
class NormalizedCoreStore
{
    public const STATE_KEY = 'core-entities-v1';

    private const COLLECTIONS = ['users', 'properties', 'mobileAgents', 'cityAgents'];

    public function isActive(): bool
    {
        if (!Schema::hasTable('normalization_state')) {
            return false;
        }

        return DB::table('normalization_state')
            ->where('state_key', self::STATE_KEY)
            ->exists();
    }

    public function hydrate(array $document): array
    {
        $document['users'] = $this->readPayloads('app_users', 'position');
        $document['properties'] = $this->readPayloads('properties', 'position');
        $document['mobileAgents'] = $this->readAgentPayloads('mobileAgents');
        $document['cityAgents'] = $this->readAgentPayloads('cityAgents');

        return $document;
    }

    /**
     * Copy the legacy collections into empty normalized tables.
     *
     * This method never modifies app_data. The caller should hold the
     * app_data row lock and wrap the operation in a database transaction.
     */
    public function migrateFromLegacy(array $document, bool $dryRun = false): array
    {
        if ($this->isActive()) {
            return [
                'alreadyActive' => true,
                'counts' => $this->currentCounts(),
                'checksum' => (string) DB::table('normalization_state')
                    ->where('state_key', self::STATE_KEY)
                    ->value('source_checksum'),
            ];
        }

        $this->assertProjectionTablesEmpty();
        $projection = $this->buildProjection($document);
        $counts = $this->counts($projection);
        $checksum = $this->checksum($document);

        if ($dryRun) {
            return ['dryRun' => true, 'counts' => $counts, 'checksum' => $checksum];
        }

        $this->insertProjection($projection);
        $this->assertRoundTrip($document);

        DB::table('normalization_state')->insert([
            'state_key' => self::STATE_KEY,
            'source_checksum' => $checksum,
            'counts' => $this->encode($counts),
            'activated_at' => now(),
            'updated_at' => now(),
        ]);

        return ['dryRun' => false, 'counts' => $counts, 'checksum' => $checksum];
    }

    /**
     * Keep normalized tables and the app_data rollback copy in sync.
     */
    public function sync(array $document): void
    {
        $projection = $this->buildProjection($document);
        $this->upsertProjection($projection);
        $counts = $this->counts($projection);

        DB::table('normalization_state')
            ->where('state_key', self::STATE_KEY)
            ->update([
                'source_checksum' => $this->checksum($document),
                'counts' => $this->encode($counts),
                'updated_at' => now(),
            ]);
    }

    private function buildProjection(array $document): array
    {
        $users = $this->collection($document, 'users');
        $properties = $this->collection($document, 'properties');
        $mobileAgents = $this->collection($document, 'mobileAgents');
        $cityAgents = $this->collection($document, 'cityAgents');

        $userRows = [];
        $propertyRows = [];
        $agentRows = [];
        $mediaRows = [];
        $now = now();

        foreach ($users as $position => $user) {
            $id = $this->numericId($user, 'users', $position);
            $userRows[] = [
                'id' => $id,
                'position' => $position,
                'name' => $this->text($user['name'] ?? null, 255),
                'email' => $this->text($user['email'] ?? null, 320),
                'username' => $this->text($user['username'] ?? null, 191),
                'phone' => $this->text($user['phone'] ?? null, 96),
                'city' => $this->text($user['city'] ?? null, 191),
                'role' => $this->text($user['role'] ?? null, 64),
                'status' => $this->text($user['status'] ?? null, 64),
                'password_hash' => $this->text($user['password'] ?? null, 255),
                'profile_photo_url' => $this->text($user['profilePhoto'] ?? $user['photo'] ?? null),
                'cover_photo_url' => $this->text($user['coverPhoto'] ?? null),
                'payload' => $this->encode($user),
                'created_at' => $now,
                'updated_at' => $now,
            ];
            array_push($mediaRows, ...$this->mediaRows('users', (string) $id, $user, $now));
        }
        $this->assertUniqueNumericIds($userRows, 'users');

        foreach ($properties as $position => $property) {
            $id = $this->numericId($property, 'properties', $position);
            $price = $property['price'] ?? null;
            $propertyRows[] = [
                'id' => $id,
                'position' => $position,
                'seller_id' => $this->text($property['sellerId'] ?? $property['userId'] ?? null, 191),
                'title' => $this->text($property['title'] ?? $property['name'] ?? null, 255),
                'city' => $this->text($property['city'] ?? null, 191),
                'property_type' => $this->text($property['type'] ?? null, 100),
                'purpose' => $this->text($property['purpose'] ?? null, 64),
                'approval_status' => $this->text($property['approvalStatus'] ?? null, 64),
                'listing_status' => $this->text($property['listingStatus'] ?? null, 64),
                'price_value' => is_numeric($price) ? (string) $price : null,
                'payload' => $this->encode($property),
                'created_at' => $now,
                'updated_at' => $now,
            ];
            array_push($mediaRows, ...$this->mediaRows('properties', (string) $id, $property, $now));
        }
        $this->assertUniqueNumericIds($propertyRows, 'properties');

        foreach ([
            'mobileAgents' => $mobileAgents,
            'cityAgents' => $cityAgents,
        ] as $directory => $agents) {
            $seenIds = [];
            foreach ($agents as $position => $agent) {
                $legacyId = $this->legacyAgentId($agent, $position);
                $uniqueKey = $directory . ':' . $legacyId;
                if (isset($seenIds[$uniqueKey])) {
                    throw new RuntimeException("Duplicate agent id in {$directory}: {$legacyId}");
                }
                $seenIds[$uniqueKey] = true;

                $agentRows[] = [
                    'directory' => $directory,
                    'legacy_id' => $legacyId,
                    'position' => $position,
                    'name' => $this->text($agent['displayName'] ?? $agent['name'] ?? null, 255),
                    'city' => $this->text($agent['city'] ?? null, 191),
                    'phone' => $this->text($agent['phone'] ?? null, 96),
                    'status' => $this->text($agent['status'] ?? null, 64),
                    'profile_photo_url' => $this->text($agent['profilePhoto'] ?? $agent['photo'] ?? null),
                    'cover_photo_url' => $this->text($agent['coverPhoto'] ?? null),
                    'payload' => $this->encode($agent),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                array_push($mediaRows, ...$this->mediaRows($directory, $legacyId, $agent, $now));
            }
        }

        return [
            'users' => $userRows,
            'properties' => $propertyRows,
            'agents' => $agentRows,
            'media' => $mediaRows,
            'source' => [
                'users' => $users,
                'properties' => $properties,
                'mobileAgents' => $mobileAgents,
                'cityAgents' => $cityAgents,
            ],
        ];
    }

    private function insertProjection(array $projection): void
    {
        foreach (['users' => 'app_users', 'properties' => 'properties', 'agents' => 'agents'] as $key => $table) {
            foreach (array_chunk($projection[$key], 500) as $chunk) {
                if ($chunk !== []) {
                    DB::table($table)->insert($chunk);
                }
            }
        }

        foreach (array_chunk($projection['media'], 500) as $chunk) {
            if ($chunk !== []) {
                DB::table('media_assets')->insert($chunk);
            }
        }
    }

    private function upsertProjection(array $projection): void
    {
        $this->upsertRows('app_users', $projection['users'], ['id']);
        $this->upsertRows('properties', $projection['properties'], ['id']);
        $this->upsertRows('agents', $projection['agents'], ['directory', 'legacy_id']);

        $this->deleteMissing('app_users', 'id', array_column($projection['users'], 'id'));
        $this->deleteMissing('properties', 'id', array_column($projection['properties'], 'id'));
        foreach (['mobileAgents', 'cityAgents'] as $directory) {
            $ids = array_column(
                array_values(array_filter($projection['agents'], fn (array $row): bool => $row['directory'] === $directory)),
                'legacy_id',
            );
            $query = DB::table('agents')->where('directory', $directory);
            if ($ids === []) {
                $query->delete();
            } else {
                $query->whereNotIn('legacy_id', $ids)->delete();
            }
        }

        DB::table('media_assets')->delete();
        foreach (array_chunk($projection['media'], 500) as $chunk) {
            if ($chunk !== []) {
                DB::table('media_assets')->insert($chunk);
            }
        }
    }

    private function upsertRows(string $table, array $rows, array $uniqueBy): void
    {
        foreach (array_chunk($rows, 500) as $chunk) {
            if ($chunk === []) {
                continue;
            }

            $updateColumns = array_values(array_diff(array_keys($chunk[0]), $uniqueBy));
            DB::table($table)->upsert($chunk, $uniqueBy, $updateColumns);
        }
    }

    private function deleteMissing(string $table, string $column, array $ids): void
    {
        $query = DB::table($table);
        if ($ids === []) {
            $query->delete();
            return;
        }

        $query->whereNotIn($column, $ids)->delete();
    }

    private function assertProjectionTablesEmpty(): void
    {
        foreach (['app_users', 'properties', 'agents', 'media_assets'] as $table) {
            if (DB::table($table)->exists()) {
                throw new RuntimeException(
                    "Refusing to normalize: {$table} already contains rows and no normalization marker exists.",
                );
            }
        }
    }

    private function assertRoundTrip(array $source): void
    {
        $expected = [
            'users' => $this->collection($source, 'users'),
            'properties' => $this->collection($source, 'properties'),
            'mobileAgents' => $this->collection($source, 'mobileAgents'),
            'cityAgents' => $this->collection($source, 'cityAgents'),
        ];
        $actual = [
            'users' => $this->readPayloads('app_users', 'position'),
            'properties' => $this->readPayloads('properties', 'position'),
            'mobileAgents' => $this->readAgentPayloads('mobileAgents'),
            'cityAgents' => $this->readAgentPayloads('cityAgents'),
        ];

        foreach (self::COLLECTIONS as $collection) {
            if ($this->canonicalJson($expected[$collection]) !== $this->canonicalJson($actual[$collection])) {
                throw new RuntimeException("Normalized {$collection} data did not match the source document.");
            }
        }
    }

    private function readPayloads(string $table, string $orderColumn): array
    {
        return DB::table($table)->orderBy($orderColumn)->orderBy('id')->get(['payload'])
            ->map(fn ($row): array => $this->decodePayload($row->payload, $table))
            ->all();
    }

    private function readAgentPayloads(string $directory): array
    {
        return DB::table('agents')->where('directory', $directory)->orderBy('position')->orderBy('legacy_id')->get(['payload'])
            ->map(fn ($row): array => $this->decodePayload($row->payload, $directory))
            ->all();
    }

    private function decodePayload(string $payload, string $source): array
    {
        $decoded = json_decode($payload, true);
        if (!is_array($decoded)) {
            throw new RuntimeException("Invalid normalized payload found in {$source}.");
        }

        return $decoded;
    }

    private function mediaRows(string $collection, string $ownerId, array $entity, $timestamp): array
    {
        $rows = [];
        $position = 0;
        $walk = function (mixed $value, array $path = [], bool $insideMedia = false, string $mediaHint = '') use (&$walk, &$rows, &$position, $collection, $ownerId, $timestamp): void {
            if (is_array($value)) {
                foreach ($value as $key => $child) {
                    $keyString = (string) $key;
                    $lowerKey = strtolower($keyString);
                    $keyLooksMedia = preg_match('/image|photo|video|avatar|thumbnail|media/', $lowerKey) === 1;
                    $container = $insideMedia || in_array($lowerKey, ['images', 'photos', 'videos', 'media', 'gallery'], true);
                    $hint = $keyLooksMedia ? $lowerKey : $mediaHint;
                    $walk($child, [...$path, $keyString], $container, $hint);
                }
                return;
            }

            if (!is_string($value) || trim($value) === '') {
                return;
            }

            $lastKey = strtolower((string) end($path));
            $isUrlField = in_array($lastKey, ['url', 'uri', 'src', 'path'], true);
            $fieldLooksMedia = preg_match('/image|photo|video|avatar|thumbnail|media/', implode('.', $path)) === 1;
            if (!$fieldLooksMedia && !($insideMedia && $isUrlField)) {
                return;
            }

            $url = trim($value);
            if (!$this->looksLikeMediaUrl($url)) {
                return;
            }

            $pathPart = strtolower((string) (parse_url($url, PHP_URL_PATH) ?: $url));
            $isVideo = str_contains($mediaHint, 'video')
                || preg_match('/\.(mp4|mov|m4v|webm|avi)(?:$|\/)/i', $pathPart) === 1;
            $rows[] = [
                'owner_type' => $collection,
                'owner_id' => $ownerId,
                'field_path' => implode('.', $path),
                'media_type' => $isVideo ? 'video' : 'image',
                'position' => $position++,
                'url' => $url,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        };

        $walk($entity);

        return $rows;
    }

    private function looksLikeMediaUrl(string $value): bool
    {
        if (preg_match('/^(https?:\/\/|\/)/i', $value) === 1) {
            return true;
        }

        return preg_match('/\.(jpe?g|png|webp|gif|mp4|mov|m4v|webm|avi)(?:[?#].*)?$/i', $value) === 1;
    }

    private function collection(array $document, string $key): array
    {
        if (!array_key_exists($key, $document)) {
            return [];
        }
        if (!is_array($document[$key])) {
            throw new RuntimeException("Legacy {$key} collection is not a JSON array.");
        }

        return array_values($document[$key]);
    }

    private function numericId(array $record, string $collection, int $position): int
    {
        $value = $record['id'] ?? null;
        if (!is_numeric($value) || !is_finite((float) $value) || floor((float) $value) !== (float) $value || (float) $value < 0 || (float) $value > PHP_INT_MAX) {
            throw new RuntimeException("Invalid or missing numeric id in {$collection} at position {$position}.");
        }

        return (int) $value;
    }

    private function assertUniqueNumericIds(array $rows, string $collection): void
    {
        $seen = [];
        foreach ($rows as $row) {
            $id = (string) $row['id'];
            if (isset($seen[$id])) {
                throw new RuntimeException("Duplicate id {$id} in {$collection}.");
            }
            $seen[$id] = true;
        }
    }

    private function legacyAgentId(array $agent, int $position): string
    {
        $id = $agent['id'] ?? "row-{$position}";
        if (!is_scalar($id)) {
            $id = "row-{$position}";
        }
        $id = trim((string) $id);
        if ($id === '') {
            $id = "row-{$position}";
        }

        return strlen($id) <= 191 ? $id : 'sha256:' . hash('sha256', $id);
    }

    private function text(mixed $value, ?int $limit = null): ?string
    {
        if (!is_scalar($value)) {
            return null;
        }
        $text = (string) $value;

        return $limit === null || strlen($text) <= $limit ? $text : substr($text, 0, $limit);
    }

    private function encode(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private function checksum(array $document): string
    {
        $core = [];
        foreach (self::COLLECTIONS as $collection) {
            $core[$collection] = $this->collection($document, $collection);
        }

        return hash('sha256', $this->encode($core));
    }

    private function canonicalJson(mixed $value): string
    {
        $canonicalize = function (mixed $candidate) use (&$canonicalize): mixed {
            if (!is_array($candidate)) {
                return $candidate;
            }

            if (array_is_list($candidate)) {
                return array_map($canonicalize, $candidate);
            }

            ksort($candidate);
            foreach ($candidate as $key => $child) {
                $candidate[$key] = $canonicalize($child);
            }

            return $candidate;
        };

        return $this->encode($canonicalize($value));
    }

    private function counts(array $projection): array
    {
        return [
            'users' => count($projection['users']),
            'properties' => count($projection['properties']),
            'mobileAgents' => count(array_filter($projection['agents'], fn (array $row): bool => $row['directory'] === 'mobileAgents')),
            'cityAgents' => count(array_filter($projection['agents'], fn (array $row): bool => $row['directory'] === 'cityAgents')),
            'mediaAssets' => count($projection['media']),
        ];
    }

    private function currentCounts(): array
    {
        return [
            'users' => DB::table('app_users')->count(),
            'properties' => DB::table('properties')->count(),
            'mobileAgents' => DB::table('agents')->where('directory', 'mobileAgents')->count(),
            'cityAgents' => DB::table('agents')->where('directory', 'cityAgents')->count(),
            'mediaAssets' => DB::table('media_assets')->count(),
        ];
    }
}