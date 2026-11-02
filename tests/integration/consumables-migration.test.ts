import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { preflightSingleRoom } from '../../scripts/consumables-room-migration';
import { R22_ROOM_ID } from '../../packages/consumables-core/src/room';

test('R22 additive upgrade preserves v1 ledger, idempotency, quantities and pack snapshots', async () => {
  const uri = process.env.CONSUMABLES_MIGRATION_DATABASE_URL;
  if (process.env.TEST_DATABASE !== '1' || !uri?.includes('127.0.0.1:13306/plant_consumables'))
    throw Error('Disposable database required.');
  const name = 'r22_upgrade_' + randomUUID().replaceAll('-', ''),
    folder = await mkdtemp(join(tmpdir(), 'r22-upgrade-'));
  const c = await mysql.createConnection({ uri, multipleStatements: true, dateStrings: true });
  const base = 'packages/consumables-core/migrations';
  try {
    await mkdir(join(folder, 'meta'));
    const journal = JSON.parse(await readFile(join(base, 'meta/_journal.json'), 'utf8'));
    journal.entries = journal.entries.slice(0, 2);
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(journal));
    for (const e of journal.entries) await copyFile(join(base, e.tag + '.sql'), join(folder, e.tag + '.sql'));
    await c.query(`CREATE DATABASE \`${name}\``);
    await c.query(`USE \`${name}\``);
    await migrate(drizzle(c), { migrationsFolder: folder });
    const m = randomUUID(),
      l = randomUUID(),
      i = randomUUID(),
      v = randomUUID(),
      k = randomUUID();
    await c.query(
      "INSERT INTO materials(id,mmid,description,common_name,unit,category,mrp_type,critical,pack_size,created_at,updated_at) VALUES (?,'001','Old SAP','Old common','EA','Test','',0,50,NOW(3),NOW(3))",
      [m],
    );
    await c.query("INSERT INTO locations(id,name,created_at) VALUES (?,'Legacy',NOW(3))", [l]);
    await c.query(
      "INSERT INTO inventory(id,material_id,location_id,rack,quantity,initialized) VALUES (?,?,?,'A1',0.5,1)",
      [i, m, l],
    );
    await c.query(
      "INSERT INTO stock_movements(id,inventory_id,material_id,location_id,mmid,description,unit,location_name,type,quantity,balance_after,packs,pack_size,reference,wo,job,reason,actor_id,actor_name,created_at) VALUES (?,?,?,?,'001','Old SAP','EA','Legacy','opening',0.5,0.5,1,50,'ref','wo','job','reason','actor','Name',NOW(3))",
      [v, i, m, l],
    );
    await c.query(
      "INSERT INTO stock_idempotency(id,actor_id,request_key,payload_hash,movement_id) VALUES (?,'actor','legacy-key',?,?)",
      [k, 'a'.repeat(64), v],
    );
    const [before] = await c.query<mysql.RowDataPacket[]>('SELECT * FROM stock_movements');
    // Verify the document upgrade separately: single-room upgrade must not merge this fixture.
    journal.entries = JSON.parse(await readFile(join(base, 'meta/_journal.json'), 'utf8')).entries.slice(
      0,
      3,
    );
    await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(journal));
    await copyFile(
      join(base, journal.entries[2].tag + '.sql'),
      join(folder, journal.entries[2].tag + '.sql'),
    );
    await migrate(drizzle(c), { migrationsFolder: folder });
    await migrate(drizzle(c), { migrationsFolder: folder });
    const [after] = await c.query<mysql.RowDataPacket[]>('SELECT * FROM stock_movements');
    for (const field of Object.keys(before[0])) assert.deepEqual(after[0][field], before[0][field], field);
    assert.equal(after[0].document_id, null);
    const [master] = await c.query<mysql.RowDataPacket[]>(
      'SELECT sap_unit,decimal_allowed,pack_size,conversion_reviewed FROM materials',
    );
    assert.deepEqual(
      { ...master[0] },
      { sap_unit: 'EA', decimal_allowed: 0, pack_size: '50.000000', conversion_reviewed: 0 },
    );
    const [keys] = await c.query<mysql.RowDataPacket[]>(
      'SELECT movement_id,document_id FROM stock_idempotency',
    );
    assert.equal(keys[0].movement_id, v);
    assert.equal(keys[0].document_id, null);
    const [balance] = await c.query<mysql.RowDataPacket[]>(
      'SELECT i.quantity,SUM(v.quantity) AS ledger FROM inventory i JOIN stock_movements v ON i.id=v.inventory_id GROUP BY i.id',
    );
    assert.equal(balance[0].quantity, balance[0].ledger);
    const preflight = await preflightSingleRoom(c);
    assert.equal(preflight.ready, false);
    assert.deepEqual(preflight.nonCanonicalRows, { inventory: 1, stock_movements: 1, stock_documents: 0 });
    await assert.rejects(migrate(drizzle(c), { migrationsFolder: base }));
    const [unchanged] = await c.query<mysql.RowDataPacket[]>('SELECT * FROM stock_movements');
    assert.deepEqual(unchanged, after);
    const [rooms] = await c.query<mysql.RowDataPacket[]>('SELECT id FROM locations');
    assert.deepEqual(
      rooms.map((v) => v.id),
      [l],
    );
    await assert.rejects(
      c.query(
        "INSERT INTO stock_idempotency(id,actor_id,request_key,payload_hash) VALUES (?,'actor','bad-key',?)",
        [randomUUID(), 'a'.repeat(64)],
      ),
    );
  } finally {
    await c.query('USE plant_consumables');
    await c.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await c.end();
    await rm(folder, { recursive: true, force: true });
  }
});

test('R22 single-room migration supports empty install, master-only upgrade and safe rerun', async () => {
  const uri = process.env.CONSUMABLES_MIGRATION_DATABASE_URL;
  if (process.env.TEST_DATABASE !== '1' || !uri?.includes('127.0.0.1:13306/plant_consumables'))
    throw Error('Disposable database required.');
  const base = 'packages/consumables-core/migrations';
  for (const existing of [false, true]) {
    const name = 'r22_master_' + randomUUID().replaceAll('-', ''),
      folder = await mkdtemp(join(tmpdir(), 'r22-master-'));
    const c: mysql.Connection = await mysql.createConnection(uri);
    try {
      await c.query(`CREATE DATABASE \`${name}\``);
      await c.query(`USE \`${name}\``);
      assert.equal((await preflightSingleRoom(c)).ready, true);
      if (existing) {
        await mkdir(join(folder, 'meta'));
        const journal = JSON.parse(await readFile(join(base, 'meta/_journal.json'), 'utf8'));
        journal.entries = journal.entries.slice(0, 2);
        await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(journal));
        for (const e of journal.entries)
          await copyFile(join(base, e.tag + '.sql'), join(folder, e.tag + '.sql'));
        await migrate(drizzle(c), { migrationsFolder: folder });
        await c.query(
          "INSERT INTO materials(id,mmid,description,common_name,unit,category,mrp_type,critical,created_at,updated_at) VALUES (?,'MASTER','Original SAP','Original name','EA','Test','',0,NOW(3),NOW(3))",
          [randomUUID()],
        );
      }
      assert.equal((await preflightSingleRoom(c)).ready, true);
      await migrate(drizzle(c), { migrationsFolder: base });
      await migrate(drizzle(c), { migrationsFolder: base });
      const [rooms] = await c.query<mysql.RowDataPacket[]>('SELECT id,name,active FROM locations');
      assert.deepEqual(
        rooms.map((r) => ({ ...r })),
        [{ id: R22_ROOM_ID, name: 'R22', active: 1 }],
      );
      const [rows] = await c.query<mysql.RowDataPacket[]>(
        'SELECT mmid,description,common_name FROM materials',
      );
      assert.equal(rows.length, existing ? 1 : 0);
      if (existing) assert.equal(rows[0].common_name, 'Original name');
      assert.equal((await preflightSingleRoom(c)).ready, true);
      // Destination conflicts fail without inventing a replacement identity.
      await c.query("UPDATE locations SET name='Wrong' WHERE id=?", [R22_ROOM_ID]);
      assert.equal((await preflightSingleRoom(c)).ready, false);
    } finally {
      await c.query('USE plant_consumables');
      await c.query(`DROP DATABASE IF EXISTS \`${name}\``);
      await c.end();
      await rm(folder, { recursive: true, force: true });
    }
  }
});
