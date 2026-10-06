// Service for receipt generation and formatting
import { fetchApi } from './api';
import type { Sale, SaleItem, Store } from '@/types'; // Import Sale, SaleItem, and Store (used as StoreInfo) interfaces
import { renderSaleWithTemplate, renderReturnWithTemplate } from './templateReceiptService';
import { getJurisdictionContext } from './jurisdictionService';
import { getTenantFieldOverrides } from './industryService';
// Dynamic imports for discountService functions

// Removed local Sale and SaleItem interfaces

export interface ReceiptData {
  html: string;
  css: string;
}

// Extended interface for the full data returned by getReceiptForSale
export interface FullReceiptData extends ReceiptData {
  saleId: string;
  /**
   * The issued sequential number, when the store has numbering switched on.
   * Null otherwise — most stores do not, and a UUID is not a substitute.
   */
  documentNumber?: string | null;
  storeId?: string | null;
  subtotal: number;
  discount?: number | null;
  tax: number;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number; // Line total
    product_id: string; // Keep as product_id if that's what the caller expects, or change to productId
  }>;
  customerName?: string | null;
  cashierName?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
}

export const getReceiptForSale = async (
  saleId: string,
  printerSettings?: any,
  storeInfo?: Store, // optional
  prefetchedSale?: Sale, // NEW: prefer client copy (may include item discounts)
  // Print Module Phase 1: which template family to render as. Defaults to
  // 'receipt' so every existing caller keeps working unchanged; POS checkout
  // passes the store's `defaultSaleDocumentType` explicitly (see useReceipt.ts).
  documentType: 'receipt' | 'invoice' = 'receipt',
  templateId?: string | null,
): Promise<FullReceiptData> => {
  try {
    // Prefer prefetchedSale if provided
    let sale: Sale | null = prefetchedSale ? { ...prefetchedSale } : null;

    // Always fetch backend too (to fill in missing fields), but avoid overwriting richer client data
    let apiSaleData: any = null;
    try {
      const saleResponse = await fetchApi<any>(`/sales/${saleId}`);
      apiSaleData = (saleResponse as any).data || saleResponse;
    } catch (error: any) {
      console.error('API error while fetching sale (continuing with prefetchedSale if available):', error);
      if (!sale) throw new Error(`Failed to fetch sale data: ${error.message || String(error)}`);
    }

    if (!sale && apiSaleData) {
      // Build from backend if no prefetchedSale
      sale = {
        id: apiSaleData.id,
        tenantId: apiSaleData.tenant_id,
        storeId: apiSaleData.store_id,
        cashierId: apiSaleData.cashier_id,
        items: [],
        subtotal: parseFloat(apiSaleData.subtotal),
        tax: parseFloat(apiSaleData.tax),
        discountAmount: (apiSaleData.discount_amount && parseFloat(apiSaleData.discount_amount) > 0) ? parseFloat(apiSaleData.discount_amount) : ((apiSaleData.discount_type === 'fixed' && apiSaleData.discount_value && parseFloat(apiSaleData.discount_value) > 0) ? parseFloat(apiSaleData.discount_value) : (apiSaleData.discount ? parseFloat(apiSaleData.discount) : 0)),
        total: parseFloat(apiSaleData.total_amount || apiSaleData.total),
        paymentMethod: apiSaleData.payment_method,
        status: apiSaleData.status,
        createdAt: apiSaleData.createdAt || apiSaleData.created_at,
        customerName: apiSaleData.customerName || apiSaleData.customer_name,
        cashierName: apiSaleData.cashierName || apiSaleData.cashier_name,
        paymentMethodName: apiSaleData.paymentMethodName || apiSaleData.paymentMethodDisplay || apiSaleData.payment_method_name || apiSaleData.payment_method_display,
        discountType: apiSaleData.discount_type,
        discountValue: apiSaleData.discount_value ? parseFloat(apiSaleData.discount_value) : undefined,
        employeeName: apiSaleData.employeeName || apiSaleData.employee_name,
      } as Sale;
    }

    if (!sale) throw new Error('Invalid sale data');

    // The resolved payment method name (never the raw payment_methods.id —
    // see salesController.js's getSaleById) only ever came from apiSaleData.
    // A prefetchedSale — the sale object handed back immediately after
    // checkout, which is exactly the common case for "print right after
    // sale" — carries the raw ID submitted to checkout as `paymentMethod`
    // and never had a resolved name to begin with. This used to only get
    // filled in on the `!sale` branch above, which a prefetchedSale always
    // skips, so a same-session receipt printed the raw ID (e.g.
    // "demo0001-jw00-...") instead of "Cash"/"Card"/etc.
    if (!sale.paymentMethodName && apiSaleData) {
      sale.paymentMethodName =
        apiSaleData.paymentMethodName || apiSaleData.paymentMethodDisplay ||
        apiSaleData.payment_method_name || apiSaleData.payment_method_display || undefined;
    }

    // Prefer items from prefetchedSale when present (they may include per-line discounts)
    const hasClientItems = Array.isArray(prefetchedSale?.items) && (prefetchedSale!.items.length > 0);
    if (hasClientItems) {
      sale.items = prefetchedSale!.items;
    } else if ((!sale.items || sale.items.length === 0) && apiSaleData) {
      try {
        const itemsData = await fetchApi<any>(`/sales/${saleId}/items`);
        const rawItems = (itemsData as any).data || itemsData || [];
        sale.items = Array.isArray(rawItems) ? rawItems.map((apiItem: any) => ({
          productId: apiItem.product_id || apiItem.productId,
          id: apiItem.id,
          quantity: parseInt(apiItem.quantity, 10),
          price: parseFloat(apiItem.price),
          name: apiItem.productName || apiItem.product_name || apiItem.name || 'Unknown Item',
          discount: apiItem.discount_amount ? parseFloat(apiItem.discount_amount) : (apiItem.discount ? parseFloat(apiItem.discount) : undefined),
          attributes: apiItem.attributes ?? undefined,
        } as SaleItem)) : [];
      } catch (error) {
        console.error('Failed to fetch sale items:', error);
        sale.items = sale.items || [];
      }
    }

    // Enrich items with applied discounts using cached promotional offers when missing
    try {
      const items = Array.isArray(sale.items) ? sale.items : [];
      const missingApplied = items.some((it: any) => !Array.isArray(it?.appliedDiscounts) || it.appliedDiscounts.length === 0);
      if (items.length > 0 && missingApplied) {
        // Try cached offers from localStorage first
        let cachedOffers: any[] = [];
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem('cache_promotional_offers') : null;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.data)) {
              cachedOffers = parsed.data;
            }
          }
        } catch (e) {
          console.warn('[RECEIPT] Failed reading cached offers:', e);
        }

        // Fallback: fetch active offers if cache empty
        if (!cachedOffers || cachedOffers.length === 0) {
          try {
            const { getAllActiveOffers } = await import('./discountService');
            cachedOffers = await getAllActiveOffers();
          } catch (e) {
            console.warn('[RECEIPT] Failed to fetch active offers, proceeding without enrichment');
            cachedOffers = [];
          }
        }

        if (cachedOffers && cachedOffers.length > 0) {
          // Build minimal cart items for discount engine
          const cartItems = items.map((it: any) => {
            const product = {
              id: String(it.productId),
              price: Number(it.price) || 0,
              // Optional fields used in applicability checks; keep undefined if unknown
              categoryId: it.categoryId != null ? String(it.categoryId) : undefined,
              promotionalOfferId: it.promotionalOfferId != null ? String(it.promotionalOfferId) : undefined,
            } as any; // Minimal Product shape
            return {
              product,
              quantity: Number(it.quantity) || 0,
              appliedDiscounts: [],
              originalPrice: product.price,
              finalPrice: product.price,
              unitPrice: product.price,
            } as any;
          });

          try {
            const { applyItemWiseDiscounts } = await import('./discountService');
            const res = applyItemWiseDiscounts(cartItems as any, cachedOffers as any);
            const updated = res.updatedItems || [];
            // Write back applied discounts and per-line discount totals so receipt math and labels work
            sale.items = items.map((it: any, idx: number) => {
              const u = updated[idx];
              if (u && Array.isArray(u.appliedDiscounts) && u.appliedDiscounts.length > 0) {
                const lineDiscount = u.appliedDiscounts.reduce((a: number, d: any) => a + (Number(d.discountAmount) || 0), 0);
                return {
                  ...it,
                  appliedDiscounts: u.appliedDiscounts,
                  // Provide common discount fields used by receipt rendering
                  discountAmount: Math.round(lineDiscount * 100) / 100,
                  discount_amount: Math.round(lineDiscount * 100) / 100,
                };
              }
              return it;
            });
          } catch (e) {
            console.warn('[RECEIPT] Discount enrichment failed:', e);
          }
        }
      }
    } catch (e) {
      console.warn('[RECEIPT] Skipping discount enrichment due to error:', e);
    }

    // Totals: prefer prefetchedSale values if present (they reflect cart logic)
    if (prefetchedSale) {
      sale.subtotal = prefetchedSale.subtotal ?? sale.subtotal;
      sale.tax = prefetchedSale.tax ?? sale.tax;
      sale.discountAmount = (typeof prefetchedSale.discountAmount === 'number') ? prefetchedSale.discountAmount : sale.discountAmount;
      sale.total = prefetchedSale.total ?? sale.total;
    }
    // console.log('[getReceiptForSale] Mapped sale object:', JSON.stringify(sale, null, 2));
    
    if (!sale || !sale.id) {
      throw new Error('Invalid sale data received from API');
    }
    
    // storeInfo fallback fetch unchanged
    
    // Item formatting is now handled within generateReceiptHtml
    // console.log('[getReceiptForSale] sale.items before passing to generateReceiptHtml:', JSON.stringify(sale.items, null, 2));
    
    // Attempt to get store_id from the sale data itself if available
    const storeIdToFetch = sale.storeId; // Use sale.storeId
    if (!storeInfo && storeIdToFetch) {
        try {
        const storeResult = await fetchApi<any>(`/stores/${storeIdToFetch}`);
        if (storeResult && (storeResult as any).data) {
          storeInfo = (storeResult as any).data as Store;
        } else {
          storeInfo = (storeResult as Store) || { id: String(storeIdToFetch), tenantId: 'unknown', name: 'Store', currencyCode: 'USD' };
        }
      } catch (error) {
        console.error('Error fetching store details:', error);
        // Fallback to a very basic default
        storeInfo = { id: String(storeIdToFetch), tenantId: 'unknown', name: 'Store', currencyCode: 'USD' }; 
      }
    } else if (!storeInfo) {
      // If still no storeInfo and no ID to fetch with, use a hardcoded default or error
      console.warn('Store information is missing and could not be fetched. Using default placeholder for receipt.');
      storeInfo = { id: 'default', tenantId: 'unknown', name: 'Your Store', currencyCode: 'USD' }; // Basic fallback
    }  

    /*
     * Template-driven printing — the only path.
     *
     * The hardcoded legacy receipt (formerly `generateReceiptHtml`) was
     * removed 2026-08-25 as part of Print Module Phase 1. It is safe to do
     * this unconditionally now because every tenant has a published default
     * `receipt` template (backfilled via
     * backend/scripts/provision-missing-print-templates.js, and provisioned
     * automatically for every new tenant going forward). A missing or failed
     * template now surfaces as a clear, actionable error instead of silently
     * falling back to a document nobody designed.
     */

    // Jurisdiction-driven wording (the export declaration, the tax label, the
    // mandated invoice title, etc.). Failure is silent: the compliance blocks
    // that read these fields all self-suppress on absent data, so a lookup
    // problem just means a plainer document, not a blocked print.
    const jurisdictionCtx = await getJurisdictionContext().catch(() => null);
    const fieldOverrides = await getTenantFieldOverrides('product').catch(() => []);

    // Jewelry tenants publish their invoice under `jewelry_invoice`, not the
    // general `invoice` type (see retailProfileService.js's INDUSTRY_TEMPLATES).
    // A store choosing "print sales as Invoice" shouldn't need to know that —
    // try the plain type first, and only fall back to the jewelry-specific one
    // if nothing is published under it.
    const templateTypesToTry = documentType === 'invoice' ? ['invoice', 'jewelry_invoice'] : [documentType];

    let rendered: Awaited<ReturnType<typeof renderSaleWithTemplate>> = null;
    for (const templateType of templateTypesToTry) {
      rendered = await renderSaleWithTemplate(sale as any, {
      templateType,
      templateId,
      paperWidth: printerSettings?.paperWidth,
      storeId: storeInfo?.id,
      logoUrl: (storeInfo as any)?.logo_url || (storeInfo as any)?.logoUrl || null,
      context: {
        store: {
          name: storeInfo?.name,
          address: storeInfo?.address,
          phone: storeInfo?.phone,
          email: storeInfo?.email,
          taxId: (storeInfo as any)?.tax_id,
          currencyCode: (storeInfo as any)?.currencyCode,
        },
        // Without this the document prints a raw ISO timestamp.
        dateFormat: (storeInfo as any)?.dateFormat,
        numbering: {
          showNumberOnReceipt: (storeInfo as any)?.showNumberOnReceipt,
          showNumberOnInvoice: (storeInfo as any)?.showNumberOnInvoice,
        },
        fieldOverrides,
        jurisdiction: jurisdictionCtx ? {
          mandatoryInvoiceTitle: jurisdictionCtx.profile?.mandatoryInvoiceTitle,
          requiresCustomerTaxId: jurisdictionCtx.profile?.requiresCustomerTaxId,
          taxLabel: jurisdictionCtx.profile?.taxLabel,
          taxIdLabel: jurisdictionCtx.profile?.taxIdLabel,
          // Configurable per store, so read from the store settings layer,
          // not the shared country profile.
          exportDeclarationText: jurisdictionCtx.store?.exportDeclarationText,
          fiscalizationEnabled: jurisdictionCtx.profile?.fiscalizationEnabled,
        } : undefined,
        },
      });
      if (rendered) break;
    }

    if (!rendered) {
      throw new Error(
        `No published ${documentType} template is configured for this store. ` +
        'Go to Settings → Printer Settings and publish one before printing.'
      );
    }

    const receiptData: ReceiptData = { html: rendered.html, css: rendered.css };

    return {
      html: receiptData.html,
      css: receiptData.css,
      saleId: sale.id,
      documentNumber: (sale as any).documentNumber ?? (sale as any).document_number ?? null,
      storeId: sale.storeId, // Use sale.storeId
      subtotal: sale.subtotal,
      discount: sale.discountAmount, // Use sale.discountAmount
      tax: sale.tax,
      total: sale.total,
      items: (sale.items || []).map((item: SaleItem) => ({ // Map to a simpler structure if needed by caller, explicitly type item
        name: item?.name || 'Unknown Item',
        quantity: Number(item?.quantity) || 0,
        price: Number(item?.price) || 0, // Unit price
        total: (Number(item?.quantity) || 0) * (Number(item?.price) || 0), // Line total
        product_id: (item as any)?.productId
      })),
      customerName: sale.customerName,
      cashierName: sale.cashierName || sale.employeeName,
      paymentMethod: sale.paymentMethod, // Use sale.paymentMethod
      createdAt: sale.createdAt || new Date().toISOString(), // Use sale.createdAt
    };
  } catch (error) {
    console.error('Error generating receipt:', error);
    // Return a FullReceiptData compliant object in case of error
    return {
      html: `<p>Error generating receipt: ${error instanceof Error ? error.message : 'Unknown error'}</p>`,
      css: '',
      saleId: saleId, // Include saleId if available, or a placeholder
      documentNumber: null,
      storeId: storeInfo?.id || 'unknown',
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      items: [],
      customerName: 'N/A',
      cashierName: 'N/A',
      paymentMethod: 'N/A',
      createdAt: new Date().toISOString(),
    };
  }
};

// Generate receipt for Sales Return
export const getReceiptForReturn = async (
  salesReturnId: string,
  printerSettings?: any,
  storeInfo?: Store
): Promise<ReceiptData> => {
  // Fetch sales return data
  let retResp: any;
  try {
    retResp = await fetchApi<any>(`/sales-returns/${salesReturnId}`);
  } catch (err: any) {
    console.error('Error fetching sales return:', err);
    throw err;
  }

  const ret: any = retResp?.data || retResp;
  // Items fetch if missing. Assigned back onto `ret.items` — the template
  // renderer below reads items off `ret`, and previously this local `items`
  // fetch was silently discarded once the legacy inline renderer (which used
  // the local variable directly) was removed.
  if (!Array.isArray(ret?.items) || ret.items.length === 0) {
    try {
      const itemsJson = await fetchApi<any>(`/sales-returns/${salesReturnId}/items`);
      ret.items = itemsJson?.data || itemsJson || [];
    } catch (e) {
      // ignore — renderReturnWithTemplate handles an empty item list gracefully
    }
  }

  /*
   * Template-driven refund slip — the only path.
   *
   * Requires the store's dedicated published `return` template. Refunds never
   * fall back to a sale receipt or hardcoded legacy HTML. Media and delivery
   * follow the store's configured default sales-document route until a separate
   * return route is introduced.
   */
  const rendered = await renderReturnWithTemplate(ret, {
    paperWidth: printerSettings?.paper_width,
    storeId: storeInfo?.id,
    logoUrl: (storeInfo as any)?.logo_url || (storeInfo as any)?.logoUrl || null,
    context: {
      store: {
        name: storeInfo?.name,
        address: storeInfo?.address,
        phone: storeInfo?.phone,
        email: storeInfo?.email,
        taxId: (storeInfo as any)?.tax_id,
        currencyCode: (storeInfo as any)?.currencyCode,
      },
      dateFormat: (storeInfo as any)?.dateFormat,
    },
  });

  if (!rendered) {
    throw new Error(
      'No published Refund / Credit Note template is configured for this store. ' +
      'Publish a return template in Print Templates before printing a refund.'
    );
  }

  return { html: rendered.html, css: rendered.css };
};
