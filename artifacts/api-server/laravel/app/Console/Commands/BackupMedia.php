<?php

namespace App\Console\Commands;

use App\Services\MediaStorage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;

class BackupMedia extends Command
{
    protected $signature = 'media:backup
        {--output= : Empty directory where the app_data snapshot and media copy will be written}';

    protected $description = 'Back up app_data and the files referenced by uploaded property media';

    public function handle(MediaStorage $mediaStorage): int
    {
        $output = trim((string) $this->option('output'));
        if ($output === '') {
            $this->components->error('Pass an output directory with --output=/path/to/backup.');

            return self::FAILURE;
        }

        $output = $this->absolutePath($output);
        if (is_dir($output) && count(File::allFiles($output)) > 0) {
            $this->components->error("Refusing to overwrite a non-empty backup directory: {$output}");

            return self::FAILURE;
        }

        try {
            File::ensureDirectoryExists($output);
            $rawData = DB::table('app_data')->where('id', 1)->value('data');
            if ($rawData === null) {
                throw new RuntimeException('app_data row id=1 was not found.');
            }

            $appData = json_decode((string) $rawData, true, 512, JSON_THROW_ON_ERROR);
            if (!$mediaStorage->ready()) {
                throw new RuntimeException('Media storage is not mounted and readable/writable; refusing to create an empty backup.');
            }
            $mediaDirectory = $mediaStorage->directory();
            $mediaBackupDirectory = $output . DIRECTORY_SEPARATOR . 'media';
            if (!File::copyDirectory($mediaDirectory, $mediaBackupDirectory)) {
                throw new RuntimeException('Media storage could not be copied into the backup.');
            }

            $referenced = [];
            foreach ($mediaStorage->referencedPaths($appData) as $publicPath) {
                $source = $mediaStorage->fileForPublicPath($publicPath);
                $filename = basename($publicPath);
                $exists = $source !== null && is_file($source);
                $referenced[] = [
                    'path' => $publicPath,
                    'filename' => $filename,
                    'bytes' => $exists ? filesize($source) : null,
                    'sha256' => $exists ? hash_file('sha256', $source) : null,
                    'included' => $exists && is_file($mediaBackupDirectory . DIRECTORY_SEPARATOR . $filename),
                ];
            }

            $snapshot = [
                'id' => 1,
                'data' => $appData,
            ];
            File::put(
                $output . DIRECTORY_SEPARATOR . 'app_data.json',
                json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL
            );
            File::put(
                $output . DIRECTORY_SEPARATOR . 'media-manifest.json',
                json_encode([
                    'createdAt' => now()->toISOString(),
                    'mediaDirectoryFiles' => count(File::allFiles($mediaBackupDirectory)),
                    'referencedFiles' => $referenced,
                ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL
            );
        } catch (\Throwable $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }

        $missing = collect($referenced)->where('included', false)->count();
        if ($missing > 0) {
            $this->components->error("Backup created with {$missing} missing referenced media file(s).");

            return self::FAILURE;
        }

        $this->components->info("Media backup created: {$output}");

        return self::SUCCESS;
    }

    private function absolutePath(string $path): string
    {
        return str_starts_with($path, DIRECTORY_SEPARATOR)
            ? rtrim($path, DIRECTORY_SEPARATOR)
            : base_path($path);
    }
}