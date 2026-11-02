'use client';
import type { MaterialSearchResult } from '@plant/contracts';
export type CartLine = { material: MaterialSearchResult; quantity: string; mode?: 'base' | 'sap' };
export type CartDraft = {
  hec: string;
  wo: string;
  note: string;
  sourceRef: string;
  onbehalf: boolean;
  requesterName: string;
  requesterNik: string;
  reservationNo: string;
  equipmentNo: string;
  functionalLocation: string;
  costCenter: string;
  requiredDate: string;
  lines: CartLine[];
  pending?: { fingerprint: string; key: string };
};
export const emptyCart = (): CartDraft => ({
  hec: '',
  wo: '',
  note: '',
  sourceRef: '',
  onbehalf: false,
  requesterName: '',
  requesterNik: '',
  reservationNo: '',
  equipmentNo: '',
  functionalLocation: '',
  costCenter: '',
  requiredDate: '',
  lines: [],
});
export const cartKey = (userId: string, type: string, locationId: string) =>
  `r22-cart:${userId}:${type}:${locationId}`;
const memory = new Map<string, CartDraft>();
export function readCart(key: string): CartDraft {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (
      value &&
      typeof value === 'object' &&
      Array.isArray(value.lines) &&
      value.lines.length <= 100 &&
      value.lines.every(
        (l: CartLine) => typeof l?.material?.id === 'string' && typeof l.quantity === 'string',
      )
    ) {
      const draft = { ...emptyCart(), ...value };
      memory.set(key, draft);
      return draft;
    }
  } catch {}
  return memory.get(key) || emptyCart();
}
export function writeCart(key: string, draft: CartDraft) {
  memory.set(key, draft);
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {}
  window.dispatchEvent(new Event('r22-cart-change'));
}
export function removeCart(key: string) {
  memory.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {}
  window.dispatchEvent(new Event('r22-cart-change'));
}
export function clearR22Carts() {
  memory.clear();
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith('r22-cart:')) sessionStorage.removeItem(key);
  } catch {}
  window.dispatchEvent(new Event('r22-cart-change'));
}
export function cartCount(userId: string, type: string) {
  const prefix = `r22-cart:${userId}:${type}:`,
    keys = new Set([...memory.keys()]);
  try {
    for (const key of Object.keys(sessionStorage)) keys.add(key);
  } catch {}
  return [...keys].filter((k) => k.startsWith(prefix)).reduce((n, k) => n + readCart(k).lines.length, 0);
}
