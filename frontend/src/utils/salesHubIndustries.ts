/**
 * Single source of truth for which business types get the Sales Hub
 * (`/sales-hub` — the fullscreen, search-first counter screen; see
 * SalesHubPage.tsx and docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md).
 *
 * Originally jewelry-only. Opened up to every business type EXCEPT grocery
 * (2026-09-02) — a grocery counter's workflow is high-volume scan-and-go with
 * no customer-relationship lookups (no repairs/layaways/memos/savings to
 * find), so the Hub's whole reason for existing — surfacing a customer's
 * open items across modules — doesn't apply there. Every other vertical
 * benefits from at least the universal search + New Sale / Duty-Free Sale
 * hero tiles, even if some of the "Start something new" shortcuts stay
 * hidden for them (see SalesHubPage.tsx's `shortcuts` industry filtering).
 *
 * Used by: AppRoutes.tsx (route gate), Sidebar.tsx (nav visibility),
 * Login.tsx (post-login redirect for sales-floor users).
 *
 * IMPORTANT: keep in sync with backend/services/retailProfileService.js's
 * INDUSTRIES catalog — pharmacy is excluded here too since it isn't
 * selectable at all yet (`available: false`).
 */
export const SALES_HUB_INDUSTRIES = ['general_retail', 'electronics', 'apparel', 'jewelry', 'souvenir_gifts'] as const;

export type SalesHubIndustry = typeof SALES_HUB_INDUSTRIES[number];

export const hasSalesHub = (industryCode?: string | null): boolean =>
  !!industryCode && (SALES_HUB_INDUSTRIES as readonly string[]).includes(industryCode);
