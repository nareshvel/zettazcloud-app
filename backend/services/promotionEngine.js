// promotionEngine.js
// Basic server-side promotional discounts computation

/**
 * Compute promotional discounts for a sale request
 * Currently supports simple global or product-scoped offers of type:
 *  - percentage (discount_value = percent)
 *  - fixed_amount (discount_value = per-unit currency)
 * Applies offers by descending priority and sums per-item promo discounts.
 *
 * @param {Object} params
 * @param {Array<{product_id: string, quantity: number, price: number}>} params.items
 * @param {string} params.tenantId
 * @param {string} params.storeId
 * @param {import('mysql2/promise').Pool} params.pool
 */
async function computePromotions({ items, tenantId, storeId, pool }) {
  // 1) Fetch active offers. `store_id IS NULL` rows are the tenant-wide
  // default offer set; a store with its own offers OVERRIDES the tenant
  // defaults for that store entirely ("replace, not merge" — see
  // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §6 Q3,
  // same rule applied to tax classes). Fetch both, then filter in
  // application code rather than SQL so the replace logic stays easy to read.
  const [allOffers] = await pool.query(
    `SELECT
       id, name, offer_type AS offerType, discount_value AS discountValue,
       minimum_quantity AS minimumQuantity,
       priority, store_id AS storeId
     FROM promotional_offers
     WHERE tenant_id = ? AND (store_id = ? OR store_id IS NULL) AND is_active = 1
       AND (start_date IS NULL OR start_date = '0000-00-00 00:00:00' OR start_date <= NOW())
       AND (end_date IS NULL OR end_date = '0000-00-00 00:00:00' OR end_date >= NOW())`,
    [tenantId, storeId]
  );

  const hasStoreSpecificOffers = allOffers.some(o => o.storeId === storeId);
  const offers = hasStoreSpecificOffers
    ? allOffers.filter(o => o.storeId === storeId)
    : allOffers;

  // 2) Load rules per offer (product-scoped only for now)
  const offerRulesMap = new Map();
  if (offers.length > 0) {
    const offerIds = offers.map(o => o.id);
    const placeholders = offerIds.map(() => '?').join(',');
    const [rules] = await pool.query(
      `SELECT offer_id, rule_type AS ruleType, entity_id AS entityId, quantity
       FROM offer_rules
       WHERE offer_id IN (${placeholders})`,
      offerIds
    );
    for (const rule of rules) {
      const arr = offerRulesMap.get(rule.offer_id) || [];
      arr.push(rule);
      offerRulesMap.set(rule.offer_id, arr);
    }

    // 2b) Load price tiers for tiered_pricing
    const [tiers] = await pool.query(
      `SELECT offer_id, quantity, price
       FROM offer_price_tiers
       WHERE offer_id IN (${placeholders})
       ORDER BY quantity DESC`,
      offerIds
    );
    // Map: offer_id -> sorted tiers (desc by quantity)
    var offerTiersMap = new Map();
    for (const t of tiers) {
      const arr = offerTiersMap.get(t.offer_id) || [];
      arr.push({ quantity: Number(t.quantity), price: Number(t.price) });
      offerTiersMap.set(t.offer_id, arr);
    }
  }

  // Sort offers by priority high->low (nulls last)
  const sortedOffers = [...offers].sort((a, b) => (b.priority ?? -Infinity) - (a.priority ?? -Infinity));

  let salePromotionsAmount = 0;
  const perItem = items.map(it => ({
    product_id: it.product_id,
    promo_discount_per_unit: 0,
    final_unit_price: Number(it.price),
    applied_discounts_json: []
  }));
  const appliedOffersSnapshot = [];
  const offerAudits = [];
  const itemDiscountAudits = [];

  // 3) Apply offers
  for (const offer of sortedOffers) {
    const rules = offerRulesMap.get(offer.id) || [];
    const isGlobal = rules.length === 0; // no rule => applies to all products

    let offerTotal = 0;
    // apply to each item
    items.forEach((it, idx) => {
      // check applicability
      let applicable = isGlobal;
      if (!isGlobal) {
        // Support product rule only for now
        applicable = rules.some(r => r.ruleType === 'product' && r.entityId === it.product_id);
      }
      if (!applicable) return;

      const pricePerUnit = Number(it.price) || 0;
      const qty = Number(it.quantity) || 0;
      if (qty <= 0 || pricePerUnit <= 0) return;

      // compute discount according to offer type
      const type = (offer.offerType || '').toLowerCase();
      if (type === 'percentage' || type === 'percentage_discount') {
        const pct = Number(offer.discountValue) || 0;
        let unitDiscount = (pricePerUnit * pct) / 100;
        unitDiscount = Math.max(0, Math.min(unitDiscount, pricePerUnit));
        if (unitDiscount > 0) {
          perItem[idx].promo_discount_per_unit += unitDiscount;
          perItem[idx].applied_discounts_json.push({
            offerId: offer.id,
            offerName: offer.name,
            offerType: offer.offerType,
            discountPerUnit: unitDiscount,
          });
          const totalForItem = unitDiscount * qty;
          offerTotal += totalForItem;
          itemDiscountAudits.push({
            item_index: idx,
            product_id: it.product_id,
            offer_id: offer.id,
            offer_name: offer.name,
            offer_type: offer.offerType,
            rule_type: isGlobal ? null : 'product',
            rule_entity_id: isGlobal ? null : it.product_id,
            quantity_applied: qty,
            discount_per_unit: unitDiscount,
            total_discount_amount: totalForItem,
            metadata_json: null,
          });
        }
      } else if (type === 'fixed_amount' || type === 'fixed_discount') {
        let unitDiscount = Number(offer.discountValue) || 0;
        unitDiscount = Math.max(0, Math.min(unitDiscount, pricePerUnit));
        if (unitDiscount > 0) {
          perItem[idx].promo_discount_per_unit += unitDiscount;
          perItem[idx].applied_discounts_json.push({
            offerId: offer.id,
            offerName: offer.name,
            offerType: offer.offerType,
            discountPerUnit: unitDiscount,
          });
          const totalForItem = unitDiscount * qty;
          offerTotal += totalForItem;
          itemDiscountAudits.push({
            item_index: idx,
            product_id: it.product_id,
            offer_id: offer.id,
            offer_name: offer.name,
            offer_type: offer.offerType,
            rule_type: isGlobal ? null : 'product',
            rule_entity_id: isGlobal ? null : it.product_id,
            quantity_applied: qty,
            discount_per_unit: unitDiscount,
            total_discount_amount: totalForItem,
            metadata_json: null,
          });
        }
      } else if (type === 'buy_x_get_y') {
        // Do not change per-unit price. Compute total discount as free items * pricePerUnit
        const ruleX = Number(rules.find(r => r.ruleType === 'product')?.quantity || 0) || 0;
        const x = ruleX > 0 ? ruleX : (Number(offer.minimumQuantity) || 0);
        const y = Number(offer.discountValue) || 0;
        if (x > 0 && y > 0 && qty >= x) {
          const sets = Math.floor(qty / (x + y));
          const freeItems = Math.min(sets * y, qty - (sets * x));
          const totalForItem = Math.max(0, freeItems * pricePerUnit);
          if (totalForItem > 0) {
            perItem[idx].applied_discounts_json.push({
              offerId: offer.id,
              offerName: offer.name,
              offerType: offer.offerType,
              discountPerUnit: 0,
              metadata: { freeQuantity: freeItems }
            });
            offerTotal += totalForItem;
            itemDiscountAudits.push({
              item_index: idx,
              product_id: it.product_id,
              offer_id: offer.id,
              offer_name: offer.name,
              offer_type: offer.offerType,
              rule_type: isGlobal ? null : 'product',
              rule_entity_id: isGlobal ? null : it.product_id,
              quantity_applied: qty,
              discount_per_unit: 0,
              total_discount_amount: totalForItem,
              metadata_json: JSON.stringify({ freeQuantity: freeItems }),
            });
          }
        }
      } else if (type === 'bundle_price') {
        // When buying minimumQuantity items, total price is fixed at discountValue
        const minQty = Number(offer.minimumQuantity || 0);
        const bundlePrice = Number(offer.discountValue) || 0;
        if (minQty > 0 && bundlePrice >= 0 && qty >= minQty) {
          const bundles = Math.floor(qty / minQty);
          const bundleDiscount = (minQty * pricePerUnit) - bundlePrice;
          const totalForItem = Math.max(0, bundles * bundleDiscount);
          if (totalForItem > 0) {
            const unitDiscount = totalForItem / qty; // prorate across units for storage
            perItem[idx].promo_discount_per_unit += unitDiscount;
            perItem[idx].applied_discounts_json.push({
              offerId: offer.id,
              offerName: offer.name,
              offerType: offer.offerType,
              discountPerUnit: unitDiscount,
              metadata: { bundles, bundleSize: minQty, bundlePrice }
            });
            offerTotal += totalForItem;
            itemDiscountAudits.push({
              item_index: idx,
              product_id: it.product_id,
              offer_id: offer.id,
              offer_name: offer.name,
              offer_type: offer.offerType,
              rule_type: isGlobal ? null : 'product',
              rule_entity_id: isGlobal ? null : it.product_id,
              quantity_applied: qty,
              discount_per_unit: unitDiscount,
              total_discount_amount: totalForItem,
              metadata_json: JSON.stringify({ bundles, bundleSize: minQty, bundlePrice }),
            });
          }
        }
      } else if (type === 'tiered_pricing') {
        // Apply highest tier whose quantity <= qty
        const tiers = (typeof offerTiersMap !== 'undefined') ? offerTiersMap.get(offer.id) || [] : [];
        if (tiers.length > 0) {
          let pricePerItem = pricePerUnit; // default
          for (const t of tiers) {
            if (qty >= t.quantity) { pricePerItem = t.price; break; }
          }
          const originalTotal = qty * pricePerUnit;
          const discountedTotal = qty * pricePerItem;
          const totalForItem = Math.max(0, originalTotal - discountedTotal);
          if (totalForItem > 0) {
            const unitDiscount = totalForItem / qty;
            perItem[idx].promo_discount_per_unit += unitDiscount;
            perItem[idx].applied_discounts_json.push({
              offerId: offer.id,
              offerName: offer.name,
              offerType: offer.offerType,
              discountPerUnit: unitDiscount,
              metadata: { appliedTierPrice: pricePerItem, appliedTierQuantity: qty }
            });
            offerTotal += totalForItem;
            itemDiscountAudits.push({
              item_index: idx,
              product_id: it.product_id,
              offer_id: offer.id,
              offer_name: offer.name,
              offer_type: offer.offerType,
              rule_type: isGlobal ? null : 'product',
              rule_entity_id: isGlobal ? null : it.product_id,
              quantity_applied: qty,
              discount_per_unit: unitDiscount,
              total_discount_amount: totalForItem,
              metadata_json: JSON.stringify({ appliedTierPrice: pricePerItem, appliedTierQuantity: qty }),
            });
          }
        }
      } else {
        // unsupported types ignored
      }
    });

    if (offerTotal > 0) {
      salePromotionsAmount += offerTotal;
      appliedOffersSnapshot.push({
        offerId: offer.id,
        name: offer.name,
        offerType: offer.offerType,
        discountValue: offer.discountValue,
        priority: offer.priority,
        totalDiscountAmount: offerTotal,
      });
      offerAudits.push({
        offer_id: offer.id,
        offer_name: offer.name,
        offer_type: offer.offerType,
        discount_value: offer.discountValue,
        priority: offer.priority,
        rules_json: rules,
        price_tiers_json: null,
        total_discount_amount: offerTotal,
      });
    }
  }

  // finalize per-item final price
  perItem.forEach((p, idx) => {
    p.promo_discount_per_unit = Number(p.promo_discount_per_unit.toFixed(4));
    const base = Number(items[idx].price) || 0;
    p.final_unit_price = Math.max(0, base - p.promo_discount_per_unit);
  });

  return {
    salePromotionsAmount: Number(salePromotionsAmount.toFixed(2)),
    appliedOffersSnapshot,
    perItem,
    offerAudits,
    itemDiscountAudits,
  };
}

module.exports = { computePromotions };
