import { test, expect, request as requests, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { getConsumablesDb, closeConsumablesDb } from '@plant/consumables-core';
import * as s from '@plant/consumables-core/schema';
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
  email = `r22-browser-${suffix}@example.test`,
  password = 'R22-browser-password-2026',
  temporary = 'R22-temporary-password-2026';
const admin: Identity = {
  id: randomUUID(),
  name: 'R22 Browser',
  email,
  position: '',
  portalAdmin: true,
  mustChangePassword: false,
  grants: [],
};
let client: APIRequestContext, userId: string, materialId: string;
const mmid = 'R22-BROWSER-' + suffix,
  roleUsers: string[] = [],
  materials: string[] = [];
async function post(c: APIRequestContext, path: string, data: unknown, key?: string) {
  return c.post(path, {
    data,
    headers: { origin: process.env.PUBLIC_ORIGIN!, ...(key ? { 'Idempotency-Key': key } : {}) },
  });
}
async function save(path: string, data: unknown, key?: string) {
  const r = await post(client, path, data, key);
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function login(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Masuk/ }).click();
  await page.waitForURL((u) => u.pathname === '/');
}
test.beforeAll(async () => {
  userId = (await createUser(admin, { name: admin.name, email, password: temporary })).id;
  await updateUserAccess(admin, userId, { active: true, portalAdmin: true });
  await setAppGrant(admin, userId, 'consumables', { appId: 'consumables', role: 'admin' });
  await setGrant(admin, userId, { appId: 'bag-filter', role: 'viewer', equipment: ['L61-BF1'] });
  await changePassword({ ...admin, id: userId }, temporary, password);
  await closeAuthDb();
  client = await requests.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
  expect((await post(client, '/auth/api/sign-in/email', { email, password })).ok()).toBeTruthy();
  materialId = (
    await save('/consumables/api/materials', {
      mmid,
      description: 'Browser synthetic SAP',
      commonName: 'Browser baut',
      aliases: 'bolt, fastener',
      unit: 'PCS',
      sapUnit: 'SET',
      packSize: '50',
      category: 'Synthetic',
      decimalAllowed: false,
    })
  ).id;
  materials.push(materialId);
  await save('/consumables/api/inventory', { materialId, rack: 'Rack B1' });
});
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
test.afterAll(async () => {
  const ids = [userId, ...roleUsers].filter(Boolean);
  try {
    await getConsumablesDb().transaction(async (tx) => {
      if (ids.length) {
        await tx.delete(s.idempotency).where(inArray(s.idempotency.actorId, ids));
        await tx.delete(s.audit).where(inArray(s.audit.actorId, ids));
      }
      if (materials.length) {
        await tx.delete(s.movements).where(inArray(s.movements.materialId, materials));
        await tx.delete(s.inventory).where(inArray(s.inventory.materialId, materials));
        await tx.delete(s.materials).where(inArray(s.materials.id, materials));
      }
      if (ids.length) await tx.delete(s.documents).where(inArray(s.documents.actorId, ids));
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
test('single R22 stock: opening, persistent Consume/Return carts, print, correction and cross-app SSO', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await expect(page.getByRole('region', { name: 'Ringkasan Consumable Room', exact: true })).toBeVisible();
  await page.goto('/consumables/manage');
  await page.getByRole('button', { name: 'Stok, rak & saldo awal', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Cari material atau transaksi' }).fill(mmid);
  await page.locator('.stock-table-row').filter({ hasText: mmid }).click();
  await page.getByLabel('Jumlah fisik', { exact: true }).fill('10');
  await page.getByLabel('Alasan / keterangan hitung fisik').fill('Browser count');
  await page.getByRole('button', { name: 'Simpan saldo awal', exact: true }).click();
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saldo awal tersimpan');
  // Location-scoped drafts are not mixed into the new cart.
  await page.evaluate(
    ({ userId }) =>
      sessionStorage.setItem(
        `r22-cart:${userId}:consume:legacy-location`,
        JSON.stringify({ hec: '999-OLD', lines: [] }),
      ),
    { userId },
  );
  await page.goto('/consumables/consume');
  await page.getByLabel('HAC/SAC / Functional Location').fill('tq.452-bu1');
  await page.getByRole('combobox', { name: /Cari material/ }).fill(mmid);
  const modal = page.getByRole('dialog', { name: 'Tambah jumlah material' });
  await expect(modal).toBeVisible();
  await modal.getByLabel('Jumlah (PCS)', { exact: true }).fill('3');
  await page.screenshot({ path: '.test-runtime/r22-quantity-modal-1440.png', fullPage: true });
  await modal.getByRole('button', { name: 'Tambah ke keranjang' }).click();
  await page.getByLabel('WO Number (opsional)').fill('R22-BROWSER-WO');
  await page.reload();
  await expect(page.getByLabel('HAC/SAC / Functional Location')).toHaveValue('452-BU1');
  await expect(page.locator('.r22-cart-table')).toContainText(mmid);
  await page.getByRole('button', { name: 'Tema', exact: true }).click();
  await page.getByRole('button', { name: 'Gelap', exact: true }).click();
  await expect(page.getByLabel('WO Number (opsional)')).toHaveValue('R22-BROWSER-WO');
  await page.screenshot({ path: '.test-runtime/r22-consume-1440.png', fullPage: true });
  await page.getByRole('button', { name: /Submit Order/ }).click();
  await expect(page.getByRole('dialog')).toContainText('HAC/SAC 452-BU1');
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Consume Order tersimpan');
  await expect(page.locator('.r22-success')).toContainText('HAC/SAC 452-BU1');
  await page.getByRole('link', { name: 'Lihat / Cetak bukti' }).click();
  await expect(page.locator('.r22-receipt')).toContainText('452-BU1');
  await expect(page.locator('.r22-receipt dt')).toContainText(['HAC/SAC / Functional Location']);
  await expect(page.locator('.r22-receipt')).not.toContainText('Lokasi');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.screenshot({ path: '.test-runtime/r22-receipt-print.png', fullPage: true });
  await page.pdf({ path: '.test-runtime/r22-consume-print.pdf', format: 'A4' });
  await page.emulateMedia({ media: 'screen' });
  await page.goto(`/consumables/return?material=${materialId}`);
  await expect(modal).toBeVisible();
  await modal.getByLabel('Jumlah (PCS)', { exact: true }).fill('2');
  await modal.getByRole('button', { name: 'Tambah ke keranjang' }).click();
  await page.getByLabel('HAC/SAC / Functional Location').fill('452-BU1');
  await page.getByRole('button', { name: /Submit Order/ }).click();
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Return Order tersimpan');
  expect((await (await client.get('/consumables/api/materials/' + materialId)).json()).stock.quantity).toBe(
    '9.000000',
  );
  await page.goto('/consumables/history');
  await page.getByRole('searchbox', { name: 'Cari dokumen' }).fill('R22-BROWSER-WO');
  await page.locator('.r22-documents-list .stock-table-row').first().click();
  await expect(page.getByRole('dialog')).toContainText('R22-BROWSER-WO');
  await expect(page.getByRole('dialog').locator('dt')).toContainText(['HAC/SAC']);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto('/consumables/manage');
  await page.getByRole('button', { name: 'Stok, rak & saldo awal', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Cari material atau transaksi' }).fill(mmid);
  await page.locator('.stock-table-row').filter({ hasText: mmid }).click();
  await page.getByLabel('Jumlah fisik', { exact: true }).fill('8');
  await page.getByLabel('Alasan / keterangan hitung fisik').fill('Recount');
  await page.getByRole('button', { name: 'Simpan koreksi', exact: true }).click();
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Koreksi tersimpan');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => localStorage.setItem('plant-ui-theme', t), theme);
    await page.goto('/consumables/stock');
    await page.getByRole('searchbox', { name: 'Cari material atau transaksi' }).fill(mmid);
    await expect(page.locator('.stock-table-row').filter({ hasText: mmid })).toContainText('8');
    await page.screenshot({ path: `.test-runtime/r22-stock-${theme}-1440.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['', '/stock', '/consume', '/return', '/picklist', '/history', '/manage', '/audit']) {
    await page.goto('/consumables' + path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      path,
    ).toBeTruthy();
  }
  await page.screenshot({ path: '.test-runtime/r22-mobile-390.png', fullPage: true });
  await page.goto('/bag-filter/equipment/l61-bf1');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('L61');
  await page.goto('/');
  expect(page.url()).not.toContain('/auth/login');
  expect(errors).toEqual([]);
});
test('20-line SAP picklist, retry and K3 auto enrollment use the single room', async ({ page }) => {
  test.setTimeout(150000);
  const lines = [];
  for (let i = 0; i < 20; i++) {
    const id = (
      await save('/consumables/api/materials', {
        mmid: `PICK-${suffix}-${i}`,
        description: `Synthetic picklist ${i}`,
        commonName: `Baut ${i}`,
        unit: 'PCS',
        sapUnit: 'SET',
        packSize: '2',
        category: 'Synthetic',
      })
    ).id;
    materials.push(id);
    lines.push({ materialId: id, sapQuantity: '3', materialVersion: 1 });
  }
  await page.context().addCookies((await client.storageState()).cookies);
  await page.goto('/consumables/picklist');
  // Add all lines through the accessible catalog search, preserving real API responses.
  await page.getByLabel('No. Reservasi', { exact: true }).fill('RES-' + suffix);
  await page.getByLabel('WO No.', { exact: true }).fill('WO-' + suffix);
  for (let i = 0; i < 20; i++) {
    await page.getByRole('combobox', { name: /Cari material/ }).fill(`PICK-${suffix}-${i}`);
    await expect(page.locator('[data-r22-quantity]')).toHaveCount(i + 1);
    await page.locator('[data-r22-quantity]').nth(i).fill('3');
  }
  await page.reload();
  await expect(page.locator('[data-r22-quantity]')).toHaveCount(20);
  await page.screenshot({ path: '.test-runtime/r22-picklist-1440.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: '.test-runtime/r22-picklist-390.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const costCenter = page.getByRole('textbox', { name: /^Cost Center\b/ });
  await expect(costCenter).toHaveAttribute('required', '');
  await page.getByRole('button', { name: /Terima Picklist/ }).click();
  await expect(costCenter).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await costCenter.fill('   ');
  await page.getByRole('button', { name: /Terima Picklist/ }).click();
  await expect(page.locator('.r22-picklist .notice[role="alert"]')).toHaveText('Cost Center wajib diisi.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await costCenter.fill('40420');
  await page.getByRole('button', { name: /Terima Picklist/ }).click();
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Penerimaan Picklist tersimpan');
  const idempotency = randomUUID(),
    body = { reservationNo: 'RES-' + suffix, wo: 'WO-' + suffix, costCenter: '40420', lines };
  const { costCenter: _, ...missingCostCenter } = body;
  for (const invalid of [missingCostCenter, { ...body, costCenter: '   ' }]) {
    const rejected = await post(client, '/consumables/api/picklist-receipts', invalid, idempotency);
    expect(rejected.status()).toBe(400);
  }
  const first = await save('/consumables/api/picklist-receipts', body, idempotency),
    second = await save('/consumables/api/picklist-receipts', body, idempotency);
  expect(first.document.id).toBe(second.document.id);
  expect(first.document.costCenter).toBe('40420');
  expect(second.replayed).toBeTruthy();
  const d = await (await client.get('/consumables/api/materials/' + lines[0].materialId)).json();
  expect(d.stock.quantity).toBe('12.000000');
  expect(d.stock.rack).toBe('');
  expect(d.stock.initialized).toBe(true);
  expect(d.stocks).toBeUndefined();
});
test('gateway, four roles, role-only grant, rejected location fields, revocation and disabled apps', async ({
  request,
}) => {
  test.setTimeout(120000);
  const d = await (await client.get('/consumables/api/materials/' + materialId)).json();
  if (!d.stock.initialized)
    await save(
      '/consumables/api/opening-balances',
      { materialId, quantity: '10', reason: 'Role count', expectedVersion: 1 },
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
  expect((await client.get('/consumables/api/locations')).status()).toBe(410);
  expect((await client.get('/consumables/api/locations/' + randomUUID())).status()).toBe(410);
  expect((await client.get('/api/admin/applications/consumables/locations')).status()).toBe(404);
  for (const role of ['viewer', 'operator', 'storekeeper', 'admin'] as const) {
    const userEmail = `r22-${role}-${randomUUID()}@example.test`,
      id = (await save('/api/admin/users', { name: 'R22 ' + role, email: userEmail, password: temporary }))
        .id;
    roleUsers.push(id);
    await save(`/api/admin/users/${id}/grants/consumables`, { grant: { appId: 'consumables', role } });
    await changePassword({ ...admin, id }, temporary, password);
    await closeAuthDb();
    const c = await requests.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
    try {
      expect((await post(c, '/auth/api/sign-in/email', { email: userEmail, password })).status()).toBe(200);
      expect((await c.get('/consumables/api/inventory?locationId=' + randomUUID())).status()).toBe(400);
      expect((await c.get('/consumables/api/audit')).status()).toBe(role === 'admin' ? 200 : 403);
      expect((await (await c.get('/consumables/api/materials/' + materialId)).json()).stock.inventoryId).toBe(
        d.stock.inventoryId,
      );
      const body = { hec: '452-BU1', lines: [{ materialId, quantity: '1' }] };
      expect(
        (
          await post(
            c,
            '/consumables/api/consume-orders',
            { ...body, locationId: randomUUID() },
            randomUUID(),
          )
        ).status(),
      ).toBe(role === 'viewer' ? 403 : 400);
      const consume = await post(c, '/consumables/api/consume-orders', body, randomUUID());
      expect(consume.status()).toBe(role === 'viewer' ? 403 : 201);
      if (role !== 'viewer') expect((await consume.json()).document.actorId).toBe(id);
      const ret = await post(c, '/consumables/api/return-orders', body, randomUUID());
      expect(ret.status()).toBe(role === 'viewer' ? 403 : 201);
      expect(
        (
          await post(
            c,
            '/consumables/api/picklist-receipts',
            {
              reservationNo: 'ROLE',
              wo: 'ROLE',
              costCenter: '40420',
              lines: [{ materialId, quantity: '1' }],
            },
            randomUUID(),
          )
        ).status(),
      ).toBe(['storekeeper', 'admin'].includes(role) ? 201 : 403);
      expect((await post(c, '/consumables/api/receipts', {}, randomUUID())).status()).toBe(410);
      await save(`/api/admin/users/${id}/grants/consumables`, { grant: null });
      expect((await c.get('/consumables/api/inventory')).status()).toBe(403);
    } finally {
      await c.dispose();
    }
  }
  await save('/api/admin/applications/consumables', { status: 'disabled' });
  try {
    expect((await client.get('/consumables/api/inventory')).status()).toBe(403);
  } finally {
    await save('/api/admin/applications/consumables', { status: 'active' });
  }
});
