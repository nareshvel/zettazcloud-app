# Responsive Design Standards

Every page reachable from the sidebar must work on phone, tablet and desktop.
This is the contract — build to it without being asked.

## Breakpoints (Tailwind defaults)

| Token | Min width | Target |
|---|---|---|
| *(base)* | 0 | Phone portrait (360–430px) |
| `sm:` | 640px | Large phone / phone landscape |
| `md:` | 768px | Tablet portrait |
| `lg:` | 1024px | Tablet landscape / small laptop |
| `xl:` | 1280px | Desktop |

**Mobile-first:** write the phone layout as the base class, then add `sm:`/`md:`/`lg:`
overrides. Never write desktop-first and try to claw back with `max-*`.

The sidebar is off-canvas below `md:` (hamburger toggle) and fixed from `md:` up —
so page content must assume full width on phones/tablet-portrait.

## The rules

1. **Never let a page scroll horizontally.** The page itself must fit the viewport;
   only designated containers (tables) may scroll sideways.
2. **Tables:** prefer `ResponsiveTable` (`components/ResponsiveTable.tsx`) which
   renders real rows on desktop and stacked cards on mobile — use
   `hideOnMobile` / `priority` / `mobileLabel` on column defs.
   If using a raw `<table>`, it **must** be wrapped in `overflow-x-auto`.
3. **Form / modal grids:** stack on phones. Use
   `grid-cols-1 sm:grid-cols-2` (never a bare `grid-cols-2`).
   Dense inputs (e.g. the cost-code digit map) use `grid-cols-3 sm:grid-cols-5`.
4. **Page padding:** `p-4 sm:p-6` — tighter gutters on phones.
5. **Toolbars / filter chips:** always `flex flex-wrap gap-2` so chips wrap rather
   than overflow. Search + select pairs use `flex-col sm:flex-row`.
6. **`PageHeader`** already handles title/action wrapping; keep action buttons short
   (icon + 1–2 words) so they don't dominate a phone header.
7. **Tap targets ≥ 40px.** The standard `Button` (h-9 = 36px plus padding) is
   acceptable; never shrink below `size="sm"` for primary touch actions.
8. **Modals:** `max-w-*` + `w-full` + `max-h-[90vh] overflow-y-auto` so tall forms
   scroll inside the dialog instead of pushing the page.
9. **No fixed pixel widths** for layout (`w-[720px]`). Use `max-w-*` + `w-full`.
10. **POS is the exception** — it is a dedicated full-screen surface with its own
    grid; it already carries the densest responsive treatment.

## Per-page audit (2026-08-08)

Legend: ✅ meets standard · 🟡 acceptable, could improve · ❌ needs work

| Page | State | Notes |
|---|---|---|
| Dashboard | 🟡 | Responsive grid; one raw table wrapped in `overflow-x-auto`. Consider `ResponsiveTable`. |
| POS | ✅ | Densest responsive handling in the app (17 breakpoint usages). |
| Orders | 🟡 | Few breakpoints; verify list on phone. |
| Promotions | ✅ | Fixed in this pass: `PageHeader` + `px-4 sm:px-6 py-4 sm:py-6`; toolbar and table were already responsive. |
| Sales Return | 🟡 | Table wrapped; limited breakpoints. |
| Customers | ✅ | Responsive. |
| Repairs | ✅ | Fixed in this pass: `p-4 sm:p-6`, wrapping chips, `grid-cols-1 sm:grid-cols-2` modal, table scrolls. |
| Old Gold | ✅ | Same fixes as Repairs. |
| Products | ✅ | Uses `ResponsiveTable` — the reference implementation. |
| Serialized Stock | ✅ | Fixed: stacked product picker, wrapping status counts, responsive modal. |
| Suppliers | 🟡 | Some breakpoints; verify on tablet. |
| Purchase Orders | 🟡 | Rendered list OK (its `<table>` is print-HTML only). |
| Goods Receiving | 🟡 | Same as above. |
| Reports | 🟡 | Charts need width checks on phones. |
| Settings | ✅ | Well covered (14 breakpoint usages). |
| User Management | ✅ | Responsive. |
| Employees | ✅ | Fixed: responsive card grid + stacked modal fields. |

### Backlog from this audit
- **Promotions page**: add a mobile layout (highest priority ❌).
- Migrate Dashboard / Sales Return / Repairs / Old Gold / Serialized tables from
  raw `<table>` to `ResponsiveTable` for card-view parity with Products.
- Reports: confirm chart containers shrink correctly under 400px.

## Per-page audit refresh (2026-08-31)

Prompted by a real device bug report (Dashboard KPI cards truncating, chart tooltip
overflowing) — see `2026-08-31_Responsive_UI_Audit.md` in this directory for the full
findings. The table above predates the Sales Hub search-first redesign, the Dashboard
chart work, and several shared-component fixes, so treat entries below as authoritative
over the 2026-08-08 table where they overlap; entries not listed here are unchanged.

| Page | State | Notes |
|---|---|---|
| Dashboard | ✅ | KPI grid fixed (`grid-cols-2 lg:grid-cols-4`, fluid `clamp()` font + `title` fallback instead of bare `truncate`); all 4 chart tooltips clamped via shared `CHART_TOOLTIP_PROPS` (no more touch-open-and-stuck / overflow past the card edge); row-action touch targets enlarged; delete-sale modal now has full dark-mode coverage; KPI icon colors moved off raw palette classes to semantic tokens. |
| Sales Hub | ✅ | Search-first redesign (2026-08-29) is itself mobile-first — see `docs/17-migration-and-roadmap/14_Sales_Hub_Search_First_Redesign.md`. |
| Orders / Sales Return / Repairs / Old Gold | ✅ | Header row no longer drops the primary action button to its own line when the subtitle is long (`flex-nowrap` + `min-w-0`/`truncate` on the title block instead of `flex-wrap` on the row) — this was a real regression a subtitle-length change would have silently reintroduced on any of these four pages. |
| Layaway / Savings Schemes | 🟡 | Multi-button headers (2-4 actions) intentionally kept on `flex-wrap` rather than forced onto one row — with several labeled buttons, wrapping to a second row is the safer trade-off vs. horizontal overflow on a 375px phone. Value-summary grids (valuation/schedule/payment preview cards) that held currency or a customer name at a bare `grid-cols-3`/`grid-cols-4` were loosened to `grid-cols-2 sm:grid-cols-3` (or `grid-cols-1 sm:grid-cols-3`); short-label 3-up metric strips (`Redeemable`/`Bonus`/`Maturity` style cards) were left as-is — they're short enough to fit 3-up at 375px without truncating. |
| Memo | 🟡 | Item-entry row (description + qty + unit value + line total) changed from a flat `grid-cols-3` to `grid-cols-2 sm:grid-cols-3` with the description and total spanning both mobile columns, so the qty/unit-value inputs aren't squeezed to ~⅓ card width on a phone. |
| Products | ✅ | Toolbar (`UniversalListControls`) now fully icon-only below `sm:` across every optional button (Filter, Import, Export, Manage Tax Classes, New) — previously only some were compacted, so the ones that weren't (Import, Manage Tax Classes) pushed the whole toolbar row into horizontal overflow, hiding the search box off-screen. KPI strip icon colors moved to semantic tokens. |
| Customers / Suppliers | ✅ | `UniversalListControls`'s search+action row changed from `flex-col sm:flex-row` (stacked, two rows) to a single `flex-row` at every breakpoint, with the search input shrinking (`flex-1 min-w-0`) and the button cluster staying fixed-size and non-wrapping — matches how the row already read on desktop. |
| All pages (global) | ✅ | Sidebar's fixed mobile hamburger toggle no longer overlaps page content — top bar shows a single truncated current-page label on mobile (`TopBar.tsx`, via the new `useCurrentPageLabel()`/`Breadcrumbs.tsx`) instead of the old full breadcrumb trail, which had no room to fit next to both the hamburger and the icon cluster below `md:`. |

### Open backlog (2026-08-31)
- **Bespoke `fixed inset-0` modals**: 36 occurrences across 16 files (Repairs, Old Gold,
  Layaway, Savings Schemes, Memo, Dashboard, POS, Signup, Employees, Metal Rates, Catalog
  Sync, Serialized Inventory, and others) still hand-roll their own modal overlay instead
  of the `Dialog`/`ModalBase` primitive — flagged as tech debt in `FRONTEND_STANDARDS.md`
  §8. Deliberately **not** batch-migrated in this pass: each one has its own form state,
  focus handling, and business logic, the count is real (verified via `grep -rn "fixed
  inset-0" frontend/src/pages`), and this session had no way to click through the results
  in a live browser. Treat this as its own dedicated effort with real device/browser
  testing, not something to fold into an unrelated fix.

## Manual QA checklist (before merging a UI change)

Test at these widths in devtools: **375px** (phone), **768px** (tablet portrait),
**1024px** (tablet landscape), **1440px** (desktop).

- [ ] No horizontal page scrollbar at 375px.
- [ ] Sidebar opens/closes via hamburger below `md:` and doesn't trap focus.
- [ ] All table columns reachable (card view or horizontal scroll).
- [ ] Modals fully usable: fields stacked, actions reachable, body scrolls.
- [ ] Buttons/links are comfortably tappable; nothing clipped or overlapping.
- [ ] Long text (product names, customer names) truncates rather than breaking layout.
