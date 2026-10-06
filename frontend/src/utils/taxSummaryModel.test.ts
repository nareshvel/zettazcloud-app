import { describe, it, expect } from 'vitest';
import { buildTaxSummary, ZERO_RATE_LABELS } from './taxSummaryModel';

/**
 * Tax summary normalisation.
 *
 * This module deliberately performs NO tax arithmetic — the backend's
 * taxCalculationService already handles classes, multiple rates and compound
 * tax, and a second implementation would drift. These tests therefore pin
 * *shape handling* and *presentation*, and specifically guard the cases where
 * getting it wrong produces a non-compliant document:
 *
 *   * zero-rated sales must state WHY (a bare 0.00 explains nothing)
 *   * reverse-charge wording must survive normalisation intact
 *   * the tax label must come from data, never be hardcoded
 */

describe('buildTaxSummary', () => {
  describe('flat taxBreakdown shape (fixtures)', () => {
    const data = {
      currency: 'XCD',
      taxBreakdown: [
        { label: 'Exempt (food)', rate: 0, taxableAmount: 25.10, taxAmount: 0 },
        { label: 'ABST 15%', rate: 15, taxableAmount: 33.50, taxAmount: 5.03 },
      ],
    };

    it('preserves every line', () => {
      expect(buildTaxSummary(data).lines).toHaveLength(2);
    });

    it('sums the tax across rates', () => {
      expect(buildTaxSummary(data).totalTax).toBeCloseTo(5.03, 2);
    });

    it('marks zero-rate lines so they can be styled or hidden', () => {
      const [exempt, standard] = buildTaxSummary(data).lines;
      expect(exempt.isZeroRated).toBe(true);
      expect(standard.isZeroRated).toBe(false);
    });

    it('keeps the taxable base for each rate', () => {
      expect(buildTaxSummary(data).lines[1].taxableAmount).toBe(33.50);
    });
  });

  describe('backend generateTaxSummary shape', () => {
    // Mirrors taxCalculationService.generateTaxSummary() output.
    const snake = {
      taxSummary: [{
        tax_class_name: 'Standard',
        total_tax_amount: 15.0,
        rate_summaries: [
          { tax_rate_name: 'GST', rate: 5, is_compound: 0, total_tax_amount: 5.0 },
          { tax_rate_name: 'QST', rate: 9.975, is_compound: 1, total_tax_amount: 10.0 },
        ],
      }],
    };

    it('flattens class -> rate into display lines', () => {
      expect(buildTaxSummary(snake).lines).toHaveLength(2);
    });

    it('labels compound rates so tax-on-tax is visible', () => {
      // Quebec applies QST on top of GST; hiding that makes the total look wrong.
      const compound = buildTaxSummary(snake).lines.find((l) => l.isCompound);
      expect(compound).toBeDefined();
      expect(compound!.label).toContain('compound');
    });

    it('does not round a fractional rate away', () => {
      const qst = buildTaxSummary(snake).lines.find((l) => l.label.includes('QST'));
      expect(qst!.label).toContain('9.975');
    });

    it('also accepts the camelCase form (fetchApi converts in transit)', () => {
      const camel = {
        taxSummary: [{
          taxClassName: 'Standard',
          totalTaxAmount: 5.0,
          rateSummaries: [{ taxRateName: 'VAT', rate: 20, isCompound: false, totalTaxAmount: 5.0 }],
        }],
      };
      const r = buildTaxSummary(camel);
      expect(r.lines).toHaveLength(1);
      expect(r.lines[0].label).toContain('VAT');
    });
  });

  describe('rate normalisation', () => {
    it('treats a fraction as a percentage', () => {
      // Backend stores 0.15000 for 15%; fixtures use 15.
      const frac = buildTaxSummary({ taxBreakdown: [{ label: '', rate: 0.15, taxAmount: 1 }] });
      expect(frac.lines[0].rate).toBeCloseTo(15, 5);
    });

    it('leaves an explicit percentage alone', () => {
      const pct = buildTaxSummary({ taxBreakdown: [{ label: '', rate: 15, taxAmount: 1 }] });
      expect(pct.lines[0].rate).toBe(15);
    });
  });

  describe('tax label comes from data, never hardcoded', () => {
    it('uses the supplied jurisdiction label', () => {
      const r = buildTaxSummary({ tax: 5, taxRate: 15 }, 'ABST');
      expect(r.lines[0].label).toContain('ABST');
    });

    it('uses a different label for a different jurisdiction', () => {
      const r = buildTaxSummary({ tax: 5, taxRate: 20 }, 'VAT');
      expect(r.lines[0].label).toContain('VAT');
      expect(r.lines[0].label).not.toContain('ABST');
    });
  });

  describe('zero-rated sales', () => {
    it('carries the duty-free reason through', () => {
      const r = buildTaxSummary({
        zeroRateReason: 'duty_free',
        taxBreakdown: [{ label: 'Zero-rated (export)', rate: 0, taxAmount: 0 }],
      });
      expect(r.zeroRateReason).toBe('duty_free');
      expect(r.totalTax).toBe(0);
    });

    it('has human wording for every zero-rate reason', () => {
      // A receipt showing 0.00 with no explanation is not compliant.
      ['duty_free', 'export', 'reverse_charge'].forEach((reason) => {
        expect(ZERO_RATE_LABELS[reason]).toBeTruthy();
      });
    });
  });

  describe('reverse charge', () => {
    it('preserves the prescribed wording verbatim', () => {
      const text = 'Reverse charge: customer to account for VAT';
      const r = buildTaxSummary({
        zeroRateReason: 'reverse_charge',
        reverseChargeText: text,
        taxBreakdown: [{ label: 'Reverse charge — 0%', rate: 0, taxAmount: 0 }],
      });
      expect(r.reverseChargeText).toBe(text);
    });

    it('reads the wording from a nested jurisdiction block too', () => {
      const r = buildTaxSummary({
        jurisdiction: { reverseChargeText: 'Autoliquidação' },
        tax: 0,
      });
      expect(r.reverseChargeText).toBe('Autoliquidação');
    });
  });

  describe('degenerate input', () => {
    it('reports empty rather than throwing when there is no tax data', () => {
      expect(buildTaxSummary({}).isEmpty).toBe(true);
      expect(buildTaxSummary(null).isEmpty).toBe(true);
      expect(buildTaxSummary(undefined).isEmpty).toBe(true);
    });

    it('distinguishes "no data" from "tax is genuinely zero"', () => {
      // A tax-free sale still has something to say; an absent field does not.
      expect(buildTaxSummary({ tax: 0 }).isEmpty).toBe(false);
      expect(buildTaxSummary({}).isEmpty).toBe(true);
    });

    it('never produces NaN from a malformed amount', () => {
      const r = buildTaxSummary({ taxBreakdown: [{ label: 'x', rate: 'abc', taxAmount: 'xyz' }] });
      expect(Number.isFinite(r.totalTax)).toBe(true);
      expect(Number.isFinite(r.lines[0].rate)).toBe(true);
    });
  });
});
