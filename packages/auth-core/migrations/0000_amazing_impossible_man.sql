CREATE TABLE `accounts` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp(3),
	`refresh_token_expires_at` timestamp(3),
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`status` varchar(16) NOT NULL,
	`path` varchar(100),
	CONSTRAINT `applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_audit` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`actor_name` varchar(100) NOT NULL,
	`action` varchar(64) NOT NULL,
	`target_id` varchar(100) NOT NULL,
	`details` text NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `auth_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_grants` (
	`user_id` varchar(36) NOT NULL,
	`app_id` varchar(64) NOT NULL,
	`role` varchar(16) NOT NULL,
	`equipment` text NOT NULL,
	CONSTRAINT `app_grants_user_id_app_id_pk` PRIMARY KEY(`user_id`,`app_id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`attempt_key` varchar(64) NOT NULL,
	`attempts` int NOT NULL,
	`reset_at` timestamp(3) NOT NULL,
	CONSTRAINT `login_attempts_attempt_key` PRIMARY KEY(`attempt_key`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`token` varchar(255) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`ip_address` varchar(64),
	`user_agent` text,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	`position` varchar(100) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT true,
	`portal_admin` boolean NOT NULL DEFAULT false,
	`must_change_password` boolean NOT NULL DEFAULT true,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_grants` ADD CONSTRAINT `app_grants_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_grants` ADD CONSTRAINT `app_grants_app_id_applications_id_fk` FOREIGN KEY (`app_id`) REFERENCES `applications`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_audit_time_idx` ON `auth_audit` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `sessions` (`user_id`);