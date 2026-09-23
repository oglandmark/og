<?php

namespace App\Console\Commands;

use App\Services\AppDataSnapshot;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class ImportAppData extends Command
{
    protected $signature = 'data:import
        {snapshot : Path to the reviewed OG Landmark JSON snapshot}
        {--expected-sha256= : Expected canonical SHA-256 checksum for the snapshot}';

    protected $description = 'Import a reviewed OG Landmark snapshot into an empty MySQL database';

    /**
     * Tables that may contain live account state outside the canonical document.
     */
    private const STATE_TABLES = [
        'auth_sessions',
        'auth_challenges',
        'users',
        'password_reset_tokens',
        'sessions',
    ];

    public function handle(): int
    {
        try {
            $snapshot = AppDataSnapshot::fromFile($this->argument('snapshot'));
            $sourceChecksum = AppDataSnapshot::checksum($snapshot);
            $this->assertExpectedChecksum($sourceChecksum);

            $result = DB::transaction(function () use ($snapshot, $sourceChecksum): array {
                $row = DB::table('app_data')
                    ->where('id', 1)
                    ->lockForUpdate()
                    ->first();

                if ($row !== null) {
                    $existing = AppDataSnapshot::fromStoredJson((string) $row->data);
                    if (!AppDataSnapshot::isEmptyCanonicalDocument($existing)) {
                        throw new RuntimeException(
                            'Refusing to import: app_data(id=1) already contains data.',
                        );
                    }
                }

                foreach (self::STATE_TABLES as $table) {
                    if (Schema::hasTable($table) && DB::table($table)->count() > 0) {
                        throw new RuntimeException(
                            "Refusing to import: target table {$table} is not empty.",
                        );
                    }
                }

                $payload = [
                    'data' => json_encode(
                        $snapshot,
                        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
                    ),
                    'updated_at' => now(),
                ];

                if ($row === null) {
                    DB::table('app_data')->insert(['id' => 1] + $payload);
                } else {
                    DB::table('app_data')->where('id', 1)->update($payload);
                }

                $stored = AppDataSnapshot::fromStoredJson(
                    (string) DB::table('app_data')->where('id', 1)->value('data'),
                );
                $targetChecksum = AppDataSnapshot::checksum($stored);
                if (!hash_equals($sourceChecksum, $targetChecksum)) {
                    throw new RuntimeException(
                        'Import verification failed: source and target checksums differ.',
                    );
                }

                return [
                    'source' => [
                        'sha256' => $sourceChecksum,
                        ...AppDataSnapshot::summary($snapshot),
                    ],
                    'target' => [
                        'sha256' => $targetChecksum,
                        ...AppDataSnapshot::summary($stored),
                    ],
                    'match' => true,
                ];
            });

            $this->line((string) json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    private function assertExpectedChecksum(string $sourceChecksum): void
    {
        $expected = trim((string) $this->option('expected-sha256'));
        if ($expected === '') {
            return;
        }
        if (!preg_match('/^[a-f0-9]{64}$/i', $expected)) {
            throw new RuntimeException('--expected-sha256 must be a 64-character hexadecimal SHA-256 checksum.');
        }
        if (!hash_equals(strtolower($expected), $sourceChecksum)) {
            throw new RuntimeException('Snapshot checksum does not match --expected-sha256.');
        }
    }
}