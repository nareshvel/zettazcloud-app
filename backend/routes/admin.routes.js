/**
 * Admin Routes - Provisioning
 * POST /api/admin/tenants/:tenantId/provision
 */
const express = require('express');
const router = express.Router();

const { hasPermission } = require('../middleware/permissionMiddleware');
const { authenticate } = require('../middleware/unifiedAuthMiddleware');
const TenantProvisioningService = require('../services/tenantProvisioningService');

// Helper to set tenant context for system-level permission checks
const setTenantContext = (req, _res, next) => {
  try {
    const { tenantId } = req.params || {};
    if (tenantId) {
      req.tenantId = tenantId;
      req.user = req.user || {};
      // Permission middleware looks at req.user.tenant_id/tenantId for system-level checks
      req.user.tenant_id = tenantId;
      req.user.tenantId = tenantId;
    }
  } catch (_) {}
  next();
};

// Admin-only: Provision tenant deterministically
router.post('/tenants/:tenantId/provision', authenticate, setTenantContext, hasPermission('tenants.edit', { skipAdminBypass: true }), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const requestedBy = req.user?.id || req.userId || 'system';

    const result = await TenantProvisioningService.provisionTenant(tenantId, { requestedBy });
    res.json({ success: true, message: 'Tenant provisioned successfully', data: result });
  } catch (error) {
    console.error('Provisioning error:', error);
    res.status(500).json({ success: false, message: 'Failed to provision tenant', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error' });
  }
});

module.exports = router;
