/* eslint-disable */
const { expect } = require('chai');
const cc = require('../services/costCodeService');

const CONFIG = {
  enabled: true,
  prefix: 'X',
  suffix: 'Y',
  decimalChar: '.',
  repeatChar: '',
  digitMap: { '1':'A','2':'N','3':'C','4':'D','5':'E','6':'F','7':'G','8':'H','9':'I','0':'O' },
};

describe('costCodeService.encode/decode', () => {
  it('encodes a whole number', () => {
    expect(cc.encode(125, CONFIG)).to.equal('XANEY');
  });

  it('encodes a decimal value', () => {
    expect(cc.encode(125.5, CONFIG)).to.equal('XANE.EY');
  });

  it('round-trips a range of values', () => {
    [0, 1, 9, 10, 99, 100.25, 1234.5, 99999.99].forEach((v) => {
      const code = cc.encode(v, CONFIG);
      expect(cc.decode(code, CONFIG)).to.equal(Number(v.toFixed ? v.toFixed(2) : v) * 1);
    });
  });

  it('respects a custom digit map', () => {
    const cfg = { ...CONFIG, digitMap: { ...CONFIG.digitMap, '1':'Z','2':'Q' } };
    expect(cc.encode(12, cfg)).to.equal('XZQY');
    expect(cc.decode('XZQY', cfg)).to.equal(12);
  });

  it('supports repeat compression', () => {
    const cfg = { ...CONFIG, repeatChar: '*' };
    // 55 -> E then repeat
    expect(cc.encode(55, cfg)).to.equal('XE*Y');
    expect(cc.decode('XE*Y', cfg)).to.equal(55);
  });

  it('rejects a bad prefix on decode', () => {
    expect(() => cc.decode('ZANEY', CONFIG)).to.throw(/prefix/);
  });

  it('rejects unknown characters', () => {
    expect(() => cc.decode('XZZZY', CONFIG)).to.throw(/unknown character/);
  });

  it('rejects numeric values in the digit map', () => {
    const bad = { ...CONFIG, digitMap: { ...CONFIG.digitMap, '1':'5' } };
    expect(() => cc.encode(1, bad)).to.throw(/not be numeric/);
  });

  it('rejects duplicate letters in the map', () => {
    const bad = { ...CONFIG, digitMap: { ...CONFIG.digitMap, '2':'A' } };
    expect(() => cc.encode(1, bad)).to.throw(/unique/);
  });
});

describe('costCodeService pricing pipeline', () => {
  it('computes cost price from purchase + handling %', () => {
    expect(cc.computeCostPrice(100, 10)).to.equal(110);
  });
  it('computes selling price from cost + markup %', () => {
    expect(cc.computeSellingPrice(110, 25)).to.equal(137.5);
  });
  it('derives the full pipeline', () => {
    const r = cc.derivePricing({ purchasePrice: 100, handlingCostPct: 10, markupPct: 25 });
    expect(r.costPrice).to.equal(110);
    expect(r.sellingPrice).to.equal(137.5);
  });
});
