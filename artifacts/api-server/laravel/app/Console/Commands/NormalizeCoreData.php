<?php

namespace App\Console\Commands;

use App\Services\NormalizedCoreStore;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class NormalizeCoreData extends Command
{
    protected $signature = 'data:normalize-core
        {--apply : Write normalized rows and activate normalized core storage; omit for a read-only dry run}';

    protected $description = 'Preview or safely normalize users, properties, agents, and media URL references';

    public function handle(NormalizedCoreStore $store): int
    {
        try {
            foreach (['app_data', 'app_users', 'properties', 'agents', 'media_assets', 'normalization_state'] as $table) {
                if (!Schema::hasTable($table)) {
                    throw new RuntimeException("Required table {$table} is missing; apply the Laravel migrations first.");
                }
            }

            $apply = (bool) $this->option('apply');
            $result = DB::transaction(function () use ($store, $apply): array {
                $row = DB::table('app_data')
                    ->where('id', 1)
                    ->lockForUpdate()
                    ->first(['data']);

                if ($row === null) {
                    throw new RuntimeException('Canonical app_data(id=1) does not exist.');
                }

                try {
                    $document = json_decode((string) $row->data, true, 512, JSON_THROW_ON_ERROR);
                } catch (\JsonException $exception) {
                    throw new RuntimeException('Canonical app_data(id=1) is not valid JSON.', 0, $exception);
                }

                if (!is_array($document)) {
                    throw new RuntimeException('Canonical app_data(id=1) must contain a JSON object.');
                }

                return $store->migrateFromLegacy($document, !$apply);
            });

            $this->line((string) json_encode([
                'mode' => $apply ? 'apply' : 'dry-run',
                ...$result,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }
}