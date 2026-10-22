import { identityForCookie } from '@plant/auth-core';
import { failure, verifyInternal } from '@plant/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    verifyInternal(request);
    const identity = await identityForCookie(
      request.headers.get('cookie') || '',
      new URL(request.url).searchParams.get('allowPasswordChange') === '1',
    );
    return Response.json({ identity }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return failure(e);
  }
}
