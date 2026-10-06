# Live Verification — What Testing Against the Running App Found

**Date:** 2026-08-31

---

## Why this document exists

Three rounds in a row shipped with a defect that surfaced the moment the code
was actually run. The cause was method, not luck: work was verified against
unit tests written from the same assumptions as the code, and handed over
without ever exercising the real path.

This pass did the opposite — rendered through the live call stack, clicked the
real buttons in the browser, and inspected real API traffic. Everything below
was found that way, and **none of it would have been caught by the test suites
as they stood.**

---

## 1. Barcodes did not scan. Two compounding bugs.

The worst finding, because it silently undermined a design decision made
earlier: receipts hide the document number by default *because the barcode
identifies the sale*.

**`resolveBarcodeValue` never looked at `documentNumber`** — the field the sale
mapper actually produces. It consulted `receiptNumber`, `invoiceNumber` and
`barcode`, none of which the mapper emits. The value was an **empty string for
every real sale and every real refund**.

**The renderers drew a decorative SVG**, with bar widths derived from character
codes. It looks like a barcode and scans as nothing. That was acceptable while
`buildPrintableHtml` only fed the designer preview; it stopped being acceptable
the moment real sales printed through it.

**An empty value fell back to the literal `'0000000000'`**, so the slip printed
a barcode encoding a constant. A cashier scanning it finds nothing — or worse,
whatever sale happens to carry that reference.

Together: a receipt with no readable number and a barcode that scans to a
constant. **No usable identifier at all.**

Fixed with `barcodeModel.ts` — real Code 128 via JsBarcode, real QR via the
`qrcode` library already in the project. When there is nothing to encode it
returns `null` and the block prints **nothing**: a barcode scanning to the wrong
value is worse than none, because a cashier with no barcode looks the sale up by
hand while one scanning a bogus code refunds the wrong transaction.

The **fiscal QR** was decorative too. In fiscalized jurisdictions a tax
inspector scans that to verify the document against the authority's records, so
a pattern that cannot be scanned makes the receipt non-compliant while looking
correct.

---

## 2. Saving document numbering returned HTTP 500

Found by clicking Save in Settings and reloading.

The three numbering columns are `NOT NULL`. The write was a single upsert that
passed `NULL` for any field the caller had not supplied, so a PUT changing only
`sequentialNumbering` violated the constraint on the other two. MySQL validates
the INSERT row before reaching `ON DUPLICATE KEY`, so that branch never rescued
it.

Now only the supplied columns are written — which also keeps a partial update
partial, so changing one setting cannot reset the others to defaults.

---

## 3. A failed save reported success

`StoreContext.updateStore` caught the API error, wrote the new values into local
state, and **returned them as if the save had worked**. The screen showed
exactly what the user typed — store name, address, tax number — while the
database still held the old values. Nothing looked wrong until the next reload,
by which point the change had been "saved" days earlier and there was no reason
to doubt it.

Pre-existing, not introduced here. Optimistic local state is reasonable when the
caller is *told* the write failed; doing it silently converts a visible failure
into a wrong record.

---

## 4. Every printed document showed a raw ISO timestamp

`2026-08-23T13:20:00.000Z` where the date should be.

The mapper falls back to the raw value when given no formatter — deliberately,
because a visibly unformatted date gets reported while a silently wrong one does
not. But **nothing on the live path ever supplied a formatter.** The unit tests
passed one, so they never saw it.

---

## 5. A jewellery invoice was titled `JEWELRY_INVOICE`

`invoice` and `jewelry_invoice` ship with `content: ''` — falsy, so the fallback
ran, and the fallback was `documentType.toUpperCase()`. Underscore and all, at
the top of a high-value invoice.

Now resolved through a title map: `TAX INVOICE`, `CERTIFICATE OF AUTHENTICITY`
and so on. Those are conventions, not prettier strings.

---

## 6. Another canvas/print divergence — created in the same session

The refund slip showed **"Original Sale —"** in the designer while printing the
real number.

`accessor` support was added to the print renderer's `custom` block so a refund
could name the sale it reverses, and the canvas was left resolving only `value`.
Written minutes apart, already diverged. Now one `buildCustomRows` shared by
both, with a test asserting neither reimplements it.

---

## 7. Sweep results — what was checked and found clean

| Check | Result |
|---|---|
| Block types used vs handled by each renderer | clean |
| Every block type reachable from the palette | clean |
| Raw accessor names leaking as labels | clean |
| Placeholder / `undefined` / `NaN` in rendered output | clean |
| Every template against realistic mapped data | clean |

The one warning — a jewellery invoice showing 18% em-dashes — was confirmed
correct: it was being fed a general-retail sale with no purity or weight fields.
Given jewellery data it drops to one.

---

## What changed about the method

- Render through the **live call stack**, not the module in isolation. Bugs 4
  and 5 were invisible from the mapper's own tests.
- **Click the real button**, then reload and check it persisted. Bugs 2 and 3
  only appear on the second load.
- Assert on the **encoded output**, not that some output exists. A test checking
  "an `<svg>` came back" would have passed through both barcode bugs.
- When a test escapes a mutation, **fix the test**. Two did here — an assertion
  scoped so loosely it caught the wrong `catch` block, and one asserting on
  rendered text where the blocks self-suppress.

---

## Verification

Backend **200** · Frontend **545** · typecheck clean · build green.

Every fix mutation-tested. Two mutations initially escaped and both were
genuine weaknesses in my assertions, now corrected.

**Still not verified:** none of this has touched a real printer. The barcodes
are real encodings and the layouts render correctly in a browser, but scanning,
column widths and cut position are decided by hardware. That remains
`10_Print_Hardware_QA_Checklist.md`, and §1.4 of it — "the barcode scans with
your own scanner" — would have caught the barcode bugs above.
