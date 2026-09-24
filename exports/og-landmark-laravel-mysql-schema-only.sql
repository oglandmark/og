-- OG Landmark Hostinger schema helper
-- Schema only: no users, listings, app_data rows, or other application data.
-- In phpMyAdmin, select the EXISTING Hostinger database before importing this file.
-- CREATE TABLE IF NOT EXISTS preserves existing tables and their contents.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `app_data` (
    `id` BIGINT UNSIGNED NOT NULL,
    `data` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
    `token_hash` VARCHAR(255) NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`token_hash`),
    KEY `idx_auth_sessions_user` (`user_id`),
    KEY `idx_auth_sessions_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_challenges` (
    `email` VARCHAR(320) NOT NULL,
    `purpose` VARCHAR(64) NOT NULL,
    `code_hash` CHAR(64) NOT NULL,
    `attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`email`, `purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;