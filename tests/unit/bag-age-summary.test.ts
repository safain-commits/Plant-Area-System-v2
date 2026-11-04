import test from 'node:test';
import assert from 'node:assert/strict';
import { activeAgeSummary } from '../../apps/bag-filter/app/equipment/[code]/age-summary';

const now = Date.parse('2026-11-04T05:00:00.000Z');
const installed = (days: number) => ({ installedAt: new Date(now - days * 86_400_000).toISOString() });

test('active ages exclude unrecorded positions and handle an empty equipment', () => {
  assert.deepEqual(activeAgeSummary([], now), { min: null, max: null, old: 0, recorded: 0 });
  assert.deepEqual(activeAgeSummary([{ installedAt: null }, { installedAt: 'invalid' }], now), {
    min: null,
    max: null,
    old: 0,
    recorded: 0,
  });
});

test('one age and equal ages keep a single range value', () => {
  assert.deepEqual(activeAgeSummary([installed(7)], now), { min: 7, max: 7, old: 0, recorded: 1 });
  assert.deepEqual(activeAgeSummary([installed(450), installed(450)], now), {
    min: 450,
    max: 450,
    old: 0,
    recorded: 2,
  });
});

test('active range is uncapped, counts the 1260-day boundary and accepts current records only', () => {
  const latest = new Map([
    ['replaced', installed(1678)],
    ['still-old', installed(1678)],
    ['boundary', installed(1260)],
    ['younger', installed(1259)],
  ]);
  latest.set('replaced', installed(7));
  assert.deepEqual(activeAgeSummary(latest.values(), now), { min: 7, max: 1678, old: 2, recorded: 4 });
});

test('a later clock updates the whole equipment range independently of the visible compartment', () => {
  const positions = [installed(7 + 86_370 / 86_400), installed(1678)];
  assert.equal(activeAgeSummary(positions, now).min, 7);
  assert.equal(activeAgeSummary(positions, now + 60_000).min, 8);
  assert.equal(activeAgeSummary(positions, now + 86_400_000).max, 1679);
});
