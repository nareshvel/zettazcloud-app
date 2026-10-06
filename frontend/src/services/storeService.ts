import { fetchApi } from './api';

// ── Original store list/type (restored — this file previously only had
// these two exports; UserFormModal.tsx and possibly others depend on them.
// Do not remove without checking callers first.) ───────────────────────────
export interface Store {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  status?: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Fetches all stores for the current tenant
 */
export const fetchStores = async (): Promise<Store[]> => {
  try {
    const response = await fetchApi<Store[]>('/stores');
    return response;
  } catch (error) {
    console.error('Error fetching stores:', error);
    return [];
  }
};

// ── Accessible stores (for the "Switch Store" menu) ────────────────────────
export interface AccessibleStore {
  id: string;
  name: string;
  isCurrent: boolean;
  isDefault: boolean;
}

export const getAccessibleStores = async (): Promise<AccessibleStore[]> =>
  fetchApi<AccessibleStore[]>('/stores/accessible');

/**
 * Soft-deletes a store: it stops appearing in every normal store list and
 * gets a 30-day restore window before backend/scripts/purge-expired-stores.js
 * permanently removes its data. The backend refuses this if the store is the
 * tenant's default store (change the default first — see setDefaultStore) or
 * its only remaining store; otherwise it's allowed even if the store has
 * products/sales/users, which is why the caller must explicitly confirm.
 * See docs/17-migration-and-roadmap/19_Store_Creation_And_Switching.md.
 */
export const deleteStore = async (storeId: string): Promise<void> => {
  await fetchApi(`/stores/${storeId}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm: true }),
  });
};

/** Tenant Admin only. Makes `storeId` the tenant's default store — the
 * default store is the only one that can't be soft-deleted through
 * deleteStore(). */
export const setDefaultStore = async (storeId: string): Promise<void> => {
  await fetchApi(`/stores/${storeId}/set-default`, { method: 'PATCH' });
};

export interface DeletedStore {
  id: string;
  name: string;
  deletedAt: string;
  scheduledPurgeAt: string;
  daysRemaining: number;
}

/** Tenant Admin only. Lists soft-deleted stores still inside their 30-day
 * restore window (i.e. not yet hard-purged). */
export const getDeletedStores = async (): Promise<DeletedStore[]> =>
  fetchApi<DeletedStore[]>('/stores/deleted');

/** Tenant Admin only. Restores a soft-deleted store, provided its purge date
 * hasn't passed yet. */
export const restoreStore = async (storeId: string): Promise<void> => {
  await fetchApi(`/stores/${storeId}/restore`, { method: 'POST' });
};

// ── Create store (full setup form) ──────────────────────────────────────────
export interface CreateStorePayload {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  currencyCode?: string;
  countryCode?: string;
  timezone?: string;
  defaultTaxBasis?: 'INCLUSIVE' | 'EXCLUSIVE';
  languageCode?: string;
  localeCode?: string;
  /** Raw DB pattern string (e.g. '1,234.56'), not the UI key — same contract
   * as PATCH /stores/settings. Convert the UI key before calling createStore. */
  numberFormat?: string;
  decimalPrecision?: number;
  measurementSystem?: 'metric' | 'imperial';
  dateFormat?: string;
  timeFormat?: string;
  theme?: 'light' | 'dark';
  /** What happens to existing tenant-wide shared products (products.store_id
   * IS NULL) when this store is created. 'shared' (default, or omitted) =
   * every shared product gets a store_product_listings row here immediately
   * (stock starts at 0). 'empty' = skip that provisioning; none of the
   * shared catalog is sellable here until someone explicitly adds it. See
   * docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §5.2. */
  catalogSharing?: 'shared' | 'empty';
  /** Per-store business type override. Omit/empty to inherit the tenant's
   * company-wide default (backend/services/retailProfileService.js's
   * INDUSTRIES catalog) — same convention as every other store. Applied
   * before print templates are provisioned, so the store's first templates
   * already match this vertical. */
  industryCode?: string;
  /** Sells duty-free/export. Applied before provisioning too, so a
   * duty-free store gets its duty-free document from day one instead of
   * needing a follow-up visit to Settings. */
  isDutyFree?: boolean;
}

export interface CreatedStore {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  currencyCode: string;
  countryCode: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  localeCode: string;
  languageCode: string;
  numberFormat: string;
  decimalPrecision: number;
  measurementSystem: string;
  defaultTaxBasis: string;
  theme: string;
}

export const createStore = async (payload: CreateStorePayload): Promise<CreatedStore> =>
  fetchApi<CreatedStore>('/stores', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ── Switch store ─────────────────────────────────────────────────────────
/**
 * Calls POST /auth/switch-store for a fresh JWT scoped to `storeId`, persists
 * it exactly the way a normal login does (same localStorage keys authService
 * uses), then does a full page reload.
 *
 * A full reload — not a soft context refresh — is deliberate: store_id is
 * baked into the JWT and read by most RBAC-gated backend routes, so swapping
 * the token without reloading risks pages/hooks that don't expect their
 * store context to change under them holding onto stale permission/store
 * state. See docs/17-migration-and-roadmap/19_Store_Creation_And_Switching.md.
 */
export const switchStore = async (storeId: string): Promise<void> => {
  const result = await fetchApi<{ token: string; user: Record<string, any> }>('/auth/switch-store', {
    method: 'POST',
    body: JSON.stringify({ storeId }),
  });

  if (!result?.token) {
    throw new Error('Switch store did not return a new session token.');
  }

  localStorage.setItem('auth_token', result.token);
  if (result.user) {
    try {
      localStorage.setItem('currentUser', JSON.stringify(result.user));
      // api.ts's fetchApi prioritizes localStorage's 'tenant_id'/'store_id' over
      // whatever the current token decodes to when building request headers
      // (see its "Always try to get tenant and store IDs from localStorage
      // first" block) — mirrors the same persistence login() does in api.ts.
      // Without this, switching stores leaves the OLD store_id in localStorage,
      // so every request after the reload sends a stale store-id header that
      // no longer matches the NEW token's store_id, and any route that
      // compares the two (e.g. GET /api/jurisdiction/current) 403s with
      // "Requested store is outside your access scope."
      const tenantId = (result.user as any).tenantId || (result.user as any).tenant_id;
      const newStoreId = (result.user as any).storeId || (result.user as any).store_id;
      if (tenantId) localStorage.setItem('tenant_id', tenantId);
      if (newStoreId) localStorage.setItem('store_id', newStoreId);
    } catch {
      // Non-fatal — the reload below re-fetches the user from the new token anyway.
    }
  }

  window.location.reload();
};
