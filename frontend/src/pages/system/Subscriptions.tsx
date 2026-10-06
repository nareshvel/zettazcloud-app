import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Wallet } from 'lucide-react';
import { ago, platformApi, type BillingIssue, type SubscriptionRow } from '@/services/platformApi';
import { Badge, btn, Empty, Field, inputCls, Modal, PageHeader, Spinner, statusColor } from '@/components/system/ui';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useToast } from '@/hooks/use-toast';

const Subscriptions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = hasPermission(user, 'subscriptions.edit', { allowWildcard: false, checkAdmin: false });

  const [tab, setTab] = useState<'subs' | 'issues'>('subs');
  const [rows, setRows] = useState<SubscriptionRow[] | null>(null);
  const [issues, setIssues] = useState<BillingIssue[] | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<SubscriptionRow | null>(null);
  const [dunningBusy, setDunningBusy] = useState(false);

  const load = () => {
    platformApi.subscriptions(status || undefined).then(setRows).catch((e) => setError(e.message));
    platformApi.billingIssues().then(setIssues).catch(() => setIssues([]));
  };
  useEffect(load, [status]);

  const runDunning = async () => {
    setDunningBusy(true);
    try {
      const r = await platformApi.runDunning();
      toast({ title: 'Dunning run complete', description: String((r as Record<string, unknown>)?.message || '') });
      load();
    } catch (e) { toast({ title: 'Dunning failed', description: (e as Error).message, variant: 'destructive' }); }
    finally { setDunningBusy(false); }
  };

  return (
    <div>
      <PageHeader eyebrow="System" title="Subscriptions" icon={Wallet} subtitle="Tenant billing state across the platform" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          {(['subs', 'issues'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 ${tab === t ? 'bg-primary-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {t === 'subs' ? 'All subscriptions' : `Billing issues${issues ? ` (${issues.length})` : ''}`}
            </button>
          ))}
        </div>
        {tab === 'subs' && (
          <div className="w-44 shrink-0">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['active', 'trial', 'past_due', 'expired', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        {canEdit && (
          <button className={`${btn.secondary} ml-auto`} disabled={dunningBusy} onClick={runDunning}>
            <RefreshCw className={`h-4 w-4 ${dunningBusy ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Run dunning</span>
          </button>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tab === 'subs' ? (
        !rows ? <Spinner /> : rows.length === 0 ? <Empty icon={Wallet} title="No subscriptions" /> : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Cycle</th>
                  <th className="px-4 py-3">Status</th><th className="px-4 py-3">Ends</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.tenantName}</td>
                    <td className="px-4 py-3 text-slate-700">{s.planName || s.planId || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{s.billingCycle || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge color={statusColor(s.status)}>{s.status}</Badge>
                      {s.gracePeriodEndsAt && <Badge className="ml-1" color="red">grace</Badge>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.trialEndDate ? `trial ${ago(s.trialEndDate)}` : ago(s.endDate)}</td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && <button className={btn.ghost} onClick={() => setEdit(s)}>Edit</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        !issues ? <Spinner /> : issues.length === 0 ? <Empty icon={Wallet} title="No billing issues" text="Nothing needs attention right now." /> : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Issue</th><th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Failed attempts</th><th className="px-4 py-3">When</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{i.tenantName}</td>
                    <td className="px-4 py-3"><Badge color={statusColor(i.issue)}>{i.issue.replace('_', ' ')}</Badge></td>
                    <td className="px-4 py-3 text-slate-700">{i.planName || '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{i.failedAttempts}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{ago(i.gracePeriodEndsAt || i.trialEndDate || i.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {edit && (
        <EditSubModal sub={edit} onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); }} />
      )}
    </div>
  );
};

const EditSubModal = ({ sub, onClose, onSaved }: { sub: SubscriptionRow; onClose: () => void; onSaved: () => void }) => {
  const { toast } = useToast();
  const [f, setF] = useState({
    status: sub.status, endDate: (sub.endDate || '').slice(0, 10),
    trialEndDate: (sub.trialEndDate || '').slice(0, 10),
    billingCycle: sub.billingCycle || 'monthly', autoRenew: !!sub.autoRenew,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await platformApi.updateSubscription(sub.id, f);
      toast({ title: 'Subscription updated' });
      onSaved();
    } catch (e) { toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Edit subscription — ${sub.tenantName}`}
      footer={<><button className={btn.secondary} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy} onClick={save}>Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
            {['active', 'trial', 'past_due', 'expired', 'cancelled', 'inactive'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Billing cycle">
          <select className={inputCls} value={f.billingCycle} onChange={(e) => set('billingCycle', e.target.value)}>
            <option value="monthly">monthly</option><option value="yearly">yearly</option>
          </select>
        </Field>
        <Field label="End date"><input className={inputCls} type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
        <Field label="Trial end"><input className={inputCls} type="date" value={f.trialEndDate} onChange={(e) => set('trialEndDate', e.target.value)} /></Field>
        <Field label="Auto-renew">
          <select className={inputCls} value={f.autoRenew ? '1' : '0'} onChange={(e) => set('autoRenew', e.target.value === '1')}>
            <option value="1">on</option><option value="0">off</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
};

export default Subscriptions;
