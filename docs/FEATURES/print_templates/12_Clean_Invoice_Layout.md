# The Clean A4 Invoice Layout

**Date:** 2026-08-31

---

## What shipped

`invoice.clean` — a layout variant of the existing `invoice` type, offered as
the **Invoice — Clean** preset. Existing invoices are untouched; a store gets
this only by choosing it.

```
  ◐ Store Name                                          Invoice
                                             Invoice No. INV-…  ·  23/08/2026

  ┌ Bill to ─────────────┬ Ship to ────────┬ Details ──────────┐   ← tinted band
  │ name, address, tax   │ only if it      │ terms, due, PO    │      ship-to
  └──────────────────────┴ differs ────────┴───────────────────┘      conditional

  Item          Qty      Unit price          Amount              ← one rule, no grid
  ────────────────────────────────────────────────────
  …

                                     Subtotal / Tax / TOTAL
  ▣ QR                                                          ← customer scans

  ──────────────────────────────────────────────────────────
  Store · address            phone · email · Tax ID            ← repeats per page
```

---

## The four decisions, and why

### 1. Logo beside the name, contact moved to the footer

The header now carries two things at eye level — who you are, and what the
document is. The page reads faster for it.

The catch that came with it: most VAT/GST regimes require the seller's address
**and tax number** on an invoice. A footer satisfies that, provided the tax
number goes down there too — so it sits on the right beside the phone and
email, not trailing the address, because it is the line an accounts department
looks for.

### 2. A parties band, with ship-to conditional

Bill to / Ship to / Details side by side in one tinted group. **Ship to appears
only when a shipping address exists and differs from billing** — most retail has
no separate delivery address, and a column repeating the billing one is noise on
every counter sale.

Address comparison ignores case, punctuation and spacing. Two hand-typed fields
saying "22 Marylebone Lane, London" and "22 marylebone lane london" are the same
place, and showing a column because of a comma would defeat the rule.

`alwaysShowShipTo` exists for wholesale operations whose goods-in desk expects
the column regardless.

### 3. QR on the invoice — but Code 128 stays on the receipt

This document goes to a **customer**, who scans it with a phone. The thermal
receipt goes to a **cashier**, who scans it at the counter for returns — and
most retail 1D laser scanners cannot read QR at all. Switching both would have
broken the till on a lot of existing hardware.

The QR encodes the document number today. A public invoice URL can be swapped in
later without touching the layout — only the value changes.

### 4. A repeating page footer

`position: fixed` inside a paged context, so it lands on every page. A footer
left in normal flow appears once, after the last block — leaving page one of a
two-page invoice non-compliant on its own.

Paged sizes only. A thermal roll has no page boundaries, and pinning the footer
there would overlay it on the receipt body.

---

## How it avoids restyling anyone

A template type has one canonical block set in `DEFAULT_BLOCKS`. This is a
**layout variant** in a separate `TEMPLATE_LAYOUTS` map, named by a plan entry.

That separation is deliberate: `DEFAULT_BLOCKS` is the source of truth for which
template *types* exist — `validTemplateTypes()` reads its keys, and seven
registries are checked against it. Registering a new look as a type would mean
updating every one of them.

A store receives it as an **additional** document called "Invoice (Clean)". One
that has already customised its "Invoice" keeps it exactly as it is.

---

## A latent trap found on the way

`tablePreset` is set by six shipped templates. **The renderer never reads it.**

Choosing a preset in the properties panel writes *both* `tablePreset` (the
marker showing which is selected) and `fields` (the actual columns). The
renderer only consumes `fields`. So a block setting the preset alone looks
configured and silently falls back to columns inferred from the data shape —
which is how the clean invoice initially lost its line-amount column.

The `document` template had the same latent gap. Both fixed, and a test now
asserts that every table block naming a preset also declares its fields.

---

## Verification

Backend **200** · Frontend **577** · typecheck clean · build green.

Mutation-tested, six reintroduced bugs, all caught:

| Reintroduced | Caught |
|---|---|
| Ship-to always shown | ✔ |
| Ship-to never shown, even when it differs | ✔ |
| Tax number dropped from the footer | ✔ |
| Table preset without fields (drops the amount column) | ✔ |
| Footer no longer repeating per page | ✔ |
| QR downgraded back to a barcode | ✔ |

**One of my assertions escaped its mutation and was fixed.** The QR check tested
that the viewBox width was at least 21 — which a Code 128 barcode also satisfies,
since JsBarcode emits roughly 285×40. It now asserts the viewBox is **square**: a
QR is a module matrix and always is, a linear barcode never is.

Also verified in the running app rather than only in tests — both new blocks
added from the palette, rendered on the canvas, properties panel working, and
ship-to correctly hidden for a customer whose addresses match. The demo template
was left unsaved and reverted.

**Not verified:** none of this has met a printer. In particular the repeating
footer depends on how a given browser and driver handle fixed positioning in a
paged context, and that varies. It belongs in the hardware QA pass —
`10_Print_Hardware_QA_Checklist.md`, §3.4 (multi-page header/footer).
