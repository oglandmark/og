<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AdminPasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        parent::tearDown();
        JsonStore::reset();
    }

    private function seedAccounts(): void
    {
        JsonStore::reset();
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode([
                'users' => [
                    [
                        'id' => 1,
                        'email' => 'admin-reset@example.test',
                        'name' => 'Test Admin',
                        'role' => 'Admin',
                        'status' => 'Active',
                        'password' => 'pbkdf2:unused:unused',
                    ],
                    [
                        'id' => 2,
                        'email' => 'regular-reset@example.test',
                        'name' => 'Test User',
                        'role' => 'User',
                        'status' => 'Active',
                        'password' => 'pbkdf2:unused:unused',
                    ],
                ],
                'properties' => [],
            ]),
        ]);
        JsonStore::reset();
    }

    public function test_admin_login_has_a_forgot_password_path_and_reset_requests_are_admin_scoped(): void
    {
        $this->seedAccounts();
        config([
            'mail.mailers.smtp.username' => 'preview@example.test',
            'mail.mailers.smtp.password' => 'test-password',
        ]);
        Mail::shouldReceive('raw')->once()->andReturn(null);

        $this->get('/login?role=admin')
            ->assertOk()
            ->assertSee('Forgot your password?')
            ->assertSee(route('admin.password.request'));

        $this->get(route('admin.password.request'))
            ->assertOk()
            ->assertSee('Administrator email')
            ->assertSee('Send reset code');

        $this->postJson('/api/auth/admin-forgot-password', ['email' => 'regular-reset@example.test'])
            ->assertOk()
            ->assertJsonPath('success', true);
        $this->assertDatabaseMissing('auth_challenges', [
            'email' => 'regular-reset@example.test',
            'purpose' => 'password-reset',
        ]);

        $this->postJson('/api/auth/admin-forgot-password', ['email' => 'admin-reset@example.test'])
            ->assertOk()
            ->assertJsonPath('success', true);
        $this->assertDatabaseHas('auth_challenges', [
            'email' => 'admin-reset@example.test',
            'purpose' => 'password-reset',
        ]);
    }

    public function test_reset_code_changes_only_the_admin_password_and_allows_sign_in(): void
    {
        $this->seedAccounts();
        $expiresAt = now()->addMinutes(15)->format('Y-m-d H:i:s');
        DB::table('auth_challenges')->insert([
            [
                'email' => 'regular-reset@example.test',
                'purpose' => 'password-reset',
                'code_hash' => hash('sha256', '123456'),
                'attempts' => 0,
                'expires_at' => $expiresAt,
            ],
            [
                'email' => 'admin-reset@example.test',
                'purpose' => 'password-reset',
                'code_hash' => hash('sha256', '654321'),
                'attempts' => 0,
                'expires_at' => $expiresAt,
            ],
        ]);

        $this->postJson('/api/auth/admin-reset-password', [
            'email' => 'regular-reset@example.test',
            'code' => '123456',
            'newPassword' => 'RegularUserTestPass456',
        ])->assertStatus(400);
        $this->assertDatabaseHas('auth_challenges', [
            'email' => 'regular-reset@example.test',
            'purpose' => 'password-reset',
            'attempts' => 0,
        ]);

        $newPassword = 'AdminResetTestPass789';
        $this->post(route('admin.password.update'), [
            'email' => 'admin-reset@example.test',
            'code' => '654321',
            'newPassword' => $newPassword,
            'newPassword_confirmation' => $newPassword,
        ])->assertRedirect(route('auth.login', ['role' => 'admin']));

        $this->postJson('/api/auth/login', [
            'identifier' => 'admin-reset@example.test',
            'password' => $newPassword,
        ])->assertOk();

        $this->assertDatabaseMissing('auth_challenges', [
            'email' => 'admin-reset@example.test',
            'purpose' => 'password-reset',
        ]);
    }

    public function test_forgot_password_shows_delivery_failure_instead_of_claiming_code_was_sent(): void
    {
        $this->seedAccounts();
        config([
            'mail.mailers.smtp.username' => 'preview@example.test',
            'mail.mailers.smtp.password' => 'test-password',
        ]);
        Mail::shouldReceive('raw')
            ->once()
            ->andThrow(new \RuntimeException('SMTP connection failed'));

        $this->from(route('admin.password.request'))
            ->post(route('admin.password.email'), ['email' => 'admin-reset@example.test'])
            ->assertRedirect(route('admin.password.request'))
            ->assertSessionHasErrors('reset')
            ->assertSessionHas('errors', function ($errors): bool {
                return str_contains($errors->first('reset'), 'could not be delivered');
            });

        $this->assertDatabaseMissing('auth_challenges', [
            'email' => 'admin-reset@example.test',
            'purpose' => 'password-reset',
        ]);
    }

    public function test_reset_email_uses_smtp_mailbox_when_default_from_address_is_null(): void
    {
        $this->seedAccounts();
        config([
            'mail.from.address' => null,
            'mail.mailers.smtp.username' => 'preview@example.test',
            'mail.mailers.smtp.password' => 'test-password',
        ]);

        $message = \Mockery::mock(\Illuminate\Mail\Message::class);
        $message->shouldReceive('from')->once()->with('preview@example.test')->andReturnSelf();
        $message->shouldReceive('to')->once()->with('admin-reset@example.test')->andReturnSelf();
        $message->shouldReceive('subject')->once()->with('OG Landmark — Password Reset Code')->andReturnSelf();
        Mail::shouldReceive('raw')
            ->once()
            ->withArgs(function (string $body, callable $callback) use ($message): bool {
                $callback($message);
                return str_contains($body, 'password reset code');
            })
            ->andReturn(null);

        $this->postJson('/api/auth/admin-forgot-password', ['email' => 'admin-reset@example.test'])
            ->assertOk()
            ->assertJsonPath('smtpOff', false)
            ->assertJsonPath('message', 'Reset code sent. Check your email.');
    }

    public function test_local_admin_test_account_can_sign_in_without_email_otp(): void
    {
        $this->seedAccounts();
        config(['app.env' => 'local']);

        $password = 'Test@123';
        $salt = 'local-preview-admin';
        $hash = hash_pbkdf2('sha512', $password, $salt, 100000, 128, false);
        $data = JsonStore::read();
        $data['users'][] = [
            'id' => 'local-admin-test',
            'email' => 'admin@test.com',
            'name' => 'Local Preview Admin',
            'role' => 'Admin',
            'status' => 'Active',
            'password' => "pbkdf2:{$salt}:{$hash}",
        ];
        JsonStore::write($data);

        $this->post('/login', [
            'role' => 'admin',
            'identifier' => 'admin@test.com',
            'password' => $password,
        ])->assertRedirect('/portal/admin/dashboard');

        $this->get('/portal/admin/dashboard')->assertOk();
        $this->assertDatabaseMissing('auth_challenges', [
            'email' => 'admin@test.com',
            'purpose' => 'admin-login',
        ]);

        config(['app.env' => 'production']);
        $this->postJson('/api/auth/admin-verify', [
            'email' => 'admin@test.com',
            'password' => $password,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonMissingPath('token');
        $this->assertDatabaseHas('auth_challenges', [
            'email' => 'admin@test.com',
            'purpose' => 'admin-login',
        ]);
    }
}
