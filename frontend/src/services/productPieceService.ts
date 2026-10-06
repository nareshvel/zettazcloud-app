import { fetchApi } from './api';

/** Client for serialized inventory (product pieces) at /api/product-pieces. */

export type PieceStatus = 'available' | 'hold' | 'sold' | 'returned' | 'melted' | 'lost' | 'damaged';

export interface ProductPiece {
  id: string;
  productId: string;
  productName?: string | null;
  productSku?: string | null;
  pieceCode: string;
  barcode?: string | null;
  status: PieceStatus;
  grossWeight?: number | null;
  netWeight?: number | null;
  purity?: string | null;
  purchasePrice?: number | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
  costCode?: string | null;
  attributes?: Record<string, any> | null;
  grnId?: string | null;
  notes?: string | null;
  storeId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ListPiecesParams {
  status?: string;
  productId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

const unwrap = <T,>(r: any): T => (r && r.data !== undefined ? r.data : r);

/** List all pieces across products (cross-product view) */
export async function listAllPieces(params: ListPiecesParams = {}): Promise<ProductPiece[]> {
  const p = new URLSearchParams();
  if (params.status)    p.set('status', params.status);
  if (params.productId) p.set('product_id', params.productId);
  if (params.q)         p.set('q', params.q);
  if (params.limit)     p.set('limit', String(params.limit));
  if (params.offset)    p.set('offset', String(params.offset));
  const qs = p.toString() ? `?${p.toString()}` : '';
  return unwrap<ProductPiece[]>(await fetchApi<any>(`/product-pieces/all${qs}`));
}

/** List pieces for a specific product */
export async function listPieces(productId: string, status?: string, q?: string): Promise<ProductPiece[]> {
  const p = new URLSearchParams();
  if (status) p.set('status', status);
  if (q)      p.set('q', q);
  const qs = p.toString() ? `?${p.toString()}` : '';
  return unwrap<ProductPiece[]>(await fetchApi<any>(`/product-pieces/product/${productId}${qs}`));
}

/** Get a single piece by ID */
export async function getPiece(id: string): Promise<ProductPiece> {
  return unwrap<ProductPiece>(await fetchApi<any>(`/product-pieces/${id}`));
}

export async function lookupPiece(barcodeOrCode: string): Promise<ProductPiece> {
  const enc = encodeURIComponent(barcodeOrCode);
  return unwrap<ProductPiece>(await fetchApi<any>(`/product-pieces/lookup?barcode=${enc}&code=${enc}`));
}

export async function createPiece(payload: Partial<ProductPiece> & { productId: string }): Promise<{ id: string; pieceCode: string; costCode?: string; available: number }> {
  return unwrap(await fetchApi<any>('/product-pieces', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function bulkCreatePieces(payload: { productId: string; count: number } & Partial<ProductPiece>): Promise<{ created: { id: string; pieceCode: string; costCode?: string }[]; available: number }> {
  return unwrap(await fetchApi<any>('/product-pieces/bulk', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updatePiece(id: string, payload: Partial<ProductPiece>): Promise<void> {
  await fetchApi(`/product-pieces/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function setPieceStatus(id: string, status: PieceStatus, saleId?: string, notes?: string): Promise<{ available: number }> {
  return unwrap(await fetchApi<any>(`/product-pieces/${id}/status`, {
    method: 'POST', body: JSON.stringify({ status, sale_id: saleId, notes }),
  }));
}
