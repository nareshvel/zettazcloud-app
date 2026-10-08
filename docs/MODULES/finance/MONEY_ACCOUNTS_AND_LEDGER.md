# Money Accounts & Ledger (Finance Module)

Status: **feature-complete accrual ledger** (2026-10-14). All §6 gaps closed —
redemption relief, COGS/inventory accounting, split tender, period locking,
bank reconciliation, tax remittance, forfeited-deposit income, and the legacy
refund path removal. Session-log entries under 2026-10-12 → 2026-10-14 in
`docs/AI_CONTEXT/SESSION_LOG.md` carry the per-phase detail.

This document is the map of the double-entry accounting layer: what exists,
how the invariants work, where every hook lives, and how to test it.

---

## 1. Model

**Schema** (`database/migrations/`):

| File | Tables / columns |
|---|---|
| `2026-10-12a_money_accounts_ledger.sql` | `money_accounts`, `money_journal_entries`, `money_journal_lines`, `finance_account_mappings` (+ seeds) |
| `2026-10-12b_drawer_sessions.sql` | `cash_drawer_sessions`, `money_drawer_movements` |
| `2026-10-13a_customer_account_payments.sql` | `customer_account_payments` |
| `2026-10-14a_finance_completeness.sql` | `accounting_period_locks`, `money_reconciliations`, `tax_remissions`, `money_journal_lines.reconciliation_id`, seed INVENTORY/COGS/FORFINC |
| `2026-10-14b_sale_item_unit_cost.sql` | `sale_items.unit_cost` — per-unit cost snapshot at sale time |

`money_accounts` — tenant chart of accounts. `account_type` ∈
`asset | liability | equity | revenue | expense` drives the normal-balance
side (asset/expense = debit-normal). `store_id` nullable — a NULL row is a
tenant-wide account, a set row is that store's drawer. `is_system` rows are
seeded and should not be deleted (postings resolve by `code`).

Seeded codes: `CASH, BANK, SAFE, CARDCLR, AR, AP, TAXPAY, LAYDEF, SAVDEF,
SALES, SALESRET, PURCH, OPEXP, OVERSHORT, EQUITY, INVENTORY, COGS, FORFINC`.

`money_journal_entries` — header: `entry_number` (`JE-YYYY-NNNNNN`, per-tenant
sequence), `entry_date`, `source_type`, `source_id`, `memo`, `status`
(`posted`/`voided`), `reversal_of_id`, `created_by`.
`UNIQUE(tenant_id, source_type, source_id)` is the **idempotency key** — a
business event can only post once.

`money_journal_lines` — legs: `account_id`, `debit`, `credit`,
`CHECK ((debit>0) != (credit>0))`, optional `customer_id`/`supplier_id`
subledger refs, `line_no`, `reconciliation_id` (the session that cleared it).

`finance_account_mappings` — `tender:<method>` and `event:<name>` →
`account_id`, tenant-editable from the UI (Accounts → Posting rules).
Never hard-code a target account in a hook — resolve through the mapping so
tenants can repoint it.

`cash_drawer_sessions` — open/close lifecycle per store. One open session per
store enforced by `open_marker` generated column. The opening float **is**
journaled (`source_type='drawer_open'`, Dr drawer / Cr SAFE by default) and
the expected-cash query excludes that source so it isn't double-counted
against `opening_float`.

`accounting_period_locks` — one row per tenant (`locked_through` DATE).
`postEntry` rejects any journal dated on/before it — the guard lives inside
the service so every write path (auto postings, reversals, manual entries)
funnels through it.

`money_reconciliations` — statement-matching sessions: account, statement
date + ending balance, cleared balance, difference, optional
`adjustment_entry_id`, `in_progress`/`completed`.

`tax_remissions` — audit trail for TAXPAY settlements (Dr TAXPAY / Cr the
account paid from). Partial remittances supported; balance carries forward.

`sale_items.unit_cost` — the per-unit inventory cost captured inside the sale
transaction (store listing WAC → product WAC → `cost_price` →
`last_received_cost_price`). The sale's COGS legs sum these, and sales-return
restores read the same snapshot, so a return months later revalues at the
original basis even after WAC moved. NULL on pre-migration rows → callers
fall back to the live valuation source.

`customer_account_payments` — a payment collected against a customer's
on-account (AR) balance. Rows are never hard-deleted — voids reverse the
journal and restore `customers.outstanding_credit`. Balance invariant:

```
customers.outstanding_credit
  =  Σ on-account tenders on sales (incl. on_account legs of split tenders)
   − Σ posted customer_account_payments
   − Σ store_credit/exchange refunds (credits AR → decrements balance)
   ± void/delete reversals
```

Overpayment is allowed — the balance goes negative, which reads as "customer
has credit with us". Deliberate (tenant flexibility).

## 2. Service — `backend/services/moneyPostingService.js`

- `postEntry({ tenantId, storeId, entryDate, sourceType, sourceId, memo,
  lines, createdBy }, conn?)` — validates legs balance **to the cent after
  per-leg rounding**, resolves `{ accountId }`/`{ accountCode }`/`{ account_id }`
  refs, checks ownership + `is_active`, enforces the **period lock**
  (`entry_date <= locked_through` → throws). Pass the caller's `conn` to keep
  posting atomic with the business write.
- `reverseEntry(entryId, { tenantId, memo, createdBy }, conn?)` — posts a
  **mirror** entry and flips the original to `voided`. The reversal flows
  through the same period-lock guard — a locked period cannot be silently
  altered. Already-voided → error (409 at API).
- `tenderAccountId(conn, tenantId, methodCode, direction)` — `tender:<code>`
  mapping → direction default (`in`→`event:default_in`, `out`→
  `event:default_out`). Custom tenant payment methods resolve by their DB
  `code`; unknown methods fall back to CASH/BANK and never block a sale.
- `resolveAccountId(tenantId, keyOrCode, conn?)` — mapping → code → lazy
  `ensureDefaults` retry.
- `unitCost(conn, tenantId, { productId, pieceId, storeId })` — shared
  valuation source used by sale COGS, return restores (fallback), and layaway
  completion COGS: piece cost → store listing WAC → listing override →
  last-received → product WAC → `cost_price`. Returns 0 when unknown — callers
  skip the COGS pair rather than posting 0-value legs.
- `ensureDefaults(tenantId, conn?)` — idempotent seed of the default chart +
  mappings (keep in sync with `2026-10-14a` when adding accounts).
- `accountBalances(tenantId, conn?)` — **counts every line including voided
  originals**: a voided entry stays in the books and its posted reversal
  cancels it arithmetically. Excluding voided rows double-subtracts.

`validateLines` / `buildReversalLines` are pure and unit-tested
(`tests/moneyPostingService.test.js`).

## 3. Posting hooks (all inside the business transaction)

| Event | File | Entry |
|---|---|---|
| Sale (single or split tender) | `controllers/createSaleController.js` | **Per tender leg**: Dr `tender:<leg code>` account. Then Cr `event:revenue` (net) / Cr `event:tax`. Then **Dr `event:cogs` / Cr `event:inventory`** from the `sale_items.unit_cost` snapshot. `tenders[]` in the request produces one balanced multi-leg entry; `sales.payment_method` stores `'split'` and one `payment_transactions` row lands per leg. `on_account` legs resolve to AR and bump `outstanding_credit` by their leg amount only; any on-account leg without a customer → 400. |
| Return/refund | `controllers/salesReturnController.js` | Dr `event:returns` + Dr `event:tax` / Cr refund tender; `store_credit`/`exchange` → Cr AR and decrement `outstanding_credit`. Restockable items add **Dr `event:inventory` / Cr `event:cogs`** valued at the original `unit_cost` snapshot (live `unitCost` fallback for pre-snapshot rows). |
| Return cancel | `salesReturnController.js` `cancelReturn` | Un-restocks + `reverseEntry` on the return's entry + restores `outstanding_credit` for credit-method refunds. |
| GRN commit (create-COMPLETED, status → COMPLETED/POSTED) | `controllers/grnController.js` | **Dr `event:inventory` / Cr `event:payable`** for `total_received_value`. `source_type='grn_receipt'`; idempotent via `uq_entry_source`. |
| GRN de-commit (→ DRAFT/CANCELLED, delete, updateGrn) | `grnController.js` | `reverseEntry` mirror on the receipt entry. |
| Outgoing payment (all 4 insert paths) | `routes/finance.routes.js` | Supplier → **Dr `event:payable` (AP)** — settles the payable the GRN accrued. Expense/other → Dr `event:expense` (OPEXP). Credit = tender out-account. Remap `event:payable` → PURCH for cash-basis books. |
| Payment void | `routes/finance.routes.js` | `reverseEntry` mirror. |
| Layaway payments | `routes/layaway.routes.js` | Dr tender / Cr `event:layaway_liability`. |
| **Layaway completion** | `routes/layaway.routes.js` | `postLayawayCompletionEntry` at whichever path finishes the plan (final payment or `status → completed`): **Dr `LAYDEF` / Cr `event:revenue`** for `paid_amount` + Dr COGS / Cr INVENTORY for the released pieces. `source_type='layaway_complete'` — idempotent, can't double-post. |
| Savings installments | `routes/savingsSchemes.routes.js` | Dr tender / Cr `event:savings_liability`. |
| **Savings redemption** | `savingsSchemes.routes.js` `status → redeemed` | `source_type='savings_redeem'`, Dr `SAVDEF` for `total_paid`. **Linked to a sale** (`redeemed_sale_id`): Cr the sale's tender account for `min(paid, sale.total)` — offsets the tender debit so revenue isn't double-counted — and Cr `payoutMethod` tender for any excess paid back to the customer. **No linked sale**: Cr `event:revenue` — the redemption is the revenue event. |
| Layaway cancel / default | `routes/layaway.routes.js` | Dr `LAYDEF` / Cr refund tender, or Cr `event:forfeited_deposits` (FORFINC) when `defaulted`/`forfeit`. `source_type='layaway_cancel'`. |
| Savings cancel | `savingsSchemes.routes.js` | Same shape on `total_paid`; `source_type='savings_cancel'`. |
| `/payments/process` on-account settlement | `controllers/payment.controller.js` | Dr tender / Cr AR — only when the sale was `on_account`. |
| Customer payment received | `finance.routes.js` `POST /customer-payments` | Dr tender / Cr AR (`payment_received`) + `customer_account_payments` row + `outstanding_credit −= amount` — one transaction, `FOR UPDATE` locked. |
| Customer payment void | `finance.routes.js` | Reversal + balance restore + row → `voided`. |
| Drawer open float | `finance.routes.js` | Dr drawer / Cr funding (`body.sourceAccountId`, default SAFE). |
| Drawer paid-in/out, close variance, transfer | `finance.routes.js` | See §3 of the phase-4 log; variance → `OVERSHORT`. |
| Manual journal + reversal | `finance.routes.js` | `POST /journal`, `POST /journal/:id/reverse`. |
| Sale delete | `services/saleDeletionService.js` | `reverseEntry` on the sale's entry + `outstanding_credit` decrement for on-account sales — inside the delete transaction. |
| **Tax remittance** | `finance.routes.js` `POST /tax-remittance` | Dr `event:tax` (TAXPAY) / Cr paid-from account or tender method + `tax_remissions` row. |
| **Reconciliation adjustment** | `finance.routes.js` `POST /reconciliations/:id/complete` | When cleared ≠ statement balance, books the residual to `adjustmentAccountId` (`source_type='reconciliation'`) and auto-clears the account-side line. |

## 4. API surface (`/api/finance/…`, JWT + tenant + store middleware)

`GET/POST/PUT /accounts` · `GET/PUT /mappings` · `GET /ledger` ·
`GET /ledger/export.csv` · `POST /journal` · `POST /journal/:id/reverse` ·
`GET/POST /drawer-sessions`, `GET /drawer-sessions/current`,
`POST /drawer-sessions/:id/movements`, `POST /drawer-sessions/:id/close` ·
`POST /transfers` · `GET/POST /customer-payments`, `POST /customer-payments/:id/void` ·
`GET /period-lock` · `PUT /period-lock` `{ lockedThrough | null, notes? }` ·
`GET /tax-payable` · `POST /tax-remittance` · `GET /tax-remissions` ·
`GET/POST /reconciliations` · `GET /reconciliations/:id` ·
`POST /reconciliations/:id/lines` `{ lineIds, cleared }` ·
`POST /reconciliations/:id/complete` `{ adjustmentAccountId? }` ·
`GET /reports/cash-flow` · `GET /reports/profit-loss`.

Reads = `finance.view`; writes = `finance.manage`; expense approvals =
`finance.approve`.

## 5. Frontend

| Route | Page |
|---|---|
| `/accounts` | `AccountsPage.tsx` — chart + balances, create/edit, Posting rules editor, Transfer dialog, **Period lock** card (lock-through date + confirm + unlock), **Tax payable** card (accrued/remitted + remit dialog + history), row-click → filtered ledger |
| `/ledger` | `LedgerPage.tsx` — filterable journal, per-line legs, New Journal Entry (live balance check), Reverse, Export CSV |
| `/drawer` | `DrawerPage.tsx` — open float, live expected cash, paid-in/out, close with variance preview |
| `/reconciliation` | `ReconciliationPage.tsx` — session list → detail: checkbox clearing with live cleared/difference preview, adjustment-account completion |
| `/reports/cash-flow` · `/reports/profit-loss` | report pages |
| `/customers/:id` (Payments tab) | Receive Payment dialog + history + void |
| POS checkout | `PaymentModal.tsx` — "Split payment" toggle adds tender rows (method + amount), live remaining/over indicator, confirm disabled until balanced; on-account leg warns when no customer |

Sidebar: Finance → Expenses · Payments · Money Accounts · Ledger · Cash
Drawer · Reconciliation. `financeService.ts` holds all client calls.

## 6. Resolved gaps / remaining notes

**All original design-level gaps are now closed** (see §3). Deliberate
semantics to know:

1. **Savings redemption linked to a sale** credits the *sale's tender
   account*, not revenue — the sale already recognized revenue; crediting the
   tender reverses the phantom cash/card the sale debited. Combined effect
   across the two entries: `Dr SAVDEF / Cr SALES` exactly once. Excess scheme
   value over the sale total pays out via `payoutMethod`.
2. **Supplier payments are accrual** (Dr AP) because GRN receipt accrues the
   payable. A tenant preferring cash-basis books remaps `event:payable →
   PURCH` — both sides then behave cash-basis.
3. **The legacy `/api/payment/refund` path is removed** (route, controller,
   and frontend `refundTransaction`) — it wrote to columns that don't exist
   and used the wrong status casing. Canonical refunds are sales returns
   (`salesReturnController`), which post through the ledger.
4. **COGS uses the `sale_items.unit_cost` snapshot**; rows predating the
   column return NULL and the return path falls back to live valuation — an
   accepted approximation for historical sales.
5. **Period lock is per-tenant, one rolling `locked_through` date** — not
   per-period buckets. Reversals of locked-period entries are also blocked,
   which is correct: adjust in the open period instead.

## 7. Test checklist (for QA / dev smoke)

Verified live on `zettaz_dev` 2026-10-14 — this is the sequence to re-run
when testing:

- [ ] **Split tender**: checkout a sale paying part cash / part card →
  `sales.payment_method='split'`, two `payment_transactions` rows, journal
  shows `Dr CASH + Dr CARDCLR / Cr SALES` (+ COGS legs). Under/over-total →
  400. On-account leg without customer → 400.
- [ ] **COGS**: product with `cost_price` → sale posts `Dr COGS / Cr
  INVENTORY` at `unit_cost`; `sale_items.unit_cost` populated; restockable
  return posts the reverse at the snapshot.
- [ ] **GRN accrual**: create a COMPLETED GRN → `Dr INVENTORY / Cr AP`; pay
  the supplier via Payments → `Dr AP / Cr tender`; delete the GRN → receipt
  entry voided + mirror reversal.
- [ ] **Layaway**: complete a paid plan → `Dr LAYDEF / Cr SALES` + COGS legs;
  retry → no duplicate (`layaway_complete` idempotent).
- [ ] **Savings**: redeem matured enrollment → `Dr SAVDEF / Cr SALES`
  (standalone) or `Cr <sale tender>` (linked); cancel with `forfeit:true` →
  Cr `FORFINC`.
- [ ] **Period lock**: Accounts → Period lock → lock through a past date →
  post a manual journal dated before it → rejected with the lock message;
  today's date posts; unlock works.
- [ ] **Reconciliation**: `/reconciliation` → new session (account + date +
  ending balance) → tick lines → cleared/difference update live → complete
  (adjustment account picker appears when difference ≠ 0).
- [ ] **Tax remittance**: Accounts → Tax payable → Remit → `Dr TAXPAY /
  Cr <account>` + row in history.
- [ ] **Legacy refund**: `POST /api/payment/refund` → 404.

## 8. Operational gotchas (learned during build)

- `node scripts/migrate.js` blocks on an interactive confirm — always run
  `node scripts/migrate.js --yes --no-move` (`--no-move` keeps the file
  top-level so the VPS runner can apply it).
- `users.name` is a single column — no `first_name`/`last_name`.
- mysql2 binds `?` placeholders in **textual order** — date expressions in a
  SELECT list bind before WHERE params.
- `'0000-00-00'` is invalid under `NO_ZERO_DATE` — use `'1970-01-01'`.
- `logActivity` takes a **data object**, not positional args.
- Balance semantics: a voided entry remains posted history — counts in
  balances, cancelled arithmetically by its reversal.
- SQL string literals containing `''`-escaped comments trip the migration
  splitter — keep `COMMENT` clauses out of `PREPARE`-wrapped DDL.
- `POST /sales` reads `store_id` (snake_case) — the POS cart sends it; raw
  curl needs the snake key, not `storeId`.
