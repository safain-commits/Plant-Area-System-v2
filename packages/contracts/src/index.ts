import { z } from 'zod';

export const equipmentCodes = ['561-BF1', '562-BF1', '421-BF1', '422-BF1', 'L61-BF1', 'L62-BF1'] as const;
export type EquipmentCode = (typeof equipmentCodes)[number];
export const bagBrands = ['Intensiv filter (Original)', 'Filtras', 'Cipta Medya', 'Other'] as const;
export type BagBrand = (typeof bagBrands)[number];
export const bagRoles = ['viewer', 'operator', 'admin'] as const;
export type BagRole = (typeof bagRoles)[number];
export type Grant = { appId: string; role: BagRole; equipment: EquipmentCode[] };
export type Identity = {
  id: string;
  name: string;
  email: string;
  position: string;
  portalAdmin: boolean;
  mustChangePassword: boolean;
  grants: Grant[];
};
export const sides = ['Utara', 'Selatan', 'A', 'B', 'Timur', 'Barat'] as const;
export type Position = { side: (typeof sides)[number]; compartment: number; column: number; row: number };
export type Equipment = {
  code: EquipmentCode;
  perSide: number;
  compartments: number;
  rows: number;
  columns: string;
  bagsPerCompartment: number;
  colorScaleDays: number;
  rowDividerAfter: number | null;
  centeredLabels: boolean;
  sides: { name: Position['side']; labels: string[]; descendingRows: boolean }[];
};
const sequence = (count: number, label: (local: number) => string) =>
  Array.from({ length: count }, (_, i) => label(i + 1));
export const equipment: Equipment[] = equipmentCodes.map((code) => {
  const is56 = code === '561-BF1' || code === '562-BF1';
  const isL6 = code === 'L61-BF1' || code === 'L62-BF1';
  const perSide = is56 ? 12 : isL6 ? 8 : 15;
  const rows = isL6 ? 16 : 17;
  return {
    code,
    perSide,
    compartments: perSide * 2,
    rows,
    columns: is56 ? 'HGFEDCBA' : 'ABCDEFGH',
    bagsPerCompartment: rows * 8,
    colorScaleDays: 900,
    rowDividerAfter: is56 ? null : isL6 ? 8 : 9,
    centeredLabels: true,
    sides: [
      {
        name: is56 ? 'Utara' : isL6 ? 'Timur' : 'A',
        labels: sequence(perSide, (n) => (is56 || isL6 ? String(n) : `${n}A`)),
        descendingRows: true,
      },
      {
        name: is56 ? 'Selatan' : isL6 ? 'Barat' : 'B',
        labels: sequence(perSide, (n) => (is56 || isL6 ? String(perSide * 2 + 1 - n) : `${n}B`)),
        descendingRows: false,
      },
    ],
  };
});
export const getEquipment = (code: string) => equipment.find((e) => e.code === code);
export const positionKey = (p: Position) => `${p.side}-${p.compartment}-${p.column}-${p.row}`;
export const displayCompartment = (p: Pick<Position, 'side' | 'compartment'>, eq: Equipment) =>
  eq.sides.find((s) => s.name === p.side)?.labels[p.compartment - 1] ?? '';
export const positionLabel = (p: Position, eq: Equipment) =>
  `${displayCompartment(p, eq)} ${eq.columns[p.column - 1]}${p.row}`;
export const compartmentFromLabel = (label: string, eq: Equipment) => {
  for (const side of eq.sides) {
    const index = side.labels.indexOf(label);
    if (index !== -1) return { side: side.name, compartment: index + 1 };
  }
  return undefined;
};
export const rowOrder = (eq: Equipment, side: Position['side']) => {
  const descending = eq.sides.find((s) => s.name === side)?.descendingRows;
  return Array.from({ length: eq.rows }, (_, i) => (descending ? eq.rows - i : i + 1));
};
// The divider follows the physical row number, regardless of display direction.
export const rowDividerBefore = (eq: Equipment, side: Position['side'], row: number) =>
  eq.rowDividerAfter !== null &&
  row === eq.rowDividerAfter + (eq.sides.find((s) => s.name === side)?.descendingRows ? 0 : 1);
export const validPosition = (p: Position, eq: Equipment) =>
  eq.sides.some((s) => s.name === p.side) &&
  Number.isInteger(p.compartment) &&
  p.compartment >= 1 &&
  p.compartment <= eq.perSide &&
  Number.isInteger(p.column) &&
  p.column >= 1 &&
  p.column <= eq.columns.length &&
  Number.isInteger(p.row) &&
  p.row >= 1 &&
  p.row <= eq.rows;
export function equipmentPositions(eq: Equipment): Position[] {
  return eq.sides.flatMap(({ name: side }) =>
    Array.from({ length: eq.perSide }, (_, i) =>
      Array.from({ length: eq.columns.length }, (_, c) =>
        Array.from({ length: eq.rows }, (_, r) => ({ side, compartment: i + 1, column: c + 1, row: r + 1 })),
      ).flat(),
    ).flat(),
  );
}
export const equipmentSideSummary = (eq: Equipment) =>
  eq.sides.map((s) => `${eq.perSide} ${s.name}`).join(' / ');
export const ageHours = (installedAt: string | null, now = Date.now()) =>
  installedAt === null ? null : Math.max(0, Math.floor((now - Date.parse(installedAt)) / 3_600_000));
export function bagColor(hours: number | null) {
  if (hours === null) return '#e6eae9';
  const f = Math.min(Math.max(hours / 21600, 0), 1);
  return `hsl(${Math.round(128 + f * 20)} ${Math.round(78 - f * 22)}% ${Math.round(61 - f * 47)}%)`;
}
export const formatDate = (value: string) =>
  new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
export const wibInput = (now = Date.now()) => new Date(now + 7 * 3_600_000).toISOString().slice(0, 16);
export function wibToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Tanggal WIB tidak valid.');
  return new Date(`${value}:00+07:00`).toISOString();
}
export const positionSchema = z
  .object({
    side: z.enum(sides),
    compartment: z.number().int().min(1).max(15),
    column: z.number().int().min(1).max(8),
    row: z.number().int().min(1).max(17),
  })
  .strict();
export const replacementSchema = z
  .object({
    equipmentCode: z.enum(equipmentCodes),
    positions: z.array(positionSchema).min(1).max(500),
    installedAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(500),
    wo: z.string().trim().max(100).optional().default(''),
    // Omission is retained only for replaying pre-brand batches; new writes require a brand.
    brand: z.enum(bagBrands).optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const eq = getEquipment(b.equipmentCode)!;
    if (b.positions.some((p) => !validPosition(p, eq)))
      ctx.addIssue({ code: 'custom', message: 'Koordinat di luar equipment.' });
    if (new Set(b.positions.map(positionKey)).size !== b.positions.length)
      ctx.addIssue({ code: 'custom', message: 'Posisi tidak boleh duplikat.' });
  });
export type ReplacementInput = z.infer<typeof replacementSchema>;
export function validateInstallationDate(value: string, now = Date.now()) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= Date.UTC(2000, 0, 1) && time <= now + 60_000;
}
export function hasPermission(identity: Identity, action: 'read' | 'write' | 'audit', code?: string) {
  if (identity.mustChangePassword) return false;
  const grant = identity.grants.find((g) => g.appId === 'bag-filter');
  if (!grant || !grant.equipment.length || (code && !grant.equipment.includes(code as EquipmentCode)))
    return false;
  if (action === 'read') return bagRoles.includes(grant.role);
  if (action === 'write') return grant.role === 'operator' || grant.role === 'admin';
  return action === 'audit' && grant.role === 'admin';
}
export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  try {
    const u = new URL(value, 'https://plant.invalid');
    if (u.origin !== 'https://plant.invalid' || u.pathname.startsWith('/auth')) return '/';
    return u.pathname + u.search + u.hash;
  } catch {
    return '/';
  }
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_FAILED',
  ) {
    super(message);
  }
}
export const appCatalog = [
  {
    id: 'bag-filter',
    name: 'Bag Filter',
    description: 'Peta umur bag, pencatatan penggantian, dan riwayat per koordinat.',
    path: '/bag-filter',
    status: 'active',
  },
  {
    id: 'consumables',
    name: 'Consumable Room',
    description: 'Stok, penerimaan, dan pemakaian material.',
    status: 'planned',
  },
  {
    id: 'drawings',
    name: 'Drawing Database',
    description: 'Request, pemeriksaan, dan revisi drawing.',
    status: 'planned',
  },
  {
    id: 'rca',
    name: 'Root Cause Analysis',
    description: 'Analisis penyebab dan tindak lanjut perbaikan.',
    status: 'planned',
  },
  {
    id: 'part-cost',
    name: 'Part Cost',
    description: 'Estimasi biaya pembuatan sparepart.',
    status: 'planned',
  },
] as const;
