import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  authSchema,
  getAuthDb,
  closeAuthDb,
  createUser,
  setGrant,
  updateUserAccess,
  changePassword,
} from '@plant/auth-core';
import { equipmentCodes, type Identity } from '@plant/contracts';

const origin = process.env.PUBLIC_ORIGIN!;
const email = `theme-${randomUUID()}@example.test`;
const password = 'Theme-test-password-2026';
let userId: string;
test.beforeAll(async () => {
  const [bootstrap] = await getAuthDb()
    .select()
    .from(authSchema.user)
    .where(eq(authSchema.user.email, process.env.BOOTSTRAP_EMAIL!));
  if (!bootstrap) throw new Error('Bootstrap is required');
  const actor = { ...bootstrap, mustChangePassword: false, grants: [] } as Identity;
  const temp = 'Theme-temporary-password-2026';
  const created = await createUser(actor, {
    email,
    password: temp,
    name: 'Theme validation',
    position: 'Test',
  });
  userId = created.id;
  await setGrant(actor, userId, { appId: 'bag-filter', role: 'admin', equipment: [...equipmentCodes] });
  await updateUserAccess(actor, userId, { active: true, portalAdmin: true });
  await changePassword({ ...actor, id: userId, name: 'Theme validation', email }, temp, password);
});
test.afterAll(async () => {
  try {
    if (userId)
      await getAuthDb().transaction(async (tx) => {
        await tx.delete(authSchema.session).where(eq(authSchema.session.userId, userId));
        await tx.delete(authSchema.account).where(eq(authSchema.account.userId, userId));
        await tx.delete(authSchema.grants).where(eq(authSchema.grants.userId, userId));
        await tx.delete(authSchema.user).where(eq(authSchema.user.id, userId));
      });
  } finally {
    await closeAuthDb();
  }
});

async function choose(page: Page, value: 'light' | 'dark') {
  const toggle = page.getByRole('button', { name: 'Tema gelap', exact: true });
  await expect(toggle).toBeEnabled();
  if ((await page.locator('html').getAttribute('data-theme-preference')) !== value) {
    await toggle.click();
    if ((await page.locator('html').getAttribute('data-theme')) !== value) await toggle.click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', value);
  await expect(toggle).toHaveAttribute('aria-pressed', String(value === 'dark'));
}

test('system theme, explicit choice, cross-tab sync and blocked storage', async ({
  page,
  context,
  browser,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/auth/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.getByRole('button', { name: 'Tema gelap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await choose(page, 'dark');
  // Session-storage events must not override local preference, including clear events.
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: null,
        newValue: null,
        storageArea: sessionStorage,
      }),
    ),
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const tab = await context.newPage();
  await tab.goto('/auth/login');
  await expect(tab.locator('html')).toHaveAttribute('data-theme', 'dark');
  await choose(page, 'light');
  await expect(tab.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(tab.getByRole('button', { name: 'Tema gelap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await tab.evaluate(() => localStorage.setItem('plant-ui-theme', 'system'));
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => localStorage.setItem('plant-ui-theme', 'invalid'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await page.evaluate(() => {
    localStorage.setItem('plant-ui-theme', 'light');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.getByRole('button', { name: 'Tema gelap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  // Space and Enter operate the icon toggle without losing focus.
  await page.getByRole('button', { name: 'Tema gelap', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await tab.close();

  const blocked = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    colorScheme: 'light',
  });
  await blocked.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    }),
  );
  const blockedPage = await blocked.newPage();
  const errors: string[] = [];
  blockedPage.on('pageerror', (e) => errors.push(e.message));
  await blockedPage.goto('/auth/login');
  await choose(blockedPage, 'dark');
  await expect(blockedPage.locator('html')).toHaveAttribute('data-theme', 'dark');
  await blockedPage.reload();
  await expect(blockedPage.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
  await blocked.close();
});

test('history coordinate chips remain readable at rest, hover and keyboard focus', async ({ page }) => {
  const login = await page.request.post('/auth/api/sign-in/email', {
    headers: { origin },
    data: { email, password },
  });
  expect(login.status()).toBe(200);
  await page.route('**/bag-filter/api/equipment/561-BF1/batches?*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'theme-contrast-fixture',
            installedAt: '2026-09-01T00:00:00.000Z',
            createdAt: '2026-09-01T00:00:00.000Z',
            actorName: 'Audit tampilan',
            wo: 'WO-THEME',
            reason: 'Pemeriksaan keterbacaan history',
            brand: 'Filtras',
            positionCount: 2,
            positions: [
              { side: 'Utara', compartment: 1, column: 1, row: 1 },
              { side: 'Selatan', compartment: 1, column: 8, row: 1 },
            ],
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.goto('/bag-filter/equipment/561-bf1');
  const chip = page.locator('.coordinate-links button').first();
  await expect(chip).toHaveText('1 H1');
  for (const theme of ['light', 'dark'] as const) {
    await choose(page, theme);
    for (const state of ['rest', 'hover', 'focus']) {
      if (state === 'rest') await page.mouse.move(0, 0);
      if (state === 'hover') await chip.hover();
      if (state === 'focus') {
        await page.mouse.move(0, 0);
        await chip.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(chip).toBeFocused();
      }
      const ratio = await chip.evaluate((el) => {
        const lum = (color: string) => {
          const c = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
        };
        const s = getComputedStyle(el),
          a = lum(s.color),
          b = lum(s.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(ratio, `${theme} ${state}`).toBeGreaterThanOrEqual(4.5);
    }
    const toggle = page.getByRole('button', { name: 'Tema gelap', exact: true });
    expect((await toggle.boundingBox())!.width).toBeLessThanOrEqual(40);
    await page
      .locator('.history-item')
      .screenshot({ path: `test-results/theme-${theme}-history-readable.png` });
  }
});

test('theme is set before hydration even when framework scripts are blocked', async ({ browser }) => {
  for (const [saved, system, expected] of [
    ['dark', 'light', 'dark'],
    ['light', 'dark', 'light'],
    ['system', 'dark', 'dark'],
  ] as const) {
    const context = await browser.newContext({
      baseURL: origin,
      ignoreHTTPSErrors: true,
      colorScheme: system,
    });
    await context.addInitScript((value) => localStorage.setItem('plant-ui-theme', value), saved);
    await context.route('**/_next/static/**/*.js', (route) => route.abort());
    const page = await context.newPage();
    await page.goto('/auth/login');
    await expect(page.getByRole('heading', { name: 'Masuk ke portal' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
    await expect(page.locator('html')).toHaveCSS('color-scheme', expected);
    await expect(page.getByRole('button', { name: 'Tema gelap', exact: true })).toBeDisabled();
    await context.close();
  }
});

test('all zones and maps in both themes, contrast, draft preservation and logout', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /hydration|hydrated|Minified React/.test(m.text())) errors.push(m.text());
  });
  const login = await page.request.post('/auth/api/sign-in/email', {
    headers: { origin },
    data: { email, password },
  });
  expect(login.status()).toBe(200);
  await page.goto('/');
  for (const theme of ['light', 'dark'] as const) {
    await choose(page, theme);
    for (const path of [
      '/',
      '/profile',
      '/admin',
      '/auth/change-password',
      '/bag-filter',
      '/bag-filter/audit',
      ...equipmentCodes.map((code) => `/bag-filter/equipment/${code.toLowerCase()}`),
    ]) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Tema gelap', exact: true })).toBeEnabled();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path.includes('/equipment/')) {
        await expect(page.locator('.overview-cell').first()).toBeVisible();
        const orders = await page
          .locator('.overview-band')
          .last()
          .locator('.overview-compartment')
          .evaluateAll((els) => els.map((el) => Array.from(el.children).map((c) => c.className)));
        for (const order of orders)
          expect(order).toEqual(['overview-title', 'overview-labels', 'overview-matrix']);
      }
      if (
        [
          '/',
          '/auth/change-password',
          '/bag-filter/equipment/l61-bf1',
          '/bag-filter/equipment/421-bf1',
        ].includes(path)
      ) {
        await page.screenshot({
          path: `test-results/theme-${theme}-${path.replaceAll('/', '_') || 'portal'}-desktop.png`,
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('button', { name: 'Tema gelap', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path.includes('/equipment/')) {
        await page.locator('#bag-detail').scrollIntoViewIfNeeded();
        await expect(page.locator('.bag-cell').first()).toBeVisible();
      }
      if (['/', '/auth/change-password', '/bag-filter/equipment/l61-bf1'].includes(path)) {
        await page.screenshot({
          path: `test-results/theme-${theme}-${path.replaceAll('/', '_') || 'portal'}-mobile.png`,
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    // Resolve the real CSS tokens in the browser, including light-dark() and aliases.
    const ratios = await page.evaluate(() => {
      const luminance = (color: string) => {
        const rgb = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const pairs: [string, string, number][] = [
        ['--text', '--page', 4.5],
        ['--text', '--surface', 4.5],
        ['--text-muted', '--page', 4.5],
        ['--text-muted', '--surface', 4.5],
        ['--text-muted', '--surface-muted', 4.5],
        ['--on-action', '--action', 4.5],
        ['--on-action', '--action-hover', 4.5],
        ['--on-selection', '--bag-selected', 4.5],
        ['--info-text', '--info-bg', 4.5],
        ['--info-text', '--info-hover', 4.5],
        ['--success-text', '--success-bg', 4.5],
        ['--warning-text', '--warning-bg', 4.5],
        ['--danger-text', '--danger-bg', 4.5],
        ['--inverse-text', '--danger-solid', 4.5],
        ['--inverse-text', '--compartment-bg', 4.5],
        ['--inverse-text', '--compartment-hover', 4.5],
        ['--inverse-text', '--brand-green', 4.5],
        ['--inverse-muted', '--brand-green', 4.5],
        ['--inverse-muted', '--sidebar-bg', 4.5],
        ['--control-border', '--surface', 3],
        ['--focus', '--surface', 3],
        ['--focus', '--page', 3],
        ['--focus', '--surface-muted', 3],
      ];
      const el = document.createElement('span');
      document.body.appendChild(el);
      const result = pairs.map(([fg, bg, min]) => {
        el.style.color = `var(${fg})`;
        el.style.backgroundColor = `var(${bg})`;
        const style = getComputedStyle(el),
          a = luminance(style.color),
          b = luminance(style.backgroundColor);
        return { pair: `${fg}/${bg}`, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), min };
      });
      el.remove();
      return result;
    });
    for (const pair of ratios) expect(pair.ratio, `${theme} ${pair.pair}`).toBeGreaterThanOrEqual(pair.min);
  }
  await page.goto('/profile');
  await page.getByRole('combobox', { name: 'Preferensi tema' }).selectOption('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.getByRole('button', { name: 'Tema gelap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByRole('button', { name: 'Tema gelap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Tema gelap', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Preferensi tema' })).toHaveValue('light');
  await page.goto('/bag-filter/equipment/561-bf1');
  const selected = page.locator('.bag-cell').first();
  await selected.click();
  await page.getByLabel('Brand/Pabrikan', { exact: true }).selectOption('Filtras');
  await page.getByLabel('Alasan penggantian / pemasangan awal').fill('Draft tema');
  for (const theme of ['light', 'dark'] as const) {
    await choose(page, theme);
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(selected).toHaveCSS('background-color', 'rgb(255, 115, 0)');
    await expect(page.getByLabel('Brand/Pabrikan', { exact: true })).toHaveValue('Filtras');
    await expect(page.getByLabel('Alasan penggantian / pemasangan awal')).toHaveValue('Draft tema');
    await selected.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(selected).toHaveCSS('outline-offset', '3px');
  }
  await page.locator('.sidebar nav a[aria-current="page"]').hover();
  await expect(page.locator('.sidebar nav a[aria-current="page"]')).toHaveCSS(
    'background-color',
    'rgb(189, 251, 7)',
  );
  await page.locator('.sidebar .logout').click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/theme-dark-login.png', fullPage: true });
  await choose(page, 'light');
  await page.screenshot({ path: 'test-results/theme-light-login.png', fullPage: true });
  expect(errors).toEqual([]);
});
