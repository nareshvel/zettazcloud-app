const { v4: uuidv4 } = require('uuid');
const { query, pool } = require('../config/db');

/**
 * store_product_listings — per-store price/stock/active override for a
 * tenant-shared product (products.store_id IS NULL).
 *
 * See docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
 *
 * Store-owned products (products.store_id NOT NULL) never go through this
 * table — they keep reading/writing products.price / products.stock_quantity
 * directly. Callers are responsible for branching on products.store_id
 * before calling into this service (see resolveEffectiveProduct below for
 * the read-side convenience that does this for you).
 */

/**
 * Get (or lazily understand there is no) per-store listing row for a
 * product at a store.
 */
const getListing = async (tenantId, storeId, productId) => {
  const [rows] = await query(
    `SELECT * FROM store_product_listings WHERE tenant_id = ? AND store_id = ? AND product_id = ?`,
    [tenantId, storeId, productId]
  );
  return rows && rows[0] ? rows[0] : null;
};

/**
 * List all per-store listings for a store, joined with the shared product's
 * own base fields so callers get one effective row per product.
 */
const getListingsForStore = async (tenantId, storeId, { search = '', limit = 50, offset = 0 } = {}) => {
  const limitNum = parseInt(limit) || 50;
  const offsetNum = parseInt(offset) || 0;

  let sql = `
    SELECT
      p.id AS product_id,
      p.name,
      p.sku,
      p.barcode,
      p.category_id,
      p.price AS base_price,
      p.cost_price AS base_cost_price,
      spl.id AS listing_id,
      spl.price AS override_price,
      spl.cost_price_override,
      spl.stock_quantity,
      spl.is_active AS listing_active,
      COALESCE(spl.price, p.price) AS effective_price,
      COALESCE(spl.cost_price_override, p.cost_price) AS effective_cost_price
    FROM products p
    INNER JOIN store_product_listings spl
      ON spl.product_id = p.id AND spl.store_id = ? AND spl.tenant_id = ?
    WHERE p.tenant_id = ? AND p.store_id IS NULL
  `;
  const params = [storeId, tenantId, tenantId];

  if (search) {
    sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ` ORDER BY p.name ASC LIMIT ${limitNum} OFFSET ${offsetNum}`;

  const [rows] = await query(sql, params);
  return rows || [];
};

/**
 * Create or update a store's listing for a shared product. `price: null`
 * clears the override (falls back to the shared product's own price).
 */
const upsertListing = async (tenantId, storeId, productId, { price, costPriceOverride, isActive } = {}) => {
  // Mutual exclusivity (plan doc §6 Q2): a store-owned product never gets a
  // listing row — it's not shared, so there's nothing to override per-store.
  const [productRows] = await query(
    `SELECT store_id FROM products WHERE id = ? AND tenant_id = ?`,
    [productId, tenantId]
  );
  if (!productRows.length) {
    throw new Error(`Product ${productId} was not found for this tenant.`);
  }
  if (productRows[0].store_id !== null) {
    throw new Error(
      `Product ${productId} is store-owned (store_id=${productRows[0].store_id}); ` +
      `store_product_listings only applies to tenant-wide shared products (products.store_id IS NULL).`
    );
  }

  const existing = await getListing(tenantId, storeId, productId);

  if (existing) {
    const fields = [];
    const params = [];
    if (price !== undefined) { fields.push('price = ?'); params.push(price); }
    if (costPriceOverride !== undefined) { fields.push('cost_price_override = ?'); params.push(costPriceOverride); }
    if (isActive !== undefined) { fields.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (fields.length === 0) return existing;

    params.push(existing.id);
    await query(`UPDATE store_product_listings SET ${fields.join(', ')} WHERE id = ?`, params);
    return getListing(tenantId, storeId, productId);
  }

  const id = uuidv4();
  await query(
    `INSERT INTO store_product_listings
      (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, tenantId, storeId, productId, price ?? null, costPriceOverride ?? null, isActive === undefined ? 1 : (isActive ? 1 : 0)]
  );
  return getListing(tenantId, storeId, productId);
};

/**
 * Adjust a store's stock for a shared product by a signed delta, inside the
 * caller's own transaction connection (`conn`) so it participates in the
 * same atomic unit as a sale/GRN/adjustment. Locks the listing row.
 * Throws if the listing doesn't exist or would go negative (caller decides
 * whether that's fatal).
 */
const adjustStockForUpdate = async (conn, tenantId, storeId, productId, delta) => {
  const [rows] = await conn.query(
    `SELECT id, stock_quantity FROM store_product_listings
     WHERE tenant_id = ? AND store_id = ? AND product_id = ? FOR UPDATE`,
    [tenantId, storeId, productId]
  );
  if (!rows || !rows[0]) {
    throw new Error(`No store_product_listings row for tenant=${tenantId} store=${storeId} product=${productId}`);
  }
  const newQty = rows[0].stock_quantity + delta;
  await conn.query(
    `UPDATE store_product_listings SET stock_quantity = ? WHERE id = ?`,
    [newQty, rows[0].id]
  );
  return newQty;
};

/**
 * Convenience for read paths that don't yet distinguish store-owned vs
 * shared products: given a product row (already fetched with its own
 * store_id/price/stock_quantity), returns the effective price/stock for the
 * given store — either the product's own values (store-owned) or the
 * per-store listing's values (shared).
 */
const resolveEffectiveProduct = async (tenantId, storeId, product) => {
  if (product.store_id) {
    // Store-owned product — use its own columns as-is.
    return {
      ...product,
      effectivePrice: product.price,
      effectiveStockQuantity: product.stock_quantity
    };
  }
  const listing = await getListing(tenantId, storeId, product.id);
  return {
    ...product,
    effectivePrice: listing && listing.price != null ? listing.price : product.price,
    effectiveStockQuantity: listing ? listing.stock_quantity : 0,
    listingId: listing ? listing.id : null,
    listingActive: listing ? !!listing.is_active : false
  };
};

/**
 * Compute a weighted-average-cost update from an old (qty, cost) basis and a
 * newly received (qty, cost) pair. Shared by receiveStock's store-owned and
 * shared-product branches, both of which now do this math against their own
 * store's numbers only — see the 2026-09-08 product-owner direction quoted
 * on the `store_product_listings` migration this feature depends on
 * (database/migrations/2026-09-08_store_product_listings_own_cost_tracking.sql):
 * cost/WAC/total-received must be tracked strictly per store, never shared
 * or aggregated across stores, unless a tenant/authorised user deliberately
 * chooses to (no such override path exists yet).
 */
const computeWeightedAverageCost = (oldQty, oldWAC, receivedQty, receivedCost) => {
  const safeOldQty = isNaN(oldQty) ? 0 : oldQty;
  const safeOldWAC = isNaN(oldWAC) ? 0 : oldWAC;
  const safeReceivedQty = isNaN(receivedQty) ? 0 : receivedQty;
  const safeReceivedCost = isNaN(receivedCost) ? 0 : receivedCost;
  const safeNewQty = safeOldQty + safeReceivedQty;

  if (safeNewQty <= 0) return safeReceivedCost;
  if (safeOldQty <= 0 && safeReceivedQty > 0) return safeReceivedCost;

  const oldValue = safeOldQty * safeOldWAC;
  const newValue = safeReceivedQty * safeReceivedCost;
  const result = (oldValue + newValue) / safeNewQty;
  return (isNaN(result) || !isFinite(result)) ? safeReceivedCost : result;
};

/**
 * Receive stock for a product inside the caller's own transaction
 * (`conn`) — the shared entry point for GRN receiving (and anywhere else
 * that increases stock via a "received quantity + cost" pair, as opposed to
 * a straight stock-adjustment). Branches on the product's own `store_id`:
 *
 *  - Store-owned product: increments `products.stock_quantity`/
 *    `weighted_average_cost`/`total_quantity_received` directly (unchanged
 *    behavior).
 *  - Shared product: increments the given store's own
 *    `store_product_listings` row instead — `stock_quantity`,
 *    `weighted_average_cost`, `total_quantity_received`, and
 *    `last_received_cost_price`/`last_received_date` are all tracked on
 *    that row, strictly for this store, and never touch the `products` row
 *    or any other store's listing. Per product-owner direction: sharing a
 *    product shares its details only, not cost/price/receiving history —
 *    each store's cost basis is entirely its own.
 *
 * Returns { isSharedProduct, oldQtyOnHand, newQtyOnHand, oldWeightedAverageCost,
 * newWeightedAverageCost, oldTotalQuantityReceived, newTotalQuantityReceived }
 * so the caller can write its own inventory_logs row with accurate before/after
 * values, matching what grnController.js already did inline.
 */
const receiveStock = async (conn, tenantId, storeId, productId, receivedQty, receivedCost, { receivedDate, userId } = {}) => {
  const [productRows] = await conn.query(
    'SELECT store_id, stock_quantity, weighted_average_cost, total_quantity_received FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
    [productId, tenantId]
  );
  if (!productRows.length) {
    throw new Error(`Product ${productId} was not found for this tenant.`);
  }
  const isSharedProduct = productRows[0].store_id === null;
  const safeReceivedQty = isNaN(receivedQty) ? 0 : receivedQty;
  const safeReceivedCost = isNaN(receivedCost) ? 0 : receivedCost;

  if (isSharedProduct) {
    if (!storeId) {
      throw new Error(`store_id is required to receive stock for shared product ${productId}.`);
    }
    // Lock (and create if missing) this store's own listing row — every
    // number below is scoped to this row alone.
    await conn.query(
      `INSERT INTO store_product_listings (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, weighted_average_cost, total_quantity_received, is_active)
       VALUES (?, ?, ?, ?, NULL, NULL, 0, NULL, 0, 1)
       ON DUPLICATE KEY UPDATE id = id`,
      [uuidv4(), tenantId, storeId, productId]
    );
    const [listingRows] = await conn.query(
      `SELECT stock_quantity, weighted_average_cost, total_quantity_received
       FROM store_product_listings WHERE tenant_id = ? AND store_id = ? AND product_id = ? FOR UPDATE`,
      [tenantId, storeId, productId]
    );
    const listing = listingRows[0];
    const oldQtyOnHand = parseFloat(listing.stock_quantity || 0);
    const oldWeightedAverageCost = parseFloat(listing.weighted_average_cost || 0);
    const oldTotalQuantityReceived = parseFloat(listing.total_quantity_received || 0);

    const newQtyOnHand = oldQtyOnHand + safeReceivedQty;
    const newTotalQuantityReceived = oldTotalQuantityReceived + safeReceivedQty;
    const newWeightedAverageCost = computeWeightedAverageCost(oldQtyOnHand, oldWeightedAverageCost, safeReceivedQty, safeReceivedCost);

    await conn.query(
      `UPDATE store_product_listings
       SET stock_quantity = ?, weighted_average_cost = ?, total_quantity_received = ?, last_received_cost_price = ?, last_received_date = ?
       WHERE tenant_id = ? AND store_id = ? AND product_id = ?`,
      [newQtyOnHand.toFixed(2), newWeightedAverageCost.toFixed(4), newTotalQuantityReceived.toFixed(2), safeReceivedCost.toFixed(2), receivedDate || new Date(), tenantId, storeId, productId]
    );

    return {
      isSharedProduct: true,
      oldQtyOnHand,
      newQtyOnHand,
      oldWeightedAverageCost,
      newWeightedAverageCost,
      oldTotalQuantityReceived,
      newTotalQuantityReceived,
    };
  }

  const oldQtyOnHand = parseFloat(productRows[0].stock_quantity || 0);
  const oldWeightedAverageCost = parseFloat(productRows[0].weighted_average_cost || 0);
  const oldTotalQuantityReceived = parseFloat(productRows[0].total_quantity_received || 0);
  const newQtyOnHand = oldQtyOnHand + safeReceivedQty;
  const newTotalQuantityReceived = oldTotalQuantityReceived + safeReceivedQty;
  const newWeightedAverageCost = computeWeightedAverageCost(oldQtyOnHand, oldWeightedAverageCost, safeReceivedQty, safeReceivedCost);

  await conn.query(
    'UPDATE products SET stock_quantity = ?, last_received_cost_price = ?, weighted_average_cost = ?, total_quantity_received = ?, last_received_date = ?, updated_by_user_id = ? WHERE id = ? AND tenant_id = ?',
    [newQtyOnHand.toFixed(2), safeReceivedCost.toFixed(2), newWeightedAverageCost.toFixed(4), newTotalQuantityReceived.toFixed(2), receivedDate || new Date(), userId || null, productId, tenantId]
  );

  return {
    isSharedProduct: false,
    oldQtyOnHand,
    newQtyOnHand,
    oldWeightedAverageCost,
    newWeightedAverageCost,
    oldTotalQuantityReceived,
    newTotalQuantityReceived,
  };
};

/**
 * Reverse a previously-received quantity (GRN status change back to
 * draft/cancelled, or a GRN edit/void) inside the caller's own transaction.
 * Mirrors receiveStock's store-owned/shared branching — for a shared
 * product, everything (`stock_quantity`, `weighted_average_cost`,
 * `total_quantity_received`) is reversed on the given store's own listing
 * row only, never on the `products` row or another store's listing.
 * `quantityToReverse` and `costToReverse` are positive numbers (the amount
 * originally received). Never lets a store's on-hand quantity go below 0.
 *
 * Returns { isSharedProduct, oldQtyOnHand, newQtyOnHand, currentWAC,
 * newWeightedAverageCost, currentTotalReceived, newTotalReceived } — same
 * shape grnController.js's inline reversal logic already computed, so
 * callers can keep writing their own inventory_logs row unchanged.
 */
const reverseStock = async (conn, tenantId, storeId, productId, quantityToReverse, costToReverse) => {
  const [productRows] = await conn.query(
    'SELECT store_id FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
    [productId, tenantId]
  );
  if (!productRows.length) {
    throw new Error(`Product ${productId} was not found for this tenant.`);
  }
  const isSharedProduct = productRows[0].store_id === null;

  if (isSharedProduct) {
    if (!storeId) {
      throw new Error(`store_id is required to reverse stock for shared product ${productId}.`);
    }
    const [listingRows] = await conn.query(
      `SELECT stock_quantity, weighted_average_cost, last_received_cost_price, total_quantity_received
       FROM store_product_listings WHERE tenant_id = ? AND store_id = ? AND product_id = ? FOR UPDATE`,
      [tenantId, storeId, productId]
    );
    if (!listingRows.length) {
      throw new Error(`No store_product_listings row for tenant=${tenantId} store=${storeId} product=${productId}.`);
    }
    const listing = listingRows[0];
    const currentWAC = parseFloat(listing.weighted_average_cost) || 0;
    const currentTotalReceived = parseFloat(listing.total_quantity_received) || 0;
    const lastReceivedCostPrice = listing.last_received_cost_price || 0;
    const oldQtyOnHand = parseFloat(listing.stock_quantity) || 0;

    const newQtyOnHand = Math.max(0, oldQtyOnHand - quantityToReverse);
    const newTotalReceived = Math.max(0, currentTotalReceived - quantityToReverse);

    let newWeightedAverageCost = currentWAC;
    if (newQtyOnHand > 0 && oldQtyOnHand > 0) {
      const currentTotalValue = oldQtyOnHand * currentWAC;
      const reversalValue = quantityToReverse * costToReverse;
      const newTotalValue = Math.max(0, currentTotalValue - reversalValue);
      newWeightedAverageCost = newTotalValue / newQtyOnHand;
      if (isNaN(newWeightedAverageCost) || !isFinite(newWeightedAverageCost)) {
        newWeightedAverageCost = currentWAC;
      }
    } else if (newQtyOnHand <= 0) {
      newWeightedAverageCost = lastReceivedCostPrice || 0;
    }

    await conn.query(
      `UPDATE store_product_listings
       SET stock_quantity = ?, weighted_average_cost = ?, total_quantity_received = ?
       WHERE tenant_id = ? AND store_id = ? AND product_id = ?`,
      [newQtyOnHand.toFixed(2), newWeightedAverageCost.toFixed(4), newTotalReceived.toFixed(2), tenantId, storeId, productId]
    );

    return {
      isSharedProduct: true,
      oldQtyOnHand,
      newQtyOnHand,
      currentWAC,
      newWeightedAverageCost,
      currentTotalReceived,
      newTotalReceived,
    };
  }

  const [prodDetailRows] = await conn.query(
    'SELECT stock_quantity, weighted_average_cost, last_received_cost_price, total_quantity_received FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
    [productId, tenantId]
  );
  const product = prodDetailRows[0];
  const currentWAC = parseFloat(product.weighted_average_cost) || 0;
  const currentTotalReceived = parseFloat(product.total_quantity_received) || 0;
  const lastReceivedCostPrice = product.last_received_cost_price || 0;
  const oldQtyOnHand = parseFloat(product.stock_quantity) || 0;

  const newQtyOnHand = Math.max(0, oldQtyOnHand - quantityToReverse);
  const newTotalReceived = Math.max(0, currentTotalReceived - quantityToReverse);

  let newWeightedAverageCost = currentWAC;
  if (newQtyOnHand > 0 && oldQtyOnHand > 0) {
    const currentTotalValue = oldQtyOnHand * currentWAC;
    const reversalValue = quantityToReverse * costToReverse;
    const newTotalValue = Math.max(0, currentTotalValue - reversalValue);
    newWeightedAverageCost = newTotalValue / newQtyOnHand;
    if (isNaN(newWeightedAverageCost) || !isFinite(newWeightedAverageCost)) {
      newWeightedAverageCost = currentWAC;
    }
  } else if (newQtyOnHand <= 0) {
    newWeightedAverageCost = lastReceivedCostPrice || 0;
  }

  await conn.query(
    'UPDATE products SET stock_quantity = ?, weighted_average_cost = ?, total_quantity_received = ? WHERE id = ? AND tenant_id = ?',
    [newQtyOnHand.toFixed(2), newWeightedAverageCost.toFixed(4), newTotalReceived.toFixed(2), productId, tenantId]
  );

  return {
    isSharedProduct: false,
    oldQtyOnHand,
    newQtyOnHand,
    currentWAC,
    newWeightedAverageCost,
    currentTotalReceived,
    newTotalReceived,
  };
};

/**
 * One-off bulk conversion for tenants adopting multi-store after already
 * having a catalog: every still-store-owned product (products.store_id NOT
 * NULL) becomes tenant-wide shared (store_id = NULL), with its *current*
 * store's existing stock/cost-tracking numbers preserved on a new
 * store_product_listings row for that same store — so nothing changes at
 * the store the product already belonged to, but every other store
 * (including a brand-new one) can now see it and receive stock into it.
 *
 * Only ever touches products that are still store-owned; already-shared
 * products (and their existing listings) are left untouched, so this is
 * safe to run more than once (e.g. after creating more products the
 * old-fashioned way).
 *
 * Returns { converted: number, skipped: number } — `skipped` counts
 * store-owned products that already had, unexpectedly, a listing row at
 * their own store (shouldn't normally happen given upsertListing's mutual
 * exclusivity check, but guarded against just in case of stale data).
 */
const shareExistingStoreOwnedProducts = async (tenantId) => {
  const conn = await pool.getConnection();
  let converted = 0;
  let skipped = 0;
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, store_id, stock_quantity, weighted_average_cost, total_quantity_received,
              last_received_cost_price, last_received_date
       FROM products
       WHERE tenant_id = ? AND store_id IS NOT NULL
       FOR UPDATE`,
      [tenantId]
    );

    for (const p of rows) {
      const [existingListing] = await conn.query(
        `SELECT id FROM store_product_listings WHERE tenant_id = ? AND store_id = ? AND product_id = ?`,
        [tenantId, p.store_id, p.id]
      );
      if (existingListing.length) {
        // Unexpected (a store-owned product shouldn't have a listing row at
        // all), but don't clobber it — skip and let it be looked at manually.
        skipped++;
        continue;
      }

      await conn.query(
        `INSERT INTO store_product_listings
          (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity,
           weighted_average_cost, total_quantity_received, last_received_cost_price, last_received_date, is_active)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, 1)`,
        [
          uuidv4(), tenantId, p.store_id, p.id,
          p.stock_quantity || 0,
          p.weighted_average_cost,
          p.total_quantity_received || 0,
          p.last_received_cost_price,
          p.last_received_date,
        ]
      );

      await conn.query(
        `UPDATE products SET store_id = NULL WHERE id = ? AND tenant_id = ?`,
        [p.id, tenantId]
      );
      converted++;
    }

    await conn.commit();
    return { converted, skipped };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  getListing,
  getListingsForStore,
  upsertListing,
  adjustStockForUpdate,
  resolveEffectiveProduct,
  receiveStock,
  reverseStock,
  shareExistingStoreOwnedProducts,
};
