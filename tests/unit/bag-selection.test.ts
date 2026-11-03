import test from 'node:test';
import assert from 'node:assert/strict';
import {
  equipment,
  getEquipment,
  equipmentPositions,
  positionKey,
  positionLabel,
  validPosition,
} from '@plant/contracts';
import {
  areaPositions,
  compartmentPositions,
  selectionPreview,
  selectionReducer,
  initialSelection,
  groupSelection,
  compartmentChoices,
  toggleCompartment,
} from '../../apps/bag-filter/app/equipment/[code]/selection';

test('compartment quota is proactive on every equipment while checked items can always be removed', () => {
  for (const eq of equipment) {
    const side = eq.sides[0].name;
    let pending = [1, 2, 3].map((compartment) => ({ side, compartment }));
    const choices = compartmentChoices(eq, [], pending);
    assert.ok(choices.filter((c) => c.checked).every((c) => !c.blocked));
    assert.equal(choices.find((c) => c.side === side && c.compartment === 4)!.blocked, true);
    assert.strictEqual(toggleCompartment(eq, [], pending, { side, compartment: 4 }), pending);
    pending = toggleCompartment(eq, [], pending, { side, compartment: 3 });
    assert.equal(
      compartmentChoices(eq, [], pending).find((c) => c.side === side && c.compartment === 4)!.blocked,
      false,
    );
  }
});

test('partial compartments use their missing unique bag count rather than the full unit capacity', () => {
  const eq = getEquipment('421-BF1')!;
  const current = [
    ...compartmentPositions(eq, [
      { side: 'A', compartment: 1 },
      { side: 'A', compartment: 2 },
    ]),
    ...compartmentPositions(eq, [{ side: 'A', compartment: 3 }]).slice(0, 100),
  ];
  const choices = compartmentChoices(eq, [...current, current[0]], []);
  const partial = choices.find((c) => c.side === 'A' && c.compartment === 3)!;
  assert.equal(partial.additional, 36);
  assert.equal(partial.blocked, false);
  assert.equal(choices.find((c) => c.side === 'A' && c.compartment === 4)!.blocked, true);
  assert.equal(choices.find((c) => c.side === 'A' && c.compartment === 1)!.additional, 0);
  const pending = toggleCompartment(eq, current, [], partial);
  assert.equal(selectionPreview(current, compartmentPositions(eq, pending)).total, 408);
  assert.equal(toggleCompartment(eq, current, pending, partial).length, 0);
});

test('bulk selection covers both physical sides of all six equipment without inventing coordinates', () => {
  for (const eq of equipment)
    for (const side of eq.sides) {
      for (const compartment of [1, eq.perSide]) {
        const items = compartmentPositions(eq, [{ side: side.name, compartment }]);
        assert.equal(items.length, eq.bagsPerCompartment);
        assert.equal(new Set(items.map(positionKey)).size, eq.bagsPerCompartment);
        assert.ok(items.every((p) => validPosition(p, eq)));
        assert.ok(items.every((p) => p.side === side.name && p.compartment === compartment));
        assert.equal(items[0].row, side.descendingRows ? eq.rows : 1);
        assert.equal(
          positionLabel(items[0], eq),
          `${side.labels[compartment - 1]} ${eq.columns[0]}${items[0].row}`,
        );
      }
    }
});

test('three full compartments plus a 42-bag area yield exactly 450 unique positions', () => {
  const eq = getEquipment('422-BF1')!;
  const full = compartmentPositions(
    eq,
    [1, 2, 3].map((compartment) => ({ side: 'A', compartment })),
  );
  const area = areaPositions(eq, {
    side: 'A',
    compartment: 4,
    columnFrom: 1,
    columnTo: 7,
    rowFrom: 1,
    rowTo: 6,
  });
  assert.equal(full.length, 408);
  assert.equal(area.length, 42);
  const preview = selectionPreview(full, [...area, ...area]);
  assert.equal(preview.added, 42);
  assert.equal(preview.overlap, 0);
  assert.equal(preview.total, 450);
  assert.equal(preview.excess, 0);
  assert.ok(preview.positions.every((p) => validPosition(p, eq)));
  assert.deepEqual(
    groupSelection(eq, preview.positions).map((g) => [g.compartment, g.positions.length]),
    [
      [1, 136],
      [2, 136],
      [3, 136],
      [4, 42],
    ],
  );
  const overlap = selectionPreview(preview.positions, full);
  assert.equal(overlap.added, 0);
  assert.equal(overlap.overlap, 408);
  assert.equal(overlap.total, 450);
});

test('areas are inclusive and reversible for rows, columns, both orientations and stiffeners', () => {
  for (const eq of equipment)
    for (const { name: side } of eq.sides) {
      const area = {
        side,
        compartment: 1,
        columnFrom: 2,
        columnTo: 7,
        rowFrom: eq.rowDividerAfter!,
        rowTo: eq.rowDividerAfter! + 1,
      };
      const items = areaPositions(eq, area);
      assert.equal(items.length, 12);
      assert.deepEqual(
        areaPositions(eq, { ...area, columnFrom: 7, columnTo: 2, rowFrom: area.rowTo, rowTo: area.rowFrom }),
        items,
      );
      assert.equal(
        areaPositions(eq, { ...area, columnFrom: 1, columnTo: 8, rowFrom: 1, rowTo: 1 }).length,
        8,
      );
      assert.equal(
        areaPositions(eq, { ...area, columnFrom: 1, columnTo: 1, rowFrom: 1, rowTo: eq.rows }).length,
        eq.rows,
      );
    }
  const eq = getEquipment('L61-BF1')!;
  assert.throws(() =>
    areaPositions(eq, { side: 'Timur', compartment: 1, columnFrom: 1, columnTo: 8, rowFrom: 1, rowTo: 17 }),
  );
  assert.throws(() => compartmentPositions(eq, [{ side: 'Utara', compartment: 1 }]));
  assert.throws(() => compartmentPositions(eq, [{ side: 'Barat', compartment: 9 }]));
});

test('500 positions succeed, 501 rejects the entire change and does not consume undo', () => {
  const items = equipmentPositions(getEquipment('421-BF1')!);
  const state = selectionReducer(initialSelection, { type: 'add', positions: items.slice(0, 500) });
  assert.equal(state.positions.length, 500);
  assert.equal(state.previous!.length, 0);
  const failed = selectionReducer(state, { type: 'add', positions: items.slice(499, 501) });
  assert.deepEqual(failed.positions, state.positions);
  assert.strictEqual(failed.previous, state.previous);
  assert.match(failed.error, /501.*500.*1 bag/);
  assert.equal(selectionReducer(failed, { type: 'undo' }).positions.length, 0);
  assert.equal(
    selectionReducer(initialSelection, { type: 'add', positions: items.slice(0, 501) }).positions.length,
    0,
  );
});

test('individual exceptions, clear and one-level undo preserve the exact prior selection', () => {
  const positions = compartmentPositions(getEquipment('421-BF1')!, [{ side: 'B', compartment: 1 }]);
  const full = selectionReducer(initialSelection, { type: 'add', positions });
  const removed = selectionReducer(full, { type: 'toggle', position: positions[5] });
  assert.equal(removed.positions.length, 135);
  assert.deepEqual(selectionReducer(removed, { type: 'undo' }).positions, positions);
  const cleared = selectionReducer(full, { type: 'clear' });
  assert.equal(cleared.positions.length, 0);
  const undone = selectionReducer(cleared, { type: 'undo' });
  assert.deepEqual(undone.positions, positions);
  assert.equal(undone.previous, null);
  assert.strictEqual(selectionReducer(undone, { type: 'undo' }), undone);
  assert.deepEqual(selectionReducer(undone, { type: 'reset' }), initialSelection);
  assert.strictEqual(selectionReducer(full, { type: 'add', positions }).previous, full.previous);
});

test('a whole drag is one undo step; cancelled or overflowing drags restore their base', () => {
  const items = equipmentPositions(getEquipment('421-BF1')!);
  const base = selectionReducer(initialSelection, { type: 'add', positions: items.slice(0, 450) });
  const preview = selectionReducer(base, {
    type: 'preview',
    base: base.positions,
    positions: items.slice(450, 475),
  });
  assert.equal(preview.positions.length, 475);
  assert.strictEqual(preview.previous, base.previous);
  const done = selectionReducer(preview, {
    type: 'add',
    base: base.positions,
    positions: items.slice(450, 480),
  });
  assert.equal(done.positions.length, 480);
  assert.deepEqual(selectionReducer(done, { type: 'undo' }).positions, base.positions);
  const overflow = selectionReducer(preview, {
    type: 'preview',
    base: base.positions,
    positions: items.slice(450, 501),
  });
  assert.deepEqual(overflow.positions, base.positions);
  const failed = selectionReducer(overflow, {
    type: 'add',
    base: base.positions,
    positions: items.slice(450, 501),
  });
  assert.deepEqual(failed.positions, base.positions);
  assert.strictEqual(failed.previous, base.previous);
  assert.deepEqual(
    selectionReducer(preview, { type: 'cancel-drag', base: base.positions }).positions,
    base.positions,
  );
});
