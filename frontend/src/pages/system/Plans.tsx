import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Pencil, Plus } from 'lucide-react';
import { money, platformApi, type Plan } from '@/services/platformApi';
import { Badge, btn, Empty, Field, inputCls, Modal, PageHeader, Spinner, statusColor } from '@/components/system/ui';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useToast } from '@/hooks/use-toast';

const emptyPlan = {
  name: '', description: '', priceMonthly: 0, priceYearly: 0, currency: 'USD',
  features: '{}', limits: '{}', isActive: true,
};

const Plans = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = hasPermission(user, 'plans.edit', { allowWildcard: false, checkAdmin: false });
  const canCreate = hasPermission(user, 'plans.create', { allowWildcard: false, checkAdmin: false });

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Plan | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => platformApi.plans().then(setPlans).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <Empty icon={AlertTriangle} title="Could not load plans" text={error} />;

  return (
    <div>
      <PageHeader eyebrow="System" title="Plans" icon={CreditCard} subtitle="Subscription plans and limits"
        actions={canCreate && <button className={btn.primary} onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />New plan</button>} />

      {!plans ? <Spinner /> : plans.length === 0 ? <Empty icon={CreditCard} title="No plans configured" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{p.description || '—'}</p>
                </div>
                <Badge color={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'active' : 'inactive'}</Badge>
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {money(p.priceMonthly, p.currency)}<span className="text-sm font-normal text-slate-500">/mo</span>
                {p.priceYearly ? <span className="ml-2 text-sm font-normal text-slate-500">{money(p.priceYearly, p.currency)}/yr</span> : null}
              </p>
              {p.limits && (
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  {Object.entries(p.limits).slice(0, 5).map(([k, v]) => (
                    <p key={k} className="flex justify-between"><span>{k.replace(/_/g, ' ')}</span>
                      <span className="tabular-nums">{Number(v) === -1 ? '∞' : v}</span></p>
                  ))}
                </div>
              )}
              {canEdit && (
                <button className={`${btn.secondary} mt-4 w-full`} onClick={() => setEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />Edit plan
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(edit || showCreate) && (
        <PlanModal
          plan={edit}
          onClose={() => { setEdit(null); setShowCreate(false); }}
          onSaved={() => { setEdit(null); setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
};

const PlanModal = ({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) => {
  const { toast } = useToast();
  const [f, setF] = useState(plan ? {
    name: plan.name, description: plan.description || '',
    priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly || 0,
    currency: plan.currency || 'USD',
    features: JSON.stringify(plan.features || {}, null, 2),
    limits: JSON.stringify(plan.limits || {}, null, 2),
    isActive: !!plan.isActive,
  } : emptyPlan);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    let features: Record<string, unknown>; let limits: Record<string, unknown>;
    try { features = JSON.parse(f.features || '{}'); limits = JSON.parse(f.limits || '{}'); }
    catch { toast({ title: 'Invalid JSON in features or limits', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const body = { ...f, features, limits };
      if (plan) await platformApi.updatePlan(plan.id, body);
      else await platformApi.createPlan(body);
      toast({ title: plan ? 'Plan updated' : 'Plan created' });
      onSaved();
    } catch (e) { toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={plan ? `Edit plan — ${plan.name}` : 'New plan'} size="lg"
      footer={<><button className={btn.secondary} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy || !f.name.trim()} onClick={save}>Save plan</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Currency"><input className={inputCls} value={f.currency} onChange={(e) => set('currency', e.target.value)} /></Field>
        <Field label="Monthly price"><input className={inputCls} type="number" min={0} step="0.01" value={f.priceMonthly} onChange={(e) => set('priceMonthly', Number(e.target.value))} /></Field>
        <Field label="Yearly price"><input className={inputCls} type="number" min={0} step="0.01" value={f.priceYearly} onChange={(e) => set('priceYearly', Number(e.target.value))} /></Field>
        <Field label="Description" className="sm:col-span-2"><input className={inputCls} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Limits (JSON)" hint='e.g. {"max_users": 5, "max_stores": 2, "max_products": 500} — use -1 for unlimited' className="sm:col-span-2">
          <textarea className={`${inputCls} font-mono text-xs`} rows={4} value={f.limits} onChange={(e) => set('limits', e.target.value)} />
        </Field>
        <Field label="Features (JSON)" hint='e.g. {"catalog_sync": true, "duty_free": false}' className="sm:col-span-2">
          <textarea className={`${inputCls} font-mono text-xs`} rows={3} value={f.features} onChange={(e) => set('features', e.target.value)} />
        </Field>
        <Field label="Active">
          <select className={inputCls} value={f.isActive ? '1' : '0'} onChange={(e) => set('isActive', e.target.value === '1')}>
            <option value="1">active</option><option value="0">inactive</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
};

export default Plans;
