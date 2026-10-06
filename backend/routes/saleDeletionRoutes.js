/**
 * Sale Deletion Routes
 * API endpoints for sale deletion functionality
 */

const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { 
  getSaleDeletionPreview, 
  deleteSale, 
  validateSaleDeletion 
} = require('../controllers/saleDeletionController');

// Get sale deletion preview
router.get('/preview/:saleId', 
  requirePermission('sales.delete'), 
  getSaleDeletionPreview
);

// Validate sale deletion
router.get('/validate/:saleId', 
  requirePermission('sales.delete'), 
  validateSaleDeletion
);

// Delete sale
router.delete('/:saleId', 
  requirePermission('sales.delete'), 
  deleteSale
);

module.exports = router;
