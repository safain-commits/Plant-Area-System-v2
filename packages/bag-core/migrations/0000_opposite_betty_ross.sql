CREATE TABLE `bag_audit` (
	`id` varchar(36) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`equipment_code` varchar(16) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`actor_name` varchar(100) NOT NULL,
	`action` varchar(64) NOT NULL,
	`details` text NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `bag_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replacement_batches` (
	`id` varchar(36) NOT NULL,
	`equipment_code` varchar(16) NOT NULL,
	`actor_id` varchar(36) NOT NULL,
	`actor_name` varchar(100) NOT NULL,
	`installed_at` datetime(3) NOT NULL,
	`reason` varchar(500) NOT NULL,
	`wo` varchar(100) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`idempotency_key` varchar(128) NOT NULL,
	`request_hash` varchar(64) NOT NULL,
	`position_count` int NOT NULL,
	CONSTRAINT `replacement_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `batch_actor_key_unique` UNIQUE(`actor_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `coordinates` (
	`equipment_code` varchar(16) NOT NULL,
	`side` varchar(8) NOT NULL,
	`compartment` int NOT NULL,
	`col` int NOT NULL,
	`row_no` int NOT NULL,
	CONSTRAINT `coordinates_equipment_code_side_compartment_col_row_no_pk` PRIMARY KEY(`equipment_code`,`side`,`compartment`,`col`,`row_no`)
);
--> statement-breakpoint
CREATE TABLE `equipment` (
	`code` varchar(16) NOT NULL,
	`per_side` int NOT NULL,
	CONSTRAINT `equipment_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `installations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`equipment_code` varchar(16) NOT NULL,
	`side` varchar(8) NOT NULL,
	`compartment` int NOT NULL,
	`col` int NOT NULL,
	`row_no` int NOT NULL,
	`installed_at` datetime(3) NOT NULL,
	CONSTRAINT `installations_id` PRIMARY KEY(`id`),
	CONSTRAINT `batch_position_unique` UNIQUE(`batch_id`,`side`,`compartment`,`col`,`row_no`)
);
--> statement-breakpoint
ALTER TABLE `bag_audit` ADD CONSTRAINT `bag_audit_batch_id_replacement_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `replacement_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `replacement_batches` ADD CONSTRAINT `replacement_batches_equipment_code_equipment_code_fk` FOREIGN KEY (`equipment_code`) REFERENCES `equipment`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coordinates` ADD CONSTRAINT `coordinates_equipment_code_equipment_code_fk` FOREIGN KEY (`equipment_code`) REFERENCES `equipment`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `installations` ADD CONSTRAINT `installations_batch_id_replacement_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `replacement_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `installations` ADD CONSTRAINT `installation_coordinate_fk` FOREIGN KEY (`equipment_code`,`side`,`compartment`,`col`,`row_no`) REFERENCES `coordinates`(`equipment_code`,`side`,`compartment`,`col`,`row_no`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bag_audit_equipment_time_idx` ON `bag_audit` (`equipment_code`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `batch_equipment_time_idx` ON `replacement_batches` (`equipment_code`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `installation_position_time_idx` ON `installations` (`equipment_code`,`side`,`compartment`,`col`,`row_no`,`installed_at`,`id`);