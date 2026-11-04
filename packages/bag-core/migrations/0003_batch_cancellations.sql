CREATE TABLE `batch_cancellations` (
  `batch_id` varchar(36) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `actor_id` varchar(36) NOT NULL,
  `actor_name` varchar(100) NOT NULL,
  `cancelled_at` datetime(3) NOT NULL,
  `idempotency_key` varchar(128) NOT NULL,
  `request_hash` varchar(64) NOT NULL,
  CONSTRAINT `batch_cancellations_batch_id` PRIMARY KEY (`batch_id`),
  CONSTRAINT `cancellation_actor_key_unique` UNIQUE (`actor_id`,`idempotency_key`),
  CONSTRAINT `batch_cancellations_batch_id_replacement_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `replacement_batches` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);
