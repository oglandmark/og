<?php

namespace Tests\Feature;

use App\Services\JsonStore;
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

    public function test_imported_document_serves_listing_and_authenticated_user_routes(): void
    {
        JsonStore::reset();
        $password = 'TestPassword123';
        $salt = 'fixture-salt';
        $hash = hash_pbkdf2('sha512', $password, $salt, 100000, 128, false);

        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'properties' => [[
                    'id' => 41,
                    'title' => 'Active test listing',
                    'sellerId' => 9,
                    'approvalStatus' => 'Active',
                    'listingStatus' => 'Active',
                ]],
                'users' => [[
                    'id' => 9,
                    'email' => 'seller@example.com',
                    'name' => 'Seller',
                    'role' => 'Buyer',
                    'status' => 'Active',
                    'password' => "pbkdf2:{$salt}:{$hash}",
                ]],
            ]),
        ]);

        $login = $this->postJson('/api/auth/login', [
            'identifier' => 'seller@example.com',
            'password' => $password,
        ])->assertOk();

        $token = (string) $login->json('token');
        $this->assertNotSame('', $token);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('email', 'seller@example.com');

        $this->getJson('/api/properties')
            ->assertOk()
            ->assertJsonPath('0.id', 41);
    }
}