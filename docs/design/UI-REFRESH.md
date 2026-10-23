# UI Refresh Brief v2 — Plant Area System (Portal · Auth · Bag Filter)

Give the existing app a fresh, premium visual design. Keep every feature, flow, permission rule, label and data source as they are. Only the presentation and interaction feel change. Earlier theme rules for the app no longer apply; this brief replaces them. Use the token sheet (ui-brief.jsonc) as the single source of truth for values. You may build the controls on shadcn/ui components, but restyle them completely to these tokens so nothing looks like the library default.

## The look

The app should feel calm, airy, data-first and expensive. Pages sit on a light-gray canvas. Content lives in white cards with 16px corners and no borders. Lime is the hero data color: it marks whatever value is active or important. Orange marks contrast (negative, behind target, warnings). Near-black "ink" is used for decisions: primary buttons, checked controls, selection rings and small tooltips. Everything inactive is drawn as a flat soft-gray copy of the same shape, so a chart with one highlighted day shows the other days as quiet gray bars. Active data marks get a fine 45° diagonal hatch. Big numbers carry the hierarchy: large, medium weight, tight tracking, tabular figures. Labels stay small and gray.

## Shell

- **Sidebar.** It follows the theme: a white panel on the gray canvas in light mode, a dark panel in dark mode.
  - **Contents:** the wordmark, nav items (icon + label, 48px tall, 12px corners), expandable groups whose children connect with a thin tree line, count badges, a divider, secondary links, a bottom session card and a "Collapse sidebar" row.
  - **Active item:** a soft gray pill (dark gray in dark mode) with bold text, plus a short indicator bar on its left edge. The bar is ink in light mode and lime in dark mode, and it glides to the new item when the page changes.
- **Sidebar collapse.** The sidebar collapses to a 76px icon rail.
  - **Ways to toggle:** the footer row, a small round handle that appears on the sidebar's right edge when hovered, and the ⌘B / Ctrl+B shortcut.
  - **Collapsed anatomy:** icons stay exactly in place. The logo becomes a monogram. Groups open as a flyout menu to the right. Count badges shrink to dots. The session card becomes an icon with a thin progress ring for time left. Every icon shows a tooltip with its label and shortcut.
  - **Motion:** on collapse, labels fade and slide out first, then the width shrinks. On expand, the width grows first, then labels fade in with a light stagger. The motion takes about 300ms on a soft, decelerating curve.
  - **Defaults:** collapsed on tablet widths, where expanding floats over the content. Expanded on desktop, where it is docked and the content smoothly reflows. The user's choice is remembered per browser.
- **Header.** It contains:
  - A 48px search trigger showing a ⌘K hint. It opens a command palette.
  - 48px square icon buttons: a theme switcher (Light / Dark / System menu) and notifications with an orange dot.
  - A user chip with a round avatar, name and email.
  - One header action button.
- **Content grid (widest screens).** It has a main column and a 360px right rail. Main row 1 is a split hero card: chart panel plus a 240px KPI rail, with the chart panel casting a soft shadow onto the rail. Row 2 has two cards and row 3 has three. The rail holds a feature widget and a long list card that scrolls inside. Cards in a row share the same height.

## Premium inputs, dropdowns and overlays

- **Text fields.** 44px tall with 12px corners. Each has a real label above and helper text or a counter below.
  - **At rest:** the field is slightly tinted, with a hairline border.
  - **On focus:** it turns white, the border goes lime-green and a soft lime halo grows around it. The leading icon darkens. A clear button fades in when there is a value.
  - **Errors:** the field turns red with a red halo and one gentle shake. The message slides in below.
  - **Counters:** turn orange near the limit and red at the limit.
  - **Units:** 'WIB' or 'days' appear as small chips inside the field.
  - **Textareas:** grow with content.
- **Date and time.** The field opens a refined calendar popover. Today has a thin ring, the selected day is filled with ink, and a time list snaps as it scrolls. There is a "Now" shortcut.
- **Selects and menus.**
  - **Panels:** frosted, slightly translucent, with 14px corners, a layered soft shadow and 6px inner padding.
  - **Items:** 36px rows. One highlight pill glides smoothly between items as the pointer or keyboard moves; items don't flash individually. The selected item shows a check that draws in.
  - **Structure:** groups have small gray labels and hairline separators.
  - **Long lists:** fade at the scroll edges.
  - **Animation:** panels scale and fade in from the trigger's side in under 200ms and close even faster. The trigger's chevron rotates.
- **Searchable selects.** Equipment, brand and user lists have a search row pinned at the top, highlight the matched characters and show a clear "No results" state. Multi-select shows chips inside the trigger that animate in and out and collapse to "+3".
- **Command palette.** A centered frosted dialog with a large search field. Results are grouped (Recent, Pages, Equipment, Batches) and a hint row at the bottom shows the keys.
- **Checkbox, radio and switch.** Checked states use ink in light mode and lime in dark mode. Checkmarks draw in. Switch thumbs slide with a firm spring.
- **Segmented controls.** The active pill slides between options.
- **Tooltips.** Small ink tooltips. The first one waits a moment; moving to the next one shows it instantly.
- **Dialogs, sheets and toasts.**
  - **Dialogs:** 20px corners, a blurred scrim and a gentle scale-in.
  - **Sheets:** forms like "install bags" open in a right-side sheet on desktop and a draggable bottom sheet on mobile.
  - **Toasts:** stack with depth and pause when hovered.
  - **Below 640px:** all selects and menus become bottom sheets.
- **Buttons.**
  - **Primary:** ink.
  - **Accent:** lime with black text, used at most once per view for the main commit action.
  - **Others:** outline, ghost and destructive (red).
  - **Feedback:** every button presses down slightly. Loading swaps the label for a spinner without changing width.

## Motion feel

Motion is quick, soft and physical. Things appear from where they came from and leave faster than they arrived. Nothing bounces visibly, and most transitions take 140–280ms.

- **Page load:** cards fade up with a light stagger.
- **Data:** KPI numbers count up and changed values roll. Chart bars grow from the zero line, and gauges and progress bars sweep in.
- **Hover:** clickable cards lift slightly.
- **Theme switch:** a circular reveal spreads from the switcher. It never resets a form draft or the selected bag positions.
- **Reduced motion:** honor the user's reduced-motion setting by replacing all movement with short fades.

## Data components

- **Bar chart.** Positive values stack above zero (lime base with a yellow-lime cap) and negative values go below zero in orange, with 4px gaps between segments.
  - **States:** inactive slots are gray. The active slot shows color plus hatch.
  - **Tooltip:** a white tooltip glides with the active slot, showing the date and rows of dot, label and value.
- **KPI block.** Small label, 32px value, and a trend row with an arrow. A good trend is green text and a bad trend is orange.
- **Capacity bar.** Lime with hatch, a 4px gap and a gray remainder. It turns orange at 90%.
- **Distribution bar.** Rounded segments with a legend list below.
- **Semi-circle gauge.** Four segments filled with a yellow-to-lime gradient with hatch.
- **Progress list rows.** Thumbnail, name, fraction with the second part gray, a 14px bar (lime when on track, orange when behind) and a helper line.
- **Activity list rows.** Logo tile, name with date below, and on the right a value with a status word below. Rows highlight on hover.
- **Hero card.** Lime gradient with wavy contour lines and black text. It tilts slightly toward the pointer.
- **Tip card.** Text with a "Read more ›" link. A hatched mosaic of small tiles fades toward the left.

## Bag age colors and the bag map

- **Age scale.** It runs from lime (new) through yellow and orange to red (oldest). Stops are at 0, 150, 300, 450, 600, 750 and 900+ days, and the scale stays red from 900 days on.
  - **Values:** #8FCB2F, #BDD62E, #EBD52F, #F7B32B, #F4862A, #E65A2A, #CF2E2E.
  - **Map cells:** blend smoothly along the scale.
  - **Legends and distribution bars:** use 7 buckets.
  - **Themes:** the same colors appear in both themes.
- **Never-installed positions.** Plain gray (light gray in light mode, dark gray in dark mode). The detail view adds a dashed outline.
- **Cell details.**
  - In light mode, cells have a faint inner edge so yellow cells don't melt into white.
  - Cells at 900+ days get a small corner notch, so the oldest bags are recognizable without color.
  - Text on cells is black, except on red, where it is white.
- **Selection.** Selection is a double ring (ink ring around a thin surface-colored gap) plus a small check, never a fill color. Selection supports:
  - Click.
  - Shift-click for ranges.
  - Drag-to-select with a dashed marquee.
  - Keyboard: arrows move, Space toggles.
- **Selection bar.** A floating bar slides up showing the count, a clear action and the main action.
- **Hover.** Hovering a cell rings it, highlights its row and column labels and shows a tooltip with coordinate, age, install date (WIB) and brand.
- **Legend filter.** Clicking a legend bucket dims all other cells.

## Light and dark

Both themes use the same layout, the same lime, orange and age fills, and the same hatch.

- **Light.**
  - **Surfaces:** gray canvas, white cards and a white sidebar, with no card borders and no card shadows.
  - **Overlays:** frosted white.
- **Dark.**
  - **Surfaces:** near-black canvas. Cards and the sidebar are dark gray with hairline borders, and placeholders are a deeper gray.
  - **Overlays:** frosted dark.
  - **Text:** flips to light grays. Trend and status text uses the lighter steps.
  - **Ink and accents:** ink elements invert to near-white, except checked controls and the sidebar indicator, which use lime.

## Responsive behavior (640 / 768 / 1024 / 1280 / 1536)

- **Below 640.**
  - **Sidebar:** a swipeable left drawer, with no collapse state.
  - **Search:** an icon that opens a full-screen palette.
  - **Layout:** one column. KPIs become a swipeable chip row under the chart.
  - **Controls:** inputs are 48px tall, overlays are bottom sheets and touch targets are at least 44px.
- **From 640.** Small cards pair into two columns.
- **From 768.**
  - **Sidebar:** the collapsed icon rail. Expanding floats over the content.
  - **Header:** the search field is visible.
  - **Overlays:** popovers anchored to their trigger.
- **From 1024.** The hero card splits into chart and KPI rail. Row 2 has two columns.
- **From 1280.** The sidebar is expanded and docked by default, and the content reflows when it collapses. The right rail column appears.
- **From 1536.** The layout matches the reference.

## Token rules and usage

1. **Two palettes only.** Primary (lime) and secondary (pumpkin), each 50–950. Add the neutral gray ramp (0–1000; ink = gray-950), a short accent list (highlight yellow, lavender, danger) and the dedicated age scale. Do not introduce any other hues.
2. **Lime is a fill, never text on white.** Text on lime is always ink. Positive text uses primary-700 (light) or primary-300 (dark).
3. **Secondary means contrast.** Use it for negative values, behind-target progress, warnings and the notification dot. It is not used for selection.
4. **Ink means decisions.** Use it for primary buttons, checked controls (lime in dark mode), selection rings and small tooltips.
5. **One accent button per view, at most.** Danger is only for destructive actions and errors, and never appears in charts.
6. **Inactive equals placeholder gray, same shape.** The placeholder style doubles as the loading skeleton.
7. **Hatch only on active lime, orange or highlight fills.** Never put it on placeholders, text, icons or age cells.
8. **Age colors only come from the age tokens.** They never come from primary or secondary, and they are identical in both themes.
9. **Gray roles.**
    - **Light mode:** gray-950 for primary text, gray-700 for secondary text and gray-500 for captions. gray-400 is only for placeholders and axis ticks.
    - **Dark mode:** captions use gray-400.
10. **Elevation by tone.**
    - **Light-mode cards:** no border and no shadow.
    - **Shadows:** only on overlays, chart tooltips, the hero split panel, the hero card, a floating sidebar and hovered clickable cards.
    - **Dark mode:** hairline borders replace card shadows.
11. **Fixed geometry.**
    - **Radius:** card 16, dialog 20, overlay 14, tile and input 12, control 10, menu item 8, bar 6, progress 4, bag cell 3.
    - **Spacing:** 4px base, card padding 24 (20 on mobile), grid gap 16 (12 on mobile).
12. **Type scale only.**
    - **Sizes:** 40, 32, 28, 20, 18, 15, 14, 13, 12, 11, 10.
    - **Weights:** 400 and 500.
    - **Figures:** tabular figures for every number, date and coordinate.
13. **Motion tokens only.**
    - **Durations:** 80 / 140 / 200 / 280 / 400 / 600ms.
    - **Curves:** standard, enter, exit, drawer and spring, as defined in the token sheet.
    - **What moves:** animate opacity and position/scale only. The sidebar width is the one exception.
14. **Accessibility.**
    - **Focus:** lime focus border with halo on inputs, and a visible ring on everything else.
    - **Non-color cues:** trends carry arrows, statuses carry words, selection uses a double ring and check, and the oldest bags carry a notch.
    - **Keyboard:** full support for menus, palette and bag map.
    - **Contrast:** text passes AA in both themes.

## Done when

- Every screen in Portal, Auth and Bag Filter uses only these tokens and component specs.
- The sidebar collapses and expands smoothly and remembers its state.
- All dropdowns, inputs, overlays and transitions match the premium specs.
- The bag map uses the new age scale with the double-ring selection.
- Both themes pass AA for text, and all five breakpoints behave as described.
- Empty, loading and error states exist for every card.
- No feature or permission behavior has changed.
