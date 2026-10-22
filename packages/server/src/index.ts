import { timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppError, safeReturnTo, hasPermission, type Identity } from '@plant/contracts';

export function failure(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  const requestId = crypto.randomUUID();
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'request.failed',
      requestId,
      errorType: error instanceof Error ? error.name : 'unknown',
    }),
  );
  return Response.json(
    { error: 'Layanan sementara tidak tersedia. Coba lagi.', requestId },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
export function verifyOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (
    !process.env.PUBLIC_ORIGIN ||
    origin !== process.env.PUBLIC_ORIGIN ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new AppError(403, 'Origin tidak diizinkan.');
}
export async function readJson(request: Request, maxBytes = 128_000): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AppError(415, 'Gunakan application/json.');
  if (Number(request.headers.get('content-length') || 0) > maxBytes)
    throw new AppError(413, 'Permintaan terlalu besar.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Body diperlukan.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError(413, 'Permintaan terlalu besar.');
    }
    chunks.push(value);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppError(400, 'JSON tidak valid.');
  }
}
export function verifyInternal(request: Request) {
  const actual = request.headers.get('x-plant-service-token') || '',
    expected = process.env.SERVICE_TOKEN || '';
  const actualBytes = Buffer.from(actual),
    expectedBytes = Buffer.from(expected);
  if (
    expectedBytes.length < 32 ||
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  )
    throw new AppError(403, 'Akses internal ditolak.');
}
export async function fetchIdentity(cookie: string, allowPasswordChange = false): Promise<Identity> {
  const base = process.env.AUTH_INTERNAL_URL,
    token = process.env.SERVICE_TOKEN;
  if (!base || !token) throw new AppError(503, 'Konfigurasi autentikasi belum tersedia.');
  let response: Response;
  try {
    response = await fetch(
      `${base}/auth/internal/session${allowPasswordChange ? '?allowPasswordChange=1' : ''}`,
      {
        headers: { cookie, 'x-plant-service-token': token },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    );
  } catch {
    throw new AppError(503, 'Layanan autentikasi tidak tersedia.');
  }
  const body = await response.json();
  if (!response.ok)
    throw new AppError(
      response.status === 401 || response.status === 403 ? response.status : 503,
      body.error || 'Autentikasi tidak tersedia.',
      body.code,
    );
  return body.identity as Identity;
}
export async function pageIdentity(returnTo: string, allowPasswordChange = false) {
  try {
    return await fetchIdentity((await headers()).get('cookie') || '', allowPasswordChange);
  } catch (e) {
    if (e instanceof AppError && e.status === 401)
      redirect(`/auth/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
    if (e instanceof AppError && e.code === 'PASSWORD_CHANGE_REQUIRED') redirect('/auth/change-password');
    throw e;
  }
}
export async function apiIdentity(request: Request, action?: 'read' | 'write' | 'audit', equipment?: string) {
  const identity = await fetchIdentity(request.headers.get('cookie') || '');
  if (action && !hasPermission(identity, action, equipment))
    throw new AppError(403, 'Akses aplikasi atau equipment belum diberikan.');
  return identity;
}
export async function proxyAuthManagement(request: Request, path: string) {
  if (request.method !== 'GET') verifyOrigin(request);
  const identity = await apiIdentity(request);
  if (path.startsWith('admin/') && !identity.portalAdmin)
    throw new AppError(403, 'Akses admin portal diperlukan.');
  const requestHeaders = new Headers({
    cookie: request.headers.get('cookie') || '',
    origin: process.env.PUBLIC_ORIGIN!,
    'content-type': 'application/json',
  });
  const response = await fetch(`${process.env.AUTH_INTERNAL_URL}/auth/manage/${path}`, {
    method: request.method,
    headers: requestHeaders,
    body: request.method === 'GET' ? undefined : JSON.stringify(await readJson(request)),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
