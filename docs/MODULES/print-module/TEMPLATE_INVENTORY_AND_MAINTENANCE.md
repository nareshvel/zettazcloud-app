# Print Template Inventory and Maintenance Guide

**Created:** 2026-08-26  
**Source of truth:** `backend/services/retailProfileService.js`, `frontend/src/utils/templatePresets.ts`, and `backend/services/printTemplateService.js`

## Model

A store's expected template inventory is derived from:

```text
Industry/business type + sales mode + jurisdiction capabilities
```

Industry controls the normal document set. Duty-free and tax-refund capabilities add documents; they do not replace the industry's normal templates.

The authoritative provisioning flow is:

```text
retailProfileService.planTemplates()
→ templateProvisioningService
→ print_templates
```

The visual preset catalog in `templatePresets.ts` must describe every provisioned preset. `DEFAULT_BLOCKS` defines the block schema for every supported template type.

## Template type registry

| Template type | Typical media | Use |
|---|---|---|
| `receipt` | 58/80/110 mm | Sale receipt, gift receipt, duty-free retail receipt |
| `invoice` | A4/Letter | General, electronics, tax-refund, reverse-charge invoices |
| `jewelry_invoice` | A4/Letter | Jewelry domestic and duty-free invoices |
| `jewelry_certificate` | A4/Letter | Certificate of authenticity |
| `return` | Currently 80 mm preset | Refund / Credit Note; A4/Letter variant planned |
| `label` | Label media | Product/jewelry labels; separate label workflow |
| `document` | A4/Letter | User-created generic documents |

Receipt/Invoice Printer Settings route families are not the template registry. The Invoice route may select `invoice` or `jewelry_invoice`; refunds use `return` through a compatibility route until dedicated return routing is implemented.

## Provisioned inventory by industry

### General retail

| Document | Preset | Type | Media | Default |
|---|---|---|---|---|
| Sales Receipt | `retail-receipt-80` | `receipt` | 80 mm | Yes |
| Invoice | `retail-invoice-a4` | `invoice` | A4 | No |
| Refund / Credit Note | `retail-return-80` | `return` | 80 mm | No |

### Grocery & supermarket

| Document | Preset | Type | Media | Default |
|---|---|---|---|---|
| Grocery Receipt | `grocery-receipt-80` | `receipt` | 80 mm | Yes |
| Refund / Credit Note | `retail-return-80` | `return` | 80 mm | No |

### Electronics

| Document | Preset | Type | Media | Default |
|---|---|---|---|---|
| Sales Receipt | `retail-receipt-80` | `receipt` | 80 mm | Yes |
| Tax Invoice | `electronics-invoice-a4` | `invoice` | A4 | No |
| Refund / Credit Note | `retail-return-80` | `return` | 80 mm | No |

### Apparel & fashion

| Document | Preset | Type | Media | Default |
|---|---|---|---|---|
| Sales Receipt | `apparel-receipt-80` | `receipt` | 80 mm | Yes |
| Gift Receipt | `apparel-gift-80` | `receipt` | 80 mm | No |
| Refund / Credit Note | `retail-return-80` | `return` | 80 mm | No |

### Jewelry & bullion

| Document | Preset | Type | Media | Default |
|---|---|---|---|---|
| Sales Receipt | `retail-receipt-80` | `receipt` | 80 mm | Yes |
| Jewelry Invoice | `jewelry-invoice-a4` | `jewelry_invoice` | A4 | No |
| Certificate of Authenticity | `jewelry-certificate-a4` | `jewelry_certificate` | A4 | No |
| Refund / Credit Note | `retail-return-80` | `return` | 80 mm | No |

### Pharmacy

Pharmacy is currently unavailable for tenant selection pending regulatory review, but the catalog contains:

| Document | Preset | Type | Media | Default |
|---|---|---|---|---|
| Pharmacy Receipt | `pharmacy-receipt-80` | `receipt` | 80 mm | Yes |
| Refund / Credit Note | `retail-return-80` | `return` | 80 mm | No |

Do not expose pharmacy as an available industry until dispensing-record requirements are reviewed for the target jurisdiction.

## Conditional additions

### Duty-free jewelry

| Document | Preset | Type | Media |
|---|---|---|---|
| Duty-Free Invoice | `jewelry-dutyfree-a4` | `jewelry_invoice` | A4 |

This is added alongside the domestic Jewelry Invoice.

### Duty-free non-jewelry

| Document | Preset | Type | Media |
|---|---|---|---|
| Duty-Free Receipt | `retail-dutyfree-80` | `receipt` | 80 mm |

### Traveller tax-refund scheme

| Document | Preset | Type | Media |
|---|---|---|---|
| Tax-Free Shopping Invoice | `taxrefund-invoice-a4` | `invoice` | A4 |

### Available but not currently auto-provisioned

| Document | Preset | Type | Media |
|---|---|---|---|
| B2B Reverse-Charge Invoice | `b2b-reverse-charge-a4` | `invoice` | A4 |

## Return document gap

Every industry currently receives the 80 mm `retail-return-80` preset. The renderer already supports the `return` template type and falls back to a receipt template when no return template exists.

A4/Letter return documents are feasible and should be introduced as an explicit preset, for example:

```text
retail-return-a4
Refund / Credit Note (A4)
return
A4
```

`useReturnReceipt` now uses `print_document_settings`, the shared Auto Print action resolver, explicit current route settings, and dedicated `return` templates only. No deprecated `printer_settings`, hardcoded return HTML, or sale-receipt template fallback remains.

Current compatibility policy:

- A receipt-first store renders the return template at the configured thermal media size.
- An invoice-first store renders the same dedicated return template at A4 or Letter and sends it through the invoice route delivery settings.

This provides a simple universal A4/Letter Credit Note immediately without introducing another settings row. A future dedicated return route can be added when stores need return delivery independent from their default sale document.

Still required for field-proven return support:

1. Add a visually refined A4/Letter return preset if the universal return blocks need page-specific improvement.
2. Add independent return route configuration only when a tenant needs a different return printer/delivery policy.
3. Test thermal refund and A4/Letter credit-note output end to end.
4. Verify partial/full return tax reversal, refund method, original sale reference, and inventory restock.

## How to add or update a template

### Updating block defaults for a template type

1. Update `DEFAULT_BLOCKS` in `backend/services/printTemplateService.js`.
2. Preserve block IDs where possible so reset/default comparisons remain stable.
3. Update renderer/model utilities for any new block behavior.
4. Update fixture data in `backend/services/printFixtures.js`.
5. Update renderer parity and golden tests.
6. Decide whether existing tenant templates should be reset, migrated, or left unchanged.

Do not silently overwrite merchant-edited templates.

### Adding a preset

1. Add the preset to `frontend/src/utils/templatePresets.ts`.
2. Use a template type already supported by `DEFAULT_BLOCKS`, or complete the full type-registry process.
3. Add suitable fixture data.
4. Add the preset to `INDUSTRY_TEMPLATES`, `DUTY_FREE_TEMPLATES`, or another deliberate provisioning rule if it should be auto-created.
5. Update this inventory.
6. Run registry, preset, defaults, renderer, and provisioning tests.

### Adding a template type

A template type is represented in multiple layers. The registry test treats `DEFAULT_BLOCKS` as the source of truth and checks alignment across:

- Backend accepted types
- `TemplateType`
- Database enum/migration
- Default paper-size mapping
- New Template dialog
- Human-readable labels
- Preview fixtures

Run:

```bash
cd frontend
npm test -- --run src/utils/templateTypeRegistry.test.ts
```

### Provisioning existing stores

Always begin with:

```bash
cd backend
npm run provision:missing-templates:dry
```

If missing templates are expected and reviewed:

```bash
npm run provision:missing-templates
```

Provisioning is additive. It must not replace merchant-edited templates.

## Required verification

```bash
cd backend
npm run migrate:status
npm run provision:missing-templates:dry
npm test -- --grep "Print defaults|Retail profile|Template provisioning"

cd ../frontend
npm test -- --run src/utils/templateTypeRegistry.test.ts src/utils/templatePresets.test.ts src/utils/printGolden.test.ts src/utils/rendererParity.test.ts
npm run build
```

Manual QA must then select the explicit template in Printer Settings and prove that exact template prints. Automated tests verify contracts but do not prove printer hardware, browser dialogs, Local Agent installers, or physical page output.
