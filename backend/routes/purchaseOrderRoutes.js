const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Set to false to disable debug logs
const DEBUG_PO = process.env.DEBUG_PO === 'true' || false;

// Conditional debug logging helper
const debugLog = (...args) => {
  if (DEBUG_PO) {
    console.log(...args);
  }
};

// Lightweight helper to run a function within a manual MySQL transaction using the shared pool.
// This allows us to drop the legacy `db.withTransaction` helper without rewriting the whole handler.
const withTransaction = async (task) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await task(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// Helper function to generate a new Purchase Order number with race-condition safety
async function generatePurchaseOrderNumber(connection, tenant_id) {
  const poPrefix = 'PO';
  
  try {
    // Use FOR UPDATE to prevent race conditions
    const [result] = await connection.query(
      `SELECT MAX(CAST(SUBSTRING(purchase_order_number, ${poPrefix.length + 1}) AS UNSIGNED)) as max_num 
       FROM purchase_orders 
       WHERE tenant_id = ? AND purchase_order_number REGEXP '^${poPrefix}[0-9]+$'
       FOR UPDATE`,
      [tenant_id]
    );
    
    debugLog('[DEBUG] PO number generation - Query result:', result);
    
    let nextNum = 100001; // Default starting number
    
    // Handle MySQL2 result format safely
    if (result && result.length > 0 && result[0] && result[0].max_num !== null && result[0].max_num !== undefined) {
      const maxNum = parseInt(result[0].max_num, 10);
      if (!isNaN(maxNum)) {
        nextNum = maxNum + 1;
        debugLog('[DEBUG] Found existing max PO number:', maxNum, 'Next:', nextNum);
      }
    } else {
      debugLog('[DEBUG] No existing PO numbers found, starting with:', nextNum);
    }
    
    const finalPoNumber = `${poPrefix}${nextNum.toString().padStart(6, '0')}`;
    debugLog('[DEBUG] Generated PO number:', finalPoNumber);
    
    return finalPoNumber;
  } catch (error) {
    console.error('[ERROR] PO number generation failed:', error);
    // Fallback to timestamp-based number to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    const fallbackNumber = `${poPrefix}${timestamp}`;
    debugLog('[DEBUG] Using fallback PO number:', fallbackNumber);
    return fallbackNumber;
  }
}

// This space intentionally left empty after removing unused function

// ---------------------------------------------------------------------------
// Tenant / user resolution
//
// SECURITY: these values come exclusively from `req.user`, which is populated by
// the `authenticate` middleware from a verified JWT. They must NEVER be read from
// request headers or query params — a client-supplied `tenant-id` header would
// allow any caller to read or write another tenant's purchase orders.
//
// This router is mounted behind `authenticate` + `requireTenantId` in server.js,
// so `req.user.tenant_id` is guaranteed present by the time a handler runs.
// ---------------------------------------------------------------------------

/** Verified acting user id. Fails closed — no anonymous or hardcoded fallback. */
const getUserId = (req) => {
  const userId = req.user?.id;
  if (!userId) {
    const err = new Error('Unauthenticated request reached purchase order route');
    err.statusCode = 401;
    throw err;
  }
  return userId;
};

/** Verified tenant id from the JWT. Never from headers. */
const getTenantId = (req) => {
  const tenantId = req.user?.tenant_id || req.user?.tenantId;
  if (!tenantId) {
    const err = new Error('No tenant context on authenticated request');
    err.statusCode = 400;
    throw err;
  }
  return tenantId;
};

/**
 * Store id for the request. The `store-id` header is a legitimate store-switching
 * mechanism, but it is only honoured when the authenticated user is actually
 * scoped to that store (or has no store binding, i.e. tenant-wide access).
 */
const getStoreId = (req) => {
  const userStoreId = req.user?.store_id || req.user?.storeId || null;
  const requestedStoreId = req.headers['store-id'] || null;
  if (!requestedStoreId) return userStoreId;
  // A user bound to a specific store may not act on a different one.
  if (userStoreId && requestedStoreId !== userStoreId) {
    const err = new Error('Requested store is outside your access scope');
    err.statusCode = 403;
    throw err;
  }
  return requestedStoreId;
};

// POST /api/purchase-orders - Create a new purchase order
router.post('/', async (req, res) => {
  debugLog('[DEBUG] POST /api/purchase-orders - Request received');
  debugLog('[DEBUG] Request body:', JSON.stringify(req.body, null, 2));
  const { supplier_id, order_date, expected_delivery_date, status, notes, items } = req.body;

  debugLog('[DEBUG] Extracted fields:');
  debugLog('- supplier_id:', supplier_id);
  debugLog('- order_date:', order_date);
  debugLog('- expected_delivery_date:', expected_delivery_date);
  debugLog('- status:', status);
  debugLog('- notes:', notes);
  debugLog('- items is array:', Array.isArray(items));
  debugLog('- items length:', items ? items.length : 'N/A');

  // SECURITY: tenant and user come from the verified JWT only (see helpers above).
  let tenant_id, store_id, created_by_user_id;
  try {
    tenant_id = getTenantId(req);
    store_id = getStoreId(req);
    created_by_user_id = getUserId(req);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  debugLog('[DEBUG] Verified context:');
  debugLog('- tenant_id:', tenant_id);
  debugLog('- store_id:', store_id);
  debugLog('- created_by_user_id:', created_by_user_id);

  // Basic validation
  debugLog('[DEBUG] Validation checks:');
  debugLog('- !supplier_id:', !supplier_id);
  debugLog('- !order_date:', !order_date);
  debugLog('- !tenant_id:', !tenant_id);
  debugLog('- !items:', !items);
  debugLog('- !Array.isArray(items):', !Array.isArray(items));
  debugLog('- items.length === 0:', items ? items.length === 0 : 'N/A');
  
  if (!supplier_id || !order_date || !tenant_id || !items || !Array.isArray(items) || items.length === 0) {
    debugLog('[DEBUG] Validation failed - missing required fields');
    return res.status(400).json({
      error: 'Missing required fields',
      details: {
        supplier_id: !supplier_id ? 'required' : 'ok',
        order_date: !order_date ? 'required' : 'ok',
        tenant_id: !tenant_id ? 'required' : 'ok',
        items: !items || !Array.isArray(items) || items.length === 0 ? 'required (non-empty array)' : 'ok'
      }
    });
  }

  if (!store_id) {
    return res.status(400).json({ message: 'Store ID is missing. Please select a store.' });
  }

  try {
    let finalPurchaseOrderNumber;
    const newPurchaseOrderId = uuidv4();
    const calculatedTotalAmount = items.reduce((sum, item) => sum + item.quantity_ordered * item.cost_price, 0);

    await withTransaction(async (txConnection) => {
      // Generate unique PO number using the improved helper function
      finalPurchaseOrderNumber = await generatePurchaseOrderNumber(txConnection, tenant_id);

      await txConnection.query(
        'INSERT INTO purchase_orders (id, tenant_id, store_id, supplier_id, purchase_order_number, order_date, expected_delivery_date, status, notes, total_amount, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [newPurchaseOrderId, tenant_id, store_id, supplier_id, finalPurchaseOrderNumber, order_date, expected_delivery_date, status, notes, calculatedTotalAmount, created_by_user_id, created_by_user_id]
      );

      const itemInsertPromises = items.map(item => {
        const newItemId = uuidv4();
        return txConnection.query(
          'INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity_ordered, cost_price, status) VALUES (?, ?, ?, ?, ?, ?)',
          [newItemId, newPurchaseOrderId, item.product_id, item.quantity_ordered, item.cost_price, 'NOT_RECEIVED']
        );
      });
      await Promise.all(itemInsertPromises);
    });

    res.status(201).json({ 
      message: 'Purchase order created successfully', 
      id: newPurchaseOrderId, 
      purchase_order_number: finalPurchaseOrderNumber, 
      total_amount: calculatedTotalAmount 
    });
  } catch (error) {
    console.error('Error creating purchase order with items:', error);
    res.status(500).json({ message: 'Error creating purchase order', error: error.message });
  }
});

// GET /api/purchase-orders - List all purchase orders
router.get('/', async (req, res) => {
  const { tenant_id, store_id, supplier_id, status, for_grn } = req.query;
  
  debugLog(`[DEBUG] PO GET request - tenant_id: ${tenant_id}, supplier_id: ${supplier_id}, status: ${status}, for_grn: ${for_grn}`);
  
  // Enhanced query with proper filtering and item counts
  let query = `
    SELECT 
      po.id, 
      po.tenant_id, 
      po.store_id, 
      po.supplier_id, 
      COALESCE(s.supplier_name, 'Unknown Supplier') AS supplier_name, 
      COALESCE(po.purchase_order_number, CONCAT('PO-', po.id)) AS purchase_order_number, 
      po.order_date, 
      po.expected_delivery_date, 
      po.status, 
      COALESCE(po.total_amount, 0) AS total_amount, 
      po.notes, 
      po.created_at, 
      po.updated_at, 
      po.created_by_user_id, 
      po.updated_by_user_id,
      COALESCE(item_counts.item_count, 0) AS item_count
    FROM 
      purchase_orders po 
    LEFT JOIN 
      suppliers s ON po.supplier_id = s.id 
    LEFT JOIN (
      SELECT purchase_order_id, COUNT(*) as item_count 
      FROM purchase_order_items 
      GROUP BY purchase_order_id
    ) item_counts ON po.id = item_counts.purchase_order_id
    WHERE po.tenant_id = ?
  `;
  const queryParams = [tenant_id];

  // Add supplier filtering
  if (supplier_id) {
    query += ` AND po.supplier_id = ?`;
    queryParams.push(supplier_id);
  }

  // Add store filtering (include NULL store_id for backward compatibility)
  if (store_id) {
    query += ` AND (po.store_id = ? OR po.store_id IS NULL)`;
    queryParams.push(store_id);
  }

  // Add status filtering - handle comma-separated values
  if (status) {
    const statusList = status.split(',').map(s => s.trim());
    const statusPlaceholders = statusList.map(() => '?').join(',');
    query += ` AND po.status IN (${statusPlaceholders})`;
    queryParams.push(...statusList);
  }

  // Special filtering for GRN creation - only show POs with items that can receive goods
  if (for_grn === 'true') {
    query += ` AND item_counts.item_count > 0`; // Only POs with items
    // For GRN, we want POs that are not cancelled and have receivable items
    if (!status) {
      // If no status specified for GRN, default to receivable statuses
      query += ` AND po.status IN ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED')`;
    }
  }

  query += ` ORDER BY po.created_at DESC`;

  try {
    debugLog(`[DEBUG] Executing query with params:`, queryParams);
    const [rows] = await pool.query(query, queryParams);
    debugLog(`[DEBUG] Found ${rows.length} purchase orders`);
    
    if (rows.length > 0) {
      debugLog(`[DEBUG] Sample PO:`, {
        id: rows[0].id,
        purchase_order_number: rows[0].purchase_order_number,
        supplier_name: rows[0].supplier_name,
        status: rows[0].status,
        total_amount: rows[0].total_amount
      });
    }

    // Return simplified data structure for now
    res.json({
      data: rows,
      pagination: {
        total: rows.length,
        page: 1,
        limit: 50,
        totalPages: Math.ceil(rows.length / 50)
      }
    });

  } catch (error) {
    console.error('[DEBUG] Error fetching purchase orders:', error);
    res.status(500).json({ message: 'Error fetching purchase orders', error: error.message });
  }
});

// GET /api/purchase-orders/:id - Get a specific purchase order by ID
// GET /api/purchase-orders/:id - Get a specific purchase order with items
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // SECURITY: tenant scope comes from the verified JWT, never from headers.
  let tenant_id, store_id;
  try {
    tenant_id = getTenantId(req);
    store_id = getStoreId(req);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  debugLog('[DEBUG] GET PO /:id - Request for PO:', id, 'Tenant:', tenant_id);
  
  try {
    // MySQL2 returns [rows, fields] format, so we need to access the first element
    const poQueryResult = await pool.query(
      `SELECT po.*, s.supplier_name 
       FROM purchase_orders po 
       JOIN suppliers s ON po.supplier_id = s.id 
       WHERE po.id = ? AND po.tenant_id = ?`,
      [id, tenant_id]
    );
    const poRows = poQueryResult[0]; // Access actual rows array
    
    if (!Array.isArray(poRows) || poRows.length === 0) {
      debugLog('[DEBUG] PO not found for ID:', id, 'Tenant:', tenant_id);
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    
    // Also fetch items for this purchase order with tenant filtering
    const itemsQueryResult = await pool.query(
      `SELECT poi.*, p.name as product_name, p.sku as product_sku 
       FROM purchase_order_items poi 
       JOIN products p ON poi.product_id = p.id 
       WHERE poi.purchase_order_id = ? AND p.tenant_id = ? 
       ORDER BY poi.created_at ASC`,
      [id, tenant_id]
    );
    const itemsRows = itemsQueryResult[0]; // Access actual items array
    
    debugLog('[DEBUG] PO GET /:id - PO found:', poRows[0].purchase_order_number);
    debugLog('[DEBUG] PO GET /:id - Supplier:', poRows[0].supplier_name);
    debugLog('[DEBUG] PO GET /:id - Items count:', itemsRows.length);
    debugLog('[DEBUG] PO GET /:id - Expected delivery date:', poRows[0].expected_delivery_date);
    debugLog('[DEBUG] PO GET /:id - All PO fields:', Object.keys(poRows[0]));
    
    // Return PO with items
    const result = {
      ...poRows[0],
      items: itemsRows || []
    };
    
    res.status(200).json(result);
  } catch (error) {
    console.error('[ERROR] Error fetching purchase order:', error);
    res.status(500).json({ 
      message: 'Error fetching purchase order', 
      error: error.message 
    });
  }
});

// PUT /api/purchase-orders/:id - Update an existing purchase order
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    store_id, 
    supplier_id, 
    purchase_order_number, 
    order_date, 
    expected_delivery_date, 
    status, 
    notes, 
    items // Expect items array for update as well
  } = req.body;
  const updated_by_user_id = getUserId(req);

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'Items array is required for update.' });
  }

  // Validate items structure and calculate total_amount
  let calculatedTotalAmount = 0;
  for (const item of items) {
    if (item.product_id == null || item.quantity_ordered == null || item.cost_price == null) {
      return res.status(400).json({ message: 'Each item must have product_id, quantity_ordered, and cost_price.' });
    }
    if (typeof item.quantity_ordered !== 'number' || item.quantity_ordered <= 0) {
      return res.status(400).json({ message: `Invalid quantity for product ID ${item.product_id}. Must be a positive number.` });
    }
    if (typeof item.cost_price !== 'number' || item.cost_price < 0) {
      return res.status(400).json({ message: `Invalid cost price for product ID ${item.product_id}. Must be a non-negative number.` });
    }
    calculatedTotalAmount += item.quantity_ordered * item.cost_price;
  }

  try {
    await withTransaction(async (txConnection) => {
      // Fetch the existing purchase order to check its current state
      const [existingPOs] = await txConnection.query('SELECT * FROM purchase_orders WHERE id = ?', [id]);
      if (existingPOs.length === 0) {
        return res.status(404).json({ message: 'Purchase order not found.' });
      }
      const existingPO = existingPOs[0];

      // 1. Update purchase_orders header
      const updateFields = [];
      const queryParams = [];

      let finalPurchaseOrderNumber = purchase_order_number;

      // If status is changing from Draft to Ordered and there's no PO number, generate one.
      if (status === 'ORDERED' && existingPO.status === 'DRAFT' && !existingPO.purchase_order_number) {
        const tenant_id = req.user.tenant_id;
        finalPurchaseOrderNumber = await generatePurchaseOrderNumber(txConnection, tenant_id);
      }

      if (store_id !== undefined) { updateFields.push('store_id = ?'); queryParams.push(store_id); }
      if (supplier_id !== undefined) { updateFields.push('supplier_id = ?'); queryParams.push(supplier_id); }
      // Only update the PO number if a non-empty one is provided or newly generated.
      if (finalPurchaseOrderNumber) { 
        updateFields.push('purchase_order_number = ?'); 
        queryParams.push(finalPurchaseOrderNumber); 
      }
      if (order_date !== undefined) { updateFields.push('order_date = ?'); queryParams.push(order_date); }
      if (expected_delivery_date !== undefined) { updateFields.push('expected_delivery_date = ?'); queryParams.push(expected_delivery_date); }
      if (status !== undefined) { updateFields.push('status = ?'); queryParams.push(status); }
      if (notes !== undefined) { updateFields.push('notes = ?'); queryParams.push(notes); }
      
      // Always update total_amount based on current items
      updateFields.push('total_amount = ?'); 
      queryParams.push(calculatedTotalAmount);
      
      updateFields.push('updated_by_user_id = ?');
      queryParams.push(updated_by_user_id);
      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      if (updateFields.length > 2) { // Ensure there's more than just updated_by and updated_at
        let poUpdateQuery = 'UPDATE purchase_orders SET ' + updateFields.join(', ') + ' WHERE id = ?';
        const poUpdateParams = [...queryParams, id];
        const result = await txConnection.query(poUpdateQuery, poUpdateParams);
        if (result.affectedRows === 0) {
          throw new Error('Purchase order not found or no changes to header'); // Will be caught by transaction rollback
        }
      } else if (items.length > 0) {
        // If only items are changing, we still need to update the total_amount and updated_at on the PO header
        let poUpdateQuery = 'UPDATE purchase_orders SET total_amount = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        const poUpdateParams = [calculatedTotalAmount, updated_by_user_id, id];
        const result = await txConnection.query(poUpdateQuery, poUpdateParams);
        if (result.affectedRows === 0) {
          throw new Error('Purchase order not found when updating total for items');
        }
      }

      // 2. PRESERVE EXISTING ITEM STATUS AND QUANTITIES DURING UPDATE
      // Instead of deleting and re-inserting, we'll update existing items and handle additions/deletions intelligently
      
      // First, get existing items with their current status and received quantities
      const [existingItems] = await txConnection.query(
        'SELECT id, product_id, quantity_ordered, cost_price, status, quantity_received FROM purchase_order_items WHERE purchase_order_id = ?',
        [id]
      );
      
      const existingItemsMap = new Map();
      existingItems.forEach(item => {
        existingItemsMap.set(item.product_id, item);
      });
      
      const updatedProductIds = new Set();
      
      // 3. Update or insert items while preserving status and received quantities
      if (items.length > 0) {
        const itemUpsertPromises = items.map(async (item) => {
          const existingItem = existingItemsMap.get(item.product_id);
          updatedProductIds.add(item.product_id);
          
          if (existingItem) {
            // UPDATE existing item - preserve status and quantity_received
            return txConnection.query(
              'UPDATE purchase_order_items SET quantity_ordered = ?, cost_price = ? WHERE id = ?',
              [item.quantity_ordered, item.cost_price, existingItem.id]
            );
          } else {
            // INSERT new item with proper default status
            const newItemId = uuidv4();
            return txConnection.query(
              'INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity_ordered, cost_price, status, quantity_received) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [newItemId, id, item.product_id, item.quantity_ordered, item.cost_price, 'NOT_RECEIVED', 0]
            );
          }
        });
        await Promise.all(itemUpsertPromises);
      }
      
      // 4. Remove items that are no longer in the updated items list
      const itemsToDelete = existingItems.filter(existingItem => !updatedProductIds.has(existingItem.product_id));
      if (itemsToDelete.length > 0) {
        const deletePromises = itemsToDelete.map(item => 
          txConnection.query('DELETE FROM purchase_order_items WHERE id = ?', [item.id])
        );
        await Promise.all(deletePromises);
      }
    });

    res.status(200).json({ 
      message: 'Purchase order updated successfully', 
      id, 
      total_amount: calculatedTotalAmount 
    });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    // Check if it's our custom error from transaction
    if (error.message.includes('Purchase order not found')) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating purchase order', error: error.message });
  }
});

// DELETE /api/purchase-orders/:id - Delete or cancel a purchase order
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { tenant_id, hard_delete = 'false' } = req.query;
  const isHardDelete = hard_delete.toLowerCase() === 'true';
  const updated_by_user_id = getUserId(req);

  debugLog(`[Backend] Processing purchase order deletion: ${id}, Type: ${isHardDelete ? 'HARD DELETE' : 'SOFT DELETE/CANCEL'}, Tenant ID: ${tenant_id || 'not provided'}`);

  if (!tenant_id) {
    debugLog('[Backend] Tenant ID not provided for deletion request.');
    return res.status(400).json({ message: 'Tenant ID is required for this operation.' });
  }

  try {
    const transactionResult = await withTransaction(async (connection) => {
      // 1. Check if the PO exists and belongs to the tenant
      // MySQL2 returns [rows, fields] format, so we need to access the first element
      const queryResult = await connection.query(
        'SELECT id, status, purchase_order_number, tenant_id FROM purchase_orders WHERE id = ? AND tenant_id = ?',
        [id, tenant_id]
      );
      
      // Access the actual rows array from the nested result
      const poDataArray = queryResult[0];
      debugLog('[DEBUG] PO query result:', JSON.stringify(queryResult));
      debugLog('[DEBUG] PO data array:', JSON.stringify(poDataArray));

      let po;
      if (Array.isArray(poDataArray) && poDataArray.length > 0) {
        po = poDataArray[0];
      } else {
        // No PO found
        po = null;
      }

      if (!po) {
        debugLog(`[Backend] Purchase order ${id} not found for tenant ${tenant_id}. Query result: ${JSON.stringify(poDataArray)}`);
        return { status: 404, body: { message: 'Purchase order not found.' } };
      }

      // po is now guaranteed to be the purchase order object
      debugLog('[DEBUG] PO found:', JSON.stringify(po));
      debugLog(`[Backend] Purchase order found: ${po.purchase_order_number}, Status: ${po.status}, Tenant: ${po.tenant_id}`);

      // 2. Fetch linked GRNs to check their status
      const grnQueryResult = await connection.query(
        'SELECT id, status FROM goods_received_notes WHERE purchase_order_id = ?',
        [id]
      );
      const grnRows = grnQueryResult[0]; // Fix GRN query result handling too
      const hasLinkedGrns = grnRows.length > 0;
      const hasCompletedGrns = grnRows.some(grn => grn.status === 'COMPLETED');
      debugLog(`[Backend] PO ${id} has ${grnRows.length} linked GRNs. Completed GRNs: ${hasCompletedGrns ? 'Yes' : 'No'}`);

      // Rule: If PO has COMPLETED GRNs, no deletion (hard or soft) is allowed.
      if (hasCompletedGrns) {
        debugLog(`[Backend] Cannot delete/cancel PO ${id} - has completed GRNs.`);
        return {
          status: 400,
          body: {
            message: 'Cannot delete or cancel this purchase order as it has completed goods receipts associated with it.',
            reason: 'HAS_COMPLETED_GRNS'
          }
        };
      }

      // --- Process Hard Delete request --- 
      if (isHardDelete) {
        // Condition for Hard Delete: No linked GRNs at all.
        if (hasLinkedGrns) {
          debugLog(`[Backend] Cannot hard delete PO ${id} - has linked GRNs.`);
          return {
            status: 400,
            body: { message: 'Cannot permanently delete this purchase order as it has linked goods receipts. Please cancel the order or remove/cancel the GRNs first.' }
          };
        }
        // Condition for Hard Delete: PO status must be DRAFT or CANCELLED.
        if (po.status !== 'DRAFT' && po.status !== 'CANCELLED') {
          debugLog(`[Backend] Cannot hard delete PO ${id}. Status is ${po.status}.`);
          return {
            status: 400,
            body: { message: `Cannot permanently delete this purchase order. Its status is '${po.status}'. Only DRAFT or CANCELLED orders can be deleted.` }
          };
        }

        // Proceed with hard delete
        debugLog(`[Backend] Executing hard delete for PO ${id}`);
        await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
        const poDeleteResult = await connection.query('DELETE FROM purchase_orders WHERE id = ?', [id]);

        // Check if poDeleteResult is valid and if rows were affected
        if (!poDeleteResult || poDeleteResult.affectedRows === 0) {
           // Should have been caught by initial PO check, but as a safeguard:
          debugLog(`[Backend] Hard delete failed for PO ${id}, PO not found or no rows affected after item deletion.`);
          return { status: 404, body: { message: 'Purchase order not found or no rows affected during final delete step.' } };
        }
        debugLog(`[Backend] Purchase order ${id} permanently deleted.`);
        return { status: 200, body: { message: 'Purchase order permanently deleted.', id, deletionType: 'HARD_DELETE' } };
      }
      // --- Process Soft Delete (Cancel) request --- 
      else {
        if (po.status === 'CANCELLED') {
          debugLog(`[Backend] Purchase order ${id} is already cancelled.`);
          return { status: 200, body: { message: 'Purchase order is already cancelled.', id, deletionType: 'SOFT_DELETE_NO_CHANGE' } };
        }

        debugLog(`[Backend] Executing soft delete (cancellation) for PO ${id}`);
        const queryResponse = await connection.query(
          'UPDATE purchase_orders SET status = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['CANCELLED', updated_by_user_id, id]
        );

        // Also update all associated purchase order items to 'CANCELLED'
        // Do not update items if they are already CANCELLED to avoid unnecessary writes/log spam, though DB won't error.
        // We also only want to cancel items that aren't already part of a completed GRN (though the PO level check for completed GRNs should prevent this path)
        await connection.query(
          'UPDATE purchase_order_items SET status = ? WHERE purchase_order_id = ? AND status != ?',
          ['CANCELLED', id, 'CANCELLED']
        );
        debugLog(`[Backend] Updated items for PO ${id} to CANCELLED status (if not already cancelled).`);

        // MySQL2 UPDATE queries return [OkPacket, null] format, so we need to access the first element
        const updateResult = queryResponse[0];

        // Check if updateResult is valid and contains the affectedRows property
        if (!updateResult || typeof updateResult.affectedRows === 'undefined') {
          console.error(`[Backend] Soft delete for PO ${id} query problem: Expected result object not found or malformed. Query response: ${JSON.stringify(queryResponse)}`);
          throw new Error(`Database update for purchase order ${id} (soft delete) failed to return a valid confirmation. The operation may not have completed.`);
        }

        if (updateResult.affectedRows === 0) {
          // This means the query ran, found the OkPacket, but no rows were actually changed.
          // This could happen if the PO was already 'CANCELLED' or if the ID didn't match (though prior checks should prevent this).
          console.warn(`[Backend] Soft delete for PO ${id}: The purchase order was not updated (0 affected rows). It might have been already cancelled or the ID was not found (despite prior checks).`);
          // Depending on business logic, this might not be a hard error if the goal is idempotency.
          // For now, treating as an unexpected state if we expected a change.
          throw new Error(`Purchase order ${id} status was not updated as expected during cancellation (0 affected rows).`);
        }

        // If there are linked DRAFT GRNs, cancel them as well (since COMPLETED GRNs block this path)
        if (hasLinkedGrns) {
          const draftGrnIds = grnRows.filter(grn => grn.status === 'DRAFT').map(grn => grn.id);
          if (draftGrnIds.length > 0) {
            debugLog(`[Backend] Also cancelling ${draftGrnIds.length} DRAFT GRNs linked to this PO.`);
            for (const grnId of draftGrnIds) {
              await connection.query(
                'UPDATE goods_received_notes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['CANCELLED', grnId]
              );
            }
          }
        }
        debugLog(`[Backend] Purchase order ${id} cancelled successfully.`);
        return { status: 200, body: { message: 'Purchase order cancelled successfully.', id, deletionType: 'SOFT_DELETE' } };
      }
    }); // End of db.withTransaction

    // Send response based on transaction result
    return res.status(transactionResult.status).json(transactionResult.body);

  } catch (error) {
    console.error('[Backend] Error processing purchase order deletion:', error);
    // Check if it's a custom error from the transaction with status (though current design returns objects, not throws them)
    if (error.status && error.body) {
       return res.status(error.status).json(error.body);
    }
    return res.status(500).json({
      message: 'Error processing purchase order deletion',
      error: error.message
    });
  }
});

// --- Purchase Order Items Routes ---

// POST /api/purchase-orders/:po_id/items - Add an item to a purchase order
router.post('/:po_id/items', async (req, res) => {
  const { po_id } = req.params;
  const { product_id, quantity_ordered, cost_price } = req.body;
  // Basic validation
  if (!product_id || quantity_ordered === undefined || cost_price === undefined) {
    return res.status(400).json({ message: 'Product ID, quantity, and cost price are required.' });
  }
  if (typeof quantity_ordered !== 'number' || quantity_ordered <= 0) {
    return res.status(400).json({ message: 'Quantity must be a positive number.' });
  }
  if (typeof cost_price !== 'number' || cost_price < 0) {
    return res.status(400).json({ message: 'Cost price must be a non-negative number.' });
  }

  const newItemId = uuidv4();

  try {
    const newItemData = await withTransaction(async (txConnection) => {
      // Check PO status - ideally, only add to DRAFT or similar status
      const [poRows] = await txConnection.query('SELECT status, tenant_id FROM purchase_orders WHERE id = ?', [po_id]);
      if (poRows.length === 0) {
        const err = new Error('Purchase order not found.');
        err.statusCode = 404;
        throw err;
      }
      const po = poRows[0];
      // Example: Prevent adding items to a 'COMPLETED' or 'CANCELLED' PO
      if (['COMPLETED', 'CANCELLED'].includes(po.status)) {
        const err = new Error(`Cannot add items to a purchase order with status: ${po.status}.`);
        err.statusCode = 400;
        throw err;
      }

      // TODO: Add check for product_id existence and tenant_id consistency if necessary
      // const [productRows] = await txConnection.query('SELECT id FROM products WHERE id = ? AND tenant_id = ?', [product_id, po.tenant_id]);
      // if (productRows.length === 0) {
      //   const err = new Error('Product not found or does not belong to the tenant.');
      //   err.statusCode = 404;
      //   throw err;
      // }

      const line_total = quantity_ordered * cost_price;
      const [insertResult] = await txConnection.query(
        'INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity_ordered, cost_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
        [newItemId, po_id, product_id, quantity_ordered, cost_price, line_total]
      );

      if (insertResult.affectedRows !== 1) {
        const err = new Error('Failed to add item to purchase order.');
        err.statusCode = 500; // Internal server error if insert failed unexpectedly
        throw err;
      }

      // Update PO total_amount
      await txConnection.query(
        'UPDATE purchase_orders SET total_amount = (SELECT SUM(line_total) FROM purchase_order_items WHERE purchase_order_id = ?) WHERE id = ?',
        [po_id, po_id]
      );

      // Fetch the newly created item to return it (including any DB-generated fields if applicable)
      const [newItemRows] = await txConnection.query('SELECT poi.*, p.name as product_name, p.sku as product_sku FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id WHERE poi.id = ?', [newItemId]);
      if (newItemRows.length === 0) {
        // This should ideally not happen if insert was successful
        const err = new Error('Failed to retrieve the newly added item after insert.');
        err.statusCode = 500;
        throw err;
      }
      return newItemRows[0];
    });

    res.status(201).json(newItemData);

  } catch (error) {
    console.error(`Error adding item to PO ${po_id}:`, error);
    const statusCode = error.statusCode || 500; // Use custom status code if set
    res.status(statusCode).json({ message: error.message || 'An unexpected error occurred while adding the item.' });
  }
});

// PUT /api/purchase-orders/:po_id/items/:item_id - Update an item in a purchase order
router.put('/:po_id/items/:item_id', async (req, res) => {
  const { po_id, item_id } = req.params;

  try {
    const updatedItemData = await withTransaction(async (txConnection) => {
      // Check PO status
      const [poRows] = await txConnection.query('SELECT status FROM purchase_orders WHERE id = ?', [po_id]);
      if (poRows.length === 0) {
        const err = new Error('Purchase order not found.');
        err.statusCode = 404;
        throw err;
      }
      // Example: Prevent updates to items in a 'COMPLETED' or 'CANCELLED' PO
      if (['COMPLETED', 'CANCELLED'].includes(poRows[0].status)) {
        const err = new Error(`Cannot update items in a purchase order with status: ${poRows[0].status}.`);
        err.statusCode = 400;
        throw err;
      }

      // Fetch current item details
      const [itemRows] = await txConnection.query('SELECT quantity_ordered, cost_price FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?', [item_id, po_id]);
      if (itemRows.length === 0) {
        const err = new Error('Item not found in this purchase order.');
        err.statusCode = 404;
        throw err;
      }
      const currentItem = itemRows[0];

      // Build the update query dynamically
      const updateFields = [];
      const queryParams = [];

      let new_quantity = currentItem.quantity_ordered;
      let new_cost_price = currentItem.cost_price;

      if (req.body.quantity_ordered !== undefined) {
        new_quantity = req.body.quantity_ordered;
        if (typeof new_quantity !== 'number' || new_quantity <= 0) {
          const err = new Error('Quantity must be a positive number.');
          err.statusCode = 400;
          throw err;
        }
        updateFields.push('quantity_ordered = ?');
        queryParams.push(new_quantity);
      }

      if (req.body.cost_price !== undefined) {
        new_cost_price = req.body.cost_price;
        if (typeof new_cost_price !== 'number' || new_cost_price < 0) {
          const err = new Error('Cost price must be a non-negative number.');
          err.statusCode = 400;
          throw err;
        }
        updateFields.push('cost_price = ?');
        queryParams.push(new_cost_price);
      }

      if (updateFields.length === 0) {
        // No actual fields to update, could return 200 with current item or 304 Not Modified
        // For simplicity, let's treat it as an error if no updatable fields are sent.
        const err = new Error('No fields to update provided.');
        err.statusCode = 400;
        throw err;
      }

      // Recalculate line_total
      const newLineTotal = new_quantity * new_cost_price;
      updateFields.push('line_total = ?');
      queryParams.push(newLineTotal);

      let updateQueryStr = 'UPDATE purchase_order_items SET ';
      updateQueryStr += updateFields.join(', ');
      updateQueryStr += ' WHERE id = ? AND purchase_order_id = ?';
      queryParams.push(item_id, po_id);

      const [updateResult] = await txConnection.query(updateQueryStr, queryParams);

      if (updateResult.affectedRows !== 1) {
        // This could happen if the item was deleted between the fetch and update, or if ID is wrong.
        const err = new Error('Item not found or no changes made during update.');
        err.statusCode = 404; // Or 500 if it's an unexpected DB state
        throw err;
      }

      // Update PO total_amount
      await txConnection.query(
        'UPDATE purchase_orders SET total_amount = (SELECT SUM(line_total) FROM purchase_order_items WHERE purchase_order_id = ?) WHERE id = ?',
        [po_id, po_id]
      );
      
      // Fetch the fully updated item to return
      const [updatedItemRows] = await txConnection.query('SELECT poi.*, p.name as product_name, p.sku as product_sku FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id WHERE poi.id = ?', [item_id]);
      if (updatedItemRows.length === 0) {
        const err = new Error('Updated item not found after update operation. This should not happen.');
        err.statusCode = 500;
        throw err;
      }
      return updatedItemRows[0];
    });

    res.status(200).json(updatedItemData);

  } catch (error) {
    console.error(`Error updating item ${item_id} in PO ${po_id}:`, error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'An unexpected error occurred while updating the item.' });
  }
});

// DELETE /api/purchase-orders/:po_id/items/:item_id - Remove an item from a purchase order
router.delete('/:po_id/items/:item_id', async (req, res) => {
  const { po_id, item_id } = req.params;

  try {
    await withTransaction(async (txConnection) => {
      // Check PO status
      const [poRows] = await txConnection.query('SELECT status FROM purchase_orders WHERE id = ?', [po_id]);
      if (poRows.length === 0) {
        const err = new Error('Purchase order not found.');
        err.statusCode = 404;
        throw err;
      }
      // Example: Prevent deleting items from a 'COMPLETED' or 'CANCELLED' PO
      if (['COMPLETED', 'CANCELLED'].includes(poRows[0].status)) {
        const err = new Error(`Cannot delete items from a purchase order with status: ${poRows[0].status}.`);
        err.statusCode = 400;
        throw err;
      }

      // Fetch the item to be deleted to get its line_total for PO adjustment
      const [itemDataArray] = await txConnection.query('SELECT quantity_ordered, cost_price, line_total FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?', [item_id, po_id]);
      if (itemDataArray.length === 0) {
        const err = new Error('Item not found in this purchase order.');
        err.statusCode = 404;
        throw err;
      }
      const item_to_delete = itemDataArray[0];
      // Use the stored line_total if available and accurate, otherwise recalculate if necessary.
      // Assuming line_total in DB is accurate.
      const line_total_to_remove = parseFloat(item_to_delete.line_total);
      // If line_total is not stored or might be stale, recalculate:
      // const line_total_to_remove = parseFloat(item_to_delete.quantity_ordered) * parseFloat(item_to_delete.cost_price);

      // Delete the item
      const [deleteResult] = await txConnection.query('DELETE FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?', [item_id, po_id]);
      if (deleteResult.affectedRows !== 1) {
        // This might happen if the item was deleted by another process between the check and this delete
        const err = new Error('Item not found or not deleted. It might have been removed by another process.');
        err.statusCode = 404; // Or 409 Conflict
        throw err;
      }

      // Update PO total_amount
      await txConnection.query(
        'UPDATE purchase_orders SET total_amount = (SELECT SUM(IFNULL(line_total, 0)) FROM purchase_order_items WHERE purchase_order_id = ?) WHERE id = ?',
        [po_id, po_id]
      );
      // The above query recalculates the sum. Alternatively, if only subtracting:
      // await txConnection.query(
      //   'UPDATE purchase_orders SET total_amount = total_amount - ? WHERE id = ?',
      //   [line_total_to_remove, po_id]
      // );
    });

    res.status(200).json({ message: 'Item removed from purchase order successfully', itemId: item_id, purchase_order_id: po_id });

  } catch (error) {
    console.error(`Error removing item ${item_id} from PO ${po_id}:`, error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'An unexpected error occurred while removing the item.' });
  }
});

// Temporary Debug Route to Diagnose Supplier POs
router.get('/debug-supplier-pos', async (req, res) => {
  const { tenant_id } = req.query;
  if (!tenant_id) {
    return res.status(400).json({ message: 'Tenant ID is required.' });
  }

  try {
    // MySQL2 returns [rows, fields] format, so we need to access the first element
    const suppliersResult = await pool.query('SELECT id, supplier_name FROM suppliers WHERE tenant_id = ?', [tenant_id]);
    const suppliers = suppliersResult[0]; // Access actual rows array

    const debugData = await Promise.all(suppliers.map(async (supplier) => {
      const purchaseOrders = await pool.query(`
        SELECT 
          id, 
          purchase_order_number, 
          status, 
          order_date, 
          total_amount
        FROM 
          purchase_orders
        WHERE 
          tenant_id = ? AND supplier_id = ?
        ORDER BY 
          order_date DESC
      `, [tenant_id, supplier.id]);

      const poDetails = await Promise.all(purchaseOrders.map(async (po) => {
        const items = await pool.query(`
          SELECT 
            poi.id, 
            p.name as product_name, 
            poi.quantity_ordered, 
            COALESCE(SUM(grni.quantity_received), 0) as quantity_received
          FROM 
            purchase_order_items poi
          JOIN 
            products p ON poi.product_id = p.id
          LEFT JOIN 
            grn_items grni ON grni.purchase_order_item_id = poi.id
          WHERE 
            poi.purchase_order_id = ?
          GROUP BY 
            poi.id
        `, [po.id]);
        
        const actionableItems = items.filter(item => item.quantity_ordered > item.quantity_received);
        return { ...po, items, actionable_item_count: actionableItems.length };
      }));

      const actionablePOs = poDetails.filter(po => ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) && po.actionable_item_count > 0);

      return {
        supplier_name: supplier.supplier_name,
        supplier_id: supplier.id,
        total_pos: poDetails.length,
        actionable_pos_count: actionablePOs.length,
        purchase_orders: poDetails,
      };
    }));

    res.status(200).json(debugData);

  } catch (error) {
    console.error('Error in /debug-supplier-pos:', error);
    res.status(500).json({ message: 'Error fetching debug data', error: error.message });
  }
});

// GET /api/purchase-orders - List all purchase orders
router.get('/', async (req, res) => {
  const { tenant_id, store_id, supplier_id, status } = req.query;
  let query = `
    SELECT 
      po.id,
      po.purchase_order_number,
      po.order_date,
      po.expected_delivery_date,
      po.status,
      po.notes,
      po.total_amount,
      po.created_at,
      po.updated_at,
      s.name as supplier_name,
      st.name as store_name,
      u.first_name as created_by_first_name,
      u.last_name as created_by_last_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN stores st ON po.store_id = st.id
    LEFT JOIN users u ON po.created_by_user_id = u.id
    WHERE po.tenant_id = ?
    ORDER BY po.created_at DESC
  `;
  const params = [tenant_id];

  try {
    // MySQL2 returns [rows, fields] format, so we need to access the first element
    const queryResult = await pool.query(query, params);
    const purchaseOrders = queryResult[0]; // Access actual rows array
    
    debugLog('[DEBUG] PO listing - Found', purchaseOrders.length, 'purchase orders');
    
    // Log sample purchase order to see its structure
    if (purchaseOrders.length > 0) {
      const samplePO = purchaseOrders[0];
      debugLog('[DEBUG] Sample PO structure:', Object.keys(samplePO));
      
      // Check if critical fields are null/undefined
      const criticalFields = ['purchase_order_number', 'supplier_name', 'order_date', 'expected_delivery_date', 'status', 'total_amount'];
      const missingFields = criticalFields.filter(field => !samplePO[field]);
      if (missingFields.length > 0) {
        debugLog('[DEBUG] WARNING: Missing values for these critical fields:', missingFields);
      }
    }

    // For each purchase order, fetch its items - exclude items already in DRAFT GRNs
    // Set a flag to enable robust error handling
    let hasErrorOccurred = false;
    
    const purchaseOrdersWithItems = await Promise.all(
      purchaseOrders.map(async (po) => {
        // DIAGNOSTIC QUERY: Check if any draft GRNs exist for this PO's items
        const [draftCheck] = await pool.query(`
          SELECT 
            COUNT(*) as draft_grn_count,
            SUM(grni.quantity_received) as total_draft_qty
          FROM 
            purchase_order_items poi
          JOIN
            grn_items grni ON grni.purchase_order_item_id = poi.id
          JOIN
            goods_received_notes grn ON grni.grn_id = grn.id AND grn.status = 'DRAFT'
          WHERE 
            poi.purchase_order_id = ?`,
          [po.id]
        );
        
        try {
          // Enhanced query for better draft GRN tracking
          // This query includes explicit calculations for draft and non-draft quantities
          const queryResult = await pool.query(`
          SELECT 
            poi.*, 
            p.name as product_name, 
            p.sku as product_sku,
            -- Total quantity ordered
            poi.quantity_ordered as quantity_ordered,
            -- Quantity received in non-draft GRNs (Corrected to handle NULL status)
            COALESCE(SUM(CASE WHEN grn.status IS NULL OR grn.status != 'DRAFT' THEN grni.quantity_received ELSE 0 END), 0) as quantity_received_completed,
            -- Quantity in draft GRNs
            COALESCE(SUM(CASE WHEN grn.status = 'DRAFT' THEN grni.quantity_received ELSE 0 END), 0) as quantity_in_draft_grns,
            -- Available quantity (ordered minus received in non-draft GRNs)
            poi.quantity_ordered - COALESCE(SUM(CASE WHEN grn.status != 'DRAFT' THEN grni.quantity_received ELSE 0 END), 0) as available_quantity,
            -- Flag if item has any draft GRN quantities
            CASE WHEN SUM(CASE WHEN grn.status = 'DRAFT' THEN 1 ELSE 0 END) > 0 THEN TRUE ELSE FALSE END as has_draft_grns,
            -- List of draft GRN IDs for this item (for debugging)
            GROUP_CONCAT(DISTINCT CASE WHEN grn.status = 'DRAFT' THEN grn.id ELSE NULL END) as draft_grn_ids
          FROM 
            purchase_order_items poi 
          JOIN 
            products p ON poi.product_id = p.id 
          LEFT JOIN 
            grn_items grni ON grni.purchase_order_item_id = poi.id
          LEFT JOIN 
            goods_received_notes grn ON grni.grn_id = grn.id 
          WHERE 
            poi.purchase_order_id = ?
          GROUP BY 
            poi.id
          HAVING 
            -- Show items that are either available or already in draft GRNs
            available_quantity > 0 OR (quantity_in_draft_grns > 0 AND poi.quantity_ordered > quantity_received_completed)
          ORDER BY 
            poi.created_at ASC`,
          [po.id]
        );
        
        // Enhanced item mapping for better draft GRN visibility
        // This utilizes the additional fields from our improved query
        
        // Handle the result in the most resilient way possible
        let rows = [];
        if (Array.isArray(queryResult) && queryResult.length > 0) {
          // Standard MySQL2 format: [rows, fields]
          if (Array.isArray(queryResult[0])) {
            rows = queryResult[0];
          } else {
            // In some cases, the rows might be directly in the first element
            rows = queryResult;
          }
        }
        
        // Process rows from query result
        
        // Only attempt to map if we have valid rows
        if (!Array.isArray(rows) || rows.length === 0 || (rows.length === 1 && Array.isArray(rows[0]) && rows[0].length === 0)) {
          // No valid rows to map
          return { ...po, items: [] };
        }
        
        // Handle case where rows is an array with an empty array inside
        if (rows.length === 1 && Array.isArray(rows[0])) {
          // Unwrap nested array structure if needed
          rows = rows[0];
          
          // Double check after unwrapping
          if (rows.length === 0) {
            return { ...po, items: [] };
          }
        }
        
        const mappedItems = rows.map(item => {
          // Parse all numeric values to ensure consistent types
          const qtyOrdered = parseFloat(item.quantity_ordered || 0);
          const qtyReceivedCompleted = parseFloat(item.quantity_received_completed || 0);
          const qtyInDraftGrns = parseFloat(item.quantity_in_draft_grns || 0);
          const availableQty = parseFloat(item.available_quantity || 0);
          const hasDraftGrns = item.has_draft_grns === 1 || item.has_draft_grns === true;
          
          // Process purchase order item details
          
          // Add frontend-friendly property names to match the expected structure
          const mappedItem = {
            ...item,
            // Ensure all numeric values are proper numbers
            quantity_ordered: qtyOrdered,
            quantity_received_completed: qtyReceivedCompleted,
            available_quantity: availableQty,
            quantity_in_draft_grns: qtyInDraftGrns,
            
            // IMPORTANT: Add frontend-expected property names
            quantityOrdered: qtyOrdered,
            quantityReceived: qtyReceivedCompleted,
            quantityInDraftGrns: qtyInDraftGrns, // Add camelCase version for frontend
            
            // Clear flags for UI visibility
            is_in_draft_grns: hasDraftGrns,
            has_draft_grns: hasDraftGrns,
            isInDraftGrns: hasDraftGrns, // Add camelCase version for frontend
            
            // Actual available quantity (considering draft GRNs)
            actual_available_quantity: availableQty - qtyInDraftGrns,
            
            // Simplified status for UI display
            draft_status: hasDraftGrns ? 'In Draft GRN' : (availableQty > 0 ? 'Available' : 'Fully Received'),
            
            // Safe quantity to receive
            max_receivable_quantity: Math.max(0, availableQty)
          };
          
          return mappedItem;
        });
        
        // Logging for debugging
        // PO items mapping complete
        
        return {
          ...po,
          items: mappedItems
        };
        } catch (error) {
          console.error(`[ERROR] Error processing items for PO ${po.id}:`, error);
          hasErrorOccurred = true;
          return {
            ...po,
            items: [],
            error: error.message
          };
        }
      })
    );

    // Log the final structure after items are added
    if (purchaseOrdersWithItems.length > 0) {
      // debugLog('[Backend] Final PO with items structure:', Object.keys(purchaseOrdersWithItems[0]));
    }

    // Filter out POs that have no items after all the processing
    const finalPurchaseOrders = purchaseOrdersWithItems.filter(po => po.items && po.items.length > 0);
    
    // debugLog(`[Backend] Returning ${finalPurchaseOrders.length} purchase orders after filtering empty ones`);
    
    // Return original array format as expected by frontend
    // But log more detailed information about each field in the first PO for debugging
    if (finalPurchaseOrders.length > 0) {
      const firstPO = finalPurchaseOrders[0];
      const keysWithValues = Object.entries(firstPO).map(([key, value]) => {
        return `${key}: ${value === null ? 'NULL' : value === undefined ? 'UNDEFINED' : `"${value}"`} (${typeof value})`;
      });
      // debugLog('[Backend] First PO detailed data:\n', keysWithValues.join('\n'));
    }
    
    if (hasErrorOccurred) {
      debugLog('[WARNING] Some errors occurred while processing purchase orders');
    } else if (finalPurchaseOrders.length === 0) {
      // debugLog('[Backend] No purchase orders found that match the criteria.');
    }

    res.status(200).json(finalPurchaseOrders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ message: 'Error fetching purchase orders', error: error.message });
  }
});

module.exports = router;
