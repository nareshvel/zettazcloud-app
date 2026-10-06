/**
 * Print Template Renderer
 *
 * Generates a real, physically-sized (mm/pt) HTML document for a print
 * template so "Print Preview" shows exactly what will come out of the
 * printer or PDF — not the compressed on-screen proofing canvas.
 *
 * Typography follows standard invoice guidance: ~10-12pt body, ~12-14pt
 * emphasis (totals), ~14-18pt headers, ~8-10pt fine print for A4/Letter;
 * thermal receipts use tighter monospace sizing matching real ESC/POS output.
 *
 * Follows the app's existing print convention (see printerService.ts):
 * write into a hidden iframe and call iframe.contentWindow.print().
 */
import { TemplateBlock, TemplateField, PaperSize, PAPER_SIZE_PHYSICAL } from '@/types/printTemplate';
import { buildScannable, buildQrCode } from '@/utils/barcodeModel';
import { buildTaxSummary, ZERO_RATE_LABELS } from '@/utils/taxSummaryModel';
import {
  isBlockSuppressed, isGiftMode, filterGiftModeColumns, isDutyFreeOrExport,
  buildDutyFreeLines, buildTaxRefundLines, DEFAULT_REPRINT_TEXT,
} from '@/utils/salesModeRules';
import {
  resolveColumns, isNumericColumn, buildWeighedSubLine, buildTaxFlagLegend,
  MONEY_ACCESSORS as TABLE_MONEY_ACCESSORS,
  WEIGHT_ACCESSORS as TABLE_WEIGHT_ACCESSORS,
} from '@/utils/itemTableModel';
import {
  buildSavings, buildLoyalty, buildChangeDue, buildReturnPolicy,
  buildRxDetails, buildBatchExpiry, buildSerialRows, buildWarrantyRows,
  buildCustomRows,
} from '@/utils/verticalBlockModel';
import { buildFiscal, FISCAL_MISSING_NOTICE } from '@/utils/fiscalBlockModel';
import { buildDocumentHeader } from '@/utils/documentHeaderModel';
import { buildParties, buildPageFooter } from '@/utils/documentSectionsModel';
import { shouldShowDocumentNumber, classifyDocument } from '@/utils/documentNumberVisibility';

const escapeHtml = (value: unknown): string => {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const money = (n: unknown, currency = 'USD') => {
  const num = typeof n === 'number' ? n : parseFloat(String(n ?? 0));
  if (Number.isNaN(num)) return escapeHtml(n ?? '');
  try {
    return escapeHtml(new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num));
  } catch {
    return `$${num.toFixed(2)}`;
  }
};

/**
 * Resolve one table cell.
 *
 * Weight uses the ITEM's own unit rather than assuming grams — the app supports
 * g / oz / tola / baht / kg, and a jewellery weight printed in the wrong unit is
 * a commercially significant error.
 *
 * A tax flag renders as-is (T / N / Z) with no formatting: the characters are
 * the convention, and the legend beneath the table decodes them.
 */
const resolveAccessorValue = (item: any, accessor?: string, currency?: string, row?: any) => {
  if (!accessor) return '—';
  const value = item?.[accessor];
  if (value === undefined || value === null || value === '') {
    // An absent tax flag is meaningful (unflagged = not applicable), so it
    // should print blank rather than a placeholder dash.
    return accessor === 'taxFlag' ? '' : '—';
  }
  if (accessor === 'taxFlag') return escapeHtml(value);
  if (TABLE_MONEY_ACCESSORS.has(accessor)) return money(value, currency);
  if (TABLE_WEIGHT_ACCESSORS.has(accessor)) {
    const unit = (row || item)?.weightUnit || 'g';
    return `${escapeHtml(value)}${unit}`;
  }
  return escapeHtml(value);
};

const inferDefaultColumns = (items: any[]): TemplateField[] => {
  const sample = items?.[0] || {};
  if ('amount' in sample || 'purity' in sample) {
    return [
      { id: 'name', label: 'Item', accessor: 'name' },
      { id: 'purity', label: 'Purity', accessor: 'purity' },
      { id: 'netWeight', label: 'Net Wt', accessor: 'netWeight' },
      { id: 'amount', label: 'Amount', accessor: 'amount' },
    ];
  }
  if ('price' in sample && !('unitPrice' in sample)) {
    return [
      { id: 'name', label: 'Item', accessor: 'name' },
      { id: 'description', label: 'Description', accessor: 'description' },
      { id: 'qty', label: 'Qty', accessor: 'qty' },
      { id: 'price', label: 'Price', accessor: 'price' },
    ];
  }
  return [
    { id: 'name', label: 'Item', accessor: 'name' },
    { id: 'qty', label: 'Qty', accessor: 'qty' },
    { id: 'unitPrice', label: 'Price', accessor: 'unitPrice' },
  ];
};

type FontKey = 'fine' | 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'title';
// Real point sizes (1pt = 1/72in), matching invoice typography best practice.
const FONT_SCALE_PT: Record<PaperSize, Record<FontKey, number>> = {
  '58mm': { fine: 6, xs: 6.5, sm: 7, base: 7.5, lg: 9, xl: 10, title: 11 },
  '80mm': { fine: 7, xs: 7.5, sm: 8, base: 9, lg: 10.5, xl: 12, title: 13 },
  a4: { fine: 8.5, xs: 9.5, sm: 10.5, base: 11, lg: 13, xl: 17, title: 20 },
  label: { fine: 6, xs: 6.5, sm: 7, base: 7.5, lg: 9, xl: 10, title: 11 },
};

const alignStyle = (align?: string) =>
  align === 'center' ? 'text-align:center;' : align === 'right' ? 'text-align:right;' : 'text-align:left;';

const renderBlockHtml = (block: TemplateBlock, data: any, paperSize: PaperSize, storeLogoUrl?: string | null): string => {
  const cfg = block.config || {};
  const scale = FONT_SCALE_PT[paperSize];
  const primarySize = (key: FontKey): FontKey => (cfg.fontSize as FontKey) || key;
  const style = `${alignStyle(cfg.align)}font-size:${scale[primarySize('sm')]}pt;${cfg.bold ? 'font-weight:bold;' : ''}`;
  const fields: TemplateField[] = cfg.fields || [];
  const currency = data.currency;

  switch (block.type) {
    case 'logo': {
      const logoSrc = cfg.imageUrl || storeLogoUrl;
      const layout = (cfg.logoLayout || 'logo_only') as string;
      const defaultHeight = paperSize === 'a4' ? 16 : 9;
      const heightMm = cfg.logoHeight ?? defaultHeight;
      const align = cfg.align || 'left';
      /*
       * `logo_name_inline` puts the mark beside the name with no contact block,
       * for layouts that carry the address in a page footer instead. It keeps
       * the top of the page to two things at eye level — who you are, and what
       * the document is — which is most of what makes that layout read quickly.
       */
      const isInline    = layout === 'logo_name_inline';
      const showImage   = layout === 'logo_only' || layout === 'logo_name'
                          || layout === 'logo_name_contact' || isInline;
      const showName    = layout !== 'logo_only';
      const showContact = layout === 'logo_name_contact' || layout === 'name_contact';
      const contactFields = new Set<string>(cfg.logoContactFields || ['address', 'phone', 'email']);

      const imgHtml = showImage && logoSrc
        ? `<img src="${escapeHtml(logoSrc)}" style="height:${heightMm}mm;object-fit:contain;flex-shrink:0;" />`
        : '';

      const contactLines: string[] = [];
      if (showContact) {
        if (contactFields.has('address') && data.storeAddress) contactLines.push(escapeHtml(data.storeAddress));
        if (contactFields.has('phone')   && data.storePhone)   contactLines.push(escapeHtml(data.storePhone));
        if (contactFields.has('email')   && data.storeEmail)   contactLines.push(escapeHtml(data.storeEmail));
        if (contactFields.has('taxId')   && data.storeTaxId)   contactLines.push(`Tax: ${escapeHtml(data.storeTaxId)}`);
      }
      const nameHtml  = showName ? `<div style="font-weight:bold;font-size:${scale[primarySize(isInline ? 'lg' : 'base')]}pt;">${escapeHtml(data.storeName || 'Store Name')}</div>` : '';
      const infoHtml  = contactLines.length ? `<div style="font-size:${scale.xs}pt;color:#555;margin-top:0.5mm;">${contactLines.join('<br/>')}</div>` : '';
      const textBlock = (nameHtml || infoHtml) ? `<div>${nameHtml}${infoHtml}</div>` : '';

      // Inline: mark and name on one line, vertically centred, nothing else.
      if (isInline) {
        return `<div style="display:flex;align-items:center;gap:3mm;">${imgHtml}${textBlock}</div>`;
      }
      // Center: image stacked above text
      if (align === 'center') {
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2mm;">${imgHtml}${textBlock}</div>`;
      }
      // Right: text on left, image on right
      if (align === 'right') {
        return `<div style="display:flex;align-items:center;justify-content:flex-end;gap:3mm;">${textBlock}${imgHtml}</div>`;
      }
      // Left (default): image on left, text on right
      if (!imgHtml && !textBlock) return '';
      if (!textBlock) return `<div style="display:flex;">${imgHtml}</div>`;
      return `<div style="display:flex;align-items:center;gap:3mm;">${imgHtml}${textBlock}</div>`;
    }

    case 'header': {
      /*
       * Every decision here — title precedence, whether the number is shown,
       * how it is labelled — lives in documentHeaderModel and is shared with
       * TemplateCanvas.
       *
       * It used to be written out twice, once per renderer, and they drifted:
       * the canvas showed a bare `RCT-002250` while print showed
       * `Receipt No. RCT-002250`, and the canvas ignored the tenant's
       * show/hide setting entirely. A designer that misrepresents the printed
       * output is worse than no preview, because people check it and trust it.
       */
      const header = buildDocumentHeader(data, cfg, paperSize);

      /*
       * The subtitle (invoice no. · date · employee) deliberately uses the
       * fixed `sm` size, NOT primarySize('sm').
       *
       * `cfg.fontSize` sizes the PRIMARY text of the block — here, the title.
       * `primarySize(key)` returns cfg.fontSize whenever it is set, ignoring
       * whatever key was actually asked for, so a header configured with
       * fontSize:'xl' (needed to make "DUTY-FREE INVOICE" prominent) was also
       * blowing the subtitle up to the SAME 17pt on A4 — nearly double its
       * intended 10.5pt. Right-aligned and that large, "Invoice No. ... ·
       * date · Emp: Marcus Hill" wrapped, stranding "Hill" alone on its own
       * line. The subtitle is always secondary to the title; it must not
       * inherit the title's own size override.
       */
      let html = `<div style="${style}"><div style="font-weight:bold;font-size:${scale[primarySize('title')]}pt;">${escapeHtml(header.title)}</div>`;
      if (header.parts.length > 0) {
        html += `<div style="font-size:${scale.sm}pt;color:#555;margin-top:1mm;">${escapeHtml(header.parts.join(' · '))}</div>`;
      }
      html += '</div>';
      return html;
    }

    case 'text': {
      const storeFields = new Set(cfg.storeFields || ['name', 'address', 'phone', 'email', 'taxId']);
      const storeParts: string[] = [];
      if (storeFields.has('name')) storeParts.push(data.storeName || 'Store Name');
      if (storeFields.has('address')) storeParts.push(data.storeAddress);
      if (storeFields.has('phone')) storeParts.push(data.storePhone || data.storeTel);
      if (storeFields.has('email')) storeParts.push(data.storeEmail);
      if (storeFields.has('taxId')) storeParts.push(data.storeTaxId);
      const activeParts = storeParts.filter(Boolean);
      const title = cfg.content || (activeParts.length ? activeParts[0] : 'Store Name');
      const subtitleParts = cfg.content ? activeParts : activeParts.slice(1);
      let html = `<div style="${style}"><div style="font-weight:bold;font-size:${scale[primarySize('title')]}pt;">${escapeHtml(title)}</div>`;
      if (subtitleParts.length > 0) {
        // Fixed `sm`, not primarySize('sm') — see the note in case 'header'.
        html += `<div style="font-size:${scale.sm}pt;color:#555;">${escapeHtml(subtitleParts.join(' · '))}</div>`;
      }
      html += '</div>';
      return html;
    }

    case 'customer': {
      const customerFields = new Set(cfg.customerFields || ['name', 'address', 'city', 'phone', 'email', 'taxId', 'passport']);
      const c = data.customer || {};
      const name = customerFields.has('name') ? (c.name || data.customerName || '') : null;
      const address = customerFields.has('address') ? (c.address || data.customerAddress) : null;
      // Deduplicate: `address` is often already a full one-line address that
      // includes city/state/postcode. Composing a second line from those parts
      // then repeats them. Only add the parts the address line does not contain.
      const cityParts = customerFields.has('city')
        ? [c.city, c.state, c.postalCode, c.country].filter(Boolean)
        : [];
      const addressLower = String(address || '').toLowerCase();
      const newParts = cityParts.filter((p) => !addressLower.includes(String(p).toLowerCase()));
      const city = newParts.length ? newParts.join(', ') : null;
      const email = customerFields.has('email') ? (c.email || data.customerEmail) : null;
      const phone = customerFields.has('phone') ? (c.phone || data.customerPhone) : null;
      // Where the jurisdiction requires the buyer's tax number on a B2B invoice
      // (most of the EU, and mandatory under reverse charge), show it even if
      // the template did not tick the field — omitting it makes the invoice
      // invalid for the buyer's input-tax credit. Labelled per jurisdiction:
      // "VAT No." / "GSTIN" / "ABN" / "TRN".
      const custTaxId = c.taxId || data.customerTaxId;
      const taxIdRequired = Boolean(data.requiresCustomerTaxId) && Boolean(custTaxId);
      const showTaxId = customerFields.has('taxId') || taxIdRequired;
      const taxIdLabel = data.taxIdLabel || 'Tax ID';
      const taxOrPassport = [
        customerFields.has('passport') && c.passport ? `Passport: ${c.passport}` : null,
        showTaxId && custTaxId ? `${taxIdLabel}: ${custTaxId}` : null,
      ].filter(Boolean).join(' · ');

      return `<div style="${style}">
        ${name ? `<div style="font-weight:600;font-size:${scale[primarySize('base')]}pt;">${escapeHtml(name)}</div>` : ''}
        <div style="font-size:${scale[primarySize('sm')]}pt;color:#555;">
          ${address ? `<div>${escapeHtml(address)}</div>` : ''}
          ${city ? `<div>${escapeHtml(city)}</div>` : ''}
          ${email ? `<div>${escapeHtml(email)}</div>` : ''}
          ${phone ? `<div>${escapeHtml(phone)}</div>` : ''}
          ${taxOrPassport ? `<div>${escapeHtml(taxOrPassport)}</div>` : ''}
        </div>
      </div>`;
    }

    case 'address': {
      const addressType = cfg.addressType || 'billing';
      const billing = data.customer?.billingAddress || data.customer?.address || data.customer?.addressLine1 || '';
      const shipping = data.customer?.shippingAddress || data.customer?.address || data.customer?.addressLine1 || '';
      const showBilling = addressType === 'billing' || addressType === 'both';
      const showShipping = addressType === 'shipping' || addressType === 'both';
      let html = `<div style="${style}">`;
      if (showBilling) {
        html += `<div style="font-size:${scale.fine}pt;color:#777;text-transform:uppercase;letter-spacing:0.05em;">Billing Address</div>`;
        html += `<div style="font-size:${scale[primarySize('sm')]}pt;">${escapeHtml(billing)}</div>`;
      }
      if (showShipping) {
        html += `<div style="font-size:${scale.fine}pt;color:#777;text-transform:uppercase;letter-spacing:0.05em;">Shipping Address</div>`;
        html += `<div style="font-size:${scale[primarySize('sm')]}pt;">${escapeHtml(shipping)}</div>`;
      }
      html += '</div>';
      return html;
    }

    case 'table': {
      const items = Array.isArray(data.items) ? data.items : [];
      const gift = isGiftMode(cfg, data);

      // Gift receipts show what was bought, never what it cost.
      const configured = filterGiftModeColumns(
        fields.length ? fields : inferDefaultColumns(items),
        gift,
      );
      // A tax-flag column is only appended when the data actually carries flags —
      // requesting it otherwise would print a column of dashes.
      const columns = resolveColumns(configured, items, {
        taxFlagColumn: Boolean(cfg.tableTaxFlagColumn) && !gift,
      });

      const rows = items.length ? items : [{}];
      const showHeader = cfg.tableShowHeader !== false;
      const zebra = Boolean(cfg.tableZebra);
      const pad = cfg.tableCompact ? '0.8mm' : '1.5mm';
      const fs = scale[primarySize('sm')];

      const align = (col: any, i: number) =>
        i === 0 ? 'left' : (isNumericColumn(col.accessor) || i > 0 ? 'right' : 'left');

      const headerCells = columns.map((col, i) =>
        `<th style="text-align:${align(col, i)};padding:${pad} 0;font-weight:600;">${escapeHtml(col.label ?? col.accessor ?? '')}</th>`
      ).join('');

      const bodyRows = rows.map((item: any, idx: number) => {
        const cells = columns.map((col, i) =>
          `<td style="text-align:${align(col, i)};padding:${pad} 0;">${resolveAccessorValue(item, col.accessor, currency, item)}</td>`
        ).join('');

        const bg = zebra && idx % 2 === 1 ? 'background:#f4f4f4;' : '';
        const main = `<tr style="${bg}border-bottom:0.2mm dashed #ccc;">${cells}</tr>`;

        // Weighed produce/deli: show the measured weight and rate so the
        // customer can verify the scale. Suppressed in gift mode, where the
        // rate would reveal price.
        const sub = !gift && cfg.weighedItemMode !== false
          ? buildWeighedSubLine(item, (v) => money(v, currency))
          : null;
        if (!sub) return main;

        return `${main}<tr style="${bg}border-bottom:0.2mm dashed #ccc;">
          <td colspan="${columns.length}" style="text-align:left;padding:0 0 ${pad} 3mm;font-size:${scale.fine}pt;color:#555;">${sub}</td>
        </tr>`;
      }).join('');

      const table = `<table style="width:100%;border-collapse:collapse;font-size:${fs}pt;">
        ${showHeader ? `<thead><tr style="border-bottom:0.5mm solid #000;">${headerCells}</tr></thead>` : ''}
        <tbody>${bodyRows}</tbody>
      </table>`;

      // Legend decoding the tax markers. Only when more than one flag is in
      // play — a single marker explains nothing.
      const legend = cfg.tableTaxFlagColumn && !gift ? buildTaxFlagLegend(items) : null;
      const legendHtml = legend
        ? `<div style="font-size:${scale.fine}pt;color:#555;margin-top:1mm;">${escapeHtml(legend)}</div>`
        : '';

      return `${table}${legendHtml}`;
    }

    case 'attributes': {
      const item = data.items?.[0] || {};
      const chips = fields.length ? fields : [
        { id: 'purity', label: 'Purity', value: item.purity },
        { id: 'huid', label: 'HUID', value: item.huid },
      ].filter((f) => f.value);
      if (!chips.length) return '';
      return `<div style="${style}display:flex;flex-wrap:wrap;gap:2mm;">${chips.map((f) =>
        `<span style="border:0.2mm solid #ccc;border-radius:3mm;padding:0.5mm 2mm;font-size:${scale[primarySize('xs')]}pt;"><span style="color:#777;">${escapeHtml(f.label)}</span> ${escapeHtml(f.value)}</span>`
      ).join('')}</div>`;
    }

    case 'purity': {
      const item = data.items?.[0] || {};
      const rows = fields.length ? fields : [
        { id: 'gross', label: 'Gross Weight', value: item.grossWeight ? `${item.grossWeight}g` : undefined },
        { id: 'net', label: 'Net Weight', value: item.netWeight ? `${item.netWeight}g` : undefined },
        { id: 'rate', label: 'Rate / gram', value: item.ratePerGram ? money(item.ratePerGram, currency) : undefined },
        { id: 'making', label: 'Making Charge', value: item.makingCharge !== undefined ? money(item.makingCharge, currency) : undefined },
      ].filter((f) => f.value);
      if (!rows.length) return '';
      return `<table style="width:100%;font-size:${scale[primarySize('sm')]}pt;">${rows.map((f) =>
        `<tr><td style="color:#777;padding:0.5mm 0;">${escapeHtml(f.label)}</td><td style="text-align:right;padding:0.5mm 0;">${f.value}</td></tr>`
      ).join('')}</table>`;
    }

    case 'gemstones': {
      if (!fields.length) return '';
      return `<div style="font-size:${scale[primarySize('sm')]}pt;">${fields.map((f) =>
        `<div><span style="color:#777;">${escapeHtml(f.label)}:</span> ${escapeHtml(f.value || '—')}</div>`
      ).join('')}</div>`;
    }

    case 'itemAttributes': {
      // Per-item attribute lines — e.g. jewelry purity/weight — for fields the
      // tenant has marked `show_on_receipt`. Attribute lines are computed in
      // saleToPrintData and attached to each item as `attributeLines`.
      const items = Array.isArray(data.items) ? data.items : [];
      const rows = items
        .map((item) => {
          const lines = Array.isArray(item.attributeLines) ? item.attributeLines : [];
          if (!lines.length) return '';
          const name = escapeHtml(item.name ?? 'Item');
          const sub = lines
            .map((line) => `<div style="font-size:${scale.fine}pt;color:#555;margin-left:2mm;">${escapeHtml(line)}</div>`)
            .join('');
          return `<div style="margin-bottom:1mm;"><div style="font-weight:600;">${name}</div>${sub}</div>`;
        })
        .filter(Boolean)
        .join('');
      if (!rows) return '';
      return `<div style="${style}font-size:${scale[primarySize('xs')]}pt;">${rows}</div>`;
    }

    case 'tax':
      return `<div style="${style}display:flex;justify-content:space-between;font-size:${scale[primarySize('sm')]}pt;">
        <span>${escapeHtml(data.taxLabel || 'Tax')} ${data.taxRate ? `(${escapeHtml(data.taxRate)}%)` : ''}</span>
        <span>${money(data.taxAmount ?? data.tax, currency)}</span>
      </div>`;

    // ── Commercial ─────────────────────────────────────────────────────────
    case 'savings': {
      const s = buildSavings(data);
      if (!s.hasSavings) return '';
      const fs = scale[primarySize('sm')];
      const label = cfg.savingsLabel || 'YOU SAVED';

      const coupons = cfg.showCouponLines !== false && s.couponLines.length
        ? s.couponLines.map((c) =>
            `<div style="display:flex;justify-content:space-between;gap:3mm;font-size:${scale.fine}pt;color:#555;">
               <span>${escapeHtml(c.description)}</span><span>${money(c.amount, currency)}</span>
             </div>`
          ).join('')
        : '';

      // The total is what customers look for, so it carries the emphasis.
      const total = `<div style="display:flex;justify-content:space-between;gap:3mm;font-weight:bold;padding-top:0.6mm;">
        <span>${escapeHtml(label)}</span><span>${money(s.total, currency)}</span>
      </div>`;

      return `<div style="${style}font-size:${fs}pt;">${coupons}${total}</div>`;
    }

    case 'loyalty': {
      const l = buildLoyalty(data);
      if (!l.hasLoyalty) return '';
      const visible = cfg.showPointsBalance === false
        ? l.lines.filter((x) => x.label !== 'Points balance')
        : l.lines;
      if (!visible.length) return '';
      return `<div style="${style}font-size:${scale[primarySize('sm')]}pt;">${
        visible.map((x) =>
          `<div style="display:flex;justify-content:space-between;gap:3mm;${x.emphasis ? 'font-weight:600;' : ''}">
             <span style="color:#555;">${escapeHtml(x.label)}</span><span>${escapeHtml(x.value)}</span>
           </div>`
        ).join('')
      }</div>`;
    }

    case 'changeDue': {
      // Cash only — card payments have no tender or change, and printing
      // "Change 0.00" on a card sale is noise.
      const c = buildChangeDue(data);
      if (!c.hasChange) return '';
      return `<div style="${style}font-size:${scale[primarySize('sm')]}pt;">${
        c.lines.map((x) =>
          `<div style="display:flex;justify-content:space-between;gap:3mm;${x.emphasis ? 'font-weight:bold;' : ''}">
             <span>${escapeHtml(x.label)}</span><span>${money(x.value, currency)}</span>
           </div>`
        ).join('')
      }</div>`;
    }

    case 'returnPolicy': {
      const r = buildReturnPolicy(data, cfg.returnPolicyText as string | undefined);
      if (!r.hasPolicy) return '';
      const fs = scale[primarySize('xs')];
      const parts: string[] = [];

      if (cfg.showReturnWindow !== false && r.windowDays != null) {
        parts.push(`<div style="font-weight:600;">Returns accepted within ${r.windowDays} days with receipt.</div>`);
      }
      if (cfg.showRestockingFee !== false && r.restockingFeePct != null) {
        parts.push(`<div>A ${r.restockingFeePct}% restocking fee may apply.</div>`);
      }
      if (r.terms) parts.push(`<div style="margin-top:0.6mm;">${escapeHtml(r.terms)}</div>`);

      return `<div style="${style}font-size:${fs}pt;color:#555;line-height:1.35;">${parts.join('')}</div>`;
    }

    // ── Compliance ─────────────────────────────────────────────────────────
    case 'rxDetails': {
      const rx = buildRxDetails(data);
      if (!rx.hasRx) return '';
      const fs = scale[primarySize('sm')];

      const visible = rx.lines.filter((l) => {
        if (l.label === 'Prescriber' && cfg.showPrescriber === false) return false;
        if (l.label === 'Refills' && cfg.showRefills === false) return false;
        return true;
      });

      const rows = visible.map((l) =>
        `<div style="display:flex;justify-content:space-between;gap:3mm;${l.emphasis ? 'font-weight:600;' : ''}">
           <span style="color:#555;">${escapeHtml(l.label)}</span><span>${escapeHtml(l.value)}</span>
         </div>`
      ).join('');

      // Pharmacist sign-off — who verified the dispense.
      const signoff = cfg.showPharmacistSignoff !== false && rx.pharmacistName
        ? `<div style="font-size:${scale.fine}pt;color:#555;margin-top:1mm;">Dispensed by ${escapeHtml(rx.pharmacistName)}</div>`
        : '';
      const counsel = rx.counsellingNotice
        ? `<div style="font-size:${scale.fine}pt;color:#555;">${escapeHtml(rx.counsellingNotice)}</div>`
        : '';

      return `<div style="${style}font-size:${fs}pt;">${rows}${signoff}${counsel}</div>`;
    }

    case 'batchExpiry': {
      const rows = buildBatchExpiry(data);
      if (!rows.length) return '';
      // Identifier label is jurisdiction data — NDC (US), DIN (CA), PZN (DE).
      const idLabel = data.drugIdentifierLabel || 'Drug ID';
      const fs = scale[primarySize('xs')];

      const body = rows.map((r) => {
        const bits: string[] = [];
        if (cfg.showDrugIdentifier !== false && r.drugId) bits.push(`${escapeHtml(idLabel)}: ${escapeHtml(r.drugId)}`);
        if (cfg.showLotNumber !== false && r.lotNumber)   bits.push(`Lot: ${escapeHtml(r.lotNumber)}`);
        // Beyond-use date is the operative date for the patient.
        if (r.expiry) bits.push(`Use by: ${escapeHtml(r.expiry)}`);
        if (!bits.length) return '';
        return `<div style="margin-bottom:0.8mm;">
          <div style="font-weight:600;">${escapeHtml(r.itemName)}</div>
          <div style="color:#555;">${bits.join(' · ')}</div>
        </div>`;
      }).join('');

      return `<div style="${style}font-size:${fs}pt;">${body}</div>`;
    }

    case 'serialCapture': {
      // A warranty claim requires the receipt to carry matching serial numbers.
      const rows = buildSerialRows(data);
      if (!rows.length) return '';
      const fs = scale[primarySize('xs')];

      const body = rows.map((r) => {
        const bits: string[] = [];
        if (r.serialNumber) bits.push(`S/N: ${escapeHtml(r.serialNumber)}`);
        if (cfg.showImei !== false && r.imei) bits.push(`IMEI: ${escapeHtml(r.imei)}`);
        return `<div style="display:flex;justify-content:space-between;gap:3mm;margin-bottom:0.5mm;">
          <span>${escapeHtml(r.itemName)}</span>
          <span style="color:#555;">${bits.join(' · ')}</span>
        </div>`;
      }).join('');

      return `<div style="${style}font-size:${fs}pt;">${body}</div>`;
    }

    case 'warranty': {
      const rows = buildWarrantyRows(data);
      if (!rows.length) return '';
      const fs = scale[primarySize('xs')];

      const body = rows.map((r) => {
        const bits: string[] = [];
        if (r.term) bits.push(escapeHtml(r.term));
        if (cfg.showWarrantyExpiry !== false && r.expiry) bits.push(`until ${escapeHtml(r.expiry)}`);
        return `<div style="display:flex;justify-content:space-between;gap:3mm;margin-bottom:0.5mm;">
          <span>${escapeHtml(r.itemName)}</span>
          <span style="color:#555;">${bits.join(' ')}</span>
        </div>`;
      }).join('');

      return `<div style="${style}font-size:${fs}pt;">${body}</div>`;
    }

    case 'fiscal': {
      // Signature comes from the certified backend integration — never generated
      // here. See fiscalBlockModel.ts for why.
      const fx = buildFiscal(data, {
        required: data.fiscalizationEnabled != null ? Boolean(data.fiscalizationEnabled) : undefined,
      });
      if (!fx.required) return '';

      const fs = scale.fine;

      // Required by law but absent — must be conspicuous. A receipt that looks
      // complete but lacks its signature is worse than one that obviously does not.
      if (fx.isMissing) {
        return `<div style="${alignStyle(cfg.align || 'center')}font-size:${scale[primarySize('sm')]}pt;font-weight:bold;border:0.4mm solid #000;padding:1.5mm;margin:1mm 0;">${escapeHtml(FISCAL_MISSING_NOTICE)}</div>`;
      }

      /*
       * The fiscal QR must be REAL. In fiscalized jurisdictions (PT ATCUD,
       * AT RKSV, IT RT ...) a tax inspector scans it to verify the document
       * against the authority's records. A decorative QR — which is what this
       * drew before — makes the receipt non-compliant while looking correct.
       *
       * If it cannot be encoded, print nothing rather than a pattern that
       * cannot be scanned; the signature text below still carries the value.
       */
      const fiscalQr = cfg.showFiscalQr !== false && fx.qrPayload
        ? buildQrCode(fx.qrPayload, (paperSize === 'a4' ? 20 : 16) * 3.78)
        : null;
      const qrSizeMm = paperSize === 'a4' ? 20 : 16;
      const qr = fiscalQr
        ? `<div style="height:${qrSizeMm}mm;">${fiscalQr.svg}</div>`
        : '';

      const lines: string[] = [];
      if (fx.documentId) lines.push(`${escapeHtml(fx.documentIdLabel)}: ${escapeHtml(fx.documentId)}`);
      if (cfg.showFiscalSignature !== false && fx.signature) {
        // Signatures are long; truncate for legibility. The QR carries the full value.
        const shown = fx.signature.length > 40 ? `${fx.signature.slice(0, 40)}…` : fx.signature;
        lines.push(escapeHtml(shown));
      }
      if (cfg.showFiscalDeviceInfo !== false) {
        if (fx.softwareId)   lines.push(`Software: ${escapeHtml(fx.softwareId)}`);
        if (fx.deviceSerial) lines.push(`Device: ${escapeHtml(fx.deviceSerial)}`);
      }

      const text = lines.length
        ? `<div style="font-size:${fs}pt;color:#555;word-break:break-all;line-height:1.3;">${lines.join('<br/>')}</div>`
        : '';

      return `<div style="${alignStyle(cfg.align || 'center')}display:flex;flex-direction:column;align-items:center;gap:1mm;">${qr}${text}</div>`;
    }

    case 'dutyFree': {
      const lines = buildDutyFreeLines(data, cfg.dutyFreeFields as string[] | undefined, cfg);
      if (lines.length === 0) return '';

      const fs = scale[primarySize('sm')];
      const rows = lines.map((l) =>
        `<div style="display:flex;justify-content:space-between;gap:3mm;padding:0.3mm 0;">
           <span style="color:#555;">${escapeHtml(l.label)}</span>
           <span style="font-weight:600;">${escapeHtml(l.value)}</span>
         </div>`
      ).join('');

      return `<div style="${style}font-size:${fs}pt;">${rows}</div>`;
    }

    case 'taxRefund': {
      const lines = buildTaxRefundLines(data);
      const r = data.taxRefund || {};
      const showBreakdown = cfg.showRefundBreakdown !== false;
      const hasAmounts = r.adminCharge != null || r.refundDue != null;
      if (lines.length === 0 && !hasAmounts) return '';

      const fs = scale[primarySize('sm')];
      const rows = lines.map((l) =>
        `<div style="display:flex;justify-content:space-between;gap:3mm;padding:0.3mm 0;">
           <span style="color:#555;">${escapeHtml(l.label)}</span>
           <span>${escapeHtml(l.value)}</span>
         </div>`
      ).join('');

      // The retailer must state the admin charge and the refund actually due —
      // the traveller is entitled to know what the operator deducts.
      const amounts = showBreakdown && hasAmounts
        ? `${r.adminCharge != null
            ? `<div style="display:flex;justify-content:space-between;gap:3mm;"><span style="color:#555;">Admin charge</span><span>${money(r.adminCharge, currency)}</span></div>` : ''}
           ${r.refundDue != null
            ? `<div style="display:flex;justify-content:space-between;gap:3mm;font-weight:600;border-top:0.2mm solid #999;padding-top:0.6mm;margin-top:0.6mm;"><span>Refund due</span><span>${money(r.refundDue, currency)}</span></div>` : ''}`
        : '';

      // Customs validation is required before any refund is paid.
      const note = `<div style="font-size:${scale.fine}pt;color:#555;margin-top:1.5mm;line-height:1.35;">Present this form, the goods and your passport to customs for validation before departure.</div>`;

      return `<div style="${style}font-size:${fs}pt;">${rows}${amounts}${note}</div>`;
    }

    case 'reprintNotice': {
      // Suppression is handled centrally (see isBlockSuppressed) so a duty-free
      // document can never be stamped. Reaching here means it is allowed.
      const text = cfg.reprintText || DEFAULT_REPRINT_TEXT;
      return `<div style="${alignStyle(cfg.align || 'center')}font-size:${scale[primarySize('sm')]}pt;font-weight:bold;letter-spacing:0.08em;border:0.4mm solid #000;padding:1.5mm;margin:1mm 0;">${escapeHtml(text)}</div>`;
    }

    case 'taxSummary': {
      // Tax LABEL is jurisdiction data (VAT / GST / ABST / Sales Tax), never a
      // constant — one template must print correctly in any country.
      const taxLabel = data.taxLabel || 'Tax';
      const summary = buildTaxSummary(data, taxLabel);
      const showTaxable = cfg.showTaxableAmount !== false;
      const showExempt = cfg.showExemptLines !== false;
      const showTotal = cfg.showTaxTotal !== false;
      const showRcNotice = cfg.showReverseChargeNotice !== false;

      const visible = showExempt ? summary.lines : summary.lines.filter((l) => !l.isZeroRated);
      if (summary.isEmpty && !summary.zeroRateReason) return '';

      const fs = scale[primarySize('sm')];
      const fine = scale.fine;

      const rows = visible.map((line) => {
        const taxable = showTaxable && line.taxableAmount != null
          ? ` <span style="font-size:${fine}pt;color:#666;">on ${money(line.taxableAmount, currency)}</span>`
          : '';
        const dim = line.isZeroRated ? 'color:#666;' : '';
        return `<div style="display:flex;justify-content:space-between;gap:3mm;padding:0.3mm 0;${dim}">
          <span>${escapeHtml(line.label)}${taxable}</span>
          <span>${money(line.taxAmount, currency)}</span>
        </div>`;
      }).join('');

      const totalRow = showTotal && visible.length > 1
        ? `<div style="display:flex;justify-content:space-between;gap:3mm;border-top:0.2mm solid #999;padding-top:0.6mm;margin-top:0.6mm;font-weight:600;">
             <span>Total ${escapeHtml(taxLabel)}</span><span>${money(summary.totalTax, currency)}</span>
           </div>`
        : '';

      // A bare 0.00 is not a compliant explanation — state why it is zero-rated.
      const zeroNote = summary.zeroRateReason
        ? `<div style="font-size:${fine}pt;color:#666;padding-top:0.6mm;">${escapeHtml(
            ZERO_RATE_LABELS[summary.zeroRateReason] || 'Zero-rated'
          )}</div>`
        : '';

      // Prescribed wording, required verbatim where reverse charge applies.
      const rcNote = showRcNotice && summary.reverseChargeText
        ? `<div style="font-size:${fine}pt;padding-top:1mm;font-weight:600;">${escapeHtml(summary.reverseChargeText)}</div>`
        : '';

      return `<div style="${style}font-size:${fs}pt;">${rows}${totalRow}${zeroNote}${rcNote}</div>`;
    }

    case 'totals': {
      // Uses the jurisdiction's own tax wording so the totals block agrees with
      // the tax summary above it.
      const taxLabel = data.taxLabel || 'Tax';
      const taxValue = data.taxAmount ?? data.tax;
      // A zero-rated sale has no tax LINE to show — the taxSummary block states
      // the reason. Printing "Tax 0.00" here would just be noise.
      const taxRow = data.zeroRated
        ? ''
        : `<div style="display:flex;justify-content:space-between;padding:0.5mm 0;"><span>${escapeHtml(taxLabel)}</span><span>${money(taxValue, currency)}</span></div>`;
      // discountAmount is mapped in saleToPrintData.ts from sale.discountAmount/
      // sale.discount but was never actually rendered anywhere in this file —
      // a discounted sale's printed total silently included the discount with
      // no line explaining why Subtotal + Tax didn't add up to Total.
      const discountValueRaw = data.discountAmount ?? data.discount;
      const discountValue = discountValueRaw != null ? parseFloat(String(discountValueRaw)) : 0;
      const discountRow = discountValue && discountValue > 0
        ? `<div style="display:flex;justify-content:space-between;padding:0.5mm 0;color:#166534;"><span>Discount${data.discountLabel ? ' (' + escapeHtml(String(data.discountLabel)) + ')' : ''}</span><span>-${money(discountValue, currency)}</span></div>`
        : '';
      return `<div style="font-size:${scale[primarySize('sm')]}pt;">
        <div style="display:flex;justify-content:space-between;padding:0.5mm 0;"><span>Subtotal</span><span>${money(data.subtotal, currency)}</span></div>
        ${discountRow}
        ${taxRow}
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:${scale[primarySize('lg')]}pt;border-top:0.5mm solid #000;padding-top:1mm;margin-top:1mm;"><span>Total</span><span>${money(data.total, currency)}</span></div>
      </div>`;
    }

    case 'payment':
      // Sits directly under the `totals` block's bold grand Total — with no
      // separation, a payment-amount line that (correctly) equals the total
      // for a fully-paid sale reads as an unlabeled duplicate total rather
      // than "how this was paid." A top border/margin plus a "Paid via"
      // label removes that ambiguity. (The leaked raw payment_method_id
      // string that used to appear here — e.g. a UUID-looking value — was a
      // separate backend bug in salesController.js's name lookup fallback,
      // fixed there; this block just renders whatever label it's given.)
      return `<div style="${style}display:flex;justify-content:space-between;font-size:${scale[primarySize('sm')]}pt;color:#555;border-top:0.2mm solid #ddd;margin-top:1.5mm;padding-top:1.5mm;">
        <span>Paid via ${escapeHtml(data.payment?.method || 'Payment')}</span>
        <span>${money(data.payment?.amount ?? data.total, currency)}</span>
      </div>`;

    case 'terms':
      return `<div style="${style}font-size:${scale[primarySize('xs')]}pt;color:#555;">${escapeHtml(cfg.content || data.terms || '')}</div>`;

    case 'compliance': {
      const lines: string[] = fields.length ? fields.map((f) => f.value || f.label) : (data.legalText || []);

      // The export declaration ("goods must leave the territory") is legal
      // text, not traveller data — it belongs with the other compliance
      // wording, not bolted onto the passport/flight block. It's sourced
      // from the jurisdiction profile (terms vary tenant to tenant, country
      // to country) and only ever applies to a duty-free/export sale.
      const decl = isDutyFreeOrExport(data) ? (data.exportDeclaration || data.exportDeclarationText) : null;
      const allLines = decl ? [...lines, decl] : lines;
      if (!allLines.length) return '';
      return `<div style="font-size:${scale[primarySize('fine')]}pt;color:#555;">${allLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}</div>`;
    }

    case 'barcode': {
      /*
       * A REAL, scannable code — see barcodeModel.
       *
       * This used to draw a decorative SVG whose bar widths came from character
       * codes: it looked like a barcode and scanned as nothing. Harmless while
       * this renderer only fed the designer preview; not harmless once real
       * sales printed through it.
       *
       * Nothing is printed when there is no value to encode. A barcode that
       * scans to the wrong thing is worse than none: a cashier with no barcode
       * looks the sale up by hand, a cashier scanning a bogus one refunds the
       * wrong transaction.
       */
      const heightMm = paperSize === 'a4' ? 10 : 8;
      const qrSizeMm = paperSize === 'a4' ? 18 : 14;
      const scannable = buildScannable(cfg, data, {
        heightPx: heightMm * 3.78,
        qrSizePx: qrSizeMm * 3.78,
      });
      if (!scannable) return '';

      /*
       * The caption beneath the code is a scan-fallback, not a second place to
       * print the document number — a tenant who switches showNumberOnInvoice
       * OFF means the number gone from the page, not moved under the QR.
       *
       * Scoped narrowly: only suppressed when (a) this is a page-class
       * document (a4/letter/legal — a thermal receipt's caption is the ONLY
       * place its number appears by design, see documentNumberVisibility),
       * and (b) the encoded value actually IS the document/invoice/order
       * number. A barcode encoding a SKU or a customer ID is unrelated to this
       * setting and must never be blanked by it.
       */
      const numberSource = !cfg.barcodeSource || ['receiptNo', 'invoiceNo', 'orderNo'].includes(cfg.barcodeSource);
      const isPageDocument = classifyDocument(undefined, paperSize) === 'invoice';
      const showCaption = !(numberSource && isPageDocument
        && !shouldShowDocumentNumber(undefined, paperSize, data));

      return `<div style="display:flex;flex-direction:column;align-items:center;gap:1mm;">
        <div style="height:${cfg.symbology === 'qr' ? qrSizeMm : heightMm}mm;">${scannable.svg}</div>
        ${showCaption ? `<span style="font-size:${scale.fine}pt;letter-spacing:0.1em;">${escapeHtml(scannable.value)}</span>` : ''}
      </div>`;
    }

    case 'signatures':
      return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;padding-top:4mm;font-size:${scale[primarySize('xs')]}pt;color:#555;">
        <div style="border-top:0.2mm dashed #999;padding-top:1mm;text-align:center;">${escapeHtml(data.signatures?.customer || 'Customer Signature')}</div>
        <div style="border-top:0.2mm dashed #999;padding-top:1mm;text-align:center;">${escapeHtml(data.signatures?.authorized || 'Authorized Signature')}</div>
      </div>`;

    case 'price':
      return `<div style="${style}font-size:${scale[primarySize('lg')]}pt;font-weight:600;">${money(data.sellingPrice ?? data.total, currency)}</div>`;

    case 'footer': {
      const lines: string[] = fields.length ? fields.map((f) => f.label) : (cfg.lines || data.footer || []);
      if (!lines.length) return '';
      return `<div style="${style}font-size:${scale[primarySize('xs')]}pt;color:#555;">${lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}</div>`;
    }

    case 'parties': {
      /*
       * Bill to | Ship to | Details, grouped in one tinted band.
       *
       * Ship to appears only when a shipping address exists AND differs from
       * billing — see shouldShowShipTo. Most retail has no separate delivery
       * address, and a "Ship to" column repeating the billing one is noise on
       * every counter sale.
       *
       * The column count follows the data, so the band stays balanced whether
       * there are two columns or three.
       */
      const columns = buildParties(data, cfg);
      if (!columns.length) return '';

      const tint = cfg.bandTint === false ? '' : 'background:#f6f7f8;border-radius:1.6mm;';
      const cells = columns.map((col) => `<div>
        <span style="display:block;font-size:${scale.fine}pt;text-transform:uppercase;letter-spacing:.09em;color:#8b8f96;margin-bottom:1.1mm;">${escapeHtml(col.label)}</span>
        ${col.heading ? `<div style="font-weight:600;">${escapeHtml(col.heading)}</div>` : ''}
        ${col.lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
      </div>`).join('');

      return `<div style="${tint}padding:4mm 5mm;display:grid;grid-template-columns:repeat(${columns.length},minmax(0,1fr));gap:6mm;font-size:${scale[primarySize('sm')]}pt;line-height:1.6;">${cells}</div>`;
    }

    case 'pageFooter': {
      /*
       * Store identity at the FOOT of the page.
       *
       * Repeated on every printed page by the stylesheet in buildPrintableHtml,
       * not just emitted once here — an invoice that runs to two pages must
       * carry the seller's address and tax number on both, or page two is not a
       * compliant document on its own.
       */
      const footer = buildPageFooter(data, cfg);
      if (!footer) return '';

      return `<div class="doc-page-footer" style="border-top:0.25mm solid #e3e5e8;padding-top:2mm;margin-top:4mm;display:flex;justify-content:space-between;gap:6mm;font-size:${scale.fine}pt;color:#8b8f96;line-height:1.6;">
        <div>${escapeHtml(footer.left)}</div>
        <div style="text-align:right;">${footer.right.map((r) => `<div>${escapeHtml(r)}</div>`).join('')}</div>
      </div>`;
    }

    case 'custom': {
      /*
       * Shared with TemplateCanvas via buildCustomRows.
       *
       * Accessor support was added HERE first — so a refund slip could name the
       * sale it reverses — and the canvas kept resolving only `value`. The
       * designer showed "Original Sale —" for a document that printed the real
       * number. One builder, so that cannot happen again.
       */
      const rows = buildCustomRows(fields, data);
      if (!rows.length) return '';
      return `<div style="${style}">${rows.map((r) =>
        `<div style="display:flex;justify-content:space-between;gap:2mm;"><span style="color:#777;">${escapeHtml(r.label)}</span><span>${escapeHtml(r.value)}</span></div>`
      ).join('')}</div>`;
    }

    default:
      return '';
  }
};

/** Builds a complete, physically-sized HTML document for the given template. */
export const buildPrintableHtml = (
  blocks: TemplateBlock[],
  fixtureData: any,
  paperSize: PaperSize,
  storeLogoUrl?: string | null,
): string => {
  const physical = PAPER_SIZE_PHYSICAL[paperSize];
  const isThermal = paperSize === '58mm' || paperSize === '80mm';
  const data = fixtureData || {};

  // Mode rules override the template's own visibility flags. A duty-free
  // document must never carry a reprint stamp, and a gift receipt must never
  // reveal price — neither is negotiable by template configuration.
  const sortedBlocks = [...blocks]
    .filter((b) => b.visible && !isBlockSuppressed(b, data))
    .sort((a, b) => a.order - b.order);

  const blockHtml = sortedBlocks
    .map((block) => renderBlockHtml(block, data, paperSize, storeLogoUrl))
    .filter(Boolean)
    .join(`<div style="height:${isThermal ? 2 : 3}mm;"></div>`);

  const pageRule = physical.height
    ? `@page { size: ${physical.width} ${physical.height}; margin: ${physical.margin}; }`
    : `@page { size: ${physical.width} auto; margin: ${physical.margin}; }`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Print Preview</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ${isThermal ? "'Courier New', monospace" : "Arial, Helvetica, sans-serif"};
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { width: 100%; }

    /*
     * The page footer repeats on EVERY printed page.
     *
     * An invoice that runs to a second page must still carry the seller's
     * address and tax number, or that page is not a compliant document on its
     * own. A fixed-position element inside a paged context is what browsers
     * repeat per page; a footer left in normal flow lands once, after the last
     * block. (No backticks in this comment — it sits inside a template literal
     * and a stray backtick terminates the whole document string.)
     *
     * Only on paged sizes. A thermal roll has no page boundaries, and pinning
     * the footer there would overlay it on the receipt body.
     */
    ${isThermal ? '' : `
    @media print {
      .doc-page-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        margin-top: 0 !important;
        background: #fff;
      }
      body { padding-bottom: 16mm; }
    }`}
  </style>
</head>
<body>
  ${blockHtml}
</body>
</html>`;
};

/** Opens the given HTML in a hidden iframe and triggers the browser print
 * dialog — matches the existing app convention (see printerService.ts). */
export const printHtmlDocument = (html: string): void => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Unable to access print frame document.');
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    const win = iframe.contentWindow as Window;
    win.focus();
    win.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
};
