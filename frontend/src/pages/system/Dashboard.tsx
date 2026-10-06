import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CreditCard, Store, Users } from 'lucide-react';
import { platformApi, money, ago, type Overview } from '@/services/platformApi';
import { Badge, Empty, PageHeader, Spinner, Stat, statusColor } from '@/components/system/ui';

const SystemDashboard = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    platformApi.overview().then(setData).catch((e) => setError(e.message || 'Failed to load overview'));
  }, []);

  if (error) return <Empty icon={AlertTriangle} title="Could not load overview" text={error} />;
  if (!data) return <Spinner />;

  const mrrEntries = Object.entries(data.revenue.mrr || {});
  const mrrLabel = mrrEntries.length
    ? mrrEntries.map(([cur, v]) => money(v, cur)).join('  ·  ')
    : '$0';

  return (
    <div>
      <PageHeader eyebrow="System" title="Platform overview" subtitle="Tenancy, revenue and usage at a glance" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tenants" value={data.tenants.total} sub={`${data.tenants.active} active`} icon={Building2} tone="brand" />
        <Stat label="New this month" value={data.tenants.newThisMonth} />
        <Stat label="Suspended" value={data.tenants.suspended} tone={data.tenants.suspended ? 'warn' : 'neutral'} />
        <Stat label="Pending deletion" value={data.tenants.pendingDeletion} tone={data.tenants.pendingDeletion ? 'bad' : 'neutral'} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="MRR" value={mrrLabel} icon={CreditCard} tone="good" />
        <Stat label="Paying tenants" value={data.revenue.paying} sub={`${data.revenue.trials} on trial`} />
        <Stat label="Trials ending (7d)" value={data.revenue.trialsEnding7d} tone={data.revenue.trialsEnding7d ? 'warn' : 'neutral'} />
        <Stat label="Payment grace" value={data.revenue.pastDue} tone={data.revenue.pastDue ? 'bad' : 'neutral'} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Staff accounts" value={data.usage.staff} icon={Users} sub={`${data.usage.activeStaff7d} active (7d)`} />
        <Stat label="Stores" value={data.usage.stores} icon={Store} />
        <Stat label="Products" value={data.usage.products} />
        <Stat label="Sales (30d)" value={data.usage.sales30d} />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-semibold text-slate-900">Needs attention</p>
          <Link to="/system/tenants" className="text-xs font-medium text-primary-700 hover:underline">All tenants →</Link>
        </div>
        {data.attention.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">All tenants are healthy.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.attention.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Link to={`/system/tenants?focus=${t.id}`} className="text-sm font-medium text-primary-700 hover:underline">
                  {t.name}
                </Link>
                <div className="flex items-center gap-2">
                  {t.flags.slice(0, 3).map((f) => <Badge key={f} color={statusColor(f)}>{f.replace(/_/g, ' ')}</Badge>)}
                  <span className="text-xs tabular-nums text-slate-500">{t.healthScore}/100</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SystemDashboard;
