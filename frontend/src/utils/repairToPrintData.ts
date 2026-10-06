/**
 * Repair order -> print template data.
 *
 * Mirrors saleToPrintData.ts's approach: a translation, not a calculation.
 * Monetary figures are copied from the order as recorded — nothing here
 * re-derives a balance or re-formats a total beyond currency display.
 * Absent fields are left undefined so the block renderers' own
 * self-suppression (empty custom rows are dropped) does the rest.
 */

import type { RepairOrder, RepairStatus } from '../services/repairService';

export interface RepairPrintContext {
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

const STATUS_LABELS: Record<RepairStatus, string> = {
  received: 'Received',
  in_progress: 'In Progress',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

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
 * Map a repair order onto the structure DEFAULT_BLOCKS.repair_ticket's
 * block accessors read.
 */
export function repairToPrintData(
  order: RepairOrder | null | undefined,
  context: RepairPrintContext = {},
): Record<string, unknown> {
  if (!order) return {};

  const { store, formatDate, formatCurrency } = context;

  const customerName = [str(order.customerFirstName), str(order.customerLastName)]
    .filter(Boolean)
    .join(' ') || undefined;

  const received = str(order.receivedDate);
  const promised = str(order.promisedDate);

  const metal = str(order.metal);
  const weight = num(order.weight);
  const metalWeightDisplay = [metal, weight !== undefined ? `${weight}g` : undefined]
    .filter(Boolean)
    .join(' · ') || undefined;

  const estimatedCost = num(order.estimatedCost);
  const advancePaid = num(order.advancePaid);
  const finalCost = num(order.finalCost);
  // Balance due prefers the final cost once set (job priced/completed), else
  // falls back to the estimate — same precedence a cashier would use.
  const baseCost = finalCost ?? estimatedCost;
  const balanceDue = baseCost !== undefined && advancePaid !== undefined
    ? baseCost - advancePaid
    : undefined;

  return {
    documentType: 'repair_ticket',
    documentNumber: str(order.ticketNo),

    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(store?.currencyCode),

    date: received ? (formatDate ? formatDate(received) : received) : undefined,

    customer: {
      name: customerName,
      phone: str(order.customerPhone),
      email: str(order.customerEmail),
    },

    itemDescription: str(order.itemDescription),
    metalWeightDisplay,
    promisedDateDisplay: promised ? (formatDate ? formatDate(promised) : promised) : undefined,

    estimatedCostDisplay: money(estimatedCost, formatCurrency),
    advancePaidDisplay: money(advancePaid, formatCurrency),
    balanceDueDisplay: money(balanceDue, formatCurrency),
    statusLabel: STATUS_LABELS[order.status] ?? str(order.status),

    problemDescription: str(order.problemDescription),
    workRequired: str(order.workRequired),
    repairNotes: str(order.notes),
  };
}
