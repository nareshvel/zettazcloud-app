import { useEffect, useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { printReceipt, PrinterSettings } from '@/services/printerService';
import { getPrintDocumentSettings, resolveDocumentAction, PrintDocumentSetting } from '@/services/printDocumentSettingsService';
import { salesReturnService, SalesReturn } from '@/services/salesReturnService';
import { getReceiptForReturn } from '@/services/receiptService';

export const useReturnReceipt = () => {
  const { store, isLoading: isStoreLoading } = useStore();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptContent, setReceiptContent] = useState<{ html: string; css: string }>({ html: '', css: '' });
  const [documentSetting, setDocumentSetting] = useState<PrintDocumentSetting | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [currentReturn, setCurrentReturn] = useState<SalesReturn | null>(null);

  useEffect(() => {
    // silent mount
  }, []);

  useEffect(() => {
    const fetchPrinterSettings = async () => {
      if (!isAuthLoading && isAuthenticated && !isStoreLoading && store?.id) {
        try {
          const settings = await getPrintDocumentSettings(store.id);
          const route = settings.settings.find((item) => item.documentType === settings.defaultSaleDocumentType) || null;
          setDocumentSetting(route);
          setAutoPrint(Boolean(route?.enabled && route?.autoPrint));
        } catch (error) {
          console.error('Error fetching print document settings for returns:', error);
          setDocumentSetting(null);
          setAutoPrint(false);
        }
      } else {
        setDocumentSetting(null);
        setAutoPrint(false);
      }
    };
    fetchPrinterSettings();
  }, [isAuthLoading, isAuthenticated, isStoreLoading, store?.id]);

  type ShowOptions = { previewOnly?: boolean; disableFallback?: boolean };
  const showReceiptForReturn = async (
    returnInput: { id: string } | SalesReturn,
    options: ShowOptions = {}
  ) => {
    // silent invocation
    try {
      toast.dismiss('return-receipt-entry');
      toast('Preparing return receipt…', { id: 'return-receipt-entry' });
    } catch {}
    const { previewOnly = false, disableFallback = false } = options;
    if (!returnInput || !returnInput.id) {
      logger.error('showReceiptForReturn: invalid return input');
      toast.error('Cannot generate return receipt: Invalid return data.');
      return;
    }
    setIsLoadingReceipt(true);

    try {
      // Ensure full return details
      let ret: SalesReturn | null = null;
      if ((returnInput as SalesReturn).items) {
        ret = returnInput as SalesReturn;
      } else {
        ret = await salesReturnService.getReturnById(returnInput.id);
      }
      if (!ret) {
        throw new Error('Failed to load return details');
      }
      setCurrentReturn(ret);

      // Build receipt HTML for return
      const storeInfo = {
        id: store?.id || '',
        tenantId: store?.tenantId || '',
        name: store?.name || 'Zettaz Store',
        address: store?.address || '',
        phone: store?.phone || '',
        email: store?.email || '',
        currencyCode: store?.currencyCode || 'USD',
      } as any;

      // Ensure we have up-to-date printer settings before deciding auto-print
      let effectiveDocumentSetting = documentSetting;
      if (!effectiveDocumentSetting && store?.id) {
        try {
          const settings = await getPrintDocumentSettings(store.id);
          effectiveDocumentSetting = settings.settings.find((item) => item.documentType === settings.defaultSaleDocumentType) || null;
          setDocumentSetting(effectiveDocumentSetting);
          setAutoPrint(Boolean(effectiveDocumentSetting?.enabled && effectiveDocumentSetting?.autoPrint));
        } catch (e) {
          effectiveDocumentSetting = null;
        }
      }

      const effectiveSettings: PrinterSettings | null = effectiveDocumentSetting ? {
        store_id: store?.id || '',
        enabled: effectiveDocumentSetting.enabled,
        auto_print: effectiveDocumentSetting.autoPrint,
        print_mode: effectiveDocumentSetting.deliveryMode === 'local_agent' ? 'local-agent' : effectiveDocumentSetting.deliveryMode,
        printer_name: effectiveDocumentSetting.printerName || undefined,
        paper_width: effectiveDocumentSetting.paperWidth,
      } : null;

      // no debug logging

      const receipt = await getReceiptForReturn(ret.id, effectiveSettings, storeInfo);
      setReceiptContent({ html: receipt.html, css: receipt.css });

      const action = effectiveDocumentSetting
        ? resolveDocumentAction(effectiveDocumentSetting, previewOnly ? 'view' : 'print')
        : 'preview';
      if (action === 'preview') {
        setIsReceiptModalOpen(true);
        return;
      }
      if (action === 'none') return;

      // Auto/Direct print using printer settings (must be enabled AND auto_print)
      if (effectiveSettings) {
        const mode = (effectiveSettings.print_mode || 'browser').toLowerCase();
        if (mode === 'browser') {
          // Use printerService to perform browser printing via hidden iframe (align with sales receipts)
          try {
            const storeIdFromAuth = store?.id || user?.store?.id || user?.storeId;
            const ok = await printReceipt(
              receipt.html,
              receipt.css,
              effectiveSettings,
              undefined,
              storeIdFromAuth || undefined,
              disableFallback,
              effectiveDocumentSetting?.copies || 1,
            );
            if (!ok) {
              // user declined browser fallback (from direct mode) - not applicable here but keep consistent behavior
              setIsReceiptModalOpen(false);
            }
            return;
          } catch (err) {
            console.error('Error printing return receipt (browser mode via service):', err);
            setIsReceiptModalOpen(true);
          }
        } else {
          try {
            const storeIdFromAuth = store?.id || user?.store?.id || user?.storeId;
            const ok = await printReceipt(
              receipt.html,
              receipt.css,
              effectiveSettings,
              undefined,
              storeIdFromAuth || undefined,
              disableFallback,
              effectiveDocumentSetting?.copies || 1,
            );
            if (!ok) {
              // user declined browser fallback; keep modal closed
              setIsReceiptModalOpen(false);
            }
          } catch (err) {
            console.error('Error printing return receipt:', err);
            setIsReceiptModalOpen(true);
          }
        }
      }
    } catch (error: any) {
      logger.error('showReceiptForReturn error:', error);
      toast.error('Failed to prepare or print sales return receipt.');
      if (receiptContent.html) setIsReceiptModalOpen(true);
    } finally {
      try { toast.dismiss('return-receipt-entry'); } catch {}
      setIsLoadingReceipt(false);
    }
  };

  const closeReceiptModal = () => setIsReceiptModalOpen(false);

  return {
    isReceiptModalOpen,
    isLoadingReceipt,
    receiptContent,
    currentReturn,
    autoPrint,
    printerSettings: documentSetting,
    showReceiptForReturn,
    closeReceiptModal,
  };
};

export default useReturnReceipt;
