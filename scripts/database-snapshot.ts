// Read-only fingerprints for logical database transfers. Never exports row values.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import mysql from 'mysql2/promise';

type Table = { rows: number; sha256: string; schemaSha256: string; primaryKey: string[] };
type Snapshot = {
  format: 1;
  capturedAt: string;
  origin: string | null;
  code: { commit: string | null; migrationsSha256: string };
  serverVersions: Record<string, string>;
  databases: Record<string, Record<string, Table>>;
};
const databases = [
  ['plant_auth', 'AUTH_MIGRATION_DATABASE_URL'],
  ['plant_bag_filter', 'BAG_MIGRATION_DATABASE_URL'],
  ['plant_consumables', 'CONSUMABLES_MIGRATION_DATABASE_URL'],
] as const;
const ephemeral = new Set(['plant_auth.sessions', 'plant_auth.verifications', 'plant_auth.login_attempts']);
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const identifier = (v: string) => '`' + v.replaceAll('`', '``') + '`';
const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  if (i < 0 || !args[i + 1] || args[i + 1].startsWith('--')) throw Error(`${name} diperlukan.`);
  return args[i + 1];
}
async function migrationsHash() {
  const files: string[] = [];
  async function walk(folder: string) {
    for (const e of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, e.name);
      if (e.isDirectory()) await walk(path);
      else if (/\.(sql|json)$/.test(e.name)) files.push(path);
    }
  }
  for (const core of ['auth-core', 'bag-core', 'consumables-core']) await walk(`packages/${core}/migrations`);
  const h = createHash('sha256');
  for (const file of files.sort((a, b) =>
    a.replaceAll('\\', '/').localeCompare(b.replaceAll('\\', '/'), 'en'),
  )) {
    h.update(relative('.', file).replaceAll('\\', '/') + '\0');
    h.update((await readFile(file, 'utf8')).replaceAll('\r\n', '\n') + '\0');
  }
  return h.digest('hex');
}
async function capture() {
  const out = option('--out');
  const snapshot: Snapshot = {
    format: 1,
    capturedAt: new Date().toISOString(),
    origin: process.env.PUBLIC_ORIGIN || null,
    code: {
      commit: await promisify(execFile)('git', ['rev-parse', 'HEAD'])
        .then((r) => r.stdout.trim())
        .catch(() => null),
      migrationsSha256: await migrationsHash(),
    },
    serverVersions: {},
    databases: {},
  };
  let endpoint: string | undefined;
  for (const [database, env] of databases) {
    const uri = process.env[env];
    if (!uri || new URL(uri).pathname !== '/' + database) throw Error(`${env} harus menunjuk ${database}.`);
    const target = new URL(uri);
    const address = target.hostname + ':' + (target.port || '3306');
    if (endpoint && endpoint !== address) throw Error('Ketiga URL harus menunjuk satu instance MySQL.');
    endpoint = address;
    const connection = await mysql.createConnection({
      uri,
      timezone: 'Z',
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      decimalNumbers: false,
      jsonStrings: true,
    });
    try {
      await connection.query("SET SESSION time_zone='+00:00'");
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
      const [version] = await connection.query<mysql.RowDataPacket[]>('SELECT VERSION() AS version');
      snapshot.serverVersions[database] = String(version[0].version);
      const [tables] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME',
        [database],
      );
      if (!tables.length) throw Error(`${database}: schema kosong; belum dapat menjadi baseline migrasi.`);
      for (const catalog of ['TRIGGERS', 'ROUTINES', 'EVENTS']) {
        const column =
          catalog === 'TRIGGERS'
            ? 'TRIGGER_SCHEMA'
            : catalog === 'ROUTINES'
              ? 'ROUTINE_SCHEMA'
              : 'EVENT_SCHEMA';
        const [objects] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT COUNT(*) AS n FROM information_schema.${catalog} WHERE ${column}=?`,
          [database],
        );
        if (Number(objects[0].n)) throw Error(`${database}: ${catalog} memerlukan review transfer khusus.`);
      }
      snapshot.databases[database] = {};
      for (const table of tables) {
        if (table.type !== 'BASE TABLE' || table.engine !== 'InnoDB')
          throw Error(`${database}: hanya tabel InnoDB yang didukung.`);
        const name = String(table.name);
        const [keys] = await connection.query<mysql.RowDataPacket[]>(
          "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX",
          [database, name],
        );
        const primaryKey = keys.map((k) => String(k.name));
        if (!primaryKey.length)
          throw Error(`${database}.${name}: primary key diperlukan untuk hash deterministik.`);
        const [definition] = await connection.query<mysql.RowDataPacket[]>(
          'SHOW CREATE TABLE ' + identifier(name),
        );
        // Current sequence positions may differ after a logical reload; stored IDs are hashed in full.
        const schema = String(definition[0]['Create Table'])
          .replace(/ AUTO_INCREMENT=\d+\b/g, '')
          .replaceAll('\r\n', '\n');
        const h = createHash('sha256');
        const [rows] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT * FROM ${identifier(name)} ORDER BY ${primaryKey.map(identifier).join(',')}`,
        );
        for (const row of rows) h.update(JSON.stringify(row) + '\n');
        snapshot.databases[database][name] = {
          rows: rows.length,
          sha256: h.digest('hex'),
          schemaSha256: hash(schema),
          primaryKey,
        };
      }
      const [foreignKeys] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT TABLE_NAME AS child,CONSTRAINT_NAME AS constraintName,COLUMN_NAME AS childColumn,REFERENCED_TABLE_SCHEMA AS parentSchema,REFERENCED_TABLE_NAME AS parent,REFERENCED_COLUMN_NAME AS parentColumn FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION',
        [database],
      );
      const groups = new Map<string, mysql.RowDataPacket[]>();
      for (const fk of foreignKeys) {
        const key = String(fk.child) + '.' + String(fk.constraintName);
        groups.set(key, [...(groups.get(key) || []), fk]);
      }
      for (const columns of groups.values()) {
        const first = columns[0];
        if (first.parentSchema !== database)
          throw Error('Foreign key lintas database memerlukan review khusus.');
        const match = columns
          .map((fk) => `c.${identifier(String(fk.childColumn))}=p.${identifier(String(fk.parentColumn))}`)
          .join(' AND ');
        const nonNull = columns
          .map((fk) => `c.${identifier(String(fk.childColumn))} IS NOT NULL`)
          .join(' AND ');
        const [orphans] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT 1 FROM ${identifier(String(first.child))} c LEFT JOIN ${identifier(String(first.parent))} p ON ${match} WHERE ${nonNull} AND p.${identifier(String(first.parentColumn))} IS NULL LIMIT 1`,
        );
        if (orphans.length) throw Error('Ditemukan foreign key orphan; jangan lanjut transfer.');
      }
      await connection.commit();
    } finally {
      await connection.end();
    }
  }
  await writeFile(out, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(
    JSON.stringify({
      event: 'database.snapshot_saved',
      file: out,
      counts: Object.fromEntries(
        Object.entries(snapshot.databases).map(([db, tables]) => [
          db,
          Object.fromEntries(Object.entries(tables).map(([name, t]) => [name, t.rows])),
        ]),
      ),
    }),
  );
}
async function compare() {
  const expected: Snapshot = JSON.parse(await readFile(option('--expected'), 'utf8'));
  const actual: Snapshot = JSON.parse(await readFile(option('--actual'), 'utf8'));
  if (expected.format !== 1 || actual.format !== 1) throw Error('Format snapshot tidak dikenal.');
  const differences: string[] = [];
  if (expected.code.migrationsSha256 !== actual.code.migrationsSha256) differences.push('migration-files');
  const expectedNames = Object.keys(expected.databases).sort();
  if (
    JSON.stringify(expectedNames) !== JSON.stringify(databases.map(([db]) => db).sort()) ||
    JSON.stringify(expectedNames) !== JSON.stringify(Object.keys(actual.databases).sort())
  )
    differences.push('database-list');
  for (const [db, tables] of Object.entries(expected.databases)) {
    if (
      JSON.stringify(Object.keys(tables).sort()) !==
      JSON.stringify(Object.keys(actual.databases[db] || {}).sort())
    )
      differences.push(db + ':table-list');
    for (const [name, table] of Object.entries(tables)) {
      const current = actual.databases[db]?.[name],
        key = db + '.' + name;
      if (!current) {
        differences.push(key + ':missing');
        continue;
      }
      if (
        table.schemaSha256 !== current.schemaSha256 ||
        JSON.stringify(table.primaryKey) !== JSON.stringify(current.primaryKey)
      )
        differences.push(key + ':schema');
      if (args.includes('--after-session-revoke') && ephemeral.has(key)) {
        if (current.rows !== 0 || current.sha256 !== hash('')) differences.push(key + ':not-empty');
      } else if (table.rows !== current.rows || table.sha256 !== current.sha256)
        differences.push(key + ':data');
    }
  }
  console.log(
    JSON.stringify({
      event: 'database.snapshot_compared',
      passed: !differences.length,
      phase: args.includes('--after-session-revoke') ? 'after-session-revoke' : 'exact',
      differences,
    }),
  );
  if (differences.length) process.exitCode = 1;
}
try {
  if (args[0] === 'capture') await capture();
  else if (args[0] === 'compare') await compare();
  else
    throw Error(
      'Gunakan capture --out FILE atau compare --expected FILE --actual FILE [--after-session-revoke].',
    );
} catch {
  // mysql2 errors can contain SQL, row values or connection details; keep those out of logs.
  console.error(
    JSON.stringify({
      event: 'database.snapshot_failed',
      message:
        'Periksa argumen, schema/primary key, izin, koneksi, dan path output baru; detail database tidak dicetak.',
    }),
  );
  process.exitCode = 1;
}
