import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decimalUnits,
  decimalString,
  formatQuantity,
  localDecimal,
  canConsume,
  type Identity,
} from '@plant/contracts';
import { parseCatalog } from '@plant/consumables-core/import';
test('fixed-point quantities preserve fractions, localization and overflow boundaries', () => {
  assert.equal(decimalString(decimalUnits('0.1') + decimalUnits('0.2')), '0.300000');
  assert.equal(decimalString(decimalUnits('12.125') * 3n), '36.375000');
  assert.equal(formatQuantity('1234.500000'), '1.234,5');
  assert.equal(localDecimal(' 0,125 '), '0.125');
  assert.equal(decimalString(decimalUnits('999999999999.999999')), '999999999999.999999');
  for (const v of ['1.0000001', '1000000000000', '-1', '1e3', NaN, 0.1, '1,2', 'Infinity'])
    assert.throws(() => decimalUnits(v));
  assert.throws(() => decimalString(decimalUnits('999999999999.999999') + 1n));
});
test('consumable permissions are app-specific, scoped and fail closed', () => {
  const actor = {
    id: 'x',
    name: 'x',
    email: 'x',
    position: 'Engineer',
    portalAdmin: true,
    mustChangePassword: false,
    grants: [],
  } as Identity;
  assert.equal(canConsume(actor, 'manage'), false);
  for (const role of ['viewer', 'operator', 'storekeeper', 'admin'] as const) {
    actor.grants = [{ appId: 'consumables', role, locationIds: role === 'admin' ? [] : ['A'] }];
    assert.equal(canConsume(actor, 'read', 'A'), true);
    assert.equal(canConsume(actor, 'read', 'B'), role === 'admin');
    assert.equal(canConsume(actor, 'issue', 'A'), role !== 'viewer');
    assert.equal(canConsume(actor, 'receive', 'A'), role === 'storekeeper' || role === 'admin');
    assert.equal(canConsume(actor, 'manage', 'A'), role === 'admin');
    assert.equal(canConsume(actor, 'invented' as never, 'A'), false);
  }
  actor.mustChangePassword = true;
  assert.equal(canConsume(actor, 'read'), false);
});
test('catalog mapping preserves master and excludes historical quantity/value', () => {
  const row = [
    '001234567890',
    'Material sintetis',
    'Nama umum',
    'KG',
    '',
    1,
    '2020-01-01',
    -50,
    12345,
    'Kimia',
  ];
  const parsed = parseCatalog(JSON.stringify({ batch: 'fixture', rows: [row] }));
  assert.equal(parsed.rows[0].mmid, '001234567890');
  assert.equal(parsed.rows[0].critical, true);
  assert.equal('quantity' in parsed.rows[0], false);
  assert.equal('oldStock' in parsed.rows[0], false);
  assert.equal('packSize' in parsed.rows[0], false);
  assert.throws(() => parseCatalog(JSON.stringify({ batch: 'fixture', rows: [row, row] })));
  assert.throws(() =>
    parseCatalog(JSON.stringify({ batch: 'fixture', rows: [[...row.slice(0, 3), '', ...row.slice(4)]] })),
  );
});
