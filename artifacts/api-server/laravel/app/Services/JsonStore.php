<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Compatibility repository for the existing OG Landmark data contract.
 *
 * The current production database stores the canonical application document
 * in app_data(id=1). Keeping that contract during the Laravel cutover makes
 * the migration non-destructive and lets the web and mobile clients switch
 * runtimes without a data rewrite.
 */
class JsonStore
{
    private static ?array $cache = null;

    /**
     * Clear the in-process document cache between isolated database fixtures.
     */
    public static function reset(): void
    {
        self::$cache = null;
    }

    public static function read(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        try {
            $row = DB::table('app_data')->where('id', 1)->first();
            if ($row && $row->data) {
                $decoded = json_decode((string) $row->data, true);
                if (is_array($decoded)) {
                    return self::$cache = $decoded;
                }
            }
        } catch (\Throwable $exception) {
            if (app()->environment('production')) {
                Log::error('OG Landmark MySQL document unavailable in production.', [
                    'error' => $exception->getMessage(),
                ]);
                throw new \RuntimeException('Canonical OG Landmark data is unavailable.', 0, $exception);
            }
            Log::warning('OG Landmark MySQL document unavailable; using local fallback.', [
                'error' => $exception->getMessage(),
            ]);
        }

        $fallback = storage_path('app/runtime-data.json');
        if (is_file($fallback)) {
            $decoded = json_decode((string) file_get_contents($fallback), true);
            if (is_array($decoded)) {
                return self::$cache = $decoded;
            }
        }

        if (app()->environment('production')) {
            throw new \RuntimeException('Canonical OG Landmark data is missing.');
        }

        return self::$cache = [
            'properties' => [],
            'users' => [],
            'inquiries' => [],
            'offers' => [],
            'appointments' => [],
            'conversations' => [],
            'notifications' => [],
            'blogPosts' => [],
            'savedProperties' => [],
            'savedSearches' => [],
            'mobileAgents' => [],
            'cityAgents' => [],
            'nextId' => 1,
        ];
    }

    public static function write(array $data): array
    {
        self::$cache = $data;
        $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        try {
            DB::table('app_data')->updateOrInsert(
                ['id' => 1],
                ['data' => $json, 'updated_at' => now()],
            );
        } catch (\Throwable $exception) {
            if (app()->environment('production')) {
                Log::error('OG Landmark MySQL document write failed in production.', [
                    'error' => $exception->getMessage(),
                ]);
                throw new \RuntimeException('Canonical OG Landmark data could not be written.', 0, $exception);
            }
            Log::warning('OG Landmark MySQL document write failed; writing local fallback.', [
                'error' => $exception->getMessage(),
            ]);
            $fallback = storage_path('app/runtime-data.json');
            if (!is_dir(dirname($fallback))) {
                mkdir(dirname($fallback), 0775, true);
            }
            file_put_contents($fallback, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        return $data;
    }

    public static function mutate(callable $callback): array
    {
        $data = self::read();
        $result = $callback($data);
        return self::write(is_array($result) ? $result : $data);
    }

    public static function nextId(array &$data, string $prefix = ''): int|string
    {
        $next = max(1, (int) ($data['nextId'] ?? 1));
        $data['nextId'] = $next + 1;
        return $prefix === '' ? $next : $prefix . '_' . bin2hex(random_bytes(8));
    }

    public static function id(string $prefix = ''): string
    {
        return $prefix . '_' . bin2hex(random_bytes(8));
    }
}