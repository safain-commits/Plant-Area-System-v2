import { identityForCookie } from '@plant/auth-core';
import { AppError, hasPermission, safeReturnTo } from '@plant/contracts';
import { failure, verifyInternal } from '@plant/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    verifyInternal(request);
    const identity = await identityForCookie(request.headers.get('cookie') || '');
    const app = request.headers.get('x-plant-app');
    if (app !== 'portal' && app !== 'bag-filter') throw new AppError(403, 'Aplikasi tidak dikenal.');
    if (app === 'bag-filter' && !hasPermission(identity, 'read'))
      throw new AppError(403, 'Akses Bag Filter belum diberikan.');
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof AppError && e.code === 'PASSWORD_CHANGE_REQUIRED')
      return new Response(null, { status: 401, headers: { 'X-Auth-Redirect': '/auth/change-password' } });
    if (e instanceof AppError && e.status === 401)
      return new Response(null, {
        status: 401,
        headers: {
          'X-Auth-Redirect': `/auth/login?returnTo=${encodeURIComponent(safeReturnTo(request.headers.get('x-original-uri')))}`,
        },
      });
    return failure(e);
  }
}
