import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { getReceiptForSale } from '../services/receiptService';
import { getSaleById } from '../services/salesService'; // Import getSaleById
import { Sale } from '@/types'; // Assuming Sale type is defined in types
import { getPrinterSettings, PrinterSettings } from '../services/printerService';
import { getPrintDocumentSettings, resolveDocumentAction, type PrintDocumentSetting, type PrintDocumentType } from '../services/printDocumentSettingsService';
import { normalizeImageUrl } from '../utils/imageUtils';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

export const useReceipt = () => {
  const { store, isLoading: isStoreLoading } = useStore();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const [receiptContent, setReceiptContent] = useState<{ html: string; css: string }>({ html: '', css: '' });
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings | null>(null);
  const [currentSale, setCurrentSale] = useState<any>(null);
  // Print Module Phase 1: does a completed sale at this store print as a
  // receipt or an invoice? Defaults to 'receipt' — matches the column default
  // on `stores.default_sale_document_type` for any store that hasn't set one.
  const [saleDocumentType, setSaleDocumentType] = useState<PrintDocumentType>('receipt');
  // Per-document-type delivery config (mode/printer/paper width/copies),
  // configured in Settings → Printer Settings. This is the real source of
  // truth for HOW a document prints — `printerSettings` above (the legacy
  // printer_settings table) is read only as a rollback-window fallback; see
  // docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md.
  const [docSettingsList, setDocSettingsList] = useState<PrintDocumentSetting[]>([]);

  // Fetch printer settings
  useEffect(() => {
    const fetchPrinterSettings = async () => {
      if (!isAuthLoading && isAuthenticated && !isStoreLoading && store?.id) {
        try {
          const settings = await getPrinterSettings(store.id);
          if (settings) {
            setPrinterSettings(settings);
            setAutoPrint(settings.enabled && settings.auto_print);
          } else {
            setPrinterSettings(null);
            setAutoPrint(false);
            // logger.warn(`useReceipt: No printer settings loaded for store ${store.id}. Footer/header might be default.`); // Kept for now if useful
          }
        } catch (error) {
          console.error('Error fetching printer settings:', error);
          // Ensure settings are reset on error too
          setPrinterSettings(null);
          setAutoPrint(false);
        }

        try {
          const docSettings = await getPrintDocumentSettings(store.id);
          setSaleDocumentType(docSettings.defaultSaleDocumentType);
          setDocSettingsList(docSettings.settings);
        } catch (error) {
          console.error('Error fetching print document settings:', error);
          setSaleDocumentType('receipt'); // safest known-good default
          setDocSettingsList([]);
        }
      } else {
        // Optional: Log why settings fetch is skipped if needed for future debugging, but keep it minimal.
        // if (isAuthLoading) logger.debug('[useReceipt useEffect] Waiting for Auth to load...');
        // else if (!isAuthenticated) logger.debug('[useReceipt useEffect] User not authenticated, skipping printer settings fetch.');
        // else if (isStoreLoading) logger.debug('[useReceipt useEffect] Waiting for Store to load...');
        // else if (!store?.id) logger.debug('[useReceipt useEffect] Store loaded, but no store.id available, skipping printer settings fetch.');

        setPrinterSettings(null);
        setAutoPrint(false);
        setSaleDocumentType('receipt');
        setDocSettingsList([]);
      }
    };

    fetchPrinterSettings();
  }, [isAuthLoading, isAuthenticated, isStoreLoading, store?.id]);

  // Function to generate and show receipt for a sale
  // options.mode: 'print' | 'view' (default 'print')
  // options.disableFallback: if true, do not prompt browser print fallback on direct print failure
  const showReceiptForSale = async (
    saleInput: any,
    options?: { mode?: 'print' | 'view'; disableFallback?: boolean }
  ) => {
    if (!saleInput || !saleInput.id) {
      logger.error('showReceiptForSale: saleInput is invalid or missing ID.');
      toast.error('Cannot generate receipt: Invalid sale data provided.');
      return;
    }

    setIsLoadingReceipt(true);
    let saleDetails: Sale | null = null;

    try {
      // Step 1: Ensure we have full sale details
      if (typeof saleInput.subtotal === 'undefined' || typeof saleInput.total === 'undefined' || !saleInput.items) {
        // logger.debug('showReceiptForSale: Partial sale object received or items missing, fetching full details for sale ID:', saleInput.id);
        const fetchedSale = await getSaleById(saleInput.id);
        if (!fetchedSale) {
          logger.error(`showReceiptForSale: Failed to fetch full sale details for ID: ${saleInput.id}`);
          toast.error('Could not load sale details for receipt.');
          return; 
        }
        saleDetails = fetchedSale;
      } else {
        saleDetails = saleInput as Sale;
      }

      if (!saleDetails) {
        logger.error('showReceiptForSale: saleDetails is null after attempting to fetch/assign.');
        toast.error('Failed to process sale details for receipt.');
        return; 
      }

      setCurrentSale(saleDetails); // Set currentSale with full details

      // Step 2: Get store info from context — but ONLY when the sale actually
      // belongs to the store currently active in this browser tab's context.
      // For a multi-store tenant, viewing/reprinting a sale that happened at
      // a DIFFERENT store (e.g. a Sales Hub search result, or a Dashboard
      // recent-transaction reprint) must render with THAT sale's own store
      // identity — not whichever store the user currently has selected in
      // the TopBar — or the receipt shows the wrong store name, address,
      // phone and tax ID. Leave storeInfo undefined in that case so
      // getReceiptForSale's own fallback (GET /stores/:storeId, scoped by
      // the sale's real storeId) resolves the correct store instead.
      const saleStoreId = (saleDetails as any)?.storeId;
      const storeInfo = (!saleStoreId || saleStoreId === store?.id) ? {
        id: store?.id || '',
        tenantId: store?.tenantId || '',
        name: store?.name || 'Zettaz Store',
        address: store?.address || '',
        phone: store?.phone || '',
        email: store?.email || '',
        website: (store as any)?.website || '',
        currencyCode: store?.currencyCode || 'USD',
        dateFormat: store?.dateFormat || 'yyyy-MM-dd',
        timeFormat: store?.timeFormat || 'HH:mm',
        tax_id: (store as any)?.tax_id || '',
        logo_url: normalizeImageUrl((store as any)?.logoUrl || (store as any)?.logo_url || '') || ''
      } : undefined;
      
      // Print Module Phase 1: the print_document_settings row for whichever
      // document type this sale actually prints as — the real, live-effective
      // delivery config (see the field's declaration above). Falls back to an
      // enabled, browser-mode default if no row exists yet, matching the
      // backend's own "never leave a store with nothing to print with" default.
      //
      // paperWidth must vary by document type here, same as
      // printDocumentSettingsController.js's own DEFAULT_SETTINGS (210mm/A4
      // for 'invoice', 80mm thermal otherwise) — this used to hardcode 80
      // regardless of type, so a store with no saved invoice settings yet
      // silently rendered its A4 jewelry invoice as if it were an 80mm
      // thermal receipt (paperSizeFromWidth(80) => '80mm' => isThermal =
      // true in printTemplateRenderer.ts), which disables the print CSS that
      // pins the footer to the bottom of the page — among other A4-specific
      // layout rules.
      const effectiveDocSetting: PrintDocumentSetting = docSettingsList.find(
        (d) => d.documentType === saleDocumentType,
      ) || {
        id: null, storeId: store?.id || '', documentType: saleDocumentType,
        deliveryMode: 'browser', printerName: null,
        paperWidth: saleDocumentType === 'invoice' ? 210 : 80,
        templateId: null, copies: 1, enabled: true, autoPrint: false,
      };

      // Shaped for both consumers: printerService.ts's printReceipt/
      // printReceiptToNetworkPrinter read snake_case (`paper_width`,
      // `printer_name`, `print_mode`), while receiptService.ts's
      // getReceiptForSale reads camelCase (`paperWidth`) when building the
      // template render context. Both are set so paper size actually reaches
      // whichever path is exercised — previously `paperWidth` was never set at
      // all here, so it silently always fell back to a default.
      const effectivePrinterSettings: any = {
        enabled: effectiveDocSetting.enabled,
        auto_print: effectiveDocSetting.autoPrint,
        print_mode: effectiveDocSetting.deliveryMode === 'local_agent' ? 'local-agent' : effectiveDocSetting.deliveryMode,
        printer_name: effectiveDocSetting.printerName || undefined,
        paper_width: effectiveDocSetting.paperWidth,
        paperWidth: effectiveDocSetting.paperWidth,
      };

      // Generate receipt HTML using full saleDetails
      const receipt = await getReceiptForSale(
        saleDetails.id,
        effectivePrinterSettings,
        storeInfo,
        saleDetails,
        saleDocumentType,
        effectiveDocSetting.templateId,
      );
      setReceiptContent(receipt);

      const action = resolveDocumentAction(effectiveDocSetting, options?.mode || 'print');
      if (action === 'preview') {
        setIsReceiptModalOpen(true);
        return;
      }
      if (action === 'none') return;

      // Print logic: use this document type's own enabled flag, not the
      // legacy receipt-only `printerSettings` state — an invoice-format store
      // can have receipts off and invoices on, or vice versa.
      try {
          const { printReceipt } = await import('../services/printerService');

          // Use full saleDetails for receiptData
          let actualDiscount = 0;
          const receiptData = {
            saleId: saleDetails.id,
            discountAmount: actualDiscount > 0 ? actualDiscount : (saleDetails.discountAmount || 0),
            discountType: actualDiscount > 0 ? 'fixed' : (saleDetails.discountType || 'fixed'), // Use camelCase and remove snake_case fallback
            discountValue: saleDetails.discountValue || 0 // Use camelCase and remove snake_case fallback
          };

          const storeIdFromAuth = user?.store?.id || user?.storeId;

          // Call printReceipt with THIS document type's own settings — not
          // `undefined` (which used to make printReceipt silently re-fetch the
          // legacy printer_settings row internally, ignoring everything
          // configured in the new Printer Settings UI).
          const printCommandSuccessful = await printReceipt(
            receipt.html,
            receipt.css,
            effectivePrinterSettings,
            receiptData,
            storeIdFromAuth || undefined, // still passed for logging/local-agent context
            options?.disableFallback === true, // Pass down the disableFallback flag
            effectiveDocSetting.copies,
          );

          // If printCommandSuccessful is false, it means the user was prompted for fallback and declined.
          // In this specific scenario, we do NOT automatically open the modal.
          // The modal is opened for preview mode or unexpected print errors.
          if (!printCommandSuccessful) {
            // logger.debug('Print command was not successful (direct print failed and user declined fallback). Modal will not auto-open.');
          }
          // Other logging and toasts are handled within printerService.ts
        } catch (printError) {
          console.error('Error initiating print from useReceipt:', printError);
          // If any part of printing fails (including fetching settings or the print job itself),
          // set receipt content and open modal for user to see receipt / try browser print.
          setReceiptContent(receipt); 
          setIsReceiptModalOpen(true);
        }
    } catch (error) {
      // This catch block handles errors from sale fetching, receipt generation, or printing initiation
      logger.error('Error in showReceiptForSale:', error);
      toast.error('Failed to prepare or print receipt.');
      // If receipt content was generated before an error in printing, modal might still be useful
      // If error was early (e.g. fetching sale), receiptContent might be empty.
      // Consider if setIsReceiptModalOpen(true) is always desired here.
      // For now, keeping it to allow manual print if some receipt data exists.
      if (receiptContent.html) { // Only open modal if there's something to show
        setIsReceiptModalOpen(true);
      }
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  // Close the receipt modal
  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
  };

  return {
    isReceiptModalOpen,
    isLoadingReceipt,
    receiptContent,
    currentSale,
    autoPrint,
    showReceiptForSale,
    closeReceiptModal
  };
};

export default useReceipt;
