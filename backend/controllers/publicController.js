const db = require('../db');
const { query } = require('../config/db');
const logger = require('../utils/logger');
require('dotenv').config();

/**
 * Get all active promotional offers - public endpoint that doesn't require authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getActivePromotionalOffers = async (req, res) => {
  // INTENTIONALLY UNAUTHENTICATED — this is a public storefront endpoint, so there
  // is no session to derive tenant context from and the caller must identify the
  // tenant/store explicitly. This is safe ONLY because the response is limited to
  // active promotional offers, which are public marketing data.
  //
  // Do not copy this pattern into authenticated routes: everywhere a session
  // exists, tenant identity must come from `req.user` (the verified JWT).
  const tenant_id = req.headers['tenant-id'] || req.query.tenant_id;
  const store_id = req.headers['store-id'] || req.query.store_id;
  const currentDate = new Date();
  
  // Validate required parameters
  if (!tenant_id || !store_id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  // Store parameters in an object for logging
  const tenantId = tenant_id;
  const storeId = store_id;
  
  // Use the shared connection pool instead of opening a new connection per call.
  let offers = [];

  try {
    // SQL query to get all active offers for the tenant and store
    const sql = `SELECT
      po.id,
      po.tenant_id,
      po.store_id,
      po.name,
      po.description,
      po.offer_type,
      po.discount_value,
      po.start_date,
      po.end_date,
      po.is_active,
      po.priority,
      po.max_uses_per_customer,
      po.max_total_uses,
      po.current_total_uses,
      po.minimum_quantity,
      po.minimum_purchase_amount,
      po.created_at,
      po.updated_at
    FROM
      promotional_offers po
    WHERE
      po.tenant_id = ?
      AND po.store_id = ?`;

    // Execute the query to get all offers
    offers = await query(sql, [tenantId, storeId]);

    // Get rules for each offer
    for (const offer of offers) {
      try {
        const rules = await query(
          `SELECT
            ofr.rule_type as ruleType,
            ofr.entity_id as entityId,
            ofr.quantity
          FROM
            offer_rules ofr
          WHERE
            ofr.offer_id = ?`,
          [offer.id]
        );

        // Assign rules to the offer
        offer.rules = rules;
      } catch (error) {
        console.error(`Error fetching rules for offer ${offer.id}:`, error);
        offer.rules = [];
      }
    }

    // Return the processed offers array
    res.json({ data: offers });
  } catch (error) {
    console.error('Error fetching active promotional offers:', error);
    res.status(500).json({ message: 'Failed to fetch promotional offers' });
  }
};

module.exports = {
  getActivePromotionalOffers
};
