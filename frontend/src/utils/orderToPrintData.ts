/**
 * Special/back order -> print template data.
 *
 * Same translation-not-calculation contract as saleToPrintData.ts. This is
 * the first print surface OrdersPage.tsx has ever had — SalesOrder already
 * carries subtotal/tax/total as recorded, so nothing here recomputes them.
 */

import type { SalesOrder, OrderItem } from '../services/ordersService';

export interface OrderPrintContext {
  store?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    taxId?: string | null;
    currencyCode?: string | null;
  } | null;
  formatDate?: (value: string) => string;
}

const str = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return v === null || v === undefined ? undefined : String(v);
  const t = v.trim();
  return t === '' ? undefined : t;
};

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const STATUS_LABELS: Record<SalesOrder['status'], string> = {
  pending: 'Pending', processing: 'Processing', shipped: 'Shipped',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

function mapOrderItem(item: OrderItem): Record<string, unknown> {
  return {
    name: str(item.productName) ?? 'Item',
    qty: num(item.quantity),
    unitPrice: num(item.unitPrice),
    lineTotal: num(item.totalPrice),
  };
}

/** Map a special order onto DEFAULT_BLOCKS.order_acknowledgement's accessors. */
export function orderToPrintData(
  order: SalesOrder | null | undefined,
  context: OrderPrintContext = {},
): Record<string, unknown> {
  if (!order) return {};

  const { store, formatDate } = context;

  const created = str(order.createdAt);
  const items = Array.isArray(order.items) ? order.items.map(mapOrderItem) : [];

  return {
    documentType: 'order_acknowledgement',
    documentNumber: str(order.orderNumber),

    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(store?.currencyCode),

    date: created ? (formatDate ? formatDate(created) : created) : undefined,

    customer: {
      name: str(order.customerName),
      phone: str(order.customerPhone),
      email: str(order.customerEmail),
    },

    statusLabel: STATUS_LABELS[order.status] ?? str(order.status),

    items,
    subtotal: num(order.subtotal),
    tax: num(order.tax),
    total: num(order.total),

    notes: str(order.notes),

    signatures: { customer: 'Customer Signature', authorized: 'Authorised By' },
  };
}
