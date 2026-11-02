import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { eq, sql } from 'drizzle-orm';
import {
  saveMaterial,
  saveInventory,
  postMovement,
  materialDetail,
  listInventory,
  listMaterials,
  listMovements,
  stockDashboard,
  reconcile,
  getConsumablesDb,
  closeConsumablesDb,
  consumablesSchema,
} from '@plant/consumables-core';
import { importCatalog } from '@plant/consumables-core/import';
import { type Identity, AppError } from '@plant/contracts';
if (
  process.env.TEST_DATABASE !== '1' ||
  !process.env.CONSUMABLES_DATABASE_URL?.includes('127.0.0.1:13306/plant_consumables')
)
  throw Error('Use isolated MySQL only.');
const actor: Identity = {
  id: randomUUID(),
  name: 'Stock integration',
  email: 'stock@example.test',
  position: '',
  portalAdmin: false,
  mustChangePassword: false,
  grants: [{ appId: 'consumables', role: 'admin' }],
};
const key = () => randomUUID();
const input = (suffix = key()) => ({
  mmid: 'TEST-' + suffix,
  description: 'Synthetic stock ' + suffix,
  commonName: 'Synthetic',
  unit: 'KG',
  category: 'Synthetic',
  mrpType: 'PD',
  critical: true,
  packSize: '0.125000',
  active: true,
});
const conflict = (e: unknown) => e instanceof AppError && e.status === 409;
async function fixture() {
  const source = input();
  const { id: materialId } = await saveMaterial(actor, source);
  const { id: inventoryId } = await saveInventory(actor, { materialId, rack: 'A1' });
  return { materialId: materialId!, inventoryId, source };
}
async function state(f: { materialId: string }) {
  return (await materialDetail(actor, f.materialId)).stock!;
}
test('opening, decimal receipts/issues, pack snapshots, correction and immutable history', async () => {
  const f = await fixture(),
    base = { materialId: f.materialId };
  assert.equal((await state(f)).initialized, false);
  await assert.rejects(
    postMovement(actor, 'issue', { ...base, quantity: '0.1', job: 'Job' }, key()),
    conflict,
  );
  await postMovement(
    actor,
    'opening',
    { ...base, quantity: '0', reason: 'Physical zero', expectedVersion: 1 },
    key(),
  );
  assert.equal((await state(f)).initialized, true);
  await assert.rejects(
    postMovement(actor, 'opening', { ...base, quantity: '1', reason: 'Again', expectedVersion: 2 }, key()),
    conflict,
  );
  await postMovement(actor, 'receipt', { ...base, mode: 'base', quantity: '0.1', reference: 'R1' }, key());
  await postMovement(actor, 'receipt', { ...base, mode: 'base', quantity: '0.2', reference: 'R2' }, key());
  assert.equal((await state(f)).quantity, '0.300000');
  const pack = await postMovement(
    actor,
    'receipt',
    { ...base, mode: 'pack', packs: 2, materialVersion: 1, reference: 'P1' },
    key(),
  );
  assert.equal(pack.movement.packSize, '0.125000');
  assert.equal((await state(f)).quantity, '0.550000');
  await postMovement(actor, 'issue', { ...base, quantity: '0.05', job: 'Maintenance', wo: 'W1' }, key());
  assert.equal((await state(f)).quantity, '0.500000');
  const current = await state(f);
  await assert.rejects(
    postMovement(actor, 'adjustment', { ...base, quantity: '1', reason: 'Count', expectedVersion: 1 }, key()),
    conflict,
  );
  await postMovement(
    actor,
    'adjustment',
    { ...base, quantity: '0.25', reason: 'Recount', expectedVersion: current.inventoryVersion },
    key(),
  );
  assert.equal((await state(f)).quantity, '0.250000');
  await saveMaterial(
    actor,
    { ...f.source, description: 'Changed name', packSize: '1', version: 1 },
    f.materialId,
  );
  await assert.rejects(
    postMovement(
      actor,
      'receipt',
      { ...base, mode: 'pack', packs: 1, materialVersion: 1, reference: 'Stale' },
      key(),
    ),
    conflict,
  );
  await assert.rejects(saveMaterial(actor, { ...f.source, unit: 'L', version: 2 }, f.materialId), conflict);
  await assert.rejects(
    saveMaterial(actor, { ...f.source, active: false, version: 2 }, f.materialId),
    conflict,
  );
  const history = await listMovements(actor, new URLSearchParams({ materialId: f.materialId }));
  assert.equal(history.items.length, 6);
  assert.equal(history.items.find((m) => m.id === pack.movement.id)?.description, f.source.description);
  assert.equal(history.items.find((m) => m.type === 'adjustment')?.quantity, '-0.250000');
  assert.deepEqual((await reconcile(actor)).items, []);
});
test('concurrent withdrawals and idempotent requests cannot overdraw or duplicate', async () => {
  const f = await fixture(),
    base = { materialId: f.materialId };
  await postMovement(
    actor,
    'opening',
    { ...base, quantity: '5', reason: 'Count', expectedVersion: 1 },
    key(),
  );
  const results = await Promise.allSettled(
    [1, 2].map(() => postMovement(actor, 'issue', { ...base, quantity: '4', job: 'Concurrent' }, key())),
  );
  assert.equal(results.filter((v) => v.status === 'fulfilled').length, 1);
  assert.equal((await state(f)).quantity, '1.000000');
  const k = key(),
    body = { ...base, mode: 'base', quantity: '0.125', reference: 'Retry' };
  const both = await Promise.all([
    postMovement(actor, 'receipt', body, k),
    postMovement(actor, 'receipt', body, k),
  ]);
  assert.equal(both[0].movement.id, both[1].movement.id);
  assert.equal(both.filter((v) => v.replayed).length, 1);
  assert.equal((await state(f)).quantity, '1.125000');
  await assert.rejects(postMovement(actor, 'receipt', { ...body, quantity: '2' }, k), conflict);
  const replay = await postMovement(actor, 'receipt', { ...body, quantity: '0.125000' }, k);
  assert.equal(replay.replayed, true);
});
test('all granted roles share R22 while action rights and revoked grants fail closed', async () => {
  const a = await fixture(),
    b = await fixture();
  const viewer: Identity = {
    ...actor,
    portalAdmin: true,
    grants: [{ appId: 'consumables', role: 'viewer' }],
  };
  assert.equal((await materialDetail(viewer, b.materialId)).stock!.inventoryId, b.inventoryId);
  assert.equal((await materialDetail(viewer, a.materialId)).stock!.rack, 'A1');
  await assert.rejects(
    postMovement(
      viewer,
      'opening',
      { materialId: a.materialId, quantity: '0', reason: 'Try', expectedVersion: 1 },
      key(),
    ),
    (e) => e instanceof AppError && e.status === 403,
  );
  const revoked: Identity = { ...viewer, grants: [] };
  await assert.rejects(
    listInventory(revoked, new URLSearchParams()),
    (e) => e instanceof AppError && e.status === 403,
  );
  await assert.rejects(
    materialDetail(revoked, b.materialId),
    (e) => e instanceof AppError && e.status === 403,
  );
  const d = await stockDashboard(viewer);
  assert.ok(d.operational >= 2);
  assert.ok(d.uncounted >= 2);
  assert.equal(d.series.length, 4);
  await assert.rejects(
    saveInventory(actor, { materialId: a.materialId, locationId: key() }),
    (e) => e instanceof AppError && e.status === 400,
  );
});
test('audit failure rolls back balance, movement and idempotency; same key can retry', async () => {
  const f = await fixture(),
    base = { materialId: f.materialId };
  await postMovement(
    actor,
    'opening',
    { ...base, quantity: '0', reason: 'Count', expectedVersion: 1 },
    key(),
  );
  const root = await mysql.createConnection(process.env.CONSUMABLES_MIGRATION_DATABASE_URL!);
  const k = key(),
    body = { ...base, mode: 'base', quantity: '2', reference: 'Rollback' };
  try {
    await root.query(
      `CREATE TRIGGER test_audit_failure BEFORE INSERT ON consumables_audit FOR EACH ROW BEGIN IF NEW.actor_id='${actor.id}' AND NEW.action='stock.receipt' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected failure'; END IF; END`,
    );
    await assert.rejects(postMovement(actor, 'receipt', body, k));
    assert.equal((await state(f)).quantity, '0.000000');
    assert.equal(
      (await listMovements(actor, new URLSearchParams({ materialId: f.materialId }))).items.length,
      1,
    );
  } finally {
    await root.query('DROP TRIGGER IF EXISTS test_audit_failure');
    await root.end();
  }
  const retry = await postMovement(actor, 'receipt', body, k);
  assert.equal(retry.replayed, false);
  assert.equal((await state(f)).quantity, '2.000000');
});
test('single stock registration is unique and server pagination retains more than 300 movements', async () => {
  const f = await fixture();
  await assert.rejects(saveInventory(actor, { materialId: f.materialId }), conflict);
  const p = await listInventory(actor, new URLSearchParams({ materialId: f.materialId }));
  assert.equal(p.items.length, 1);
  assert.equal(p.nextCursor, null);
  await postMovement(
    actor,
    'opening',
    {
      materialId: f.materialId,
      quantity: '1',
      reason: 'Count',
      expectedVersion: 1,
    },
    key(),
  );
  for (let i = 0; i < 303; i++)
    await postMovement(
      actor,
      'receipt',
      {
        materialId: f.materialId,
        mode: 'base',
        quantity: '0.1',
        reference: 'Page',
      },
      key(),
    );
  const h = await listMovements(actor, new URLSearchParams({ materialId: f.materialId }));
  assert.equal(h.items.length, 50);
  const h2 = await listMovements(
    actor,
    new URLSearchParams({ materialId: f.materialId, cursor: h.nextCursor! }),
  );
  const all = [...h.items, ...h2.items];
  let cursor = h2.nextCursor;
  while (cursor) {
    const page = await listMovements(actor, new URLSearchParams({ materialId: f.materialId, cursor }));
    all.push(...page.items);
    cursor = page.nextCursor;
  }
  assert.equal(all.length, 304);
  assert.equal(new Set(all.map((v) => v.id)).size, 304);
});
test('catalog dry-run/apply/replay preserve master-only import and conflict atomically', async () => {
  const batch = 'test-' + key(),
    mmid = 'IMP-' + key(),
    row = [mmid, 'Imported synthetic', 'Common', 'EA', '', 1, '2020-01-01', 99, 12345, 'Synthetic'];
  const file = JSON.stringify({ batch, rows: [row] });
  assert.equal((await importCatalog(file)).applied, false);
  assert.equal((await listMaterials(actor, new URLSearchParams({ q: mmid }))).items.length, 0);
  assert.equal((await importCatalog(file, true)).inserted, 1);
  assert.equal((await importCatalog(file, true)).replayed, true);
  const m = (await listMaterials(actor, new URLSearchParams({ q: mmid }))).items[0];
  assert.equal(m.packSize, null);
  assert.equal((await materialDetail(actor, m.id)).stock, null);
  await assert.rejects(
    importCatalog(JSON.stringify({ batch, rows: [[...row.slice(0, 1), 'Changed', ...row.slice(2)]] }), true),
    conflict,
  );
  const other = 'IMP-' + key();
  await assert.rejects(
    importCatalog(
      JSON.stringify({
        batch: 'test-' + key(),
        rows: [
          [other, ...row.slice(1)],
          [mmid, 'Conflict', ...row.slice(2)],
        ],
      }),
      true,
    ),
    conflict,
  );
  assert.equal((await listMaterials(actor, new URLSearchParams({ q: other }))).items.length, 0);
});
test('quarter and date filters use WIB boundaries rather than UTC dates', async () => {
  const f = await fixture(),
    base = { materialId: f.materialId };
  const opening = await postMovement(
    actor,
    'opening',
    { ...base, quantity: '0', reason: 'Boundary fixture', expectedVersion: 1 },
    key(),
  );
  await getConsumablesDb()
    .update(consumablesSchema.movements)
    .set({ createdAt: new Date('2001-12-31T16:59:59.999Z') })
    .where(eq(consumablesSchema.movements.id, opening.movement.id));
  for (const when of [
    '2001-12-31T17:00:00Z',
    '2002-03-31T17:00:00Z',
    '2002-06-30T17:00:00Z',
    '2002-09-30T17:00:00Z',
  ]) {
    const move = await postMovement(
      actor,
      'receipt',
      { ...base, mode: 'base', quantity: '1', reference: 'Quarter boundary' },
      key(),
    );
    await getConsumablesDb()
      .update(consumablesSchema.movements)
      .set({ createdAt: new Date(when) })
      .where(eq(consumablesSchema.movements.id, move.movement.id));
  }
  const scoped: Identity = {
    ...actor,
    grants: [{ appId: 'consumables', role: 'viewer' }],
  };
  const d = await stockDashboard(scoped, 2002);
  assert.deepEqual(
    d.series.map((q) => q.picklist),
    [0, 0, 0, 0],
  );
  assert.deepEqual(
    d.series.map((q) => q.opening),
    [0, 0, 0, 0],
  );
  const day = await listMovements(
    scoped,
    new URLSearchParams({ from: '2002-04-01', to: '2002-04-01', materialId: f.materialId }),
  );
  assert.equal(d.legacyMovementCount, 4);
  assert.equal(day.items.length, 1);
  assert.equal(day.items[0].createdAt, '2002-03-31T17:00:00.000Z');
});
after(async () => {
  await closeConsumablesDb();
});
