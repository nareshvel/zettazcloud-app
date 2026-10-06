/**
 * Printer Settings Controller
 * Manages printer settings and receipt templates
 */

const { v4: uuidv4, validate: validateUUID } = require('uuid');
const pool = require('../config/db');

// Set to false to disable debug logs
const DEBUG_PRINTER = process.env.DEBUG_PRINTER === 'true' || false;

// Conditional debug logging helper
const debugLog = (...args) => {
  if (DEBUG_PRINTER) {
    console.log(...args);
  }
};

// Helper function to check if a string is a valid UUID v4
function isValidUUID(uuid) {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(uuid);
}

// Helper function to validate template_id
function validateTemplateId(templateId) {
  // Special system template IDs that should be preserved
  const systemTemplateIds = ['standard', 'compact', 'detailed'];
  
  // Log the incoming template ID for debugging
  debugLog(`Validating template ID: ${templateId}, Type: ${typeof templateId}`);
  
  // If template ID is falsy (null, undefined, empty string), return null
  if (!templateId) {
    return null;
  }
  
  // Convert to string to ensure consistent comparison
  const templateIdStr = String(templateId).trim();
  
  // If it's a system template ID, keep it as is
  if (systemTemplateIds.includes(templateIdStr)) {
    debugLog(`Found system template ID: ${templateIdStr}`);
    return templateIdStr;
  }
  
  // Otherwise, validate as UUID
  return isValidUUID(templateIdStr) ? templateIdStr : null;
}

/**
 * Get printer settings for a specific store
 * @route GET /api/settings/printer/:storeId
 * @access Private
 */
exports.getPrinterSettings = async (req, res, next) => {
  try {
    // Debug logging removed for cleaner console output
    // Debug logging removed for cleaner console output
    const storeId = String(req.params.storeId || '').trim();
    const tenantId = (req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null);
    debugLog('[printerSettings] resolved identifiers', { storeId, tenantId });
    
    // 1) Try store-specific settings
    const storeQueryRes = await pool.query(
      `SELECT * FROM printer_settings WHERE store_id = ? AND tenant_id = ? LIMIT 1`,
      [storeId, tenantId]
    );
    const settingsRows = Array.isArray(storeQueryRes) && Array.isArray(storeQueryRes[0]) ? storeQueryRes[0] : storeQueryRes;

    debugLog('[printerSettings] GET store-level lookup', { storeId, tenantId });
    debugLog('[printerSettings] store-level rows count:', Array.isArray(settingsRows) ? settingsRows.length : 'n/a');
    if (settingsRows && settingsRows.length > 0) {
      return res.json({
        status: 'success',
        message: 'Printer settings retrieved',
        data: settingsRows[0]
      });
    }

    // 2) Fallback to tenant-level defaults (store_id IS NULL)
    debugLog('[printerSettings] No store-level row, trying tenant-level (store_id IS NULL)', { tenantId });
    const tenantLevelRes = await pool.query(
      `SELECT * FROM printer_settings WHERE store_id IS NULL AND tenant_id = ? LIMIT 1`,
      [tenantId]
    );
    const tenantLevelRows = Array.isArray(tenantLevelRes) && Array.isArray(tenantLevelRes[0]) ? tenantLevelRes[0] : tenantLevelRes;

    debugLog('[printerSettings] tenant-level rows count:', Array.isArray(tenantLevelRows) ? tenantLevelRows.length : 'n/a');
    if (tenantLevelRows && tenantLevelRows.length > 0) {
      const row = tenantLevelRows[0];
      // Return tenant-level row but surface requested store_id for client convenience
      return res.json({
        status: 'success',
        message: 'Printer settings retrieved (tenant-level fallback)',
        data: { ...row, store_id: storeId }
      });
    }

    // 2b) Fallback to any tenant row (e.g., legacy rows with placeholder store_id)
    debugLog('[printerSettings] No tenant-level row, trying any tenant row', { tenantId });
    const anyTenantRes = await pool.query(
      `SELECT * FROM printer_settings 
       WHERE tenant_id = ? 
       ORDER BY (updated_at IS NULL) ASC, updated_at DESC, (created_at IS NULL) ASC, created_at DESC 
       LIMIT 1`,
      [tenantId]
    );
    const anyTenantRows = Array.isArray(anyTenantRes) && Array.isArray(anyTenantRes[0]) ? anyTenantRes[0] : anyTenantRes;

    debugLog('[printerSettings] any-tenant rows count:', Array.isArray(anyTenantRows) ? anyTenantRows.length : 'n/a');
    if (anyTenantRows && anyTenantRows.length > 0) {
      const row = anyTenantRows[0];
      return res.json({
        status: 'success',
        message: 'Printer settings retrieved (tenant-scope fallback)',
        data: { ...row, store_id: storeId }
      });
    }

    // 3) Final hard defaults if nothing found
    debugLog('[printerSettings] No rows found at any level. Returning hard defaults.', { storeId, tenantId });
    return res.json({
      status: 'success',
      message: 'Default printer settings returned',
      data: {
        store_id: storeId,
        enabled: true,
        auto_print: false,
        print_mode: 'browser',
        paper_width: 58,
        printer_name: null,
        template_id: null,
        header: null,
        footer: 'Thank you for your purchase!'
      }
    });
  } catch (error) {
    console.error('Error retrieving printer settings:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Could not retrieve printer settings',
      error: error.message
    });
  }
};

/**
 * Update printer settings for a specific store
 * @route PUT /api/settings/printer/:storeId
 * @access Private
 */
exports.updatePrinterSettings = async (req, res, next) => {
  try {
    debugLog('Request body:', JSON.stringify(req.body));
    debugLog('Request params:', req.params);
    debugLog('User info:', req.user);
    const storeId = req.params.storeId;
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
    const {
      enabled,
      auto_print,
      print_mode,
      printer_name,
      paper_width,
      template_id,
      header,
      footer,
      use_print_templates
    } = req.body;

    // Normalize print_mode to a safe value
    // SECURITY: Only allow 'browser' and 'direct' for now
    // 'server' and 'local-agent' are not yet implemented
    const allowedModes = new Set(['browser', 'direct']);
    const normalizedPrintMode = (typeof print_mode === 'string' && allowedModes.has(print_mode.trim().toLowerCase()))
      ? print_mode.trim().toLowerCase()
      : 'browser';
    
    // Validate template_id - allowing both UUIDs and special system template IDs
    const validTemplateId = validateTemplateId(template_id);
    
    debugLog(`Updating printer settings for store ID: ${storeId}`);
    debugLog(`Template ID: ${template_id}, Valid Template ID: ${validTemplateId}`);
    
    // Check if settings exist.
    // NOTE: pool.query() (backend/config/db.js) already unwraps mysql2's
    // [rows, fields] tuple and returns just the rows array — do not
    // destructure with `const [x] = await pool.query(...)`, that silently
    // grabs row zero instead of the array (pre-existing bug, discovered and
    // fixed alongside Print Module Phase 1; see printDocumentSettingsController.js
    // for the same fix applied to the newer table).
    const existingSettingsRows = await pool.query(
      `SELECT id FROM printer_settings WHERE store_id = ? AND tenant_id = ?`,
      [storeId, tenantId]
    );
    
    if (!existingSettingsRows || existingSettingsRows.length === 0) {
      // Create new settings
      const id = uuidv4();
      
      await pool.query(
        `INSERT INTO printer_settings
        (id, tenant_id, store_id, enabled, auto_print, print_mode, printer_name, paper_width,
         template_id, header, footer, use_print_templates, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          tenantId,
          storeId,
          enabled === undefined ? true : enabled,
          auto_print === undefined ? false : auto_print,
          normalizedPrintMode,
          printer_name === undefined ? null : printer_name,
          paper_width === undefined ? 58 : paper_width,
          validTemplateId, // Use validated template_id
          header === undefined ? null : header,
          footer === undefined ? 'Thank you for your purchase!' : footer,
          // Off unless explicitly requested. A new store gets the built-in
          // receipt, which is the known-good path.
          use_print_templates ? 1 : 0,
          (req.user?.id || "system"),
          (req.user?.id || "system")
        ]
      );
      
      return res.status(201).json({
        status: 'success',
        message: 'Printer settings created successfully',
        data: { id }
      });
    } else {
      // Update existing settings
      await pool.query(
        `UPDATE printer_settings SET
         enabled = ?,
         auto_print = ?,
         print_mode = ?,
         printer_name = ?,
         paper_width = ?,
         template_id = ?,
         header = ?,
         footer = ?,
         use_print_templates = COALESCE(?, use_print_templates),
         updated_by = ?,
         updated_at = NOW()
         WHERE store_id = ? AND tenant_id = ?`,
        [
          enabled === undefined ? true : enabled,
          auto_print === undefined ? false : auto_print,
          normalizedPrintMode,
          printer_name === undefined ? null : printer_name,
          paper_width === undefined ? 58 : paper_width,
          validTemplateId, // Use validated template_id
          header === undefined ? null : header,
          footer === undefined ? 'Thank you for your purchase!' : footer,
          // COALESCE above: an update that does not mention the flag leaves it
          // alone. Every other field in this handler defaults on omission,
          // which would silently switch a store back to the legacy receipt
          // whenever any unrelated printer setting was saved.
          use_print_templates === undefined ? null : (use_print_templates ? 1 : 0),
          (req.user?.id || "system"),
          storeId,
          tenantId
        ]
      );
      
      return res.json({
        status: 'success',
        message: 'Printer settings updated successfully',
        data: { id: existingSettingsRows[0]?.id || 'updated' }
      });
    }
  } catch (error) {
    console.error('Error updating printer settings:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      status: 'error',
      message: 'Could not update printer settings',
      error: error.message
    });
  }
};

/**
 * Test printer settings
 * @route POST /api/settings/printer/:storeId/test
 * @access Private
 */
exports.testPrintSettings = async (req, res, next) => {
  try {
    const storeId = req.params.storeId;
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;

    // Get the settings (see the note in updatePrinterSettings above — no destructuring)
    const settingsRows = await pool.query(
      `SELECT * FROM printer_settings WHERE store_id = ? AND tenant_id = ?`,
      [storeId, tenantId]
    );
    
    // Return success for demo - in a real implementation, this would send a test print
    res.json({
      status: 'success',
      message: 'Test print request received',
      data: {
        settings: settingsRows && settingsRows.length > 0 ? settingsRows[0] : null,
        test_success: true
      }
    });
  } catch (error) {
    console.error('Error testing printer settings:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Could not test printer settings',
      error: error.message
    });
  }
};

// REMOVED 2026-08-25 (Print Module Phase 1): getReceiptTemplates,
// getReceiptTemplate, createReceiptTemplate, updateReceiptTemplate,
// deleteReceiptTemplate. They backed a `receipt_templates` table nothing ever
// wrote rows into — the real template store is `print_templates`
// (printTemplateService.js / /api/print-templates), already used by the Print
// Template Designer. Do not re-add these; a caller wanting the receipt
// template list should hit GET /print-templates?template_type=receipt.
