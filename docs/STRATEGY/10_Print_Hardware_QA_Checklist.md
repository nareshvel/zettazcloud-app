# Print Hardware QA Checklist

**Why this exists:** every print assertion in the test suite runs against a
headless DOM. That proves the HTML is correct. It proves nothing about what
comes out of a thermal printer — column widths, character encoding, cut
position and logo dithering are all decided by the driver and the hardware,
none of which the tests can see.

This is the pass that has to be done by a person, once, before any customer is
moved onto template printing.

**Time:** about 40 minutes with the printer already set up.
**You need:** a 58mm thermal printer, an 80mm thermal printer, an A4/Letter
printer, and one demo store.

---

## Setup

```bash
cd backend
npm run migrate        # through 2026-08-31_return_template_type.sql
npm run migrate:demo   # demo tenants, sales and templates
```

Then sign in as `demo@retail.zettaz.test` and, in **Settings → Printers**, turn
on **Use my print templates**.

> Leave every other demo store on the built-in receipt. If something is wrong,
> the difference between one store and the rest is the fastest diagnosis you
> will get.

---

## 1. Thermal — 80mm

Print a sale from the demo history (Sales → any completed sale → Print).

| # | Check | Why it matters |
|---|---|---|
| 1.1 | Nothing is cut off at the right margin | The most common template failure. Renders fine on screen at any width. |
| 1.2 | The total is the most prominent figure | It is the one line customers actually look for. |
| 1.3 | Item names wrap rather than truncate | A truncated name is unusable for a return. |
| 1.4 | The barcode scans with your own scanner | **Do not skip.** With the number text hidden by default, this is the only identifier on the slip. |
| 1.5 | The logo is legible, not a grey smear | Thermal printers dither. A logo that looks fine on A4 often does not survive. |
| 1.6 | The paper cuts below the last line | A cut through the footer loses the return policy. |
| 1.7 | Currency symbols and any accented characters render | Encoding problems appear here first. |

## 2. Thermal — 58mm

Repeat 1.1–1.7. **58mm is where layouts break**, so if you only have time for
one width, use this one.

| # | Check | Why it matters |
|---|---|---|
| 2.1 | The items table still has readable columns | Four columns rarely survive 58mm. |
| 2.2 | The tax summary is not squeezed into overlap | |
| 2.3 | Long store names wrap sensibly in the header | |

## 3. A4 / Letter invoice

Print an invoice for the same sale.

| # | Check | Why it matters |
|---|---|---|
| 3.1 | **The invoice number is printed** | On by default for invoices. Wholesale and trade settle against it. |
| 3.2 | The customer block shows the bill-to details | |
| 3.3 | Nothing falls into the printer's unprintable margin | Usually 5mm; varies by model. |
| 3.4 | A multi-page sale repeats the header | Add items to the cart until it runs over. |

## 4. Refund slip

Process a return against a demo sale and print it.

| # | Check | Why it matters |
|---|---|---|
| 4.1 | Titled REFUND / CREDIT NOTE, **not** SALES RECEIPT | This was a real bug — a borrowed receipt template kept its own title. |
| 4.2 | Shows its own refund number | A credit note nobody can reference is unusable. |
| 4.3 | Shows the **original sale's** reference | The one thing a refund document must do. |
| 4.4 | Amounts are positive, not negative | The title carries the direction. |
| 4.5 | No "Exchange within 30 days" or loyalty points | Neither applies to a refund. |

## 5. Duty-free

Sign in as `demo@jewelry.zettaz.test` (duty-free) and print a sale.

| # | Check | Why it matters |
|---|---|---|
| 5.1 | **No tax is charged or shown** | The entire point of the vertical. |
| 5.2 | The export declaration is printed in full | It is the legal substance of a duty-free supply. |
| 5.3 | Not stamped DUPLICATE or REPRINT | A reprint-marked receipt is invalid at customs. |

## 6. The fallback actually falls back

The most important test on this page, because it is the one protecting the
till. **Break it on purpose:**

| # | Do this | Expected |
|---|---|---|
| 6.1 | Unpublish the store's receipt template, then print | The built-in receipt prints. No error. |
| 6.2 | Stop the backend, then print an already-loaded sale | The built-in receipt prints. |
| 6.3 | Re-publish, print again | The template prints. |

If any of these fails to produce paper, stop and fix it before going further.
Everything else on this list is cosmetic by comparison.

---

## Recording results

Note the printer make and model against each section — "works on an Epson
TM-T20" is a useful fact, "works on thermal" is not. Anything that fails is
worth capturing as a photo of the paper next to the on-screen preview; the
difference between the two is usually the whole diagnosis.

---

## Known gaps this pass will not cover

- **ESC/POS direct printing.** These checks assume browser printing. The
  direct-print path renders differently and needs its own pass.
- **Cash drawer kick and bell.** Driven by the printer profile, unrelated to
  templates.
- **Pharmacy.** The vertical is held back pending regulatory review, so its
  template is not provisioned to any demo store.
