import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countScale } from '../../packages/ui/src/chart-scale';
test('count axes include zero and all values with equal integer steps, including sparse quarters', () => {
  for (const maximum of [0, 1, 2, 8, 17, 1179, 999999]) {
    const axis = countScale(maximum);
    assert.ok(axis.maximum >= maximum);
    assert.equal(axis.ticks.at(-1), 0);
    assert.equal(axis.ticks[0], axis.maximum);
    const step = axis.ticks[0] - axis.ticks[1];
    for (let i = 0; i < axis.ticks.length - 1; i++) {
      assert.ok(Number.isInteger(axis.ticks[i]));
      assert.equal(axis.ticks[i] - axis.ticks[i + 1], step);
    }
  }
});
