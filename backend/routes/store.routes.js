const express = require('express');
const router = express.Router();
const { pool } = require('../db'); // Assuming your db connection pool is exported from here
const { v4: uuidv4 } = require('uuid');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware'); // For authentication
const rbacService = require('../services/rbacService');
const { withinUsageLimits } = require('../middleware/subscriptionMiddleware'); // Plan `limits.stores` enforcement

// Async count function for withinUsageLimits('stores', ...) — matches the
// same unscoped COUNT(*) query getSubscriptionUsage() and GET / already use.
// Excludes soft-deleted stores (deleted_at IS NOT NULL) — a store pending
// purge shouldn't count against the plan's store limit or the "last store"
// check below.
const countTenantStores = async (tenantId) => {
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM stores WHERE tenant_id = ? AND deleted_at IS NULL', [tenantId]);
  return rows?.[0]?.count ?? 0;
};

// Tenant-Admin-only gate for store actions that are more sensitive than the
// stores.* permission set implies (changing the default store, soft-deleting
// a store with real data, restoring one) — mirrors the pattern already
// established in tenants.routes.js's PATCH /me.
const requireTenantAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    if (!userId || !tenantId) {
      return res.status(403).json({ status: 'error', message: 'Not authorized.' });
    }
    const isAdmin = await rbacService.isTenantAdmin(userId, tenantId);
    if (!isAdmin) {
      return res.status(403).json({ status: 'error', message: 'Only a Tenant Admin can perform this action.' });
    }
    next();
  } catch (error) {
    console.error('[requireTenantAdmin] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to verify permissions.' });
  }
};

/**
 * @route   GET /api/stores
 * @desc    Fetch all stores for the tenant
 * @access  Private (requires stores.read permission)
 */
router.get('/', requirePermission('stores.view'), async (req, res) => {
  try {
    const { tenant_id } = req.user;
    
    const query = `
      SELECT id, name, address, phone, email, tenant_id, currency_code, date_format, created_at, updated_at, quickstart_progress, is_default_store
      FROM stores
      WHERE tenant_id = ? AND deleted_at IS NULL
      ORDER BY name ASC
    `;

    const [rows] = await pool.execute(query, [tenant_id]);

    // Map snake_case DB columns to camelCase for the frontend
    const stores = rows.map(store => {
      let quickstartProgress = null;
      if (store.quickstart_progress) {
        try {
          quickstartProgress = typeof store.quickstart_progress === 'string'
            ? JSON.parse(store.quickstart_progress)
            : store.quickstart_progress;
        } catch (e) {
          console.error('Error parsing quickstart_progress:', e);
          quickstartProgress = null;
        }
      }

      return {
        id: store.id,
        name: store.name,
        address: store.address,
        phone: store.phone,
        email: store.email,
        status: 'active', // Default status if not available
        isDefault: !!store.is_default_store,
        createdAt: store.created_at,
        updatedAt: store.updated_at,
        quickstartProgress: quickstartProgress
      };
    });
    
    return res.status(200).json(stores);
  } catch (error) {
    console.error('[GET /api/stores] Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch stores'
    });
  }
});

/**
 * @route   GET /api/stores/accessible
 * @desc    List only the stores the CALLING user can switch into — Tenant Admin
 *          sees every store for the tenant; everyone else sees only stores
 *          where they hold a store-scoped role. This is deliberately narrower
 *          than GET / (which is gated on stores.view but returns every store
 *          in the tenant regardless of the caller's own store assignments) so
 *          the "Switch Store" list in the UI can never offer a store that
 *          POST /api/auth/switch-store would then reject with a 403 — both
 *          use the exact same store-scoped-role query.
 * @access  Private (authenticated; no stores.view requirement — a user should
 *          always be able to see which stores THEY can switch between)
 */
router.get('/accessible', authenticate, requireTenantId, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const currentStoreId = req.user.store_id || req.user.storeId || null;

    const isAdmin = await rbacService.isTenantAdmin(userId, tenantId);

    let stores;
    if (isAdmin) {
      const [rows] = await pool.execute(
        'SELECT id, name, is_default_store FROM stores WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name ASC',
        [tenantId]
      );
      stores = rows;
    } else {
      const storeRoles = await rbacService.getUserTenantRoles(userId, tenantId, { scope: 'store' });
      const storeIds = [...new Set((storeRoles || []).map((r) => r.store_id).filter(Boolean))];
      if (storeIds.length === 0) {
        stores = [];
      } else {
        const placeholders = storeIds.map(() => '?').join(',');
        const [rows] = await pool.execute(
          `SELECT id, name, is_default_store FROM stores WHERE tenant_id = ? AND deleted_at IS NULL AND id IN (${placeholders}) ORDER BY name ASC`,
          [tenantId, ...storeIds]
        );
        stores = rows;
      }
    }

    const data = stores.map((s) => ({
      id: s.id,
      name: s.name,
      isCurrent: s.id === currentStoreId,
      isDefault: !!s.is_default_store,
    }));
    res.json({ status: 'success', data });
  } catch (error) {
    console.error('[GET /api/stores/accessible] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch accessible stores' });
  }
});

/**
 * @route   POST /api/stores
 * @desc    Create a new store for the tenant (full setup form — see
 *          docs/17-migration-and-roadmap/19_Store_Creation_And_Switching.md).
 *          Optionally accepts `industryCode` (per-store business type
 *          override — omit/empty to inherit the tenant's company-wide
 *          default, same convention as every other store) and `isDutyFree`.
 *          Both are applied via retailProfileService.updateRetailProfile
 *          BEFORE template provisioning runs, so the store's very first
 *          print templates are already correct for its actual vertical/
 *          sales mode instead of always being general_retail/domestic and
 *          needing a follow-up visit to Settings to fix (added 2026-09-01
 *          after a store created with e.g. souvenir_gifts + duty-free still
 *          got the tenant's default templates).
 * @access  Private (Tenant Admin only, via stores.create permission)
 */
router.post('/', requirePermission('stores.create'), withinUsageLimits('stores', countTenantStores), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant information is missing or user is not authorized.' });
    }

    const retailProfileService = require('../services/retailProfileService');

    // NOTE: every field below is read as snake_case, NOT camelCase, because
    // fetchApi (frontend/src/services/api.ts) converts every outgoing JSON
    // request body from camelCase to snake_case BEFORE it reaches this
    // route — req.body has `industry_code`/`currency_code`/`number_format`/
    // etc., never `industryCode`/`currencyCode`/`numberFormat`. Destructuring
    // the camelCase names here silently dropped ALL of them (business type,
    // duty-free, AND every localization field — currency, country, language,
    // number/date/time format, measurement system, tax basis, catalog
    // sharing) on every store creation; only `name`/`address`/`phone`/
    // `email` ever worked, because those happen to be identical in both
    // cases. Fixed 2026-09-01 after a second store still inherited the
    // parent tenant's business type and templates despite the picker being
    // set — same class of bug as the tenants.routes.js postal-code fix
    // earlier the same day. See docs/18-errors-fixes/ for the write-up.
    const body = req.body || {};

    // Validated up front, before anything is written — an invalid/unavailable
    // business type must not leave behind an orphaned store row.
    let normalizedIndustryCode; // undefined = inherit (leave stores.industry_code NULL)
    if (body.industry_code !== undefined && body.industry_code !== null && body.industry_code !== '') {
      const requestedIndustry = body.industry_code;
      if (!retailProfileService.INDUSTRIES[requestedIndustry]) {
        return res.status(400).json({ status: 'error', message: `Unknown business type: ${requestedIndustry}` });
      }
      if (!retailProfileService.isIndustryAvailable(requestedIndustry)) {
        return res.status(400).json({
          status: 'error',
          message: `${retailProfileService.INDUSTRIES[requestedIndustry].label} is not available yet — `
            + `${retailProfileService.INDUSTRIES[requestedIndustry].unavailableReason}`,
        });
      }
      normalizedIndustryCode = requestedIndustry;
    }
    const requestedIsDutyFree = typeof body.is_duty_free === 'boolean' ? body.is_duty_free : undefined;

    // Full setup form — mirrors every field GeneralSettings.tsx/
    // LocalizationSettings.tsx already collect for an EXISTING store's
    // PATCH /settings, so a new store can be fully configured in one step
    // instead of needing a follow-up visit to Settings (per the confirmed
    // "full setup form" decision in
    // docs/17-migration-and-roadmap/19_Store_Creation_And_Switching.md).
    // `number_format` is expected as the raw DB pattern string (e.g.
    // '1,234.56'), not the UI key ('point_comma') — same contract
    // PATCH /settings already uses; the UI-key<->DB-pattern mapping is the
    // frontend's job (see LocalizationSettings.tsx's uiToDbNumberFormat).
    const {
      name, address, phone, email,
      currency_code: currencyCode, country_code: countryCode, timezone, default_tax_basis: defaultTaxBasis,
      language_code: languageCode, locale_code: localeCode, number_format: numberFormat, decimal_precision: decimalPrecision,
      measurement_system: measurementSystem, date_format: dateFormat, time_format: timeFormat, theme,
      catalog_sharing: catalogSharing,
    } = body;
    // What happens to existing tenant-wide shared products (products.store_id
    // IS NULL) when this store is created — per
    // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §5.2
    // item 3. 'empty' = don't provision any store_product_listings rows (the
    // store starts with none of the shared catalog sellable until someone
    // explicitly adds it later). Anything else (including omitted, the
    // default) = 'shared': every existing shared product gets a listing row
    // at this store immediately (price NULL = inherit, stock starts at 0 —
    // stock is never copied, it comes in via this store's own GRN/adjustment
    // flow, same as a store-owned product).
    const skipCatalogSharing = catalogSharing === 'empty';
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ status: 'error', message: 'Store name is required.' });
    }

    const id = uuidv4();
    // The tenant's very first store is automatically the default — every
    // subsequent one starts non-default; the Tenant Admin can change it via
    // PATCH /:id/set-default. countTenantStores() already excludes
    // soft-deleted rows, so a tenant that deleted its way back down to zero
    // active stores correctly gets a new default here too.
    const existingStoreCount = await countTenantStores(tenantId);
    const isFirstStore = existingStoreCount === 0;

    const fields = ['id', 'tenant_id', 'name', 'is_default_store'];
    const placeholders = ['?', '?', '?', '?'];
    const values = [id, tenantId, trimmedName, isFirstStore ? 1 : 0];

    const optional = {
      address, phone, email,
      currency_code: currencyCode,
      country_code: countryCode,
      timezone,
      language_code: languageCode,
      locale_code: localeCode,
      number_format: numberFormat,
      date_format: dateFormat,
      time_format: timeFormat,
    };
    Object.entries(optional).forEach(([col, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        fields.push(col);
        placeholders.push('?');
        values.push(val);
      }
    });

    if (decimalPrecision !== undefined && decimalPrecision !== null && decimalPrecision !== '') {
      const dp = Number(decimalPrecision);
      if (!Number.isNaN(dp) && dp >= 0 && dp <= 6) {
        fields.push('decimal_precision');
        placeholders.push('?');
        values.push(dp);
      }
    }

    if (measurementSystem && ['metric', 'imperial'].includes(String(measurementSystem))) {
      fields.push('measurement_system');
      placeholders.push('?');
      values.push(measurementSystem);
    }

    if (theme && ['light', 'dark'].includes(String(theme))) {
      fields.push('theme');
      placeholders.push('?');
      values.push(theme);
    }

    if (defaultTaxBasis && ['INCLUSIVE', 'EXCLUSIVE'].includes(String(defaultTaxBasis).toUpperCase())) {
      fields.push('default_tax_basis');
      placeholders.push('?');
      values.push(String(defaultTaxBasis).toUpperCase());
    }

    await pool.execute(`INSERT INTO stores (${fields.join(',')}) VALUES (${placeholders.join(',')})`, values);

    // Applied BEFORE template provisioning runs below, so the plan it reads
    // already reflects this store's real business type/sales mode instead of
    // always being general_retail/domestic. Non-fatal by design (matches
    // every other post-creation step here) — the store already exists, and
    // Settings offers the same controls afterward if this fails.
    if (normalizedIndustryCode !== undefined || requestedIsDutyFree !== undefined) {
      try {
        await retailProfileService.updateRetailProfile(tenantId, id, {
          industryCode: normalizedIndustryCode,
          isDutyFree: requestedIsDutyFree,
        });
      } catch (profileErr) {
        console.error('[POST /api/stores] Business type / duty-free setup failed (non-blocking):', profileErr.message);
      }
    }

    const [rows] = await pool.execute(
      `SELECT id, tenant_id, name, email, phone, address, currency_code, country_code,
              timezone, date_format, time_format, locale_code, language_code,
              number_format, decimal_precision, measurement_system, default_tax_basis, theme,
              is_default_store, industry_code, is_duty_free
       FROM stores WHERE id = ?`,
      [id]
    );
    const store = rows[0];

    try {
      const { logActivity } = require('../services/auditLogService');
      await logActivity({
        tenant_id: tenantId,
        user_id: req.user?.id,
        action: 'STORE_CREATED',
        entity_type: 'store',
        entity_id: id,
        details: { name: trimmedName },
      });
    } catch (auditErr) {
      console.error('[POST /api/stores] Audit log failed (non-blocking):', auditErr.message);
    }

    // Provision defaults so the new store isn't a blank shell — per
    // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §5.2.
    // Both steps are non-blocking: a provisioning failure shouldn't fail
    // store creation itself (the store already exists at this point), but it
    // should be loud in the logs since a store silently missing templates
    // will hit Print Module Phase 1's "no published template" hard error the
    // first time someone tries to check out.
    try {
      const templateProvisioningService = require('../services/templateProvisioningService');
      await templateProvisioningService.provisionStoreTemplates(tenantId, id, { replace: false, publish: true });
    } catch (provisionErr) {
      console.error('[POST /api/stores] Print template provisioning failed (non-blocking):', provisionErr.message);
    }

    try {
      // Seed default receipt/invoice delivery settings. template_id is left
      // NULL here — printDocumentSettingsController's existing fallback
      // (is_default / route resolution) fills it in once templates from the
      // step above are queried, avoiding a load-order dependency on knowing
      // the specific template id provisioning just created.
      for (const documentType of ['receipt', 'invoice']) {
        await pool.execute(
          `INSERT INTO print_document_settings
             (id, tenant_id, store_id, document_type, delivery_mode, paper_width, copies, enabled, auto_print)
           VALUES (?, ?, ?, ?, 'browser', 80, 1, 1, 0)
           ON DUPLICATE KEY UPDATE id = id`,
          [uuidv4(), tenantId, id, documentType]
        );
      }
    } catch (settingsErr) {
      console.error('[POST /api/stores] Default print_document_settings seeding failed (non-blocking):', settingsErr.message);
    }

    if (!skipCatalogSharing) {
      try {
        // Give every existing tenant-wide shared product a listing row at
        // this brand-new store so it's immediately sellable (with stock 0
        // until stocked in). Without this, a shared product cannot be sold
        // here at all — createSaleController.js's stock deduction throws
        // when no store_product_listings row exists for the pair.
        const [sharedProducts] = await pool.execute(
          `SELECT id FROM products WHERE tenant_id = ? AND store_id IS NULL`,
          [tenantId]
        );
        for (const p of sharedProducts) {
          await pool.execute(
            `INSERT IGNORE INTO store_product_listings
               (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
             VALUES (?, ?, ?, ?, NULL, NULL, 0, 1)`,
            [uuidv4(), tenantId, id, p.id]
          );
        }
      } catch (listingsErr) {
        console.error('[POST /api/stores] store_product_listings provisioning failed (non-blocking):', listingsErr.message);
      }
    }

    res.status(201).json({
      status: 'success',
      data: {
        id: store.id,
        tenantId: store.tenant_id,
        name: store.name,
        email: store.email || '',
        phone: store.phone || '',
        address: store.address || '',
        currencyCode: store.currency_code || 'USD',
        countryCode: store.country_code || 'US',
        timezone: store.timezone || 'UTC',
        dateFormat: store.date_format || 'MM/DD/YYYY',
        timeFormat: store.time_format || 'hh:mm A',
        localeCode: store.locale_code || 'en-US',
        languageCode: store.language_code || 'en',
        numberFormat: store.number_format || 'point_comma',
        decimalPrecision: store.decimal_precision || 2,
        measurementSystem: store.measurement_system || 'metric',
        defaultTaxBasis: store.default_tax_basis || 'EXCLUSIVE',
        theme: store.theme || 'light',
        isDefault: !!store.is_default_store,
      },
    });
  } catch (error) {
    console.error('[POST /api/stores] Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create store.' });
  }
});

// GET /api/stores/settings - Fetch settings for the store associated with tenant_id
router.get('/settings', async (req, res) => {
  try {
    // This route has NEVER had `authenticate` mounted on it (unlike PATCH
    // /settings below, or /current), so `req.user` was always undefined here
    // — every comment further down that says "authenticated user wins" was
    // dead code, and resolution silently depended entirely on the frontend
    // correctly computing `store_id` as a query param. StoreContext.tsx does
    // usually get that right, but it's one hop removed from the verified
    // JWT — after switching stores, a stale/slow-to-update client-side value
    // there made this endpoint (and therefore the "Current Store" label AND
    // General Settings' Store Name/Phone/Email/Address fields, both sourced
    // from it) show the PREVIOUS store's data even though the authenticated
    // /retail-profile endpoint (which decodes the JWT directly) correctly
    // showed the new store's Business Type. Fixed by decoding the token
    // here too — softly: an invalid/missing token just falls through to the
    // existing query-param path rather than rejecting the request, since
    // this endpoint is documented to also work unauthenticated.
    let tokenUser = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../config/constants');
        const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
        tokenUser = {
          tenant_id: decoded.tenant_id || decoded.tenantId,
          store_id: decoded.store_id || decoded.storeId,
        };
      } catch (e) {
        // Invalid/expired token — fall through to the query-param path below
        // rather than 401ing an endpoint documented to work without auth.
      }
    }

    // Resolve tenant_id from the verified token, explicit query parameter, or
    // x-tenant-id header. Order of precedence: token -> explicit query -> header.
    const tenantId = tokenUser?.tenant_id
      || req.query?.tenant_id
      || req.headers["x-tenant-id"];
    // console.log('[DEBUG] Using tenant_id:', tenantId);

    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'tenant_id is required as a query parameter when not authenticated'
      });
    }

    // Resolve the ACTIVE store, not just "any store for this tenant".
    // A multi-store tenant's JWT carries store_id (set at login / by
    // switch-store), and that must win here — this endpoint used to filter
    // on tenant_id alone with no ORDER BY, so `LIMIT 1` silently returned
    // whichever store MySQL happened to list first (typically the oldest/
    // first-created one). That made the TopBar's "Current Store" label show
    // a different store than the one actually selected in the Switch Store
    // dropdown (which correctly reads /stores/accessible's per-store
    // isCurrent flag, computed from the same JWT store_id) — cosmetic, but
    // confusing enough to look like a real bug. Falls back to the old
    // tenant-only lookup when no store_id is available (e.g. legacy tokens).
    const storeId = tokenUser?.store_id
      || req.query?.store_id
      || req.query?.storeId
      || req.headers["x-store-id"];

    // Query all columns including localization fields and tax_config
    const baseSelect = `
      SELECT
        id, name, email, phone, address, logo_url,
        currency_code, tenant_id, date_format, time_format, timezone,
        language_code, country_code, locale_code, number_format,
        decimal_precision, measurement_system, allow_negative_stock, default_tax_basis, tax_config, quickstart_progress, theme,
        industry_code, require_open_register
      FROM stores
      WHERE tenant_id = ?
    `;

    let rows;
    if (storeId) {
      [rows] = await pool.execute(`${baseSelect} AND id = ? LIMIT 1;`, [tenantId, storeId]);
      // A stale/cross-tenant store_id shouldn't 404 the whole page — fall
      // back to the tenant's first store rather than showing nothing.
      if (rows.length === 0) {
        [rows] = await pool.execute(`${baseSelect} LIMIT 1;`, [tenantId]);
      }
    } else {
      [rows] = await pool.execute(`${baseSelect} LIMIT 1;`, [tenantId]);
    }
    
    if (rows.length === 0) {
      // Return a mock store if no store is found
      return res.status(200).json({
        id: 'mock-store-id',
        tenantId: tenantId,
        name: 'Mock Store',
        email: 'mock@zettaz.com',
        phone: '(555) MOCK-DATA',
        address: '123 Mock St',
        logoUrl: null,
        currencyCode: 'USD',
        currencyDecimalPlaces: 2,
        dateFormat: 'MM/DD/YYYY',
        timeFormat: 'hh:mm A',
        numberFormat: 'point_comma',
        decimalPrecision: 2,
        localeCode: 'en-US',
        measurementSystem: 'metric'
      });
    }
    
    // Convert snake_case database fields to camelCase for frontend
    const store = rows[0];
    
    // Handle tax_config JSON field (MySQL2 auto-parses JSON columns)
    let taxConfig = {};
    if (store.tax_config) {
      if (typeof store.tax_config === 'object') {
        // Already parsed by MySQL2
        taxConfig = store.tax_config;
      } else if (typeof store.tax_config === 'string') {
        try {
          taxConfig = JSON.parse(store.tax_config);
        } catch (e) {
          console.error('Error parsing tax_config JSON string:', e);
          taxConfig = {};
        }
      }
    }
    
    // Handle quickstart_progress JSON field
    let quickstartProgress = null;
    if (store.quickstart_progress) {
      if (typeof store.quickstart_progress === 'object') {
        quickstartProgress = store.quickstart_progress;
      } else if (typeof store.quickstart_progress === 'string') {
        try {
          quickstartProgress = JSON.parse(store.quickstart_progress);
        } catch (e) {
          console.error('Error parsing quickstart_progress JSON string:', e);
          quickstartProgress = null;
        }
      }
    }
    
    const camelCaseStore = {
      id: store.id,
      tenantId: store.tenant_id,
      name: store.name,
      email: store.email || '',
      phone: store.phone || '',
      address: store.address || '',
      logoUrl: store.logo_url || null,
      currencyCode: store.currency_code || 'USD',
      currencyDecimalPlaces: 2,
      // Use actual database values instead of defaults
      dateFormat: store.date_format || 'MM/DD/YYYY',
      timeFormat: store.time_format || 'hh:mm A',
      numberFormat: store.number_format || 'point_comma',
      decimalPrecision: store.decimal_precision || 2,
      localeCode: store.locale_code || 'en-US',
      languageCode: store.language_code || 'en',
      countryCode: store.country_code || 'US',
      timezone: store.timezone || 'UTC',
      measurementSystem: store.measurement_system || 'metric',
      allowNegativeStock: !!store.allow_negative_stock,
      // When on, the POS refuses sale completion until a drawer session is
      // open for the store (enforced server-side in createSaleController).
      requireOpenRegister: !!store.require_open_register,
      defaultTaxBasis: store.default_tax_basis || 'EXCLUSIVE', // Ensure this is included
      tax_config: taxConfig, // Add the parsed tax_config
      quickstartProgress: quickstartProgress, // Add the parsed quickstart_progress
      theme: store.theme || 'light',
      // NULL = this store inherits its business type from the tenant's
      // company-wide default (tenants.industry_code, via GET /api/industry/tenant).
      // A non-null value here means this specific store has its own override —
      // see PUT /api/retail-profile and docs/17-migration-and-roadmap/
      // 22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md.
      industryCode: store.industry_code || null
    };
    
    return res.status(200).json(camelCaseStore);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
});

// PATCH /api/stores/settings - Update store settings
// SECURITY: this route used to have NO auth middleware at all — tenantId was
// resolved from req.user OR an unauthenticated query/header/body value, so any
// caller supplying a tenant_id could rename that tenant's store. `authenticate`
// + `requireTenantId` below close that gap; tenantId is now taken from the
// verified JWT only (req.user.tenant_id), same pattern as sibling routes in
// this file (see /current) and employees.routes.js.
// NOTE: the query/header/body fallback resolution this replaced was not found
// to be depended on by any internal service-to-service caller in this codebase
// (only frontend callers, which always send an authenticated request) — but if
// a future caller needs to hit this route without a user session, that caller
// needs its own review, not a reintroduction of the permissive fallback.
router.patch('/settings', authenticate, requireTenantId, requirePermission('stores.edit'), async (req, res) => {
  try {
    const storeData = req.body || {};

    const tenantId = req.user.tenant_id;


    // Convert camelCase frontend fields to snake_case for database
    // Include all fields, including localization settings
    const dbStoreData = {};
    
    // Map frontend camelCase fields to database snake_case fields
    // Handle both forms in case frontend sends inconsistent formats
    
    // Basic info fields
    if (storeData.name) dbStoreData.name = storeData.name;
    if (storeData.email) dbStoreData.email = storeData.email;
    if (storeData.phone) dbStoreData.phone = storeData.phone;
    if (storeData.address) dbStoreData.address = storeData.address;
    if (storeData.logoUrl !== undefined) dbStoreData.logo_url = storeData.logoUrl;
    if (storeData.logo_url !== undefined) dbStoreData.logo_url = storeData.logo_url;
    
    // Localization fields - handle both camelCase and snake_case versions
    if (storeData.currencyCode) dbStoreData.currency_code = storeData.currencyCode;
    if (storeData.currency_code) dbStoreData.currency_code = storeData.currency_code;
    
    if (storeData.dateFormat) dbStoreData.date_format = storeData.dateFormat;
    if (storeData.date_format) dbStoreData.date_format = storeData.date_format;
    
    if (storeData.timeFormat) dbStoreData.time_format = storeData.timeFormat;
    if (storeData.time_format) dbStoreData.time_format = storeData.time_format;
    
    if (storeData.timezone) dbStoreData.timezone = storeData.timezone;
    
    if (storeData.languageCode) dbStoreData.language_code = storeData.languageCode;
    if (storeData.language_code) dbStoreData.language_code = storeData.language_code;
    
    if (storeData.countryCode) dbStoreData.country_code = storeData.countryCode;
    if (storeData.country_code) dbStoreData.country_code = storeData.country_code;
    
    if (storeData.localeCode) dbStoreData.locale_code = storeData.localeCode;
    if (storeData.locale_code) dbStoreData.locale_code = storeData.locale_code;
    
    if (storeData.numberFormat) dbStoreData.number_format = storeData.numberFormat;
    if (storeData.number_format) dbStoreData.number_format = storeData.number_format;
    
    // Handle numeric and boolean fields with appropriate conversions
    if (storeData.decimalPrecision !== undefined) {
      dbStoreData.decimal_precision = Number(storeData.decimalPrecision);
    } else if (storeData.decimal_precision !== undefined) {
      dbStoreData.decimal_precision = Number(storeData.decimal_precision);
    }
    
    if (storeData.measurementSystem) dbStoreData.measurement_system = storeData.measurementSystem;
    if (storeData.measurement_system) dbStoreData.measurement_system = storeData.measurement_system;

    if (storeData.theme && ['light', 'dark'].includes(storeData.theme)) {
      dbStoreData.theme = storeData.theme;
    }
    
    // Convert boolean to 0/1 for MySQL
    if (storeData.allowNegativeStock !== undefined) {
      dbStoreData.allow_negative_stock = storeData.allowNegativeStock ? 1 : 0;
    } else if (storeData.allow_negative_stock !== undefined) {
      dbStoreData.allow_negative_stock = storeData.allow_negative_stock ? 1 : 0;
    }

    if (storeData.requireOpenRegister !== undefined) {
      dbStoreData.require_open_register = storeData.requireOpenRegister ? 1 : 0;
    } else if (storeData.require_open_register !== undefined) {
      dbStoreData.require_open_register = storeData.require_open_register ? 1 : 0;
    }

    // Handle defaultTaxBasis (pricing includes tax or not)
    if (storeData.defaultTaxBasis !== undefined && ['INCLUSIVE', 'EXCLUSIVE'].includes(storeData.defaultTaxBasis.toUpperCase())) {
      dbStoreData.default_tax_basis = storeData.defaultTaxBasis.toUpperCase();
    } else if (storeData.default_tax_basis !== undefined && ['INCLUSIVE', 'EXCLUSIVE'].includes(storeData.default_tax_basis.toUpperCase())) {
      // Also accept snake_case just in case
      dbStoreData.default_tax_basis = storeData.default_tax_basis.toUpperCase();
    }
    
    // Handle tax_config as a special JSON field
    if (storeData.tax_config !== undefined) {
      dbStoreData.tax_config = storeData.tax_config;
    }
    
    // Handle quickstart_progress as a special JSON field
    if (storeData.quickstartProgress !== undefined) {
      dbStoreData.quickstart_progress = storeData.quickstartProgress;
    } else if (storeData.quickstart_progress !== undefined) {
      dbStoreData.quickstart_progress = storeData.quickstart_progress;
    }
    
    // Always include tenant_id
    dbStoreData.tenant_id = tenantId;
    
    // Build the SQL query dynamically based on which fields are present
    const updateFields = [];
    const values = [];
    
    
    Object.entries(dbStoreData).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        
        // Handle specific data type conversions
        if (key === 'decimal_precision' && value !== null) {
          // Ensure decimal_precision is a number
          values.push(Number(value));
        } else if (key === 'allow_negative_stock' && value !== null) {
          // Convert boolean to 0/1 for MySQL
          values.push(value === true || value === 1 || value === '1' ? 1 : 0);
        } else if (key === 'tax_config' && value !== null) {
          // Ensure tax_config is stored as a JSON string
          values.push(JSON.stringify(value));
        } else if (key === 'quickstart_progress' && value !== null) {
          // Ensure quickstart_progress is stored as a JSON string
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    let result;
    let targetStoreId = storeData.id && storeData.id !== 'mock-store-id' ? storeData.id : null;

    if (targetStoreId) {
      // Update by explicit ID and tenant for safety
      const queryById = `UPDATE stores SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`;
      result = await pool.query(queryById, [...values, targetStoreId, tenantId]);
      result = Array.isArray(result) ? result[0] : result;
      if (result.affectedRows === 0) {
        // Fall back to update by tenant if ID didn't match
        const queryByTenant = `UPDATE stores SET ${updateFields.join(', ')} WHERE tenant_id = ? LIMIT 1`;
        result = await pool.query(queryByTenant, [...values, tenantId]);
        result = Array.isArray(result) ? result[0] : result;
      }
    } else {
      // No valid ID (likely mock-store-id); update by tenant_id
      const queryByTenant = `UPDATE stores SET ${updateFields.join(', ')} WHERE tenant_id = ? LIMIT 1`;
      result = await pool.query(queryByTenant, [...values, tenantId]);
      result = Array.isArray(result) ? result[0] : result;
    }

    if (!result || result.affectedRows === 0) {
      // No row updated. If there is no store for this tenant, create one using provided fields.
      const [existsRows] = await pool.query('SELECT id FROM stores WHERE tenant_id = ? LIMIT 1', [tenantId]);
      if (!existsRows || existsRows.length === 0) {
        const newId = uuidv4();
        const insertFields = ['id', 'tenant_id'];
        const insertPlaceholders = ['?', '?'];
        const insertValues = [newId, tenantId];

        // Map dbStoreData keys directly to columns to insert
        Object.entries(dbStoreData).forEach(([key, value]) => {
          if (value !== undefined && key !== 'tenant_id') {
            insertFields.push(key);
            insertPlaceholders.push('?');
            // Normalize booleans/numbers as in update
            if (key === 'decimal_precision' && value !== null) {
              insertValues.push(Number(value));
            } else if (key === 'allow_negative_stock' && value !== null) {
              insertValues.push(value === true || value === 1 || value === '1' ? 1 : 0);
            } else if (key === 'quickstart_progress' && value !== null) {
              insertValues.push(JSON.stringify(value));
            } else {
              insertValues.push(value);
            }
          }
        });

        // Provide sensible defaults if not supplied
        if (!insertFields.includes('name')) { insertFields.push('name'); insertPlaceholders.push('?'); insertValues.push('My Store'); }
        if (!insertFields.includes('currency_code')) { insertFields.push('currency_code'); insertPlaceholders.push('?'); insertValues.push('USD'); }
        if (!insertFields.includes('date_format')) { insertFields.push('date_format'); insertPlaceholders.push('?'); insertValues.push('MM/DD/YYYY'); }
        if (!insertFields.includes('time_format')) { insertFields.push('time_format'); insertPlaceholders.push('?'); insertValues.push('hh:mm A'); }
        if (!insertFields.includes('number_format')) { insertFields.push('number_format'); insertPlaceholders.push('?'); insertValues.push('point_comma'); }
        if (!insertFields.includes('decimal_precision')) { insertFields.push('decimal_precision'); insertPlaceholders.push('?'); insertValues.push(2); }
        if (!insertFields.includes('locale_code')) { insertFields.push('locale_code'); insertPlaceholders.push('?'); insertValues.push('en-US'); }
        if (!insertFields.includes('language_code')) { insertFields.push('language_code'); insertPlaceholders.push('?'); insertValues.push('en'); }
        if (!insertFields.includes('country_code')) { insertFields.push('country_code'); insertPlaceholders.push('?'); insertValues.push('US'); }
        if (!insertFields.includes('timezone')) { insertFields.push('timezone'); insertPlaceholders.push('?'); insertValues.push('UTC'); }
        if (!insertFields.includes('measurement_system')) { insertFields.push('measurement_system'); insertPlaceholders.push('?'); insertValues.push('metric'); }
        if (!insertFields.includes('allow_negative_stock')) { insertFields.push('allow_negative_stock'); insertPlaceholders.push('?'); insertValues.push(1); }
        if (!insertFields.includes('default_tax_basis')) { insertFields.push('default_tax_basis'); insertPlaceholders.push('?'); insertValues.push('EXCLUSIVE'); }

        const insertSql = `INSERT INTO stores (${insertFields.join(',')}) VALUES (${insertPlaceholders.join(',')})`;
        await pool.query(insertSql, insertValues);
      } else {
        // A store exists but no changes were applied – treat as no-op success
        const [existingStores] = await pool.query(
          'SELECT id, tenant_id, name, email, phone, address, logo_url, currency_code, ' +
          'date_format, time_format, timezone, language_code, country_code, ' +
          'locale_code, number_format, decimal_precision, measurement_system, ' +
          'allow_negative_stock, default_tax_basis, theme FROM stores WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 1',
          [tenantId]
        );
        if (existingStores && existingStores.length > 0) {
          const s = existingStores[0];
          return res.status(200).json({
            id: s.id,
            tenantId: s.tenant_id,
            name: s.name,
            email: s.email || '',
            phone: s.phone || '',
            address: s.address || '',
            logoUrl: s.logo_url || null,
            currencyCode: s.currency_code || 'USD',
            currencyDecimalPlaces: 2,
            dateFormat: s.date_format || 'MM/DD/YYYY',
            timeFormat: s.time_format || 'hh:mm A',
            numberFormat: s.number_format || 'point_comma',
            decimalPrecision: s.decimal_precision || 2,
            localeCode: s.locale_code || 'en-US',
            languageCode: s.language_code || 'en',
            countryCode: s.country_code || 'US',
            timezone: s.timezone || 'UTC',
            measurementSystem: s.measurement_system || 'metric',
            allowNegativeStock: !!s.allow_negative_stock,
            defaultTaxBasis: s.default_tax_basis || 'EXCLUSIVE',
            theme: s.theme || 'light'
          });
        }
        // Fallthrough will be handled by later fetch
      }
    }
    
    
    // Fetch the updated store to return to frontend - by tenant_id
    const [updatedStores] = await pool.query(
      'SELECT id, tenant_id, name, email, phone, address, logo_url, currency_code, ' +
      'date_format, time_format, timezone, language_code, country_code, ' +
      'locale_code, number_format, decimal_precision, measurement_system, ' +
      'allow_negative_stock, default_tax_basis, quickstart_progress, theme FROM stores WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 1',
      [tenantId]
    );
    
    if (updatedStores.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Store not found after update'
      });
    }
    
    // Convert snake_case database fields to camelCase for frontend
    const updatedStore = updatedStores[0];
    
    // Parse quickstart_progress if it exists
    let quickstartProgress = null;
    if (updatedStore.quickstart_progress) {
      try {
        quickstartProgress = typeof updatedStore.quickstart_progress === 'string' 
          ? JSON.parse(updatedStore.quickstart_progress) 
          : updatedStore.quickstart_progress;
      } catch (e) {
        console.error('Error parsing quickstart_progress:', e);
        quickstartProgress = null;
      }
    }
    
    const camelCaseStore = {
      id: updatedStore.id,
      tenantId: updatedStore.tenant_id,
      name: updatedStore.name,
      email: updatedStore.email || '',
      phone: updatedStore.phone || '',
      address: updatedStore.address || '',
      logoUrl: updatedStore.logo_url || null,
      currencyCode: updatedStore.currency_code || 'USD',
      currencyDecimalPlaces: 2,
      // Use actual database values instead of defaults
      dateFormat: updatedStore.date_format || 'MM/DD/YYYY',
      timeFormat: updatedStore.time_format || 'hh:mm A',
      numberFormat: updatedStore.number_format || 'point_comma',
      decimalPrecision: updatedStore.decimal_precision || 2,
      localeCode: updatedStore.locale_code || 'en-US',
      languageCode: updatedStore.language_code || 'en',
      countryCode: updatedStore.country_code || 'US',
      timezone: updatedStore.timezone || 'UTC',
      measurementSystem: updatedStore.measurement_system || 'metric',
      allowNegativeStock: !!updatedStore.allow_negative_stock,
      defaultTaxBasis: updatedStore.default_tax_basis || 'EXCLUSIVE',
      quickstartProgress: quickstartProgress,
      theme: updatedStore.theme || 'light'
    };
    
    return res.status(200).json(camelCaseStore);
  } catch (error) {
    console.error('[PATCH /api/stores/settings] Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update store settings',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/stores/current
 * @desc    Fetch the current store for the authenticated user
 * @access  Private (requires stores.read permission)
 */
/**
 * @route   GET /api/stores/current
 * @desc    Fetch the current store for the authenticated user or create one in development mode
 * @access  Private (requires stores.view permission)
 */
// Debug flag for store routes - DISABLED by default
const DEBUG_STORE = process.env.DEBUG_STORE === 'true';

// Helper for conditional debug logging
const debugLog = (...args) => {
  if (DEBUG_STORE) {
    console.log(...args);
  }
};

router.get('/current', requirePermission('stores.view'), async (req, res) => {
  // All debug logs disabled by default
  // Debug logging removed for cleaner console output
  // Debug logging removed for cleaner console output
  
  // SECURITY: tenant identity comes from the verified JWT only. Header and query
  // fallbacks were removed — they allowed a caller to read another tenant's store
  // by setting `tenant-id`. `requirePermission` above verifies the token and
  // populates req.user.
  const tenantId = req.user?.tenant_id || req.user?.tenantId;
  
  // Debug logging removed for cleaner console output

  // Check if running in development mode with permission checks skipped
  const isDevelopmentMode = process.env.NODE_ENV === 'development' && process.env.SKIP_PERMISSION_CHECKS === 'true';
  // Debug logging removed for cleaner console output

  try {
    // In development mode, use 'dev-tenant' if no tenant ID was provided
    let actualTenantId = tenantId;
    const { v4: uuidv4 } = require('uuid');

    if (isDevelopmentMode) {
      // SIMPLIFIED APPROACH FOR DEVELOPMENT MODE
      // 1. Create a fixed tenant ID for development
      const devTenantId = 'dev-tenant-123';
      
      // 2. Use the fixed tenant ID if no tenant ID was provided
      if (!actualTenantId) {
        actualTenantId = devTenantId;
        // Debug logging removed for cleaner console output
      }
      
      // 3. Make sure the tenant exists
      try {
        const [tenants] = await pool.execute('SELECT id FROM tenants WHERE id = ?', [actualTenantId]);
        if (!tenants || tenants.length === 0) {
          // Create the tenant if it doesn't exist
          // Debug logging removed for cleaner console output
          await pool.execute(
            'INSERT INTO tenants (id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
            [actualTenantId, 'Development Tenant']
          );
        }
      } catch (err) {
        // Debug logging removed for cleaner console output
        // Continue anyway - we'll try to create it when checking the store
      }
    }

    // If we still have no tenant ID, return an error
    if (!actualTenantId) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Tenant information is missing or user is not authorized.',
        developerNote: 'Make sure x-tenant-id header is included in the request'
      });
    }

    // Get the default store for this tenant
    const query = 'SELECT id, name, currency_code, tenant_id, tax_config, default_tax_basis, quickstart_progress FROM stores WHERE tenant_id = ? LIMIT 1';
    const [stores] = await pool.execute(query, [actualTenantId]);

    // If no store exists and we're in development mode, create one
    if (stores.length === 0) {
      if (isDevelopmentMode) {
        // Create a new store for the tenant
        // Debug logging removed for cleaner console output
        
        // Try to make sure the tenant exists again (double-check)
        try {
          await pool.execute(
            'INSERT IGNORE INTO tenants (id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
            [actualTenantId, 'Development Tenant']
          );
        } catch (err) {
          // Ignore errors - the tenant might already exist
        }
        
        // Create the store
        const storeId = uuidv4();
        const defaultTaxConfig = JSON.stringify({
          pricesIncludeTax: false,
          default_tax_class_id: null
        });
        
        try {
          await pool.execute(
            'INSERT INTO stores (id, tenant_id, name, currency_code, tax_config, quickstart_progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [storeId, actualTenantId, 'Default Store', 'USD', defaultTaxConfig, null]
          );
          
          // Fetch the newly created store
          const [newStores] = await pool.execute(query, [actualTenantId]);
          if (newStores.length > 0) {
            // Parse tax_config and quickstart_progress
            const store = newStores[0];
            if (store.tax_config) {
              try {
                store.tax_config = JSON.parse(store.tax_config);
              } catch (err) {
                store.tax_config = {
                  pricesIncludeTax: false,
                  default_tax_class_id: null
                };
              }
            } else {
              store.tax_config = {
                pricesIncludeTax: false,
                default_tax_class_id: null
              };
            }
            
            if (store.quickstart_progress) {
              try {
                store.quickstart_progress = JSON.parse(store.quickstart_progress);
              } catch (err) {
                store.quickstart_progress = null;
              }
            }
            
            return res.json({
              status: 'success',
              data: store
            });
          }
        } catch (err) {
          console.error(`Failed to create store: ${err.message}`);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to create default store',
            error: err.message
          });
        }
      }
      
      // If we're not in development mode or store creation failed
      return res.status(404).json({ 
        status: 'error', 
        message: 'No store found for this tenant.' 
      });
    }

    // We found a store - parse the tax_config and quickstart_progress
    const store = stores[0];
    if (store.tax_config) {
      try {
        store.tax_config = JSON.parse(store.tax_config);
      } catch (err) {
        store.tax_config = {
          pricesIncludeTax: false,
          default_tax_class_id: null
        };
      }
    } else {
      store.tax_config = {
        pricesIncludeTax: false,
        default_tax_class_id: null
      };
    }
    
    if (store.quickstart_progress) {
      try {
        store.quickstart_progress = JSON.parse(store.quickstart_progress);
      } catch (err) {
        store.quickstart_progress = null;
      }
    }

    return res.json({
      status: 'success',
      data: store
    });
  } catch (error) {
    console.error('Error handling store request:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to handle store request',
      error: error.message
    });
  }
});

// List soft-deleted, not-yet-purged stores. Tenant Admin only. Must stay
// above GET /:id below — otherwise "deleted" is swallowed as an :id param.
router.get('/deleted', authenticate, requireTenantAdmin, async (req, res) => {
  const tenantId = req.user?.tenant_id || req.user?.tenantId;

  try {
    const [rows] = await pool.execute(
      `SELECT id, name, deleted_at, scheduled_purge_at
       FROM stores
       WHERE tenant_id = ? AND deleted_at IS NOT NULL AND scheduled_purge_at > NOW()
       ORDER BY deleted_at DESC`,
      [tenantId]
    );

    const data = rows.map((s) => {
      const msRemaining = new Date(s.scheduled_purge_at).getTime() - Date.now();
      return {
        id: s.id,
        name: s.name,
        deletedAt: s.deleted_at,
        scheduledPurgeAt: s.scheduled_purge_at,
        daysRemaining: Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24))),
      };
    });

    res.json({ status: 'success', data });
  } catch (error) {
    console.error('Error listing deleted stores:', error);
    res.status(500).json({ status: 'error', message: 'Failed to list deleted stores.', error: error.message });
  }
});

/**
 * @route   GET /api/stores/:id
 * @desc    Fetch a single store by ID
 * @access  Private (requires stores.read permission)
 */
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { tenant_id: tenantId } = req.user; // Get tenant_id from authenticated user

  if (!id) {
    return res.status(400).json({ status: 'error', message: 'Store ID is required.' });
  }

  if (!tenantId) {
    return res.status(403).json({ status: 'error', message: 'Tenant information is missing or user is not authorized.' });
  }

  try {
    const query = 'SELECT id, name, currency_code, tenant_id FROM stores WHERE id = ? AND tenant_id = ?';
    const [rows] = await pool.execute(query, [id, tenantId]);

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Store not found or not associated with this tenant.' });
    }

    // Assuming your database columns are snake_case, you might want to convert to camelCase for the frontend
    // For simplicity, returning as is for now. Add a toCamelCase utility if needed.
    const store = rows[0];
    
    res.json({ status: 'success', data: store });
  } catch (error) {
    console.error('Error fetching store details:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch store details.' });
  }
});

/**
 * @route   PATCH /api/stores/:id
 * @desc    Update a store by ID
 * @access  Private (requires stores.update permission)
 */
router.patch('/:id', requirePermission('stores.edit'), async (req, res) => {
  // Debug logging removed for cleaner console output
  // Debug logging removed for cleaner console output
  // Debug logging removed for cleaner console output
  // Debug logging removed for cleaner console output
  
  const { id } = req.params;
  const { tenant_id: tenantId } = req.user;
  const updateData = req.body;

  if (!id) {
    return res.status(400).json({ status: 'error', message: 'Store ID is required.' });
  }

  if (!tenantId) {
    return res.status(403).json({ status: 'error', message: 'Tenant information is missing or user is not authorized.' });
  }

  try {
    // Check if store exists and belongs to tenant
    const checkQuery = 'SELECT id FROM stores WHERE id = ? AND tenant_id = ?';
    const [checkRows] = await pool.execute(checkQuery, [id, tenantId]);

    if (checkRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Store not found or not associated with this tenant.' });
    }

    // Build update query dynamically based on provided fields
    const updateFields = [];
    const values = [];

    // Handle tax_config as a special case - it's a JSON field
    if (updateData.tax_config) {
      updateFields.push('tax_config = ?');
      // Ensure tax_config is stored as a JSON string
      values.push(JSON.stringify(updateData.tax_config));
    }

    // Handle other fields if needed
    Object.entries(updateData).forEach(([key, value]) => {
      if (key !== 'tax_config' && value !== undefined) {
        // Convert camelCase to snake_case for database
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbField} = ?`);
        values.push(value);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No fields to update.' });
    }

    // Add store ID and tenant ID to values for WHERE clause
    values.push(id);
    values.push(tenantId);

    const updateQuery = `UPDATE stores SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`;
    const [result] = await pool.execute(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Store not found or no changes made.' });
    }

    // Fetch the updated store to return
    const fetchQuery = 'SELECT id, name, currency_code, tenant_id, tax_config FROM stores WHERE id = ? AND tenant_id = ?';
    const [rows] = await pool.execute(fetchQuery, [id, tenantId]);
    
    // Parse tax_config JSON if it exists
    if (rows[0].tax_config && typeof rows[0].tax_config === 'string') {
      try {
        rows[0].tax_config = JSON.parse(rows[0].tax_config);
      } catch (e) {
        console.error('Error parsing tax_config JSON:', e);
      }
    }

    res.json({ status: 'success', data: rows[0], message: 'Store updated successfully.' });
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update store.', error: error.message });
  }
});

/**
 * @route   DELETE /api/stores/:id
 * @desc    Delete a store — but ONLY if it has zero transactional history.
 *          This is deliberately a "safe delete for an empty/test store" tool,
 *          not full data-destruction for a store with real business data.
 *          A store with sales, products, or assigned users/roles is refused
 *          with a clear list of what's blocking it — building a real
 *          "wipe all data for a store with history" feature is a much larger,
 *          higher-risk piece of work (every module that stores `store_id`
 *          would need an audited cascade or archival plan) that hasn't been
 *          scoped or built yet. See
 *          docs/17-migration-and-roadmap/19_Store_Creation_And_Switching.md.
 * @access  Private (Tenant Admin only, via stores.delete permission)
 */
// Soft-delete. The default store can never be deleted this way (only by
// deleting the whole tenant account), and the tenant's last remaining active
// store can't be deleted either. Otherwise deletion is allowed EVEN IF the
// store has products/sales/users — the caller must pass `confirm: true` to
// acknowledge that. This marks the row deleted_at/scheduled_purge_at (+30
// days) rather than removing anything; backend/scripts/purge-expired-stores.js
// does the real hard delete once the purge date passes.
router.delete('/:id', requirePermission('stores.delete'), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id || req.user?.tenantId;
  const confirm = req.body?.confirm === true;

  if (!tenantId) {
    return res.status(403).json({ status: 'error', message: 'Tenant information is missing or user is not authorized.' });
  }

  if (!confirm) {
    return res.status(400).json({
      status: 'error',
      message: 'Deletion must be explicitly confirmed. Pass { confirm: true }.',
    });
  }

  try {
    const [storeRows] = await pool.execute(
      'SELECT id, name, is_default_store FROM stores WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [id, tenantId]
    );
    if (storeRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Store not found or not associated with this tenant.' });
    }

    const store = storeRows[0];

    if (store.is_default_store) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete your default store. Set a different store as default first — the default store can only be removed by deleting the entire tenant account.',
      });
    }

    const totalStores = await countTenantStores(tenantId);
    if (totalStores <= 1) {
      return res.status(400).json({ status: 'error', message: 'Cannot delete your only remaining store.' });
    }

    await pool.execute(
      'UPDATE stores SET deleted_at = NOW(), scheduled_purge_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    try {
      const { logActivity } = require('../services/auditLogService');
      await logActivity({
        tenant_id: tenantId,
        user_id: req.user?.id,
        action: 'STORE_SOFT_DELETED',
        entity_type: 'store',
        entity_id: id,
        details: { name: store.name },
      });
    } catch (auditErr) {
      console.error('[DELETE /api/stores/:id] Audit log failed (non-blocking):', auditErr.message);
    }

    res.json({
      status: 'success',
      message: `"${store.name}" has been deleted. It can be restored within 30 days, after which all of its data will be permanently removed.`,
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete store.', error: error.message });
  }
});

// Change which store is the tenant's default. Tenant Admin only.
router.patch('/:id/set-default', authenticate, requireTenantAdmin, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id || req.user?.tenantId;

  try {
    const [storeRows] = await pool.execute(
      'SELECT id, name FROM stores WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL',
      [id, tenantId]
    );
    if (storeRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Store not found or not associated with this tenant.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('UPDATE stores SET is_default_store = 0 WHERE tenant_id = ?', [tenantId]);
      await connection.execute('UPDATE stores SET is_default_store = 1 WHERE id = ? AND tenant_id = ?', [id, tenantId]);
      await connection.commit();
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

    try {
      const { logActivity } = require('../services/auditLogService');
      await logActivity({
        tenant_id: tenantId,
        user_id: req.user?.id,
        action: 'STORE_SET_DEFAULT',
        entity_type: 'store',
        entity_id: id,
        details: { name: storeRows[0].name },
      });
    } catch (auditErr) {
      console.error('[PATCH /api/stores/:id/set-default] Audit log failed (non-blocking):', auditErr.message);
    }

    res.json({ status: 'success', message: `"${storeRows[0].name}" is now your default store.` });
  } catch (error) {
    console.error('Error setting default store:', error);
    res.status(500).json({ status: 'error', message: 'Failed to set default store.', error: error.message });
  }
});

// Restore a soft-deleted store, provided its purge date hasn't passed. Tenant Admin only.
router.post('/:id/restore', authenticate, requireTenantAdmin, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id || req.user?.tenantId;

  try {
    const [storeRows] = await pool.execute(
      'SELECT id, name FROM stores WHERE id = ? AND tenant_id = ? AND deleted_at IS NOT NULL AND scheduled_purge_at > NOW()',
      [id, tenantId]
    );
    if (storeRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Store not found, not deleted, or past its restore window.',
      });
    }

    await pool.execute(
      'UPDATE stores SET deleted_at = NULL, scheduled_purge_at = NULL WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    try {
      const { logActivity } = require('../services/auditLogService');
      await logActivity({
        tenant_id: tenantId,
        user_id: req.user?.id,
        action: 'STORE_RESTORED',
        entity_type: 'store',
        entity_id: id,
        details: { name: storeRows[0].name },
      });
    } catch (auditErr) {
      console.error('[POST /api/stores/:id/restore] Audit log failed (non-blocking):', auditErr.message);
    }

    res.json({ status: 'success', message: `"${storeRows[0].name}" has been restored.` });
  } catch (error) {
    console.error('Error restoring store:', error);
    res.status(500).json({ status: 'error', message: 'Failed to restore store.', error: error.message });
  }
});

module.exports = router;
