<?php

namespace App\Services;

use RuntimeException;

class MediaStorage
{
    public const PUBLIC_PREFIX = '/images/uploads/';

    public function directory(): string
    {
        $configured = trim((string) env('MEDIA_STORAGE_DIR', 'public/images/uploads'));

        return str_starts_with($configured, DIRECTORY_SEPARATOR)
            ? rtrim($configured, DIRECTORY_SEPARATOR)
            : base_path(trim($configured, DIRECTORY_SEPARATOR));
    }

    public function persistent(): bool
    {
        $default = app()->environment('production') ? false : true;

        return filter_var(env('MEDIA_STORAGE_PERSISTENT', $default), FILTER_VALIDATE_BOOLEAN);
    }

    public function ready(): bool
    {
        $directory = $this->directory();

        return is_dir($directory) && is_readable($directory) && is_writable($directory);
    }

    public function ensureReady(): void
    {
        $directory = $this->directory();

        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Media storage directory could not be created.');
        }

        if (!$this->ready()) {
            throw new RuntimeException('Media storage directory is not readable and writable.');
        }
    }

    public function fileForPublicPath(string $path): ?string
    {
        $path = (string) (parse_url($path, PHP_URL_PATH) ?: $path);
        if (!str_starts_with($path, self::PUBLIC_PREFIX)) {
            return null;
        }

        $filename = basename($path);
        $relative = substr($path, strlen(self::PUBLIC_PREFIX));
        if ($filename === '' || $filename === '.' || $filename === '..' || $relative !== $filename) {
            return null;
        }

        return $this->directory() . DIRECTORY_SEPARATOR . $filename;
    }

    public function publicPath(string $filename): string
    {
        return self::PUBLIC_PREFIX . basename($filename);
    }

    public function url(string $path): string
    {
        $base = rtrim((string) env('MEDIA_PUBLIC_BASE_URL', ''), '/');

        return $base === '' ? $path : $base . $path;
    }

    public function health(): array
    {
        $ready = $this->ready();
        $persistent = $this->persistent();
        $productionSafe = !app()->environment('production') || $persistent;

        return [
            'status' => $ready && $productionSafe ? 'ready' : 'not_ready',
            'ready' => $ready,
            'persistent' => $persistent,
            'publicBaseUrlConfigured' => trim((string) env('MEDIA_PUBLIC_BASE_URL', '')) !== '',
        ];
    }

    /**
     * Return the upload paths referenced anywhere in the canonical app_data JSON.
     *
     * Uploads are intentionally stored as URLs/paths in a JSON document, so the
     * backup must discover both legacy string fields and newer media metadata.
     *
     * @return list<string>
     */
    public function referencedPaths(mixed $value): array
    {
        $paths = [];
        $walk = function (mixed $candidate) use (&$walk, &$paths): void {
            if (is_array($candidate)) {
                foreach ($candidate as $child) {
                    $walk($child);
                }

                return;
            }

            if (!is_string($candidate)) {
                return;
            }

            $path = (string) (parse_url($candidate, PHP_URL_PATH) ?: $candidate);
            if (!str_contains($path, self::PUBLIC_PREFIX)) {
                return;
            }

            $file = $this->fileForPublicPath($path);
            if ($file !== null) {
                $paths[] = $this->publicPath(basename($file));
            }
        };

        $walk($value);

        return array_values(array_unique($paths));
    }
}