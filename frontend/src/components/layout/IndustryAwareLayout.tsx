import { Loader2 } from 'lucide-react';
import { useIndustry } from '@/hooks/useIndustry';
import { hasSalesHub } from '@/utils/salesHubIndustries';
import AppLayout from './AppLayout';
import HubFlowShell from './HubFlowShell';

/**
 * Route wrapper for pages that are Sales-Hub-only for Sales-Hub industries
 * but remain ordinary sidebar pages for grocery, the one industry without a
 * Sales Hub (Repairs, Old Gold, Savings Schemes, Layaway, Sales Orders,
 * Sales Return — see AppRoutes.tsx). Same route, different chrome, decided
 * at runtime by the tenant's industry via `hasSalesHub()` (single source of
 * truth: frontend/src/utils/salesHubIndustries.ts) — not two separate routes
 * to keep in sync.
 *
 * While industry is still resolving we render nothing but a spinner rather
 * than guessing, so a tenant never gets a flash of the sidebar (or vice
 * versa) before settling into the right shell.
 */
const IndustryAwareLayout = () => {
  const { industry, loading } = useIndustry();

  if (loading || !industry) {
    return (
      <div className="h-screen flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return hasSalesHub(industry) ? <HubFlowShell /> : <AppLayout />;
};

export default IndustryAwareLayout;
