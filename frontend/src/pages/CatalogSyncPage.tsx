import React, { useEffect, useState } from 'react';
import { listChannels, createChannel, updateChannel, getSyncQueue, SalesChannel } from '@/services/jewelryOpsService';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Share2, Plus, Loader2, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5172/api';

const CatalogSyncPage: React.FC = () => {
  const { user } = useAuth();
  // Channel create/update/publish writes are gated by settings.edit.
  const canEdit = hasPermission(user, 'settings.edit');
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, q] = await Promise.all([listChannels(), getSyncQueue()]);
      setChannels(c || []); setQueue(q || []);
    } catch { setChannels([]); setQueue([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={Share2}
        title="Sales Channels"
        subtitle="Publish your catalogue to a website or marketplace. Platform-agnostic feed + sync queue."
        actions={
          <div className="flex gap-2">
            <a href={`${API_BASE}/catalog/feed?format=csv`} target="_blank" rel="noreferrer">
              <Button variant="outline"><Download className="h-4 w-4" /> Export feed</Button>
            </a>
            <Button onClick={() => setShowNew(true)} disabled={!canEdit} title={!canEdit ? 'View-only access' : undefined}><Plus className="h-4 w-4" /> Add Channel</Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {channels.length === 0 ? (
            <div className="text-sm text-muted-foreground mb-6">
              No channels yet. Add one to start publishing products, or export the CSV feed for a manual upload.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white dark:bg-card rounded-lg shadow-sm border border-gray-100 dark:border-border mb-6">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-muted/50 text-gray-600 dark:text-muted-foreground"><tr>
                  <th className="text-left px-4 py-2">Channel</th><th className="text-left px-4 py-2">Platform</th>
                  <th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Auto sync</th>
                  <th className="text-left px-4 py-2">Last sync</th><th className="text-left px-4 py-2">Action</th>
                </tr></thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100 dark:border-border">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 capitalize">{c.platform}</td>
                      <td className="px-4 py-2"><StatusBadge status={c.status === 'connected' ? 'active' : c.status === 'error' ? 'cancelled' : 'pending'} /></td>
                      <td className="px-4 py-2">{Number(c.autoSync) ? 'On' : 'Off'}</td>
                      <td className="px-4 py-2">{c.lastSyncAt ? String(c.lastSyncAt).slice(0, 10) : '—'}</td>
                      <td className="px-4 py-2">
                        <Button size="sm" variant="outline" disabled={!canEdit}
                          onClick={async () => { if (!canEdit) return; await updateChannel(c.id, { auto_sync: Number(c.autoSync) ? 0 : 1 }); load(); }}>
                          {Number(c.autoSync) ? 'Disable' : 'Enable'} auto
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="text-sm font-semibold text-foreground mb-2">Pending sync jobs ({queue.length})</h3>
          {queue.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nothing queued.</div>
          ) : (
            <div className="overflow-x-auto bg-white dark:bg-card rounded-lg shadow-sm border border-gray-100 dark:border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-muted/50 text-gray-600 dark:text-muted-foreground"><tr>
                  <th className="text-left px-4 py-2">Entity</th><th className="text-left px-4 py-2">Action</th>
                  <th className="text-left px-4 py-2">Status</th><th className="text-right px-4 py-2">Attempts</th>
                  <th className="text-left px-4 py-2">Queued</th>
                </tr></thead>
                <tbody>
                  {queue.map((j) => (
                    <tr key={j.id} className="border-t border-gray-100 dark:border-border">
                      <td className="px-4 py-2">{j.entityType || j.entity_type}</td>
                      <td className="px-4 py-2 capitalize">{j.action}</td>
                      <td className="px-4 py-2"><StatusBadge status={j.status === 'queued' ? 'pending' : j.status} /></td>
                      <td className="px-4 py-2 text-right">{j.attempts}</td>
                      <td className="px-4 py-2">{String(j.createdAt || j.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showNew && <NewChannelModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
};

const NewChannelModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'settings.edit');
  const [f, setF] = useState<any>({ platform: 'custom' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!canEdit) return;
    if (!f.name) return;
    setSaving(true);
    try { await createChannel(f); onSaved(); } finally { setSaving(false); }
  };
  const inp = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs text-muted-foreground';
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-card rounded-lg shadow-lg max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Add Sales Channel</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:text-muted-foreground">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className={lbl}>Name *</label><input className={inp} value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="My Online Store" /></div>
          <div>
            <label className={lbl}>Platform</label>
            <select className={inp} value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
              <option value="custom">Custom / API</option>
              <option value="feed">CSV / feed only</option>
              <option value="shopify">Shopify</option>
              <option value="woocommerce">WooCommerce</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Credentials are stored by reference in a secret store, never in the database.
            Until an adapter is connected, use the CSV feed export to upload manually.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !f.name || !canEdit}>{saving ? 'Saving…' : 'Add channel'}</Button>
        </div>
      </div>
    </div>
  );
};

export default CatalogSyncPage;
