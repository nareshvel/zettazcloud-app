const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Public routes that don't require authentication
router.get('/promotional-offers/active', publicController.getActivePromotionalOffers);

module.exports = router;
