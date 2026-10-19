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

    public function test_production_health_is_unavailable_until_core_normalization_is_active(): void
    {
        $this->app['env'] = 'production';
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode(['users' => [], 'properties' => []]),
        ]);

        $this->getJson('/api/healthz')
            ->assertStatus(503)
            ->assertJsonPath('status', 'degraded')
            ->assertJsonPath('normalizedCoreStorage', 'not_active');
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

    public function test_forgot_password_sends_a_reset_email_through_the_configured_transport(): void
    {
        JsonStore::reset();
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'users' => [[
                    'id' => 8,
                    'email' => 'reset-test@example.test',
                    'name' => 'Reset Test',
                    'password' => 'pbkdf2:unused:unused',
                ]],
            ]),
        ]);
        JsonStore::reset();
        config([
            'mail.default' => 'array',
            'mail.mailers.array' => ['transport' => 'array'],
            'mail.mailers.smtp.username' => 'test-smtp-user',
            'mail.mailers.smtp.password' => 'test-smtp-password',
        ]);

        $this->postJson('/api/auth/forgot-password', ['email' => 'reset-test@example.test'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('smtpOff', false);

        $sent = app('mail.manager')->mailer()->getSymfonyTransport()->messages();
        $this->assertCount(1, $sent);
        $message = $sent->first()->getOriginalMessage();
        $this->assertSame('OG Landmark — Password Reset Code', $message->getSubject());
        $this->assertSame('reset-test@example.test', $message->getTo()[0]->getAddress());
        $body = (string) $message->getTextBody();
        $this->assertStringContainsString('reset code', strtolower($body));
        $this->assertSame(1, preg_match('/\b(\d{6})\b/', $body, $matches));

        $this->postJson('/api/auth/reset-password', [
            'email' => 'reset-test@example.test',
            'code' => $matches[1],
            'newPassword' => 'UpdatedPassword123',
        ])->assertOk()->assertJsonPath('success', true);

        $this->postJson('/api/auth/login', [
            'identifier' => 'reset-test@example.test',
            'password' => 'UpdatedPassword123',
        ])->assertOk()->assertJsonPath('user.email', 'reset-test@example.test');
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

    public function test_normalization_is_dry_run_by_default_and_preserves_live_api_payloads_when_applied(): void
    {
        JsonStore::reset();
        $password = 'TestPassword123';
        $salt = 'normalization-fixture';
        $hash = hash_pbkdf2('sha512', $password, $salt, 100000, 128, false);
        $document = [
            'users' => [[
                'id' => 9,
                'email' => 'normalized-seller@example.com',
                'name' => 'Normalized Seller',
                'role' => 'Buyer',
                'status' => 'Active',
                'password' => "pbkdf2:{$salt}:{$hash}",
                'profilePhoto' => '/images/uploads/seller.jpg',
                'customLegacyField' => ['keep' => true],
            ]],
            'properties' => [[
                'id' => 41,
                'title' => 'Normalized active listing',
                'sellerId' => 9,
                'approvalStatus' => 'Active',
                'listingStatus' => 'Active',
                'price' => 1250000,
                'images' => ['/images/uploads/listing.jpg'],
                'videoUrl' => '/images/uploads/tour.mp4',
            ]],
            'mobileAgents' => [[
                'id' => 'agent-1',
                'displayName' => 'Mobile Agent',
                'city' => 'Lahore',
                'photo' => '/images/uploads/agent.jpg',
            ]],
            'cityAgents' => [],
            'notifications' => [['id' => 501, 'message' => 'Not part of normalization']],
            'nextId' => 700,
        ];
        $legacyJson = json_encode($document, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        DB::table('app_data')->insert([
            'id' => 1,
            'data' => $legacyJson,
        ]);

        $this->artisan('data:normalize-core')->assertExitCode(0);
        $this->assertDatabaseCount('app_users', 0);
        $this->assertDatabaseCount('properties', 0);
        $this->assertDatabaseCount('agents', 0);
        $this->assertDatabaseCount('media_assets', 0);
        $this->assertDatabaseCount('normalization_state', 0);

        $this->artisan('data:normalize-core', ['--apply' => true])->assertExitCode(0);
        $this->assertDatabaseHas('normalization_state', ['state_key' => 'core-entities-v1']);
        $this->assertDatabaseCount('app_users', 1);
        $this->assertDatabaseCount('properties', 1);
        $this->assertDatabaseCount('agents', 1);
        $this->assertDatabaseCount('media_assets', 4);
        $this->assertSame($legacyJson, (string) DB::table('app_data')->where('id', 1)->value('data'));

        JsonStore::reset();
        $normalized = JsonStore::read();
        $this->assertSame($document['users'], $normalized['users']);
        $this->assertSame($document['properties'], $normalized['properties']);
        $this->assertSame($document['mobileAgents'], $normalized['mobileAgents']);
        $this->assertSame($document['cityAgents'], $normalized['cityAgents']);
        $this->assertSame($document['notifications'], $normalized['notifications']);

        $login = $this->postJson('/api/auth/login', [
            'identifier' => 'normalized-seller@example.com',
            'password' => $password,
        ])->assertOk()
            ->assertJsonPath('user.email', 'normalized-seller@example.com');

        $token = (string) $login->json('token');
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/properties')
            ->assertOk()
            ->assertJsonPath('0.id', 41)
            ->assertJsonPath('0.images.0', '/images/uploads/listing.jpg');
    }

    public function test_json_store_dual_writes_core_collections_after_normalization(): void
    {
        JsonStore::reset();
        $document = [
            'users' => [],
            'properties' => [],
            'mobileAgents' => [],
            'cityAgents' => [],
            'notifications' => [],
            'nextId' => 1,
        ];
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode($document),
        ]);
        $this->artisan('data:normalize-core', ['--apply' => true])->assertExitCode(0);

        $document['properties'][] = [
            'id' => 22,
            'title' => 'Dual-written property',
            'sellerId' => 3,
            'images' => ['/images/uploads/dual-write.jpg'],
        ];
        JsonStore::write($document);

        $this->assertDatabaseHas('properties', [
            'id' => 22,
            'title' => 'Dual-written property',
        ]);
        $this->assertDatabaseHas('media_assets', [
            'owner_type' => 'properties',
            'owner_id' => '22',
            'url' => '/images/uploads/dual-write.jpg',
        ]);
        JsonStore::reset();
        $this->assertSame($document['properties'], JsonStore::read()['properties']);
    }

    public function test_agent_cover_photo_requires_admin_enabled_agent_access(): void
    {
        JsonStore::reset();
        $password = 'CoverAccessTest123';
        $makeUser = static function (int $id, string $email, string $role) use ($password): array {
            $salt = "cover-fixture-{$id}";
            $hash = hash_pbkdf2('sha512', $password, $salt, 100000, 128, false);

            return [
                'id' => $id,
                'name' => ucfirst(strtok($email, '@')),
                'email' => $email,
                'role' => $role,
                'status' => 'Active',
                'password' => "pbkdf2:{$salt}:{$hash}",
            ];
        };

        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'users' => [
                    $makeUser(10, 'agent@example.test', 'Agent'),
                    $makeUser(11, 'buyer@example.test', 'Buyer'),
                    $makeUser(12, 'admin@example.test', 'Admin'),
                ],
            ]),
        ]);
        JsonStore::reset();

        $agentToken = $this->postJson('/api/auth/login', [
            'identifier' => 'agent@example.test',
            'password' => $password,
        ])->assertOk()->json('token');
        $buyerToken = $this->postJson('/api/auth/login', [
            'identifier' => 'buyer@example.test',
            'password' => $password,
        ])->assertOk()->json('token');
        $adminToken = $this->postJson('/api/auth/login', [
            'identifier' => 'admin@example.test',
            'password' => $password,
        ])->assertOk()->json('token');

        $this->withToken($agentToken)
            ->getJson('/api/account/cover-photo')
            ->assertForbidden();
        $this->withToken($agentToken)
            ->putJson('/api/account/cover-photo', ['url' => '/images/agent-cover.jpg'])
            ->assertForbidden();

        $this->withToken($adminToken)
            ->patchJson('/api/admin/users/10/agent-cover-access', ['enabled' => true])
            ->assertOk()
            ->assertJsonPath('agentCoverUploadEnabled', true);
        $this->withToken($adminToken)
            ->patchJson('/api/admin/users/11/agent-cover-access', ['enabled' => true])
            ->assertUnprocessable();

        $this->withToken($agentToken)
            ->putJson('/api/account/cover-photo', ['url' => '/images/agent-cover.jpg'])
            ->assertOk()
            ->assertJsonPath('url', '/images/agent-cover.jpg');

        $this->withToken($buyerToken)
            ->putJson('/api/users/11', ['coverPhoto' => '/images/bypass.jpg'])
            ->assertForbidden();
        $this->withToken($buyerToken)
            ->putJson('/api/account', ['coverPhoto' => '/images/bypass.jpg'])
            ->assertForbidden();

        $this->withToken($adminToken)
            ->patchJson('/api/admin/users/10/role', ['role' => 'user'])
            ->assertOk()
            ->assertJsonPath('agentCoverUploadEnabled', false);
        $this->withToken($agentToken)
            ->deleteJson('/api/account/cover-photo')
            ->assertForbidden();
    }
}