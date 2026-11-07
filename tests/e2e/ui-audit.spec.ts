import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import {
  createUser,
  setGrant,
  setAppGrant,
  changePassword,
  closeAuthDb,
  getAuthDb,
  authSchema,
} from '@plant/auth-core';
import { closeConsumablesDb, getConsumablesDb } from '@plant/consumables-core';
import * as s from '@plant/consumables-core/schema';
import { type Identity, type InventoryItem } from '@plant/contracts';
import { emptyCart, cartKey } from '../../packages/ui/src/r22-cart';
test.use({ video: { mode: 'on', size: { width: 375, height: 812 } } });
const email = `audit-${randomUUID()}@example.test`,
  password = randomUUID() + randomUUID();
const actor: Identity = {
  id: randomUUID(),
  email,
  name: 'Audit browser',
  position: '',
  portalAdmin: true,
  mustChangePassword: false,
  grants: [],
};
let client: APIRequestContext, userId: string;
const materials: string[] = [];
let inventory: InventoryItem[];
async function save(path: string, data: unknown) {
  const r = await client.post(path, {
    data,
    headers: { origin: process.env.PUBLIC_ORIGIN!, 'Idempotency-Key': randomUUID() },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
test.beforeAll(async () => {
  const temporary = randomUUID();
  userId = (await createUser(actor, { email, password: temporary, name: actor.name })).id;
  await setGrant(actor, userId, { appId: 'bag-filter', role: 'viewer', equipment: ['L61-BF1'] });
  await setAppGrant(actor, userId, 'consumables', { appId: 'consumables', role: 'admin' });
  await changePassword({ ...actor, id: userId }, temporary, password);
  client = await request.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
  await save('/auth/api/sign-in/email', { email, password });
  for (let i = 0; i < 2; i++) {
    const m = await save('/consumables/api/materials', {
      mmid: `UI-AUDIT-${userId}-${i}`,
      description: `Material uji ${i}`,
      commonName: `Material ${i}`,
      unit: 'PCS',
      sapUnit: 'PCS',
      category: 'Uji UI',
      decimalAllowed: false,
    });
    materials.push(m.id);
    await save('/consumables/api/inventory', { materialId: m.id, rack: `A-${i}` });
    await save('/consumables/api/opening-balances', {
      materialId: m.id,
      quantity: '100',
      reason: 'Data sintetis audit UI',
      expectedVersion: 1,
    });
  }
  inventory = (
    await (
      await client.get('/consumables/api/inventory?q=' + encodeURIComponent(`UI-AUDIT-${userId}`))
    ).json()
  ).items;
});
test.afterAll(async () => {
  try {
    if (materials.length)
      await getConsumablesDb().transaction(async (tx) => {
        await tx.delete(s.idempotency).where(eq(s.idempotency.actorId, userId));
        await tx.delete(s.audit).where(eq(s.audit.actorId, userId));
        await tx.delete(s.movements).where(inArray(s.movements.materialId, materials));
        await tx.delete(s.inventory).where(inArray(s.inventory.materialId, materials));
        await tx.delete(s.materials).where(inArray(s.materials.id, materials));
        await tx.delete(s.audit).where(eq(s.audit.actorId, userId));
        await tx.delete(s.idempotency).where(eq(s.idempotency.actorId, userId));
      });
    if (userId)
      await getAuthDb().transaction(async (tx) => {
        await tx.delete(authSchema.session).where(eq(authSchema.session.userId, userId));
        await tx.delete(authSchema.grants).where(eq(authSchema.grants.userId, userId));
        await tx.delete(authSchema.account).where(eq(authSchema.account.userId, userId));
        await tx.delete(authSchema.user).where(eq(authSchema.user.id, userId));
        await tx.delete(authSchema.audit).where(inArray(authSchema.audit.actorId, [userId, actor.id]));
      });
  } finally {
    await client?.dispose();
    await Promise.all([closeAuthDb(), closeConsumablesDb()]);
  }
});
async function start(page: Page, motion: 'reduce' | 'no-preference' = 'reduce') {
  await page.context().addCookies((await client.storageState()).cookies);
  await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript(() => localStorage.setItem('plant-ui-theme', 'light'));
}
test('portal uses symmetric summaries, a contextual badge and no full dashboard', async ({ page }) => {
  await start(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const bag = await (await client.get('/bag-filter/api/dashboard')).json();
  await page.route('**/bag-filter/api/dashboard*', (route) =>
    route.fulfill({
      json: {
        ...bag,
        recent: [
          {
            id: randomUUID(),
            equipmentCode: 'L61-BF1',
            wo: 'W'.repeat(100),
            reason: 'Data sintetis',
            brand: null,
            actorName: actor.name,
            positionCount: 500,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.application-summary')).toHaveCount(2);
  await expect(
    page.locator('.portal-hub .feature-widget, .portal-hub .bar-chart, .portal-hub .quarter-chart'),
  ).toHaveCount(0);
  await expect(page.locator('.portal-hub .eyebrow')).toHaveCount(1);
  await expect(page.getByText('Hanya lihat', { exact: true })).toBeVisible();
  const cards = await page
    .locator('.application-summary')
    .evaluateAll((els) =>
      els.map((e) => ({ top: e.getBoundingClientRect().top, height: e.getBoundingClientRect().height })),
    );
  expect(Math.abs(cards[0].top - cards[1].top)).toBeLessThan(1);
  expect(Math.abs(cards[0].height - cards[1].height)).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(1350);
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
test('filters and pagination fetch while browser timers are paused, retaining the current rows', async ({
  page,
}) => {
  await start(page);
  let hold = false,
    seen = '',
    release = () => {};
  let gate = Promise.resolve();
  await page.route('**/consumables/api/inventory?*', async (route) => {
    const url = new URL(route.request().url());
    if (hold) {
      seen = url.search;
      await gate;
    }
    await route.fulfill({
      json: { items: inventory, nextCursor: url.searchParams.has('cursor') ? null : 'next-page' },
    });
  });
  await page.goto('/consumables/stock');
  await expect(page.locator('.stock-table-row')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Ketersediaan', exact: true }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  hold = true;
  gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.getByRole('option', { name: 'Tersedia', exact: true }).click({ force: true });
  await expect.poll(() => seen).toContain('availability=available');
  await expect(page.locator('.stock-table-row')).toHaveCount(2);
  await expect(page.locator('.stock-table')).toHaveAttribute('aria-busy', 'true');
  release();
  await page.clock.resume();
  await expect(page.locator('.stock-table')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('dialog', { name: 'Ketersediaan', exact: true })).toBeHidden();
  seen = '';
  gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.clock.pauseAt(new Date());
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click({ force: true });
  await expect.poll(() => seen).toContain('cursor=next-page');
  await expect(page.locator('.stock-table-row')).toHaveCount(2);
  release();
  await page.clock.resume();
});
test('material detail uses a sheet, keeps its selected row and moves with arrow keys', async ({ page }) => {
  await start(page);
  await page.route('**/consumables/api/inventory?*', (r) =>
    r.fulfill({ json: { items: inventory, nextCursor: null } }),
  );
  await page.goto('/consumables/stock');
  await page.locator('.stock-table-row').first().click();
  const sheet = page.locator('.overlay-sheet[open]');
  await expect(sheet).toContainText(inventory[0].mmid);
  await expect(page.locator('.stock-table-row.selected')).toContainText(inventory[0].mmid);
  await page.keyboard.press('ArrowDown');
  await expect(sheet).toContainText(inventory[1].mmid);
  await expect(page.locator('.stock-table-row.selected')).toContainText(inventory[1].mmid);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});
test('switching catalog and stock tabs never renders material data as inventory rows', async ({ page }) => {
  await start(page);
  const keyWarnings: string[] = [];
  page.on('console', (message) => {
    if (/unique.*key|same key/i.test(message.text())) keyWarnings.push(message.text());
  });
  const catalog = inventory.map(
    ({ inventoryId, rack, quantity, initialized, inventoryActive, inventoryVersion, ...material }) =>
      material,
  );
  let hold = false,
    release = () => {};
  let gate = Promise.resolve();
  await page.route('**/consumables/api/materials?*', (route) =>
    route.fulfill({ json: { items: catalog, nextCursor: null } }),
  );
  await page.route('**/consumables/api/inventory?*', async (route) => {
    if (hold) await gate;
    await route.fulfill({ json: { items: inventory, nextCursor: null } });
  });
  try {
    await page.goto('/consumables/stock');
    await expect(page.locator('.stock-table-row')).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Katalog master', exact: true }).click();
      await expect(page.locator('.stock-table')).toHaveAttribute('aria-busy', 'false');
      await expect(page.locator('.stock-table-head')).toContainText('SAP/MMID');
      hold = true;
      gate = new Promise((resolve) => {
        release = resolve;
      });
      await page.getByRole('button', { name: 'Stok R22', exact: true }).click();
      await expect(page.locator('.stock-table')).toHaveAttribute('aria-busy', 'true');
      await expect(page.locator('.stock-table-row')).toHaveCount(0);
      await expect(page.locator('.table-skeleton')).toBeVisible();
      release();
      await expect(page.locator('.stock-table')).toHaveAttribute('aria-busy', 'false');
      await expect(page.locator('.stock-table-row')).toHaveCount(2);
      await expect(page.locator('.stock-table-row').first()).toContainText(inventory[0].rack);
    }
    await page.goto('/consumables/manage');
    await expect(page.locator('.stock-table-row')).toHaveCount(2);
    gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.getByRole('button', { name: 'Stok, rak & saldo awal', exact: true }).click();
    await expect(page.locator('.stock-table-row')).toHaveCount(0);
    await expect(page.locator('.table-skeleton')).toBeVisible();
    release();
    await expect(page.locator('.stock-table-row')).toHaveCount(2);
    await expect(page.locator('.stock-table')).toHaveAttribute('aria-busy', 'false');
    expect(keyWarnings).toEqual([]);
  } finally {
    release();
  }
});
test('pill toggle thumb contrasts with its track in both themes and checked states', async ({ page }) => {
  await start(page);
  await page.goto('/consumables/consume');
  const toggle = page.getByRole('switch', { name: 'Catat untuk pengguna lain', exact: true });
  await expect(toggle).toBeEnabled();
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: 'Tema', exact: true }).click();
    await page.getByRole('button', { name: theme === 'dark' ? 'Gelap' : 'Terang', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Tema', exact: true })).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const checked of [false, true]) {
      await toggle.setChecked(checked);
      await toggle.blur();
      await toggle
        .locator('..')
        .screenshot({ path: `.test-runtime/toggle-${theme}-${checked ? 'on' : 'off'}.png` });
      const colors = await toggle.evaluate((el) => {
        const luminance = (color: string) =>
          (color.match(/[\d.]+/g) || [])
            .slice(0, 3)
            .map(Number)
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const track = getComputedStyle(el).backgroundColor,
          thumb = getComputedStyle(el, '::after').backgroundColor,
          a = luminance(track),
          b = luminance(thumb);
        return { track, thumb, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
      expect(
        colors.contrast,
        `${theme}, checked=${checked}: ${JSON.stringify(colors)}`,
      ).toBeGreaterThanOrEqual(3);
    }
  }
});
test('cart undo restores only the removed row and the mobile save action stays visible', async ({ page }) => {
  await start(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(({ key, draft }) => sessionStorage.setItem(key, JSON.stringify(draft)), {
    key: cartKey(userId, 'consume'),
    draft: {
      ...emptyCart(),
      hec: '452-BU1',
      lines: inventory.map((material) => ({ material, quantity: '2' })),
    },
  });
  await page.goto('/consumables/consume');
  await expect(page.locator('.r22-cart-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Simpan order', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: `Hapus ${inventory[0].mmid}`, exact: true }).click();
  await expect(page.locator('.r22-cart-row')).toHaveCount(1);
  await page.getByLabel('HAC/SAC / Lokasi fungsional').fill('451-BU2');
  await page.getByRole('button', { name: 'Urungkan', exact: true }).click();
  await expect(page.locator('.r22-cart-row')).toHaveCount(2);
  await expect(page.getByLabel('HAC/SAC / Lokasi fungsional')).toHaveValue('451-BU2');
  await expect(page.locator('.r22-cart-row').first().locator('input')).toHaveValue('2');
});
test('menu exit preserves focus, anchored origin and a visible intermediate presentation', async ({
  page,
}) => {
  await start(page, 'no-preference');
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Tema', exact: true });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Tema', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('opacity', '1');
  expect(await menu.evaluate((el) => el.style.getPropertyValue('--anchor-origin'))).toMatch(
    /top (left|right)/,
  );
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('data-closing', '');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await trigger.click();
  await expect(menu).toBeVisible();
});

test.describe('gesture regression', () => {
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
  });
  test('drawer rubber bands, reverses a drag and dismisses on a short outward flick', async ({ page }) => {
    await start(page, 'no-preference');
    await page.goto('/');
    const cdp = await page.context().newCDPSession(page);
    const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number) => {
      await cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: x === undefined ? [] : [{ x, y: 180, id: 1 }],
      });
    };
    const trigger = page.getByRole('button', { name: 'Buka navigasi', exact: true });
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Navigasi', exact: true });
    await expect(drawer).toBeVisible();
    await expect
      .poll(() => drawer.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41))
      .toBe(0);
    // Invalid direction keeps resistance rather than hitting a hard boundary.
    await touch('touchStart', 100);
    await touch('touchMove', 170);
    await expect
      .poll(() => drawer.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41))
      .toBeGreaterThan(0);
    const resisted = await drawer.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
    expect(resisted).toBeLessThan(70);
    await touch('touchEnd');
    await expect
      .poll(() =>
        drawer.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)),
      )
      .toBeLessThan(1);
    // A long drag followed by a reverse release returns to its open position.
    await touch('touchStart', 240);
    for (const x of [190, 140, 90, 70, 100, 140, 170, 200]) {
      await touch('touchMove', x);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    await expect(drawer).toBeVisible();
    await expect
      .poll(() =>
        drawer.evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)),
      )
      .toBeLessThan(1);
    await page.evaluate(() => {
      const samples: unknown[] = [];
      (window as any).__gestureSamples = samples;
      for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
        document.addEventListener(
          name,
          (e) => {
            const p = e as PointerEvent;
            samples.push({ name, x: p.clientX, time: p.timeStamp });
          },
          true,
        );
    });
    // Less than half the panel width, with sufficient outward velocity.
    await touch('touchStart', 240);
    await touch('touchMove', 225);
    await touch('touchMove', 200);
    await touch('touchEnd');
    await page.waitForTimeout(400);
    await test.info().attach('gesture-pointer-samples', {
      body: JSON.stringify(await page.evaluate(() => (window as any).__gestureSamples)),
      contentType: 'application/json',
    });
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    await cdp.detach();
  });
});

test('large browser text and accessibility media retain usable Portal, tables and long carts', async ({
  page,
}) => {
  await start(page);
  await page.addInitScript(
    ({ userId, material, blank }) => {
      const lines = Array.from({ length: 20 }, (_, i) => ({
        material: {
          ...material,
          id: `font-${i}`,
          mmid: `FONT-${i}`,
          description: `Material uji ukuran teks ${i}`,
        },
        quantity: '1',
        mode: 'base',
      }));
      for (const type of ['consume', 'picklist'])
        sessionStorage.setItem(
          `r22-cart:${userId}:${type}`,
          JSON.stringify({ ...blank, hec: '452-BU1', lines }),
        );
    },
    { userId, material: inventory[0], blank: emptyCart() },
  );
  const cdp = await page.context().newCDPSession(page);
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((value) => localStorage.setItem('plant-ui-theme', value), theme);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        '/',
        '/consumables',
        '/consumables/stock',
        '/consumables/consume',
        '/consumables/picklist',
      ]) {
        await page.goto(path);
        await expect(page.locator('.shell:not(.shell-skeleton) h1').first()).toBeVisible();
        await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${path} at ${width}px, ${theme}`,
        ).toBeTruthy();
        if (path.endsWith('/consume') && width === 375)
          await expect(page.getByRole('button', { name: 'Simpan order', exact: true })).toBeInViewport();
      }
    }
  }
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-reduced-transparency', value: 'reduce' },
      { name: 'prefers-contrast', value: 'more' },
    ],
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tema', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Tema', exact: true });
  await expect(menu).toHaveCSS('backdrop-filter', 'none');
  expect(await menu.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toContain('rgba');
  const borderContrast = await menu.evaluate((el) => {
    const color = (value: string) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = (c: number[]) =>
      c
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
    const style = getComputedStyle(el),
      a = luminance(color(style.borderTopColor)),
      b = luminance(color(style.backgroundColor));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(borderContrast).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await page.goto('/consumables/consume');
  await page.getByRole('combobox', { name: /Cari material/ }).fill(`UI-AUDIT-${userId}`);
  const results = page.locator('.r22-search-options');
  await expect(results).toBeVisible();
  await expect(results).toHaveCSS('backdrop-filter', 'none');
  expect(await results.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toContain('rgba');

  expect(
    await page.evaluate(() =>
      [
        'prefers-reduced-motion: reduce',
        'prefers-reduced-transparency: reduce',
        'prefers-contrast: more',
      ].every((query) => matchMedia(`(${query})`).matches),
    ),
  ).toBeTruthy();
  await cdp.detach();
});

test('RSC page requests keep their grants without forwarding framework headers into auth subrequests', async ({
  page,
}) => {
  await start(page);
  for (const path of ['/', '/bag-filter', '/consumables/stock']) {
    const response = await page.request.get(path, { headers: { RSC: '1' } });
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('text/x-component');
  }
});
