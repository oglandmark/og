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
        $this->withToken($adminToken)
            ->getJson('/api/users')
            ->assertOk()
            ->assertJsonCount(4)
            ->assertJsonMissingPath('0.password');

        $sellerToken = $this->login('dashboard-seller@example.test');
        $this->withToken($sellerToken)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('role', 'User')
            ->assertJsonPath('accountType', 'User');
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

    public function test_admin_listing_and_user_actions_match_the_dashboard_contract(): void
    {
        $this->seedDashboardFixture();
        $adminToken = $this->login('dashboard-admin@example.test');
        $adminHeaders = ['Authorization' => "Bearer {$adminToken}"];

        $this->patchJson('/api/admin/properties/991', [
            'title' => 'Updated seller listing',
            'price' => 2750000,
            'bedrooms' => 3,
            'images' => ['/images/uploads/front.jpg', '/images/uploads/lounge.jpg'],
            'assignedAgent' => [
                'id' => 'agent-profile-1',
                'name' => 'Assigned Agent',
                'phone' => '03001234567',
                'profileType' => 'profile',
            ],
        ], $adminHeaders)
            ->assertOk()
            ->assertJsonPath('title', 'Updated seller listing')
            ->assertJsonPath('price', 2750000)
            ->assertJsonPath('bedrooms', 3)
            ->assertJsonPath('images.1', '/images/uploads/lounge.jpg')
            ->assertJsonPath('coverImage', '/images/uploads/front.jpg')
            ->assertJsonPath('assignedAgentId', 'agent-profile-1');

        $this->getJson('/api/admin/properties', $adminHeaders)
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.title', 'Updated seller listing');
        $this->getJson('/api/admin/properties/991/review', $adminHeaders)
            ->assertOk()
            ->assertJsonPath('property.id', 991)
            ->assertJsonPath('property.images.0', '/images/uploads/front.jpg');

        $this->patchJson('/api/admin/properties/991', ['bedrooms' => -1], $adminHeaders)
            ->assertStatus(422)
            ->assertJsonStructure(['error', 'errors']);
        $this->patchJson('/api/admin/properties/991', ['title' => 'Unauthenticated edit'])
            ->assertUnauthorized();
        $this->patchJson('/api/admin/properties/991', ['title' => 'Seller edit'], [
            'Authorization' => 'Bearer ' . $this->login('dashboard-seller@example.test'),
        ])->assertForbidden();

        $this->deleteJson('/api/admin/properties/992', [], $adminHeaders)->assertNoContent();
        $this->getJson('/api/admin/properties', $adminHeaders)->assertOk()->assertJsonCount(1);
        $this->deleteJson('/api/admin/properties/992', [], $adminHeaders)->assertNotFound();

        $created = $this->postJson('/api/users', [
            'name' => 'Admin-created User',
            'email' => 'admin-created@example.test',
            'phone' => '+923001112233',
            'password' => 'AdminCreated123',
            'role' => 'User',
            'status' => 'Active',
        ], $adminHeaders)
            ->assertCreated()
            ->assertJsonPath('name', 'Admin-created User')
            ->assertJsonPath('accountType', 'User')
            ->assertJsonPath('status', 'Active')
            ->assertJsonMissingPath('password');
        $newUserId = $created->json('id');
        $this->getJson('/api/users', $adminHeaders)
            ->assertOk()
            ->assertJsonFragment(['id' => $newUserId, 'name' => 'Admin-created User'])
            ->assertJsonMissingPath('0.password');

        $this->putJson("/api/users/{$newUserId}", [
            'name' => 'Updated User',
            'email' => 'updated-user@example.test',
            'phone' => '+923009998877',
            'status' => 'Suspended',
            'password' => 'UpdatedPass123',
        ], $adminHeaders)
            ->assertOk()
            ->assertJsonPath('name', 'Updated User')
            ->assertJsonPath('email', 'updated-user@example.test')
            ->assertJsonPath('status', 'Suspended')
            ->assertJsonMissingPath('password');

        $this->patchJson("/api/admin/users/{$newUserId}/role", ['role' => 'Agent'], $adminHeaders)
            ->assertOk()
            ->assertJsonPath('role', 'Agent')
            ->assertJsonPath('accountType', 'User')
            ->assertJsonPath('permissions.0', 'agent');

        $sellerToken = $this->login('dashboard-seller@example.test');
        $sellerHeaders = ['Authorization' => "Bearer {$sellerToken}"];
        $this->postJson('/api/users', [
            'name' => 'Unauthorized User',
            'email' => 'unauthorized@example.test',
            'password' => 'Unauthorized123',
            'role' => 'Admin',
        ], $sellerHeaders)->assertForbidden();
        $this->putJson('/api/users/903', ['status' => 'Suspended'], $sellerHeaders)->assertForbidden();

        $this->deleteJson("/api/users/{$newUserId}", [], $adminHeaders)->assertNoContent();
        $this->getJson('/api/users', $adminHeaders)->assertOk()->assertJsonMissing(['id' => $newUserId]);
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
        $data['mobileAgents'] = [
            ['id' => 2001, 'authUserId' => 902, 'email' => 'dashboard-seller@example.test'],
            ['id' => 2002, 'authUserId' => 903, 'email' => 'other-agent@example.test'],
        ];
        $data['agentLeads'] = [
            ['id' => 9101, 'userId' => 902, 'agentId' => '902', 'name' => 'Owned lead', 'status' => 'new'],
            ['id' => 9102, 'userId' => 903, 'agentId' => '903', 'name' => 'Other agent lead', 'status' => 'new'],
        ];
        $data['agentVisits'] = [
            ['id' => 9111, 'userId' => 902, 'agentId' => '902', 'date' => now()->toDateString(), 'status' => 'Requested'],
            ['id' => 9112, 'userId' => 903, 'agentId' => '903', 'date' => now()->toDateString(), 'status' => 'Requested'],
        ];
        JsonStore::write($data);

        $agentToken = $this->login('dashboard-seller@example.test');
        $buyerToken = $this->login('dashboard-buyer@example.test');
        $buyerVisit = $this->withToken($buyerToken)
            ->postJson('/api/agent-visits', [
                'agentId' => '2001',
                'clientName' => 'Scheduled client',
                'clientPhone' => '03001234567',
                'propertyTitle' => 'Test listing',
                'propertyCity' => 'Lahore',
                'date' => now()->toDateString(),
                'time' => '10:00 AM',
                'status' => 'Requested',
            ])
            ->assertCreated()
            ->assertJsonPath('agentId', '2001')
            ->assertJsonPath('userId', 904);
        $buyerVisitId = $buyerVisit->json('id');

        $this->withToken($buyerToken)
            ->getJson('/api/agent-visits')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $buyerVisitId);

        $this->withToken($agentToken)
            ->postJson('/api/agent-visits', [
                'agentId' => '903',
                'clientName' => 'Agent client',
                'clientPhone' => '03001234568',
                'propertyTitle' => 'Agent-created visit',
                'propertyCity' => 'Lahore',
                'date' => now()->toDateString(),
                'time' => '11:00 AM',
                'status' => 'Requested',
            ])
            ->assertCreated()
            ->assertJsonPath('agentId', 902);

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
            ->assertJsonCount(3)
            ->assertJsonFragment(['id' => $buyerVisitId])
            ->assertJsonFragment(['id' => 9111])
            ->assertJsonMissing(['id' => 9112]);
        $this->withToken($agentToken)
            ->patchJson('/api/agent-visits/' . $buyerVisitId, [
                'agentId' => '903',
                'status' => 'Confirmed',
            ])
            ->assertOk()
            ->assertJsonPath('agentId', '2001')
            ->assertJsonPath('status', 'Confirmed');
        $this->withToken($agentToken)
            ->patchJson('/api/agent-visits/9112', ['status' => 'Confirmed'])
            ->assertNotFound();
    }

    public function test_admin_login_uses_laravels_two_step_verification_and_returns_a_recoverable_session(): void
    {
        $this->seedDashboardFixture();
        config([
            'mail.default' => 'array',
            'mail.mailers.array' => ['transport' => 'array'],
            'mail.mailers.smtp.username' => 'dashboard-test-smtp-user',
            'mail.mailers.smtp.password' => 'dashboard-test-smtp-password',
        ]);

        $this->postJson('/api/auth/admin-verify', [
            'email' => 'dashboard-seller@example.test',
            'password' => self::PASSWORD,
        ])->assertUnauthorized();
        $this->postJson('/api/auth/admin-verify', [
            'email' => 'dashboard-admin@example.test',
            'password' => 'incorrect-password',
        ])->assertUnauthorized();

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
        $this->withToken((string) $otpLogin->json('token'))
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('success', true);
        $this->withToken((string) $otpLogin->json('token'))
            ->getJson('/api/auth/me')
            ->assertUnauthorized();

        $this->postJson('/api/auth/admin-otp', [
            'email' => 'dashboard-admin@example.test',
            'otp' => $matches[1],
        ])->assertBadRequest();

        $this->assertSame(200, $verification->status());
    }

    public function test_local_admin_login_bypasses_otp_and_still_requires_the_password(): void
    {
        $this->seedDashboardFixture();
        config(['app.env' => 'local']);

        $this->postJson('/api/auth/admin-verify', [
            'email' => 'dashboard-admin@example.test',
            'password' => self::PASSWORD,
        ])->assertOk()->assertJsonStructure(['token', 'user']);

        $this->postJson('/api/auth/admin-verify', [
            'email' => 'dashboard-admin@example.test',
            'password' => 'incorrect-password',
        ])->assertUnauthorized();

        $this->assertSame(0, DB::table('auth_challenges')->where('purpose', 'admin-login')->count());
    }

    public function test_admin_can_trust_this_device_after_otp_but_other_devices_still_need_otp(): void
    {
        $this->seedDashboardFixture();
        config([
            'mail.default' => 'array',
            'mail.mailers.array' => ['transport' => 'array'],
            'mail.mailers.smtp.username' => 'dashboard-test-smtp-user',
            'mail.mailers.smtp.password' => 'dashboard-test-smtp-password',
        ]);

        $this->postJson('/api/auth/admin-verify', [
            'email' => 'dashboard-admin@example.test',
            'password' => self::PASSWORD,
        ])->assertOk()->assertJsonMissingPath('token');

        $sent = app('mail.manager')->mailer()->getSymfonyTransport()->messages();
        $message = $sent->first()->getOriginalMessage();
        preg_match('/\b(\d{6})\b/', (string) $message->getTextBody(), $matches);

        $otpResponse = $this->postJson('/api/auth/admin-otp', [
            'email' => 'dashboard-admin@example.test',
            'otp' => $matches[1],
            'rememberDevice' => true,
        ])->assertOk()->assertJsonStructure(['token', 'user']);

        $cookie = $otpResponse->getCookie('og_admin_trusted_device', false);
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('/api/auth', $cookie->getPath());
        $deviceToken = $cookie->getValue();

        $storedAdmin = collect(JsonStore::read()['users'])->firstWhere('email', 'dashboard-admin@example.test');
        $storedDevice = $storedAdmin['trustedDevices'][0] ?? null;
        $this->assertNotNull($storedDevice);
        $this->assertSame(hash('sha256', $deviceToken), $storedDevice['tokenHash']);
        $this->assertTrue(\Illuminate\Support\Carbon::parse($storedDevice['expiresAt'])->isFuture());
        $this->assertArrayNotHasKey('trustedDevices', $otpResponse->json('user'));

        $trustedLogin = $this->withUnencryptedCookie('og_admin_trusted_device', $deviceToken)
            ->post('/api/auth/admin-verify', [
                'email' => 'dashboard-admin@example.test',
                'password' => self::PASSWORD,
            ]);
        $trustedLogin->assertOk()->assertJsonStructure(['token', 'user']);

        $this->withUnencryptedCookie('og_admin_trusted_device', 'unrecognized-device-token')
            ->post('/api/auth/admin-verify', [
                'email' => 'dashboard-admin@example.test',
                'password' => self::PASSWORD,
            ])
            ->assertOk()
            ->assertJsonMissingPath('token');

        $this->assertCount(2, app('mail.manager')->mailer()->getSymfonyTransport()->messages());
    }

    public function test_agent_admin_messages_and_progress_reports_notify_both_sides(): void
    {
        $this->seedDashboardFixture();
        $adminToken = $this->login('dashboard-admin@example.test');
        $adminHeaders = ['Authorization' => "Bearer {$adminToken}"];
        $this->patchJson('/api/admin/users/902/role', ['role' => 'Agent'], $adminHeaders)->assertOk();
        $agentToken = $this->login('dashboard-seller@example.test');
        $agentHeaders = ['Authorization' => "Bearer {$agentToken}"];

        $agentMessage = $this->postJson('/api/agent-admin-messages', ['text' => 'Please review my area update.'], $agentHeaders)
            ->assertCreated()
            ->assertJsonPath('messages.0.senderRole', 'Agent');
        $threadId = $agentMessage->json('id');
        $this->getJson('/api/agent-admin-messages', $adminHeaders)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $threadId);

        $this->postJson("/api/agent-admin-messages/{$threadId}", ['text' => 'Received, thank you.'], $adminHeaders)
            ->assertCreated()
            ->assertJsonPath('messages.1.senderRole', 'Admin');

        $report = $this->postJson('/api/agent-progress', [
            'date' => now()->format('Y-m-d'),
            'summary' => 'Followed up with assigned clients and completed a site visit.',
            'leadsContacted' => 4,
            'visitsCompleted' => 1,
            'followUps' => 3,
            'blockers' => 'Waiting for updated site plan.',
        ], $agentHeaders)->assertCreated()
            ->assertJsonPath('status', 'submitted');
        $reportId = $report->json('id');

        $this->getJson('/api/agent-progress', $adminHeaders)
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $reportId);
        $this->patchJson("/api/agent-progress/{$reportId}", [
            'status' => 'needs_follow_up',
            'adminNote' => 'Please add the site-plan delivery date.',
        ], $adminHeaders)
            ->assertOk()
            ->assertJsonPath('status', 'needs_follow_up');
        $this->getJson('/api/agent-progress', $agentHeaders)
            ->assertOk()
            ->assertJsonPath('0.adminNote', 'Please add the site-plan delivery date.');

        $this->getJson('/api/notifications', $adminHeaders)
            ->assertOk()
            ->assertJsonFragment(['title' => 'New Agent message'])
            ->assertJsonFragment(['title' => 'Agent daily progress submitted']);
        $this->getJson('/api/notifications', $agentHeaders)
            ->assertOk()
            ->assertJsonFragment(['title' => 'Message from Admin'])
            ->assertJsonFragment(['title' => 'Daily progress reviewed']);
    }
}
