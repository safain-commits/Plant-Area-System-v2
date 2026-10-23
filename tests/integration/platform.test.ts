import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { eq, sql } from 'drizzle-orm';
import {
  createReplacement,
  snapshot,
  batchHistory,
  positionHistory,
  auditHistory,
  getBagDb,
  closeBagDb,
  bagSchema,
  dashboard,
  activity,
} from '@plant/bag-core';
import {
  getAuthDb,
  closeAuthDb,
  authSchema,
  createUser,
  setGrant,
  changePassword,
  resetPassword,
  updateUserAccess,
  identityForCookie,
  login,
  getAuth,
} from '@plant/auth-core';
import { AppError, equipmentCodes, type Identity, type Position } from '@plant/contracts';
if (process.env.TEST_DATABASE !== '1' || !process.env.BAG_DATABASE_URL?.includes('127.0.0.1:13306'))
  throw Error('Integration tests require the isolated test database on localhost:13306.');
const actor: Identity = {
  id: randomUUID(),
  name: 'Integration Admin',
  email: `integration-${randomUUID()}@example.test`,
  position: 'Engineer',
  portalAdmin: true,
  mustChangePassword: false,
  grants: [{ appId: 'bag-filter', role: 'admin', equipment: [...equipmentCodes] }],
};
const pos: Position = { side: 'Utara', compartment: 1, column: 1, row: 17 };
const body = (
  positions: Position[] = [pos],
  installedAt = '2026-01-01T00:00:00Z',
  reason = 'Integration replacement',
) => ({ equipmentCode: '561-BF1', positions, installedAt, reason, wo: '', brand: 'Filtras' });
const key = () => randomUUID();

test('dashboard and activity use current installations and exact equipment scope', async () => {
  const now = Date.now(),
    reason = `Dashboard ${randomUUID()}`;
  await createReplacement(
    actor,
    {
      equipmentCode: 'L61-BF1',
      positions: [
        { side: 'Timur', compartment: 8, column: 7, row: 2 },
        { side: 'Barat', compartment: 8, column: 6, row: 2 },
      ],
      installedAt: new Date(now).toISOString(),
      brand: 'Filtras',
      reason,
      wo: '',
    },
    key(),
  );
  await createReplacement(
    actor,
    {
      equipmentCode: 'L61-BF1',
      positions: [{ side: 'Timur', compartment: 8, column: 5, row: 2 }],
      installedAt: new Date(now - 901 * 86400000).toISOString(),
      brand: 'Other',
      reason,
      wo: '',
    },
    key(),
  );
  const year = new Date(now + 7 * 3600000).getUTCFullYear();
  const data = await dashboard(['L61-BF1'], year, now);
  assert.equal(data.total, 2048);
  assert.deepEqual(
    data.perEquipment.map((e) => e.code),
    ['L61-BF1'],
  );
  const state = await snapshot('L61-BF1');
  assert.equal(data.installed, state.recorded);
  assert.equal(data.neverInstalled, 2048 - state.recorded);
  assert.equal(
    data.distribution.reduce((s, n) => s + n, 0),
    state.recorded,
  );
  assert.ok(data.older900 >= 1);
  assert.ok(data.series[Math.floor(new Date(now + 7 * 3600000).getUTCMonth() / 3)].total >= 2);
  assert.deepEqual(
    data.series.map((q) => q.label),
    ['Q1', 'Q2', 'Q3', 'Q4'],
  );
  const events = await activity(['L61-BF1'], reason);
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.equipmentCode === 'L61-BF1'));
  assert.ok(!(await activity(['L62-BF1'], reason)).length);
  assert.deepEqual((await dashboard([], year, now)).perEquipment, []);
  await assert.rejects(dashboard(['L61-BF1'], 1999));
  await assert.rejects(activity([], 'x'.repeat(201)));
  const boundary = Date.parse('2025-12-31T16:59:45Z');
  const beforeMidnight = await dashboard(['L62-BF1'], 2025, boundary);
  const beforeNextDay = await dashboard(['L62-BF1'], 2026, boundary + 60000);
  await createReplacement(
    actor,
    {
      equipmentCode: 'L62-BF1',
      positions: [{ side: 'Barat', compartment: 8, column: 8, row: 16 }],
      installedAt: '2025-12-31T17:00:15Z',
      brand: 'Cipta Medya',
      reason: `WIB boundary ${randomUUID()}`,
      wo: '',
    },
    key(),
  );
  const nearMidnight = await dashboard(['L62-BF1'], 2025, boundary);
  assert.equal(nearMidnight.previousTotal, beforeMidnight.previousTotal);
  assert.equal(nearMidnight.periodTotal, beforeMidnight.periodTotal);
  assert.equal(
    (await dashboard(['L62-BF1'], 2026, boundary + 60000)).periodTotal,
    beforeNextDay.periodTotal + 1,
  );
  await assert.rejects(dashboard([], year + 1, now));
  await assert.rejects(dashboard([], 2024.5, now));
  const beforeQuarters = await dashboard(['L62-BF1'], 2024, now);
  const before2025 = await dashboard(['L62-BF1'], 2025, now);
  for (const installedAt of [
    '2024-03-31T16:59:59Z',
    '2024-03-31T17:00:00Z',
    '2024-06-30T16:59:59Z',
    '2024-06-30T17:00:00Z',
    '2024-09-30T16:59:59Z',
    '2024-09-30T17:00:00Z',
    '2024-12-31T16:59:59Z',
    '2024-12-31T17:00:00Z',
  ])
    await createReplacement(
      actor,
      {
        equipmentCode: 'L62-BF1',
        positions: [{ side: 'Timur', compartment: 8, column: 8, row: 16 }],
        installedAt,
        brand: 'Filtras',
        reason: `Quarter boundary ${randomUUID()}`,
        wo: '',
      },
      key(),
    );
  const quarters = await dashboard(['L62-BF1'], 2024, now);
  assert.deepEqual(
    quarters.series.map((q, i) => q.total - beforeQuarters.series[i].total),
    [1, 2, 2, 2],
  );
  assert.deepEqual(
    quarters.series.map((q, i) => (q.brands.Filtras || 0) - (beforeQuarters.series[i].brands.Filtras || 0)),
    [1, 2, 2, 2],
  );
  const nextYear = await dashboard(['L62-BF1'], 2025, now);
  assert.equal(nextYear.series[0].total, before2025.series[0].total + 1);
  assert.equal(nextYear.previousTotal, before2025.previousTotal + 7);
});
after(async () => {
  await closeAuthDb();
  await closeBagDb();
});
test('MySQL transaction, history, retries, pagination and authentication', async (t) => {
  await t.test('seed has 18,784 coordinates and no dependence on inventory', async () => {
    const [rows] = await getBagDb().execute(
      sql`SELECT equipment_code,COUNT(*) AS total FROM coordinates GROUP BY equipment_code ORDER BY equipment_code`,
    );
    assert.deepEqual(
      (rows as unknown as { total: number }[]).map((r) => Number(r.total)),
      [4080, 4080, 3264, 3264, 2048, 2048],
    );
  });
  await t.test('500 positions commit with one audit and replay is safe under concurrency', async () => {
    const positions: Position[] = [];
    for (let c = 1; c <= 4; c++)
      for (let column = 1; column <= 8; column++)
        for (let row = 1; row <= 17; row++) positions.push({ ...pos, compartment: c, column, row });
    const payload = body(positions.slice(0, 500)),
      idempotency = key();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createReplacement(actor, payload, idempotency)),
    );
    assert.equal(new Set(results.map((r) => r.batchId)).size, 1);
    assert.equal(results.filter((r) => !r.replayed).length, 1);
    const rows = await getBagDb()
      .select()
      .from(bagSchema.installations)
      .where(eq(bagSchema.installations.batchId, results[0].batchId));
    assert.equal(rows.length, 500);
    const audit = await getBagDb()
      .select()
      .from(bagSchema.bagAudit)
      .where(eq(bagSchema.bagAudit.batchId, results[0].batchId));
    assert.equal(audit.length, 1);
    await assert.rejects(
      createReplacement(actor, { ...payload, reason: 'Changed' }, idempotency),
      (e: unknown) => e instanceof AppError && e.status === 409,
    );
    for (const input of [
      body(positions.slice(0, 501)),
      body([pos, pos]),
      body([{ ...pos, compartment: 13 }]),
    ])
      await assert.rejects(
        createReplacement(actor, input, key()),
        (e: unknown) => e instanceof AppError && e.status === 400,
      );
  });
  await t.test(
    'backdates and equal-time records retain deterministic current state and timeline',
    async () => {
      const p = { ...pos, compartment: 12 };
      const latest = await createReplacement(actor, body([p], '2026-06-01T00:00:00Z'), key());
      await createReplacement(actor, body([p], '2026-02-01T00:00:00Z'), key());
      let state = await snapshot('561-BF1');
      assert.equal(state.positions.find((r) => r.compartment === 12)?.batchId, latest.batchId);
      const same = await createReplacement(actor, body([p], '2026-06-01T00:00:00Z'), key());
      state = await snapshot('561-BF1');
      assert.equal(state.positions.find((r) => r.compartment === 12)?.batchId, same.batchId);
      const timeline = await positionHistory('561-BF1', p);
      assert.equal(timeline.items[0].endedAt, null);
      assert.equal(timeline.items[1].endedAt, '2026-06-01T00:00:00.000Z');
      assert.equal(timeline.items[2].endedAt, '2026-06-01T00:00:00.000Z');
    },
  );
  await t.test('audit failure rolls back batch and installation rows', async () => {
    const root = await mysql.createConnection(process.env.BAG_MIGRATION_DATABASE_URL!);
    const marker = key();
    try {
      await root.query(
        "CREATE TRIGGER test_audit_failure BEFORE INSERT ON bag_audit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected test failure'",
      );
      await assert.rejects(createReplacement(actor, body(), marker));
      const [rows] = await root.query<mysql.RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM replacement_batches WHERE idempotency_key=?',
        [marker],
      );
      assert.equal(rows[0].total, 0);
      const [orphans] = await root.query<mysql.RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM installations i LEFT JOIN replacement_batches b ON b.id=i.batch_id WHERE b.id IS NULL',
      );
      assert.equal(orphans[0].total, 0);
    } finally {
      await root.query('DROP TRIGGER IF EXISTS test_audit_failure');
      await root.end();
    }
  });
  await t.test('empty-WO batches stay grouped and 50-record seek pagination has no gaps', async () => {
    const search = `pagination-${key()}`;
    await Promise.all(
      Array.from({ length: 55 }, () =>
        createReplacement(actor, body([{ ...pos, compartment: 11 }], '2026-03-02T00:00:00Z', search), key()),
      ),
    );
    const first = await batchHistory('561-BF1', search),
      second = await batchHistory('561-BF1', search, first.nextCursor);
    assert.equal(first.items.length, 50);
    assert.equal(second.items.length, 5);
    assert.equal(new Set([...first.items, ...second.items].map((b) => b.id)).size, 55);
    assert.ok(first.items.every((b) => b.wo === '' && b.positions.length === 1));
    const coordinate = await batchHistory('561-BF1', '11 H17');
    assert.equal(coordinate.items.length, 50);
    const timeline = await positionHistory('561-BF1', { ...pos, compartment: 11 });
    assert.equal(timeline.items.length, 50);
    assert.ok(timeline.nextCursor);
    const state = await snapshot('561-BF1');
    assert.equal(
      state.positions.find(
        (p) => p.compartment === 11 && p.side === pos.side && p.column === pos.column && p.row === pos.row,
      )?.id,
      timeline.items[0].id,
    );
    const audits = await auditHistory(['561-BF1']);
    assert.equal(audits.items.length, 50);
    assert.ok(audits.nextCursor);
  });
  const email = `operator-${key()}@example.test`,
    temporary = 'Temporary-Password-123',
    password = 'Permanent-Password-456';
  let userId = '',
    cookie = '';
  async function signIn(pass: string, ip = '127.0.0.10') {
    return login(
      new Request(`${process.env.PUBLIC_ORIGIN}/auth/api/sign-in/email`, {
        method: 'POST',
        headers: { origin: process.env.PUBLIC_ORIGIN!, 'x-real-ip': ip, 'content-type': 'application/json' },
      }),
      { email, password: pass },
    );
  }
  await t.test('temporary account must change password and old sessions are revoked', async () => {
    userId = (
      await createUser(actor, {
        email,
        name: 'Integration Operator',
        position: 'Technician',
        password: temporary,
      })
    ).id;
    await setGrant(actor, userId, { appId: 'bag-filter', role: 'operator', equipment: ['561-BF1'] });
    const response = await signIn(temporary);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.clone().json(), { ok: true });
    const raw = response.headers.getSetCookie();
    assert.ok(
      raw.some(
        (v) =>
          v.includes('HttpOnly') &&
          v.includes('Secure') &&
          v.includes('SameSite=Lax') &&
          v.includes('Path=/') &&
          !v.includes('Domain='),
      ),
    );
    cookie = raw.map((v) => v.split(';')[0]).join('; ');
    await assert.rejects(
      identityForCookie(cookie),
      (e: unknown) => e instanceof AppError && e.code === 'PASSWORD_CHANGE_REQUIRED',
    );
    const identity = await identityForCookie(cookie, true);
    await changePassword(identity, temporary, password);
    await assert.rejects(identityForCookie(cookie));
    const next = await signIn(password);
    assert.equal(next.status, 200);
    cookie = next.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const current = await identityForCookie(cookie);
    assert.equal(current.mustChangePassword, false);
    assert.deepEqual(current.grants[0].equipment, ['561-BF1']);
  });
  await t.test('8-hour absolute session, grant updates, expiry, disable, reset and logout', async () => {
    const [session] = await getAuthDb()
      .select()
      .from(authSchema.session)
      .where(eq(authSchema.session.userId, userId));
    assert.equal(session.expiresAt.getTime() - session.createdAt.getTime(), 8 * 3600000);
    await setGrant(actor, userId, { appId: 'bag-filter', role: 'viewer', equipment: ['562-BF1'] });
    assert.equal((await identityForCookie(cookie)).grants[0].role, 'viewer');
    const [unchanged] = await getAuthDb()
      .select()
      .from(authSchema.session)
      .where(eq(authSchema.session.id, session.id));
    assert.equal(unchanged.expiresAt.getTime(), session.expiresAt.getTime());
    await getAuthDb()
      .update(authSchema.session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authSchema.session.id, session.id));
    await assert.rejects(identityForCookie(cookie));
    let res = await signIn(password);
    cookie = res.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    await updateUserAccess(actor, userId, { active: false, portalAdmin: false });
    await assert.rejects(identityForCookie(cookie));
    assert.equal((await signIn(password)).status, 401);
    await updateUserAccess(actor, userId, { active: true, portalAdmin: false });
    res = await signIn(password);
    cookie = res.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const logout = await getAuth().handler(
      new Request(`${process.env.PUBLIC_ORIGIN}/auth/api/sign-out`, {
        method: 'POST',
        headers: { cookie, origin: process.env.PUBLIC_ORIGIN! },
      }),
    );
    assert.equal(logout.status, 200);
    await assert.rejects(identityForCookie(cookie));
    res = await signIn(password);
    cookie = res.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    await resetPassword(actor, userId, temporary);
    await assert.rejects(identityForCookie(cookie));
  });
  await t.test('database limiter rejects the eleventh failure per account/IP', async () => {
    for (let i = 0; i < 10; i++) assert.equal((await signIn('Wrong-password-000', '127.0.0.99')).status, 401);
    const blocked = await signIn(temporary, '127.0.0.99');
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get('retry-after'));
    assert.equal((await signIn(temporary, '127.0.0.100')).status, 200);
  });
  await t.test('a concurrent password reset cannot leave an old-password session usable', async () => {
    const [response] = await Promise.all([
      signIn(temporary, '127.0.0.101'),
      resetPassword(actor, userId, 'Reset-race-password-789'),
    ]);
    if (response.ok) {
      const oldCookie = response.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; ');
      await assert.rejects(identityForCookie(oldCookie, true));
    }
    assert.equal((await signIn('Reset-race-password-789', '127.0.0.102')).status, 200);
  });
  await t.test(
    'parallel logins exceeding the management pool do not exhaust nested transactions',
    { timeout: 20000 },
    async () => {
      const responses = await Promise.all(
        Array.from({ length: 12 }, (_, i) => signIn('Reset-race-password-789', `127.0.1.${i + 1}`)),
      );
      assert.ok(responses.every((r) => r.status === 200));
    },
  );
});
