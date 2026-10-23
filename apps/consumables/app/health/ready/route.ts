import { sql } from 'drizzle-orm';
import { getConsumablesDb } from '@plant/consumables-core';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await getConsumablesDb().execute(sql`SELECT id FROM catalog_imports LIMIT 1`);
    const r = await fetch(`${process.env.AUTH_INTERNAL_URL}/auth/health/ready`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (!r.ok) throw Error();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
