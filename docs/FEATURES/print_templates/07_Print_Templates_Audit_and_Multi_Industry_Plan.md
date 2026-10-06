# Print Templates — Deep Audit & Multi-Industry, Multi-Jurisdiction Plan

**Date:** 2026-08-23 (rev. 2 — country-agnostic + duty-free)
**Scope:** Receipt + Invoice templates, all verticals, all jurisdictions, all sales modes
**Verticals:** Jewelry & Bullion · General Retail · Grocery & Supermarket · Electronics · Apparel & Fashion · Pharmacy

---

## 1. Executive Summary

The template engine (blocks, canvas, renderer, versioning) is architecturally sound.
The **content layer is not** — it is jewelry-shaped, US-tax-shaped, and domestic-sale-shaped.

Three corrections drive this revision:

1. **The app is not country-specific.** Tax is not "sales tax" — it is VAT, GST, HST,
   ABST, consumption tax, or none, with different mandatory invoice fields, different
   mandatory header wording, and in ~30 countries a mandatory **fiscal signature and QR
   code** on every receipt.
2. **Duty-free is a first-class sales mode**, not a niche. Diamond Republic itself is a
   duty-free jeweller in Antigua. Duty-free carries its own document requirements
   (passport, boarding pass, export declaration).
3. **Duty-free and jurisdiction are cross-cutting**, not verticals. A duty-free
   electronics shop in Dubai and a duty-free jeweller in Antigua share export
   requirements but differ entirely in item-table shape.

### The correct model — three independent axes

```
  Vertical            ×   Jurisdiction Profile   ×   Sales Mode
  ─────────────           ────────────────────       ──────────────
  Jewelry                 Tax regime (VAT/GST/…)     Domestic
  General Retail          Mandatory header text      Duty-free / export
  Grocery                 Fiscalization rules        Tax-refund (VAT reclaim)
  Electronics             Numbering rules            B2B reverse-charge
  Apparel                 Rounding / currency
  Pharmacy
```

A template = **vertical blocks** + **jurisdiction blocks** + **mode blocks**.
Today we model only the first axis, and only for jewelry.

---

## 2. Current State

### 2.1 Block palette (19 types)

| Category | Blocks |
|---|---|
| Identity & Branding | `logo` · `text` · `header` |
| Customer Info | `customer` · `address` |
| Items & Products | `table` · `attributes` · `purity` · `gemstones` |
| Totals & Payment | `tax` · `totals` · `payment` · `price` |
| Terms & Compliance | `terms` · `compliance` |
| General | `barcode` · `signatures` · `footer` · `custom` |

### 2.2 Default templates

Four types: `receipt` · `invoice` · `jewelry_invoice` · `label`.

**Critical:** every default block is bare —

```js
{ id: 'store_logo', type: 'logo', visible: true, order: 1 }
```

No `config` at all. Every configuration surface we built starts empty on every new
template.

### 2.3 Fixtures

Six fixtures, **all jewelry**, all `ZETTAZ JEWELRY`, all domestic-sale shaped. No
duty-free fixture despite duty-free being a core use case, and no fixture exercises
VAT/GST, reverse charge, or fiscal fields.

---

## 3. Bugs & Dangling Features

| # | Issue | Status |
|---|---|---|
| 1 | `barcodeSource` existed in the properties panel but **neither renderer read it** — every barcode encoded the receipt number regardless of choice. | **Fixed** — `resolveBarcodeValue()` wired into canvas + print renderer. |
| 2 | Logo layout presets rendered on canvas but **ignored by print renderer**. | **Fixed** |
| 3 | `Cashier:` inconsistent between canvas and print. | **Fixed** — both `Emp:`. |
| 4 | Table has no per-line tax flag → cannot meet split-tax display requirements. | **Open** |
| 5 | `tax` and `totals` **print blocks** assume a single flat rate — no multi-rate, no reverse charge, no exempt class. | **Open.** ⚠️ See correction below — the *backend* is richer than the blocks. |
| 6 | Document numbering is not guaranteed sequential/gapless — an EU invoicing requirement. | **Open — backend concern.** |

> **Correction (rev. 3, from `08_Application_Wide_Audit.md`):**
> `backend/services/taxCalculationService.js` **already implements** tax classes,
> multiple rates per class, **compound tax** (`is_compound`), prices-include-tax
> handling, and `generateTaxSummary()`. The gap is in the *print blocks only*.
> The `taxSummary` block must **consume the existing `generateTaxSummary()` output
> shape** rather than define a parallel tax model. This shrinks Phase 2 considerably.
> Genuinely missing from the backend: reverse-charge mode, zero-rated/export class,
> and the jurisdiction profile itself.

---

## 4. Research — Jurisdiction Axis

### 4.1 Tax invoice mandatory fields vary by country

Missing fields block the buyer's input-tax credit, so this is not cosmetic. Concretely:

- **Australia** requires the literal words **"Tax Invoice"** as a mandatory header.
- **EU** requires VAT numbers, **sequential numbering**, and reverse-charge handling
  for cross-border B2B.
- **Canada** requires the tax breakdown to separate **GST (5%) vs HST (13–15%)**
  depending on the **place of supply** (province).
- **Reverse charge** (available in **165+ VAT/GST countries**) requires the invoice to
  carry explicit wording such as *"Reverse charge: customer to account for VAT"*, show
  the customer's VAT number, and indicate which line items fall under the scheme. For
  B2B services the place of supply is generally where the customer is established.

**Implication:** `header` needs configurable mandatory title text. `tax` needs
multi-rate, exempt-class, and reverse-charge modes. `customer` needs a VAT/GST number
field that is mandatory in some profiles.

### 4.2 Fiscalization — mandatory in ~30 countries

Fiscalization secures POS transaction data with a **digital signature** to prevent tax
fraud through manipulation. Where it applies, every receipt from a compliant register
must carry a **QR code encoding the signature and essential transaction data** in
machine-readable form.

| Country | Requirement |
|---|---|
| **Austria** | *Signaturpflicht* (§131b BAO) — receipts digitally signed via a secure signature creation device so alterations are detectable |
| **Portugal** | Software certified by the AT; every invoice carries a **QR code and ATCUD identifier**; monthly SAF-T (PT) reporting |
| **Germany** | DsFinV-K — every business-relevant transaction signed and stored; defined receipt elements, payment types, export formats |
| **Bulgaria** | Receipts carry a **USN number and QR code**; fiscal printers transmit XML every 5 minutes |
| **Belgium** | HoReCa sector; fiscalized register required above EUR 25,000 on-premise sales |

Portugal led in 2022 by mandating QR codes on all B2B and B2C invoices; tax
authorities worldwide are following to combat fraud and streamline audits.

**Implication:** a `fiscal` block is required — fiscal signature, fiscal QR, fiscal
document number/ATCUD, certified software ID, fiscal device serial. It must be
**profile-gated** so tenants in non-fiscalized countries never see it.

---

## 5. Research — Duty-Free & Export Sales Mode

### 5.1 Duty-free purchase requirements

Travellers must present a **valid boarding pass and passport** at the time of purchase,
and the **passport name must match the purchaser**. Goods are sold to departing
travellers or those crossing into another territory, are **for export**, and must be
taken out of the country of purchase.

For liquids, aerosols and gels, goods must be packed in a **transparent sealed bag
(STEB) that includes the original receipt**.

Critically for our design: a valid proof of sale is the final receipt **not marked as
duplicate, reprint, or internal store copy**, and the **surname on the receipt must
match the passport**.

> ⚠️ **Design conflict identified.** My earlier plan proposed a `reprintNotice` block
> stamping "DUPLICATE" on reprints. That is correct for apparel/retail fraud control
> but **invalidates a duty-free receipt for refund purposes**. The block must be
> mode-aware: in duty-free mode a reprint must either be suppressed or clearly routed
> through a re-issue process, not silently stamped.

### 5.2 Tax-free shopping / VAT refund

Distinct from duty-free — the traveller pays tax and reclaims it on export.

**Customer-side fields** (UK VAT407 as the reference model): full name, permanent
address outside the country/EU, passport or identity number, issuing country, bank or
card account for refund, **date of arrival**, **date of planned departure**, signature
and date.

**Retailer-side obligations:** provide a full and accurate **description of goods,
price, administration charge and refund due**, sign and date the form, and **mark the
till receipt to show the goods were included on a VAT refund form**.

**Export validation:** before departure the traveller shows customs the passport,
goods and documentation; customs **stamps the form** to validate export. Stamped
documents then go to the refund operator.

**Implication:** two blocks — `dutyFree` (passport, flight, destination, export
declaration) and `taxRefund` (refund form reference, admin charge, refund due, the
required till-receipt marking).

---

## 6. Research — Vertical Axis

### 6.1 Jewelry & Bullion

Where hallmarking applies, the invoice must separately itemise the description of each
article, **net weight** of precious metal, **purity in carat and fineness**, and
**hallmarking charges** — which are levied **per article regardless of weight**, so
they are a distinct line from making charges and wastage. Since July 2021 the hallmark
comprises BIS logo, purity/fineness, and a six-digit alphanumeric **HUID**. Gold value,
making charges and tax each appear as separate lines.

> **Jurisdiction note:** these are **India/BIS-specific**. Antigua has no equivalent
> mandate. Hallmark fields must be profile-gated, never hardcoded.

**Blocks:** `purity` · `attributes` · `gemstones` · `compliance` · `signatures` — ✅ exist
**Gap:** `hallmarkCharge` as a distinct line.

### 6.2 Grocery & Supermarket

Loose produce rings under **4- or 5-digit PLU codes** (organic = 5 digits starting
with 9) and the line must print **weight and price-per-unit** beside the line total.
Registers print a **taxable/exempt flag** per line because many jurisdictions exempt
basic groceries but tax prepared food and non-food items; the tax line covers only
flagged items. Coupon discounts print as **negative amounts directly beneath the item**
and total into a **"You Saved"** summary. Footers carry store, lane, cashier and
transaction numbers.

**Gap:** weighed-item rendering, per-line tax flag, `savings`, `loyalty`, multi-rate tax.

### 6.3 Pharmacy

The **NDC** appears on packaging, pharmacy receipts and insurance claims so a drug can
be identified in a recall; it has three segments — labeler, product (strength + dosage
form), package size. The **discard/expiration date** is a use-by date. Repackaged drugs
require drug name, strength and form, **beyond-use date**, NDC and **manufacturer lot
number**; records must name the pharmacist who repackaged and the one who verified.

> **Jurisdiction note:** NDC is **US-specific**. Other countries use DIN (Canada),
> PZN (Germany), EAN/GTIN, or national equivalents. The block must expose a generic
> **drug identifier** field whose label is profile-driven.

**Gap:** `rxDetails`, `batchExpiry`, pharmacist sign-off — none exist.

### 6.4 Electronics

Warranty claims require the **original receipt with matching serial numbers**; lookup
is by **IMEI or serial number**. RMA requests need serial number, invoice number,
purchase date and documented defect. Retailers may refuse returns or charge restocking
fees when goods are not in original condition or missing contents, and typically
require an **RMA number** for shipped returns.

**Gap:** `serialCapture`, `warranty`, `returnPolicy` — none exist.

### 6.5 Apparel & Fashion

Best practice: print a **barcode encoding the transaction number** so cashiers can scan
for exchange/return without manual lookup *(now working via the `barcodeSource` fix)*.
Print one original; label reprints **"Duplicate" or "Copy"**. **Gift receipts** omit
price, discount and payment while showing items, quantities, transaction number, store
details and return policy. Policy wording should make **exchange the default** and
refund the extra step.

**Gap:** `giftMode` price suppression, size/colour preset, `returnPolicy`.

### 6.6 General Retail

Baseline coverage exists — but with **no styled default**.

### 6.7 Thermal typography (cross-vertical)

80mm is the dominant countertop format at roughly **48 characters per line**. Keep to
**2–3 columns**, wrap descriptions, use borders sparingly, make **total and transaction
number stand out** via bold/larger type. Print at **203 DPI with 2–3 mm margins** to
avoid right-edge truncation.

Our `FONT_SCALE_PT` already models this. Defaults don't apply it.

---

## 7. Data Gap Analysis

| Field group | Axis | Present? |
|---|---|---|
| `taxProfile`, `taxLabel`, rate classes | Jurisdiction | ❌ |
| `fiscalSignature`, `fiscalQr`, `atcud`, `fiscalDeviceId` | Jurisdiction | ❌ |
| `customerVatNumber`, `reverseCharge` flag | Jurisdiction | ❌ |
| `passportNumber`, `flightNumber`, `destination`, `departureDate` | Duty-free | ⚠️ passport only |
| `refundFormRef`, `adminCharge`, `refundDue` | Tax-refund | ❌ |
| `plu`, `weight`, `pricePerUnit`, `taxFlag` | Grocery | ❌ |
| `savingsTotal`, `couponLines` | Grocery/Retail | ❌ |
| `loyaltyPointsEarned`, `loyaltyBalance` | Grocery/Retail | ❌ |
| `serialNumber`, `imei`, `warrantyMonths` | Electronics | ❌ |
| `rxNumber`, `prescriber`, `refillsRemaining` | Pharmacy | ❌ |
| `drugIdentifier` (NDC/DIN/PZN), `lotNumber`, `beyondUseDate` | Pharmacy | ❌ |
| `sku`, `size`, `color` | Apparel | ❌ |
| `laneNumber`, `transactionNumber` | Grocery/Retail | ❌ |
| `purity`, `huid`, `grossWeight`, `netWeight`, `makingCharge` | Jewelry | ✅ |
| `hallmarkCharge` | Jewelry | ❌ |

**15 of 16 field groups missing.** Fixtures need a rebuild across all three axes.

---

## 8. Proposed Block Additions

### Jurisdiction axis (new — highest priority)

| Block | Purpose | Gated by |
|---|---|---|
| `fiscal` | Fiscal signature, fiscal QR, ATCUD/USN, certified software ID, device serial | Fiscalized jurisdictions |
| `taxSummary` | Multi-rate table, exempt classes, reverse-charge mode, configurable label (VAT/GST/HST/ABST/Sales Tax) | All |

### Sales-mode axis (new)

| Block | Purpose | Gated by |
|---|---|---|
| `dutyFree` | Passport #, name-match attestation, flight/boarding pass, destination, departure date, export declaration | Duty-free mode |
| `taxRefund` | Refund form reference, goods description, admin charge, refund due, till-receipt marking | Tax-refund mode |

### Vertical axis (new)

| Block | Purpose | Vertical |
|---|---|---|
| `serialCapture` | Serial / IMEI per line | Electronics |
| `warranty` | Term, expiry, claim instructions | Electronics |
| `rxDetails` | Rx #, prescriber, refills | Pharmacy |
| `batchExpiry` | Drug identifier, lot, expiry / beyond-use date | Pharmacy, Grocery |
| `savings` | "You Saved" + coupon breakdown | Grocery, Retail, Apparel |
| `loyalty` | Points earned, balance, tier | Grocery, Retail, Apparel |
| `changeDue` | Tendered / change | Grocery, Retail |
| `returnPolicy` | Structured return window + RMA terms | Electronics, Apparel, Retail |
| `reprintNotice` | Duplicate marking — **mode-aware, suppressed in duty-free** | All except duty-free |

### Table presets — extend beyond today's four

| Preset | Columns |
|---|---|
| Grocery | Item · PLU · Qty/Weight · Rate · Tax Flag · Amount |
| Pharmacy | Drug · Strength · Qty · Days Supply · Drug ID · Amount |
| Electronics | Item · Model · Serial/IMEI · Qty · Price · Amount |
| Apparel | Item · SKU · Size · Colour · Qty · Price · Amount |
| Duty-free | Item · Qty · Unit Price (tax-free) · Amount |
| Jewelry *(exists)* | Item · Purity · Net Wt · Gross Wt · Making · Amount |

Plus config toggles: `tableTaxFlagColumn`, `weighedItemMode`
(renders `1.24 kg @ $3.99/kg` as a sub-line), `giftMode` (price suppression).

---

## 9. Jurisdiction Profile — Proposed Schema

A single tenant-level profile drives all jurisdiction behaviour. Nothing hardcoded.

```jsonc
{
  "countryCode": "AG",
  "taxLabel": "ABST",              // VAT | GST | HST | ABST | Sales Tax | Consumption Tax
  "taxRates": [
    { "code": "standard", "label": "ABST 15%", "rate": 15 },
    { "code": "exempt",   "label": "Exempt",    "rate": 0 }
  ],
  "mandatoryInvoiceTitle": null,   // e.g. "TAX INVOICE" for AU
  "requiresCustomerTaxId": false,  // true across most of the EU for B2B
  "supportsReverseCharge": false,
  "reverseChargeText": "Reverse charge: customer to account for VAT",
  "fiscalization": {
    "enabled": false,              // true → render `fiscal` block
    "scheme": null,                // "AT" | "PT_ATCUD" | "DE_DSFINV_K" | "BG_USN" | …
    "requiresQr": false
  },
  "numbering": { "sequential": true, "gapless": true, "prefix": "INV-" },
  "hallmarkRegime": null,          // "BIS_IN" | null
  "drugIdentifierLabel": "NDC"     // "NDC" | "DIN" | "PZN" | "GTIN"
}
```

Diamond Republic (Antigua) resolves to: ABST label, 15% standard, no fiscalization,
no hallmark regime, duty-free mode enabled.

---

## 10. Proposed Template Presets

Presets are composed, not enumerated — vertical base + jurisdiction overlay + mode
overlay. Shipping set:

| # | Preset | Vertical | Mode |
|---|---|---|---|
| 1 | Grocery Receipt (80mm) | Grocery | Domestic |
| 2 | Pharmacy Receipt (80mm) | Pharmacy | Domestic |
| 3 | Electronics Invoice (A4) | Electronics | Domestic |
| 4 | Apparel Receipt (80mm) | Apparel | Domestic |
| 5 | Apparel Gift Receipt (80mm) | Apparel | Domestic + `giftMode` |
| 6 | General Retail Receipt (80mm) | Retail | Domestic |
| 7 | Jewelry Invoice (A4) | Jewelry | Domestic |
| 8 | **Duty-Free Jewelry Invoice (A4)** | Jewelry | Duty-free |
| 9 | **Duty-Free Retail Receipt (80mm)** | Retail | Duty-free |
| 10 | **Duty-Free Electronics Invoice (A4)** | Electronics | Duty-free |
| 11 | **VAT-Refund Invoice (A4)** | Any | Tax-refund |
| 12 | **B2B Reverse-Charge Invoice (A4)** | Any | Reverse-charge |

### Example — Duty-Free Jewelry Invoice (A4)

| # | Block | Key config |
|---|---|---|
| 1 | `logo` | `logoLayout: logo_name_contact`, left |
| 2 | `header` | title from profile (default `TAX INVOICE`), doc# + date |
| 3 | `dutyFree` | passport #, flight, destination, departure date |
| 4 | `customer` | name + passport + country (name-match attestation) |
| 5 | `table` | preset `jewelry`, tax-free unit pricing |
| 6 | `purity` | gross/net/purity/making *(+ hallmark if profile set)* |
| 7 | `gemstones` | stone detail |
| 8 | `taxSummary` | zero-rated export, exempt class |
| 9 | `totals` | `fontSize: xl`, bold |
| 10 | `payment` | method + reference |
| 11 | `compliance` | export declaration — goods must leave the territory |
| 12 | `barcode` | `barcodeSource: invoiceNo` |
| 13 | `signatures` | customer + authorised |

*Note:* `reprintNotice` is **deliberately absent** — a duplicate-marked receipt is
invalid as duty-free proof of sale.

### Example — Grocery Receipt (80mm)

logo (`name_contact`, centre) → header → table (`grocery` preset, taxFlag on,
weighedItemMode on, compact) → `savings` (bold) → `taxSummary` (multi-rate split) →
`totals` (lg, bold) → `payment` + `changeDue` → `loyalty` → `barcode` (receiptNo) →
`fiscal` *(if profile enabled)* → footer (lane #, txn #, store #).

---

## 11. Implementation Plan

> **Prerequisite — Sprint 0 of `08_Application_Wide_Audit.md` must land first.**
> Two P0 items block this work: (a) a cross-tenant auth hole in `purchaseOrderRoutes`,
> and (b) **no baseline schema migration** — a fresh DB cannot be built from
> `database/migrations/`, which means Phase 8's golden-file tests have nowhere to run.

### Phase 0 — Jurisdiction foundation *(shared, not print-local — merge with audit Sprint 1)*
1. Add `jurisdiction_profile` JSON to tenant/store settings with the §9 schema.
   **Owned by the tenant/tax layer**, consumed by print — tax calculation and invoice
   numbering read the same profile.
2. Resolver service: `getJurisdictionProfile(tenantId, storeId)`.
3. Seed profiles for our known markets (start: Antigua/ABST, US, EU-generic, India, UAE).
4. Extend `taxCalculationService` with reverse-charge mode and a zero-rated/export class.

### Phase 1 — Foundation ✅ COMPLETE
4. ~~Add `config` to all existing `DEFAULT_BLOCKS`~~ — **done.** All 6 template
   types (46 blocks) now ship fully configured: centred identity on thermal /
   left on A4, bold enlarged totals, transaction barcode on receipts, SKU barcode
   on labels, vertical-appropriate table columns, per-block spacing.
5. ~~Rebuild `printFixtures.js`~~ — **done.** 19 fixtures across 6 verticals with
   the fields each actually needs: grocery PLU/weight/tax-flags/savings, pharmacy
   Rx/drug-ID/lot/beyond-use-date, electronics serial/IMEI/warranty/RMA, apparel
   SKU/size/colour, jewelry purity/weights/making, plus duty-free variants and a
   price-suppressed gift receipt.
6. Add `industry` + `sales_mode` to `print_templates` for preset filtering. *(deferred to Phase 7)*

**Jurisdiction neutrality is enforced by test**: defaults contain no currency
symbol, no tax label, no hardcoded invoice title, and no hallmark text — all of
which now come from the jurisdiction profile at render time.

**Coverage:** `printDefaults.test.js` (44 assertions) +
`printPhase1.integration.test.ts` (8 render checks against real fixtures).

### Phase 2 — Tax correctness ✅ COMPLETE
7. ~~`taxSummary` block~~ — **done.** `utils/taxSummaryModel.ts` normalises three
   input shapes (backend `generateTaxSummary` in snake_ or camelCase, the flat
   fixture breakdown, and a single legacy tax figure) and performs **no tax
   arithmetic** — the backend remains the only tax engine. Renders multi-rate,
   exempt classes, compound tax (labelled so tax-on-tax is visible), and states
   *why* a sale is zero-rated. Four config toggles: taxable amount, exempt lines,
   combined total, reverse-charge notice.
8. ~~`header` mandatory-title support~~ — **done.** `mandatoryInvoiceTitle`
   overrides the user's title, so a template cannot accidentally produce a
   non-compliant document in AU/IN/AE.
9. ~~`customer` tax number~~ — **done.** Shown when
   `requiresCustomerTaxId` is set even if the template did not tick the field
   (omitting it invalidates the buyer's input-tax credit), and labelled per
   jurisdiction — "VAT No." / "GSTIN" / "ABN" / "TRN".
10. Verify backend document numbering is sequential and gapless. *(carried forward)*

**Also:** `totals` now uses the jurisdiction tax wording and omits a meaningless
"Tax 0.00" row on zero-rated sales. New `reverse_charge` fixture (EU/Dutch B2B)
exercises a jurisdiction whose tax label, tax-ID label and currency all differ
from the Antigua baseline.

**Coverage:** `taxSummaryModel.test.ts` (19) + Phase 2 integration tests (11),
all mutation-verified — hardcoding the tax label, ignoring the mandatory title,
or dropping the required customer tax ID each make the suite fail.

### Phase 3 — Duty-free & export mode ✅ COMPLETE
11. ~~`dutyFree` + `taxRefund` blocks~~ — **done.** `dutyFree` prints passport
    (with issuing country), flight, destination, departure and the export
    declaration. `taxRefund` covers the *other* traveller scheme — where tax IS
    charged and reclaimed on export — stating scheme, form reference, admin
    charge, refund due, and the customs-validation requirement.
12. ~~`giftMode` price suppression~~ — **done.** Hides every monetary block and
    strips price columns from the items table, including jewelry-specific ones
    (`makingCharge`, `ratePerGram`) that reveal price just as directly.
13. ~~Mode-aware `reprintNotice`~~ — **done.** Automatically suppressed on
    duty-free and export documents, and **not overridable by template config**.

**Both suppression rules live in one shared module** (`utils/salesModeRules.ts`)
because the canvas and print renderer are separate implementations that have
drifted before — a rule that only holds on screen is worthless when the document
that matters is on paper.

**Why these are not styling decisions**
- A duty-free receipt stamped "DUPLICATE" is not valid proof of sale at customs.
  Stamping reprints is correct fraud control for ordinary retail and *destroys*
  the traveller's ability to evidence the export.
- A gift receipt that leaks the total defeats its only purpose.

Note `reverse_charge` is deliberately **not** treated as an export supply — it is
also zero-rated, but it is a B2B liability shift, so a reprint stamp is fine.

**Coverage:** `salesModeRules.test.ts` (35) + Phase 3 integration tests (14).
Mutation-verified: removing the duty-free suppression fails 5 tests, removing
gift-mode suppression fails 7.

**Bug caught by these tests:** wiring suppression into the renderer introduced a
temporal-dead-zone error (`data` used one line before its declaration). It
typechecked clean — TypeScript did not catch it. Every render test failed, which
is exactly what should happen.

### Phase 4 — Table intelligence ✅ COMPLETE
14. ~~Five new presets + `tableTaxFlagColumn` + `weighedItemMode`~~ — **done.**
    Ten presets total (general, grocery, pharmacy, electronics, apparel, jewelry,
    duty-free, service, restaurant, custom), all in a shared model
    (`utils/itemTableModel.ts`) consumed by both renderers.
15. ~~New accessors~~ — **done.** ~40 accessors grouped by vertical in the column
    picker; a flat list that long is unusable. A test asserts every accessor used
    by a shipped preset is actually offered in the UI.

**Weighed items** now print the conventional sub-line beneath the item:

```
Bananas                    4011              4.95  N
  1.24 kg @ $3.99/kg
```

Without it a grocery receipt is unverifiable — the customer cannot check the
scale against the price charged. The sub-line appears only when weight **and**
rate are both present, so it is harmless on packaged goods, and is suppressed in
gift mode where the rate would reveal price.

**Tax flags** mark each line taxable/exempt with a decoding legend. The column is
dropped automatically when the data carries no flags — printing a column of
dashes reads as a fault rather than a design choice. The legend is omitted when
only one flag is present, since a uniform marker explains nothing.

**Weight units** now come from the item (`g / oz / tola / baht / kg`) rather than
being hardcoded to grams. A jewellery weight printed in the wrong unit is a
commercially significant error, not a formatting nit.

**Layout constraint respected:** thermal presets are capped at five columns. An
80mm roll is ~48 characters wide, which is why grocery moves weight to a sub-line
rather than adding two more columns.

**Coverage:** `itemTableModel.test.ts` (36) + Phase 4 integration tests (18).
Mutation-verified: killing the weighed sub-line fails 5 tests, appending the tax
column unconditionally fails 1, hardcoding grams fails 1.

### Phase 5 — Vertical blocks ✅ COMPLETE
16. ~~Commercial: `savings` · `loyalty` · `changeDue` · `returnPolicy`~~ — **done.**
17. ~~Compliance: `rxDetails` · `batchExpiry` · `serialCapture` · `warranty`~~ — **done.**

All eight share `utils/verticalBlockModel.ts`, so canvas and print cannot diverge.

**The governing property: every block prints nothing when its data is absent.**
Templates are shared across verticals, so a pharmacy block on a grocery receipt
must disappear rather than print an empty heading. Asserted for all 8 blocks
against all 6 vertical fixtures (48 combinations), plus an empty document.

**Decisions that carry real-world weight**

| Behaviour | Why |
|---|---|
| Zero refills is **shown and emphasised** | "0 remaining" tells the patient to contact their prescriber. An absent line is ambiguous. |
| **Beyond-use date wins** over manufacturer expiry | It is the date after which a repackaged medicine must be discarded — the one the patient acts on. |
| Drug identifier label is **jurisdiction data** | NDC is US-only; Canada uses DIN, Germany PZN. |
| `changeDue` is **cash-only** | Card sales have no tender or change; "Change 0.00" is noise. |
| Rounding shown as **its own line** | Where small coins are withdrawn (AU/CA), the adjustment must be visible, not silently fold into the total. |
| `serialCapture` exists at all | A warranty claim requires the original receipt with **matching** serial numbers. |

**Coverage:** `verticalBlockModel.test.ts` (37) + Phase 5 integration tests (34).

**Bug found by the tests:** the three array-based builders threw a `TypeError`
on a non-array `items` — a malformed or partial API response would have crashed
the print job. Now guarded centrally by `itemsOf()`.

**Weak test found and fixed:** the `changeDue` "card sale" assertion originally
passed because the fixture had no `tendered` field, not because the cash check
worked — removing the check entirely left it green. Rewritten to pass a card
payment *with* tendered and change, so it now fails under that mutation.

### Phase 6 — Fiscalization ✅ COMPLETE *(rendering only — see gate below)*
18. ~~`fiscal` block + profile gating~~ — **done.** Renders signature, QR, ATCUD /
    USN, certified software ID and device serial. Gated on
    `fiscalizationEnabled`, so stores in non-fiscalized countries never see it.

**Signing remains a market-entry gate, not a coding task.** The block deliberately
generates nothing: certification attaches to the signing component, so a
home-grown implementation is non-compliant however correct the cryptography is,
and signing keys must never reach a browser. A certified vendor (fiskaly or
equivalent) is required before selling into AT, PT, DE, BG, IT, GR, HR, PL or
much of LatAm.

**Fails loudly, not quietly:** where a jurisdiction mandates a signature and none
arrives, the receipt prints `FISCAL SIGNATURE MISSING — this document is not
compliant`. Silence would let a non-compliant receipt reach a customer unnoticed
until an audit.

### Phase 7 — Presets & polish ✅ COMPLETE
19. ~~Ship the presets~~ — **done.** Twelve presets across all six verticals and
    all four sales modes (domestic, duty-free, tax-refund, B2B reverse-charge).
20. ~~Preset gallery~~ — **done.** `NewTemplateDialog` rebuilt with three modes
    (preset / blank / duplicate), searchable gallery grouped by vertical, and
    per-preset highlights showing what each gives over a blank template.
    Jurisdiction is *not* an axis — it resolves per store at render time, so one
    preset works in any country.

### Phase 8 — Verification ✅ COMPLETE
21. ~~Golden-file tests~~ — **done.** `printGolden.test.ts` renders every preset
    against its fixture and checks the failures that only surface on paper:
    unresolved placeholders, missing mandatory content per sales mode, and
    cross-vertical leakage. Plus resilience: every preset × every fixture,
    empty documents, and malformed payloads.
22. Physical print QA on 58mm, 80mm, A4. *(hardware task — carried forward)*

**A vacuous-test trap worth recording.** The first version of the leakage and
no-reprint assertions passed under mutation — because duty-free templates ship
no `reprintNotice` block and grocery templates ship no `rxDetails` block, so
neither suppression rule was ever exercised. The assertions proved nothing.
Both now add the foreign blocks **explicitly** before rendering. After the fix,
removing the duty-free suppression fails 2 tests and breaking Rx self-suppression
fails 11.

**Bug found by this suite:** `data.items` was read as `data.items || []` in three
places, which throws on a non-array. A malformed API response would have crashed
the print job. Guarded with `Array.isArray` throughout.

---

## Status

| Phase | State |
|---|---|
| 0 — Jurisdiction foundation | ✅ |
| 1 — Styled defaults + vertical fixtures | ✅ |
| 2 — Tax correctness | ✅ |
| 3 — Duty-free & export mode | ✅ |
| 4 — Table intelligence | ✅ |
| 5 — Vertical blocks | ✅ |
| 6 — Fiscalization *(rendering)* | ✅ |
| 7 — Presets & gallery | ✅ |
| 8 — Golden-file verification | ✅ |

**Test totals:** backend 117 · frontend 323 · TypeScript clean · build green.

**Carried forward**

| Item | Note |
|---|---|
| Certified fiscal signing vendor | Market-entry gate for ~30 countries. Do not build in-house. |
| Physical print QA | 58mm / 80mm / A4 on real hardware. |
| Gapless sequential numbering | Modelled in the jurisdiction profile, not yet enforced under concurrency. |
| Pharmacy review | Rx / lot / beyond-use blocks should be checked against each target market's board-of-pharmacy rules before go-live. |

---

## 12. Risk Register

| Risk | Severity | Note |
|---|---|---|
| **Fiscalization is a legal obligation, not a feature.** Selling into Austria, Portugal, Germany, Bulgaria, Italy, Greece, Croatia, Poland or much of LatAm without it is non-compliant. | **High** | Requires a certified signing vendor. Do not build the crypto in-house. Treat Phase 6 as a market-entry gate, not a nice-to-have. |
| **Duty-free reprint conflict.** A "DUPLICATE" stamp invalidates the receipt as proof of sale. | **High** | Already caught — `reprintNotice` must be mode-aware. |
| **Pharmacy is a regulated surface.** Drug identifier, lot, beyond-use date carry regulatory weight and rules vary by board of pharmacy. | **High** | Needs review by someone with pharmacy operations knowledge in each target market before go-live. |
| **Hallmarking is jurisdiction-specific.** BIS/HUID is India-only. | **Medium** | Profile-gate it. Never hardcode. |
| **Tax display assumptions.** The grocery exempt/taxable split is common in the US, not universal. | **Medium** | `taxSummary` must be entirely profile-driven. |
| **Sequential numbering.** EU requires gapless sequential invoice numbers. | **Medium** | Verify the backend guarantees this under concurrency. |
| **Currency and rounding.** Multi-currency duty-free shops display dual currency; rounding rules differ (e.g. Swiss 0.05 rounding). | **Low–Medium** | Extend `useLocaleFormat`. |

---

## Sources

**Duty-free & tax-free shopping**
- [Duty Free Americas — FAQs](https://dutyfreeamericas.com/faq-english)
- [Duty-Free Shopping Rules — ICICI Lombard](https://www.icicilombard.com/travel-insurance/travel-guide/blogs/duty-free-shopping-rules)
- [Duty-Free Shopping Rules and Regulations — Digit](https://www.godigit.com/international-travel-insurance/duty-free-shopping/rules-and-regulations-of-duty-free-shopping)
- [Requirements — TaxFree Shopping](https://taxfreeshopping.com/req/)
- [VAT: tax-free shopping retailer's checklist (VAT407 notes) — GOV.UK](https://gov.uk/government/publications/vat-tax-free-shopping-retailers-checklist-vat-407-notes/tax-free-shopping-retailers-checklist-vat407-notes)
- [What is Tax Free Shopping — PIE VAT](https://pievat.com/blog/what-is-tax-free-shopping-the-complete-guide-for-tourists)
- [What is Tax Free shopping and how does it work — Planet](https://www.weareplanet.com/blog/tax-free-shopping)
- [VAT Refund — Austrian Federal Ministry of Finance](https://bmf.gv.at/en/topics/customs/travellers/vat-refund.html)

**Fiscalization & tax invoicing**
- [Fiscalization and tax compliance in Europe — fiskaly](https://www.fiskaly.com/blog/fiscalization-and-tax-compliance-in-europe)
- [ATCUD, SAF-T and QES in Portugal — fiskaly](https://www.fiskaly.com/blog/fiscalization-atcud-qes-in-portugal)
- [Real-time reporting and fiscalization in Europe — DDD Invoices](https://dddinvoices.com/learn/real-time-reporting-europe)
- [Global Overview of Mandatory QR Codes on Invoices and Receipts — Bynn](https://www.bynn.com/resources/global-overview-of-mandatory-qr-codes-on-invoices-and-receipts)
- [Invoice Tax Compliance: VAT, GST & Sales Tax Requirements — InvoiceQuickly](https://invoicequickly.com/guides/invoice-tax-compliance)
- [The Reverse Charge Mechanism — Fonoa](https://www.fonoa.com/resources/blog/the-reverse-charge-mechanism-what-you-need-to-know)
- [EU VAT Reverse Charge — Avalara](https://www.avalara.com/us/en/vatlive/eu-vat-rules/eu-vat-returns/reverse-charge-on-eu-vat.html)

**Vertical requirements**
- [BIS Hallmarking FAQ — Bureau of Indian Standards](https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/hallmarking-faq/?lang=en)
- [BIS Hallmarking Explained: HUID, 916 Mark — GoldRate](https://goldrate.app/learn/bis-hallmarking-explained)
- [Expiration Dating and National Drug Code Rules — StatPearls / NCBI](https://www.ncbi.nlm.nih.gov/books/NBK570620/)
- [Pharmacy Auditing and Dispensing Self-Audit Checklist — CMS](https://www.cms.gov/sites/default/files/repo-new/44/Pharmacy%20Self-Audit%20Checklist.pdf)
- [Wisconsin Pharmacy Repackaging Rule Text — Wisconsin Legislature](https://docs.legis.wisconsin.gov/code/register/2020/779a3/register/cr/cr_19_145_rule_text/cr_19_145_rule_text/_67?up=1)
- [Kroger Receipt Template & Structure — Receipt Baker](https://receiptbaker.com/examples/kroger-receipt-example-template)
- [Returns and Warranty — Central Computer](https://www.centralcomputer.com/terms-and-conditions/return-warranty)
- [5 Invoice Fields Every Repair Shop Should Require — IMEI.info](https://www.imei.info/news/5-invoice-fields-every-repair-shop-should-require/)
- [Retail Receipt: Best Practices & Template — Retail Dogma](https://www.retaildogma.com/retail-receipt/)
- [Gift Receipt: Meaning & Use Case — Retail Dogma](https://www.retaildogma.com/gift-receipt/)
- [Return Policy Template for Clothing Stores — Size.ly](https://www.size.ly/blog/return-policy-template-clothing)

**Thermal print**
- [58mm, 80mm, and 112mm Thermal Receipt Paper — HPRT](https://www.hprt.com/blog/58mm-80mm-and-112mm-Thermal-Receipt-Paper-Which-Size-is-Right-for-You.html)
- [Thermal Printer Receipt Template Design Guide — Receipt Builders](https://receiptbuilders.com/print/thermal-printer-receipt-template/)
