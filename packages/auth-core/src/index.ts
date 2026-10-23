import { randomUUID, createHash } from 'node:crypto';
import { and, eq, sql, desc } from 'drizzle-orm';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import {
  AppError,
  equipmentCodes,
  bagRoles,
  type Identity,
  type Grant,
  type BagRole,
  type BagGrant,
  consumablesRoles,
} from '@plant/contracts';
import { getAuth, publicOrigin } from './auth';
import { getAuthDb } from './database';
import { user, session, account, grants, applications, audit, loginAttempts } from './schema';
export { getAuth, publicOrigin } from './auth';
export { getAuthDb, closeAuthDb } from './database';
export * as authSchema from './schema';

function stringField(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new AppError(400, `${label} harus ${min}–${max} karakter.`);
  return value.trim();
}
function passwordField(value: unknown) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new AppError(400, 'Password harus 12–128 karakter.');
  return value;
}
const auditEntry = (
  actor: Pick<Identity, 'id' | 'name'>,
  action: string,
  targetId: string,
  details: unknown = {},
) => ({
  id: randomUUID(),
  actorId: actor.id,
  actorName: actor.name,
  action,
  targetId,
  details: JSON.stringify(details),
  createdAt: new Date(),
});
function decodeGrant(g: {
  appId: string;
  role: string;
  equipment: string;
  scope?: string | null;
}): Grant | null {
  try {
    if (g.appId === 'bag-filter' && bagRoles.includes(g.role as BagRole)) {
      const equipment = JSON.parse(g.equipment);
      if (
        !Array.isArray(equipment) ||
        !equipment.length ||
        equipment.some((c) => !equipmentCodes.includes(c)) ||
        new Set(equipment).size !== equipment.length
      )
        return null;
      return { appId: 'bag-filter', role: g.role as BagRole, equipment };
    }
    if (g.appId === 'consumables' && consumablesRoles.includes(g.role as (typeof consumablesRoles)[number])) {
      const scope = JSON.parse(g.scope || 'null');
      if (
        !scope ||
        !Array.isArray(scope.locationIds) ||
        scope.locationIds.some((id: unknown) => typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) ||
        new Set(scope.locationIds).size !== scope.locationIds.length ||
        (g.role !== 'admin' && !scope.locationIds.length)
      )
        return null;
      return {
        appId: 'consumables',
        role: g.role as (typeof consumablesRoles)[number],
        locationIds: scope.locationIds,
      };
    }
  } catch {}
  return null;
}
export async function listScopeLocations(actor: Identity) {
  requireAdmin(actor);
  const base = process.env.CONSUMABLES_INTERNAL_URL,
    token = process.env.SERVICE_TOKEN;
  if (!base || !token) throw new AppError(503, 'Layanan lokasi belum dikonfigurasi.');
  try {
    const response = await fetch(`${base}/consumables/internal/locations`, {
      headers: { 'x-plant-service-token': token },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error();
    const data = await response.json();
    if (!Array.isArray(data.items)) throw Error();
    return data.items as { id: string; name: string; active: boolean }[];
  } catch {
    throw new AppError(503, 'Lokasi belum dapat diverifikasi; akses tidak diubah.');
  }
}
export async function setAppGrant(actor: Identity, id: string, appId: string, input: unknown) {
  requireAdmin(actor);
  if (appId === 'bag-filter') {
    await setGrant(actor, id, input);
    return;
  }
  if (appId !== 'consumables') throw new AppError(400, 'Aplikasi tidak dikenal.');
  let grant: Extract<Grant, { appId: 'consumables' }> | null = null;
  if (input !== null) {
    if (!input || typeof input !== 'object') throw new AppError(400, 'Grant tidak valid.');
    const g = input as Extract<Grant, { appId: 'consumables' }>;
    if (
      g.appId !== appId ||
      !consumablesRoles.includes(g.role) ||
      !Array.isArray(g.locationIds) ||
      g.locationIds.some((v) => typeof v !== 'string') ||
      new Set(g.locationIds).size !== g.locationIds.length ||
      (g.role !== 'admin' && !g.locationIds.length) ||
      (g.role === 'admin' && g.locationIds.length)
    )
      throw new AppError(400, 'Role atau cakupan lokasi tidak valid.');
    if (g.role !== 'admin') {
      const known = await listScopeLocations(actor);
      if (g.locationIds.some((v) => !known.some((l) => l.id === v && l.active)))
        throw new AppError(400, 'Lokasi tidak aktif atau tidak ditemukan.');
    }
    grant = { appId: 'consumables', role: g.role, locationIds: [...g.locationIds].sort() };
  }
  await getAuthDb().transaction(async (tx) => {
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for('update');
    if (!target) throw new AppError(404, 'Pengguna tidak ditemukan.');
    await tx.delete(grants).where(and(eq(grants.userId, id), eq(grants.appId, appId)));
    if (grant)
      await tx
        .insert(grants)
        .values({
          userId: id,
          appId,
          role: grant.role,
          equipment: '[]',
          scope: JSON.stringify({ locationIds: grant.locationIds }),
        });
    await tx.insert(audit).values(auditEntry(actor, 'grant.updated', id, { appId, grant }));
  });
}
export async function identityForCookie(cookie: string, allowPasswordChange = false): Promise<Identity> {
  const current = await getAuth().api.getSession({
    headers: new Headers({ cookie }),
    query: { disableCookieCache: true },
  });
  if (!current) throw new AppError(401, 'Silakan login.', 'UNAUTHENTICATED');
  const db = getAuthDb();
  const [u] = await db.select().from(user).where(eq(user.id, current.user.id));
  if (!u?.active) throw new AppError(401, 'Akun tidak aktif.', 'UNAUTHENTICATED');
  if (u.mustChangePassword && !allowPasswordChange)
    throw new AppError(403, 'Ganti password sementara terlebih dahulu.', 'PASSWORD_CHANGE_REQUIRED');
  const list = await db
    .select({ appId: grants.appId, role: grants.role, equipment: grants.equipment, scope: grants.scope })
    .from(grants)
    .innerJoin(applications, eq(grants.appId, applications.id))
    .where(and(eq(grants.userId, u.id), eq(applications.status, 'active')));
  return {
    id: u.id,
    sessionExpiresAt: new Date(current.session.expiresAt).toISOString(),
    name: u.name,
    email: u.email,
    position: u.position,
    portalAdmin: u.portalAdmin,
    mustChangePassword: u.mustChangePassword,
    grants: list.map(decodeGrant).filter((g): g is Grant => g !== null),
  };
}
export function requireAdmin(actor: Identity) {
  if (!actor.portalAdmin || actor.mustChangePassword)
    throw new AppError(403, 'Akses admin portal diperlukan.');
}
export async function listApplications(actor: Identity) {
  requireAdmin(actor);
  return getAuthDb().select().from(applications).orderBy(applications.name);
}
export async function setApplicationStatus(actor: Identity, id: string, status: unknown) {
  requireAdmin(actor);
  if (!['bag-filter', 'consumables'].includes(id) || (status !== 'active' && status !== 'disabled'))
    throw new AppError(400, 'Hanya aplikasi yang telah dirilis dapat diaktifkan atau dinonaktifkan.');
  await getAuthDb().transaction(async (tx) => {
    await tx.update(applications).set({ status }).where(eq(applications.id, id));
    await tx.insert(audit).values(auditEntry(actor, 'application.status_updated', id, { status }));
  });
}
export async function listUsers(actor: Identity) {
  requireAdmin(actor);
  const db = getAuthDb();
  const users = await db.select().from(user).orderBy(user.name);
  const allGrants = await db.select().from(grants);
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    position: u.position,
    active: u.active,
    portalAdmin: u.portalAdmin,
    mustChangePassword: u.mustChangePassword,
    grants: allGrants
      .filter((g) => g.userId === u.id)
      .map(decodeGrant)
      .filter((g): g is Grant => g !== null),
  }));
}
export async function createUser(actor: Identity, input: Record<string, unknown>) {
  requireAdmin(actor);
  const email = stringField(input.email, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'Email tidak valid.');
  const name = stringField(input.name, 'Nama', 2, 100),
    password = passwordField(input.password);
  const position = stringField(input.position ?? '', 'Jabatan', 0, 100);
  const hash = await hashPassword(password),
    id = randomUUID(),
    now = new Date();
  try {
    await getAuthDb().transaction(async (tx) => {
      await tx.insert(user).values({
        id,
        email,
        name,
        position,
        emailVerified: true,
        active: true,
        portalAdmin: false,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: hash,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(audit).values(auditEntry(actor, 'user.created', id, { email }));
    });
  } catch (e) {
    if (mysqlCode(e) === 'ER_DUP_ENTRY') throw new AppError(409, 'Email sudah terdaftar.');
    throw e;
  }
  return { id };
}
export async function updateUserAccess(actor: Identity, id: string, input: Record<string, unknown>) {
  requireAdmin(actor);
  if (typeof input.active !== 'boolean' || typeof input.portalAdmin !== 'boolean')
    throw new AppError(400, 'Status akun tidak valid.');
  const active = input.active,
    portalAdmin = input.portalAdmin;
  await getAuthDb().transaction(async (tx) => {
    // Serialize administrator demotion/deactivation to preserve one working administrator.
    const admins = await tx
      .select()
      .from(user)
      .where(and(eq(user.portalAdmin, true), eq(user.active, true)))
      .for('update');
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for('update');
    if (!target) throw new AppError(404, 'Pengguna tidak ditemukan.');
    if (target.portalAdmin && target.active && (!active || !portalAdmin) && admins.length <= 1)
      throw new AppError(409, 'Admin portal aktif terakhir tidak dapat dinonaktifkan.');
    await tx.update(user).set({ active, portalAdmin, updatedAt: new Date() }).where(eq(user.id, id));
    if (!active || target.portalAdmin !== portalAdmin) await tx.delete(session).where(eq(session.userId, id));
    await tx.insert(audit).values(auditEntry(actor, 'user.access_updated', id, { active, portalAdmin }));
  });
}
export async function setGrant(actor: Identity, id: string, input: unknown) {
  requireAdmin(actor);
  let grant: BagGrant | null = null;
  if (input !== null) {
    if (!input || typeof input !== 'object') throw new AppError(400, 'Grant tidak valid.');
    const g = input as BagGrant;
    if (
      g.appId !== 'bag-filter' ||
      !bagRoles.includes(g.role) ||
      !Array.isArray(g.equipment) ||
      !g.equipment.length ||
      g.equipment.some((c) => !equipmentCodes.includes(c)) ||
      new Set(g.equipment).size !== g.equipment.length
    )
      throw new AppError(400, 'Role atau cakupan equipment tidak valid.');
    grant = { appId: g.appId, role: g.role, equipment: [...g.equipment].sort() };
  }
  await getAuthDb().transaction(async (tx) => {
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for('update');
    if (!target) throw new AppError(404, 'Pengguna tidak ditemukan.');
    await tx.delete(grants).where(and(eq(grants.userId, id), eq(grants.appId, 'bag-filter')));
    if (grant)
      await tx.insert(grants).values({
        userId: id,
        appId: grant.appId,
        role: grant.role,
        equipment: JSON.stringify(grant.equipment),
      });
    await tx.insert(audit).values(auditEntry(actor, 'grant.updated', id, { grant }));
  });
}
export async function resetPassword(actor: Identity, id: string, password: unknown) {
  requireAdmin(actor);
  const hash = await hashPassword(passwordField(password));
  await getAuthDb().transaction(async (tx) => {
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for('update');
    if (!target) throw new AppError(404, 'Pengguna tidak ditemukan.');
    await tx
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(account.userId, id), eq(account.providerId, 'credential')));
    await tx.update(user).set({ mustChangePassword: true, updatedAt: new Date() }).where(eq(user.id, id));
    await tx.delete(session).where(eq(session.userId, id));
    await tx.insert(audit).values(auditEntry(actor, 'user.password_reset', id));
  });
}
export async function changePassword(actor: Identity, current: unknown, replacement: unknown) {
  const next = passwordField(replacement);
  if (typeof current !== 'string' || current.length > 128 || current === next)
    throw new AppError(400, 'Password baru harus berbeda dari password saat ini.');
  const hash = await hashPassword(next);
  await getAuthDb().transaction(async (tx) => {
    await tx.select().from(user).where(eq(user.id, actor.id)).for('update');
    const [credential] = await tx
      .select()
      .from(account)
      .where(and(eq(account.userId, actor.id), eq(account.providerId, 'credential')))
      .for('update');
    if (!credential?.password || !(await verifyPassword({ hash: credential.password, password: current })))
      throw new AppError(400, 'Password saat ini tidak sesuai.');
    await tx
      .update(account)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(account.id, credential.id));
    await tx
      .update(user)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(user.id, actor.id));
    await tx.delete(session).where(eq(session.userId, actor.id));
    await tx.insert(audit).values(auditEntry(actor, 'user.password_changed', actor.id));
  });
}
export async function updateProfile(actor: Identity, input: Record<string, unknown>) {
  const name = stringField(input.name, 'Nama', 2, 100),
    position = stringField(input.position ?? '', 'Jabatan', 0, 100);
  await getAuthDb().transaction(async (tx) => {
    await tx.update(user).set({ name, position, updatedAt: new Date() }).where(eq(user.id, actor.id));
    await tx.insert(audit).values(auditEntry(actor, 'user.profile_updated', actor.id, { name, position }));
  });
}
export async function authAudit(actor: Identity, before?: string) {
  requireAdmin(actor);
  let boundary;
  if (before) {
    const d = new Date(before);
    if (!Number.isFinite(d.getTime())) throw new AppError(400, 'Cursor tidak valid.');
    boundary = sql`${audit.createdAt} < ${d}`;
  }
  return getAuthDb()
    .select()
    .from(audit)
    .where(boundary)
    .orderBy(desc(audit.createdAt), desc(audit.id))
    .limit(50);
}
export async function login(request: Request, body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || typeof body.password !== 'string' || body.password.length > 128)
    throw new AppError(400, 'Email atau password tidak valid.');
  const key = createHash('sha256')
    .update(`${email}\0${request.headers.get('x-real-ip') || 'unknown'}`)
    .digest('hex');
  const now = new Date(),
    resetAt = new Date(now.getTime() + 900_000),
    db = getAuthDb();
  await db
    .insert(loginAttempts)
    .values({ key, attempts: 0, resetAt })
    .onDuplicateKeyUpdate({ set: { key: sql`${loginAttempts.key}` } });
  return db.transaction(async (tx) => {
    const [limit] = await tx.select().from(loginAttempts).where(eq(loginAttempts.key, key)).for('update');
    const failures = limit.resetAt > now ? limit.attempts : 0;
    if (failures >= 10)
      return Response.json(
        { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt.getTime() - now.getTime()) / 1000))),
          },
        },
      );
    const [target] = await tx.select().from(user).where(eq(user.email, email));
    const [credential] = target
      ? await tx
          .select({ password: account.password })
          .from(account)
          .where(and(eq(account.userId, target.id), eq(account.providerId, 'credential')))
      : [];
    const headers = new Headers(request.headers);
    headers.set('content-type', 'application/json');
    headers.delete('content-length');
    const native = await getAuth().handler(
      new Request(`${publicOrigin()}/auth/api/sign-in/email`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password: body.password, rememberMe: true }),
      }),
    );
    // Better Auth owns a separate transaction. Do not hold a user lock across
    // its session insert. Fence a successful login afterwards against a reset
    // or deactivation that completed while the password was being verified.
    let accepted = native.ok && !!target?.active;
    if (native.ok && target) {
      const [current] = await tx.select().from(user).where(eq(user.id, target.id)).for('update');
      const [currentCredential] = await tx
        .select({ password: account.password })
        .from(account)
        .where(and(eq(account.userId, target.id), eq(account.providerId, 'credential')))
        .for('update');
      accepted =
        !!current?.active && !!credential?.password && credential.password === currentCredential?.password;
    }
    if (!accepted) {
      if (native.ok && target) await tx.delete(session).where(eq(session.userId, target.id));
      await tx
        .update(loginAttempts)
        .set({ attempts: failures + 1, resetAt: limit.resetAt > now ? limit.resetAt : resetAt })
        .where(eq(loginAttempts.key, key));
      return Response.json({ error: 'Email/password tidak sesuai atau akun tidak aktif.' }, { status: 401 });
    }
    await tx.delete(loginAttempts).where(eq(loginAttempts.key, key));
    await tx.insert(audit).values(auditEntry(target, 'session.login', target.id));
    // Keep Set-Cookie but never expose the native session token in JSON.
    const responseHeaders = new Headers(native.headers);
    responseHeaders.delete('content-length');
    return Response.json({ ok: true }, { headers: responseHeaders });
  });
}
export function mysqlCode(e: unknown): string | undefined {
  if (!e || typeof e !== 'object') return undefined;
  return (e as { code?: string }).code ?? mysqlCode((e as { cause?: unknown }).cause);
}
