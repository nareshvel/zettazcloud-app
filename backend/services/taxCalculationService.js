/**
 * Tax Calculation Service
 * 
 * This service provides functions for calculating taxes on sales items
 * and generating tax summaries grouped by tax class.
 */

const db = require('../db');

/**
 * Error thrown when tax cannot be computed reliably.
 *
 * Callers MUST handle this rather than defaulting to zero — see the note on
 * calculateSaleTaxes below.
 */
class TaxCalculationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'TaxCalculationError';
    this.statusCode = 500;
    this.cause = cause;
  }
}


/**
 * Calculate taxes for a line item based on its tax class
 * 
 * @param {Object} lineItem - The line item to calculate tax for
 * @param {Boolean} pricesIncludeTax - Whether prices include tax
 * @param {Object} taxClasses - Map of tax class IDs to tax class objects with rates
 * @returns {Object} The line item with calculated tax information
 */
const calculateLineItemTax = async (lineItem, pricesIncludeTax, taxClasses) => {
  try {
    // If no product_id or tax_class_id, return the line item without tax
    if (!lineItem.product_id) {
      return {
        ...lineItem,
        tax_class_id: null,
        tax_amount: 0,
        tax_details: []
      };
    }

    // Get the tax class ID for this product
    const productTaxClassId = lineItem.tax_class_id;
    
    // If no tax class is assigned, return the line item without tax
    if (!productTaxClassId || !taxClasses[productTaxClassId]) {
      return {
        ...lineItem,
        tax_amount: 0,
        tax_details: []
      };
    }

    const taxClass = taxClasses[productTaxClassId];
    const taxRates = taxClass.rates || [];
    
    // If no tax rates, return the line item without tax
    if (!taxRates.length) {
      return {
        ...lineItem,
        tax_amount: 0,
        tax_details: []
      };
    }

    // Calculate tax for each rate
    let totalTaxAmount = 0;
    const taxDetails = [];
    let baseAmount = lineItem.line_total;

    // If prices include tax, we need to back-calculate the base amount
    if (pricesIncludeTax) {
      // Calculate the divisor for backing out tax from inclusive prices
      let divisor = 1;
      for (const rate of taxRates) {
        if (!rate.is_compound) {
          divisor += rate.rate / 100;
        }
      }
      
      // Back-calculate the base amount
      baseAmount = lineItem.line_total / divisor;
      
      // Calculate tax for each rate
      for (const rate of taxRates) {
        if (!rate.is_compound) {
          const taxAmount = baseAmount * (rate.rate / 100);
          totalTaxAmount += taxAmount;
          
          taxDetails.push({
            tax_rate_id: rate.id,
            tax_rate_name: rate.tax_rate_name,
            rate: rate.rate,
            tax_amount: taxAmount,
            is_compound: rate.is_compound
          });
        }
      }
      
      // Calculate compound taxes
      for (const rate of taxRates) {
        if (rate.is_compound) {
          const taxAmount = (baseAmount + totalTaxAmount) * (rate.rate / 100);
          totalTaxAmount += taxAmount;
          
          taxDetails.push({
            tax_rate_id: rate.id,
            tax_rate_name: rate.tax_rate_name,
            rate: rate.rate,
            tax_amount: taxAmount,
            is_compound: rate.is_compound
          });
        }
      }
    } else {
      // For exclusive taxes, calculate tax on the line total
      // First, calculate non-compound taxes
      for (const rate of taxRates) {
        if (!rate.is_compound) {
          const taxAmount = baseAmount * (rate.rate / 100);
          totalTaxAmount += taxAmount;
          
          taxDetails.push({
            tax_rate_id: rate.id,
            tax_rate_name: rate.tax_rate_name,
            rate: rate.rate,
            tax_amount: taxAmount,
            is_compound: rate.is_compound
          });
        }
      }
      
      // Then calculate compound taxes on top of that
      for (const rate of taxRates) {
        if (rate.is_compound) {
          const taxAmount = (baseAmount + totalTaxAmount) * (rate.rate / 100);
          totalTaxAmount += taxAmount;
          
          taxDetails.push({
            tax_rate_id: rate.id,
            tax_rate_name: rate.tax_rate_name,
            rate: rate.rate,
            tax_amount: taxAmount,
            is_compound: rate.is_compound
          });
        }
      }
    }

    return {
      ...lineItem,
      tax_class_id: productTaxClassId,
      tax_amount: totalTaxAmount,
      tax_details: taxDetails
    };
  } catch (error) {
    // Same policy as calculateSaleTaxes: a failure here previously became a
    // silent zero for this line, quietly undercharging the customer on one item
    // while the rest of the sale looked normal — even harder to notice than a
    // whole-sale failure. Surface it.
    //
    // Note the early returns above are NOT errors: a line with no product_id,
    // no tax class, or no rates is legitimately untaxed and still returns 0.
    console.error('[tax] Line item calculation failed:', error, { lineItemId: lineItem?.id });
    throw new TaxCalculationError('Unable to calculate tax for a line item', error);
  }
};

/**
 * Generate a tax summary grouped by tax class
 * 
 * @param {Array} lineItems - Array of line items with calculated taxes
 * @param {Object} taxClasses - Map of tax class IDs to tax class objects
 * @returns {Array} Tax summary grouped by tax class
 */
const generateTaxSummary = (lineItems, taxClasses) => {
  try {
    // Create a map to store tax summaries by tax class
    const taxSummaryMap = {};
    
    // Process each line item
    for (const lineItem of lineItems) {
      if (!lineItem.tax_class_id || !lineItem.tax_details || lineItem.tax_amount <= 0) {
        continue;
      }
      
      const taxClassId = lineItem.tax_class_id;
      const taxClass = taxClasses[taxClassId];
      
      if (!taxClass) continue;
      
      // Initialize tax class summary if it doesn't exist
      if (!taxSummaryMap[taxClassId]) {
        taxSummaryMap[taxClassId] = {
          tax_class_id: taxClassId,
          tax_class_name: taxClass.name,
          total_tax_amount: 0,
          rate_summaries: {}
        };
      }
      
      // Add tax details to the summary
      for (const taxDetail of lineItem.tax_details) {
        const rateId = taxDetail.tax_rate_id;
        
        if (!taxSummaryMap[taxClassId].rate_summaries[rateId]) {
          taxSummaryMap[taxClassId].rate_summaries[rateId] = {
            tax_rate_id: rateId,
            tax_rate_name: taxDetail.tax_rate_name,
            rate: taxDetail.rate,
            is_compound: taxDetail.is_compound,
            total_tax_amount: 0
          };
        }
        
        taxSummaryMap[taxClassId].rate_summaries[rateId].total_tax_amount += taxDetail.tax_amount;
        taxSummaryMap[taxClassId].total_tax_amount += taxDetail.tax_amount;
      }
    }
    
    // Convert the map to an array of tax summaries
    const taxSummaries = Object.values(taxSummaryMap).map(summary => {
      return {
        ...summary,
        rate_summaries: Object.values(summary.rate_summaries)
      };
    });
    
    return taxSummaries;
  } catch (error) {
    console.error('Error generating tax summary:', error);
    return [];
  }
};

/**
 * Get all tax classes and rates for a tenant
 * 
 * @param {String} tenantId - The tenant ID
 * @param {String} storeId - The store ID
 * @returns {Object} Map of tax class IDs to tax class objects with rates
 */
const getTaxClassesWithRates = async (tenantId, storeId) => {
  try {
    const pool = db.pool;

    // Get all tax classes for this tenant (both store-specific and tenant-wide).
    // `store_id IS NULL` rows are the tenant-wide default; a specific-store row
    // OVERRIDES the default for that store, per the "replace, not merge" model
    // in docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §6
    // Q3 — if this store has ANY of its own tax classes, the tenant-wide ones
    // must not also apply (e.g. a French store shouldn't see US tax classes
    // as options just because the tenant also has tenant-wide ones defined).
    const [allRows] = await pool.query(
      `SELECT * FROM tax_classes
       WHERE tenant_id = ? AND (store_id = ? OR store_id IS NULL)`,
      [tenantId, storeId]
    );

    const hasStoreSpecific = allRows.some(tc => tc.store_id === storeId);
    const taxClassRows = hasStoreSpecific
      ? allRows.filter(tc => tc.store_id === storeId)
      : allRows;

    // Get all tax rates for these tax classes
    const taxClassIds = taxClassRows.map(tc => tc.id);
    
    if (taxClassIds.length === 0) {
      return {};
    }
    
    const [taxRateRows] = await pool.query(
      `SELECT * FROM tax_class_rates 
       WHERE tax_class_id IN (?) 
       ORDER BY priority ASC, tax_rate_name ASC`,
      [taxClassIds]
    );
    
    // Create a map of tax class IDs to tax class objects with rates
    const taxClasses = {};
    
    for (const taxClass of taxClassRows) {
      taxClasses[taxClass.id] = {
        ...taxClass,
        rates: taxRateRows.filter(rate => rate.tax_class_id === taxClass.id)
      };
    }
    
    return taxClasses;
  } catch (error) {
    // ---------------------------------------------------------------------
    // DO NOT return {} here.
    //
    // {} is the legitimate value for "this tenant has configured no tax
    // classes". Returning it on *error* makes a database failure
    // indistinguishable from a genuinely tax-free tenant — the caller then
    // computes zero tax and the sale completes undercharged, silently.
    //
    // That ambiguity was the root cause of the silent-zero bug. An empty
    // result must mean "no tax configured" and nothing else.
    // ---------------------------------------------------------------------
    console.error('[tax] Failed to load tax classes:', error);
    throw new TaxCalculationError('Unable to load tax configuration', error);
  }
};

/**
 * Calculate taxes for all line items in a sale
 * 
 * @param {Array} lineItems - Array of line items
 * @param {String} tenantId - The tenant ID
 * @param {String} storeId - The store ID
 * @param {Boolean} pricesIncludeTax - Whether prices include tax
 * @returns {Object} Object containing line items with taxes and tax summary
 */
const calculateSaleTaxes = async (lineItems, tenantId, storeId, pricesIncludeTax) => {
  // -------------------------------------------------------------------------
  // FAILURE POLICY — read before adding a try/catch here.
  //
  // This function previously caught every error, logged it, and returned
  // `total_tax_amount: 0`. That meant a transient database blip silently
  // UNDERCHARGED the customer: the sale completed, the receipt printed, and
  // nothing anywhere indicated tax had been skipped. Under-collected tax is a
  // reportable error, and it is invisible until an audit.
  //
  // A tax figure is either correct or unknown. There is no safe default, so we
  // fail loudly and let the caller decide — block the sale, retry, or fall back
  // explicitly with an audit trail. Silence is the one option that is never right.
  // -------------------------------------------------------------------------
  try {
    const taxClasses = await getTaxClassesWithRates(tenantId, storeId);

    const lineItemsWithTaxes = await Promise.all(
      lineItems.map((lineItem) => calculateLineItemTax(lineItem, pricesIncludeTax, taxClasses))
    );

    const taxSummary = generateTaxSummary(lineItemsWithTaxes, taxClasses);

    return {
      line_items: lineItemsWithTaxes,
      tax_summary: taxSummary,
      total_tax_amount: taxSummary.reduce((sum, ts) => sum + ts.total_tax_amount, 0),
      // Lets callers distinguish "tax is genuinely zero" from "tax was not configured".
      tax_classes_configured: Object.keys(taxClasses || {}).length > 0,
    };
  } catch (error) {
    // Already a TaxCalculationError from a lower layer — rethrow rather than
    // wrapping again, so the original cause stays one level away instead of
    // being buried under a chain of identical wrappers.
    if (error instanceof TaxCalculationError) throw error;

    console.error('[tax] Calculation failed — refusing to return a zero default:', error);
    throw new TaxCalculationError(
      'Unable to calculate tax for this sale. The sale was not recorded.',
      error
    );
  }
};

// ===========================================================================
// Jurisdiction-aware layer
// ===========================================================================
// The calculator above handles the arithmetic well — tax classes, multiple rates
// per class, compound tax, inclusive vs exclusive pricing. What it does not know
// is the *jurisdictional context* the sale happens in:
//
//   * a duty-free or export sale is supplied free of local consumption tax
//     (the goods leave the territory), so tax must be zero-rated regardless of
//     the tax class attached to the product
//   * a cross-border B2B sale under the reverse-charge mechanism shifts the
//     liability to the buyer: the seller charges nothing but MUST print
//     prescribed wording and the buyer's tax number. Available in 165+ VAT/GST
//     countries, but only where the jurisdiction permits it
//   * whether prices are displayed tax-inclusive is a regional retail convention
//     (EU/AU/IN inclusive, US/CA exclusive), not a per-call decision
//
// These wrappers add that context without touching the arithmetic, so existing
// callers of calculateSaleTaxes are unaffected.
// ===========================================================================

const ZERO_RATE_REASONS = {
  DUTY_FREE: 'duty_free',
  EXPORT: 'export',
  REVERSE_CHARGE: 'reverse_charge',
};

/** Zero every line's tax while preserving the original line shape. */
const zeroRateLineItems = (lineItems) =>
  lineItems.map((item) => ({
    ...item,
    tax_amount: 0,
    tax_details: [],
    // Base stays whatever the caller supplied; nothing was added on top.
    taxable_amount: item.taxable_amount ?? item.line_total ?? item.price ?? 0,
  }));

/**
 * Calculate sale taxes with jurisdictional rules applied.
 *
 * @param {Array}  lineItems
 * @param {String} tenantId
 * @param {String} storeId
 * @param {Object} [options]
 * @param {Boolean} [options.pricesIncludeTax]  Override the jurisdiction default
 * @param {Boolean} [options.reverseCharge]     Caller asserts a B2B reverse-charge sale
 * @param {String}  [options.customerTaxId]     Buyer VAT/GST number (required for reverse charge)
 * @returns {Promise<Object>} calculateSaleTaxes shape plus a `jurisdiction` block
 */
const calculateSaleTaxesWithJurisdiction = async (lineItems, tenantId, storeId, options = {}) => {
  // Required lazily: taxCalculationService is imported in contexts where the
  // jurisdiction tables may not exist yet (e.g. mid-migration tooling).
  const jurisdictionService = require('./jurisdictionService');

  const ctx = await jurisdictionService.getJurisdictionProfile(tenantId, storeId);
  const { profile } = ctx;

  // Caller wins; otherwise follow the regional retail convention.
  const pricesIncludeTax = options.pricesIncludeTax !== undefined
    ? options.pricesIncludeTax
    : profile.pricesIncludeTax;

  // --- Zero-rated: duty-free / export ------------------------------------
  if (ctx.zeroRated) {
    return {
      line_items: zeroRateLineItems(lineItems),
      tax_summary: [],
      total_tax_amount: 0,
      jurisdiction: {
        profile,
        salesMode: ctx.salesMode,
        zeroRated: true,
        zeroRateReason: ctx.isDutyFree ? ZERO_RATE_REASONS.DUTY_FREE : ZERO_RATE_REASONS.EXPORT,
        pricesIncludeTax,
        // Printed on the document — goods must physically leave the territory.
        declarationText: ctx.store.exportDeclarationText,
        requiresPassport: ctx.store.requiresPassport,
        requiresBoardingPass: ctx.store.requiresBoardingPass,
      },
    };
  }

  // --- Reverse charge: B2B, liability shifts to the buyer ------------------
  if (options.reverseCharge) {
    if (!profile.supportsReverseCharge) {
      const err = new Error(
        `Reverse charge is not available in ${profile.displayName || 'this jurisdiction'}`
      );
      err.statusCode = 400;
      throw err;
    }
    if (!options.customerTaxId) {
      // Without the buyer's tax number the invoice is not valid for the scheme,
      // so refuse rather than emit a document that cannot be relied on.
      const err = new Error('Reverse charge requires the customer tax ID on the invoice');
      err.statusCode = 400;
      throw err;
    }

    return {
      line_items: zeroRateLineItems(lineItems),
      tax_summary: [],
      total_tax_amount: 0,
      jurisdiction: {
        profile,
        salesMode: ctx.salesMode,
        zeroRated: true,
        zeroRateReason: ZERO_RATE_REASONS.REVERSE_CHARGE,
        pricesIncludeTax,
        // Prescribed wording must appear verbatim on the invoice.
        reverseChargeText: profile.reverseChargeText
          || 'Reverse charge: customer to account for tax',
        customerTaxId: options.customerTaxId,
      },
    };
  }

  // --- Standard domestic sale ---------------------------------------------
  const result = await calculateSaleTaxes(lineItems, tenantId, storeId, pricesIncludeTax);

  return {
    ...result,
    jurisdiction: {
      profile,
      salesMode: ctx.salesMode,
      zeroRated: false,
      zeroRateReason: null,
      pricesIncludeTax,
      // Presentation hints the receipt/invoice renderer needs.
      taxLabel: profile.taxLabel,
      taxIdLabel: profile.taxIdLabel,
      mandatoryInvoiceTitle: profile.mandatoryInvoiceTitle,
      requiresCustomerTaxId: profile.requiresCustomerTaxId,
      cashRoundingIncrement: profile.cashRoundingIncrement,
    },
  };
};

/**
 * Round a cash total to the jurisdiction's smallest circulating coin.
 * e.g. AU/CA round to 0.05 since 1c/2c coins were withdrawn. Electronic payments
 * are NOT rounded — only physical cash — so callers must pass the tender type.
 */
const applyCashRounding = (amount, increment) => {
  const inc = Number(increment || 0);
  if (!inc || inc <= 0) return Number(amount);
  return Math.round(Number(amount) / inc) * inc;
};

// ===========================================================================
// Server-side tax verification
// ===========================================================================
// The POS computes tax client-side for responsiveness, and the sale endpoint
// historically stored that figure verbatim (`tax, // Tax amount from frontend`).
// Subtotal was recalculated server-side, but tax was not — so a modified client,
// or anyone calling the API directly, could post `tax: 0` on any sale.
//
// This verifier recomputes tax from the server's own tax classes and compares.
// It is deliberately conservative:
//
//   * If the tenant has NO tax classes configured, the server has no opinion, so
//     the client value stands (with `verified: false`). This preserves behaviour
//     for tenants who have not set tax up.
//   * If tax classes ARE configured, a mismatch beyond tolerance is reported.
//     `mode` decides what happens — 'warn' (default) logs and keeps the client
//     value; 'enforce' substitutes the server figure. Defaulting to 'warn' means
//     turning this on cannot break a live POS; flip to 'enforce' once the logs
//     are quiet.
// ===========================================================================

/** Currency amounts are compared to the cent; allow for float dust. */
const TAX_TOLERANCE = 0.01;

/**
 * Verify a client-supplied tax figure against a server-side recomputation.
 *
 * @param {Object}  params
 * @param {Array}   params.lineItems
 * @param {Number}  params.clientTax        Tax amount asserted by the caller
 * @param {String}  params.tenantId
 * @param {String}  params.storeId
 * @param {Boolean} [params.pricesIncludeTax]
 * @param {'warn'|'enforce'} [params.mode='warn']
 * @returns {Promise<{tax:Number, verified:Boolean, mismatch:Boolean,
 *                    serverTax:Number|null, clientTax:Number, reason:String}>}
 */
const verifySaleTax = async ({
  lineItems,
  clientTax,
  tenantId,
  storeId,
  pricesIncludeTax = false,
  mode = 'warn',
}) => {
  const asserted = Number.parseFloat(clientTax);
  const clientValue = Number.isFinite(asserted) ? asserted : 0;

  // A non-numeric tax field is a client bug, not a zero-tax sale.
  if (!Number.isFinite(asserted) && clientTax !== undefined && clientTax !== null && clientTax !== '') {
    console.warn('[tax] Non-numeric tax value received and coerced to 0:', clientTax);
  }

  let server;
  try {
    server = await calculateSaleTaxes(lineItems, tenantId, storeId, pricesIncludeTax);
  } catch (err) {
    // Recomputation is a safety net. If it fails we must not block the sale on
    // the strength of a net that is itself broken — but we must be loud, since
    // this is exactly the situation the old silent-zero behaviour concealed.
    console.error('[tax] Verification unavailable, accepting client value:', err.message);
    return {
      tax: clientValue,
      verified: false,
      mismatch: false,
      serverTax: null,
      clientTax: clientValue,
      reason: 'verification_unavailable',
    };
  }

  if (!server.tax_classes_configured) {
    return {
      tax: clientValue,
      verified: false,
      mismatch: false,
      serverTax: null,
      clientTax: clientValue,
      reason: 'no_tax_classes_configured',
    };
  }

  const serverTax = Number(server.total_tax_amount || 0);
  const mismatch = Math.abs(serverTax - clientValue) > TAX_TOLERANCE;

  if (mismatch) {
    console.warn(
      `[tax] MISMATCH tenant=${tenantId} store=${storeId} ` +
      `client=${clientValue.toFixed(2)} server=${serverTax.toFixed(2)} mode=${mode}`
    );
  }

  /*
   * ENFORCE DOES NOT MEAN "SILENTLY SUBSTITUTE THE SERVER FIGURE".
   *
   * That was the original behaviour and it is a money bug. The customer has
   * already been quoted a total and, on a card sale, already been charged it.
   * Replacing the tax server-side recomputes `total` further down the
   * controller, so the recorded sale would differ from the amount actually
   * collected — the books and the card terminal disagree, and nobody is told.
   *
   * The only safe response to "the client's tax is wrong" at this point is to
   * refuse the sale, so the till re-prices and re-tenders against a figure the
   * customer can be shown. `reject` says so explicitly; the caller turns it
   * into an error rather than writing a row.
   */
  const reject = mismatch && mode === 'enforce';

  return {
    // Unchanged in every accepted case: the recorded total always matches what
    // the customer was charged.
    tax: clientValue,
    reject,
    verified: true,
    mismatch,
    serverTax,
    clientTax: clientValue,
    reason: mismatch ? `mismatch_${mode}` : 'verified',
  };
};

module.exports = {
  calculateLineItemTax,
  generateTaxSummary,
  getTaxClassesWithRates,
  calculateSaleTaxes,
  TaxCalculationError,
  // Jurisdiction-aware additions
  calculateSaleTaxesWithJurisdiction,
  applyCashRounding,
  ZERO_RATE_REASONS,
  // Server-side integrity
  verifySaleTax,
  TAX_TOLERANCE,
};
