import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart2,
  Archive,
  DollarSign,
  Users,
  TrendingUp,
  CreditCard,
  Gem,
  Shirt,
  Pill,
  ShoppingCart,
  Cpu,
  Printer,
  Receipt,
  RotateCcw,
  UserCheck,
  PieChart,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { getTenantIndustry } from '../../services/industryService';

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

interface ReportDef {
  name: string;
  path: string;
  icon: React.ElementType;
  description: string;
  /** Colour-accent class for the icon container (light bg). */
  accent?: string;
}

const coreReports: ReportDef[] = [
  { name: 'Sales', path: '/reports/sales', icon: BarChart2, description: 'Revenue trends, daily sales, and transaction history.', accent: 'bg-blue-500/10 text-blue-600 ring-blue-500/20' },
  { name: 'Payments', path: '/reports/payments', icon: DollarSign, description: 'Payment methods, settlement, and reconciliation.', accent: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20' },
  { name: 'Inventory', path: '/reports/inventory', icon: Archive, description: 'Stock levels, valuation, and product performance.', accent: 'bg-violet-500/10 text-violet-600 ring-violet-500/20' },
  { name: 'Customer Value', path: '/reports/customer-value', icon: TrendingUp, description: 'Lifetime value, purchase frequency, and segmentation.', accent: 'bg-amber-500/10 text-amber-600 ring-amber-500/20' },
  { name: 'Charge Accounts', path: '/reports/charge-accounts', icon: CreditCard, description: 'Outstanding balances, credit limits, and receivables.', accent: 'bg-rose-500/10 text-rose-600 ring-rose-500/20' },
  { name: 'User Activity', path: '/reports/user-activity', icon: Users, description: 'Staff actions, login history, and system access.', accent: 'bg-cyan-500/10 text-cyan-600 ring-cyan-500/20' },
  { name: 'Tax Collected', path: '/reports/tax', icon: Receipt, description: 'Tax breakdown by period and jurisdiction.', accent: 'bg-teal-500/10 text-teal-600 ring-teal-500/20' },
  { name: 'Sales Returns', path: '/reports/returns', icon: RotateCcw, description: 'Refunds, returns, and exchange tracking.', accent: 'bg-orange-500/10 text-orange-600 ring-orange-500/20' },
  { name: 'Employee Performance', path: '/reports/employee-performance', icon: UserCheck, description: 'Sales by employee, targets, and commissions.', accent: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20' },
  { name: 'Category Sales', path: '/reports/category-sales', icon: PieChart, description: 'Revenue by product category and mix analysis.', accent: 'bg-pink-500/10 text-pink-600 ring-pink-500/20' },
  { name: 'Print Job History', path: '/reports/print-jobs', icon: Printer, description: 'Print queue, failures, and reprint history.', accent: 'bg-gray-500/10 text-gray-600 ring-gray-500/20' },
];

// Industry-specific report cards
const industryReports: Record<string, ReportDef[]> = {
  jewelry: [
    { name: 'Purity Valuation', path: '/reports/jewelry-valuation', icon: Gem, description: 'Stock value by metal purity, weight, and piece status.', accent: 'bg-yellow-500/10 text-yellow-600 ring-yellow-500/20' },
  ],
  apparel: [
    { name: 'Size & Style Stock', path: '/reports/inventory', icon: Shirt, description: 'Inventory by size, colour, and style attributes.', accent: 'bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/20' },
  ],
  pharmacy: [
    { name: 'Expiry Tracking', path: '/reports/inventory', icon: Pill, description: 'Products nearing or past expiry date.', accent: 'bg-red-500/10 text-red-600 ring-red-500/20' },
  ],
  electronics: [
    { name: 'Warranty & Serial', path: '/reports/inventory', icon: Cpu, description: 'Serialized products, warranty status, and service tags.', accent: 'bg-sky-500/10 text-sky-600 ring-sky-500/20' },
  ],
  grocery: [
    { name: 'Category Sales Mix', path: '/reports/sales', icon: ShoppingCart, description: 'Sales breakdown by grocery category.', accent: 'bg-lime-500/10 text-lime-600 ring-lime-500/20' },
  ],
};

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

const ReportCard: React.FC<ReportDef> = ({ name, path, icon: Icon, description, accent }) => (
  <Link
    to={path}
    className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  >
    {/* Decorative background circle */}
    <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/[0.04] transition-transform duration-300 group-hover:scale-150" />

    <div className="relative flex items-start justify-between gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${accent || 'bg-primary/10 text-primary ring-primary/10'} transition-colors group-hover:ring-primary/25`}>
        <Icon className="h-5 w-5" />
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
    </div>

    <div className="relative mt-4 flex flex-1 flex-col">
      <h3 className="text-[15px] font-semibold tracking-tight text-card-foreground">{name}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground line-clamp-2">{description}</p>
    </div>
  </Link>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ReportsCenter: React.FC = () => {
  const [industryCode, setIndustryCode] = useState<string | null>(null);

  useEffect(() => {
    getTenantIndustry().then(setIndustryCode).catch(() => setIndustryCode(null));
  }, []);

  const specificReports = industryCode ? (industryReports[industryCode] ?? []) : [];

  return (
    <div className="p-4 sm:p-6 space-y-8 min-h-screen">
      <PageHeader
        icon={BarChart2}
        title="Reports"
        subtitle="Business intelligence and operational insights."
      />

      {/* Core reports */}
      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Core</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">Business reports</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {coreReports.map(r => <ReportCard key={r.path} {...r} />)}
        </div>
      </section>

      {/* Industry reports */}
      {specificReports.length > 0 && (
        <section>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Industry</p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">Specialized reports</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {specificReports.map(r => <ReportCard key={r.path + r.name} {...r} />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default ReportsCenter;
