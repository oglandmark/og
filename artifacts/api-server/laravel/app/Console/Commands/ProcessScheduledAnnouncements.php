<?php

namespace App\Console\Commands;

use App\Services\JsonStore;
use App\Services\NotificationDeliveryService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class ProcessScheduledAnnouncements extends Command
{
    protected $signature = 'announcements:process-scheduled';

    protected $description = 'Deliver due OG Landmark announcements to eligible users.';

    public function handle(NotificationDeliveryService $delivery): int
    {
        JsonStore::reset();

        try {
            $result = DB::transaction(function () use ($delivery): array {
                $row = DB::table('app_data')->where('id', 1)->lockForUpdate()->first();
                if (!$row || !$row->data) {
                    throw new \RuntimeException('Canonical OG Landmark app_data row is missing.');
                }

                $data = json_decode((string) $row->data, true);
                if (!is_array($data)) {
                    throw new \RuntimeException('Canonical OG Landmark app_data row contains invalid JSON.');
                }

                if (!is_array($data['announcements'] ?? null)) {
                    $data['announcements'] = [];
                }

                $processed = 0;
                $notificationCount = 0;
                foreach ($data['announcements'] as &$announcement) {
                    if (!is_array($announcement)
                        || ($announcement['status'] ?? null) !== 'scheduled'
                        || empty($announcement['scheduleAt'])
                        || !empty($announcement['sentAt'])) {
                        continue;
                    }

                    try {
                        $scheduledAt = CarbonImmutable::parse((string) $announcement['scheduleAt']);
                    } catch (Throwable) {
                        continue;
                    }

                    if ($scheduledAt->isAfter(now())) {
                        continue;
                    }

                    $recipients = $this->recipientsFor($data, (array) ($announcement['audience'] ?? []));
                    $announcementNotificationCount = count($delivery->deliver(
                        $data,
                        $recipients,
                        $this->notificationPayload($announcement),
                    ));
                    $notificationCount += $announcementNotificationCount;

                    $announcement['status'] = 'sent';
                    $announcement['sentAt'] = now()->toISOString();
                    $announcement['recipientCount'] = $announcementNotificationCount;
                    $processed++;
                }
                unset($announcement);

                if ($processed > 0) {
                    JsonStore::write($data);
                }

                return [
                    'processed' => $processed,
                    'notifications' => $notificationCount,
                ];
            }, 1);
        } catch (Throwable $exception) {
            $this->error('Scheduled announcement processing failed: '.$exception->getMessage());
            report($exception);
            JsonStore::reset();
            return self::FAILURE;
        }

        JsonStore::reset();
        $this->info(sprintf(
            'Processed %d scheduled announcement(s); created %d notification(s).',
            $result['processed'],
            $result['notifications'],
        ));

        return self::SUCCESS;
    }

    private function recipientsFor(array $data, array $audience): array
    {
        $role = strtolower((string) ($audience['role'] ?? ''));
        $city = strtolower(trim((string) ($audience['city'] ?? '')));
        $recipients = [];

        foreach ($data['users'] ?? [] as $user) {
            if (!is_array($user)
                || in_array($user['status'] ?? null, ['Inactive', 'Suspended'], true)) {
                continue;
            }

            if ($role !== '' && strtolower((string) ($user['role'] ?? '')) !== $role) {
                continue;
            }
            if ($city !== '' && strtolower((string) ($user['city'] ?? '')) !== $city) {
                continue;
            }

            $recipients[] = $user['id'] ?? null;
        }

        return $recipients;
    }

    private function notificationPayload(array $announcement): array
    {
        $id = $announcement['id'] ?? null;
        $type = match ($announcement['type'] ?? null) {
            'promotional' => 'PROMOTIONAL_ANNOUNCEMENT',
            'important' => 'IMPORTANT_ANNOUNCEMENT',
            'system' => 'SYSTEM_ANNOUNCEMENT',
            default => 'GENERAL_ANNOUNCEMENT',
        };
        $deepLink = '/announcements/'.$id;

        return [
            'type' => $type,
            'category' => ($announcement['type'] ?? null) === 'promotional'
                ? 'promotional'
                : 'announcements',
            'title' => $announcement['title'] ?? 'OG Landmark Update',
            'body' => $announcement['message'] ?? '',
            'imageUrl' => $announcement['imageUrl'] ?? null,
            'entityType' => 'announcement',
            'entityId' => $id,
            'announcementId' => $id,
            'deepLink' => $deepLink,
            'priority' => $announcement['priority'] ?? 'NORMAL',
            'expiresAt' => $announcement['expiresAt'] ?? null,
            'eventKey' => 'announcement:'.$id,
            'metadata' => ['audience' => $announcement['audience'] ?? (object) []],
        ];
    }
}