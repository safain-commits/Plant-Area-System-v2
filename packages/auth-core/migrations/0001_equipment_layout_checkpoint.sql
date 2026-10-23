CREATE TABLE `data_migrations` (
	`id` varchar(100) NOT NULL,
	`completed_at` timestamp(3) NOT NULL,
	CONSTRAINT `data_migrations_id` PRIMARY KEY(`id`)
);
