import { test, expect, type Page, request, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  createUser,
  updateUserAccess,
  setGrant,
  setAppGrant,
  changePassword,
  getAuthDb,
  closeAuthDb,
  authSchema,
} from '@plant/auth-core';
import { closeConsumablesDb, getConsumablesDb } from '@plant/consumables-core';
import * as schema from '@plant/consumables-core/schema';
import { equipmentCodes, type Identity, type StockDashboard } from '@plant/contracts';

const email = `ui-polish-${randomUUID()}@example.test`,
  password = randomUUID() + randomUUID(),
  temporary = randomUUID();
const actor: Identity = {
  id: randomUUID(),
  email,
  name: 'UI review',
  position: '',
  portalAdmin: true,
  mustChangePassword: false,
  grants: [],
};
let userId: string, locationId: string, client: APIRequestContext;
const year = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
const types = ['opening', 'receipt', 'issue', 'adjustment'] as const;
function fixture(): StockDashboard {
  return {
    operational: 64,
    available: 43,
    empty: 0,
    criticalEmpty: 0,
    uncounted: 21,
    year,
    currentYear: year,
    series: [1, 2, 3, 4].map((quarter) => ({
      quarter,
      opening: quarter < 4 ? 2 : 41,
      receipt: quarter < 4 ? 0 : 1109,
      issue: quarter < 4 ? 0 : 23,
      adjustment: quarter < 4 ? 0 : 6,
    })),
    recent: Array.from({ length: 8 }, (_, i) => ({
      id: randomUUID(),
      materialId: randomUUID(),
      locationId: randomUUID(),
      mmid: `SYNTHETIC-MATERIAL-${i}`,
      description:
        'Synthetic long material description for visual verification of industrial spare parts and maintenance supplies with a deliberately extended name',
      unit: i % 2 ? 'KG' : 'EA',
      locationName: 'Synthetic location',
      type: types[i % 4],
      quantity: i % 4 === 2 ? '-0.123456' : '123.456789',
      balanceAfter: '1000.000000',
      packs: null,
      packSize: null,
      reference: '',
      wo: '',
      job: '',
      reason: '',
      actorId: userId,
      actorName: 'Synthetic actor',
      createdAt: new Date().toISOString(),
    })),
  };
}
async function post(path: string, data: unknown) {
  const r = await client.post(path, { headers: { origin: process.env.PUBLIC_ORIGIN! }, data });
  expect(r.ok(), `${path}: ${r.status()}`).toBeTruthy();
  return r.json();
}
test.beforeAll(async () => {
  userId = (await createUser(actor, { email, password: temporary, name: actor.name })).id;
  await updateUserAccess(actor, userId, { active: true, portalAdmin: true });
  await setGrant(actor, userId, { appId: 'bag-filter', role: 'admin', equipment: [...equipmentCodes] });
  await setAppGrant(actor, userId, 'consumables', { appId: 'consumables', role: 'admin', locationIds: [] });
  await changePassword({ ...actor, id: userId }, temporary, password);
  client = await request.newContext({ baseURL: process.env.PUBLIC_ORIGIN, ignoreHTTPSErrors: true });
  await post('/auth/api/sign-in/email', { email, password });
  locationId = (await post('/consumables/api/locations', { name: `UI fixture ${randomUUID()}` })).id;
});
test.afterAll(async () => {
  try {
    await getConsumablesDb().transaction(async (tx) => {
      if (userId) await tx.delete(schema.audit).where(eq(schema.audit.actorId, userId));
      if (locationId) await tx.delete(schema.locations).where(eq(schema.locations.id, locationId));
    });
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
    await Promise.all([closeAuthDb(), closeConsumablesDb()]);
  }
});
async function signIn(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.context().addCookies((await client.storageState()).cookies);
}
async function select(page: Page, label: string, value: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}
async function theme(page: Page, value: string) {
  await page.getByRole('button', { name: 'Tema', exact: true }).click();
  await page.getByRole('button', { name: value, exact: true }).click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
}
async function sidebarContrast(page: Page) {
  const ratios = await page.locator('.application-link').evaluateAll((links) => {
    const luminance = (color: string) => {
      const values = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };
    return links.map((link) => {
      let el: Element | null = link;
      let background = 'rgb(255,255,255)';
      while (el) {
        const color = getComputedStyle(el).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
          background = color;
          break;
        }
        el = el.parentElement;
      }
      const a = luminance(getComputedStyle(link).color),
        b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
}

test('premium dashboard, bounded activity, responsive sidebar, themes and Bag Filter reference', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/consumables/api/dashboard*', (r) => r.fulfill({ json: fixture() }));
  await page.goto('/consumables');
  await expect(page.locator('.quarter-chart')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consumable Room', exact: true })).toHaveCount(1);
  await expect(
    page
      .getByRole('navigation', { name: 'Navigasi utama' })
      .getByRole('link', { name: 'Ringkasan', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.sidebar .equipment-links')).toHaveCount(0);
  expect(
    await page
      .locator('.quarter-stack')
      .first()
      .evaluate((e) => e.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(72);
  const cardHeight = await page.locator('.hero-chart-card').evaluate((e) => e.getBoundingClientRect().height);
  expect(cardHeight).toBeLessThan(740);
  expect(
    await page.locator('.stock-activity .activity-scroll').evaluate((e) => e.scrollHeight > e.clientHeight),
  ).toBeTruthy();
  await expect(page.locator('.quarter-details')).toContainText('1.179 transaksi');
  await page.getByRole('button', { name: 'Detail sesi aktif', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Sesi aktif', exact: true })).toContainText('Berakhir');
  await expect(page.getByRole('dialog', { name: 'Sesi aktif', exact: true })).toContainText('WIB');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Detail sesi aktif', exact: true })).toBeFocused();
  for (const value of ['Terang', 'Gelap']) {
    await theme(page, value);
    await sidebarContrast(page);
    await page.screenshot({
      path: `.test-runtime/stock-polish-${value === 'Terang' ? 'light' : 'dark'}-1440.png`,
      fullPage: true,
    });
    for (const [width, height] of [
      [1920, 900],
      [1440, 768],
      [1024, 900],
      [768, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      await noOverflow(page);
      if (width === 1920)
        await page.screenshot({
          path: `.test-runtime/stock-polish-${value === 'Terang' ? 'light' : 'dark'}-1920.png`,
          fullPage: true,
        });
      if (width >= 1280) {
        const bottom = await page
          .locator('.sidebar-bottom')
          .evaluate((e) => e.getBoundingClientRect().bottom);
        expect(bottom).toBeLessThanOrEqual(height);
        await expect(
          page.locator('.sidebar-account').getByRole('link', { name: 'Kelola akses' }),
        ).toBeVisible();
      }
      if (width === 390) {
        await page.screenshot({
          path: `.test-runtime/stock-polish-${value === 'Terang' ? 'light' : 'dark'}-390.png`,
          fullPage: true,
        });
        await page.getByRole('button', { name: 'Buka navigasi' }).click();
        const drawer = page.getByRole('dialog', { name: 'Navigasi', exact: true });
        await expect(drawer.getByRole('link', { name: 'Pemakaian', exact: true })).toBeVisible();
        await expect(drawer.getByRole('button', { name: 'Keluar akun' })).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await theme(page, 'Terang');
  await page.getByRole('link', { name: 'Lihat yang belum dihitung' }).click();
  await expect(page.getByRole('combobox', { name: 'Ketersediaan', exact: true })).toContainText(
    'Belum dihitung',
  );
  await page.goto('/bag-filter');
  await expect(page.locator('.bar-chart')).toBeVisible();
  await expect(page.locator('.sidebar .equipment-links a')).toHaveCount(6);
  await expect(page.locator('.sidebar .nav-application[data-app="consumables"] .nav-children')).toHaveCount(
    0,
  );
  await page.locator('.dashboard-grid').screenshot({ path: '.test-runtime/bag-gold-polish.png' });
  await page.goto('/bag-filter/audit');
  await expect(
    page
      .getByRole('navigation', { name: 'Navigasi utama' })
      .getByRole('link', { name: 'Audit', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  for (const path of ['/profile', '/admin']) {
    await page.goto(path);
    await expect(page.locator('.sidebar .nav-children')).toHaveCount(0);
    await expect(page.locator('.sidebar-account a[aria-current="page"]')).toHaveAttribute('href', path);
  }
  await page.goto('/bag-filter');
  await page.keyboard.press('Control+b');
  await page.getByRole('button', { name: 'Menu Consumable Room', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Consumable Room', exact: true });
  await expect(menu.getByRole('link', { name: 'Ringkasan', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu Consumable Room', exact: true })).toBeFocused();
  await page.keyboard.press('Control+b');
  await page.goto('/');
  await expect(page.locator('.stock-summary.is-compact')).toBeVisible();
  await expect(page.locator('.sidebar .nav-children')).toHaveCount(0);
  await expect(page.locator('.stock-summary .quarter-chart')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('quarter scale and details preserve counts, zeros, year selection, errors and retry', async ({
  page,
}) => {
  await signIn(page);
  let data = fixture(),
    failed = false;
  let release: () => void = () => {};
  const loading = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/consumables/api/dashboard*', async (route) => {
    await loading;
    if (failed)
      return route.fulfill({ status: 502, contentType: 'text/html', body: '<!DOCTYPE html>unavailable' });
    return route.fulfill({
      json: { ...data, year: Number(new URL(route.request().url()).searchParams.get('year')) },
    });
  });
  await page.goto('/consumables');
  await expect(
    page.getByRole('status', { name: 'Memuat ringkasan Consumable Room', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.stock-loading-hero')).toBeVisible();
  release();
  const q1 = page.getByRole('button', { name: `Q1 ${year}: 2 transaksi`, exact: true });
  await q1.focus();
  await page.keyboard.press('Space');
  await expect(q1).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.quarter-details')).toContainText('Saldo awal2');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: `Q2 ${year}: 2 transaksi`, exact: true })).toBeFocused();
  await select(page, 'Tahun transaksi stok', String(year - 1));
  await expect(page.locator('.quarter-details')).toContainText(`Q4 ${year - 1}`);
  await expect(page.locator('.kpi-rail .metric-block').first()).toContainText('64');
  failed = true;
  await select(page, 'Tahun transaksi stok', String(year));
  await expect(page.locator('.stock-refresh-error')).toContainText('Ringkasan belum dapat dimuat');
  await expect(page.locator('.stock-refresh-error')).not.toContainText('DOCTYPE');
  await expect(page.locator('.quarter-details')).toContainText(String(year - 1));
  failed = false;
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.locator('.quarter-details')).toContainText(`Q4 ${year}`);
  for (const kind of ['empty', 'single', 'balanced'] as const) {
    data = fixture();
    data.series = [1, 2, 3, 4].map((quarter) => ({
      quarter,
      opening: kind === 'balanced' ? 2 : 0,
      receipt: kind === 'empty' ? 0 : 2,
      issue: kind === 'balanced' ? 2 : 0,
      adjustment: kind === 'balanced' ? 2 : 0,
    }));
    if (kind === 'empty')
      Object.assign(data, {
        operational: 0,
        available: 0,
        empty: 0,
        criticalEmpty: 0,
        uncounted: 0,
        recent: [],
      });
    await page.reload();
    await expect(page.locator('.quarter-chart')).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: `Q1 ${year}: ${kind === 'empty' ? 0 : kind === 'balanced' ? 8 : 2} transaksi`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('.quarter-stack i')).toHaveCount(
      kind === 'empty' ? 0 : kind === 'single' ? 4 : 16,
    );
    if (kind === 'empty') {
      await expect(page.getByText('Belum ada transaksi pada tahun ini.', { exact: true })).toBeVisible();
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    }
  }
});

test('sidebar and action card follow consumable roles while portal controls remain separate', async ({
  page,
}) => {
  await signIn(page);
  await page.route('**/consumables/api/dashboard*', (r) => r.fulfill({ json: fixture() }));
  for (const role of ['viewer', 'operator', 'storekeeper', 'admin']) {
    await post(`/api/admin/users/${userId}/grants/consumables`, {
      grant: { appId: 'consumables', role, locationIds: role === 'admin' ? [] : [locationId] },
    });
    await page.goto('/consumables');
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
    await expect(nav.getByRole('link', { name: 'Cek stok', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Penerimaan', exact: true })).toHaveCount(
      ['admin', 'storekeeper'].includes(role) ? 1 : 0,
    );
    await expect(nav.getByRole('link', { name: 'Pemakaian', exact: true })).toHaveCount(
      role === 'viewer' ? 0 : 1,
    );
    await expect(nav.getByRole('link', { name: 'Pengelolaan', exact: true })).toHaveCount(
      role === 'admin' ? 1 : 0,
    );
    await expect(page.locator('.stock-action-card a')).toHaveAttribute(
      'href',
      role === 'viewer'
        ? '/consumables/stock'
        : role === 'operator'
          ? '/consumables/issue'
          : '/consumables/receive',
    );
    await expect(
      page
        .getByRole('navigation', { name: 'Akun dan administrasi' })
        .getByRole('link', { name: 'Kelola akses' }),
    ).toBeVisible();
  }
  await page
    .locator('.sidebar-bottom')
    .getByRole('button', { name: /^Keluar akun/ })
    .click();
  await page.waitForURL('**/auth/login');
  expect((await page.request.get('/consumables/api/dashboard')).status()).toBe(401);
  expect((await page.request.get('/bag-filter/api/dashboard')).status()).toBe(401);
});
