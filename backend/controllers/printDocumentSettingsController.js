/**
 * Print Document Settings Controller
 *
 * Store-level printing configuration per document type (receipt, invoice).
 * See docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md for the phased plan this
 * belongs to, and PRINT_MODULE_FINAL_BLUEPRINT.md for where it's headed
 * (station-level routing, print_jobs, adapters).
 *
 * NOT `print_routes`: a table with that name already exists in this database
 * (a dormant, unreferenced partial build of the full blueprint's generic
 * condition-engine routing model, tied to `printer_devices`/`print_stations`).
 * This controller only ever reads/writes `print_document_settings`, a
 * differently-named, purpose-built table added for this phase. See the
 * migration file's header comment for the full story.
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const printerDeviceService = require('../services/printerDeviceService');

const DOCUMENT_TYPES = ['receipt', 'invoice'];
const DELIVERY_MODES = ['browser', 'direct', 'local_agent'];

function defaultsFor(storeId, documentType) {
  return {
    id: null,
    store_id: storeId,
    document_type: documentType,
    delivery_mode: 'browser',
    printer_name: null,
    paper_width: documentType === 'invoice' ? 210 : 80,
    media_size: documentType === 'invoice' ? 'a4' : '80mm',
    template_id: null,
    copies: 1,
    enabled: documentType === 'receipt', // a store gets a working receipt out of the box; invoice printing is opt-in
    auto_print: false,
  };
}

/**
 * GET /api/settings/print-document-settings/:storeId
 * Returns one row per known document type, filling in defaults for any type
 * that has no row yet (mirrors getPrinterSettings' "never 404" behavior —
 * Printer Settings must always have something to render), plus the store's
 * receipt-vs-invoice choice for a completed sale.
 */
exports.getPrintDocumentSettings = async (req, res) => {
  try {
    const storeId = String(req.params.storeId || '').trim();
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenant_id || req.query?.tenant_id || null;

    // NOTE: this module's `pool.query()` (backend/config/db.js's exported
    // `query`) already unwraps mysql2's `[rows, fields]` tuple internally and
    // returns just the rows array — do NOT destructure the result with
    // `const [x] = await pool.query(...)` again here, that silently grabs row
    // zero instead of the array (bit this exact file once already, causing
    // every GET here to 500).
    const rows = await pool.query(
      `SELECT * FROM print_document_settings WHERE store_id = ? AND tenant_id = ?`,
      [storeId, tenantId],
    );

    const byType = new Map((rows || []).map((r) => [r.document_type, r]));
    const settings = DOCUMENT_TYPES.map((type) => byType.get(type) || defaultsFor(storeId, type));

    const storeRows = await pool.query(
      'SELECT default_sale_document_type FROM stores WHERE id = ? AND tenant_id = ?',
      [storeId, tenantId],
    );
    const defaultSaleDocumentType = storeRows?.[0]?.default_sale_document_type || 'receipt';

    return res.json({
      status: 'success',
      message: 'Print document settings retrieved',
      data: { settings, defaultSaleDocumentType },
    });
  } catch (error) {
    console.error('Error retrieving print document settings:', error);
    return res.status(500).json({ status: 'error', message: 'Could not retrieve print document settings', error: error.message });
  }
};

/**
 * PUT /api/settings/print-document-settings/:storeId/default-format
 * Sets whether a completed POS sale at this store prints as a receipt or an
 * invoice. A retail-profile fact about the store, not a delivery detail — see
 * the migration file's header for why this isn't a print_document_settings
 * column.
 */
exports.updateDefaultSaleDocumentType = async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'] || null;
    const { defaultSaleDocumentType } = req.body;

    if (!DOCUMENT_TYPES.includes(defaultSaleDocumentType)) {
      return res.status(400).json({
        status: 'error',
        message: `Unknown defaultSaleDocumentType "${defaultSaleDocumentType}". Expected one of: ${DOCUMENT_TYPES.join(', ')}`,
      });
    }

    await pool.query(
      'UPDATE stores SET default_sale_document_type = ? WHERE id = ? AND tenant_id = ?',
      [defaultSaleDocumentType, storeId, tenantId],
    );

    return res.json({ status: 'success', message: 'Default sale document type updated', data: { defaultSaleDocumentType } });
  } catch (error) {
    console.error('Error updating default sale document type:', error);
    return res.status(500).json({ status: 'error', message: 'Could not update default sale document type', error: error.message });
  }
};

/**
 * PUT /api/settings/print-document-settings/:storeId/:documentType
 * Upserts one document type's row. Every field is optional except the ones
 * that must not silently reset on a partial save (enabled/auto_print use the
 * same COALESCE pattern as printerSettingsController for that reason).
 */
exports.updateAllPrintDocumentSettings = async (req, res) => {
  const storeId = String(req.params.storeId || '').trim();
  const tenantId = req.user?.tenant_id || null;
  const body = req.body || {};
  const defaultSaleDocumentType = body.defaultSaleDocumentType || body.default_sale_document_type;
  const settings = body.settings;
  const errors = {};

  if (!DOCUMENT_TYPES.includes(defaultSaleDocumentType)) {
    errors.defaultSaleDocumentType = 'Choose Receipt or Invoice.';
  }
  for (const type of DOCUMENT_TYPES) {
    if (!settings?.[type]) errors[type] = `Missing ${type} settings.`;
  }
  if (settings?.[defaultSaleDocumentType] && !settings[defaultSaleDocumentType].enabled) {
    errors[`${defaultSaleDocumentType}.enabled`] = 'The default sales document must be available for printing.';
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ status: 'error', message: 'Printer settings are incomplete', errors });
  }

  try {
    const normalized = await pool.executeTransaction(async (connection) => {
      const [stores] = await connection.query(
        'SELECT id FROM stores WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [storeId, tenantId],
      );
      if (!stores.length) {
        const error = new Error('Store not found for this tenant.');
        error.statusCode = 404;
        throw error;
      }

      const result = {};
      for (const type of DOCUMENT_TYPES) {
        const raw = settings[type];
        const input = {
          ...raw,
          storeId: raw.storeId ?? raw.store_id,
          documentType: raw.documentType ?? raw.document_type,
          deliveryMode: raw.deliveryMode ?? raw.delivery_mode,
          printerName: raw.printerName ?? raw.printer_name,
          paperWidth: raw.paperWidth ?? raw.paper_width,
          mediaSize: raw.mediaSize ?? raw.media_size,
          templateId: raw.templateId ?? raw.template_id,
          autoPrint: raw.autoPrint ?? raw.auto_print,
        };
        const routeErrors = {};
        const deliveryMode = input.deliveryMode;
        const mediaSize = input.mediaSize || (type === 'invoice' ? 'a4' : `${Number(input.paperWidth) || 80}mm`);
        const allowedMedia = type === 'invoice' ? ['a4', 'letter'] : ['58mm', '80mm', '110mm'];
        const compatibleTypes = type === 'invoice' ? ['invoice', 'jewelry_invoice'] : ['receipt'];
        const copies = Number(input.copies);

        if (!DELIVERY_MODES.includes(deliveryMode)) routeErrors.deliveryMode = 'Choose a supported delivery method.';
        if (!allowedMedia.includes(mediaSize)) routeErrors.mediaSize = `Choose one of: ${allowedMedia.join(', ')}.`;
        if (!Number.isInteger(copies) || copies < 1 || copies > 10) routeErrors.copies = 'Copies must be between 1 and 10.';
        if (deliveryMode === 'direct') {
          if (type !== 'receipt') {
            routeErrors.deliveryMode = 'Network ESC/POS delivery is supported only for receipt routes.';
          } else if (!input.printerName) {
            routeErrors.printerName = 'Enter the network printer address as host:port.';
          } else {
            try {
              printerDeviceService.validatePrinterAddress(input.printerName);
            } catch (error) {
              routeErrors.printerName = error.message;
            }
          }
        }

        let templateId = input.templateId || null;
        if (templateId) {
          const placeholders = compatibleTypes.map(() => '?').join(',');
          const [templates] = await connection.query(
            `SELECT id FROM print_templates
              WHERE id = ? AND tenant_id = ? AND is_published = 1
                AND template_type IN (${placeholders})
                AND (store_id = ? OR store_id IS NULL)`,
            [templateId, tenantId, ...compatibleTypes, storeId],
          );
          if (!templates.length) routeErrors.templateId = 'Select a compatible published template for this store.';
        } else if (input.enabled) {
          routeErrors.templateId = 'Select a published template.';
        }

        if (Object.keys(routeErrors).length) {
          Object.entries(routeErrors).forEach(([field, message]) => { errors[`${type}.${field}`] = message; });
          continue;
        }

        const paperWidth = type === 'invoice'
          ? (mediaSize === 'letter' ? 216 : 210)
          : Number(mediaSize.replace('mm', ''));
        const id = input.id || uuidv4();
        await connection.query(
          `INSERT INTO print_document_settings
            (id, tenant_id, store_id, document_type, delivery_mode, printer_name,
             paper_width, media_size, template_id, copies, enabled, auto_print)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             delivery_mode = VALUES(delivery_mode), printer_name = VALUES(printer_name),
             paper_width = VALUES(paper_width), media_size = VALUES(media_size),
             template_id = VALUES(template_id), copies = VALUES(copies),
             enabled = VALUES(enabled), auto_print = VALUES(auto_print), updated_at = NOW()`,
          [id, tenantId, storeId, type, deliveryMode,
            deliveryMode === 'browser' ? null : input.printerName,
            paperWidth, mediaSize, templateId, deliveryMode === 'browser' ? 1 : copies,
            !!input.enabled, !!input.autoPrint],
        );
        result[type] = { ...input, id, storeId, documentType: type, paperWidth, mediaSize, templateId,
          printerName: deliveryMode === 'browser' ? null : input.printerName,
          copies: deliveryMode === 'browser' ? 1 : copies };
      }

      if (Object.keys(errors).length) {
        const error = new Error('Printer settings are incomplete');
        error.statusCode = 400;
        error.validationErrors = errors;
        throw error;
      }

      await connection.query(
        'UPDATE stores SET default_sale_document_type = ? WHERE id = ? AND tenant_id = ?',
        [defaultSaleDocumentType, storeId, tenantId],
      );
      return result;
    });

    return res.json({ status: 'success', message: 'Printer settings saved', data: {
      defaultSaleDocumentType,
      settings: DOCUMENT_TYPES.map((type) => normalized[type]),
    } });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error('Error saving printer settings:', error);
    return res.status(status).json({
      status: 'error',
      message: error.message || 'Could not save printer settings',
      errors: error.validationErrors,
    });
  }
};

exports.updatePrintDocumentSetting = async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const documentType = req.params.documentType;
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'] || null;

    if (!DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({ status: 'error', message: `Unknown document_type "${documentType}". Expected one of: ${DOCUMENT_TYPES.join(', ')}` });
    }

    const {
      delivery_mode,
      printer_name,
      paper_width,
      template_id,
      copies,
      enabled,
      auto_print,
    } = req.body;

    const normalizedDeliveryMode = DELIVERY_MODES.includes(delivery_mode) ? delivery_mode : 'browser';

    // template_id must belong to this tenant, or we silently drop it rather
    // than store a dangling reference a future print attempt can't resolve.
    let validTemplateId = null;
    if (template_id) {
      const templateRows = await pool.query(
        'SELECT id FROM print_templates WHERE id = ? AND tenant_id = ?',
        [template_id, tenantId],
      );
      validTemplateId = (templateRows && templateRows.length) ? template_id : null;
    }

    const existing = await pool.query(
      'SELECT id FROM print_document_settings WHERE tenant_id = ? AND store_id = ? AND document_type = ?',
      [tenantId, storeId, documentType],
    );

    if (!existing || existing.length === 0) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO print_document_settings
          (id, tenant_id, store_id, document_type, delivery_mode, printer_name,
           paper_width, template_id, copies, enabled, auto_print)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, tenantId, storeId, documentType, normalizedDeliveryMode,
          printer_name || null,
          paper_width === undefined ? (documentType === 'invoice' ? 210 : 80) : paper_width,
          validTemplateId,
          copies === undefined ? 1 : Math.max(1, Number(copies) || 1),
          enabled === undefined ? true : !!enabled,
          auto_print === undefined ? false : !!auto_print,
        ],
      );
      return res.status(201).json({ status: 'success', message: 'Print document setting created', data: { id } });
    }

    await pool.query(
      `UPDATE print_document_settings SET
         delivery_mode = ?,
         printer_name = ?,
         paper_width = ?,
         template_id = ?,
         copies = ?,
         enabled = ?,
         auto_print = ?,
         updated_at = NOW()
       WHERE tenant_id = ? AND store_id = ? AND document_type = ?`,
      [
        normalizedDeliveryMode,
        printer_name || null,
        paper_width === undefined ? 80 : paper_width,
        validTemplateId,
        copies === undefined ? 1 : Math.max(1, Number(copies) || 1),
        enabled === undefined ? true : !!enabled,
        auto_print === undefined ? false : !!auto_print,
        tenantId, storeId, documentType,
      ],
    );
    return res.json({ status: 'success', message: 'Print document setting updated', data: { id: existing[0].id } });
  } catch (error) {
    console.error('Error updating print document setting:', error);
    return res.status(500).json({ status: 'error', message: 'Could not update print document setting', error: error.message });
  }
};
