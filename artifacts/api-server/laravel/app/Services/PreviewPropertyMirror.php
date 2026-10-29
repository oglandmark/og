<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class PreviewPropertyMirror
{
    private const LIVE_API = 'https://www.oglandmark.com/api/properties';

    public function syncIfStale(LegacyDataStore $store): void
    {
        if (
            config('app.env') !== 'local'
            || getenv('APP_ENV') === 'testing'
            || defined('PHPUNIT_COMPOSER_INSTALL')
        ) return;
        $this->sync($store);
    }

    public function sync(LegacyDataStore $store): void
    {
        if (config('app.env') !== 'local') return;
        $data = $store->read();
        $lastSync = strtotime((string) ($data['previewPropertiesSyncedAt'] ?? ''));
        if ($lastSync && $lastSync > now()->subMinutes(10)->timestamp) return;

        try {
            $properties = [];
            for ($offset = 0; $offset < 2000; $offset += 100) {
                $response = Http::acceptJson()->timeout(12)->get(self::LIVE_API, [
                    'limit' => 100, 'offset' => $offset,
                ]);
                if (! $response->successful()) {
                    Log::warning('Preview property mirror could not fetch public listings.', ['status' => $response->status()]);
                    return;
                }
                $payload = $response->json();
                $rows = $this->rows($payload);
                if ($rows === null) return;
                $properties = [...$properties, ...$rows];
                $total = is_array($payload) ? (int) ($payload['total'] ?? $payload['meta']['total'] ?? 0) : 0;
                if (count($rows) < 100 || ($total > 0 && $offset + count($rows) >= $total)) break;
            }

            $store->mutate(function (array &$local) use ($properties): void {
                $local['properties'] ??= [];
                $known = array_fill_keys(array_map('strval', $local['previewImportedPropertyIds'] ?? []), true);
                $localIds = array_fill_keys(array_map(
                    fn (array $property) => (string) ($property['id'] ?? ''),
                    $local['properties']
                ), true);
                foreach ($properties as $property) {
                    if (! is_array($property) || ! isset($property['id'])) continue;
                    $id = (string) $property['id'];
                    if (isset($known[$id])) continue;
                    foreach (['images', 'coverImage', 'videoUrl'] as $field) {
                        if (is_string($property[$field] ?? null)) {
                            $property[$field] = $this->absoluteMedia($property[$field]);
                        } elseif ($field === 'images' && is_array($property[$field] ?? null)) {
                            $property[$field] = array_map(
                                fn ($url) => is_string($url) ? $this->absoluteMedia($url) : $url,
                                $property[$field]
                            );
                        }
                    }
                    if (! isset($localIds[$id])) $local['properties'][] = $property;
                    $known[$id] = true;
                    $localIds[$id] = true;
                }
                $local['previewImportedPropertyIds'] = array_keys($known);
                $local['previewPropertiesSyncedAt'] = now()->toIso8601String();
            });
        } catch (\Throwable $error) {
            Log::warning('Preview property mirror sync failed.', ['message' => $error->getMessage()]);
        }
    }

    private function rows(mixed $payload): ?array
    {
        if (! is_array($payload)) return null;
        foreach (['items', 'properties', 'data', 'results'] as $key) {
            if (isset($payload[$key]) && is_array($payload[$key])) return $payload[$key];
        }
        return array_is_list($payload) ? $payload : null;
    }

    private function absoluteMedia(string $url): string
    {
        if (preg_match('/^https?:\/\//i', $url) || str_starts_with($url, '//')) return $url;
        return 'https://www.oglandmark.com/' . ltrim($url, '/');
    }
}
