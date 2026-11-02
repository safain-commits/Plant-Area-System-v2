-- Preserve legacy tables and history. Refuse consolidation rather than guessing balances.
-- NULL primary key deliberately fails closed if preflight is bypassed.
INSERT INTO `locations` (`id`,`name`,`active`,`version`,`created_at`)
SELECT IF(
  EXISTS(SELECT 1 FROM `inventory` WHERE `location_id` <> '00000000-0000-4000-8000-000000000022')
  OR EXISTS(SELECT 1 FROM `stock_movements` WHERE `location_id` <> '00000000-0000-4000-8000-000000000022')
  OR EXISTS(SELECT 1 FROM `stock_documents` WHERE `location_id` <> '00000000-0000-4000-8000-000000000022')
  OR EXISTS(SELECT 1 FROM `locations` WHERE `id` = '00000000-0000-4000-8000-000000000022' AND (`name` <> 'R22' OR `active` = 0)),
  NULL,'00000000-0000-4000-8000-000000000022'), 'R22',true,1,UTC_TIMESTAMP(3)
WHERE NOT EXISTS(SELECT 1 FROM `locations` WHERE `id` = '00000000-0000-4000-8000-000000000022')
  OR EXISTS(SELECT 1 FROM `inventory` WHERE `location_id` <> '00000000-0000-4000-8000-000000000022')
  OR EXISTS(SELECT 1 FROM `stock_movements` WHERE `location_id` <> '00000000-0000-4000-8000-000000000022')
  OR EXISTS(SELECT 1 FROM `stock_documents` WHERE `location_id` <> '00000000-0000-4000-8000-000000000022')
  OR EXISTS(SELECT 1 FROM `locations` WHERE `id` = '00000000-0000-4000-8000-000000000022' AND (`name` <> 'R22' OR `active` = 0));
