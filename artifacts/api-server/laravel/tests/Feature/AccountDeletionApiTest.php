<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AccountDeletionApiTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'DisposablePass123';

    private ?string $mediaStorageDirectory = null;
    private ?string $previousMediaStorageDirectory = null;

    protected function tearDown(): void
    {
        JsonStore::reset();
        if ($this->mediaStorageDirectory !== null) {
            if (is_dir($this->mediaStorageDirectory)) {
                $this->removeDirectory($this->mediaStorageDirectory);
            }
            if ($this->previousMediaStorageDirectory === null) {
                putenv('MEDIA_STORAGE_DIR');
                unset($_ENV['MEDIA_STORAGE_DIR'], $_SERVER['MEDIA_STORAGE_DIR']);
            } else {
                putenv('MEDIA_STORAGE_DIR=' . $this->previousMediaStorageDirectory);
                $_ENV['MEDIA_STORAGE_DIR'] = $this->previousMediaStorageDirectory;
                $_SERVER['MEDIA_STORAGE_DIR'] = $this->previousMediaStorageDirectory;
            }
        }

        parent::tearDown();
    }

    private function useTemporaryMediaStorage(): void
    {
        $previous = getenv('MEDIA_STORAGE_DIR');
        $this->previousMediaStorageDirectory = $previous === false ? null : (string) $previous;
        $this->mediaStorageDirectory = sys_get_temp_dir() . '/og-account-delete-' . bin2hex(random_bytes(8));
        mkdir($this->mediaStorageDirectory, 0775, true);
        putenv('MEDIA_STORAGE_DIR=' . $this->mediaStorageDirectory);
        $_ENV['MEDIA_STORAGE_DIR'] = $this->mediaStorageDirectory;
        $_SERVER['MEDIA_STORAGE_DIR'] = $this->mediaStorageDirectory;
    }

    private function removeDirectory(string $directory): void
    {
        foreach (array_diff(scandir($directory) ?: [], ['.', '..']) as $entry) {
            $path = $directory . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($directory);
    }

    private function user(int $id, string $email, string $name, string $role): array
    {
        $salt = 'account-deletion-' . $id;
        $hash = hash_pbkdf2('sha512', self::PASSWORD, $salt, 100000, 128, false);

        return [
            'id' => $id,
            'email' => $email,
            'name' => $name,
            'phone' => '+1 555 010' . str_pad((string) $id, 2, '0', STR_PAD_LEFT),
            'role' => $role,
            'status' => 'Active',
            'password' => "pbkdf2:{$salt}:{$hash}",
            ...($id === 41 ? ['profilePhoto' => '/images/uploads/orphan.jpg'] : []),
        ];
    }

    private function seedData(array $data): void
    {
        JsonStore::reset();
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode($data, JSON_THROW_ON_ERROR),
        ]);
        JsonStore::reset();
    }

    private function token(string $email): string
    {
        $response = $this->postJson('/api/auth/login', [
            'identifier' => $email,
            'password' => self::PASSWORD,
        ])->assertOk();

        return (string) $response->json('token');
    }

    public function test_authenticated_account_deletion_cleans_owned_data_and_preserves_shared_records(): void
    {
        $this->useTemporaryMediaStorage();
        file_put_contents($this->mediaStorageDirectory . '/orphan.jpg', 'account-owned fixture upload');
        file_put_contents($this->mediaStorageDirectory . '/shared.jpg', 'shared listing fixture upload');

        $email = 'deletion-target@example.test';
        $otherEmail = 'unrelated-user@example.test';
        $this->seedData([
            'users' => [
                $this->user(41, $email, 'Disposable Seller', 'Seller'),
                $this->user(99, $otherEmail, 'Retained Buyer', 'Buyer'),
            ],
            'properties' => [
                [
                    'id' => 1,
                    'sellerId' => 41,
                    'title' => 'Owned listing',
                    'images' => ['/images/uploads/orphan.jpg'],
                ],
                [
                    'id' => 2,
                    'sellerId' => 99,
                    'agentId' => 41,
                    'agentName' => 'Disposable Seller',
                    'agentPhone' => '+1 555 01041',
                    'images' => ['/images/uploads/shared.jpg'],
                ],
                [
                    'id' => 3,
                    'sellerId' => 99,
                    'agentId' => 99,
                    'images' => ['/images/uploads/shared.jpg'],
                ],
            ],
            'mobileAgents' => [
                ['id' => 'agent-41', 'authUserId' => 41, 'displayName' => 'Disposable Seller'],
                ['id' => 'agent-99', 'authUserId' => 99, 'displayName' => 'Retained Buyer'],
            ],
            'savedProperties' => [41 => [1], 99 => [3]],
            'savedSearches' => [
                ['id' => 'search-41', 'userId' => 41],
                ['id' => 'search-99', 'userId' => 99],
            ],
            'conversations' => [
                [
                    'id' => 'one-to-one',
                    'participantIds' => [41, 99],
                    'participantNames' => ['Disposable Seller', 'Retained Buyer'],
                    'messages' => [
                        ['id' => 'own-conversation-message', 'senderId' => 41, 'text' => 'Remove this message'],
                        ['id' => 'other-conversation-message', 'senderId' => 99, 'text' => 'Keep this message'],
                    ],
                ],
                [
                    'id' => 'group',
                    'participantIds' => [41, 99, 100],
                    'participantNames' => ['Disposable Seller', 'Retained Buyer', 'Third User'],
                    'messages' => [
                        ['id' => 'group-own-message', 'senderId' => 41, 'text' => 'Remove this message'],
                        ['id' => 'group-other-message', 'senderId' => 99, 'text' => 'Keep this message'],
                        ['id' => 'group-third-message', 'senderId' => 100, 'text' => 'Keep this message too'],
                    ],
                ],
            ],
            'messages' => [
                ['id' => 'own-message', 'senderId' => 41, 'text' => 'Remove this message'],
                ['id' => 'other-message', 'senderId' => 99, 'text' => 'Keep this message'],
            ],
        ]);

        $firstToken = $this->token($email);
        $secondToken = $this->token($email);
        $otherToken = $this->token($otherEmail);
        $this->assertSame(2, DB::table('auth_sessions')->where('user_id', 41)->count());
        $this->assertSame(1, DB::table('auth_sessions')->where('user_id', 99)->count());

        DB::table('auth_challenges')->insert([
            [
                'email' => $email,
                'purpose' => 'password-reset',
                'code_hash' => hash('sha256', 'disposable-reset'),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(15),
            ],
            [
                'email' => $email,
                'purpose' => 'email-verification',
                'code_hash' => hash('sha256', 'disposable-verification'),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(15),
            ],
            [
                'email' => $otherEmail,
                'purpose' => 'password-reset',
                'code_hash' => hash('sha256', 'other-user-reset'),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(15),
            ],
        ]);

        $this->deleteJson('/api/account', [], ['Authorization' => "Bearer {$firstToken}"])
            ->assertNoContent();

        $this->assertSame(0, DB::table('auth_sessions')->where('user_id', 41)->count());
        $this->assertSame(1, DB::table('auth_sessions')->where('user_id', 99)->count());
        $this->assertSame(0, DB::table('auth_challenges')->where('email', $email)->count());
        $this->assertSame(1, DB::table('auth_challenges')->where('email', $otherEmail)->count());

        $this->withToken($firstToken)->getJson('/api/account')->assertUnauthorized();
        $this->withToken($secondToken)->getJson('/api/account')->assertUnauthorized();
        $this->withToken($otherToken)->getJson('/api/account')->assertOk();

        JsonStore::reset();
        $stored = JsonStore::read();
        $this->assertSame([99], array_column($stored['users'], 'id'));
        $this->assertSame([2, 3], array_column($stored['properties'], 'id'));
        $this->assertArrayNotHasKey('agentId', $stored['properties'][0]);
        $this->assertArrayNotHasKey('agentName', $stored['properties'][0]);
        $this->assertArrayNotHasKey('agentPhone', $stored['properties'][0]);
        $this->assertSame(['agent-99'], array_column($stored['mobileAgents'], 'id'));
        $this->assertArrayNotHasKey(41, $stored['savedProperties']);
        $this->assertSame([3], $stored['savedProperties'][99]);
        $this->assertSame(['search-99'], array_column($stored['savedSearches'], 'id'));
        $this->assertSame(['other-message'], array_column($stored['messages'], 'id'));
        $this->assertSame(['group'], array_column($stored['conversations'], 'id'));
        $this->assertSame(
            ['group-other-message', 'group-third-message'],
            array_column($stored['conversations'][0]['messages'], 'id'),
        );
        $this->assertStringNotContainsString($email, json_encode($stored));
        $this->assertStringNotContainsString('Disposable Seller', json_encode($stored));

        $this->assertFileDoesNotExist($this->mediaStorageDirectory . '/orphan.jpg');
        $this->assertFileExists($this->mediaStorageDirectory . '/shared.jpg');
    }
}
