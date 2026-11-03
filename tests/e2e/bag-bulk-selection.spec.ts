import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { authSchema, getAuthDb, closeAuthDb, createUser, setGrant, changePassword } from '@plant/auth-core';
import { getBagDb, closeBagDb, bagSchema } from '@plant/bag-core';
import { equipmentCodes, getEquipment, positionKey, type Identity, type Position } from '@plant/contracts';

const origin = process.env.PUBLIC_ORIGIN!;
const password = 'Bulk-browser-test-password-2026';
const users: { id: string; email: string }[] = [];
const reason = `Bulk 450 ${randomUUID()}`;

test.beforeAll(async () => {
  const [bootstrap] = await getAuthDb()
    .select()
    .from(authSchema.user)
    .where(eq(authSchema.user.email, process.env.BOOTSTRAP_EMAIL!));
  if (!bootstrap) throw Error('Bootstrap required');
  const actor = { ...bootstrap, mustChangePassword: false, grants: [] } as Identity;
  for (const [index, role] of ['operator', 'viewer', 'operator'].entries()) {
    const email = `bulk-${index}-${randomUUID()}@example.test`,
      temporary = 'Bulk-temporary-password-2026';
    const user = await createUser(actor, {
      email,
      password: temporary,
      name: `Bulk ${role}`,
      position: 'Test',
    });
    users.push({ id: user.id, email });
    await setGrant(actor, user.id, {
      appId: 'bag-filter',
      role: role as 'operator' | 'viewer',
      equipment: index === 0 ? [...equipmentCodes] : ['422-BF1'],
    });
    await changePassword({ ...actor, id: user.id, email, name: `Bulk ${role}` }, temporary, password);
  }
});
test.afterAll(async () => {
  try {
    // Remove only this fixture's operational records, preserving other browser fixtures.
    for (const user of users) {
      const batches = await getBagDb()
        .select({ id: bagSchema.batches.id })
        .from(bagSchema.batches)
        .where(eq(bagSchema.batches.actorId, user.id));
      if (batches.length)
        await getBagDb().transaction(async (tx) => {
          const ids = batches.map((b) => b.id);
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

async function login(page: Page, index = 0) {
  expect(
    (
      await page.request.post('/auth/api/sign-in/email', {
        headers: { origin },
        data: { email: users[index].email, password },
      })
    ).status(),
  ).toBe(200);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
async function choose(page: Page, name: string, label: string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
}
async function openBulk(page: Page) {
  await page.getByRole('button', { name: 'Pilih banyak', exact: true }).click();
  return page.getByRole('dialog', { name: 'Pilih banyak bag', exact: true });
}
async function addFull(page: Page, labels: string[]) {
  const sheet = await openBulk(page);
  for (const label of labels)
    await sheet.getByRole('checkbox', { name: `Comp. ${label}`, exact: true }).check();
  await sheet.getByRole('button', { name: 'Tambahkan pilihan', exact: true }).click();
  await expect(sheet).toBeHidden();
}
async function area(page: Page, compartment: string, toColumn: string, toRow: string) {
  const sheet = await openBulk(page);
  await sheet.getByRole('button', { name: 'Area bag', exact: true }).click();
  await choose(page, 'Kompartemen area', `Comp. ${compartment}`);
  await choose(page, 'Kolom sampai', toColumn);
  await choose(page, 'Baris sampai', toRow);
  return sheet;
}

test('408 + 42 mixed selection, grouped review, undo and a lost save response produce exactly one 450-bag batch', async ({
  page,
}) => {
  await login(page);
  await page.goto('/bag-filter/equipment/422-bf1');
  const first = await openBulk(page);
  for (const label of ['1A', '2A', '3A'])
    await first.getByRole('checkbox', { name: `Comp. ${label}`, exact: true }).check();
  await expect(first.getByRole('checkbox', { name: 'Comp. 4A', exact: true })).toBeDisabled();
  await expect(first.getByRole('status')).toContainText('92 bag tersisa');
  await expect(first.getByRole('checkbox', { name: 'Comp. 3A', exact: true })).toBeEnabled();
  await first.getByRole('checkbox', { name: 'Comp. 3A', exact: true }).uncheck();
  await expect(first.getByRole('checkbox', { name: 'Comp. 4A', exact: true })).toBeEnabled();
  await first.getByRole('checkbox', { name: 'Comp. 3A', exact: true }).check();
  await expect(first.locator('[data-preview="added"]')).toHaveText('408');
  await first.screenshot({ path: 'test-results/bulk-full-408-desktop.png' });
  await first.getByRole('button', { name: 'Tambahkan pilihan', exact: true }).click();
  await expect(page.locator('.selection-bar strong')).toHaveText('408 posisi dipilih');
  const block = await area(page, '4A', 'G', '6');
  await expect(block.locator('[data-preview="added"]')).toHaveText('42');
  await expect(block.locator('[data-preview="total"]')).toHaveText('450');
  await block.screenshot({ path: 'test-results/bulk-area-450-desktop.png' });
  await block.getByRole('button', { name: 'Tambahkan pilihan', exact: true }).click();
  await expect(page.locator('.selection-bar strong')).toHaveText('450 posisi dipilih');
  const repeated = await openBulk(page);
  await expect(repeated.getByRole('checkbox', { name: 'Comp. 1A', exact: true })).not.toBeChecked();
  await repeated.getByRole('checkbox', { name: 'Comp. 1A', exact: true }).check();
  await expect(repeated.locator('[data-preview="overlap"]')).toHaveText('136');
  await expect(repeated.locator('[data-preview="added"]')).toHaveText('0');
  await expect(repeated.getByRole('button', { name: 'Tambahkan pilihan', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Pilih banyak', exact: true })).toBeFocused();
  await page
    .locator('.bulk-selection-tools')
    .getByRole('button', { name: 'Urungkan pilihan terakhir', exact: true })
    .click();
  await expect(page.locator('.selection-bar strong')).toHaveText('408 posisi dipilih');
  await (
    await area(page, '4A', 'G', '6')
  )
    .getByRole('button', { name: 'Tambahkan pilihan', exact: true })
    .click();
  await page.locator('.bag-cell').first().click();
  await expect(page.locator('.selection-bar strong')).toHaveText('449 posisi dipilih');
  await page
    .locator('.bulk-selection-tools')
    .getByRole('button', { name: 'Urungkan pilihan terakhir', exact: true })
    .click();
  await page.locator('[data-sheet-trigger]:visible').click();
  const form = page.getByRole('dialog', { name: 'Pencatatan penggantian', exact: true });
  await expect(form.locator('.selection-group')).toHaveCount(4);
  await expect(form.locator('.selection-group[open]')).toHaveCount(0);
  await expect(form.getByRole('heading', { name: '450 posisi dipilih', exact: true })).toBeVisible();
  const last = form.locator('.selection-group').last();
  await expect(last.locator('summary')).toContainText('42 bag');
  await last.locator('summary').click();
  await last.getByRole('button', { name: 'Hapus 4A A6', exact: true }).click();
  await expect(form.getByRole('heading', { name: '449 posisi dipilih', exact: true })).toBeVisible();
  await form.getByRole('button', { name: 'Urungkan pilihan terakhir', exact: true }).click();
  await last.locator('summary').click();
  await form.getByRole('button', { name: 'Bersihkan semua', exact: true }).click();
  await expect(form.getByRole('heading', { name: '0 posisi dipilih', exact: true })).toBeVisible();
  await form.getByRole('button', { name: 'Urungkan pilihan terakhir', exact: true }).click();
  await expect(form.getByRole('heading', { name: '450 posisi dipilih', exact: true })).toBeVisible();
  await form.screenshot({ path: 'test-results/bulk-review-450-desktop.png' });
  await choose(page, 'Brand/Pabrikan', 'Filtras');
  await form.getByLabel('Alasan penggantian / pemasangan awal').fill(reason);
  await form.getByLabel('WO Number (opsional)').fill('BULK-450');
  await form.locator('input[type="datetime-local"]').fill('2026-10-29T08:00');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const attempts: { key: string; data: { positions: Position[]; [key: string]: unknown } }[] = [];
  let committed: { batchId: string; count: number } | undefined;
  await page.route('**/bag-filter/api/equipment/422-BF1/batches', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts.push({
      key: route.request().headers()['idempotency-key'],
      data: route.request().postDataJSON(),
    });
    if (attempts.length === 1) {
      await gate;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      committed = await response.json();
      await route.abort('failed');
    } else await route.continue();
  });
  try {
    await form.getByRole('button', { name: 'Simpan 450 bag', exact: true }).click();
    await expect(page.locator('.bulk-selection-tools button').first()).toBeDisabled();
    await expect(form.locator('button[aria-busy="true"]')).toBeDisabled();
  } finally {
    release();
  }
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Simpan 450 bag', exact: true })).toBeEnabled();
  await form.getByRole('button', { name: 'Simpan 450 bag', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('450 posisi tersimpan');
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toBeTruthy();
  expect(attempts[0]).toEqual(attempts[1]);
  const expected: Position[] = [];
  for (let compartment = 1; compartment <= 4; compartment++)
    for (let row = 1; row <= (compartment === 4 ? 6 : 17); row++)
      for (let column = 1; column <= (compartment === 4 ? 7 : 8); column++)
        expected.push({ side: 'A', compartment, row, column });
  expect(attempts[0].data.positions.map(positionKey).sort()).toEqual(expected.map(positionKey).sort());
  expect(attempts[0].data.brand).toBe('Filtras');
  expect(attempts[0].data.installedAt).toBe('2026-10-29T01:00:00.000Z');
  const history = await (
    await page.request.get(`/bag-filter/api/equipment/422-BF1/batches?q=${encodeURIComponent(reason)}`)
  ).json();
  expect(history.items).toHaveLength(1);
  expect(history.items[0].id).toBe(committed!.batchId);
  expect(history.items[0].positions).toHaveLength(450);
  expect(history.items[0].positions.map(positionKey).sort()).toEqual(expected.map(positionKey).sort());
  await expect(
    page
      .locator('.bulk-selection-tools')
      .getByRole('button', { name: 'Urungkan pilihan terakhir', exact: true }),
  ).toBeDisabled();
});

test('mobile bulk picker handles every equipment, side labels, reversed areas, cancellation and both themes', async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((value) => localStorage.setItem('plant-ui-theme', value), theme);
    for (const code of equipmentCodes) {
      const eq = getEquipment(code)!;
      await page.goto(`/bag-filter/equipment/${code.toLowerCase()}`);
      await addFull(page, [eq.sides[0].labels[0], eq.sides[1].labels[0]]);
      await expect(page.locator('.selection-bar strong')).toHaveText(
        `${eq.bagsPerCompartment * 2} posisi dipilih`,
      );
      const sheet = await openBulk(page);
      await expect(
        sheet.getByText(`1 kompartemen = ${eq.bagsPerCompartment} bag`, { exact: true }),
      ).toBeVisible();
      await sheet.getByRole('button', { name: 'Area bag', exact: true }).click();
      await choose(page, 'Sisi area', eq.sides[1].name);
      await choose(page, 'Kompartemen area', `Comp. ${eq.sides[1].labels[1]}`);
      await choose(page, 'Kolom dari', eq.columns[7]);
      await choose(page, 'Kolom sampai', eq.columns[0]);
      await choose(page, 'Baris dari', String(eq.rows));
      await choose(page, 'Baris sampai', '1');
      await expect(sheet.locator('[data-preview="total"]')).toHaveText(String(eq.bagsPerCompartment * 3));
      await sheet.screenshot({ path: `test-results/bulk-${code}-${theme}-390.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await sheet.getByRole('button', { name: 'Tambahkan pilihan', exact: true }).click();
      await expect(page.locator('.selection-bar strong')).toHaveText(
        `${eq.bagsPerCompartment * 3} posisi dipilih`,
      );
      const cancelled = await openBulk(page);
      await cancelled.getByRole('checkbox', { name: `Comp. ${eq.sides[0].labels[0]}`, exact: true }).check();
      await cancelled.getByRole('button', { name: 'Batal', exact: true }).click();
      await expect(page.locator('.selection-bar strong')).toHaveText(
        `${eq.bagsPerCompartment * 3} posisi dipilih`,
      );
      const reopened = await openBulk(page);
      await expect(reopened.getByRole('checkbox', { checked: true })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.locator('[data-sheet-trigger]:visible').click();
      const form = page.getByRole('dialog', { name: 'Pencatatan penggantian', exact: true });
      await expect(form.locator('.selection-group')).toHaveCount(3);
      await expect(form.locator('.selection-group[open]')).toHaveCount(0);
      await form.screenshot({ path: `test-results/bulk-review-${code}-${theme}-390.png` });
      await page.keyboard.press('Escape');
    }
  }
  expect(errors).toEqual([]);
});

test('exactly 500 succeeds, 501 preserves selection and undo; viewer and out-of-scope operations stay denied', async ({
  page,
}) => {
  await login(page);
  await page.goto('/bag-filter/equipment/422-bf1');
  await addFull(page, ['1A', '2A', '3A']);
  await (
    await area(page, '4A', 'H', '11')
  )
    .getByRole('button', { name: 'Tambahkan pilihan', exact: true })
    .click();
  const four = await area(page, '4A', 'D', '12');
  await choose(page, 'Baris dari', '12');
  await expect(four.locator('[data-preview="total"]')).toHaveText('500');
  await four.getByRole('button', { name: 'Tambahkan pilihan', exact: true }).click();
  const over = await area(page, '4A', 'H', '17');
  await choose(page, 'Kolom dari', 'H');
  await choose(page, 'Baris dari', '17');
  await expect(over.getByRole('alert')).toContainText('Lebih 1 bag');
  await expect(over.getByRole('button', { name: 'Tambahkan pilihan', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('.selection-bar strong')).toHaveText('500 posisi dipilih');
  await choose(page, 'Kompartemen', 'Comp. 4A');
  await page.locator('.bag-cell').filter({ hasText: 'H17' }).click();
  await expect(page.locator('.selection-bar strong')).toHaveText('500 posisi dipilih');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('sebanyak 1 bag');
  await page
    .locator('.bulk-selection-tools')
    .getByRole('button', { name: 'Urungkan pilihan terakhir', exact: true })
    .click();
  await expect(page.locator('.selection-bar strong')).toHaveText('496 posisi dipilih');
  await login(page, 1);
  await page.goto('/bag-filter/equipment/422-bf1');
  await expect(page.getByRole('button', { name: 'Pilih banyak', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Urungkan pilihan terakhir', exact: true })).toHaveCount(0);
  await page.locator('.bag-cell').first().click();
  await expect(page.locator('.selection-bar')).toHaveCount(0);
  expect(
    (
      await page.request.post('/bag-filter/api/equipment/422-BF1/batches', {
        headers: { origin, 'Idempotency-Key': randomUUID() },
        data: {
          equipmentCode: '422-BF1',
          positions: [{ side: 'A', compartment: 1, column: 1, row: 1 }],
          brand: 'Other',
          installedAt: '2026-10-01T00:00:00.000Z',
          reason: 'Denied viewer',
        },
      })
    ).status(),
  ).toBe(403);
  await login(page, 2);
  await page.goto('/bag-filter/equipment/422-bf1');
  await expect(page.getByRole('button', { name: 'Pilih banyak', exact: true })).toBeEnabled();
  expect((await page.request.get('/bag-filter/api/equipment/561-BF1/state')).status()).toBe(403);
});

test('capacity feedback and bounded sheet layout stay clear on desktop, small mobile and both themes', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((value) => localStorage.setItem('plant-ui-theme', value), theme);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 640 },
      { width: 390, height: 844 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/bag-filter/equipment/422-bf1');
      const sheet = await openBulk(page);
      await expect(sheet.locator('.sheet-grab')).toHaveCount(0);
      await expect(sheet.getByText('1 kompartemen = 136 bag', { exact: true })).toBeVisible();
      await expect(sheet.getByText('Belum ada transaksi yang disimpan.', { exact: true })).toHaveCount(0);
      const body = sheet.getByRole('region', { name: 'Daftar kompartemen', exact: true });
      const geometry = await sheet.evaluate((el) => {
        const body = el.querySelector('.bulk-scroll')!,
          footer = el.querySelector('.bulk-footer')!;
        const r = body.getBoundingClientRect(),
          f = footer.getBoundingClientRect();
        const numbers = Array.from(el.querySelectorAll('.bulk-preview strong')).map(
          (n) => n.getBoundingClientRect().top,
        );
        const buttons = Array.from(el.querySelectorAll('.bulk-footer-actions button')).map((n) =>
          n.getBoundingClientRect(),
        );
        return {
          bodyHeight: r.height,
          noOverlap: r.bottom <= f.top + 1,
          rootOverflow: el.scrollHeight > el.clientHeight + 1,
          numberDelta: Math.max(...numbers) - Math.min(...numbers),
          ratio: buttons[1].width / buttons[0].width,
          fillsFooter:
            Math.abs(buttons[0].left - f.left - 20) < 1 && Math.abs(buttons[1].right - f.right + 20) < 1,
        };
      });
      expect(geometry.rootOverflow).toBe(false);
      expect(geometry.noOverlap).toBe(true);
      expect(geometry.bodyHeight).toBeGreaterThan(
        viewport.height <= 568 ? 200 : viewport.height <= 640 ? 240 : 400,
      );
      expect(geometry.numberDelta).toBeLessThan(1);
      expect(geometry.ratio).toBeCloseTo(2, 1);
      expect(geometry.fillsFooter).toBe(true);
      for (const label of ['1A', '2A', '3A'])
        await sheet.getByRole('checkbox', { name: `Comp. ${label}`, exact: true }).check();
      await expect(sheet.getByRole('checkbox', { name: 'Comp. 4A', exact: true })).toBeDisabled();
      await expect(sheet.getByRole('checkbox', { name: 'Comp. 3A', exact: true })).toBeEnabled();
      await expect(sheet.getByRole('status')).toContainText('92 bag tersisa');
      await body.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(sheet.getByRole('checkbox', { name: 'Comp. 15B', exact: true })).toBeInViewport();
      await expect(sheet.locator('.bulk-scroll-frame')).toHaveAttribute('data-scroll-end', 'false');
      await sheet.screenshot({
        path: `test-results/bulk-polish-${theme}-${viewport.width}-${viewport.height}.png`,
      });
      const footerBefore = (await sheet.locator('.bulk-footer').boundingBox())!.height;
      await sheet.getByRole('button', { name: 'Area bag', exact: true }).click();
      await choose(page, 'Kompartemen area', 'Comp. 4A');
      await expect(sheet.locator('[data-preview="total"]')).toHaveText('136');
      // Apply an existing 408-bag base, then preview a full fourth compartment in area mode.
      await sheet.getByRole('button', { name: 'Kompartemen penuh', exact: true }).click();
      await sheet.getByRole('button', { name: 'Tambahkan pilihan', exact: true }).click();
      const overflow = await openBulk(page);
      await overflow.getByRole('button', { name: 'Area bag', exact: true }).click();
      await choose(page, 'Kompartemen area', 'Comp. 4A');
      await expect(overflow.locator('[data-preview="total"]')).toHaveText('544');
      await expect(overflow.getByRole('alert')).toHaveText('Lebih 44 bag. Perkecil area.');
      await expect(overflow.getByRole('button', { name: 'Tambahkan pilihan', exact: true })).toBeDisabled();
      const feedback = await overflow.evaluate((el) => {
        const number = el.querySelector<HTMLElement>('[data-preview="total"]')!;
        const positions = Array.from(el.querySelectorAll('.bulk-preview strong')).map(
          (n) => n.getBoundingClientRect().top,
        );
        return {
          color: getComputedStyle(number).color,
          textColor: getComputedStyle(el).color,
          delta: Math.max(...positions) - Math.min(...positions),
          footerHeight: el.querySelector('.bulk-footer')!.getBoundingClientRect().height,
          bodyHeight: el.querySelector('.bulk-scroll')!.getBoundingClientRect().height,
        };
      });
      expect(feedback.color).not.toBe(feedback.textColor);
      expect(feedback.delta).toBeLessThan(1);
      expect(feedback.footerHeight - footerBefore).toBeLessThanOrEqual(17);
      expect(feedback.bodyHeight).toBeGreaterThan(
        viewport.height <= 568 ? 200 : viewport.height <= 640 ? 240 : 400,
      );
      await overflow.screenshot({
        path: `test-results/bulk-polish-overflow-${theme}-${viewport.width}-${viewport.height}.png`,
      });
      await page.keyboard.press('Escape');
    }
  }
});
