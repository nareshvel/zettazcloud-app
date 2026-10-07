import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  listSchemePlans, createSchemePlan, updateSchemePlan,
  listEnrollmentsPaged, getEnrollment, createEnrollment, addSchemePayment, setSchemeStatus,
  SchemePlan, SchemeEnrollment, Pagination,
} from '@/services/jewelryOpsService';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useStore } from '@/contexts/StoreContext';
import { renderSavingsWithTemplate } from '@/services/templateReceiptService';
import CustomerSearchSelect, { CustomerHit } from '@/components/customers/CustomerSearchSelect';
import QuickAddCustomerModal from '@/components/customers/QuickAddCustomerModal';
import { Button } from '@/components/ui/button';
import {
  PiggyBank, Plus, Loader2, X, User, ChevronRight,
  CalendarDays, Banknote, CheckCircle2, Clock, Gift,
  ChevronDown, ChevronUp, Receipt, Search, Edit2,
  AlertTriangle, ShoppingBag, Scale, Printer, RefreshCw,
  UserPlus, Phone, Mail, ArrowLeft,
} from 'lucide-react';

const PAGE_SIZE = 20;
const QUICK_SEARCH_LIMIT = 8;

/* ─── date safety helper ─────────────────────────────────────────────────── */
function toIsoDate(d: any): string | null {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  if (typeof d === 'string') return d.slice(0, 10);
  return null;
}

const addMonths = (dateStr: string, n: number): string => {
  const iso = toIsoDate(dateStr);
  if (!iso) return '—';
  const d = new Date(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

const inputCls =
  'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background text-foreground placeholder:text-muted-foreground transition-colors text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';
const sectionCls = 'border border-border rounded-xl p-4 bg-card space-y-3';

/* ─── status config ──────────────────────────────────────────────────────── *
 * Navy is the only decorative color; matured/redeemed lean on the confirmed
 * "green = completed" exception, cancelled leans on "red = lapsed/cancelled".
 * Active is mid-flight, not a semantic outcome, so it stays plain navy
 * rather than borrowing blue as a fifth decorative color.               */
const STATUS_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  active:    { icon: Clock,        color: 'text-primary',                              bg: 'bg-primary/10',                          label: 'Active' },
  matured:   { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400',     bg: 'bg-emerald-100 dark:bg-emerald-500/15',  label: 'Matured' },
  redeemed:  { icon: ShoppingBag,  color: 'text-emerald-600 dark:text-emerald-400',     bg: 'bg-emerald-100 dark:bg-emerald-500/15',  label: 'Redeemed' },
  cancelled: { icon: X,            color: 'text-rose-600 dark:text-rose-400',           bg: 'bg-rose-100 dark:bg-rose-500/15',        label: 'Cancelled' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   PRINT PASSBOOK
═══════════════════════════════════════════════════════════════════════════ */
function printPassbook(e: SchemeEnrollment, storeName: string, currency: string): void {
  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  const custName = [e.customerFirstName, e.customerLastName].filter(Boolean).join(' ') || 'Customer';
  const pcts = e.paidInstallments ?? 0;
  const dur  = e.durationMonths ?? 0;
  const pct  = dur ? Math.round((pcts / dur) * 100) : 0;

  const rows = ((e.payments ?? []) as any[]).map((p, i) => `
    <tr>
      <td>${p.installmentNo ?? i + 1}</td>
      <td>${toIsoDate(p.paidAt) ?? '—'}</td>
      <td style="text-align:right">${fmt(p.amount)}</td>
      <td>${p.paymentMethod ?? 'Cash'}</td>
      <td>${p.reference ?? '—'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Savings Passbook – ${e.enrollmentNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 10mm; }
  @media print { @page { size: A4; margin: 10mm; } }
  .header { text-align: center; margin-bottom: 6mm; }
  .store  { font-size: 18px; font-weight: 900; }
  .title  { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 3mm; }
  .grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 4mm 0; }
  .cell   { border: 1px solid #ddd; border-radius: 4px; padding: 3mm; }
  .cell .lbl { font-size: 9px; text-transform: uppercase; color: #666; }
  .cell .val { font-size: 13px; font-weight: 700; margin-top: 1mm; }
  .prog-bar { height: 8px; background: #eee; border-radius: 4px; overflow: hidden; margin: 3mm 0; }
  .prog-fill { height: 100%; background: #1e2a5e; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  th { background: #f4f4f4; font-size: 9px; text-transform: uppercase; padding: 2mm 3mm; text-align: left; border-bottom: 2px solid #ddd; }
  td { padding: 2mm 3mm; border-bottom: 1px solid #eee; font-size: 11px; }
  .summary { margin-top: 6mm; border-top: 2px solid #000; padding-top: 4mm; display: flex; justify-content: space-between; }
  .sig { margin-top: 12mm; display: flex; justify-content: space-between; }
  .sig-line { border-top: 1px solid #aaa; padding-top: 2mm; font-size: 9px; color: #666; width: 40%; text-align: center; }
  .printed-at { text-align: center; font-size: 9px; color: #999; margin-top: 4mm; }
  .bonus-chip { display: inline-block; background: #eef0fb; color: #1e2a5e; border: 1px solid #c7cdec; border-radius: 99px; padding: 1px 8px; font-size: 9px; font-weight: 700; }
</style></head>
<body>
  <div class="header">
    <div class="store">${storeName}</div>
    <div class="title">Savings Scheme Passbook</div>
  </div>

  <div class="grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
    <div class="cell"><div class="lbl">Enrollment</div><div class="val">${e.enrollmentNo}</div></div>
    <div class="cell"><div class="lbl">Plan</div><div class="val">${e.planName ?? '—'}</div></div>
    <div class="cell"><div class="lbl">Start Date</div><div class="val">${toIsoDate(e.startDate) ?? '—'}</div></div>
    <div class="cell"><div class="lbl">Maturity Date</div><div class="val">${toIsoDate(e.maturityDate) ?? '—'}</div></div>
  </div>

  <div class="grid">
    <div class="cell"><div class="lbl">Customer</div><div class="val">${custName}</div>
      ${e.customerPhone ? `<div style="font-size:10px;color:#555;margin-top:1mm">${e.customerPhone}</div>` : ''}
    </div>
    <div class="cell"><div class="lbl">Status</div><div class="val" style="text-transform:capitalize">${e.status}</div></div>
  </div>

  <div style="margin: 4mm 0">
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#555;margin-bottom:1.5mm">
      <span>Progress: ${pcts} / ${dur} instalments (${pct}%)</span>
      <span>${fmt(e.totalPaid)} collected</span>
    </div>
    <div class="prog-bar"><div class="prog-fill" style="width:${Math.min(pct,100)}%"></div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Date</th><th style="text-align:right">Amount</th><th>Method</th><th>Reference</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5" style="text-align:center;color:#999">No payments recorded yet</td></tr>'}
    </tbody>
  </table>

  <div class="summary">
    <div><span style="font-size:10px;color:#555">Total Paid</span><br><strong style="font-size:15px">${fmt(e.totalPaid)}</strong></div>
    ${(e.bonus ?? 0) > 0 ? `<div><span style="font-size:10px;color:#555">Bonus</span><br><strong style="font-size:15px;color:#1e2a5e">+ ${fmt(e.bonus)}</strong></div>` : ''}
    <div><span style="font-size:10px;color:#555">Redeemable Value</span><br><strong style="font-size:16px;color:#16a34a">${fmt(e.redeemableValue ?? e.totalPaid)}</strong></div>
  </div>

  <div class="sig">
    <div class="sig-line">Customer Signature</div>
    <div class="sig-line">Authorised by</div>
  </div>
  <div class="printed-at">Printed ${new Date().toLocaleString('en-IN')}</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Allow popups for this site to print the passbook.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
const SavingsSchemesPage: React.FC = () => {
  const { formatDate, formatCurrency } = useLocaleFormat();
  const fmtD  = (d: any) => { const s = toIsoDate(d); return s ? formatDate(s) : '—'; };
  const fmtC  = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';
  const location = useLocation();
  const navigate = useNavigate();

  // Sales Hub quick action: { quickAction: true, fromSalesHub: true } —
  // navigating here with this state auto-opens the "Collect Payment" search
  // flow instead of landing on the management list. Mirrors the
  // `fromSalesHub` precedent in POSScreen.tsx / DutyFreeIntakeModal.tsx,
  // which the same tile-based Hub already uses to know when to route back.
  const navState = (location.state as { quickAction?: boolean; fromSalesHub?: boolean; presetQuery?: string; presetRecordId?: string } | null) ?? null;
  const [fromSalesHub] = useState(Boolean(navState?.fromSalesHub));
  const [quickActionOpen, setQuickActionOpen] = useState(Boolean(navState?.quickAction));

  const [tab, setTab]               = useState<'enrollments' | 'plans'>('enrollments');
  const [plans, setPlans]           = useState<SchemePlan[]>([]);
  const [allPlans, setAllPlans]     = useState<SchemePlan[]>([]);
  const [enrollments, setEnrollments] = useState<SchemeEnrollment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQ, setSearchQ]       = useState('');
  const [showPlan, setShowPlan]     = useState(false);
  const [editPlan, setEditPlan]     = useState<SchemePlan | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollWithPlan, setEnrollWithPlan] = useState<SchemePlan | null>(null);
  const [detail, setDetail]         = useState<SchemeEnrollment | null>(null);
  const [payFor, setPayFor]         = useState<SchemeEnrollment | null>(null);
  const [payFromQuickAction, setPayFromQuickAction] = useState(false);

  // Debounce the search box — server-side search, same 350ms pattern as
  // SalesReturnPage.tsx, rather than filtering an already-fetched page.
  useEffect(() => {
    const t = setTimeout(() => setSearchQ(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [searchQ, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [active, all, list] = await Promise.all([
        listSchemePlans(false),
        listSchemePlans(true),
        listEnrollmentsPaged({ status: statusFilter || undefined, q: searchQ || undefined, page, limit: PAGE_SIZE }),
      ]);
      setPlans(active || []);
      setAllPlans(all || []);
      setEnrollments(list.data || []);
      setPagination(list.pagination ?? null);
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load');
      setPlans([]); setAllPlans([]); setEnrollments([]); setPagination(null);
    } finally { setLoading(false); }
  }, [statusFilter, searchQ, page]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (e: SchemeEnrollment) => {
    try { setDetail(await getEnrollment(e.id)); } catch { setDetail(e); }
  };

  const closeAndMaybeReturnToHub = useCallback(() => {
    if (fromSalesHub) navigate('/sales-hub');
  }, [fromSalesHub, navigate]);

  const kpiItems = [
    { key: 'active' as const,    label: 'Active',    icon: STATUS_META.active.icon,    color: STATUS_META.active.color },
    { key: 'matured' as const,   label: 'Matured',   icon: STATUS_META.matured.icon,   color: STATUS_META.matured.color },
    { key: 'redeemed' as const,  label: 'Redeemed',  icon: STATUS_META.redeemed.icon,  color: STATUS_META.redeemed.color },
    { key: 'cancelled' as const, label: 'Cancelled', icon: STATUS_META.cancelled.icon, color: STATUS_META.cancelled.color },
  ];
  // KPI counts reflect the current filtered/paginated response's totals is
  // not meaningful across pages, so pull status counts from a lightweight
  // independent request only when needed — instead we approximate using the
  // full pagination total for the active filter and fall back to visible
  // page counts otherwise, matching SalesReturnPage's stats-endpoint role
  // without introducing a new stats endpoint for a modest-volume feature.
  const [statusKpi, setStatusKpi] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          (['active', 'matured', 'redeemed', 'cancelled'] as const).map(s =>
            listEnrollmentsPaged({ status: s, page: 1, limit: 1 }).then(r => [s, r.pagination?.total ?? 0] as const)
          )
        );
        if (!cancelled) setStatusKpi(Object.fromEntries(results));
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
  }, [enrollments.length]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {fromSalesHub && (
        <button
          onClick={() => navigate('/sales-hub')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sales Hub
        </button>
      )}

      {/* Header — glass hero, navy gradient icon chip (no other decorative color) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shadow-sm shrink-0">
            <PiggyBank className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight">Savings Schemes</h1>
            <p className="text-sm text-muted-foreground">Customer instalment schemes — pay monthly, redeem against a future purchase.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => load()} className="rounded-full gap-1.5">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {tab === 'plans' ? (
            <Button onClick={() => { setEditPlan(null); setShowPlan(true); }}
              className="rounded-full gap-1.5 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0 shadow-sm">
              <Plus className="h-4 w-4" /> New Scheme Plan
            </Button>
          ) : (
            <Button onClick={() => { setEnrollWithPlan(null); setShowEnroll(true); }} disabled={!allPlans.length}
              className="rounded-full gap-1.5 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0 shadow-sm">
              <Plus className="h-4 w-4" /> New Enrollment
            </Button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {(['enrollments', 'plans'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t === 'plans' ? `Scheme Plans (${allPlans.length})` : 'Enrollments — View All'}
          </button>
        ))}
      </div>

      {/* Error */}
      {loadError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive flex-1">{loadError}</span>
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {tab === 'enrollments' ? (
        <>
          {/* KPI strip — glass cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpiItems.map(item => {
              const Icon = item.icon;
              const active = statusFilter === item.key;
              return (
                <button key={item.key} onClick={() => setStatusFilter(active ? '' : item.key)}
                  className={`flex items-center gap-3 rounded-2xl border border-r-4 p-3.5 text-left transition-all backdrop-blur-md ${
                    active ? 'border-primary border-r-primary bg-primary/10 shadow-sm' : 'border-white/40 border-r-primary/40 bg-card/70 hover:border-primary/40 hover:shadow-md'
                  }`}>
                  <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{statusKpi[item.key] ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Search — glass pill */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search enrollment #, customer name, phone, email, or plan…"
              className="w-full pl-10 pr-9 py-2.5 rounded-full border border-white/40 bg-card/70 backdrop-blur-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : enrollments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
              <PiggyBank className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {searchQ || statusFilter ? 'No enrollments match this filter.' : 'No enrollments yet.'}
              </p>
              {!searchQ && !statusFilter && (
                <Button variant="outline" size="sm" className="mt-4 rounded-full"
                  onClick={() => { setEnrollWithPlan(null); setShowEnroll(true); }}
                  disabled={!allPlans.length}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Enroll first customer
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {enrollments.map(e => {
                const pct = e.durationMonths ? Math.round((e.paidInstallments / e.durationMonths) * 100) : 0;
                const M = STATUS_META[e.status];
                return (
                  <div key={e.id} onClick={() => openDetail(e)}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer">
                    <div className="min-w-[7rem]">
                      <p className="text-xs text-muted-foreground">Enrollment</p>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{e.enrollmentNo}</span>
                    </div>
                    <div className="min-w-[9rem] flex-1">
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="font-medium text-sm text-foreground truncate">
                          {[e.customerFirstName, e.customerLastName].filter(Boolean).join(' ') || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-[8rem]">
                      <p className="text-xs text-muted-foreground">Plan</p>
                      <p className="text-sm text-foreground">{e.planName ?? '—'}</p>
                    </div>
                    <div className="min-w-[10rem]">
                      <p className="text-xs text-muted-foreground mb-1">Progress</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-primary/10 rounded-full h-1.5 w-24">
                          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{e.paidInstallments}/{e.durationMonths ?? '?'}</span>
                      </div>
                    </div>
                    <div className="min-w-[6rem]">
                      <p className="text-xs text-muted-foreground">Total Paid</p>
                      <p className="font-semibold text-sm text-foreground">{fmtC(e.totalPaid)}</p>
                    </div>
                    <div className="min-w-[7rem]">
                      <p className="text-xs text-muted-foreground">Maturity</p>
                      <p className="text-xs text-foreground">{fmtD(e.maturityDate)}</p>
                    </div>
                    <div className="min-w-[6rem]">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${M.bg} ${M.color}`}>
                        <M.icon className="h-3 w-3" />{M.label}
                      </span>
                    </div>
                    <div className="ml-auto">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination — server-side */}
          {!loading && pagination && pagination.total > 0 && (
            <div className="flex items-center justify-between gap-4 pt-1">
              <p className="text-xs text-muted-foreground">
                {pagination.total} enrollment{pagination.total === 1 ? '' : 's'} · page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border border-white/40 bg-card/70 backdrop-blur-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border border-white/40 bg-card/70 backdrop-blur-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Plans tab */
        loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : allPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
            <Gift className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No scheme plans configured yet.</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => { setEditPlan(null); setShowPlan(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Create first plan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allPlans.map(p => {
              const totalVal  = (p.installmentAmount ?? 0) * p.durationMonths;
              const bonusAmt  = p.bonusType === 'extra_installment'
                ? (p.bonusValue ?? 0) * (p.installmentAmount ?? 0)
                : p.bonusType === 'percentage' ? totalVal * (p.bonusValue ?? 0) / 100 : 0;
              return (
                <div key={p.id} className={`rounded-2xl border backdrop-blur-md p-4 space-y-3 transition-all ${p.isActive ? 'border-white/40 border-r-primary/40 bg-card/70 hover:border-primary/40 hover:shadow-md' : 'border-border/40 bg-card/40 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {p.accrualType === 'amount' ? 'Fixed Amount' : 'Gold Weight'} · {p.durationMonths} months
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={(ev) => { ev.stopPropagation(); setEditPlan(p); setShowPlan(true); }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {p.installmentAmount != null && (
                      <div className="bg-primary/5 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">Per Instalment</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{fmtC(p.installmentAmount)}</p>
                      </div>
                    )}
                    <div className="bg-primary/5 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{p.durationMonths} months</p>
                    </div>
                    {totalVal > 0 && (
                      <div className="bg-primary/5 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">Total Collected</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{fmtC(totalVal)}</p>
                      </div>
                    )}
                    {totalVal > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">Redemption Value</p>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{fmtC(totalVal + bonusAmt)}</p>
                      </div>
                    )}
                  </div>

                  {p.bonusType !== 'none' && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-primary font-medium flex items-center gap-1">
                        <Gift className="h-3 w-3" /> Bonus
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.bonusType === 'extra_installment'
                          ? `+${p.bonusValue} extra instalment(s) = ${fmtC(bonusAmt)}`
                          : `${p.bonusValue}% of total = ${fmtC(bonusAmt)}`}
                      </p>
                    </div>
                  )}

                  {p.terms && (
                    <p className="text-xs text-muted-foreground border-t border-border pt-2 line-clamp-2">{p.terms}</p>
                  )}

                  {p.isActive && (
                    <Button variant="outline" size="sm" className="w-full rounded-full"
                      onClick={() => { setEnrollWithPlan(p); setTab('enrollments'); setShowEnroll(true); }}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Enroll Customer
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modals */}
      {showPlan && (
        <PlanModal
          plan={editPlan}
          onClose={() => { setShowPlan(false); setEditPlan(null); }}
          onSaved={() => { setShowPlan(false); setEditPlan(null); load(); }}
        />
      )}
      {showEnroll && (
        <EnrollModal
          plans={allPlans}
          defaultPlan={enrollWithPlan}
          onClose={() => { setShowEnroll(false); setEnrollWithPlan(null); }}
          onSaved={() => { setShowEnroll(false); setEnrollWithPlan(null); load(); }}
        />
      )}
      {detail && (
        <EnrollmentDrawer
          enrollment={detail}
          onClose={() => setDetail(null)}
          onPayment={(e) => { setDetail(null); setPayFromQuickAction(false); setPayFor(e); }}
          onRefresh={async () => {
            try { setDetail(await getEnrollment(detail.id)); } catch {}
            load();
          }}
        />
      )}
      {payFor && (
        <PaymentModal
          enrollment={payFor}
          onClose={() => { setPayFor(null); if (payFromQuickAction) closeAndMaybeReturnToHub(); }}
          onSaved={() => {
            setPayFor(null);
            load();
            if (payFromQuickAction) closeAndMaybeReturnToHub();
          }}
        />
      )}

      {/* Sales Hub quick action — find the enrollment first, then go
          straight into recording the instalment. */}
      {quickActionOpen && (
        <CollectPaymentSearchModal
          onClose={() => { setQuickActionOpen(false); closeAndMaybeReturnToHub(); }}
          onFound={(e) => { setQuickActionOpen(false); setPayFromQuickAction(true); setPayFor(e); }}
          presetQuery={navState?.presetQuery}
          presetRecordId={navState?.presetRecordId}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK ACTION — COLLECT PAYMENT SEARCH
   Step 1 of the Sales Hub "Savings Scheme Payment" tile: find the active
   enrollment by customer name/phone/email or enrollment number, live
   search-as-you-type against GET /savings-schemes/enrollments?status=active&q=,
   exactly the pattern ReturnProcessingModal.tsx uses for sale lookup.
═══════════════════════════════════════════════════════════════════════════ */
const CollectPaymentSearchModal: React.FC<{
  onClose: () => void;
  onFound: (e: SchemeEnrollment) => void;
  presetQuery?: string;
  presetRecordId?: string;
}> = ({ onClose, onFound, presetQuery, presetRecordId }) => {
  const { formatCurrency } = useLocaleFormat();
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';

  const [query, setQuery] = useState(presetQuery || '');
  const [results, setResults] = useState<SchemeEnrollment[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSelectAttemptedRef = useRef(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await listEnrollmentsPaged({ status: 'active', q: query, page: 1, limit: QUICK_SEARCH_LIMIT });
        setResults(r.data || []);
      } catch {
        setResults([]);
      } finally { setSearching(false); }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Preset from the Sales Hub — fire the search immediately rather than
  // waiting on the debounce (query already seeded above via initial state).
  useEffect(() => {
    if (!presetQuery?.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    (async () => {
      try {
        const r = await listEnrollmentsPaged({ status: 'active', q: presetQuery, page: 1, limit: QUICK_SEARCH_LIMIT });
        setResults(r.data || []);
      } catch {
        setResults([]);
      } finally { setSearching(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the Hub told us exactly which enrollment the cashier wants and the
  // results narrow to exactly that record, skip straight to it.
  useEffect(() => {
    if (!presetRecordId || autoSelectAttemptedRef.current) return;
    if (searching) return;
    if (results.length === 0) return;
    autoSelectAttemptedRef.current = true;
    if (results.length === 1 && results[0].id === presetRecordId) {
      onFound(results[0]);
    }
  }, [presetRecordId, searching, results, onFound]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shadow-sm">
              <Banknote className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Collect Payment</h2>
              <p className="text-xs text-muted-foreground">Find the active enrollment to record an instalment</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search customer name, phone, email, or enrollment #…"
              className="w-full pl-10 pr-10 py-2.5 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary/60" />}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {query.trim() && !searching && results.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                No active enrollments match "{query}".
              </div>
            )}
            {!query.trim() && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Start typing to find an active scheme enrollment.
              </div>
            )}
            {results.map(e => {
              const pct = e.durationMonths ? Math.round((e.paidInstallments / e.durationMonths) * 100) : 0;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onFound(e)}
                  className="w-full flex items-center justify-between gap-4 p-3 rounded-xl border border-primary/15 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {[e.customerFirstName, e.customerLastName].filter(Boolean).join(' ') || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="font-mono">{e.enrollmentNo}</span> · {e.planName ?? 'Scheme'} · {e.paidInstallments}/{e.durationMonths ?? '?'} paid ({pct}%)
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-foreground">{fmtC(e.totalPaid)}</div>
                    <div className="text-xs text-muted-foreground">collected</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <Button variant="outline" className="flex-1 rounded-full" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PLAN MODAL  (create + edit)
═══════════════════════════════════════════════════════════════════════════ */
const PlanModal: React.FC<{
  plan: SchemePlan | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ plan, onClose, onSaved }) => {
  const { formatCurrency } = useLocaleFormat();
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';

  const isEdit = !!plan;
  const [f, setF] = useState({
    name:               plan?.name               ?? '',
    accrual_type:       plan?.accrualType         ?? 'amount',
    installment_amount: plan?.installmentAmount != null ? String(plan.installmentAmount) : '',
    duration_months:    String(plan?.durationMonths ?? 11),
    bonus_type:         plan?.bonusType           ?? 'none',
    bonus_value:        String(plan?.bonusValue    ?? 1),
    terms:              plan?.terms               ?? '',
    is_active:          plan?.isActive !== undefined ? Boolean(plan.isActive) : true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | boolean) => setF(p => ({ ...p, [k]: v }));

  const totalValue = Number(f.installment_amount) * Number(f.duration_months);
  const bonusAmt = f.bonus_type === 'extra_installment'
    ? Number(f.bonus_value) * Number(f.installment_amount)
    : f.bonus_type === 'percentage' ? totalValue * Number(f.bonus_value) / 100 : 0;

  const save = async () => {
    if (!f.name || !f.duration_months) return;
    setSaving(true);
    try {
      const payload = {
        name:               f.name,
        accrual_type:       f.accrual_type,
        installment_amount: f.installment_amount ? Number(f.installment_amount) : null,
        duration_months:    Number(f.duration_months),
        bonus_type:         f.bonus_type,
        bonus_value:        f.bonus_type !== 'none' ? Number(f.bonus_value) : 0,
        terms:              f.terms || null,
        is_active:          f.is_active,
      };
      if (isEdit && plan) {
        await updateSchemePlan(plan.id, payload);
      } else {
        await createSchemePlan(payload);
      }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Scheme Plan' : 'New Scheme Plan'}</h2>
              <p className="text-xs text-muted-foreground">Define the plan customers enroll into</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className={labelCls}>Plan Name *</label>
            <input className={inputCls} placeholder="e.g. Gold Savings Scheme 2026"
              value={f.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Accrual Type</label>
              <select className={inputCls} value={f.accrual_type} onChange={e => set('accrual_type', e.target.value)}>
                <option value="amount">Fixed Amount</option>
                <option value="weight">Gold Weight (g)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Instalment {f.accrual_type === 'amount' ? 'Amount' : 'Weight (g)'}</label>
              <input className={inputCls} type="number" min="0" placeholder="e.g. 5000"
                value={f.installment_amount} onChange={e => set('installment_amount', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Duration (months)</label>
              <input className={inputCls} type="number" min="1" max="60"
                value={f.duration_months} onChange={e => set('duration_months', e.target.value)} />
            </div>
          </div>

          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5" /> Bonus (Optional)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bonus Type</label>
                <select className={inputCls} value={f.bonus_type} onChange={e => set('bonus_type', e.target.value)}>
                  <option value="none">No Bonus</option>
                  <option value="extra_installment">Extra Instalment(s)</option>
                  <option value="percentage">Percentage Bonus</option>
                </select>
              </div>
              {f.bonus_type !== 'none' && (
                <div>
                  <label className={labelCls}>{f.bonus_type === 'extra_installment' ? 'Extra Instalments' : 'Bonus %'}</label>
                  <input className={inputCls} type="number" min="0" value={f.bonus_value}
                    onChange={e => set('bonus_value', e.target.value)} />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Terms & Conditions</label>
            <textarea className={`${inputCls} resize-none`} rows={3}
              placeholder="Optional — shown on passbook"
              value={f.terms} onChange={e => set('terms', e.target.value)} />
          </div>

          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-10 h-5 rounded-full transition-colors ${f.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                onClick={() => set('is_active', !f.is_active)}>
                <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${f.is_active ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm text-foreground">{f.is_active ? 'Plan is active' : 'Plan is inactive'}</span>
            </label>
          )}

          {totalValue > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Collected</p>
                <p className="text-base font-bold text-foreground mt-0.5">{fmtC(totalValue)}</p>
              </div>
              {bonusAmt > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Bonus Value</p>
                  <p className="text-base font-bold text-primary mt-0.5">{fmtC(bonusAmt)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Redemption Value</p>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{fmtC(totalValue + bonusAmt)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <Button variant="outline" className="flex-1 rounded-full" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 rounded-full" onClick={save} disabled={saving || !f.name}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…</> : isEdit ? 'Save Changes' : 'Create Plan'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ENROLL MODAL
═══════════════════════════════════════════════════════════════════════════ */
const EnrollModal: React.FC<{
  plans: SchemePlan[];
  defaultPlan: SchemePlan | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ plans, defaultPlan, onClose, onSaved }) => {
  const { formatCurrency, formatDate } = useLocaleFormat();
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';
  const today = () => new Date().toISOString().slice(0, 10);

  const [customer, setCustomer]         = useState<CustomerHit | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState('');
  const [planId, setPlanId]             = useState(defaultPlan?.id ?? plans[0]?.id ?? '');
  const [startDate, setStartDate]       = useState(today());
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);

  const selectedPlan = plans.find(p => p.id === planId);
  const maturityDateStr = selectedPlan ? addMonths(startDate, selectedPlan.durationMonths) : null;

  const schedule = useMemo(() => {
    if (!selectedPlan || !startDate) return [];
    return Array.from({ length: selectedPlan.durationMonths }, (_, i) => ({
      no: i + 1,
      date: addMonths(startDate, i + 1),
      amount: selectedPlan.installmentAmount,
    }));
  }, [selectedPlan, startDate]);

  const save = async () => {
    if (!customer || !planId) return;
    setSaving(true);
    try {
      await createEnrollment({ customer_id: customer.id, plan_id: planId, start_date: startDate, notes: notes || null });
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><PiggyBank className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Enroll Customer</h2>
              <p className="text-xs text-muted-foreground">Link a customer to a savings scheme</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Customer */}
          <div className={sectionCls}>
            <h3 className={`${labelCls} flex items-center gap-1.5`}><User className="h-3.5 w-3.5" /> Customer *</h3>
            <CustomerSearchSelect
              selected={customer}
              onSelect={setCustomer}
              allowQuickAdd
              onQuickAddRequested={(prefill) => { setQuickAddPrefill(prefill || ''); setIsQuickAddOpen(true); }}
            />
          </div>
          <QuickAddCustomerModal
            isOpen={isQuickAddOpen}
            prefillName={quickAddPrefill}
            onClose={() => setIsQuickAddOpen(false)}
            onCreated={(hit) => { setCustomer(hit); setIsQuickAddOpen(false); }}
          />

          {/* Plan + dates */}
          <div className={sectionCls}>
            <h3 className={`${labelCls} flex items-center gap-1.5`}><Gift className="h-3.5 w-3.5" /> Scheme Plan *</h3>
            <select className={inputCls} value={planId} onChange={e => setPlanId(e.target.value)}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.durationMonths} months</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div>
                <label className={labelCls}>Start Date</label>
                <input className={inputCls} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Maturity Date</label>
                <div className={`${inputCls} bg-muted/40 text-muted-foreground`}>
                  {maturityDateStr ? formatDate(maturityDateStr) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Plan preview */}
          {selectedPlan && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Schedule Preview
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Per Month</p>
                  <p className="font-bold text-foreground">{fmtC(selectedPlan.installmentAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-bold text-foreground">{selectedPlan.durationMonths} months</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Collected</p>
                  <p className="font-bold text-foreground">
                    {fmtC((selectedPlan.installmentAmount ?? 0) * selectedPlan.durationMonths)}
                  </p>
                </div>
              </div>
              {/* First 6 schedule rows */}
              {schedule.length > 0 && (
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {schedule.slice(0, 6).map(s => (
                    <div key={s.no} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Month {s.no} — {formatDate(s.date)}</span>
                      <span className="font-medium text-foreground">{fmtC(s.amount)}</span>
                    </div>
                  ))}
                  {schedule.length > 6 && (
                    <p className="text-xs text-muted-foreground">+ {schedule.length - 6} more months…</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (Optional)</label>
            <textarea className={`${inputCls} resize-none`} rows={2}
              placeholder="Any internal notes about this enrollment"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <Button variant="outline" className="flex-1 rounded-full" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 rounded-full" onClick={save} disabled={saving || !customer || !planId}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Enrolling…</> : 'Enroll Customer'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ENROLLMENT DETAIL DRAWER
═══════════════════════════════════════════════════════════════════════════ */
const EnrollmentDrawer: React.FC<{
  enrollment: SchemeEnrollment;
  onClose: () => void;
  onPayment: (e: SchemeEnrollment) => void;
  onRefresh: () => void;
}> = ({ enrollment: e, onClose, onPayment, onRefresh }) => {
  const { formatDate, formatCurrency } = useLocaleFormat();
  const { store } = useStore();
  const fmtD = (d: any) => { const s = toIsoDate(d); return s ? formatDate(s) : '—'; };
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';

  // Try the published savings_enrollment template first; fall back to the
  // inline printPassbook if the store has none published yet — same
  // null-means-fallback contract as the other renderXWithTemplate helpers.
  const handlePrintPassbook = useCallback(async () => {
    try {
      const rendered = await renderSavingsWithTemplate(e, {
        storeId: store?.id,
        logoUrl: store?.logoUrl,
        context: {
          store: {
            name: store?.name, address: store?.address, phone: store?.phone,
            email: store?.email, taxId: store?.taxId, currencyCode: store?.currencyCode,
          },
          formatDate, formatCurrency,
        },
      });
      if (rendered) {
        const win = window.open('', '_blank', 'width=900,height=700');
        if (win) {
          win.document.write(rendered.html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 400);
        }
        return;
      }
    } catch { /* fall through to the legacy passbook */ }
    printPassbook(e, store?.name ?? 'Store', store?.currencyCode ?? 'INR');
  }, [e, store, formatDate, formatCurrency]);

  const [expanded, setExpanded] = useState<'payments' | 'schedule' | null>('schedule');
  const [actioning, setActioning] = useState<string | null>(null);

  const pct = e.durationMonths ? Math.round((e.paidInstallments / e.durationMonths) * 100) : 0;
  const M   = STATUS_META[e.status];

  const doStatus = async (status: 'matured' | 'cancelled' | 'redeemed') => {
    setActioning(status);
    try {
      await setSchemeStatus(e.id, status);
      onRefresh();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update status');
    } finally { setActioning(null); }
  };

  const startDateIso = toIsoDate(e.startDate) ?? '';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{e.enrollmentNo}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${M.bg} ${M.color}`}>
                  <M.icon className="h-3 w-3" />{M.label}
                </span>
              </div>
              <p className="text-base font-semibold text-foreground">
                {[e.customerFirstName, e.customerLastName].filter(Boolean).join(' ') || 'Unknown Customer'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{e.planName}</p>
              {e.customerPhone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" /> {e.customerPhone}
                </p>
              )}
              {e.customerEmail && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Mail className="h-3 w-3" /> {e.customerEmail}
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Paid {e.paidInstallments} of {e.durationMonths ?? '?'} instalments ({pct}%)</span>
              <span className="font-semibold text-foreground">{fmtC(e.totalPaid)}</span>
            </div>
            <div className="h-2.5 bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/40 rounded-lg px-3 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">Redeemable</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{fmtC(e.redeemableValue ?? e.totalPaid)}</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">Bonus</p>
              <p className="text-sm font-bold text-primary mt-0.5">{fmtC(e.bonus ?? 0)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg px-3 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">Maturity</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">{fmtD(e.maturityDate)}</p>
            </div>
          </div>

          {/* Dates info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>Started: <span className="text-foreground font-medium">{fmtD(e.startDate)}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>Matures: <span className="text-foreground font-medium">{fmtD(e.maturityDate)}</span></span>
            </div>
          </div>

          {e.notes && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <span className="font-semibold">Note: </span>{e.notes}
            </div>
          )}

          {/* Instalment Schedule */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button onClick={() => setExpanded(prev => prev === 'schedule' ? null : 'schedule')}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-muted-foreground" /> Instalment Schedule
              </span>
              {expanded === 'schedule' ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {expanded === 'schedule' && (
              <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-1">
                {startDateIso ? Array.from({ length: e.durationMonths ?? 0 }, (_, i) => {
                  const paid    = i < e.paidInstallments;
                  const current = i === e.paidInstallments;
                  const dateStr = addMonths(startDateIso, i + 1);
                  const pmt     = (e.payments as any[])?.[i];
                  return (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${paid ? 'bg-emerald-50 dark:bg-emerald-950/20' : current && e.status === 'active' ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'}`}>
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${paid ? 'bg-emerald-500 text-white' : current ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                        {paid ? '✓' : i + 1}
                      </div>
                      <span className="flex-1 text-muted-foreground text-xs">{formatDate(dateStr)}</span>
                      {paid && pmt && (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(pmt.amount)}</span>
                      )}
                      {current && e.status === 'active' && (
                        <span className="text-xs text-primary font-medium">Next due</span>
                      )}
                    </div>
                  );
                }) : <p className="text-sm text-muted-foreground">No schedule available.</p>}
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button onClick={() => setExpanded(prev => prev === 'payments' ? null : 'payments')}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Receipt className="h-4 w-4 text-muted-foreground" /> Payment History ({(e.payments ?? []).length})
              </span>
              {expanded === 'payments' ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {expanded === 'payments' && (
              <div className="px-4 py-3">
                {(e.payments ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-1">
                    {(e.payments as any[]).map((p, idx) => (
                      <div key={p.id ?? idx} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-xs font-bold text-emerald-600">
                              {p.installmentNo ?? idx + 1}
                            </span>
                            <span className="font-medium text-foreground capitalize">{p.paymentMethod ?? 'Cash'}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtD(p.paidAt)}
                            {p.reference && <span className="ml-2 font-mono">#{p.reference}</span>}
                          </p>
                        </div>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmtC(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons footer */}
        <div className="px-5 py-4 border-t border-border bg-muted/20 shrink-0 space-y-2">
          {/* Print always available */}
          <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-full"
            onClick={() => { void handlePrintPassbook(); }}>
            <Printer className="h-3.5 w-3.5" /> Print Passbook
          </Button>

          {/* Record payment — only active */}
          {e.status === 'active' && (
            <Button className="w-full gap-1.5 rounded-full" onClick={() => onPayment(e)}>
              <Banknote className="h-4 w-4" /> Record Monthly Payment
            </Button>
          )}

          {/* Matured: Redeem or Cancel */}
          {e.status === 'matured' && (
            <div className="grid grid-cols-2 gap-2">
              <Button className="gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={actioning === 'redeemed'}
                onClick={() => doStatus('redeemed')}>
                {actioning === 'redeemed' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                Mark Redeemed
              </Button>
              <Button variant="outline" className="gap-1.5 rounded-full text-destructive border-destructive/30 hover:bg-destructive/5"
                disabled={actioning === 'cancelled'}
                onClick={() => doStatus('cancelled')}>
                {actioning === 'cancelled' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Cancel
              </Button>
            </div>
          )}

          {/* Active: force mature early or cancel */}
          {e.status === 'active' && (
            <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-full text-destructive border-destructive/30 hover:bg-destructive/5"
              disabled={actioning === 'cancelled'}
              onClick={() => {
                if (confirm('Are you sure you want to cancel this enrollment?')) doStatus('cancelled');
              }}>
              {actioning === 'cancelled' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Cancel Enrollment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   PAYMENT MODAL
═══════════════════════════════════════════════════════════════════════════ */
const PaymentModal: React.FC<{
  enrollment: SchemeEnrollment;
  onClose: () => void;
  onSaved: () => void;
}> = ({ enrollment: e, onClose, onSaved }) => {
  const { formatCurrency, formatDate } = useLocaleFormat();
  const { store } = useStore();
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';

  /* Pre-fill with plan's instalment amount, not redeemable value */
  const defaultAmt = e.installmentAmount != null ? String(e.installmentAmount) : '';
  const nextNo     = (e.paidInstallments ?? 0) + 1;

  const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'].filter(m =>
    m !== 'upi' || store?.countryCode?.toUpperCase() === 'IN'
  );

  const [amount, setAmount] = useState(defaultAmt);
  const [method, setMethod] = useState('cash');
  const [reference, setRef] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!Number(amount)) return;
    setSaving(true);
    try {
      await addSchemePayment(e.id, { amount: Number(amount), payment_method: method, reference: reference || null });
      onSaved();
    } finally { setSaving(false); }
  };

  const isLastInstalment = nextNo >= (e.durationMonths ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Instalment #{nextNo}
                {isLastInstalment && <span className="ml-2 text-xs text-emerald-600 font-medium">Final!</span>}
              </h2>
              <p className="text-xs text-muted-foreground">{e.enrollmentNo} · {e.planName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Summary card */}
          <div className="bg-muted/40 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-semibold text-foreground truncate">
                {[e.customerFirstName, e.customerLastName].filter(Boolean).join(' ')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instalments</p>
              <p className="font-semibold text-foreground">{e.paidInstallments} / {e.durationMonths ?? '?'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="font-semibold text-foreground">{fmtC(e.totalPaid)}</p>
            </div>
          </div>

          {isLastInstalment && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Final Instalment
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                Recording this payment will mature the scheme.
                Redeemable value will be {fmtC((e.totalPaid ?? 0) + Number(amount || 0) + (e.bonus ?? 0))}.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Amount</label>
            <input className={`${inputCls} text-lg font-semibold`} type="number" min="0" step="0.01"
              value={amount} onChange={e => setAmount(e.target.value)} />
            {e.installmentAmount != null && Number(amount) !== e.installmentAmount && Number(amount) > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Plan instalment is {fmtC(e.installmentAmount)} — custom amount recorded
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`py-2.5 rounded-lg border text-sm font-medium capitalize transition-all ${method === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                  {m === 'bank_transfer' ? 'Bank' : m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Reference / Receipt #</label>
            <input className={inputCls} placeholder="Optional" value={reference} onChange={e => setRef(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" className="flex-1 rounded-full" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 rounded-full" onClick={save} disabled={saving || !Number(amount)}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Recording…</> : 'Record Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SavingsSchemesPage;
