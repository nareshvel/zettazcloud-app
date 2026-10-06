/**
 * Memo (consignment) -> print template data.
 *
 * Same translation-not-calculation contract as the other To-Print mappers in
 * this directory. Line values are copied from the recorded item rather than
 * recomputed — a printed acknowledgement that disagrees with the memo ledger
 * would be worse than none.
 */

import type { Memo, MemoItem } from '../services/jewelryOpsService';

export interface MemoPrintContext {
  store?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    taxId?: string | null;
    currencyCode?: string | null;
  } | null;
  formatDate?: (value: string) => string;
  formatCurrency?: (value: number) => string;
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

function money(v: number | undefined, formatCurrency?: (n: number) => string): string | undefined {
  if (v === undefined) return undefined;
  return formatCurrency ? formatCurrency(v) : String(v);
}

const partyName = (m: Memo): string | undefined =>
  str(m.supplierName)
  ?? ([str(m.customerFirstName), str(m.customerLastName)].filter(Boolean).join(' ') || undefined);

const directionLabel = (m: Memo): string =>
  m.direction === 'in' ? 'Memo In — Received from Supplier' : 'Memo Out — Sent to Customer';

/**
 * One memo line. Unknown keys are dropped here (unlike saleToPrintData's
 * item mapper) since memo_slip's table binds a fixed, known field set.
 */
function mapMemoItem(item: MemoItem): Record<string, unknown> {
  const qty = num(item.quantity);
  const unitPrice = num(item.unitValue);
  const lineTotal = num(item.lineValue) ?? (qty !== undefined && unitPrice !== undefined ? qty * unitPrice : undefined);

  return {
    pieceCode: str(item.pieceCode) ?? str(item.productSku),
    description: str(item.description) ?? str(item.productName) ?? 'Item',
    purity: str(item.purity),
    grossWeight: num(item.grossWeight),
    qty,
    unitPrice,
    lineTotal,
  };
}

/**
 * Map a memo onto the structure DEFAULT_BLOCKS.memo_slip's block accessors
 * read.
 */
export function memoToPrintData(
  memo: Memo | null | undefined,
  context: MemoPrintContext = {},
): Record<string, unknown> {
  if (!memo) return {};

  const { store, formatDate, formatCurrency } = context;

  const issue = str(memo.issueDate);
  const due = str(memo.dueDate);

  const items = Array.isArray(memo.items) ? memo.items.map(mapMemoItem) : [];

  return {
    documentType: 'memo_slip',
    documentNumber: str(memo.memoNo),

    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(store?.currencyCode),

    date: issue ? (formatDate ? formatDate(issue) : issue) : undefined,
    directionLabel: directionLabel(memo),
    dueDateDisplay: due ? (formatDate ? formatDate(due) : due) : undefined,

    customer: {
      name: partyName(memo),
      phone: str(memo.customerPhone),
      email: str(memo.customerEmail),
    },

    items,
    totalValueDisplay: money(num(memo.totalValue), formatCurrency),

    signatures: { customer: 'Customer Signature', authorized: 'Store Representative' },
  };
}
