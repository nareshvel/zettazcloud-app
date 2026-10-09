// Print Module Phase 1 — store-level printing configuration per document type
// (receipt, invoice), and the store's receipt-vs-invoice choice for a
// completed sale.
//
// NOT `printerService.ts`'s `getPrinterSettings`/`updatePrinterSettings`
// (`printer_settings` table) — that path is deprecated for the rollback
// window only. This is the real settings store going forward. See
// docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md.

import { fetchApi } from './api';

// 'register_close' configures Z/X register-report delivery — never a checkout
// document, so the sale-format fields keep the narrower SaleDocumentType.
export type PrintDocumentType = 'receipt' | 'invoice' | 'register_close';
export type SaleDocumentType = 'receipt' | 'invoice';
export type PrintDeliveryMode = 'browser' | 'direct' | 'local_agent';

export interface PrintDocumentSetting {
  id: string | null;
  storeId: string;
  documentType: PrintDocumentType;
  deliveryMode: PrintDeliveryMode;
  printerName: string | null;
  paperWidth: number;
  mediaSize: '58mm' | '80mm' | '110mm' | 'a4' | 'letter';
  templateId: string | null;
  copies: number;
  enabled: boolean;
  autoPrint: boolean;
}

export interface PrintDocumentSettingsResponse {
  settings: PrintDocumentSetting[];
  defaultSaleDocumentType: SaleDocumentType;
}

export interface SavePrintDocumentSettingsPayload {
  defaultSaleDocumentType: SaleDocumentType;
  // register_close may be absent — the backend keeps its defaults then.
  settings: Partial<Record<PrintDocumentType, PrintDocumentSetting>>;
}

export const resolveDocumentAction = (
  setting: Pick<PrintDocumentSetting, 'enabled' | 'autoPrint'>,
  requestedMode: 'print' | 'view' = 'print',
): 'none' | 'preview' | 'print' => {
  if (requestedMode === 'view') return 'preview';
  if (!setting.enabled) return 'none';
  return setting.autoPrint ? 'print' : 'preview';
};

/** Both document-type rows for a store, plus which one a sale prints as. */
export const getPrintDocumentSettings = (storeId: string): Promise<PrintDocumentSettingsResponse> =>
  fetchApi<PrintDocumentSettingsResponse>(`/settings/print-document-settings/${storeId}`);

export const savePrintDocumentSettings = (
  storeId: string,
  payload: SavePrintDocumentSettingsPayload,
): Promise<PrintDocumentSettingsResponse> =>
  fetchApi<PrintDocumentSettingsResponse>(`/settings/print-document-settings/${storeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

/** Update one document type's delivery/printer/template/copies configuration. */
export const updatePrintDocumentSetting = (
  storeId: string,
  documentType: PrintDocumentType,
  payload: Partial<Pick<PrintDocumentSetting,
    'deliveryMode' | 'printerName' | 'paperWidth' | 'templateId' | 'copies' | 'enabled' | 'autoPrint'
  >>,
): Promise<{ id: string }> =>
  fetchApi<{ id: string }>(`/settings/print-document-settings/${storeId}/${documentType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    // Backend fields are snake_case; fetchApi only camelCases responses, not
    // requests, so the outbound body is written explicitly.
    body: JSON.stringify({
      delivery_mode: payload.deliveryMode,
      printer_name: payload.printerName,
      paper_width: payload.paperWidth,
      template_id: payload.templateId,
      copies: payload.copies,
      enabled: payload.enabled,
      auto_print: payload.autoPrint,
    }),
  });

/** Whether a completed sale at this store prints as a receipt or an invoice. */
export const updateDefaultSaleDocumentType = (
  storeId: string,
  defaultSaleDocumentType: SaleDocumentType,
): Promise<{ defaultSaleDocumentType: SaleDocumentType }> =>
  fetchApi<{ defaultSaleDocumentType: SaleDocumentType }>(
    `/settings/print-document-settings/${storeId}/default-format`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultSaleDocumentType }),
    },
  );
