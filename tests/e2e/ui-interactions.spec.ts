import { test, expect, request, type Page, type Locator, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  createUser,
  setGrant,
  setAppGrant,
  changePassword,
  getAuthDb,
  closeAuthDb,
  authSchema,
} from '@plant/auth-core';
import { equipmentCodes, type Identity } from '@plant/contracts';

const email = `interactions-${randomUUID()}@example.test`,
  password = randomUUID() + randomUUID();
const actor: Identity = {
  id: randomUUID(),
  email,
  name: 'Interaction audit',
  position: '',
  portalAdmin: true,
  mustChangePassword: false,
  grants: [],
};
let userId: string, client: APIRequestContext;
test.beforeAll(async () => {
  const temporary = randomUUID();
  userId = (await createUser(actor, { email, password: temporary, name: actor.name })).id;
  await setGrant(actor, userId, { appId: 'bag-filter', role: 'admin', equipment: [...equipmentCodes] });
  await setAppGrant(actor, userId, 'consumables', { appId: 'consumables', role: 'admin', locationIds: [] });
  await changePassword({ ...actor, id: userId }, temporary, password);
  client = await request.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
  const result = await client.post('/auth/api/sign-in/email', {
    headers: { origin: process.env.PUBLIC_ORIGIN! },
    data: { email, password },
  });
  expect(result.ok()).toBeTruthy();
});
test.afterAll(async () => {
  try {
    if (userId)
      await getAuthDb().transaction(async (tx) => {
        await tx.delete(authSchema.session).where(eq(authSchema.session.userId, userId));
        await tx.delete(authSchema.grants).where(eq(authSchema.grants.userId, userId));
        await tx.delete(authSchema.account).where(eq(authSchema.account.userId, userId));
        await tx.delete(authSchema.user).where(eq(authSchema.user.id, userId));
        await tx.delete(authSchema.audit).where(eq(authSchema.audit.actorId, userId));
        await tx.delete(authSchema.audit).where(eq(authSchema.audit.actorId, actor.id));
      });
  } finally {
    await client?.dispose();
    await closeAuthDb();
  }
});
async function start(page: Page, theme = 'light') {
  await page.context().addCookies((await client.storageState()).cookies);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((value) => localStorage.setItem('plant-ui-theme', value), theme);
}
async function outside(page: Page, menu: Locator) {
  const r = (await menu.boundingBox())!,
    viewport = page.viewportSize()!;
  // Choose an actual backdrop point, not a sibling inside the menu content.
  if (r.y > 1) await page.mouse.click(viewport.width / 2, r.y / 2);
  else if (r.x > 1) await page.mouse.click(r.x / 2, viewport.height / 2);
  else await page.mouse.click(viewport.width / 2, r.y + r.height + 2);
}
async function readable(control: Locator) {
  await control.hover();
  const samples = await control.evaluate((element) => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) || []).map(Number);
    const blend = (a: number[], b: number[]) => {
      const alpha = a[3] ?? 1;
      return [0, 1, 2].map((i) => a[i] * alpha + b[i] * (1 - alpha));
    };
    const background = (el: Element | null): number[] =>
      !el ? [255, 255, 255] : blend(rgb(getComputedStyle(el).backgroundColor), background(el.parentElement));
    const luminance = (c: number[]) =>
      c
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT),
      result: { text: string; ratio: number }[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const el = node.parentElement!,
        text = node.textContent?.trim();
      if (
        !text ||
        !el.getBoundingClientRect().width ||
        !el.getBoundingClientRect().height ||
        getComputedStyle(el).visibility === 'hidden'
      )
        continue;
      const bg = background(el),
        fg = blend(rgb(getComputedStyle(el).color), bg),
        a = luminance(fg),
        b = luminance(bg);
      result.push({ text, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
    }
    return result;
  });
  for (const sample of samples)
    expect(sample.ratio, `Hovered text: ${sample.text}`).toBeGreaterThanOrEqual(4.5);
}

for (const theme of ['light', 'dark'])
  test(`hover contrast remains readable in ${theme}`, async ({ page }) => {
    await start(page, theme);
    await page.goto('/consumables');
    for (const selector of [
      '.user-menu-trigger',
      '.session-summary',
      '.sidebar .logout',
      '.application-toggle',
    ])
      await readable(page.locator(selector).first());
    await page.getByRole('combobox', { name: 'Tahun transaksi stok' }).click();
    for (const option of await page.getByRole('option').all()) await readable(option);
    await page.keyboard.press('Escape');
    await page.goto('/bag-filter');
    await readable(page.locator('.equipment-subgroup'));
    await page.goto('/consumables/stock');
    await readable(page.getByRole('combobox', { name: 'Ketersediaan', exact: true }));
    const rows = page.locator('.stock-table-row');
    if (await rows.count()) await readable(rows.first());
    await page.goto('/consumables/manage');
    const tabs = page.getByRole('group', { name: 'Pengelolaan', exact: true }).getByRole('button');
    await expect(tabs).toHaveCount(3);
    for (const tab of await tabs.all()) await readable(tab);
    await page.mouse.move(0, 0);
    await page.getByRole('button', { name: 'Menu akun', exact: true }).click();
    await outside(page, page.getByRole('dialog', { name: actor.name, exact: true }));
    await expect(page.getByRole('button', { name: 'Menu akun', exact: true })).toBeFocused();
  });

for (const width of [1440, 390])
  test(`dropdown dismissal preserves values and focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await start(page);
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    for (const [route, name] of [
      ['/consumables', 'Tahun transaksi stok'],
      ['/consumables/stock', 'Ketersediaan'],
      ['/bag-filter', 'Tahun grafik'],
    ]) {
      await page.goto(route);
      const trigger = page.getByRole('combobox', { name, exact: true }),
        menu = page.getByRole('dialog', { name: name === 'Ketersediaan' ? 'Pilih opsi' : name, exact: true });
      await expect(trigger).toBeVisible();
      const value = await trigger.textContent();
      await trigger.click();
      await expect(menu).toBeVisible();
      await menu.getByRole('textbox', { name: 'Cari opsi' }).fill('2');
      await expect(menu).toBeVisible();
      await outside(page, menu);
      await expect(menu).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveText(value!);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.click();
      const option = menu.getByRole('option').first(),
        selected = await option.textContent();
      await option.click();
      await expect(menu).not.toBeVisible();
      await expect(trigger).toHaveText(selected!);
      await trigger.click();
      const input = menu.getByRole('textbox', { name: 'Cari opsi' }),
        box = (await input.boundingBox())!;
      await page.mouse.move(box.x + 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(8, 40);
      await page.mouse.up();
      await expect(menu).toBeVisible(); // Selecting/dragging outward is not a backdrop press.
      await page.keyboard.press('Escape');
    }
    expect(failures).toEqual([]);
  });

test('nested manufacturer menu dismisses without closing or losing the replacement draft', async ({
  page,
}) => {
  await start(page, 'dark');
  await page.goto('/bag-filter/equipment/L61-BF1');
  await page.getByRole('button', { name: 'Catat penggantian', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Pencatatan penggantian', exact: true });
  const reason = sheet.getByPlaceholder('Contoh: bag bocor atau pemasangan awal');
  await reason.fill('Unsaved interaction-test draft');
  const brand = sheet.getByRole('combobox', { name: 'Brand/Pabrikan', exact: true });
  await brand.click();
  const menu = page.getByRole('dialog', { name: 'Brand/Pabrikan', exact: true });
  await outside(page, menu);
  await expect(menu).not.toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(brand).toBeFocused();
  await expect(reason).toHaveValue('Unsaved interaction-test draft');
  await brand.click();
  await page.getByRole('option', { name: 'Filtras', exact: true }).click();
  await expect(brand).toHaveText('Filtras');
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await page.getByRole('button', { name: 'Catat penggantian', exact: true }).click();
  await expect(reason).toHaveValue('Unsaved interaction-test draft');
  await expect(brand).toHaveText('Filtras');
});

test('outside pointer click on Tema closes the portal year menu before opening another menu', async ({
  page,
}) => {
  await start(page);
  await page.goto('/');
  const theme = page.getByRole('button', { name: 'Tema', exact: true });
  for (const preference of ['Terang', 'Gelap']) {
    await theme.click();
    await page
      .getByRole('dialog', { name: 'Tema', exact: true })
      .getByRole('button', { name: preference, exact: true })
      .click();
    const trigger = page.getByRole('combobox', { name: 'Tahun grafik', exact: true });
    const year = page.getByRole('dialog', { name: 'Tahun grafik', exact: true });
    const value = await trigger.textContent();
    await trigger.click();
    const box = (await theme.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(year).not.toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveText(value!);
    await expect(trigger).toBeFocused();
    await theme.click();
    await expect(page.getByRole('dialog', { name: 'Tema', exact: true })).toBeVisible();
    await expect(year).not.toBeVisible();
    await outside(page, page.getByRole('dialog', { name: 'Tema', exact: true }));
    await expect(theme).toBeFocused();
    const notification = page.getByRole('button', { name: 'Notifikasi aktivitas', exact: true });
    await notification.click();
    const activity = page.getByRole('dialog', { name: 'Aktivitas aplikasi', exact: true });
    await outside(page, activity);
    await expect(activity).not.toBeVisible();
    await expect(notification).toBeFocused();
  }
});
