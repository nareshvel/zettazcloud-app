import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchActivityLogs,
  ActivityLog,
  ActivityLogFilters,
  PaginationData,
  FetchActivityLogsData,
} from '../../services/activityLogService';
import { fetchUsers, User } from '../../services/userService';
import { format } from 'date-fns';
import ActivityLogItem from '../../components/ActivityLogItem';
import PageHeader from '@/components/common/PageHeader';
import { Activity, Filter, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportToCsv } from '@/utils/reportExport';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ACTION_TYPES = [
  { value: 'USER_LOGIN_SUCCESS', label: 'Login Success' },
  { value: 'USER_LOGIN_FAILURE', label: 'Login Failure' },
  { value: 'USER_LOGOUT', label: 'Logout' },
  { value: 'SALE_PROCESSED', label: 'Sale Processed' },
  { value: 'PAYMENT_RECEIVED', label: 'Payment Received' },
  { value: 'PRODUCT_CREATED', label: 'Product Created' },
  { value: 'PRODUCT_UPDATED', label: 'Product Updated' },
  { value: 'PRODUCT_STOCK_ADJUSTED', label: 'Stock Adjusted' },
];

const UserActivityReportPage: React.FC = () => {
  const [groupedLogs, setGroupedLogs] = useState<Record<string, ActivityLog[]>>({});
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const today = format(new Date(), 'yyyy-MM-dd');

  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [filters, setFilters] = useState<ActivityLogFilters>({
    startDate: today,
    endDate: today,
    page: 1,
    limit: 25,
  });
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async (f: ActivityLogFilters) => {
    setLoading(true);
    setError(null);
    try {
      const res: FetchActivityLogsData = await fetchActivityLogs(f);
      setPagination(res.pagination);
      setAllLogs(res.logs);
      groupByDate(res.logs);
    } catch {
      setError('Failed to load activity logs.');
      setPagination(null);
      setGroupedLogs({});
      setAllLogs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(filters); }, [loadLogs, filters]);

  useEffect(() => {
    fetchUsers({ limit: 1000 }).then(d => setUsers(d.users || [])).catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value, page: 1 }));
  };

  const goToPage = (p: number) => {
    if (p < 1 || (pagination && p > pagination.totalPages)) return;
    setFilters(prev => ({ ...prev, page: p }));
  };

  const groupByDate = (logs: ActivityLog[]) => {
    const groups: Record<string, ActivityLog[]> = {};
    logs.forEach(log => {
      const d = format(new Date(log.timestamp), 'yyyy-MM-dd');
      (groups[d] ??= []).push(log);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    const sorted = Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {} as Record<string, ActivityLog[]>);
    setGroupedLogs(sorted);
  };

  const handleExportCSV = () => {
    exportToCsv(allLogs, [
      { header: 'Timestamp', accessor: (r) => r.timestamp },
      { header: 'User', accessor: (r) => r.username || r.user_id },
      { header: 'Action', accessor: (r) => r.action_type?.replace(/_/g, ' ') || '' },
      { header: 'Description', accessor: (r) => r.description || '' },
      { header: 'Status', accessor: (r) => r.status || '' },
      { header: 'IP Address', accessor: (r) => r.ip_address || '' },
    ], `user_activity_${filters.startDate}`);
  };

  // ---- Metrics ----
  const totalActions = allLogs.length;
  const uniqueUsers = new Set(allLogs.map(l => l.user_id)).size;

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Activity}
        title="User Activity"
        subtitle="Staff actions, login history, and system access."
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!allLogs.length}>
            <Download className="h-4 w-4 mr-1.5" /> CSV
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Actions" value={String(totalActions)} />
        <KpiCard label="Active Users" value={String(uniqueUsers)} />
        <KpiCard label="Date Range" value={filters.startDate === filters.endDate ? filters.startDate : `${filters.startDate} - ${filters.endDate}`} />
        <KpiCard label="Page" value={pagination ? `${filters.page} / ${pagination.totalPages}` : '—'} />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-primary" /> Filters
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterInput label="Start date" name="startDate" type="date" value={filters.startDate || ''} onChange={handleChange} />
          <FilterInput label="End date" name="endDate" type="date" value={filters.endDate || ''} onChange={handleChange} />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">User</label>
            <select name="userId" value={filters.userId || ''} onChange={handleChange} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">All users</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Action type</label>
            <select name="actionType" value={filters.actionType || ''} onChange={handleChange} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">All types</option>
              {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map(i => <div key={i} className="rounded-xl bg-muted/50 animate-pulse h-32" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-sm text-destructive">{error}</div>
      ) : Object.keys(groupedLogs).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center text-sm text-muted-foreground">No activity logs found for the selected filters.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedLogs).map(([date, logs]) => (
            <section key={date} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">{format(new Date(date), 'EEEE, MMMM d, yyyy')}</h2>
                <Badge variant="secondary">{logs.length}</Badge>
              </div>
              <div className="divide-y divide-border/60">
                {logs.map(log => (
                  <ActivityLogItem key={log.id} log={log} onViewDetails={setSelectedLog} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={() => goToPage((filters.page || 1) - 1)} disabled={(filters.page || 1) <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {filters.page || 1} of {pagination.totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => goToPage((filters.page || 1) + 1)} disabled={(filters.page || 1) >= pagination.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <DetailRow label="User" value={selectedLog.username || `ID: ${selectedLog.user_id}`} />
              <DetailRow label="Action" value={selectedLog.action_type?.replace(/_/g, ' ') || 'N/A'} />
              <DetailRow label="Time" value={format(new Date(selectedLog.timestamp), 'PPP p')} />
              {selectedLog.description && <DetailRow label="Description" value={selectedLog.description} />}
              {selectedLog.ip_address && <DetailRow label="IP Address" value={selectedLog.ip_address} />}
              {selectedLog.target_resource_id && <DetailRow label="Resource ID" value={selectedLog.target_resource_id} />}
              {selectedLog.status && <DetailRow label="Status" value={selectedLog.status} />}
              {selectedLog.details && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Details</span>
                  <pre className="mt-1 rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-all">
                    {typeof selectedLog.details === 'string' ? selectedLog.details : JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---- Sub-components ----

const KpiCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    <p className="mt-1 text-xl font-bold text-foreground truncate">{value}</p>
  </div>
);

const FilterInput: React.FC<{ label: string; name: string; type: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, name, type, value, onChange }) => (
  <div>
    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
    <input type={type} name={name} value={value} onChange={onChange} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
  </div>
);

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <p className="text-foreground">{value}</p>
  </div>
);

export default UserActivityReportPage;
