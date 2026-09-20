CREATE TABLE `app_data` (
	`id` bigint NOT NULL,
	`data` json NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `app_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_challenges` (
	`email` varchar(320) NOT NULL,
	`purpose` varchar(64) NOT NULL,
	`code_hash` char(64) NOT NULL,
	`attempts` smallint NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `auth_challenges_email_purpose_pk` PRIMARY KEY(`email`,`purpose`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`token_hash` varchar(255) NOT NULL,
	`user_id` bigint NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `auth_sessions_token_hash_pk` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_expiry` ON `auth_sessions` (`expires_at`);