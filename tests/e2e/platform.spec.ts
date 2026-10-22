import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getAuthDb, authSchema, resetPassword, closeAuthDb } from '@plant/auth-core';
import { type Identity } from '@plant/contracts';
const origin = process.env.PUBLIC_ORIGIN!,
  temporary = process.env.BOOTSTRAP_PASSWORD!,
  password = 'Browser-pilot-password-2026';
const path = '/bag-filter/equipment/561-bf1';
const post = (request: APIRequestContext, url: string, data: unknown, headers: Record<string, string> = {}) =>
  request.post(url, { data, headers: { origin, ...headers } });
test.beforeAll(async () => {
  const [admin] = await getAuthDb()
    .select()
    .from(authSchema.user)
    .where(eq(authSchema.user.email, process.env.BOOTSTRAP_EMAIL!));
  if (!admin) throw Error('Run bootstrap before browser tests.');
  await resetPassword({ ...admin, mustChangePassword: false, grants: [] } as Identity, admin.id, temporary);
  await closeAuthDb();
});
test('SSO, first password change, gateway isolation, map, batch, mobile, permissions and logout', async ({
  page,
  browser,
  request,
}) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (e) => browserErrors.push(e.message));
  const unauth = await request.get(`${path}?tab=history&search=bag`, { maxRedirects: 0 });
  expect(unauth.status()).toBe(303);
  expect(unauth.headers().location).toContain(
    'returnTo=%2Fbag-filter%2Fequipment%2F561-bf1%3Ftab%3Dhistory%26search%3Dbag',
  );
  for (const internal of [
    '/auth/internal/session',
    '/auth/internal/verify',
    '/_verify_bag',
    '/auth/%69nternal/session',
  ])
    expect((await request.get(internal)).status()).toBe(404);
  const api = await request.get('/bag-filter/api/equipment', {
    headers: { 'x-user-role': 'admin', 'x-user-id': 'forged', 'x-plant-service-token': 'forged' },
  });
  expect(api.status()).toBe(401);
  expect(api.headers()['content-type']).toContain('application/json');
  expect(
    (
      await post(request, '/auth/api/sign-up/email', {
        email: 'public@example.test',
        password: 'cannot-create-this',
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post('/auth/api/sign-in/email', {
        data: { email: process.env.BOOTSTRAP_EMAIL, password: temporary },
        headers: { origin: 'https://evil.test' },
      })
    ).status(),
  ).toBe(403);
  await page.goto('/');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
  await page.getByLabel('Email', { exact: true }).fill(process.env.BOOTSTRAP_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(temporary);
  await page.getByRole('button', { name: /Masuk/ }).click();
  await expect(page).toHaveURL(/\/auth\/change-password/);
  await page.getByLabel('Password sementara', { exact: true }).fill(temporary);
  await page.locator('input[name="newPassword"]').fill(password);
  await page.getByLabel('Ulangi password baru').fill(password);
  await page.getByRole('button', { name: 'Ganti password', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByLabel('Email', { exact: true }).fill(process.env.BOOTSTRAP_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Masuk/ }).click();
  await expect(page.getByRole('heading', { name: /Selamat datang/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/portal-desktop.png', fullPage: true });
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name.includes('session_token'));
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
  await page.goto('/bag-filter/equipment/421-bf1');
  await expect(page.getByRole('heading', { name: '421-BF1', exact: true })).toBeVisible();
  await expect(page.getByText('Belum ada pemasangan atau penggantian.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/');
  await page
    .locator('.app-card')
    .filter({ has: page.getByRole('heading', { name: 'Bag Filter', exact: true }) })
    .click();
  await expect(page).toHaveURL(/\/bag-filter$/);
  await page.route(
    '**/bag-filter/api/equipment/561-BF1/batches?*',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulasi layanan sibuk' }),
      }),
    { times: 1 },
  );
  await page.goto(path);
  await expect(page.getByRole('heading', { name: '561-BF1', exact: true })).toBeVisible();
  await expect(page.getByText('Simulasi layanan sibuk')).toBeVisible();
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByText('Simulasi layanan sibuk')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: 'Detail kompartemen 1', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page
    .getByRole('group', { name: 'Detail kompartemen 1', exact: true })
    .getByRole('button', { name: /Kolom H, baris 17:/ })
    .click();
  await page.getByLabel(/^Sisi/).selectOption('Selatan');
  await page
    .getByRole('group', { name: 'Detail kompartemen 24', exact: true })
    .getByRole('button', { name: /Kolom A, baris 1:/ })
    .click();
  const reason = `Browser batch ${randomUUID()}`;
  await page.getByLabel('Alasan penggantian / pemasangan awal').fill(reason);
  await page.getByLabel('Tanggal & jam pemasangan (WIB)').fill('2026-09-01T08:00');
  await page.getByRole('button', { name: 'Simpan 2 bag', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('2 posisi tersimpan');
  await page.getByLabel('Cari WO, alasan, tanggal, atau koordinat').fill(reason);
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('.history-item')).toContainText('Tanpa WO');
  await expect(page.locator('.history-item')).toContainText('2 bag');
  await page.screenshot({ path: 'test-results/bag-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('group', { name: 'Detail kompartemen 24', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#bag-detail').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/bag-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Pengguna & hak akses' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nonaktifkan Bag Filter' })).toBeVisible();
  const adminRequest = page.request;
  const email = `browser-${randomUUID()}@example.test`;
  let result = await post(adminRequest, '/api/admin/users', {
    email,
    name: 'Browser Viewer',
    password: temporary,
    position: 'Technician',
  });
  expect(result.status()).toBe(201);
  const { id } = await result.json();
  expect(
    (
      await post(adminRequest, `/api/admin/users/${id}/grant`, {
        grant: { appId: 'bag-filter', role: 'viewer', equipment: ['561-BF1'] },
      })
    ).ok(),
  ).toBe(true);
  const viewer = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  expect((await post(viewer.request, '/auth/api/sign-in/email', { email, password: temporary })).ok()).toBe(
    true,
  );
  expect(
    (
      await post(viewer.request, '/auth/manage/password', {
        currentPassword: temporary,
        newPassword: password,
      })
    ).ok(),
  ).toBe(true);
  expect((await post(viewer.request, '/auth/api/sign-in/email', { email, password })).ok()).toBe(true);
  const payload = {
    equipmentCode: '561-BF1',
    positions: [{ side: 'Utara', compartment: 1, column: 1, row: 1 }],
    installedAt: '2026-06-01T00:00:00Z',
    reason: 'Permission test',
  };
  expect(
    (
      await post(viewer.request, '/bag-filter/api/equipment/561-BF1/batches', payload, {
        'Idempotency-Key': randomUUID(),
      })
    ).status(),
  ).toBe(403);
  expect((await viewer.request.get('/bag-filter/api/equipment/562-BF1/state')).status()).toBe(403);
  expect((await viewer.request.get('/api/admin/users')).status()).toBe(403);
  await post(adminRequest, `/api/admin/users/${id}/grant`, {
    grant: { appId: 'bag-filter', role: 'operator', equipment: ['561-BF1'] },
  });
  expect(
    (
      await post(
        viewer.request,
        '/bag-filter/api/equipment/562-BF1/batches',
        { ...payload, equipmentCode: '562-BF1' },
        { 'Idempotency-Key': randomUUID() },
      )
    ).status(),
  ).toBe(403);
  const retryKey = randomUUID();
  const first = await post(viewer.request, '/bag-filter/api/equipment/561-BF1/batches', payload, {
    'Idempotency-Key': retryKey,
  });
  expect(first.status()).toBe(201);
  const saved = await first.json();
  const repeated = await post(viewer.request, '/bag-filter/api/equipment/561-BF1/batches', payload, {
    'Idempotency-Key': retryKey,
  });
  expect((await repeated.json()).batchId).toBe(saved.batchId);
  expect((await post(adminRequest, '/api/admin/applications/bag-filter', { status: 'disabled' })).ok()).toBe(
    true,
  );
  expect((await viewer.request.get('/bag-filter/api/equipment')).status()).toBe(403);
  await post(adminRequest, '/api/admin/applications/bag-filter', { status: 'active' });
  await post(adminRequest, `/api/admin/users/${id}/access`, { active: false, portalAdmin: false });
  expect((await viewer.request.get('/bag-filter/api/equipment')).status()).toBe(401);
  await viewer.close();
  expect((await post(adminRequest, '/auth/api/sign-out', {})).ok()).toBe(true);
  expect((await adminRequest.get('/bag-filter/api/equipment')).status()).toBe(401);
  expect((await adminRequest.get('/api/admin/users')).status()).toBe(401);
  expect(browserErrors).toEqual([]);
});
