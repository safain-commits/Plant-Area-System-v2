import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { createReplacement, dashboard, snapshot, getBagDb, closeBagDb, bagSchema } from '@plant/bag-core';
import { equipmentPositions, getEquipment, positionKey } from '@plant/contracts';

if (
  process.env.TEST_DATABASE !== '1' ||
  !['localhost', '127.0.0.1', 'mysql'].includes(new URL(process.env.BAG_DATABASE_URL!).hostname)
)
  throw Error('Age scale tests require an isolated local database.');
test('dashboard uses seven 210-day buckets with exact hourly edges and unchanged equipment totals', async () => {
  const actor = { id: randomUUID(), name: 'Age-scale fixture' };
  const now = Date.now(),
    year = new Date(now + 7 * 3600000).getUTCFullYear();
  const ages = [
    0,
    209 * 24 + 23,
    210 * 24,
    419 * 24 + 23,
    420 * 24,
    629 * 24 + 23,
    630 * 24,
    839 * 24 + 23,
    840 * 24,
    1049 * 24 + 23,
    1050 * 24,
    1259 * 24 + 23,
    1260 * 24,
    1678 * 24,
  ];
  const before = await snapshot('L62-BF1', now);
  const occupied = new Set(before.positions.map(positionKey));
  const positions = equipmentPositions(getEquipment('L62-BF1')!)
    .filter((p) => !occupied.has(positionKey(p)))
    .slice(0, ages.length);
  const baseline = await dashboard(['L62-BF1'], year, now);
  const ids: string[] = [];
  try {
    for (const [index, hours] of ages.entries()) {
      const batch = await createReplacement(
        actor,
        {
          equipmentCode: 'L62-BF1',
          positions: [positions[index]],
          installedAt: new Date(now - hours * 3600000).toISOString(),
          brand: 'Filtras',
          reason: 'Age-scale fixture',
        },
        randomUUID(),
      );
      ids.push(batch.batchId);
    }
    const result = await dashboard(['L62-BF1'], year, now);
    assert.deepEqual(
      result.distribution.map((value, index) => value - baseline.distribution[index]),
      [2, 2, 2, 2, 2, 2, 2],
    );
    assert.equal(result.installed, baseline.installed + 14);
    assert.equal(result.older1260, baseline.older1260 + 2);
    assert.equal(result.perEquipment[0].older1260, baseline.perEquipment[0].older1260 + 2);
    assert.equal(result.total, 2048);
    assert.equal((await snapshot('L62-BF1', now)).equipment.colorScaleDays, 1260);
  } finally {
    try {
      if (ids.length)
        await getBagDb().transaction(async (tx) => {
          await tx.delete(bagSchema.bagAudit).where(inArray(bagSchema.bagAudit.batchId, ids));
          await tx.delete(bagSchema.installations).where(inArray(bagSchema.installations.batchId, ids));
          await tx.delete(bagSchema.batches).where(eq(bagSchema.batches.actorId, actor.id));
        });
    } finally {
      await closeBagDb();
    }
  }
});
