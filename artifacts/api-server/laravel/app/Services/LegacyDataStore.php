<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Compatibility boundary for the existing OG Landmark app_data document.
 * It preserves the current mobile/website payload shape while Laravel routes
 * are migrated module by module. It never invents or seeds production data.
 */
final class LegacyDataStore
{
    public function read(): array
    {
        $row = DB::table('app_data')->where('id', 1)->first();
        if (! $row) {
            throw new RuntimeException('OG Landmark app_data row is missing; import or connect the existing database before serving API traffic.');
        }

        $data = is_string($row->data) ? json_decode($row->data, true, 512, JSON_THROW_ON_ERROR) : $row->data;
        if (! is_array($data)) {
            throw new RuntimeException('OG Landmark app_data row is not a valid JSON document.');
        }

        return $data;
    }

    /**
     * Serialize writes to the canonical document so simultaneous API requests
     * cannot overwrite each other's changes.
     */
    public function mutate(callable $callback): mixed
    {
        return DB::transaction(function () use ($callback): mixed {
            $row = DB::table('app_data')->where('id', 1)->lockForUpdate()->first();
            if (! $row) {
                throw new RuntimeException('OG Landmark app_data row is missing; refusing to create an empty production dataset.');
            }

            $data = is_string($row->data) ? json_decode($row->data, true, 512, JSON_THROW_ON_ERROR) : $row->data;
            if (! is_array($data)) {
                throw new RuntimeException('OG Landmark app_data row is not a valid JSON document.');
            }

            $result = $callback($data);
            DB::table('app_data')->where('id', 1)->update([
                'data' => json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'updated_at' => now(),
            ]);

            return $result;
        });
    }
}
