/**
 * Retail profile — business type + duty-free, and the documents they imply.
 *
 * Two settings drive the whole print module: what kind of shop this is, and
 * whether it sells duty-free. Everything else (which templates, whether tax
 * applies, whether a passport is captured) follows from those.
 */

import { fetchApi } from './api';

export type IndustryCode =
  | 'general_retail' | 'grocery' | 'electronics' | 'apparel' | 'jewelry' | 'pharmacy' | 'souvenir_gifts';

export interface IndustryOption {
  code: IndustryCode;
  label: string;
}

export interface TemplatePlanEntry {
  presetId: string;
  name: string;
  templateType: string;
  isDefault?: boolean;
  salesMode?: string;
  /** Named layout variant of the same template type, e.g. 'invoice.clean'. */
  layout?: string;
  overrides?: Record<string, unknown>;
}

export interface RetailProfile {
  storeId: string;
  storeName: string | null;
  industryCode: IndustryCode;
  industryLabel: string;
  /** False for verticals held back — pharmacy pending regulatory review. */
  industryAvailable: boolean;
  /** True when this store has its own override rather than inheriting the tenant's company-wide default. */
  industryIsOverride: boolean;
  salesMode: 'domestic' | 'duty_free' | 'export' | 'mixed';
  isDutyFree: boolean;
  supportsTaxRefund: boolean;

  /** Is a gapless number ALLOCATED for each sale? */
  sequentialNumbering: boolean;
  /** True where the jurisdiction requires it — the tenant cannot switch it off. */
  sequentialNumberingMandatory: boolean;

  /**
   * Is the number PRINTED as text? A separate decision from issuing it.
   * Off by default on thermal receipts (the barcode identifies the sale),
   * on by default on A4/Letter invoices (wholesale settles against it).
   */
  showNumberOnReceipt: boolean;
  showNumberOnInvoice: boolean;
  countryCode: string | null;
  currencyCode: string | null;
  /** The documents this profile calls for. */
  templatePlan: TemplatePlanEntry[];
  /**
   * Templates created as a side effect of this update.
   *
   * Only present on the PUT response: switching a store to duty-free adds a
   * document, and the user should be told it appeared rather than discovering
   * it later.
   */
  provisionedTemplates?: Array<{ id: string; name: string; presetId: string }>;
}

export interface MissingTemplates {
  profile: RetailProfile;
  missing: TemplatePlanEntry[];
}

export interface ProvisionResult {
  created: Array<{ id: string; name: string; presetId: string }>;
  skipped: Array<{ name: string; reason: string }>;
  profile: RetailProfile;
}

/** Business types a tenant may select. Excludes those held back. */
export const listIndustries = (): Promise<IndustryOption[]> =>
  fetchApi<IndustryOption[]>('/retail-profile/industries');

/** This store's profile and its template plan. */
export const getRetailProfile = (): Promise<RetailProfile> =>
  fetchApi<RetailProfile>('/retail-profile');

/**
 * Update business type and/or duty-free.
 *
 * Duty-free determines whether tax is charged at all, so treat it as a
 * financial setting and confirm the change with the user before sending.
 */
export const updateRetailProfile = (patch: {
  /** Pass `null` (not `undefined`) to reset this store back to inheriting the tenant's default. */
  industryCode?: IndustryCode | null;
  isDutyFree?: boolean;
  sequentialNumbering?: boolean;
  showNumberOnReceipt?: boolean;
  showNumberOnInvoice?: boolean;
}): Promise<RetailProfile> =>
  fetchApi<RetailProfile>('/retail-profile', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

/** Planned templates not yet created — lets settings show a count before acting. */
export const getMissingTemplates = (): Promise<MissingTemplates> =>
  fetchApi<MissingTemplates>('/retail-profile/templates/missing');

/**
 * Create the missing templates.
 * Additive only — existing templates are never modified or removed.
 */
export const provisionTemplates = (): Promise<ProvisionResult> =>
  fetchApi<ProvisionResult>('/retail-profile/templates/provision', {
    method: 'POST',
    body: JSON.stringify({ publish: true }),
  });
