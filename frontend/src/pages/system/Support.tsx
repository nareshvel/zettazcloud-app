import { useEffect, useState } from 'react';
import { AlertTriangle, LifeBuoy, Send, X } from 'lucide-react';
import { ago, platformApi, type Ticket, type TicketMessage } from '@/services/platformApi';
import { Badge, btn, Empty, inputCls, PageHeader, Spinner, statusColor } from '@/components/system/ui';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useToast } from '@/hooks/use-toast';

const Support = () => {
  const { user } = useAuth();
  const canRespond = hasPermission(user, 'support.respond', { allowWildcard: false, checkAdmin: false });
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<Ticket[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = () => platformApi.tickets(status || undefined).then(setRows).catch((e) => setError(e.message));
  useEffect(load, [status]);

  if (error) return <Empty icon={AlertTriangle} title="Could not load tickets" text={error} />;

  return (
    <div>
      <PageHeader eyebrow="System" title="Support tickets" icon={LifeBuoy} subtitle="Tenant helpdesk" />

      <div className="mb-4">
        <select className={`${inputCls} w-44`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['open', 'in_progress', 'resolved', 'closed'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon={LifeBuoy} title="No tickets" /> : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setFocusId(t.id)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.subject}</td>
                  <td className="px-4 py-3 text-slate-700">{t.tenantName}</td>
                  <td className="px-4 py-3"><Badge color={statusColor(t.priority)}>{t.priority}</Badge></td>
                  <td className="px-4 py-3"><Badge color={statusColor(t.status)}>{t.status.replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{ago(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {focusId && <TicketDrawer id={focusId} canRespond={canRespond} onClose={() => setFocusId(null)} onChanged={load} />}
    </div>
  );
};

const TicketDrawer = ({ id, canRespond, onClose, onChanged }: {
  id: string; canRespond: boolean; onClose: () => void; onChanged: () => void;
}) => {
  const { toast } = useToast();
  const [data, setData] = useState<{ ticket: Ticket; messages: TicketMessage[] } | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => platformApi.ticket(id).then(setData).catch(() => {});
  useEffect(() => { refresh(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try { await platformApi.replyTicket(id, reply.trim()); setReply(''); refresh(); onChanged(); }
    catch (e) { toast({ title: 'Reply failed', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const setStatus = async (s: string) => {
    try { await platformApi.updateTicketStatus(id, s); refresh(); onChanged(); }
    catch (e) { toast({ title: 'Status update failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {!data ? <Spinner /> : (
          <>
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{data.ticket.subject}</h2>
                <p className="text-xs text-slate-500">{data.ticket.tenantName} · {data.ticket.userEmail || 'unknown'}</p>
                <div className="mt-1 flex gap-1.5">
                  <Badge color={statusColor(data.ticket.status)}>{data.ticket.status.replace('_', ' ')}</Badge>
                  <Badge color={statusColor(data.ticket.priority)}>{data.ticket.priority}</Badge>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {data.messages.map((m) => (
                <div key={m.id} className={`rounded-xl px-4 py-3 text-sm ${m.isPlatformReply ? 'ml-8 bg-primary-50' : 'mr-8 bg-slate-100'}`}>
                  <p className="mb-1 text-xs font-medium text-slate-500">
                    {m.isPlatformReply ? 'Support' : (m.authorName || m.authorEmail || 'Tenant')} · {ago(m.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap text-slate-800">{m.body}</p>
                </div>
              ))}
            </div>

            {canRespond && (
              <div className="border-t border-slate-100 p-4">
                <div className="mb-2 flex gap-1.5">
                  {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
                    <button key={s} onClick={() => setStatus(s)}
                      className={`rounded-md px-2 py-1 text-xs ${data.ticket.status === s ? 'bg-primary-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea className={`${inputCls} flex-1`} rows={2} placeholder="Reply…"
                    value={reply} onChange={(e) => setReply(e.target.value)} />
                  <button className={btn.primary} disabled={busy || !reply.trim()} onClick={send}>
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Support;
