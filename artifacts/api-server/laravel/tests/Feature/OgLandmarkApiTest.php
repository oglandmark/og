<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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
                'reports' => [
                    ['id' => 301, 'reporterId' => 42, 'propertyId' => 101, 'status' => 'Pending', 'reportedAt' => '2026-02-01T00:00:00Z', 'reason' => 'Incorrect details'],
                    ['id' => 302, 'reporterId' => 99, 'propertyId' => 102, 'status' => 'Resolved', 'reportedAt' => '2026-02-02T00:00:00Z', 'reason' => 'Duplicate'],
                ],
                'buyerRequests' => [
                    ['id' => 401, 'userId' => 42, 'createdAt' => '2026-02-03T00:00:00Z', 'action' => 'submitted'],
                    ['id' => 402, 'userId' => 99, 'createdAt' => '2026-02-04T00:00:00Z', 'action' => 'other user'],
                ],
                'auditLog' => [],
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
        $this->withToken($token)->getJson('/api/admin/properties/101/review')
            ->assertOk()->assertJsonPath('property.id', 101)
            ->assertJsonPath('seller.email', 'user@example.test');
        $this->withToken($token)->patchJson('/api/properties/102/approve')
            ->assertOk()->assertJsonPath('property.approvalStatus', 'Active');
        $this->withToken($token)->patchJson('/api/properties/102/request-changes', ['reason' => 'Please add ownership documents.'])
            ->assertOk()->assertJsonPath('property.approvalStatus', 'Changes Requested')
            ->assertJsonPath('property.changeRequest', 'Please add ownership documents.');
        $this->withToken($token)->patchJson('/api/admin/mobile-agents/9', [
            'name' => 'Updated Agent', 'about' => 'Updated profile',
            'approvalStatus' => 'Approved', 'status' => 'Active', 'visible' => true,
        ])->assertOk()->assertJsonPath('agent.visible', true)
            ->assertJsonPath('agent.name', 'Updated Agent')
            ->assertJsonPath('agent.about', 'Updated profile');
        $this->withToken($token)->getJson('/api/mobile-agents')->assertJsonCount(1);
        $this->withToken($token)->patchJson('/api/admin/mobile-agents/9', [
            'status' => 'Suspended', 'visible' => false,
        ])->assertOk()->assertJsonPath('agent.status', 'Suspended')
            ->assertJsonPath('agent.visible', false);

        $this->withToken($token)->getJson('/api/mobile-agents')->assertJsonCount(0);
    }

    public function test_admin_property_media_upload_update_and_cleanup_use_laravel_storage(): void
    {
        Storage::fake('public');
        $existingUrl = '/api-legacy/api/admin/property-media/old-photo.jpg';
        $data = json_decode(DB::table('app_data')->where('id', 1)->value('data'), true);
        $data['properties'][0]['images'] = [$existingUrl];
        $data['properties'][0]['coverImage'] = $existingUrl;
        DB::table('app_data')->where('id', 1)->update(['data' => json_encode($data, JSON_THROW_ON_ERROR)]);
        Storage::disk('public')->put('listing-media/old-photo.jpg', 'old photo');
        $token = $this->adminToken();

        $upload = $this->withToken($token)->post('/api/admin/properties/101/media', [
            '_method' => 'PATCH',
            'images' => json_encode([$existingUrl]),
            'videoUrl' => '',
            'newImages' => [UploadedFile::fake()->image('new-photo.jpg')],
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('success', true);
        $photoUrl = $upload->json('property.images.1');
        $this->assertStringStartsWith('/api-legacy/api/admin/property-media/', $photoUrl);
        $filename = basename(parse_url($photoUrl, PHP_URL_PATH));
        Storage::disk('public')->assertExists('listing-media/'.$filename);
        Storage::disk('public')->assertExists('listing-media/old-photo.jpg');

        $this->withToken($token)->patchJson('/api/admin/properties/101/media', [
            'images' => [],
            'videoUrl' => null,
        ])->assertOk()->assertJsonPath('property.images', []);
        Storage::disk('public')->assertMissing('listing-media/'.$filename);
        Storage::disk('public')->assertMissing('listing-media/old-photo.jpg');
    }

    public function test_admin_property_media_rejects_unsupported_uploads_without_changing_media(): void
    {
        Storage::fake('public');
        $token = $this->adminToken();

        $this->withToken($token)->post('/api/admin/properties/101/media', [
            '_method' => 'PATCH',
            'images' => '[]',
            'newImages' => [UploadedFile::fake()->create('script.txt', 2, 'text/plain')],
        ], ['Accept' => 'application/json'])->assertUnprocessable();

        $data = json_decode(DB::table('app_data')->where('id', 1)->value('data'), true);
        $this->assertEmpty($data['properties'][0]['images'] ?? []);
        Storage::disk('public')->assertDirectoryEmpty('listing-media');
    }

    public function test_local_admin_routes_validate_the_existing_website_session_and_permissions(): void
    {
        $this->app->detectEnvironment(fn () => 'local');
        config(['services.og_landmark.website_auth_url' => 'http://website.test/api/auth/me']);
        Http::fake([
            'http://website.test/api/auth/me' => Http::sequence()
                ->push(['user' => ['id' => 7, 'name' => 'Admin User', 'role' => 'Admin', 'permissions' => ['admin'], 'status' => 'Active']])
                ->push(['user' => ['id' => 42, 'name' => 'Test User', 'role' => 'User', 'permissions' => [], 'status' => 'Active']]),
        ]);

        $this->withToken('existing-local-admin-session')->getJson('/api/admin/properties')->assertOk();
        $this->withToken('existing-local-user-session')->getJson('/api/admin/properties')->assertForbidden();
        Http::assertSentCount(2);
    }

    public function test_regular_users_cannot_open_admin_moderation_routes(): void
    {
        $token = $this->postJson('/api/auth/login', [
            'identifier' => 'testuser',
            'password' => self::PASSWORD,
        ])->assertOk()->json('token');
        $this->withToken($token)->getJson('/api/admin/properties')->assertForbidden();
    }

    public function test_admin_can_list_users_and_inspect_paginated_account_activity(): void
    {
        $token = $this->adminToken();

        $this->withToken($token)->getJson('/api/admin/users?role=user&limit=1')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', 42)
            ->assertJsonMissingPath('0.password');

        $this->withToken($token)->getJson('/api/admin/users/42/activity?limit=1&page=1')
            ->assertOk()
            ->assertHeader('X-Total-Count', '1')
            ->assertJsonCount(1)
            ->assertJsonPath('0.resource', 'buyerRequests')
            ->assertJsonPath('0.id', 401);

        $this->withToken($token)->getJson('/api/admin/users/999/activity')
            ->assertNotFound()->assertJsonPath('error', 'User not found');
    }

    public function test_admin_can_update_validated_staff_permissions_with_audit_history(): void
    {
        $token = $this->adminToken();

        $this->withToken($token)->patchJson('/api/admin/users/42/permissions', [
            'permissions' => ['developer', 'agent'],
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', 42)
            ->assertJsonPath('user.permissions', ['agent', 'developer'])
            ->assertJsonMissingPath('user.password');

        $this->withToken($token)->patchJson('/api/admin/users/42/permissions', [
            'permissions' => ['superuser'],
        ])->assertUnprocessable();
        $this->withToken($token)->patchJson('/api/admin/users/42/permissions', [
            'permissions' => ['admin', 'admin'],
        ])->assertUnprocessable();
        $this->withToken($token)->patchJson('/api/admin/users/7/permissions', [
            'permissions' => [],
        ])->assertUnprocessable();

        $data = json_decode(DB::table('app_data')->where('id', 1)->value('data'), true);
        $this->assertSame('user_permissions_updated', $data['auditLog'][0]['action']);
        $this->assertSame('42', $data['auditLog'][0]['recordId']);
        $this->assertSame(['agent', 'developer'], $data['auditLog'][0]['detail']['toPermissions']);
    }

    public function test_admin_can_update_role_without_removing_own_admin_access(): void
    {
        $token = $this->adminToken();
        $this->withToken($token)->patchJson('/api/admin/users/42/role', ['role' => 'Agent'])
            ->assertOk()
            ->assertJsonPath('user.role', 'Agent')
            ->assertJsonPath('user.permissions', ['agent']);
        $this->withToken($token)->patchJson('/api/admin/users/42/role', ['role' => 'Root'])
            ->assertUnprocessable();
        $this->withToken($token)->patchJson('/api/admin/users/7/role', ['role' => 'User'])
            ->assertUnprocessable();
    }

    public function test_admin_can_edit_and_delete_users_with_audit_history(): void
    {
        $token = $this->adminToken();
        $this->withToken($token)->putJson('/api/admin/users/42', [
            'name' => 'Updated User',
            'email' => 'updated@example.test',
            'status' => 'Suspended',
            'role' => 'Developer',
        ])->assertOk()
            ->assertJsonPath('id', 42)
            ->assertJsonPath('name', 'Updated User')
            ->assertJsonPath('role', 'Developer')
            ->assertJsonPath('permissions', ['developer'])
            ->assertJsonPath('status', 'Suspended')
            ->assertJsonMissingPath('password');
        $this->withToken($token)->putJson('/api/admin/users/42', ['role' => 'Root'])
            ->assertUnprocessable();

        $this->withToken($token)->deleteJson('/api/admin/users/42')
            ->assertOk()->assertJsonPath('success', true);
        $this->withToken($token)->getJson('/api/admin/users/42/activity')->assertNotFound();

        $data = json_decode(DB::table('app_data')->where('id', 1)->value('data'), true);
        $this->assertSame(['user_deleted', 'user_updated'], array_column($data['auditLog'], 'action'));
        $this->assertSame('42', $data['auditLog'][0]['recordId']);
    }

    public function test_admin_can_review_reports_and_mutations_are_audited(): void
    {
        $token = $this->adminToken();
        $this->withToken($token)->getJson('/api/admin/reports?status=Pending')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', 301);
        $this->withToken($token)->getJson('/api/admin/reports')
            ->assertOk()->assertJsonPath('0.id', 302);

        $this->withToken($token)->patchJson('/api/admin/reports/301', [
            'status' => 'Resolved',
            'adminNote' => 'Confirmed and resolved.',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('report.status', 'Resolved')
            ->assertJsonPath('report.adminNote', 'Confirmed and resolved.')
            ->assertJsonStructure(['report' => ['resolvedAt']]);

        $this->withToken($token)->patchJson('/api/admin/reports/301', ['status' => 'Closed'])
            ->assertUnprocessable();
        $this->withToken($token)->patchJson('/api/admin/reports/999', ['status' => 'Resolved'])
            ->assertNotFound()->assertJsonPath('error', 'Report not found');

        $data = json_decode(DB::table('app_data')->where('id', 1)->value('data'), true);
        $this->assertSame('report_updated', $data['auditLog'][0]['action']);
        $this->assertSame('reports', $data['auditLog'][0]['resource']);
        $this->assertSame('301', $data['auditLog'][0]['recordId']);
    }

    public function test_regular_users_cannot_access_user_or_report_moderation(): void
    {
        $token = $this->postJson('/api/auth/login', [
            'identifier' => 'testuser',
            'password' => self::PASSWORD,
        ])->assertOk()->json('token');

        $this->withToken($token)->getJson('/api/admin/users')->assertForbidden();
        $this->withToken($token)->getJson('/api/admin/reports')->assertForbidden();
        $this->withToken($token)->patchJson('/api/admin/users/42/permissions', ['permissions' => ['admin']])->assertForbidden();
        $this->withToken($token)->patchJson('/api/admin/reports/301', ['status' => 'Resolved'])->assertForbidden();
    }

    private function adminToken(): string
    {
        return $this->postJson('/api/auth/login', [
            'identifier' => 'testadmin',
            'password' => self::PASSWORD,
        ])->assertOk()->json('token');
    }
}
