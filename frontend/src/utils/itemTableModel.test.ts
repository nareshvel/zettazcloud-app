import { describe, it, expect } from 'vitest';
import {
  TABLE_PRESET_FIELDS, ACCESSOR_GROUPS,
  isWeighedItem, buildWeighedSubLine,
  collectTaxFlags, buildTaxFlagLegend, TAX_FLAG_LABELS,
  resolveColumns, isNumericColumn,
} from './itemTableModel';

/**
 * Items-table model.
 *
 * Two behaviours here have real consequences on a printed receipt:
 *
 *   * a weighed line without its "1.24 kg @ $3.99/kg" sub-line is unverifiable —
 *     the customer cannot check the scale against the price charged
 *   * a tax-flag column on data that carries no flags prints a column of dashes,
 *     which looks like a fault rather than a design choice
 */

const money = (v: unknown) => `$${Number(v).toFixed(2)}`;

describe('table presets', () => {
  const VERTICALS = ['general', 'grocery', 'pharmacy', 'electronics', 'apparel', 'jewelry', 'dutyFree'] as const;

  VERTICALS.forEach((key) => {
    it(`${key} has columns with labels and accessors`, () => {
      const cols = TABLE_PRESET_FIELDS[key];
      expect(cols.length).toBeGreaterThan(0);
      cols.forEach((c) => {
        expect(c.label).toBeTruthy();
        expect(c.accessor).toBeTruthy();
      });
    });
  });

  it('custom is intentionally empty so the user starts from scratch', () => {
    expect(TABLE_PRESET_FIELDS.custom).toEqual([]);
  });

  it('keeps thermal presets narrow enough for an 80mm roll', () => {
    // ~48 characters per line. More than six columns is unreadable, and the
    // grocery preset deliberately moves weight to a sub-line for this reason.
    ['general', 'grocery', 'pharmacy'].forEach((k) => {
      expect(TABLE_PRESET_FIELDS[k as 'general'].length).toBeLessThanOrEqual(5);
    });
  });

  it('grocery shows PLU rather than an internal SKU', () => {
    // Produce is identified by PLU; organic uses a 5-digit code starting with 9.
    const accessors = TABLE_PRESET_FIELDS.grocery.map((c) => c.accessor);
    expect(accessors).toContain('plu');
    expect(accessors).not.toContain('sku');
  });

  it('electronics carries the serial number for warranty claims', () => {
    const accessors = TABLE_PRESET_FIELDS.electronics.map((c) => c.accessor);
    expect(accessors).toContain('serialNumber');
  });

  it('apparel carries size and colour', () => {
    const accessors = TABLE_PRESET_FIELDS.apparel.map((c) => c.accessor);
    expect(accessors).toContain('size');
    expect(accessors).toContain('color');
  });

  it('duty-free omits a tax column, since the supply is tax-free', () => {
    const accessors = TABLE_PRESET_FIELDS.dutyFree.map((c) => c.accessor);
    expect(accessors).not.toContain('taxFlag');
  });
});

describe('accessor groups', () => {
  it('covers every vertical', () => {
    const groups = ACCESSOR_GROUPS.map((g) => g.group);
    ['General', 'Grocery', 'Jewelry', 'Pharmacy', 'Electronics', 'Apparel'].forEach((g) => {
      expect(groups).toContain(g);
    });
  });

  it('has no duplicate accessor values across groups', () => {
    // A duplicate would make the Select ambiguous and the binding unpredictable.
    const all = ACCESSOR_GROUPS.flatMap((g) => g.options.map((o) => o.value));
    expect(new Set(all).size).toBe(all.length);
  });

  it('exposes every accessor used by the shipped presets', () => {
    const available = new Set(ACCESSOR_GROUPS.flatMap((g) => g.options.map((o) => o.value)));
    const used = new Set(
      Object.values(TABLE_PRESET_FIELDS).flat().map((c) => c.accessor!).filter(Boolean),
    );
    const missing = [...used].filter((a) => !available.has(a));
    expect(missing, `preset accessors not offered in the UI: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('weighed items', () => {
  const weighed = { name: 'Bananas', weight: 1.24, weightUnit: 'kg', pricePerUnit: 3.99 };

  it('detects a line priced by weight', () => {
    expect(isWeighedItem(weighed)).toBe(true);
  });

  it('does not treat a normal line as weighed', () => {
    expect(isWeighedItem({ name: 'Milk', qty: 2, unitPrice: 6.2 })).toBe(false);
  });

  it('requires BOTH weight and rate', () => {
    // Weight alone cannot produce a verifiable sub-line.
    expect(isWeighedItem({ weight: 1.24 })).toBe(false);
    expect(isWeighedItem({ pricePerUnit: 3.99 })).toBe(false);
  });

  it('renders the sub-line in the conventional form', () => {
    expect(buildWeighedSubLine(weighed, money)).toBe('1.24 kg @ $3.99/kg');
  });

  it('uses the item’s own unit, not an assumed one', () => {
    const lb = { weight: 2.5, weightUnit: 'lb', pricePerUnit: 4.5 };
    expect(buildWeighedSubLine(lb, money)).toContain('lb');
    expect(buildWeighedSubLine(lb, money)).not.toContain('kg');
  });

  it('returns null for a non-weighed line', () => {
    expect(buildWeighedSubLine({ name: 'Milk' }, money)).toBeNull();
  });
});

describe('tax flags', () => {
  const mixed = [
    { taxFlag: 'N' }, { taxFlag: 'T' }, { taxFlag: 'N' }, { taxFlag: 'T' },
  ];

  it('collects the distinct flags present', () => {
    expect(collectTaxFlags(mixed)).toEqual(['N', 'T']);
  });

  it('builds a legend decoding each flag', () => {
    const legend = buildTaxFlagLegend(mixed)!;
    expect(legend).toContain('T = Taxable');
    expect(legend).toContain('N = Non-taxable');
  });

  it('omits the legend when only one flag is in play', () => {
    // A single marker on every line explains nothing.
    expect(buildTaxFlagLegend([{ taxFlag: 'T' }, { taxFlag: 'T' }])).toBeNull();
  });

  it('omits the legend when there are no flags', () => {
    expect(buildTaxFlagLegend([{ name: 'x' }])).toBeNull();
  });

  it('has a label for every conventional flag', () => {
    ['T', 'N', 'Z', 'E', 'RC'].forEach((f) => expect(TAX_FLAG_LABELS[f]).toBeTruthy());
  });

  it('degrades gracefully for an unrecognised flag', () => {
    const legend = buildTaxFlagLegend([{ taxFlag: 'T' }, { taxFlag: 'Q' }])!;
    expect(legend).toContain('Q =');
  });
});

describe('resolveColumns', () => {
  const base = [
    { id: 'name', label: 'Item', accessor: 'name' },
    { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
  ];

  it('appends a tax-flag column when asked and the data has flags', () => {
    const out = resolveColumns(base, [{ taxFlag: 'T' }], { taxFlagColumn: true });
    expect(out.map((c) => c.accessor)).toContain('taxFlag');
  });

  it('does NOT append it when the data has no flags', () => {
    // Otherwise the receipt prints a column of dashes, which reads as a fault.
    const out = resolveColumns(base, [{ name: 'x' }], { taxFlagColumn: true });
    expect(out.map((c) => c.accessor)).not.toContain('taxFlag');
  });

  it('does not append it when the template did not ask', () => {
    const out = resolveColumns(base, [{ taxFlag: 'T' }], { taxFlagColumn: false });
    expect(out.map((c) => c.accessor)).not.toContain('taxFlag');
  });

  it('does not duplicate an explicitly configured tax-flag column', () => {
    const withFlag = [...base, { id: 'f', label: 'Tax', accessor: 'taxFlag' }];
    const out = resolveColumns(withFlag, [{ taxFlag: 'T' }], { taxFlagColumn: true });
    expect(out.filter((c) => c.accessor === 'taxFlag')).toHaveLength(1);
  });

  it('leaves the configured columns untouched otherwise', () => {
    expect(resolveColumns(base, [], {})).toHaveLength(2);
  });
});

describe('isNumericColumn', () => {
  it('right-aligns money and quantity columns', () => {
    ['unitPrice', 'lineTotal', 'amount', 'qty', 'netWeight'].forEach((a) => {
      expect(isNumericColumn(a)).toBe(true);
    });
  });

  it('left-aligns text columns', () => {
    ['name', 'sku', 'size', 'color', 'purity'].forEach((a) => {
      expect(isNumericColumn(a)).toBe(false);
    });
  });

  it('handles an undefined accessor', () => {
    expect(isNumericColumn(undefined)).toBe(false);
  });
});
