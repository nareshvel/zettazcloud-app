/**
 * Savings scheme enrollment -> print template data.
 *
 * Same translation-not-calculation contract as the other To-Print mappers.
 * Progress percentage is display-only arithmetic on already-recorded counts
 * (paid instalments / duration), not a re-derivation of a monetary figure.
 */

import type { SchemeEnrollment } from '../services/jewelryOpsService';

export interface SavingsPrintContext {
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

function mapPayment(p: any, index: number): Record<string, unknown> {
  const dateRaw = str(p.paidAt) ?? str(p.paid_at);
  return {
    no: p.installmentNo ?? index + 1,
    dateDisplay: dateRaw ? dateRaw.slice(0, 10) : undefined,
    amount: num(p.amount),
    method: str(p.paymentMethod) ?? str(p.payment_method) ?? 'Cash',
    reference: str(p.reference),
  };
}

/**
 * Map a savings enrollment onto DEFAULT_BLOCKS.savings_enrollment's block
 * accessors.
 */
export function savingsToPrintData(
  enrollment: SchemeEnrollment | null | undefined,
  context: SavingsPrintContext = {},
): Record<string, unknown> {
  if (!enrollment) return {};

  const { store, formatDate, formatCurrency } = context;

  const customerName = [str(enrollment.customerFirstName), str(enrollment.customerLastName)]
    .filter(Boolean)
    .join(' ') || undefined;

  const start = str(enrollment.startDate);
  const maturity = str(enrollment.maturityDate);

  const paid = enrollment.paidInstallments ?? 0;
  const duration = enrollment.durationMonths ?? 0;
  const pct = duration ? Math.round((paid / duration) * 100) : 0;

  const items = Array.isArray(enrollment.payments) ? enrollment.payments.map(mapPayment) : [];

  const bonus = num(enrollment.bonus) ?? num(enrollment.bonusAmount);

  return {
    documentType: 'savings_enrollment',
    documentNumber: str(enrollment.enrollmentNo),

    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(store?.currencyCode),

    date: start ? (formatDate ? formatDate(start) : start) : undefined,

    planName: str(enrollment.planName),
    startDateDisplay: start ? (formatDate ? formatDate(start) : start) : undefined,
    maturityDateDisplay: maturity ? (formatDate ? formatDate(maturity) : maturity) : undefined,
    statusLabel: str(enrollment.status),

    customer: {
      name: customerName,
      phone: str(enrollment.customerPhone),
      email: str(enrollment.customerEmail),
    },

    progressDisplay: duration ? `${paid} / ${duration} instalments (${pct}%)` : undefined,
    totalPaidDisplay: money(num(enrollment.totalPaid), formatCurrency),

    items,

    bonusDisplay: bonus ? `+ ${money(bonus, formatCurrency)}` : undefined,
    redeemableValueDisplay: money(
      num(enrollment.redeemableValue) ?? num(enrollment.totalPaid), formatCurrency,
    ),

    signatures: { customer: 'Customer Signature', authorized: 'Authorised By' },
  };
}
