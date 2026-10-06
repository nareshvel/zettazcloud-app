const express = require('express');
const router = express.Router();
const promotionalOfferController = require('../controllers/promotionalOfferController');
const { authenticate, authorize, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all active promotional offers
// Get all promotional offers
router.get('/', promotionalOfferController.getAllOffers);

// Get all active promotional offers
router.get('/active', promotionalOfferController.getActiveOffers);

// Create a new promotional offer
router.post('/', promotionalOfferController.createOffer);

// Get a specific promotional offer by ID
router.get('/:id', promotionalOfferController.getOfferById);

// Update a specific promotional offer
router.put('/:id', promotionalOfferController.updateOffer);

// Delete a specific promotional offer
router.delete('/:id', promotionalOfferController.deleteOffer);

module.exports = router;
