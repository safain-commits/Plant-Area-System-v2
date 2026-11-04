import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bagColor, bagAgeScaleDays, ageStops, ageBucket, equipment } from '@plant/contracts';
import { dataTextTone, relativeLuminance } from '../../packages/ui/src/color';

test('seven 210-day age categories stay continuous and readable through the 1260-day scale', () => {
  assert.equal(bagColor(null), 'var(--empty-bag)');
  assert.equal(bagColor(0), '#8fcb2f');
  assert.equal(bagColor(630 * 24), '#f7b32b');
  assert.equal(bagColor(1260 * 24), '#cf2e2e');
  assert.equal(bagColor(1678 * 24), bagColor(1260 * 24));
  assert.notEqual(bagColor(900 * 24), bagColor(1260 * 24));
  assert.deepEqual(
    ageStops.map((stop) => stop.days),
    [0, 210, 420, 630, 840, 1050, 1260],
  );
  assert.ok(equipment.every((eq) => eq.colorScaleDays === 1260));
  for (const [index, stop] of ageStops.entries()) {
    assert.equal(ageBucket(stop.days * 24), index);
    assert.equal(bagColor(stop.days * 24), stop.color.toLowerCase());
    if (index > 0) assert.equal(ageBucket(stop.days * 24 - 1), index - 1);
  }
  assert.equal(ageBucket(-1), 0);
  assert.equal(ageBucket(9999 * 24), 6);
  for (const hours of [...Array.from({ length: bagAgeScaleDays * 24 + 1 }, (_, i) => i), 1678 * 24]) {
    const color = bagColor(hours);
    const foreground = dataTextTone(color) === 'dark' ? '#050505' : '#FFFFFF';
    const a = relativeLuminance(color),
      b = relativeLuminance(foreground);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${hours} hours`);
  }
});
