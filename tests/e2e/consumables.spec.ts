import {
  test,
  expect,
  request as requests,
  type APIRequestContext,
  type Page,
  type Locator,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { getConsumablesDb, closeConsumablesDb } from '@plant/consumables-core';
import * as stockSchema from '@plant/consumables-core/schema';
import {
  createUser,
  updateUserAccess,
  setAppGrant,
  setGrant,
  changePassword,
  closeAuthDb,
  getAuthDb,
  authSchema,
} from '@plant/auth-core';
import type { Identity } from '@plant/contracts';
const suffix = randomUUID().slice(0, 8),
  email = `stock-browser-${suffix}@example.test`,
  password = 'Stock-browser-password-2026',
  temporary = 'Stock-temporary-password-2026';
const admin: Identity = {
  id: randomUUID(),
  name: 'Stock Browser',
  email,
  position: '',
  portalAdmin: true,
  mustChangePassword: false,
  grants: [],
};
let client: APIRequestContext,
  materialId: string,
  locationId: string,
  otherLocationId: string,
  userId: string;
const mmid = 'BROWSER-' + suffix,
  locationName = 'E2E Main ' + suffix;
const roleUsers: string[] = [];
async function post(c: APIRequestContext, path: string, data: unknown, key?: string) {
  return c.post(path, {
    data,
    headers: { origin: process.env.PUBLIC_ORIGIN!, ...(key ? { 'Idempotency-Key': key } : {}) },
  });
}
async function jsonPost(path: string, data: unknown, key?: string) {
  const r = await post(client, path, data, key);
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function choose(control: Locator, value: string) {
  const label = await control.evaluate(
    (el, v) =>
      Array.from(el.parentElement!.querySelector('select')!.options)
        .find((o) => o.value === v)
        ?.textContent?.trim(),
    value,
  );
  await control.click();
  await control.page().getByRole('option', { name: label!, exact: true }).click();
}
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Masuk/ }).click();
  await page.waitForURL((u) => u.pathname === '/');
}
test.beforeAll(async () => {
  userId = (await createUser(admin, { name: 'Stock Browser', email, password: temporary })).id;
  await updateUserAccess(admin, userId, { active: true, portalAdmin: true });
  await setAppGrant(admin, userId, 'consumables', { appId: 'consumables', role: 'admin', locationIds: [] });
  await setGrant(admin, userId, { appId: 'bag-filter', role: 'viewer', equipment: ['L61-BF1'] });
  await changePassword({ ...admin, id: userId }, temporary, password);
  await closeAuthDb();
  client = await requests.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
  expect((await post(client, '/auth/api/sign-in/email', { email, password })).ok()).toBeTruthy();
  materialId = (
    await jsonPost('/consumables/api/materials', {
      mmid,
      description: 'Browser synthetic material',
      commonName: 'Browser material',
      unit: 'EA',
      category: 'Synthetic',
      mrpType: 'PD',
      critical: true,
      packSize: '50',
    })
  ).id;
  locationId = (await jsonPost('/consumables/api/locations', { name: locationName })).id;
  otherLocationId = (await jsonPost('/consumables/api/locations', { name: 'E2E Other ' + suffix })).id;
  for (const id of [locationId, otherLocationId])
    await jsonPost('/consumables/api/inventory', { materialId, locationId: id, rack: 'Rack B1' });
  await jsonPost(
    '/consumables/api/opening-balances',
    { materialId, locationId: otherLocationId, quantity: '5', reason: 'Physical count', expectedVersion: 1 },
    randomUUID(),
  );
});
test.afterAll(async () => {
  const ids = [userId, ...roleUsers].filter(Boolean);
  try {
    await getConsumablesDb().transaction(async (tx) => {
      if (ids.length) {
        await tx.delete(stockSchema.idempotency).where(inArray(stockSchema.idempotency.actorId, ids));
        await tx.delete(stockSchema.audit).where(inArray(stockSchema.audit.actorId, ids));
      }
      if (materialId) {
        await tx.delete(stockSchema.movements).where(eq(stockSchema.movements.materialId, materialId));
        await tx.delete(stockSchema.inventory).where(eq(stockSchema.inventory.materialId, materialId));
        await tx.delete(stockSchema.materials).where(eq(stockSchema.materials.id, materialId));
      }
      const locations = [locationId, otherLocationId].filter(Boolean);
      if (locations.length)
        await tx.delete(stockSchema.locations).where(inArray(stockSchema.locations.id, locations));
    });
    if (ids.length)
      await getAuthDb().transaction(async (tx) => {
        await tx.delete(authSchema.session).where(inArray(authSchema.session.userId, ids));
        await tx.delete(authSchema.account).where(inArray(authSchema.account.userId, ids));
        await tx.delete(authSchema.grants).where(inArray(authSchema.grants.userId, ids));
        await tx.delete(authSchema.user).where(inArray(authSchema.user.id, ids));
        await tx.delete(authSchema.audit).where(inArray(authSchema.audit.actorId, [admin.id, ...ids]));
      });
  } finally {
    await client?.dispose();
    await Promise.all([closeAuthDb(), closeConsumablesDb()]);
  }
});
test('Consumables SSO, opening, pack receipt, self-service issue, history, themes and mobile', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await expect(page.getByRole('heading', { name: 'Consumable Room', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ringkasan Consumable Room', exact: true })).toBeVisible();
  await expect(page.getByRole('figure', { name: /^Pemasangan per kuartal / })).toBeVisible();
  await page.screenshot({ path: '.test-runtime/gateway-portal-recovered.png', fullPage: true });
  await page.goto('/consumables');
  await expect(page.getByRole('region', { name: 'Ringkasan Consumable Room', exact: true })).toBeVisible();
  await page.screenshot({ path: '.test-runtime/gateway-consumables-recovered.png', fullPage: true });
  await page.goto('/consumables/manage');
  await page.getByRole('button', { name: 'Daftar stok & saldo awal', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Cari material atau transaksi' }).fill(mmid);
  await page.locator('.stock-table-row').filter({ hasText: mmid }).filter({ hasText: locationName }).click();
  await page.getByLabel('Jumlah fisik', { exact: true }).fill('0');
  await page.getByLabel('Alasan / keterangan hitung fisik').fill('Browser physical zero');
  await page.getByRole('button', { name: 'Simpan saldo awal', exact: true }).click();
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saldo awal tersimpan');
  await page.goto(`/consumables/receive?material=${materialId}&location=${locationId}`);
  await choose(page.getByRole('combobox', { name: 'Mode penerimaan', exact: true }), 'pack');
  await page.getByLabel('Jumlah pack', { exact: true }).fill('2');
  await page.getByLabel('Referensi penerimaan', { exact: true }).fill('BROWSER-RECEIPT');
  await page.getByRole('button', { name: 'Simpan penerimaan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Penerimaan tersimpan');
  await page.goto(`/consumables/issue?material=${materialId}&location=${locationId}`);
  await page.getByLabel('Jumlah (EA)', { exact: true }).fill('3');
  await page.getByLabel('Pekerjaan / equipment').fill('Browser maintenance');
  await page.getByRole('button', { name: 'Tema', exact: true }).click();
  await page.getByRole('button', { name: 'Gelap', exact: true }).click();
  await expect(page.getByLabel('Jumlah (EA)', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('Pekerjaan / equipment')).toHaveValue('Browser maintenance');
  await page.getByLabel('WO Number (opsional)').fill('BROWSER-WO');
  await page.getByRole('button', { name: 'Simpan pemakaian', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Pemakaian tersimpan');
  const d = await (await client.get('/consumables/api/materials/' + materialId)).json();
  expect(d.stocks.find((s: any) => s.locationId === locationId).quantity).toBe('97.000000');
  await page.goto(`/consumables/history?material=${materialId}&location=${locationId}`);
  await page.locator('.stock-table-row').filter({ hasText: 'Pemakaian' }).click();
  await expect(page.getByRole('dialog')).toContainText('BROWSER-WO');
  await expect(page.getByRole('dialog')).toContainText('97 EA');
  await page.keyboard.press('Escape');
  await page.goto('/consumables/stock');
  await page.getByRole('searchbox', { name: 'Cari material atau transaksi' }).fill(mmid);
  await expect(page.locator('.stock-table-row').filter({ hasText: locationName })).toContainText('97');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => {
      localStorage.setItem('plant-ui-theme', t);
    }, theme);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.getByRole('searchbox', { name: 'Cari material atau transaksi' }).fill(mmid);
    await expect(page.locator('.stock-table-row').filter({ hasText: locationName })).toContainText('97');
    await page.screenshot({ path: `.test-runtime/consumables-desktop-${theme}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    '/consumables',
    '/consumables/stock',
    '/consumables/receive',
    '/consumables/issue',
    '/consumables/history',
    '/consumables/manage',
    '/consumables/audit',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      path + ' overflow',
    ).toBeTruthy();
  }
  await expect(page.locator('.stock-audit-row').first()).toBeVisible();
  await page.screenshot({ path: '.test-runtime/consumables-mobile-dark.png', fullPage: false });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/bag-filter/equipment/l61-bf1');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('L61');
  await page.goto('/');
  expect(page.url()).not.toContain('/auth/login');
  expect(errors).toEqual([]);
});
test('gateway and role/location checks reject direct access, revoked grants and disabled apps', async ({
  request,
}) => {
  test.setTimeout(120000);
  const initial = await (await client.get('/consumables/api/materials/' + materialId)).json();
  const current = initial.stocks.find((s: any) => s.locationId === locationId);
  if (!current.initialized)
    await jsonPost(
      '/consumables/api/opening-balances',
      {
        materialId,
        locationId,
        quantity: '10',
        reason: 'Role fixture count',
        expectedVersion: current.inventoryVersion,
      },
      randomUUID(),
    );
  for (const path of [
    '/consumables/internal/locations',
    '/consumables/%69nternal/locations',
    '/_verify_consumables',
    '/consumables/health/ready',
  ])
    expect((await request.get(path)).status()).toBe(404);
  expect(
    (
      await request.get('/consumables/api/inventory', {
        headers: { 'x-user-role': 'admin', 'x-user-id': userId, 'x-plant-service-token': 'forged' },
      })
    ).status(),
  ).toBe(401);
  for (const role of ['viewer', 'operator', 'storekeeper'] as const) {
    const userEmail = `stock-${role}-${randomUUID()}@example.test`,
      id = (
        await jsonPost('/api/admin/users', { name: 'Stock ' + role, email: userEmail, password: temporary })
      ).id;
    roleUsers.push(id);
    await jsonPost(`/api/admin/users/${id}/grants/consumables`, {
      grant: { appId: 'consumables', role, locationIds: [locationId] },
    });
    await changePassword({ ...admin, id }, temporary, password);
    await closeAuthDb();
    const c = await requests.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
    try {
      expect((await post(c, '/auth/api/sign-in/email', { email: userEmail, password })).status()).toBe(200);
      expect((await c.get('/consumables/api/inventory?locationId=' + otherLocationId)).status()).toBe(403);
      expect((await c.get('/consumables/api/audit')).status()).toBe(403);
      const detail = await (await c.get('/consumables/api/materials/' + materialId)).json();
      expect(detail.stocks.map((s: any) => s.locationId)).toEqual([locationId]);
      const receipt = await post(
        c,
        '/consumables/api/receipts',
        { materialId, locationId, mode: 'base', quantity: '1', reference: 'Role check' },
        randomUUID(),
      );
      expect(receipt.status()).toBe(role === 'storekeeper' ? 201 : 403);
      const issue = await post(
        c,
        '/consumables/api/issues',
        { materialId, locationId, quantity: '0.1', job: 'Role check' },
        randomUUID(),
      );
      expect(issue.status()).toBe(role === 'viewer' ? 403 : 201);
      if (role !== 'viewer') expect((await issue.json()).movement.actorId).toBe(id);
      await jsonPost(`/api/admin/users/${id}/grants/consumables`, { grant: null });
      expect((await c.get('/consumables/api/inventory')).status()).toBe(403);
    } finally {
      await c.dispose();
    }
  }
  await jsonPost('/api/admin/applications/consumables', { status: 'disabled' });
  try {
    expect((await client.get('/consumables/api/inventory')).status()).toBe(403);
  } finally {
    await jsonPost('/api/admin/applications/consumables', { status: 'active' });
  }
});
