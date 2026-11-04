import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import {
  AppError,
  equipmentCodes,
  equipmentPositions,
  getEquipment,
  positionKey,
  type Identity,
  type Position,
} from '@plant/contracts';
import {
  createReplacement,
  cancelReplacement,
  snapshot,
  positionHistory,
  batchHistory,
  dashboard,
  activity,
  auditHistory,
  getBagDb,
  closeBagDb,
  bagSchema,
} from '@plant/bag-core';

if (
  process.env.TEST_DATABASE !== '1' ||
  !['localhost', '127.0.0.1', 'mysql'].includes(new URL(process.env.BAG_DATABASE_URL!).hostname)
)
  throw Error('Cancellation tests require an isolated local database.');
const actor: Identity = {
  id: randomUUID(),
  name: 'Cancellation admin',
  email: 'cancel@example.test',
  position: 'Test',
  portalAdmin: false,
  mustChangePassword: false,
  grants: [{ appId: 'bag-filter', role: 'admin', equipment: [...equipmentCodes] }],
};
const other = { ...actor, id: randomUUID(), name: 'Second cancellation admin' };
const marker = `cancel-fixture-${randomUUID()}`;
const p: Position = { side: 'A', compartment: 5, column: 2, row: 14 };
const body = (
  positions: Position[] = [p],
  installedAt = '2025-06-01T00:00:00Z',
  code = '421-BF1',
  brand = 'Filtras',
) => ({ equipmentCode: code, positions, installedAt, brand, reason: marker, wo: '' });
const create = (positions?: Position[], date?: string, code?: string) =>
  createReplacement(actor, body(positions, date, code), randomUUID());
const reject = (status: number, code?: string) => (error: unknown) =>
  error instanceof AppError && error.status === status && (!code || error.code === code);
after(async () => {
  try {
    const rows = await getBagDb()
      .select({ id: bagSchema.batches.id })
      .from(bagSchema.batches)
      .where(eq(bagSchema.batches.actorId, actor.id));
    if (rows.length)
      await getBagDb().transaction(async (tx) => {
        const ids = rows.map((r) => r.id);
        await tx
          .delete(bagSchema.batchCancellations)
          .where(inArray(bagSchema.batchCancellations.batchId, ids));
        await tx.delete(bagSchema.bagAudit).where(inArray(bagSchema.bagAudit.batchId, ids));
        await tx.delete(bagSchema.installations).where(inArray(bagSchema.installations.batchId, ids));
        await tx.delete(bagSchema.batches).where(inArray(bagSchema.batches.id, ids));
      });
  } finally {
    await closeBagDb();
  }
});

test('wrong 3-bag equipment batch is retained but removed from state, KPIs, activity and search', async () => {
  const positions: Position[] = [
    { side: 'B', compartment: 5, column: 2, row: 14 },
    { side: 'B', compartment: 5, column: 3, row: 4 },
    { side: 'B', compartment: 6, column: 8, row: 6 },
  ];
  const previous = await createReplacement(
    actor,
    body(positions, '2024-01-01T00:00:00Z', '421-BF1', 'Other'),
    randomUUID(),
  );
  const wrong = await create(positions);
  await create(positions, '2025-05-01T00:00:00Z', '422-BF1');
  const untouched = await snapshot('422-BF1');
  const before = await snapshot('421-BF1');
  const [original] = await getBagDb()
    .select()
    .from(bagSchema.batches)
    .where(eq(bagSchema.batches.id, wrong.batchId));
  const installations = await getBagDb()
    .select()
    .from(bagSchema.installations)
    .where(eq(bagSchema.installations.batchId, wrong.batchId));
  const summary = await dashboard(['421-BF1'], 2025);
  const key = randomUUID();
  const result = await cancelReplacement(
    actor,
    '421-BF1',
    wrong.batchId,
    { reason: '  Salah equipment, seharusnya 422-BF1  ' },
    key,
  );
  assert.equal(result.cancellation.reason, 'Salah equipment, seharusnya 422-BF1');
  const state = await snapshot('421-BF1');
  for (const position of positions)
    assert.equal(
      state.positions.find((x) => positionKey(x) === positionKey(position))?.batchId,
      previous.batchId,
    );
  assert.equal(state.positions.find((x) => x.batchId === previous.batchId)?.brand, 'Other');
  assert.equal(state.recorded, before.recorded);
  assert.equal(state.updatedAt, result.cancellation.cancelledAt);
  const after = await dashboard(['421-BF1'], 2025);
  assert.equal(after.periodTotal, summary.periodTotal - 3);
  assert.equal(after.series[1].total, summary.series[1].total - 3);
  assert.equal((await snapshot('422-BF1')).updatedAt, untouched.updatedAt);
  assert.deepEqual((await snapshot('422-BF1')).positions, untouched.positions);
  assert.equal((await activity(['421-BF1'], wrong.batchId)).length, 0);
  const history = await batchHistory('421-BF1', wrong.batchId);
  assert.equal(history.items[0].status, 'cancelled');
  assert.equal(history.items[0].cancellation?.actorId, actor.id);
  assert.equal(history.items[0].positions.length, 3);
  assert.deepEqual(
    (await getBagDb().select().from(bagSchema.batches).where(eq(bagSchema.batches.id, wrong.batchId)))[0],
    original,
  );
  assert.deepEqual(
    await getBagDb()
      .select()
      .from(bagSchema.installations)
      .where(eq(bagSchema.installations.batchId, wrong.batchId)),
    installations,
  );
  const replay = await cancelReplacement(
    actor,
    '421-BF1',
    wrong.batchId,
    { reason: 'Salah equipment, seharusnya 422-BF1' },
    key,
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.cancellation.cancelledAt, result.cancellation.cancelledAt);
  await assert.rejects(
    createReplacement(actor, body(positions), original.idempotencyKey),
    reject(409, 'BATCH_CANCELLED'),
  );
  await assert.rejects(
    cancelReplacement(actor, '421-BF1', wrong.batchId, { reason: 'Berbeda' }, key),
    reject(409),
  );
  await assert.rejects(
    cancelReplacement(actor, '421-BF1', wrong.batchId, { reason: 'Salah equipment' }, randomUUID()),
    reject(409, 'BATCH_ALREADY_CANCELLED'),
  );
  assert.equal(
    (await auditHistory(['421-BF1'])).items.filter(
      (x) => x.batchId === wrong.batchId && x.action === 'bag.batch_cancelled',
    ).length,
    1,
  );
});

test('cancelled middle, equal-time and first installations do not end valid bag lifespans', async () => {
  const pos = { ...p, compartment: 7 };
  const oldest = await create([pos], '2024-01-01T00:00:00Z');
  const middle = await create([pos], '2024-02-01T00:00:00Z');
  const newest = await create([pos], '2024-03-01T00:00:00Z');
  const equal = await create([pos], '2024-03-01T00:00:00Z');
  await cancelReplacement(actor, '421-BF1', equal.batchId, { reason: 'Duplikat' }, randomUUID());
  await cancelReplacement(actor, '421-BF1', middle.batchId, { reason: 'Salah tanggal' }, randomUUID());
  const timeline = await positionHistory('421-BF1', pos);
  assert.equal(timeline.items.find((x) => x.batchId === oldest.batchId)?.endedAt, '2024-03-01T00:00:00.000Z');
  assert.equal(timeline.items.find((x) => x.batchId === newest.batchId)?.endedAt, null);
  assert.equal(timeline.items.find((x) => x.batchId === middle.batchId)?.status, 'cancelled');
  assert.equal(
    (await snapshot('421-BF1')).positions.find((x) => positionKey(x) === positionKey(pos))?.batchId,
    newest.batchId,
  );
  await cancelReplacement(actor, '421-BF1', newest.batchId, { reason: 'Salah' }, randomUUID());
  await cancelReplacement(actor, '421-BF1', oldest.batchId, { reason: 'Salah awal' }, randomUUID());
  assert.equal(
    (await snapshot('421-BF1')).positions.some((x) => positionKey(x) === positionKey(pos)),
    false,
  );
});

test('permissions, reason validation, equipment mismatch and replay after grant revocation fail closed', async () => {
  const batch = await create([{ ...p, compartment: 8 }]);
  const key = randomUUID();
  for (const role of ['viewer', 'operator'] as const)
    await assert.rejects(
      cancelReplacement(
        { ...actor, portalAdmin: true, grants: [{ appId: 'bag-filter', role, equipment: ['421-BF1'] }] },
        '421-BF1',
        batch.batchId,
        { reason: 'Salah' },
        key,
      ),
      reject(403),
    );
  for (const grants of [
    [],
    [{ appId: 'bag-filter' as const, role: 'admin' as const, equipment: ['422-BF1' as const] }],
  ])
    await assert.rejects(
      cancelReplacement(
        { ...actor, portalAdmin: true, grants },
        '421-BF1',
        batch.batchId,
        { reason: 'Salah' },
        key,
      ),
      reject(403),
    );
  for (const input of [
    { reason: '' },
    { reason: '  ' },
    { reason: 'x'.repeat(501) },
    { reason: 'Salah', actorId: actor.id },
    { reason: 'Salah', cancelledAt: new Date().toISOString() },
  ])
    await assert.rejects(cancelReplacement(actor, '421-BF1', batch.batchId, input, key), reject(400));
  await assert.rejects(
    cancelReplacement(actor, '421-BF1', batch.batchId, { reason: 'Salah' }, null),
    reject(400),
  );
  await assert.rejects(
    cancelReplacement(actor, '422-BF1', batch.batchId, { reason: 'Salah' }, key),
    reject(404),
  );
  await cancelReplacement(actor, '421-BF1', batch.batchId, { reason: 'Salah' }, key);
  await assert.rejects(
    cancelReplacement({ ...actor, grants: [] }, '421-BF1', batch.batchId, { reason: 'Salah' }, key),
    reject(403),
  );
});

test('concurrent retry and competing admins create exactly one cancellation and audit', async () => {
  const batch = await create([{ ...p, compartment: 9 }]);
  const key = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      cancelReplacement(actor, '421-BF1', batch.batchId, { reason: 'Retry' }, key),
    ),
  );
  assert.equal(results.filter((x) => !x.replayed).length, 1);
  const second = await create([{ ...p, compartment: 10 }]);
  const competing = await Promise.allSettled(
    [actor, other].map((a) =>
      cancelReplacement(a, '421-BF1', second.batchId, { reason: 'Salah' }, randomUUID()),
    ),
  );
  assert.equal(competing.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(competing.filter((x) => x.status === 'rejected' && reject(409)(x.reason)).length, 1);
  const audits = await getBagDb()
    .select()
    .from(bagSchema.bagAudit)
    .where(
      and(
        eq(bagSchema.bagAudit.batchId, second.batchId),
        eq(bagSchema.bagAudit.action, 'bag.batch_cancelled'),
      ),
    );
  assert.equal(audits.length, 1);
  await assert.rejects(
    cancelReplacement(actor, '421-BF1', second.batchId, { reason: 'Retry' }, key),
    reject(409),
  );
});

test('audit failure rolls back cancellation without touching original records', async () => {
  const batch = await create([{ ...p, compartment: 11 }]);
  const db = await mysql.createConnection(process.env.BAG_MIGRATION_DATABASE_URL!);
  try {
    await db.query(
      "CREATE TRIGGER test_cancel_audit BEFORE INSERT ON bag_audit FOR EACH ROW BEGIN IF NEW.action='bag.batch_cancelled' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected'; END IF; END",
    );
    await assert.rejects(
      cancelReplacement(actor, '421-BF1', batch.batchId, { reason: 'Salah' }, randomUUID()),
    );
    assert.equal((await batchHistory('421-BF1', batch.batchId)).items[0].status, 'active');
    assert.ok((await snapshot('421-BF1')).positions.some((x) => x.batchId === batch.batchId));
  } finally {
    await db.query('DROP TRIGGER IF EXISTS test_cancel_audit');
    await db.end();
  }
});

test('500 positions across compartments cancel as one batch and migration replay preserves data', async () => {
  const positions = equipmentPositions(getEquipment('L61-BF1')!).slice(0, 500);
  const batch = await create(positions, '2024-05-01T00:00:00Z', 'L61-BF1');
  await cancelReplacement(actor, 'L61-BF1', batch.batchId, { reason: 'Salah equipment' }, randomUUID());
  assert.equal((await snapshot('L61-BF1')).positions.filter((x) => x.batchId === batch.batchId).length, 0);
  assert.equal((await batchHistory('L61-BF1', batch.batchId)).items[0].positions.length, 500);
  const db = await mysql.createConnection({
    uri: process.env.BAG_MIGRATION_DATABASE_URL!,
    multipleStatements: true,
    timezone: 'Z',
  });
  try {
    await migrate(drizzle(db), { migrationsFolder: 'packages/bag-core/migrations' });
  } finally {
    await db.end();
  }
  assert.equal((await batchHistory('L61-BF1', batch.batchId)).items[0].status, 'cancelled');
});

test('cancelled and active history pagination has no gaps or duplicates', async () => {
  const pos = { ...p, compartment: 12 };
  const ids: string[] = [];
  for (let i = 0; i < 52; i++) {
    const batch = await create([pos]);
    ids.push(batch.batchId);
    if (i % 2 === 0)
      await cancelReplacement(actor, '421-BF1', batch.batchId, { reason: 'Pagination' }, randomUUID());
  }
  const first = await positionHistory('421-BF1', pos);
  const second = await positionHistory('421-BF1', pos, first.nextCursor);
  assert.equal(first.items.length, 50);
  assert.equal(second.items.length, 2);
  assert.equal(new Set([...first.items, ...second.items].map((x) => x.id)).size, 52);
  assert.equal([...first.items, ...second.items].filter((x) => x.status === 'cancelled').length, 26);
  const page = await batchHistory('421-BF1', marker);
  const rest = await batchHistory('421-BF1', marker, page.nextCursor);
  assert.equal([...page.items, ...rest.items].filter((x) => ids.includes(x.id)).length, 52);
});

test(
  'recording retries exceeding the pool size do not acquire nested pool connections',
  { timeout: 15000 },
  async () => {
    const payload = body([{ ...p, compartment: 13 }]);
    const key = randomUUID();
    const batch = await createReplacement(actor, payload, key);
    const responses = await Promise.all(
      Array.from({ length: 24 }, () => createReplacement(actor, payload, key)),
    );
    assert.ok(responses.every((x) => x.replayed && x.batchId === batch.batchId));
    await cancelReplacement(actor, '421-BF1', batch.batchId, { reason: 'Salah' }, randomUUID());
    const cancelled = await Promise.allSettled(
      Array.from({ length: 24 }, () => createReplacement(actor, payload, key)),
    );
    assert.ok(cancelled.every((x) => x.status === 'rejected' && reject(409, 'BATCH_CANCELLED')(x.reason)));
  },
);
