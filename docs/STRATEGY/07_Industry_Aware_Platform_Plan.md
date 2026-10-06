# Industry-Aware Platform — Implementation Plan & Checklist

Goal: one codebase serving many verticals. A tenant picks an **industry**, and the
app adapts — product fields, navigation, and (later) reports, receipts and
defaults. A grocery store should never see "Old Gold" or "Repairs".

## 1. Where industry lives

- `industry_types` — catalogue of verticals (seeded): `general_retail`, `jewelry`,
  `apparel`, `electronics`, `grocery`, `pharmacy`.
- `tenants.industry_code` — the tenant's selected vertical (source of truth).
- `tenants.settings.businessType` — the marketing-facing onboarding answer.
- `backend/services/industryMapping.js` — the **single** place the two vocabularies
  meet (`businessType → industry_code`). Restaurant/cafe/food-truck map to
  `general_retail` because food service is served by the separate iRestrack product.

## 2. What's implemented

| Capability | Status |
|---|---|
| Industry catalogue + per-industry field definitions | ✅ (migration + seed applied) |
| Per-tenant field overrides (add/hide/relabel) | ✅ backend |
| Dynamic product fields render by industry | ✅ both product forms |
| Capture industry at **onboarding** | ✅ `businessType` → `industry_code` persisted |
| "Jewelry Store" option in onboarding | ✅ added |
| Change industry **after** setup | ✅ Settings → General → **Business Type** |
| Backfill industry for existing tenants | ✅ migration `2026-08-09_backfill_tenant_industry_code.sql` |
| Navigation hidden by industry | ✅ Sidebar `industries: [...]` gating |

**Current nav gating**

| Menu item | Visible for |
|---|---|
| Old Gold | `jewelry` |
| Repairs | `jewelry`, `electronics` |
| Serialized Stock | `jewelry`, `electronics` |
| Everything else | all industries |

## 3. How to gate a new feature by industry

**Navigation** — add `industries` to the item in `Sidebar.tsx`:

```ts
{ name: tNav('old_gold'), icon: Coins, path: "/old-gold",
  permissions: ['sales.view'], industries: ['jewelry'] }
```

Omit `industries` to show it to everyone. Items are hidden while the industry is
still resolving, so nothing flashes.

**Inside a page/component** — use the hook:

```ts
const { industry } = useIndustry();
if (industry === 'jewelry') { /* show purity column */ }
```

**Product fields** — don't hardcode. Add a row to `industry_field_definitions`
(seed file) and it appears automatically in both product forms.

## 4. Defence in depth — implemented

Industry gating is enforced at **three** layers:

1. **Navigation (UX):** `industries: [...]` on sidebar items hides irrelevant modules.
2. **Frontend route guard:** `components/common/IndustryRoute.tsx` wraps the
   vertical routes in `AppRoutes.tsx`, so a bookmarked/typed URL redirects to the
   dashboard instead of rendering an empty module.
3. **Backend middleware (the real boundary):** `middleware/requireIndustry.js`
   returns `403 INDUSTRY_NOT_ENABLED` for the wrong vertical.

| API | Allowed industries |
|---|---|
| `/api/old-gold` | `jewelry` |
| `/api/repairs` | `jewelry`, `electronics` |
| `/api/product-pieces` | `jewelry`, `electronics` |

**Fail-open policy:** if the tenant's industry cannot be resolved at all (missing
column, DB hiccup) the middleware allows the request so a transient error never
bricks a module. A *resolved but mismatched* industry always returns 403.

**Future:** when we sell per-vertical plans, fold this into the existing
subscription/plan feature flags rather than maintaining two parallel systems —
`requireIndustry` should then consult the plan, not just the industry.

## 5. Checklist for adding a new industry

1. Insert into `industry_types` (seed migration).
2. Add its default fields to `industry_field_definitions` (same seed).
3. Add the onboarding `businessType` option (`OnboardingWizard.tsx`) **and** the
   mapping entry in `industryMapping.js`.
4. Decide which existing modules to expose/hide (`industries` on nav items).
5. Add any vertical-specific receipt/report tweaks.
6. Update this doc's gating table.

## 6. Known gaps / next steps

- **Store-level industry.** Industry is currently per **tenant**. A multi-store
  tenant with different verticals per store would need `stores.industry_code` with
  tenant fallback. Not required today; note it before selling multi-vertical groups.
- **Reports & receipts** are not yet industry-aware (e.g. purity-wise valuation for
  jewelry). Tracked in doc 05.
- **Onboarding wizard** still shows food-service options (restaurant, cafe, food
  truck) that map to general retail. Consider removing them and pointing those
  signups at iRestrack.
- **`useIndustry` caches in `sessionStorage`.** Changing industry in Settings clears
  the cache and reloads; a tenant switch in the same tab should also clear it.
