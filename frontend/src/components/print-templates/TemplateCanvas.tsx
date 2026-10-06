import React from 'react';
import { TemplateBlock, PaperSize, PAPER_SIZE_WIDTH_PX, TemplateField } from '@/types/printTemplate';
import { Image as ImageIcon, Eye, EyeOff, Trash2, GripVertical } from 'lucide-react';
import { buildTaxSummary, ZERO_RATE_LABELS } from '@/utils/taxSummaryModel';
import {
  isBlockSuppressed, isGiftMode, filterGiftModeColumns, isDutyFreeOrExport,
  buildDutyFreeLines, buildTaxRefundLines, DEFAULT_REPRINT_TEXT,
} from '@/utils/salesModeRules';
import {
  buildSavings, buildLoyalty, buildChangeDue, buildReturnPolicy,
  buildRxDetails, buildBatchExpiry, buildSerialRows, buildWarrantyRows,
  buildCustomRows,
  BLOCK_EMPTY_HINTS,
} from '@/utils/verticalBlockModel';
import { buildFiscal, FISCAL_MISSING_NOTICE, FISCAL_DESIGNER_HINT } from '@/utils/fiscalBlockModel';
import { buildDocumentHeader } from '@/utils/documentHeaderModel';
import { buildScannable, resolveBarcodeValue } from '@/utils/barcodeModel';
import { buildParties, buildPageFooter } from '@/utils/documentSectionsModel';
import { shouldShowDocumentNumber, classifyDocument } from '@/utils/documentNumberVisibility';
import {
  resolveColumns, buildWeighedSubLine, buildTaxFlagLegend,
  MONEY_ACCESSORS as TABLE_MONEY_ACCESSORS,
  WEIGHT_ACCESSORS as TABLE_WEIGHT_ACCESSORS,
} from '@/utils/itemTableModel';

interface TemplateCanvasProps {
  paperSize: PaperSize;
  blocks: TemplateBlock[];
  fixtureData: any;
  /** Store logo from Settings → General. Used automatically by Logo blocks
   * unless the block has an explicit imageUrl override. */
  storeLogoUrl?: string | null;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleVisibility: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
}

const money = (n: unknown, currency = 'USD') => {
  const num = typeof n === 'number' ? n : parseFloat(String(n ?? 0));
  if (Number.isNaN(num)) return String(n ?? '');
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
};

const alignClass = (align?: string) =>
  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

/** Returns the configured font-size key for a block, or a per-block default. */
const getPrimarySize = (block: TemplateBlock, fallback: FontKey = 'sm'): FontKey =>
  (block.config?.fontSize as FontKey) || fallback;

/**
 * Paper-aware type scale. Thermal receipts are naturally cramped (8-11pt on
 * real hardware), but A4/Letter documents follow standard invoice typography
 * guidance: ~10-12pt body, ~12-14pt emphasis, ~14-18pt headers, ~8-10pt fine
 * print. Using one flat size for every paper size was the main reason the A4
 * preview looked wrong — this fixes that.
 */
type FontKey = 'fine' | 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'title';
const FONT_SCALE: Record<PaperSize, Record<FontKey, string>> = {
  '58mm': { fine: 'text-[7px]', xs: 'text-[8px]', sm: 'text-[9px]', base: 'text-[10px]', lg: 'text-[12px]', xl: 'text-[14px]', title: 'text-[15px]' },
  '80mm': { fine: 'text-[8px]', xs: 'text-[9px]', sm: 'text-[10px]', base: 'text-[11px]', lg: 'text-[13px]', xl: 'text-[15px]', title: 'text-[16px]' },
  a4: { fine: 'text-[10px]', xs: 'text-[11px]', sm: 'text-[12px]', base: 'text-[13px]', lg: 'text-[16px]', xl: 'text-[20px]', title: 'text-[24px]' },
  label: { fine: 'text-[7px]', xs: 'text-[8px]', sm: 'text-[9px]', base: 'text-[10px]', lg: 'text-[12px]', xl: 'text-[14px]', title: 'text-[15px]' },
};

const MONEY_ACCESSORS = new Set(['unitPrice', 'lineTotal', 'makingCharge', 'amount', 'price']);
const WEIGHT_ACCESSORS = new Set(['netWeight', 'grossWeight']);

/** Resolves what a barcode/QR block should encode, based on its configured source. */
/** @deprecated Import from @/utils/barcodeModel. Re-exported for compatibility. */
export { resolveBarcodeValue };


const resolveAccessorValue = (item: any, accessor?: string, currency?: string, row?: any) => {
  if (!accessor) return '—';
  const value = item?.[accessor];
  if (value === undefined || value === null || value === '') {
    // An absent tax flag means "not applicable" — blank, not a placeholder.
    return accessor === 'taxFlag' ? '' : '—';
  }
  if (accessor === 'taxFlag') return String(value);
  if (TABLE_MONEY_ACCESSORS.has(accessor)) return money(value, currency);
  if (TABLE_WEIGHT_ACCESSORS.has(accessor)) {
    // Use the item's own unit — the app supports g / oz / tola / baht / kg.
    const unit = (row || item)?.weightUnit || 'g';
    return `${value}${unit}`;
  }
  return String(value);
};

/** Infers sensible default table columns from the shape of the actual sample
 * data, instead of a single hardcoded set — so a jewelry invoice (grossWeight,
 * netWeight, amount) doesn't render a receipt-shaped Qty/Unit-Price table. */
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

/** Renders an authentic-looking barcode using pure CSS bars (deterministic
 * from the code string) instead of a generic placeholder icon. */
const FakeBarcode: React.FC<{ code: string; height?: number }> = ({ code, height = 32 }) => {
  const bars = React.useMemo(() => {
    const source = code || '0000000000';
    const widths: number[] = [];
    for (let i = 0; i < source.length; i += 1) {
      const charCode = source.charCodeAt(i);
      widths.push(1 + (charCode % 3)); // bar width 1-3px, deterministic
    }
    return widths;
  }, [code]);

  return (
    <div className="flex items-end gap-[1.5px]" style={{ height }}>
      {bars.map((w, i) => (
        <div key={i} className="bg-black" style={{ width: `${w}px`, height: '100%' }} />
      ))}
    </div>
  );
};

/** Deterministic pixel-grid "QR-like" placeholder — visually communicates a
 * scannable QR code without needing a QR-generation dependency. */
const FakeQrCode: React.FC<{ code: string; size?: number }> = ({ code, size = 56 }) => {
  const cells = React.useMemo(() => {
    const gridSize = 9;
    const source = code || '0';
    const grid: boolean[] = [];
    for (let i = 0; i < gridSize * gridSize; i += 1) {
      const charCode = source.charCodeAt(i % source.length) + i;
      grid.push(charCode % 3 === 0);
    }
    [0, 8].forEach((cx) => [0, 8].forEach((cy) => {
      if (!(cx === 8 && cy === 8)) {
        for (let dx = 0; dx < 3; dx += 1) {
          for (let dy = 0; dy < 3; dy += 1) {
            grid[(cy + (cy === 0 ? dy : -dy)) * gridSize + (cx + (cx === 0 ? dx : -dx))] = dx === 1 && dy === 1 ? false : true;
          }
        }
      }
    }));
    return grid;
  }, [code]);

  return (
    <div className="grid grid-cols-9 gap-[1px] bg-white p-1 border border-black/10" style={{ height: size, width: size }}>
      {cells.map((filled, i) => (
        <div key={i} className={filled ? 'bg-black' : 'bg-white'} />
      ))}
    </div>
  );
};

/** Renders the content of a single block using fixture data. Falls back gracefully
 * when a field isn't present so the canvas still communicates the block's purpose. */
const renderBlockContent = (block: TemplateBlock, data: any, paperSize: PaperSize, storeLogoUrl?: string | null): React.ReactNode => {
  const cfg = block.config || {};
  const scale = FONT_SCALE[paperSize];
  const primarySize = (key: FontKey): FontKey => (block.config?.fontSize as FontKey) || key;

  /** Designer-only placeholder. A block with no data prints NOTHING on paper —
   *  this text exists so the canvas still communicates the block's purpose. */
  const hint = (blockType: string) => (
    <div
      className="text-[10px] text-muted-foreground/70 italic border border-dashed border-muted-foreground/25 rounded px-1.5 py-0.5 font-sans"
      data-designer-only="true"
    >
      {BLOCK_EMPTY_HINTS[blockType] || 'No data in sample'}
    </div>
  );
  const cls = `${alignClass(cfg.align)} ${scale[primarySize('sm')]} ${cfg.bold ? 'font-bold' : ''}`;
  const fields: TemplateField[] = cfg.fields || [];
  const isThermal = paperSize === '58mm' || paperSize === '80mm';

  switch (block.type) {
    case 'logo': {
      const logoSrc = cfg.imageUrl || storeLogoUrl;
      const layout = (cfg.logoLayout || 'logo_only') as import('@/types/printTemplate').LogoLayout;
      const defaultHeight = paperSize === 'a4' ? 56 : isThermal ? 32 : 28;
      const logoHeight = cfg.logoHeight ? Math.round(cfg.logoHeight * 3.78) : defaultHeight;
      const justifyClass = cfg.align === 'right' ? 'justify-end' : cfg.align === 'center' ? 'justify-center' : 'justify-start';
      const isInline = layout === 'logo_name_inline';
      const showImage = layout === 'logo_only' || layout === 'logo_name'
        || layout === 'logo_name_contact' || isInline;
      const showName = layout !== 'logo_only';
      const showContact = layout === 'logo_name_contact' || layout === 'name_contact';
      const contactFields = new Set<string>(cfg.logoContactFields || ['address', 'phone', 'email']);

      const logoImg = showImage ? (
        logoSrc ? (
          <img src={logoSrc} alt="Logo" style={{ height: logoHeight }} className="object-contain shrink-0" />
        ) : (
          <div
            className="border border-dashed border-muted-foreground/40 rounded flex items-center justify-center text-muted-foreground gap-1 px-2 shrink-0"
            style={{ height: logoHeight, minWidth: logoHeight }}
          >
            <ImageIcon className="h-3 w-3" />
            <span className={FONT_SCALE[paperSize].fine}>Logo</span>
          </div>
        )
      ) : null;

      const storeInfoBlock = (showName || showContact) ? (
        <div className={`${alignClass(cfg.align)} leading-snug`}>
          {showName && (
            <div className={`font-bold ${isInline ? scale.lg : scale.base}`}>{data.storeName || 'Store Name'}</div>
          )}
          {showContact && (
            <div className={`${scale.xs} text-muted-foreground space-y-0`}>
              {contactFields.has('address') && data.storeAddress && <div>{data.storeAddress}</div>}
              {contactFields.has('phone')   && data.storePhone   && <div>{data.storePhone}</div>}
              {contactFields.has('email')   && data.storeEmail   && <div>{data.storeEmail}</div>}
              {contactFields.has('taxId')   && data.storeTaxId   && <div>Tax: {data.storeTaxId}</div>}
            </div>
          )}
        </div>
      ) : null;

      // No-image layouts: just the text block
      if (!showImage) {
        return <div className={alignClass(cfg.align)}>{storeInfoBlock}</div>;
      }

      // Image only (no text alongside)
      if (!storeInfoBlock) {
        return (
          <div className={`flex ${justifyClass} py-1`}>{logoImg}</div>
        );
      }

      // INLINE: mark beside the name on one line, nothing else. Matches the
      // print renderer's `logo_name_inline` branch.
      if (isInline) {
        return (
          <div className="flex items-center gap-3 py-1">{logoImg}{storeInfoBlock}</div>
        );
      }

      // CENTER: image stacked above text, both centered
      if (!cfg.align || cfg.align === 'center') {
        return (
          <div className="flex flex-col items-center gap-1.5 py-1 text-center">
            {logoImg}
            {storeInfoBlock}
          </div>
        );
      }

      // RIGHT: text on the left, image on the right
      if (cfg.align === 'right') {
        return (
          <div className="flex items-center justify-end gap-3 py-1">
            <div className="text-right">{storeInfoBlock}</div>
            {logoImg}
          </div>
        );
      }

      // LEFT (default): image on the left, text to its right
      return (
        <div className="flex items-center gap-3 py-1">
          {logoImg}
          {storeInfoBlock}
        </div>
      );
    }

    case 'header': {
      /*
       * Shared with printTemplateRenderer via documentHeaderModel.
       *
       * This block used to duplicate the print renderer's logic, and the two
       * drifted: the canvas printed a bare `RCT-002250` while print printed
       * `Receipt No. RCT-002250`, and the canvas ignored the tenant's
       * number show/hide setting completely. The designer was misrepresenting
       * the printed output — worse than having no preview, because people
       * check the preview and trust it.
       *
       * Do not reimplement any of this here. If the canvas ever genuinely
       * needs to differ, that belongs in a parameter to buildDocumentHeader.
       */
      const header = buildDocumentHeader(data, cfg, paperSize);

      // Fixed `sm`, not primarySize('sm') — see printTemplateRenderer's
      // case 'header'. cfg.fontSize sizes the TITLE; a header configured
      // large (e.g. 'xl' for "DUTY-FREE INVOICE") was blowing the subtitle up
      // to match, wrapping "Invoice No. ... · Emp: Marcus Hill" onto a
      // stranded second line under right alignment.
      return (
        <div className={cls}>
          <div className={`font-bold ${scale[primarySize('title')]}`}>{header.title}</div>
          {header.parts.length > 0 && (
            <div className={`${scale.sm} text-muted-foreground mt-0.5`}>
              {header.parts.join(' · ')}
            </div>
          )}
        </div>
      );
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
      return (
        <div className={cls}>
          <div className={`font-bold ${scale[primarySize('title')]}`}>{title}</div>
          {subtitleParts.length > 0 && (
            // Fixed `sm`, not primarySize('sm') — see case 'header' above.
            <div className={`${scale.sm} text-muted-foreground`}>
              {subtitleParts.join(' · ')}
            </div>
          )}
        </div>
      );
    }

    case 'customer': {
      const customerFields = new Set(cfg.customerFields || ['name', 'address', 'city', 'phone', 'email', 'taxId', 'passport']);
      const c = data.customer || {};
      const name = customerFields.has('name') ? (c.name || data.customerName || 'Customer Name') : null;
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

      return (
        <div className={cls}>
          {name && <div className={`font-medium ${scale[primarySize('base')]}`}>{name}</div>}
          <div className={`${scale[primarySize('sm')]} text-muted-foreground space-y-0.5`}>
            {address && <div>{address}</div>}
            {city && <div>{city}</div>}
            {email && <div>{email}</div>}
            {phone && <div>{phone}</div>}
            {taxOrPassport && <div>{taxOrPassport}</div>}
          </div>
        </div>
      );
    }

    case 'address': {
      const addressType = cfg.addressType || 'billing';
      const billing = data.customer?.billingAddress || data.customer?.address || data.customer?.addressLine1 || '';
      const shipping = data.customer?.shippingAddress || data.customer?.address || data.customer?.addressLine1 || '';
      const showBilling = addressType === 'billing' || addressType === 'both';
      const showShipping = addressType === 'shipping' || addressType === 'both';
      return (
        <div className={`${cls} space-y-1`}>
          {showBilling && (
            <div>
              <div className={`${scale.fine} text-muted-foreground uppercase tracking-wide`}>Billing Address</div>
              <div className={scale[primarySize('sm')]}>{billing}</div>
            </div>
          )}
          {showShipping && (
            <div>
              <div className={`${scale.fine} text-muted-foreground uppercase tracking-wide`}>Shipping Address</div>
              <div className={scale[primarySize('sm')]}>{shipping}</div>
            </div>
          )}
        </div>
      );
    }

    case 'table': {
      const items = Array.isArray(data.items) ? data.items : [];
      const gift = isGiftMode(cfg, data);

      // Gift receipts show what was bought, never what it cost.
      const configured: TemplateField[] = filterGiftModeColumns(
        fields.length ? fields : inferDefaultColumns(items),
        gift,
      );
      // Only append a tax-flag column when the data actually carries flags —
      // otherwise it would render a column of dashes.
      const columns = resolveColumns(configured, items, {
        taxFlagColumn: Boolean(cfg.tableTaxFlagColumn) && !gift,
      });

      const rows = items.length ? items : [{}];
      const showHeader = cfg.tableShowHeader !== false;
      const zebra      = !!cfg.tableZebra;
      const rowPy      = cfg.tableCompact ? 'py-0.5' : 'py-1';
      const legend     = cfg.tableTaxFlagColumn && !gift ? buildTaxFlagLegend(items) : null;

      return (
        <>
          <table className={`w-full border-collapse ${scale[primarySize('sm')]}`}>
            {showHeader && (
              <thead>
                <tr className="border-b-2 border-black/70">
                  {columns.map((col, i) => (
                    <th key={col.id} className={`${rowPy} font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>
                      {col.label ?? col.accessor}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((item: any, idx: number) => {
                // Weighed produce/deli carries a sub-line showing the measured
                // weight and rate, so the customer can verify the scale.
                const sub = !gift && cfg.weighedItemMode !== false
                  ? buildWeighedSubLine(item, (v) => money(v, data.currency))
                  : null;
                const zebraCls = zebra && idx % 2 === 1 ? 'bg-black/3' : '';
                return (
                  <React.Fragment key={idx}>
                    <tr className={`${sub ? '' : 'border-b border-dashed border-black/15'} ${zebraCls}`}>
                      {columns.map((col, i) => (
                        <td key={col.id} className={`${rowPy} ${i === 0 ? '' : 'text-right'}`}>
                          {resolveAccessorValue(item, col.accessor, data.currency, item)}
                        </td>
                      ))}
                    </tr>
                    {sub && (
                      <tr className={`border-b border-dashed border-black/15 ${zebraCls}`}>
                        <td colSpan={columns.length} className={`${scale.fine} text-muted-foreground pl-3 pb-1`}>
                          {sub}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {legend && (
            <div className={`${scale.fine} text-muted-foreground mt-1`}>{legend}</div>
          )}
        </>
      );
    }

    // "Attributes" gives a compact one-line summary (category-style chips);
    // "Purity & Weight" gives a fuller gross/net/rate breakdown table — the
    // two are deliberately different so they aren't redundant on the same document.
    case 'attributes': {
      const item = data.items?.[0] || {};
      const chips = fields.length
        ? fields
        : [
            { id: 'purity', label: 'Purity', value: item.purity },
            { id: 'huid', label: 'HUID', value: item.huid },
          ].filter((f) => f.value);
      return chips.length ? (
        <div className={`${cls} flex flex-wrap gap-1.5`}>
          {chips.map((f) => (
            <span key={f.id} className={`inline-flex items-center gap-1 border border-black/20 rounded-full px-2 py-0.5 ${scale[primarySize('xs')]}`}>
              <span className="text-muted-foreground">{f.label}</span> {f.value}
            </span>
          ))}
        </div>
      ) : (
        hint('attributes')
      );
    }

    case 'purity': {
      const item = data.items?.[0] || {};
      const rows = fields.length
        ? fields
        : [
            { id: 'gross', label: 'Gross Weight', value: item.grossWeight ? `${item.grossWeight}g` : undefined },
            { id: 'net', label: 'Net Weight', value: item.netWeight ? `${item.netWeight}g` : undefined },
            { id: 'rate', label: 'Rate / gram', value: item.ratePerGram ? money(item.ratePerGram, data.currency) : undefined },
            { id: 'making', label: 'Making Charge', value: item.makingCharge !== undefined ? money(item.makingCharge, data.currency) : undefined },
          ].filter((f) => f.value);
      return rows.length ? (
        <table className={`${cls} w-full ${scale[primarySize('sm')]}`}>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td className="py-0.5 text-muted-foreground">{f.label}</td>
                <td className="py-0.5 text-right">{f.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={`${scale.sm} text-muted-foreground italic`}>No purity/weight data in sample data</div>
      );
    }

    case 'gemstones':
      return fields.length ? (
        <div className={`${cls} ${scale[primarySize('sm')]} space-y-0.5`}>
          {fields.map((f) => (
            <div key={f.id}><span className="text-muted-foreground">{f.label}:</span> {f.value || '—'}</div>
          ))}
        </div>
      ) : (
        <div className={`${scale[primarySize('sm')]} text-muted-foreground italic`}>No gemstone details in sample data</div>
      );

    case 'itemAttributes': {
      const items = Array.isArray(data.items) ? data.items : [];
      const rows = items
        .map((item) => {
          const lines = Array.isArray(item.attributeLines) ? item.attributeLines : [];
          if (!lines.length) return null;
          return (
            <div key={item.name} className="mb-1">
              <div className="font-semibold">{item.name || 'Item'}</div>
              {lines.map((line, i) => (
                <div key={i} className={`${scale.fine} text-muted-foreground ml-2`}>{line}</div>
              ))}
            </div>
          );
        })
        .filter(Boolean);
      return rows.length ? (
        <div className={`${cls} ${scale[primarySize('xs')]} space-y-1`}>{rows}</div>
      ) : (
        <div className={`${scale[primarySize('sm')]} text-muted-foreground italic`}>No per-item attributes in sample data</div>
      );
    }

    case 'tax':
      return (
        <div className={`${cls} flex justify-between ${scale[primarySize('sm')]}`}>
          <span>{data.taxLabel || 'Tax'} {data.taxRate ? `(${data.taxRate}%)` : ''}</span>
          <span>{money(data.taxAmount ?? data.tax, data.currency)}</span>
        </div>
      );

    // ── Commercial ─────────────────────────────────────────────────────────
    case 'savings': {
      const sv = buildSavings(data);
      if (!sv.hasSavings) return hint('savings');
      const label = cfg.savingsLabel || 'YOU SAVED';
      return (
        <div className={`${cls} ${scale[primarySize('sm')]}`}>
          {cfg.showCouponLines !== false && sv.couponLines.map((c, i) => (
            <div key={i} className={`flex justify-between gap-2 ${scale.fine} text-muted-foreground`}>
              <span>{c.description}</span><span>{money(c.amount, data.currency)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-2 font-bold pt-0.5">
            <span>{label}</span><span>{money(sv.total, data.currency)}</span>
          </div>
        </div>
      );
    }

    case 'loyalty': {
      const ly = buildLoyalty(data);
      if (!ly.hasLoyalty) return hint('loyalty');
      const visible = cfg.showPointsBalance === false
        ? ly.lines.filter((x) => x.label !== 'Points balance')
        : ly.lines;
      if (!visible.length) return hint('loyalty');
      return (
        <div className={`${cls} ${scale[primarySize('sm')]}`}>
          {visible.map((x, i) => (
            <div key={i} className={`flex justify-between gap-2 ${x.emphasis ? 'font-medium' : ''}`}>
              <span className="text-muted-foreground">{x.label}</span><span>{x.value}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'changeDue': {
      // Cash only — card sales have no tender or change.
      const cd = buildChangeDue(data);
      if (!cd.hasChange) return hint('changeDue');
      return (
        <div className={`${cls} ${scale[primarySize('sm')]}`}>
          {cd.lines.map((x, i) => (
            <div key={i} className={`flex justify-between gap-2 ${x.emphasis ? 'font-bold' : ''}`}>
              <span>{x.label}</span><span>{money(x.value, data.currency)}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'returnPolicy': {
      const rp = buildReturnPolicy(data, cfg.returnPolicyText as string | undefined);
      if (!rp.hasPolicy) return hint('returnPolicy');
      return (
        <div className={`${cls} ${scale[primarySize('xs')]} text-muted-foreground leading-snug`}>
          {cfg.showReturnWindow !== false && rp.windowDays != null && (
            <div className="font-medium">Returns accepted within {rp.windowDays} days with receipt.</div>
          )}
          {cfg.showRestockingFee !== false && rp.restockingFeePct != null && (
            <div>A {rp.restockingFeePct}% restocking fee may apply.</div>
          )}
          {rp.terms && <div className="mt-0.5">{rp.terms}</div>}
        </div>
      );
    }

    // ── Compliance ─────────────────────────────────────────────────────────
    case 'rxDetails': {
      const rx = buildRxDetails(data);
      if (!rx.hasRx) return hint('rxDetails');
      const visible = rx.lines.filter((l) => {
        if (l.label === 'Prescriber' && cfg.showPrescriber === false) return false;
        if (l.label === 'Refills' && cfg.showRefills === false) return false;
        return true;
      });
      return (
        <div className={`${cls} ${scale[primarySize('sm')]}`}>
          {visible.map((l, i) => (
            <div key={i} className={`flex justify-between gap-2 ${l.emphasis ? 'font-medium' : ''}`}>
              <span className="text-muted-foreground">{l.label}</span><span>{l.value}</span>
            </div>
          ))}
          {cfg.showPharmacistSignoff !== false && rx.pharmacistName && (
            <div className={`${scale.fine} text-muted-foreground mt-1`}>Dispensed by {rx.pharmacistName}</div>
          )}
          {rx.counsellingNotice && (
            <div className={`${scale.fine} text-muted-foreground`}>{rx.counsellingNotice}</div>
          )}
        </div>
      );
    }

    case 'batchExpiry': {
      const rows = buildBatchExpiry(data);
      if (!rows.length) return hint('batchExpiry');
      // Identifier label is jurisdiction data — NDC (US), DIN (CA), PZN (DE).
      const idLabel = data.drugIdentifierLabel || 'Drug ID';
      return (
        <div className={`${cls} ${scale[primarySize('xs')]}`}>
          {rows.map((r, i) => {
            const bits: string[] = [];
            if (cfg.showDrugIdentifier !== false && r.drugId) bits.push(`${idLabel}: ${r.drugId}`);
            if (cfg.showLotNumber !== false && r.lotNumber)   bits.push(`Lot: ${r.lotNumber}`);
            if (r.expiry) bits.push(`Use by: ${r.expiry}`);
            if (!bits.length) return null;
            return (
              <div key={i} className="mb-1">
                <div className="font-medium">{r.itemName}</div>
                <div className="text-muted-foreground">{bits.join(' · ')}</div>
              </div>
            );
          })}
        </div>
      );
    }

    case 'serialCapture': {
      // Warranty claims require the receipt to carry matching serial numbers.
      const rows = buildSerialRows(data);
      if (!rows.length) return hint('serialCapture');
      return (
        <div className={`${cls} ${scale[primarySize('xs')]}`}>
          {rows.map((r, i) => {
            const bits: string[] = [];
            if (r.serialNumber) bits.push(`S/N: ${r.serialNumber}`);
            if (cfg.showImei !== false && r.imei) bits.push(`IMEI: ${r.imei}`);
            return (
              <div key={i} className="flex justify-between gap-2 mb-0.5">
                <span>{r.itemName}</span>
                <span className="text-muted-foreground">{bits.join(' · ')}</span>
              </div>
            );
          })}
        </div>
      );
    }

    case 'warranty': {
      const rows = buildWarrantyRows(data);
      if (!rows.length) return hint('warranty');
      return (
        <div className={`${cls} ${scale[primarySize('xs')]}`}>
          {rows.map((r, i) => {
            const bits: string[] = [];
            if (r.term) bits.push(r.term);
            if (cfg.showWarrantyExpiry !== false && r.expiry) bits.push(`until ${r.expiry}`);
            return (
              <div key={i} className="flex justify-between gap-2 mb-0.5">
                <span>{r.itemName}</span>
                <span className="text-muted-foreground">{bits.join(' ')}</span>
              </div>
            );
          })}
        </div>
      );
    }

    case 'fiscal': {
      const fx = buildFiscal(data, {
        required: data.fiscalizationEnabled != null ? Boolean(data.fiscalizationEnabled) : undefined,
      });
      // In the designer there is no live transaction, so explain rather than
      // render an empty box.
      if (!fx.required) {
        return <div className={`${scale.fine} text-muted-foreground italic`}>{FISCAL_DESIGNER_HINT}</div>;
      }
      if (fx.isMissing) {
        return (
          <div className={`${alignClass(cfg.align || 'center')} ${scale[primarySize('sm')]} font-bold border-2 border-black px-2 py-1 my-1`}>
            {FISCAL_MISSING_NOTICE}
          </div>
        );
      }
      const lines: string[] = [];
      if (fx.documentId) lines.push(`${fx.documentIdLabel}: ${fx.documentId}`);
      if (cfg.showFiscalSignature !== false && fx.signature) {
        lines.push(fx.signature.length > 40 ? `${fx.signature.slice(0, 40)}…` : fx.signature);
      }
      if (cfg.showFiscalDeviceInfo !== false) {
        if (fx.softwareId)   lines.push(`Software: ${fx.softwareId}`);
        if (fx.deviceSerial) lines.push(`Device: ${fx.deviceSerial}`);
      }
      return (
        <div className="flex flex-col items-center gap-1 py-1">
          {cfg.showFiscalQr !== false && fx.qrPayload && (
            <FakeQrCode code={fx.qrPayload} size={paperSize === 'a4' ? 72 : 56} />
          )}
          {lines.length > 0 && (
            <div className={`${scale.fine} text-muted-foreground text-center break-all leading-tight`}>
              {lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      );
    }

    case 'dutyFree': {
      const lines = buildDutyFreeLines(data, cfg.dutyFreeFields as string[] | undefined, cfg);
      if (lines.length === 0) {
        return hint('dutyFree');
      }
      return (
        <div className={`${cls} ${scale[primarySize('sm')]} space-y-0.5`}>
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="font-medium">{l.value}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'taxRefund': {
      const lines = buildTaxRefundLines(data);
      const r = data.taxRefund || {};
      const showBreakdown = cfg.showRefundBreakdown !== false;
      const hasAmounts = r.adminCharge != null || r.refundDue != null;
      if (lines.length === 0 && !hasAmounts) {
        return hint('taxRefund');
      }
      return (
        <div className={`${cls} ${scale[primarySize('sm')]} space-y-0.5`}>
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{l.label}</span>
              <span>{l.value}</span>
            </div>
          ))}
          {showBreakdown && r.adminCharge != null && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Admin charge</span>
              <span>{money(r.adminCharge, data.currency)}</span>
            </div>
          )}
          {showBreakdown && r.refundDue != null && (
            <div className="flex justify-between gap-2 font-medium border-t border-black/20 pt-0.5">
              <span>Refund due</span>
              <span>{money(r.refundDue, data.currency)}</span>
            </div>
          )}
          <div className={`${scale.fine} text-muted-foreground pt-1 leading-snug`}>
            Present this form, the goods and your passport to customs for validation before departure.
          </div>
        </div>
      );
    }

    case 'reprintNotice': {
      // Suppression handled centrally — reaching here means it is permitted.
      const text = cfg.reprintText || DEFAULT_REPRINT_TEXT;
      return (
        <div className={`${alignClass(cfg.align || 'center')} ${scale[primarySize('sm')]} font-bold tracking-wider border-2 border-black px-2 py-1 my-1`}>
          {text}
        </div>
      );
    }

    case 'taxSummary': {
      // The tax LABEL comes from the document data (fed by the jurisdiction
      // profile) — never hardcoded, so one template works in any country.
      const summary = buildTaxSummary(data, data.taxLabel || 'Tax');
      const showTaxable = cfg.showTaxableAmount !== false;
      const showExempt = cfg.showExemptLines !== false;
      const showTotal = cfg.showTaxTotal !== false;
      const showRcNotice = cfg.showReverseChargeNotice !== false;

      const visible = showExempt ? summary.lines : summary.lines.filter((l) => !l.isZeroRated);

      if (summary.isEmpty && !summary.zeroRateReason) {
        return hint('taxSummary');
      }

      return (
        <div className={`${scale[primarySize('sm')]} space-y-0.5`}>
          {visible.map((line, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className={line.isZeroRated ? 'text-muted-foreground' : ''}>
                {line.label}
                {showTaxable && line.taxableAmount != null && (
                  <span className={`${scale.fine} text-muted-foreground ml-1`}>
                    on {money(line.taxableAmount, data.currency)}
                  </span>
                )}
              </span>
              <span className={line.isZeroRated ? 'text-muted-foreground' : ''}>
                {money(line.taxAmount, data.currency)}
              </span>
            </div>
          ))}

          {showTotal && visible.length > 1 && (
            <div className="flex justify-between gap-2 border-t border-black/20 pt-0.5 font-medium">
              <span>Total {data.taxLabel || 'Tax'}</span>
              <span>{money(summary.totalTax, data.currency)}</span>
            </div>
          )}

          {/* Zero-rating must state WHY — a bare 0.00 is not a compliant explanation. */}
          {summary.zeroRateReason && (
            <div className={`${scale.fine} text-muted-foreground pt-0.5`}>
              {ZERO_RATE_LABELS[summary.zeroRateReason] || 'Zero-rated'}
            </div>
          )}

          {/* Prescribed wording — required verbatim where reverse charge applies. */}
          {showRcNotice && summary.reverseChargeText && (
            <div className={`${scale.fine} pt-1 font-medium`}>{summary.reverseChargeText}</div>
          )}
        </div>
      );
    }

    case 'totals': {
      // Uses the jurisdiction's own tax wording, and omits the tax row entirely
      // on a zero-rated sale — the taxSummary block above already states WHY it
      // is zero, so "Tax 0.00" here is duplicate noise.
      //
      // This mirrors the print renderer exactly. An earlier version diverged:
      // print suppressed the row, the canvas did not, so the preview disagreed
      // with the paper.
      const taxLabel = data.taxLabel || 'Tax';
      // Kept in parity with printTemplateRenderer.ts's 'totals' case — a
      // discounted sale used to have no line explaining why Subtotal + Tax
      // didn't add up to Total on either the paper or this preview.
      const discountValueRaw = data.discountAmount ?? data.discount;
      const discountValue = discountValueRaw != null ? parseFloat(String(discountValueRaw)) : 0;
      return (
        <div className={`space-y-1 ${scale[primarySize('sm')]}`}>
          <div className="flex justify-between"><span>Subtotal</span><span>{money(data.subtotal, data.currency)}</span></div>
          {discountValue > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount{data.discountLabel ? ` (${data.discountLabel})` : ''}</span><span>-{money(discountValue, data.currency)}</span>
            </div>
          )}
          {!data.zeroRated && (
            <div className="flex justify-between">
              <span>{taxLabel}</span><span>{money(data.taxAmount ?? data.tax, data.currency)}</span>
            </div>
          )}
          <div className={`flex justify-between font-bold ${scale[primarySize('lg')]} border-t-2 border-black/70 pt-1`}><span>Total</span><span>{money(data.total, data.currency)}</span></div>
        </div>
      );
    }

    case 'payment':
      // Kept in parity with printTemplateRenderer.ts's 'payment' case: a
      // top border/margin + "Paid via" label so this doesn't read as an
      // unlabeled duplicate of the totals block's Total directly above it.
      return (
        <div className={`${cls} flex justify-between ${scale[primarySize('sm')]} text-gray-600 border-t border-gray-300 mt-1.5 pt-1.5`}>
          <span>Paid via {data.payment?.method || 'Payment'}</span>
          <span>{money(data.payment?.amount ?? data.total, data.currency)}</span>
        </div>
      );

    case 'terms': {
      /*
       * The fallback used to be the literal string 'Payment terms and
       * conditions.', which the PRINT renderer does not produce — it emits
       * nothing when there are no terms. The canvas was therefore showing
       * document text that would never appear on paper.
       *
       * Now it renders the designer-only hint, which is visibly a hint
       * (dashed, italic, data-designer-only) rather than content.
       */
      const terms = cfg.content || data.terms;
      if (!terms) return hint('terms');
      return <div className={`${cls} ${scale[primarySize('xs')]} text-muted-foreground`}>{terms}</div>;
    }

    case 'compliance': {
      // Same divergence as `terms` above: the print renderer emits nothing when
      // there is no legal text, so a placeholder here would promise wording
      // that never reaches the page.
      const lines = fields.length ? fields.map((f) => f.value || f.label) : (data.legalText || []);
      // The export declaration lives here, not in the dutyFree block — see
      // the matching comment in printTemplateRenderer.ts's compliance case.
      const decl = isDutyFreeOrExport(data) ? (data.exportDeclaration || data.exportDeclarationText) : null;
      const allLines = decl ? [...lines, decl] : lines;
      if (!allLines.length) return hint('compliance');
      return (
        <div className={`${cls} ${scale[primarySize('fine')]} text-muted-foreground space-y-0.5`}>
          {allLines.map((line: string, idx: number) => <div key={idx}>{line}</div>)}
        </div>
      );
    }

    case 'barcode': {
      /*
       * The SAME real barcode the printer gets — see barcodeModel.
       *
       * The canvas used to draw a decorative approximation and, worse, fall
       * back to the literal '0000000000' when there was no value. So a designer
       * checking their receipt saw a healthy-looking barcode for a document
       * that would print an unscannable one, or one encoding a constant.
       *
       * When there is nothing to encode the block shows the designer hint, so
       * the problem is visible HERE rather than discovered at the till.
       */
      const size = paperSize === 'a4' ? { h: 40, qr: 64 } : { h: 32, qr: 56 };
      const scannable = buildScannable(cfg, data, { heightPx: size.h, qrSizePx: size.qr });
      if (!scannable) return hint('barcode');

      // Same suppression as printTemplateRenderer — see the comment there.
      // The caption is a scan-fallback, not a second place to print the
      // document number; a tenant who switches showNumberOnInvoice OFF means
      // the number gone from the page, not moved under the QR.
      const numberSource = !cfg.barcodeSource || ['receiptNo', 'invoiceNo', 'orderNo'].includes(cfg.barcodeSource);
      const isPageDocument = classifyDocument(undefined, paperSize) === 'invoice';
      const showCaption = !(numberSource && isPageDocument
        && !shouldShowDocumentNumber(undefined, paperSize, data));

      return (
        <div className="flex flex-col items-center gap-1 py-1.5">
          <div
            style={{ height: cfg.symbology === 'qr' ? size.qr : size.h }}
            // The SVG is produced by JsBarcode / qrcode from a value we control,
            // never from user-authored markup.
            dangerouslySetInnerHTML={{ __html: scannable.svg }}
          />
          {showCaption && <span className={`${scale.fine} tracking-widest`}>{scannable.value}</span>}
        </div>
      );
    }

    case 'signatures':
      return (
        <div className={`grid grid-cols-2 gap-4 pt-2 ${scale[primarySize('xs')]} text-muted-foreground`}>
          <div className="border-t border-dashed pt-1 text-center">{data.signatures?.customer || 'Customer Signature'}</div>
          <div className="border-t border-dashed pt-1 text-center">{data.signatures?.authorized || 'Authorized Signature'}</div>
        </div>
      );

    case 'price':
      return <div className={`${cls} ${scale[primarySize('lg')]} font-semibold`}>{money(data.sellingPrice ?? data.total, data.currency)}</div>;

    case 'footer': {
      const lines: string[] = fields.length ? fields.map((f) => f.label) : (cfg.lines || data.footer || ['Thank you for your business!']);
      return (
        <div className={`${cls} ${scale[primarySize('xs')]} text-muted-foreground space-y-0.5`}>
          {lines.map((line, idx) => <div key={idx}>{line}</div>)}
        </div>
      );
    }

    case 'parties': {
      // Shared with printTemplateRenderer via buildParties — including the rule
      // that Ship to appears only when it differs from Bill to.
      const columns = buildParties(data, cfg);
      if (!columns.length) return hint('parties');

      return (
        <div
          className={`${scale[primarySize('sm')]} leading-relaxed`}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            gap: '1.25rem',
            background: cfg.bandTint === false ? undefined : '#f6f7f8',
            borderRadius: cfg.bandTint === false ? undefined : 6,
            padding: cfg.bandTint === false ? undefined : '10px 13px',
          }}
        >
          {columns.map((col) => (
            <div key={col.label}>
              <span className="block text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{col.label}</span>
              {col.heading && <div className="font-semibold">{col.heading}</div>}
              {col.lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          ))}
        </div>
      );
    }

    case 'pageFooter': {
      // Repeats on every printed page — see the print stylesheet. The canvas
      // shows it once, at the foot of the proof, which is what a single page
      // looks like.
      const footer = buildPageFooter(data, cfg);
      if (!footer) return hint('pageFooter');

      return (
        <div className={`${scale.fine} text-muted-foreground flex justify-between gap-4 border-t pt-2 mt-2 leading-relaxed`}>
          <div>{footer.left}</div>
          <div className="text-right">{footer.right.map((r, i) => <div key={i}>{r}</div>)}</div>
        </div>
      );
    }

    case 'custom': {
      // Shared with the print renderer via buildCustomRows — see that function
      // for why. Rows resolving to nothing are dropped, not shown as a dash.
      const rows = buildCustomRows(fields, data);
      if (!fields.length) {
        return <div className={`${scale[primarySize('sm')]} text-muted-foreground italic`}>No custom fields added yet — use the panel on the right.</div>;
      }
      if (!rows.length) return hint('custom');
      return (
        <div className={`${cls} ${scale[primarySize('sm')]} space-y-0.5`}>
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{r.label}</span>
              <span>{r.value}</span>
            </div>
          ))}
        </div>
      );
    }

    default:
      return <div className={`${scale.sm} text-muted-foreground italic`}>{block.label || block.type}</div>;
  }
};

// Thermal receipts print with a monospace font on real hardware; A4/labels
// look better with a clean proportional font. Match that here so the canvas
// isn't just a generic wireframe — it should read like the physical output.
const PAPER_FONT_CLASS: Record<PaperSize, string> = {
  '58mm': 'font-mono',
  '80mm': 'font-mono',
  a4: 'font-sans',
  label: 'font-sans',
};

const PAPER_PADDING_CLASS: Record<PaperSize, string> = {
  '58mm': 'p-3',
  '80mm': 'p-4',
  a4: 'p-10',
  label: 'p-2.5',
};

const TemplateCanvas: React.FC<TemplateCanvasProps> = ({
  paperSize, blocks, fixtureData, storeLogoUrl, selectedBlockId, onSelectBlock, onReorder, onToggleVisibility, onDeleteBlock,
}) => {
  const [zoom, setZoom] = React.useState(1);
  const baseWidth = PAPER_SIZE_WIDTH_PX[paperSize];
  const dragIndex = React.useRef<number | null>(null);
  const isThermal = paperSize === '58mm' || paperSize === '80mm';

  // Mode rules override the template's own flags — a duty-free document must
  // never show a reprint stamp, and a gift receipt must never reveal price.
  // Applied here so the designer preview matches what actually prints.
  const sortedBlocks = [...blocks]
    .filter((b) => !isBlockSuppressed(b, fixtureData || {}))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1.5">
        <button
          className="h-6 w-6 flex items-center justify-center rounded border text-xs text-muted-foreground hover:bg-secondary disabled:opacity-30"
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
          disabled={zoom <= 0.6}
        >
          −
        </button>
        <span className="text-[11px] text-muted-foreground w-9 text-center">{Math.round(zoom * 100)}%</span>
        <button
          className="h-6 w-6 flex items-center justify-center rounded border text-xs text-muted-foreground hover:bg-secondary disabled:opacity-30"
          onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
          disabled={zoom >= 1.6}
        >
          +
        </button>
      </div>

      <div className="flex justify-center py-8 bg-secondary/40 rounded-lg border overflow-auto min-h-[520px]">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
          <div
            className={`bg-white text-black ${isThermal ? 'shadow-[0_1px_3px_rgba(0,0,0,0.15),0_8px_20px_rgba(0,0,0,0.12)]' : 'shadow-[0_1px_2px_rgba(0,0,0,0.1),0_12px_28px_rgba(0,0,0,0.15)] rounded-sm border'}`}
            style={{ width: baseWidth, minHeight: paperSize === 'a4' ? 780 : 400, display: 'flex', flexDirection: 'column' }}
          >
            {/*
              * PAGE FOOTER PINNING — on-screen preview only.
              *
              * printTemplateRenderer pins the footer to the bottom of every
              * printed page via `position: fixed` inside `@media print`, which
              * only takes effect on real paper/print-preview. This canvas is a
              * plain on-screen DOM render, so that rule never applies here — the
              * page box below only had a minHeight, and blocks (including
              * pageFooter) simply stacked in flow. On a short document the
              * footer landed right after the last block, well above the bottom
              * edge: "the footer in the middle of the page."
              *
              * Fix: the content wrapper is a flex column that fills the page
              * box (`flex: 1`), and the pageFooter block gets `marginTop: auto`
              * below — so it is pushed to the bottom of the page box exactly
              * once by CSS, whether the document has three lines or thirty.
              */}
            <div className={`${PAPER_PADDING_CLASS[paperSize]} ${PAPER_FONT_CLASS[paperSize]} space-y-3`} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {sortedBlocks.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-12 font-sans">
                  Add blocks from the palette to start designing
                </div>
              )}
              {sortedBlocks.map((block, index) => (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => { dragIndex.current = index; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex.current !== null && dragIndex.current !== index) {
                      onReorder(dragIndex.current, index);
                    }
                    dragIndex.current = null;
                  }}
                  onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }}
                  style={{
                    paddingTop:    block.config?.paddingTop    ? `${block.config.paddingTop}px`    : undefined,
                    paddingBottom: block.config?.paddingBottom ? `${block.config.paddingBottom}px` : undefined,
                    // Pin to the bottom of the page box — see the note above
                    // the flex column this sits in. Only meaningful on a page
                    // that has one; a thermal roll has no bottom edge to pin to.
                    marginTop: block.type === 'pageFooter' && !isThermal ? 'auto' : undefined,
                  }}
                  className={`group relative cursor-pointer rounded transition-colors px-1 py-1 ${
                    !block.visible ? 'opacity-30' : ''
                  } ${
                    selectedBlockId === block.id
                      ? 'ring-2 ring-primary ring-offset-1'
                      : 'hover:ring-1 hover:ring-primary/40'
                  }`}
                >
                  {/* Hover quick-actions, Notion/Airtable style */}
                  <div className="absolute -top-2.5 right-0 hidden group-hover:flex items-center gap-0.5 bg-white border rounded shadow-sm z-10 text-black font-sans">
                    <button
                      className="p-1 hover:bg-secondary rounded-l"
                      title="Drag to reorder"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-3 w-3" />
                    </button>
                    <button
                      className="p-1 hover:bg-secondary"
                      title={block.visible ? 'Hide block' : 'Show block'}
                      onClick={(e) => { e.stopPropagation(); onToggleVisibility(block.id); }}
                    >
                      {block.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                    <button
                      className="p-1 hover:bg-red-50 hover:text-red-600 rounded-r"
                      title="Delete block"
                      onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {renderBlockContent(block, fixtureData || {}, paperSize, storeLogoUrl)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateCanvas;
