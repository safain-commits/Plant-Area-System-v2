import {
  identityForCookie,
  listUsers,
  createUser,
  updateUserAccess,
  setGrant,
  resetPassword,
  changePassword,
  updateProfile,
  authAudit,
  listApplications,
  setApplicationStatus,
} from '@plant/auth-core';
import { AppError } from '@plant/contracts';
import { failure, readJson, verifyOrigin } from '@plant/server';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ segments: string[] }> };
export async function GET(request: Request, context: Context) {
  try {
    const segments = (await context.params).segments,
      path = segments.join('/');
    const actor = await identityForCookie(request.headers.get('cookie') || '', path === 'me');
    if (path === 'me')
      return Response.json({ identity: actor }, { headers: { 'Cache-Control': 'no-store' } });
    if (path === 'admin/users')
      return Response.json({ users: await listUsers(actor) }, { headers: { 'Cache-Control': 'no-store' } });
    if (path === 'admin/applications')
      return Response.json(
        { applications: await listApplications(actor) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    if (path === 'admin/audit')
      return Response.json(
        { items: await authAudit(actor, new URL(request.url).searchParams.get('before') || undefined) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    throw new AppError(404, 'Endpoint tidak ditemukan.');
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    verifyOrigin(request);
    const segments = (await context.params).segments,
      path = segments.join('/');
    const actor = await identityForCookie(request.headers.get('cookie') || '', path === 'password');
    const body = await readJson(request, 8192);
    if (path === 'profile') await updateProfile(actor, body);
    else if (path === 'password') await changePassword(actor, body.currentPassword, body.newPassword);
    else if (path === 'admin/users') return Response.json(await createUser(actor, body), { status: 201 });
    else if (path === 'admin/applications/bag-filter')
      await setApplicationStatus(actor, 'bag-filter', body.status);
    else if (segments.length === 4 && segments[0] === 'admin' && segments[1] === 'users') {
      const id = segments[2];
      if (segments[3] === 'access') await updateUserAccess(actor, id, body);
      else if (segments[3] === 'grant') await setGrant(actor, id, body.grant);
      else if (segments[3] === 'password') await resetPassword(actor, id, body.password);
      else throw new AppError(404, 'Endpoint tidak ditemukan.');
    } else throw new AppError(404, 'Endpoint tidak ditemukan.');
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return failure(e);
  }
}
