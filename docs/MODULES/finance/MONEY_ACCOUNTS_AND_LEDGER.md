# Money Accounts & Ledger (Finance Module)

Status: Phases 1–5 complete and pushed (through `ab81c23`, 2026-10-13).
Author: Devin sessions 2026-10-12 → 2026-10-13. Session-log entries under the
same dates in `docs/AI_CONTEXT/SESSION_LOG.md` carry the per-phase detail.

This document is the map of the double-entry accounting layer: what exists,
how the invariants work, where every hook lives, and the known gaps.

---

## 1. Model

**Schema** (`database/migrations/`):

| File | Tables |
|---|---|
| `2026-10-12a_money_accounts_ledger.sql` | `money_accounts`, `money_journal_entries`, `money_journal_lines`, `finance_account_mappings` (+ seeds for existing tenants) |
| `2026-10-12b_drawer_sessions.sql` | `cash_drawer_sessions`, `money_drawer_movements` |

`money_accounts` — tenant chart of accounts. `account_type` ∈
`asset | liability | equity | revenue | expense` drives the normal-balance
side (asset/expense = debit-normal). `store_id` nullable — a NULL row is a
tenant-wide account, a set row is that store's drawer. `is_system` rows are
seeded and should not be deleted (postings resolve by `code`).

Seeded codes: `CASH, BANK, SAFE, CARDCLR, AR, AP, TAXPAY, LAYDEF, SAVDEF,
SALES, SALESRET, PURCH, OPEXP, OVERSHORT, EQUITY`.

`money_journal_entries` — header: `entry_number` (`JE-YYYY-NNNNNN`, per-tenant
sequence), `entry_date`, `source_type`, `source_id`, `memo`, `status`
(`posted`/`voided`), `reversal_of_id`, `created_by`.
`UNIQUE(tenant_id, source_type, source_id)` is the **idempotency key** — a
business event can only post once.

`money_journal_lines` — legs: `account_id`, `debit`, `credit`,
`CHECK ((debit>0) != (credit>0))`, optional `customer_id`/`supplier_id`
subledger refs, `line_no`.

`finance_account_mappings` — `tender:<method>` and `event:<name>` →
`account_id`, tenant-editable from the UI (Accounts → Posting rules).
Never hard-code a target account in a hook — resolve through the mapping so
tenants can repoint it.

`cash_drawer_sessions` — open/close lifecycle per store. One open session per
store is enforced by generated column `open_marker =
IF(status='open',1,NULL)` + UNIQUE (NULLs don't collide, so closed history is
unlimited). The opening float lives **on the session row, not the ledger**
(see §6 gaps).

`money_drawer_movements` — paid-in/paid-out rows → `journal_entry_id`.

## 2. Service — `backend/services/moneyPostingService.js`

- `postEntry({ tenantId, storeId, entryDate, sourceType, sourceId, memo,
  lines, createdBy }, conn?)` — validates legs balance **to the cent after
  per-leg rounding**, resolves `{ accountId }` or `{ accountCode }` refs,
  checks account ownership + `is_active`, writes entry + lines. Pass the
  caller's `conn` to keep posting atomic with the business write; without it
  the service takes its own connection.
- `reverseEntry(entryId, { tenantId, memo, createdBy }, conn?)` — posts a
  **mirror** entry and flips the original to `voided`. History is never
  edited. Reversals double-post-guard: already-voided → error (409 at API).
- `tenderAccountId(tenantId, methodCode, direction, conn?)` — resolves
  `tender:<code>` mapping → direction default (`in`→`event:default_in`,
  `out`→`event:default_out`). Custom tenant payment methods resolve by their
  own DB `code`; unknown methods fall back to CASH/BANK and never block a
  sale.
- `resolveAccountId(tenantId, keyOrCode, conn?)` — mapping lookup →
  code fallback → lazy `ensureDefaults` retry.
- `ensureDefaults(tenantId, conn?)` — idempotent seed of the default chart +
  mappings (also runs inside `tenantProvisioningService` for new tenants).
- `accountBalances(tenantId, conn?)` — **counts every line including voided
  originals**: a voided entry stays in the books and its posted reversal
  cancels it arithmetically. Excluding voided rows double-subtracts.

`validateLines` / `buildReversalLines` are pure and unit-tested
(`tests/moneyPostingService.test.js`).

## 3. Posting hooks (all inside the business transaction)

| Event | File | Entry |
|---|---|---|
| Sale | `controllers/createSaleController.js` | Dr tender / Cr `event:revenue` (net) / Cr `event:tax`. Skips `$0`/`none` sales. Also writes the `payment_transactions` tender row (previously missing on this path). |
| Return/refund | `controllers/salesReturnController.js` | Dr `event:returns` + Dr `event:tax` (claw-back) / Cr refund tender. `store_credit`/`exchange` credit AR (no cash moves). |
| Outgoing payment (create-paid, top-up, POST /payments, approve+pay) | `routes/finance.routes.js` | Dr `event:purchases` (supplier) or `event:expense` (other) / Cr tender out-account — cash basis; remap to AP for accrual. |
| Payment void (unpaid-flip, delete, /payments/:id/void) | `routes/finance.routes.js` | `reverseEntry` mirror. |
| Layaway down payment + installments | `routes/layaway.routes.js` | Dr tender / Cr `event:layaway_liability` (`LAYDEF`). |
| Savings installments | `routes/savingsSchemes.routes.js` | Dr tender / Cr `event:savings_liability` (`SAVDEF`). |
| `/payments/process` on-account settlement | `controllers/payment.controller.js` | Dr tender / Cr AR — only when the sale was `on_account` (checkout-paid sales already posted; avoids double counting). |
| Drawer open float | `finance.routes.js` | Dr drawer / Cr funding account (`body.sourceAccountId`, default `SAFE`; skipped when the counterpart would be the drawer itself). `source_type='drawer_open'`; expected-cash queries exclude this source so the float isn't double-counted against `opening_float`. |
| Drawer paid-out | `finance.routes.js` | Dr `event:expense` (or `counterpartAccountId`) / Cr drawer. |
| Drawer paid-in | `finance.routes.js` | Dr drawer / Cr counterpart (default `SAFE`). |
| Drawer close variance | `finance.routes.js` | short: Dr `OVERSHORT` / Cr drawer; over: Dr drawer / Cr `OVERSHORT`. |
| Account transfer | `finance.routes.js` | Dr destination / Cr source, `source_type='transfer'`. |
| Manual journal + reversal | `finance.routes.js` | `POST /journal`, `POST /journal/:id/reverse`. |
| Sale delete | `services/saleDeletionService.js` | `reverseEntry` on the sale's posted entry inside the delete transaction — a failed reversal rolls the whole delete back. Skipped only when `money_journal_entries` doesn't exist (unmigrated DB). |
| Layaway cancel / default | `routes/layaway.routes.js` `POST /:id/status` | Dr `LAYDEF` / Cr refund tender (default `cash`, `body.refundMethod` overrides) on `cancelled`; `defaulted` (or `body.forfeit`) → Cr `event:forfeited_deposits` mapping else `event:revenue`. `source_type='layaway_cancel'`. |
| Savings cancel | `routes/savingsSchemes.routes.js` `POST /enrollments/:id/status` | Same shape on `total_paid`: Dr `SAVDEF` / Cr refund tender or forfeit income. `source_type='savings_cancel'`. Route now runs in a transaction (was bare `pool` calls). |

## 4. API surface (`/api/finance/…`, JWT + tenant + store middleware)

`GET/POST/PUT /accounts` · `GET/PUT /mappings` · `GET /ledger`
(`?account_id&source_type&from&to&limit`) · `GET /ledger/export.csv` ·
`POST /journal` · `POST /journal/:id/reverse` · `GET/POST /drawer-sessions`,
`GET /drawer-sessions/current`, `POST /drawer-sessions/:id/movements`,
`POST /drawer-sessions/:id/close` · `POST /transfers` ·
`GET /reports/cash-flow` · `GET /reports/profit-loss`.

Reads = `finance.view`; writes = `finance.manage`; expense approvals =
`finance.approve`.

## 5. Frontend

| Route | Page |
|---|---|
| `/accounts` | `AccountsPage.tsx` — chart + balances, create/edit, Posting rules editor, Transfer dialog, row-click → filtered ledger |
| `/ledger` | `LedgerPage.tsx` — filterable journal, per-line legs inline, New Journal Entry dialog (live balance check), Reverse, **Export CSV** honoring current filters |
| `/drawer` | `DrawerPage.tsx` — open float, live expected cash, paid-in/out, close with variance preview, history |
| `/reports/cash-flow` | `reports/CashFlowReportPage.tsx` — opening/inflow/outflow/closing per asset account + by-source summary |
| `/reports/profit-loss` | `reports/ProfitLossReportPage.tsx` — revenue/expense sections + net line |

Sidebar: Finance → Expenses · Payments · Money Accounts · Ledger · Cash Drawer.
Reports Center has Cash Flow + Profit & Loss cards.
`financeService.ts` holds all client calls; `downloadLedgerCsv` mirrors the
`downloadExpenseCsv` blob pattern.

## 6. Known gaps / deferred work

Tracked here and in `CLAUDE.md` → Known pending work. Ordered roughly by
impact. (Fixed 2026-10-13: sale-delete reversal, drawer-float journaling,
layaway/savings cancel relief — see §3.)

1. **`customers.outstanding_credit` is never written at runtime** — the
   charge-account report reads a field only a backfill script updates. Needs
   a real receive-payment-on-account flow (`payment_received` source type is
   ready for it) that posts Dr tender / Cr AR **and** writes the column.
2. **Layaway/savings *redemption* isn't relieved** — completing a layaway
   (status → completed + final sale) or redeeming a matured savings scheme
   leaves the liability unless the completing sale is tendered with a method
   mapped to `LAYDEF`/`SAVDEF`. Elegant no-code path: create a payment method
   and map `tender:<code>` to the liability account — the completing sale
   then posts Dr LAYDEF / Cr SALES, which is exactly right. If tenants want a
   dedicated redeem flow, post Dr `LAYDEF`/`SAVDEF` at the status transition.
3. **No COGS / inventory-asset accounting** — supplier purchases post to
   `PURCH` at payment time (cash basis). P&L shows purchases, not
   cost-of-goods-sold at sale, and there is no inventory-asset account
   movement. That's an accrual-vs-cash design choice for a later phase —
   documented so nobody mistakes `totalExpenses` for COGS.
4. **Legacy `payment.controller.js` transaction-refund path** — references
   columns absent from the current schema (`original_transaction_id`,
   `type`); canonical refunds go through `salesReturnController` (hooked).
   Decide: repair or remove.
5. **Split tender** — `sales.payment_method` is still a single string; the
   `payment_transactions` row mirrors that one tender. True multi-tender
   checkout isn't modeled.
6. **No period locking / fiscal close** — any `finance.manage` user can post
   or reverse into any date. Add a `period_close` table + a guard in
   `postEntry` when needed.
7. **No bank reconciliation / statement import** — transfers model the
   deposit chain but there's no match-against-statement screen. Journal CSV
   export is the accountant hand-off for now.
8. **Tax remittance** — `TAXPAY` accrues credits on sales and debits on
   returns forever; no remittance workflow. A manual journal entry
   (Dr TAXPAY / Cr BANK) is the current workaround.
9. **Forfeit income has no dedicated seeded account** — cancel-forfeit posts
   to `event:forfeited_deposits` when the tenant defines that mapping, else
   `event:revenue` (SALES). To keep forfeited deposits out of sales figures,
   the tenant creates an income account and adds the mapping key.

## 7. Operational gotchas (learned during build)

- `node scripts/migrate.js` blocks on an interactive confirm — always run
  `node scripts/migrate.js --yes --no-move` (`--no-move` keeps the file
  top-level so the VPS runner can apply it).
- `users.name` is a single column — no `first_name`/`last_name` (bit the
  drawer joins once).
- mysql2 binds `?` placeholders in **textual order** — date expressions in a
  SELECT list bind before WHERE params (this caused the first cash-flow 500).
- `'0000-00-00'` is an invalid date under `NO_ZERO_DATE` — use
  `'1970-01-01'` as the "all history" floor.
- `logActivity` takes a **data object**, not `(req, action, …)` positional
  args.
- Balance semantics: a voided entry remains posted history — counts in
  balances, cancelled arithmetically by its reversal. Don't filter voided
  rows out of balance math.
