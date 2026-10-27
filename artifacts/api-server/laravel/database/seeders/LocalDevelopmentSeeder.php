<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class LocalDevelopmentSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('LocalDevelopmentSeeder is disabled outside local/testing environments.');
        }
        if (DB::table('app_data')->where('id', 1)->exists()) {
            return;
        }

        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'nextId' => 1000,
                'users' => [],
                'properties' => [],
                'mobileAgents' => [],
            ], JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }
}
