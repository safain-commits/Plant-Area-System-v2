import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  equipment,
  positionKey,
  positionLabel,
  displayCompartment,
  ageHours,
  bagColor,
  wibInput,
  wibToIso,
  safeReturnTo,
  hasPermission,
  replacementSchema,
  validateInstallationDate,
  type Identity,
  type Position,
} from '@plant/contracts';
import { canonicalReplacement } from '@plant/bag-core';
const p: Position = { side: 'Utara', compartment: 1, column: 1, row: 17 };
const input = {
  equipmentCode: '561-BF1',
  positions: [p],
  installedAt: '2026-01-01T00:00:00Z',
  reason: 'Penggantian terjadwal',
};
test('four equipment contain unique, reversible north/south coordinate identities', () => {
  for (const eq of equipment) {
    const keys = new Set<string>();
    for (const side of ['Utara', 'Selatan'] as const)
      for (let c = 1; c <= eq.perSide; c++)
        for (let column = 1; column <= 8; column++)
          for (let row = 1; row <= 17; row++) {
            const position = { side, compartment: c, column, row };
            keys.add(positionKey(position));
            const display = displayCompartment(position, eq);
            assert.equal(side === 'Utara' ? display : eq.compartments + 1 - display, c);
          }
    assert.equal(keys.size, eq.compartments * 136);
  }
  assert.equal(positionLabel(p, equipment[0]), '1 H17');
  assert.equal(positionLabel({ ...p, side: 'Selatan', column: 8, row: 1 }, equipment[0]), '24 A1');
});
test('24/7 age and 0, 450, 900 and >900 day colors', () => {
  const now = Date.UTC(2026, 9, 22);
  for (const days of [0, 450, 900, 1200])
    assert.equal(ageHours(new Date(now - days * 86400000).toISOString(), now), days * 24);
  assert.equal(ageHours(null), null);
  assert.equal(bagColor(null), '#e6eae9');
  assert.notEqual(bagColor(0), bagColor(450 * 24));
  assert.equal(bagColor(900 * 24), bagColor(1200 * 24));
});
test('WIB conversion and date boundary', () => {
  assert.equal(wibToIso('2026-10-22T07:30'), '2026-10-22T00:30:00.000Z');
  assert.equal(wibInput(Date.parse('2026-10-22T00:30:00Z')), '2026-10-22T07:30');
  assert.equal(validateInstallationDate('1999-12-31T23:59:59Z'), false);
  const now = Date.now();
  assert.equal(validateInstallationDate(new Date(now + 60000).toISOString(), now), true);
  assert.equal(validateInstallationDate(new Date(now + 60001).toISOString(), now), false);
});
test('reject invalid batches and normalize retries regardless of position order', () => {
  const q = { ...p, row: 1 };
  assert.deepEqual(
    canonicalReplacement({ ...input, positions: [p, q] }),
    canonicalReplacement({ ...input, positions: [q, p], wo: '' }),
  );
  for (const patch of [
    { positions: [] },
    { positions: [p, p] },
    { positions: [{ ...p, compartment: 13 }] },
    { positions: [{ ...p, row: 18 }] },
    { reason: '' },
    { reason: 'x'.repeat(501) },
    { wo: 'x'.repeat(101) },
    { actorId: 'spoof' },
  ])
    assert.equal(replacementSchema.safeParse({ ...input, ...patch }).success, false);
  assert.throws(() => canonicalReplacement({ ...input, installedAt: '2099-01-01T00:00:00Z' }));
});
test('permissions deny unknown roles, actions, equipment and temporary passwords', () => {
  const actor: Identity = {
    id: 'x',
    name: 'Tester',
    email: 'test@example.test',
    position: 'Engineer',
    portalAdmin: true,
    mustChangePassword: false,
    grants: [{ appId: 'bag-filter', role: 'viewer', equipment: ['561-BF1'] }],
  };
  assert.equal(hasPermission(actor, 'read', '561-BF1'), true);
  assert.equal(hasPermission(actor, 'write', '561-BF1'), false);
  assert.equal(hasPermission(actor, 'read', '562-BF1'), false);
  actor.grants[0].role = 'operator';
  assert.equal(hasPermission(actor, 'write', '561-BF1'), true);
  assert.equal(hasPermission(actor, 'audit'), false);
  actor.grants[0].role = 'admin';
  assert.equal(hasPermission(actor, 'audit'), true);
  assert.equal(hasPermission(actor, 'delete' as 'read'), false);
  actor.grants[0].role = 'unknown' as 'viewer';
  assert.equal(hasPermission(actor, 'read'), false);
  actor.mustChangePassword = true;
  assert.equal(hasPermission(actor, 'read'), false);
});
test('login return destination cannot become an external redirect', () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/auth/api/sign-out', '/\r\nevil'])
    assert.equal(safeReturnTo(value), '/');
  assert.equal(
    safeReturnTo('/bag-filter/equipment/561-BF1?tab=history'),
    '/bag-filter/equipment/561-BF1?tab=history',
  );
});
