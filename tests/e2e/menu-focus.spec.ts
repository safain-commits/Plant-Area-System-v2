import { test, expect } from '@playwright/test';

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
