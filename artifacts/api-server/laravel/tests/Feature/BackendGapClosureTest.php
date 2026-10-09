<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class BackendGapClosureTest extends TestCase
{
    use RefreshDatabase;

    private ?string $mediaStorageDirectory = null;
    private ?string $previousMediaStorageDirectory = null;

    protected function tearDown(): void
    {
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
        $this->mediaStorageDirectory = sys_get_temp_dir() . '/og-landmark-banner-tests-' . bin2hex(random_bytes(8));
        putenv('MEDIA_STORAGE_DIR=' . $this->mediaStorageDirectory);
        $_ENV['MEDIA_STORAGE_DIR'] = $this->mediaStorageDirectory;
        $_SERVER['MEDIA_STORAGE_DIR'] = $this->mediaStorageDirectory;
    }

    private function removeDirectory(string $directory): void
    {
        foreach (array_diff(scandir($directory) ?: [], ['.', '..']) as $entry) {
            $path = $directory . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) $this->removeDirectory($path);
            else @unlink($path);
        }
        @rmdir($directory);
    }

    private function seedData(array $data): void
    {
        JsonStore::reset();
        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode($data),
        ]);
        JsonStore::reset();
    }

    private function user(int $id, string $email, string $role, string $password = 'TestPassword123'): array
    {
        $salt = 'gap-test-' . $id;
        $hash = hash_pbkdf2('sha512', $password, $salt, 100000, 128, false);

        return [
            'id' => $id,
            'email' => $email,
            'name' => ucfirst($role) . ' Test',
            'role' => $role,
            'status' => 'Active',
            'password' => "pbkdf2:{$salt}:{$hash}",
        ];
    }

    private function token(string $email): string
    {
        $response = $this->postJson('/api/auth/login', [
            'identifier' => $email,
            'password' => 'TestPassword123',
        ])->assertOk();

        return (string) $response->json('token');
    }

    public function test_seller_registration_preserves_the_requested_role(): void
    {
        $this->seedData(['users' => [], 'properties' => []]);

        $this->postJson('/api/auth/register', [
            'email' => 'seller@example.com',
            'password' => 'TestPassword123',
            'name' => 'New Seller',
            'phone' => '03001234567',
            'role' => 'seller',
        ])
            ->assertCreated()
            ->assertJsonPath('user.role', 'Seller');

        $this->postJson('/api/auth/register', [
            'email' => 'developer@example.com',
            'password' => 'TestPassword123',
            'name' => 'New Developer',
            'phone' => '03007654321',
            'role' => 'developer',
        ])
            ->assertCreated()
            ->assertJsonPath('user.role', 'Developer');
    }

    public function test_buyer_registration_returns_a_session_usable_by_dashboard_requests(): void
    {
        $this->seedData(['users' => [], 'properties' => [], 'savedProperties' => []]);

        $registration = $this->postJson('/api/auth/register', [
            'email' => 'buyer-dashboard@example.test',
            'password' => 'TestPassword123',
            'name' => 'Dashboard Buyer',
            'phone' => '03001234567',
            'role' => 'buyer',
        ])
            ->assertCreated()
            ->assertJsonPath('user.role', 'Buyer');

        $token = (string) $registration->json('token');
        $this->assertNotSame('', $token);

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('email', 'buyer-dashboard@example.test')
            ->assertJsonPath('role', 'Buyer');
    }

    public function test_mobile_signup_listing_admin_review_and_publication_work_end_to_end(): void
    {
        $this->useTemporaryMediaStorage();
        $this->seedData([
            'users' => [$this->user(1, 'mobile-flow-admin@example.test', 'Admin')],
            'properties' => [],
            'nextId' => 2,
        ]);
        config([
            'mail.default' => 'array',
            'mail.mailers.array' => ['transport' => 'array'],
            'mail.mailers.smtp.username' => 'mobile-flow-test-smtp-user',
            'mail.mailers.smtp.password' => 'mobile-flow-test-smtp-password',
        ]);

        // Match the mobile client's signup payload and ensure registration
        // returns a session that can immediately submit a property.
        $registration = $this->postJson('/api/auth/register', [
            'firstName' => 'Mobile',
            'lastName' => 'Listing QA',
            'username' => 'mobile-listing-qa',
            'email' => 'mobile-listing-qa@example.test',
            'phone' => '03001234567',
            'password' => 'TestPassword123',
            'confirmPassword' => 'TestPassword123',
            'role' => 'buyer',
            'city' => 'Okara',
        ])->assertCreated()
            ->assertJsonPath('user.role', 'Buyer');

        $buyerId = $registration->json('user.id');
        $buyerToken = (string) $registration->json('token');
        $this->assertNotSame('', $buyerToken);
        $this->withToken($buyerToken)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('id', $buyerId)
            ->assertJsonPath('role', 'Buyer');

        // Exercise the same authenticated, single-photo upload used by mobile.
        $upload = $this->post('/api/upload/single', [
            'image' => UploadedFile::fake()->image('mobile-qa-house.jpg')->size(40),
        ], ['Authorization' => "Bearer {$buyerToken}"])->assertOk();
        $imageUrl = (string) $upload->json('url');
        $this->assertNotSame('', $imageUrl);
        $uploadedPath = parse_url($imageUrl, PHP_URL_PATH);
        $this->assertFileExists(
            $this->mediaStorageDirectory . DIRECTORY_SEPARATOR . basename((string) $uploadedPath),
        );
        $this->get($uploadedPath)->assertOk();
        $secondUpload = $this->post('/api/upload/single', [
            'image' => UploadedFile::fake()->image('mobile-qa-house-interior.jpg')->size(40),
        ], ['Authorization' => "Bearer {$buyerToken}"])->assertOk();
        $secondImageUrl = (string) $secondUpload->json('url');
        $this->assertNotSame('', $secondImageUrl);
        $secondUploadedPath = parse_url($secondImageUrl, PHP_URL_PATH);
        $this->assertFileExists(
            $this->mediaStorageDirectory . DIRECTORY_SEPARATOR . basename((string) $secondUploadedPath),
        );
        $this->get($secondUploadedPath)->assertOk();

        $property = $this->postJson('/api/properties', [
            'title' => 'QA-only mobile house listing',
            'type' => 'House',
            'status' => 'For Sale',
            'submissionState' => 'submitted',
            'price' => 18000000,
            'area' => 5,
            'areaUnit' => 'Marla',
            'bedrooms' => 3,
            'bathrooms' => 2,
            'city' => 'Okara',
            'address' => 'QA-only test address',
            'description' => 'Temporary development workflow test listing; not for sale.',
            'lat' => 30.8086123,
            'lng' => 73.4537654,
            'images' => [$imageUrl, $secondImageUrl],
            'coverImage' => $imageUrl,
            'location' => [
                'latitude' => 30.8086123,
                'longitude' => 73.4537654,
                'city' => 'Okara',
                'district' => 'Okara',
                'locality' => 'QA Test Area',
                'address' => 'QA-only test address',
                'source' => 'manual',
            ],
        ], ['Authorization' => "Bearer {$buyerToken}"])
            ->assertCreated()
            ->assertJsonPath('sellerId', $buyerId)
            ->assertJsonPath('approvalStatus', 'Pending')
            ->assertJsonPath('listingStatus', 'Pending')
            ->assertJsonCount(2, 'images')
            ->assertJsonPath('images.0', $imageUrl)
            ->assertJsonPath('images.1', $secondImageUrl)
            ->assertJsonPath('lat', 30.8086123)
            ->assertJsonPath('lng', 73.4537654)
            ->assertJsonPath('location.latitude', 30.8086123)
            ->assertJsonPath('location.longitude', 73.4537654);
        $propertyId = $property->json('id');

        // Sign in through the same OTP-gated admin flow used by the app.
        $this->postJson('/api/auth/admin-verify', [
            'email' => 'mobile-flow-admin@example.test',
            'password' => 'TestPassword123',
        ])->assertOk()->assertJsonPath('success', true);

        $sent = app('mail.manager')->mailer()->getSymfonyTransport()->messages();
        $this->assertCount(1, $sent);
        $message = $sent->first()->getOriginalMessage();
        $this->assertSame('mobile-flow-admin@example.test', $message->getTo()[0]->getAddress());
        $this->assertSame(
            1,
            preg_match('/\b(\d{6})\b/', (string) $message->getTextBody(), $matches),
        );

        $adminLogin = $this->postJson('/api/auth/admin-otp', [
            'email' => 'mobile-flow-admin@example.test',
            'otp' => $matches[1],
        ])->assertOk()
            ->assertJsonPath('user.role', 'Admin');
        $adminToken = (string) $adminLogin->json('token');

        $this->withToken($adminToken)
            ->getJson('/api/admin/properties?status=Pending')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $propertyId)
            ->assertJsonPath('0.images.0', $imageUrl)
            ->assertJsonPath('0.images.1', $secondImageUrl)
            ->assertJsonPath('0.coverImage', $imageUrl)
            ->assertJsonPath('0.lat', 30.8086123)
            ->assertJsonPath('0.lng', 73.4537654)
            ->assertJsonPath('0.location.latitude', 30.8086123)
            ->assertJsonPath('0.location.longitude', 73.4537654);
        $this->withToken($adminToken)
            ->getJson("/api/admin/properties/{$propertyId}/review")
            ->assertOk()
            ->assertJsonPath('property.id', $propertyId)
            ->assertJsonPath('property.images.0', $imageUrl)
            ->assertJsonPath('property.images.1', $secondImageUrl)
            ->assertJsonPath('property.coverImage', $imageUrl)
            ->assertJsonPath('property.lat', 30.8086123)
            ->assertJsonPath('property.lng', 73.4537654)
            ->assertJsonPath('property.location.latitude', 30.8086123)
            ->assertJsonPath('property.location.longitude', 73.4537654)
            ->assertJsonPath('seller.id', $buyerId)
            ->assertJsonPath('seller.role', 'Buyer')
            ->assertJsonCount(0, 'audit');

        $this->putJson("/api/properties/{$propertyId}", [
            'lat' => 31.1234567,
            'lng' => 72.7654321,
            'location' => [
                'latitude' => 31.1234567,
                'longitude' => 72.7654321,
                'address' => 'QA-only updated test address',
                'city' => 'Okara',
                'source' => 'map_tap',
            ],
        ], ['Authorization' => "Bearer {$adminToken}"])
            ->assertOk()
            ->assertJsonPath('lat', 31.1234567)
            ->assertJsonPath('lng', 72.7654321)
            ->assertJsonPath('location.latitude', 31.1234567)
            ->assertJsonPath('location.longitude', 72.7654321);
        $this->withoutHeader('Authorization')
            ->getJson("/api/properties/{$propertyId}")
            ->assertNotFound();

        $this->patchJson(
            "/api/properties/{$propertyId}/approve",
            [],
            ['Authorization' => "Bearer {$adminToken}"],
        )->assertOk()
            ->assertJsonPath('approvalStatus', 'Active')
            ->assertJsonPath('listingStatus', 'Active');

        $this->getJson("/api/properties/{$propertyId}")
            ->assertOk()
            ->assertJsonPath('approvalStatus', 'Active')
            ->assertJsonPath('listingStatus', 'Active');
        $this->withToken($adminToken)
            ->getJson("/api/admin/properties/{$propertyId}/review")
            ->assertOk()
            ->assertJsonCount(1, 'audit')
            ->assertJsonPath('audit.0.action', 'approve')
            ->assertJsonPath('audit.0.toStatus', 'Active');
    }

    public function test_registration_requires_a_valid_mobile_number(): void
    {
        $this->seedData(['users' => [], 'properties' => []]);

        $this->postJson('/api/auth/register', [
            'email' => 'no-phone@example.com',
            'password' => 'TestPassword123',
            'name' => 'No Phone',
            'role' => 'buyer',
        ])->assertUnprocessable()->assertJsonValidationErrors('phone');

        $this->postJson('/api/auth/register', [
            'email' => 'invalid-phone@example.com',
            'password' => 'TestPassword123',
            'name' => 'Invalid Phone',
            'phone' => 'not-a-mobile',
            'role' => 'buyer',
        ])->assertUnprocessable()->assertJsonValidationErrors('phone');
    }

    public function test_saved_searches_are_persisted_and_scoped_to_the_signed_in_user(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'buyer-one@example.com', 'Buyer'),
                $this->user(2, 'buyer-two@example.com', 'Buyer'),
            ],
            'savedSearches' => [],
        ]);
        $ownerToken = $this->token('buyer-one@example.com');
        $otherToken = $this->token('buyer-two@example.com');

        $created = $this->postJson('/api/saved-searches', [
            'label' => 'Apartments in Lahore',
            'query' => 'Lahore',
            'filters' => ['type' => 'Apartment', 'minPrice' => '10000000'],
        ], ['Authorization' => "Bearer {$ownerToken}"])
            ->assertCreated()
            ->assertJsonPath('label', 'Apartments in Lahore');
        $id = (string) $created->json('id');

        $this->getJson('/api/saved-searches', ['Authorization' => "Bearer {$ownerToken}"])
            ->assertOk()
            ->assertJsonCount(1);
        $this->getJson('/api/saved-searches', ['Authorization' => "Bearer {$otherToken}"])
            ->assertOk()
            ->assertJsonCount(0);
        $this->deleteJson("/api/saved-searches/{$id}", [], ['Authorization' => "Bearer {$otherToken}"])
            ->assertForbidden();
        $this->deleteJson('/api/saved-searches', [], ['Authorization' => "Bearer {$ownerToken}"])
            ->assertNoContent();
        $this->getJson('/api/saved-searches', ['Authorization' => "Bearer {$ownerToken}"])
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_developer_resources_are_owner_scoped_and_public_projects_hide_drafts(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'developer-one@example.com', 'Developer'),
                $this->user(2, 'developer-two@example.com', 'Developer'),
                $this->user(3, 'buyer@example.com', 'Buyer'),
            ],
            'developerProjects' => [
                ['id' => 10, 'developerId' => 1, 'name' => 'Live One', 'approvalStatus' => 'Approved', 'status' => 'Live'],
                ['id' => 11, 'developerId' => 2, 'name' => 'Live Two', 'approvalStatus' => 'Approved', 'status' => 'Live'],
                ['id' => 12, 'developerId' => 1, 'name' => 'Draft', 'approvalStatus' => 'Pending', 'status' => 'Draft'],
            ],
            'inventoryBlocks' => [
                ['id' => 20, 'developerId' => 1, 'projectId' => 10, 'name' => 'Block A'],
            ],
            'inventoryUnits' => [],
        ]);
        $developerToken = $this->token('developer-one@example.com');
        $otherDeveloperToken = $this->token('developer-two@example.com');
        $buyerToken = $this->token('buyer@example.com');

        $this->getJson('/api/developer/projects', ['Authorization' => "Bearer {$developerToken}"])
            ->assertOk()
            ->assertJsonCount(2);
        $this->getJson('/api/developer/projects/10/blocks', ['Authorization' => "Bearer {$developerToken}"])
            ->assertOk()
            ->assertJsonPath('0.name', 'Block A');
        $this->patchJson('/api/developer/projects/10', ['name' => 'Hijacked'], ['Authorization' => "Bearer {$otherDeveloperToken}"])
            ->assertForbidden();
        $this->getJson('/api/developer/projects', ['Authorization' => "Bearer {$buyerToken}"])
            ->assertForbidden();
        $this->getJson('/api/projects')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_sellers_can_resubmit_corrections_but_cannot_change_other_users_listings(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'seller-one@example.com', 'Seller'),
                $this->user(2, 'seller-two@example.com', 'Seller'),
            ],
            'properties' => [[
                'id' => 41,
                'sellerId' => 1,
                'approvalStatus' => 'Changes Requested',
                'listingStatus' => 'Changes Requested',
                'changeRequest' => 'Add clear photos',
            ]],
        ]);
        $ownerToken = $this->token('seller-one@example.com');
        $otherToken = $this->token('seller-two@example.com');

        $this->patchJson('/api/properties/41/resubmit', [], ['Authorization' => "Bearer {$ownerToken}"])
            ->assertOk()
            ->assertJsonPath('approvalStatus', 'Pending')
            ->assertJsonPath('submissionState', 'submitted');
        $this->patchJson('/api/properties/41/resubmit', [], ['Authorization' => "Bearer {$otherToken}"])
            ->assertForbidden();
    }

    public function test_admin_send_now_creates_preference_aware_notifications_and_pushes(): void
    {
        Http::fake();
        $this->seedData([
            'users' => [
                $this->user(1, 'admin@example.com', 'Admin'),
                $this->user(2, 'buyer-one@example.com', 'Buyer'),
                $this->user(3, 'buyer-two@example.com', 'Buyer'),
            ],
            'notificationPreferences' => [
                '3' => ['announcements' => false],
            ],
            'pushDevices' => [
                ['userId' => 2, 'pushToken' => 'ExponentPushToken[buyer-one]', 'isActive' => true],
            ],
            'notifications' => [],
            'notificationEvents' => [],
            'announcements' => [],
        ]);
        $adminToken = $this->token('admin@example.com');

        $response = $this->postJson('/api/admin/announcements', [
            'title' => 'Important update',
            'message' => 'Please read this.',
            'type' => 'important',
            'priority' => 'HIGH',
            'audience' => ['role' => 'buyer'],
            'sendNow' => true,
        ], ['Authorization' => "Bearer {$adminToken}"])
            ->assertCreated()
            ->assertJsonPath('status', 'sent')
            ->assertJsonPath('recipientCount', 1);

        $id = $response->json('id');
        $this->getJson("/api/announcements/{$id}")
            ->assertOk()
            ->assertJsonPath('title', 'Important update');
        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request): bool =>
            $request->url() === 'https://exp.host/--/api/v2/push/send'
            && $request['to'] === 'ExponentPushToken[buyer-one]'
        );
    }

    public function test_notification_category_filter_and_user_delete_do_not_affect_other_users(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'buyer-one@example.com', 'Buyer'),
                $this->user(2, 'buyer-two@example.com', 'Buyer'),
            ],
            'notifications' => [
                ['id' => 101, 'recipientUserId' => 1, 'category' => 'projects', 'read' => false],
                ['id' => 102, 'recipientUserId' => 1, 'category' => 'announcements', 'read' => false],
                ['id' => 103, 'recipientUserId' => 2, 'category' => 'projects', 'read' => false],
            ],
        ]);
        $token = $this->token('buyer-one@example.com');

        $this->getJson('/api/notifications?category=projects', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.id', 101);
        $this->patchJson('/api/notifications/mark-all-read', ['category' => 'projects'], ['Authorization' => "Bearer {$token}"])
            ->assertOk();
        JsonStore::reset();
        $afterRead = JsonStore::read();
        $this->assertTrue($afterRead['notifications'][0]['read']);
        $this->assertFalse($afterRead['notifications'][1]['read']);

        $this->deleteJson('/api/notifications/103', [], ['Authorization' => "Bearer {$token}"])
            ->assertNotFound();
        $this->deleteJson('/api/notifications/101', [], ['Authorization' => "Bearer {$token}"])
            ->assertNoContent();

        JsonStore::reset();
        $saved = JsonStore::read();
        $this->assertNotEmpty($saved['notifications'][0]['userDeletedAt']);
        $this->assertEmpty($saved['notifications'][2]['userDeletedAt'] ?? null);
    }

    public function test_mobile_broadcast_creates_notifications_and_sends_push_requests(): void
    {
        Http::fake();
        $this->seedData([
            'users' => [
                $this->user(1, 'admin@example.com', 'Admin'),
                $this->user(2, 'buyer@example.com', 'Buyer'),
            ],
            'pushDevices' => [
                ['userId' => 2, 'pushToken' => 'ExponentPushToken[broadcast-user]', 'isActive' => true],
            ],
            'notifications' => [],
            'notificationEvents' => [],
        ]);
        $adminToken = $this->token('admin@example.com');

        $this->postJson('/api/mobile/push', [
            'title' => 'Service update',
            'body' => 'We have new listings.',
            'data' => ['type' => 'SYSTEM_UPDATE'],
        ], ['Authorization' => "Bearer {$adminToken}"])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('notificationsCreated', 2);

        Http::assertSentCount(1);
        JsonStore::reset();
        $this->assertCount(2, JsonStore::read()['notifications']);
    }

    public function test_conversations_and_messages_are_live_and_participant_scoped(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'buyer-one@example.com', 'Buyer'),
                $this->user(2, 'seller@example.com', 'Seller'),
                $this->user(3, 'buyer-two@example.com', 'Buyer'),
            ],
            'conversations' => [],
        ]);
        $buyerToken = $this->token('buyer-one@example.com');
        $otherBuyerToken = $this->token('buyer-two@example.com');

        $conversation = $this->postJson('/api/conversations', [
            'participants' => [2],
            'propertyId' => 41,
            'propertyTitle' => 'Test property',
        ], ['Authorization' => "Bearer {$buyerToken}"])
            ->assertCreated()
            ->assertJsonPath('propertyTitle', 'Test property');
        $id = $conversation->json('id');

        $this->getJson('/api/conversations', ['Authorization' => "Bearer {$buyerToken}"])
            ->assertOk()
            ->assertJsonCount(1);
        $this->getJson("/api/conversations/{$id}/messages", ['Authorization' => "Bearer {$otherBuyerToken}"])
            ->assertNotFound();
        $this->postJson("/api/conversations/{$id}/messages", [
            'text' => 'Is the property still available?',
            'senderId' => 999,
        ], ['Authorization' => "Bearer {$buyerToken}"])
            ->assertCreated()
            ->assertJsonPath('senderId', 1);
        $this->getJson("/api/conversations/{$id}/messages", ['Authorization' => "Bearer {$buyerToken}"])
            ->assertOk()
            ->assertJsonCount(1);
    }

    public function test_property_inquiry_creates_a_real_conversation_for_the_buyer_and_listing_contacts(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'buyer@example.com', 'Buyer'),
                $this->user(2, 'seller@example.com', 'Seller'),
                $this->user(3, 'agent@example.com', 'Agent'),
            ],
            'properties' => [[
                'id' => 41,
                'title' => 'Verified property title',
                'sellerId' => 2,
                'agentId' => 3,
            ]],
            'inquiries' => [],
            'conversations' => [],
        ]);
        $buyerToken = $this->token('buyer@example.com');
        $sellerToken = $this->token('seller@example.com');
        $agentToken = $this->token('agent@example.com');

        $inquiry = $this->postJson('/api/inquiries', [
            'propertyId' => 41,
            'propertyTitle' => 'Untrusted title',
            'clientName' => 'Buyer Test',
            'message' => 'I would like to arrange a visit.',
            'sellerId' => 999,
            'buyerId' => 999,
        ], ['Authorization' => "Bearer {$buyerToken}"])
            ->assertCreated()
            ->assertJsonPath('sellerId', 2)
            ->assertJsonPath('buyerId', 1)
            ->assertJsonPath('propertyTitle', 'Verified property title');
        $conversationId = $inquiry->json('conversationId');
        $this->assertNotNull($conversationId);

        $this->getJson('/api/conversations', ['Authorization' => "Bearer {$buyerToken}"])
            ->assertOk()
            ->assertJsonPath('0.id', $conversationId)
            ->assertJsonPath('0.otherUserName', 'Seller Test')
            ->assertJsonPath('0.lastMessage', 'I would like to arrange a visit.');
        $this->getJson('/api/conversations', ['Authorization' => "Bearer {$sellerToken}"])
            ->assertOk()
            ->assertJsonPath('0.otherUserName', 'Buyer Test');
        $this->getJson("/api/conversations/{$conversationId}/messages", ['Authorization' => "Bearer {$agentToken}"])
            ->assertOk()
            ->assertJsonPath('0.senderId', 1)
            ->assertJsonPath('0.text', 'I would like to arrange a visit.');
    }

    public function test_admin_login_does_not_succeed_without_configured_email_delivery(): void
    {
        $this->seedData([
            'users' => [$this->user(1, 'admin@example.com', 'Admin')],
        ]);
        config([
            'mail.mailers.smtp.username' => null,
            'mail.mailers.smtp.password' => null,
        ]);

        $this->postJson('/api/auth/admin-verify', [
            'email' => 'admin@example.com',
            'password' => 'TestPassword123',
        ])->assertStatus(503);

        $this->postJson('/api/auth/admin-otp', [
            'email' => 'admin@example.com',
            'otp' => '123456',
        ])->assertStatus(400);
    }

    public function test_mobile_banner_read_seeds_canonical_records_and_stably_orders_active_items(): void
    {
        $this->seedData([
            'users' => [$this->user(1, 'admin@example.com', 'Admin')],
            'banners' => [[
                'id' => 81,
                'type' => 'video',
                'category' => 'video',
                'imageUrl' => '/images/uploads/existing.mp4',
                'active' => true,
                'order' => -1,
            ]],
        ]);
        $adminToken = $this->token('admin@example.com');

        $this->getJson('/api/mobile/banners')
            ->assertOk()
            ->assertJsonCount(6)
            ->assertJsonPath('0.id', 81)
            ->assertJsonPath('1.category', 'homes')
            ->assertJsonPath('2.category', 'commercial')
            ->assertJsonPath('3.category', 'agriculture')
            ->assertJsonPath('4.category', 'plots')
            ->assertJsonPath('5.category', 'projects')
            ->assertJsonPath('1.imageUrl', '/images/mobile-banners/homes.jpg')
            ->assertJsonPath('1.route', '/explore')
            ->assertJsonPath('1.ctaParams.category', 'Homes')
            ->assertJsonPath('1.ctaParams.propertyType', 'House');

        $secondRead = $this->getJson('/api/mobile/banners')->assertOk();
        $this->assertCount(6, $secondRead->json());
        $this->assertSame(
            [
                ['Homes', 'House'],
                ['Commercial', 'Commercial'],
                ['Agriculture Land', 'Agriculture Land'],
                ['Plots', 'Plot'],
                ['Projects', 'Project'],
            ],
            array_map(fn ($banner) => [
                $banner['ctaParams']['category'],
                $banner['ctaParams']['propertyType'],
            ], array_slice($secondRead->json(), 1)),
        );
        foreach (array_slice($secondRead->json(), 1) as $seededBanner) {
            $this->assertIsInt($seededBanner['id']);
        }

        $this->patchJson('/api/mobile/banners/81', ['title' => 'Legacy metadata patch'], ['Authorization' => "Bearer {$adminToken}"])
            ->assertOk()
            ->assertJsonPath('banner.title', 'Legacy metadata patch')
            ->assertJsonPath('banner.active', true);
        $this->patchJson('/api/mobile/banners/81/toggle', [], ['Authorization' => "Bearer {$adminToken}"])
            ->assertOk()
            ->assertJsonPath('active', false);
        $this->getJson('/api/mobile/banners')->assertOk()->assertJsonCount(5);
        $this->getJson('/api/mobile/banners/all', ['Authorization' => "Bearer {$adminToken}"])
            ->assertOk()
            ->assertJsonCount(6)
            ->assertJsonPath('0.id', 81);

        JsonStore::reset();
        $saved = JsonStore::read();
        $this->assertArrayHasKey('mobileBanners', $saved);
        $this->assertArrayNotHasKey('banners', $saved);
        $this->assertTrue($saved['mobileBannersSeeded']);
        $this->assertSame('Agriculture Land', $saved['mobileBanners'][3]['ctaParams']['propertyType']);
    }

    public function test_banner_admin_read_authorization_precedes_initialization_or_mutation(): void
    {
        $this->seedData(['users' => [
            $this->user(1, 'admin@example.com', 'Admin'),
            $this->user(2, 'buyer@example.com', 'Buyer'),
        ]]);

        $this->getJson('/api/mobile/banners/all')->assertUnauthorized();
        $buyerToken = $this->token('buyer@example.com');
        $this->getJson('/api/mobile/banners/all', ['Authorization' => "Bearer {$buyerToken}"])->assertForbidden();

        JsonStore::reset();
        $saved = JsonStore::read();
        $this->assertArrayNotHasKey('mobileBannersSeeded', $saved);
        $this->assertArrayNotHasKey('mobileBanners', $saved);
        $this->assertArrayNotHasKey('banners', $saved);
    }

    public function test_admin_can_upsert_image_categories_and_append_uploaded_video_banners(): void
    {
        $this->useTemporaryMediaStorage();
        $this->seedData(['users' => [$this->user(1, 'admin@example.com', 'Admin')]]);
        $adminToken = $this->token('admin@example.com');
        $headers = ['Authorization' => "Bearer {$adminToken}"];

        $first = $this->post('/api/mobile/banners', [
            'media' => UploadedFile::fake()->image('homes.jpg')->size(40),
            'type' => 'image',
            'category' => 'homes',
            'eyebrow' => 'First',
            'title' => 'First title',
            'subtitle' => 'First subtitle',
            'cta' => 'Explore',
            'route' => '/explore',
            'ctaParams' => '{"type":"House"}',
            'order' => 2,
            'active' => '0',
        ], $headers)->assertCreated();
        $firstBanner = $first->json('banner');
        $this->assertStringStartsWith('/images/uploads/', $firstBanner['imageUrl']);
        $this->assertSame(['type' => 'House'], $firstBanner['ctaParams']);
        $this->assertFileExists($this->mediaStorageDirectory . '/' . basename($firstBanner['imageUrl']));

        $second = $this->post('/api/mobile/banners', [
            'media' => UploadedFile::fake()->image('homes-new.png')->size(40),
            'type' => 'image',
            'category' => 'homes',
            'title' => 'Updated title',
            'order' => 1,
        ], $headers)->assertOk();
        $this->assertSame((string) $firstBanner['id'], (string) $second->json('banner.id'));
        $this->assertSame('Updated title', $second->json('banner.title'));
        $this->assertFalse($second->json('banner.active'));
        $this->assertFileDoesNotExist($this->mediaStorageDirectory . '/' . basename($firstBanner['imageUrl']));

        $put = $this->putJson('/api/mobile/banners/' . $second->json('banner.id'), [
            'ctaParams' => '{"category":"Homes","propertyType":"House"}',
        ], $headers)->assertOk();
        $this->assertSame(['category' => 'Homes', 'propertyType' => 'House'], $put->json('banner.ctaParams'));

        $video = $this->post('/api/mobile/banners', [
            'media' => UploadedFile::fake()->create('tour.mp4', 512, 'video/mp4'),
            'type' => 'video',
            'category' => 'commercial',
            'title' => 'Property tour',
            'order' => 8,
        ], $headers)->assertCreated();
        $this->assertSame('commercial', $video->json('banner.category'));
        $this->assertSame('video', $video->json('banner.type'));
        $this->assertStringStartsWith('/images/uploads/', $video->json('banner.videoUrl'));
        $this->assertArrayNotHasKey('imageUrl', $video->json('banner'));
        $this->assertTrue($video->json('banner.active'));

        $this->getJson('/api/mobile/banners/all', $headers)
            ->assertOk()
            ->assertJsonCount(6);
        $this->assertSame(1, collect($this->getJson('/api/mobile/banners/all', $headers)->json())
            ->filter(fn ($banner) => ($banner['category'] ?? null) === 'homes' && ($banner['type'] ?? null) === 'image')
            ->count());
    }

    public function test_banner_delete_keeps_referenced_uploads_and_removes_unreferenced_uploads(): void
    {
        $this->useTemporaryMediaStorage();
        $this->seedData(['users' => [$this->user(1, 'admin@example.com', 'Admin')]]);
        $adminToken = $this->token('admin@example.com');
        $headers = ['Authorization' => "Bearer {$adminToken}"];

        $referenced = $this->post('/api/mobile/banners', [
            'media' => UploadedFile::fake()->image('commercial.jpg')->size(40),
            'type' => 'image',
            'category' => 'commercial',
        ], $headers)->assertCreated()->json('banner');
        $referencedFile = $this->mediaStorageDirectory . '/' . basename($referenced['imageUrl']);
        JsonStore::reset();
        $data = JsonStore::read();
        $data['properties'] = [['id' => 42, 'photo' => $referenced['imageUrl']]];
        JsonStore::write($data);

        $this->deleteJson('/api/mobile/banners/' . $referenced['id'], [], $headers)->assertOk();
        $this->assertFileExists($referencedFile);

        $unreferenced = $this->post('/api/mobile/banners', [
            'media' => UploadedFile::fake()->image('agriculture.jpg')->size(40),
            'type' => 'image',
            'category' => 'agriculture',
        ], $headers)->assertCreated()->json('banner');
        $unreferencedFile = $this->mediaStorageDirectory . '/' . basename($unreferenced['imageUrl']);
        $this->assertFileExists($unreferencedFile);
        $this->deleteJson('/api/mobile/banners/' . $unreferenced['id'], [], $headers)->assertOk();
        $this->assertFileDoesNotExist($unreferencedFile);
        $this->assertFileExists($referencedFile);
    }

    public function test_admin_mobile_api_can_review_reports_and_update_home_banners(): void
    {
        $this->seedData([
            'users' => [
                $this->user(1, 'admin@example.test', 'Admin'),
                $this->user(2, 'reporter@example.test', 'Buyer'),
            ],
            'properties' => [],
            'reports' => [[
                'id' => 31,
                'propertyId' => 901,
                'reporterId' => 2,
                'reporterName' => 'Buyer Test',
                'reason' => 'Incorrect listing details',
                'description' => 'The listing address does not match the photos.',
                'status' => 'Pending',
                'reportedAt' => now()->toISOString(),
            ]],
            'mobileBanners' => [],
        ]);
        $token = $this->token('admin@example.test');

        $this->withToken($token)
            ->getJson('/api/admin/reports?status=Pending')
            ->assertOk()
            ->assertJsonPath('0.id', 31);

        $this->withToken($token)
            ->patchJson('/api/admin/reports/31', [
                'status' => 'Resolved',
                'adminNote' => 'Reviewed against the listing.',
            ])
            ->assertOk();

        $this->assertSame('Resolved', JsonStore::read()['reports'][0]['status']);

        $this->withToken($token)
            ->getJson('/api/mobile/banners/all')
            ->assertOk()
            ->assertJsonCount(5);

        $this->withToken($token)
            ->postJson('/api/mobile/banners', [
                'type' => 'image',
                'category' => 'homes',
                'title' => 'Updated home banner',
                'subtitle' => 'Updated from the mobile admin panel.',
                'imageUrl' => '/images/mobile-banners/homes.jpg',
            ])
            ->assertOk()
            ->assertJsonPath('banner.title', 'Updated home banner');

        $this->withToken($token)
            ->getJson('/api/mobile/banners/all')
            ->assertOk()
            ->assertJsonPath('0.title', 'Updated home banner');
    }
}