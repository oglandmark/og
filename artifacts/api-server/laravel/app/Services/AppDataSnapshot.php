<?php

namespace App\Services;

use RuntimeException;

/**
 * Loads and compares the canonical OG Landmark JSON document without exposing
 * the document contents in operator output.
 */
final class AppDataSnapshot
{
    public static function fromFile(string $path): array
    {
        $resolved = realpath($path);
        if ($resolved === false || !is_file($resolved) || !is_readable($resolved)) {
            throw new RuntimeException("Snapshot file is missing or unreadable: {$path}");
        }

        try {
            $data = json_decode(
                (string) file_get_contents($resolved),
                true,
                512,
                JSON_THROW_ON_ERROR,
            );
        } catch (\JsonException $exception) {
            throw new RuntimeException('Snapshot is not valid JSON.', 0, $exception);
        }

        if (!is_array($data)) {
            throw new RuntimeException('Snapshot root must be a JSON object.');
        }

        self::validate($data);

        return $data;
    }

    public static function fromStoredJson(?string $json): array
    {
        if ($json === null || trim($json) === '') {
            throw new RuntimeException('The app_data row contains no JSON document.');
        }

        try {
            $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new RuntimeException('The app_data row contains invalid JSON.', 0, $exception);
        }

        if (!is_array($data)) {
            throw new RuntimeException('The app_data document root must be a JSON object.');
        }

        self::validate($data);

        return $data;
    }

    public static function checksum(array $data): string
    {
        try {
            return hash('sha256', json_encode(
                $data,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
            ));
        } catch (\JsonException $exception) {
            throw new RuntimeException('Snapshot could not be canonicalized.', 0, $exception);
        }
    }

    /**
     * Return counts that are safe to put in an audit log.
     */
    public static function summary(array $data): array
    {
        $counts = [];
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $counts[$key] = count($value);
            }
        }
        ksort($counts);

        return [
            'counts' => $counts,
            'nextId' => $data['nextId'] ?? null,
        ];
    }

    /**
     * The schema seed is intentionally allowed as the only pre-existing row.
     */
    public static function isEmptyCanonicalDocument(array $data): bool
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                if ($value !== []) {
                    return false;
                }
                continue;
            }

            if ($key !== 'nextId' || (int) $value !== 1) {
                return false;
            }
        }

        return true;
    }

    private static function validate(array $data): void
    {
        foreach (['properties', 'users'] as $key) {
            if (!isset($data[$key]) || !is_array($data[$key])) {
                throw new RuntimeException("Snapshot must contain an array named {$key}.");
            }
        }

        if (isset($data['nextId']) && (!is_int($data['nextId']) && !is_numeric($data['nextId']))) {
            throw new RuntimeException('Snapshot nextId must be numeric.');
        }

        foreach ($data['users'] as $index => $user) {
            if (!is_array($user)) {
                throw new RuntimeException("Snapshot user at index {$index} is invalid.");
            }

            $password = (string) ($user['password'] ?? '');
            if ($password !== '' && !str_starts_with($password, 'pbkdf2:') && !str_starts_with($password, '$')) {
                throw new RuntimeException("Snapshot user at index {$index} does not contain a supported password hash.");
            }
        }
    }
}