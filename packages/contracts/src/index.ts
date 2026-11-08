import { z } from 'zod';

export const equipmentCodes = ['561-BF1', '562-BF1', '421-BF1', '422-BF1', 'L61-BF1', 'L62-BF1'] as const;
export type EquipmentCode = (typeof equipmentCodes)[number];
export const bagBrands = ['Intensiv filter (Original)', 'Filtras', 'Cipta Medya', 'Other'] as const;
export type BagBrand = (typeof bagBrands)[number];
export const bagAgeIntervalDays = 210;
export const bagAgeScaleDays = 6 * bagAgeIntervalDays;
export const bagRoles = ['viewer', 'operator', 'admin'] as const;
export type BagRole = (typeof bagRoles)[number];
export type BagGrant = { appId: 'bag-filter'; role: BagRole; equipment: EquipmentCode[] };
export type Grant = BagGrant | import('./consumables').ConsumablesGrant;
export * from './consumables';
export type Identity = {
  id: string;
  name: string;
  email: string;
  position: string;
  portalAdmin: boolean;
  mustChangePassword: boolean;
  grants: Grant[];
  sessionExpiresAt?: string;
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
    colorScaleDays: bagAgeScaleDays,
    rowDividerAfter: isL6 ? 8 : 9,
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
export const ageStops = [
  { days: 0, color: '#8FCB2F' },
  { days: bagAgeIntervalDays, color: '#BDD62E' },
  { days: 2 * bagAgeIntervalDays, color: '#EBD52F' },
  { days: 3 * bagAgeIntervalDays, color: '#F7B32B' },
  { days: 4 * bagAgeIntervalDays, color: '#F4862A' },
  { days: 5 * bagAgeIntervalDays, color: '#E65A2A' },
  { days: bagAgeScaleDays, color: '#CF2E2E' },
] as const;
export const ageBucket = (hours: number) =>
  Math.min(ageStops.length - 1, Math.floor(Math.max(0, hours) / (bagAgeIntervalDays * 24)));
export function bagColor(hours: number | null) {
  if (hours === null) return 'var(--empty-bag)';
  const days = Math.min(bagAgeScaleDays, Math.max(0, hours / 24));
  const index = Math.min(ageStops.length - 2, Math.floor(days / bagAgeIntervalDays));
  const a = ageStops[index],
    b = ageStops[index + 1],
    f = (days - a.days) / (b.days - a.days);
  const rgb = [1, 3, 5].map((i) =>
    Math.round(parseInt(a.color.slice(i, i + 2), 16) * (1 - f) + parseInt(b.color.slice(i, i + 2), 16) * f),
  );
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
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

export type WibWeek = {
  start: string; // YYYY-MM-DD (Senin WIB)
  label: string; // '3 Nov'
  startMs: number; // timestamp ms for Monday 00:00:00+07:00
  endMs: number; // timestamp ms for next Monday 00:00:00+07:00
};

export function wibWeekStarts(now = Date.now(), count = 12): WibWeek[] {
  const WIB_OFFSET_MS = 7 * 3_600_000;
  const wibTime = now + WIB_OFFSET_MS;
  const wibDate = new Date(wibTime);
  const day = wibDate.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const daysFromMonday = (day + 6) % 7;
  const currentMondayUtcDate = wibDate.getUTCDate() - daysFromMonday;
  const year = wibDate.getUTCFullYear();
  const month = wibDate.getUTCMonth();

  const shortMonthFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
  });

  const weeks: WibWeek[] = [];
  for (let i = 0; i < count; i++) {
    const weeksAgo = count - 1 - i;
    const weekMondayWibMs = Date.UTC(year, month, currentMondayUtcDate - weeksAgo * 7, 0, 0, 0, 0);
    const startMs = weekMondayWibMs - WIB_OFFSET_MS;
    const endMs = startMs + 7 * 86_400_000;

    const wDate = new Date(weekMondayWibMs);
    const y = wDate.getUTCFullYear();
    const m = String(wDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(wDate.getUTCDate()).padStart(2, '0');
    const start = `${y}-${m}-${d}`;
    const label = shortMonthFormatter.format(new Date(startMs));

    weeks.push({ start, label, startMs, endMs });
  }
  return weeks;
}

export function formatRelativeWib(date: string | number | Date, now = Date.now()): string {
  const targetMs = typeof date === 'string' ? Date.parse(date) : date instanceof Date ? date.getTime() : date;
  if (!Number.isFinite(targetMs)) return '';

  const WIB_OFFSET_MS = 7 * 3_600_000;
  const targetWibMs = targetMs + WIB_OFFSET_MS;
  const nowWibMs = now + WIB_OFFSET_MS;

  const targetDate = new Date(targetWibMs);
  const nowDate = new Date(nowWibMs);

  const diffMs = Math.max(0, now - targetMs);

  if (diffMs < 60_000) return 'Baru saja';
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins} menit lalu`;
  }

  const targetMidnightMs = Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
  );
  const nowMidnightMs = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const diffDays = Math.round((nowMidnightMs - targetMidnightMs) / 86_400_000);

  const hours = String(targetDate.getUTCHours()).padStart(2, '0');
  const minutes = String(targetDate.getUTCMinutes()).padStart(2, '0');
  const timeStr = `${hours}.${minutes}`;

  if (diffDays === 0) {
    return `Hari ini ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Kemarin ${timeStr}`;
  }
  if (diffDays >= 2 && diffDays <= 6) {
    return `${diffDays} hari lalu`;
  }
  const day = targetDate.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthName = months[targetDate.getUTCMonth()];
  if (targetDate.getUTCFullYear() === nowDate.getUTCFullYear()) {
    return `${day} ${monthName}`;
  }
  return `${day} ${monthName} ${targetDate.getUTCFullYear()}`;
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
export const cancellationSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export type BatchCancellation = {
  reason: string;
  actorId: string;
  actorName: string;
  cancelledAt: string;
};
export type BatchStatus = 'active' | 'cancelled';
export function validateInstallationDate(value: string, now = Date.now()) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= Date.UTC(2000, 0, 1) && time <= now + 60_000;
}
export function hasPermission(
  identity: Identity,
  action: 'read' | 'write' | 'audit' | 'cancel',
  code?: string,
) {
  if (identity.mustChangePassword) return false;
  const grant = identity.grants.find((g) => g.appId === 'bag-filter');
  if (!grant || !grant.equipment.length || (code && !grant.equipment.includes(code as EquipmentCode)))
    return false;
  if (action === 'read') return bagRoles.includes(grant.role);
  if (action === 'write') return grant.role === 'operator' || grant.role === 'admin';
  return (action === 'audit' || action === 'cancel') && grant.role === 'admin';
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
    icon: 'filter',
    name: 'Bag Filter',
    description: 'Peta umur bag, pencatatan penggantian, dan riwayat per koordinat.',
    path: '/bag-filter',
    portalSummary: '/bag-filter/api/portal-summary',
    status: 'active',
  },
  {
    id: 'consumables',
    icon: 'box',
    name: 'Consumable Room',
    description: 'Stok, penerimaan, dan pemakaian material.',
    path: '/consumables',
    portalSummary: '/consumables/api/portal-summary',
    status: 'active',
  },
  {
    id: 'drawings',
    icon: 'drawing',
    name: 'Drawing Database',
    description: 'Request, pemeriksaan, dan revisi drawing.',
    status: 'planned',
  },
  {
    id: 'rca',
    icon: 'rca',
    name: 'Root Cause Analysis',
    description: 'Analisis penyebab dan tindak lanjut perbaikan.',
    status: 'planned',
  },
  {
    id: 'part-cost',
    icon: 'cost',
    name: 'Part Cost',
    description: 'Estimasi biaya pembuatan sparepart.',
    status: 'planned',
  },
] as const;

export type AppId = (typeof appCatalog)[number]['id'];
export type PortalIconName =
  | 'box'
  | 'receipt'
  | 'issue'
  | 'home'
  | 'grid'
  | 'user'
  | 'settings'
  | 'search'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'chevron'
  | 'collapse'
  | 'menu'
  | 'x'
  | 'check'
  | 'arrow'
  | 'clock'
  | 'plus'
  | 'calendar'
  | 'filter'
  | 'drawing'
  | 'rca'
  | 'cost'
  | 'info'
  | 'logout';
export type PortalTone = 'neutral' | 'accent' | 'warning' | 'danger';
export type PortalMetricTone = 'neutral' | 'warning' | 'danger';
export type PortalAttentionSeverity = 'warning' | 'danger';

export type PortalAttentionGroup = {
  key: string;
  label: string;
  unit: string;
};

export type PortalAttentionItem = {
  key: string;
  group: PortalAttentionGroup;
  label: string;
  value: number;
  severity: PortalAttentionSeverity;
  href: string;
};

export type PortalSummaryHeadline = {
  label: string;
  value: number;
  total: number;
  unit: string;
  caption: string;
  href?: string;
};

export type PortalSummaryMetric = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  href?: string;
  tone?: PortalMetricTone;
};

export type PortalSummaryActivityWeek = {
  start: string; // YYYY-MM-DD (Senin WIB)
  count: number;
};

export type PortalSummaryActivity = {
  unitSingular: string; // 'batch' | 'dokumen'
  weeks: PortalSummaryActivityWeek[]; // tepat 12, lama → baru
};

export type PortalSummaryRecent = {
  id: string;
  title: string;
  meta: string;
  at: string;
  href: string;
  value?: number;
  unit?: string;
};

export type PortalSummary = {
  appId: AppId;
  updatedAt: string;
  headline: PortalSummaryHeadline;
  metrics: PortalSummaryMetric[]; // maks 2
  attention: PortalAttentionItem[];
  activity: PortalSummaryActivity;
  recent: PortalSummaryRecent[]; // maks 5
  action?: { label: string; href: string; icon: PortalIconName };
};
