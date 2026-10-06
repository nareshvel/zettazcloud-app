/**
 * Sale Deletion Controller
 * Handles API endpoints for sale deletion functionality
 */

const SaleDeletionService = require('../services/saleDeletionService');
const { getConnectionWithTimeZone } = require('../config/db');

/**
 * Get sale deletion preview
 * Shows what will be deleted and validation results
 */
const getSaleDeletionPreview = async (req, res) => {
  try {
    const { saleId } = req.params;
    const { tenant_id: tenantId } = req.user;

    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: 'Sale ID is required'
      });
    }

    const preview = await SaleDeletionService.getSaleDeletionPreview(saleId, tenantId);

    res.json({
      success: true,
      data: preview
    });

  } catch (error) {
    console.error('Error getting sale deletion preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sale deletion preview',
      error: error.message
    });
  }
};

/**
 * Delete a sale
 * Performs comprehensive sale deletion with rollback handling
 */
const deleteSale = async (req, res) => {
  try {
    const { saleId } = req.params;
    const { tenant_id: tenantId, id: userId } = req.user;
    const { reason, forceDelete = false } = req.body;

    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: 'Sale ID is required'
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Deletion reason is required (minimum 10 characters)'
      });
    }

    // Get client info for audit logging
    const options = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      reason: reason.trim(),
      forceDelete
    };

    const result = await SaleDeletionService.deleteSale(saleId, tenantId, userId, options);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to delete sale',
        data: result
      });
    }

    res.json({
      success: true,
      message: 'Sale deleted successfully',
      data: {
        saleId: result.saleId,
        deletedRecords: result.deletedRecords,
        inventoryRollback: result.inventoryRollback,
        auditLogId: result.auditLog
      }
    });

  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sale',
      error: error.message
    });
  }
};

/**
 * Validate sale deletion
 * Checks if a sale can be deleted without actually deleting it
 */
const validateSaleDeletion = async (req, res) => {
  const connection = await getConnectionWithTimeZone(req.storeTz);
  
  try {
    const { saleId } = req.params;
    const { tenant_id: tenantId } = req.user;

    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: 'Sale ID is required'
      });
    }

    const validation = await SaleDeletionService.validateSaleDeletion(saleId, tenantId, connection);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('Error validating sale deletion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate sale deletion',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getSaleDeletionPreview,
  deleteSale,
  validateSaleDeletion
};
