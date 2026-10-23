#!/bin/bash
set -euo pipefail
umask 077
mkdir -p /backups
while true; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  temporary="/backups/.plant-${stamp}.sql.gz.tmp"
  target="/backups/plant-${stamp}.sql.gz"
  mysqldump -h "${MYSQL_HOST:-mysql}" -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF --databases plant_auth plant_bag_filter plant_consumables | gzip > "$temporary"
  gzip -t "$temporary"
  mv "$temporary" "$target"
  find /backups -maxdepth 1 -type f -name 'plant-*.sql.gz' -mtime +13 -delete
  printf '{"event":"backup.complete","file":"%s"}\n' "$(basename "$target")"
  [[ "${RUN_ONCE:-false}" == true ]] && break
  sleep 86400
done
