/**
 * metalPricingService
 * -----------------------------------------------------------------------------
 * Weight-based jewelry pricing (optional; OFF unless a tenant enables it).
 *
 *   metal_value  = net_weight * rate_per_gram
 *   wastage      = net_weight * wastage_pct/100 * rate_per_gram
 *   making       = per_gram    -> net_weight * making_value
 *                  percentage  -> metal_value * making_value/100
 *                  flat        -> making_value
 *   line_total   = metal_value + wastage + making + stone_value
 *
 * Pure functions, no DB — unit-testable in isolation.
 */

'use strict';

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * @param {object} p
 * @param {number} p.netWeight        grams of metal
 * @param {number} p.ratePerGram      current metal rate
 * @param {number} [p.wastagePct]     wastage %, default 0
 * @param {'per_gram'|'percentage'|'flat'} [p.makingChargeType]
 * @param {number} [p.makingChargeValue]
 * @param {number} [p.stoneValue]     flat stone value added at the end
 * @returns {{metalValue:number, wastageValue:number, makingCharge:number, stoneValue:number, lineTotal:number}}
 */
function calculateLinePrice(p = {}) {
  const netWeight = Number(p.netWeight);
  const rate = Number(p.ratePerGram);
  if (Number.isNaN(netWeight) || netWeight < 0) throw new Error('metalPricing: netWeight invalid');
  if (Number.isNaN(rate) || rate < 0) throw new Error('metalPricing: ratePerGram invalid');

  const wastagePct = Number(p.wastagePct) || 0;
  const makingType = p.makingChargeType || 'per_gram';
  const makingValue = Number(p.makingChargeValue) || 0;
  const stoneValue = Number(p.stoneValue) || 0;

  const metalValue = netWeight * rate;
  const wastageValue = netWeight * (wastagePct / 100) * rate;

  let makingCharge = 0;
  if (makingType === 'per_gram') makingCharge = netWeight * makingValue;
  else if (makingType === 'percentage') makingCharge = metalValue * (makingValue / 100);
  else makingCharge = makingValue; // flat

  const lineTotal = metalValue + wastageValue + makingCharge + stoneValue;

  return {
    metalValue: round2(metalValue),
    wastageValue: round2(wastageValue),
    makingCharge: round2(makingCharge),
    stoneValue: round2(stoneValue),
    lineTotal: round2(lineTotal),
  };
}

/**
 * Build the snapshot persisted on sale_items.pricing_snapshot so a historical
 * invoice can always be reproduced even after rates change.
 */
function buildSnapshot(input, result) {
  return {
    method: 'weight',
    netWeight: Number(input.netWeight) || 0,
    ratePerGram: Number(input.ratePerGram) || 0,
    metal: input.metal || null,
    purityLabel: input.purityLabel || null,
    wastagePct: Number(input.wastagePct) || 0,
    makingChargeType: input.makingChargeType || 'per_gram',
    makingChargeValue: Number(input.makingChargeValue) || 0,
    ...result,
    pricedAt: new Date().toISOString(),
  };
}

module.exports = { calculateLinePrice, buildSnapshot, round2 };
