import React from 'react';
import { Navigate } from 'react-router-dom';
import { useIndustry } from '@/hooks/useIndustry';
import { Loader2 } from 'lucide-react';

interface IndustryRouteProps {
  /** Industry codes allowed to view this route. */
  allow: string[];
  children: React.ReactNode;
  /** Where to send a tenant whose industry isn't allowed. */
  redirectTo?: string;
}

/**
 * Route guard for vertical-specific pages. Prevents a bookmarked/typed URL from
 * rendering a module that doesn't apply to this tenant's business type.
 * The backend enforces the same rule via `requireIndustry` — this is UX only.
 */
const IndustryRoute: React.FC<IndustryRouteProps> = ({ allow, children, redirectTo = '/dashboard' }) => {
  const { industry, loading } = useIndustry();

  if (loading || !industry) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!allow.includes(industry)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default IndustryRoute;
