<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ApiCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_healthz_exposes_laravel_and_database_status(): void
    {
        $this->getJson('/api/healthz')
            ->assertOk()
            ->assertJsonPath('framework', 'laravel')
            ->assertJsonPath('databaseProvider', 'mysql')
            ->assertJsonPath('status', 'ok');
    }

    public function test_forgot_password_persists_a_bounded_challenge(): void
    {
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'users' => [[
                    'id' => 7,
                    'email' => 'seller@example.com',
                    'name' => 'Seller',
                    'password' => 'pbkdf2:unused:unused',
                ]],
            ]),
        ]);

        $this->postJson('/api/auth/forgot-password', ['email' => 'seller@example.com'])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('auth_challenges', [
            'email' => 'seller@example.com',
            'purpose' => 'password-reset',
            'attempts' => 0,
        ]);

        $this->postJson('/api/auth/reset-password', [
            'email' => 'seller@example.com',
            'code' => '000000',
            'newPassword' => 'NewPassword123',
        ])->assertStatus(400);

        $this->assertDatabaseHas('auth_challenges', [
            'email' => 'seller@example.com',
            'purpose' => 'password-reset',
            'attempts' => 1,
        ]);
    }
}