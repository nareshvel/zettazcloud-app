import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  listLayaways, getLayaways, searchLayaways, getLayaway, createLayaway, addLayawayPayment, setLayawayStatus,
  sendLayawayEmail,
  previewLayaway,
  Layaway, LayawayStatus,
} from '@/services/jewelryOpsService';
import { getStoreDetails } from '@/services/api';
import CustomerSearchSelect, { CustomerHit } from '@/components/customers/CustomerSearchSelect';
import QuickAddCustomerModal from '@/components/customers/QuickAddCustomerModal';
import { searchProducts } from '@/services/productService';
import {
  printAgreement, printStatement, printPaymentReceipt, printCompletionNotice,
} from '@/services/layawayPrintService';
import { renderLayawayAgreementWithTemplate, renderLayawayReceiptWithTemplate } from '@/services/templateReceiptService';
import { useStore } from '@/contexts/StoreContext';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { Button } from '@/components/ui/button';
import {
  CalendarClock, Plus, Loader2, X, ChevronRight, CreditCard,
  CheckCircle2, AlertCircle, Clock, Ban, User, Package,
  CalendarDays, Banknote, Receipt, ChevronDown, ChevronUp,
  Printer, Mail, FileText, Search,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const fmt = (n: number | null | undefined, currency = 'INR') =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

const today = () => new Date().toISOString().slice(0, 10);

const addMonths = (dateStr: string, months: number) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};
const addWeeks = (dateStr: string, weeks: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

const buildSchedule = (
  startDate: string,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  count: number,
  installmentAmt: number,
): { no: number; dueDate: string; amount: number }[] => {
  const result = [];
  for (let i = 0; i < count; i++) {
    let dueDate: string;
    if (frequency === 'weekly') dueDate = addWeeks(startDate, i + 1);
    else if (frequency === 'biweekly') dueDate = addWeeks(startDate, (i + 1) * 2);
    else dueDate = addMonths(startDate, i + 1);
    result.push({ no: i + 1, dueDate, amount: installmentAmt });
  }
  return result;
};

const isOverdue = (l: Layaway) =>
  l.status === 'active' && l.dueDate && l.dueDate < today();

// Brand navy for everything decorative; these are the semantic status
// exception (green=success/completed, amber=pending/in-progress,
// red=overdue/cancelled/defaulted) — same convention as SalesReturnPage.tsx.
const statusMeta: Record<LayawayStatus, { icon: React.ElementType; color: string }> = {
  active:    { icon: Clock,         color: 'text-amber-600' },
  completed: { icon: CheckCircle2,  color: 'text-emerald-600' },
  cancelled: { icon: Ban,           color: 'text-rose-600' },
  defaulted: { icon: AlertCircle,   color: 'text-red-600' },
};

const STATUS_BADGE_CLS: Record<LayawayStatus, string> = {
  active:    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  defaulted: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

const LayawayStatusBadge: React.FC<{ status: LayawayStatus }> = ({ status }) => {
  const Meta = statusMeta[status] ?? statusMeta.active;
  const Icon = Meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE_CLS[status] ?? STATUS_BADGE_CLS.active}`}>
      <Icon className="h-3 w-3" /> {status}
    </span>
  );
};

/* ─── shared style tokens ──────────────────────────────────────────────────── */
const inputCls =
  'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background text-foreground placeholder:text-muted-foreground transition-colors text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';
const sectionCls = 'border border-border rounded-xl p-4 bg-card space-y-3';

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
const STATUSES: LayawayStatus[] = ['active', 'completed', 'cancelled', 'defaulted'];

export interface StoreCtx {
  storeName?: string; storeAddress?: string;
  storePhone?: string; storeEmail?: string; currency?: string;
}

const PAGE_SIZE = 20;

const LayawayPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Sales Hub quick-action entry point: { quickAction: true, fromSalesHub: true }
  // (fromSalesHub follows the POSScreen.tsx / DutyFreeIntakeModal.tsx precedent
  // for returning the cashier to the Hub once the flow completes). quickAction
  // auto-opens the "find the plan → collect payment" flow immediately on
  // mount instead of dropping the cashier on the full plan-list page.
  const qaState = location.state as { quickAction?: boolean; fromSalesHub?: boolean; presetQuery?: string; presetRecordId?: string } | null;
  const fromSalesHub = Boolean(qaState?.fromSalesHub);
  const [quickActionOpen, setQuickActionOpen] = useState(Boolean(qaState?.quickAction));

  const [rows, setRows]         = useState<Layaway[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput]   = useState('');
  const [searchTerm, setSearchTerm]     = useState('');
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showNew, setShowNew]   = useState(false);
  const [detail, setDetail]     = useState<Layaway | null>(null);
  const [payFor, setPayFor]     = useState<Layaway | null>(null);
  const [storeCtx, setStoreCtx] = useState<StoreCtx>({});

  // Fetch store info once for use in print documents
  useEffect(() => {
    try {
      const storeId = localStorage.getItem('store_id');
      const tenantId = localStorage.getItem('tenant_id');
      if (storeId && tenantId) {
        import('@/services/api').then(({ getStoreDetails }) => {
          getStoreDetails(storeId).then((s: any) => {
            setStoreCtx({
              storeName: s?.name || s?.storeName || '',
              storeAddress: [s?.address, s?.city].filter(Boolean).join(', '),
              storePhone: s?.phone || s?.phoneNumber || '',
              storeEmail: s?.email || '',
              currency: s?.currencyCode || 'INR',
            });
          }).catch(() => {});
        });
      }
    } catch {}
  }, []);

  const { store } = useStore();
  const { formatDate, formatCurrency } = useLocaleFormat();

  const openPrintWindow = (html: string, width: number, height: number) => {
    const win = window.open('', '_blank', `width=${width},height=${height}`);
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  };

  // Try the published layaway_agreement template first; fall back to the
  // hand-rolled A4 agreement if the store has none published yet — same
  // null-means-fallback contract as the other renderXWithTemplate helpers.
  const handlePrintAgreement = useCallback(async (plan: Layaway) => {
    try {
      const rendered = await renderLayawayAgreementWithTemplate(plan, {
        storeId: store?.id,
        logoUrl: store?.logoUrl,
        context: {
          store: {
            name: storeCtx.storeName, address: storeCtx.storeAddress, phone: storeCtx.storePhone,
            email: storeCtx.storeEmail, taxId: store?.taxId, currencyCode: storeCtx.currency,
          },
          formatDate, formatCurrency,
        },
      });
      if (rendered) { openPrintWindow(rendered.html, 900, 700); return; }
    } catch { /* fall through to the legacy agreement */ }
    printAgreement(plan, storeCtx);
  }, [store, storeCtx, formatDate, formatCurrency]);

  // Same fallback contract for the payment receipt — only used on the
  // non-completing payment path; a completing payment keeps printing the
  // legacy completion notice (out of scope for this template phase).
  const handlePrintReceipt = useCallback(async (plan: Layaway, payment: {
    paymentAmount: number; paymentMethod: string; reference?: string | null;
    newPaidAmount: number; newBalance: number;
  }) => {
    try {
      const rendered = await renderLayawayReceiptWithTemplate(plan, payment, {
        storeId: store?.id,
        logoUrl: store?.logoUrl,
        context: {
          store: {
            name: storeCtx.storeName, address: storeCtx.storeAddress, phone: storeCtx.storePhone,
            email: storeCtx.storeEmail, taxId: store?.taxId, currencyCode: storeCtx.currency,
          },
          formatDate, formatCurrency,
        },
      });
      if (rendered) { openPrintWindow(rendered.html, 420, 700); return; }
    } catch { /* fall through to the legacy receipt */ }
    printPaymentReceipt({
      plan, paymentAmount: payment.paymentAmount, paymentMethod: payment.paymentMethod,
      reference: payment.reference, newPaidAmount: payment.newPaidAmount, newBalance: payment.newBalance,
      storeName: storeCtx.storeName, storePhone: storeCtx.storePhone, currency: storeCtx.currency,
    }).catch(() => {});
  }, [store, storeCtx, formatDate, formatCurrency]);

  // Debounce the search box, same as SalesReturnPage.tsx.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLayaways({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
        page, limit: PAGE_SIZE,
      });
      setRows(res.data);
      setTotalPages(res.pagination.pages || 1);
      setTotalCount(res.pagination.total ?? res.data.length);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [statusFilter, searchTerm, page]);

  useEffect(() => { load(); }, [load]);

  // Status counts for the KPI strip — a lightweight unfiltered fetch,
  // independent of the paginated/searched list above.
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    listLayaways().then(all => {
      const m: Record<string, number> = {};
      all.forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
      setStatusCounts(m);
    }).catch(() => {});
  }, [rows.length === 0 && page === 1]); // refresh opportunistically when the list changes shape

  const openDetail = async (l: Layaway) => {
    try { setDetail(await getLayaway(l.id)); }
    catch { setDetail(l); }
  };

  const handleStatusChange = async (l: Layaway, status: LayawayStatus) => {
    await setLayawayStatus(l.id, status);
    load();
    if (detail?.id === l.id) {
      try { setDetail(await getLayaway(l.id)); } catch {}
    }
  };

  const handleQuickActionPick = (l: Layaway) => {
    setQuickActionOpen(false);
    setPayFor(l);
  };

  const handlePaymentSaved = () => {
    setPayFor(null);
    load();
    if (fromSalesHub) {
      navigate('/sales-hub');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header — navy glass hero, matching SalesReturnPage.tsx */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shadow-sm shrink-0">
            <CalendarClock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight">Layaway Plans</h1>
            <p className="text-sm text-muted-foreground">Reserve items and collect payment in instalments — item releases when fully paid.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setQuickActionOpen(true)}
            className="rounded-full gap-1.5"
          >
            <CreditCard className="h-4 w-4" /> Collect Payment
          </Button>
          <Button
            onClick={() => setShowNew(true)}
            className="rounded-full gap-1.5 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0 shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Plan
          </Button>
        </div>
      </div>

      {/* ── KPI strip — glass cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map((s) => {
          const Meta = statusMeta[s];
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? '' : s)}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all backdrop-blur-md ${
                active
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-white/40 bg-card/70 hover:border-primary/40 hover:shadow-md'
              }`}
            >
              <Meta.icon className={`h-5 w-5 shrink-0 ${Meta.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{statusCounts[s] ?? 0}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{s}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Search — glass pill, server-side ────────────────────────────── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by plan #, customer name, email, or phone…"
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/40 bg-card/70 backdrop-blur-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* ── List — glass cards, not a table ─────────────────────────────── */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No layaway plans{statusFilter ? ` with status "${statusFilter}"` : ''}{searchTerm ? ` matching "${searchTerm}"` : ''}.
          </p>
          <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create first plan
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((l) => {
            const overdue = isOverdue(l);
            return (
              <div
                key={l.id}
                onClick={() => openDetail(l)}
                className={`group cursor-pointer flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border bg-card/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow p-4 ${
                  overdue ? 'border-red-200 dark:border-red-900/40' : 'border-white/40'
                }`}
              >
                <div className="min-w-[7rem]">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-mono text-sm font-semibold text-foreground">{l.planNo}</p>
                </div>
                <div className="min-w-[9rem] flex-1 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {[l.customerFirstName, l.customerLastName].filter(Boolean).join(' ') || <span className="text-muted-foreground italic">Walk-in</span>}
                    </p>
                  </div>
                </div>
                <div className="min-w-[6rem] text-right">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-semibold text-sm text-foreground">{fmt(l.balance)}</p>
                </div>
                <div className="min-w-[9rem] w-36">
                  <p className="text-xs text-muted-foreground mb-1">Progress</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-primary/20 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(l.paidPct ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(l.paidPct ?? 0)}%</span>
                  </div>
                </div>
                <div className="min-w-[7rem]">
                  <p className="text-xs text-muted-foreground">Due</p>
                  <span className={`text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
                    {overdue && <AlertCircle className="h-3.5 w-3.5 inline mr-1 text-red-500" />}
                    {l.dueDate ?? '—'}
                  </span>
                </div>
                <div className="min-w-[7rem]"><LayawayStatusBadge status={l.status} /></div>
                <div className="ml-auto flex items-center gap-1">
                  {l.status === 'active' && (
                    <button
                      title="Collect Payment"
                      onClick={(e) => { e.stopPropagation(); setPayFor(l); }}
                      className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                    >
                      <CreditCard className="h-4 w-4" />
                    </button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination — server-side ─────────────────────────────────────── */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {totalCount} plan{totalCount === 1 ? '' : 's'} · page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-white/40 bg-card/70 backdrop-blur-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-white/40 bg-card/70 backdrop-blur-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {quickActionOpen && (
        <CollectPaymentQuickAction
          onClose={() => setQuickActionOpen(false)}
          onViewAll={() => setQuickActionOpen(false)}
          onPick={handleQuickActionPick}
          presetQuery={qaState?.presetQuery}
          presetRecordId={qaState?.presetRecordId}
        />
      )}
      {showNew && (
        <NewPlanModal
          storeCtx={storeCtx}
          onPrintAgreement={handlePrintAgreement}
          onClose={() => setShowNew(false)}
          onSaved={(plan) => { setShowNew(false); load(); if (plan) openDetail(plan); }}
        />
      )}
      {detail && (
        <PlanDetailDrawer
          plan={detail}
          storeCtx={storeCtx}
          onPrintAgreement={handlePrintAgreement}
          onClose={() => setDetail(null)}
          onPayment={(l) => { setDetail(null); setPayFor(l); }}
          onStatusChange={handleStatusChange}
          onRefresh={async () => {
            try { setDetail(await getLayaway(detail.id)); } catch {}
            load();
          }}
        />
      )}
      {payFor && (
        <PaymentModal
          plan={payFor}
          storeCtx={storeCtx}
          onPrintReceipt={handlePrintReceipt}
          onClose={() => setPayFor(null)}
          onSaved={handlePaymentSaved}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   COLLECT PAYMENT — QUICK ACTION (Sales Hub entry point)
   Live search-as-you-type over active plans, mirroring
   ReturnProcessingModal.tsx's Step 1 sale lookup pattern.
══════════════════════════════════════════════════════════════════════════════ */
const CollectPaymentQuickAction: React.FC<{
  onClose: () => void;
  onViewAll: () => void;
  onPick: (l: Layaway) => void;
  presetQuery?: string;
  presetRecordId?: string;
}> = ({ onClose, onViewAll, onPick, presetQuery, presetRecordId }) => {
  const [query, setQuery] = useState(presetQuery || '');
  const [results, setResults] = useState<Layaway[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSelectAttemptedRef = useRef(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try { setResults(await searchLayaways(query)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Arrived from the Sales Hub with a preset query — fire the search
  // immediately on mount rather than waiting on the debounce above (the
  // effect above still runs since `query` was initialized to presetQuery,
  // but this fires it without the 300ms wait).
  useEffect(() => {
    if (!presetQuery?.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);
    (async () => {
      try { setResults(await searchLayaways(presetQuery)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the Hub told us exactly which plan the cashier wants and results
  // resolve to exactly that one record, skip straight to it.
  useEffect(() => {
    if (!presetRecordId || autoSelectAttemptedRef.current) return;
    if (searching) return;
    if (results.length === 0) return;
    autoSelectAttemptedRef.current = true;
    if (results.length === 1 && results[0].id === presetRecordId) {
      onPick(results[0]);
    }
  }, [presetRecordId, searching, results, onPick]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Collect Payment</h2>
              <p className="text-xs text-muted-foreground">Find the active layaway plan</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plan #, customer name, email, or phone…"
              autoFocus
              className={`${inputCls} pl-9`}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary/60" />
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {query.trim() && !searching && results.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                No active plans match &ldquo;{query}&rdquo;.
              </div>
            )}
            {!query.trim() && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Start typing to find a customer&rsquo;s active layaway plan.
              </div>
            )}
            {results.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onPick(l)}
                className="w-full flex items-center justify-between gap-4 p-3 rounded-lg border border-primary/15 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate flex items-center gap-2">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{l.planNo}</span>
                      {[l.customerFirstName, l.customerLastName].filter(Boolean).join(' ') || 'Walk-in'}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {l.customerPhone ? `${l.customerPhone}` : ''}
                      {l.customerEmail ? ` · ${l.customerEmail}` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-foreground">{fmt(l.balance)}</div>
                  <div className="text-xs text-muted-foreground">balance due</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer — secondary "View All" reaches the full plan list */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <button onClick={onViewAll} className="text-sm text-primary hover:text-primary/80 font-medium">
            View All Plans
          </button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   NEW PLAN MODAL
══════════════════════════════════════════════════════════════════════════════ */
interface ProductHit  { id: string; name: string; price: number; sku?: string; }

const NewPlanModal: React.FC<{
  onClose: () => void; onSaved: (plan?: Layaway) => void; storeCtx: StoreCtx;
  onPrintAgreement: (plan: Layaway) => void | Promise<void>;
}> = ({ onClose, onSaved, storeCtx, onPrintAgreement }) => {
  const [customer, setCustomer]   = useState<CustomerHit | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState('');
  const [productQ, setProductQ]   = useState('');
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [items, setItems]         = useState<{ productId?: string; description: string; quantity: number; unit_price: number }[]>([]);
  const [f, setF]                 = useState({ down_payment: '', down_payment_method: 'cash', installment_count: '6', frequency: 'monthly', start_date: today(), cancellation_pct: '10', notes: '' });
  const [schedule, setSchedule]   = useState<{ no: number; dueDate: string; amount: number }[]>([]);
  const [saving, setSaving]       = useState(false);
  const [createdPlan, setCreatedPlan] = useState<Layaway | null>(null); // post-creation state
  const productRef                = useRef<HTMLDivElement>(null);

  // Product search
  useEffect(() => {
    const id = setTimeout(async () => {
      if (productQ.length < 2) { setProductHits([]); return; }
      try {
        const res: any = await searchProducts(productQ, '');
        const arr = Array.isArray(res) ? res : (res?.products ?? res?.data ?? []);
        setProductHits(arr.map((p: any) => ({ id: p.id, name: p.name, price: p.price, sku: p.sku })));
        setProductOpen(true);
      } catch { setProductHits([]); }
    }, 280);
    return () => clearTimeout(id);
  }, [productQ]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (productRef.current && !productRef.current.contains(e.target as Node)) setProductOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const addProduct = (p: ProductHit) => {
    setItems(prev => [...prev, { productId: p.id, description: p.name, quantity: 1, unit_price: p.price }]);
    setProductQ(''); setProductOpen(false);
  };
  const addFreeItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  const removeItem  = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const setItem     = (i: number, k: string, v: any) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const total   = useMemo(() => items.reduce((s, i) => s + (i.quantity || 1) * (i.unit_price || 0), 0), [items]);
  const balance = Math.max(total - (Number(f.down_payment) || 0), 0);
  const perInst = balance / Math.max(Number(f.installment_count) || 1, 1);

  // Rebuild schedule whenever terms change
  useEffect(() => {
    if (perInst > 0 && Number(f.installment_count) > 0) {
      setSchedule(buildSchedule(f.start_date, f.frequency as any, Number(f.installment_count), perInst));
    } else {
      setSchedule([]);
    }
  }, [f.start_date, f.frequency, f.installment_count, perInst]);

  const save = async () => {
    if (!items.length || total <= 0) return;
    setSaving(true);
    try {
      const result = await createLayaway({
        customer_id: customer?.id ?? null,
        total_amount: total,
        down_payment: Number(f.down_payment) || 0,
        payment_method: Number(f.down_payment) > 0 ? f.down_payment_method : null,
        installment_count: Number(f.installment_count) || 1,
        frequency: f.frequency,
        start_date: f.start_date,
        notes: f.notes || null,
        items: items.map(i => ({
          product_id: i.productId ?? null,
          description: i.description,
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
        })),
      });
      // Build a local plan object for immediate printing (full detail fetched on open)
      const localPlan: Layaway = {
        id: result?.id ?? '',
        planNo: result?.plan_no ?? '',
        customerId: customer?.id ?? null,
        customerFirstName: customer?.firstName ?? null,
        customerLastName: customer?.lastName ?? null,
        customerPhone: customer?.phone ?? null,
        customerEmail: customer?.email ?? null,
        totalAmount: total,
        downPayment: Number(f.down_payment) || 0,
        paidAmount: Number(f.down_payment) || 0,
        balance: total - (Number(f.down_payment) || 0),
        installmentAmount: result?.installmentAmount ?? (total - (Number(f.down_payment) || 0)) / Math.max(Number(f.installment_count) || 1, 1),
        installmentCount: Number(f.installment_count) || 1,
        frequency: f.frequency as 'weekly' | 'biweekly' | 'monthly',
        startDate: f.start_date,
        dueDate: result?.dueDate ?? null,
        status: 'active',
        items: items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price, line_total: i.quantity * i.unit_price })),
        payments: Number(f.down_payment) > 0 ? [{ amount: Number(f.down_payment), payment_method: f.down_payment_method, notes: 'Down payment', paid_at: new Date().toISOString() }] : [],
      };
      setCreatedPlan(localPlan);
      onSaved(localPlan); // notify parent to refresh list
    } finally { setSaving(false); }
  };

  /* ── Post-creation success panel ───────────────────────────────────────── */
  if (createdPlan) {
    const [showEmailModal, setShowEmailModal] = useState(false);
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-8 text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Plan Created!</h2>
            <p className="text-sm text-muted-foreground mb-1">
              <span className="font-mono font-semibold text-foreground">{createdPlan.planNo}</span>
              {' · '}{[createdPlan.customerFirstName, createdPlan.customerLastName].filter(Boolean).join(' ') || 'Walk-in Customer'}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Balance: <strong>{fmt(createdPlan.balance)}</strong> in {createdPlan.installmentCount} instalments
            </p>
            <div className="space-y-2.5">
              <Button className="w-full gap-2" onClick={() => { void onPrintAgreement(createdPlan); }}>
                <Printer className="h-4 w-4" /> Print Agreement
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => setShowEmailModal(true)}>
                <Mail className="h-4 w-4" /> Email to Customer
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        </div>
        {showEmailModal && (
          <EmailModal
            plan={createdPlan}
            defaultDocType="agreement"
            onClose={() => setShowEmailModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-5xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">New Layaway Plan</h2>
              <p className="text-xs text-muted-foreground">Reserve items · collect in instalments</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — two-column layout */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* LEFT: Customer + Items */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-5 border-r border-border">

          {/* Customer */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Customer
            </h3>
            <CustomerSearchSelect
              selected={customer}
              onSelect={setCustomer}
              onQuickAddRequested={(prefill) => { setQuickAddPrefill(prefill || ''); setIsQuickAddOpen(true); }}
            />
          </div>
          <QuickAddCustomerModal
            isOpen={isQuickAddOpen}
            prefillName={quickAddPrefill}
            onClose={() => setIsQuickAddOpen(false)}
            onCreated={(hit) => { setCustomer(hit); setIsQuickAddOpen(false); }}
          />

          {/* Reserved Items */}
          <div className={sectionCls}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Reserved Items {items.length > 0 && <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">{items.length}</span>}
            </h3>

            {/* Product search */}
            <div ref={productRef} className="relative">
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="Search inventory by product name or SKU…"
                  value={productQ}
                  onChange={e => setProductQ(e.target.value)}
                />
              </div>
              {productOpen && productHits.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                  {productHits.map(p => (
                    <button
                      key={p.id} type="button"
                      onMouseDown={() => addProduct(p)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 text-sm border-b border-border last:border-0"
                    >
                      <div className="text-left">
                        <p className="font-medium text-foreground">{p.name}</p>
                        {p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}
                      </div>
                      <span className="text-primary font-semibold">{fmt(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Item rows */}
            {items.length > 0 && (
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-16">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-28">Unit Price</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground w-24">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <input className={inputCls} value={it.description} placeholder="Item description"
                            onChange={e => setItem(i, 'description', e.target.value)} />
                        </td>
                        <td className="px-3 py-2">
                          <input className={`${inputCls} text-right`} type="number" min="1" value={it.quantity}
                            onChange={e => setItem(i, 'quantity', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2">
                          <input className={`${inputCls} text-right`} type="number" min="0" step="0.01" value={it.unit_price}
                            onChange={e => setItem(i, 'unit_price', Number(e.target.value))} />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">
                          {fmt(it.quantity * it.unit_price)}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-red-500">
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {items.length === 0 && (
              <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                Search inventory above or add a custom item
              </div>
            )}

            <button onClick={addFreeItem} className="text-sm text-primary hover:text-primary/80 flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add custom item
            </button>
          </div>

          </div> {/* end LEFT column */}

          {/* RIGHT: Payment terms + Summary + Schedule preview */}
          <div className="w-80 shrink-0 overflow-y-auto p-6 space-y-5 bg-muted/20">
            <div className={sectionCls}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5" /> Payment Terms
              </h3>
              <div>
                <label className={labelCls}>Down Payment (₹)</label>
                <input className={inputCls} type="number" min="0" placeholder="0.00"
                  value={f.down_payment} onChange={e => setF(p => ({ ...p, down_payment: e.target.value }))} />
              </div>
              {Number(f.down_payment) > 0 && (
                <div>
                  <label className={labelCls}>Down Payment Method</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['cash', 'card', 'upi', 'bank'].map(m => (
                      <button key={m} type="button" onClick={() => setF(p => ({ ...p, down_payment_method: m }))}
                        className={`py-2 rounded-lg border text-xs font-medium uppercase tracking-wide transition-all ${f.down_payment_method === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Instalments</label>
                  <input className={inputCls} type="number" min="1" max="60"
                    value={f.installment_count} onChange={e => setF(p => ({ ...p, installment_count: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Frequency</label>
                  <select className={inputCls} value={f.frequency} onChange={e => setF(p => ({ ...p, frequency: e.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Start Date</label>
                <input className={inputCls} type="date" value={f.start_date}
                  onChange={e => setF(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Cancellation Fee %</label>
                <input className={inputCls} type="number" min="0" max="100" placeholder="e.g. 10"
                  value={f.cancellation_pct} onChange={e => setF(p => ({ ...p, cancellation_pct: e.target.value }))} />
                <p className="text-xs text-muted-foreground mt-1">Deducted from paid if cancelled</p>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={2} placeholder="Internal notes…"
                  value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            {/* Live summary */}
            {total > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Summary</p>
                {[
                  { label: 'Total Value', value: fmt(total), accent: true },
                  { label: 'Down Payment', value: fmt(Number(f.down_payment) || 0) },
                  { label: 'Balance Financed', value: fmt(balance) },
                  { label: `Per Instalment ×${f.installment_count}`, value: fmt(perInst), accent: true },
                ].map(({ label, value, accent }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={accent ? 'font-bold text-primary' : 'font-medium text-foreground'}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Inline schedule preview */}
            {schedule.length > 0 && (
              <div className={sectionCls}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Schedule Preview
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {schedule.map(s => (
                    <div key={s.no} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{s.no}</span>
                        {s.dueDate}
                      </span>
                      <span className="font-medium text-foreground">{fmt(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div> {/* end RIGHT column */}
        </div> {/* end two-column body */}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <p className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''} · {fmt(total)}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || total <= 0 || items.length === 0}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Creating…</> : 'Create Plan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   PLAN DETAIL DRAWER
══════════════════════════════════════════════════════════════════════════════ */
const PlanDetailDrawer: React.FC<{
  plan: Layaway;
  storeCtx: StoreCtx;
  onPrintAgreement: (plan: Layaway) => void | Promise<void>;
  onClose: () => void;
  onPayment: (p: Layaway) => void;
  onStatusChange: (p: Layaway, s: LayawayStatus) => void;
  onRefresh: () => void;
}> = ({ plan, storeCtx, onPrintAgreement, onClose, onPayment, onStatusChange, onRefresh }) => {
  const [expanded, setExpanded] = useState<'payments' | 'schedule' | 'items' | null>('schedule');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [emailDocType, setEmailDocType] = useState<'agreement' | 'statement' | null>(null);

  const schedule = useMemo(() => {
    if (!plan.installmentAmount || !plan.installmentCount) return [];
    return buildSchedule(plan.startDate, plan.frequency, plan.installmentCount, plan.installmentAmount);
  }, [plan]);

  // Instalments paid = exclude the down payment entry from the count
  const instalmentsOnly = (plan.payments ?? []).filter((p: any) => p.notes !== 'Down payment');
  const paidCount = instalmentsOnly.length;
  // Or compute from amounts as a fallback
  const paidCountAlt = plan.installmentAmount
    ? Math.min(Math.floor(((plan.paidAmount ?? 0) - (plan.downPayment ?? 0)) / plan.installmentAmount), plan.installmentCount ?? 0)
    : paidCount;
  const effectivePaidCount = Math.max(paidCount, paidCountAlt);

  const customerName = [plan.customerFirstName, plan.customerLastName].filter(Boolean).join(' ') || null;
  const Meta = statusMeta[plan.status];

  // Cancellation refund estimate
  const cancellationFeePct = 10; // default; ideally stored on the plan
  const refundAmount = Math.max((plan.paidAmount ?? 0) - (plan.paidAmount ?? 0) * cancellationFeePct / 100, 0);

  return (
    <>
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Drawer header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{plan.planNo}</span>
                <LayawayStatusBadge status={plan.status} />
                {isOverdue(plan) && (
                  <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">Overdue</span>
                )}
              </div>
              <p className="text-base font-semibold text-foreground">
                {customerName ?? 'Walk-in Customer'}
              </p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {(plan as any).customerPhone && (
                  <span className="text-xs text-muted-foreground">📞 {(plan as any).customerPhone}</span>
                )}
                {(plan as any).customerEmail && (
                  <span className="text-xs text-muted-foreground">✉ {(plan as any).customerEmail}</span>
                )}
                {!((plan as any).customerPhone) && !((plan as any).customerEmail) && (
                  <span className="text-xs text-muted-foreground">Due {plan.dueDate ?? '—'}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                title="Print Statement"
                onClick={() => printStatement(plan, storeCtx)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                title="Email to Customer"
                onClick={() => setEmailDocType('statement')}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Mail className="h-4 w-4" />
              </button>
              <button
                title="Print Agreement"
                onClick={() => { void onPrintAgreement(plan); }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <FileText className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground ml-1">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Paid {fmt(plan.paidAmount)} of {fmt(plan.totalAmount)}</span>
              <span className="font-semibold text-foreground">{Math.round(plan.paidPct ?? 0)}%</span>
            </div>
            <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(plan.paidPct ?? 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs">
              <span className="text-green-600 dark:text-green-400 font-medium">Paid {fmt(plan.paidAmount)}</span>
              <span className="text-muted-foreground">Balance <span className="font-semibold text-foreground">{fmt(plan.balance)}</span></span>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Per Instalment', value: fmt(plan.installmentAmount) },
              { label: 'Frequency', value: plan.frequency ?? '—', capitalize: true },
              { label: 'Instalments', value: `${paidCount} / ${plan.installmentCount ?? '—'}` },
            ].map(({ label, value, capitalize }) => (
              <div key={label} className="bg-muted/40 rounded-lg px-3 py-2.5 text-center">
                <p className={`text-sm font-semibold text-foreground ${capitalize ? 'capitalize' : ''}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Collapsible: Instalment Schedule */}
          <CollapsibleSection
            title="Instalment Schedule"
            icon={CalendarDays}
            isOpen={expanded === 'schedule'}
            onToggle={() => setExpanded(prev => prev === 'schedule' ? null : 'schedule')}
          >
            {/* Down payment row */}
            {plan.downPayment > 0 && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-green-50 dark:bg-green-950/20 mb-1">
                <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 text-xs font-bold">✓</div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Down Payment</p>
                  <p className="text-xs text-muted-foreground">{plan.startDate}</p>
                </div>
                <span className="font-semibold text-foreground">{fmt(plan.downPayment)}</span>
              </div>
            )}
            {schedule.length === 0 ? (
              <p className="text-sm text-muted-foreground">No schedule available.</p>
            ) : (
              <div className="space-y-1">
                {schedule.map((s, idx) => {
                  const paid = idx < effectivePaidCount;
                  const current = idx === effectivePaidCount;
                  const overDue = !paid && s.dueDate < today();
                  return (
                    <div
                      key={s.no}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                        paid ? 'bg-green-50 dark:bg-green-950/20' :
                        overDue ? 'bg-red-50 dark:bg-red-950/20' :
                        current ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
                      }`}
                    >
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        paid ? 'bg-green-500 text-white' :
                        overDue ? 'bg-red-500 text-white' :
                        current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {paid ? '✓' : s.no}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">Instalment {s.no}</p>
                        <p className="text-xs text-muted-foreground">{s.dueDate}</p>
                      </div>
                      <span className="font-semibold text-foreground">{fmt(s.amount)}</span>
                      {overDue && <span className="text-xs text-red-600 font-semibold">Overdue</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>

          {/* Collapsible: Payment History */}
          <CollapsibleSection
            title={`Payment History (${(plan.payments ?? []).length})`}
            icon={Receipt}
            isOpen={expanded === 'payments'}
            onToggle={() => setExpanded(prev => prev === 'payments' ? null : 'payments')}
          >
            {(plan.payments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {(plan.payments as any[]).map((p, idx) => {
                  const isDown = p.notes === 'Down payment';
                  const method = p.payment_method ?? p.paymentMethod;
                  return (
                    <div key={p.id ?? idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {isDown && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Down Payment</span>}
                          {!isDown && <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground">Instalment {idx}</span>}
                          {method && <span className="text-xs text-muted-foreground capitalize">{method}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(p.paid_at ?? p.paidAt)?.slice(0, 10) ?? '—'}
                          {p.reference && <span className="ml-2">Ref: {p.reference}</span>}
                        </p>
                      </div>
                      <span className="font-semibold text-green-600 dark:text-green-400">{fmt(p.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>

          {/* Collapsible: Items */}
          <CollapsibleSection
            title={`Reserved Items (${(plan.items ?? []).length})`}
            icon={Package}
            isOpen={expanded === 'items'}
            onToggle={() => setExpanded(prev => prev === 'items' ? null : 'items')}
          >
            {(plan.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No items.</p>
            ) : (
              <div className="space-y-1.5">
                {(plan.items as any[]).map((it, idx) => (
                  <div key={it.id ?? idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{it.description}</p>
                      <p className="text-xs text-muted-foreground">Qty: {it.quantity}</p>
                    </div>
                    <span className="font-medium text-foreground">{fmt(it.lineTotal)}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Auto-complete banner */}
          {plan.status === 'completed' && (
            <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">Plan Fully Paid!</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                All {plan.installmentCount} instalments collected. Item ready for pickup.
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => printCompletionNotice({ plan, paymentAmount: 0, paymentMethod: '', newPaidAmount: plan.paidAmount, newBalance: 0, isComplete: true, storeName: storeCtx.storeName, storePhone: storeCtx.storePhone, currency: storeCtx.currency })}
                >
                  <Printer className="h-3.5 w-3.5" /> Print Collection Notice
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 border-green-300 text-green-700" onClick={() => setEmailDocType('statement')}>
                  <Mail className="h-3.5 w-3.5" /> Email Customer
                </Button>
              </div>
            </div>
          )}

          {/* Cancellation confirm */}
          {showCancelConfirm && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Confirm Cancellation</p>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Total paid</span><span>{fmt(plan.paidAmount)}</span></div>
                <div className="flex justify-between text-red-600"><span className="text-muted-foreground">Cancellation fee ({cancellationFeePct}%)</span><span>- {fmt((plan.paidAmount ?? 0) * cancellationFeePct / 100)}</span></div>
                <div className="flex justify-between font-semibold border-t border-red-200 dark:border-red-800 pt-1.5 mt-1.5"><span>Customer refund</span><span className="text-green-600">{fmt(refundAmount)}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCancelConfirm(false)}>Back</Button>
                <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                  onClick={() => { setShowCancelConfirm(false); onStatusChange(plan, 'cancelled'); }}>
                  Cancel Plan
                </Button>
              </div>
            </div>
          )}

          {/* Status change */}
          {plan.status === 'active' && !showCancelConfirm && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Other Actions</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onStatusChange(plan, 'defaulted')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-muted/40 hover:bg-muted transition-colors">
                  Mark Defaulted
                </button>
                <button onClick={() => setShowCancelConfirm(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                  Cancel Plan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action footer */}
        {plan.status === 'active' && !showCancelConfirm && (
          <div className="px-5 py-4 border-t border-border bg-muted/20 shrink-0 space-y-2">
            <Button className="w-full" onClick={() => onPayment(plan)}>
              <CreditCard className="h-4 w-4 mr-2" />
              Record Payment — Balance {fmt(plan.balance)}
            </Button>
            {isOverdue(plan) && (
              <p className="text-xs text-center text-red-600 font-medium">
                ⚠ This plan is overdue — payment was due on {plan.dueDate}
              </p>
            )}
          </div>
        )}
        {plan.status === 'completed' && (
          <div className="px-5 py-4 border-t border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 shrink-0">
            <p className="text-sm text-center text-green-700 dark:text-green-400 font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Plan complete · ready for pickup
            </p>
          </div>
        )}
      </div>
    </div>

    {/* Email modal — rendered inside drawer so z-index stacks correctly */}
    {emailDocType && (
      <EmailModal
        plan={plan}
        defaultDocType={emailDocType}
        onClose={() => setEmailDocType(null)}
      />
    )}
    </>
  );
};

/* ── Collapsible section sub-component ───────────────────────────────────── */
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon: Icon, isOpen, onToggle, children }) => (
  <div className="border border-border rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </span>
      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
    {isOpen && <div className="px-4 py-3">{children}</div>}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════════
   PAYMENT MODAL
══════════════════════════════════════════════════════════════════════════════ */
const PaymentModal: React.FC<{
  plan: Layaway;
  storeCtx: StoreCtx;
  onPrintReceipt: (plan: Layaway, payment: {
    paymentAmount: number; paymentMethod: string; reference?: string | null;
    newPaidAmount: number; newBalance: number;
  }) => void | Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}> = ({ plan, storeCtx, onPrintReceipt, onClose, onSaved }) => {
  const [amount, setAmount] = useState(String(plan.installmentAmount ?? plan.balance ?? ''));
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);

  const amountNum = Number(amount) || 0;
  const remaining = Math.max((plan.balance ?? 0) - amountNum, 0);
  const willComplete = amountNum >= (plan.balance ?? 0) && (plan.balance ?? 0) > 0;

  const save = async () => {
    if (!amountNum) return;
    setSaving(true);
    try {
      await addLayawayPayment(plan.id, {
        amount: amountNum,
        payment_method: method,
        reference: reference || null,
        notes: note || null,
      });
      // Print receipt / completion notice via configured printer
      if (printReceipt) {
        const receiptData = {
          plan,
          paymentAmount: amountNum,
          paymentMethod: method,
          reference: reference || null,
          newPaidAmount: (plan.paidAmount ?? 0) + amountNum,
          newBalance: Math.max(remaining, 0),
          isComplete: willComplete,
          storeName: storeCtx.storeName,
          storePhone: storeCtx.storePhone,
          currency: storeCtx.currency,
        };
        if (willComplete) {
          printCompletionNotice(receiptData).catch(() => {});
        } else {
          void onPrintReceipt(plan, {
            paymentAmount: amountNum, paymentMethod: method, reference: reference || null,
            newPaidAmount: (plan.paidAmount ?? 0) + amountNum, newBalance: Math.max(remaining, 0),
          });
        }
      }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Record Payment</h2>
              <p className="text-xs text-muted-foreground font-mono">{plan.planNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Balance info */}
          <div className="bg-muted/40 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
              <p className="text-xl font-bold text-foreground">{fmt(plan.balance)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Per Instalment</p>
              <p className="text-base font-semibold text-primary">{fmt(plan.installmentAmount)}</p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className={labelCls}>Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">₹</span>
              <input
                className={`${inputCls} pl-7 text-lg font-semibold`}
                type="number" min="0" step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            {amountNum > 0 && remaining > 0 && (
              <p className="text-xs mt-1.5 text-muted-foreground">
                After this payment: remaining balance <span className="font-semibold text-foreground">{fmt(remaining)}</span>
              </p>
            )}
            {amountNum > 0 && remaining <= 0 && (
              <div className="mt-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">This payment will fully settle the plan — it will auto-complete!</p>
              </div>
            )}
          </div>

          {/* Preset buttons */}
          <div className="flex gap-2">
            {[plan.installmentAmount, plan.balance].filter((v): v is number => v != null && v > 0).map((v, i) => (
              <button key={i} onClick={() => setAmount(String(v))}
                className="flex-1 px-3 py-2 rounded-lg border border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors">
                {i === 0 ? 'Instalment amt' : 'Full balance'} · {fmt(v)}
              </button>
            ))}
          </div>

          {/* Method */}
          <div>
            <label className={labelCls}>Payment Method</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'cash',   label: 'Cash' },
                { value: 'card',   label: 'Card' },
                { value: 'upi',    label: 'UPI' },
                { value: 'bank',   label: 'Bank' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setMethod(value)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                    method === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Reference / Receipt No.</label>
              <input className={inputCls} placeholder="Optional"
                value={reference} onChange={e => setReference(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Note</label>
              <input className={inputCls} placeholder="Optional"
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Print toggle */}
        <div className="px-6 pb-2 flex items-center gap-2">
          <input
            id="print-receipt-toggle"
            type="checkbox"
            checked={printReceipt}
            onChange={e => setPrintReceipt(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          <label htmlFor="print-receipt-toggle" className="text-xs text-muted-foreground cursor-pointer select-none flex items-center gap-1">
            <Printer className="h-3 w-3" />
            {willComplete ? 'Print collection notice after saving' : 'Print payment receipt after saving'}
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving || !amountNum} className="flex-1">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…</> : `Record ${fmt(amountNum)}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   EMAIL MODAL
══════════════════════════════════════════════════════════════════════════════ */
export const EmailModal: React.FC<{
  plan: Layaway;
  defaultDocType?: 'agreement' | 'statement';
  onClose: () => void;
}> = ({ plan, defaultDocType = 'agreement', onClose }) => {
  const defaultTo = plan.customerEmail ?? '';
  const [to, setTo]           = useState(defaultTo);
  const [docType, setDocType] = useState<'agreement' | 'statement'>(defaultDocType);
  const [subject, setSubject] = useState(`Layaway ${defaultDocType === 'statement' ? 'Statement' : 'Agreement'} — ${plan.planNo}`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  // Keep subject in sync when docType changes
  useEffect(() => {
    setSubject(`Layaway ${docType === 'statement' ? 'Statement' : 'Agreement'} — ${plan.planNo}`);
  }, [docType, plan.planNo]);

  const send = async () => {
    if (!to) return;
    setSending(true); setError('');
    try {
      await sendLayawayEmail(plan.id, { to, subject, message: message || undefined, docType });
      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to send email');
    } finally { setSending(false); }
  };

  if (sent) return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">Email Sent!</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {docType === 'statement' ? 'Account statement' : 'Layaway agreement'} sent to <strong>{to}</strong>
        </p>
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Email Document</h2>
              <p className="text-xs text-muted-foreground font-mono">{plan.planNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Document type */}
          <div>
            <label className={labelCls}>Document</label>
            <div className="grid grid-cols-2 gap-2">
              {(['agreement', 'statement'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDocType(t)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium capitalize transition-all ${
                    docType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {t === 'agreement' ? '📄 Agreement' : '📊 Statement'}
                </button>
              ))}
            </div>
          </div>

          {/* To */}
          <div>
            <label className={labelCls}>To</label>
            <input
              className={inputCls}
              type="email"
              placeholder="customer@email.com"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
            {!plan.customerEmail && (
              <p className="text-xs text-amber-600 mt-1">No email on file for this customer — enter manually.</p>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className={labelCls}>Subject</label>
            <input
              className={inputCls}
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          {/* Message */}
          <div>
            <label className={labelCls}>Message (optional)</label>
            <textarea
              className={`${inputCls} h-20 resize-none`}
              placeholder="Add a personal message to include above the document…"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          {/* Preview note */}
          <div className="rounded-lg bg-muted/40 p-3 flex gap-2.5 text-xs text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>
              The email will include a formatted {docType === 'statement' ? 'account statement with full payment history' : 'layaway agreement with item list and instalment schedule'} embedded directly in the message body.
            </span>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={send} disabled={sending || !to} className="flex-1 gap-2">
            {sending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
              : <><Mail className="h-3.5 w-3.5" /> Send Email</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LayawayPage;
