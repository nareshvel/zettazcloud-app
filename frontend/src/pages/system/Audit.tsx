import { useEffect, useState } from 'react';
import { AlertTriangle, FileText, Search } from 'lucide-react';
import { ago, platformApi, type AuditEntry, type TenantRow } from '@/services/platformApi';
import { Badge, Empty, inputCls, PageHeader, Spinner, statusColor } from '@/components/system/ui';

const PAGE_SIZE = 100;

const Audit = () => {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');

  const load = () => {
    platformApi.audit({ tenantId: tenantId || undefined, limit: PAGE_SIZE, offset })
      .then(setRows).catch((e) => setError(e.message));
  };
  useEffect(load, [tenantId, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { platformApi.tenants().then(setTenants).catch(() => {}); }, []);

  const filtered = (rows || []).filter((r) =>
    !search || `${r.action} ${r.tenantName || ''} ${r.userEmail || ''}`.toLowerCase().includes(search.toLowerCase()));

  if (error) return <Empty icon={AlertTriangle} title="Could not load audit log" text={error} />;

  return (
    <div>
      <PageHeader eyebrow="System" title="Audit log" icon={FileText} subtitle="Platform and tenant activity trail" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} w-64 pl-9`} placeholder="Filter results…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputCls} w-56`} value={tenantId} onChange={(e) => { setTenantId(e.target.value); setOffset(0); }}>
          <option value="">All tenants + platform</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {!rows ? <Spinner /> : filtered.length === 0 ? <Empty icon={FileText} title="No audit entries" /> : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Severity</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{ago(r.createdAt)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.tenantName || 'platform'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{r.userEmail || 'system'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-800">{r.action}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{r.entityType}{r.entityId ? ` · ${String(r.entityId).slice(0, 8)}` : ''}</td>
                  <td className="px-4 py-2.5">{r.severity && <Badge color={statusColor(r.severity)}>{r.severity}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-sm">
        <button className={inputCls.replace('block w-full', 'inline-flex w-auto')} disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>← Prev</button>
        <span className="text-xs text-slate-500">offset {offset}</span>
        <button className={inputCls.replace('block w-full', 'inline-flex w-auto')} disabled={(rows?.length || 0) < PAGE_SIZE}
          onClick={() => setOffset(offset + PAGE_SIZE)}>Next →</button>
      </div>
    </div>
  );
};

export default Audit;
