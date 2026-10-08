const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { getUserId } = require('../middleware/permissionMiddleware');
const storeProductListingService = require('../services/storeProductListingService');
const moneyPosting = require('../services/moneyPostingService');

/**
 * Receipt-side accrual posting for a committed GRN:
 *   Dr Inventory on Hand (event:inventory) / Cr Accounts Payable (event:payable)
 * for the GRN's total_received_value. supplier payments later debit AP — the
 * pair is what turns purchases into balance-sheet inventory instead of a
 * same-day expense. source_type='grn_receipt' + uq_entry_source makes it
 * idempotent across create-COMPLETED and status-commit paths.
 * Skips silently when the ledger tables don't exist yet (unmigrated DB).
 */
async function postGrnReceiptEntry(connection, tenantId, grn, userId) {
  const value = Math.round(Number(grn.total_received_value || 0) * 100) / 100;
  if (value <= 0) return;
  const dr = await moneyPosting.resolveAccountId(tenantId, 'event:inventory', connection);
  const cr = await moneyPosting.resolveAccountId(tenantId, 'event:payable', connection);
  if (!dr || !cr) throw new Error('Ledger posting failed: required money account(s) are missing or inactive');
  await moneyPosting.postEntry({
    tenantId, storeId: grn.store_id || null,
    sourceType: 'grn_receipt', sourceId: grn.id,
    memo: `GRN ${grn.grn_number} — goods received`, createdBy: userId,
    lines: [
      { accountId: dr, debit: value, credit: 0, memo: 'Inventory received', supplierId: grn.supplier_id || null },
      { accountId: cr, debit: 0, credit: value, memo: 'Payable to supplier', supplierId: grn.supplier_id || null },
    ],
  }, connection);
}

/** Reverse a GRN's receipt entry when inventory is de-committed (void/return-to-draft/delete). */
async function reverseGrnReceiptEntry(connection, tenantId, grnId, grnNumber, userId) {
  let rows;
  try {
    [rows] = await connection.query(
      `SELECT id FROM money_journal_entries
        WHERE tenant_id = ? AND source_type = 'grn_receipt' AND source_id = ? AND status = 'posted'`,
      [tenantId, grnId]
    );
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') return;
    throw e;
  }
  if (rows.length) {
    await moneyPosting.reverseEntry(rows[0].id, {
      tenantId, memo: `GRN ${grnNumber} receipt reversed`, createdBy: userId,
    }, connection);
  }
}

// Set to false to disable debug logs
const DEBUG_GRN = process.env.DEBUG_GRN === 'true' || false;

// Conditional debug logging helper
const debugLog = (...args) => {
  if (DEBUG_GRN) {
    console.log(...args);
  }
};

// Helper function to update Purchase Order Status based on its items
const updatePurchaseOrderStatus = async (purchaseOrderId, connection, tenant_id, received_date_for_po_update) => {
  // Correctly destructure query result to avoid 'poItems is not iterable' error
  // Add explicit casting to DECIMAL to ensure proper numeric comparison
  const [poItemsResult] = await connection.query(
    `SELECT 
      poi.id,
      CAST(poi.quantity_ordered AS DECIMAL(10,2)) as numeric_quantity_ordered, 
      CAST(poi.quantity_received AS DECIMAL(10,2)) as numeric_quantity_received,
      poi.quantity_ordered, 
      poi.quantity_received, 
      poi.status
    FROM purchase_order_items poi 
    JOIN purchase_orders po ON poi.purchase_order_id = po.id
    WHERE poi.purchase_order_id = ? AND po.tenant_id = ? FOR UPDATE`, 
    [purchaseOrderId, tenant_id]
  );

  const poItems = poItemsResult || [];
  debugLog(`[updatePurchaseOrderStatus] Retrieved ${poItems.length} items for PO ${purchaseOrderId}`);
  
  if (!poItems || poItems.length === 0) {
    console.warn(`[updatePurchaseOrderStatus] No items found for PO ID ${purchaseOrderId} or PO does not belong to tenant ${tenant_id}. Status not changed.`);
    return;
  }

  let allItemsFullyReceived = true;
  let anyItemReceived = false;
  
  debugLog(`[updatePurchaseOrderStatus] Checking ${poItems.length} items for PO ID ${purchaseOrderId}`);
  
  // First pass: Update individual item statuses based on quantities
  for (const item of poItems) {
    const ordered = parseFloat(item.numeric_quantity_ordered || item.quantity_ordered || 0);
    const received = parseFloat(item.numeric_quantity_received || item.quantity_received || 0);
    debugLog(`  Item ID=${item.id}, status=${item.status}, ordered=${ordered}, received=${received}`);
    
    // Determine new item status based on quantities
    let newItemStatus = null;
    
    if (received === 0) {
      newItemStatus = 'NOT_RECEIVED';
    } else if (received >= ordered) {
      newItemStatus = 'FULLY_RECEIVED';
    } else {
      newItemStatus = 'PARTIALLY_RECEIVED';
    }
    
    // Update item status if it has changed
    if (newItemStatus !== item.status) {
      await connection.query(
        'UPDATE purchase_order_items SET status = ? WHERE id = ?',
        [newItemStatus, item.id]
      );
      debugLog(`  Updated item ${item.id}: status=${newItemStatus}`);
    }
    
    // Check overall PO status based on updated item statuses
    if (received < ordered) {
      allItemsFullyReceived = false;
    }
    
    if (received > 0) {
      anyItemReceived = true;
    }
  }

  let newPoStatus;
  const hasOrderableItems = poItems.some(item => parseFloat(item.quantity_ordered || 0) > 0);
  
  if (!hasOrderableItems) {
      newPoStatus = 'RECEIVED';
  } else if (allItemsFullyReceived) {
      newPoStatus = 'RECEIVED';
  } else if (anyItemReceived) {
      newPoStatus = 'PARTIALLY_RECEIVED';
  } else {
      newPoStatus = 'ORDERED';
  }
  
  debugLog(`[updatePurchaseOrderStatus] Setting PO ${purchaseOrderId} status to: ${newPoStatus}. allItemsFullyReceived=${allItemsFullyReceived}, anyItemReceived=${anyItemReceived}`);

  // Update the PO status
  try {
    await connection.query(
      'UPDATE purchase_orders SET status = ? WHERE id = ? AND tenant_id = ?',
      [newPoStatus, purchaseOrderId, tenant_id]
    );
    debugLog(`[updatePurchaseOrderStatus] Successfully updated PO ${purchaseOrderId} status to ${newPoStatus}`);
  } catch (error) {
    console.error(`[updatePurchaseOrderStatus] Error updating PO ${purchaseOrderId} status:`, error.message);
    throw error; // Re-throw to be caught by caller
  }

  // Correctly destructure query result for purchase order status check
  const [currentPoRowsResult] = await connection.query('SELECT status FROM purchase_orders WHERE id = ? AND tenant_id = ?', [purchaseOrderId, tenant_id]);
  
  // Debug logging for currentPoRowsResult
  debugLog(`[Backend] updatePurchaseOrderStatus: currentPoRowsResult type: ${typeof currentPoRowsResult}, isArray: ${Array.isArray(currentPoRowsResult)}`);
  if (currentPoRowsResult) {
    try {
      debugLog(`[Backend] updatePurchaseOrderStatus: currentPoRowsResult content: ${JSON.stringify(currentPoRowsResult)}`);
    } catch (e) {
      debugLog(`[Backend] updatePurchaseOrderStatus: Error stringifying currentPoRowsResult: ${e.message}`);
    }
  }
  
  if (!currentPoRowsResult || (Array.isArray(currentPoRowsResult) && currentPoRowsResult.length === 0)) {
    console.error(`[updatePurchaseOrderStatus] PO ${purchaseOrderId} not found for tenant ${tenant_id} during status update.`);
    return;
  }

  // Handle both array and single object results
  const currentPoRow = Array.isArray(currentPoRowsResult) ? currentPoRowsResult[0] : currentPoRowsResult;
  
  if (!currentPoRow) {
    console.error(`[updatePurchaseOrderStatus] PO ${purchaseOrderId} row data is missing or undefined.`);
    return;
  }
  
  const currentPoStatus = currentPoRow.status;

  if (currentPoStatus === 'DRAFT') {
    debugLog(`[updatePurchaseOrderStatus] PO ${purchaseOrderId} is in DRAFT status. Status not changed by GRN event.`);
    return;
  }

  const setClauses = [];
  const updateParamsList = []; 

  if (newPoStatus && newPoStatus !== currentPoStatus) {
    setClauses.push('status = ?');
    updateParamsList.push(newPoStatus);
  }

  // Note: received_status column removed as it doesn't exist in purchase_orders table

  if (received_date_for_po_update && (newPoStatus === 'PARTIALLY_RECEIVED' || newPoStatus === 'RECEIVED')) {
    // Update last_grn_date column (now that we've added it to the table)
    setClauses.push('last_grn_date = ?');
    updateParamsList.push(received_date_for_po_update);
  }

  if (setClauses.length > 0) {
    const updateQueryStr = `UPDATE purchase_orders SET ${setClauses.join(', ')} WHERE id = ? AND tenant_id = ?`;
    updateParamsList.push(purchaseOrderId, tenant_id);
    await connection.query(updateQueryStr, updateParamsList);
    
    let logMessage = `[updatePurchaseOrderStatus] PO ${purchaseOrderId}:`;
    let changed = false;
    if (setClauses.some(c => c.startsWith('status = ?'))) {
        logMessage += ` status changed from ${currentPoStatus} to ${newPoStatus}.`;
        changed = true;
    }
    if (setClauses.some(c => c.startsWith('last_grn_date = ?'))) {
        logMessage += ` last_grn_date updated to ${received_date_for_po_update}.`;
        changed = true;
    }
    if (!changed && setClauses.length > 0) { 
        logMessage += ` Update query run with clauses: ${setClauses.join(', ')}.`;
    }
    debugLog(logMessage);
  } else {
    debugLog(`[updatePurchaseOrderStatus] PO ${purchaseOrderId}: No changes needed for status or last_grn_date.`);
  }
};

// Helper function to update all POs affected by a GRN
const updateAllAffectedPurchaseOrders = async (connection, grnId, grnItemsArray, directPurchaseOrderId, tenant_id, receivedDate) => {
  try {
    debugLog(`[GRN] Starting updateAllAffectedPurchaseOrders for GRN ID: ${grnId}`);
    debugLog(`[GRN] GRN items array:`, JSON.stringify(grnItemsArray.map(item => ({
      id: item.id,
      purchase_order_item_id: item.purchase_order_item_id,
      meta_purchase_order_id: item.meta_purchase_order_id
    })), null, 2));
    
    // Track all affected PO IDs to update their statuses
    const affectedPurchaseOrderIds = new Set();
    
    // Add the direct PO if it exists
    if (directPurchaseOrderId) {
      debugLog(`[GRN] Adding direct PO ID to affected list: ${directPurchaseOrderId}`);
      affectedPurchaseOrderIds.add(directPurchaseOrderId);
    } else {
      debugLog(`[GRN] No direct purchase_order_id provided for GRN ID: ${grnId}`);
    }
    
    // Add any POs from the GRN items that may not be the main PO
    debugLog(`[GRN] Checking ${grnItemsArray.length} GRN items for related purchase order items`);
    
    // Process each GRN item to find associated PO IDs
    for (const item of grnItemsArray) {
      // If meta_purchase_order_id is already set, use it
      if (item.meta_purchase_order_id) {
        affectedPurchaseOrderIds.add(item.meta_purchase_order_id);
        debugLog(`[GRN] Added pre-resolved PO ID ${item.meta_purchase_order_id} from meta_purchase_order_id for item`);
        continue;
      }
      
      // If we have a purchase_order_item_id, look up its parent PO
      if (item.purchase_order_item_id) {
        try {
          debugLog(`[GRN] Looking up parent PO for PO item ${item.purchase_order_item_id}`);
          const [poRows] = await connection.query(
            'SELECT poi.purchase_order_id, po.id as po_id FROM purchase_order_items poi JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE poi.id = ? AND po.tenant_id = ?',
            [item.purchase_order_item_id, tenant_id]
          );
          
          debugLog(`[GRN] PO lookup query results for item ${item.purchase_order_item_id}:`, JSON.stringify(poRows, null, 2));
          
          if (poRows && poRows.length > 0) {
            const poId = poRows[0].purchase_order_id;
            affectedPurchaseOrderIds.add(poId);
            item.meta_purchase_order_id = poId; // Set the meta field for future reference
            debugLog(`[GRN] Found and added purchase_order_id=${poId} for purchase_order_item_id=${item.purchase_order_item_id}`);
          } else {
            console.warn(`[GRN] Could not find parent PO for PO item ${item.purchase_order_item_id}`);
          }
        } catch (error) {
          console.error(`[GRN] Error looking up parent PO for item ${item.purchase_order_item_id}:`, error.message);
        }
      }
    }

    const affectedPOArray = Array.from(affectedPurchaseOrderIds);
    debugLog(`[GRN] Final list of affected PO IDs to update: ${affectedPOArray.join(', ')}`);
    
    if (affectedPurchaseOrderIds.size === 0) {
      debugLog(`[GRN] No purchase orders to update for GRN ID: ${grnId}`);
      return;
    }

    // For each affected PO, update its status
    for (const poId of affectedPurchaseOrderIds) {
      try {
        debugLog(`[GRN] Updating status for purchase order ID: ${poId}`);
        await updatePurchaseOrderStatus(poId, connection, tenant_id, receivedDate);
        debugLog(`[GRN] Successfully updated purchase order status for PO ID: ${poId}`);
      } catch (error) {
        console.error(`[GRN] Error updating purchase order status for PO ID: ${poId}:`, error.message);
        // Continue with other POs despite errors
      }
    }

    debugLog(`[GRN] Completed updateAllAffectedPurchaseOrders for GRN ID: ${grnId}`);
  } catch (error) {
    console.error(`[GRN] Unexpected error in updateAllAffectedPurchaseOrders:`, error.message);
    throw error; // Re-throw to be handled by the caller
  }
};

// Helper function to generate GRN Number that's unique per store
const generateGrnNumber = async (txConnection, tenantId, storeId) => {
  if (!storeId) {
    throw new Error('Store ID is required for GRN number generation to ensure uniqueness per store');
  }
  
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last two digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Zero-padded month
  
  // Include store identifier in the prefix
  const storePrefix = storeId.toString().substring(0, 4).padEnd(4, '0'); // First 4 chars of store ID padded to 4
  const prefix = `GRN-${year}${month}-${storePrefix}-`; // Example: GRN-2405-STORE-

  // Find the highest current GRN number with this prefix for the tenant and store
  // txConnection.query returns rows directly (no destructuring needed)
  debugLog(`[Backend] generateGrnNumber: Generating unique GRN number for tenant ${tenantId} and store ${storeId}`);
  
  const [rows] = await txConnection.query(
    'SELECT MAX(CAST(SUBSTRING(grn_number, LENGTH(?) + 1) AS UNSIGNED)) as max_num FROM goods_received_notes WHERE grn_number LIKE ? AND tenant_id = ? AND store_id = ?',
    [prefix, `${prefix}%`, tenantId, storeId]
  );
  
  let nextNum = 10001; // Start sequence from 10001
  if (rows && rows.length > 0 && rows[0].max_num) {
    nextNum = parseInt(rows[0].max_num, 10) + 1;
    debugLog(`[Backend] generateGrnNumber: Found existing GRN numbers, incrementing to ${nextNum}`);
  } else {
    debugLog(`[Backend] generateGrnNumber: No existing GRN numbers found with prefix ${prefix}, starting at ${nextNum}`);
  }
  
  return `${prefix}${nextNum.toString()}`;
};

// @desc    Create a new Goods Received Note
// @route   POST /api/grn
// @access  Private (to be implemented)
const createGrn = async (req, res) => {
  debugLog('[Backend] createGrn: Received request');
  
  // Get authenticated user data from JWT token (CRITICAL FIX)
  const { tenant_id, id: userId } = req.user;
  
  const {
    supplier_id,
    purchase_order_id,
    received_date,
    notes,
    items,
    supplier_invoice_number,
    supplier_invoice_date,
    total_tax_paid,
    shipping_handling_paid,
    other_charges_paid,
    store_id  // Store ID should come from request body for GRN creation
  } = req.body;
  
  debugLog(`[Backend] createGrn: Authenticated user - tenant_id: ${tenant_id}, userId: ${userId}`);
  debugLog(`[Backend] createGrn: Request data - store_id: ${store_id}, supplier_id: ${supplier_id}, purchase_order_id: ${purchase_order_id}`);
  debugLog(`[Backend] createGrn: Items count: ${items ? items.length : 0}`);
  debugLog(`[Backend] createGrn: RAW STATUS FROM FRONTEND - req.body.status: '${req.body.status}' (type: ${typeof req.body.status})`);
  
  // Log items with purchase_order_item_id focus for debugging
  if (items && items.length > 0) {
    debugLog(`[Backend] createGrn: Items with PO item ID focus:`, JSON.stringify(
      items.map(item => ({
        product_id: item.product_id,
        purchase_order_item_id: item.purchase_order_item_id,
        purchase_order_id: item.purchase_order_id,
        quantity_received: item.quantity_received
      })), null, 2
    ));
  }

  // --- Basic Input Validation (can be expanded) ---
  if (!tenant_id || !store_id || !received_date || !items || items.length === 0 || !userId) {
    return res.status(400).json({ message: 'Missing required fields: tenant_id, store_id, received_date, items, or user authentication.' });
  }

  for (const item of items) {
    if (!item.product_id || item.quantity_received == null || item.unit_cost_price == null || item.tax_rate == null) {
      return res.status(400).json({ message: 'Each item must have product_id, quantity_received, unit_cost_price, and tax_rate' });
    }
    if (parseFloat(item.quantity_received) <= 0) {
        return res.status(400).json({ message: `Quantity received for product ${item.product_id} must be greater than 0.` });
    }
    if (parseFloat(item.tax_rate) < 0) {
        return res.status(400).json({ message: `Tax rate for product ${item.product_id} cannot be negative.` });
    }
  }

  // --- Fetch store setting for over-receiving --- 
  let storeAllowsOverReceiving = false; 
  try {
    const [storeSettingsResult] = await pool.query('SELECT allow_over_receiving FROM stores WHERE id = ? AND tenant_id = ?', [store_id, tenant_id]);
    
    // Check if we got a result (either an object or the first element of an array)
    const storeData = Array.isArray(storeSettingsResult) ? storeSettingsResult[0] : storeSettingsResult;

    if (storeData) { // If storeData is a valid object
      if (storeData.allow_over_receiving == 1 || storeData.allow_over_receiving === true) { // Explicitly check for true or 1
        storeAllowsOverReceiving = true;
        debugLog(`[Backend] createGrn: Store ${store_id} ALLOWS over-receiving.`);
      } else {
        debugLog(`[Backend] createGrn: Store ${store_id} does NOT allow over-receiving.`);
      }
    } else {
      console.warn(`[Backend] createGrn: Store settings for store_id ${store_id} (tenant: ${tenant_id}) NOT FOUND. Defaulting to no over-receiving.`);
    }
  } catch (dbError) {
    console.error(`[Backend] createGrn: Error fetching store settings for store_id ${store_id}:`, dbError);
    // Potentially return 500 error or proceed with default (false)
    // For now, proceeding with default (false)
  }

  // --- Strict Over-Receiving Validation (Phase 2: Zero Tolerance) --- 
  // Always enforce strict validation regardless of store settings
  debugLog('[Backend] createGrn: Enforcing strict no over-receiving validation (Phase 2 requirement).');
    for (const item of items) {
    if (item.purchase_order_item_id) {
      try {
        const [poItemResult] = await pool.query(
          'SELECT p.name as product_name, poi.quantity_ordered, poi.quantity_received FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE poi.id = ? AND po.tenant_id = ?',
          [item.purchase_order_item_id, tenant_id]
        );
        
        // Check if we got a result
        const poItemData = Array.isArray(poItemResult) ? poItemResult[0] : poItemResult;

        if (!poItemData) { // If poItemData is null, undefined, or an empty array's first element (which would be undefined)
          return res.status(400).json({
            message: `Validation Error: Purchase Order Item ID ${item.purchase_order_item_id} not found or does not belong to tenant ${tenant_id}. Cannot validate received quantity.`
          });
        }

        const poItemDetails = poItemData; // poItemData is the actual row object
        const productName = poItemDetails.product_name || `ID ${item.product_id}`;
        const quantityOrdered = parseFloat(poItemDetails.quantity_ordered);
        const currentQuantityReceived = parseFloat(poItemDetails.quantity_received || 0);
        const quantityBeingReceived = parseFloat(item.quantity_received);

        const maxReceivable = quantityOrdered - currentQuantityReceived;

        if (quantityBeingReceived > maxReceivable) {
          return res.status(400).json({
            message: `Over-receiving Product: ${productName} (PO Item ID: ${item.purchase_order_item_id}). Ordered: ${quantityOrdered}, Already Received: ${currentQuantityReceived}, Attempting to Receive Now: ${quantityBeingReceived}. Maximum allowable additional quantity is ${maxReceivable.toFixed(2)}. Please adjust the received quantity.`
          });
        }
      } catch (error) {
        console.error(`[VALIDATION_ERROR] Error during over-receiving check for PO Item ID ${item.purchase_order_item_id}:`, error);
        return res.status(500).json({ message: 'Server error during pre-GRN validation.' });
      }
    }
  }
  // --- End of Strict Over-Receiving Validation ---

  try {
    debugLog(`[Backend] createGrn: GRN status from request (req.body.status): ${req.body.status}`);
    debugLog('[Backend] createGrn: Starting transaction with explicit error handling and rollback...');

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      debugLog('[Backend] createGrn: Transaction started.');
      const currentGrnId = uuidv4();
      debugLog('[Backend] createGrn: GRN ID generated:', currentGrnId);
      
      // Use the store_id from the request body to ensure GRN number uniqueness per store
      const store_id = req.body.store_id;
      if (!store_id) {
        throw new Error('Store ID is required for GRN creation');
      }
      
      const currentGrnNumber = await generateGrnNumber(connection, tenant_id, store_id);
      debugLog(`[Backend] createGrn: GRN number generated: ${currentGrnNumber}`);

      let totalReceivedValue = 0;
      items.forEach(item => {
        totalReceivedValue += parseFloat(item.quantity_received) * parseFloat(item.unit_cost_price);
      });

      // Use status from frontend request, default to DRAFT if not provided
      const grnStatusFromRequest = req.body.status || 'DRAFT';
      debugLog(`[Backend] createGrn: GRN status from request: ${grnStatusFromRequest}`);

      // Initialize finalPurchaseOrderId - will be set after pre-processing
      let finalPurchaseOrderId = purchase_order_id;

      const processedItemsForPOUpdate = [];
      debugLog(`[Backend] createGrn: Processing ${items.length} GRN items for pre-processing...`);
      
      // First, pre-process any items with PO items to get the parent PO IDs
      for (const item of items) {
        if (item.purchase_order_item_id) {
          try {
            debugLog(`[Backend] createGrn: Looking up parent PO for PO item ${item.purchase_order_item_id}`);
            const [poItemLookupRows] = await connection.query(
              'SELECT poi.purchase_order_id, po.id as po_id FROM purchase_order_items poi JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE poi.id = ? AND po.tenant_id = ?', 
              [item.purchase_order_item_id, tenant_id]
            );
            
            debugLog(`[Backend] createGrn: PO item lookup result:`, JSON.stringify(poItemLookupRows, null, 2));
            
            if (poItemLookupRows && poItemLookupRows.length > 0) {
              item.meta_purchase_order_id = poItemLookupRows[0].purchase_order_id;
              debugLog(`[Backend] createGrn: Found parent PO ID ${item.meta_purchase_order_id} for PO item ${item.purchase_order_item_id}`);
            } else {
              console.warn(`[Backend] createGrn: Could not find parent PO for PO Item ID ${item.purchase_order_item_id}`);
              item.meta_purchase_order_id = null;
            }
          } catch (error) {
            console.error(`[Backend] createGrn: Error looking up parent PO for PO item ${item.purchase_order_item_id}:`, error.message);
            item.meta_purchase_order_id = null;
          }
        } else {
          item.meta_purchase_order_id = null;
        }
      }
      debugLog(`[Backend] createGrn: Pre-processed items with PO information:`, JSON.stringify(items.map(i => ({ id: i.id, purchase_order_item_id: i.purchase_order_item_id, meta_purchase_order_id: i.meta_purchase_order_id })), null, 2));
      
      // Auto-detect purchase_order_id for GRN header BEFORE creating the header
      if (!finalPurchaseOrderId) {
        const poIdsFromItems = items.filter(item => item.meta_purchase_order_id).map(item => item.meta_purchase_order_id);
        const uniquePoIds = [...new Set(poIdsFromItems)];
        if (uniquePoIds.length === 1) {
          finalPurchaseOrderId = uniquePoIds[0];
          debugLog(`[Backend] createGrn: Auto-detected purchase_order_id: ${finalPurchaseOrderId} from PO items`);
        } else if (uniquePoIds.length > 1) {
          debugLog(`[Backend] createGrn: Multiple PO IDs found in items (${uniquePoIds.join(', ')}). Cannot auto-detect single purchase_order_id.`);
        } else {
          debugLog(`[Backend] createGrn: No PO items found for auto-detection. GRN will have NULL purchase_order_id.`);
        }
      }

      // Now create the GRN header with the correct purchase_order_id
      const grnHeader = {
        id: currentGrnId,
        tenant_id,
        store_id,
        grn_number: currentGrnNumber,
        supplier_id: supplier_id || null,
        purchase_order_id: finalPurchaseOrderId || null, 
        received_date,
        notes: notes || null,
        user_id: userId,
        received_by_user_id: userId,
        status: grnStatusFromRequest,
        total_received_value: totalReceivedValue.toFixed(2),
        supplier_invoice_number: supplier_invoice_number || null,
        supplier_invoice_date: supplier_invoice_date || null,
        total_tax_paid: parseFloat(total_tax_paid || 0).toFixed(2),
        shipping_handling_paid: parseFloat(shipping_handling_paid || 0).toFixed(2),
        other_charges_paid: parseFloat(other_charges_paid || 0).toFixed(2)
      };

      debugLog('[Backend] createGrn: Inserting GRN header with correct purchase_order_id:', grnHeader);
      await connection.query('INSERT INTO goods_received_notes SET ?', grnHeader);
      debugLog('[Backend] createGrn: GRN header inserted.');

      debugLog(`[Backend] createGrn: Processing ${items.length} GRN items for insertion into grn_items table...`);
      
      for (const item of items) {
        const grnItemId = uuidv4();
        item.meta_grn_item_id = grnItemId; 

        const grnItemData = {
          id: grnItemId,
          grn_id: currentGrnId,
          product_id: item.product_id,
          purchase_order_id: item.meta_purchase_order_id || null, // NEW: Item-level PO tracking
          purchase_order_item_id: item.purchase_order_item_id || null,
          quantity_received: parseFloat(item.quantity_received),
          unit_cost_price: parseFloat(item.unit_cost_price),
          tax_rate: parseFloat(item.tax_rate).toFixed(2),
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null,
          remarks: item.remarks || null,
        };
        await connection.query('INSERT INTO grn_items SET ?', grnItemData);
        debugLog(`[Backend] createGrn: Inserted grn_item ${grnItemId} for product ${item.product_id}.`);
        
        // meta_purchase_order_id was already resolved in pre-processing step
        debugLog(`[Backend] createGrn: Adding item to processedItemsForPOUpdate with purchase_order_item_id=${item.purchase_order_item_id}, meta_purchase_order_id=${item.meta_purchase_order_id}`);
        // The meta_purchase_order_id is already set in the pre-processing step
        processedItemsForPOUpdate.push(item); // Add item (now with meta_purchase_order_id) to the array
      }
      debugLog('[Backend] createGrn: All grn_items inserted.');

      // NEW LOGIC: Process inventory and PO updates based on GRN status
      // DRAFT: No inventory/PO updates, COMPLETED: Full updates, CANCELLED: No updates
      if (grnHeader.status === 'COMPLETED') {
        debugLog(`[Backend] createGrn: GRN status is COMPLETED. Proceeding with inventory and PO updates.`);
        
        // Process each item for inventory and PO updates
        for (const item of items) {
          const receivedQty = parseFloat(item.quantity_received);
          const receivedCost = parseFloat(item.unit_cost_price);

          // 1. Update product stock quantities (always for COMPLETED GRNs).
          // Branches internally on store-owned vs. tenant-shared product —
          // see storeProductListingService.receiveStock's doc comment.
          let receiveResult;
          try {
            receiveResult = await storeProductListingService.receiveStock(
              connection, tenant_id, grnHeader.store_id, item.product_id, receivedQty, receivedCost,
              { receivedDate: received_date, userId }
            );
          } catch (receiveErr) {
            console.error(`[Backend] createGrn: Product ID ${item.product_id} receive failed: ${receiveErr.message}`);
            continue;
          }
          const { oldQtyOnHand, newQtyOnHand } = receiveResult;
          debugLog(`[Backend] createGrn: Product ${item.product_id} stock updated.`);

          // 2. Create inventory log entry
          const inventoryLogId = uuidv4();
          const inventoryLogData = {
            id: inventoryLogId, 
            tenant_id, 
            store_id: grnHeader.store_id, 
            product_id: item.product_id,
            quantity_change: receivedQty.toFixed(2), 
            reason: `GRN Receipt: ${currentGrnNumber}`,
            current_stock_before_change: oldQtyOnHand.toFixed(2), 
            current_stock_after_change: newQtyOnHand.toFixed(2),
            created_by: userId, 
            reference_id: currentGrnId, 
            reference_type: 'GRN'
          };
          await connection.query('INSERT INTO inventory_logs SET ?', inventoryLogData);
          debugLog(`[Backend] createGrn: Inventory log created for product ${item.product_id}.`);
          
          // 3. Update PO item quantities (only for PO-linked items)
          if (item.purchase_order_item_id) {
            try {
              const [poItemRows] = await connection.query(
                'SELECT poi.quantity_received, poi.purchase_order_id FROM purchase_order_items poi JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE poi.id = ? AND po.tenant_id = ? FOR UPDATE',
                [item.purchase_order_item_id, tenant_id]
              );
              
              if (poItemRows && poItemRows.length > 0) {
                // Set meta_purchase_order_id for PO status updates
                if (!item.meta_purchase_order_id && poItemRows[0].purchase_order_id) {
                  item.meta_purchase_order_id = poItemRows[0].purchase_order_id;
                }
                
                const currentPoItemReceivedQty = parseFloat(poItemRows[0].quantity_received || 0);
                const newTotalPoItemReceivedQty = currentPoItemReceivedQty + receivedQty;
                
                await connection.query(
                  'UPDATE purchase_order_items SET quantity_received = ? WHERE id = ?',
                  [newTotalPoItemReceivedQty.toFixed(2), item.purchase_order_item_id]
                );
                debugLog(`[Backend] createGrn: Updated PO item ${item.purchase_order_item_id} received quantity.`);
              }
            } catch (error) {
              console.error(`[Backend] createGrn: Error updating PO item ${item.purchase_order_item_id}:`, error.message);
            }
          }
        }

        // 4. Update all affected PO statuses
        debugLog('[Backend] createGrn: Updating affected PO statuses...');
        await updateAllAffectedPurchaseOrders(connection, currentGrnId, processedItemsForPOUpdate, grnHeader.purchase_order_id, tenant_id, received_date);
        debugLog('[Backend] createGrn: PO status updates completed.');

        // 5. Accrual posting — goods on the shelf are an asset until sold:
        //    Dr Inventory / Cr AP for the received value.
        await postGrnReceiptEntry(connection, tenant_id, grnHeader, userId);

      } else if (grnHeader.status === 'DRAFT') {
        debugLog(`[Backend] createGrn: GRN status is DRAFT. Skipping inventory and PO updates (will process when status changes to COMPLETED).`);
      } else {
        debugLog(`[Backend] createGrn: GRN status is ${grnHeader.status}. No inventory or PO updates required.`);
      }

      await connection.commit();
      debugLog('[Backend] createGrn: Transaction committed successfully. GRN ID:', currentGrnId, 'Number:', currentGrnNumber);
      res.status(201).json({
        message: 'GRN created successfully',
        grnId: currentGrnId,
        grnNumber: currentGrnNumber
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('[Backend] createGrn: Error during GRN creation:', error);
    res.status(500).json({ message: `Failed to create GRN: ${error.message}`, error: error.toString() });
  }

};

// @desc    Get all Goods Received Notes with pagination and filters
// @route   GET /api/grn
// @access  Private (to be implemented)
const getGrns = async (req, res) => {
  const {
    tenant_id,
    page = 1,
    limit = 10,
    sortBy = 'grn.received_date', // prefixed with table alias
    sortOrder = 'DESC',
    grn_number,
    supplier_id,
    purchase_order_id,
    status,
    dateFrom,
    dateTo,
    store_id
  } = req.query;

  if (!tenant_id) {
    return res.status(400).json({ message: 'Tenant ID is required.' });
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let query = `
    SELECT 
      grn.id, grn.grn_number, grn.received_date, grn.status, grn.total_received_value,
      grn.supplier_invoice_number, grn.grand_total,
      s.supplier_name as supplier_name,
      po.purchase_order_number as po_number,
      u.name as received_by_username,
      st.name as store_name 
    FROM goods_received_notes grn
    LEFT JOIN suppliers s ON grn.supplier_id = s.id AND s.tenant_id = grn.tenant_id
    LEFT JOIN purchase_orders po ON grn.purchase_order_id = po.id AND po.tenant_id = grn.tenant_id
    LEFT JOIN users u ON grn.received_by_user_id = u.id 
    LEFT JOIN stores st ON grn.store_id = st.id AND st.tenant_id = grn.tenant_id
    WHERE grn.tenant_id = ?`;
  
  let countQuery = 'SELECT COUNT(*) as totalItems FROM goods_received_notes grn WHERE grn.tenant_id = ?';
  
  const params = [tenant_id];
  const countParams = [tenant_id];

  if (grn_number) {
    query += ' AND grn.grn_number LIKE ?';
    countQuery += ' AND grn.grn_number LIKE ?';
    params.push(`%${grn_number}%`);
    countParams.push(`%${grn_number}%`);
  }
  if (supplier_id) {
    query += ' AND grn.supplier_id = ?';
    countQuery += ' AND grn.supplier_id = ?';
    params.push(supplier_id);
    countParams.push(supplier_id);
  }
  if (purchase_order_id) {
    query += ' AND grn.purchase_order_id = ?';
    countQuery += ' AND grn.purchase_order_id = ?';
    params.push(purchase_order_id);
    countParams.push(purchase_order_id);
  }
  if (status) {
    query += ' AND grn.status = ?';
    countQuery += ' AND grn.status = ?';
    params.push(status);
    countParams.push(status);
  }
  if (dateFrom) {
    query += ' AND grn.received_date >= ?';
    countQuery += ' AND grn.received_date >= ?';
    params.push(dateFrom);
    countParams.push(dateFrom);
  }
  if (dateTo) {
    query += ' AND grn.received_date <= ?';
    countQuery += ' AND grn.received_date <= ?';
    params.push(dateTo);
    countParams.push(dateTo);
  }
  if (store_id) {
    query += ' AND grn.store_id = ?';
    countQuery += ' AND grn.store_id = ?';
    params.push(store_id);
    countParams.push(store_id);
  }

  const validSortColumns = ['grn.received_date', 'grn.grn_number', 'grn.status', 'grn.total_received_value', 's.supplier_name', 'po.purchase_order_number', 'st.name', 'u.name'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'grn.received_date';
  const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${sortColumn} ${orderDirection} LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  try {
    // Correctly destructure to get the rows array from [rows, fields]
    const [countResult] = await pool.query(countQuery, countParams);
    const totalItems = countResult && countResult.length > 0 ? countResult[0].totalItems : 0;

    let data = []; // Default to empty array

    if (totalItems > 0) {
      // Only fetch data if countQuery indicates there is data
      const [grnRows] = await pool.query(query, params);
      data = grnRows; // grnRows is now the array of data objects
    }

    res.json({
      data,
      totalItems,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalItems / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching GRNs:', error);
    res.status(500).json({ message: 'Failed to fetch GRNs', error: error.message });
  }
};

// @desc    Get a single Goods Received Note by ID
// @route   GET /api/grn/:id
// @access  Private (to be implemented)
const getGrnById = async (req, res) => {
  const { id } = req.params;
  const { tenant_id } = req.query; 

  if (!tenant_id) {
    return res.status(400).json({ message: 'Tenant ID is required in query parameters.' });
  }

  try {
    debugLog(`[getGrnById] Fetching GRN ID: ${id} for tenant: ${tenant_id}`);
    
    const [grnRows] = await pool.query(
      `SELECT 
         grn.*, 
         s.supplier_name as supplier_name,
         po.purchase_order_number as po_number,
         u_creator.name as created_by_username,
         u_receiver.name as received_by_username,
         st.name as store_name 
       FROM goods_received_notes grn
       LEFT JOIN suppliers s ON grn.supplier_id = s.id AND s.tenant_id = grn.tenant_id
       LEFT JOIN purchase_orders po ON grn.purchase_order_id = po.id AND po.tenant_id = grn.tenant_id
       LEFT JOIN users u_creator ON grn.user_id = u_creator.id
       LEFT JOIN users u_receiver ON grn.received_by_user_id = u_receiver.id
       LEFT JOIN stores st ON grn.store_id = st.id AND st.tenant_id = grn.tenant_id
       WHERE grn.id = ? AND grn.tenant_id = ?`,
      [id, tenant_id]
    );
    
    debugLog(`[getGrnById] Found ${grnRows.length} GRN records`);

    if (!grnRows || grnRows.length === 0) {
      return res.status(404).json({ message: 'GRN not found or not accessible for this tenant.' });
    }
    const grn = grnRows[0];

    // Fetch GRN items
    debugLog(`[getGrnById] Fetching items for GRN ID: ${id}`);
    
    const [itemsArray] = await pool.query(
      `SELECT 
         gi.id, 
         gi.grn_id AS grnId, 
         gi.product_id AS productId, 
         gi.quantity_received AS quantityReceived, 
         gi.unit_cost_price AS unitCostPrice, 
         gi.tax_rate AS taxRate, 
         gi.tax_amount AS taxAmount, 
         gi.line_total AS lineTotal, 
         gi.batch_number AS batchNumber, 
         gi.expiry_date AS expiryDate, 
         gi.remarks,
         p.name as productName, 
         p.sku as productSku
       FROM grn_items gi
       JOIN products p ON gi.product_id = p.id AND p.tenant_id = ? 
       WHERE gi.grn_id = ?`,
      [tenant_id, id] // Parameters fixed: tenant_id first, then grn_id
    );
    
    debugLog(`[getGrnById] Found ${itemsArray.length} GRN items`);
    debugLog(`[getGrnById] Items array:`, itemsArray);

    // Ensure grn.items is always an array
    grn.items = Array.isArray(itemsArray) ? itemsArray : [];
    
    debugLog(`[getGrnById] Final GRN object with ${grn.items.length} items`);

    res.json(grn);

  } catch (error) {
    console.error(`Error fetching GRN by ID ${id}:`, error);
    res.status(500).json({ message: 'Failed to fetch GRN', error: error.message });
  }
};

// @desc    Update GRN Status (handles inventory commitment/reversal)
// @route   PATCH /api/grn/:id/status
// @access  Private (to be implemented)
const updateGrnStatus = async (req, res) => {
  const { id: grnId } = req.params;
  const { new_status: newStatus, tenant_id } = req.body; // tenant_id from body, new_status aliased to newStatus
  const userId = getUserId(req); // Placeholder for actual user ID from auth

  if (!newStatus || !tenant_id) {
    return res.status(400).json({ message: 'New status and tenant ID are required.' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // 1. Fetch current GRN details
      const [grnRows] = await connection.query(
        'SELECT id, tenant_id, store_id, grn_number, status, received_date, purchase_order_id, supplier_id, total_received_value FROM goods_received_notes WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [grnId, tenant_id]
      );
      
      debugLog('[grnController.updateGrnStatus] MySQL2 query result (grnRows):', JSON.stringify(grnRows, null, 2));

      if (!grnRows || grnRows.length === 0) { // If no rows returned, GRN not found
        debugLog('[grnController.updateGrnStatus] GRN not found - no rows returned. grnRows:', JSON.stringify(grnRows, null, 2));
        const err = new Error('GRN not found or not accessible for this tenant.');
        err.statusCode = 404;
        throw err;
      }

      // Extract the first (and only) GRN record from the result array
      const grnResult = grnRows[0];
      debugLog('[GRN STATUS UPDATE DEBUG] Extracted GRN data:', JSON.stringify(grnResult, null, 2)); 
      // Optional: Log grnResult if needed, but it's same as grnRecord logged above.
      // debugLog('[grnController.updateGrnStatus] grnResult (assigned from grnRecord):', JSON.stringify(grnResult, null, 2)); 

      // Safeguard: Check if grnResult is indeed a usable object.
      // This should ideally not be hit if !grnRecord catches all "not found" cases.
      if (typeof grnResult !== 'object' || grnResult === null) { 
          console.error('[grnController.updateGrnStatus] CRITICAL: grnResult is not a valid object despite grnRecord being truthy. grnResult:', JSON.stringify(grnResult, null, 2));
          const err = new Error('Internal server error: Failed to process GRN data due to unexpected result type.');
          err.statusCode = 500;
          throw err;
      }

      const currentStatus = grnResult.status;
      const storeId = grnResult.store_id;
      const grnNumber = grnResult.grn_number;
      const receivedDate = grnResult.received_date;
      const purchaseOrderId = grnResult.purchase_order_id;

      // CRITICAL DEBUG: Log the status transition details RIGHT HERE
      debugLog(`[GRN STATUS UPDATE DEBUG] EXTRACTED STATUS INFO:`);
      debugLog(`[GRN STATUS UPDATE DEBUG] Current Status: '${currentStatus}' (type: ${typeof currentStatus})`);
      debugLog(`[GRN STATUS UPDATE DEBUG] New Status: '${newStatus}' (type: ${typeof newStatus})`);
      debugLog(`[GRN STATUS UPDATE DEBUG] GRN Number: ${grnNumber}`);
      debugLog(`[GRN STATUS UPDATE DEBUG] Store ID: ${storeId}`);
      debugLog(`[GRN STATUS UPDATE DEBUG] Purchase Order ID: ${purchaseOrderId}`);

      if (currentStatus === newStatus) {
        // No change, but to ensure idempotency, we might just return success
        // For now, let's inform the user.
        // Consider if frontend expects a 200 or a different code for no change.
        // Returning 200 for simplicity as the state matches the desired state.
        return res.status(200).json({ message: `GRN status is already ${newStatus}.` });
      }

      if (currentStatus === 'CANCELLED' || currentStatus === 'POSTED') {
        // Generally, POSTED is final, and CANCELLED is also final.
        // Business logic might allow POSTED -> COMPLETED (e.g. unposting) or other specific transitions.
        // For now, keeping it simple: cannot change from CANCELLED or POSTED easily.
        // This check might need refinement based on detailed business rules.
        if (newStatus !== currentStatus) { // only restrict if trying to change from these final states
             return res.status(400).json({ message: `Cannot change status from ${currentStatus} to ${newStatus} through this general endpoint.` });
        }
      }
      
      const inventoryCommittedStatuses = ['COMPLETED', 'POSTED'];
      const inventoryReversingNewStatuses = ['DRAFT', 'CANCELLED']; // Statuses that trigger reversal if current was committed
      const nonCommittedOldStatuses = ['DRAFT']; // Statuses that can be committed from

      // CRITICAL DEBUG: Log the status transition details
      debugLog(`[GRN STATUS UPDATE DEBUG] Starting status update for GRN ${grnId}`);
      debugLog(`[GRN STATUS UPDATE DEBUG] Current Status: '${currentStatus}' -> New Status: '${newStatus}'`);
      debugLog(`[GRN STATUS UPDATE DEBUG] inventoryCommittedStatuses.includes(currentStatus): ${inventoryCommittedStatuses.includes(currentStatus)}`);
      debugLog(`[GRN STATUS UPDATE DEBUG] inventoryReversingNewStatuses.includes(newStatus): ${inventoryReversingNewStatuses.includes(newStatus)}`);
      debugLog(`[GRN STATUS UPDATE DEBUG] Should trigger reversal: ${inventoryCommittedStatuses.includes(currentStatus) && inventoryReversingNewStatuses.includes(newStatus)}`);

      // Fetch GRN items for inventory operations
      // Ensure grnItems is an array of rows, or an empty array if no items are found.
      const [rawGrnItems] = await connection.query('SELECT * FROM grn_items WHERE grn_id = ?', [grnId]);
      
      // Normalize GRN items to ensure we always have an array
      let grnItemsArray;
      if (!rawGrnItems) {
        grnItemsArray = [];
      } else if (Array.isArray(rawGrnItems)) {
        grnItemsArray = rawGrnItems;
      } else {
        // If it's a single object (not an array), wrap it in an array
        grnItemsArray = [rawGrnItems];
      }
      
      debugLog(`[GRN STATUS UPDATE DEBUG] Found ${grnItemsArray.length} GRN items for processing`);
      debugLog(`[GRN Status Update] Normalized ${grnItemsArray.length} GRN items for processing`);
      
      // A. INVENTORY REVERSAL LOGIC
      if (inventoryCommittedStatuses.includes(currentStatus) && inventoryReversingNewStatuses.includes(newStatus)) {
        debugLog(`[GRN STATUS UPDATE DEBUG] ✅ ENTERING REVERSAL LOGIC - Reversing from ${currentStatus} to ${newStatus}`);
        debugLog(`[GRN Status Update] Reversing inventory for GRN ${grnNumber} from ${currentStatus} to ${newStatus}`);
        debugLog('[grnController.updateGrnStatus] GRN items for reversal:', JSON.stringify(grnItemsArray, null, 2));
        
        // CRITICAL: First validate that stock levels allow reversal
        debugLog('[Backend] GRN Reversal: Performing pre-reversal validation checks...');
        
        // Collect validation errors to report all at once
        const validationErrors = [];
        
        // Check each item to see if reversal is possible
        for (const item of grnItemsArray) {
          try {
            // Get current stock quantity — for a shared product, cost/stock
            // tracking is strictly per-store, so "current stock" here is
            // THIS GRN's own store's listing, not a tenant-wide total. See
            // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
            const [productStockResult] = await connection.query(
              'SELECT id, store_id, stock_quantity, name FROM products WHERE id = ? AND tenant_id = ?',
              [item.product_id, tenant_id]
            );

            if (!productStockResult || productStockResult.length === 0) {
              validationErrors.push(`Product ID ${item.product_id} not found - may have been deleted since GRN was created.`);
              continue;
            }

            const product = productStockResult[0];
            let currentStock = parseFloat(product.stock_quantity) || 0;
            if (product.store_id === null) {
              const [listingRows] = await connection.query(
                'SELECT stock_quantity FROM store_product_listings WHERE tenant_id = ? AND store_id = ? AND product_id = ?',
                [tenant_id, storeId, item.product_id]
              );
              currentStock = listingRows.length ? (Number(listingRows[0].stock_quantity) || 0) : 0;
            }
            const quantityToReverse = parseFloat(item.quantity_received) || 0;
            
            if (currentStock < quantityToReverse) {
              // Cannot reverse more than current stock level
              validationErrors.push(
                `Cannot reverse GRN: Product "${product.name || item.product_id}" has insufficient stock. ` +
                `Current stock: ${currentStock}, GRN quantity to reverse: ${quantityToReverse}. ` +
                `This product has likely been sold, transferred, or adjusted after this GRN was completed.`
              );
            }
          } catch (err) {
            console.error(`[ERROR] GRN Reversal validation check failed for product ${item.product_id}:`, err);
            validationErrors.push(`Error validating product ${item.product_id}: ${err.message}`);
          }
        }
        
        // If any validation issues, abort the reversal
        if (validationErrors.length > 0) {
          const errorMessage = 'Cannot reverse GRN due to the following issues:\n' + validationErrors.join('\n');
          console.error('[ERROR] GRN Reversal validation failed:', errorMessage);
          throw new Error(errorMessage);
        }
        
        debugLog('[Backend] GRN Reversal: All validation checks passed, proceeding with reversal...');

        for (const item of grnItemsArray) {
          debugLog(`[GRN Status Update] Processing reversal for product ID: ${item.product_id}`);
          
          // Get reversal quantities and costs
          const quantityToReverse = parseFloat(item.quantity_received);
          const costToReverse = parseFloat(item.unit_cost_price);

          // Branches internally on store-owned vs. tenant-shared product —
          // see storeProductListingService.reverseStock's doc comment.
          let reverseResult;
          try {
            reverseResult = await storeProductListingService.reverseStock(
              connection, tenant_id, storeId, item.product_id, quantityToReverse, costToReverse
            );
          } catch (reverseErr) {
            console.warn(`[WARNING] Product ${item.product_id} reversal failed during GRN status update: ${reverseErr.message}. Skipping inventory reversal for this product.`);
            continue; // Skip this product and continue with the next one
          }
          const { oldQtyOnHand: currentStock, newQtyOnHand: newStock, newWeightedAverageCost } = reverseResult;

          debugLog(`[Backend] GRN Reversal WAC: ${reverseResult.currentWAC} → ${newWeightedAverageCost}, Stock: ${currentStock} → ${newStock}`);
          debugLog(`[Backend] GRN Reversal: Updated product ${item.product_id}, new stock: ${newStock}, new WAC: ${newWeightedAverageCost}`);

          await connection.query('INSERT INTO inventory_logs SET ?', {
            id: uuidv4(),
            tenant_id,
            store_id: storeId,
            product_id: item.product_id,
            quantity_change: -quantityToReverse,
            current_stock_before_change: currentStock,
            current_stock_after_change: newStock,
            reason: `GRN ${grnNumber} status changed from ${currentStatus} to ${newStatus}`,
            created_by: userId,
            reference_type: 'GRN_STATUS_REVERSAL',
            reference_id: grnId,
          });

          if (item.purchase_order_item_id) {
            // Fetch PO item details, ensuring it belongs to the correct tenant by joining with purchase_orders
            const [poItemDetailsRows] = await connection.query(
              `SELECT poi.id, poi.quantity_ordered, poi.quantity_received, poi.purchase_order_id 
               FROM purchase_order_items poi
               JOIN purchase_orders po ON poi.purchase_order_id = po.id
               WHERE poi.id = ? AND po.tenant_id = ? FOR UPDATE`,
              [item.purchase_order_item_id, tenant_id]
            );
            const poItem = poItemDetailsRows && poItemDetailsRows.length > 0 ? poItemDetailsRows[0] : null;

            if (poItem) {
              const quantityToReverse = parseFloat(item.quantity_received);
              const newReceivedQty = parseFloat(poItem.quantity_received) - quantityToReverse;
              let newPoItemStatus = 'ORDERED'; // Default if all reversed
              if (newReceivedQty > 0 && newReceivedQty < parseFloat(poItem.quantity_ordered)) {
                newPoItemStatus = 'PARTIALLY_RECEIVED';
              } else if (newReceivedQty >= parseFloat(poItem.quantity_ordered)) {
                // This case (e.g. receiving more than ordered then reversing) might need specific handling if over-receiving was allowed.
                // For now, if reversal results in qty >= ordered, it's fully_received, though typically reversal implies less than fully received.
                newPoItemStatus = 'FULLY_RECEIVED'; 
              }
              // purchase_order_items table does not have tenant_id, access is validated by the SELECT query above.
              await connection.query('UPDATE purchase_order_items SET quantity_received = ?, status = ? WHERE id = ?', 
                [newReceivedQty, newPoItemStatus, poItem.id]);
            }
          }
        }
        
        debugLog(`[GRN STATUS UPDATE DEBUG] ✅ REVERSAL LOGIC COMPLETED - Updating affected POs`);
        // Update all POs affected by this GRN
        await updateAllAffectedPurchaseOrders(connection, grnId, grnItemsArray, purchaseOrderId, tenant_id, receivedDate);
        debugLog(`[GRN STATUS UPDATE DEBUG] ✅ PO STATUS UPDATES COMPLETED`);

        // Ledger — reverse the Dr Inventory / Cr AP receipt entry alongside
        // the stock de-commitment so the books never keep phantom inventory.
        await reverseGrnReceiptEntry(connection, tenant_id, grnId, grnNumber, userId);
      }
      // B. INVENTORY COMMITMENT LOGIC
      else if (nonCommittedOldStatuses.includes(currentStatus) && inventoryCommittedStatuses.includes(newStatus)) {
        debugLog(`[GRN STATUS UPDATE DEBUG] ✅ ENTERING COMMITMENT LOGIC - Committing from ${currentStatus} to ${newStatus}`);
        debugLog(`[GRN Status Update] Committing inventory for GRN ${grnNumber} from ${currentStatus} to ${newStatus}`);
        for (const item of grnItemsArray) {
          debugLog(`[GRN Status Update] Processing commitment for product ID: ${item.product_id}`);
          const quantityReceived = parseFloat(item.quantity_received);
          const unitCost = parseFloat(item.unit_cost_price);

          // Branches internally on store-owned vs. tenant-shared product —
          // see storeProductListingService.receiveStock's doc comment.
          let receiveResult;
          try {
            receiveResult = await storeProductListingService.receiveStock(
              connection, tenant_id, storeId, item.product_id, quantityReceived, unitCost,
              { receivedDate, userId }
            );
          } catch (receiveErr) {
            console.warn(`[WARNING] Product ${item.product_id} not found during GRN status update commitment: ${receiveErr.message}. Skipping inventory commitment for this product.`);
            continue; // Skip this product and continue with the next one
          }
          const { oldQtyOnHand: oldStock, newQtyOnHand: newStock } = receiveResult;

          await connection.query('INSERT INTO inventory_logs SET ?', {
            id: uuidv4(),
            tenant_id,
            store_id: storeId,
            product_id: item.product_id,
            quantity_change: quantityReceived,
            current_stock_before_change: oldStock,
            current_stock_after_change: newStock,
            reason: `GRN ${grnNumber} status changed from ${currentStatus} to ${newStatus}`,
            created_by: userId,
            reference_type: 'GRN_STATUS_COMMITMENT',
            reference_id: grnId,
          });

          if (item.purchase_order_item_id) {
            // Fetch PO item details, ensuring it belongs to the correct tenant by joining with purchase_orders
            const [poItemDetailsRows] = await connection.query(
              `SELECT poi.id, poi.quantity_ordered, poi.quantity_received, poi.purchase_order_id 
               FROM purchase_order_items poi
               JOIN purchase_orders po ON poi.purchase_order_id = po.id
               WHERE poi.id = ? AND po.tenant_id = ? FOR UPDATE`,
              [item.purchase_order_item_id, tenant_id]
            );
            const poItem = poItemDetailsRows && poItemDetailsRows.length > 0 ? poItemDetailsRows[0] : null;

            if (poItem) {
              const newReceivedQty = parseFloat(poItem.quantity_received) + quantityReceived;
              let newPoItemStatus = 'PARTIALLY_RECEIVED';
              if (newReceivedQty >= parseFloat(poItem.quantity_ordered)) {
                newPoItemStatus = 'FULLY_RECEIVED';
              }
              // purchase_order_items table does not have tenant_id, access is validated by the SELECT query above.
              await connection.query('UPDATE purchase_order_items SET quantity_received = ?, status = ? WHERE id = ?', 
                [newReceivedQty, newPoItemStatus, poItem.id]);
            }
          }
        }
        // Update all POs affected by this GRN
        await updateAllAffectedPurchaseOrders(connection, grnId, grnItemsArray, purchaseOrderId, tenant_id, receivedDate);

        // Ledger — Dr Inventory / Cr AP for the received value now that the
        // goods are committed to stock (idempotent via source key).
        await postGrnReceiptEntry(connection, tenant_id, { ...grnResult, store_id: storeId }, userId);
      } else {
        debugLog(`[GRN STATUS UPDATE DEBUG] ❌ NO LOGIC EXECUTED - Neither reversal nor commitment conditions met`);
      }

      // 2. Update GRN status
      debugLog(`[GRN STATUS UPDATE DEBUG] 🔄 UPDATING GRN STATUS in database`);
      await connection.query('UPDATE goods_received_notes SET status = ? WHERE id = ? AND tenant_id = ?', [newStatus, grnId, tenant_id]);
      debugLog(`[GRN STATUS UPDATE DEBUG] ✅ GRN STATUS UPDATED SUCCESSFULLY`);

      res.status(200).json({ message: `GRN ${grnNumber} status successfully updated to ${newStatus}.` });
      debugLog(`[GRN STATUS UPDATE DEBUG] ✅ TRANSACTION COMMITTING`);
      await connection.commit();
      debugLog(`[GRN STATUS UPDATE DEBUG] ✅ TRANSACTION COMMITTED SUCCESSFULLY`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(`Error updating GRN ${grnId} status:`, error);
    // Check if res has already been sent (e.g. by return res.status() inside transaction)
    if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to update GRN status', error: error.message });
    }
  }
};

// @desc    Delete a GRN (handles inventory reversal if committed)
// @route   DELETE /api/grn/:id
// @access  Private (to be implemented)
const deleteGrn = async (req, res) => {
  const { id: grnId } = req.params;
  const { tenant_id } = req.query; // tenant_id from query parameters
  const userId = getUserId(req); // Placeholder

  debugLog(`\n🗑️ [GRN DELETION DEBUG] ===== STARTING GRN DELETION =====`);
  debugLog(`🗑️ [GRN DELETION DEBUG] GRN ID: ${grnId}`);
  debugLog(`🗑️ [GRN DELETION DEBUG] Tenant ID: ${tenant_id}`);
  debugLog(`🗑️ [GRN DELETION DEBUG] User ID: ${userId}`);

  if (!tenant_id) {
    return res.status(400).json({ message: 'Tenant ID is required as a query parameter.' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      debugLog(`🗑️ [GRN DELETION DEBUG] Transaction started`);
      
      // 1. Fetch GRN details to check status and get necessary info for reversal
      debugLog(`🗑️ [GRN DELETION DEBUG] Step 1: Fetching GRN details...`);
      debugLog(`[GRN Delete] Attempting to delete GRN ID: ${grnId} for Tenant ID: ${tenant_id}`);
      const queryResult = await connection.query(
        'SELECT id, tenant_id, store_id, grn_number, status, received_date, purchase_order_id FROM goods_received_notes WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [grnId, tenant_id]
      );
      debugLog(`🗑️ [GRN DELETION DEBUG] GRN query result:`, JSON.stringify(queryResult, null, 2));
      // Log the raw queryResult to understand its structure
      debugLog('[GRN Delete] Raw queryResult from connection.query:', queryResult ? JSON.stringify(queryResult, null, 2) : queryResult);

      // Fix: Handle MySQL2 result structure properly - queryResult is [rows, fields]
      const [grnRows] = queryResult;
      debugLog(`🗑️ [GRN DELETION DEBUG] Extracted GRN rows:`, JSON.stringify(grnRows, null, 2));
      
      if (!grnRows || grnRows.length === 0) {
        console.error(`[GRN Delete] GRN not found. GRN ID: ${grnId}, Tenant ID: ${tenant_id}. grnRows:`, grnRows);
        const err = new Error('GRN not found or not accessible for this tenant.');
        err.statusCode = 404;
        throw err;
      }

      // Extract the first (and only) GRN record from the rows array
      const grnDetails = grnRows[0];
      debugLog(`🗑️ [GRN DELETION DEBUG] Extracted GRN details:`, JSON.stringify(grnDetails, null, 2));
      debugLog('[GRN Delete] grnDetails (grnRows[0]):', grnDetails ? JSON.stringify(grnDetails, null, 2) : grnDetails);

      // Check if grnDetails is a valid object and not empty
      if (!grnDetails || typeof grnDetails !== 'object' || Object.keys(grnDetails).length === 0) {
        console.error(`[GRN Delete] GRN data object not found, invalid, or empty. GRN ID: ${grnId}, Tenant ID: ${tenant_id}. grnDetails:`, grnDetails);
        const err = new Error('GRN not found, or its data is invalid/empty.');
        err.statusCode = 404;
        throw err;
      }

      // Destructure from the actual GRN details object
      const { status: currentStatus, store_id: storeId, grn_number: grnNumber, received_date: receivedDate, purchase_order_id: purchaseOrderId } = grnDetails;
      
      debugLog(`🗑️ [GRN DELETION DEBUG] Extracted values:`);
      debugLog(`🗑️ [GRN DELETION DEBUG]   - currentStatus: '${currentStatus}'`);
      debugLog(`🗑️ [GRN DELETION DEBUG]   - storeId: '${storeId}'`);
      debugLog(`🗑️ [GRN DELETION DEBUG]   - grnNumber: '${grnNumber}'`);
      debugLog(`🗑️ [GRN DELETION DEBUG]   - purchaseOrderId: '${purchaseOrderId}'`);
      // Using actualGrnIdFromDb can be safer for subsequent queries if needed, though grnId from params should match.

      const inventoryCommittedStatuses = ['COMPLETED', 'POSTED'];

      // 2. If GRN was in a committed state, reverse inventory changes
      debugLog(`🗑️ [GRN DELETION DEBUG] Step 2: Checking if reversal needed...`);
      debugLog(`🗑️ [GRN DELETION DEBUG] Current Status: '${currentStatus}'`);
      debugLog(`🗑️ [GRN DELETION DEBUG] Inventory Committed Statuses:`, inventoryCommittedStatuses);
      debugLog(`🗑️ [GRN DELETION DEBUG] Should reverse inventory: ${inventoryCommittedStatuses.includes(currentStatus)}`);
      
      if (inventoryCommittedStatuses.includes(currentStatus)) {
        debugLog(`🗑️ [GRN DELETION DEBUG] ✅ ENTERING REVERSAL LOGIC for status ${currentStatus}`);
        debugLog(`[GRN Delete] GRN ${grnNumber} is in status ${currentStatus}. Reversing inventory...`);
        
        debugLog(`🗑️ [GRN DELETION DEBUG] Fetching GRN items...`);
        const [rawGrnItems] = await connection.query('SELECT * FROM grn_items WHERE grn_id = ? FOR UPDATE', [grnId]);
        debugLog(`🗑️ [GRN DELETION DEBUG] Raw GRN items result:`, JSON.stringify(rawGrnItems, null, 2));
        
        // Normalize GRN items to ensure we always have an array
        let grnItemsArray;
        if (!rawGrnItems) {
          grnItemsArray = [];
        } else if (Array.isArray(rawGrnItems)) {
          grnItemsArray = rawGrnItems;
        } else {
          // If it's a single object (not an array), wrap it in an array
          grnItemsArray = [rawGrnItems];
        }
        
        debugLog(`[GRN Delete] Normalized ${grnItemsArray.length} GRN items for processing`);
        debugLog('[GRN Delete] GRN items to be processed:', JSON.stringify(grnItemsArray, null, 2));
        
        // CRITICAL: First validate that stock levels allow deletion reversal
        debugLog('[Backend] GRN Deletion: Performing pre-deletion validation checks...');
        
        // Collect validation errors to report all at once
        const validationErrors = [];
        
        // Check each item to see if deletion reversal is possible
        for (const item of grnItemsArray) {
          try {
            // Get current stock quantity — for a shared product, cost/stock
            // tracking is strictly per-store, so "current stock" here is
            // THIS GRN's own store's listing, not a tenant-wide total. See
            // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
            const [productStockResult] = await connection.query(
              'SELECT id, store_id, stock_quantity, name FROM products WHERE id = ? AND tenant_id = ?',
              [item.product_id, tenant_id]
            );

            if (!productStockResult || productStockResult.length === 0) {
              validationErrors.push(`Product ID ${item.product_id} not found - may have been deleted since GRN was created.`);
              continue;
            }

            const product = productStockResult[0];
            let currentStock = parseFloat(product.stock_quantity) || 0;
            if (product.store_id === null) {
              const [listingRows] = await connection.query(
                'SELECT stock_quantity FROM store_product_listings WHERE tenant_id = ? AND store_id = ? AND product_id = ?',
                [tenant_id, storeId, item.product_id]
              );
              currentStock = listingRows.length ? (Number(listingRows[0].stock_quantity) || 0) : 0;
            }
            const quantityToReverse = parseFloat(item.quantity_received) || 0;
            
            if (currentStock < quantityToReverse) {
              // Cannot reverse more than current stock level
              validationErrors.push(
                `Cannot delete GRN: Product "${product.name || item.product_id}" has insufficient stock. ` +
                `Current stock: ${currentStock}, GRN quantity to reverse: ${quantityToReverse}. ` +
                `This product has likely been sold, transferred, or adjusted after this GRN was completed.`
              );
            }
          } catch (err) {
            console.error(`[ERROR] GRN Deletion validation check failed for product ${item.product_id}:`, err);
            validationErrors.push(`Error validating product ${item.product_id}: ${err.message}`);
          }
        }
        
        // If any validation issues, abort the deletion
        if (validationErrors.length > 0) {
          const errorMessage = 'Cannot delete GRN due to the following issues:\n' + validationErrors.join('\n');
          console.error('[ERROR] GRN Deletion validation failed:', errorMessage);
          throw new Error(errorMessage);
        }
        
        debugLog('[Backend] GRN Deletion: All validation checks passed, proceeding with reversal...');

        for (const item of grnItemsArray) {
          // Get reversal quantities and costs
          const quantityToReverse = parseFloat(item.quantity_received);
          const costToReverse = parseFloat(item.unit_cost_price);

          // Branches internally on store-owned vs. tenant-shared product —
          // see storeProductListingService.reverseStock's doc comment.
          let reverseResult;
          try {
            reverseResult = await storeProductListingService.reverseStock(
              connection, tenant_id, storeId, item.product_id, quantityToReverse, costToReverse
            );
          } catch (reverseErr) {
            console.warn(`Product ${item.product_id} not found during GRN deletion reversal: ${reverseErr.message}. Skipping stock update for this item.`);
            continue;
          }
          const { oldQtyOnHand: currentStock, newQtyOnHand: newStock, newWeightedAverageCost } = reverseResult;

          debugLog(`[Backend] GRN Deletion Reversal WAC: ${reverseResult.currentWAC} → ${newWeightedAverageCost}, Stock: ${currentStock} → ${newStock}`);

          await connection.query('INSERT INTO inventory_logs SET ?', {
            id: uuidv4(),
            tenant_id,
            store_id: storeId, // Ensure storeId is in scope
            product_id: item.product_id,
            quantity_change: -quantityToReverse,
            current_stock_before_change: currentStock,
            current_stock_after_change: newStock,
            reason: `GRN ${grnNumber} deleted while in ${currentStatus} status`,
            created_by: userId, // Assuming userId is in scope
            reference_type: 'GRN_DELETION_REVERSAL',
            reference_id: grnId,
          });

          if (item.purchase_order_item_id && purchaseOrderId) {
            debugLog(`🗑️ [GRN DELETION DEBUG] Processing PO item update for item ${item.purchase_order_item_id}`);
            debugLog(`🗑️ [GRN DELETION DEBUG] Purchase Order ID: ${purchaseOrderId}`);
            debugLog(`🗑️ [GRN DELETION DEBUG] Quantity to reverse: ${quantityToReverse}`);
            
            // Fix: Remove tenant_id from purchase_order_items query since that table doesn't have tenant_id column
            const [poItemRows] = await connection.query(
              'SELECT id, quantity_ordered, quantity_received FROM purchase_order_items WHERE id = ? AND purchase_order_id = ? FOR UPDATE', 
              [item.purchase_order_item_id, purchaseOrderId]
            );
            debugLog(`🗑️ [GRN DELETION DEBUG] PO item query result:`, JSON.stringify(poItemRows, null, 2));
            
            const poItem = poItemRows && poItemRows.length > 0 ? poItemRows[0] : null;
            
            if (poItem) {
              debugLog(`🗑️ [GRN DELETION DEBUG] Found PO item:`, JSON.stringify(poItem, null, 2));
              
              const currentReceivedQty = parseFloat(poItem.quantity_received);
              const orderedQty = parseFloat(poItem.quantity_ordered);
              const newReceivedQty = Math.max(0, currentReceivedQty - quantityToReverse);
              
              debugLog(`🗑️ [GRN DELETION DEBUG] PO Item Quantity Calculation:`);
              debugLog(`🗑️ [GRN DELETION DEBUG]   - Current Received: ${currentReceivedQty}`);
              debugLog(`🗑️ [GRN DELETION DEBUG]   - Ordered: ${orderedQty}`);
              debugLog(`🗑️ [GRN DELETION DEBUG]   - To Reverse: ${quantityToReverse}`);
              debugLog(`🗑️ [GRN DELETION DEBUG]   - New Received: ${newReceivedQty}`);
              
              let newPoItemStatus = 'NOT_RECEIVED'; // Default when quantity becomes 0
              
              if (newReceivedQty > 0 && newReceivedQty < orderedQty) {
                newPoItemStatus = 'PARTIALLY_RECEIVED';
              } else if (newReceivedQty >= orderedQty) {
                newPoItemStatus = 'FULLY_RECEIVED';
              }
              
              debugLog(`🗑️ [GRN DELETION DEBUG] New PO Item Status: ${newPoItemStatus}`);
              
              // Fix: Remove tenant_id from purchase_order_items UPDATE since that table doesn't have tenant_id column
              await connection.query(
                'UPDATE purchase_order_items SET quantity_received = ?, status = ? WHERE id = ?', 
                [newReceivedQty, newPoItemStatus, poItem.id]
              );
              
              debugLog(`🗑️ [GRN DELETION DEBUG] ✅ PO item ${poItem.id} updated successfully`);
            } else {
              debugLog(`🗑️ [GRN DELETION DEBUG] ⚠️ PO item ${item.purchase_order_item_id} not found`);
            }
          } else {
            debugLog(`🗑️ [GRN DELETION DEBUG] Skipping PO item update - no purchase_order_item_id or purchaseOrderId`);
            debugLog(`🗑️ [GRN DELETION DEBUG]   - purchase_order_item_id: ${item.purchase_order_item_id}`);
            debugLog(`🗑️ [GRN DELETION DEBUG]   - purchaseOrderId: ${purchaseOrderId}`);
          }
        }
        
        debugLog(`🗑️ [GRN DELETION DEBUG] Step 3: Updating affected PO statuses...`);
        debugLog(`🗑️ [GRN DELETION DEBUG] Calling updateAllAffectedPurchaseOrders with:`);
        debugLog(`🗑️ [GRN DELETION DEBUG]   - grnId: ${grnId}`);
        debugLog(`🗑️ [GRN DELETION DEBUG]   - purchaseOrderId: ${purchaseOrderId}`);
        debugLog(`🗑️ [GRN DELETION DEBUG]   - tenant_id: ${tenant_id}`);
        debugLog(`🗑️ [GRN DELETION DEBUG]   - grnItemsArray length: ${grnItemsArray.length}`);
        
        // Update all POs affected by this GRN
        await updateAllAffectedPurchaseOrders(connection, grnId, grnItemsArray, purchaseOrderId, tenant_id, receivedDate);
        debugLog(`🗑️ [GRN DELETION DEBUG] ✅ PO status updates completed`);

        // Ledger — reverse the Dr Inventory / Cr AP receipt entry so a
        // deleted GRN doesn't leave phantom inventory/payable behind.
        await reverseGrnReceiptEntry(connection, tenant_id, grnId, grnNumber, userId);
      } else {
        debugLog(`🗑️ [GRN DELETION DEBUG] ⚠️ Skipping inventory reversal - GRN status '${currentStatus}' not in committed statuses`);
      }

      // 3. Delete GRN items
      debugLog(`🗑️ [GRN DELETION DEBUG] Step 4: Deleting GRN items...`);
      const deleteItemsResult = await connection.query('DELETE FROM grn_items WHERE grn_id = ?', [grnId]);
      debugLog(`🗑️ [GRN DELETION DEBUG] Delete GRN items result:`, deleteItemsResult);

      // 4. Delete GRN header
      debugLog(`🗑️ [GRN DELETION DEBUG] Step 5: Deleting GRN header...`);
      const deleteHeaderResult = await connection.query('DELETE FROM goods_received_notes WHERE id = ? AND tenant_id = ?', [grnId, tenant_id]);
      debugLog(`🗑️ [GRN DELETION DEBUG] Delete GRN header result:`, deleteHeaderResult);

      debugLog(`🗑️ [GRN DELETION DEBUG] ✅ GRN deletion completed successfully`);
      res.status(200).json({ message: `GRN ${grnNumber} and its items successfully deleted.` });
      
      debugLog(`🗑️ [GRN DELETION DEBUG] Committing transaction...`);
      await connection.commit();
      debugLog(`🗑️ [GRN DELETION DEBUG] ✅ Transaction committed successfully`);
      debugLog(`🗑️ [GRN DELETION DEBUG] ===== GRN DELETION COMPLETED =====\n`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(`Error deleting GRN ${grnId}:`, error);
    if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to delete GRN', error: error.message });
    }
  }
};

// @desc    Update an existing Goods Received Note
// @route   PUT /api/grn/:id
// @access  Private (to be implemented)
const updateGrn = async (req, res) => {
  const { id: grnId } = req.params;
  const { 
    tenant_id, // For validation, ensuring request is for the correct tenant
    store_id,
    supplier_id,
    purchase_order_id,
    received_date,
    notes,
    items, // Full new list of items if GRN is DRAFT and items are being changed
    supplier_invoice_number,
    supplier_invoice_date,
    total_tax_paid,
    shipping_handling_paid,
    other_charges_paid,
    status: newStatus // Added for status updates
  } = req.body;

  const userId = getUserId(req); // Using actual user ID from auth

  // Debug logging to identify user ID and other issues
  debugLog(`[Backend] updateGrn User ID from auth: ${userId}`);
  debugLog(`[Backend] updateGrn Request Body: ${JSON.stringify(req.body, null, 2)}`);
  debugLog(`[Backend] updateGrn Extracted Values - tenant_id: ${tenant_id}, store_id: ${store_id}, supplier_id: ${supplier_id}, purchase_order_id: ${purchase_order_id}`);
  debugLog(`[Backend] updateGrn Numeric Values - total_tax_paid: ${total_tax_paid}, shipping_handling_paid: ${shipping_handling_paid}, other_charges_paid: ${other_charges_paid}`);
  debugLog(`[Backend] updateGrn Items: ${JSON.stringify(items, null, 2)}`);

  if (!tenant_id) {
    return res.status(400).json({ message: 'Tenant ID is required in the request body.' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      debugLog(`[Backend] updateGrn Transaction START: Attempting to fetch GRN with ID: ${grnId}, Tenant ID (from req.body for query): ${tenant_id}`);
      // 1. Fetch current GRN
      const [actualGrnRowsArray] = await connection.query(
        'SELECT * FROM goods_received_notes WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [grnId, tenant_id]
      );
      debugLog(`[Backend] updateGrn Transaction: Query for GRN executed. Result actualGrnRowsArray: ${JSON.stringify(actualGrnRowsArray)}, Length: ${actualGrnRowsArray ? actualGrnRowsArray.length : 'undefined/null'}`);

      if (!actualGrnRowsArray || actualGrnRowsArray.length === 0) { // If no record is found, actualGrnRowsArray will be empty array
        const err = new Error('GRN not found or not accessible for this tenant.');
        err.statusCode = 404;
        throw err;
      }
      const existingGrn = actualGrnRowsArray[0]; // Use first row object, not the array

      // 2. Validate if GRN can be updated
      if (existingGrn.status === 'CANCELLED' || existingGrn.status === 'POSTED') {
        // Allow only minor updates for POSTED, e.g., notes, supplier invoice details if business rules permit.
        // For now, strict: no updates to POSTED or CANCELLED GRNs via this general endpoint.
        // Specific fields might be updatable via more targeted endpoints if needed.
        if (notes !== undefined || supplier_invoice_number !== undefined || supplier_invoice_date !== undefined || 
            total_tax_paid !== undefined || shipping_handling_paid !== undefined || other_charges_paid !== undefined || 
            store_id !== undefined || supplier_id !== undefined || purchase_order_id !== undefined || received_date !== undefined || items !== undefined) {
            if (existingGrn.status === 'POSTED' && 
                (notes !== undefined && notes !== existingGrn.notes) || 
                (supplier_invoice_number !== undefined && supplier_invoice_number !== existingGrn.supplier_invoice_number) || 
                (supplier_invoice_date !== undefined && supplier_invoice_date !== existingGrn.supplier_invoice_date)
                // Only allow these few fields for POSTED, and nothing else changed
                && store_id === undefined && supplier_id === undefined && purchase_order_id === undefined && received_date === undefined && items === undefined && 
                total_tax_paid === undefined && shipping_handling_paid === undefined && other_charges_paid === undefined
            ) {
                 // Allow updating notes, supplier_invoice_number, supplier_invoice_date for POSTED GRNs
            } else {
                const err = new Error(`GRN in ${existingGrn.status} status cannot be fully updated. Only limited field updates might be permissible for POSTED status.`);
                err.statusCode = 400;
                throw err;
            }
        }
      }

      // 3. Prepare updates for goods_received_notes table
      const grnUpdates = {};
      if (notes !== undefined) grnUpdates.notes = notes;
      if (supplier_invoice_number !== undefined) grnUpdates.supplier_invoice_number = supplier_invoice_number;
      if (supplier_invoice_date !== undefined) grnUpdates.supplier_invoice_date = supplier_invoice_date;
      if (total_tax_paid !== undefined) {
        const taxValue = parseFloat(total_tax_paid || 0);
        grnUpdates.total_tax_paid = isNaN(taxValue) ? '0.00' : taxValue.toFixed(2);
      }
      if (shipping_handling_paid !== undefined) {
        const shippingValue = parseFloat(shipping_handling_paid || 0);
        grnUpdates.shipping_handling_paid = isNaN(shippingValue) ? '0.00' : shippingValue.toFixed(2);
      }
      if (other_charges_paid !== undefined) {
        const otherValue = parseFloat(other_charges_paid || 0);
        grnUpdates.other_charges_paid = isNaN(otherValue) ? '0.00' : otherValue.toFixed(2);
      }
      
      // Fields updatable only if DRAFT (or potentially other non-committed statuses like 'PENDING_APPROVAL')
      if (existingGrn.status === 'DRAFT') {
        if (store_id !== undefined) grnUpdates.store_id = store_id;
        if (supplier_id !== undefined) grnUpdates.supplier_id = supplier_id || null;
        if (purchase_order_id !== undefined) grnUpdates.purchase_order_id = purchase_order_id || null;
        if (received_date !== undefined) grnUpdates.received_date = received_date;
      }
      
      // 4. Handle item updates if GRN is DRAFT and items are provided
      let newTotalReceivedValue = parseFloat(existingGrn.total_received_value);
      let poIdForStatusUpdate = existingGrn.purchase_order_id;

      if (existingGrn.status === 'DRAFT' && items && Array.isArray(items)) {
        // Delete existing items for this DRAFT GRN
        await connection.query('DELETE FROM grn_items WHERE grn_id = ?', [grnId]);
        
        newTotalReceivedValue = 0;
        for (const item of items) {
          if (!item.product_id || item.quantity_received == null || item.unit_cost_price == null || item.tax_rate == null) {
            throw new Error('Each item must have product_id, quantity_received, unit_cost_price, and tax_rate');
          }
          if (parseFloat(item.quantity_received) <= 0) {
            throw new Error(`Quantity received for product ${item.product_id} must be greater than 0.`);
          }

          const grnItemData = {
            id: uuidv4(),
            grn_id: grnId,
            product_id: item.product_id,
            purchase_order_item_id: item.purchase_order_item_id || null,
  
            quantity_received: parseFloat(item.quantity_received),
            unit_cost_price: parseFloat(item.unit_cost_price),
            tax_rate: parseFloat(item.tax_rate).toFixed(2),
            batch_number: item.batch_number || null,
            expiry_date: item.expiry_date || null,
            remarks: item.remarks || null,
          };
          await connection.query('INSERT INTO grn_items SET ?', grnItemData);
          newTotalReceivedValue += parseFloat(grnItemData.quantity_received) * parseFloat(grnItemData.unit_cost_price);
        }
        grnUpdates.total_received_value = newTotalReceivedValue.toFixed(2);
        // If PO ID was changed in this update, use the new one for status update
        if (grnUpdates.purchase_order_id !== undefined) {
            poIdForStatusUpdate = grnUpdates.purchase_order_id;
        }
      } else if (items && existingGrn.status !== 'DRAFT') {
        // If items are provided but GRN is not DRAFT, this is an invalid operation under current rules.
        throw new Error(`Cannot update items for a GRN in ${existingGrn.status} status.`);
      }

      // 5. Apply updates to GRN header if any changes were prepared
      if (Object.keys(grnUpdates).length > 0) {
        await connection.query('UPDATE goods_received_notes SET ? WHERE id = ? AND tenant_id = ?', [grnUpdates, grnId, tenant_id]);
      }

      // 6. Handle Status Change Logic (e.g., DRAFT -> COMPLETED)
      const inventoryCommittedStatuses = ['COMPLETED', 'POSTED'];
      const nonCommittedOldStatuses = ['DRAFT'];
      let grnItemsForCommitment = [];

      if (newStatus && newStatus !== existingGrn.status) {
        debugLog(`[updateGrn] Status change requested from ${existingGrn.status} to ${newStatus}`);
        if (nonCommittedOldStatuses.includes(existingGrn.status) && inventoryCommittedStatuses.includes(newStatus)) {
          debugLog(`[updateGrn] Committing inventory for GRN ${existingGrn.grn_number} due to status change: ${existingGrn.status} -> ${newStatus}`);
          
          // Determine which items to use for commitment
          if (existingGrn.status === 'DRAFT' && items && Array.isArray(items)) {
            // Items were just updated in this request, use them directly
            // Need to ensure they have the structure needed for commitment (product_id, quantity_received, unit_cost_price, purchase_order_item_id)
            grnItemsForCommitment = items.map(item => ({ ...item })); // Shallow copy, ensure all fields are present
            debugLog('[updateGrn] Using newly provided items for commitment.');
          } else {
            // Fetch existing GRN items if not provided or GRN wasn't DRAFT with item changes
            const [fetchedGrnItems] = await connection.query('SELECT * FROM grn_items WHERE grn_id = ?', [grnId]);
            grnItemsForCommitment = Array.isArray(fetchedGrnItems) ? fetchedGrnItems : (fetchedGrnItems ? [fetchedGrnItems] : []);
            debugLog('[updateGrn] Fetched existing items for commitment.');
          }

          if (grnItemsForCommitment.length === 0) {
            throw new Error('Cannot commit GRN: No items found or provided for commitment.');
          }

          const storeIdForCommit = grnUpdates.store_id || existingGrn.store_id;
          const receivedDateForCommit = grnUpdates.received_date || existingGrn.received_date;

          for (const item of grnItemsForCommitment) {
            const quantityReceived = parseFloat(item.quantity_received);
            const unitCost = parseFloat(item.unit_cost_price);

            // Branches internally on store-owned vs. tenant-shared product —
            // see storeProductListingService.receiveStock's doc comment.
            let receiveResult;
            try {
              receiveResult = await storeProductListingService.receiveStock(
                connection, tenant_id, storeIdForCommit, item.product_id, quantityReceived, unitCost,
                { receivedDate: receivedDateForCommit, userId }
              );
            } catch (receiveErr) {
              console.warn(`[WARNING][updateGrn] Product ${item.product_id} not found during GRN status update commitment: ${receiveErr.message}. Skipping inventory for this product.`);
              continue;
            }
            const { oldQtyOnHand: oldStock, newQtyOnHand: newStock } = receiveResult;

            await connection.query('INSERT INTO inventory_logs SET ?', {
              id: uuidv4(), tenant_id, store_id: storeIdForCommit, product_id: item.product_id,
              quantity_change: quantityReceived, current_stock_before_change: oldStock, current_stock_after_change: newStock,
              reason: `GRN ${existingGrn.grn_number} status changed from ${existingGrn.status} to ${newStatus} (via updateGrn)`,
              created_by: userId, reference_type: 'GRN_STATUS_COMMITMENT', reference_id: grnId,
            });

            // PO item quantity updates and status calculations will be handled by updateAllAffectedPurchaseOrders
            // This ensures consistent status logic across all GRN operations
            if (item.purchase_order_item_id) {
              debugLog(`[updateGrn] PO item ${item.purchase_order_item_id} will be updated by centralized PO status update logic`);
            }
          }
          // Update all POs affected by this GRN status change
          const finalPoIdForUpdate = grnUpdates.purchase_order_id !== undefined ? grnUpdates.purchase_order_id : existingGrn.purchase_order_id;
          if (finalPoIdForUpdate) {
             await updateAllAffectedPurchaseOrders(connection, grnId, grnItemsForCommitment, finalPoIdForUpdate, tenant_id, receivedDateForCommit);
          }
          // Ledger — Dr Inventory / Cr AP for the committed received value.
          await postGrnReceiptEntry(connection, tenant_id, {
            ...existingGrn,
            total_received_value: grnUpdates.total_received_value !== undefined
              ? grnUpdates.total_received_value : existingGrn.total_received_value,
          }, userId);
          grnUpdates.status = newStatus; // Set the new status for the GRN header update
        } else if (inventoryCommittedStatuses.includes(existingGrn.status) && nonCommittedOldStatuses.includes(newStatus)) {
          // Handle reversal if changing from COMPLETED/POSTED to DRAFT (Simplified: log and suggest using updateGrnStatus for full reversal)
          console.warn(`[updateGrn] Reversal from ${existingGrn.status} to ${newStatus} requested. Full reversal logic (like in updateGrnStatus) is not implemented here. Only updating status field.`);
          // For a full reversal, the frontend should ideally call PATCH /api/grn/:id/status
          grnUpdates.status = newStatus;
        } else {
          // Other status changes (e.g., COMPLETED to POSTED, or custom flows)
          // For now, just update the status field if it's a valid transition not handled above.
          // More complex validation might be needed here based on business rules.
          debugLog(`[updateGrn] Applying general status update from ${existingGrn.status} to ${newStatus}`);
          grnUpdates.status = newStatus;
        }
      } else if (newStatus && newStatus === existingGrn.status) {
        debugLog('[updateGrn] Requested status is the same as current status. No status change action needed.');
      }

      // 7. Apply updates to GRN header if any changes were prepared
      if (Object.keys(grnUpdates).length > 0) {
        await connection.query('UPDATE goods_received_notes SET ? WHERE id = ? AND tenant_id = ?', [grnUpdates, grnId, tenant_id]);
      }

      res.status(200).json({ message: `GRN ${existingGrn.grn_number} successfully updated.` });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    // Attempt to get tenant_id from req.body if available, for logging purposes
    const tenantIdForLog = req.body.tenant_id || 'unknown'; 
    console.error(`[Backend] updateGrn Error updating GRN ${grnId} for tenant ${tenantIdForLog}: ${error.message}`, error.stack);
    const statusCode = error.statusCode || 500;
    if (!res.headersSent) {
      res.status(statusCode).json({ message: error.message || 'Failed to update GRN.' });
    }
  }
};

module.exports = {
  createGrn,
  getGrns,
  getGrnById,
  updateGrnStatus,
  deleteGrn,
  updateGrn
};
