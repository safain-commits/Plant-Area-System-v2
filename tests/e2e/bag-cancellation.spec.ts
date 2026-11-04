import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { authSchema, getAuthDb, closeAuthDb, createUser, setGrant, changePassword } from '@plant/auth-core';
import { getBagDb, closeBagDb, bagSchema } from '@plant/bag-core';
import { type Identity, type Position } from '@plant/contracts';
const origin = process.env.PUBLIC_ORIGIN!;
const password = 'Cancellation-browser-password-2026';
const users: { id: string; email: string }[] = [];
let owner: Identity;
test.beforeAll(async () => {
  const [bootstrap] = await getAuthDb()
    .select()
    .from(authSchema.user)
    .where(eq(authSchema.user.email, process.env.BOOTSTRAP_EMAIL!));
  owner = { ...bootstrap, mustChangePassword: false, grants: [] } as Identity;
  for (const [i, role] of ['admin', 'operator', 'viewer', 'admin'].entries()) {
    const email = `cancel-${randomUUID()}@example.test`,
      temporary = 'Cancel-temporary-password-2026';
    const user = await createUser(owner, {
      email,
      password: temporary,
      name: `Cancel ${role}`,
      position: 'Test',
    });
    users.push({ id: user.id, email });
    await setGrant(owner, user.id, {
      appId: 'bag-filter',
      role: role as 'admin' | 'operator' | 'viewer',
      equipment: i === 3 ? ['422-BF1'] : ['421-BF1', '422-BF1'],
    });
    await changePassword({ ...owner, id: user.id, email }, temporary, password);
  }
});
test.afterAll(async () => {
  try {
    for (const user of users) {
      const records = await getBagDb()
        .select({ id: bagSchema.batches.id })
        .from(bagSchema.batches)
        .where(eq(bagSchema.batches.actorId, user.id));
      if (records.length)
        await getBagDb().transaction(async (tx) => {
          const ids = records.map((x) => x.id);
          await tx
            .delete(bagSchema.batchCancellations)
            .where(inArray(bagSchema.batchCancellations.batchId, ids));
          await tx.delete(bagSchema.bagAudit).where(inArray(bagSchema.bagAudit.batchId, ids));
          await tx.delete(bagSchema.installations).where(inArray(bagSchema.installations.batchId, ids));
          await tx.delete(bagSchema.batches).where(inArray(bagSchema.batches.id, ids));
        });
      await getAuthDb().transaction(async (tx) => {
        await tx.delete(authSchema.session).where(eq(authSchema.session.userId, user.id));
        await tx.delete(authSchema.account).where(eq(authSchema.account.userId, user.id));
        await tx.delete(authSchema.grants).where(eq(authSchema.grants.userId, user.id));
        await tx.delete(authSchema.user).where(eq(authSchema.user.id, user.id));
      });
    }
  } finally {
    await closeAuthDb();
    await closeBagDb();
  }
});
async function login(page: Page, user = 0) {
  expect(
    (
      await page.request.post('/auth/api/sign-in/email', {
        headers: { origin },
        data: { email: users[user].email, password },
      })
    ).status(),
  ).toBe(200);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
async function createBatch(page: Page, reason: string, code = '421-BF1', date = '2025-06-01T00:00:00Z') {
  const positions: Position[] = [
    { side: 'B', compartment: 5, column: 2, row: 14 },
    { side: 'B', compartment: 5, column: 3, row: 4 },
    { side: 'B', compartment: 6, column: 8, row: 6 },
  ];
  const response = await page.request.post(`/bag-filter/api/equipment/${code}/batches`, {
    headers: { origin, 'Idempotency-Key': randomUUID() },
    data: { equipmentCode: code, positions, installedAt: date, brand: 'Filtras', reason },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).batchId as string;
}
test('admin cancellation preserves draft, retries a lost response once, refreshes safely and is readable in both themes', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  const previous = await createBatch(page, 'Original fixture', '421-BF1', '2024-01-01T00:00:00Z');
  const wrong = await createBatch(page, 'Wrong equipment fixture');
  await createBatch(page, 'Other equipment fixture', '422-BF1');
  const targetBefore = await (await page.request.get('/bag-filter/api/equipment/422-BF1/state')).json();
  await page.goto(`/bag-filter/equipment/421-bf1?batch=${wrong}`);
  await page.locator('.bag-grid .bag-cell').first().click();
  await page.getByRole('button', { name: 'Catat penggantian', exact: true }).click();
  const recording = page.getByRole('dialog', { name: 'Pencatatan penggantian', exact: true });
  await recording.getByLabel('Alasan penggantian / pemasangan awal').fill('Draft kept during cancellation');
  await recording.getByLabel('WO Number (opsional)').fill('DRAFT-WO');
  await recording.getByRole('button', { name: 'Tutup Pencatatan penggantian' }).click();
  const row = page.locator(`[data-batch-id="${wrong}"]`);
  const dialog = page.getByRole('dialog', { name: 'Batalkan record', exact: true });
  for (const theme of ['light', 'dark'])
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((value) => {
        localStorage.setItem('plant-ui-theme', value);
        dispatchEvent(
          new StorageEvent('storage', { key: 'plant-ui-theme', newValue: value, storageArea: localStorage }),
        );
      }, theme);
      await row.getByRole('button', { name: 'Batalkan record', exact: true }).click();
      await expect(dialog).toContainText('421-BF1');
      await expect(dialog).toContainText('3 bag');
      await expect(dialog.getByRole('button', { name: 'Batalkan record', exact: true })).toBeDisabled();
      await expect(page.getByRole('region', { name: 'Pilihan bag', exact: true })).toBeHidden();
      await dialog.screenshot({ path: `test-results/cancellation-${theme}-${width}.png` });
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(row.getByRole('button', { name: 'Batalkan record', exact: true })).toBeFocused();
    }
  await row.getByRole('button', { name: 'Batalkan record', exact: true }).click();
  await dialog.getByLabel('Alasan pembatalan').fill('Salah equipment, seharusnya 422-BF1');
  const url = `**/api/equipment/421-BF1/batches/${wrong}/cancel`;
  const keys: string[] = [];
  await page.route(url, async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    const response = await route.fetch();
    if (keys.length === 1) {
      expect(response.status()).toBe(200);
      await route.abort('failed');
    } else {
      expect((await response.json()).replayed).toBe(true);
      await route.fulfill({ response });
    }
  });
  await dialog.getByRole('button', { name: 'Batalkan record', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Koneksi terputus');
  // The transaction has committed, but a failed refresh must not invite another cancellation.
  await page.route('**/api/equipment/421-BF1/state', (route) =>
    route.fulfill({ status: 503, json: { error: 'Injected refresh failure' } }),
  );
  await dialog.getByRole('button', { name: 'Batalkan record', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  await expect(page.getByRole('main').locator('.notice[role="alert"]')).toContainText(
    'Record sudah dibatalkan, tetapi tampilan belum diperbarui',
  );
  await expect(row).toContainText('Dibatalkan');
  await expect(row.getByRole('button', { name: 'Batalkan record' })).toHaveCount(0);
  await page.unroute('**/api/equipment/421-BF1/state');
  await page.getByRole('button', { name: 'Muat ulang data', exact: true }).click();
  await expect(page.getByRole('main').locator('.notice[role="alert"]')).toHaveCount(0);
  const restored = await (await page.request.get('/bag-filter/api/equipment/421-BF1/state')).json();
  expect(restored.positions.filter((x: { batchId: string }) => x.batchId === previous)).toHaveLength(3);
  expect(
    (await (await page.request.get('/bag-filter/api/equipment/422-BF1/state')).json()).positions,
  ).toEqual(targetBefore.positions);
  await expect(page.getByRole('region', { name: 'Pilihan bag', exact: true })).toContainText(
    '1 posisi dipilih',
  );
  await page.getByRole('button', { name: 'Catat penggantian', exact: true }).click();
  await expect(recording.getByLabel('Alasan penggantian / pemasangan awal')).toHaveValue(
    'Draft kept during cancellation',
  );
  await expect(recording.getByLabel('WO Number (opsional)')).toHaveValue('DRAFT-WO');
  await recording.getByRole('button', { name: 'Tutup Pencatatan penggantian' }).click();
  await row.getByRole('button', { name: '5B B14', exact: true }).click();
  const timeline = page.getByRole('region', { name: 'Daftar riwayat koordinat', exact: true });
  await expect(timeline).toContainText('Dibatalkan');
  await expect(timeline.getByText('Terpasang sekarang', { exact: true })).toHaveCount(1);
  await page.goto('/bag-filter/audit');
  await expect(page.getByRole('cell', { name: /Pembatalan record/ })).toContainText('Salah equipment');
});

test('direct cancellation API enforces roles, scope, origin, spoofed identity and revoked grant', async ({
  page,
  browser,
}) => {
  await login(page);
  const batch = await createBatch(page, 'API cancellation guard');
  const endpoint = `/bag-filter/api/equipment/421-BF1/batches/${batch}/cancel`;
  const data = { reason: 'Guard test' };
  for (const user of [1, 2, 3]) {
    const context = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
    const other = await context.newPage();
    await login(other, user);
    expect(
      (
        await other.request.post(endpoint, { headers: { origin, 'Idempotency-Key': randomUUID() }, data })
      ).status(),
    ).toBe(403);
    if (user !== 3) {
      await other.goto(`/bag-filter/equipment/421-bf1?batch=${batch}`);
      await expect(other.locator(`[data-batch-id="${batch}"]`)).toBeVisible();
      await expect(other.getByRole('button', { name: 'Batalkan record', exact: true })).toHaveCount(0);
    }
    await context.close();
  }
  expect(
    (
      await page.request.post(endpoint, {
        headers: { origin: 'https://forged.test', 'Idempotency-Key': randomUUID() },
        data,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(endpoint, {
        headers: { origin, 'Idempotency-Key': randomUUID() },
        data: { ...data, actorId: users[0].id },
      })
    ).status(),
  ).toBe(400);
  const unauthenticated = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  expect(
    (
      await unauthenticated.request.post(endpoint, {
        headers: {
          origin,
          'Idempotency-Key': randomUUID(),
          'x-user-role': 'admin',
          'x-user-id': users[0].id,
        },
        data,
      })
    ).status(),
  ).toBe(401);
  await unauthenticated.close();
  await page.goto(`/bag-filter/equipment/421-bf1?batch=${batch}`);
  await page
    .locator(`[data-batch-id="${batch}"]`)
    .getByRole('button', { name: 'Batalkan record', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Batalkan record', exact: true });
  await dialog.getByLabel('Alasan pembatalan').fill('Grant revoked while open');
  await setGrant(owner, users[0].id, {
    appId: 'bag-filter',
    role: 'viewer',
    equipment: ['421-BF1', '422-BF1'],
  });
  await dialog.getByRole('button', { name: 'Batalkan record', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(
    (await page.request.get(`/bag-filter/api/equipment/421-BF1/batches?q=${batch}`).then((x) => x.json()))
      .items[0].status,
  ).toBe('active');
});
