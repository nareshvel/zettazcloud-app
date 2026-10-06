import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { ago, platformApi, type HealthReport } from '@/services/platformApi';
import { Badge, btn, Empty, PageHeader, Spinner, Stat, statusColor } from '@/components/system/ui';

const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

const Health = () => {
  const [data, setData] = useState<HealthReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setBusy(true);
    platformApi.health().then(setData).catch((e) => setError(e.message)).finally(() => setBusy(false));
  };
  useEffect(() => { load(); }, []);

  if (error) return <Empty icon={AlertTriangle} title="Could not load health" text={error} />;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader eyebrow="System" title="Health" icon={Activity} subtitle="Runtime and scheduled-job status"
        actions={<button className={btn.secondary} disabled={busy} onClick={load}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh
        </button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Database" value={data.database === 'up' ? 'Connected' : 'DOWN'} icon={Database}
          tone={data.database === 'up' ? 'good' : 'bad'} />
        <Stat label="Uptime" value={fmtUptime(data.uptimeSeconds)} />
        <Stat label="Node" value={data.node} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">Scheduled jobs</p>
        {data.jobs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No job runs recorded yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Job</th><th className="px-4 py-3">Last run</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Result</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.jobs.map((j) => (
                <tr key={j.jobName}>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">{j.jobName}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{ago(j.startedAt)}</td>
                  <td className="px-4 py-3"><Badge color={statusColor(j.status)}>{j.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{j.message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Health;
