/* eslint-disable */
const { expect } = require('chai');
const mp = require('../services/metalPricingService');

describe('metalPricingService.calculateLinePrice', () => {
  it('prices metal by weight and rate', () => {
    const r = mp.calculateLinePrice({ netWeight: 10, ratePerGram: 60, makingChargeType: 'per_gram', makingChargeValue: 0 });
    expect(r.metalValue).to.equal(600);
    expect(r.lineTotal).to.equal(600);
  });

  it('adds per-gram making charge', () => {
    const r = mp.calculateLinePrice({ netWeight: 10, ratePerGram: 60, makingChargeType: 'per_gram', makingChargeValue: 5 });
    expect(r.makingCharge).to.equal(50);
    expect(r.lineTotal).to.equal(650);
  });

  it('adds percentage making charge on metal value', () => {
    const r = mp.calculateLinePrice({ netWeight: 10, ratePerGram: 60, makingChargeType: 'percentage', makingChargeValue: 10 });
    expect(r.makingCharge).to.equal(60);
    expect(r.lineTotal).to.equal(660);
  });

  it('adds flat making charge', () => {
    const r = mp.calculateLinePrice({ netWeight: 10, ratePerGram: 60, makingChargeType: 'flat', makingChargeValue: 200 });
    expect(r.makingCharge).to.equal(200);
    expect(r.lineTotal).to.equal(800);
  });

  it('applies wastage and stone value', () => {
    // metal 600, wastage 2% -> 12, stone 100
    const r = mp.calculateLinePrice({ netWeight: 10, ratePerGram: 60, wastagePct: 2, stoneValue: 100, makingChargeValue: 0 });
    expect(r.wastageValue).to.equal(12);
    expect(r.lineTotal).to.equal(712);
  });

  it('rejects invalid weight', () => {
    expect(() => mp.calculateLinePrice({ netWeight: -1, ratePerGram: 10 })).to.throw(/netWeight/);
  });

  it('builds a reproducible snapshot', () => {
    const input = { netWeight: 5, ratePerGram: 50, metal: 'Gold', purityLabel: '22K' };
    const snap = mp.buildSnapshot(input, mp.calculateLinePrice(input));
    expect(snap.method).to.equal('weight');
    expect(snap.ratePerGram).to.equal(50);
    expect(snap.lineTotal).to.be.a('number');
  });
});
