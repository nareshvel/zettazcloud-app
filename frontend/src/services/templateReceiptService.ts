/**
 * Printing a real sale through a print template.
 *
 * This is the bridge that was missing: the designer could build documents and
 * `buildPrintableHtml` could render them, but nothing connected either to an
 * actual sale. Sales printed through the hard-coded receipt in
 * receiptService.ts instead.
 *
 * FALLBACK IS THE POINT
 * ---------------------
 * Every function here returns `null` rather than throwing when it cannot
 * produce a document — no published template, rendering error, template with no
 * blocks. The caller treats null as "use the legacy receipt".
 *
 * That is not defensive padding. A cashier has a customer standing at the
 * counter, and a template problem must never be the reason they cannot hand
 * over a receipt. A slightly-wrong-looking receipt is recoverable; no receipt
 * is not.
 */

import { fetchPrintTemplates, type PrintTemplate } from './printService';
import { isDutyFreeOrExport } from '@/utils/salesModeRules';
import { buildPrintableHtml } from '@/utils/printTemplateRenderer';
import {
  saleToPrintData, returnToPrintData,
  type PrintableSale, type PrintableReturn, type PrintContext,
} from '@/utils/saleToPrintData';
import { repairToPrintData, type RepairPrintContext } from '@/utils/repairToPrintData';
import type { RepairOrder } from './repairService';
import { oldGoldToPrintData, type OldGoldPrintContext } from '@/utils/oldGoldToPrintData';
import type { OldGoldPurchase } from './oldGoldService';
import { memoToPrintData, type MemoPrintContext } from '@/utils/memoToPrintData';
import type { Memo } from './jewelryOpsService';
import {
  layawayAgreementToPrintData, layawayReceiptToPrintData, type LayawayPrintContext,
} from '@/utils/layawayToPrintData';
import type { Layaway } from './jewelryOpsService';
import { savingsToPrintData, type SavingsPrintContext } from '@/utils/savingsToPrintData';
import type { SchemeEnrollment } from './jewelryOpsService';
import { orderToPrintData, type OrderPrintContext } from '@/utils/orderToPrintData';
import type { SalesOrder } from './ordersService';
import type { PaperSize } from '@/types/printTemplate';
import { format } from 'date-fns';
import { logger } from '@/utils/logger';


/**
 * Format a document date for printing.
 *
 * Without this the renderer fell back to the raw value and every
 * template-printed document showed `2026-08-23T13:20:00.000Z` where the date
 * should be. The fallback was working as designed — a visibly unformatted date
 * gets reported, a silently wrong one does not — but nothing was ever supplying
 * a formatter on the live path.
 *
 * Returns the input unchanged if it cannot be parsed, so a pre-formatted string
 * (fixtures already carry `23/08/2026`) passes through untouched.
 */
export function formatDocumentDate(value: string, dateFormat?: string | null): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  // date-fns tokens differ from the DD/MM/YYYY notation stored on the store
  // record, so the common patterns are mapped explicitly rather than passed
  // through and silently mis-parsed.
  const PATTERNS: Record<string, string> = {
    'DD/MM/YYYY': 'dd/MM/yyyy HH:mm',
    'MM/DD/YYYY': 'MM/dd/yyyy HH:mm',
    'YYYY-MM-DD': 'yyyy-MM-dd HH:mm',
  };
  try {
    return format(parsed, PATTERNS[String(dateFormat || '')] || 'dd/MM/yyyy HH:mm');
  } catch {
    return value;
  }
}

/** Paper width in mm from printer settings -> the renderer's paper size. */
export function paperSizeFromWidth(width?: number | string | null): PaperSize {
  const n = Number(width);
  if (n === 58) return '58mm';
  if (n === 80) return '80mm';
  // Anything else — including an unset or unrecognised width — is a page.
  // Printing an A4 layout to a thermal roll wastes paper; printing a thermal
  // layout to A4 produces a tiny strip in the corner. Neither is good, but the
  // 80mm default below is the common case for a POS.
  return Number.isFinite(n) && n > 100 ? 'a4' : '80mm';
}

/** Does this template's own blocks show a visible `dutyFree` block? */
function templateHasVisibleDutyFreeBlock(template: PrintTemplate): boolean {
  const blocks = Array.isArray(template.blocks) ? template.blocks : [];
  return blocks.some((b: any) => b?.type === 'dutyFree' && b?.visible !== false);
}

/**
 * The template a store should use for a document type.
 *
 * Prefers the one explicitly marked default. Falls back to any published
 * template of that type — a store that published exactly one template and never
 * marked it default clearly means to use it, and refusing would drop them onto
 * the legacy receipt for no reason they could guess at.
 *
 * Unpublished templates are never used: a draft is work in progress and may be
 * half-edited.
 *
 * @param saleData Optional — when a real sale's zero-rated status is known
 * (per-transaction override, see docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md
 * §5), prefer whichever candidate's own `dutyFree` block visibility actually
 * matches it, over the static `isDefault` flag. A tenant with two published
 * templates of the same type — one a duty-free variant, one plain — used to
 * always render the SAME one regardless of whether the specific sale being
 * printed was actually zero-rated, which is exactly backwards once tax mode
 * can vary sale-to-sale rather than being fixed per store. Falls back to the
 * old isDefault/sole-candidate behavior whenever there's no clear tax-status
 * match (missing saleData, no candidate whose dutyFree visibility actually
 * differs, etc.) so nothing changes for a tenant with only one template.
 */
export function selectTemplate(
  templates: PrintTemplate[],
  templateType: string,
  templateId?: string | null,
  saleData?: any,
): PrintTemplate | null {
  const candidates = templates.filter(
    (t) => t.templateType === templateType && t.isPublished,
  );
  if (templateId) return candidates.find((t) => t.id === templateId) || null;
  if (candidates.length === 0) return null;

  if (saleData) {
    const saleIsZeroRated = isDutyFreeOrExport(saleData);
    const matchingCandidates = candidates.filter(
      (t) => templateHasVisibleDutyFreeBlock(t) === saleIsZeroRated,
    );
    // Only trust this signal when it actually narrows things down — if every
    // candidate matches (or none do), the dutyFree block presence isn't
    // distinguishing anything and the old default/sole-candidate logic below
    // is just as good a tiebreaker.
    if (matchingCandidates.length > 0 && matchingCandidates.length < candidates.length) {
      return matchingCandidates.find((t) => t.isDefault) || matchingCandidates[0];
    }
  }

  return candidates.find((t) => t.isDefault) || (candidates.length === 1 ? candidates[0] : null);
}

export interface TemplateReceiptResult {
  html: string;
  css: string;
  templateId: string;
  templateName: string;
}

/**
 * Render a sale through a template.
 *
 * @returns The document, or null if the caller should fall back.
 */
export async function renderSaleWithTemplate(
  sale: PrintableSale,
  options: {
    templateType?: string;
    templateId?: string | null;
    paperWidth?: number | string | null;
    storeId?: string;
    logoUrl?: string | null;
    context?: PrintContext;
    /** Injected in tests; defaults to the real API call. */
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    templateType = 'receipt',
    templateId,
    paperWidth,
    storeId,
    logoUrl,
    context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!sale) return null;

  try {
    const templates = await loadTemplates({ templateType, storeId });
    const template = selectTemplate(templates || [], templateType, templateId, sale);
    if (!template) return null;

    // A template with no blocks would render an empty page — worse than the
    // legacy receipt, and it looks like the printer failed.
    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) {
      logger.warn(`[print] Template "${template.name}" has no blocks; using the built-in receipt`);
      return null;
    }

    const paperSize = paperSizeFromWidth(paperWidth);
    const data = saleToPrintData(sale, {
      formatDate: (v: string) => formatDocumentDate(v, context.dateFormat),
      ...context,
      documentType: templateType,
    });

    const html = buildPrintableHtml(blocks, data, paperSize, logoUrl ?? null);

    // buildPrintableHtml emits a complete document with its styles inline, so
    // there is no separate stylesheet to return. The empty string keeps the
    // shape identical to the legacy path's `{ html, css }`.
    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    // Deliberately swallowed. See the note at the top of this file: the
    // customer is waiting, and the legacy receipt still works.
    logger.error('[print] Template rendering failed; using the built-in receipt', error);
    return null;
  }
}

/**
 * Render a sales return through a template.
 *
 * Requires a dedicated published `return` template. Returns never fall back to
 * a sale receipt or a hardcoded legacy slip.
 *
 * Same contract as above: null means the return route is not configured.
 */
export async function renderReturnWithTemplate(
  salesReturn: PrintableReturn,
  options: {
    paperWidth?: number | string | null;
    storeId?: string;
    logoUrl?: string | null;
    context?: PrintContext;
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    paperWidth, storeId, logoUrl, context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!salesReturn) return null;

  try {
    const returnTemplates = await loadTemplates({ templateType: 'return', storeId }).catch(() => []);
    const template = selectTemplate(returnTemplates || [], 'return');
    if (!template) return null;

    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) return null;

    const data = returnToPrintData(salesReturn, {
      formatDate: (v: string) => formatDocumentDate(v, context.dateFormat),
      ...context,
    });
    const html = buildPrintableHtml(
      blocks, data, paperSizeFromWidth(paperWidth), logoUrl ?? null,
    );

    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    logger.error('[print] Return template rendering failed; using the built-in slip', error);
    return null;
  }
}

/**
 * Render a repair job card through a template.
 *
 * Requires a dedicated published `repair_ticket` template; falls back (null)
 * to repairPrintService.ts's hand-rolled job card otherwise — same contract
 * as the return path above. Always rendered at A4 (see
 * DEFAULT_PAPER_SIZE_FOR_TYPE.repair_ticket), so there is no paperWidth
 * parameter to thread through.
 */
export async function renderRepairWithTemplate(
  order: RepairOrder,
  options: {
    storeId?: string;
    logoUrl?: string | null;
    context?: RepairPrintContext;
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    storeId, logoUrl, context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!order) return null;

  try {
    const templates = await loadTemplates({ templateType: 'repair_ticket', storeId }).catch(() => []);
    const template = selectTemplate(templates || [], 'repair_ticket');
    if (!template) return null;

    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) return null;

    const data = repairToPrintData(order, context);
    const html = buildPrintableHtml(blocks, data, 'a4', logoUrl ?? null);

    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    logger.error('[print] Repair template rendering failed; using the built-in job card', error);
    return null;
  }
}

/**
 * Render an old-gold voucher through a template.
 *
 * Same null-means-fallback contract; falls back to oldGoldPrintService.ts's
 * hand-rolled thermal voucher. Always rendered at 80mm (see
 * DEFAULT_PAPER_SIZE_FOR_TYPE.old_gold_voucher).
 */
export async function renderOldGoldWithTemplate(
  purchase: OldGoldPurchase,
  options: {
    storeId?: string;
    logoUrl?: string | null;
    context?: OldGoldPrintContext;
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    storeId, logoUrl, context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!purchase) return null;

  try {
    const templates = await loadTemplates({ templateType: 'old_gold_voucher', storeId }).catch(() => []);
    const template = selectTemplate(templates || [], 'old_gold_voucher');
    if (!template) return null;

    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) return null;

    const data = oldGoldToPrintData(purchase, context);
    const html = buildPrintableHtml(blocks, data, '80mm', logoUrl ?? null);

    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    logger.error('[print] Old gold template rendering failed; using the built-in voucher', error);
    return null;
  }
}

/**
 * Render a memo (consignment) acknowledgement through a template.
 *
 * Same null-means-fallback contract; falls back to memoPrintService.ts's
 * hand-rolled A4 acknowledgement (printMemoAcknowledgement). Always rendered
 * at A4 (see DEFAULT_PAPER_SIZE_FOR_TYPE.memo_slip).
 */
export async function renderMemoWithTemplate(
  memo: Memo,
  options: {
    storeId?: string;
    logoUrl?: string | null;
    context?: MemoPrintContext;
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    storeId, logoUrl, context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!memo) return null;

  try {
    const templates = await loadTemplates({ templateType: 'memo_slip', storeId }).catch(() => []);
    const template = selectTemplate(templates || [], 'memo_slip');
    if (!template) return null;

    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) return null;

    const data = memoToPrintData(memo, context);
    const html = buildPrintableHtml(blocks, data, 'a4', logoUrl ?? null);

    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    logger.error('[print] Memo template rendering failed; using the built-in acknowledgement', error);
    return null;
  }
}

/**
 * Render a layaway agreement through a template.
 *
 * Same null-means-fallback contract; falls back to layawayPrintService.ts's
 * hand-rolled A4 agreement (printAgreement). Always rendered at A4.
 */
export async function renderLayawayAgreementWithTemplate(
  plan: Layaway,
  options: {
    storeId?: string;
    logoUrl?: string | null;
    context?: LayawayPrintContext;
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    storeId, logoUrl, context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!plan) return null;

  try {
    const templates = await loadTemplates({ templateType: 'layaway_agreement', storeId }).catch(() => []);
    const template = selectTemplate(templates || [], 'layaway_agreement');
    if (!template) return null;

    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) return null;

    const data = layawayAgreementToPrintData(plan, context);
    const html = buildPrintableHtml(blocks, data, 'a4', logoUrl ?? null);

    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    logger.error('[print] Layaway agreement template rendering failed; using the built-in agreement', error);
    return null;
  }
}

/**
 * Render a layaway payment receipt through a template.
 *
 * Same null-means-fallback contract; falls back to layawayPrintService.ts's
 * hand-rolled thermal receipt (printPaymentReceipt). Always rendered at
 * 80mm.
 */
export async function renderLayawayReceiptWithTemplate(
  plan: Layaway,
  payment: {
    paymentAmount: number;
    paymentMethod: string;
    reference?: string | null;
    newPaidAmount: number;
    newBalance: number;
  },
  options: {
    storeId?: string;
    logoUrl?: string | null;
    context?: LayawayPrintContext;
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    storeId, logoUrl, context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!plan) return null;

  try {
    const templates = await loadTemplates({ templateType: 'layaway_receipt', storeId }).catch(() => []);
    const template = selectTemplate(templates || [], 'layaway_receipt');
    if (!template) return null;

    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) return null;

    const data = layawayReceiptToPrintData(plan, payment, context);
    const html = buildPrintableHtml(blocks, data, '80mm', logoUrl ?? null);

    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    logger.error('[print] Layaway receipt template rendering failed; using the built-in receipt', error);
    return null;
  }
}

/**
 * Render a savings scheme passbook through a template.
 *
 * Same null-means-fallback contract; falls back to
 * SavingsSchemesPage.tsx's inline printPassbook. Always rendered at A4.
 */
export async function renderSavingsWithTemplate(
  enrollment: SchemeEnrollment,
  options: {
    storeId?: string;
    logoUrl?: string | null;
    context?: SavingsPrintContext;
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    storeId, logoUrl, context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!enrollment) return null;

  try {
    const templates = await loadTemplates({ templateType: 'savings_enrollment', storeId }).catch(() => []);
    const template = selectTemplate(templates || [], 'savings_enrollment');
    if (!template) return null;

    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) return null;

    const data = savingsToPrintData(enrollment, context);
    const html = buildPrintableHtml(blocks, data, 'a4', logoUrl ?? null);

    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    logger.error('[print] Savings template rendering failed; using the built-in passbook', error);
    return null;
  }
}

/**
 * Render a special/back order acknowledgement through a template.
 *
 * OrdersPage.tsx has never had a print path before this — there is no
 * "legacy" document to fall back to. Returns null when no published
 * template exists so the caller can tell the user printing isn't set up
 * yet, rather than silently doing nothing.
 */
export async function renderOrderWithTemplate(
  order: SalesOrder,
  options: {
    storeId?: string;
    logoUrl?: string | null;
    context?: OrderPrintContext;
    loadTemplates?: (filters: { templateType?: string; storeId?: string }) => Promise<PrintTemplate[]>;
  } = {},
): Promise<TemplateReceiptResult | null> {
  const {
    storeId, logoUrl, context = {},
    loadTemplates = fetchPrintTemplates,
  } = options;

  if (!order) return null;

  try {
    const templates = await loadTemplates({ templateType: 'order_acknowledgement', storeId }).catch(() => []);
    const template = selectTemplate(templates || [], 'order_acknowledgement');
    if (!template) return null;

    const blocks = Array.isArray(template.blocks) ? template.blocks : null;
    if (!blocks || blocks.length === 0) return null;

    const data = orderToPrintData(order, context);
    const html = buildPrintableHtml(blocks, data, 'a4', logoUrl ?? null);

    return { html, css: '', templateId: template.id, templateName: template.name };
  } catch (error) {
    logger.error('[print] Order acknowledgement template rendering failed', error);
    return null;
  }
}
