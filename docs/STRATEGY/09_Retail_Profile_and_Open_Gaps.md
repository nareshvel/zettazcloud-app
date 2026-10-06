# Retail Profile, Demo Tenants & Open Gaps

**Date:** 2026-08-31 (Rev 7)

---

## 1. How to run everything

```bash
cd backend

npm run migrate        # schema only — demo files are skipped
npm run migrate:demo   # schema + five demo tenants + their print templates
npm run db:reset-demo  # DESTRUCTIVE: wipe all tenant data, reseed demo only
```

`npm run migrate` will **never** create demo companies. The demo seed is named
`*.demo.sql` and the runner filters that suffix unless `--demo` /
`ALLOW_DEMO_SEED=1` is given. Seeding fictional companies into a real database
should not be something that can happen by forgetting a flag.

---

## 2. The duty-free audit — findings and removals

### 2.1 `duty_free_profiles` is dead, and could never have worked

Three tables (`duty_free_profiles`, `duty_free_invoice_sequences`,
`duty_free_invoice_corrections`), a 416-line service, a route, a mount, and one
frontend function. The audit traced every reference:

| Check | Result |
|---|---|
| Backend callers of `dutyFreeService` | Only `dutyFree.routes.js` — a closed loop |
| Frontend callers of `fetchDutyFreeProfiles` | **Zero** |
| Anything else reading the three tables | Nothing |

The decisive evidence is in `generateInvoiceNumber()`:

```sql
UPDATE duty_free_invoice_sequences
   SET current_value = current_value + 1
 WHERE profile_id = ? AND tenant_id = ?
RETURNING current_value, prefix, padding
```

`UPDATE … RETURNING` is **MariaDB and PostgreSQL syntax. MySQL 8 rejects it**
with a parse error. This function has never once returned an invoice number.
The subsystem was never exercised, in any environment.

**Removed:** `2026-08-25_drop_duty_free_profiles.sql`, plus the service, route,
mount, and the frontend interface and fetcher.

The drop migration does **not** assume the tables are empty — it counts the rows
first and aborts with a message rather than destroying anything unexpected.

### 2.2 The sequence table is not a head start on sequential numbering

`duty_free_invoice_sequences` looks like the sequential-numbering feature still
on the roadmap, so it is worth being explicit that it is not something to build
on. Beyond the invalid SQL:

- keyed on a duty-free profile, not on `(tenant, store, doc_type, period)`
- increments **outside** the sale transaction, so a rolled-back sale still burns
  a number and leaves a gap — and the authorities that mandate sequential
  numbering specifically prohibit gaps

The replacement is a `document_sequences` table allocated with
`SELECT … FOR UPDATE` inside the sale transaction. **Built — see §7a.**

### 2.3 Six abandoned backup files

`*_backup_<timestamp>`, `.bak`, `index copy 2.css`. None imported. Deleted.
They are hazardous precisely because they look like real modules — someone greps
for a symbol, finds it in a stale copy, and edits code that has been dead since
August. A test now fails if new ones appear.

### 2.4 Where duty-free actually lives

| Question | Home |
|---|---|
| Is this store duty-free? | `store_jurisdiction_settings.sales_mode` |
| What does the country require? | `jurisdiction_profiles` |
| What appears on the document? | `print_templates` blocks |
| Export / legal wording | `store_jurisdiction_settings.export_declaration_text` |

`stores.is_duty_free` is a denormalised mirror, written only inside the same
transaction as `sales_mode`, never edited on its own.

---

## 3. A real bug found while auditing: column-level collation

`2026-08-23_normalize_collation.sql` normalised **table** collation. MySQL tracks
**column** collation separately, and a column carrying an explicit `COLLATE`
keeps it after the table default changes.

**47 columns across 8 tables** were still `utf8mb4_unicode_ci`. Six are foreign
keys whose parents are `utf8mb4_0900_ai_ci`:

```
payment_transactions.sale_id       -> sales.id
payment_transactions.tenant_id     -> tenants.id
customer_activity_log.customer_id  -> customers.id
customer_contacts.customer_id      -> customers.id
payment_methods.tenant_id          -> tenants.id
payment_terminals.tenant_id        -> tenants.id
tenant_payment_settings.tenant_id  -> tenants.id
```

Any JOIN across these raises `Illegal mix of collations`. It is **latent, not
currently firing** — no query in the codebase joins them yet. It fires the first
time someone writes the obvious reporting query, "payments by sale", which is
squarely on the roadmap.

Fixed by `2026-08-25_normalize_column_collation.sql`, which uses `CONVERT TO`
(one statement per table, no restating 47 column definitions) and then asserts
zero stragglers via `SIGNAL`.

**The CI check was the reason this survived.** It compared
`INFORMATION_SCHEMA.TABLES.TABLE_COLLATION` only, so it stayed green while the
hazard sat there. CI now checks `INFORMATION_SCHEMA.COLUMNS` too.

---

## 4. A bug I introduced, now fixed: split-brain business type

Business type is stored in two places:

- `tenants.industry_code` — drives product fields and menu visibility
- `stores.industry_code` — drives the retail profile and template plan, and
  `retailProfileService` reads it **in preference to** the tenant value

The 2026-08-24 migration backfilled `stores.industry_code`. From that moment the
store row shadows the tenant row — so `PUT /industry/tenant`, which updated only
the tenant, would change the product fields while leaving the documents on the
old vertical. Both are now updated in one transaction.

---

## 5. On the `customers` column names — there was no problem

To answer the question directly: **the schema is fine and the mistake was
mine.** `first_name` / `last_name` / `phone_number` / `address_line1` are
perfectly reasonable names, and `customers` is internally consistent. I wrote
`name` / `phone` / `address` in the demo seed from assumption instead of reading
the table first. Nothing needed renaming; nothing was renamed.

The broader sweep across all 51 tables found no naming inconsistency worth a
migration. `stores.phone` vs `customers.phone_number` differ, but a store has
one phone number and a customer record models a person — renaming live columns
to make two different concepts look alike would be churn with real risk and no
benefit.

The sweep did find the collation problem in §3, which is a genuine defect. That
was worth the exercise.

---

## 6. Settings — Business Type + Duty-Free

`/settings?tab=general` now carries a **Duty-Free Store** checkbox directly
beneath **Business Type**, in `GeneralSettings`.

It was deliberately **not** added as a separate panel. A standalone
`RetailProfileSettings` component had been built with its own business-type
picker; mounting it would have put two different pickers, writing through two
different APIs, in the same settings page — the exact overlap this audit was
about. The component was deleted and its duty-free control folded in beside the
existing selector.

Two behaviours worth knowing:

- The checkbox renders **only after** the current value has loaded. An unchecked
  box we could not verify would tell a duty-free operator they are taxable.
- Saving a change to it asks for confirmation and states the consequence, because
  this setting decides whether tax is charged at all.

---

## 7. Demo tenants

| Login | Vertical | Jurisdiction | Mode |
|---|---|---|---|
| `demo@jewelry.zettaz.test` | Jewelry | Antigua, ABST 15% | **Duty-free** |
| `demo@grocery.zettaz.test` | Grocery | Antigua, ABST 15% | Domestic |
| `demo@electronics.zettaz.test` | Electronics | UAE, VAT 5% | Domestic |
| `demo@apparel.zettaz.test` | Apparel | UK, VAT 20% | Domestic |
| `demo@retail.zettaz.test` | General Retail | US, Sales Tax | Domestic |

Deliberately spread across four jurisdictions so nothing is silently
Antigua-shaped. Templates are generated by the same provisioning service real
tenants use, not seeded as SQL — hand-written block JSON would test a path
customers never exercise and drift as defaults improve.

Pharmacy is absent: a demo would imply readiness the vertical does not have.

---

## 7a. Rev 3 — the five follow-ups

### General Retail invoice (was: cosmetic, turned out not to be)

General Retail's invoice pointed at `electronics-invoice-a4`. The *provisioned
document* was fine — blocks come from `templateType`, not `presetId` — but the
fixture behind that preset carries serial numbers, IMEIs and warranty terms, so
the gallery and preview showed a gift shop an invoice full of columns it can
never populate.

Added a real `retailInvoice` fixture and a `retail-invoice-a4` preset. A test
now fails if any vertical borrows a preset named for another, unless the reuse
is justified in an explicit allowlist.

### Templates now provision at three moments

| When | Where |
|---|---|
| Signup | `signupService.js`, after commit, in its own try/catch |
| Business type change | `industry.routes.js` |
| Duty-free change | `retailProfile.routes.js`, and the UI reports what appeared |

All additive — `replace: true` deletes customised templates and is asserted
absent from every one of these call sites.

### Sequential numbering

`sales.document_number` + `document_sequences` keyed
`(tenant, store, doc_type, period)`, allocated with `SELECT … FOR UPDATE` **on
the connection running the sale transaction**. A rolled-back sale returns its
number; no gap appears.

Opting in is asymmetric on purpose: where the jurisdiction requires sequential
numbering it is ON and the store **cannot** turn it off. A tenant checkbox that
could disable a legal obligation is a compliance hazard dressed up as a
preference.

Where numbering is mandatory and allocation fails, the sale is **refused** — an
unnumbered invoice is not a valid document, and recording the sale anyway
produces paperwork that fails an audit.

### Demo sales history

Twelve sales across the five verticals. **A bug was caught by re-deriving the
figures independently of the generator that wrote them:** `tax_per_unit` was
stored at 2dp, so 5 × bananas (3.99 @ 15% = 0.5985/unit) reconciled to 3.00
against a sale header of 2.99.

This is the concrete answer to the 2dp-vs-4dp question: **money is rounded once,
at the line, to 2dp. Per-unit intermediates are held at the full 4dp the column
provides.** Rounding per unit and multiplying is how a receipt stops matching
its own total.

### Tax enforcement — a money bug fixed before enabling it

`verifySaleTax` was already wired into the sale path in `warn` mode. But
`enforce` mode **substituted the server's tax figure**, and the controller
recomputes `total` from it — so a mismatched sale would have been recorded with
a total different from what the customer was actually charged. Books and card
terminal disagree, silently.

Enforce now **rejects** (HTTP 409) instead, handing the decision back to the
till, which can re-price and re-tender against a number the customer can be
shown. `tax` is never returned as anything other than the charged value.

`warn` remains the default, and a test asserts it — defaulting to enforce would
let a tax misconfiguration stop a shop trading.

---

## 7b. Rev 4 — receipt numbering

### I was wrong about the symptom

I said receipts printed the sale UUID. They did not — **they printed no
identifier at all.** Only date, cashier and customer. A customer returning an
item had nothing to quote, and staff had to find the sale by time and amount.

### One helper, so print paths cannot disagree

`frontend/src/utils/documentReference.ts` resolves what a sale is called:

| Situation | Printed | Label |
|---|---|---|
| Sequential numbering on | `INV-2026-000417` | **Invoice No.** |
| Not on | `9F2C1A84` (from the UUID) | **Ref** |
| No id at all | nothing rendered | — |

The differing label is the point, not cosmetics. A slice of a UUID is not
ordered, not gapless and not issued by the seller — presenting it as an
"Invoice No." would be a false statement on a tax document. A test asserts the
fallback never carries an invoice label.

Returning `null` rather than an empty string matters too: a stray `Ref:` with
no value looks like a bug on a printed slip.

### Applied to

- **Sales receipt** — new number line, weighted slightly heavier so it is
  findable at a glance on a 58mm slip
- **Return slip** — "Orig. Receipt" was usually blank because
  `original_receipt_number` is rarely populated. It now falls back to the
  original sale's issued number, then to its short reference. The backend
  fetches `sales.document_number` for the original sale with a keyed lookup
  rather than a join, since `sales_returns` and `sales` were on different
  collations until 2026-08-25.
- **Template renderer** — the number is now labelled rather than sitting bare
  between the title and the date, and `documentNumber` takes precedence over
  the fixture fields.

### What this does NOT fix

`buildPrintableHtml` is still called only by the template **designer**. Real
sales print through `receiptService`, and **no sale-to-template data mapper
exists**. The print template module is a designer today, not a printing
pipeline. That mapper is the next substantial piece of work, and it is bigger
than it sounds — every block accessor has to be fed from a real sale.

---

## 7c. Rev 5 — number visibility, and the sale-to-template mapper

### Issuing a number and printing it are separate decisions

Conflating them would be wrong in both directions. A shop can want gapless
numbering for its books without cluttering a 58mm slip; a wholesaler needs the
number on the page regardless of how it was produced.

| | Setting | Default |
|---|---|---|
| Is a number **issued**? | `sequential_numbering_optin` | off, unless the jurisdiction requires it |
| Printed on a **till receipt**? | `show_number_on_receipt` | **off** — the barcode identifies the sale |
| Printed on an **A4/Letter invoice**? | `show_number_on_invoice` | **on** — wholesale settles against it |

Paper size decides which rule applies, not template type. A jewellery invoice
printed to 80mm is being used as a slip; an A4 "receipt" is being used as a page.

Both are tenant-overridable in `/settings?tab=general`. The override must be
able to switch a number **off** as well as on — a control that can only add
would appear to save and silently do nothing. A test covers that direction
specifically, because it is the one a `a || b` implementation gets wrong.

### A receipt always carries an identifier

Hiding the number text is only safe because the QR is there instead. If QR
generation fails, the text comes back automatically regardless of the setting —
otherwise the slip would print with no way at all to identify the sale, which is
worse than the noise the setting exists to remove.

### The sale-to-template mapper

`frontend/src/utils/saleToPrintData.ts`. Until now the print module could render
fixtures beautifully and could not print a single real sale.

Two design rules, both load-bearing:

**It translates, it does not calculate.** Every monetary figure is copied from
the sale as recorded. If a sale's total disagrees with its lines, the document
prints the recorded total — "fixing" it on paper hides a real discrepancy and
produces a receipt that does not match the books. A test feeds it a deliberately
inconsistent sale and asserts the recorded figure survives.

**Absent data stays absent.** Missing fields pass through as `undefined`, never
as zero. Blocks self-suppress on undefined — that is what keeps a grocery
receipt from printing an empty "Serial" column — and a substituted zero defeats
it silently. Zero tax and *absent* tax are different claims; only the first says
the sale was zero-rated.

Unknown item keys are carried through untouched, so serial numbers, IMEIs,
weights, PLUs and size/colour reach their column accessors without this mapper
knowing about any vertical. Adding a vertical should not mean editing it.

---

## 7d. Rev 6 — templates now print real sales

### Opt-in, not a switchover

`printer_settings.use_print_templates`, **off by default**, exposed in Settings →
Printers as "Use my print templates".

Receipts are the most customer-visible artefact the product makes. Flipping
every existing store onto a new renderer on deploy day would change their
receipts with no warning and no way back. Opt-in also means a shop can be put
back on the known-good path by clearing one flag, with no deploy — which matters
because thermal printers are where rendering assumptions go to die.

### Fallback is the design, not padding

`renderSaleWithTemplate` returns **null** rather than throwing in every failure
case, and the caller prints the built-in receipt:

| Failure | Result |
|---|---|
| No published template | built-in receipt |
| Only an unpublished draft | built-in receipt |
| Template has no blocks | built-in receipt |
| Template API unreachable | built-in receipt |
| Rendering throws | built-in receipt |

A cashier has a customer at the counter. A slightly-wrong receipt is
recoverable; no receipt is not.

**A bug the tests caught:** the catch block itself threw, because `logger` was
imported as a default export when it is a named one. The fallback guarantee was
worthless in exactly the situation it existed for. Found by the "never throws,
whatever it is given" case.

### Returns and credit notes

`returnToPrintData` maps a sales return, carrying the original sale's reference
so a refund can be tied to what it reverses — resolved through the same helper
the original receipt used, so the two documents always show the same reference.

**Amounts are positive.** The direction is carried by the title. "-2,572.50"
under a heading that already says REFUND reads as a double negative, and is
genuinely ambiguous when the slip is keyed into an accounts package by hand.

A return prefers a dedicated `return` template and falls back to the `receipt`
shape — a refund slip is shaped like a receipt, and dropping to the legacy path
just because nobody designed a return layout would be needlessly worse.

**Two bugs found while wiring that up.** Borrowing a receipt template gave the
refund the title `SALES RECEIPT` (baked into the block config) and hid the
return number (receipt `headerFields` deliberately omits it). A credit note that
calls itself a sales receipt and carries no reference is worse than no template
at all. Fixed with `forceDocumentTitle` / `forceDocumentNumber`, which only
returns set — a test asserts sales never do, since that would silently undo both
the template's chosen title and the tenant's number-visibility setting.

---

## 7e. Rev 7 — the leftovers

### A dedicated return template

`DEFAULT_BLOCKS.return` — receipt-shaped, because a refund slip is a slip handed
across a counter, but with the differences that matter: the number **is** shown
(a credit note nobody can reference is unusable), the original sale's reference
is printed, a signature line is included (a refund moves money out of the till),
and there is no loyalty, savings or return-policy block. "Exchange within 30
days" on a refund slip is actively confusing.

Provisioned for **every** vertical — everyone refunds, and adding it per-vertical
would be five copies of the same line with one eventually forgotten.

### Three bugs found doing it

**Invented block types render as silence.** The return template was first
written with `type: 'signature'` (the renderer handles `signatures`) and a
`contentSource` config that does not exist. The renderer's `default:` case
returns `''`, which is right at runtime — an unknown block should not crash a
receipt — but it means **a typo is invisible**. Both would have shipped as blank
space. A test now checks every type in `DEFAULT_BLOCKS` against the types the
renderer actually implements.

**`custom` blocks could not read data.** They supported only a literal `value`,
so "Original Sale: INV-…" was inexpressible — the refund slip had no way to name
what it reverses. Added `accessor` support, with rows that resolve to nothing
dropped rather than printed as a dangling label.

**`template_type` is a DB ENUM.** Provisioning a `return` template would have
failed with `Data truncated for column 'template_type'` — a message giving no
hint the cause is a missing enum member. Widened by
`2026-08-31_return_template_type.sql`. A test now reads the enum out of the
migrations and asserts every planned type is accepted, so this cannot recur.

### Two of my own assertions were weaker than they claimed

Caught by mutation testing, not by reading:

- "does not offer a return policy or loyalty points" asserted on rendered
  **text**. Those blocks self-suppress on absent data, so the assertion passed
  whether or not they were in the template — it proved only that the fixture was
  sparse. Now asserted on the **block list**.
- The empty-row check for `custom` blocks did not exist at all.

### Returns now print through templates

`getReceiptForReturn` uses `renderReturnWithTemplate` when the store has opted
in, with the same fall-through to the built-in slip. A refund is less forgiving
than a sale — the customer is being handed money and is owed a document for it.

---

## 8. Still open

| Item | Note |
|---|---|
| Sequential numbering UI | The engine and per-store opt-in exist; Settings has no control for `sequential_numbering_optin` / `sequence_reset` yet. |
| **Physical print QA** | The only remaining blocker, and it needs a person with a printer. Checklist: `10_Print_Hardware_QA_Checklist.md`. |
| ESC/POS direct printing | Everything above assumes browser printing. The direct-print path renders differently and needs its own pass. |
| `template_type` as VARCHAR | The ENUM needs a migration per document type and fails as "Data truncated" rather than anything readable. Deliberately not changed alongside shipping refunds. |
| Flip `TAX_VERIFICATION_MODE` to `enforce` | Safe to do now that enforce rejects rather than rewrites. Watch the mismatch logs first. |
| Tax profile `verified` flag | Seeded countries show "Verified"; self-configured show "Custom — review with your accountant". |
| Print counting | Replaces the reprint stamp. Needs `print_count` per document + a settings cap. |
| Provision-missing-templates UI | Belongs on the Print Templates page. |
| Physical print QA | 58mm / 80mm / A4 on real hardware. |
| Pharmacy review | Before enabling the vertical. |

---

## 9. Verification

Backend **188** · Frontend **458** · typecheck clean · production build green.

(One backend test is legitimately pending: the migration splitter only checks
*pending* migrations, and there are none — all have been applied.)

New removal regressions in `backend/tests/deadCodeRemoval.test.js` were
**mutation-tested**: each was re-broken and confirmed to fail.

| Reintroduced bug | Caught |
|---|---|
| `/duty-free-profiles` mounted again | ✔ |
| `stores.industry_code` sync dropped | ✔ |
| Demo-file filter removed from the runner | ✔ |
| A new `*_backup_*` file committed | ✔ |
| Non-empty guard stripped from the drop migration | ✔ |
| General Retail borrowing the electronics preset | ✔ |
| Signup provisioning removed | ✔ |
| Signup provisioning moved before commit | ✔ |
| Industry-change re-provisioning removed | ✔ |
| Duty-free provisioning removed | ✔ |
| Destructive `replace: true` introduced | ✔ |
| `FOR UPDATE` dropped from the sequence allocator | ✔ |
| Pool-not-connection guard removed | ✔ |
| Sale allocating on the pool instead of its transaction | ✔ |
| `document_number` no longer persisted | ✔ |
| Sequence numbers truncated to the padding width | ✔ |
| `tax_per_unit` reverted to 2dp | ✔ |
| A duty-free demo sale charged tax | ✔ |
| Demo sequence counter lagging the numbers issued | ✔ |
| A demo subtotal broken | ✔ |
| A duplicate demo document number | ✔ |
| Silent tax substitution restored | ✔ |
| Controller ignoring a tax rejection | ✔ |
| Default verification mode flipped to `enforce` | ✔ |
| Short reference labelled as an invoice number | ✔ |
| Sale id winning over the issued number | ✔ |
| Empty string treated as a real number | ✔ |
| Blank reference returned instead of null | ✔ |
| Short reference not upper-cased | ✔ |
| Total recomputed from the lines instead of copied | ✔ |
| Missing tax coerced to zero | ✔ |
| Derived line total overriding the recorded one | ✔ |
| Unknown vertical item fields dropped | ✔ |
| Visibility override unable to turn a number OFF | ✔ |
| Renderer ignoring the tenant setting | ✔ |
| Template errors propagating instead of falling back | ✔ |
| An unpublished draft being printed | ✔ |
| A blockless template rendering a blank page | ✔ |
| Refund keeping the borrowed "SALES RECEIPT" title | ✔ |
| Refund losing its return number | ✔ |
| Sales also forcing the title, undoing template choice | ✔ |
| Return amounts printed negative | ✔ |
| Return template using an unimplemented block type | ✔ |
| Custom block losing accessor support | ✔ |
| Custom block printing empty rows | ✔ |
| Refund slip regaining a return-policy block | ✔ |
| Refund slip losing its signature line | ✔ |
| Enum migration for the return type missing | ✔ |

**Applied:** every migration through `2026-08-28_demo_sales_history.demo.sql`
has been run against the live database.

**Pending:** `2026-08-31_return_template_type.sql` — widens the
`print_templates.template_type` enum. Until it runs, provisioning a refund
template fails with "Data truncated for column 'template_type'". This environment
has no MySQL and no network route to the database, so they are checked by the
project's own statement splitter but not run. The CI `schema` job executes them
against a clean MySQL 8 on push — treat that as the real gate, and take a backup
before running against your database.
