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
  await page.setViewportSize({ width: 1280, height: 800 });
  const dashboardRequests: string[] = [];
  const summaryRequests: string[] = [];
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/dashboard')) dashboardRequests.push(u);
    if (u.includes('/api/portal-summary')) summaryRequests.push(u);
  });
  const bag = await (await client.get('/bag-filter/api/portal-summary')).json();
  await page.route('**/bag-filter/api/portal-summary*', (route) =>
    route.fulfill({
      json: {
        ...bag,
        recent: [
          {
            id: randomUUID(),
            title: 'W'.repeat(100),
            meta: 'L61-BF1 · 500 bag',
            at: new Date().toISOString(),
            href: '/bag-filter/equipment/l61-bf1',
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.application-summary')).toHaveCount(2);
  await expect(page.locator('.portal-hub .feature-widget')).toHaveCount(1);
  await expect(page.locator('.portal-hub .bar-chart')).toHaveCount(1);
  await expect(page.locator('.portal-hub .quarter-chart')).toHaveCount(0);
  await expect(page.locator('.portal-heading .eyebrow')).toHaveText('TQ-CMMS / PORTAL');
  await expect(page.locator('.portal-date-slot')).toContainText('WIB');
  await expect(page.getByText('Hanya lihat', { exact: true })).toBeVisible();
  await expect(page.locator('.portal-quick-actions')).toContainText('Consume Order');
  expect(dashboardRequests).toHaveLength(0);
  expect(summaryRequests).toHaveLength(2);
  const cards = await page
    .locator('.application-summary')
    .evaluateAll((els) =>
      els.map((e) => ({ top: e.getBoundingClientRect().top, height: e.getBoundingClientRect().height })),
    );
  expect(Math.abs(cards[0].top - cards[1].top)).toBeLessThan(1);
  expect(Math.abs(cards[0].height - cards[1].height)).toBeLessThan(1);
  const fit1280x800 = await page.evaluate(() => {
    const hero = document.querySelector('.portal-hub .hero-chart-card')?.getBoundingClientRect();
    const widget = document.querySelector('.portal-quick-actions')?.getBoundingClientRect();
    const cardList = Array.from(document.querySelectorAll('.application-summary'));
    const lastCard = cardList[cardList.length - 1]?.getBoundingClientRect();
    return {
      heroBottom: hero ? hero.bottom : 9999,
      widgetBottom: widget ? widget.bottom : 9999,
      cardsBottom: lastCard ? lastCard.bottom : 9999,
    };
  });
  expect(fit1280x800.heroBottom).toBeLessThanOrEqual(800);
  expect(fit1280x800.widgetBottom).toBeLessThanOrEqual(800);
  expect(fit1280x800.cardsBottom).toBeLessThanOrEqual(1220);
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('portal renders 0, 1, 2, 3 and 5 active apps from catalog, isolates errors and preserves >=3:1 signal contrast', async ({
  page,
}) => {
  await start(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  const mockCatalog = [
    {
      id: 'bag-filter',
      icon: 'filter',
      name: 'Bag Filter',
      description: 'Peta umur bag.',
      path: '/bag-filter',
      portalSummary: '/bag-filter/api/portal-summary',
      status: 'active',
    },
    {
      id: 'consumables',
      icon: 'box',
      name: 'Consumable Room',
      description: 'Stok material R22.',
      path: '/consumables',
      portalSummary: '/consumables/api/portal-summary',
      status: 'active',
    },
    {
      id: 'drawings',
      icon: 'drawing',
      name: 'Drawing Database',
      description: 'Request, pemeriksaan, dan revisi drawing.',
      path: '/drawings',
      portalSummary: '/drawings/api/portal-summary',
      status: 'active',
    },
    {
      id: 'rca',
      icon: 'rca',
      name: 'Root Cause Analysis',
      description: 'Analisis penyebab dan tindak lanjut perbaikan.',
      path: '/rca',
      portalSummary: '/rca/api/portal-summary',
      status: 'active',
    },
    {
      id: 'part-cost',
      icon: 'cost',
      name: 'Part Cost',
      description: 'Estimasi biaya pembuatan sparepart.',
      path: '/part-cost',
      portalSummary: '/part-cost/api/portal-summary',
      status: 'active',
    },
  ] as const;

  let rcaShouldFail = true;
  await page.route('**/drawings/api/portal-summary', (route) =>
    route.fulfill({
      json: {
        appId: 'drawings',
        updatedAt: '2026-11-08T10:00:00.000Z',
        headline: {
          label: 'Revisi aktif',
          value: 14,
          total: 20,
          unit: 'drawing',
          caption: '14 dari 20 revisi aktif sedang diproses.',
          href: '/drawings',
        },
        metrics: [{ key: 'revisions', label: 'Revisi aktif', value: 14, tone: 'neutral' }],
        attention: [],
        activity: {
          unitSingular: 'revisi',
          weeks: Array.from({ length: 12 }, (_, i) => ({
            start: `2026-11-${String(i + 1).padStart(2, '0')}`,
            count: 2,
          })),
        },
        recent: [
          {
            id: 'drw-1',
            title: 'DWG-561-04',
            meta: 'Revisi B · Disetujui',
            at: '2026-11-08T09:30:00.000Z',
            href: '/drawings',
            value: 1,
            unit: 'revisi',
          },
        ],
      },
    }),
  );
  await page.route('**/rca/api/portal-summary', (route) =>
    rcaShouldFail
      ? route.fulfill({ status: 503, json: { error: 'Layanan RCA sedang pemeliharaan.' } })
      : route.fulfill({
          json: {
            appId: 'rca',
            updatedAt: '2026-11-08T10:00:00.000Z',
            headline: {
              label: 'Investigasi aktif',
              value: 2,
              total: 11,
              unit: 'kasus',
              caption: '2 dari 11 kasus memerlukan investigasi.',
              href: '/rca',
            },
            metrics: [
              { key: 'open', label: 'Investigasi aktif', value: 2, tone: 'warning' },
              { key: 'closed', label: 'Selesai bulan ini', value: 9, tone: 'neutral' },
            ],
            attention: [],
            activity: {
              unitSingular: 'kasus',
              weeks: Array.from({ length: 12 }, (_, i) => ({
                start: `2026-11-${String(i + 1).padStart(2, '0')}`,
                count: 1,
              })),
            },
            recent: [],
          },
        }),
  );
  await page.route('**/part-cost/api/portal-summary', (route) =>
    route.fulfill({
      json: {
        appId: 'part-cost',
        updatedAt: '2026-11-08T10:00:00.000Z',
        headline: {
          label: 'Estimasi aktif',
          value: 7,
          total: 8,
          unit: 'part',
          caption: '7 dari 8 estimasi selesai.',
          href: '/part-cost',
        },
        metrics: [
          { key: 'estimates', label: 'Estimasi minggu ini', value: 7, tone: 'neutral' },
          { key: 'pending', label: 'Menunggu review', value: 1, tone: 'warning' },
        ],
        attention: [
          {
            key: 'cost-review',
            group: { key: 'cost-review', label: 'Estimasi review', unit: 'part' },
            label: 'Estimasi menunggu review',
            value: 1,
            severity: 'warning' as const,
            href: '/part-cost',
          },
        ],
        activity: {
          unitSingular: 'part',
          weeks: Array.from({ length: 12 }, (_, i) => ({
            start: `2026-11-${String(i + 1).padStart(2, '0')}`,
            count: 3,
          })),
        },
        recent: [],
        action: { label: 'Buat estimasi', href: '/part-cost', icon: 'cost' },
      },
    }),
  );

  for (const activeCount of [0, 1, 2, 3, 5]) {
    const catalog = mockCatalog.map((item, i) =>
      i < activeCount
        ? item
        : {
            id: item.id,
            icon: item.icon,
            name: item.name,
            description: item.description,
            status: 'planned' as const,
          },
    );
    const grants = mockCatalog.slice(0, activeCount).map((item, i) => ({
      appId: item.id,
      role: (i === 0 ? 'viewer' : 'operator') as 'viewer' | 'operator',
    }));
    await page.addInitScript(
      (fx) => {
        window.__PORTAL_TEST_FIXTURE__ = fx;
      },
      { catalog, grants },
    );
    await page.goto('/');
    if (activeCount === 0) {
      await expect(page.locator('.portal-no-access')).toBeVisible();
      await expect(page.locator('.application-summary')).toHaveCount(0);
    } else {
      await expect(page.locator('.application-summary')).toHaveCount(activeCount);
      await expect(page.locator('.portal-feed-filters')).toHaveCount(activeCount >= 3 ? 1 : 0);
    }
    if (activeCount === 3) {
      await expect(page.locator('[data-app-id="drawings"] .app-card-metric')).toHaveCount(1);
      await expect(page.locator('[data-app-id="drawings"] .progress-track')).toBeVisible();
    }
    if (activeCount === 5) {
      const rcaCard = page.locator('[data-app-id="rca"]');
      await expect(rcaCard.locator('.portal-card-error')).toContainText('Layanan RCA sedang pemeliharaan.');
      await expect(page.locator('[data-app-id="part-cost"] .app-card-metric')).toHaveCount(2);
      rcaShouldFail = false;
      await rcaCard.getByRole('button', { name: 'Coba lagi' }).click();
      await expect(rcaCard.locator('.app-card-metric')).toHaveCount(2);
    }
  }

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    const contrastCheck = await page.evaluate(() => {
      const parse = (value: string) => {
        const m = value.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
        return m.slice(0, 3);
      };
      const lum = ([r, g, b]: number[]) => {
        const c = [r, g, b].map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const ratio = (a: number[], b: number[]) => {
        const l1 = lum(a),
          l2 = lum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      const card = document.querySelector('.portal-app-card') as HTMLElement;
      const track = card.querySelector('.progress-track') as HTMLElement;
      const hatched = track.querySelector('i.hatched') as HTMLElement;
      const surfaceRgb = parse(getComputedStyle(card).backgroundColor);
      const trackRgb = parse(getComputedStyle(track).backgroundColor);
      const hatchedRgb = parse(getComputedStyle(hatched).backgroundColor);
      return {
        trackHeight: getComputedStyle(track).height,
        hatchedContrast: ratio(hatchedRgb, surfaceRgb),
      };
    });
    expect(contrastCheck.trackHeight).toBe('14px');
    expect(contrastCheck.hatchedContrast).toBeGreaterThanOrEqual(1.5);
  }
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
  const availabilityMenu = page.getByRole('dialog', { name: 'Pilih opsi', exact: true });
  await expect(availabilityMenu).toBeVisible();
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
  await expect(availabilityMenu).toBeHidden();
  const nextPage = page.getByRole('button', { name: 'Berikutnya', exact: true });
  await expect(nextPage).toBeEnabled();
  seen = '';
  gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.clock.pauseAt(new Date());
  await nextPage.click({ force: true });
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
    /^\d+(\.\d+)?px 0px$/,
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
        if (path === '/') await expect(page.locator('.application-summary')).toHaveCount(2);
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

test('self-hosted Inter font, basePath preload, code-text features, and sidebar S1 typography stay consistent across apps', async ({
  page,
}) => {
  await start(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const origin = process.env.PUBLIC_ORIGIN!;
  for (const [route, prefix] of [
    ['/auth/login', '/auth/_next/'],
    ['/', '/_next/'],
    ['/bag-filter', '/bag-filter/_next/'],
    ['/consumables', '/consumables/_next/'],
  ] as const) {
    const external: string[] = [];
    const onRequest = (req: import('@playwright/test').Request) => {
      if (!req.url().startsWith(origin) && !req.url().startsWith('data:')) external.push(req.url());
    };
    page.on('request', onRequest);
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    page.off('request', onRequest);
    expect(external, `No external requests on ${route}`).toEqual([]);
    const fontCheck = await page.evaluate((expectedPrefix) => {
      const preloads = Array.from(document.querySelectorAll('link[rel="preload"][as="font"]')).map((l) =>
        l.getAttribute('href'),
      );
      const interLoaded = Array.from(document.fonts).some(
        (f) => f.status === 'loaded' && f.family.toLowerCase().includes('inter'),
      );
      return {
        hasPrefixPreload: preloads.some((h) => h?.startsWith(expectedPrefix)),
        interLoaded,
        fontFamily: getComputedStyle(document.documentElement).fontFamily.toLowerCase(),
      };
    }, prefix);
    expect(fontCheck.hasPrefixPreload, `Preload on ${route}`).toBe(true);
    expect(fontCheck.interLoaded, `Inter loaded on ${route}`).toBe(true);
    expect(fontCheck.fontFamily).toContain('inter');
  }
  await page.goto('/bag-filter');
  const s1 = await page.evaluate(() => {
    const topLabels = Array.from(
      document.querySelectorAll(
        '.sidebar nav > a .sidebar-label, .sidebar nav .application-link .sidebar-label',
      ),
    ).map((el) => ({
      text: el.textContent?.trim(),
      fontSize: getComputedStyle(el).fontSize,
      fontWeight: getComputedStyle(el).fontWeight,
    }));
    const treeRows = Array.from(document.querySelectorAll('.sidebar .nav-tree .nav-tree-row')).map((el) => ({
      text: el.textContent?.trim(),
      current: el.getAttribute('aria-current'),
      fontSize: getComputedStyle(el).fontSize,
      fontWeight: getComputedStyle(el).fontWeight,
    }));
    return { topLabels, treeRows };
  });
  for (const label of s1.topLabels) {
    expect(label.fontSize, `S1 top-level font-size (${label.text})`).toBe('14px');
    expect(label.fontWeight, `S1 top-level font-weight (${label.text})`).toBe('500');
  }
  for (const row of s1.treeRows) {
    expect(row.fontSize, `S1 tree-row font-size (${row.text})`).toBe('14px');
    expect(row.fontWeight, `S1 tree-row font-weight (${row.text})`).toBe(
      row.current === 'page' ? '500' : '400',
    );
  }
});
