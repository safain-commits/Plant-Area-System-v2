import { getAuthDb, getAuth } from '@plant/auth-core';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    getAuth();
    await getAuthDb().execute('SELECT 1');
    return Response.json({ status: 'ready' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
