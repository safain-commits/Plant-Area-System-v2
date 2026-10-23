import { verifyInternal, failure } from '@plant/server';
import { internalLocations } from '@plant/consumables-core';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    verifyInternal(request);
    return Response.json({ items: await internalLocations() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return failure(e);
  }
}
