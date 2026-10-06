/**
 * Label / tag print service
 * Wraps /api/labels/* endpoints and handles the browser-print fallback.
 */

import { fetchApi } from './api';

const unwrap = <T,>(r: any): T => (r && r.data !== undefined ? r.data : r);

export interface LabelSettings {
  label_printer_type: 'none' | 'zebra_zpl' | 'tsc_network' | 'browser';
  label_printer_address: string | null;
  label_paper_width_mm: number;
  label_paper_height_mm: number;
}

export async function getLabelSettings(storeId?: string): Promise<LabelSettings> {
  const params = storeId ? `?store_id=${storeId}` : '';
  return unwrap<LabelSettings>(await fetchApi<any>(`/labels/settings${params}`));
}

export async function saveLabelSettings(settings: LabelSettings & { store_id?: string }): Promise<void> {
  await fetchApi('/labels/settings', { method: 'PUT', body: JSON.stringify(settings) });
}

export async function testLabelPrinter(storeId?: string): Promise<void> {
  const res = await fetchApi<any>('/labels/test', { method: 'POST', body: JSON.stringify({ store_id: storeId }) });
  if (res?.driver === 'browser' && res?.html) {
    openBrowserPrint(res.html);
  }
}

export async function printPieceLabel(pieceId: string, storeId?: string): Promise<void> {
  const res = await fetchApi<any>('/labels/print', { method: 'POST', body: JSON.stringify({ piece_id: pieceId, store_id: storeId }) });
  if (res?.driver === 'browser' && res?.html) {
    openBrowserPrint(res.html);
  }
}

export async function printBulkLabels(pieceIds: string[], storeId?: string): Promise<void> {
  const res = await fetchApi<any>('/labels/print/bulk', { method: 'POST', body: JSON.stringify({ piece_ids: pieceIds, store_id: storeId }) });
  if (res?.driver === 'browser' && res?.html) {
    openBrowserPrint(res.html);
  }
}

/** Opens an HTML label in a new window and triggers window.print() */
function openBrowserPrint(html: string): void {
  const win = window.open('', '_blank', 'width=400,height=300');
  if (!win) { alert('Please allow popups for this site to print labels.'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
