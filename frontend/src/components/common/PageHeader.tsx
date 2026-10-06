import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Right-aligned actions (e.g. a primary Button). */
  actions?: React.ReactNode;
}

/**
 * Standard page header used across all top-level pages.
 * Keeps title/subtitle/action layout and spacing consistent.
 *
 * Breadcrumbs are handled entirely by TopBar.tsx (a single truncated current-page
 * label on mobile, the full trail from `md:` up) — an earlier attempt to also show
 * the trail here duplicated the page title that's already the very next line down,
 * so it was reverted (2026-08-31).
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon: Icon, actions }) => (
  <div className="flex items-start justify-between mb-6 gap-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        {Icon && <Icon className="h-6 w-6 text-primary" />} {title}
      </h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
