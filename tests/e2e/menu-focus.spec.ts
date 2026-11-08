import { test, expect, request, type APIRequestContext, type Locator, type Page } from '@playwright/test';
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

const email = `menu-anchor-${randomUUID()}@example.test`,
  password = randomUUID() + randomUUID();
const actor: Identity = {
  id: randomUUID(),
  email,
  name: 'Operator Menu Uji',
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
  await setAppGrant(actor, userId, 'consumables', { appId: 'consumables', role: 'admin' });
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

for (const theme of ['light', 'dark'])
  for (const width of [1280, 390])
    test(`theme menu separates pointer and keyboard focus in ${theme} at ${width}px`, async ({
      page,
      browserName,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('plant-ui-theme', value), theme);
      await page.goto('/auth/login');
      const trigger = page.getByRole('button', { name: 'Tema', exact: true }),
        menu = page.getByRole('dialog', { name: 'Tema', exact: true }),
        first = menu.getByRole('button', { name: 'Terang', exact: true }),
        second = menu.getByRole('button', { name: 'Gelap', exact: true });
      await expect(trigger).toBeEnabled();
      await trigger.click();
      await expect(menu).toBeVisible();
      await expect(first).toHaveCSS('outline-style', 'none');
      expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      await menu.screenshot({ path: `.test-runtime/menu-${browserName}-${theme}-${width}-pointer.png` });

      await page.keyboard.press('Home');
      await expect(first).toBeFocused();
      await expect(first).toHaveCSS('outline-style', 'solid');
      await expect(first).toHaveCSS('outline-offset', '-2px');
      await page.keyboard.press('ArrowDown');
      await expect(second).toBeFocused();
      await expect(second).toHaveCSS('outline-style', 'solid');
      await menu.screenshot({ path: `.test-runtime/menu-${browserName}-${theme}-${width}-keyboard.png` });
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();

      // A pointer reopen after keyboard dismissal must clear the previous keyboard mode.
      await trigger.click();
      await expect(first).toHaveCSS('outline-style', 'none');
      await page.mouse.click(1, 1);
      await expect(menu).toBeHidden();
      await trigger.dispatchEvent('click', { detail: 0 });
      await expect(menu).toHaveAttribute('data-focus-input', 'keyboard');
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await trigger.press('Enter');
      await expect(first).toBeFocused();
      await expect(first).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('Enter');
      await expect(menu).toBeHidden();
      await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'light');
      await expect(trigger).toBeFocused();
    });

async function measureMenu(
  page: Page,
  trigger: Locator,
  menu: Locator,
  placement: 'bottom' | 'bottom-end' | 'right',
) {
  await trigger.click();
  await expect(menu).toBeVisible();
  const triggerBox = (await trigger.boundingBox())!;
  const menuBox = (await menu.boundingBox())!;
  const { clientWidth, clientHeight, originX, originY } = await menu.evaluate((el) => {
    const rawOrigin = el.style.getPropertyValue('--anchor-origin').trim() || '0px 0px';
    const [ox, oy] = rawOrigin.split(/\s+/).map((v) => Number.parseFloat(v) || 0);
    return {
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      originX: ox,
      originY: oy,
    };
  });

  // Menu completely within clientWidth - 8 and clientHeight - 8
  expect(menuBox.x).toBeGreaterThanOrEqual(8 - 1);
  expect(menuBox.y).toBeGreaterThanOrEqual(8 - 1);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(clientWidth - 8 + 1);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(clientHeight - 8 + 1);

  if (placement === 'right') {
    expect(Math.abs(menuBox.x - (triggerBox.x + triggerBox.width) - 8)).toBeLessThanOrEqual(1);
    const absOriginY = menuBox.y + originY;
    expect(absOriginY).toBeGreaterThanOrEqual(triggerBox.y - 1);
    expect(absOriginY).toBeLessThanOrEqual(triggerBox.y + triggerBox.height + 1);
  } else {
    // Vertical distance to trigger = 8 px
    expect(Math.abs(menuBox.y - (triggerBox.y + triggerBox.height) - 8)).toBeLessThanOrEqual(1);
    // Transform origin inside trigger box
    const absOriginX = menuBox.x + originX;
    expect(absOriginX).toBeGreaterThanOrEqual(triggerBox.x - 1);
    expect(absOriginX).toBeLessThanOrEqual(triggerBox.x + triggerBox.width + 1);

    if (placement === 'bottom-end') {
      const unclampedLeft = triggerBox.x + triggerBox.width - menuBox.width;
      const clamped = unclampedLeft < 8 || unclampedLeft + menuBox.width > clientWidth - 8;
      if (!clamped) {
        expect(Math.abs(menuBox.x + menuBox.width - (triggerBox.x + triggerBox.width))).toBeLessThanOrEqual(
          1,
        );
      }
    } else {
      const unclampedLeft = triggerBox.x;
      const clamped = unclampedLeft < 8 || unclampedLeft + menuBox.width > clientWidth - 8;
      if (!clamped) {
        expect(Math.abs(menuBox.x - triggerBox.x)).toBeLessThanOrEqual(1);
      }
    }
  }

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  return menuBox;
}

for (const width of [1024, 1280, 1536])
  for (const classicScrollbar of [false, true])
    test(`header menus, select, and sidebar flyout anchor accurately at ${width}px (${classicScrollbar ? 'classic scrollbar' : 'overlay scrollbar'})`, async ({
      page,
    }) => {
      await page.context().addCookies((await client.storageState()).cookies);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/bag-filter');
      if (classicScrollbar) {
        await page.addStyleTag({
          content: `
            html { overflow-y: scroll !important; }
            html::-webkit-scrollbar { width: 16px !important; height: 16px !important; display: block !important; }
            html::-webkit-scrollbar-track { background: rgba(128, 128, 128, 0.15); }
            html::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.45); }
          `,
        });
      }

      // 1. Theme menu (bottom-end)
      await measureMenu(
        page,
        page.getByRole('button', { name: 'Tema', exact: true }),
        page.getByRole('dialog', { name: 'Tema', exact: true }),
        'bottom-end',
      );

      // 2. Activity menu (bottom-end)
      const activityBox = await measureMenu(
        page,
        page.getByRole('button', { name: 'Notifikasi aktivitas', exact: true }),
        page.getByRole('dialog', { name: 'Aktivitas aplikasi', exact: true }),
        'bottom-end',
      );

      // 3. Account menu (bottom-end)
      const accountBox = await measureMenu(
        page,
        page.getByRole('button', { name: 'Menu akun', exact: true }),
        page.getByRole('dialog', { name: actor.name, exact: true }),
        'bottom-end',
      );

      // Activity and Account menus do not open at the same x coordinate
      expect(activityBox.x).not.toBe(accountBox.x);

      // 4. Select dropdown (bottom)
      await measureMenu(
        page,
        page.getByRole('combobox', { name: 'Tahun grafik', exact: true }),
        page.getByRole('dialog', { name: 'Tahun grafik', exact: true }),
        'bottom',
      );

      // 5. Sidebar flyout (right)
      const flyoutTrigger = page.getByRole('button', { name: 'Menu Bag Filter', exact: true });
      if (!(await flyoutTrigger.isVisible())) {
        await page.getByRole('button', { name: 'Ciutkan sidebar', exact: true }).click();
      }
      await expect(flyoutTrigger).toBeVisible();
      await measureMenu(
        page,
        flyoutTrigger,
        page.getByRole('dialog', { name: 'Bag Filter', exact: true }),
        'right',
      );
    });
