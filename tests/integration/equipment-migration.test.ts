import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { migrateEquipmentData, equipmentMigrationId } from '../../scripts/equipment-migration';
import {
  createReplacement,
  closeBagDb,
  snapshot,
  batchHistory,
  positionHistory,
  auditHistory,
} from '@plant/bag-core';

if (process.env.TEST_DATABASE !== '1' || !process.env.BAG_MIGRATION_DATABASE_URL?.includes('127.0.0.1:13306'))
  throw Error('Migration tests require the isolated MySQL test server.');

async function fixture(kind: 'bag-core' | 'auth-core', run: (db: Connection, url: string) => Promise<void>) {
  const url = new URL(process.env.BAG_MIGRATION_DATABASE_URL!);
  const name = `test_layout_${randomUUID().replaceAll('-', '')}`;
  const root = await mysql.createConnection({ uri: url.toString(), timezone: 'Z' });
  let db: Connection | undefined;
  try {
    await root.query(`CREATE DATABASE \`${name}\``);
    url.pathname = `/${name}`;
    db = await mysql.createConnection({ uri: url.toString(), timezone: 'Z', multipleStatements: true });
    const folder = `packages/${kind}/migrations`;
    const { entries } = JSON.parse(await readFile(`${folder}/meta/_journal.json`, 'utf8'));
    for (const entry of entries) {
      const sql = await readFile(`${folder}/${entry.tag}.sql`, 'utf8');
      for (const statement of sql.split('--> statement-breakpoint'))
        if (statement.trim()) await db.query(statement);
    }
    await run(db, url.toString());
  } finally {
    if (db) await db.end();
    // Only the randomly named database created by this fixture is removed.
    await root.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await root.end();
  }
}
async function rows(db: Connection, query: string, values: unknown[] = []) {
  const [result] = await db.query<RowDataPacket[]>(query, values);
  return result;
}

test('equipment migration preserves history, rolls back on failure and supports retry', async () => {
  await fixture('bag-core', async (db, url) => {
    const batch = randomUUID(),
      actor = randomUUID(),
      key = randomUUID();
    const batch421 = randomUUID(),
      key421 = randomUUID();
    await db.query("INSERT INTO equipment VALUES ('421-BF1',15),('422-BF2',15)");
    await db.query("INSERT INTO coordinates VALUES ('421-BF1','Utara',1,1,17),('422-BF2','Selatan',15,8,1)");
    await db.query(
      `INSERT INTO replacement_batches (id,equipment_code,actor_id,actor_name,installed_at,reason,wo,created_at,idempotency_key,request_hash,position_count) VALUES (?,?,?,?,'2026-01-01','Migrasi uji','', '2026-01-02',?, ?,1)`,
      [batch, '422-BF2', actor, 'Migration tester', key, 'old-hash'],
    );
    await db.query(
      "INSERT INTO installations (id,batch_id,equipment_code,side,compartment,col,row_no,installed_at) VALUES (123,?,'422-BF2','Selatan',15,8,1,'2026-01-01')",
      [batch],
    );
    await db.query(
      "INSERT INTO bag_audit VALUES (?,?,'422-BF2',?,'Migration tester','bag.batch_created','{}','2026-01-02')",
      [randomUUID(), batch, actor],
    );
    await db.query(
      "INSERT INTO replacement_batches (id,equipment_code,actor_id,actor_name,installed_at,reason,wo,created_at,idempotency_key,request_hash,position_count) VALUES (?, '421-BF1', ?, 'Migration tester', '2026-01-01', 'Migrasi 421', '', '2026-01-02', ?, 'old-hash-421', 1)",
      [batch421, actor, key421],
    );
    await db.query(
      "INSERT INTO installations (id,batch_id,equipment_code,side,compartment,col,row_no,installed_at) VALUES (124,?,'421-BF1','Utara',1,1,17,'2026-01-01')",
      [batch421],
    );
    await db.query(`CREATE TRIGGER fail_hash BEFORE UPDATE ON replacement_batches FOR EACH ROW
      BEGIN IF NEW.request_hash <> OLD.request_hash THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='simulated hash failure'; END IF; END`);
    await assert.rejects(migrateEquipmentData(db, 'bag-core'), /simulated hash failure/);
    assert.equal((await rows(db, "SELECT * FROM equipment WHERE code='422-BF2'")).length, 1);
    assert.equal((await rows(db, "SELECT * FROM equipment WHERE code='L61-BF1'")).length, 0);
    assert.equal((await rows(db, 'SELECT * FROM data_migrations')).length, 0);
    assert.equal((await rows(db, 'SELECT side FROM installations WHERE id=123'))[0].side, 'Selatan');
    await db.query('DROP TRIGGER fail_hash');
    assert.equal(await migrateEquipmentData(db, 'bag-core'), true);
    assert.equal(await migrateEquipmentData(db, 'bag-core'), false);
    assert.equal(Number((await rows(db, 'SELECT COUNT(*) AS total FROM coordinates'))[0].total), 18784);
    const saved = (await rows(db, 'SELECT * FROM installations WHERE id=123'))[0];
    assert.equal(saved.id, 123);
    assert.equal(saved.equipment_code, '422-BF1');
    assert.equal(saved.side, 'B');
    assert.deepEqual([saved.compartment, saved.col, saved.row_no], [15, 8, 1]);
    const savedBatch = (await rows(db, 'SELECT * FROM replacement_batches WHERE id=?', [batch]))[0];
    assert.equal(savedBatch.actor_id, actor);
    assert.equal(savedBatch.installed_at.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(savedBatch.created_at.toISOString(), '2026-01-02T00:00:00.000Z');
    assert.equal((await rows(db, 'SELECT equipment_code FROM bag_audit'))[0].equipment_code, '422-BF1');
    const originalUrl = process.env.BAG_DATABASE_URL;
    await closeBagDb();
    process.env.BAG_DATABASE_URL = url;
    try {
      const replay = await createReplacement(
        { id: actor, name: 'Migration tester' },
        {
          equipmentCode: '422-BF1',
          installedAt: '2026-01-01T00:00:00Z',
          reason: 'Migrasi uji',
          wo: '',
          positions: [{ side: 'B', compartment: 15, column: 8, row: 1 }],
        },
        key,
      );
      assert.deepEqual(replay, { batchId: batch, count: 1, replayed: true });
      assert.equal((await batchHistory('422-BF1', '15B H1')).items[0].id, batch);
      assert.equal((await batchHistory('422-BF1', '15B H1')).items[0].brand, null);
      const legacyBody = {
        equipmentCode: '422-BF1',
        installedAt: '2026-01-01T00:00:00Z',
        reason: 'Migrasi uji',
        wo: '',
        positions: [{ side: 'B', compartment: 15, column: 8, row: 1 }],
      };
      await assert.rejects(
        createReplacement({ id: actor, name: 'Migration tester' }, legacyBody, randomUUID()),
        /Brand\/Pabrikan wajib/,
      );
      for (const brand of ['Intensiv filter (Original)', 'Filtras', 'Cipta Medya', 'Other']) {
        const brandKey = randomUUID();
        const payload = { ...legacyBody, brand };
        const result = await createReplacement({ id: actor, name: 'Migration tester' }, payload, brandKey);
        assert.equal(
          (await createReplacement({ id: actor, name: 'Migration tester' }, payload, brandKey)).batchId,
          result.batchId,
        );
        await assert.rejects(
          createReplacement(
            { id: actor, name: 'Migration tester' },
            { ...payload, brand: brand === 'Other' ? 'Filtras' : 'Other' },
            brandKey,
          ),
          /data berbeda/,
        );
        assert.equal(
          (await batchHistory('422-BF1')).items.find((b) => b.id === result.batchId)?.brand,
          brand,
        );
        assert.equal(
          (await positionHistory('422-BF1', { side: 'B', compartment: 15, column: 8, row: 1 })).items.find(
            (b) => b.batchId === result.batchId,
          )?.brand,
          brand,
        );
        assert.equal(
          (await auditHistory(['422-BF1'])).items.find(
            (b) => (b as unknown as { batchId: string }).batchId === result.batchId,
          )?.details.brand,
          brand,
        );
      }
      const replay421 = await createReplacement(
        { id: actor, name: 'Migration tester' },
        {
          equipmentCode: '421-BF1',
          installedAt: '2026-01-01T00:00:00Z',
          reason: 'Migrasi 421',
          wo: '',
          positions: [{ side: 'A', compartment: 1, column: 1, row: 17 }],
        },
        key421,
      );
      assert.deepEqual(replay421, { batchId: batch421, count: 1, replayed: true });
      assert.equal((await batchHistory('421-BF1', '1A A17')).items[0].id, batch421);
      assert.equal((await snapshot('421-BF1')).positions[0].id, '124');
      for (const equipmentCode of ['L61-BF1', 'L62-BF1']) {
        const positions = [
          { side: 'Timur', compartment: 8, column: 8, row: 16 },
          { side: 'Barat', compartment: 1, column: 1, row: 1 },
        ] as const;
        const value = {
          equipmentCode,
          positions: [...positions],
          installedAt: '2026-01-01T00:00:00Z',
          reason: 'Stiffener mapping',
          brand: 'Cipta Medya',
        };
        const retryKey = randomUUID();
        const created = await createReplacement({ id: actor, name: 'Migration tester' }, value, retryKey);
        assert.equal(
          (await createReplacement({ id: actor, name: 'Migration tester' }, value, retryKey)).batchId,
          created.batchId,
        );
        const state = await snapshot(equipmentCode);
        assert.equal(state.total, 2048);
        assert.equal(state.recorded, 2);
        for (const label of ['8 H16', '16 A1'])
          assert.equal((await batchHistory(equipmentCode, label)).items[0].id, created.batchId);
        assert.equal((await positionHistory(equipmentCode, positions[1])).items[0].batchId, created.batchId);
      }
    } finally {
      await closeBagDb();
      process.env.BAG_DATABASE_URL = originalUrl;
    }
    await db.query("INSERT INTO coordinates VALUES ('421-BF1','Utara',1,1,17)");
    await assert.rejects(migrateEquipmentData(db, 'bag-core'), /Coordinates differ/);
    await db.query("DELETE FROM coordinates WHERE side='Utara' AND equipment_code='421-BF1'");
    assert.equal(await migrateEquipmentData(db, 'bag-core'), false);
  });
});

test('migration stops on conflicting target equipment or coordinates', async () => {
  await fixture('bag-core', async (db) => {
    await db.query("INSERT INTO equipment VALUES ('422-BF2',15),('422-BF1',15)");
    await assert.rejects(migrateEquipmentData(db, 'bag-core'), /both exist/);
    assert.equal((await rows(db, 'SELECT * FROM data_migrations')).length, 0);
    await db.query("DELETE FROM equipment WHERE code='422-BF2'");
    await db.query("INSERT INTO coordinates VALUES ('422-BF1','Utara',1,1,1),('422-BF1','A',1,1,1)");
    await assert.rejects(migrateEquipmentData(db, 'bag-core'), /coexist/);
  });
});

test('grant migration renames scopes and adds L61/L62 only to bootstrap once', async () => {
  await fixture('auth-core', async (db) => {
    const bootstrap = randomUUID(),
      other = randomUUID();
    await db.query("INSERT INTO applications VALUES ('bag-filter','Bag Filter','active','/bag-filter')");
    for (const id of [bootstrap, other]) {
      await db.query(
        "INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?,'Tester',?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
        [id, `${id}@example.test`],
      );
      await db.query("INSERT INTO app_grants VALUES (?,'bag-filter','admin',?)", [
        id,
        JSON.stringify(['421-BF1', '422-BF2']),
      ]);
    }
    await db.query(
      "INSERT INTO auth_audit VALUES (?,?, 'Tester','bootstrap.created',?,'{}',UTC_TIMESTAMP(3))",
      [randomUUID(), bootstrap, bootstrap],
    );
    await migrateEquipmentData(db, 'auth-core');
    let grants = await rows(db, 'SELECT user_id,equipment,role FROM app_grants');
    assert.deepEqual(JSON.parse(grants.find((g) => g.user_id === bootstrap)!.equipment), [
      '421-BF1',
      '422-BF1',
      'L61-BF1',
      'L62-BF1',
    ]);
    assert.deepEqual(JSON.parse(grants.find((g) => g.user_id === other)!.equipment), ['421-BF1', '422-BF1']);
    assert.ok(grants.every((g) => g.role === 'admin'));
    assert.equal(
      (await rows(db, "SELECT * FROM auth_audit WHERE action='equipment.scope_migrated'")).length,
      2,
    );
    await db.query('UPDATE app_grants SET equipment=\'["421-BF1"]\' WHERE user_id=?', [bootstrap]);
    assert.equal(await migrateEquipmentData(db, 'auth-core'), false);
    grants = await rows(db, 'SELECT equipment FROM app_grants WHERE user_id=?', [bootstrap]);
    assert.deepEqual(JSON.parse(grants[0].equipment), ['421-BF1']);
    assert.equal((await rows(db, 'SELECT id FROM data_migrations'))[0].id, equipmentMigrationId);
  });
});
