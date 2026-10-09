<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DashboardAuthCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'DashboardFixture123';

    private function fixtureUser(int $id, string $email, string $role): array
    {
        $salt = "dashboard-fixture-{$id}";
        $hash = hash_pbkdf2('sha512', self::PASSWORD, $salt, 100000, 128, false);

        return [
            'id' => $id,
            'email' => $email,
            'name' => ucfirst($role) . ' Fixture',
            'role' => $role,
            'status' => 'Active',
            'password' => "pbkdf2:{$salt}:{$hash}",
        ];
    }

    private function seedDashboardFixture(): void
    {
        JsonStore::reset();
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'users' => [
                    $this->fixtureUser(901, 'dashboard-admin@example.test', 'Admin'),
                    $this->fixtureUser(902, 'dashboard-seller@example.test', 'Seller'),
                    $this->fixtureUser(903, 'other-seller@example.test', 'Seller'),
                    $this->fixtureUser(904, 'dashboard-buyer@example.test', 'Buyer'),
                ],
                'properties' => [
                    ['id' => 991, 'title' => 'Fixture seller listing', 'sellerId' => 902, 'approvalStatus' => 'Pending'],
                    ['id' => 992, 'title' => 'Other seller listing', 'sellerId' => 903, 'approvalStatus' => 'Active'],
                ],
                'savedProperties' => ['904' => [992]],
                'inquiries' => [],
            ]),
        ]);
        JsonStore::reset();
    }

    private function login(string $email): string
    {
        $response = $this->postJson('/api/auth/login', [
            'identifier' => $email,
            'password' => self::PASSWORD,
        ])->assertOk();

        $this->assertSame($email, $response->json('user.email'));
        $this->assertArrayNotHasKey('password', $response->json('user'));

        return (string) $response->json('token');
    }

    public function test_dashboard_api_reads_require_a_session_and_respect_admin_and_seller_roles(): void
    {
        $this->seedDashboardFixture();

        $this->getJson('/api/auth/me')->assertUnauthorized();
        $this->getJson('/api/admin/stats')->assertUnauthorized();
        $this->getJson('/api/admin/properties')->assertUnauthorized();
        $this->getJson('/api/admin/users')->assertUnauthorized();
        $this->getJson('/api/my-properties')->assertUnauthorized();
        $this->getJson('/api/saved')->assertUnauthorized();

        $adminToken = $this->login('dashboard-admin@example.test');
        $this->withToken($adminToken)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('email', 'dashboard-admin@example.test')
            ->assertJsonMissingPath('password');

        $this->withToken($adminToken)
            ->getJson('/api/admin/stats')
            ->assertOk()
            ->assertJsonPath('totalUsers', 4)
            ->assertJsonPath('totalProperties', 2);
        $this->withToken($adminToken)
            ->getJson('/api/admin/properties')
            ->assertOk()
            ->assertJsonCount(2);
        $this->withToken($adminToken)
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonCount(4)
            ->assertJsonMissingPath('0.password');
        // The uploaded admin dashboard requests /users for its summary list,
        // while Laravel's admin collection route is /admin/users.
        $this->withToken($adminToken)
            ->getJson('/api/users')
            ->assertNotFound();

        $sellerToken = $this->login('dashboard-seller@example.test');
        $this->withToken($sellerToken)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('role', 'Seller');
        $this->withToken($sellerToken)
            ->getJson('/api/my-properties')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', 991);
        $this->withToken($sellerToken)
            ->getJson('/api/users/902')
            ->assertOk()
            ->assertJsonPath('email', 'dashboard-seller@example.test');
        $this->withToken($sellerToken)
            ->getJson('/api/admin/stats')
            ->assertForbidden();
        $this->withToken($sellerToken)
            ->getJson('/api/users/903')
            ->assertForbidden();

        $buyerToken = $this->login('dashboard-buyer@example.test');
        // The uploaded buyer dashboard calls /saved; Laravel currently
        // requires the user ID segment for this read.
        $this->withToken($buyerToken)
            ->getJson('/api/saved')
            ->assertNotFound();
        $this->withToken($buyerToken)
            ->getJson('/api/saved/904')
            ->assertOk()
            ->assertJsonPath('0', 992);

        $this->withToken('expired-or-invalid-fixture-token')
            ->getJson('/api/my-properties')
            ->assertUnauthorized();
    }

    public function test_admin_promoted_agent_can_sign_in_and_read_only_their_dashboard_data(): void
    {
        $this->seedDashboardFixture();
        $adminToken = $this->login('dashboard-admin@example.test');

        $this->withToken($adminToken)
            ->patchJson('/api/admin/users/902/role', ['role' => 'Agent'])
            ->assertOk()
            ->assertJsonPath('role', 'Agent')
            ->assertJsonPath('agentCoverUploadEnabled', false);

        $data = JsonStore::read();
        $data['agentLeads'] = [
            ['id' => 9101, 'userId' => 902, 'agentId' => '902', 'name' => 'Owned lead', 'status' => 'new'],
            ['id' => 9102, 'userId' => 903, 'agentId' => '903', 'name' => 'Other agent lead', 'status' => 'new'],
        ];
        $data['agentVisits'] = [
            ['id' => 'agent-visit-1', 'userId' => 902, 'agentId' => '902', 'date' => now()->toDateString(), 'status' => 'Requested'],
            ['id' => 'agent-visit-2', 'userId' => 903, 'agentId' => '903', 'date' => now()->toDateString(), 'status' => 'Requested'],
        ];
        JsonStore::write($data);

        $agentToken = $this->login('dashboard-seller@example.test');
        $this->withToken($agentToken)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('role', 'Agent')
            ->assertJsonMissingPath('password');
        $this->withToken($agentToken)
            ->getJson('/api/my-properties')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', 991);
        $this->withToken($agentToken)
            ->getJson('/api/agent-leads')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', 9101);
        $this->withToken($agentToken)
            ->getJson('/api/agent-visits')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', 'agent-visit-1');
    }

    public function test_admin_otp_exchange_creates_a_valid_session_but_dashboard_expects_a_different_login_response(): void
    {
        $this->seedDashboardFixture();
        config([
            'mail.default' => 'array',
            'mail.mailers.array' => ['transport' => 'array'],
            'mail.mailers.smtp.username' => 'dashboard-test-smtp-user',
            'mail.mailers.smtp.password' => 'dashboard-test-smtp-password',
        ]);

        $verification = $this->postJson('/api/auth/admin-verify', [
            'email' => 'dashboard-admin@example.test',
            'password' => self::PASSWORD,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonMissingPath('token');

        $sent = app('mail.manager')->mailer()->getSymfonyTransport()->messages();
        $this->assertCount(1, $sent);
        $message = $sent->first()->getOriginalMessage();
        $this->assertSame('dashboard-admin@example.test', $message->getTo()[0]->getAddress());
        $this->assertSame(
            'OG Landmark — Admin Sign-in Code',
            $message->getSubject(),
        );
        $this->assertSame(
            1,
            preg_match('/\b(\d{6})\b/', (string) $message->getTextBody(), $matches),
        );

        $otpLogin = $this->postJson('/api/auth/admin-otp', [
            'email' => 'dashboard-admin@example.test',
            'otp' => $matches[1],
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.role', 'Admin')
            ->assertJsonStructure(['token', 'user']);

        $this->withToken((string) $otpLogin->json('token'))
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('email', 'dashboard-admin@example.test');
        $this->withToken((string) $otpLogin->json('token'))
            ->getJson('/api/admin/stats')
            ->assertOk()
            ->assertJsonPath('totalProperties', 2);

        $this->postJson('/api/auth/admin-otp', [
            'email' => 'dashboard-admin@example.test',
            'otp' => $matches[1],
        ])->assertBadRequest();

        $this->assertSame(200, $verification->status());
    }
}
