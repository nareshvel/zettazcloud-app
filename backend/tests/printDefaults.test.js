/**
 * Print defaults + fixtures — Phase 1 verification.
 *
 * WHAT THIS GUARDS
 * ----------------
 * 1. DEFAULT_BLOCKS used to be bare `{id, type, visible, order}` with no config,
 *    so every new template rendered flat and unstyled. Each block now ships with
 *    a starting configuration; these tests keep it that way.
 *
 * 2. Fixtures used to be jewelry-only and reused for every template type — a
 *    pharmacist designing a receipt previewed gold rings, and the fields their
 *    vertical needs did not exist at all. Each vertical now has its own fixture
 *    carrying the fields its documents legally or practically require.
 *
 * 3. Fixture keys must be camelCase. printService.ts converts snake_case to
 *    camelCase in transit, so a snake_case key would arrive renamed and the
 *    template accessor would silently resolve to "—" on a printed document.
 */

const assert = require('assert');
const {
  DEFAULT_BLOCKS, withDutyFreeVisible, blocksForReset,
} = require('../services/printTemplateService');
const fixtures = require('../services/printFixtures');

const TEMPLATE_TYPES = [
  'receipt', 'invoice', 'jewelry_invoice', 'jewelry_certificate', 'label', 'document',
  'repair_ticket', 'old_gold_voucher', 'memo_slip', 'layaway_agreement', 'layaway_receipt',
  'savings_enrollment', 'order_acknowledgement',
];

const VERTICALS = ['jewelry', 'grocery', 'pharmacy', 'electronics', 'apparel', 'retail'];

describe('Print defaults', function () {
  describe('every template type ships styled blocks', function () {
    TEMPLATE_TYPES.forEach((type) => {
      it(`${type} has blocks, all carrying config`, function () {
        const blocks = DEFAULT_BLOCKS[type];
        assert.ok(Array.isArray(blocks) && blocks.length > 0, `${type} has no default blocks`);

        const bare = blocks.filter(
          (b) => !b.config || Object.keys(b.config).length === 0
        );
        assert.strictEqual(
          bare.length, 0,
          `${bare.length} block(s) in "${type}" have no config and would render unstyled: ` +
          bare.map((b) => b.type).join(', ')
        );
      });

      it(`${type} has unique, gapless ordering`, function () {
        const orders = DEFAULT_BLOCKS[type].map((b) => b.order);
        assert.strictEqual(new Set(orders).size, orders.length, 'duplicate order values');
        assert.deepStrictEqual(
          [...orders].sort((a, b) => a - b),
          Array.from({ length: orders.length }, (_, i) => i + 1),
          'order values must run 1..n with no gaps'
        );
      });

      it(`${type} gives every block a human label`, function () {
        const unlabelled = DEFAULT_BLOCKS[type].filter((b) => !b.label);
        assert.strictEqual(
          unlabelled.length, 0,
          `blocks without a label show a raw type name in the Layers panel: ` +
          unlabelled.map((b) => b.type).join(', ')
        );
      });
    });
  });

  describe('conventions that make a document readable', function () {
    it('emphasises the total on documents that have one', function () {
      ['receipt', 'invoice', 'jewelry_invoice', 'document'].forEach((type) => {
        const totals = DEFAULT_BLOCKS[type].find((b) => b.type === 'totals');
        assert.ok(totals, `${type} has no totals block`);
        assert.strictEqual(totals.config.bold, true, `${type} total is not bold`);
        assert.ok(
          ['lg', 'xl', 'title'].includes(totals.config.fontSize),
          `${type} total should be larger than body text, got "${totals.config.fontSize}"`
        );
      });
    });

    it('encodes the transaction number in the receipt barcode', function () {
      // So a cashier can scan the receipt for a return instead of searching.
      const barcode = DEFAULT_BLOCKS.receipt.find((b) => b.type === 'barcode');
      assert.ok(barcode, 'receipt has no barcode block');
      assert.strictEqual(barcode.config.barcodeSource, 'receiptNo');
    });

    it('encodes the product SKU on labels, not the receipt number', function () {
      const barcode = DEFAULT_BLOCKS.label.find((b) => b.type === 'barcode');
      assert.strictEqual(barcode.config.barcodeSource, 'productSku');
    });

    it('centres store identity on thermal receipts and left-aligns it on A4', function () {
      const receiptLogo = DEFAULT_BLOCKS.receipt.find((b) => b.type === 'logo');
      const invoiceLogo = DEFAULT_BLOCKS.invoice.find((b) => b.type === 'logo');
      assert.strictEqual(receiptLogo.config.align, 'center');
      assert.strictEqual(invoiceLogo.config.align, 'left');
    });

    it('itemises purity and weights on a jewelry invoice', function () {
      const table = DEFAULT_BLOCKS.jewelry_invoice.find((b) => b.type === 'table');
      const accessors = table.config.fields.map((f) => f.accessor);
      // Where hallmarking applies, description / net weight / purity must be
      // itemised separately on the invoice.
      ['purity', 'grossWeight', 'netWeight', 'makingCharge'].forEach((a) => {
        assert.ok(accessors.includes(a), `jewelry table is missing "${a}"`);
      });
    });
  });

  describe('jurisdiction neutrality — nothing may be hardcoded per country', function () {
    it('leaves invoice titles blank so a mandated title can be supplied', function () {
      // AU/IN/AE require the literal words "TAX INVOICE"; the profile supplies it.
      ['invoice', 'jewelry_invoice'].forEach((type) => {
        const header = DEFAULT_BLOCKS[type].find((b) => b.type === 'header');
        assert.strictEqual(
          header.config.content, '',
          `${type} hardcodes an invoice title, which would override a legally mandated one`
        );
      });
    });

    it('leaves compliance text empty rather than assuming a hallmark regime', function () {
      // BIS/HUID wording is India-specific. Antigua has no equivalent mandate.
      const compliance = DEFAULT_BLOCKS.jewelry_invoice.find((b) => b.type === 'compliance');
      assert.ok(compliance, 'jewelry invoice has no compliance block');
      assert.ok(
        !compliance.config.content,
        'compliance text must come from the jurisdiction profile, not the default'
      );
    });

    it('does not embed a currency symbol or tax label in any default', function () {
      const json = JSON.stringify(DEFAULT_BLOCKS);
      ['ABST', 'GST', 'VAT', 'HST', '₹', '£', '€'].forEach((token) => {
        assert.ok(
          !json.includes(token),
          `defaults contain "${token}" — tax labels and currency must come from the jurisdiction profile`
        );
      });
    });
  });
});

describe('Print fixtures', function () {
  describe('every vertical has its own fixture', function () {
    VERTICALS.forEach((vertical) => {
      it(`${vertical} resolves to a distinct fixture with items`, function () {
        const fx = fixtures.getFixtureForVertical(vertical);
        assert.ok(fx, `no fixture for "${vertical}"`);
        assert.ok(fx.storeName, `${vertical} fixture has no store identity`);
        assert.ok(Array.isArray(fx.items) && fx.items.length > 0, `${vertical} fixture has no items`);
      });
    });

    it('does not reuse one store identity across every vertical', function () {
      const names = VERTICALS.map((v) => fixtures.getFixtureForVertical(v).storeName);
      assert.strictEqual(
        new Set(names).size, names.length,
        'verticals share a store name — previews would look identical: ' + names.join(', ')
      );
    });
  });

  describe('vertical-specific fields are present', function () {
    it('grocery has PLU, weight and per-line tax flags', function () {
      const fx = fixtures.getFixtureForVertical('grocery');
      const weighed = fx.items.find((i) => i.plu);
      assert.ok(weighed, 'no PLU-coded produce line');
      assert.ok(weighed.weight && weighed.pricePerUnit, 'weighed line lacks weight/price-per-unit');
      assert.ok(fx.items.every((i) => i.taxFlag), 'every grocery line needs a taxable/exempt flag');
      assert.ok(fx.savingsTotal > 0, 'grocery needs a "you saved" total');
    });

    it('pharmacy has Rx, drug identifier, lot and beyond-use date', function () {
      const fx = fixtures.getFixtureForVertical('pharmacy');
      assert.ok(fx.rxNumber && fx.prescriber, 'missing Rx number or prescriber');
      assert.ok(Number.isInteger(fx.refillsRemaining), 'missing refills remaining');
      const drug = fx.items[0];
      assert.ok(drug.drugId, 'missing drug identifier');
      assert.ok(drug.lotNumber, 'missing lot number');
      assert.ok(drug.beyondUseDate, 'missing beyond-use date');
      assert.ok(fx.pharmacistName, 'missing pharmacist for sign-off');
    });

    it('pharmacy labels the drug identifier generically, not as "NDC"', function () {
      // NDC is US-only; CA uses DIN, DE uses PZN.
      const fx = fixtures.getFixtureForVertical('pharmacy');
      assert.ok(fx.drugIdentifierLabel, 'drug identifier label must be data');
      assert.notStrictEqual(
        fx.drugIdentifierLabel, 'NDC',
        'defaulting to NDC bakes in a US assumption'
      );
    });

    it('electronics has serial, IMEI and warranty', function () {
      const fx = fixtures.getFixtureForVertical('electronics');
      const phone = fx.items.find((i) => i.imei);
      assert.ok(phone, 'no IMEI-bearing line');
      assert.ok(phone.serialNumber, 'missing serial number');
      assert.ok(phone.warrantyMonths && phone.warrantyExpiry, 'missing warranty term/expiry');
      assert.ok(fx.returnPolicy?.terms, 'missing RMA return policy');
    });

    it('apparel has SKU, size and colour', function () {
      const fx = fixtures.getFixtureForVertical('apparel');
      fx.items.forEach((i) => {
        assert.ok(i.sku, 'apparel line missing SKU');
        assert.ok(i.size, 'apparel line missing size');
        assert.ok(i.color, 'apparel line missing colour');
      });
    });

    it('jewelry has purity, weights and making charges', function () {
      const fx = fixtures.getFixtureForVertical('jewelry');
      const item = fx.items[0];
      ['purity', 'grossWeight', 'netWeight', 'makingCharge'].forEach((k) => {
        assert.ok(item[k] !== undefined, `jewelry line missing ${k}`);
      });
    });
  });

  describe('duty-free fixtures', function () {
    it('are zero-rated', function () {
      ['jewelry', 'retail'].forEach((v) => {
        const fx = fixtures.getFixtureForVertical(v, { dutyFree: true });
        assert.strictEqual(fx.tax, 0, `${v} duty-free sale must carry no tax`);
        assert.strictEqual(fx.zeroRated, true);
        assert.strictEqual(fx.zeroRateReason, 'duty_free');
      });
    });

    it('capture passport and boarding-pass details', function () {
      const fx = fixtures.getFixtureForVertical('jewelry', { dutyFree: true });
      assert.ok(fx.passportNumber, 'missing passport number');
      assert.ok(fx.flightNumber, 'missing flight number');
      assert.ok(fx.destination, 'missing destination');
      assert.ok(fx.departureDate, 'missing departure date');
    });

    it('carry an export declaration', function () {
      const fx = fixtures.getFixtureForVertical('jewelry', { dutyFree: true });
      assert.ok(fx.exportDeclaration, 'duty-free goods must carry an export declaration');
    });
  });

  describe('gift receipt suppresses price', function () {
    it('hides money fields but keeps items and quantities', function () {
      const gift = fixtures.getFixture('receipt', 'apparel_gift');
      assert.ok(gift, 'no gift receipt fixture');
      assert.strictEqual(gift.giftMode, true);
      assert.strictEqual(gift.total, null, 'gift receipt must not reveal the total');
      assert.strictEqual(gift.payment, null, 'gift receipt must not reveal payment');
      assert.ok(gift.items.length > 0, 'gift receipt still needs its items');
      gift.items.forEach((i) => {
        assert.strictEqual(i.unitPrice, undefined, 'gift receipt line reveals a price');
        assert.ok(i.qty, 'gift receipt line needs a quantity');
      });
    });
  });

  describe('field naming', function () {
    it('uses camelCase everywhere (snake_case is renamed in transit)', function () {
      const offenders = [];
      const walk = (node, path) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
        Object.entries(node).forEach(([k, v]) => {
          if (k.includes('_')) offenders.push(`${path}.${k}`);
          walk(v, `${path}.${k}`);
        });
      };
      Object.entries(fixtures.printFixtureSuite).forEach(([type, set]) => {
        Object.entries(set).forEach(([name, fx]) => walk(fx, `${type}/${name}`));
      });
      assert.strictEqual(
        offenders.length, 0,
        'snake_case keys would arrive renamed and render as "—":\n  ' + offenders.join('\n  ')
      );
    });
  });
});

/*
 * Reset-to-defaults must not silently disable a duty-free document.
 *
 * Found live: Diamond Republic's "Duty-Free Invoice" carried the dutyFree
 * block visible (passport / flight / destination). DEFAULT_BLOCKS ships that
 * block HIDDEN — it only turns on at provisioning time, which the reset
 * endpoint has no knowledge of. A naive reset (defaults verbatim) would have
 * refreshed the layout and simultaneously dropped the one section that makes
 * the document valid evidence of a duty-free export.
 */
describe('withDutyFreeVisible', function () {
  it('turns the dutyFree block on and changes nothing else', function () {
    const before = DEFAULT_BLOCKS.jewelry_invoice;
    const after = withDutyFreeVisible(before);
    after.forEach((block, i) => {
      if (block.type === 'dutyFree') {
        assert.strictEqual(block.visible, true);
      } else {
        assert.deepStrictEqual(block, before[i]);
      }
    });
  });

  it('does not mutate its input', function () {
    const before = JSON.stringify(DEFAULT_BLOCKS.jewelry_invoice);
    withDutyFreeVisible(DEFAULT_BLOCKS.jewelry_invoice);
    assert.strictEqual(JSON.stringify(DEFAULT_BLOCKS.jewelry_invoice), before);
  });

  it('is a no-op for a block set with no dutyFree block at all', function () {
    const after = withDutyFreeVisible(DEFAULT_BLOCKS.invoice);
    assert.deepStrictEqual(after, DEFAULT_BLOCKS.invoice);
  });
});

describe('blocksForReset — what /reset-defaults actually writes', function () {
  it('carries dutyFree visibility forward when the existing template had it on', function () {
    const existingBlocks = withDutyFreeVisible(DEFAULT_BLOCKS.jewelry_invoice);
    const result = blocksForReset(existingBlocks, DEFAULT_BLOCKS.jewelry_invoice);
    const dutyFreeBlock = result.find((b) => b.type === 'dutyFree');
    assert.strictEqual(dutyFreeBlock.visible, true, 'duty-free document must not lose its traveller fields on reset');
  });

  it('leaves dutyFree hidden when the existing template never had it on', function () {
    const result = blocksForReset(DEFAULT_BLOCKS.jewelry_invoice, DEFAULT_BLOCKS.jewelry_invoice);
    const dutyFreeBlock = result.find((b) => b.type === 'dutyFree');
    assert.strictEqual(dutyFreeBlock.visible, false, 'a domestic invoice must not gain traveller fields from a reset');
  });

  it('picks up every OTHER change in the fresh defaults, not just duty-free', function () {
    // The whole point of reset — an old block set must become the new one.
    const staleBlocks = [{ id: 'x', type: 'header', visible: true, order: 1, config: {} }];
    const result = blocksForReset(staleBlocks, DEFAULT_BLOCKS.jewelry_invoice);
    assert.deepStrictEqual(result, DEFAULT_BLOCKS.jewelry_invoice);
  });

  it('tolerates a template with no blocks recorded yet', function () {
    assert.doesNotThrow(() => blocksForReset(null, DEFAULT_BLOCKS.invoice));
    assert.doesNotThrow(() => blocksForReset(undefined, DEFAULT_BLOCKS.invoice));
  });

  it('does not mutate the fresh defaults it is handed', function () {
    const before = JSON.stringify(DEFAULT_BLOCKS.jewelry_invoice);
    blocksForReset(withDutyFreeVisible(DEFAULT_BLOCKS.jewelry_invoice), DEFAULT_BLOCKS.jewelry_invoice);
    assert.strictEqual(JSON.stringify(DEFAULT_BLOCKS.jewelry_invoice), before);
  });
});
