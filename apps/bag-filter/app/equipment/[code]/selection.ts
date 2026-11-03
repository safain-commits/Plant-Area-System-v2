import { positionKey, rowOrder, validPosition, type Equipment, type Position } from '@plant/contracts';

export const selectionLimit = 500;
export type Compartment = Pick<Position, 'side' | 'compartment'>;
export type BagArea = Compartment & { columnFrom: number; columnTo: number; rowFrom: number; rowTo: number };

/** Field-number order within each side; values retain the physical local coordinates. */
export function compartmentOptions(eq: Equipment) {
  return eq.sides.flatMap(({ name: side, labels }) =>
    labels
      .map((label, i) => ({ side, compartment: i + 1, label, value: `${side}:${i + 1}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'id', { numeric: true })),
  );
}

export function areaPositions(eq: Equipment, area: BagArea): Position[] {
  const from = { side: area.side, compartment: area.compartment, column: area.columnFrom, row: area.rowFrom };
  const to = { ...from, column: area.columnTo, row: area.rowTo };
  if (!validPosition(from, eq) || !validPosition(to, eq)) throw Error('Area di luar konfigurasi equipment.');
  const left = Math.min(area.columnFrom, area.columnTo),
    right = Math.max(area.columnFrom, area.columnTo);
  const low = Math.min(area.rowFrom, area.rowTo),
    high = Math.max(area.rowFrom, area.rowTo);
  return rowOrder(eq, area.side)
    .filter((row) => row >= low && row <= high)
    .flatMap((row) =>
      Array.from({ length: right - left + 1 }, (_, i) => ({ ...from, column: left + i, row })),
    );
}

export function compartmentPositions(eq: Equipment, compartments: Compartment[]): Position[] {
  const unique = new Map(compartments.map((c) => [`${c.side}-${c.compartment}`, c]));
  return [...unique.values()].flatMap((c) =>
    areaPositions(eq, {
      ...c,
      columnFrom: 1,
      columnTo: eq.columns.length,
      rowFrom: 1,
      rowTo: eq.rows,
    }),
  );
}

export function selectionPreview(current: Position[], items: Position[]) {
  const existing = new Set(current.map(positionKey));
  const candidates = new Map(items.map((p) => [positionKey(p), p]));
  const added = [...candidates.keys()].filter((key) => !existing.has(key)).length;
  const positions = [
    ...new Map([...current, ...candidates.values()].map((p) => [positionKey(p), p])).values(),
  ];
  return {
    positions,
    added,
    overlap: candidates.size - added,
    total: positions.length,
    excess: Math.max(0, positions.length - selectionLimit),
  };
}

/** A partially selected compartment costs only its missing, unique positions. */
export function compartmentChoices(eq: Equipment, current: Position[], pending: Compartment[]) {
  const total = selectionPreview(current, compartmentPositions(eq, pending)).total;
  const counts = new Map<string, number>();
  for (const p of new Map(current.map((p) => [positionKey(p), p])).values()) {
    const key = `${p.side}-${p.compartment}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return eq.sides.flatMap(({ name: side, labels }) =>
    labels.map((label, i) => {
      const compartment = i + 1;
      const checked = pending.some((c) => c.side === side && c.compartment === compartment);
      const additional = eq.bagsPerCompartment - (counts.get(`${side}-${compartment}`) || 0);
      return {
        side,
        compartment,
        label,
        checked,
        additional,
        blocked: !checked && total + additional > selectionLimit,
      };
    }),
  );
}

export function toggleCompartment(
  eq: Equipment,
  current: Position[],
  pending: Compartment[],
  target: Compartment,
) {
  const choice = compartmentChoices(eq, current, pending).find(
    (c) => c.side === target.side && c.compartment === target.compartment,
  );
  if (!choice || choice.blocked) return pending;
  return choice.checked
    ? pending.filter((c) => c.side !== target.side || c.compartment !== target.compartment)
    : [...pending, target];
}

export type SelectionState = { positions: Position[]; previous: Position[] | null; error: string };
export const initialSelection: SelectionState = { positions: [], previous: null, error: '' };
export type SelectionAction =
  | { type: 'add' | 'preview'; positions: Position[]; base?: Position[] }
  | { type: 'toggle'; position: Position }
  | { type: 'cancel-drag'; base: Position[] }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'reset' };
const sameSelection = (a: Position[], b: Position[]) => {
  const keys = new Set(a.map(positionKey));
  return a.length === b.length && b.every((p) => keys.has(positionKey(p)));
};

/** One undo snapshot per completed gesture; preview never consumes that snapshot. */
export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  if (action.type === 'reset') return initialSelection;
  if (action.type === 'undo')
    return state.previous === null ? state : { positions: state.previous, previous: null, error: '' };
  if (action.type === 'cancel-drag') return { ...state, positions: action.base, error: '' };
  const base = 'base' in action && action.base ? action.base : state.positions;
  let next: Position[];
  if (action.type === 'clear') next = [];
  else if (action.type === 'toggle') {
    const key = positionKey(action.position);
    next = base.some((p) => positionKey(p) === key)
      ? base.filter((p) => positionKey(p) !== key)
      : [...base, action.position];
  } else next = selectionPreview(base, action.positions).positions;
  if (next.length > selectionLimit)
    return {
      ...state,
      positions: base,
      error: `Total ${next.length} bag melebihi batas ${selectionLimit} sebanyak ${next.length - selectionLimit} bag. Kurangi pilihan.`,
    };
  if (action.type === 'preview') return { ...state, positions: next, error: '' };
  if (sameSelection(base, next)) return { ...state, positions: base, error: '' };
  return { positions: next, previous: base, error: '' };
}

export function groupSelection(eq: Equipment, positions: Position[]) {
  return eq.sides
    .flatMap(({ name: side }) =>
      Array.from({ length: eq.perSide }, (_, i) => {
        const compartment = i + 1;
        const rows = rowOrder(eq, side);
        const items = positions
          .filter((p) => p.side === side && p.compartment === compartment)
          .sort((a, b) => rows.indexOf(a.row) - rows.indexOf(b.row) || a.column - b.column);
        return { side, compartment, positions: items };
      }),
    )
    .filter((group) => group.positions.length > 0);
}
