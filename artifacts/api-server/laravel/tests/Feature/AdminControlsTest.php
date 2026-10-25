<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminControlsTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'AdminControlsFixture123';

    private function account(int $id, string $email, string $role = 'Admin'): array
    {
        $salt = "admin-controls-{$id}";
        $hash = hash_pbkdf2('sha512', self::PASSWORD, $salt, 100000, 128, false);

        return [
            'id' => $id,
            'email' => $email,
            'name' => "Staff {$id}",
            'role' => $role,
            'status' => 'Active',
            'password' => "pbkdf2:{$salt}:{$hash}",
        ];
    }

    private function seedFixtures(): void
    {
        JsonStore::reset();
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'users' => [
                    $this->account(901, 'owner@example.test'),
                    $this->account(902, 'analyst@example.test'),
                    $this->account(903, 'agent@example.test', 'Agent'),
                ],
                'properties' => [
                    ['id' => 1, 'title' => 'Okara Home', 'city' => 'Okara', 'price' => 5000000, 'approvalStatus' => 'Pending', 'createdAt' => '2026-10-01T09:00:00Z'],
                    ['id' => 2, 'title' => 'Lahore Flat', 'city' => 'Lahore', 'price' => 9000000, 'approvalStatus' => 'Active', 'createdAt' => '2026-10-10T09:00:00Z'],
                ],
                'inquiries' => [['id' => 'lead-1', 'name' => 'Buyer', 'city' => 'Okara', 'status' => 'New', 'createdAt' => '2026-10-12T09:00:00Z']],
                'appointments' => [],
            ]),
        ]);
        JsonStore::reset();
    }

    private function login(string $email): string
    {
        return (string) $this->postJson('/api/auth/login', [
            'identifier' => $email,
            'password' => self::PASSWORD,
        ])->assertOk()->json('token');
    }

    public function test_live_reports_filter_records_and_never_export_passwords(): void
    {
        $this->seedFixtures();
        $token = $this->login('owner@example.test');

        $this->withToken($token)
            ->getJson('/api/admin/analytics?type=properties&city=okara&dateFrom=2026-10-01&dateTo=2026-10-05')
            ->assertOk()
            ->assertJsonPath('type', 'properties')
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('records.0.title', 'Okara Home');

        $this->withToken($token)
            ->getJson('/api/admin/analytics?type=users')
            ->assertOk()
            ->assertJsonMissingPath('records.0.password');

        $this->withToken($token)
            ->getJson('/api/admin/analytics?type=properties&limit=1')
            ->assertOk()
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('limit', 1)
            ->assertJsonPath('hasMore', true);

        $this->withToken($token)
            ->getJson('/api/admin/analytics?type=properties&offset=1&limit=1')
            ->assertOk()
            ->assertJsonPath('records.0.id', 2)
            ->assertJsonPath('hasMore', false);

        $this->withToken($token)
            ->getJson('/api/admin/analytics?type=not-a-report')
            ->assertUnprocessable();
    }

    public function test_connected_admin_menus_read_and_manage_live_collections_with_role_checks(): void
    {
        $this->seedFixtures();
        $ownerToken = $this->login('owner@example.test');
        $this->withToken($ownerToken)
            ->patchJson('/api/admin/staff/902/permissions', ['role' => 'analyst'])
            ->assertOk();
        $analystToken = $this->login('analyst@example.test');

        $locations = $this->withToken($ownerToken)->getJson('/api/admin/locations')
            ->assertOk()
            ->assertJsonCount(6)
            ->json();
        $this->assertSame(
            ['Okara', 'Depalpur', 'Renala Khurd', 'Hujra Shah Muqeem', 'Basir Pur', 'Haveli Lakha'],
            array_column($locations, 'name'),
        );
        $this->withToken($ownerToken)
            ->postJson('/api/admin/locations', ['name' => 'Okara'])
            ->assertStatus(409);
        $this->withToken($ownerToken)
            ->patchJson('/api/admin/locations/service-area-okara', ['status' => 'Inactive'])
            ->assertOk()
            ->assertJsonPath('status', 'Inactive');
        $customLocation = $this->withToken($ownerToken)
            ->postJson('/api/admin/locations', ['name' => 'Lahore', 'status' => 'Active'])
            ->assertCreated()
            ->assertJsonPath('name', 'Lahore')
            ->json();
        $this->withToken($ownerToken)->deleteJson('/api/admin/locations/' . $customLocation['id'])->assertNoContent();
        $this->withToken($analystToken)->getJson('/api/admin/locations')->assertForbidden();

        $project = $this->withToken($ownerToken)
            ->postJson('/api/admin/developer-projects', [
                'title' => 'Okara Heights',
                'city' => 'Okara',
                'status' => 'Draft',
                'latitude' => 30.8094,
                'longitude' => 73.4537,
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Okara Heights')
            ->assertJsonPath('latitude', 30.8094)
            ->assertJsonPath('longitude', 73.4537)
            ->json();
        $this->withToken($ownerToken)
            ->putJson('/api/admin/developer-projects/' . $project['id'], ['status' => 'Live'])
            ->assertOk()
            ->assertJsonPath('status', 'Live');
        $this->withToken($analystToken)->getJson('/api/admin/developer-projects')->assertForbidden();
        $this->withToken($ownerToken)
            ->deleteJson('/api/admin/developer-projects/' . $project['id'])
            ->assertOk()
            ->assertJsonPath('success', true);
        $this->withToken($ownerToken)->getJson('/api/admin/developer-projects')->assertOk()->assertJsonMissing(['id' => $project['id']]);
        $archivedProject = collect(JsonStore::read()['developerProjects'])->firstWhere('id', $project['id']);
        $this->assertSame('Archived', $archivedProject['status']);
        $this->assertNotEmpty($archivedProject['deletedAt']);
        $this->assertTrue(collect(JsonStore::read()['adminActivity'] ?? [])->contains(
            fn ($activity) => ($activity['action'] ?? '') === 'admin.delete.developer-projects'
                && (string) ($activity['details']['resourceId'] ?? '') === (string) $project['id'],
        ));

        $appointment = $this->withToken($ownerToken)
            ->postJson('/api/appointments', [
                'buyerName' => 'Test buyer',
                'propertyTitle' => 'Okara Home',
                'city' => 'Okara',
                'status' => 'Upcoming',
            ])
            ->assertCreated()
            ->json();
        $this->withToken($ownerToken)
            ->patchJson('/api/appointments/' . $appointment['id'], ['status' => 'Completed'])
            ->assertOk()
            ->assertJsonPath('status', 'Completed');
        $this->withToken($analystToken)->getJson('/api/appointments')->assertForbidden();
        $this->withToken($ownerToken)->deleteJson('/api/appointments/' . $appointment['id'])->assertNoContent();

        $report = $this->withToken($ownerToken)
            ->postJson('/api/admin/reports', [
                'reason' => 'Incorrect address',
                'description' => 'Please verify the property address.',
                'status' => 'Pending',
            ])
            ->assertCreated()
            ->json();
        $this->withToken($ownerToken)
            ->patchJson('/api/admin/reports/' . $report['id'], ['status' => 'Resolved'])
            ->assertOk()
            ->assertJsonPath('status', 'Resolved');
        $this->withToken($analystToken)->getJson('/api/admin/reports')->assertForbidden();
        $this->withToken($ownerToken)->deleteJson('/api/admin/reports/' . $report['id'])->assertNoContent();

        $this->withToken($ownerToken)
            ->getJson('/api/admin/properties/1/review')
            ->assertOk()
            ->assertJsonPath('property.id', 1)
            ->assertJsonCount(0, 'audit');
        $this->withToken($ownerToken)
            ->patchJson('/api/admin/properties/1/request-changes', ['reason' => 'Add clearer photos'])
            ->assertOk()
            ->assertJsonPath('approvalStatus', 'Changes Requested');
        $this->withToken($ownerToken)
            ->getJson('/api/admin/properties/1/review')
            ->assertOk()
            ->assertJsonCount(1, 'audit')
            ->assertJsonPath('audit.0.action', 'request-changes');
        $this->withToken($analystToken)->patchJson('/api/admin/properties/1/approve')->assertForbidden();
    }

    public function test_staff_roles_are_enforced_by_the_api_and_owner_access_cannot_be_removed(): void
    {
        $this->seedFixtures();
        $ownerToken = $this->login('owner@example.test');

        $this->withToken($ownerToken)
            ->getJson('/api/admin/staff')
            ->assertOk()
            ->assertJsonCount(2, 'staff');

        $this->withToken($ownerToken)
            ->patchJson('/api/admin/staff/902/permissions', ['role' => 'analyst'])
            ->assertOk()
            ->assertJsonPath('staffRole', 'analyst');

        $analystToken = $this->login('analyst@example.test');
        $this->withToken($analystToken)
            ->getJson('/api/admin/analytics?type=properties')
            ->assertOk();
        $this->withToken($analystToken)
            ->getJson('/api/admin/staff')
            ->assertForbidden();
        $this->withToken($analystToken)
            ->putJson('/api/admin/system/settings', ['maintenanceMode' => true])
            ->assertForbidden();
        $this->withToken($analystToken)
            ->patchJson('/api/admin/properties/1', ['title' => 'Unauthorized change'])
            ->assertForbidden();
        $this->withToken($analystToken)
            ->patchJson('/api/properties/1/approve', [])
            ->assertForbidden();
        $this->withToken($analystToken)
            ->getJson('/api/mobile/banners/all')
            ->assertForbidden();
        $this->withToken($analystToken)
            ->postJson('/api/inquiries', ['propertyId' => 1, 'message' => 'Unauthorized'])
            ->assertForbidden();
        $this->withToken($analystToken)
            ->getJson('/api/conversations')
            ->assertForbidden();
        $this->withToken($analystToken)
            ->postJson('/api/developer/projects', ['name' => 'Unauthorized'])
            ->assertForbidden();
        $this->withToken($analystToken)
            ->postJson('/api/upload/single', [])
            ->assertForbidden();
        $this->withToken($analystToken)
            ->postJson('/api/saved/903/1', [])
            ->assertForbidden();
        $this->withToken($analystToken)
            ->getJson('/api/users')
            ->assertOk();
        $this->withToken($analystToken)
            ->putJson('/api/users/903', ['name' => 'Unauthorized edit'])
            ->assertForbidden();

        $this->withToken($ownerToken)
            ->patchJson('/api/admin/staff/902/permissions', ['role' => 'operations'])
            ->assertOk();
        $operationsToken = $this->login('analyst@example.test');
        $this->withToken($operationsToken)
            ->patchJson('/api/admin/users/903/role', ['role' => 'Admin'])
            ->assertForbidden();
        $this->withToken($operationsToken)
            ->postJson('/api/users', [
                'name' => 'New Admin',
                'email' => 'new-admin@example.test',
                'password' => 'StrongPassword123',
                'role' => 'Admin',
            ])
            ->assertForbidden();

        $this->withToken($ownerToken)
            ->patchJson('/api/admin/staff/901/permissions', ['role' => 'analyst'])
            ->assertConflict();
    }

    public function test_system_settings_health_and_activity_logs_use_live_service_data(): void
    {
        $this->seedFixtures();
        $token = $this->login('owner@example.test');

        $this->withToken($token)
            ->getJson('/api/admin/system/status')
            ->assertOk()
            ->assertJsonPath('framework', 'laravel')
            ->assertJsonStructure(['status', 'database', 'mediaStorage', 'checkedAt']);

        $this->withToken($token)
            ->patchJson('/api/admin/properties/1', ['title' => 'Updated Okara Home'])
            ->assertOk();

        $this->withToken($token)
            ->putJson('/api/admin/system/settings', [
                'maintenanceMode' => true,
                'maintenanceMessage' => 'Scheduled maintenance',
                'appVersion' => '2.4.0',
            ])
            ->assertOk()
            ->assertJsonPath('settings.maintenanceMode', true);

        $this->withToken($token)
            ->getJson('/api/admin/system/logs')
            ->assertOk()
            ->assertJsonPath('activityLogs.0.action', 'system.settings.updated')
            ->assertJsonFragment(['action' => 'admin.patch.properties'])
            ->assertJsonStructure(['applicationLogs', 'activityLogs', 'failedJobs', 'checkedAt']);
    }
}
