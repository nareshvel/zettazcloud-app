/**
 * Old gold purchase -> print template data.
 *
 * Same translation-not-calculation contract as repairToPrintData.ts /
 * saleToPrintData.ts: figures are copied as recorded, absent fields are left
 * undefined so the block renderers' own self-suppression handles them.
 */

import type { OldGoldPurchase, TestMethod, PaymentMode } from '../services/oldGoldService';
import { TEST_METHOD_LABELS, PAYMENT_MODE_LABELS } from '../services/oldGoldService';

export interface OldGoldPrintContext {
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

/**
 * Map an old-gold purchase onto the structure
 * DEFAULT_BLOCKS.old_gold_voucher's block accessors read.
 */
export function oldGoldToPrintData(
  purchase: OldGoldPurchase | null | undefined,
  context: OldGoldPrintContext = {},
): Record<string, unknown> {
  if (!purchase) return {};

  const { store, formatDate, formatCurrency } = context;

  const customerName = [str(purchase.customerFirstName), str(purchase.customerLastName)]
    .filter(Boolean)
    .join(' ') || undefined;

  const created = str(purchase.createdAt);

  const purityLabel = str(purchase.claimedPurityLabel) ?? str(purchase.purityLabel);
  const purityPct = num(purchase.purityPct) ?? num(purchase.claimedPurityPct);
  const testLabel = purchase.testMethod
    ? (TEST_METHOD_LABELS[purchase.testMethod as TestMethod] ?? String(purchase.testMethod))
    : undefined;
  const purityDisplay = [purityLabel, purityPct !== undefined ? `(${purityPct}%${testLabel ? `, ${testLabel}` : ''})` : undefined]
    .filter(Boolean)
    .join(' ') || undefined;

  const grossWeight = num(purchase.grossWeight);
  const netWeight = num(purchase.netWeight);

  const isCredit = purchase.voucherType !== 'cash';
  const pmLabel = purchase.paymentMode
    ? (PAYMENT_MODE_LABELS[purchase.paymentMode as PaymentMode] ?? String(purchase.paymentMode))
    : undefined;

  return {
    documentType: 'old_gold_voucher',
    documentNumber: str(purchase.voucherNo),

    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(store?.currencyCode),

    date: created ? (formatDate ? formatDate(created) : created) : undefined,

    customer: {
      name: customerName,
      phone: str(purchase.customerPhone),
      email: str(purchase.customerEmail),
    },

    itemDescription: str(purchase.itemDescription),
    metal: str(purchase.metal),
    purityDisplay,
    grossWeightDisplay: grossWeight !== undefined ? `${grossWeight}g` : undefined,
    netWeightDisplay: netWeight !== undefined ? `${netWeight}g` : undefined,
    ratePerGramDisplay: money(num(purchase.ratePerGram), formatCurrency),

    valuationDisplay: money(num(purchase.valuationAmount), formatCurrency),
    settlementDisplay: isCredit
      ? 'Redeemable against future purchase'
      : `Paid via ${pmLabel ?? 'Cash'}`,

    signatures: { customer: 'Customer Signature', authorized: 'Authorised By' },
  };
}
