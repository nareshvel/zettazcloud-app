/**
 * Layaway plan -> print template data.
 *
 * Two mappers, matching the two document types this phase covers:
 *   layawayAgreementToPrintData   — signed at plan signup (A4)
 *   layawayReceiptToPrintData     — issued after each instalment (80mm)
 *
 * Same translation-not-calculation contract as the other To-Print mappers:
 * figures are copied from the plan/payment as recorded.
 */

import type { Layaway } from '../services/jewelryOpsService';

export interface LayawayPrintContext {
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

const customerName = (plan: Layaway): string | undefined =>
  [str(plan.customerFirstName), str(plan.customerLastName)].filter(Boolean).join(' ') || undefined;

const FREQUENCY_LABELS: Record<Layaway['frequency'], string> = {
  weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly',
};

function mapLayawayItem(item: any): Record<string, unknown> {
  const qty = num(item.quantity) ?? 1;
  const unitPrice = num(item.unit_price) ?? num(item.unitPrice);
  const lineTotal = num(item.line_total) ?? num(item.lineTotal)
    ?? (unitPrice !== undefined ? qty * unitPrice : undefined);

  return {
    description: str(item.description) ?? 'Item',
    qty,
    unitPrice,
    lineTotal,
  };
}

/** Map a layaway plan onto DEFAULT_BLOCKS.layaway_agreement's accessors. */
export function layawayAgreementToPrintData(
  plan: Layaway | null | undefined,
  context: LayawayPrintContext = {},
): Record<string, unknown> {
  if (!plan) return {};

  const { store, formatDate, formatCurrency } = context;

  const start = str(plan.startDate);
  const due = str(plan.dueDate);
  const balance = num(plan.balance) ?? (num(plan.totalAmount) ?? 0) - (num(plan.paidAmount) ?? 0);

  const items = Array.isArray(plan.items) ? plan.items.map(mapLayawayItem) : [];

  return {
    documentType: 'layaway_agreement',
    documentNumber: str(plan.planNo),

    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(store?.currencyCode),

    date: start ? (formatDate ? formatDate(start) : start) : undefined,

    customer: {
      name: customerName(plan),
      phone: str(plan.customerPhone),
      email: str(plan.customerEmail),
    },

    scheduleDisplay: plan.installmentCount
      ? `${FREQUENCY_LABELS[plan.frequency] ?? plan.frequency} · ${plan.installmentCount} instalments`
      : undefined,
    startDateDisplay: start ? (formatDate ? formatDate(start) : start) : undefined,
    dueDateDisplay: due ? (formatDate ? formatDate(due) : due) : undefined,
    installmentAmountDisplay: money(num(plan.installmentAmount), formatCurrency),
    statusLabel: str(plan.status),

    items,

    totalAmountDisplay: money(num(plan.totalAmount), formatCurrency),
    downPaymentDisplay: money(num(plan.downPayment), formatCurrency),
    paidAmountDisplay: money(num(plan.paidAmount), formatCurrency),
    balanceDisplay: money(balance, formatCurrency),

    signatures: { customer: 'Customer Signature & Date', authorized: 'Authorised Staff & Date' },
  };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank Transfer', cheque: 'Cheque',
};

/** Map a layaway payment onto DEFAULT_BLOCKS.layaway_receipt's accessors. */
export function layawayReceiptToPrintData(
  plan: Layaway | null | undefined,
  payment: {
    paymentAmount: number;
    paymentMethod: string;
    reference?: string | null;
    newPaidAmount: number;
    newBalance: number;
  },
  context: LayawayPrintContext = {},
): Record<string, unknown> {
  if (!plan) return {};

  const { store, formatDate, formatCurrency } = context;
  const today = new Date().toISOString().slice(0, 10);

  const methodLabel = PAYMENT_METHOD_LABELS[String(payment.paymentMethod ?? '').toLowerCase()]
    ?? str(payment.paymentMethod) ?? 'Cash';

  const previouslyPaid = num(payment.newPaidAmount) !== undefined && num(payment.paymentAmount) !== undefined
    ? (payment.newPaidAmount - payment.paymentAmount)
    : undefined;

  return {
    documentType: 'layaway_receipt',
    documentNumber: str(plan.planNo),

    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(store?.currencyCode),

    date: formatDate ? formatDate(today) : today,

    customer: {
      name: customerName(plan),
      phone: str(plan.customerPhone),
    },

    paymentMethodDisplay: methodLabel,
    reference: str(payment.reference ?? undefined),
    paymentAmountDisplay: money(num(payment.paymentAmount), formatCurrency),

    totalAmountDisplay: money(num(plan.totalAmount), formatCurrency),
    previouslyPaidDisplay: money(previouslyPaid, formatCurrency),
    newBalanceDisplay: money(num(payment.newBalance), formatCurrency),
  };
}
