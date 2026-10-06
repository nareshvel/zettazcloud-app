import { useEffect, useState } from 'react';
import { AlertTriangle, Megaphone, Plus } from 'lucide-react';
import { ago, platformApi, type Announcement } from '@/services/platformApi';
import { Badge, btn, Empty, Field, inputCls, Modal, PageHeader, Spinner, statusColor } from '@/components/system/ui';
import { useToast } from '@/hooks/use-toast';

const Announcements = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Announcement[] | null>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Announcement | 'new' | null>(null);

  const load = () => platformApi.announcements().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggle = async (a: Announcement) => {
    try { await platformApi.updateAnnouncement(a.id, { isActive: !a.isActive }); load(); }
    catch (e) { toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  if (error) return <Empty icon={AlertTriangle} title="Could not load announcements" text={error} />;

  return (
    <div>
      <PageHeader eyebrow="System" title="Announcements" icon={Megaphone} subtitle="Broadcasts shown inside tenant workspaces"
        actions={<button className={btn.primary} onClick={() => setEdit('new')}><Plus className="h-4 w-4" />New announcement</button>} />

      {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon={Megaphone} title="No announcements yet" /> : (
        <div className="space-y-3">
          {rows.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{a.title}</p>
                  <Badge color={statusColor(a.severity)}>{a.severity}</Badge>
                  <Badge color="gray">{a.audience}</Badge>
                </div>
                {a.body && <p className="mt-1 text-sm text-slate-600">{a.body}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {a.startsAt ? `from ${ago(a.startsAt)}` : 'immediately'} · {a.endsAt ? `until ${ago(a.endsAt)}` : 'no end'} · created {ago(a.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={a.isActive ? 'green' : 'gray'}>{a.isActive ? 'live' : 'off'}</Badge>
                <button className={btn.secondary} onClick={() => toggle(a)}>{a.isActive ? 'Disable' : 'Enable'}</button>
                <button className={btn.ghost} onClick={() => setEdit(a)}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <AnnouncementModal
          a={edit === 'new' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); }}
        />
      )}
    </div>
  );
};

const AnnouncementModal = ({ a, onClose, onSaved }: { a: Announcement | null; onClose: () => void; onSaved: () => void }) => {
  const { toast } = useToast();
  const [f, setF] = useState({
    title: a?.title || '', body: a?.body || '', severity: a?.severity || 'info',
    audience: a?.audience || 'all',
    startsAt: a?.startsAt ? String(a.startsAt).slice(0, 16) : '',
    endsAt: a?.endsAt ? String(a.endsAt).slice(0, 16) : '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    const body = {
      ...f,
      startsAt: f.startsAt ? f.startsAt.replace('T', ' ') + ':00' : null,
      endsAt: f.endsAt ? f.endsAt.replace('T', ' ') + ':00' : null,
    };
    try {
      if (a) await platformApi.updateAnnouncement(a.id, body);
      else await platformApi.createAnnouncement(body);
      toast({ title: a ? 'Announcement updated' : 'Announcement published' });
      onSaved();
    } catch (e) { toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' }); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={a ? 'Edit announcement' : 'New announcement'}
      footer={<><button className={btn.secondary} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy || !f.title.trim()} onClick={save}>Save</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required className="sm:col-span-2"><input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Body" className="sm:col-span-2"><textarea className={inputCls} rows={3} value={f.body} onChange={(e) => set('body', e.target.value)} /></Field>
        <Field label="Severity">
          <select className={inputCls} value={f.severity} onChange={(e) => set('severity', e.target.value)}>
            <option value="info">info</option><option value="warning">warning</option><option value="critical">critical</option>
          </select>
        </Field>
        <Field label="Audience">
          <select className={inputCls} value={f.audience} onChange={(e) => set('audience', e.target.value)}>
            <option value="all">all tenants</option><option value="trial">trials only</option>
            <option value="active">paying only</option><option value="past_due">past-due only</option>
          </select>
        </Field>
        <Field label="Starts at"><input className={inputCls} type="datetime-local" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></Field>
        <Field label="Ends at"><input className={inputCls} type="datetime-local" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></Field>
      </div>
    </Modal>
  );
};

export default Announcements;
