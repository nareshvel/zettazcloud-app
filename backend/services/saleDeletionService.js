/**
 * Sale Deletion Service
 * Handles comprehensive sale deletion with proper database impact analysis
 * and rollback capabilities for inventory, payments, and related records
 */

const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const storeProductListingService = require('./storeProductListingService');
const moneyPosting = require('./moneyPostingService');

class SaleDeletionService {
  /**
   * Database tables affected by sale deletion (in deletion order)
   */
  static AFFECTED_TABLES = {
    // Direct sale dependencies (delete first)
    sale_item_discounts: 'sale_id',
    payment_gateway_transactions: 'sale_id', 
    payment_terminal_transactions: 'sale_id',
    sale_items: 'sale_id',
    
    // Sales returns (check for existing returns)
    sales_return_items: 'original_sale_item_id', // References sale_items
    sales_returns: 'original_sale_id',
    
    // Inventory logs (for rollback data)
    inventory_logs: 'reference_id', // May reference sale_id
    
    // Main sale record (delete last)
    sales: 'id'
  };

  /**
   * Validate if a sale can be deleted
   * @param {string} saleId - Sale ID to validate
   * @param {string} tenantId - Tenant ID for security
   * @param {Object} connection - Database connection
   * @returns {Promise<Object>} validation result
   */
  static async validateSaleDeletion(saleId, tenantId, connection) {
    const validation = {
      canDelete: false,
      reasons: [],
      warnings: [],
      saleData: null,
      relatedData: {}
    };

    try {
      // 1. Check if sale exists and belongs to tenant
      const [saleRows] = await connection.execute(
        'SELECT * FROM sales WHERE id = ? AND tenant_id = ?',
        [saleId, tenantId]
      );

      if (saleRows.length === 0) {
        validation.reasons.push('Sale not found or access denied');
        return validation;
      }

      validation.saleData = saleRows[0];

      // 2. Check for existing sales returns
      const [returnsRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM sales_returns WHERE original_sale_id = ?',
        [saleId]
      );

      if (returnsRows[0].count > 0) {
        validation.reasons.push(`Sale has ${returnsRows[0].count} associated return(s)`);
      }

      // 3. Check sale age (prevent deletion of old sales)
      const saleDate = new Date(validation.saleData.transaction_date || validation.saleData.created_at);
      const daysSinceSale = Math.floor((Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceSale > 30) {
        validation.warnings.push(`Sale is ${daysSinceSale} days old - consider creating a return instead`);
      }

      // 4. Check for payment gateway transactions
      const [paymentRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM payment_gateway_transactions WHERE sale_id = ?',
        [saleId]
      );

      if (paymentRows[0].count > 0) {
        validation.warnings.push(`Sale has ${paymentRows[0].count} payment gateway transaction(s) - these will be deleted`);
      }

      // 5. Get sale items for inventory impact analysis
      const [saleItemsRows] = await connection.execute(`
        SELECT si.*, p.name as product_name, p.stock_quantity as current_stock, p.store_id as product_store_id
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `, [saleId]);

      validation.relatedData.saleItems = saleItemsRows;

      // 6. Check if sale is already voided/cancelled
      if (validation.saleData.status === 'voided' || validation.saleData.status === 'cancelled') {
        validation.warnings.push('Sale is already voided/cancelled');
      }

      // 7. Determine if deletion is allowed
      validation.canDelete = validation.reasons.length === 0;

      return validation;

    } catch (error) {
      console.error('Error validating sale deletion:', error);
      validation.reasons.push('Database error during validation');
      return validation;
    }
  }

  /**
   * Delete a sale with comprehensive rollback handling
   * @param {string} saleId - Sale ID to delete
   * @param {string} tenantId - Tenant ID for security
   * @param {string} userId - User performing the deletion
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} deletion result
   */
  static async deleteSale(saleId, tenantId, userId, options = {}) {
    const connection = await pool.getConnection();
    const result = {
      success: false,
      saleId,
      deletedRecords: {},
      inventoryRollback: [],
      journalReversal: null,
      auditLog: null,
      error: null
    };

    try {
      await connection.beginTransaction();

      // 1. Validate deletion
      const validation = await this.validateSaleDeletion(saleId, tenantId, connection);
      
      if (!validation.canDelete) {
        throw new Error(`Cannot delete sale: ${validation.reasons.join(', ')}`);
      }

      const saleData = validation.saleData;
      const saleItems = validation.relatedData.saleItems;

      // 2. Create audit log entry before deletion
      const auditLogId = uuidv4();
      await connection.execute(`
        INSERT INTO user_activity_logs (
          id, tenant_id, user_id, action_type, description, details, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        auditLogId,
        tenantId,
        userId,
        'DELETE_SALE',
        `Deleted sale ${saleId}`,
        JSON.stringify({
          saleId,
          saleData,
          deletedAt: new Date().toISOString()
        }),
        options.ipAddress || null,
        options.userAgent || null
      ]);

      result.auditLog = auditLogId;

      // 3. Rollback inventory for each sale item
      for (const item of saleItems) {
        const isSharedProduct = item.product_store_id === null;

        let currentStockForItem = item.current_stock;
        let newStockQuantity;
        if (isSharedProduct) {
          // Shared product — its stock lives per-store in
          // store_product_listings, not on the products row. Use the sale's
          // own store_id to find the right listing. See
          // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
          const listing = await storeProductListingService.getListing(tenantId, saleData.store_id, item.product_id);
          currentStockForItem = listing ? listing.stock_quantity : 0;
          newStockQuantity = currentStockForItem + item.quantity;
          await connection.execute(
            `INSERT INTO store_product_listings (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
             VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
             ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)`,
            [uuidv4(), tenantId, saleData.store_id, item.product_id, newStockQuantity]
          );
        } else {
          newStockQuantity = currentStockForItem + item.quantity;
          await connection.execute(
            'UPDATE products SET stock_quantity = ? WHERE id = ?',
            [newStockQuantity, item.product_id]
          );
        }

        // Create inventory log for the rollback
        const inventoryLogId = uuidv4();
        await connection.execute(`
          INSERT INTO inventory_logs (
            id, tenant_id, product_id, quantity_change, reference_type, reference_id,
            reason, current_stock_before_change, current_stock_after_change, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          inventoryLogId,
          tenantId,
          item.product_id,
          item.quantity,
          'SALE_DELETION',
          saleId,
          `Inventory rollback for deleted sale ${saleId}`,
          currentStockForItem,
          newStockQuantity,
          userId
        ]);

        result.inventoryRollback.push({
          productId: item.product_id,
          productName: item.product_name,
          quantityRestored: item.quantity,
          previousStock: currentStockForItem,
          newStock: newStockQuantity,
          logId: inventoryLogId
        });
      }

      // 4. Delete related records in proper order
      const deletionOrder = [
        'sale_item_discounts',
        'payment_gateway_transactions',
        'payment_terminal_transactions',
        'sale_items',
        'sales'
      ];

      for (const tableName of deletionOrder) {
        const foreignKeyColumn = this.AFFECTED_TABLES[tableName];
        
        try {
          // Get count before deletion for reporting
          const [countRows] = await connection.execute(
            `SELECT COUNT(*) as count FROM ${tableName} WHERE ${foreignKeyColumn} = ?`,
            [saleId]
          );

          const recordCount = countRows[0].count;

          if (recordCount > 0) {
            // Delete the records
            const [deleteResult] = await connection.execute(
              `DELETE FROM ${tableName} WHERE ${foreignKeyColumn} = ?`,
              [saleId]
            );

            result.deletedRecords[tableName] = {
              count: recordCount,
              affectedRows: deleteResult.affectedRows
            };

            console.log(`✅ Deleted ${deleteResult.affectedRows} records from ${tableName}`);
          }
        } catch (tableError) {
          // Handle missing tables gracefully
          if (tableError.code === 'ER_NO_SUCH_TABLE') {
            console.warn(`Table ${tableName} does not exist, skipping deletion`);
            result.deletedRecords[tableName] = {
              count: 0,
              affectedRows: 0
            };
          } else {
            throw tableError;
          }
        }
      }

      // 4b. Reverse the sale's posted journal entry (Phase-2 auto-post leaves
      // Dr tender / Cr revenue / Cr tax standing). Never skip this — a
      // deleted sale whose entry stays posted overstates cash and revenue.
      // money_journal_entries may not exist on an unmigrated DB — skip
      // gracefully there, rollback on any other ledger error.
      try {
        const [jeRows] = await connection.execute(
          `SELECT id FROM money_journal_entries
            WHERE tenant_id = ? AND source_type = 'sale' AND source_id = ?
              AND status = 'posted'
            LIMIT 1`,
          [tenantId, saleId]
        );
        if (jeRows.length) {
          const reversal = await moneyPosting.reverseEntry(jeRows[0].id, {
            tenantId,
            memo: `Sale deleted (${saleId})`,
            createdBy: userId,
          }, connection);
          result.journalReversal = reversal.entryNumber;
        }
      } catch (ledgerErr) {
        if (ledgerErr.code === 'ER_NO_SUCH_TABLE') {
          console.warn('money_journal_entries missing — skipping sale journal reversal');
        } else {
          throw ledgerErr;
        }
      }

      // 5. Verify sale is completely deleted
      const [verifyRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM sales WHERE id = ?',
        [saleId]
      );

      if (verifyRows[0].count > 0) {
        throw new Error('Sale deletion verification failed - sale still exists');
      }

      await connection.commit();
      result.success = true;

      console.log(`✅ Successfully deleted sale ${saleId} with all related records`);
      return result;

    } catch (error) {
      await connection.rollback();
      result.error = error.message;
      console.error(`❌ Error deleting sale ${saleId}:`, error);
      return result;
    } finally {
      connection.release();
    }
  }

  /**
   * Get sale deletion preview (what will be deleted)
   * @param {string} saleId - Sale ID to preview
   * @param {string} tenantId - Tenant ID for security
   * @returns {Promise<Object>} deletion preview
   */
  static async getSaleDeletionPreview(saleId, tenantId) {
    const connection = await pool.getConnection();

    try {
      const preview = {
        saleData: null,
        affectedRecords: {},
        inventoryImpact: [],
        validation: null
      };

      // Validate first
      preview.validation = await this.validateSaleDeletion(saleId, tenantId, connection);
      
      if (!preview.validation.saleData) {
        return preview;
      }

      preview.saleData = preview.validation.saleData;

      // Count affected records in each table
      for (const [tableName, foreignKeyColumn] of Object.entries(this.AFFECTED_TABLES)) {
        try {
          if (tableName === 'sales_return_items') {
            // Special case: check via sale_items
            const [countRows] = await connection.execute(`
              SELECT COUNT(sri.id) as count 
              FROM sales_return_items sri
              JOIN sale_items si ON sri.original_sale_item_id = si.id
              WHERE si.sale_id = ?
            `, [saleId]);
            preview.affectedRecords[tableName] = countRows[0].count;
          } else {
            const [countRows] = await connection.execute(
              `SELECT COUNT(*) as count FROM ${tableName} WHERE ${foreignKeyColumn} = ?`,
              [saleId]
            );
            preview.affectedRecords[tableName] = countRows[0].count;
          }
        } catch (tableError) {
          // Handle missing tables gracefully
          if (tableError.code === 'ER_NO_SUCH_TABLE') {
            console.warn(`Table ${tableName} does not exist, skipping count check`);
            preview.affectedRecords[tableName] = 0;
          } else {
            throw tableError;
          }
        }
      }

      // Get inventory impact details. For a shared product, the "current
      // stock" is this sale's store's listing, not the products row.
      preview.inventoryImpact = await Promise.all(
        preview.validation.relatedData.saleItems.map(async (item) => {
          let currentStock = item.current_stock;
          if (item.product_store_id === null) {
            const listing = await storeProductListingService.getListing(
              tenantId, preview.saleData.store_id, item.product_id
            );
            currentStock = listing ? listing.stock_quantity : 0;
          }
          return {
            productId: item.product_id,
            productName: item.product_name,
            quantityToRestore: item.quantity,
            currentStock,
            newStock: currentStock + item.quantity
          };
        })
      );

      return preview;

    } catch (error) {
      console.error('Error getting sale deletion preview:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = SaleDeletionService;
