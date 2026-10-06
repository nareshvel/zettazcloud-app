# Sales Hub — Proposal (replacing straight-to-POS for multi-workflow verticals)

**Date:** 2026-08-25
**Status:** Implemented (2026-08-25), Option A scope, as decided in §7.
Redesigned fullscreen the same day per direct follow-up feedback (§9), then
redesigned again same day into a researched bento/chromeless layout after
feedback that the fullscreen version still looked dated (§10). See
`06_Implementation_Changelog.md`'s "Iteration 14", "15", and "16" for the
file-level record.

---

## 1. The problem, as stated

> Grocery/general retail: the POS screen is always visible, and sales happen one
> after another. Jewelry: staff also do repairs, old-gold buys, memos, layaway —
> workflows that aren't "ring up items." Today they all live as separate sidebar
> pages, disconnected from the POS screen. Could a "Hub" work better, and could
> it also solve duty-free by collecting what's needed *first*?

This doc confirms the premise against the actual codebase, researches how
comparable products solve it, and proposes a concrete design with an explicit
fork on scope (see §5) since one path is a UI change and the other touches the
tax engine and the `sales` table.

---

## 2. Current state (verified in code, 2026-08-25)

- **`/pos` is a standalone, fullscreen route** (`AppRoutes.tsx` — outside
  `AppLayout`, no sidebar). `POSScreen.tsx` goes straight to a product grid +
  cart. There is no screen, step, or prompt before it — a cashier lands
  directly on "ring up items."
- **Repairs, Old Gold, Memo, Layaway, Savings Schemes are separate sidebar
  pages** under "Sales Operations" (`Sidebar.tsx`), each a full CRUD-style
  admin page (list + modal), routed independently in `AppRoutes.tsx`. None of
  them hand off to or from the POS screen — a repair intake and a sale are two
  unrelated parts of the app today, even though both start with "a customer
  walks up to the counter."
- **`sales_mode` (duty-free/export/domestic) is a per-STORE setting, not a
  per-transaction one.** `jurisdictionService.getJurisdictionProfile(tenantId,
  storeId)` resolves it from `store_jurisdiction_settings` — there is no
  per-sale parameter anywhere in the call chain. A store is either "the
  duty-free store" or it isn't; there's no way today to ring one duty-free sale
  for a cruise passenger inside an otherwise-domestic store.
- **Nothing in the POS UI captures gift mode, duty-free traveller data, or any
  other "mode" at all.** `CartContext.tsx` and `components/pos/*` have zero
  references to `salesMode`/`giftMode`/`dutyFree`. The `sales` table's INSERT
  in `createSaleController.js` has no columns for any of this. Every
  mode-aware rendering rule that exists (`dutyFree`, `taxRefund`,
  `reprintNotice` suppression, gift-mode price hiding — see
  `frontend/src/utils/salesModeRules.ts`) only ever runs against **print
  fixtures and jurisdiction defaults**, never against something a cashier
  actually typed in. This is the same gap flagged in
  `06_Implementation_Changelog.md`'s "Pending after iteration 13": the print
  layer supports traveller ID/travel method, but nothing captures them.

**Net finding:** the user's instinct is right on both counts. The IA problem
(repairs/old-gold/memo bolted onto the sidebar, disconnected from the counter)
and the duty-free problem (nothing captures traveller data at transaction
time) are the same underlying gap — there is no concept of "what kind of
interaction is this" anywhere before the item grid.

---

## 3. What other systems do

**Task-based landing screen, not straight-to-catalog.** Restaurant POS is the
clearest, most mainstream analog: Toast and comparable systems present an
**order-type screen (Dine In / Takeout / Delivery / Curbside) before the
menu**, because the order type determines what data is needed next (table
number vs. delivery address) and how the ticket routes downstream. The
one-touch order-type screen is treated as a UX best practice specifically to
avoid the guest/cashier having to scroll into the menu to sort that out. This
is a direct structural analog to "choose Sale / Repair / Old Gold before
choosing products" — different transaction types need different data before
line items, and the mainstream POS pattern is to ask up front, not
mid-transaction. ([Toast dining options](https://doc.toasttab.com/doc/platformguide/adminDiningOptions.html))

**Jewelry-specific POS vendors already treat repairs/buying as first-class
workflows *inside* the same screen the cashier rings sales from**, not a
separate back-office module:
- Luxare: "repair module is built directly into the POS, allowing you to
  manage repair intake, update job status, and send customer notifications
  alongside your everyday retail operations, all from one screen."
- Bravo Store Systems: positions its whole platform around "a piece can come
  in on trade, get appraised, get repaired, and go back out through the case
  ... without switching systems" — explicitly contrasting this with
  SKU-only POS (Square, Shopify, Lightspeed) where buying/repairs/trade-ins
  are bolted-on afterthoughts or missing entirely.
- WJewel: repair tickets are taken "at the counter" alongside sales.

The common thread: the counter screen in a jewelry-aware POS is a **workflow
switcher**, not a checkout-only screen — validating the Hub concept rather
than "just add a fifth sidebar item."

**Duty-free/travel-retail POS specifically captures traveller ID *before* the
sale, not just for the receipt.** LS Retail, tcpos, and Socket Mobile's
travel-retail integrations scan the boarding pass/passport as the **first
step**, because destination and traveller status can affect which items are
even sellable duty-free, applicable discounts, and purchase limits — not only
what prints. This is a stronger case than "print it nicely": in a full
implementation, traveller data can be a pre-condition for the sale, not a
receipt decoration.
([LS Retail — Travel Retail & Duty-Free](https://www.lsretail.com/industries/travel-retail-and-duty-free-software),
[Socket Mobile — Duty-Free Data Capture](https://www.socketmobile.com/solutions/retail/duty-free))

**Sources:**
- [Toast — Dining Options](https://doc.toasttab.com/doc/platformguide/adminDiningOptions.html)
- [Bravo Store Systems — Best Jewelry Store POS Software in 2026](https://www.bravostoresystems.com/post/best-jewelry-store-pos-software-in-2026)
- [LS Retail — Travel Retail and Duty-Free Software](https://www.lsretail.com/industries/travel-retail-and-duty-free-software)
- [Socket Mobile — Data Capture Solutions for Duty-Free POS](https://www.socketmobile.com/solutions/retail/duty-free)
- [GemFind — Best Jewelry POS System 2026](https://gemfind.com/blogs/digital-marketing/best-jewelry-pos-system)

---

## 4. Proposed design

### 4.1 The Hub screen

A new landing screen, shown **before** the item grid, presented as large tap
targets (not a dense admin list):

```
┌─────────────────────────────────────────────────────────────┐
│  New Sale        Duty-Free Sale     Repair Intake            │
│  (ring up items) (traveller info    (job bag, photos,        │
│                   first, then items) deposit)                │
│                                                                │
│  Old Gold Buy     Memo In / Out      Layaway Payment          │
│  (live valuation, (consignment       (existing plan          │
│   voucher)         ledger)            payment)                │
│                                                                │
│  Sales Return     Savings Scheme                              │
│                    Payment                                     │
└─────────────────────────────────────────────────────────────┘
  [ 3 repairs ready for pickup ]  [ 2 memos overdue ]   ← optional glance strip
```

- Tiles resolve to **existing pages/flows** wherever one already exists —
  Repair Intake opens the existing `RepairsPage` intake modal, Old Gold Buy
  opens `OldGoldPage`'s intake, Memo/Layaway/Savings open their existing
  pages. **This is additive wiring, not a rewrite of those modules.**
- "New Sale" and "Duty-Free Sale" both go to the existing POS
  cart/product-grid screen — the only two tiles that need a *new* screen are
  the duty-free intake step (§4.2) and the Hub itself.
- Which tiles appear is **industry-gated**, the same mechanism already used
  for the sidebar (`useIndustry`/`IndustryRoute`) — a grocery/general-retail
  tenant sees only "New Sale" (and "Sales Return"), so for them the Hub can
  either be skipped entirely (straight to POS, current behavior preserved) or
  reduces to a single obvious tile. **This matches the framing in the
  request directly**: non-jewelry stays exactly as it is today.
- A small "glance strip" (repairs ready for pickup, memos overdue) reuses data
  the KPI strips on those pages already compute — turns the Hub into a light
  daily-standup view, not just a menu.

### 4.2 Duty-free intake as a Hub step

"Duty-Free Sale" doesn't open the same POS screen "New Sale" does — it opens a
short intake step first:

```
Traveller ID:  [ Passport ▾ ]  [___________]   Country [___]
Travel by:     [ Flight   ▾ ]  [___________]   (+ voyage/detail if Vessel)
Destination:   [___________]
Departure:     [ 23/08/2026 ]
                                          [ Continue to Sale → ]
```

This is the *exact same* generalized traveller-ID/travel-method model shipped
in the print layer this session (`salesModeRules.ts` —
`travellerIdType`/`travelMethodType`, Passport/National ID/Seaman's Book,
Flight/Vessel/Other) — the Hub intake form is the natural front-end for data
that already has a home on the print side but no way in. Submitting the form
attaches the captured data to the sale-in-progress; the cart/checkout screen
that follows is the *same* POS screen "New Sale" uses, just pre-seeded with
this context so it flows through to the receipt/invoice without re-asking.

### 4.3 Non-jewelry stays untouched

Grocery/general retail keeps exactly the current experience: `/pos` goes
straight to the item grid, sale after sale, no Hub step. The Hub is additive
for verticals that need more than one counter workflow, matching how
`IndustryRoute`/`useIndustry` already gate Repairs, Old Gold, Metal Rates,
etc. — no new gating concept is needed, just a new gated route.

---

## 5. The scope fork — needs a decision before building

The Hub's navigation half (§4.1) is low-risk, additive UI wiring. The
duty-free half (§4.2) forks into two genuinely different sizes of change,
because of the finding in §2: **duty-free is currently store-level, not
per-sale.**

### Option A — Hub + capture UI only (small)

- The Hub's Duty-Free Sale intake form captures traveller data into
  `CartContext` (client-side only) and threads it through to the existing
  sale-creation call as **print-time metadata**, the same shape
  `saleToPrintData.ts` already expects (`travellerIdNumber`, `travelMethodRef`,
  etc. — see `06_Implementation_Changelog.md` iteration 13).
  Minimal backend change: a few nullable columns on `sales`
  (`traveller_id_type`, `traveller_id_number`, `traveller_id_country`,
  `travel_method_type`, `travel_method_ref`, `travel_method_detail`,
  `destination`, `departure_date`) so the data survives a page reload/reprint,
  populated by `createSaleController.js`, read back by `saleToPrintData.ts`.
- **Tax calculation is unchanged** — the sale still only prints as duty-free
  and zero-rates if the *store* is already configured `sales_mode = duty_free`
  (today's model). The Hub's Duty-Free Sale tile is really "the normal
  duty-free-store sale flow, but now it actually asks for the passport instead
  of relying on the print fixture."
- Closes the exact gap flagged as pending in this session's earlier work,
  cleanly, without touching the tax engine.
- **Doesn't help** a store that is *not* duty-free-designated ring an
  occasional duty-free sale (e.g., a downtown jeweler near a cruise port that
  serves mostly locals but occasionally a tourist).

### Option B — Per-transaction sales mode override (larger)

- Everything in Option A, plus: `sales.sales_mode` becomes settable **per
  transaction** (Hub tile picks it), and `taxCalculationService.js` /
  `jurisdictionService.getJurisdictionProfile` accept an override so a single
  sale can be zero-rated as duty-free/export even in a store whose default
  `sales_mode` is domestic.
- This is the "correct" long-term model for a store with a mixed customer
  base, but it touches the tax engine, needs careful audit/compliance
  guardrails (who's allowed to flip a sale to zero-rated, is it reversible,
  does it need a manager PIN), and is meaningfully bigger and higher-risk than
  Option A.
- Only worth building if a real tenant actually needs mixed-mode selling —
  worth confirming demand before scoping the tax-engine work.

**Recommendation:** ship the Hub + Option A first. It's the change that
directly closes the already-documented pending gap, delivers the UX win for
repairs/old-gold/memo, and carries none of the tax-engine risk. Treat Option B
as a follow-up, gated on an actual tenant asking for mixed-mode selling —
consistent with how this codebase already treats the Shopify adapter and
other "build on first tenant request" items.

---

## 6. Implementation sketch (Option A scope)

**Frontend**
- `pages/SalesHubPage.tsx` (new) — tile grid, industry-gated via `useIndustry`,
  glance-strip counts reused from existing page KPI queries.
- `pages/DutyFreeIntakeModal.tsx` or a step inside `SalesHubPage` (new) — the
  form in §4.2; on submit, stores the captured fields in `CartContext`
  (extend with `travellerContext?: {...}`) and navigates to `/pos`.
- `contexts/CartContext.tsx` — add `travellerContext` state +
  `setTravellerContext`; include it in the sale-creation payload alongside
  `employee_id`/`customer_id` (same pattern already used there).
- `AppRoutes.tsx` — new gated route (`/sales-hub` or repurpose `/pos` to route
  through the hub for jewelry tenants — needs the decision in the questions
  below); `Sidebar.tsx` entry point.
- `utils/saleToPrintData.ts` — map the new sale columns to
  `travellerIdNumber`/`travellerIdCountry`/`travelMethodRef`/
  `travelMethodDetail` (the mapping this file is already missing per the
  pending-work note).

**Backend**
- New idempotent migration: `sales.traveller_id_type`, `traveller_id_number`,
  `traveller_id_country`, `travel_method_type`, `travel_method_ref`,
  `travel_method_detail`, `destination`, `departure_date` — all nullable, all
  nulls on every existing row, matching this codebase's additive-migration
  convention.
- `createSaleController.js` — accept and persist the new fields (same pattern
  as the existing `employee_id` handling at line ~257).
- `routes/sales.routes.js` (or wherever a sale is read back for reprint) —
  include the new columns in the response so a reprint doesn't lose the
  traveller data.

**Tests**
- Backend: extend `printFixtures`-style coverage to a real
  `createSaleController` unit test asserting the new fields round-trip.
- Frontend: `CartContext` test for `travellerContext` persistence into the
  sale payload; a `SalesHubPage` render test per industry (jewelry sees 7
  tiles, general retail sees 1–2).

---

## 7. Decisions (2026-08-25)

1. **Entry point:** Additional screen. The Hub ships as a new sidebar entry
   point; the existing direct `/pos` route/shortcut stays exactly as-is so
   cashiers who just want to ring sales all day are unaffected. `/pos` is not
   repurposed or gated behind the Hub.
2. **Industry scope:** Jewelry only for this pass. Electronics keeps its
   current Repairs-only sidebar entry; revisit adding a smaller Electronics
   Hub (New Sale + Repair Intake) later if there's a reason to.
3. **Duty-free scope:** Option A (capture UI only). The Duty-Free Sale tile's
   intake form persists traveller data on the sale for printing/reprinting;
   `sales_mode`/tax zero-rating stays store-level, unchanged. Option B
   (per-transaction tax-engine override) is deferred, to be picked up only if
   a tenant actually needs mixed-mode selling.

Implementation is scoped to §6 (Option A) against jewelry-only, additive-entry
Hub. Landed 2026-08-25 — see `06_Implementation_Changelog.md`'s "Iteration 14"
for the file-level record. A few implementation notes vs. the sketch in §6:

- The duty-free intake form shipped as `DutyFreeIntakeModal.tsx`, opened as a
  modal from `SalesHubPage.tsx` rather than a separate routed page — simpler
  state handoff into `CartContext`, no extra route to gate.
- The critical gap flagged in §2 (store-level `sales_mode` never actually
  zero-rated a real sale) was fixed as part of this same pass, scoped to
  stores already configured `duty_free`/`export` — see the "Duty-free
  zero-rating fix" note in Iteration 14. This was a deliberate, user-approved
  addition to Option A's stated scope ("tax calculation is unchanged"), not a
  silent expansion: without it, the Duty-Free Sale tile would have collected a
  passport for a receipt that still charged tax.
- The "glance strip" (repairs ready for pickup, memos overdue) from §4.1's
  mockup was not built in this pass — the tile grid ships without it. Worth
  adding later; it does not block the Hub being useful today.
- Tiles for Repair Intake / Old Gold Buy / Memo / Layaway / Savings Scheme
  navigate to the existing pages in their default (list) state, not
  deep-linked into an already-open "new" modal — matching §6, which did not
  call for changes to those four pages.

---

## 8. Sources

- [Toast — Dining Options (order-type-before-menu pattern)](https://doc.toasttab.com/doc/platformguide/adminDiningOptions.html)
- [Bravo Store Systems — Best Jewelry Store POS Software in 2026](https://www.bravostoresystems.com/post/best-jewelry-store-pos-software-in-2026)
- [Luxare — Jewelry POS Software](https://www.luxare.com/retail/jewelry-pos-software)
- [WJewel — All-in-One Jewelry POS Software](https://www.wjewel.com/jewelry-retail-software.php)
- [GemFind — Best Jewelry POS System 2026](https://gemfind.com/blogs/digital-marketing/best-jewelry-pos-system)
- [LS Retail — Travel Retail and Duty-Free Software](https://www.lsretail.com/industries/travel-retail-and-duty-free-software)
- [Socket Mobile — Data Capture Solutions for Duty-Free POS](https://www.socketmobile.com/solutions/retail/duty-free)
- [tcpos — Travel Retail POS Platform](https://tcpos.com/markets/travel-retail/)

---

## 9. Fullscreen redesign + role-based landing (2026-08-25, same-day follow-up)

Direct feedback after the first cut landed: the Hub should be a **fullscreen
counter screen**, not another page tucked inside the admin sidebar/topbar —
store-branded (logo + name), responsive, and the actual place sales staff
land right after login instead of the dashboard, since it's meant to cover
everything they need at the counter.

**What changed:**

- **Fullscreen, no admin chrome.** `/sales-hub` moved out of the
  `AppLayout`-wrapped route group in `AppRoutes.tsx` and sits alongside `/pos`
  as a standalone fullscreen route — no sidebar, no admin topbar. It carries
  its own header (store logo/name, clock/date, user avatar menu) and footer,
  the same treatment `/pos` already had.
- **Store branding in the header.** Left side of the header shows the
  tenant's own `store.logoUrl` (from `useStore()`), or a rounded lettermark
  built from the store name's first letter if no logo is set or the logo URL
  fails to load. Verified live against a demo tenant whose logo URL was
  actually broken — the fallback needs to trigger on `<img>` load failure via
  React state (`onError` sets a `logoFailed` flag), not just hide the broken
  `<img>` in place, or the header silently loses its branding entirely
  instead of falling back.
- **Role-aware user menu**, mirroring the pattern `POSScreen.tsx` already
  established: Dashboard link hidden for cashiers, shown for anyone else
  (managers, etc.) since they may still need admin screens; Settings link;
  Sign out. This is deliberately the *only* way out of the Hub for a cashier
  — since they now land here instead of the dashboard, the Hub has to be a
  complete home base, not a dead end.
- **Post-login landing changed for sales-floor jewelry users.**
  `Login.tsx`'s `getRedirectPath` (the single place in the app that decides
  where a user lands after signing in — confirmed via search, there is no
  other post-auth redirect) now resolves the tenant's industry
  (`getTenantIndustry()`) for any non-admin user with `sales.create`
  permission: jewelry tenants send that user to `/sales-hub`, every other
  industry keeps going straight to `/pos` exactly as before. A failed
  industry lookup fails open to `/pos` rather than blocking login. Admins and
  users without `sales.create` are unaffected (`/admin` and `/dashboard`
  respectively, unchanged).
- **Responsive tile grid** — `grid-cols-1` on mobile up to `xl:grid-cols-4` on
  wide desktops, larger touch-friendly cards with a colored icon badge, hover
  lift/shadow, and a trailing chevron, verified live in the browser at
  desktop width (1440×900) against the "Diamond Republic Demo — Heritage
  Quay" tenant.

**Deliberately unchanged:** the tile set, the duty-free intake flow, and the
zero-rating fix from the first pass — this was a chrome/layout/entry-point
change, not a rescoping of what the Hub does.

---

## 10. Bento / chromeless redesign (2026-08-25, second same-day follow-up)

Feedback on §9's result: still not good enough — it read as a conventional
"topbar + uniform card grid" admin screen, and the ask was explicit — remove
the separate topbar, blend identity into the page, and **research** rather
than iterate on the same shape. This section records that research and the
design it produced.

### What was researched

- **Bento grid layout** — a 2026 UI pattern (used by Apple, Notion, Linear,
  Stripe) where tiles are variable-sized rectangles rather than a uniform
  grid; size communicates priority before a user reads a label. Sources
  report meaningfully higher engagement (dwell time, click-through) versus
  flat grids, and note it's now used by roughly two-thirds of top SaaS
  products on ProductHunt.
- **Chromeless / blended navigation** — reducing visible app "chrome" (fixed
  bars, borders, drop shadows separating navigation from content) in favor
  of identity and controls sitting directly on the content canvas, with
  gestures/inline controls carrying the interaction instead of a persistent
  bar.
- **Command-palette / search-first navigation** — the Cmd+K pattern
  (VS Code, Figma, Notion, Linear, GitHub) that turns navigation into typing:
  a few characters jump straight to a destination instead of scanning a menu.
  Adapted here as an *always-visible* inline field rather than a hidden
  keyboard-shortcut overlay, since a retail counter isn't a keyboard-first
  power-user context — the affordance needs to be visible, not discoverable
  only via Cmd+K.
- **Current POS redesigns** (Shopify POS, Square, Toast) — the live trend is
  toward brand customization (logo/color deep into the flow, not just a
  corner logo), fewer taps to the useful action, and tablet-optimized info
  density — validating "make the counter's own identity part of the screen"
  and "biggest/fewest-taps action should be immediately obvious" as sound
  directions, not just aesthetic preference.

Full source list in §11 below.

### What changed

- **No header bar.** The `<header>` element (bordered, background-blurred,
  sticky) is gone entirely. Store logo/name, the live clock/date, and the
  user avatar now sit directly in the page's top row, inside the same
  scrolling container as everything else — they're part of the canvas, not a
  fixed strip above it. This is the literal ask ("we may not need to have a
  separate top bar and it can blend in the page itself").
- **Time-of-day mesh background.** Instead of a flat page background, a
  layered radial-gradient wash tints the whole canvas — warm amber/gold
  tones in the morning, sky blue/violet in the afternoon, indigo/pink in the
  evening (`meshForHour()` in `SalesHubPage.tsx`). This replaces the
  previous version's few decorative blurred circles with something that
  actually responds to when the cashier is looking at it.
- **Bento tile grid**, not a uniform grid: `New Sale` is a 2×2 hero tile
  (full gradient fill, an oversized translucent watermark icon in the
  corner, white text) — by far the most frequent action, so it gets by far
  the most visual weight. `Duty-Free Sale` is a 2×1 hero tile, same
  treatment, smaller. The other six workflows (Repair, Old Gold, Memo,
  Layaway, Savings, Returns) are uniform 1×1 "glass" tiles (translucent
  card, colored gradient icon chip) below. The exact span numbers were
  chosen deliberately so the total grid area is a clean multiple of the
  column count (4+2+6×1=12=3 full rows at 4 columns) — CSS Grid's
  `grid-flow-dense` auto-placement is a *greedy* algorithm, not an optimal
  packer, and an early attempt at mixing more tile sizes (making two small
  tiles row-span-2 to "use up" leftover space) produced scattered gaps
  because the greedy placement didn't find the packing a human would;
  keeping the secondary tiles uniform sidesteps that entirely and is
  guaranteed gapless regardless of placement order.
- **Live, visible search-to-filter/act field**, not a hidden Cmd+K overlay:
  typing narrows the bento grid to matching tiles in real time; pressing
  Enter with exactly one tile left open opens it directly. Verified live —
  typing "repair" narrows the whole grid to just the Repair Intake tile.
- **Copy regression caught and fixed in the same pass:** an earlier edit
  shortened the greeting to `displayName.split(' ')[0]`, meant to show just
  a first name, but the demo tenant's `first_name` field actually holds a
  full name string ("Jewelry Demo Admin"), so the greeting truncated to just
  "Jewelry". Reverted to the full `displayName` — this is exactly the kind
  of thing that only shows up against real-shaped data, not assumptions
  about field contents.

**Verification:** `npx tsc --noEmit` clean; `npx vitest run` 618/618 passing
(no test changes needed — tests query tiles by title text and menu
behavior, which are unaffected by the layout rework). Verified live via the
Chrome extension against "Diamond Republic Demo — Heritage Quay": confirmed
the gapless bento grid, the chromeless top row scrolling with the page, the
mesh background, the live search narrowing to one tile, and the user menu.

**Deliberately unchanged:** the tile set, the duty-free intake flow, the
zero-rating fix, and the role-based login redirect from §9/iteration 14–15 —
this was, again, purely a visual/layout pass.

---

## 11. Sources for §10's research

- [Bento Grid Design: How to Create Modern Modular Layouts in 2026 — Landdding](https://landdding.com/blog/blog-bento-grid-design-guide)
- [Bento Grid Dashboard Design: Complete Guide 2026 — Orbix Studio](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)
- [Designing Bento Grids That Actually Work: A 2026 Practical Guide — SaaSFrame](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide)
- [UX Trends 2026: AI, Bento Grids & Zero UI That Work — Espio Labs](https://espiolabs.com/blog/posts/ux-trends-2025-from-ai-assisted-design-to-bento-grids-what-actually-works)
- [Bento Grids: The Modular Design System Revolutionizing Product Interfaces in 2026 — MyDesigner](https://mydesigner.gg/blog/bento-grids-modular-design-2026)
- [Command Palette UI Design: Best Practices & Examples — Mobbin](https://mobbin.com/glossary/command-palette)
- [Designing Command Palettes — Sam Solomon](https://solomon.io/designing-command-palettes/)
- [Command Palette Pattern — UX Patterns for Developers](https://uxpatterns.dev/patterns/advanced/command-palette)
- [Shopify POS: Designed for Your Brand, Built for Modern Retail (2025)](https://www.shopify.com/blog/shopify-pos-design-update)
- [POS UX Benchmarking 2026: Square, Toast, Lightspeed — Interface Design](https://interface-design.co.uk/blog/pos-software-ux-benchmarking-2026-the-coherence-gap/)

---

## 12. Refinement after design approval (2026-08-25, iteration 16.1)

The §10 bento/chromeless redesign was approved as-is ("I like this design").
Four targeted follow-ups, not a design change: the live search field from §10
was removed (every option is already visible on the single screen, so a
filter step added a click rather than saved one); the greeting shrank from a
hero headline to a small label; the store logo now runs through
`normalizeImageUrl()` (`utils/imageUtils.ts`) instead of the raw
`store.logoUrl`, matching how `GeneralSettings.tsx` resolves the same
relative-path value for display; and a single right-aligned footer
("Zettaz Cloud · Version") was reintroduced below the scroll container. Full
detail: `06_Implementation_Changelog.md`, "Iteration 16.1".

---

## 13. Duty-Free intake: customer capture folded in (2026-08-25, iteration 16.2)

The traveller-only intake from §4.2 left customer capture as a separate step
on `/pos` — search or quick-add in its own modal, after already leaving the
Hub. Ask: collect the customer in the same intake screen, and require it
(not optional, unlike the ordinary POS customer picker) since every
duty-free sale needs one on record.

`DutyFreeIntakeModal.tsx` is now two columns in a wider modal: Customer
(left, via the same `CustomerSearchSelect` component and inline quick-add
POS already uses) and Traveller ID/Travel Method (right, unchanged). Both
`CartContext.setSelectedCustomer` and `CartContext.setTravellerContext` are
set before navigating to `/pos`, so "Current Sale" already shows the
customer's name the moment the cashier reaches the register — one
continuous flow instead of three stops. The `CustomerHit → Customer`
conversion was lifted out of `POSScreen.tsx` into a shared
`mapCustomerHitToCustomer()` export on `CustomerSearchSelect.tsx` so the two
entry points can't diverge. Full detail: `06_Implementation_Changelog.md`,
"Iteration 16.2".

---

## 14. Duty-Free customer capture, round 2: deferred create + labeled details + locale date (2026-08-25, iteration 16.3)

Disagreed with §13's design on three points: creating the new customer via
its own inline "Create & Select" button was still an extra click ahead of
Continue; the selected-existing-customer view should show clearly labeled
fields, not a compact chip; and the search box should stay usable even
while a new-customer draft is open. Also flagged: Departure Date's native
`<input type="date">` ignored the tenant's date format and let the year
field run past 4 digits.

Fixed all four in `DutyFreeIntakeModal.tsx`: the new-customer form now has
no submit button of its own — `createCustomer()` only runs inside
`handleContinue`, in the same click that sets the cart's customer/traveller
context and navigates to `/pos`. The existing-customer match renders as a
bespoke labeled card (Name, Code/Type, Phone, Email, Address). The search
component stays mounted above the new-customer form the whole time, so
switching to an existing match mid-draft is one click (the draft is
discarded). Departure Date now uses `components/ui/DatePickerInput` — the
same component `RepairsPage.tsx` uses for its own date fields — which reads
`store.dateFormat` and caps each segment while typing, so the year can't
overflow. Full detail: `06_Implementation_Changelog.md`, "Iteration 16.3".

---

## 15. Traveller details actually enforced as mandatory (2026-08-25, iteration 16.4)

Bug catch: the customer requirement was enforced, but the traveller fields
(ID Number, Issuing Country, Flight/Vessel/Reference, Destination,
Departure Date) were not — "Continue to Sale" would proceed with every
traveller field blank. `handleContinue` now validates both sides up front
and surfaces both problems at once if either is incomplete, blocking before
a customer is ever created so an incomplete traveller side can't leave
behind a half-created customer record. Required fields carry a red
asterisk and turn red live if left empty on a blocked attempt. Full detail:
`06_Implementation_Changelog.md`, "Iteration 16.4".
