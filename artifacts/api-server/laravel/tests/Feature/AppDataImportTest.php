<?php

namespace Tests\Feature;

use App\Services\AppDataSnapshot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AppDataImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_replaces_only_the_empty_seed_document_and_verifies_it(): void
    {
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'properties' => [],
                'users' => [],
                'nextId' => 1,
            ]),
        ]);

        $snapshot = $this->writeSnapshot([
            'properties' => [[
                'id' => 101,
                'title' => 'Reviewed listing',
                'approvalStatus' => 'Active',
                'listingStatus' => 'Active',
            ]],
            'users' => [[
                'id' => 201,
                'email' => 'seller@example.com',
                'password' => 'pbkdf2:salt:hash',
            ]],
            'inquiries' => [],
            'nextId' => 202,
        ]);

        $exitCode = Artisan::call('data:import', ['snapshot' => $snapshot]);

        $this->assertSame(0, $exitCode);
        $this->assertSame(
            AppDataSnapshot::checksum(json_decode((string) file_get_contents($snapshot), true)),
            AppDataSnapshot::checksum(json_decode((string) DB::table('app_data')->where('id', 1)->value('data'), true)),
        );
        $this->assertStringContainsString('"match": true', Artisan::output());

        @unlink($snapshot);
    }

    public function test_import_refuses_a_populated_target_without_changing_it(): void
    {
        $existing = [
            'properties' => [['id' => 1]],
            'users' => [],
            'nextId' => 2,
        ];
        DB::table('app_data')->insert(['id' => 1, 'data' => json_encode($existing)]);
        $snapshot = $this->writeSnapshot([
            'properties' => [['id' => 2]],
            'users' => [],
            'nextId' => 3,
        ]);

        $exitCode = Artisan::call('data:import', ['snapshot' => $snapshot]);

        $this->assertSame(1, $exitCode);
        $this->assertSame(
            AppDataSnapshot::checksum($existing),
            AppDataSnapshot::checksum(json_decode((string) DB::table('app_data')->where('id', 1)->value('data'), true)),
        );
        $this->assertStringContainsString('already contains data', Artisan::output());

        @unlink($snapshot);
    }

    public function test_verify_reports_a_checksum_mismatch(): void
    {
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode(['properties' => [], 'users' => [], 'nextId' => 1]),
        ]);
        $snapshot = $this->writeSnapshot([
            'properties' => [['id' => 1]],
            'users' => [],
            'nextId' => 2,
        ]);

        $exitCode = Artisan::call('data:verify', ['snapshot' => $snapshot]);

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('checksums differ', Artisan::output());

        @unlink($snapshot);
    }

    private function writeSnapshot(array $data): string
    {
        $path = tempnam(sys_get_temp_dir(), 'og-landmark-snapshot-');
        file_put_contents($path, json_encode($data));

        return $path;
    }
}