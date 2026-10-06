import { useEffect, useState } from 'react';
import { getTenantIndustry } from '@/services/industryService';

/**
 * Resolves the current tenant's industry code once and caches it for the session.
 * Used to show/hide industry-specific navigation and features.
 *
 * Returns `industry = null` while loading so callers can avoid flashing the wrong
 * menu; treat `general_retail` as the safe default once resolved.
 */

const CACHE_KEY_BASE = 'tenant_industry_code';
let inFlight: Promise<string> | null = null;
let inFlightTenantId: string | null = null;

// The cache used to be a single global localStorage key shared by every
// tenant that ever logged in on this browser. On a shared/deployed
// environment where more than one demo tenant gets logged into in the same
// browser profile (jewelry, then grocery, etc.), the SECOND tenant's industry
// overwrote the key, and it was never cleared on login/logout — only
// GeneralSettings called clearIndustryCache(), and only after explicitly
// changing industry there. So a jewelry tenant logging in after a
// general_retail tenant had used the same browser would incorrectly see
// industry === 'general_retail' from stale cache and the jewelry-only Sales
// Hub menu would silently stay hidden, even though nothing was wrong with
// that tenant's actual data. Scoping the key by tenant_id fixes this: each
// tenant gets (and keeps) its own cached value, and switching tenants in the
// same browser naturally misses cache and re-fetches instead of inheriting
// another tenant's industry.
const cacheKeyFor = (tenantId: string | null) => `${CACHE_KEY_BASE}:${tenantId || 'unknown'}`;

export function useIndustry() {
  const tenantId = localStorage.getItem('tenant_id');
  const cacheKey = cacheKeyFor(tenantId);

  // localStorage (not sessionStorage) so the value survives the tab being
  // backgrounded/restored and doesn't need a network round-trip on every wake.
  const [industry, setIndustry] = useState<string | null>(
    () => localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey)
  );
  const [loading, setLoading] = useState(!industry);

  useEffect(() => {
    if (industry) return;
    let active = true;
    if (inFlight && inFlightTenantId !== tenantId) {
      // A previous tenant's lookup is still in flight — don't reuse it.
      inFlight = null;
    }
    inFlightTenantId = tenantId;
    inFlight = inFlight || getTenantIndustry();
    inFlight
      .then((code) => {
        const value = code || 'general_retail';
        localStorage.setItem(cacheKey, value);
        if (active) setIndustry(value);
      })
      // On failure fall back to general_retail rather than leaving it null —
      // a null industry would hide every industry-gated menu item indefinitely.
      .catch(() => { if (active) setIndustry('general_retail'); })
      .finally(() => {
        inFlight = null;
        inFlightTenantId = null;
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [industry, tenantId, cacheKey]);

  return { industry, loading };
}

/** Clear the cached industry for the current tenant (call after changing it in Settings). */
export function clearIndustryCache() {
  const tenantId = localStorage.getItem('tenant_id');
  const cacheKey = cacheKeyFor(tenantId);
  localStorage.removeItem(cacheKey);
  sessionStorage.removeItem(cacheKey);
  // Also clear the old unscoped key from any pre-fix session so it can never
  // be read as a fallback by leftover code paths.
  localStorage.removeItem(CACHE_KEY_BASE);
  sessionStorage.removeItem(CACHE_KEY_BASE);
}
