import { z } from 'zod';

export const equipmentCodes = ['561-BF1', '562-BF1', '421-BF1', '422-BF2'] as const;
export type EquipmentCode = (typeof equipmentCodes)[number];
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
export type Position = { side: 'Utara' | 'Selatan'; compartment: number; column: number; row: number };
export const equipment = equipmentCodes.map((code, i) => ({
  code,
  perSide: i < 2 ? 12 : 15,
  compartments: i < 2 ? 24 : 30,
  bagsPerCompartment: 136,
  colorScaleDays: 900,
}));
export type Equipment = (typeof equipment)[number];
export const getEquipment = (code: string) => equipment.find((e) => e.code === code);
export const positionKey = (p: Position) => `${p.side}-${p.compartment}-${p.column}-${p.row}`;
export const displayCompartment = (p: Pick<Position, 'side' | 'compartment'>, eq: Equipment) =>
  p.side === 'Utara' ? p.compartment : eq.compartments + 1 - p.compartment;
export const positionLabel = (p: Position, eq: Equipment) =>
  `${displayCompartment(p, eq)} ${'HGFEDCBA'[p.column - 1]}${p.row}`;
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
    side: z.enum(['Utara', 'Selatan']),
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
  })
  .strict()
  .superRefine((b, ctx) => {
    const eq = getEquipment(b.equipmentCode)!;
    if (b.positions.some((p) => p.compartment > eq.perSide))
      ctx.addIssue({ code: 'custom', message: 'Kompartemen di luar equipment.' });
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
