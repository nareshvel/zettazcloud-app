const express = require('express');
const router = express.Router();
const { authenticate, authorize, requireTenantId, requireStoreId, hasPermission } = require('../middleware/unifiedAuthMiddleware');
const {
  getTaxClasses,
  createTaxClass,
  updateTaxClass,
  deleteTaxClass,
  getTaxRatesForClass,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  setStoreDefaultTaxClass,
  getStoreTaxConfig,
  updateProductTaxClass,
  getProductTaxClass
} = require('../controllers/taxSettingsController');

// All routes here are protected and require a user to be logged in.
router.use(authenticate);
// Ensure tenant context is present for all routes in this module
router.use(requireTenantId);

// Tax Class Routes
// Require store context for class listing/creation (store default depends on store)
router.route('/classes')
  .get(requireStoreId, hasPermission(['tax.view','settings.view']), getTaxClasses)
  .post(requireStoreId, hasPermission(['tax.create','tax.edit','settings.edit']), createTaxClass);

router.route('/classes/:id')
  .put(requireStoreId, hasPermission(['tax.edit','settings.edit']), updateTaxClass)
  .delete(requireStoreId, hasPermission(['tax.delete','settings.edit']), deleteTaxClass);

// Tax Rate Routes (nested under a tax class)
router.route('/classes/:taxClassId/rates')
  .get(requireStoreId, hasPermission(['tax.view','settings.view']), getTaxRatesForClass)
  .post(requireStoreId, hasPermission(['tax.create','tax.edit','settings.edit']), createTaxRate);

router.route('/rates/:rateId')
  .put(requireStoreId, hasPermission(['tax.edit','settings.edit']), updateTaxRate)
  .delete(requireStoreId, hasPermission(['tax.delete','settings.edit']), deleteTaxRate);

// Route to set the default tax class for a store
router.route('/store-default')
  .put(requireStoreId, hasPermission(['tax.edit','settings.edit']), setStoreDefaultTaxClass);

// Route to get complete tax configuration for a store
router.route('/store-config')
  .get(requireStoreId, hasPermission(['tax.view','settings.view']), getStoreTaxConfig);

// Routes for product tax class management
router.route('/product-tax-class')
  .put(requireStoreId, hasPermission(['tax.edit','products.edit']), updateProductTaxClass);

router.route('/product/:productId')
  .get(requireStoreId, hasPermission(['tax.view','products.view']), getProductTaxClass);

module.exports = router;
