const express = require('express');
const router = express.Router();
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const {
  getPrinterSettings,
  updatePrinterSettings,
  testPrintSettings,
} = require('../controllers/printerSettingsController');
const {
  getPrintDocumentSettings,
  updatePrintDocumentSetting,
  updateAllPrintDocumentSettings,
  updateDefaultSaleDocumentType,
} = require('../controllers/printDocumentSettingsController');

// All routes will use specific permissions

// Printer settings routes
// DEPRECATED (Print Module Phase 1): kept only for the rollback window while
// print_routes is verified in production. New code should use print-routes
// below. See docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md.
router.get('/printer/:storeId', requirePermission('printer.view'), getPrinterSettings);
router.put('/printer/:storeId', requirePermission('settings.printer'), updatePrinterSettings);
router.post('/printer/:storeId/test', requirePermission('settings.printer'), testPrintSettings);

// Print document settings — store-level config per document type (receipt, invoice).
// Table is `print_document_settings`, deliberately NOT `print_routes` — see
// that migration file's header for why (a dormant, unrelated print_routes
// table already exists in this database).
router.get('/print-document-settings/:storeId', requirePermission('printer.view'), getPrintDocumentSettings);
router.put('/print-document-settings/:storeId', requirePermission('settings.printer'), updateAllPrintDocumentSettings);
router.put('/print-document-settings/:storeId/default-format', requirePermission('settings.printer'), updateDefaultSaleDocumentType);
router.put('/print-document-settings/:storeId/:documentType', requirePermission('settings.printer'), updatePrintDocumentSetting);

// REMOVED 2026-08-25 (Print Module Phase 1): the /receipt-templates CRUD
// endpoints backed a `receipt_templates` table nothing ever wrote rows into
// — it only ever surfaced "Default Template" in the UI. The real template
// store is print_templates (see /api/print-templates), already used by the
// Print Template Designer. Do not re-add these routes; use
// GET /print-templates?template_type=receipt instead.

module.exports = router;
