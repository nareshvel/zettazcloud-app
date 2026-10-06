# Sales Hub Search-First Redesign — Session Record (2026-08-29)

Handoff record for continuing this work in a different AI tool (e.g. Devin's IDE). Written
immediately after the work landed, so treat it as ground truth over any older doc that
disagrees (in particular `13_POS_Hub_Proposal.md`, which describes the earlier bento-grid
version this redesign replaced).

---

## 1. Why the Hub was redesigned

The original Sales Hub (`docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md`, iterations
14–16) was a 10-tile bento grid, one tile per backend module (Repairs, Old Gold, Memo In/Out,
Layaway, Savings, Orders, etc.). Feedback during this session was that this was "patch work"
rather than a real rethink: nearly every Hub action actually starts with "find an existing
customer or record" — a repair to check in, a memo to return, a layaway payment to collect —
and the tile model made a cashier re-search for that customer separately *inside* whichever
destination page they landed on, six different times across six different pages.

The redesign replaces the module-tile grid with:

1. **Two hero tiles** — New Sale, Duty-Free Sale — for the "no existing record" case.
2. **One universal search bar** — type a name/phone/email and see the customer's whole
   relationship across every module at once, each result with its own contextual action.
3. **A "Start something new" row** of small, permission-filtered shortcuts (repair intake,
   old-gold buy, memo out, layaway, savings, orders, returns) for creating a record with no
   existing customer match yet.

## 2. Architecture

### Backend
- `backend/controllers/salesHubController.js` — `exports.search` for `GET
  /api/sales-hub/search?q=`. Fans out across `repair_orders`, `old_gold_purchases`,
  `memo_transactions`, `layaway_plans`, `savings_scheme_enrollments`, `sales` — each query
  `LEFT JOIN customers`, tenant-scoped, `LIMIT 8`. Rolls the hits up by `customer_id` into
  `SalesHubCustomer[]` (capped at 5 customers) plus `standaloneRecords[]` for hits with no
  linked customer. Record shape:
  ```ts
  { type, id, label, status, statusLabel, action, actionLabel, date }
  ```
  Action vocabulary: `check-in` / `collect-payment` (repair), `redeem-credit` (old gold),
  `return-item` (memo), `collect-payment` (layaway/savings), `return` (sale).
- `backend/routes/salesHub.routes.js` — mounts `authenticate` + `requireTenantId`, registers
  `GET /search`. Wired into `backend/server.js` as `app.use('/api/sales-hub', salesHubRoutes)`.
- `backend/controllers/salesController.js` — new `exports.searchSales` (separate from the Hub
  endpoint, used by Sales Return's own lookup step): `LEFT JOIN customers`, matches
  `document_number`/name/email/phone. Registered in `backend/routes/sales.routes.js` as `GET
  /search`, **before** the existing `GET /:id` (Express route-ordering rule — literal routes
  before wildcards, per the top-level CLAUDE.md convention).

### Frontend
- `frontend/src/services/salesHubService.ts` — `searchSalesHub(query)` + TS types
  `SalesHubRecordType`, `SalesHubAction`, `SalesHubRecord`, `SalesHubCustomer`,
  `SalesHubSearchResult`.
- `frontend/src/services/salesService.ts` — `SaleSearchResult` + `searchSales()` for the
  Return flow.
- `frontend/src/pages/SalesHubPage.tsx` — the rebuilt page. Key pieces:
  - `effectiveUser = user || cachedUser` (from `localStorage.currentUser`) — defensive fallback
    for a transient null `AuthContext.user`, mirroring an existing pattern in `Sidebar.tsx`.
    This did **not** fix the RBAC bug described in §4 below, but is a legitimate improvement
    kept in place regardless.
  - Hero tiles gated by `hasAnyPermission(effectiveUser, ['sales.create'])`.
  - Debounced (300ms) search calling `searchSalesHub()`, rendering `customers[]` (grouped,
    each with a header + its `records[]` as action rows) and `standaloneRecords[]`.
  - `ACTION_DESTINATION` / `RECORD_TYPE_PATH` maps route each record's `action`/`type` to a
    destination page path plus any extra router state (e.g. a memo return-item action adds
    `{quickActionType: 'in'}`).
  - `goToRecord(record, presetQuery)` — the single place that constructs the quick-action
    navigation (contract below).
  - 7 "Start something new" shortcuts, each permission-filtered independently via
    `hasAnyPermission(effectiveUser, permissions)`.
  - **View sale details**: for `record.type === 'sale'`, a separate `Eye`-icon `<button>`
    (sibling of, not nested inside, the primary action `<button>` — nested buttons are invalid
    HTML and were the reason this needed its own element) calls `handleViewSale(record)`,
    which calls `useReceipt().showReceiptForSale({id: record.id}, {mode: 'view'})`. A
    `<ReceiptModal isOpen={isReceiptModalOpen} onClose={closeReceiptModal}
    receiptContent={receiptContent} autoPrint={false} printerSettings={printerSettings ||
    undefined} title="Sale Details" />` renders when `receiptContent.html` is truthy. This
    reuses the exact same receipt/print-preview infrastructure already used by
    `POSScreen`/`Cart` — no new rendering path was built.
  - Sale record labels: `` `Sale ${s.document_number || '#' + String(s.id).slice(0,8)} · ${fmtMoney(s.total)}` ``
    — never interpolate `s.document_number` directly; it's SQL `NULL` for demo sales that
    predate the document-numbering migration, and a bare template literal stringifies that to
    the literal text "null" (this was the "Sale null" bug reported and fixed this session).

### Quick-action deep-linking contract

Established this session, used by every Hub-reachable destination page:

```ts
location.state = {
  quickAction: true,
  fromSalesHub: true,
  presetQuery?: string,        // pre-fill and auto-fire the destination's own search
  presetRecordId?: string,     // auto-select if exactly one result matches this id
  quickActionType?: 'out' | 'in', // e.g. memo direction
}
```

Destination pages read this in a `useEffect` on mount, auto-open their create/collect-payment
flow, and (if `presetQuery`/`presetRecordId` present) pre-fill and auto-fire their own
search/select. This was built out for Repairs, Old Gold, Memo, Layaway, Savings, Orders, and
Returns in this session (`RepairsPage.tsx`, `OldGoldPage.tsx`, `MemoPage.tsx`,
`LayawayPage.tsx`, `SavingsSchemesPage.tsx`, `OrdersPage.tsx`, `SalesReturnPage.tsx` +
`ReturnProcessingModal.tsx`). `CustomerSearchSelect.tsx` grew an `initialQuery` prop to support
this for the pages that use it (Repairs/OldGold/Memo); Layaway/Savings use their own
`CollectPaymentQuickAction`/`CollectPaymentSearchModal` components instead.

### Backend support built for pages that previously had none
- Orders had **zero backend** before this session — pure frontend mock. Built from scratch:
  `backend/controllers/salesOrdersController.js`, `backend/routes/salesOrders.routes.js`,
  `database/migrations/2026-08-28_sales_orders.sql`.
- Repairs/Old Gold/Memo/Layaway/Savings routes were extended with server-side search +
  pagination to support the quick-action preset-query flow.

## 3. RBAC login bug chain (found as a side effect, not the original goal)

Adding permission gating to the Hub redesign surfaced two pre-existing, previously-unknown
production bugs that silently downgraded a correctly-resolved "Tenant Admin" role to a generic
`'user'` role on login. The old ungated tile Hub never exercised this path, so it never
surfaced. Full detail is now also in the top-level `CLAUDE.md` "Critical conventions" section
— summarized here for the handoff record:

1. `backend/middleware/unifiedAuthMiddleware.js` clobbered roles/permissions to defaults on
   `roleNames.length === 0 OR permissions.length === 0`. A Tenant Admin has zero explicit
   `role_permissions` rows *by design* (bypasses permission checks by role name), so this
   fired on every Tenant Admin login. Fixed OR → AND.
2. The actual root cause, frontend-only: `frontend/src/services/authService.ts`'s
   `getActualBackendUserData()` correctly resolved roles internally, then discarded them when
   reconstructing its return value from an incomplete field whitelist. Fixed by adding
   `roles`/`roleNames`/`systemRoles`/`permissions` to that whitelist.

**Diagnosis method** (worth reusing for similarly evasive bugs): static code tracing predicted
"this should already work" twice and was wrong both times. What actually found the bugs was
adding temporary `console.log`s at the exact points data was suspected to be lost, then having
a human reproduce the issue live and paste the actual console/network output. Prefer this over
further static tracing once a bug survives one confident-but-wrong fix.

## 4. Print Agent origin/CORS rework

Independent of the Hub work, but done in the same session while investigating a Hub-adjacent
notification (print agent not paired). Three layered fixes in `print-agent/internal/agent/`,
described in full in the top-level `CLAUDE.md`. Headline: pairing is now additive across
origins, `cors()` now checks both the static and persisted origin lists, and `/health` +
`/v1/pair` are exempt from the origin gate to break a discovery chicken-and-egg deadlock.

**This code was never compiled by an AI session** — no Go toolchain was available in the
sandbox used. The user has verified it works via manual rebuild/deploy (confirmed live at
agent v2.3.6, pairing succeeded on both `cloud.zettaz.com` and `localhost:5173`), but anyone
continuing this work (Devin's IDE included) should run `go build ./... && go vet ./...` in
`print-agent/` as a first step, and ideally the existing Go test suite, before trusting or
extending this area further. `print-agent/PROJECT_STATUS.md`'s "Strict-origin loopback API"
bullet is now stale relative to this change and needs rewriting; its version number (2.3.8)
also doesn't match the last live-verified build (2.3.6) — reconcile that discrepancy before
editing the doc.

## 5. `useOptionalStore()` pattern

`/print-agent` is a deliberately public route (registered in `App.tsx` outside
`<ProtectedRoute><AppProviders>`) so a browser can pair the agent without logging in. Two
components reachable from it (`PrintAgentFleetSection.tsx`, and transitively
`useLocaleFormat.ts`, which it calls for date/time formatting) crashed with "useStore must be
used within a StoreProvider" because they called the throwing `useStore()`. Fixed by adding
`useOptionalStore()` to `frontend/src/contexts/StoreContext.tsx` (returns `undefined` instead
of throwing) and switching both call sites to it with `?.` chaining. Any future component
reachable from a public route must follow this pattern rather than assuming
`StoreProvider`/`AuthProvider` context is present.

## 6. Open items for whoever picks this up next

- Verify the Print Agent Go changes actually compile (see §4).
- Reconcile `print-agent/PROJECT_STATUS.md`'s version number and stale "Strict-origin loopback
  API" bullet.
- Sales Hub glance strip ("N repairs ready / N memos overdue") — not built.
- Sales Hub mobile/tablet — verified by code review + automated tests only, not a live device.
- Per-transaction duty-free override ("Option B") — still store-level only, unrelated to this
  redesign but tracked in `13_POS_Hub_Proposal.md` §5.
