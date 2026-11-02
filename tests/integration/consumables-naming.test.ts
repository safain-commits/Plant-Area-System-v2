import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  saveMaterial,
  saveInventory,
  postMovement,
  materialDetail,
  closeConsumablesDb,
  getConsumablesDb,
  consumablesSchema,
} from '@plant/consumables-core';
import { importNaming } from '../../packages/consumables-core/src/naming';
import { AppError, type Identity } from '@plant/contracts';
import { eq } from 'drizzle-orm';
if (
  process.env.TEST_DATABASE !== '1' ||
  !process.env.CONSUMABLES_DATABASE_URL?.includes('127.0.0.1:13306/plant_consumables')
)
  throw Error('Disposable MySQL only.');
const actor: Identity = {
  id: randomUUID(),
  name: 'Naming fixture',
  email: 'naming@example.test',
  position: '',
  portalAdmin: false,
  mustChangePassword: false,
  grants: [{ appId: 'consumables', role: 'admin' }],
};
const header = 'mmid,common_name,aliases,unit,sap_unit,pack_size,decimal_allowed\n';
test('naming dry-run/apply/replay are atomic and preserve manual edits and unit locks', async () => {
  const mmid = 'NAM-' + randomUUID(),
    source = { mmid, description: 'SAP Name', commonName: 'Original', unit: 'EA', category: 'Synthetic' },
    id = (await saveMaterial(actor, source)).id;
  const csv = header + `${mmid},Baut,"bolt, fastener",PCS,SET,2,false\n`;
  assert.equal((await importNaming(csv)).changed, 1);
  assert.equal((await materialDetail(actor, id)).material.commonName, 'Original');
  assert.equal((await importNaming(csv, true)).changed, 1);
  assert.equal((await materialDetail(actor, id)).material.version, 2);
  assert.equal((await importNaming(csv, true)).replayed, true);
  assert.equal((await materialDetail(actor, id)).material.version, 2);
  await saveInventory(actor, { materialId: id });
  await postMovement(
    actor,
    'opening',
    { materialId: id, quantity: '0', reason: 'Test count', expectedVersion: 1 },
    randomUUID(),
  );
  const before = (await materialDetail(actor, id)).material;
  await assert.rejects(
    importNaming(header + `${mmid},Changed,,KG,,,\n`, true),
    (e) => e instanceof AppError && e.status === 409,
  );
  assert.equal((await materialDetail(actor, id)).material.commonName, 'Baut');
  await assert.rejects(
    importNaming(header + `${mmid},Changed,,,,,\nUNKNOWN,,,PCS,,,\n`, true),
    (e) => e instanceof AppError && e.status === 400,
  );
  assert.equal((await materialDetail(actor, id)).material.commonName, 'Baut');
  await saveMaterial(
    actor,
    {
      ...source,
      unit: before.unit,
      sapUnit: before.sapUnit,
      commonName: 'Manual',
      packSize: before.packSize,
      version: before.version,
    },
    id,
  );
  await assert.rejects(importNaming(csv, true), (e) => e instanceof AppError && e.status === 409);
  assert.equal((await materialDetail(actor, id)).material.commonName, 'Manual');
});
test('explicit unchanged conversion in naming CSV reviews legacy pack semantics exactly once', async () => {
  const mmid = 'REVIEW-' + randomUUID(),
    id = (
      await saveMaterial(actor, {
        mmid,
        description: 'Legacy pack fixture',
        unit: 'EA',
        sapUnit: 'EA',
        packSize: '1',
        category: 'Synthetic',
        decimalAllowed: false,
      })
    ).id;
  await getConsumablesDb()
    .update(consumablesSchema.materials)
    .set({ conversionReviewed: false })
    .where(eq(consumablesSchema.materials.id, id));
  const csv = header + `${mmid},,,,EA,1,false\n`;
  assert.equal((await importNaming(csv)).changed, 1);
  assert.equal((await materialDetail(actor, id)).material.conversionReviewed, false);
  assert.equal((await importNaming(csv, true)).changed, 1);
  assert.equal((await materialDetail(actor, id)).material.conversionReviewed, true);
  assert.equal((await importNaming(csv, true)).replayed, true);
  assert.equal((await materialDetail(actor, id)).material.version, 2);
});
after(closeConsumablesDb);
