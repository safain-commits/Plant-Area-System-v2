# Plant Area: focused UI interaction audit

Test the locally running production build only. The project is a Next.js multi-zone platform with Portal `/`, Auth `/auth`, Bag Filter `/bag-filter`, and Consumable Room `/consumables`. Sign in at `/auth/login` with the temporary test account provided in the testing configuration. No public registration or password reset is needed. Login applies across all application paths.

Scope: hover readability and dismissible menus. Limit the generated plan to three high-priority UI test cases. Use a fresh authenticated browser context per case. This is a visual/read-only test: do not save stock movements, submit bag replacements, edit accounts or master data, change passwords, or disable applications. Opening forms and selecting filters is allowed. Do not scan/upload local archives, env files, backups, or internal material catalogs.

## UI01 — Dropdown dismissal and retained selections

On `/consumables` open the year dropdown labelled `Tahun transaksi stok`. Click visibly outside the dropdown without selecting an option. It must close, preserve the selected year, and return focus to its trigger. Repeat with a different outside position and with Escape. Clicking/searching within the dropdown must keep it open until selection or explicit dismissal. The menu must not immediately reopen.

On `/consumables/stock` repeat with `Ketersediaan` and a location/category dropdown when available. On `/bag-filter` repeat with `Tahun grafik`. On a bag equipment page, open the replacement form without saving and test its manufacturer select if available. Also test theme, account and notifications menus. Cover a 390px mobile bottom sheet and a 1440px desktop menu. Existing field values and draft selections must survive dismissal.

## UI02 — Light-theme hover readability

Set the theme to Terang using the Tema icon menu. Hover the user/account trigger, session details trigger, logout button (do not click logout), application expansion chevrons, equipment subgroup, select options, ordinary primary/secondary buttons, stock rows, and management tabs. All visible labels, captions, values and icons must remain readable against their hover backgrounds. Normal text should have at least 4.5:1 contrast. Disabled controls must remain disabled. Hover must not select options, submit forms or change data.

## UI03 — Dark-theme hover readability

Repeat UI02 in Gelap. Check especially black text on dark hover surfaces and light text on pale hover surfaces. In the year menu, selected, highlighted and unselected options must remain legible. Test pointer leave to ensure normal state recovers. Confirm dropdown dismissal by outside click still works after a theme change. Capture screenshots and identify exact control labels/routes for failures.

## Expected behavior

Menus close on a genuine outside click/tap or Escape, and remain open during interaction inside. Focus returns to the trigger. Choosing an option updates its value and closes the menu once. The shared overlay must not reactivate an enclosing field label or parent click handler. Selecting text or dragging from inside to outside is not a deliberate backdrop click. Theme, filters, navigation and local form drafts remain functional.

Report only behavior actually observed. If tunnelling or authentication is blocked, report infrastructure as blocked instead of reporting application failures. No dummy operational data or invented pass results.
