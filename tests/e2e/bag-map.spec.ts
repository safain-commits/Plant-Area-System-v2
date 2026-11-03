import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { authSchema, getAuthDb, closeAuthDb, createUser, setGrant, changePassword } from '@plant/auth-core';
import { getBagDb, closeBagDb, bagSchema } from '@plant/bag-core';
import { equipmentCodes, type Identity } from '@plant/contracts';

const origin = process.env.PUBLIC_ORIGIN!;
const email = `map-${randomUUID()}@example.test`;
const password = 'Map-browser-test-password-2026';
let userId: string;
test.beforeAll(async () => {
  const [bootstrap] = await getAuthDb()
    .select()
    .from(authSchema.user)
    .where(eq(authSchema.user.email, process.env.BOOTSTRAP_EMAIL!));
  if (!bootstrap) throw Error('Bootstrap is required');
  const actor = { ...bootstrap, mustChangePassword: false, grants: [] } as Identity;
  const temporary = 'Map-temporary-password-2026';
  const user = await createUser(actor, { email, password: temporary, name: 'Map browser', position: 'Test' });
  userId = user.id;
  await setGrant(actor, userId, { appId: 'bag-filter', role: 'admin', equipment: [...equipmentCodes] });
  await changePassword({ ...actor, id: userId, email, name: 'Map browser' }, temporary, password);
});
test.afterAll(async () => {
  try {
    if (userId) {
      const batches = await getBagDb()
        .select({ id: bagSchema.batches.id })
        .from(bagSchema.batches)
        .where(eq(bagSchema.batches.actorId, userId));
      if (batches.length)
        await getBagDb().transaction(async (tx) => {
          const ids = batches.map((b) => b.id);
          await tx.delete(bagSchema.bagAudit).where(inArray(bagSchema.bagAudit.batchId, ids));
          await tx.delete(bagSchema.installations).where(inArray(bagSchema.installations.batchId, ids));
          await tx.delete(bagSchema.batches).where(inArray(bagSchema.batches.id, ids));
        });
    }
    if (userId)
      await getAuthDb().transaction(async (tx) => {
        await tx.delete(authSchema.session).where(eq(authSchema.session.userId, userId));
        await tx.delete(authSchema.account).where(eq(authSchema.account.userId, userId));
        await tx.delete(authSchema.grants).where(eq(authSchema.grants.userId, userId));
        await tx.delete(authSchema.user).where(eq(authSchema.user.id, userId));
      });
  } finally {
    await closeAuthDb();
    await closeBagDb();
  }
});

async function login(page: Page) {
  const response = await page.request.post('/auth/api/sign-in/email', {
    headers: { origin },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

const layouts = [
  {
    codes: ['561-BF1', '562-BF1'],
    perSide: 12,
    rows: 17,
    top: ['1', '12'],
    bottom: ['24', '13'],
    columns: 'HGFEDCBA',
  },
  {
    codes: ['421-BF1', '422-BF1'],
    perSide: 15,
    rows: 17,
    top: ['1A', '15A'],
    bottom: ['1B', '15B'],
    columns: 'ABCDEFGH',
  },
  {
    codes: ['L61-BF1', 'L62-BF1'],
    perSide: 8,
    rows: 16,
    top: ['1', '8'],
    bottom: ['16', '9'],
    columns: 'ABCDEFGH',
  },
];

test('active ages, compact detail workspace, inset selection and one recording action', async ({ page }) => {
  test.setTimeout(120000);
  await login(page);
  await page.goto('/bag-filter/equipment/422-bf1');
  const kpi = page.getByRole('main').locator('[data-kpi="active-age"]');
  await expect(kpi.locator('[data-age-range]')).toHaveText('—');
  await expect(kpi).toContainText('Belum ada pemasangan tercatat');
  await expect(page.getByRole('button', { name: 'Catat penggantian', exact: true })).toHaveCount(0);
  const now = Date.now(),
    day = 86400000;
  const positions = [
    { side: 'A', compartment: 1, column: 1, row: 17 },
    { side: 'B', compartment: 15, column: 8, row: 1 },
  ];
  async function batch(items: typeof positions, days: number) {
    const response = await page.request.post('/bag-filter/api/equipment/422-BF1/batches', {
      headers: { origin, 'Idempotency-Key': randomUUID() },
      data: {
        equipmentCode: '422-BF1',
        positions: items,
        installedAt: new Date(now - days * day).toISOString(),
        reason: `Age UI ${userId}`,
        brand: 'Filtras',
      },
    });
    expect(response.status(), await response.text()).toBe(201);
  }
  await batch(positions, 1678);
  // Replacing a very old bag must remove its former installation from the KPI.
  await batch([positions[1]], 7 + 86370 / 86400);
  await page.clock.install({ time: new Date(now) });
  await page.reload();
  await expect(kpi.locator('[data-age-range]')).toHaveText('7–1.678 hari');
  await expect(kpi).toContainText('1 bag ≥900 hari');
  const legend = page.locator('.age-buckets button').first();
  await legend.click();
  await expect(legend).toHaveAttribute('aria-pressed', 'true');
  await expect(kpi.locator('[data-age-range]')).toHaveText('7–1.678 hari');
  await legend.click();
  await page.clock.fastForward(60000);
  await expect(kpi.locator('[data-age-range]')).toHaveText('8–1.678 hari');
  await page.clock.resume();
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => {
      localStorage.setItem('plant-ui-theme', value);
      dispatchEvent(
        new StorageEvent('storage', { key: 'plant-ui-theme', newValue: value, storageArea: localStorage }),
      );
    }, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const width of [320, 390, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const workspace = await page.locator('.equipment-workspace').boundingBox();
      const grid = await page.locator('#bag-detail').boundingBox();
      const context = await page.locator('.bag-context').boundingBox();
      if (workspace!.width >= 960) {
        expect(grid!.width).toBe(520);
        expect(context!.x).toBeGreaterThan(grid!.x + grid!.width);
        expect(Math.abs(context!.y - grid!.y)).toBeLessThan(1);
      } else {
        expect(grid!.width).toBeLessThanOrEqual(520);
        expect(context!.y).toBeGreaterThanOrEqual(grid!.y + grid!.height);
      }
      await expect(page.locator('.overview-title[aria-current="true"]')).toHaveCount(1);
      const cell = page.locator('.overview-cell').first();
      const before = await cell.boundingBox();
      await cell.click();
      const after = await cell.boundingBox();
      expect(after!.width).toBe(before!.width);
      expect(after!.height).toBe(before!.height);
      const style = await cell.evaluate((el) => ({
        shadow: getComputedStyle(el).boxShadow,
        transform: getComputedStyle(el).transform,
      }));
      expect(style.shadow).toContain('inset');
      expect(style.transform).toBe('none');
      await expect(page.getByRole('button', { name: 'Catat penggantian', exact: true })).toHaveCount(1);
      await page
        .locator('.selection-bar')
        .getByRole('button', { name: 'Catat penggantian', exact: true })
        .click();
      await expect(page.locator('.selection-bar')).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-sheet-trigger]')).toBeFocused();
      await page.getByRole('button', { name: 'Pilih banyak', exact: true }).click();
      await expect(page.locator('.selection-bar')).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Pilih banyak', exact: true })).toBeFocused();
      await expect(page.locator('.selection-bar strong')).toHaveText('1 posisi dipilih');
      await page.locator('#bag-detail').scrollIntoViewIfNeeded();
      if (width >= 1280) await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `test-results/equipment-workspace-${theme}-${width}.png`,
        fullPage: width >= 1280,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.selection-bar').getByRole('button', { name: 'Bersihkan semua' }).click();
    }
  }
  const coordinate = page
    .locator('#work-history .coordinate-links button')
    .filter({ hasText: '15B H1' })
    .first();
  await coordinate.click();
  await expect(page.locator('.overview-title[aria-current="true"]')).toHaveText('Comp. 15B');
  await expect(page.locator('#position-history')).toContainText('Comp. 15B H1');
  await page.getByRole('button', { name: /900\+ hari/ }).click();
  await expect(kpi.locator('[data-age-range]')).toHaveText('8–1.678 hari');
});

test('all six maps keep uniform square cells and aligned labels at seven widths in both themes', async ({
  page,
}) => {
  test.setTimeout(180000);
  await login(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const theme of ['light', 'dark']) {
    await page.addInitScript((value) => localStorage.setItem('plant-ui-theme', value), theme);
    for (const layout of layouts)
      for (const code of layout.codes) {
        await page.goto(`/bag-filter/equipment/${code.toLowerCase()}`);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('.overview-cell')).toHaveCount(layout.perSide * 2 * layout.rows * 8);
        const bands = page.locator('.overview-band');
        for (const [index, labels] of [layout.top, layout.bottom].entries()) {
          const band = bands.nth(index);
          await expect(band.locator('.overview-title').first()).toHaveAttribute(
            'aria-label',
            `Buka detail kompartemen ${labels[0]}`,
          );
          await expect(band.locator('.overview-title').last()).toHaveAttribute(
            'aria-label',
            `Buka detail kompartemen ${labels[1]}`,
          );
          const compartment = band.locator('.overview-compartment').first();
          expect((await compartment.locator('.overview-labels').innerText()).replace(/\s/g, '')).toBe(
            layout.columns,
          );
          await expect(compartment.locator('.overview-row-number').first()).toHaveText(
            String(index === 0 ? layout.rows : 1),
          );
          await expect(compartment.locator('.overview-row-number').last()).toHaveText(
            String(index === 0 ? 1 : layout.rows),
          );
          await expect(band.locator('.overview-stiffener')).toHaveCount(layout.perSide);
        }
        for (const width of [320, 390, 768, 1024, 1440, 1920, 2552]) {
          await page.setViewportSize({ width, height: 1000 });
          const narrow = await page.locator('.overview-map').evaluate((el) => el.clientWidth < 960);
          await expect(page.locator('.overview-scroll-tools')).toBeVisible({ visible: narrow });
          const compartment = bands.first().locator('.overview-compartment').first();
          if (narrow) {
            await expect(compartment).toHaveCSS('width', '140px');
            await expect(compartment.locator('.overview-row-number').first()).toHaveCSS('font-size', '10px');
            await expect(compartment.locator('.overview-labels')).toHaveCSS('font-size', '9px');
            await expect(compartment.locator('.overview-title')).toHaveCSS('font-size', '10px');
            await expect(compartment.locator('.overview-title-full')).toBeVisible();
          }
          const gridIssues = await page.locator('.overview-compartment').evaluateAll((compartments) => {
            const issues: string[] = [];
            for (const [index, compartment] of compartments.entries()) {
              const rows = Array.from(compartment.querySelectorAll<HTMLElement>('.overview-line'));
              const reference = Array.from(rows[0].querySelectorAll('.overview-cell')).map((cell) =>
                cell.getBoundingClientRect(),
              );
              const gaps: number[] = [];
              let previous: DOMRect | undefined;
              for (const row of rows) {
                const cells = Array.from(row.querySelectorAll('.overview-cell')).map((cell) =>
                  cell.getBoundingClientRect(),
                );
                for (const [column, cell] of cells.entries()) {
                  const expected = reference[column];
                  if (
                    Math.abs(cell.width - expected.width) > 0.05 ||
                    Math.abs(cell.height - expected.height) > 0.05 ||
                    Math.abs(cell.left - expected.left) > 0.05 ||
                    Math.abs(cell.width - cell.height) > 0.05
                  )
                    issues.push(
                      `Compartment ${index}, row ${row.firstElementChild!.textContent}, column ${column}: unequal cell geometry`,
                    );
                }
                if (previous)
                  gaps.push(cells[0].top - previous.bottom - parseFloat(getComputedStyle(row).marginTop));
                previous = cells[0];
              }
              if (Math.max(...gaps) - Math.min(...gaps) > 0.05)
                issues.push(`Compartment ${index}: inconsistent vertical spacing`);
              const labels = Array.from(compartment.querySelector('.overview-labels')!.children).slice(1);
              for (const [column, label] of labels.entries()) {
                const box = label.getBoundingClientRect(),
                  expected = reference[column];
                if (Math.abs(box.left + box.width / 2 - expected.left - expected.width / 2) > 0.05)
                  issues.push(`Compartment ${index}, column ${column}: column label is misaligned`);
              }
            }
            return issues;
          });
          expect(gridIssues, `${code} ${width} ${theme}`).toEqual([]);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${code} ${width} ${theme}`,
          ).toBe(true);
          await page.locator('.overview-viewport').evaluate((el) => {
            el.scrollLeft = el.scrollWidth;
          });
          const geometry = await page.locator('.overview-viewport').evaluate((el) => {
            const viewport = el.getBoundingClientRect();
            const bands = Array.from(el.querySelectorAll('.overview-band'));
            const last = bands.map((b) => b.lastElementChild!.getBoundingClientRect());
            return {
              overflow: el.scrollWidth > el.clientWidth + 1,
              aligned: Math.abs(last[0].left - last[1].left) < 1,
              reachable: last.every((r) => r.right <= viewport.right + 1 && r.left >= viewport.left - 1),
            };
          });
          expect(geometry.aligned).toBe(true);
          expect(geometry.reachable).toBe(true);
          expect(geometry.overflow).toBe(narrow);
          if (narrow) {
            await expect(
              page.getByRole('button', { name: 'Kompartemen berikutnya', exact: true }),
            ).toBeDisabled();
            await expect(
              page.getByRole('button', { name: 'Kompartemen sebelumnya', exact: true }),
            ).toBeEnabled();
          }
          await page.locator('.overview-viewport').evaluate((el) => {
            el.scrollLeft = 0;
          });
          if (width <= 390) {
            expect(
              await page.locator('.equipment-stats').evaluate((el) => {
                const cards = Array.from(el.children).map((c) => c.getBoundingClientRect());
                return cards.every(
                  (r, i) => r.left === cards[0].left && (i === 0 || r.top >= cards[i - 1].bottom),
                );
              }),
            ).toBe(true);
            const cell = await page.locator('.bag-cell').first().boundingBox();
            expect(cell!.width).toBeGreaterThanOrEqual(44);
            expect(cell!.height).toBeGreaterThanOrEqual(44);
          }
          if ([390, 1440, 1920, 2552].includes(width))
            await page
              .locator('.overview-panel')
              .screenshot({ path: `test-results/map-${code}-${theme}-${width}.png` });
        }
      }
  }
  expect(errors).toEqual([]);
});

test('touch panning, keyboard and detail navigation preserve deliberate bag selections', async ({
  page,
  context,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/bag-filter/equipment/422-bf1');
  const viewport = page.getByRole('region', { name: 'Peta seluruh kompartemen 422-BF1', exact: true });
  const previous = page.getByRole('button', { name: 'Kompartemen sebelumnya', exact: true });
  const next = page.getByRole('button', { name: 'Kompartemen berikutnya', exact: true });
  await expect(previous).toBeDisabled();
  await next.click();
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBe(150);
  await previous.click();
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBe(0);

  await page.locator('.overview-matrix').first().scrollIntoViewIfNeeded();
  const cell = await page.locator('.overview-cell').nth(7).boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const x = cell!.x + cell!.width / 2,
    y = cell!.y + cell!.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 18, y }] });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(20);
  await expect(page.locator('.overview-cell[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.selection-bar')).toHaveCount(0);

  // A vertical touch on the same canvas must still move the page.
  const originScroll = await page.evaluate(() => scrollY);
  const box = await viewport.boundingBox();
  const touchY = Math.max(120, box!.y + 120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: touchY }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 180, y: touchY - i * 15 }],
    });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(originScroll);
  await expect(page.locator('.overview-cell[aria-pressed="true"]')).toHaveCount(0);
  await cdp.detach();

  await page.getByRole('button', { name: 'Buka detail kompartemen 2A', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Detail Comp. 2A', exact: true })).toBeVisible();

  await viewport.focus();
  await page.keyboard.press('Home');
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBe(0);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBe(150);
  await page.keyboard.press('Home');
  const first = page.locator('.overview-cell').first();
  const color = await first.evaluate((el) => getComputedStyle(el).backgroundColor);
  const fill = await first.evaluate((el) => el.style.background);
  await first.click();
  await expect(first).toHaveCSS('background-color', color);
  await expect(page.locator('.selection-bar strong')).toHaveText('1 posisi dipilih');
  await next.click();
  const position = await viewport.evaluate((el) => el.scrollLeft);
  await page.locator('.age-buckets button').first().click();
  await expect(first).toHaveCSS('background-color', color);
  await page.getByRole('button', { name: 'Tema', exact: true }).click();
  await page.getByRole('button', { name: 'Gelap', exact: true }).click();
  expect(await viewport.evaluate((el) => el.scrollLeft)).toBe(position);
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  // Empty bags intentionally use a different neutral in dark mode; their data fill stays intact.
  expect(await first.evaluate((el) => el.style.background)).toBe(fill);
  await viewport.focus();
  await page.keyboard.press('End');
  await expect(next).toBeDisabled();
  await page.getByRole('button', { name: 'Buka detail kompartemen 15B', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Detail Comp. 15B', exact: true })).toBeVisible();
  await expect(page.locator('.selection-bar strong')).toHaveText('1 posisi dipilih');
  await page.locator('.bag-cell').first().click();
  await expect(page.locator('.selection-bar strong')).toHaveText('2 posisi dipilih');
  await page.goto('/bag-filter/equipment/l61-bf1');
  await expect.poll(() => page.locator('.overview-viewport').evaluate((el) => el.scrollLeft)).toBe(0);
});

test('map adapts to sidebar width and orientation changes without stale scroll controls', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('plant-sidebar', 'expanded'));
  await page.goto('/bag-filter/equipment/421-bf1');
  const viewport = page.locator('.overview-viewport');
  await expect(page.locator('.overview-scroll-tools')).toBeVisible();
  await viewport.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'Kompartemen berikutnya', exact: true })).toBeDisabled();
  await page.keyboard.press('Control+b');
  await expect(page.locator('.shell:visible')).toHaveAttribute('data-sidebar', 'collapsed');
  await expect(page.locator('.overview-scroll-tools')).toBeHidden();
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBe(0);
  await page.keyboard.press('Control+b');
  await expect(page.locator('.overview-scroll-tools')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kompartemen berikutnya', exact: true })).toBeEnabled();
  for (const width of [390, 844, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.overview-scroll-tools')).toBeVisible({ visible: width < 1440 });
  }
});
