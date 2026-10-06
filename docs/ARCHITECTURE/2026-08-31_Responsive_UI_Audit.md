# Responsive & UI Design Audit — 2026-08-31

Static code audit (no live login/dev server available) covering Dashboard, POS/Cart, Sales
Hub, Products/Inventory, Repairs/Old Gold/Memo/Layaway/Savings, Metal Rates, Settings/Print
Template Designer, and the main Sidebar layout, checked against mobile (375–428px), tablet
(768–1024px), small laptop (1280–1440px), and large desktop (1920px+). Triggered by a reported
Dashboard bug on iPhone: KPI cards truncating currency values ("US$11,74…") and a chart
tooltip on Revenue Overview covering/overflowing the chart on a 390px screen.

Audited against the project's own bar in `docs/11-developer-guidelines/RESPONSIVE_STANDARDS.md`
and `docs/11-developer-guidelines/FRONTEND_STANDARDS.md`, not generic best practices.

---

## Executive summary

The app follows a fairly consistent Tailwind mobile-first convention on its newer/rebuilt
pages (Dashboard, POS, Sales Hub, Products, module pages like Repairs/OldGold/Layaway/Savings),
and the sidebar has a correctly-built off-canvas mobile drawer. The reported Dashboard bug is
real and traced to two concrete causes: the KPI cards render currency via `truncate` with no
`title` fallback (so long formatted numbers genuinely lose information rather than reflow), and
the chart's `ResponsiveContainer`/`RechartsTooltip` setup has no touch-dismiss handling and no
width clamping, so on a 390px screen the default Recharts tooltip (positioned near the
cursor/touch point, sized to its content) can render wider than the remaining chart area and
stays open until another tap lands exactly on the chart. Beyond the reported bug, the
codebase's structural pattern is sound (grids stack correctly, modals mostly cap
`max-h-[85-92vh]`), but there's one raw un-scrollable `<table>` (Layaway), a legacy duplicate
Inventory page with off-token styling, and an app-wide reliance on bespoke `fixed inset-0`
modals and raw palette colors already flagged as tech debt in `FRONTEND_STANDARDS.md`.

---

## Critical (breaks/unusable on a real device — matches the reported bug)

1. **KPI card value truncation loses information, no fallback.**
   `frontend/src/pages/Dashboard.tsx:831` — `<p className="text-2xl font-bold text-foreground
   leading-none truncate">{item.value}</p>` inside a card grid `grid-cols-2 lg:grid-cols-4`
   (`:819`) with icon (`h-5 w-5 shrink-0`) + label at `text-xs`. At 390px width, two cards per
   row leaves ~150–160px of card width minus icon/gap/padding for a `text-2xl` (24px) currency
   string like "US$11,748.00" — exactly the truncation from the screenshot. **Fix**: drop to
   `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` at the base breakpoint, or keep 2 columns but
   shrink the value font at base (`text-lg sm:text-xl lg:text-2xl`) and add `title={item.value}`
   for inspectability, or use a compact currency format ("11.7K") below a breakpoint instead of
   ellipsis-only truncation.

2. **Revenue Overview chart tooltip has no dismiss/clamp behavior on touch, overflows the card
   on narrow widths.**
   `frontend/src/pages/Dashboard.tsx:852-883` — chart is correctly wrapped in
   `<ResponsiveContainer width="100%" height="100%">` (`:856`), so the chart itself resizes
   fine; the bug is `RechartsTooltip` (`:867-871`) using Recharts' default positioning with no
   `wrapperStyle`, no `position` prop, no `allowEscapeViewBox` control. On a 390px viewport
   (card padding `p-5` leaves ~350px, `h-80` chart), a tooltip sized to fit "Date: Aug 30 /
   Revenue: US$11,748.23" (~180–220px) rendered near the right edge can be pushed/clipped past
   the card edge. Recharts' `Tooltip` triggers on hover/mousemove by default; on touch, the
   first tap opens it via a synthetic mouseenter with no tap-outside or second-tap-to-close
   handler wired up, so it stays open until another touch lands directly on a different chart
   x-position. **Fix**: add `wrapperStyle={{ pointerEvents: 'auto', zIndex: 20 }}`, clamp
   `position` to stay within the container width or set `allowEscapeViewBox={{x:false,
   y:false}}`, `isAnimationActive={false}`; add an `onClick`/`onTouchStart` handler on the
   chart wrapper div (`:852`) that closes the tooltip via local state, or switch to a custom
   `content={...}` render prop with an explicit close affordance. Also bump `activeDot={{r:6}}`
   (`:878`) to `r: 8-10` for a larger touch target.

3. **Same tooltip-clamp gap on all 3 other Dashboard charts** — Sales-by-Category `BarChart`
   (`:898-914`), Inventory Status `PieChart` (`:932-954`), Payment Methods `PieChart`
   (`:1011-1033`) — identical unclamped `contentStyle`-only config. Fix once in a shared
   `<AppChartTooltip>` wrapper so all four charts get the fix simultaneously.

4. **Layaway item-line table has no horizontal-scroll wrapper (violates the project's own
   `RESPONSIVE_STANDARDS.md` rule).**
   `frontend/src/pages/LayawayPage.tsx:812-819` — `<div className="rounded-lg border
   border-border overflow-hidden"><table className="w-full text-sm">` with 5 columns inside a
   `max-w-5xl` modal (`:733`). The wrapper uses `overflow-hidden`, not `overflow-x-auto` — the
   standards doc requires raw `<table>`s be wrapped in `overflow-x-auto`. On a narrow modal,
   long descriptions plus 3 fixed-width numeric columns get clipped invisibly instead of
   scrollable. **Fix**: change `overflow-hidden` → `overflow-x-auto` (move rounding to an outer
   non-scrolling shell if needed), or migrate to `ResponsiveTable` per the doc's pattern.

---

## High priority (significant, not fully broken)

5. **Dashboard "Recent Transactions" action icons are sub-40px touch targets.**
   `Dashboard.tsx:743-767` — View/Print/Delete are raw `<button>`s wrapping only a `h-4 w-4`
   (16px) icon, no padding, no `Button` primitive. Violates the standards doc's ≥40px tap
   target rule and the golden rule to use `Button` rather than hand-roll. **Fix**: wrap in
   `Button variant="ghost" size="icon"` or add `p-2 -m-2`.

6. **Legacy `Inventory.tsx` (routed at `/inventory`) duplicates `ProductsPage.tsx` with older,
   off-token styling.** `Inventory.tsx:117-140` — raw `<table>` with literal `text-gray-500`,
   `bg-gray-50`, `border-gray-100` instead of semantic tokens, unlike `ProductsPage.tsx` (the
   doc's reference implementation using `ResponsiveTable`). It does wrap in `overflow-x-auto`
   so it isn't horizontally broken, but it's an unaudited, inconsistent surface still routed at
   `AppRoutes.tsx:130`. **Fix**: confirm if `/inventory` is still linked anywhere; remove the
   dead route or migrate it to `ResponsiveTable` + semantic tokens.

7. **Module-page modals (Repairs, Layaway, Old Gold, Savings Schemes, Memo, Metal Rates — 24
   `fixed inset-0` occurrences across 6 files) are bespoke overlays, not the `Dialog`/
   `ModalBase` primitive**, flagged as known tech debt in `FRONTEND_STANDARDS.md §8`. They do
   correctly follow `max-w-* w-full max-h-[85-92vh] overflow-y-auto`, so not visually broken,
   but miss focus-trap/ESC-to-close/scroll-lock for free and will drift over time. Lower
   urgency; worth a batch migration pass.

8. **Bare `grid-cols-3`/`grid-cols-4` summary grids inside module modals may feel tight at
   375px**: `RepairsPage.tsx:510`, `OldGoldPage.tsx:547,600`, `SavingsSchemesPage.tsx:897,
   1027,1162,1376,1419`, `MemoPage.tsx:812`, `ProductsPage.tsx:787`, `LayawayPage.tsx:880,1097,
   1468`. Inside `max-w-lg`/`max-w-md`/`max-w-xl` modals, a 4-column grid of labeled numbers
   can squeeze each cell to ~80px. Not truncating like the KPI cards, but should be spot-checked
   — recommend `grid-cols-2 sm:grid-cols-3` / `grid-cols-2 sm:grid-cols-4` for currency/date
   cells rather than a flat `grid-cols-3`/`grid-cols-4`.

---

## Medium / Polish

9. **Dashboard KPI icon colors use raw Tailwind palette classes**, not semantic tokens —
   `Dashboard.tsx:772-775`: `text-blue-600`, `text-green-600`, `text-amber-600`,
   `text-orange-600`. Violates `FRONTEND_STANDARDS.md`'s golden rule 1; also not covered by the
   `dark:` treatment already present elsewhere on the page (e.g. the delete modal).

10. **Delete Sale confirmation modal (`Dashboard.tsx:1138-1245`) is hand-rolled**, using
    literal `bg-red-50`/`bg-yellow-50`/`bg-blue-50` and `red-900`/`yellow-900`/`blue-900` text
    with **no dark-mode variant**, unlike the rest of the modal which does have `dark:`
    classes — likely poor contrast in dark mode. Its `grid-cols-2` sale-detail block (`:1157`)
    has no breakpoint override, though low risk at `max-w-2xl`.

11. **Inconsistent breakpoint density across pages** — confirms the existing per-page audit
    table in `RESPONSIVE_STANDARDS.md` (dated 2026-08-08, now stale). `SalesHubPage.tsx` has
    only 5 explicit breakpoint usages in 547 lines (acceptable — single centered column, few
    columns to reflow), versus 15–30+ in Repairs/Layaway/OldGold/SavingsSchemes/Memo. Not a
    defect, but the standards doc's table should be refreshed to include the Dashboard chart
    findings, the Sales Hub redesign, and Print Template Designer before anyone trusts its
    stale ✅ marks.

12. **`TemplateCanvas.tsx` (Print Template Designer) uses a fixed `min-h-[520px]` preview
    container** (`:1114`) and a `grid-cols-9` micro-grid for a label/QR block (`:171`, low
    impact). Desktop-oriented power-user tool, so polish-only — verify the outer designer page
    has an `overflow-x-auto` fallback below `md:` since Settings is still sidebar-reachable on
    tablet.

---

## Prioritized punch list

1. ✅ **Fixed 2026-08-31** — Dashboard KPI card truncation — `Dashboard.tsx:819,831`: grid is
   now `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, value text steps `text-lg sm:text-xl
   lg:text-2xl`, and a `title` fallback was added. *(Critical, reported bug, low effort)*
2. ✅ **Fixed 2026-08-31** — Revenue Overview chart tooltip clamped via a shared
   `CHART_TOOLTIP_PROPS` constant (`allowEscapeViewBox`, `wrapperStyle`,
   `isAnimationActive: false`) and `activeDot` radius bumped 6→9 for touch. *(Critical, reported bug, medium effort)*
3. ✅ **Fixed 2026-08-31** — same `CHART_TOOLTIP_PROPS` applied to the other 3 Dashboard charts
   (`:903-906`, `:949-952`, `:1028-1031`). *(Critical, low incremental effort)*
4. ✅ **Fixed 2026-08-31** — Layaway item table's `overflow-hidden` → `overflow-x-auto` +
   `min-w-[480px]` on the table — `LayawayPage.tsx:812-813`. *(Critical, one-line fix)*
5. ✅ **Fixed 2026-08-31** — Dashboard row-action touch targets enlarged (`p-2 -m-1
   rounded-md` + hover background) — `Dashboard.tsx:756-778`. *(High, low effort)*
6. ✅ **Fixed 2026-08-31** — confirmed via grep that no sidebar link or `navigate()` call
   anywhere in the frontend points to `/inventory`; removed the dead route in
   `AppRoutes.tsx:130` with a comment explaining why, left `Inventory.tsx` in place
   unmigrated in case an external deep link still needs it. *(High)*
7. ✅ **Fixed 2026-08-31** — spot-checked all cited `grid-cols-3`/`grid-cols-4` summary grids.
   The genuine value-summary cases (currency/date cells, not short 3-up metric strips or
   payment-method button rows) were loosened: `OldGoldPage.tsx:600` (Live Valuation Preview,
   `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`), `SavingsSchemesPage.tsx:897` (plan totals,
   → `grid-cols-2 sm:grid-cols-3`), `:1027` (schedule preview, → `grid-cols-2 sm:grid-cols-3`),
   `:1376` (payment summary incl. a customer name, → `grid-cols-1 sm:grid-cols-3`),
   `MemoPage.tsx:812` (item-entry row, → `grid-cols-2 sm:grid-cols-3` with description/total
   spanning both mobile columns). Left as-is: `RepairsPage.tsx:510` and `LayawayPage.tsx:880,
   1097,1468`/`SavingsSchemesPage.tsx:1162,1419` — these are either form-field grids (select +
   number input, not read-only values) or short-label payment-method button rows / 3-up metric
   card strips that already fit comfortably at 375px. `ProductsPage.tsx:787` is a 3-card KPI
   strip of plain integer counts (confirmed rendering fine in the user's own screenshot) — left
   the grid alone but moved its icon colors off raw palette classes while touching the file (see
   item 9). *(High, medium effort)*
8. ✅ **Fixed 2026-08-31** — Dashboard delete-sale modal (`Dashboard.tsx:1160-1294`): added
   `dark:` variants throughout (header, "Cannot Delete Sale", "Warnings", "Inventory Impact"
   boxes — previously red-900/yellow-900/blue-900 text had zero dark-mode treatment while the
   rest of the modal did), fixed a pre-existing duplicate-class bug on the Cancel button
   (`hover:bg-gray-200 dark:bg-muted` had `dark:bg-muted` twice, one meant to be a hover state),
   and gave the Sale Details `grid-cols-2` block a mobile fallback (`grid-cols-1
   sm:grid-cols-2`). Not migrated to `Dialog`/`ModalBase` — see item 10, same tech-debt class,
   deliberately not done in this pass. *(Medium)*
9. ✅ **Fixed 2026-08-31** — Dashboard KPI icons moved from `text-blue-600`/`text-green-600`/
   `text-amber-600`/`text-orange-600` to semantic tokens (`text-primary`, `text-success-600`,
   `text-warning-600` ×2 → differentiated to `text-warning-600`/`text-chart-4` since both
   Low Stock and Revenue This Month were raw-`warning`-colored originally but visually distinct
   colors — `text-chart-4` keeps that distinction while staying token-driven). Also fixed
   `ProductsPage.tsx:789-791`'s matching KPI strip (`text-sky-600`/`text-amber-600`/
   `text-red-600` → `text-primary`/`text-warning-600`/`text-danger-600`) while touching that
   file for item 7. *(Medium, cosmetic)*
10. **Deliberately not done** — batch-migrating bespoke `fixed inset-0` modals to `Dialog`/
    `ModalBase`. Re-scoped after a full count: **36 occurrences across 16 files** (not 6 pages
    as originally estimated — also includes POS, Signup, Employees, Metal Rates, Catalog Sync,
    Dashboard, Serialized Inventory, and more), verified via `grep -rn "fixed inset-0"
    frontend/src/pages`. Each modal has its own form state, focus handling, and real business
    logic (repair intake, layaway payment collection, memo in/out, etc.) — a mechanical
    find-and-replace risks subtle regressions (focus trap, ESC-to-close, scroll-lock behavior
    changing) that can't be caught by `tsc` and weren't verifiable in this session without a
    live browser against the running app. Recommend this become its own dedicated pass with
    real device/browser testing, not folded into an unrelated fix. *(Medium/Large, larger
    effort, already tracked as tech debt — intentionally deferred, not attempted)*
11. ✅ **Fixed 2026-08-31** — added a "Per-page audit refresh (2026-08-31)" section to
    `RESPONSIVE_STANDARDS.md` covering everything fixed across this and the prior session (the
    2026-08-08 table is left in place for history; the refresh section is authoritative where
    the two overlap) plus an explicit "Open backlog" entry for item 10 above. *(Low effort,
    docs only)*
12. ✅ **Verified 2026-08-31, no code change needed** — `TemplateCanvas.tsx:1114`'s canvas
    wrapper already has `overflow-auto` (handles horizontal scroll, not just the `min-h-[520px]`
    noted in the original audit), and its parent panel in `PrintTemplateDesigner.tsx:915` also
    has `overflow-auto` — the designer already degrades to scrolling rather than clipping below
    `md:`. *(Low priority, verification only)*

Items 1–9, 11, and 12 were fixed/verified with a clean `npx tsc --noEmit` run on 2026-08-31.
Item 10 was deliberately scoped down to research + a documented recommendation rather than
attempted blind. No live device/browser test was performed in either session (no login
credentials to the deployed app) — recommend a manual phone check across Dashboard, Old Gold,
Savings Schemes, Memo, and Products before calling this fully closed.

**Key files referenced**: `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/
LayawayPage.tsx`, `frontend/src/pages/Inventory.tsx`, `frontend/src/pages/ProductsPage.tsx`,
`frontend/src/pages/SalesHubPage.tsx`, `frontend/src/components/layout/Sidebar.tsx`,
`frontend/src/components/pos/Cart.tsx`, `frontend/src/pages/POSScreen.tsx`, `frontend/src/
components/settings/PrinterSettings.tsx`, `frontend/src/components/print-templates/
TemplateCanvas.tsx`, `frontend/src/pages/{RepairsPage,OldGoldPage,MemoPage,
SavingsSchemesPage,MetalRatesPage}.tsx`, `docs/11-developer-guidelines/
RESPONSIVE_STANDARDS.md`, `docs/11-developer-guidelines/FRONTEND_STANDARDS.md`.
