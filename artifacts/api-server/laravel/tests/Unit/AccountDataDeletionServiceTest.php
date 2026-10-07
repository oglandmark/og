<?php

namespace Tests\Unit;

use App\Services\AccountDataDeletionService;
use PHPUnit\Framework\TestCase;

class AccountDataDeletionServiceTest extends TestCase
{
    public function test_it_removes_private_account_data_and_unlinks_shared_records(): void
    {
        $source = [
            'users' => [
                ['id' => 41, 'name' => 'Ayesha Malik', 'email' => 'ayesha@example.com', 'phone' => '+92 300 1112233', 'profilePhoto' => '/images/uploads/profile.jpg'],
                ['id' => 99, 'name' => 'Other User', 'email' => 'other@example.com'],
            ],
            'properties' => [
                ['id' => 1, 'sellerId' => 41, 'title' => 'Ayesha listing', 'images' => ['/images/uploads/owned.jpg']],
                ['id' => 2, 'sellerId' => 99, 'agentId' => 41, 'agentName' => 'Ayesha Malik', 'agentPhone' => '+92 300 1112233', 'images' => ['/images/uploads/shared.jpg']],
                ['id' => 3, 'sellerId' => 99, 'agentId' => 99, 'images' => ['/images/uploads/shared.jpg']],
            ],
            'mobileAgents' => [
                ['id' => 'agent-41', 'authUserId' => 41, 'displayName' => 'Ayesha Malik', 'profilePhoto' => '/images/uploads/agent.jpg'],
                ['id' => 'agent-99', 'authUserId' => 99, 'displayName' => 'Other User'],
            ],
            'savedProperties' => [41 => [1], 99 => [3]],
            'savedSearches' => [
                ['id' => 'saved-41', 'userId' => 41],
                ['id' => 'saved-99', 'userId' => 99],
            ],
            'notificationPreferences' => [41 => ['email' => true], 99 => ['email' => false]],
            'notifications' => [
                ['id' => 'notice-41', 'recipientUserId' => 41],
                ['id' => 'notice-99', 'recipientUserId' => 99],
            ],
            'notificationEvents' => ['41:property:1', '99:property:3'],
            'pushDevices' => [
                ['id' => 'device-41', 'userId' => 41],
                ['id' => 'device-99', 'userId' => 99],
            ],
            'inquiries' => [
                ['id' => 'inquiry-41', 'buyerId' => 41, 'sellerId' => 99, 'email' => 'ayesha@example.com'],
                ['id' => 'inquiry-99', 'buyerId' => 99, 'sellerId' => 41, 'sellerName' => 'Ayesha Malik', 'sellerPhone' => '+92 300 1112233'],
            ],
            'conversations' => [
                [
                    'id' => 'one-to-one',
                    'participantIds' => [41, 99],
                    'participantNames' => ['Ayesha Malik', 'Other User'],
                    'messages' => [
                        ['senderId' => 41, 'senderName' => 'Ayesha Malik', 'text' => 'My email is ayesha@example.com'],
                        ['senderId' => 99, 'senderName' => 'Other User', 'text' => 'Understood'],
                    ],
                ],
                [
                    'id' => 'group',
                    'participantIds' => [41, 99, 100],
                    'participantNames' => ['Ayesha Malik', 'Other User', 'Third User'],
                    'messages' => [
                        ['senderId' => 41, 'text' => 'I will leave this group'],
                        ['senderId' => 99, 'text' => 'Still here'],
                        ['senderId' => 100, 'text' => 'Me too'],
                    ],
                ],
            ],
            'developerProjects' => [
                ['id' => 'project-41', 'developerId' => 41],
                ['id' => 'project-99', 'developerId' => 99],
            ],
            'inventoryUnits' => [
                ['id' => 'unit-41', 'projectId' => 'project-41'],
                ['id' => 'unit-99', 'projectId' => 'project-99'],
            ],
            'reports' => [
                ['id' => 'report-41', 'reporterId' => 41],
                ['id' => 'report-99', 'reporterId' => 99],
            ],
            'messages' => [
                ['id' => 'message-41', 'senderId' => 41, 'text' => 'Ayesha message'],
                ['id' => 'message-99', 'senderId' => 99, 'text' => 'Other message'],
            ],
        ];

        $result = app(AccountDataDeletionService::class)->removeFromDocument($source, '41');

        self::assertSame([99], array_column($result['users'], 'id'));
        self::assertSame([2, 3], array_column($result['properties'], 'id'));
        self::assertArrayNotHasKey('agentId', $result['properties'][0]);
        self::assertArrayNotHasKey('agentName', $result['properties'][0]);
        self::assertArrayNotHasKey('agentPhone', $result['properties'][0]);
        self::assertArrayNotHasKey(41, $result['savedProperties']);
        self::assertSame(['saved-99'], array_column($result['savedSearches'], 'id'));
        self::assertArrayNotHasKey(41, $result['notificationPreferences']);
        self::assertSame(['notice-99'], array_column($result['notifications'], 'id'));
        self::assertSame(['99:property:3'], $result['notificationEvents']);
        self::assertSame(['device-99'], array_column($result['pushDevices'], 'id'));
        self::assertSame(['inquiry-99'], array_column($result['inquiries'], 'id'));
        self::assertArrayNotHasKey('sellerId', $result['inquiries'][0]);
        self::assertArrayNotHasKey('sellerName', $result['inquiries'][0]);
        self::assertArrayNotHasKey('sellerPhone', $result['inquiries'][0]);
        self::assertSame(['group'], array_column($result['conversations'], 'id'));
        self::assertSame([99, 100], $result['conversations'][0]['participantIds']);
        self::assertSame([99, 100], array_column($result['conversations'][0]['messages'], 'senderId'));
        self::assertSame(['project-99'], array_column($result['developerProjects'], 'id'));
        self::assertSame(['unit-99'], array_column($result['inventoryUnits'], 'id'));
        self::assertSame(['report-99'], array_column($result['reports'], 'id'));
        self::assertSame(['message-99'], array_column($result['messages'], 'id'));
        self::assertStringNotContainsString('ayesha@example.com', json_encode($result));
        self::assertStringNotContainsString('Ayesha Malik', json_encode($result));
        self::assertCount(2, $source['users'], 'the input document is not mutated');
    }
}
