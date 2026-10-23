import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bagColor } from '@plant/contracts';
import { dataTextTone, relativeLuminance } from '../../packages/ui/src/color';

test('seven-stop age colors stay continuous and readable at every hourly step of the 900-day scale', () => {
  assert.equal(bagColor(null), 'var(--empty-bag)');
  assert.equal(bagColor(0), '#8fcb2f');
  assert.equal(bagColor(450 * 24), '#f7b32b');
  assert.equal(bagColor(900 * 24), '#cf2e2e');
  assert.equal(bagColor(1200 * 24), bagColor(900 * 24));
  for (const hours of [...Array.from({ length: 21601 }, (_, i) => i), 28800]) {
    const color = bagColor(hours);
    const foreground = dataTextTone(color) === 'dark' ? '#050505' : '#FFFFFF';
    const a = relativeLuminance(color),
      b = relativeLuminance(foreground);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${hours} hours`);
  }
});
