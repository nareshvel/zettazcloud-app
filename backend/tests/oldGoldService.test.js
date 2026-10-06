/* eslint-disable */
const { expect } = require('chai');
const og = require('../services/oldGoldService');

describe('oldGoldService.computeValuation', () => {
  it('values by purity when net weight not given', () => {
    // 10g gross, 22K (91.6%), rate 60/g -> net 9.16g -> 549.6
    const r = og.computeValuation({ grossWeight: 10, purityPct: 91.6, ratePerGram: 60 });
    expect(r.netWeight).to.equal(9.16);
    expect(r.valuationAmount).to.equal(549.6);
  });

  it('subtracts stone deduction before purity', () => {
    // (10 - 2) * 0.75 = 6g net, rate 50 -> 300
    const r = og.computeValuation({ grossWeight: 10, stoneDeduction: 2, purityPct: 75, ratePerGram: 50 });
    expect(r.netWeight).to.equal(6);
    expect(r.valuationAmount).to.equal(300);
  });

  it('honours an explicit net weight override', () => {
    const r = og.computeValuation({ grossWeight: 10, netWeight: 8, ratePerGram: 10 });
    expect(r.netWeight).to.equal(8);
    expect(r.valuationAmount).to.equal(80);
  });

  it('applies a flat amount deduction and never goes negative', () => {
    const r = og.computeValuation({ grossWeight: 1, purityPct: 100, ratePerGram: 10, amountDeduction: 100 });
    expect(r.valuationAmount).to.equal(0);
  });

  it('rejects invalid purity', () => {
    expect(() => og.computeValuation({ grossWeight: 10, purityPct: 0, ratePerGram: 10 })).to.throw(/purityPct/);
  });

  it('rejects invalid gross weight', () => {
    expect(() => og.computeValuation({ grossWeight: -1, purityPct: 90, ratePerGram: 10 })).to.throw(/grossWeight/);
  });
});
