<?php

namespace App\Console\Commands;

use App\Services\AppDataSnapshot;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class VerifyAppData extends Command
{
    protected $signature = 'data:verify
        {snapshot : Path to the reviewed OG Landmark JSON snapshot}
        {--expected-sha256= : Expected canonical SHA-256 checksum for the snapshot}';

    protected $description = 'Compare a reviewed OG Landmark snapshot with MySQL app_data';

    public function handle(): int
    {
        try {
            $snapshot = AppDataSnapshot::fromFile($this->argument('snapshot'));
            $sourceChecksum = AppDataSnapshot::checksum($snapshot);
            $this->assertExpectedChecksum($sourceChecksum);

            $storedJson = DB::table('app_data')->where('id', 1)->value('data');
            if ($storedJson === null) {
                throw new RuntimeException('Target app_data(id=1) does not exist.');
            }

            $target = AppDataSnapshot::fromStoredJson((string) $storedJson);
            $targetChecksum = AppDataSnapshot::checksum($target);
            $result = [
                'source' => [
                    'sha256' => $sourceChecksum,
                    ...AppDataSnapshot::summary($snapshot),
                ],
                'target' => [
                    'sha256' => $targetChecksum,
                    ...AppDataSnapshot::summary($target),
                ],
                'match' => hash_equals($sourceChecksum, $targetChecksum),
            ];
            $this->line((string) json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            if (!$result['match']) {
                $this->error('Source and target app_data checksums differ.');

                return self::FAILURE;
            }

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