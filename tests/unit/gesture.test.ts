import test from 'node:test';
import assert from 'node:assert/strict';
import {
  record,
  velocity,
  project,
  rubberband,
  shouldDismiss,
  type Sample,
} from '../../packages/ui/src/gesture';
test('gesture velocity uses five recent samples and becomes zero after a hold', () => {
  const samples: Sample[] = [];
  for (let i = 0; i < 8; i++) record(samples, i * 10, i * 10);
  assert.equal(samples.length, 5);
  assert.equal(velocity(samples), 1000);
  record(samples, 70, 300);
  assert.equal(velocity(samples), 0);
});
test('momentum commits a short outward flick and respects a reverse release', () => {
  assert.ok(Math.abs(project(1000) - 499) < 0.001);
  assert.equal(shouldDismiss(30, 1000, 420), true);
  assert.equal(shouldDismiss(300, -100, 420), false);
  assert.equal(shouldDismiss(300, 0, 420), true);
  assert.equal(shouldDismiss(30, 0, 420), false);
});
test('rubber band resists progressively and remains symmetric at either bound', () => {
  assert.equal(rubberband(0, 420), 0);
  assert.ok(rubberband(100, 420) > 0 && rubberband(100, 420) < 100);
  assert.equal(rubberband(-100, 420), -rubberband(100, 420));
  assert.ok(rubberband(10000, 420) < 420);
});
