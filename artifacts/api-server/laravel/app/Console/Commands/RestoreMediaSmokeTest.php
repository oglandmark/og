<?php

namespace App\Console\Commands;

use App\Services\MediaStorage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class RestoreMediaSmokeTest extends Command
{
    protected $signature = 'media:restore-smoke-test
        {backup : Backup directory created by media:backup}
        {--base-url= : Deployed API or CDN origin to check each restored media URL}';

    protected $description = 'Verify backup media files and optionally fetch them from the deployed origin';

    public function handle(MediaStorage $mediaStorage): int
    {
        $backup = $this->absolutePath((string) $this->argument('backup'));
        $appDataFile = $backup . DIRECTORY_SEPARATOR . 'app_data.json';
        $manifestFile = $backup . DIRECTORY_SEPARATOR . 'media-manifest.json';
        $mediaDirectory = $backup . DIRECTORY_SEPARATOR . 'media';

        try {
            if (!is_file($appDataFile) || !is_file($manifestFile) || !is_dir($mediaDirectory)) {
                throw new RuntimeException('Backup must contain app_data.json, media-manifest.json, and media/.');
            }

            $appDataSnapshot = json_decode((string) File::get($appDataFile), true, 512, JSON_THROW_ON_ERROR);
            $manifest = json_decode((string) File::get($manifestFile), true, 512, JSON_THROW_ON_ERROR);
            $referencedFiles = $manifest['referencedFiles'] ?? [];
            $snapshotPaths = $mediaStorage->referencedPaths($appDataSnapshot['data'] ?? $appDataSnapshot);
            $manifestPaths = collect($referencedFiles)
                ->pluck('path')
                ->filter()
                ->sort()
                ->values()
                ->all();
            sort($snapshotPaths);
            if ($snapshotPaths !== $manifestPaths) {
                throw new RuntimeException('Backup manifest does not match the media references in app_data.json.');
            }
            $baseUrl = rtrim(trim((string) $this->option('base-url')), '/');
            $checked = 0;

            foreach ($referencedFiles as $entry) {
                $filename = basename((string) ($entry['filename'] ?? ''));
                $path = (string) ($entry['path'] ?? '');
                if ($filename === '' || $path !== $mediaStorage->publicPath($filename)) {
                    throw new RuntimeException("Invalid media manifest entry for: {$filename}");
                }
                $backupFile = $mediaDirectory . DIRECTORY_SEPARATOR . $filename;
                if (!is_file($backupFile)) {
                    throw new RuntimeException("Missing restored media file: {$filename}");
                }

                $expectedBytes = $entry['bytes'] ?? null;
                $expectedHash = $entry['sha256'] ?? null;
                if ($expectedBytes !== null && filesize($backupFile) !== (int) $expectedBytes) {
                    throw new RuntimeException("Byte count mismatch for restored media file: {$filename}");
                }
                if ($expectedHash !== null && !hash_equals((string) $expectedHash, (string) hash_file('sha256', $backupFile))) {
                    throw new RuntimeException("Checksum mismatch for restored media file: {$filename}");
                }

                if ($baseUrl !== '') {
                    $url = $baseUrl . $mediaStorage->publicPath($filename);
                    $response = Http::withHeaders(['Range' => 'bytes=0-0'])
                        ->withOptions(['stream' => true])
                        ->timeout(15)
                        ->get($url);
                    if (!$response->successful()) {
                        throw new RuntimeException("Deployed media URL did not load ({$response->status()}): {$url}");
                    }
                }

                $checked++;
            }

            $message = $baseUrl === ''
                ? "Restore smoke test passed for {$checked} referenced media file(s) from the backup."
                : "Restore smoke test passed for {$checked} referenced media file(s), including live HTTP delivery from {$baseUrl}.";
            $this->components->info($message);

            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    private function absolutePath(string $path): string
    {
        return str_starts_with($path, DIRECTORY_SEPARATOR)
            ? rtrim($path, DIRECTORY_SEPARATOR)
            : base_path($path);
    }
}