<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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
}
