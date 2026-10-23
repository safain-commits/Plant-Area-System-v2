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

async function choose(page: Page, value: 'light' | 'dark' | 'system') {
  const button = page.getByRole('button', { name: 'Tema', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await page
    .getByRole('button', { name: { light: 'Terang', dark: 'Gelap', system: 'Sistem' }[value], exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', value);
}
async function select(page: Page, name: string | RegExp, value: string) {
  const trigger = page.getByRole('combobox', { name, exact: typeof name === 'string' });
  const label = await trigger.evaluate(
    (el, v) =>
      Array.from((el.parentElement!.querySelector('select') as HTMLSelectElement).options)
        .find((o) => o.value === v)
        ?.textContent?.trim(),
    value,
  );
  if (!label) throw Error('Unknown option');
  await trigger.click();
  await page.getByRole('option', { name: label, exact: true }).click();
}
async function login(page: Page) {
  const r = await page.request.post('/auth/api/sign-in/email', {
    headers: { origin },
    data: { email, password },
  });
  expect(r.status()).toBe(200);
}

async function contrastTokens(page: Page) {
  const results = await page.evaluate(() => {
    const pairs = [
      ['textPrimary', 'canvas'],
      ['textSecondary', 'canvas'],
      ['caption-canvas', 'canvas'],
      ['textPrimary', 'surface'],
      ['textSecondary', 'surface'],
      ['textMuted', 'surface'],
      ['textPrimary', 'surfaceMuted'],
      ['textSecondary', 'surfaceMuted'],
      ['textPrimary', 'surfaceSunken'],
      ['textSecondary', 'surfaceSunken'],
      ['buttonPrimaryText', 'buttonPrimaryBg'],
      ['buttonPrimaryText', 'buttonPrimaryHover'],
      ['buttonAccentText', 'buttonAccentBg'],
      ['buttonAccentText', 'buttonAccentHover'],
      ['positiveText', 'surface'],
      ['negativeText', 'surface'],
      ['warningText', 'surface'],
      ['success-text', 'success-bg'],
      ['warning-text', 'warning-bg'],
      ['danger-text', 'danger-bg'],
      ['sidebar-text', 'sidebar-bg'],
      ['sidebar-textMuted', 'sidebar-bg'],
      ['sidebar-itemActiveText', 'sidebar-itemActiveBg'],
      ['tooltipText', 'tooltipBg'],
      ['gray-950', 'danger'],
      ['textSecondary', 'empty-bag'],
      ['gray-950', 'primary-400'],
      ['gray-950', 'primary-600'],
    ];
    const probe = document.createElement('span');
    document.body.append(probe);
    const ctx = document.createElement('canvas').getContext('2d')!;
    const luminance = (color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const values = [...ctx.getImageData(0, 0, 1, 1).data]
        .slice(0, 3)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const results = pairs.map(([fg, bg]) => {
      probe.style.color = `var(--${fg})`;
      probe.style.backgroundColor = `var(--${bg})`;
      const style = getComputedStyle(probe),
        a = luminance(style.color),
        b = luminance(style.backgroundColor);
      return { fg, bg, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
    for (const el of document.querySelectorAll('.nav-children a[aria-current="page"]')) {
      if (!el.getClientRects().length) continue;
      const style = getComputedStyle(el),
        a = luminance(style.color),
        b = luminance(style.backgroundColor);
      results.push({
        fg: 'active equipment text',
        bg: 'rendered equipment link',
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      });
    }
    probe.remove();
    return results;
  });
  for (const result of results)
    expect(result.ratio, `${result.fg} on ${result.bg}`).toBeGreaterThanOrEqual(4.5);
}

test('theme menu, system changes, cross-tab preferences, lifecycle and unavailable storage', async ({
  page,
  context,
  browser,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/auth/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Tema', exact: true }).click();
  await page.keyboard.press('Home');
  await expect(page.getByRole('button', { name: 'Terang', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const tab = await context.newPage();
  await tab.goto('/auth/login');
  await expect(tab.locator('html')).toHaveAttribute('data-theme', 'light');
  await choose(page, 'dark');
  await expect(tab.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: null, newValue: null, storageArea: sessionStorage }),
    ),
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await choose(page, 'system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => {
    localStorage.setItem('plant-ui-theme', 'light');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await tab.close();
  const blocked = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await blocked.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    }),
  );
  const bp = await blocked.newPage();
  await bp.goto('/auth/login');
  await choose(bp, 'dark');
  await expect(bp.locator('html')).toHaveAttribute('data-theme', 'dark');
  await bp.reload();
  await expect(bp.locator('html')).toHaveAttribute('data-theme', 'light');
  await blocked.close();
});

test('saved theme is applied before framework hydration', async ({ browser }) => {
  for (const [saved, system, expected] of [
    ['dark', 'light', 'dark'],
    ['light', 'dark', 'light'],
    ['system', 'dark', 'dark'],
  ] as const) {
    const c = await browser.newContext({ baseURL: origin, ignoreHTTPSErrors: true, colorScheme: system });
    await c.addInitScript((v) => localStorage.setItem('plant-ui-theme', v), saved);
    await c.route('**/_next/static/**/*.js', (r) => r.abort());
    const p = await c.newPage();
    await p.goto('/auth/login');
    await expect(p.locator('html')).toHaveAttribute('data-theme', expected);
    await expect(p.getByRole('button', { name: 'Tema', exact: true })).toBeDisabled();
    await c.close();
  }
});

test('all zones, responsive shell, real-data dashboard, command palette and notifications', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /hydration|Minified React/.test(m.text())) errors.push(m.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/');
  await expect(page.locator('.hero-chart-card')).toBeVisible();
  const api = await (await page.request.get('/bag-filter/api/dashboard')).json();
  expect(api.total).toBe(18784);
  expect(api.perEquipment).toHaveLength(6);
  expect(api.series.map((q: { label: string }) => q.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  await select(page, 'Tahun grafik', String(api.currentYear - 1));
  await expect(page.locator('.bar-slot')).toHaveCount(4);
  await expect(page.locator('.bar-slot small')).toHaveText(['Q1', 'Q2', 'Q3', 'Q4']);
  await expect(page.locator('.bar-chart')).toHaveAttribute(
    'aria-label',
    new RegExp(String(api.currentYear - 1)),
  );
  await select(page, 'Tahun grafik', String(api.currentYear));
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Pencarian cepat' })).toBeVisible();
  await page.getByLabel('Cari halaman, equipment, atau batch').fill('L61');
  await expect(page.locator('.command-result').filter({ hasText: 'L61-BF1' }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Notifikasi aktivitas' }).click();
  await expect(page.getByRole('dialog', { name: 'Aktivitas aplikasi' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+b');
  await expect(page.locator('.shell:visible')).toHaveAttribute('data-sidebar', 'collapsed');
  await page.reload();
  await expect(page.locator('.shell:visible')).toHaveAttribute('data-sidebar', 'collapsed');
  await page.getByRole('button', { name: 'Menu Bag Filter', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bag Filter', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+b');
  await page.goto('/admin');
  const ownRow = page.locator('.user-row').filter({ hasText: email });
  await ownRow.locator(':scope > summary').click();
  await ownRow.getByText('Reset password', { exact: true }).click();
  await ownRow.getByLabel('Password sementara baru').fill('Cancelled-password-reset-2026');
  await ownRow.getByRole('button', { name: 'Reset password pengguna', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Konfirmasi perubahan' })).toBeVisible();
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  expect((await page.request.get('/bag-filter/api/dashboard')).status()).toBe(200);
  for (const theme of ['light', 'dark'] as const) {
    await choose(page, theme);
    await contrastTokens(page);
    for (const path of [
      '/',
      '/profile',
      '/admin',
      '/auth/change-password',
      '/bag-filter',
      '/bag-filter/audit',
      ...equipmentCodes.map((code) => '/bag-filter/equipment/' + code.toLowerCase()),
    ]) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Tema', exact: true })).toBeEnabled();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const width of [390, 640, 768, 1024, 1280, 1536]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          path + ' width ' + width,
        ).toBe(true);
      }
      if (path.includes('/equipment/')) {
        await contrastTokens(page);
        if (/\/(561|562)-bf1$/.test(path)) {
          await expect(page.locator('.overview-stiffener')).toHaveCount(24);
          await expect(page.locator('.bag-stiffener')).toHaveCount(1);
          await expect(page.locator('.bag-stiffener')).toHaveAttribute(
            'aria-label',
            'Jeda antara baris 9 dan 10',
          );
          await expect(page.locator('.bag-stiffener')).toHaveCSS('margin-top', '8px');
          await expect(
            page.locator('.overview-band').first().locator('.overview-stiffener .overview-row-number'),
          ).toHaveText(Array(12).fill('9'));
          await expect(
            page.locator('.overview-band').last().locator('.overview-stiffener .overview-row-number'),
          ).toHaveText(Array(12).fill('10'));
          await page
            .locator('.overview-panel')
            .screenshot({ path: `test-results/quarter-gap-${theme}-${path.split('/').at(-1)}.png` });
        }
        await expect(page.locator('.age-buckets button')).toHaveCount(8);
        const labels = await page
          .locator('.overview-band')
          .last()
          .locator('.overview-compartment')
          .evaluateAll((els) => els.map((el) => Array.from(el.children).map((c) => c.className)));
        for (const order of labels)
          expect(order).toEqual(['overview-title', 'overview-labels', 'overview-matrix']);
      }
      if (['/', '/bag-filter/equipment/l61-bf1', '/auth/change-password'].includes(path)) {
        if (path === '/') await expect(page.locator('.hero-chart-card')).toBeVisible();
        await page.screenshot({
          path: 'test-results/refresh-' + theme + '-' + path.replaceAll('/', '_') + '-desktop.png',
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        if (path.includes('equipment')) await page.locator('#bag-detail').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: 'test-results/refresh-' + theme + '-' + path.replaceAll('/', '_') + '-mobile.png',
        });
        await page.setViewportSize({ width: 1536, height: 1000 });
      }
    }
  }
  await page.goto('/profile');
  await select(page, 'Preferensi tema', 'system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('bag ranges, drag, keyboard, legend, sheet draft, calendar and contrast', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await page.goto('/bag-filter/equipment/561-bf1');
  const cells = page.locator('.bag-cell');
  await expect(cells.first()).toHaveText('H17');
  await cells.nth(0).click();
  await cells.nth(2).click({ modifiers: ['Shift'] });
  await expect(page.locator('.selection-bar strong')).toHaveText('3 posisi dipilih');
  const before = await cells.first().evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(cells.first()).toHaveAttribute('aria-pressed', 'true');
  await cells.first().focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(cells.nth(1)).toBeFocused();
  await expect(cells.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.selection-bar').getByRole('button', { name: 'Bersihkan semua' }).click();
  const a = (await cells.nth(8).boundingBox())!,
    b = (await cells.nth(17).boundingBox())!;
  await page.mouse.move(a.x + 3, a.y + 3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 3, b.y + b.height - 3, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.selection-bar strong')).toHaveText('4 posisi dipilih');
  await page.locator('.age-buckets button').first().click();
  await expect(page.locator('.age-buckets button').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.age-buckets button').first().click();
  await page.locator('[data-sheet-trigger]:visible').click();
  await select(page, 'Brand/Pabrikan', 'Filtras');
  await page.getByLabel('Alasan penggantian / pemasangan awal').fill('Draft UI refresh');
  await page.getByRole('button', { name: 'Buka kalender pemasangan' }).click();
  await expect(page.getByRole('dialog', { name: 'Tanggal & jam pemasangan (WIB)' })).toBeVisible();
  await page.getByRole('button', { name: 'Sekarang', exact: true }).click();
  await page
    .getByRole('listbox', { name: 'Pilih jam', exact: true })
    .getByRole('option', { name: '08', exact: true })
    .click();
  await page
    .getByRole('listbox', { name: 'Pilih menit', exact: true })
    .getByRole('option', { name: '30', exact: true })
    .click();
  await expect(page.getByLabel('Jam (WIB)', { exact: true })).toHaveValue('08:30');
  await page.getByRole('button', { name: 'Selesai', exact: true }).click();
  await page.getByRole('button', { name: 'Tutup Pencatatan penggantian' }).click();
  await choose(page, 'dark');
  await expect(cells.first()).toHaveCSS('background-color', before);
  await page.locator('[data-sheet-trigger]:visible').click();
  await expect(page.getByLabel('Alasan penggantian / pemasangan awal')).toHaveValue('Draft UI refresh');
  await expect(page.getByRole('combobox', { name: 'Brand/Pabrikan', exact: true })).toHaveText('Filtras');
  await page.getByRole('button', { name: 'Tutup Pencatatan penggantian' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#bag-detail').scrollIntoViewIfNeeded();
  expect((await cells.first().boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await page.locator('.bag-grid-scroll').evaluate((el) => {
    el.scrollLeft = 96;
  });
  const headerX = (await page.locator('.bag-grid > .grid-label').first().boundingBox())!.x;
  expect(Math.abs(headerX - (await cells.first().boundingBox())!.x)).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigasi' })).toBeVisible();
  await page.keyboard.press('Escape');
});
