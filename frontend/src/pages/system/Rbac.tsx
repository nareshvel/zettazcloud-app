import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ShieldCheck } from 'lucide-react';
import { platformApi, type PlatformRole } from '@/services/platformApi';
import { Badge, btn, Empty, PageHeader, Spinner } from '@/components/system/ui';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useToast } from '@/hooks/use-toast';

interface Perm { id: string; name: string; description: string | null; module: string }

const Rbac = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = hasPermission(user, 'platform.manage', { allowWildcard: false, checkAdmin: false });

  const [roles, setRoles] = useState<PlatformRole[] | null>(null);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string>('');
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([platformApi.platformRoles(), platformApi.platformPermissions()])
    .then(([r, p]) => {
      setRoles(r); setPerms(p);
      if (!selected && r.length) setSelected(r[0].id);
    })
    .catch((e) => setError(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const role = useMemo(() => roles?.find((r) => r.id === selected), [roles, selected]);
  useEffect(() => {
    setDraft(new Set(role?.permissions.map((p) => p.permissionId) || []));
  }, [role]);

  const grouped = useMemo(() => {
    const g: Record<string, Perm[]> = {};
    for (const p of perms) (g[p.module || 'other'] ||= []).push(p);
    return g;
  }, [perms]);

  const toggle = (id: string) => {
    setDraft((d) => { const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const save = async () => {
    if (!role) return;
    setBusy(true);
    try {
      await platformApi.updatePlatformRolePermissions(role.id, [...draft]);
      toast({ title: `Permissions saved for ${role.name}` });
      load();
    } catch (e) { toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  if (error) return <Empty icon={AlertTriangle} title="Could not load roles" text={error} />;

  return (
    <div>
      <PageHeader eyebrow="System" title="Roles & permissions" icon={ShieldCheck}
        subtitle="Platform-level roles. Tenant roles are managed inside each workspace."
        actions={canEdit && <button className={btn.primary} disabled={busy || !role} onClick={save}><Save className="h-4 w-4" />Save changes</button>} />

      {!roles ? <Spinner /> : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="space-y-1">
            {roles.map((r) => (
              <button key={r.id} onClick={() => setSelected(r.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${selected === r.id ? 'bg-primary-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'}`}>
                <p className="font-medium">{r.name}</p>
                <p className={`text-xs ${selected === r.id ? 'text-primary-200' : 'text-slate-500'}`}>{r.permissions.length} permissions</p>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {role && <p className="mb-3 text-sm text-slate-600">{role.description}</p>}
            {Object.entries(grouped).map(([mod, list]) => (
              <div key={mod} className="mb-5 last:mb-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{mod}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {list.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                      <input type="checkbox" className="mt-0.5" disabled={!canEdit}
                        checked={draft.has(p.id)} onChange={() => toggle(p.id)} />
                      <span>
                        <span className="block text-sm font-medium text-slate-800">{p.name}</span>
                        {p.description && <span className="block text-xs text-slate-500">{p.description}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {!canEdit && <p className="mt-2 text-xs text-slate-500">Read-only — saving requires <code>platform.manage</code>.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Rbac;
