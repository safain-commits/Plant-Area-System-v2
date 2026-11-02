import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { eq, sql } from 'drizzle-orm';
import {
  saveMaterial,
  saveLocation,
  saveInventory,
  postMovement,
  createDocument,
  documentDetail,
  listDocuments,
  searchMaterials,
  hecSuggestions,
  materialDetail,
  stockDashboard,
  discovery,
  reconcile,
  getConsumablesDb,
  closeConsumablesDb,
  consumablesSchema as s,
  DocumentConflict,
} from '@plant/consumables-core';
import { AppError, type Identity } from '@plant/contracts';
if (
  process.env.TEST_DATABASE !== '1' ||
  !process.env.CONSUMABLES_DATABASE_URL?.includes('127.0.0.1:13306/plant_consumables')
)
  throw Error('Disposable MySQL only.');
const actor: Identity = {
  id: randomUUID(),
  name: 'R22 integration',
  email: 'r22@example.test',
  position: '',
  portalAdmin: false,
  mustChangePassword: false,
  grants: [{ appId: 'consumables', role: 'admin', locationIds: [] }],
};
const key = () => randomUUID();
async function fixture(n = 2) {
  const locationId = (await saveLocation(actor, { name: 'R22 ' + key() })).id;
  const list: Array<{
    id: string;
    source: {
      mmid: string;
      description: string;
      commonName: string;
      aliases: string;
      unit: string;
      sapUnit: string;
      decimalAllowed: boolean;
      packSize: string;
      category: string;
    };
  }> = [];
  for (let j = 0; j < n; j++) {
    const source = {
      mmid: 'R22-' + key(),
      description: 'SAP Bolt ' + j,
      commonName: 'Baut M16',
      aliases: 'mur, fastener',
      unit: 'PCS',
      sapUnit: 'SET',
      decimalAllowed: false,
      packSize: '2',
      category: 'Synthetic',
    };
    const id = (await saveMaterial(actor, source)).id;
    await saveInventory(actor, { materialId: id, locationId });
    await postMovement(
      actor,
      'opening',
      { materialId: id, locationId, quantity: '10', reason: 'Fixture', expectedVersion: 1 },
      key(),
    );
    list.push({ id, source });
  }
  const input = {
    locationId,
    hec: ' tq.452-bu1 ',
    wo: 'WO-fixture',
    lines: list.map((m) => ({ materialId: m.id, quantity: '2' })),
  };
  const quantity = async (id = list[0].id) =>
    (await materialDetail(actor, id)).stocks.find((i) => i.locationId === locationId)!.quantity;
  return { locationId, list, input, quantity };
}
const status = (n: number) => (e: unknown) => e instanceof AppError && e.status === n;
test('R22 multi-item consume is atomic, reports every shortage, and replays normalized payload', async () => {
  const f = await fixture(),
    k = key();
  await assert.rejects(
    createDocument(
      actor,
      'consume',
      { ...f.input, lines: f.list.map((m) => ({ materialId: m.id, quantity: '11' })) },
      k,
    ),
    (e) =>
      e instanceof DocumentConflict &&
      e.lines.length === 2 &&
      e.lines.every((v) => v.available === '10.000000' && v.requested === '11.000000'),
  );
  assert.equal(await f.quantity(), '10.000000');
  assert.equal(
    (await listDocuments(actor, new URLSearchParams({ locationId: f.locationId }))).items.length,
    0,
  );
  const result = await createDocument(actor, 'consume', f.input, k);
  assert.equal(result.lines.length, 2);
  assert.equal(result.document.hec, '452-BU1');
  assert.equal(result.document.requesterName, actor.name);
  assert.match(result.document.number, /^R22-CO-\d{4}-\d{6}$/);
  const replay = await createDocument(
    actor,
    'consume',
    { ...f.input, hec: '452-BU1', lines: f.input.lines.map((l) => ({ ...l, quantity: '2.000000' })) },
    k,
  );
  assert.equal(replay.document.id, result.document.id);
  assert.equal(replay.replayed, true);
  await assert.rejects(createDocument(actor, 'consume', { ...f.input, wo: 'changed' }, k), status(409));
  assert.equal(await f.quantity(), '8.000000');
  assert.equal((await documentDetail(actor, result.document.id)).lines[0].commonName, 'Baut M16');
  assert.equal((await hecSuggestions(actor, 'tq.452')).items[0], '452-BU1');
  const dashboard = await stockDashboard({
    ...actor,
    grants: [{ appId: 'consumables', role: 'viewer', locationIds: [f.locationId] }],
  });
  assert.equal(
    dashboard.series.reduce((v, q) => v + q.consume, 0),
    1,
  );
  assert.equal((await discovery(actor, result.document.number)).items[0].id, result.document.id);
});
test('R22 concurrent orders with reversed lines are deterministic and cannot overdraw', async () => {
  const f = await fixture();
  const body = { ...f.input, lines: f.input.lines.map((l) => ({ ...l, quantity: '7' })) };
  const results = await Promise.allSettled([
    createDocument(actor, 'consume', body, key()),
    createDocument(actor, 'consume', { ...body, lines: [...body.lines].reverse() }, key()),
  ]);
  assert.equal(results.filter((v) => v.status === 'fulfilled').length, 1);
  assert.equal(await f.quantity(), '3.000000');
  const k = key(),
    both = await Promise.all([
      createDocument(actor, 'return', f.input, k),
      createDocument(actor, 'return', f.input, k),
    ]);
  assert.equal(both[0].document.id, both[1].document.id);
  assert.equal(both.filter((v) => v.replayed).length, 1);
  assert.equal(await f.quantity(), '5.000000');
  const documents = await Promise.all(
    Array.from({ length: 8 }, () => createDocument(actor, 'return', f.input, key())),
  );
  const nums = documents.map((d) => Number(d.document.number.split('-').at(-1))).sort((a, b) => a - b);
  assert.equal(new Set(nums).size, 8);
  assert.equal(nums.at(-1)! - nums[0], 7);
});
test('R22 picklist conversion, partial reservation warning, K3 and historical snapshots', async () => {
  const f = await fixture(1),
    materialId = (await saveMaterial(actor, { ...f.list[0].source, mmid: 'NEW-' + key() })).id;
  const input = {
    locationId: f.locationId,
    reservationNo: 'RES-' + key().slice(0,24),
    wo: 'WO',
    functionalLocation: 'TQ.452-BU1 - SAP description',
    requiredDate: '2026-11-02',
    lines: [{ materialId, sapQuantity: '3', materialVersion: 1 }],
  };
  const result = await createDocument(actor, 'picklist', input, key());
  assert.equal(result.document.lineCount, 1);
  assert.equal(result.document.requiredDate, '2026-11-02');
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].quantity, '6.000000');
  assert.equal(result.lines[0].sapUnit, 'SET');
  assert.equal(result.lines[0].sapQuantity, '3.000000');
  assert.equal(result.lines[0].packSize, '2.000000');
  const stock = (await materialDetail(actor, materialId)).stocks[0];
  assert.equal(stock.initialized, true);
  assert.equal(stock.rack, '');
  const ledger = await getConsumablesDb()
    .select()
    .from(s.movements)
    .where(eq(s.movements.materialId, materialId));
  assert.equal(ledger.length, 2);
  assert.equal(ledger.find((v) => v.type === 'opening')?.quantity, '0.000000');
  const again = await createDocument(actor, 'picklist', input, key());
  assert.equal(again.previousDocuments?.[0].id, result.document.id);
  await assert.rejects(
    saveMaterial(actor, { ...f.list[0].source, mmid: 'NEW-invalid', version: 1 }, materialId),
    status(400),
  );
  const master = (await materialDetail(actor, materialId)).material;
  await saveMaterial(
    actor,
    {
      ...f.list[0].source,
      mmid: master.mmid,
      description: 'Changed SAP',
      commonName: 'Changed name',
      packSize: '4',
      version: 1,
    },
    materialId,
  );
  await assert.rejects(createDocument(actor, 'picklist', input, key()), status(409));
  const historical = await documentDetail(actor, result.document.id);
  assert.equal(historical.lines[0].packSize, '2.000000');
  assert.equal(historical.lines[0].commonName, 'Baut M16');
  const uncounted = (await saveMaterial(actor, { ...f.list[0].source, mmid: 'UNCOUNTED-' + key() })).id;
  await saveInventory(actor, { materialId: uncounted, locationId: f.locationId });
  await assert.rejects(
    createDocument(actor, 'picklist', { ...input, lines: [{ materialId: uncounted, quantity: '2' }] }, key()),
    (e) => e instanceof DocumentConflict && e.lines[0].error.includes('Belum dihitung'),
  );
  await assert.rejects(
    createDocument(actor, 'picklist', { ...input, lines: [{ materialId: key(), quantity: '2' }] }, key()),
    status(404),
  );
});
test('R22 permissions, malformed quantities, scope and ranked search fail closed', async () => {
  const f = await fixture();
  const viewer = {
    ...actor,
    grants: [{ appId: 'consumables' as const, role: 'viewer' as const, locationIds: [f.locationId] }],
  };
  const operator = {
    ...viewer,
    grants: [{ appId: 'consumables' as const, role: 'operator' as const, locationIds: [f.locationId] }],
  };
  await assert.rejects(createDocument(viewer, 'consume', f.input, key()), status(403));
  await assert.rejects(
    createDocument(operator, 'consume', { ...f.input, requester: { name: 'Other' } }, key()),
    status(403),
  );
  const behalf = await createDocument(
    actor,
    'return',
    { ...f.input, requester: { name: 'Client', nik: '001' } },
    key(),
  );
  assert.equal(behalf.document.channel, 'cashier');
  assert.equal(behalf.document.actorId, actor.id);
  assert.equal(behalf.document.requesterName, 'Client');
  const outside = {
    ...operator,
    grants: [{ appId: 'consumables' as const, role: 'operator' as const, locationIds: [key()] }],
  };
  await assert.rejects(documentDetail(outside, behalf.document.id), status(404));
  await assert.rejects(
    searchMaterials(outside, new URLSearchParams({ q: 'baut', locationId: f.locationId })),
    status(403),
  );
  await assert.rejects(
    createDocument(actor, 'consume', { ...f.input, lines: [f.input.lines[0], f.input.lines[0]] }, key()),
    status(400),
  );
  for (const quantity of ['0', '-1', '0.1', '1.0000001', '1000000000000'])
    await assert.rejects(
      createDocument(
        actor,
        'consume',
        { ...f.input, lines: [{ materialId: f.list[0].id, quantity }] },
        key(),
      ),
      status(400),
    );
  for (const hec of ['', '452 BU1', '452-BU11'])
    await assert.rejects(createDocument(actor, 'consume', { ...f.input, hec }, key()), status(400));
  const found = await searchMaterials(
    operator,
    new URLSearchParams({ q: 'fastener', locationId: f.locationId }),
  );
  assert.equal(found.items.length, 2);
  assert.equal(found.items[0].quantity.includes('.'), true);
  const exact = await searchMaterials(
    operator,
    new URLSearchParams({ q: f.list[0].source.mmid, locationId: f.locationId }),
  );
  assert.equal(exact.items[0].id, f.list[0].id);
  assert.equal(
    (await searchMaterials(operator, new URLSearchParams({ q: '%', locationId: f.locationId }))).items.length,
    0,
  );
  await assert.rejects(searchMaterials(operator, new URLSearchParams({ q: 'baut' }), true), status(403));
});
test('R22 audit failure rolls back document, all balances, auto enrollment, idempotency and sequence', async () => {
  const f = await fixture(),
    c = await mysql.createConnection(process.env.CONSUMABLES_MIGRATION_DATABASE_URL!),
    k = key();
  try {
    await c.query(
      `CREATE TRIGGER r22_fail BEFORE INSERT ON consumables_audit FOR EACH ROW BEGIN IF NEW.actor_id='${actor.id}' AND NEW.action='document.consume' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='R22 injected failure'; END IF; END`,
    );
    await assert.rejects(createDocument(actor, 'consume', f.input, k));
    assert.equal(await f.quantity(), '10.000000');
    assert.equal(
      (await listDocuments(actor, new URLSearchParams({ locationId: f.locationId }))).items.length,
      0,
    );
  } finally {
    await c.query('DROP TRIGGER IF EXISTS r22_fail');
    await c.end();
  }
  assert.equal((await createDocument(actor, 'consume', f.input, k)).replayed, false);
  const fixtureBefore = Date.now;
  try {
    Date.now = () => new Date('2025-12-31T16:59:59Z').getTime();
    const a = await createDocument(actor, 'return', f.input, key());
    Date.now = () => new Date('2025-12-31T17:00:00Z').getTime();
    const b = await createDocument(actor, 'return', f.input, key());
    assert.ok(a.document.number.includes('-2025-'));
    assert.ok(b.document.number.includes('-2026-'));
  } finally {
    Date.now = fixtureBefore;
  }
  assert.deepEqual((await reconcile(actor)).items, []);
});
after(closeConsumablesDb);
