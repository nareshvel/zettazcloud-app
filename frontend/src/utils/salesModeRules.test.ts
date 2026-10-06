import { describe, it, expect } from 'vitest';
import {
  isBlockSuppressed, isGiftMode, isDutyFreeOrExport,
  filterGiftModeColumns, buildDutyFreeLines, buildTaxRefundLines,
} from './salesModeRules';

/**
 * Sales-mode rules.
 *
 * Two of these are not styling decisions — they decide whether a printed
 * document is fit for its purpose:
 *
 *   * a duty-free receipt stamped "DUPLICATE" is not valid at customs, so the
 *     traveller cannot evidence the export
 *   * a gift receipt that leaks the price defeats its only reason to exist
 *
 * Both are enforced centrally so the canvas and the print renderer cannot
 * diverge, and both are deliberately NOT overridable by template config.
 */

const block = (type: string, config: any = {}) => ({ type, visible: true, order: 1, config });

describe('isDutyFreeOrExport', () => {
  it('detects duty-free by sales mode', () => {
    expect(isDutyFreeOrExport({ salesMode: 'duty_free' })).toBe(true);
  });

  it('detects export by sales mode', () => {
    expect(isDutyFreeOrExport({ salesMode: 'export' })).toBe(true);
  });

  it('also detects it from the zero-rate reason', () => {
    // The sale payload may carry the reason without the mode.
    expect(isDutyFreeOrExport({ zeroRateReason: 'duty_free' })).toBe(true);
  });

  it('does not treat a domestic sale as duty-free', () => {
    expect(isDutyFreeOrExport({ salesMode: 'domestic' })).toBe(false);
    expect(isDutyFreeOrExport({})).toBe(false);
  });

  it('does not treat reverse charge as an export supply', () => {
    // Reverse charge is also zero-rated, but it is a B2B liability shift —
    // the goods are not leaving with a traveller, so a reprint stamp is fine.
    expect(isDutyFreeOrExport({ zeroRateReason: 'reverse_charge' })).toBe(false);
  });
});

describe('reprint notice suppression', () => {
  it('is suppressed on a duty-free document', () => {
    // A receipt marked as a copy is not valid proof of sale for a refund.
    expect(isBlockSuppressed(block('reprintNotice'), { salesMode: 'duty_free' })).toBe(true);
  });

  it('is suppressed on an export document', () => {
    expect(isBlockSuppressed(block('reprintNotice'), { salesMode: 'export' })).toBe(true);
  });

  it('is allowed on an ordinary domestic sale', () => {
    // Marking reprints is correct fraud control everywhere else.
    expect(isBlockSuppressed(block('reprintNotice'), { salesMode: 'domestic' })).toBe(false);
  });

  it('cannot be forced on by template configuration', () => {
    // A template author has no legitimate reason to override this — it protects
    // the customer's refund, not the merchant's preference.
    const forced = block('reprintNotice', { reprintText: 'COPY', forceShow: true });
    expect(isBlockSuppressed(forced, { salesMode: 'duty_free' })).toBe(true);
  });
});

describe('gift mode', () => {
  it('is detected from block config or from the document data', () => {
    expect(isGiftMode({ giftMode: true }, {})).toBe(true);
    expect(isGiftMode({}, { giftMode: true })).toBe(true);
    expect(isGiftMode({}, {})).toBe(false);
  });

  describe('suppresses every block that reveals what was paid', () => {
    const data = { giftMode: true };
    ['totals', 'payment', 'tax', 'taxSummary', 'price', 'savings', 'changeDue'].forEach((type) => {
      it(`hides "${type}"`, () => {
        expect(isBlockSuppressed(block(type), data)).toBe(true);
      });
    });
  });

  describe('keeps everything the recipient needs to make a return', () => {
    const data = { giftMode: true };
    ['logo', 'header', 'table', 'barcode', 'footer', 'returnPolicy'].forEach((type) => {
      it(`keeps "${type}"`, () => {
        expect(isBlockSuppressed(block(type), data)).toBe(false);
      });
    });
  });

  it('keeps monetary blocks on an ordinary receipt', () => {
    expect(isBlockSuppressed(block('totals'), {})).toBe(false);
    expect(isBlockSuppressed(block('payment'), {})).toBe(false);
  });
});

describe('filterGiftModeColumns', () => {
  const columns = [
    { id: 'name', accessor: 'name' },
    { id: 'sku', accessor: 'sku' },
    { id: 'qty', accessor: 'qty' },
    { id: 'unitPrice', accessor: 'unitPrice' },
    { id: 'lineTotal', accessor: 'lineTotal' },
  ];

  it('strips price columns in gift mode', () => {
    const out = filterGiftModeColumns(columns, true).map((c) => c.accessor);
    expect(out).toEqual(['name', 'sku', 'qty']);
  });

  it('keeps item, SKU and quantity so the item is still identifiable', () => {
    const out = filterGiftModeColumns(columns, true).map((c) => c.accessor);
    expect(out).toContain('name');
    expect(out).toContain('qty');
  });

  it('leaves columns untouched when not in gift mode', () => {
    expect(filterGiftModeColumns(columns, false)).toHaveLength(5);
  });

  it('strips jewelry-specific money columns too', () => {
    // makingCharge and ratePerGram reveal price just as directly as unitPrice.
    const jewelry = [
      { id: 'name', accessor: 'name' },
      { id: 'purity', accessor: 'purity' },
      { id: 'makingCharge', accessor: 'makingCharge' },
      { id: 'ratePerGram', accessor: 'ratePerGram' },
      { id: 'amount', accessor: 'amount' },
    ];
    const out = filterGiftModeColumns(jewelry, true).map((c) => c.accessor);
    expect(out).toEqual(['name', 'purity']);
  });
});

describe('buildDutyFreeLines', () => {
  const data = {
    passportNumber: 'P12345678',
    passportCountry: 'USA',
    flightNumber: 'AA-2246',
    destination: 'Miami (MIA), USA',
    departureDate: '23/08/2026',
  };

  it('includes all traveller fields by default', () => {
    expect(buildDutyFreeLines(data)).toHaveLength(4);
  });

  it('shows the passport issuing country alongside the number', () => {
    const passport = buildDutyFreeLines(data).find((l) => l.label === 'Passport');
    expect(passport!.value).toContain('P12345678');
    expect(passport!.value).toContain('USA');
  });

  it('honours a restricted field selection', () => {
    const lines = buildDutyFreeLines(data, ['passport']);
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe('Passport');
  });

  it('falls back to the customer record for the passport', () => {
    const lines = buildDutyFreeLines({ customer: { passport: 'X999' } });
    expect(lines[0].value).toContain('X999');
  });

  it('omits fields with no data rather than printing blanks', () => {
    expect(buildDutyFreeLines({ flightNumber: 'AA-1' })).toHaveLength(1);
    expect(buildDutyFreeLines({})).toHaveLength(0);
  });

  it('labels the travel-method line "Flight" by default', () => {
    const flight = buildDutyFreeLines(data).find((l) => l.label === 'Flight');
    expect(flight!.value).toContain('AA-2246');
  });

  describe('generalized traveller ID / travel method (not every duty-free traveller flies in on a passport)', () => {
    it('accepts the current field keys as well as the legacy ones', () => {
      const lines = buildDutyFreeLines(data, ['travellerId']);
      expect(lines).toHaveLength(1);
      expect(lines[0].label).toBe('Passport');
      expect(lines[0].value).toContain('P12345678');
    });

    it('reads the generic travellerIdNumber/-Country fields ahead of the legacy passport fields', () => {
      const lines = buildDutyFreeLines({
        travellerIdNumber: 'SB-88123',
        travellerIdCountry: 'ATG',
        passportNumber: 'SHOULD_NOT_APPEAR',
      });
      const id = lines.find((l) => l.label === 'Passport');
      expect(id!.value).toContain('SB-88123');
      expect(id!.value).not.toContain('SHOULD_NOT_APPEAR');
    });

    it('reads the generic travelMethodRef/-Detail fields ahead of the legacy flightNumber field, joined with a middle dot', () => {
      const lines = buildDutyFreeLines({
        travelMethodRef: 'MV Caribbean Princess',
        travelMethodDetail: 'Voyage 214',
        flightNumber: 'SHOULD_NOT_APPEAR',
      });
      const method = lines.find((l) => l.label === 'Flight');
      expect(method!.value).toBe('MV Caribbean Princess · Voyage 214');
    });

    it('renders a store-configured label — Caribbean cruise traffic uses a seaman\'s book and a vessel, not a passport and a flight', () => {
      const lines = buildDutyFreeLines(
        { travellerIdNumber: 'SB-88123', travelMethodRef: 'MV Caribbean Princess' },
        undefined,
        { travellerIdType: 'seaman_book', travelMethodType: 'vessel' },
      );
      expect(lines.find((l) => l.label === "Seaman's Book")).toBeTruthy();
      expect(lines.find((l) => l.label === 'Vessel')).toBeTruthy();
    });

    it('supports national ID as a traveller ID type', () => {
      const lines = buildDutyFreeLines(
        { travellerIdNumber: 'ID-4021' },
        ['travellerId'],
        { travellerIdType: 'national_id' },
      );
      expect(lines[0].label).toBe('National ID');
    });

    it('falls back to a custom label when the type is "other"', () => {
      const lines = buildDutyFreeLines(
        { travellerIdNumber: 'BP-991' },
        ['travellerId'],
        { travellerIdType: 'other', travellerIdLabel: 'Boarding Pass' },
      );
      expect(lines[0].label).toBe('Boarding Pass');
    });

    it('restricting to the new field keys behaves identically to restricting to the legacy keys', () => {
      const legacy = buildDutyFreeLines(data, ['passport', 'flight']);
      const current = buildDutyFreeLines(data, ['travellerId', 'travelMethod']);
      expect(current).toEqual(legacy);
    });
  });
});

describe('buildTaxRefundLines', () => {
  it('reads the scheme and form reference', () => {
    const lines = buildTaxRefundLines({
      taxRefund: { schemeName: 'VAT407', formRef: 'RF-2026-004410' },
    });
    const values = lines.map((l) => l.value);
    expect(values).toContain('RF-2026-004410');
    expect(values).toContain('VAT407');
  });

  it('returns nothing when there is no refund data', () => {
    expect(buildTaxRefundLines({})).toHaveLength(0);
  });
});
