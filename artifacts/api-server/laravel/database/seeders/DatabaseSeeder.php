<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        /*
         * The application keeps its backward-compatible canonical document in
         * app_data(id=1). Seed an empty document so a new MySQL installation
         * is immediately usable without creating a fake user or credentials.
         *
         * insertOrIgnore is intentional: running `migrate --seed` again must
         * never overwrite an existing production document.
         */
        DB::table('app_data')->insertOrIgnore([
            [
                'id' => 1,
                'data' => json_encode([
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
                ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ],
        ]);
    }
}
