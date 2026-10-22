import { getAuth, login, publicOrigin } from '@plant/auth-core';
import { AppError } from '@plant/contracts';
import { failure, readJson, verifyOrigin } from '@plant/server';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ all: string[] }> }) {
  try {
    verifyOrigin(request);
    const path = (await context.params).all.join('/');
    if (path === 'sign-in/email') return await login(request, await readJson(request, 4096));
    if (path === 'sign-out') {
      const h = new Headers(request.headers);
      h.delete('content-length');
      h.set('content-type', 'application/json');
      const response = await getAuth().handler(
        new Request(`${publicOrigin()}/auth/api/sign-out`, { method: 'POST', headers: h, body: '{}' }),
      );
      return Response.json({ ok: response.ok }, { status: response.status, headers: response.headers });
    }
    throw new AppError(404, 'Endpoint tidak tersedia.');
  } catch (e) {
    return failure(e);
  }
}
export async function GET() {
  return Response.json({ error: 'Endpoint tidak tersedia.' }, { status: 404 });
}
