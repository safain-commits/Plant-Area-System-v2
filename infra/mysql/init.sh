#!/bin/bash
# The MySQL entrypoint sources non-executable .sh files on Linux. Keep strict
# options and local variables inside a subshell so they cannot change its shell.
(
set -euo pipefail
# Fixed database names; generated hexadecimal secrets avoid SQL/URL ambiguity.
for value in "$AUTH_DB_PASSWORD" "$BAG_DB_PASSWORD" "$CONSUMABLES_DB_PASSWORD"; do
  [[ "$value" =~ ^[a-zA-Z0-9_-]{24,128}$ ]] || { echo 'Database passwords must use 24-128 URL-safe alphanumeric characters.' >&2; exit 1; }
done
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS plant_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS plant_bag_filter CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS plant_consumables CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'plant_consumables'@'%' IDENTIFIED BY '$CONSUMABLES_DB_PASSWORD';
GRANT SELECT,INSERT,UPDATE,DELETE ON plant_consumables.* TO 'plant_consumables'@'%';
CREATE USER IF NOT EXISTS 'plant_auth'@'%' IDENTIFIED BY '$AUTH_DB_PASSWORD';
CREATE USER IF NOT EXISTS 'plant_bag'@'%' IDENTIFIED BY '$BAG_DB_PASSWORD';
GRANT SELECT,INSERT,UPDATE,DELETE ON plant_auth.* TO 'plant_auth'@'%';
GRANT SELECT,INSERT,UPDATE,DELETE ON plant_bag_filter.* TO 'plant_bag'@'%';
SQL
)
