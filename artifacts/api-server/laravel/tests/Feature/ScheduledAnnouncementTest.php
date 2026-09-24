<?php

namespace Tests\Feature;

use App\Services\JsonStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ScheduledAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    public function test_due_announcements_create_per_user_records_respect_preferences_and_send_deduplicated_pushes(): void
    {
        Http::fake();

        $now = now();
        $document = [
            'nextId' => 100,
            'users' => [
                [
                    'id' => 1,
                    'role' => 'Buyer',
                    'city' => 'Lahore',
                    'status' => 'Active',
                    'pushToken' => 'ExponentPushToken[user-one]',
                ],
                [
                    'id' => 2,
                    'role' => 'Agent',
                    'city' => 'Karachi',
                    'status' => 'Active',
                    'pushToken' => 'ExponentPushToken[user-two]',
                ],
                ['id' => 3, 'role' => 'Buyer', 'city' => 'Lahore', 'status' => 'Suspended'],
                ['id' => 4, 'role' => 'Buyer', 'city' => 'Lahore', 'status' => 'Inactive'],
                ['id' => 5, 'role' => 'Buyer', 'city' => 'Lahore', 'status' => 'Active'],
            ],
            'notificationPreferences' => [
                '1' => ['announcements' => true, 'promotional' => true, 'frequency' => 'immediate'],
                '2' => ['announcements' => true, 'frequency' => 'weekly'],
                '5' => ['announcements' => false, 'promotional' => false],
            ],
            'pushDevices' => [
                ['userId' => 1, 'pushToken' => 'ExponentPushToken[user-one]', 'isActive' => true],
                ['userId' => 1, 'pushToken' => 'ExponentPushToken[user-one]', 'isActive' => true],
                ['userId' => 2, 'pushToken' => 'ExponentPushToken[user-two]', 'isActive' => true],
            ],
            'announcements' => [
                [
                    'id' => 88,
                    'title' => 'Important update',
                    'message' => 'Please review this update.',
                    'type' => 'important',
                    'priority' => 'HIGH',
                    'status' => 'scheduled',
                    'scheduleAt' => $now->copy()->subMinute()->toISOString(),
                    'audience' => [],
                ],
                [
                    'id' => 89,
                    'title' => 'Lahore offer',
                    'message' => 'A new offer is available.',
                    'type' => 'promotional',
                    'status' => 'scheduled',
                    'scheduleAt' => $now->copy()->subMinutes(2)->toISOString(),
                    'audience' => ['role' => 'bUyEr', 'city' => 'lAhOrE'],
                ],
                [
                    'id' => 90,
                    'title' => 'Future announcement',
                    'message' => 'Not due yet.',
                    'status' => 'scheduled',
                    'scheduleAt' => $now->copy()->addDay()->toISOString(),
                    'audience' => [],
                ],
            ],
        ];

        DB::table('app_data')->insert([
            'id' => 1,
            'data' => json_encode($document),
        ]);
        JsonStore::reset();

        $this->assertSame(0, Artisan::call('announcements:process-scheduled'));

        $saved = json_decode((string) DB::table('app_data')->where('id', 1)->value('data'), true);
        $announcements = collect($saved['announcements'])->keyBy('id');
        $this->assertSame('sent', $announcements[88]['status']);
        $this->assertSame(2, $announcements[88]['recipientCount']);
        $this->assertSame('sent', $announcements[89]['status']);
        $this->assertSame(1, $announcements[89]['recipientCount']);
        $this->assertSame('scheduled', $announcements[90]['status']);

        $notifications = collect($saved['notifications'])->keyBy('eventKey');
        $this->assertCount(3, $notifications);
        $this->assertSame('IMPORTANT_ANNOUNCEMENT', $notifications['1:announcement:88']['type']);
        $this->assertSame('announcements', $notifications['1:announcement:88']['category']);
        $this->assertSame('PROMOTIONAL_ANNOUNCEMENT', $notifications['1:announcement:89']['type']);
        $this->assertSame('/announcements/89', $notifications['1:announcement:89']['deepLink']);
        $this->assertArrayHasKey('2:announcement:88', $notifications);
        $this->assertArrayNotHasKey('5:announcement:88', $notifications);
        $this->assertArrayNotHasKey('3:announcement:88', $notifications);
        $this->assertArrayNotHasKey('4:announcement:88', $notifications);
        $this->assertSame([
            '1:announcement:88',
            '2:announcement:88',
            '1:announcement:89',
        ], $saved['notificationEvents']);

        // User 1's duplicate device/legacy token receives one push per due
        // announcement. User 2 keeps durable history but defers weekly pushes.
        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request): bool =>
            $request->url() === 'https://exp.host/--/api/v2/push/send'
            && $request['to'] === 'ExponentPushToken[user-one]'
            && $request['channelId'] === 'announcements'
        );
        Http::assertSent(fn (Request $request): bool =>
            $request['data']['announcementId'] === 89
            && $request['data']['category'] === 'promotional'
            && $request['channelId'] === 'promotional'
        );

        // The command is safe to run repeatedly: sent announcements are not
        // duplicated or pushed a second time.
        $this->assertSame(0, Artisan::call('announcements:process-scheduled'));
        Http::assertSentCount(2);
        $savedAgain = json_decode((string) DB::table('app_data')->where('id', 1)->value('data'), true);
        $this->assertCount(3, $savedAgain['notifications']);
    }
}