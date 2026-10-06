import { describe, it, expect } from 'vitest';
import {
  buildSavings, buildLoyalty, buildChangeDue, buildReturnPolicy,
  buildRxDetails, buildBatchExpiry, buildSerialRows, buildWarrantyRows,
  BLOCK_EMPTY_HINTS,
} from './verticalBlockModel';

/**
 * Vertical block models.
 *
 * The compliance blocks matter beyond presentation: a warranty claim needs a
 * serial number that matches the receipt, and a dispensed medicine needs a
 * traceable identifier and a beyond-use date. The commercial blocks are about
 * clarity — a "you saved" figure customers actually look for, change given on
 * cash, a return policy stated plainly.
 *
 * Every block must render NOTHING when its data is absent. A pharmacy block on
 * a grocery receipt should disappear, not print empty headings.
 */

describe('savings', () => {
  it('totals the coupon lines when no explicit total is given', () => {
    const s = buildSavings({
      couponLines: [{ description: 'Card Saver', amount: -1.4 }, { description: 'Coupon', amount: -2 }],
    });
    expect(s.total).toBeCloseTo(3.4, 2);
  });

  it('prefers an explicit savings total over the line sum', () => {
    // A chain may apply basket-level promotions not visible in line detail.
    const s = buildSavings({
      savingsTotal: 10,
      couponLines: [{ description: 'Coupon', amount: -2 }],
    });
    expect(s.total).toBe(10);
  });

  it('reports no savings on a plain sale', () => {
    expect(buildSavings({}).hasSavings).toBe(false);
    expect(buildSavings({ couponLines: [] }).hasSavings).toBe(false);
  });

  it('treats coupon amounts as absolute when totalling', () => {
    // Coupons are stored negative; the "you saved" figure is positive.
    const s = buildSavings({ couponLines: [{ description: 'x', amount: -5 }] });
    expect(s.total).toBe(5);
  });
});

describe('loyalty', () => {
  it('shows points earned and balance', () => {
    const l = buildLoyalty({ loyaltyPointsEarned: 60, loyaltyBalance: 1840 });
    expect(l.lines.map((x) => x.label)).toEqual(['Points earned', 'Points balance']);
  });

  it('emphasises the balance, which is what customers track', () => {
    const l = buildLoyalty({ loyaltyPointsEarned: 60, loyaltyBalance: 1840 });
    expect(l.lines.find((x) => x.label === 'Points balance')!.emphasis).toBe(true);
  });

  it('includes tier when present', () => {
    const l = buildLoyalty({ loyaltyBalance: 10, loyaltyTier: 'Gold' });
    expect(l.lines.map((x) => x.value)).toContain('Gold');
  });

  it('shows a zero balance rather than hiding it', () => {
    expect(buildLoyalty({ loyaltyBalance: 0 }).hasLoyalty).toBe(true);
  });

  it('reports nothing when the tenant has no loyalty programme', () => {
    expect(buildLoyalty({}).hasLoyalty).toBe(false);
  });
});

describe('changeDue', () => {
  it('shows tendered and change on a cash sale', () => {
    const c = buildChangeDue({ payment: { method: 'Cash', tendered: 65, change: 4.77 } });
    expect(c.hasChange).toBe(true);
    expect(c.lines.map((l) => l.label)).toContain('Tendered');
    expect(c.lines.map((l) => l.label)).toContain('Change');
  });

  it('renders nothing on a card sale EVEN IF tendered/change are present', () => {
    // Printing "Change 0.00" on a card payment is noise.
    //
    // The payload deliberately includes tendered AND change: an earlier version
    // of this test used a card payment with neither, so it passed because the
    // fields were missing rather than because the cash check worked. This
    // version fails if the method check is removed.
    const c = buildChangeDue({
      payment: { method: 'Card', amount: 50, tendered: 50, change: 0 },
    });
    expect(c.hasChange).toBe(false);
    expect(c.lines).toHaveLength(0);
  });

  it('recognises cash under different method spellings', () => {
    ['Cash', 'cash', 'CASH', 'Cash Payment'].forEach((method) => {
      expect(buildChangeDue({ payment: { method, tendered: 20, change: 5 } }).hasChange).toBe(true);
    });
  });

  it('renders nothing when cash has no tendered amount recorded', () => {
    expect(buildChangeDue({ payment: { method: 'Cash', amount: 50 } }).hasChange).toBe(false);
  });

  it('shows a rounding adjustment as its own line', () => {
    // Where small coins are withdrawn (AU/CA), rounding must be visible rather
    // than silently altering the total.
    const c = buildChangeDue({
      payment: { method: 'Cash', tendered: 20, roundingAdjustment: -0.02, change: 5 },
    });
    expect(c.lines.map((l) => l.label)).toContain('Rounding');
  });

  it('omits a zero rounding adjustment', () => {
    const c = buildChangeDue({
      payment: { method: 'Cash', tendered: 20, roundingAdjustment: 0, change: 5 },
    });
    expect(c.lines.map((l) => l.label)).not.toContain('Rounding');
  });

  it('emphasises the change, which the customer verifies', () => {
    const c = buildChangeDue({ payment: { method: 'Cash', tendered: 65, change: 4.77 } });
    expect(c.lines.find((l) => l.label === 'Change')!.emphasis).toBe(true);
  });
});

describe('returnPolicy', () => {
  it('reads window, fee and terms', () => {
    const r = buildReturnPolicy({
      returnPolicy: { windowDays: 14, restockingFeePct: 15, terms: 'RMA required.' },
    });
    expect(r.windowDays).toBe(14);
    expect(r.restockingFeePct).toBe(15);
    expect(r.terms).toBe('RMA required.');
  });

  it('falls back to template-level terms when the sale carries none', () => {
    const r = buildReturnPolicy({}, 'Exchange within 30 days.');
    expect(r.terms).toBe('Exchange within 30 days.');
    expect(r.hasPolicy).toBe(true);
  });

  it('reports nothing when neither source has a policy', () => {
    expect(buildReturnPolicy({}).hasPolicy).toBe(false);
  });
});

describe('rxDetails', () => {
  const rx = {
    rxNumber: 'RX-2026-018844',
    prescriber: 'Dr. A. Nembhard',
    refillsRemaining: 2,
    refillsAuthorized: 3,
  };

  it('shows the Rx number prominently', () => {
    const r = buildRxDetails(rx);
    expect(r.lines.find((l) => l.label === 'Rx No.')!.emphasis).toBe(true);
  });

  it('shows refills as remaining-of-authorised', () => {
    const r = buildRxDetails(rx);
    expect(r.lines.find((l) => l.label === 'Refills')!.value).toBe('2 of 3 remaining');
  });

  it('shows ZERO refills and emphasises it', () => {
    // "0 remaining" tells the patient to contact their prescriber. Hiding the
    // line would leave them guessing.
    const r = buildRxDetails({ ...rx, refillsRemaining: 0 });
    const refills = r.lines.find((l) => l.label === 'Refills')!;
    expect(refills.value).toContain('0');
    expect(refills.emphasis).toBe(true);
  });

  it('handles refills without an authorised count', () => {
    const r = buildRxDetails({ rxNumber: 'X', refillsRemaining: 1 });
    expect(r.lines.find((l) => l.label === 'Refills')!.value).toBe('1 remaining');
  });

  it('carries the pharmacist name for sign-off', () => {
    expect(buildRxDetails({ ...rx, pharmacistName: 'Dr. L. Charles' }).pharmacistName)
      .toBe('Dr. L. Charles');
  });

  it('reports nothing on a non-pharmacy sale', () => {
    expect(buildRxDetails({}).hasRx).toBe(false);
  });
});

describe('batchExpiry', () => {
  const items = [
    { name: 'Amoxicillin', drugId: '00093-4155-73', lotNumber: 'LOT-8842A', beyondUseDate: '23/02/2027' },
    { name: 'Plain Item' },
  ];

  it('includes only items that carry batch data', () => {
    expect(buildBatchExpiry({ items })).toHaveLength(1);
  });

  it('prefers beyond-use date over manufacturer expiry', () => {
    // The beyond-use date is the operative one for the patient.
    const rows = buildBatchExpiry({
      items: [{ name: 'X', lotNumber: 'L', expiryDate: '01/01/2030', beyondUseDate: '01/06/2027' }],
    });
    expect(rows[0].expiry).toBe('01/06/2027');
  });

  it('falls back to manufacturer expiry when there is no beyond-use date', () => {
    const rows = buildBatchExpiry({ items: [{ name: 'X', lotNumber: 'L', expiryDate: '01/01/2030' }] });
    expect(rows[0].expiry).toBe('01/01/2030');
  });

  it('returns nothing for a non-pharmacy basket', () => {
    expect(buildBatchExpiry({ items: [{ name: 'Milk', qty: 2 }] })).toHaveLength(0);
  });
});

describe('serialCapture', () => {
  it('includes only serialised items', () => {
    const rows = buildSerialRows({
      items: [
        { name: 'Phone', serialNumber: 'SN-1', imei: '3569...' },
        { name: 'Cable' },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].itemName).toBe('Phone');
  });

  it('includes an item with only an IMEI', () => {
    expect(buildSerialRows({ items: [{ name: 'Phone', imei: '3569' }] })).toHaveLength(1);
  });

  it('returns nothing for non-serialised goods', () => {
    expect(buildSerialRows({ items: [{ name: 'Shirt', sku: 'S-1' }] })).toHaveLength(0);
  });
});

describe('warranty', () => {
  it('formats the term in months', () => {
    const rows = buildWarrantyRows({ items: [{ name: 'Phone', warrantyMonths: 24 }] });
    expect(rows[0].term).toBe('24 months');
  });

  it('includes the expiry date', () => {
    const rows = buildWarrantyRows({
      items: [{ name: 'Phone', warrantyMonths: 24, warrantyExpiry: '23/08/2028' }],
    });
    expect(rows[0].expiry).toBe('23/08/2028');
  });

  it('includes an item with only an expiry date', () => {
    expect(buildWarrantyRows({ items: [{ name: 'X', warrantyExpiry: '2028' }] })).toHaveLength(1);
  });

  it('returns nothing for goods without warranty', () => {
    expect(buildWarrantyRows({ items: [{ name: 'Banana' }] })).toHaveLength(0);
  });
});

describe('empty-state handling', () => {
  it('every vertical block has a designer hint', () => {
    ['savings', 'loyalty', 'changeDue', 'returnPolicy',
     'rxDetails', 'batchExpiry', 'serialCapture', 'warranty'].forEach((k) => {
      expect(BLOCK_EMPTY_HINTS[k]).toBeTruthy();
    });
  });

  it('no builder throws on empty, null or malformed input', () => {
    // A template may include any block against any fixture, and `items` can
    // arrive malformed from a partial API response. A print job must never
    // crash on bad input — the worst acceptable outcome is an empty block.
    //
    // NOTE: an earlier version of this test omitted the array-based builders,
    // and they DID throw on a non-array `items`. Cover every builder.
    const BUILDERS = [
      ['savings', buildSavings], ['loyalty', buildLoyalty],
      ['changeDue', buildChangeDue], ['returnPolicy', buildReturnPolicy],
      ['rxDetails', buildRxDetails], ['batchExpiry', buildBatchExpiry],
      ['serialCapture', buildSerialRows], ['warranty', buildWarrantyRows],
    ] as const;

    const BAD_INPUTS = [
      null, undefined, {}, { items: null }, { items: 'oops' }, { items: 42 },
      { items: [null] }, { couponLines: 'nope' }, { payment: 'nope' },
    ];

    BUILDERS.forEach(([name, fn]) => {
      BAD_INPUTS.forEach((bad: any) => {
        expect(() => fn(bad), `${name} threw on ${JSON.stringify(bad)}`).not.toThrow();
      });
    });
  });
});
