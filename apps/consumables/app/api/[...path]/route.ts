import { AppError, canConsume } from '@plant/contracts';
import { apiIdentity, failure, verifyOrigin, readJson } from '@plant/server';
import {
  listLocations,
  listMaterials,
  listCategories,
  listInventory,
  materialDetail,
  listMovements,
  movementDetail,
  auditList,
  stockDashboard,
  discovery,
  reconcile,
  saveMaterial,
  saveLocation,
  saveInventory,
  postMovement,
  createDocument,
  documentDetail,
  listDocuments,
  searchMaterials,
  hecSuggestions,
  DocumentConflict,
} from '@plant/consumables-core';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
const json = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request, context: Context) {
  try {
    const a = await apiIdentity(request);
    if (!canConsume(a, 'read')) throw new AppError(403, 'Akses Consumable Room belum diberikan.');
    const path = (await context.params).path,
      p = new URL(request.url).searchParams,
      s = path.join('/');
    if (s === 'locations') return json(await listLocations(a));
    if (s === 'search') return json(await searchMaterials(a, p));
    if (s === 'catalog-search') return json(await searchMaterials(a, p, true));
    if (s === 'hec-suggestions') return json(await hecSuggestions(a, p.get('q') || ''));
    if (s === 'documents') return json(await listDocuments(a, p));
    if (path.length === 2 && path[0] === 'documents') return json(await documentDetail(a, path[1]));
    if (s === 'categories') return json(await listCategories(a));
    if (s === 'materials') return json(await listMaterials(a, p));
    if (s === 'inventory') return json(await listInventory(a, p));
    if (s === 'movements') return json(await listMovements(a, p));
    if (path.length === 2 && path[0] === 'materials') return json(await materialDetail(a, path[1]));
    if (path.length === 2 && path[0] === 'movements') return json(await movementDetail(a, path[1]));
    if (s === 'audit') return json(await auditList(a, p));
    if (s === 'reconciliation') return json(await reconcile(a));
    if (s === 'dashboard')
      return json(await stockDashboard(a, p.has('year') ? Number(p.get('year')) : undefined));
    if (s === 'activity') return json(await listDocuments(a, new URLSearchParams({ limit: '12' })));
    if (s === 'discovery') return json(await discovery(a, p.get('q') || ''));
    throw new AppError(404, 'Endpoint tidak ditemukan.');
  } catch (e) {
    return failure(e);
  }
}
async function mutate(request: Request, context: Context) {
  try {
    verifyOrigin(request);
    const a = await apiIdentity(request),
      path = (await context.params).path;
    if (!canConsume(a, 'read')) throw new AppError(403, 'Akses Consumable Room belum diberikan.');
    if (request.method === 'POST' && path.length === 1 && ['issues', 'receipts'].includes(path[0]))
      return json({ error: 'Gunakan /consume-orders atau /picklist-receipts.' }, 410);
    const body = await readJson(request);
    const documentType = (
      { 'consume-orders': 'consume', 'return-orders': 'return', 'picklist-receipts': 'picklist' } as const
    )[path[0] as 'consume-orders'];
    if (request.method === 'POST' && path.length === 1 && documentType) {
      const result = await createDocument(a, documentType, body, request.headers.get('idempotency-key'));
      return json(result, result.replayed ? 200 : 201);
    }
    const kind = (
      {
        receipts: 'receipt',
        issues: 'issue',
        'opening-balances': 'opening',
        adjustments: 'adjustment',
      } as const
    )[path[0] as 'receipts'];
    if (request.method === 'POST' && path.length === 1 && kind) {
      const result = await postMovement(a, kind, body, request.headers.get('idempotency-key'));
      return json(result, result.replayed ? 200 : 201);
    }
    if (
      (request.method === 'POST' && path.length === 1) ||
      (request.method === 'PATCH' && path.length === 2)
    ) {
      const id = path[1];
      if (path[0] === 'materials') return json(await saveMaterial(a, body, id), id ? 200 : 201);
      if (path[0] === 'locations') return json(await saveLocation(a, body, id), id ? 200 : 201);
      if (path[0] === 'inventory') return json(await saveInventory(a, body, id), id ? 200 : 201);
    }
    throw new AppError(404, 'Endpoint tidak ditemukan.');
  } catch (e) {
    if (e instanceof DocumentConflict) return json({ error: e.message, code: e.code, lines: e.lines }, 409);
    return failure(e);
  }
}
export const POST = mutate;
export const PATCH = mutate;
