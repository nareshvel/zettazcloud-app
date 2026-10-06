/**
 * requireIndustry middleware
 * -----------------------------------------------------------------------------
 * Hard-gates vertical-specific APIs (e.g. old-gold, repairs) so a tenant in a
 * different industry cannot reach them even by calling the endpoint directly.
 * Mirrors the UX-level gating done in the sidebar.
 *
 * Usage:
 *   const requireIndustry = require('../middleware/requireIndustry');
 *   router.use(requireIndustry(['jewelry']));
 *
 * Fails open only when the tenant's industry cannot be determined at all
 * (missing column / DB hiccup) so a transient error never bricks a module;
 * a resolved-but-mismatched industry always returns 403.
 */

'use strict';

const industryFieldService = require('../services/industryFieldService');

function requireIndustry(allowed = []) {
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];

  return async function industryGate(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(403).json({ status: 'error', message: 'Tenant context required.' });
      }

      const industry = await industryFieldService.getTenantIndustry(tenantId);
      if (!industry) return next(); // could not resolve — fail open

      if (!allowedList.includes(industry)) {
        return res.status(403).json({
          status: 'error',
          code: 'INDUSTRY_NOT_ENABLED',
          message: `This feature is not available for your business type (${industry}).`,
          requiredIndustries: allowedList,
        });
      }
      return next();
    } catch (err) {
      console.warn('[requireIndustry] could not resolve industry, allowing request:', err.message);
      return next(); // fail open on unexpected errors
    }
  };
}

module.exports = requireIndustry;
