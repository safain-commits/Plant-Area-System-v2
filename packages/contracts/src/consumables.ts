import type { Identity } from './index';

export const consumablesRoles = ['viewer', 'operator', 'storekeeper', 'admin'] as const;
export type ConsumablesRole = (typeof consumablesRoles)[number];
export type ConsumablesGrant = { appId: 'consumables'; role: ConsumablesRole; locationIds: string[] };
export type StockAction = 'read' | 'issue' | 'return' | 'receive' | 'onbehalf' | 'manage' | 'audit';
export function canConsume(actor: Identity, action: StockAction, locationId?: string) {
  if (!['read', 'issue', 'return', 'receive', 'onbehalf', 'manage', 'audit'].includes(action)) return false;
  if (actor.mustChangePassword) return false;
  const g = actor.grants.find((v) => v.appId === 'consumables');
  if (!g || !consumablesRoles.includes(g.role)) return false;
  if (g.role === 'admin') return true;
  if (!g.locationIds.length || (locationId && !g.locationIds.includes(locationId))) return false;
  if (action === 'read') return true;
  if (action === 'issue' || action === 'return') return g.role === 'operator' || g.role === 'storekeeper';
  return (action === 'receive' || action === 'onbehalf') && g.role === 'storekeeper';
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
  sapUnit: string;
  aliases: string;
  decimalAllowed: boolean;
  conversionReviewed: boolean;
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
  type: 'opening' | 'receipt' | 'issue' | 'return' | 'adjustment';
  documentId?: string | null;
  lineNo?: number | null;
  commonName?: string | null;
  sapUnit?: string | null;
  sapQuantity?: string | null;
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

export const HEC_PATTERN = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;
export function normalizeHec(value: string) {
  return value.trim().toUpperCase().replace(/^TQ\./, '');
}
export const COUNT_UNITS = [
  'EA',
  'PC',
  'PCS',
  'SET',
  'BH',
  'BUAH',
  'UNIT',
  'ROL',
  'ROLL',
  'CAN',
  'TBE',
  'BTL',
  'BOX',
  'PAK',
  'PACK',
] as const;
export function allowsDecimals(unit: string) {
  return !(COUNT_UNITS as readonly string[]).includes(unit.trim().toUpperCase());
}
export function normalizeAliases(value: string) {
  const result: string[] = [];
  for (const raw of value.split(',')) {
    const alias = raw.trim();
    if (!alias) continue;
    if (alias.length > 40) throw Error('Setiap alias maksimal 40 karakter.');
    if (!result.some((v) => v.toLocaleLowerCase() === alias.toLocaleLowerCase())) result.push(alias);
  }
  if (result.length > 10) throw Error('Maksimal 10 alias per material.');
  return result.join(', ');
}
export function validateStockQuantity(value: string, decimalAllowed: boolean) {
  const units = decimalUnits(value);
  if (units <= 0n) throw Error('Jumlah harus lebih besar dari nol.');
  if (!decimalAllowed && units % SCALE !== 0n) throw Error('Material ini hanya menerima jumlah bulat.');
  return decimalString(units);
}
export function sapToR22(
  value: string,
  material: Pick<Material, 'unit' | 'sapUnit' | 'packSize' | 'decimalAllowed'>,
) {
  const input = decimalUnits(value);
  if (input <= 0n) throw Error('Jumlah SAP harus lebih besar dari nol.');
  const factor =
    material.packSize ?? (material.sapUnit.toUpperCase() === material.unit.toUpperCase() ? '1' : null);
  if (!factor) throw Error('Konversi SAP belum diatur. Gunakan input satuan R22 atau hubungi admin.');
  const product = input * decimalUnits(factor);
  if (product % SCALE !== 0n)
    throw Error('Hasil konversi melebihi enam desimal. Gunakan satuan R22 atau perbaiki konversi.');
  return validateStockQuantity(decimalString(product / SCALE), material.decimalAllowed);
}
export const stockDocumentLabels = {
  consume: 'Consume Order',
  return: 'Return Order',
  picklist: 'Penerimaan Picklist',
} as const;
export type StockDocumentType = keyof typeof stockDocumentLabels;
export type StockDocument = {
  id: string;
  number: string;
  type: StockDocumentType;
  locationId: string;
  locationName: string;
  hec: string;
  wo: string;
  note: string;
  channel: 'self' | 'cashier';
  requesterName: string;
  requesterNik: string;
  sourceRef: string;
  reservationNo: string;
  equipmentNo: string;
  functionalLocation: string;
  costCenter: string;
  requiredDate: string | null;
  lineCount: number;
  actorId: string;
  actorName: string;
  createdAt: string;
};
export type StockDocumentLine = Movement & { documentId: string; lineNo: number };
export type DocumentResult = {
  document: StockDocument;
  lines: StockDocumentLine[];
  replayed?: boolean;
  previousDocuments?: StockDocument[];
};
export type StockLineConflict = {
  lineNo: number;
  materialId: string;
  mmid: string;
  available: string;
  requested: string;
  error: string;
};
export type MaterialSearchResult = Material & {
  inventoryId: string | null;
  locationId: string;
  rack: string;
  quantity: string;
  initialized: boolean;
  inventoryActive: boolean;
};
export function canonicalDocumentPayload(value: Record<string, unknown>): string {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, canonical(x)]),
      );
    return v;
  };
  return JSON.stringify(canonical(value));
}
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
