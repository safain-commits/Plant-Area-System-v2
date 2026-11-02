'use client';
import type { StockLineConflict } from '@plant/contracts';
export class StockApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public lines: StockLineConflict[] = [],
  ) {
    super(message);
  }
}
export async function stockApi(path: string, options?: RequestInit) {
  const response = await fetch('/consumables/api' + path, { cache: 'no-store', ...options });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new StockApiError(
      'Layanan belum dapat dihubungi. Coba lagi dengan permintaan yang sama.',
      response.status,
    );
  const data = await response.json();
  if (!response.ok)
    throw new StockApiError(data.error || 'Permintaan belum berhasil.', response.status, data.lines || []);
  return data;
}
