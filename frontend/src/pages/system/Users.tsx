import { useEffect, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Trash2, Users as UsersIcon } from 'lucide-react';
import { ago, platformApi, type SystemUser } from '@/services/platformApi';
import { Badge, btn, Empty, Field, inputCls, Modal, PageHeader, Spinner, statusColor } from '@/components/system/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const ROLE_NAMES = ['System Admin', 'System Manager', 'System Support'];

const SystemUsers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<SystemUser[] | null>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<SystemUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [remove, setRemove] = useState<SystemUser | null>(null);

  const load = () => platformApi.systemUsers().then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const doDelete = async () => {
    if (!remove) return;
    try {
      await platformApi.deleteSystemUser(remove.id);
      toast({ title: 'Platform user removed' });
      setRemove(null); load();
    } catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  if (error) return <Empty icon={AlertTriangle} title="Could not load users" text={error} />;

  return (
    <div>
      <PageHeader eyebrow="System" title="System users" icon={UsersIcon} subtitle="Platform staff with console access"
        actions={<button className={btn.primary} onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />New staff member</button>} />

      {!users ? <Spinner /> : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Last login</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.systemRoles.length ? u.systemRoles.map((r) => <Badge key={r} color="violet">{r}</Badge>) : <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{ago(u.lastLoginAt)}</td>
                  <td className="px-4 py-3"><Badge color={statusColor(u.isActive ? 'active' : 'inactive')}>{u.isActive ? 'active' : 'disabled'}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <button className={btn.ghost} onClick={() => setEdit(u)}><Pencil className="h-3.5 w-3.5" /></button>
                    {u.id !== user?.id && (
                      <button className={btn.ghost} onClick={() => setRemove(u)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <UserModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {edit && <UserModal user={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      <ConfirmDialog
        open={!!remove}
        onOpenChange={(o) => { if (!o) setRemove(null); }}
        title="Remove platform user"
        description={`Deactivate ${remove?.name}? Their sessions are revoked immediately.`}
        variant="destructive"
        onConfirm={doDelete}
        onCancel={() => setRemove(null)}
      />
    </div>
  );
};

const UserModal = ({ user, onClose, onSaved }: { user?: SystemUser; onClose: () => void; onSaved: () => void }) => {
  const { toast } = useToast();
  const [f, setF] = useState({
    name: user?.name || '', email: user?.email || '', password: '',
    roleName: user?.systemRoles[0] || 'System Support', isActive: user ? !!user.isActive : true,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      if (user) {
        const body: Record<string, unknown> = { name: f.name, roleName: f.roleName, isActive: f.isActive };
        if (f.password) body.password = f.password;
        await platformApi.updateSystemUser(user.id, body);
        toast({ title: 'Staff member updated' });
      } else {
        await platformApi.createSystemUser(f);
        toast({ title: 'Staff member created' });
      }
      onSaved();
    } catch (e) { toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' }); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={user ? `Edit — ${user.name}` : 'New platform staff member'}
      footer={<><button className={btn.secondary} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy || !f.name.trim() || (!user && (!f.email.trim() || f.password.length < 10))} onClick={save}>Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Email" required><input className={inputCls} type="email" disabled={!!user} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label={user ? 'New password (blank = keep)' : 'Password'} required={!user} hint="Min 10 characters">
          <input className={inputCls} type="password" value={f.password} onChange={(e) => set('password', e.target.value)} />
        </Field>
        <Field label="Platform role">
          <select className={inputCls} value={f.roleName} onChange={(e) => set('roleName', e.target.value)}>
            {ROLE_NAMES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        {user && (
          <Field label="Status">
            <select className={inputCls} value={f.isActive ? '1' : '0'} onChange={(e) => set('isActive', e.target.value === '1')}>
              <option value="1">active</option><option value="0">disabled</option>
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
};

export default SystemUsers;
