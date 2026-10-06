const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
// const { computePromotions } = require('../services/promotionEngine'); // Temporarily disabled
const { logActivity } = require('../services/auditLogService');
const taxCalculationService = require('../services/taxCalculationService');
const documentSequenceService = require('../services/documentSequenceService');
const jurisdictionService = require('../services/jurisdictionService');
const storeProductListingService = require('../services/storeProductListingService');
const { checkUserPermission } = require('../middleware/rbacPermissionMiddleware');

// Per-sale sales_mode override values a cashier may request — anything else
// posted is ignored (falls back to the store's default), never trusted as-is.
const VALID_SALES_MODE_OVERRIDES = new Set(['domestic', 'duty_free', 'export']);

// Set to true to enable debug logs for sales controller
const DEBUG_SALES = process.env.DEBUG_SALES === 'true' || false;

// Conditional debug logging helper
const debugLog = (...args) => {
  if (DEBUG_SALES) {
    console.log('[SALES]', ...args);
  }
};

/**
 * Create a new sale
 * @route POST /api/sales
 * @access Private
 */
exports.createSale = async (req, res) => {
  debugLog('sales', 'POST /api/sales - Request received');
  const {
    items,
    tenantId, // Will be overridden by req.user.tenant_id for security
    store_id,
    cashier_id, // Will be overridden by req.user.id for security
    // subtotal, // Will be recalculated on backend
    tax, // Tax amount from frontend
    // totalAmount, // Will be recalculated on backend
    payment_method_id,
    customerId, // From frontend (camelCase)
    customer_id, // Alternative form (snake_case)
    discount_type,
    discount_value,
    promotions, // Extract promotions data from frontend
    // discount // This was overall discount amount, will be recalculated
  } = req.body;

  // Duty-free traveller capture (Sales Hub's Duty-Free Sale intake — optional,
  // only ever present when the sale went through that flow). Accept both
  // casings the way employee_id does below: fetchApi converts the frontend's
  // camelCase to snake_case, but nothing stops a direct API caller sending
  // either.
  const travellerIdType = req.body.traveller_id_type || req.body.travellerIdType || null;
  const travellerIdNumber = req.body.traveller_id_number || req.body.travellerIdNumber || null;
  const travellerIdCountry = req.body.traveller_id_country || req.body.travellerIdCountry || null;
  const travelMethodType = req.body.travel_method_type || req.body.travelMethodType || null;
  const travelMethodRef = req.body.travel_method_ref || req.body.travelMethodRef || null;
  const travelMethodDetail = req.body.travel_method_detail || req.body.travelMethodDetail || null;
  const dutyFreeDestination = req.body.destination || null;
  const dutyFreeDepartureDate = req.body.departure_date || req.body.departureDate || null;

  // Per-transaction sales-mode override (Option B — see
  // docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md §5). Only a value
  // from VALID_SALES_MODE_OVERRIDES is even considered a request; anything
  // else (missing, malformed, tampered) is treated as "no override" and the
  // store's own default applies, exactly like today. The permission check
  // that decides whether this request is actually HONORED happens below,
  // once jurisdictionCtx (the store's own default) is available to compare
  // against and log.
  const requestedSalesModeOverrideRaw = req.body.sales_mode_override || req.body.salesModeOverride || null;
  const requestedSalesModeOverride = VALID_SALES_MODE_OVERRIDES.has(requestedSalesModeOverrideRaw)
    ? requestedSalesModeOverrideRaw
    : null;
  
  // Use either camelCase or snake_case versions based on what's available
  const actualCustomerId = customerId || customer_id;
  // Debug logging removed for cleaner console output

  const saleId = uuidv4(); // Generate a new UUID for the sale
  const currentUser = req.user; // From authenticate middleware

  const actualTenantId = currentUser.tenant_id;
  const actualCashierId = currentUser.id;

  // --- Basic Validations ---
  if (!items || items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Sale must include at least one item.' });
  }
  if (!store_id) {
    return res.status(400).json({ status: 'error', message: 'Missing store_id for the sale.' });
  }
  if (tenantId && tenantId !== actualTenantId) {
    // Log if provided tenantId from body mismatches token, but use token's tenantId
    console.warn(`Request body tenantId ${tenantId} mismatches authenticated user tenant ${actualTenantId}. Using authenticated user's tenantId. User ID: ${currentUser.id}`);
  }
  if (!payment_method_id) {
    return res.status(400).json({ message: 'Payment method ID is required.' });
  }

  // --- Backend Calculations ---
  let calculatedSubtotal = 0;
  items.forEach(item => {
    // Ensure price and quantity are numbers and positive
    const price = parseFloat(item.price);
    const quantity = parseInt(item.quantity, 10);
    if (isNaN(price) || price < 0 || isNaN(quantity) || quantity <= 0) {
      // This check should ideally be more robust, or throw an error to be caught
      console.error('Invalid item price or quantity:', item);
      // Decide how to handle this - for now, skip item or throw error
      // For now, let's assume valid items from frontend, but this is a point of improvement
    }
    calculatedSubtotal += price * quantity;
  });

  let calculatedOverallDiscountAmount = 0;
  if (discount_type && discount_value != null) {
    const discVal = parseFloat(discount_value);
    if (discount_type === 'percentage' && !isNaN(discVal)) {
      calculatedOverallDiscountAmount = calculatedSubtotal * (discVal / 100);
    } else if (discount_type === 'fixed' && !isNaN(discVal)) {
      calculatedOverallDiscountAmount = discVal;
    }
  }
  // Ensure discount doesn't exceed subtotal, making total negative before tax
  calculatedOverallDiscountAmount = Math.min(calculatedOverallDiscountAmount, calculatedSubtotal);

  // --- RBAC Phase 2d: role-level discount caps (opt-in via role_limits) ---
  // Only runs when a discount is actually applied and a cap is configured —
  // tenants without role_limits rows see zero behaviour change.
  if (calculatedOverallDiscountAmount > 0) {
    const limitService = require('../services/limitService');
    const discountPercent = calculatedSubtotal > 0
      ? (calculatedOverallDiscountAmount / calculatedSubtotal) * 100
      : 0;
    for (const [limitType, attempted] of [
      ['discount_percent', discountPercent],
      ['discount_amount', calculatedOverallDiscountAmount],
    ]) {
      const check = await limitService.enforceLimit({
        req,
        userId: actualCashierId,
        tenantId: actualTenantId,
        storeId: store_id,
        limitType,
        attemptedValue: attempted,
        context: { action: 'sale_discount' },
      });
      if (!check.ok) {
        return res.status(check.status).json(check.body);
      }
    }
  }

  // --- Duty-free / export: the store's own jurisdiction setting governs, ---
  // --- not the client's tax figure -----------------------------------------
  //
  // store_jurisdiction_settings.sales_mode is a STORE-level compliance
  // setting, not a per-sale preference — a store configured duty_free/export
  // sells everything free of local consumption tax, full stop. Resolving it
  // here, server-side, means the sale is correctly zero-rated even if the
  // cashier's cart happened to compute a nonzero tax (stale client, tax
  // classes still attached to products, etc.) — the alternative, trusting the
  // client to have already zeroed it, is exactly the kind of thing a stale
  // browser tab gets wrong.
  //
  // `sales_mode`/`zero_rate_reason` are also frozen onto the sale row (below)
  // rather than re-derived from the store's CURRENT setting on every reprint —
  // a store that later changes its duty-free configuration must not silently
  // rewrite whether an old, already-charged sale looks zero-rated or not.
  let jurisdictionCtx = null;
  try {
    jurisdictionCtx = await jurisdictionService.getJurisdictionProfile(actualTenantId, store_id);
  } catch (jurisdictionErr) {
    // Fail open — a jurisdiction lookup problem must not be the reason a
    // cashier cannot complete a sale. Falls through to normal tax handling.
    console.error('[SALES] Jurisdiction lookup failed, proceeding without zero-rating:', jurisdictionErr.message);
  }

  const storeDefaultIsZeroRated = Boolean(jurisdictionCtx?.zeroRated);
  const storeDefaultSalesMode = jurisdictionCtx?.salesMode || null;

  // Per-transaction override — only takes effect if (a) a valid value was
  // requested above AND (b) the acting user actually holds
  // sales.override_tax_mode. A cashier without the permission silently gets
  // the store's own default, same as if they'd never sent an override at
  // all — this endpoint never 403s over it, since the override is opt-in
  // extra behavior, not something the request depends on to succeed.
  let overrideApplied = false;
  if (requestedSalesModeOverride) {
    try {
      const canOverride = await checkUserPermission(
        currentUser.id, 'sales.override_tax_mode', actualTenantId, store_id,
      );
      if (canOverride) {
        overrideApplied = true;
      } else {
        console.warn(
          `[SALES] User ${currentUser.id} requested sales_mode_override=${requestedSalesModeOverride} without sales.override_tax_mode — ignored, store default applies.`,
        );
      }
    } catch (permErr) {
      // Fail closed on the override specifically (NOT on the sale) — a
      // permission-check error should not grant a tax-mode override it
      // couldn't actually verify, but must also not block checkout.
      console.error('[SALES] Permission check for sales_mode_override failed, ignoring override:', permErr.message);
    }
  }

  // Whether real duty-free/export EVIDENCE was actually captured for THIS
  // sale — traveller ID + travel method are the two fields
  // DutyFreeIntakeModal.tsx treats as mandatory for its flow, so either one
  // being present means a cashier genuinely ran the Duty-Free Sale intake,
  // not just a plain walk-in checkout.
  const hasTravellerProof = Boolean(travellerIdNumber || travelMethodType || travelMethodRef);

  // 2026-09-03: previously this fell back to storeDefaultIsZeroRated whenever
  // there was no override — i.e. EVERY sale at a duty-free-configured store
  // was zero-rated by default, including an ordinary walk-in with no
  // customer and no travel documentation at all. That is backwards: you
  // cannot legally treat an anonymous local walk-in as duty-free/export just
  // because the store also happens to serve tourists. Zero-rating now
  // requires actual evidence for the specific transaction — either a
  // permissioned manual override, or real traveller data captured through
  // the Duty-Free Sale intake flow. A store's own jurisdiction/duty-free
  // configuration no longer auto-applies to a sale with neither.
  //
  // The manual override is not exempt from this requirement either — a
  // permission to override tax mode is a permission to CORRECT the mode,
  // not to zero-rate a sale with no export justification whatsoever. Only
  // an override AWAY from zero-rating (to 'domestic') needs no evidence,
  // since removing a tax exemption can't hurt compliance. An override
  // requesting 'duty_free'/'export' without hasTravellerProof is treated
  // exactly like requesting it without the permission at all: logged and
  // ignored, falling through to the evidence-based automatic resolution
  // below (which will itself resolve to domestic/taxed, since there's still
  // no traveller data).
  const overrideRequestsZeroRating = requestedSalesModeOverride === 'duty_free' || requestedSalesModeOverride === 'export';
  const overrideHonored = overrideApplied && (!overrideRequestsZeroRating || hasTravellerProof);
  if (overrideApplied && overrideRequestsZeroRating && !hasTravellerProof) {
    console.warn(
      `[SALES] User ${currentUser.id} requested sales_mode_override=${requestedSalesModeOverride} with no traveller evidence captured — ignored, falling back to automatic resolution.`,
    );
  }

  const isZeroRatedSale = overrideHonored
    ? overrideRequestsZeroRating
    : hasTravellerProof
      ? storeDefaultIsZeroRated // still store-gated: a purely domestic store can't magically become export-eligible just because someone typed a passport number
      : false;
  const salesModeForSale = overrideHonored
    ? requestedSalesModeOverride
    : isZeroRatedSale
      ? (storeDefaultSalesMode || 'duty_free')
      : 'domestic';
  const zeroRateReasonForSale = isZeroRatedSale
    ? (salesModeForSale === 'duty_free' ? 'duty_free' : 'export')
    : null;

  // --- Tax: verify the client figure against a server-side recomputation ---
  //
  // Subtotal is recalculated here (above) precisely because client input cannot
  // be trusted. Tax was the one money field that was NOT — it was taken from the
  // request and stored verbatim, so a modified client or a direct API call could
  // post `tax: 0` on any sale.
  //
  // `verifySaleTax` recomputes from the tenant's own tax classes and compares.
  // It is conservative by design: tenants with no tax classes configured are
  // unaffected, and a mismatch is logged rather than rejected unless
  // TAX_VERIFICATION_MODE=enforce. That means enabling this cannot break a live
  // POS — flip to 'enforce' once the mismatch logs are quiet.
  const TAX_VERIFICATION_MODE = process.env.TAX_VERIFICATION_MODE || 'warn';

  let taxFromRequest = parseFloat(tax) || 0;
  let taxVerification = null;
  if (isZeroRatedSale) {
    // A duty-free/export store's sale is zero-rated unconditionally — there is
    // no "verify against tax classes" step to run, because tax classes do not
    // apply here at all.
    taxFromRequest = 0;
  } else {
    try {
      taxVerification = await taxCalculationService.verifySaleTax({
        lineItems: items.map((it) => ({
          ...it,
          line_total: (parseFloat(it.price) || 0) * (parseInt(it.quantity, 10) || 0),
        })),
        clientTax: tax,
        tenantId: actualTenantId,
        storeId: store_id,
        mode: TAX_VERIFICATION_MODE,
      });
      taxFromRequest = taxVerification.tax;

      if (taxVerification.reject) {
        // enforce mode, and the figures disagree. Refuse rather than record a
        // sale whose total differs from what the customer was charged. The till
        // should refresh its tax rates and re-tender.
        console.error(
          `[SALES] REJECTED — tax mismatch in enforce mode: `
          + `client=${taxVerification.clientTax} server=${taxVerification.serverTax} `
          + `tenant=${actualTenantId} store=${store_id} user=${currentUser?.id}`
        );
        return res.status(409).json({
          status: 'error',
          code: 'TAX_MISMATCH',
          message: 'The tax on this sale does not match the tax configured for this store. '
                 + 'The sale was not recorded. Refresh and try again.',
          data: { clientTax: taxVerification.clientTax, serverTax: taxVerification.serverTax },
        });
      }

      if (taxVerification.mismatch) {
        console.warn(
          `[SALES] Tax mismatch on new sale — client=${taxVerification.clientTax} ` +
          `server=${taxVerification.serverTax} mode=${TAX_VERIFICATION_MODE} ` +
          `tenant=${actualTenantId} store=${store_id} user=${currentUser?.id}`
        );
      }
    } catch (taxErr) {
      // Never let the safety net itself break checkout — but be loud about it.
      console.error('[SALES] Tax verification failed, using client value:', taxErr.message);
    }
  }

  let finalCalculatedTotalAmount = (calculatedSubtotal - calculatedOverallDiscountAmount) + taxFromRequest;
  finalCalculatedTotalAmount = Math.max(0, finalCalculatedTotalAmount); // Ensure total is not negative

  // --- Payment Method Validation ---
  //
  // `payment_methods` is a per-tenant, admin-configurable table (Settings →
  // Payment Methods) — a tenant can name and code a method however they
  // like. The frontend sends that row's opaque ID as `payment_method_id`.
  // The fixed VALID_PAYMENT_METHODS map below exists only for the small set
  // of *system* codes that get special-cased further down (the "none" /
  // $0.00-total rule), plus as a fallback for any legacy/non-UUID caller.
  //
  // Bug fixed 2026-08-25: this used to require a UUID's DB code to appear in
  // a second, separately-maintained `codeMapping` dict before the sale could
  // proceed — so a perfectly valid, active, tenant-owned payment method (any
  // code not in that short hardcoded list, e.g. one added via Settings with
  // a custom code) was rejected with "Invalid payment method ID." An active
  // row that resolves for this tenant is now sufficient on its own; the
  // codeMapping only normalizes onto the handful of codes the special-cased
  // logic below actually checks for.
  const VALID_PAYMENT_METHODS = {
    'cash': { name: 'Cash', code: 'cash' },
    'card': { name: 'Card', code: 'card' },
    'phone': { name: 'Phone', code: 'phone' },
    'on_account': { name: 'Charge Account', code: 'on_account' },
    'none': { name: 'No Payment Required', code: 'none' },
    'stripe': { name: 'Stripe', code: 'stripe' },
    'paypal': { name: 'PayPal', code: 'paypal' }
  };

  const isSystemCode = Boolean(VALID_PAYMENT_METHODS[payment_method_id]);

  let validationPaymentMethodId = payment_method_id; // Drives the "none"/$0 special case below.
  let paymentMethod = null; // Set once we've confirmed a usable payment method, from either source.

  if (!isSystemCode) {
    try {
      const [paymentMethodRows] = await pool.query(
        'SELECT code, name FROM payment_methods WHERE id = ? AND tenant_id = ? AND is_active = 1',
        [payment_method_id, actualTenantId]
      );

      if (paymentMethodRows.length > 0) {
        const dbCode = String(paymentMethodRows[0].code || '').toLowerCase();
        const dbName = paymentMethodRows[0].name || dbCode || 'Payment';

        // Normalize onto the system codes the special-cased logic below
        // checks for; anything else is left as-is — it's still a valid,
        // tenant-owned method, just not one with special behavior here.
        const codeMapping = {
          cash: 'cash',
          card: 'card',
          phone: 'phone',
          upi: 'phone', // Legacy UPI code maps to phone
          on_account: 'on_account',
          '': 'none', // Empty code for "No Payment Required"
          none: 'none',
        };
        validationPaymentMethodId = codeMapping[dbCode] || dbCode || payment_method_id;
        paymentMethod = { name: dbName, code: validationPaymentMethodId };
      }
    } catch (dbError) {
      console.error('[SALES] Error looking up payment method:', dbError);
      // Fall through to the system-code check below rather than failing the sale outright.
    }
  }

  // Legacy code callers (or a tenant payment-method lookup that found nothing) fall back
  // to the fixed system-wide codes.
  if (!paymentMethod) {
    paymentMethod = VALID_PAYMENT_METHODS[validationPaymentMethodId] || null;
  }

  if (!paymentMethod) {
    console.log(`[SALES] Invalid payment method ID received: ${payment_method_id}`);
    console.log(`[SALES] Valid system payment methods: ${Object.keys(VALID_PAYMENT_METHODS).join(', ')}`);
    return res.status(400).json({
      message: 'Invalid payment method ID.',
      validMethods: Object.keys(VALID_PAYMENT_METHODS)
    });
  }

  debugLog(`Using payment method: ${paymentMethod.name} (${validationPaymentMethodId})`);
  
  try {

    // Validate payment amount logic for "No Payment Required"
    if (validationPaymentMethodId === 'none' && finalCalculatedTotalAmount > 0) {
      return res.status(400).json({ message: 'The \'No Payment Required\' method can only be used for $0.00 totals.' });
    }
    if (validationPaymentMethodId !== 'none' && finalCalculatedTotalAmount === 0) {
      // For $0.00 totals, ideally should use 'none' but we'll allow other methods for flexibility
      console.log(`[SALES] $0.00 total with payment method '${validationPaymentMethodId}' - consider using 'none' instead`);
    }

  } catch (error) {
    console.error('Error validating payment method:', error);
    return res.status(500).json({ status: 'error', message: 'Error validating payment method.' });
  }
  // --- End Payment Method Validation ---

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Sales employee credited for commission/targets (optional; separate from cashier)
    const salesEmployeeId = req.body.employee_id || req.body.employeeId || null;

    /*
     * Sequential document number.
     *
     * Allocated on `connection` — the SAME connection running this
     * transaction — so the number and the sale commit together. If the sale
     * fails below, the rollback returns the number to the sequence and no gap
     * appears. Allocating on the pool instead would burn a number on every
     * failed sale, which is exactly what the jurisdictions requiring
     * sequential numbering forbid.
     *
     * Most stores get NULL here: numbering is only on where the jurisdiction
     * requires it or the store opted in.
     */
    let documentNumber = null;
    try {
      const numbering = await documentSequenceService.isEnabledFor(actualTenantId, store_id);
      if (numbering.enabled) {
        documentNumber = await documentSequenceService.allocate(connection, {
          tenantId: actualTenantId,
          storeId: store_id,
          docType: 'sale',
        });
      }
    } catch (numberingError) {
      // Where numbering is MANDATORY, an unnumbered invoice is not a valid
      // document — better to refuse the sale than to issue paperwork that
      // fails an audit. Where it is merely a preference, the sale proceeds
      // without a number.
      const numbering = await documentSequenceService
        .isEnabledFor(actualTenantId, store_id)
        .catch(() => ({ mandatory: false }));

      if (numbering.mandatory) {
        // Roll back only. The `finally` at the foot of this handler releases
        // the connection — releasing here as well would return it to the pool
        // twice, and the second release corrupts the pool's accounting.
        await connection.rollback();
        console.error('[sale] mandatory sequential numbering failed:', numberingError);
        return res.status(500).json({
          status: 'error',
          message: 'Could not issue an invoice number, which is required in this jurisdiction. '
                 + 'The sale was not recorded. Please retry.',
        });
      }
      console.error('[sale] optional sequential numbering failed, continuing unnumbered:', numberingError.message);
    }

    const saleQuery = 'INSERT INTO sales (id, tenant_id, store_id, cashier_id, subtotal, tax, total, payment_method, status, payment_status, discount_type, discount_value, discount_amount, customer_id, employee_id, document_number, sales_mode, zero_rate_reason, traveller_id_type, traveller_id_number, traveller_id_country, travel_method_type, travel_method_ref, travel_method_detail, destination, departure_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const saleValues = [
      saleId,
      actualTenantId,
      store_id,
      actualCashierId,
      calculatedSubtotal,
      taxFromRequest,
      finalCalculatedTotalAmount,
      payment_method_id,
      'completed', // Assuming 'completed' and 'PAID' for now
      'PAID',
      discount_type || null,
      discount_value || null,
      calculatedOverallDiscountAmount,
      actualCustomerId || null, // Use combined variable that handles both forms
      salesEmployeeId,
      documentNumber,
      // Frozen from the store's jurisdiction setting at the moment of sale —
      // see the comment above the jurisdiction lookup for why this isn't
      // re-derived from the store's current setting on reprint.
      salesModeForSale,
      zeroRateReasonForSale,
      // Duty-free traveller capture — all null on an ordinary sale.
      travellerIdType,
      travellerIdNumber,
      travellerIdCountry,
      travelMethodType,
      travelMethodRef,
      travelMethodDetail,
      dutyFreeDestination,
      dutyFreeDepartureDate,
    ];

    const [saleResult] = await connection.query(saleQuery, saleValues);

    // Promotions: prefer frontend/cart-computed payload if provided; otherwise compute on backend
    // Accepted shapes: req.body.promotions | req.body.promoResult | req.body.cartPromotions | req.body.promo_result | req.body.cart_promotions
    let promoResult = { salePromotionsAmount: 0, appliedOffersSnapshot: [], offerAudits: [], itemDiscountAudits: [], perItem: [] };
    const clientPromo = req.body && (req.body.promotions || req.body.promoResult || req.body.cartPromotions || req.body.promo_result || req.body.cart_promotions);
    debugLog('Client promotions present?', !!clientPromo);
    debugLog('Raw client promotions payload keys:', clientPromo ? Object.keys(clientPromo) : 'none');
    debugLog('Raw client promotions payload (first 500 chars):', clientPromo ? JSON.stringify(clientPromo).substring(0, 500) : 'none');
    if (clientPromo) {
      try {
        // Extract total discount from various possible keys, handling string/number
        let totalDiscount = 0;
        const discountKeys = ['total_discount', 'totalDiscount', 'salePromotionsAmount', 'promotionsAmount', 'totalDiscountAmount', 'sale_promotions_amount', 'promotions_amount', 'total_discount_amount'];
        for (const key of discountKeys) {
          if (clientPromo[key] != null) {
            const val = Number(clientPromo[key]);
            if (!isNaN(val) && val > 0) {
              totalDiscount = val;
              debugLog(`Found total discount ${totalDiscount} from key: ${key}`);
              break;
            }
          }
        }
        
        // Extract updated items from various possible locations
        let updatedItems = [];
        if (Array.isArray(clientPromo.updated_items)) {
          updatedItems = clientPromo.updated_items;
        } else if (Array.isArray(clientPromo.updatedItems)) {
          updatedItems = clientPromo.updatedItems;
        } else if (Array.isArray(clientPromo.perItem)) {
          updatedItems = clientPromo.perItem;
        } else if (Array.isArray(clientPromo.per_item)) {
          updatedItems = clientPromo.per_item;
        }
        
        debugLog('sales', 'Extracted totalDiscount:', totalDiscount, 'updatedItems length:', updatedItems.length);
        
        // Normalize and validate basic structure
        promoResult = {
          salePromotionsAmount: Number(totalDiscount || 0),
          appliedOffersSnapshot: Array.isArray(clientPromo.appliedOffersSnapshot) ? clientPromo.appliedOffersSnapshot : (clientPromo.appliedOffers || clientPromo.applied_offers_snapshot || []),
          offerAudits: Array.isArray(clientPromo.offerAudits) ? clientPromo.offerAudits : (clientPromo.offer_audits || []),
          itemDiscountAudits: Array.isArray(clientPromo.itemDiscountAudits) ? clientPromo.itemDiscountAudits : (clientPromo.item_discount_audits || []),
          perItem: updatedItems,
        };
        debugLog('sales', 'Normalized client promoResult:', JSON.stringify({
          salePromotionsAmount: promoResult.salePromotionsAmount,
          appliedOffersSnapshotLen: (promoResult.appliedOffersSnapshot||[]).length,
          offerAuditsLen: (promoResult.offerAudits||[]).length,
          itemDiscountAuditsLen: (promoResult.itemDiscountAudits||[]).length,
          perItemLen: (promoResult.perItem||[]).length,
        }));
      } catch (e) {
        debugLog('sales', 'Client promotions payload normalization failed, will fallback to backend compute:', e?.message || e);
      }
    }
    if (!clientPromo) {
      // Backend promotion computation temporarily disabled
      debugLog('sales', 'No client promotions provided, using default empty result');
    }

    // Persist manual_discount_amount (mirror existing discount_amount) and promotions_amount from engine/client
    await connection.query(
      'UPDATE sales SET manual_discount_amount = discount_amount, promotions_amount = ?, applied_offers_json = ? WHERE id = ?',
      [Number(promoResult.salePromotionsAmount || 0), JSON.stringify(promoResult.appliedOffersSnapshot || []), saleId]
    );

    // Adjust total to include promotions: total = subtotal + tax - (manual + promotions)
    const adjustedTotal = Math.max(0, (calculatedSubtotal - calculatedOverallDiscountAmount - Number(promoResult.salePromotionsAmount || 0)) + taxFromRequest);
    await connection.query('UPDATE sales SET total = ? WHERE id = ?', [adjustedTotal, saleId]);

    // Pre-generate sale_item IDs to allow deterministic mapping for audits/updates
    // Jewelry weight-pricing fields (purity/weight/making/wastage/hsn/snapshot)
    // are optional and only present when the cart's JewelryPricingModal captured
    // them for that line — see 2026-09-03_jewelry_weight_pricing_checkout_capture.sql.
    const saleItemRecords = items.map((item) => ({
      id: uuidv4(),
      sale_id: saleId,
      product_id: item.productId || item.product_id,
      quantity: item.quantity,
      price: item.price,
      purity: item.purity ?? null,
      gross_weight: item.grossWeight ?? item.gross_weight ?? null,
      net_weight: item.netWeight ?? item.net_weight ?? null,
      making_charge: item.makingCharge ?? item.making_charge ?? null,
      wastage_value: item.wastageValue ?? item.wastage_value ?? null,
      metal_value: item.metalValue ?? item.metal_value ?? null,
      hsn_code: item.hsnCode ?? item.hsn_code ?? null,
      pricing_snapshot: (item.pricingSnapshot ?? item.pricing_snapshot)
        ? JSON.stringify(item.pricingSnapshot ?? item.pricing_snapshot)
        : null,
    }));

    const saleItemQuery = `INSERT INTO sale_items
      (id, sale_id, product_id, quantity, price, purity, gross_weight, net_weight, making_charge, wastage_value, metal_value, hsn_code, pricing_snapshot)
      VALUES ?`;
    const saleItemValues = saleItemRecords.map(r => [
      r.id,
      r.sale_id,
      r.product_id,
      r.quantity,
      r.price,
      r.purity,
      r.gross_weight,
      r.net_weight,
      r.making_charge,
      r.wastage_value,
      r.metal_value,
      r.hsn_code,
      r.pricing_snapshot,
    ]);
    
    if (saleItemValues.length > 0) {
        await connection.query(saleItemQuery, [saleItemValues]);
        // Initialize per-item columns with defaults (will be updated with frontend data if available)
        await connection.query(
          `UPDATE sale_items
           SET 
             base_unit_price = IFNULL(base_unit_price, price),
             manual_discount_per_unit = 0,
             promo_discount_per_unit = 0,
             tax_per_unit = 0,
             final_unit_price = price
           WHERE sale_id = ?`,
          [saleId]
        );

        // Apply per-item promo results (from client or backend engine)
        if (Array.isArray(promoResult.perItem) && promoResult.perItem.length > 0) {
          // Build product occurrence map for robust matching when client sends partial perItem
          const productToIndices = new Map();
          for (let i = 0; i < saleItemRecords.length; i++) {
            const pid = saleItemRecords[i].product_id;
            if (!productToIndices.has(pid)) productToIndices.set(pid, []);
            productToIndices.get(pid).push(i);
          }
          const usedIndexCount = new Map();

          for (const comp of promoResult.perItem) {
            // Prefer explicit mapping via item_index or sale_item_id if provided
            let targetIndex = Number.isInteger(comp.item_index ?? comp.itemIndex) ? (comp.item_index ?? comp.itemIndex) : null;
            if (targetIndex == null && (comp.sale_item_id || comp.saleItemId)) {
              const sid = comp.sale_item_id || comp.saleItemId;
              targetIndex = saleItemRecords.findIndex(r => r.id === sid);
            }
            const compProductId = comp.product_id || comp.productId;
            if (targetIndex == null && compProductId) {
              const list = productToIndices.get(compProductId) || [];
              const used = usedIndexCount.get(compProductId) || 0;
              targetIndex = list[used] ?? null;
              if (targetIndex != null) usedIndexCount.set(compProductId, used + 1);
            }
            // Fallback by sequential index if still unknown and array is aligned
            if (targetIndex == null && promoResult.perItem.length === saleItemRecords.length) {
              targetIndex = promoResult.perItem.indexOf(comp);
            }
            if (targetIndex == null || !saleItemRecords[targetIndex]) continue;

            const rec = saleItemRecords[targetIndex];
            // Normalize per-item fields from client (support snake_case and camelCase)
            const promoPerUnit = (comp.promo_discount_per_unit ?? comp.promoDiscountPerUnit ?? 0);
            const finalUnit = (comp.final_unit_price ?? comp.finalUnitPrice ?? rec.price);
            const taxPerUnit = (comp.tax_per_unit ?? comp.taxPerUnit ?? 0);
            const appliedJsonRaw = (comp.applied_discounts_json ?? comp.appliedDiscountsJson ?? comp.appliedDiscounts ?? []);
            const appliedJson = Array.isArray(appliedJsonRaw) ? appliedJsonRaw : [];

            debugLog('sales', 'Applying per-item promo', {
              saleId,
              sale_item_id: rec.id,
              product_id: rec.product_id,
              targetIndex,
              promoPerUnit,
              finalUnit,
              taxPerUnit,
              appliedDiscountsCount: appliedJson.length
            });
            await connection.query(
              `UPDATE sale_items SET 
                 promo_discount_per_unit = ?,
                 final_unit_price = ?,
                 tax_per_unit = ?,
                 applied_discounts_json = ?
               WHERE id = ?`,
              [
                Number(promoPerUnit || 0),
                Number(finalUnit || rec.price),
                Number(taxPerUnit || 0),
                JSON.stringify(appliedJson || []),
                rec.id,
              ]
            );
          }
        }

        // Phase-safe: insert sale_applied_offers audit rows if any
        if (Array.isArray(promoResult.offerAudits) && promoResult.offerAudits.length > 0) {
          const insertOfferAuditSql = `
            INSERT INTO sale_applied_offers (
              id, sale_id, tenant_id, store_id, offer_id, offer_name, offer_type,
              discount_value, priority, rules_json, price_tiers_json, total_discount_amount
            ) VALUES ?`;
          const offerAuditValues = promoResult.offerAudits.map(oa => [
            uuidv4(),
            saleId,
            actualTenantId,
            store_id,
            oa.offer_id || null,
            oa.offer_name,
            oa.offer_type,
            oa.discount_value ?? null,
            oa.priority ?? null,
            JSON.stringify(oa.rules_json ?? null),
            JSON.stringify(oa.price_tiers_json ?? null),
            Number(oa.total_discount_amount || 0),
          ]);
          await connection.query(insertOfferAuditSql, [offerAuditValues]);
        }

        // Insert sale_item_discounts audit rows if any
        if (Array.isArray(promoResult.itemDiscountAudits) && promoResult.itemDiscountAudits.length > 0) {
          const insertItemAuditSql = `
            INSERT INTO sale_item_discounts (
              id, sale_id, sale_item_id, tenant_id, store_id, product_id,
              offer_id, offer_name, offer_type, rule_type, rule_entity_id,
              quantity_applied, discount_per_unit, total_discount_amount, metadata_json
            ) VALUES ?`;
          const itemAuditValues = promoResult.itemDiscountAudits.map(ad => {
            const idx = Number(ad.item_index || 0);
            const saleItemId = saleItemRecords[idx] ? saleItemRecords[idx].id : null;
            return [
              uuidv4(),
              saleId,
              saleItemId,
              actualTenantId,
              store_id,
              ad.product_id,
              ad.offer_id || null,
              ad.offer_name,
              ad.offer_type,
              ad.rule_type ?? null,
              ad.rule_entity_id ?? null,
              ad.quantity_applied ?? null,
              Number(ad.discount_per_unit || 0),
              Number(ad.total_discount_amount || 0),
              JSON.stringify(ad.metadata_json ?? null),
            ];
          });
          await connection.query(insertItemAuditSql, [itemAuditValues]);
        }
    } else {
        // This case should have been caught by the initial items length check
        console.warn(`Sale ${saleId} has no items to insert into sale_items, though initial check passed.`);
    }

    const stockItems = items.filter((item) => !(item.pieceId || item.piece_id));
    for (const item of stockItems) {
      const productId = item.productId || item.product_id;
      const quantity = Number(item.quantity);
      const [productRows] = await connection.query(
        'SELECT store_id, stock_quantity FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [productId, actualTenantId]
      );
      if (!productRows.length) {
        throw new Error(`Product ${productId} was not found for this tenant.`);
      }

      const isSharedProduct = productRows[0].store_id === null;

      let stockBefore;
      let stockAfter;
      if (isSharedProduct) {
        // Tenant-wide shared product — stock lives per-store in
        // store_product_listings, not on the products row itself.
        // See docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
        stockAfter = await storeProductListingService.adjustStockForUpdate(
          connection, actualTenantId, store_id, productId, -quantity
        );
        stockBefore = stockAfter + quantity;
      } else {
        stockBefore = Number(productRows[0].stock_quantity || 0);
        stockAfter = stockBefore - quantity;
        await connection.query(
          'UPDATE products SET stock_quantity = ? WHERE id = ? AND tenant_id = ?',
          [stockAfter, productId, actualTenantId]
        );
      }

      await connection.query(
        `INSERT INTO stock_adjustments (
          id, tenant_id, store_id, product_id, user_id, adjustment_type,
          reason_code, quantity_adjusted, stock_before_adjustment,
          stock_after_adjustment, notes, adjustment_date
        ) VALUES (?, ?, ?, ?, ?, 'DECREMENT', 'SALE_TRANSACTION', ?, ?, ?, ?, NOW())`,
        [uuidv4(), actualTenantId, store_id, productId, actualCashierId,
          quantity, stockBefore, stockAfter, `Sale ${saleId}`]
      );
    }

    // --- Serialized pieces: mark scanned pieces as sold and attach them to the sale ---
    // Accepts `piece_ids: [...]` (scanned at checkout) or per-item `pieceId`.
    try {
      const piecesFromBody = Array.isArray(req.body.piece_ids) ? req.body.piece_ids : [];
      const piecesFromItems = (items || [])
        .map((it) => it.pieceId || it.piece_id)
        .filter(Boolean);
      const pieceIds = [...new Set([...piecesFromBody, ...piecesFromItems])];

      for (const pieceId of pieceIds) {
        const [r] = await connection.query(
          `UPDATE product_pieces
              SET status = 'sold', sale_id = ?
            WHERE id = ? AND tenant_id = ? AND status IN ('available','hold')`,
          [saleId, pieceId, actualTenantId]
        );
        if (r.affectedRows) {
          // Keep the product's available count in sync with its pieces.
          await connection.query(
            `UPDATE products p
                SET p.stock_quantity = (
                      SELECT COUNT(*) FROM product_pieces pp
                       WHERE pp.product_id = p.id AND pp.tenant_id = p.tenant_id AND pp.status = 'available'
                    )
              WHERE p.tenant_id = ?
                AND p.id = (SELECT product_id FROM product_pieces WHERE id = ?)`,
            [actualTenantId, pieceId]
          );
        }
      }
    } catch (pieceErr) {
      console.warn('[SALES] serialized piece update skipped:', pieceErr.message);
    }

    // --- Old-gold voucher redemption: mark the voucher redeemed against this sale ---
    try {
      const voucherId = req.body.old_gold_voucher_id || req.body.oldGoldVoucherId;
      if (voucherId) {
        await connection.query(
          `UPDATE old_gold_purchases
              SET status = 'redeemed', redeemed_sale_id = ?
            WHERE id = ? AND tenant_id = ? AND status IN ('valued','credited')`,
          [saleId, voucherId, actualTenantId]
        );
      }
    } catch (voucherErr) {
      console.warn('[SALES] old-gold voucher redemption skipped:', voucherErr.message);
    }

    await connection.commit();

    // Log successful sale creation
    try {
      await logActivity({
        tenant_id: actualTenantId,
        user_id: actualCashierId, // This is req.user.id
        username: currentUser.email, // Assuming req.user has email
        action_type: 'SALE_PROCESSED',
        description: `Sale ${saleId} processed successfully for amount ${adjustedTotal.toFixed(2)}. Items: ${items.length}.`,
        details: {
          saleId: saleId,
          totalAmount: adjustedTotal,
          itemCount: items.length,
          customerId: actualCustomerId || null,
          paymentMethodId: payment_method_id,
          storeId: store_id
        },
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    } catch (logError) {
      console.error('Failed to log sale activity:', logError);
      // Do not let logging failure prevent sending response to client
    }

    // Separate, explicit audit entry whenever a sale's tax mode was actually
    // overridden away from the store's default — this is the compliance
    // trail the per-transaction override plan called for. Logged distinctly
    // from SALE_PROCESSED so it's easy to find/report on independently
    // (e.g. "show every sale a cashier zero-rated against store policy").
    if (overrideHonored) {
      try {
        await logActivity({
          tenant_id: actualTenantId,
          user_id: actualCashierId,
          username: currentUser.email,
          action_type: 'SALE_TAX_MODE_OVERRIDDEN',
          description: `Sale ${saleId} tax mode overridden to "${salesModeForSale}" (store default: "${storeDefaultSalesMode || 'domestic'}").`,
          details: {
            saleId,
            storeId: store_id,
            storeDefaultSalesMode: storeDefaultSalesMode || 'domestic',
            appliedSalesMode: salesModeForSale,
            storeDefaultIsZeroRated,
            appliedIsZeroRated: isZeroRatedSale,
          },
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
        });
      } catch (overrideLogError) {
        console.error('Failed to log sale tax-mode override:', overrideLogError);
      }
    }

    res.status(201).json({
      status: 'success',
      // documentNumber is what the customer sees on the receipt; saleId is the
      // internal UUID. Returning both means the receipt does not have to fall
      // back to printing a UUID as an "invoice number".
      data: { saleId, documentNumber },
      message: 'Sale created successfully'
    });

  } catch (error) {
    await connection.rollback();
    // Use the correct saleId in the error message if it was generated
    console.error(`Error creating sale ${saleId} for tenant ${actualTenantId}:`, error);
    console.error('SQL Error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    res.status(500).json({ status: 'error', message: 'Failed to create sale.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
};
