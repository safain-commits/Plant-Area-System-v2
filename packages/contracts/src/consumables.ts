import type { Identity } from './index';

export const consumablesRoles = ['viewer', 'operator', 'storekeeper', 'admin'] as const;
export type ConsumablesRole = (typeof consumablesRoles)[number];
export type ConsumablesGrant = { appId: 'consumables'; role: ConsumablesRole; locationIds: string[] };
export type StockAction = 'read' | 'issue' | 'receive' | 'manage' | 'audit';
export function canConsume(actor: Identity, action: StockAction, locationId?: string) {
  if (!['read', 'issue', 'receive', 'manage', 'audit'].includes(action)) return false;
  if (actor.mustChangePassword) return false;
  const g = actor.grants.find((v) => v.appId === 'consumables');
  if (!g || !consumablesRoles.includes(g.role)) return false;
  if (g.role === 'admin') return true;
  if (!g.locationIds.length || (locationId && !g.locationIds.includes(locationId))) return false;
  if (action === 'read') return true;
  if (action === 'issue') return g.role === 'operator' || g.role === 'storekeeper';
  return action === 'receive' && g.role === 'storekeeper';
}
const SCALE = 1_000_000n;
const MAX = 999_999_999_999_999_999n;
export function decimalUnits(value: unknown, signed = false): bigint {
  if (
    typeof value !== 'string' ||
    !(signed ? /^-?\d{1,12}(\.\d{1,6})?$/ : /^\d{1,12}(\.\d{1,6})?$/).test(value)
  )
    throw new Error('Jumlah harus berupa desimal, maksimal 12 digit dan 6 angka pecahan.');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
  if (units > MAX) throw new Error('Jumlah melampaui kapasitas.');
  return negative ? -units : units;
}
export function decimalString(units: bigint): string {
  if (units > MAX || units < -MAX) throw new Error('Jumlah melampaui kapasitas.');
  const n = units < 0 ? -units : units;
  return `${units < 0 ? '-' : ''}${n / SCALE}.${String(n % SCALE).padStart(6, '0')}`;
}
export function localDecimal(value: string) {
  return value.trim().replace(',', '.');
}
export function formatQuantity(value: string): string {
  const [whole, fraction] = decimalString(decimalUnits(value, true)).split('.');
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') +
    (fraction.replace(/0+$/, '') ? ',' + fraction.replace(/0+$/, '') : '')
  );
}
export type Material = {
  id: string;
  mmid: string;
  description: string;
  commonName: string;
  unit: string;
  category: string;
  mrpType: string;
  critical: boolean;
  packSize: string | null;
  active: boolean;
  version: number;
  sourceBatch: string | null;
  sourceDate: string | null;
};
export type StockLocation = { id: string; name: string; active: boolean; version: number };
export type InventoryItem = Material & {
  inventoryId: string;
  locationId: string;
  locationName: string;
  rack: string;
  quantity: string;
  initialized: boolean;
  inventoryActive: boolean;
  inventoryVersion: number;
  locationActive: boolean;
};
export type Movement = {
  id: string;
  materialId: string;
  locationId: string;
  mmid: string;
  description: string;
  unit: string;
  locationName: string;
  type: 'opening' | 'receipt' | 'issue' | 'adjustment';
  quantity: string;
  balanceAfter: string;
  packs: number | null;
  packSize: string | null;
  reference: string;
  wo: string;
  job: string;
  reason: string;
  actorId: string;
  actorName: string;
  createdAt: string;
};
export type StockDashboard = {
  operational: number;
  available: number;
  empty: number;
  criticalEmpty: number;
  uncounted: number;
  year: number;
  currentYear: number;
  series: { quarter: number; opening: number; receipt: number; issue: number; adjustment: number }[];
  recent: Movement[];
};
