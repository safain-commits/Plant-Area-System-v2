import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { snapshot, dashboard, createReplacement, getBagDb, closeBagDb, bagSchema } from '@plant/bag-core';
import type { Position } from '@plant/contracts';

if (process.env.TEST_DATABASE !== '1') throw Error('Equipment KPI tests require an isolated test database.');
const url = new URL(process.env.BAG_DATABASE_URL || '');
if (!['127.0.0.1', 'localhost', 'mysql'].includes(url.hostname))
  throw Error('Equipment KPI tests require a local test database host.');
const actor = { id: randomUUID(), name: 'Equipment KPI fixture' };
after(async () => {
  try {
    const rows = await getBagDb()
      .select({ id: bagSchema.batches.id })
      .from(bagSchema.batches)
      .where(eq(bagSchema.batches.actorId, actor.id));
    if (rows.length)
      await getBagDb().transaction(async (tx) => {
        const ids = rows.map((r) => r.id);
        await tx.delete(bagSchema.bagAudit).where(inArray(bagSchema.bagAudit.batchId, ids));
        await tx.delete(bagSchema.installations).where(inArray(bagSchema.installations.batchId, ids));
        await tx.delete(bagSchema.batches).where(inArray(bagSchema.batches.id, ids));
      });
  } finally {
    await closeBagDb();
  }
});

test('equipment replacement KPI counts every bag, scopes equipment, uses WIB boundaries and survives replay', async () => {
  const now = Date.parse('2025-06-15T12:00:00Z');
  const newYear = Date.parse('2025-12-31T17:00:00Z');
  const before = await snapshot('422-BF1', now);
  if (!before.recorded) assert.equal(before.updatedAt, null);
  const beforeNewYear = await snapshot('422-BF1', newYear);
  for (const [equipmentCode, installedAt, count] of [
    ['422-BF1', '2023-12-31T16:59:59.999Z', 1],
    ['422-BF1', '2023-12-31T17:00:00Z', 2],
    ['422-BF1', '2024-12-31T16:59:59.999Z', 3],
    ['422-BF1', '2024-12-31T17:00:00Z', 4],
    ['422-BF1', '2025-06-15T00:00:00Z', 1],
    ['422-BF1', '2025-06-15T12:01:00.000Z', 2],
    ['422-BF1', '2025-06-15T12:01:00.001Z', 3],
    ['422-BF1', '2025-12-31T17:00:00Z', 4],
    ['421-BF1', '2024-12-31T17:00:00Z', 5],
  ] as const) {
    const payload = {
      equipmentCode,
      installedAt,
      brand: 'Filtras',
      reason: 'Equipment KPI fixture',
      wo: '',
      positions: Array.from({ length: count }, (_, i): Position => ({
        side: 'A',
        compartment: 1,
        column: i + 1,
        row: 17,
      })),
    };
    const key = randomUUID();
    const first = await createReplacement(actor, payload, key);
    const replay = await createReplacement(actor, payload, key);
    assert.equal(replay.batchId, first.batchId);
    assert.equal(replay.replayed, true);
  }
  // The latest recording can be an old installation outside both KPI years.
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(before.updatedAt || '') || 0) + 1000);
  await getBagDb()
    .update(bagSchema.batches)
    .set({ createdAt: updatedAt })
    .where(
      and(
        eq(bagSchema.batches.actorId, actor.id),
        eq(bagSchema.batches.equipmentCode, '422-BF1'),
        eq(bagSchema.batches.installedAt, new Date('2023-12-31T16:59:59.999Z')),
      ),
    );
  // A later recording in another equipment must not change this header.
  await getBagDb()
    .update(bagSchema.batches)
    .set({ createdAt: new Date(updatedAt.getTime() + 1000) })
    .where(and(eq(bagSchema.batches.actorId, actor.id), eq(bagSchema.batches.equipmentCode, '421-BF1')));
  const state = await snapshot('422-BF1', now);
  assert.equal(state.updatedAt, updatedAt.toISOString());
  assert.deepEqual(state.yearlyReplacements, {
    year: 2025,
    total: before.yearlyReplacements.total + 7,
    previousYear: 2024,
    previousTotal: before.yearlyReplacements.previousTotal + 5,
  });
  assert.equal(state.serverTime, new Date(now).toISOString());
  const summary = await dashboard(['422-BF1'], 2025, now);
  assert.equal(state.yearlyReplacements.total, summary.periodTotal);
  assert.equal(state.yearlyReplacements.previousTotal, summary.previousTotal);
  // January 1 WIB starts at 17:00 UTC on December 31; prior year is a full calendar year.
  const rolled = await snapshot('422-BF1', newYear);
  assert.deepEqual(rolled.yearlyReplacements, {
    year: 2026,
    total: beforeNewYear.yearlyReplacements.total + 4,
    previousYear: 2025,
    previousTotal: beforeNewYear.yearlyReplacements.previousTotal + 10,
  });
  const rolledChart = await dashboard(['422-BF1'], 2026, newYear);
  assert.equal(rolled.yearlyReplacements.total, rolledChart.periodTotal);
  assert.equal(rolled.yearlyReplacements.previousTotal, rolledChart.previousTotal);
  await assert.rejects(snapshot('422-BF2', now));
});
