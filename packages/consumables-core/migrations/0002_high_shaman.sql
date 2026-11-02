CREATE TABLE `stock_document_sequences` (
	`type` varchar(16) NOT NULL,
	`year` int NOT NULL,
	`last_value` int NOT NULL DEFAULT 0,
	CONSTRAINT `stock_document_sequences_type_year_pk` PRIMARY KEY(`type`,`year`)
);
--> statement-breakpoint
CREATE TABLE `stock_documents` (
	`id` varchar(36) NOT NULL,
	`number` varchar(30) NOT NULL,
	`type` varchar(16) NOT NULL,
	`location_id` varchar(36) NOT NULL,
	`location_name` varchar(100) NOT NULL,
	`hec` varchar(20) NOT NULL DEFAULT '',
	`wo` varchar(100) NOT NULL DEFAULT '',
	`note` varchar(500) NOT NULL DEFAULT '',
	`channel` varchar(10) NOT NULL,
	`requester_name` varchar(100) NOT NULL,
	`requester_nik` varchar(30) NOT NULL DEFAULT '',
	`source_ref` varchar(100) NOT NULL DEFAULT '',
	`reservation_no` varchar(30) NOT NULL DEFAULT '',
	`equipment_no` varchar(100) NOT NULL DEFAULT '',
	`functional_location` varchar(100) NOT NULL DEFAULT '',
	`cost_center` varchar(40) NOT NULL DEFAULT '',
	`required_date` date,
	`line_count` int NOT NULL,
	`actor_id` varchar(64) NOT NULL,
	`actor_name` varchar(100) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `stock_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_documents_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
ALTER TABLE `stock_idempotency` MODIFY COLUMN `movement_id` varchar(36);--> statement-breakpoint
ALTER TABLE `stock_idempotency` ADD `document_id` varchar(36);--> statement-breakpoint
ALTER TABLE `materials` ADD `sap_unit` varchar(30) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `aliases` varchar(500) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `decimal_allowed` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `conversion_reviewed` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `document_id` varchar(36);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `line_no` int;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `common_name` varchar(160);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `sap_unit` varchar(30);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `sap_quantity` decimal(18,6);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `movement_document_line_uq` UNIQUE(`document_id`,`line_no`);--> statement-breakpoint
ALTER TABLE `stock_documents` ADD CONSTRAINT `stock_documents_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `document_location_time_idx` ON `stock_documents` (`location_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `document_type_time_idx` ON `stock_documents` (`type`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `document_hec_idx` ON `stock_documents` (`hec`);--> statement-breakpoint
CREATE INDEX `document_wo_idx` ON `stock_documents` (`wo`);--> statement-breakpoint
CREATE INDEX `document_reservation_idx` ON `stock_documents` (`reservation_no`);--> statement-breakpoint
ALTER TABLE `stock_idempotency` ADD CONSTRAINT `stock_idempotency_one_target` CHECK ((`stock_idempotency`.`movement_id` IS NOT NULL) <> (`stock_idempotency`.`document_id` IS NOT NULL));--> statement-breakpoint
ALTER TABLE `stock_idempotency` ADD CONSTRAINT `stock_idempotency_document_id_stock_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `stock_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_document_id_stock_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `stock_documents`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Metadata only: existing quantities, units, pack sizes and ledger remain unchanged.
UPDATE `materials` SET `sap_unit` = `unit`,
  `decimal_allowed` = UPPER(TRIM(`unit`)) NOT IN ('EA','PC','PCS','SET','BH','BUAH','UNIT','ROL','ROLL','CAN','TBE','BTL','BOX','PAK','PACK'),
  `conversion_reviewed` = (`pack_size` IS NULL);
