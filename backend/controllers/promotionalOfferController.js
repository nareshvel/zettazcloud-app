const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Get all promotional offers for the admin view
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllOffers = async (req, res) => {
  try {
    const tenantId = (req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null);
    const storeId = req.headers['store-id'];
    
    if (!storeId) {
      return res.status(400).json({ message: 'Store ID is required' });
    }

    // `store_id IS NULL` rows are tenant-wide default offers (see
    // createOffer()'s appliesToAllStores path and
    // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §4).
    // A strict `store_id = ?` here made every tenant-wide offer created
    // successfully but invisible on this admin list — confirmed live: an
    // offer inserted with store_id NULL never matched this equality filter.
    // Unlike promotionEngine.js's computePromotions (which applies
    // "replace, not merge" because it decides what actually discounts a
    // sale), this is a management list — an admin should see BOTH the
    // tenant default and any store-specific overrides, so both are
    // returned rather than one hiding the other.
    const [offers] = await pool.query(
      `SELECT
        id,
        name,
        description,
        offer_type as offerType,
        discount_value as discountValue,
        start_date as startDate,
        end_date as endDate,
        is_active as isActive,
        tenant_id as tenantId,
        store_id as storeId,
        created_at as createdAt,
        updated_at as updatedAt
      FROM
        promotional_offers
      WHERE
        tenant_id = ? AND
        (store_id = ? OR store_id IS NULL)
      ORDER BY
        store_id IS NULL DESC, created_at DESC`,
      [tenantId, storeId]
    );

    // This endpoint backs usePromotionalOffersData(), which is what the
    // POS cart's discount engine (discountService.ts's
    // isOfferApplicableToItem) actually reads — and that function
    // explicitly treats an offer with an empty/missing `rules` array as
    // NOT applicable to anything (see its "Skipping offer with no rules"
    // check). This SELECT never fetched offer_rules at all, so every offer
    // reached the cart with zero rules and could never discount anything,
    // regardless of what rule was actually configured. getActiveOffers/
    // getOfferById already fetch rules per offer; mirrored here.
    for (const offer of offers) {
      const [rules] = await pool.query(
        `SELECT rule_type as ruleType, entity_id as entityId, quantity
         FROM offer_rules WHERE offer_id = ?`,
        [offer.id]
      );
      offer.rules = rules;

      if (offer.offerType === 'tiered_pricing') {
        const [priceTiers] = await pool.query(
          `SELECT id, quantity, price FROM offer_price_tiers WHERE offer_id = ? ORDER BY quantity ASC`,
          [offer.id]
        );
        offer.priceTiers = priceTiers;
      }
    }

    res.json({ data: offers });
  } catch (error) {
    logger.error('Error fetching all promotional offers:', error);
    res.status(500).json({ message: 'Failed to fetch all offers', error: error.message });
  }
};


/**
 * Get all active promotional offers for the POS
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getActiveOffers = async (req, res) => {
  try {
    const tenantId = (req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null);
    const storeId = req.headers['store-id'];
    
    if (!storeId) {
      return res.status(400).json({ message: 'Store ID is required' });
    }

    // Same tenant-wide-default gap as getAllOffers above, plus the
    // "replace, not merge" rule promotionEngine.js's computePromotions
    // already applies when actually pricing a sale: if this store has any
    // offers of its own, its own offers are what's shown/active here — the
    // tenant defaults are entirely superseded for that store, not merged
    // alongside them.
    const [allOffers] = await pool.query(
      `SELECT
        id,
        name,
        description,
        offer_type as offerType,
        discount_value as discountValue,
        start_date as startDate,
        end_date as endDate,
        is_active as isActive,
        store_id as storeId,
        created_at as createdAt,
        updated_at as updatedAt
      FROM
        promotional_offers
      WHERE
        tenant_id = ? AND
        (store_id = ? OR store_id IS NULL) AND
        is_active = 1 AND
        (start_date IS NULL OR YEAR(start_date) = 0 OR start_date <= NOW()) AND
        (end_date IS NULL OR YEAR(end_date) = 0 OR end_date >= NOW())`,
      [tenantId, storeId]
    );

    const hasStoreSpecificOffers = allOffers.some((o) => o.storeId === storeId);
    const offers = hasStoreSpecificOffers
      ? allOffers.filter((o) => o.storeId === storeId)
      : allOffers;

    // For each offer, get its rules
    for (const offer of offers) {
      const [rules] = await pool.query(
        `SELECT 
          rule_type as ruleType,
          entity_id as entityId,
          quantity
        FROM 
          offer_rules 
        WHERE 
          offer_id = ?`,
        [offer.id]
      );
      
      offer.rules = rules;
      
      // For tiered pricing offers, also get price tiers
      if (offer.offerType === 'tiered_pricing') {
        const [priceTiers] = await pool.query(
          `SELECT 
            id,
            quantity,
            price
          FROM 
            offer_price_tiers
          WHERE 
            offer_id = ?
          ORDER BY
            quantity ASC`,
          [offer.id]
        );
        
        offer.priceTiers = priceTiers;
      }
    }

    res.json({ data: offers });
  } catch (error) {
    logger.error('Error fetching active promotional offers:', error);
    res.status(500).json({ message: 'Failed to fetch active offers', error: error.message });
  }
};

/**
 * Get a specific promotional offer by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null);

    // Look up by the offer's OWN id+tenant scope, not a `store_id = ?`
    // equality against the currently-active store — same gap as
    // getAllOffers above (a tenant-wide offer's store_id is NULL and would
    // never match), and the same fix updateOffer already uses for exactly
    // this reason (see its comment).
    const [offers] = await pool.query(
      `SELECT
        id,
        name,
        description,
        offer_type as offerType,
        discount_value as discountValue,
        start_date as startDate,
        end_date as endDate,
        is_active as isActive,
        tenant_id as tenantId,
        store_id as storeId,
        minimum_quantity as minimumQuantity,
        minimum_purchase_amount as minimumPurchaseAmount,
        max_total_uses as maxTotalUses,
        max_uses_per_customer as maxUsesPerCustomer,
        priority,
        created_at as createdAt,
        updated_at as updatedAt
      FROM
        promotional_offers
      WHERE
        id = ? AND
        tenant_id = ?`,
      [id, tenantId]
    );

    if (offers.length === 0) {
      return res.status(404).json({ message: 'Promotional offer not found' });
    }

    const offer = offers[0];

    // Get rules for the offer
    const [rules] = await pool.query(
      `SELECT 
        rule_type as ruleType,
        entity_id as entityId,
        quantity
      FROM 
        offer_rules 
      WHERE 
        offer_id = ?`,
      [id]
    );
    
    offer.rules = rules;
    
    // For tiered pricing offers, also get price tiers
    if (offer.offerType === 'tiered_pricing') {
      const [priceTiers] = await pool.query(
        `SELECT 
          id,
          quantity,
          price
        FROM 
          offer_price_tiers
        WHERE 
          offer_id = ?
        ORDER BY
          quantity ASC`,
        [id]
      );
      
      offer.priceTiers = priceTiers;
    }

    res.json({ data: offer });
  } catch (error) {
    logger.error('Error fetching promotional offer by ID:', error);
    res.status(500).json({ message: 'Failed to fetch offer', error: error.message });
  }
};

/**
 * Create a new promotional offer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createOffer = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const tenantId = (req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null);
    // `appliesToAllStores: true` (explicit client opt-in) creates a
    // tenant-wide default offer (store_id = NULL) instead of requiring a
    // specific store — see
    // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §4.
    // A store with its own offers REPLACES this default for that store (see
    // promotionEngine.js's computePromotions).
    // discountService.ts (the frontend caller) manually snake_cases its
    // request body and sends it pre-stringified, bypassing fetchApi's usual
    // camelCase auto-conversion — so this reads the snake_case wire field to
    // match that file's established convention, not the camelCase used
    // elsewhere in this codebase.
    const appliesToAllStores = req.body?.applies_to_all_stores === true;
    const storeId = appliesToAllStores ? null : req.headers['store-id'];

    if (!appliesToAllStores && !storeId) {
      connection.release();
      return res.status(400).json({ message: 'Store ID is required' });
    }

    const { 
      name, 
      description, 
      offerType, 
      offer_type, // Handle both field names
      discountValue, 
      discount_value, // Handle both field names
      startDate, 
      start_date, // Handle both field names
      endDate, 
      end_date, // Handle both field names
      isActive, 
      is_active, // Handle both field names
      minimumQuantity, 
      minimum_quantity, // Handle both field names
      minimumPurchaseAmount, 
      minimum_purchase_amount, // Handle both field names
      maxTotalUses, 
      max_total_uses, // Handle both field names
      maxUsesPerCustomer, 
      max_uses_per_customer, // Handle both field names
      priority, 
      rules, 
      priceTiers 
    } = req.body;

    // Debug logging for field extraction
    logger.log('Field extraction debug:', {
      offerType,
      offer_type,
      discountValue,
      discount_value,
      startDate,
      start_date,
      endDate,
      end_date,
      isActive,
      is_active
    });

    // Handle field mapping and provide defaults for required fields
    const actualOfferType = offerType || offer_type;
    const actualDiscountValue = discountValue !== undefined ? discountValue : discount_value;
    const actualStartDate = startDate || start_date;
    const actualEndDate = endDate || end_date;
    const actualIsActive = isActive !== undefined ? isActive : (is_active !== undefined ? is_active : true);

    // Debug logging for mapped values
    logger.log('Mapped values debug:', {
      actualOfferType,
      actualDiscountValue,
      actualStartDate,
      actualEndDate,
      actualIsActive
    });

    // Validate required fields
    if (!actualOfferType) {
      connection.release();
      return res.status(400).json({ 
        message: 'Offer type is required',
        error: 'offer_type cannot be null or undefined'
      });
    }

    if (actualDiscountValue === undefined || actualDiscountValue === null) {
      connection.release();
      return res.status(400).json({ 
        message: 'Discount value is required',
        error: 'discount_value cannot be null or undefined'
      });
    }

    const offerId = uuidv4();

    const offerData = {
      id: offerId,
      tenant_id: tenantId,
      store_id: storeId,
      name,
      description,
      offer_type: actualOfferType,
      discount_value: actualDiscountValue,
      start_date: actualStartDate,
      end_date: actualEndDate,
      is_active: actualIsActive,
      minimum_quantity: minimumQuantity || req.body.minimum_quantity || null,
      minimum_purchase_amount: minimumPurchaseAmount || req.body.minimum_purchase_amount || null,
      max_total_uses: maxTotalUses || req.body.max_total_uses || null,
      max_uses_per_customer: maxUsesPerCustomer || req.body.max_uses_per_customer || null,
      priority: priority || null,
    };

    // Debug logging
    logger.log('Creating promotional offer with data:', {
      offerId,
      tenantId,
      storeId,
      offerData: JSON.stringify(offerData, null, 2),
      requestBody: JSON.stringify(req.body, null, 2)
    });

    try {
      await connection.query('INSERT INTO promotional_offers SET ?', offerData);
      logger.log('Successfully inserted promotional offer:', offerId);
    } catch (insertError) {
      logger.error('Failed to insert promotional offer:', {
        error: insertError.message,
        code: insertError.code,
        sqlState: insertError.sqlState,
        sqlMessage: insertError.sqlMessage,
        sql: insertError.sql,
        offerData: JSON.stringify(offerData, null, 2)
      });
      throw insertError;
    }

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        // Handle field mapping for rules (camelCase vs snake_case)
        const actualRuleType = rule.ruleType || rule.rule_type;
        const actualEntityId = rule.entityId || rule.entity_id;
        
        const ruleData = {
          id: uuidv4(),
          tenant_id: tenantId,
          store_id: storeId,
          offer_id: offerId,
          rule_type: actualRuleType,
          entity_id: actualEntityId,
          quantity: rule.quantity,
        };
        
        logger.log('Inserting offer rule:', ruleData);
        await connection.query('INSERT INTO offer_rules SET ?', ruleData);
      }
    }

    if (offerType === 'tiered_pricing' && priceTiers && priceTiers.length > 0) {
      for (const tier of priceTiers) {
        const tierData = {
          id: uuidv4(),
          tenant_id: tenantId,
          store_id: storeId,
          offer_id: offerId,
          quantity: tier.quantity,
          price: tier.price,
        };
        await connection.query('INSERT INTO offer_price_tiers SET ?', tierData);
      }
    }

    await connection.commit();
    res.status(201).json({ message: 'Promotional offer created successfully', data: { id: offerId } });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Error rolling back transaction:', rollbackError);
    }
    logger.error('Error creating promotional offer:', error);
    res.status(500).json({ message: 'Failed to create promotional offer', error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * Update an existing promotional offer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateOffer = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const tenantId = (req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null);

    // Look up the offer's OWN scope rather than trusting the header — an
    // existing tenant-wide offer (store_id NULL) would never match
    // `store_id = <header value>`, and a store-specific offer shouldn't be
    // re-scoped by whichever store happens to be active when it's edited.
    // See docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §4.
    const [existingOfferRows] = await connection.query(
      'SELECT store_id FROM promotional_offers WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (existingOfferRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Promotional offer not found.' });
    }
    const storeId = existingOfferRows[0].store_id;

    // Accept both camelCase and snake_case like createOffer()
    const { 
      name, 
      description, 
      offerType, 
      offer_type, // snake case alternative
      discountValue, 
      discount_value, // snake case alternative
      startDate, 
      start_date, // snake case alternative
      endDate, 
      end_date, // snake case alternative
      isActive, 
      is_active, // snake case alternative
      minimumQuantity, 
      minimum_quantity, // snake case alternative
      minimumPurchaseAmount, 
      minimum_purchase_amount, // snake case alternative
      maxTotalUses, 
      max_total_uses, // snake case alternative
      maxUsesPerCustomer, 
      max_uses_per_customer, // snake case alternative
      priority, 
      rules, 
      priceTiers 
    } = req.body;

    // Map to actual values
    const actualOfferType = offerType || offer_type;
    const actualDiscountValue = discountValue !== undefined ? discountValue : discount_value;
    const actualStartDate = startDate || start_date;
    const actualEndDate = endDate || end_date;
    const actualIsActive = isActive !== undefined ? isActive : (is_active !== undefined ? is_active : undefined);
    const actualMinimumQuantity = minimumQuantity !== undefined ? minimumQuantity : minimum_quantity;
    const actualMinimumPurchaseAmount = minimumPurchaseAmount !== undefined ? minimumPurchaseAmount : minimum_purchase_amount;
    const actualMaxTotalUses = maxTotalUses !== undefined ? maxTotalUses : max_total_uses;
    const actualMaxUsesPerCustomer = maxUsesPerCustomer !== undefined ? maxUsesPerCustomer : max_uses_per_customer;

    // Build update payload but omit undefined fields to avoid writing NULLs accidentally
    const offerData = {
      name,
      description,
      offer_type: actualOfferType,
      discount_value: actualDiscountValue,
      start_date: actualStartDate,
      end_date: actualEndDate,
      is_active: actualIsActive,
      minimum_quantity: actualMinimumQuantity,
      minimum_purchase_amount: actualMinimumPurchaseAmount,
      max_total_uses: actualMaxTotalUses,
      max_uses_per_customer: actualMaxUsesPerCustomer,
      priority,
    };

    const cleanedOfferData = Object.fromEntries(
      Object.entries(offerData).filter(([, v]) => v !== undefined)
    );

    // Debug log request and cleaned update payload
    logger.log('Updating promotional offer - debug', {
      id,
      tenantId,
      storeId,
      requestBody: JSON.stringify(req.body, null, 2),
      mappedValues: {
        actualOfferType,
        actualDiscountValue,
        actualStartDate,
        actualEndDate,
        actualIsActive,
        actualMinimumQuantity,
        actualMinimumPurchaseAmount,
        actualMaxTotalUses,
        actualMaxUsesPerCustomer,
      },
      cleanedOfferData: JSON.stringify(cleanedOfferData, null, 2),
    });

    let updateResult;
    try {
      // `<=>` is MySQL's NULL-safe equality — needed since `storeId` can now
      // legitimately be NULL for a tenant-wide offer, and `store_id = NULL`
      // in SQL never matches (always evaluates to unknown/false).
      [updateResult] = await connection.query(
        'UPDATE promotional_offers SET ? WHERE id = ? AND tenant_id = ? AND store_id <=> ?',
        [cleanedOfferData, id, tenantId, storeId]
      );
    } catch (sqlError) {
      logger.error('SQL error during promotional offer UPDATE', {
        error: sqlError.message,
        code: sqlError.code,
        sqlState: sqlError.sqlState,
        sqlMessage: sqlError.sqlMessage,
        sql: sqlError.sql,
        cleanedOfferData: JSON.stringify(cleanedOfferData, null, 2),
      });
      throw sqlError;
    }

    // If no rows were affected, it could be either:
    // - The row doesn't exist for this tenant/store (real 404), or
    // - The UPDATE matched the row but resulted in no data changes (no-op). MySQL reports affectedRows 0 in that case.
    // In the no-op case, we must STILL proceed to replace rules/tiers.
    if (updateResult.affectedRows === 0) {
      const [existRows] = await connection.query(
        'SELECT id FROM promotional_offers WHERE id = ? AND tenant_id = ? AND store_id = ? LIMIT 1',
        [id, tenantId, storeId]
      );
      if (!existRows || existRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ message: 'Promotional offer not found or you do not have permission to update it.' });
      }
      // else: row exists; continue to rules/tiers replacement below
    }

    // Replace rules (accept both camelCase and snake_case)
    await connection.query('DELETE FROM offer_rules WHERE offer_id = ?', [id]);
    if (rules && rules.length > 0) {
      for (const rule of rules) {
        const ruleData = {
          id: uuidv4(),
          tenant_id: tenantId,
          store_id: storeId,
          offer_id: id,
          rule_type: rule.ruleType || rule.rule_type,
          entity_id: rule.entityId || rule.entity_id,
          quantity: rule.quantity,
        };
        await connection.query('INSERT INTO offer_rules SET ?', ruleData);
      }
    }

    // Replace price tiers for 'tiered_pricing' offers
    await connection.query('DELETE FROM offer_price_tiers WHERE offer_id = ?', [id]);
    // Accept both camelCase priceTiers and snake_case price_tiers
    const priceTiersBody = priceTiers || req.body.price_tiers;
    if (actualOfferType === 'tiered_pricing' && priceTiersBody && priceTiersBody.length > 0) {
      for (const tier of priceTiersBody) {
        const tierData = {
          id: uuidv4(),
          tenant_id: tenantId,
          store_id: storeId,
          offer_id: id,
          quantity: tier.quantity,
          price: tier.price,
        };
        await connection.query('INSERT INTO offer_price_tiers SET ?', tierData);
      }
    }

    await connection.commit();
    res.status(200).json({ message: 'Promotional offer updated successfully', data: { id } });
  } catch (error) {
    await connection.rollback();
    // Log detailed error information to help diagnose 500s
    logger.error('Error updating promotional offer:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
    });
    res.status(500).json({ message: 'Failed to update promotional offer', error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * Delete a promotional offer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteOffer = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const tenantId = (req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null);

    // Same gap as getOfferById/getAllOffers: a tenant-wide offer's
    // store_id is NULL, so `store_id = ?` never matched it — the delete
    // would silently 404 ("not found") on any tenant-wide offer. Scope by
    // id+tenant_id only, matching updateOffer's own lookup.
    await connection.query('DELETE FROM offer_rules WHERE offer_id = ? AND tenant_id = ?', [id, tenantId]);
    await connection.query('DELETE FROM offer_price_tiers WHERE offer_id = ? AND tenant_id = ?', [id, tenantId]);

    // Then, delete the offer itself
    const [deleteResult] = await connection.query('DELETE FROM promotional_offers WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Promotional offer not found or you do not have permission to delete it.' });
    }

    await connection.commit();
    res.status(200).json({ message: 'Promotional offer deleted successfully' });
  } catch (error) {
    await connection.rollback();
    logger.error('Error deleting promotional offer:', error);
    res.status(500).json({ message: 'Failed to delete promotional offer', error: error.message });
  } finally {
    connection.release();
  }
};

module.exports = {
  getAllOffers,
  getActiveOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
};
