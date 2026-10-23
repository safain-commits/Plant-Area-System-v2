import { createHash, randomUUID } from 'node:crypto';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { equipment, equipmentPositions, getEquipment, validPosition, type Position } from '@plant/contracts';
import { canonicalReplacement } from '@plant/bag-core';

export const equipmentMigrationId = '20261022-equipment-layout-v2';

// Called under the migration job's advisory lock, with application writes stopped.
// DDL lives in Drizzle migrations; this transaction contains only DML and its checkpoint.
export async function migrateEquipmentData(connection: Connection, database: 'auth-core' | 'bag-core') {
  await connection.beginTransaction();
  try {
    const [done] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM data_migrations WHERE id=? FOR UPDATE',
      [equipmentMigrationId],
    );
    if (done.length) {
      if (database === 'bag-core') await verifyBagCatalog(connection);
      await connection.commit();
      return false;
    }
    if (database === 'bag-core') {
      await migrateBag(connection);
      await verifyBagCatalog(connection);
    } else await migrateGrants(connection);
    await connection.query('INSERT INTO data_migrations (id,completed_at) VALUES (?,UTC_TIMESTAMP(3))', [
      equipmentMigrationId,
    ]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function verifyBagCatalog(db: Connection) {
  const [catalog] = await db.query<RowDataPacket[]>('SELECT code,per_side FROM equipment');
  if (
    catalog.length !== equipment.length ||
    catalog.some((e) => getEquipment(e.code)?.perSide !== e.per_side)
  )
    throw Error('Equipment catalog differs from the migrated configuration. Stop old migration containers.');
  const [positions] = await db.query<RowDataPacket[]>(
    'SELECT equipment_code,side,compartment,col AS `column`,row_no AS `row` FROM coordinates',
  );
  const expected = equipment.reduce((n, e) => n + e.compartments * e.bagsPerCompartment, 0);
  if (
    positions.length !== expected ||
    positions.some((p) => {
      const eq = getEquipment(p.equipment_code);
      return !eq || !validPosition(p as Position, eq);
    })
  )
    throw Error('Coordinates differ from the migrated configuration. Stop old migration containers.');
}

async function migrateBag(db: Connection) {
  const [old422] = await db.query<RowDataPacket[]>("SELECT code FROM equipment WHERE code='422-BF2'");
  const [new422] = await db.query<RowDataPacket[]>("SELECT code FROM equipment WHERE code='422-BF1'");
  if (old422.length && new422.length) throw Error('Migration conflict: 422-BF2 and 422-BF1 both exist.');
  for (const code of ['421-BF1', '422-BF1']) {
    const [sides] = await db.query<RowDataPacket[]>(
      'SELECT DISTINCT side FROM coordinates WHERE equipment_code=?',
      [code],
    );
    const legacy = sides.some((s) => s.side === 'Utara' || s.side === 'Selatan');
    const target = sides.some((s) => s.side === 'A' || s.side === 'B');
    if (legacy && target) throw Error(`Migration conflict: legacy and new coordinates coexist for ${code}.`);
  }
  // Capture affected batches before renaming. Their hashes must use the new wire representation.
  const [changed] = await db.query<RowDataPacket[]>(`SELECT DISTINCT b.id FROM replacement_batches b
    LEFT JOIN installations i ON i.batch_id=b.id
    WHERE b.equipment_code='422-BF2' OR (b.equipment_code IN ('421-BF1','422-BF1') AND i.side IN ('Utara','Selatan'))`);

  // Insert destinations before updating children: all foreign keys stay enabled.
  for (const eq of equipment) {
    await db.query(
      'INSERT INTO equipment (code,per_side) VALUES (?,?) ON DUPLICATE KEY UPDATE per_side=VALUES(per_side)',
      [eq.code, eq.perSide],
    );
    const positions = equipmentPositions(eq);
    for (let start = 0; start < positions.length; start += 500) {
      const values = positions
        .slice(start, start + 500)
        .map((p) => [eq.code, p.side, p.compartment, p.column, p.row]);
      await db.query(
        'INSERT INTO coordinates (equipment_code,side,compartment,col,row_no) VALUES ? ON DUPLICATE KEY UPDATE equipment_code=VALUES(equipment_code)',
        [values],
      );
    }
  }
  await db.query(`UPDATE installations SET
    equipment_code=IF(equipment_code='422-BF2','422-BF1',equipment_code),
    side=CASE side WHEN 'Utara' THEN 'A' WHEN 'Selatan' THEN 'B' ELSE side END
    WHERE equipment_code IN ('421-BF1','422-BF2','422-BF1')`);
  await db.query("UPDATE replacement_batches SET equipment_code='422-BF1' WHERE equipment_code='422-BF2'");
  await db.query("UPDATE bag_audit SET equipment_code='422-BF1' WHERE equipment_code='422-BF2'");
  await db.query(
    "DELETE FROM coordinates WHERE equipment_code='422-BF2' OR (equipment_code IN ('421-BF1','422-BF1') AND side IN ('Utara','Selatan'))",
  );
  await db.query("DELETE FROM equipment WHERE code='422-BF2'");

  for (const { id } of changed) {
    const [batches] = await db.query<RowDataPacket[]>(
      'SELECT equipment_code,installed_at,reason,wo,brand FROM replacement_batches WHERE id=?',
      [id],
    );
    const [positions] = await db.query<RowDataPacket[]>(
      'SELECT side,compartment,col AS `column`,row_no AS `row` FROM installations WHERE batch_id=?',
      [id],
    );
    const b = batches[0];
    const value = canonicalReplacement({
      equipmentCode: b.equipment_code,
      installedAt: b.installed_at.toISOString(),
      reason: b.reason,
      wo: b.wo,
      ...(b.brand === null ? {} : { brand: b.brand }),
      positions: positions as Position[],
    });
    const hash = createHash('sha256').update(JSON.stringify(value)).digest('hex');
    await db.query('UPDATE replacement_batches SET request_hash=? WHERE id=?', [hash, id]);
  }
}

async function migrateGrants(db: Connection) {
  const [bootstrap] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT target_id FROM auth_audit WHERE action='bootstrap.created'",
  );
  const bootstrapIds = new Set(bootstrap.map((r) => r.target_id));
  const [grants] = await db.query<RowDataPacket[]>(
    "SELECT user_id,equipment FROM app_grants WHERE app_id='bag-filter' FOR UPDATE",
  );
  for (const grant of grants) {
    const before: unknown = JSON.parse(grant.equipment);
    if (!Array.isArray(before) || !before.every((code) => typeof code === 'string'))
      throw Error('Invalid equipment grant; migration stopped.');
    const after = [...new Set(before.map((code: string) => (code === '422-BF2' ? '422-BF1' : code)))];
    if (bootstrapIds.has(grant.user_id))
      for (const code of ['L61-BF1', 'L62-BF1']) if (!after.includes(code)) after.push(code);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    await db.query("UPDATE app_grants SET equipment=? WHERE user_id=? AND app_id='bag-filter'", [
      JSON.stringify(after),
      grant.user_id,
    ]);
    await db.query(
      `INSERT INTO auth_audit (id,actor_id,actor_name,action,target_id,details,created_at)
      VALUES (?, 'system:equipment-migration', 'Migrasi equipment', 'equipment.scope_migrated', ?, ?, UTC_TIMESTAMP(3))`,
      [randomUUID(), grant.user_id, JSON.stringify({ migration: equipmentMigrationId, before, after })],
    );
  }
}
