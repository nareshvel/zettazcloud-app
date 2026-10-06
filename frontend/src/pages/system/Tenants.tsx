/**
 * Tenants — platform console tenant management.
 * List with health/status badges, detail drawer (profile, subscription,
 * admins, stores, feature flags), lifecycle actions (suspend / resume /
 * schedule-deletion / cancel), data export, and impersonation.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Building2, Download, Eye, Pause, Pencil, Play,
  Plus, Search, Trash2, X,
} from 'lucide-react';
import {
  ago, downloadTenantExport, platformApi,
  type TenantDetail, type TenantRow,
} from '@/services/platformApi';
import { Badge, Empty, Field, inputCls, Modal, PageHeader, Spinner, Stat, statusColor, btn } from '@/components/system/ui';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { IMPERSONATOR_TOKEN_KEY } from '@/components/system/ImpersonationBanner';
import { useNavigate } from 'react-router-dom';

const FLAG_LABEL: Record<string, string> = {
  suspended: 'Suspended', pending_deletion: 'Pending deletion', payment_grace: 'Payment grace',
  trial_ending: 'Trial ending', inactive_14d: 'Inactive 14d+',
};

const Tenants = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const can = (p: string) => hasPermission(user, p, { allowWildcard: false, checkAdmin: false });

  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [searchParams] = useSearchParams();

  const load = () => platformApi.tenants().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const f = searchParams.get('focus');
    if (f) setFocusId(f);
  }, [searchParams]);

  const filtered = useMemo(() => (rows || []).filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, search, statusFilter]);

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); }
  };

  if (error) return <Empty icon={AlertTriangle} title="Could not load tenants" text={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="System" title="Tenants" icon={Building2}
        subtitle={`${rows?.length ?? '…'} workspaces on the platform`}
        actions={can('tenants.create') && (
          <button className={btn.primary} onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />New tenant
          </button>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className={`${inputCls} pl-9 w-64`} placeholder="Search tenants…"
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputCls} w-44`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending_deletion">Pending deletion</option>
        </select>
      </div>

      {!rows ? <Spinner /> : filtered.length === 0 ? (
        <Empty icon={Building2} title="No tenants found" text="Adjust the search or create the first tenant." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Plan / subscription</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setFocusId(t.id)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.industryCode || '—'} · joined {ago(t.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{t.planName || '—'}</p>
                    <Badge color={statusColor(t.subStatus)}>{t.subStatus || 'none'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {t.userCount} users · {t.storeCount} stores · {t.productCount} products
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor(t.healthStatus)}>{t.healthStatus.replace('_', ' ')}</Badge>
                    <span className="ml-1 text-xs tabular-nums text-slate-500">{t.healthScore}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{ago(t.lastLoginAt)}</td>
                  <td className="px-4 py-3"><Badge color={statusColor(t.status)}>{t.status.replace('_', ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {focusId && (
        <TenantDrawer
          id={focusId}
          onClose={() => setFocusId(null)}
          can={can}
          onChanged={load}
          onAct={act}
          onImpersonate={(tenantName, result) => {
            sessionStorage.setItem(IMPERSONATOR_TOKEN_KEY, localStorage.getItem('auth_token') || '');
            localStorage.setItem('auth_token', result.token);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('user');
            navigate('/dashboard');
            window.location.reload();
          }}
        />
      )}
      {showCreate && (
        <TenantFormModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

const TenantDrawer = ({ id, onClose, can, onChanged, onAct, onImpersonate }: {
  id: string; onClose: () => void; can: (p: string) => boolean;
  onChanged: () => Promise<void> | void;
  onAct: (fn: () => Promise<unknown>) => Promise<void>;
  onImpersonate: (tenantName: string, result: { token: string; actingAs: string }) => void;
}) => {
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [features, setFeatures] = useState<Array<{ key: string; override: string; effective: boolean }>>([]);
  const [mode, setMode] = useState<null | 'edit' | 'suspend' | 'delete' | 'impersonate'>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const refresh = () => {
    platformApi.tenant(id).then(setDetail).catch((e) => setErr(e.message));
    platformApi.tenantFeatures(id).then(setFeatures).catch(() => {});
  };
  useEffect(refresh, [id]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); setMode(null); refresh(); await onChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!detail) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
        <div className="h-full w-full max-w-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {err ? <Empty icon={AlertTriangle} title="Error" text={err} /> : <Spinner />}
        </div>
      </div>
    );
  }

  const { tenant, subscription, admins, stores, counts } = detail;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{tenant.name}</h2>
            <p className="text-xs text-slate-500">{String(tenant.id)}</p>
            <div className="mt-1.5 flex gap-1.5">
              <Badge color={statusColor(tenant.status)}>{tenant.status.replace('_', ' ')}</Badge>
              {subscription && <Badge color={statusColor(String(subscription.status))}>{`${subscription.planName || 'plan'} · ${String(subscription.status)}`}</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

          <div className="grid grid-cols-4 gap-3">
            <Stat label="Users" value={counts.users} />
            <Stat label="Stores" value={counts.stores} />
            <Stat label="Products" value={counts.products} />
            <Stat label="Sales" value={counts.sales} />
          </div>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Admins</p>
            {admins.length === 0 ? <p className="text-sm text-slate-500">No tenant admins.</p> : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {admins.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div><p className="font-medium text-slate-900">{a.name}</p><p className="text-xs text-slate-500">{a.email}</p></div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {a.totpEnabled && <Badge color="green">2FA</Badge>}
                      <Badge color={a.isActive ? 'green' : 'gray'}>{a.isActive ? 'active' : 'disabled'}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stores</p>
            {stores.length === 0 ? <p className="text-sm text-slate-500">No stores.</p> : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {stores.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-900">{s.name}</span>
                    <Badge color={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'active' : 'inactive'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {can('platform.features.manage') && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Feature flags</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {features.map((f) => (
                  <li key={f.key} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-900">{f.key.replace(/_/g, ' ')}
                      {f.override !== 'default' && <Badge className="ml-2" color={f.override === 'on' ? 'green' : 'red'}>{f.override}</Badge>}
                    </span>
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={f.override}
                      onChange={(e) => run(() => platformApi.setTenantFeature(id, f.key, e.target.value as 'default' | 'on' | 'off'))}
                      disabled={busy}
                    >
                      <option value="default">Plan default{f.effective ? ' (on)' : ' (off)'}</option>
                      <option value="on">Force on</option>
                      <option value="off">Force off</option>
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</p>
            <div className="flex flex-wrap gap-2">
              {can('tenants.edit') && <button className={btn.secondary} onClick={() => setMode('edit')}><Pencil className="h-3.5 w-3.5" />Edit</button>}
              {can('tenants.edit') && tenant.status === 'active' && (
                <button className={btn.secondary} onClick={() => setMode('suspend')}><Pause className="h-3.5 w-3.5" />Suspend</button>
              )}
              {can('tenants.edit') && tenant.status === 'suspended' && (
                <button className={btn.secondary} onClick={() => run(() => platformApi.resumeTenant(id))}><Play className="h-3.5 w-3.5" />Resume</button>
              )}
              {can('tenants.view') && (
                <button className={btn.secondary} disabled={busy}
                        onClick={() => run(() => downloadTenantExport(id))}>
                  <Download className="h-3.5 w-3.5" />Export
                </button>
              )}
              {can('platform.impersonate') && (
                <button className={btn.secondary} onClick={() => setMode('impersonate')}><Eye className="h-3.5 w-3.5" />Impersonate</button>
              )}
              {can('tenants.delete') && tenant.status !== 'pending_deletion' && (
                <button className={btn.danger} onClick={() => setMode('delete')}><Trash2 className="h-3.5 w-3.5" />Schedule deletion</button>
              )}
              {can('tenants.delete') && tenant.status === 'pending_deletion' && (
                <button className={btn.secondary} onClick={() => run(() => platformApi.cancelDeletion(id))}>Cancel deletion</button>
              )}
            </div>
            {tenant['deletionDueAt'] ? (
              <p className="mt-2 text-xs text-red-600">Deletion due {ago(String(tenant['deletionDueAt']))}{tenant['suspendedReason'] ? ` — ${String(tenant['suspendedReason'])}` : ''}</p>
            ) : tenant['suspendedReason'] ? (
              <p className="mt-2 text-xs text-amber-700">Suspension reason: {String(tenant['suspendedReason'])}</p>
            ) : null}
          </section>
        </div>

        {mode === 'edit' && (
          <TenantEditModal tenant={tenant} busy={busy} onClose={() => setMode(null)}
            onSave={(body) => run(() => platformApi.updateTenant(id, body))} />
        )}
        {mode === 'suspend' && (
          <ReasonModal title="Suspend tenant" busy={busy} onClose={() => setMode(null)} label="Reason for suspension"
            onSubmit={(reason) => run(() => platformApi.suspendTenant(id, reason))} />
        )}
        {mode === 'delete' && (
          <DeleteModal busy={busy} onClose={() => setMode(null)}
            onSubmit={(days, reason) => run(() => platformApi.scheduleDeletion(id, days, reason))} />
        )}
        {mode === 'impersonate' && (
          <ReasonModal title="Impersonate tenant" busy={busy} onClose={() => setMode(null)}
            label="Reason (min 10 chars)" hint="You'll act as this tenant's first admin for 30 minutes. The session is audited."
            onSubmit={(reason) => platformApi.impersonate(id, reason)
              .then((r) => onImpersonate(tenant.name, r))
              .catch((e) => setErr(e.message))} />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

const TenantFormModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const [f, setF] = useState({ name: '', adminName: '', adminEmail: '', adminPassword: '', adminPhone: '', industryCode: 'general_retail', planName: 'Starter', trialDays: 14 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr('');
    try { await platformApi.createTenant(f); onCreated(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="New tenant" size="lg"
      footer={<><button className={btn.secondary} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create tenant'}</button></>}>
      {err && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" required><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Industry">
          <select className={inputCls} value={f.industryCode} onChange={(e) => set('industryCode', e.target.value)}>
            <option value="general_retail">General retail</option>
            <option value="jewelry">Jewelry</option>
            <option value="electronics">Electronics</option>
            <option value="grocery">Grocery</option>
          </select>
        </Field>
        <Field label="Admin name" required><input className={inputCls} value={f.adminName} onChange={(e) => set('adminName', e.target.value)} /></Field>
        <Field label="Admin email" required><input className={inputCls} type="email" value={f.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} /></Field>
        <Field label="Admin password" required hint="Min 8 characters"><input className={inputCls} type="password" value={f.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} /></Field>
        <Field label="Admin phone"><input className={inputCls} value={f.adminPhone} onChange={(e) => set('adminPhone', e.target.value)} /></Field>
        <Field label="Plan">
          <select className={inputCls} value={f.planName} onChange={(e) => set('planName', e.target.value)}>
            <option>Starter</option><option>Professional</option><option>Enterprise</option>
          </select>
        </Field>
        <Field label="Trial days"><input className={inputCls} type="number" min={0} max={90} value={f.trialDays} onChange={(e) => set('trialDays', Number(e.target.value))} /></Field>
      </div>
    </Modal>
  );
};

const TenantEditModal = ({ tenant, busy, onClose, onSave }: {
  tenant: Record<string, unknown>; busy: boolean; onClose: () => void; onSave: (b: Record<string, unknown>) => void;
}) => {
  const [f, setF] = useState({
    name: String(tenant.name || ''), email: String(tenant.email || ''), phone: String(tenant.phone || ''),
    website: String(tenant.website || ''), city: String(tenant.city || ''), countryCode: String(tenant.countryCode || ''),
    industryCode: String(tenant.industryCode || ''),
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal open onClose={onClose} title="Edit tenant" size="lg"
      footer={<><button className={btn.secondary} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy} onClick={() => onSave(f)}>Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Industry"><input className={inputCls} value={f.industryCode} onChange={(e) => set('industryCode', e.target.value)} /></Field>
        <Field label="Email"><input className={inputCls} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Website"><input className={inputCls} value={f.website} onChange={(e) => set('website', e.target.value)} /></Field>
        <Field label="Country code"><input className={inputCls} value={f.countryCode} onChange={(e) => set('countryCode', e.target.value)} placeholder="US" /></Field>
      </div>
    </Modal>
  );
};

const ReasonModal = ({ title, label, hint, busy, onClose, onSubmit }: {
  title: string; label: string; hint?: string; busy: boolean;
  onClose: () => void; onSubmit: (reason: string) => void;
}) => {
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onClose} title={title} size="sm"
      footer={<><button className={btn.secondary} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy || !reason.trim()} onClick={() => onSubmit(reason.trim())}>Confirm</button></>}>
      <Field label={label} required hint={hint}>
        <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
};

const DeleteModal = ({ busy, onClose, onSubmit }: {
  busy: boolean; onClose: () => void; onSubmit: (days: number, reason: string) => void;
}) => {
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onClose} title="Schedule tenant deletion" size="sm"
      footer={<><button className={btn.secondary} onClick={onClose}>Cancel</button>
        <button className={btn.danger} disabled={busy || !reason.trim()} onClick={() => onSubmit(days, reason.trim())}>Schedule</button></>}>
      <div className="space-y-4">
        <Field label="Days until deletion (7–90)" required>
          <input className={inputCls} type="number" min={7} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </Field>
        <Field label="Reason" required>
          <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          The tenant is locked out immediately. After the grace period, all tenant data is permanently deleted by the cleanup job. This cannot be undone.
        </p>
      </div>
    </Modal>
  );
};

export default Tenants;
