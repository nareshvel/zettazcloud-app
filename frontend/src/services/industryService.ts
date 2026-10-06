import { fetchApi } from './api';

/**
 * Industry field-config + cost-code settings client.
 * Mirrors backend routes mounted at /api/industry.
 */

export type FieldDataType =
  | 'text' | 'number' | 'decimal' | 'date' | 'select' | 'boolean' | 'textarea';

export interface IndustryField {
  fieldKey: string;
  label: string;
  dataType: FieldDataType;
  options?: string[] | null;
  unit?: string | null;
  isRequired: boolean;
  isSearchable?: boolean;
  showOnReceipt?: boolean;
  isCustom?: boolean;
  sortOrder: number;
}

export interface IndustryFieldSchema {
  industry: string;
  appliesTo: string;
  fields: IndustryField[];
}

export interface CostCodeSettings {
  enabled: boolean;
  prefix: string;
  suffix: string;
  decimalChar: string;
  repeatChar: string;
  digitMap: Record<string, string>;
}

const unwrap = <T,>(r: any): T => (r && r.data !== undefined ? r.data : r);

export async function getIndustries(): Promise<{ code: string; name: string; description?: string }[]> {
  const r = await fetchApi<any>('/industry/industries');
  return unwrap(r);
}

export async function getTenantIndustry(): Promise<string> {
  const r = await fetchApi<any>('/industry/tenant');
  return unwrap<{ industryCode: string }>(r).industryCode;
}

export async function setTenantIndustry(industryCode: string): Promise<void> {
  await fetchApi('/industry/tenant', { method: 'PUT', body: JSON.stringify({ industryCode }) });
}

// ── Tenant (business/company) profile ───────────────────────────────────────
// GET is open to any authenticated user of the tenant; PATCH is Tenant Admin only.
// Company-level contact info (address/phone/email/website/logo) is distinct
// from any individual STORE's own address/phone/email/logo — see
// docs/17-migration-and-roadmap/22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md.
export interface TenantCompanyProfile {
  id: string;
  name: string;
  industryCode: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
}

export async function getTenantProfile(): Promise<TenantCompanyProfile> {
  const r = await fetchApi<any>('/tenants/me');
  return unwrap(r);
}

export async function setTenantName(name: string): Promise<{ name: string }> {
  const r = await fetchApi<any>('/tenants/me', { method: 'PATCH', body: JSON.stringify({ name }) });
  return unwrap<{ name: string }>(r);
}

/** Update any subset of the company's contact/communication profile fields. */
export async function updateTenantProfile(patch: Partial<Omit<TenantCompanyProfile, 'id' | 'industryCode'>>): Promise<Partial<TenantCompanyProfile>> {
  const r = await fetchApi<any>('/tenants/me', { method: 'PATCH', body: JSON.stringify(patch) });
  return unwrap(r);
}

export async function getProductFieldSchema(appliesTo = 'product'): Promise<IndustryFieldSchema> {
  const r = await fetchApi<any>(`/industry/fields?applies_to=${appliesTo}`);
  return unwrap<IndustryFieldSchema>(r);
}

export async function getCostCodeSettings(): Promise<CostCodeSettings> {
  const r = await fetchApi<any>('/industry/cost-code');
  return unwrap<CostCodeSettings>(r);
}

export async function saveCostCodeSettings(cfg: CostCodeSettings): Promise<CostCodeSettings> {
  const r = await fetchApi<any>('/industry/cost-code', { method: 'PUT', body: JSON.stringify(cfg) });
  return unwrap<CostCodeSettings>(r);
}

export async function previewCostCode(amount: number): Promise<{ amount: number; code: string; decoded: number }> {
  const r = await fetchApi<any>('/industry/cost-code/preview', { method: 'POST', body: JSON.stringify({ amount }) });
  return unwrap(r);
}

// ── Tenant field overrides ──────────────────────────────────────────────────

export interface TenantFieldOverride {
  fieldKey: string;
  label?: string | null;
  isEnabled: boolean;
  isRequired?: boolean;
  showOnReceipt?: boolean;
  sortOrder?: number;
  isCustom?: boolean;
  dataType?: FieldDataType;
  options?: string[] | null;
  unit?: string | null;
}

export async function getTenantFieldOverrides(appliesTo = 'product'): Promise<TenantFieldOverride[]> {
  const r = await fetchApi<any>(`/industry/overrides?applies_to=${appliesTo}`);
  return unwrap<TenantFieldOverride[]>(r) ?? [];
}

export async function saveTenantFieldOverride(override: TenantFieldOverride & { appliesTo?: string }): Promise<void> {
  await fetchApi('/industry/overrides', { method: 'PUT', body: JSON.stringify(override) });
}

export async function deleteTenantFieldOverride(fieldKey: string): Promise<void> {
  await fetchApi(`/industry/overrides/${fieldKey}`, { method: 'DELETE' });
}
