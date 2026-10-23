CREATE TABLE `consumables_audit` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(64) NOT NULL,
	`actor_name` varchar(100) NOT NULL,
	`action` varchar(64) NOT NULL,
	`target_id` varchar(100) NOT NULL,
	`details` text NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `consumables_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_idempotency` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(64) NOT NULL,
	`request_key` varchar(128) NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`movement_id` varchar(36) NOT NULL,
	CONSTRAINT `stock_idempotency_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_idempotency_actor_key_uq` UNIQUE(`actor_id`,`request_key`)
);
--> statement-breakpoint
CREATE TABLE `catalog_imports` (
	`id` varchar(100) NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`row_count` int NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `catalog_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` varchar(36) NOT NULL,
	`material_id` varchar(36) NOT NULL,
	`location_id` varchar(36) NOT NULL,
	`rack` varchar(100) NOT NULL,
	`quantity` decimal(18,6) NOT NULL DEFAULT '0',
	`initialized` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_material_location_uq` UNIQUE(`material_id`,`location_id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` varchar(36) NOT NULL,
	`mmid` varchar(80) NOT NULL,
	`description` varchar(160) NOT NULL,
	`common_name` varchar(160) NOT NULL,
	`unit` varchar(30) NOT NULL,
	`category` varchar(100) NOT NULL,
	`mrp_type` varchar(30) NOT NULL,
	`critical` boolean NOT NULL,
	`pack_size` decimal(18,6),
	`active` boolean NOT NULL DEFAULT true,
	`version` int NOT NULL DEFAULT 1,
	`source_batch` varchar(100),
	`source_date` varchar(10),
	`created_at` timestamp(3) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `materials_id` PRIMARY KEY(`id`),
	CONSTRAINT `materials_mmid_unique` UNIQUE(`mmid`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` varchar(36) NOT NULL,
	`inventory_id` varchar(36) NOT NULL,
	`material_id` varchar(36) NOT NULL,
	`location_id` varchar(36) NOT NULL,
	`mmid` varchar(80) NOT NULL,
	`description` varchar(160) NOT NULL,
	`unit` varchar(30) NOT NULL,
	`location_name` varchar(100) NOT NULL,
	`type` varchar(16) NOT NULL,
	`quantity` decimal(18,6) NOT NULL,
	`balance_after` decimal(18,6) NOT NULL,
	`packs` int,
	`pack_size` decimal(18,6),
	`reference` varchar(200) NOT NULL,
	`wo` varchar(100) NOT NULL,
	`job` varchar(500) NOT NULL,
	`reason` varchar(500) NOT NULL,
	`actor_id` varchar(64) NOT NULL,
	`actor_name` varchar(100) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stock_idempotency` ADD CONSTRAINT `stock_idempotency_movement_id_stock_movements_id_fk` FOREIGN KEY (`movement_id`) REFERENCES `stock_movements`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_inventory_id_inventory_id_fk` FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `consumables_audit_time_idx` ON `consumables_audit` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `inventory_location_idx` ON `inventory` (`location_id`,`id`);--> statement-breakpoint
CREATE INDEX `material_category_idx` ON `materials` (`category`,`id`);--> statement-breakpoint
CREATE INDEX `movement_location_time_idx` ON `stock_movements` (`location_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `movement_material_idx` ON `stock_movements` (`material_id`,`created_at`,`id`);