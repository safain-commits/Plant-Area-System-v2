import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bagColor } from '@plant/contracts';
import { dataTextTone, relativeLuminance } from '../../packages/ui/src/color';

test('age colors remain stable and readable at every hourly step of the 900-day scale', () => {
  assert.equal(bagColor(null), '#e6eae9');
  assert.equal(bagColor(0), 'hsl(128 78% 61%)');
  assert.equal(bagColor(450 * 24), 'hsl(138 67% 38%)');
  assert.equal(bagColor(900 * 24), 'hsl(148 56% 14%)');
  assert.equal(bagColor(1200 * 24), bagColor(900 * 24));
  for (const hours of [null, ...Array.from({ length: 21601 }, (_, i) => i), 28800]) {
    const color = bagColor(hours);
    const foreground = dataTextTone(color) === 'dark' ? '#000000' : '#FFFFFF';
    const a = relativeLuminance(color),
      b = relativeLuminance(foreground);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${hours} hours`);
  }
});
