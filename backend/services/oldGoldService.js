/**
 * oldGoldService
 * -----------------------------------------------------------------------------
 * Pure valuation helpers for the old-gold / metal exchange flow. No DB deps so
 * it can be unit-tested in isolation.
 *
 * Pure-metal weight = (gross_weight - stone_deduction) * purity_pct/100
 *   (or an explicitly supplied net_weight overrides the calculation)
 * Valuation        = pure_weight * rate_per_gram - amount_deduction   (min 0)
 */

'use strict';

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function round3(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

/**
 * @param {object} p
 * @param {number} p.grossWeight      grams
 * @param {number} [p.stoneDeduction] grams (default 0)
 * @param {number} [p.purityPct]      e.g. 91.6 for 22K
 * @param {number} [p.netWeight]      overrides computed pure weight if provided
 * @param {number} p.ratePerGram      buy rate per gram of pure metal
 * @param {number} [p.amountDeduction] flat handling/refining deduction
 * @returns {{ netWeight:number, valuationAmount:number }}
 */
function computeValuation(p = {}) {
  const gross = Number(p.grossWeight);
  if (Number.isNaN(gross) || gross < 0) throw new Error('oldGold: grossWeight invalid');
  const rate = Number(p.ratePerGram);
  if (Number.isNaN(rate) || rate < 0) throw new Error('oldGold: ratePerGram invalid');

  const stone = Number(p.stoneDeduction) || 0;
  const amtDed = Number(p.amountDeduction) || 0;

  let net;
  if (p.netWeight !== undefined && p.netWeight !== null && p.netWeight !== '') {
    net = Number(p.netWeight);
    if (Number.isNaN(net) || net < 0) throw new Error('oldGold: netWeight invalid');
  } else {
    const purity = Number(p.purityPct);
    if (Number.isNaN(purity) || purity <= 0 || purity > 100) {
      throw new Error('oldGold: purityPct must be between 0 and 100 (or provide netWeight)');
    }
    net = (gross - stone) * (purity / 100);
  }
  net = round3(Math.max(net, 0));
  const valuation = round2(Math.max(net * rate - amtDed, 0));
  return { netWeight: net, valuationAmount: valuation };
}

module.exports = { computeValuation, round2, round3 };
