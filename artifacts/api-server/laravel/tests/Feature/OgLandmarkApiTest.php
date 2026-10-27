<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class OgLandmarkApiTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'TestPass123';

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'nextId' => 200,
                'users' => [[
                    'id' => 42,
                    'name' => 'Test User',
                    'email' => 'user@example.test',
                    'username' => 'testuser',
                    'phone' => '03001234567',
                    'role' => 'User',
                    'status' => 'Active',
                    'permissions' => [],
                    'password' => 'pbkdf2:test-salt:'.hash_pbkdf2('sha512', self::PASSWORD, 'test-salt', 100000, 128),
                ], [
                    'id' => 7,
                    'name' => 'Admin User',
                    'email' => 'admin@example.test',
                    'username' => 'testadmin',
                    'role' => 'User',
                    'status' => 'Active',
                    'permissions' => ['admin'],
                    'password' => 'pbkdf2:admin-salt:'.hash_pbkdf2('sha512', self::PASSWORD, 'admin-salt', 100000, 128),
                ]],
                'properties' => [[
                    'id' => 101,
                    'title' => 'Approved house',
                    'city' => 'Okara',
                    'type' => 'House',
                    'price' => 15000000,
                    'sellerId' => 42,
                    'approvalStatus' => 'Active',
                    'listingStatus' => 'Active',
                    'createdAt' => '2026-01-01T00:00:00Z',
                ], [
                    'id' => 102,
                    'title' => 'Other seller draft',
                    'city' => 'Okara',
                    'sellerId' => 99,
                    'approvalStatus' => 'Draft',
                    'listingStatus' => 'Draft',
                ]],
                'mobileAgents' => [
                    ['id' => 1, 'name' => 'Approved Agent', 'status' => 'Active', 'approvalStatus' => 'Approved', 'visible' => true, 'areas' => ['Okara'], 'specialties' => ['Residential']],
                    ['id' => 2, 'name' => 'Pending Agent', 'status' => 'Active', 'approvalStatus' => 'Pending', 'visible' => true],
                    ['id' => 3, 'name' => 'Hidden Agent', 'status' => 'Active', 'approvalStatus' => 'Approved', 'visible' => false],
                ],
            ], JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }

    public function test_health_requires_the_existing_canonical_data_row(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('database', 'connected');
    }

    public function test_login_accepts_legacy_password_hash_and_returns_a_safe_user(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'identifier' => 'testuser',
            'password' => self::PASSWORD,
        ])->assertOk()
            ->assertJsonPath('user.id', 42)
            ->assertJsonMissingPath('user.password');

        $token = $response->json('token');
        $this->assertNotEmpty($token);
        $this->assertDatabaseHas('auth_sessions', [
            'token_hash' => hash('sha256', $token),
            'user_id' => 42,
        ]);
        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.email', 'user@example.test');
    }

    public function test_mobile_agent_directory_returns_only_approved_active_visible_agents(): void
    {
        $this->getJson('/api/mobile-agents')->assertOk()->assertJsonCount(1)->assertJsonPath('0.displayName', 'Approved Agent');
    }

    public function test_my_properties_is_scoped_and_listing_updates_require_ownership(): void
    {
        $login = $this->postJson('/api/auth/login', [
            'identifier' => 'user@example.test',
            'password' => self::PASSWORD,
        ])->assertOk();
        $token = $login->json('token');

        $this->withToken($token)->getJson('/api/my-properties')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', 101);

        $this->withToken($token)->patchJson('/api/properties/101/listing-status', ['listingStatus' => 'Paused'])
            ->assertOk()->assertJsonPath('listingStatus', 'Paused');
        $this->withToken($token)->patchJson('/api/properties/102/listing-status', ['listingStatus' => 'Active'])
            ->assertForbidden();
    }

    public function test_public_property_catalog_hides_drafts_and_supports_keyword_search(): void
    {
        $this->getJson('/api/properties?search=approved')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', 101);
        $this->getJson('/api/properties/102')->assertNotFound();
    }

    public function test_admin_permission_can_review_properties_and_update_agent_visibility(): void
    {
        DB::table('app_data')->update(['data' => json_encode(array_replace_recursive(
            json_decode(DB::table('app_data')->where('id', 1)->value('data'), true),
            ['mobileAgents' => [['id' => 9, 'name' => 'Managed Agent', 'status' => 'Pending', 'approvalStatus' => 'Pending', 'visible' => false]]],
        ), JSON_THROW_ON_ERROR)]);
        $token = $this->postJson('/api/auth/login', [
            'identifier' => 'testadmin',
            'password' => self::PASSWORD,
        ])->assertOk()->json('token');

        $this->withToken($token)->getJson('/api/admin/properties')->assertOk()->assertJsonCount(2);
        $this->withToken($token)->patchJson('/api/properties/102/approve')
            ->assertOk()->assertJsonPath('property.approvalStatus', 'Active');
        $this->withToken($token)->patchJson('/api/admin/mobile-agents/9', [
            'approvalStatus' => 'Approved', 'status' => 'Active', 'visible' => true,
        ])->assertOk()->assertJsonPath('agent.visible', true);

        $this->withToken($token)->getJson('/api/mobile-agents')->assertJsonCount(1);
    }

    public function test_regular_users_cannot_open_admin_moderation_routes(): void
    {
        $token = $this->postJson('/api/auth/login', [
            'identifier' => 'testuser',
            'password' => self::PASSWORD,
        ])->assertOk()->json('token');
        $this->withToken($token)->getJson('/api/admin/properties')->assertForbidden();
    }
}
