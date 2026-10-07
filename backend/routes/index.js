/**
 * Main API Routes
 * Registers all API routes for the application
 */
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const permissionRoutes = require('./permissionRoutes');
const roleRoutes = require('./roleRoutes');
// userRoleRoutes removed — the file was dead code: it referenced an unimported
// userRoleService, called methods that don't exist, and its self-check
// (`userId === req.user?.id || "system"`) evaluated truthy for every caller.
// Real assignment endpoints live in userRoutes (/users/:id/roles).
const subscriptionRoutes = require('./subscriptionRoutes');
const userRoutes = require('./userRoutes');
const testRoutes = require('./testRoutes');
const adminRoutes = require('./admin.routes');

// Payment integration routes
const paymentTerminalRoutes = require('./paymentTerminalRoutes');
const paymentGatewayRoutes = require('./paymentGatewayRoutes');
const paymentWebhookRoutes = require('./paymentWebhookRoutes');

// Tax routes
const taxRoutes = require('./tax.routes');
const taxSettingsRoutes = require('./taxSettingsRoutes');

// Supplier routes
const supplierRoutes = require('./supplier.routes');

// Migration routes (for critical fixes)
const migrationRoutes = require('./migration.routes');

// Core business routes
const categoryRoutes = require('./category.routes');
const customerRoutes = require('./customer.routes');
const productRoutes = require('./product.routes');
const grnRoutes = require('./grnRoutes');
const salesRoutes = require('./sales.routes');
const storeRoutes = require('./store.routes');
const promotionalOfferRoutes = require('./promotionalOfferRoutes');
const reportsRoutes = require('./reports.routes');
// Printer settings routes
const printerSettingsRoutes = require('./printerSettings.routes');
const printerDevicesRoutes = require('./printerDevices.routes');
const printJobsRoutes = require('./printJobs.routes');
const printTemplatesRoutes = require('./printTemplates.routes');
const printTestsRoutes = require('./printTests.routes');
const printAgentRoutes = require('./printAgent.routes');
const printAgentConnectRoutes = require('./printAgentConnect.routes');

// Register routes
router.use('/auth', authRoutes);
router.use('/permissions', permissionRoutes);
router.use('/roles', roleRoutes);

router.use('/subscriptions', subscriptionRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

// Payment integration routes
const paymentRoutes = require('./payment.routes');
router.use('/payment', paymentRoutes);
router.use('/payment-terminals', paymentTerminalRoutes);
router.use('/payment-gateways', paymentGatewayRoutes);
router.use('/webhooks/payment', paymentWebhookRoutes);

// Tax routes
router.use('/taxes', taxRoutes);
router.use('/v1/settings/taxes', taxSettingsRoutes);

// Supplier routes
router.use('/suppliers', supplierRoutes);

// Migration routes (for critical fixes)
router.use('/migration', migrationRoutes);

// Core business routes
router.use('/categories', categoryRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/grn', grnRoutes);
router.use('/sales', salesRoutes);
router.use('/stores', storeRoutes);
// NOTE: purchase-orders is NOT mounted here — it's mounted in server.js with
// `authenticate` + `requireTenantId` middleware. Mounting it here without
// those would expose tenant-scoped PO data to unauthenticated callers
// (caught by tests/routeAuthGuard.test.js).
router.use('/promotional-offers', promotionalOfferRoutes);
router.use('/reports', reportsRoutes);
// Settings routes (printer settings, receipt templates)
router.use('/settings', printerSettingsRoutes);
// Printer device registry (security hardening)
router.use('/printer-devices', printerDevicesRoutes);
// Print job management
router.use('/print-jobs', printJobsRoutes);
// Print template management
router.use('/print-templates', printTemplatesRoutes);
// NOTE: /duty-free-profiles was removed 2026-08-25. Duty-free is now expressed
// as store_jurisdiction_settings.sales_mode (is this store duty-free?) plus
// jurisdiction_profiles (what does the country require?) plus print_templates
// blocks (what appears on the document). See
// database/migrations/applied/2026-08-25_drop_duty_free_profiles.sql
// Print certification and QA test endpoints
router.use('/print-tests', printTestsRoutes);
// Print Agent fleet management (settings CRUD)
router.use('/print-agents', printAgentRoutes);
// Print Agent public connect endpoints (enrollment, heartbeat, configuration)
router.use('/print-agent-connect', printAgentConnectRoutes);

// Industry field-config + cost-code settings routes
const industryRoutes = require('./industry.routes');
router.use('/industry', industryRoutes);

// Tenant (business) profile routes
const tenantsRoutes = require('./tenants.routes');
router.use('/tenants', tenantsRoutes);

// Platform admin console (system roles only — see platformService)
const platformRoutes = require('./platform.routes');
router.use('/platform', platformRoutes);

// Tenant-facing support tickets + announcements
const supportRoutes = require('./support.routes');
router.use('/support', supportRoutes);

// Employee module (performance, targets, incentives, Paytime integration)
const employeesRoutes = require('./employees.routes');
router.use('/employees', employeesRoutes);

// Repair / custom-order management (jewelry)
const repairsRoutes = require('./repairs.routes');
router.use('/repairs', repairsRoutes);

// Old-gold / metal exchange (jewelry)
const oldGoldRoutes = require('./oldGold.routes');
router.use('/old-gold', oldGoldRoutes);

// Serialized (per-piece) inventory
const productPiecesRoutes = require('./productPieces.routes');
router.use('/product-pieces', productPiecesRoutes);

// Bulk stock count / reconciliation (quantity-based products, all verticals)
router.use('/stock-counts', require('./stockCount.routes'));
// Finance — expenses + outgoing payments (finance.view / finance.manage)
router.use('/finance', require('./finance.routes'));

// Memo / consignment ledgers
router.use('/memos', require('./memo.routes'));

// Layaway / installment plans
router.use('/layaways', require('./layaway.routes'));

// Attachments (certificates, photos, documents)
router.use('/attachments', require('./attachments.routes'));

// Metal rates + weight-based pricing (jewelry, opt-in)
router.use('/metal-rates', require('./metalRates.routes'));

// Jurisdiction profiles — per-country tax/invoice/fiscal rules and sales mode
// (domestic / duty-free / export). Consumed by tax calculation and print templates.
router.use('/jurisdiction', require('./jurisdiction.routes'));

// Retail profile — business type + duty-free, and the template plan they imply
router.use('/retail-profile', require('./retailProfile.routes'));

// Customer savings / instalment schemes (jewelry)
router.use('/savings-schemes', require('./savingsSchemes.routes'));

// Catalog sync / e-commerce channels
router.use('/catalog', require('./catalogSync.routes'));

// Jewelry-specific reports
router.use('/jewelry-reports', require('./jewelryReports.routes'));

// Label / tag printing (piece tags, product shelf labels)
router.use('/labels', require('./labels.routes'));

// CRM: wishlists, birthday/anniversary reminders
router.use('/crm', require('./crm.routes'));

// Self-service session list/revocation (part of /api/users/me/sessions)
router.use('/users/me/sessions', require('./userSessions.routes'));

// Self-service notification preferences (part of /api/users/me/notification-preferences)
router.use('/users/me/notification-preferences', require('./notificationPreferences.routes'));

// Self-service TOTP two-factor auth (part of /api/users/me/2fa)
router.use('/users/me/2fa', require('./twoFactor.routes'));

// Test routes (temporary - for debugging)
if (process.env.NODE_ENV !== 'production') {
  router.use('/test', testRoutes);
}

module.exports = router;
