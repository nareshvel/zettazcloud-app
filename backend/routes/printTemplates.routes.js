/**
 * Print Template Routes
 * Manages print templates with versioning and publishing
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const printTemplateService = require('../services/printTemplateService');
const logger = require('../utils/logger');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(requireTenantId);

/**
 * GET /api/print-templates
 * List templates for tenant/store with filters
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.query.store_id || req.user?.store_id;

    const filters = {
      template_type: req.query.template_type,
      is_published: req.query.is_published,
      is_default: req.query.is_default
    };

    const templates = await printTemplateService.listTemplates(tenantId, storeId, filters);

    res.json({
      status: 'success',
      data: templates
    });
  } catch (error) {
    logger.error('Error listing print templates:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/print-templates/:id
 * Get a specific template
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const template = await printTemplateService.getTemplate(req.params.id, tenantId);

    if (!template) {
      return res.status(404).json({
        status: 'error',
        message: 'Print template not found'
      });
    }

    res.json({
      status: 'success',
      data: template
    });
  } catch (error) {
    logger.error('Error getting print template:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/print-templates/:id/versions
 * Get template version history
 */
router.get('/:id/versions', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const versions = await printTemplateService.getTemplateVersions(req.params.id, tenantId);

    res.json({
      status: 'success',
      data: versions
    });
  } catch (error) {
    logger.error('Error getting template versions:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/print-templates
 * Create a new template
 */
router.post('/', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.body.store_id || req.user?.store_id;
    const userId = req.user?.id;

    const template = await printTemplateService.createTemplate({
      tenant_id: tenantId,
      store_id: storeId,
      name: req.body.name,
      template_type: req.body.template_type,
      document_subtype: req.body.document_subtype,
      blocks: req.body.blocks,
      styles: req.body.styles,
      layout_config: req.body.layout_config,
      created_by: userId
    });

    res.status(201).json({
      status: 'success',
      message: 'Print template created successfully',
      data: template
    });
  } catch (error) {
    logger.error('Error creating print template:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * PUT /api/print-templates/:id
 * Update a template
 */
router.put('/:id', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const userId = req.user?.id;

    const template = await printTemplateService.updateTemplate(
      req.params.id,
      tenantId,
      req.body,
      userId
    );

    res.json({
      status: 'success',
      message: 'Print template updated successfully',
      data: template
    });
  } catch (error) {
    logger.error('Error updating print template:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/print-templates/:id/publish
 * Publish a template (creates new version)
 */
router.post('/:id/publish', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const userId = req.user?.id;

    const template = await printTemplateService.publishTemplate(req.params.id, tenantId, userId);

    res.json({
      status: 'success',
      message: 'Print template published successfully',
      data: template
    });
  } catch (error) {
    logger.error('Error publishing print template:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/print-templates/:id/default
 * Set template as default
 */
router.post('/:id/default', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const userId = req.user?.id;

    const template = await printTemplateService.setAsDefault(req.params.id, tenantId, userId);

    res.json({
      status: 'success',
      message: 'Template set as default successfully',
      data: template
    });
  } catch (error) {
    logger.error('Error setting template as default:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/print-templates/:id/rollback
 * Rollback to a specific version
 */
/**
 * POST /:id/reset-defaults
 *
 * Replace a template's blocks with the current defaults for its type.
 *
 * WHY THIS EXISTS
 * ---------------
 * DEFAULT_BLOCKS only applies at creation time, so a template created before an
 * improvement keeps its original block set forever. A template built when the
 * tax block was a single flat line still shows that line, and never picks up the
 * multi-rate tax summary, weighed-item sub-lines or vertical blocks added since.
 *
 * The previous version is written to template_versions first, so this is
 * reversible via rollback — the user is never one click away from losing work.
 */
router.post('/:id/reset-defaults', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ status: 'error', message: 'No tenant context' });

    const existing = await printTemplateService.getTemplate(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ status: 'error', message: 'Template not found' });

    const defaults = printTemplateService.DEFAULT_BLOCKS[existing.template_type];
    if (!defaults) {
      return res.status(400).json({
        status: 'error',
        message: `No defaults available for template type "${existing.template_type}"`,
      });
    }

    /*
     * DEFAULT_BLOCKS ships the dutyFree block hidden — it is meaningless on a
     * domestic sale. A duty-free template only carries it visible because
     * templateProvisioningService turned it on at creation time, which this
     * endpoint has no knowledge of on its own: it only sees the template
     * type, not the store's sales mode. blocksForReset carries the existing
     * template's own dutyFree visibility forward, so refreshing a store's
     * "Duty-Free Invoice" cannot silently drop passport/flight/destination
     * from the one document that exists to carry them.
     */
    const freshBlocks = printTemplateService.blocksForReset(existing.blocks, defaults);

    const updated = await printTemplateService.updateTemplate(
      req.params.id,
      tenantId,
      {
        blocks: freshBlocks,
        change_description: 'Reset to current defaults',
      },
      req.user?.id,
    );

    res.json({ status: 'success', data: updated });
  } catch (error) {
    console.error('[print-templates] reset-defaults failed:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reset template' });
  }
});

router.post('/:id/rollback', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const userId = req.user?.id;
    const version = parseInt(req.body.version, 10);

    if (!version || version < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid version number'
      });
    }

    const template = await printTemplateService.rollbackTemplate(req.params.id, tenantId, version, userId);

    res.json({
      status: 'success',
      message: 'Template rolled back successfully',
      data: template
    });
  } catch (error) {
    logger.error('Error rolling back template:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/print-templates/:id
 * Delete a template
 */
router.delete('/:id', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

    await printTemplateService.deleteTemplate(req.params.id, tenantId);

    res.json({
      status: 'success',
      message: 'Print template deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting print template:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
