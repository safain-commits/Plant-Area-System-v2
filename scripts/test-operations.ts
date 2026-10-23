import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { request } from '@playwright/test';
if (process.env.TEST_DATABASE !== '1' || process.env.PUBLIC_ORIGIN !== 'https://localhost:8443')
  throw Error('Only the isolated test deployment may be used.');
const run = promisify(execFile),
  compose = [
    'compose',
    '--env-file',
    '.test-runtime/stack.env',
    '-p',
    'plant-v2-test',
    '-f',
    'compose.yaml',
    '-f',
    '.test-runtime/compose.yaml',
  ];
const docker = (args: string[]) => run('docker', args, { maxBuffer: 2_000_000 });
const delay = () => new Promise((r) => setTimeout(r, 1000));
const client = await request.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
const countsSql =
  'SELECT (SELECT COUNT(*) FROM plant_auth.users),(SELECT COUNT(*) FROM plant_auth.sessions),(SELECT COUNT(*) FROM plant_bag_filter.replacement_batches),(SELECT COUNT(*) FROM plant_bag_filter.installations),(SELECT COUNT(*) FROM plant_bag_filter.bag_audit),(SELECT COUNT(*) FROM plant_bag_filter.coordinates),(SELECT COUNT(*) FROM plant_consumables.materials),(SELECT COUNT(*) FROM plant_consumables.inventory),(SELECT COUNT(*) FROM plant_consumables.stock_movements),(SELECT COUNT(*) FROM plant_consumables.consumables_audit),(SELECT COALESCE(SUM(quantity),0) FROM plant_consumables.inventory),(SELECT COALESCE(SUM(quantity),0) FROM plant_consumables.stock_movements),(SELECT BIT_XOR(CRC32(CONCAT_WS(CHAR(31),id,quantity,balance_after,actor_id))) FROM plant_consumables.stock_movements),(SELECT COUNT(*) FROM plant_consumables.locations),(SELECT COUNT(*) FROM plant_consumables.stock_idempotency),(SELECT COUNT(*) FROM plant_consumables.catalog_imports),(SELECT COUNT(*) FROM plant_auth.app_grants)';
const source = await mysql.createConnection(process.env.BAG_MIGRATION_DATABASE_URL!);
let restored = false;
try {
  const [before] = await source.query<mysql.RowDataPacket[]>(countsSql);
  await docker([...compose, 'restart', 'mysql', 'bag-filter', 'consumables']);
  await source.end();
  let connection: mysql.Connection | undefined;
  for (let i = 0; i < 60; i++) {
    try {
      connection = await mysql.createConnection(process.env.BAG_MIGRATION_DATABASE_URL!);
      await connection.query('SELECT 1');
      break;
    } catch {
      await connection?.end().catch(() => {});
      connection = undefined;
      await delay();
    }
  }
  assert.ok(connection, 'MySQL must recover after restart');
  const [after] = await connection.query<mysql.RowDataPacket[]>(countsSql);
  await connection.end();
  assert.deepEqual(after, before);
  console.log(JSON.stringify({ event: 'test.restart_persistence', result: 'passed' }));
  await docker([...compose, 'stop', 'auth']);
  try {
    for (const path of [
      '/',
      '/bag-filter',
      '/bag-filter/api/equipment',
      '/consumables',
      '/consumables/api/inventory',
      '/api/admin/users',
    ]) {
      const response = await client.get(path, { maxRedirects: 0 });
      assert.equal(response.status(), 503, `${path} must fail closed`);
    }
  } finally {
    await docker([...compose, 'start', 'auth']);
  }
  for (let i = 0; i < 60; i++) {
    if ((await client.get('/', { maxRedirects: 0 })).status() === 303) break;
    await delay();
  }
  console.log(JSON.stringify({ event: 'test.auth_unavailable', result: 'passed' }));
  await docker([
    'exec',
    'plant-v2-test-bag-filter-1',
    'node',
    '-e',
    "fetch('http://127.0.0.1:3000/bag-filter/api/equipment',{headers:{'x-user-role':'admin','x-user-id':'forged'}}).then(r=>{if(r.status!==401)process.exit(1)})",
  ]);
  await docker([
    'exec',
    'plant-v2-test-consumables-1',
    'node',
    '-e',
    "fetch('http://127.0.0.1:3000/consumables/api/inventory',{headers:{'x-user-role':'admin','x-user-id':'forged'}}).then(r=>{if(r.status!==401)process.exit(1)})",
  ]);
  await docker([
    'exec',
    'plant-v2-test-auth-1',
    'node',
    '-e',
    "fetch('http://127.0.0.1:3000/auth/internal/session').then(r=>{if(r.status!==403)process.exit(1)})",
  ]);
  console.log(JSON.stringify({ event: 'test.direct_service_guards', result: 'passed' }));
  await docker([...compose, 'run', '--rm', '-e', 'RUN_ONCE=true', 'backup']);
  const file = (await readdir('backups'))
    .filter((f) => /^plant-\d{8}T\d{6}Z\.sql\.gz$/.test(f))
    .sort()
    .at(-1);
  assert.ok(file);
  await docker([
    'run',
    '-d',
    '--rm',
    '--name',
    'plant-v2-test-restore',
    '-e',
    'MYSQL_ROOT_PASSWORD',
    '-e',
    'AUTH_DB_PASSWORD',
    '-e',
    'BAG_DB_PASSWORD',
    '-e',
    'CONSUMABLES_DB_PASSWORD',
    '-v',
    `${resolve('infra/mysql/init.sh')}:/docker-entrypoint-initdb.d/01-plant.sh:ro`,
    '-v',
    `${resolve('backups')}:/restore-backups:ro`,
    'mysql:8.4',
  ]);
  restored = true;
  for (let i = 0; i < 90; i++) {
    const log = await docker(['logs', 'plant-v2-test-restore']);
    if (log.stdout.includes('MySQL init process done.')) {
      try {
        await docker([
          'exec',
          'plant-v2-test-restore',
          'bash',
          '-c',
          'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "SELECT 1"',
        ]);
        break;
      } catch {}
    }
    if (i === 89) throw Error('Restore server did not become ready');
    await delay();
  }
  await docker([
    'exec',
    'plant-v2-test-restore',
    'bash',
    '-c',
    `set -o pipefail; gzip -dc /restore-backups/${file} | MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot`,
  ]);
  const result = await docker([
    'exec',
    'plant-v2-test-restore',
    'bash',
    '-c',
    `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B -e '${countsSql}'`,
  ]);
  assert.deepEqual(result.stdout.trim().split('\t'), Object.values(before[0]).map(String));
  console.log(JSON.stringify({ event: 'test.backup_restore', result: 'passed', tablesCompared: 14, file }));
} finally {
  if (restored) await docker(['stop', 'plant-v2-test-restore']);
  await source.end().catch(() => {});
  await client.dispose();
}
