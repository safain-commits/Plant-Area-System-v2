import { AppError, getEquipment, equipment, positionSchema, validPosition } from '@plant/contracts';
import { apiIdentity, failure, readJson, verifyOrigin } from '@plant/server';
import {
  snapshot,
  batchHistory,
  createReplacement,
  positionHistory,
  auditHistory,
  dashboard,
  activity,
} from '@plant/bag-core';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request, context: Context) {
  try {
    const path = (await context.params).path,
      params = new URL(request.url).searchParams;
    if (['dashboard', 'activity', 'discovery'].includes(path.join('/'))) {
      const actor = await apiIdentity(request, 'read');
      const codes = actor.grants.find((g) => g.appId === 'bag-filter')!.equipment;
      if (path[0] === 'dashboard') {
        const now = Date.now();
        const year = params.has('year')
          ? Number(params.get('year'))
          : new Date(now + 7 * 3600000).getUTCFullYear();
        return json(await dashboard(codes, year, now));
      }
      if (path[0] === 'activity') return json({ items: await activity(codes) });
      return json({
        equipment: equipment.filter(
          (e) =>
            codes.includes(e.code) && e.code.toLowerCase().includes((params.get('q') || '').toLowerCase()),
        ),
        items: await activity(codes, params.get('q') || ''),
      });
    }
    if (path.join('/') === 'equipment') {
      const actor = await apiIdentity(request, 'read');
      const codes = actor.grants.find((g) => g.appId === 'bag-filter')!.equipment;
      return json({ equipment: equipment.filter((e) => codes.includes(e.code)) });
    }
    if (path.join('/') === 'audit') {
      const actor = await apiIdentity(request, 'audit');
      return json(
        await auditHistory(
          actor.grants.find((g) => g.appId === 'bag-filter')!.equipment,
          params.get('cursor'),
        ),
      );
    }
    if (path.length !== 3 || path[0] !== 'equipment') throw new AppError(404, 'Endpoint tidak ditemukan.');
    const code = path[1],
      eq = getEquipment(code);
    if (!eq) throw new AppError(404, 'Equipment tidak ditemukan.');
    await apiIdentity(request, 'read', code);
    if (path[2] === 'state') return json(await snapshot(code));
    if (path[2] === 'batches')
      return json(await batchHistory(code, params.get('q') || '', params.get('cursor')));
    if (path[2] === 'positions') {
      const p = positionSchema.safeParse({
        side: params.get('side'),
        compartment: Number(params.get('compartment')),
        column: Number(params.get('column')),
        row: Number(params.get('row')),
      });
      if (!p.success || !validPosition(p.data, eq)) throw new AppError(400, 'Koordinat tidak valid.');
      return json(await positionHistory(code, p.data, params.get('cursor')));
    }
    throw new AppError(404, 'Endpoint tidak ditemukan.');
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    verifyOrigin(request);
    const path = (await context.params).path;
    if (path.length !== 3 || path[0] !== 'equipment' || path[2] !== 'batches' || !getEquipment(path[1]))
      throw new AppError(404, 'Endpoint tidak ditemukan.');
    const actor = await apiIdentity(request, 'write', path[1]),
      body = await readJson(request);
    if (body.equipmentCode !== path[1]) throw new AppError(400, 'Equipment tidak sesuai alamat.');
    const result = await createReplacement(actor, body, request.headers.get('idempotency-key'));
    return json(result, result.replayed ? 200 : 201);
  } catch (e) {
    return failure(e);
  }
}
