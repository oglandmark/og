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

CREATE TABLE IF NOT EXISTS `app_users` (
    `id` BIGINT UNSIGNED NOT NULL,
    `position` INT UNSIGNED NOT NULL DEFAULT 0,
    `name` VARCHAR(255) NULL,
    `email` VARCHAR(320) NULL,
    `username` VARCHAR(191) NULL,
    `phone` VARCHAR(96) NULL,
    `city` VARCHAR(191) NULL,
    `role` VARCHAR(64) NULL,
    `status` VARCHAR(64) NULL,
    `password_hash` VARCHAR(255) NULL,
    `profile_photo_url` TEXT NULL,
    `cover_photo_url` TEXT NULL,
    `payload` JSON NOT NULL,
    `created_at` TIMESTAMP(3) NULL,
    `updated_at` TIMESTAMP(3) NULL,
    PRIMARY KEY (`id`),
    KEY `idx_app_users_email` (`email`),
    KEY `idx_app_users_username` (`username`),
    KEY `idx_app_users_phone` (`phone`),
    KEY `idx_app_users_role_status` (`role`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `properties` (
    `id` BIGINT UNSIGNED NOT NULL,
    `position` INT UNSIGNED NOT NULL DEFAULT 0,
    `seller_id` VARCHAR(191) NULL,
    `title` VARCHAR(255) NULL,
    `city` VARCHAR(191) NULL,
    `property_type` VARCHAR(100) NULL,
    `purpose` VARCHAR(64) NULL,
    `approval_status` VARCHAR(64) NULL,
    `listing_status` VARCHAR(64) NULL,
    `price_value` DECIMAL(30,8) NULL,
    `payload` JSON NOT NULL,
    `created_at` TIMESTAMP(3) NULL,
    `updated_at` TIMESTAMP(3) NULL,
    PRIMARY KEY (`id`),
    KEY `idx_properties_seller` (`seller_id`),
    KEY `idx_properties_city_type` (`city`, `property_type`),
    KEY `idx_properties_status` (`approval_status`, `listing_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agents` (
    `directory` VARCHAR(32) NOT NULL,
    `legacy_id` VARCHAR(191) NOT NULL,
    `position` INT UNSIGNED NOT NULL DEFAULT 0,
    `name` VARCHAR(255) NULL,
    `city` VARCHAR(191) NULL,
    `phone` VARCHAR(96) NULL,
    `status` VARCHAR(64) NULL,
    `profile_photo_url` TEXT NULL,
    `cover_photo_url` TEXT NULL,
    `payload` JSON NOT NULL,
    `created_at` TIMESTAMP(3) NULL,
    `updated_at` TIMESTAMP(3) NULL,
    PRIMARY KEY (`directory`, `legacy_id`),
    KEY `idx_agents_directory_city` (`directory`, `city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `media_assets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_type` VARCHAR(32) NOT NULL,
    `owner_id` VARCHAR(191) NOT NULL,
    `field_path` VARCHAR(255) NOT NULL,
    `media_type` VARCHAR(16) NOT NULL,
    `position` INT UNSIGNED NOT NULL DEFAULT 0,
    `url` TEXT NOT NULL,
    `created_at` TIMESTAMP(3) NULL,
    `updated_at` TIMESTAMP(3) NULL,
    PRIMARY KEY (`id`),
    KEY `idx_media_owner` (`owner_type`, `owner_id`),
    KEY `idx_media_type` (`media_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `normalization_state` (
    `state_key` VARCHAR(64) NOT NULL,
    `source_checksum` CHAR(64) NOT NULL,
    `counts` JSON NOT NULL,
    `activated_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`state_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;