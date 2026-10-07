import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  listOldGoldPaginated, createOldGold, setOldGoldStatus, computeValuationLocal,
  OldGoldPurchase, OldGoldStatus, VoucherType, PaymentMode, TestMethod,
  PAYMENT_MODE_LABELS, TEST_METHOD_LABELS, getPaymentModes,
} from '@/services/oldGoldService';
import { printOldGoldVoucher } from '@/services/oldGoldPrintService';
import { renderOldGoldWithTemplate } from '@/services/templateReceiptService';
import { getCurrentRates, MetalRate } from '@/services/jewelryOpsService';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useStore } from '@/contexts/StoreContext';
import CustomerSearchSelect, { CustomerHit } from '@/components/customers/CustomerSearchSelect';
import QuickAddCustomerModal from '@/components/customers/QuickAddCustomerModal';
import { Button } from '@/components/ui/button';
import {
  Coins, Plus, Loader2, X, User, ChevronRight,
  CheckCircle2, CreditCard, Ban, Banknote, Zap, Scale,
  Search, Package, Printer, RefreshCw,
} from 'lucide-react';

const PAGE_SIZE = 20;

/* ─── constants ────────────────────────────────────────────────────────────── */
const METALS = ['Gold', 'Silver', 'Platinum'];
const PURITIES: Record<string, { label: string; pct: number }[]> = {
  Gold:     [
    { label: '24K (999)', pct: 99.9 }, { label: '22K (916)', pct: 91.6 },
    { label: '21K (875)', pct: 87.5 }, { label: '18K (750)', pct: 75 },
    { label: '14K (585)', pct: 58.5 },
  ],
  Silver:   [
    { label: '999 Fine Silver', pct: 99.9 }, { label: '925 Sterling', pct: 92.5 },
    { label: '800 Silver', pct: 80 },
  ],
  Platinum: [{ label: 'Pt 950', pct: 95 }, { label: 'Pt 900', pct: 90 }],
};

const STATUSES: OldGoldStatus[] = ['valued', 'credited', 'redeemed', 'cancelled'];

// Semantic status colors — a confirmed exception to the navy-only rule, used
// ONLY for status badges/KPI icons (same convention as SalesReturnPage.tsx's
// statusBadge helper): amber=pending action, blue=in-progress/credited,
// green=completed/redeemed, gray=cancelled. Everything decorative elsewhere
// on this page (icon chips, section accents, live-preview panel) is navy.
const STATUS_META: Record<OldGoldStatus, { icon: React.ElementType; cls: string; iconColor: string }> = {
  valued:    { icon: Scale,        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', iconColor: 'text-amber-600' },
  credited:  { icon: CreditCard,   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',     iconColor: 'text-blue-600'  },
  redeemed:  { icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', iconColor: 'text-emerald-600' },
  cancelled: { icon: Ban,          cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',      iconColor: 'text-rose-600'  },
};

const statusBadge = (status: OldGoldStatus) => {
  const meta = STATUS_META[status] ?? STATUS_META.valued;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${meta.cls}`}>
      <Icon className="h-3 w-3" /> {status}
    </span>
  );
};

/* ─── style helpers ─────────────────────────────────────────────────────────── */
const inputCls =
  'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none ' +
  'focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background text-foreground ' +
  'placeholder:text-muted-foreground transition-colors text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';
const sectionCls = 'border border-border rounded-xl p-4 bg-card/50 space-y-3.5';
const sectionHeadCls = 'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
/** Safely convert a MySQL date (string or Date object) to ISO string YYYY-MM-DD */
function toIsoDate(d: any): string | null {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  if (typeof d === 'string') return d.slice(0, 10);
  return null;
}

interface OldGoldLocationState {
  /** Set by the Sales Hub "Old Gold Buy" tile — auto-opens the New Purchase
   *  intake form on mount instead of landing on the bare list. */
  quickAction?: boolean;
  /** Set alongside quickAction — mirrors POSScreen.tsx's fromSalesHub flag so
   *  a completed quick purchase drops the cashier back on /sales-hub instead
   *  of stranding them on the full Old Gold list (matching how POSScreen
   *  returns to the Hub after checkout). Cancelling the form does NOT bounce
   *  back to the Hub — it lands on the full list, which is the intentional
   *  secondary "View All" surface for this page. */
  fromSalesHub?: boolean;
  /** Customer name the cashier already typed in the Hub search — prefills
   *  the New Purchase intake's customer search. */
  presetQuery?: string;
}

const OldGoldPage: React.FC = () => {
  const { formatDate, formatCurrency, formatWeight } = useLocaleFormat();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as OldGoldLocationState | null) ?? null;
  const fromSalesHub = Boolean(locationState?.fromSalesHub);

  const [rows, setRows]       = useState<OldGoldPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail]   = useState<OldGoldPurchase | null>(null);

  // Auto-open the intake form when arriving via the Sales Hub tile's quick
  // action, instead of making the cashier land on the list and click again.
  useEffect(() => {
    if (locationState?.quickAction) setShowNew(true);
    // Only ever consult the flag once on mount — re-opening on every
    // re-render would fight the user re-closing the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce the search box so it doesn't hit the API on every keystroke —
  // same 350ms pattern as SalesReturnPage.tsx.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change resets back to page 1.
  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await listOldGoldPaginated({
        page, limit: PAGE_SIZE,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setRows(result.data);
      setTotalPages(result.pagination.pages || 1);
      setTotalCount(result.pagination.total ?? result.data.length);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Failed to load exchanges');
      setRows([]);
    } finally { setLoading(false); }
  }, [page, statusFilter, searchTerm]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (o: OldGoldPurchase, status: OldGoldStatus) => {
    await setOldGoldStatus(o.id, status);
    load();
    if (detail?.id === o.id) setDetail({ ...o, status });
  };

  const statusCounts: Record<string, number> = {};
  rows.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  const fmtD = (d: any) => { const s = toIsoDate(d); return s ? formatDate(s) : '—'; };

  const handleQuickSaved = () => {
    setShowNew(false);
    load();
    // Mirrors POSScreen.tsx's resetSelectedCustomerAfterSale: a completed
    // action started from the Sales Hub returns the cashier there rather
    // than stranding them on this page.
    if (fromSalesHub) navigate('/sales-hub');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header — navy gradient icon chip, matches SalesReturnPage.tsx */}
      <div className="flex flex-nowrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shadow-sm shrink-0">
            <Coins className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight">Old Gold Exchange</h1>
            <p className="text-sm text-muted-foreground truncate">Buy customer metal, value by purity, issue a redeemable credit voucher.</p>
          </div>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="rounded-full gap-1.5 shrink-0 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0 shadow-sm"
        >
          <Plus className="h-4 w-4" /> New Purchase
        </Button>
      </div>

      {/* KPI strip — glass cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(s => {
          const M = STATUS_META[s];
          const Icon = M.icon;
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(active ? '' : s)}
              className={`flex items-center gap-3 rounded-2xl border border-r-4 p-3.5 text-left transition-all backdrop-blur-md ${
                active ? 'border-primary border-r-primary bg-primary/10 shadow-sm' : 'border-white/40 border-r-primary/40 bg-card/70 hover:border-primary/40 hover:shadow-md'
              }`}>
              <Icon className={`h-5 w-5 shrink-0 ${M.iconColor}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{statusCounts[s] ?? 0}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{s}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {/* Search — glass pill, server-side (voucher no / customer name / email / phone) */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by voucher #, customer name, email, or phone…"
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/40 bg-card/70 backdrop-blur-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* List — glass cards, not a table */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading exchanges…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <Coins className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            No exchanges{statusFilter ? ` with status "${statusFilter}"` : ''}{searchTerm ? ` matching "${searchTerm}"` : ''}.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create first exchange
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(o => (
            <div key={o.id} onClick={() => setDetail(o)}
              className="group cursor-pointer flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow p-4">
              <div className="flex items-center gap-2 min-w-[6rem]">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{o.voucherNo}</span>
              </div>
              <div className="min-w-[9rem] flex-1">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium text-sm text-foreground truncate">
                  {[o.customerFirstName, o.customerLastName].filter(Boolean).join(' ') ||
                    <span className="italic text-muted-foreground">Walk-in</span>}
                </p>
              </div>
              <div className="min-w-[8rem]">
                <p className="text-xs text-muted-foreground">Metal / Purity</p>
                <p className="text-sm text-foreground">{o.metal}{o.purityLabel ? ` · ${o.purityLabel}` : ''}</p>
              </div>
              <div className="min-w-[6rem]">
                <p className="text-xs text-muted-foreground">Net Wt</p>
                <p className="text-sm text-foreground">{formatWeight(o.netWeight)}</p>
              </div>
              <div className="min-w-[6rem]">
                <p className="text-xs text-muted-foreground">Valuation</p>
                <p className="font-semibold text-sm text-foreground">{formatCurrency(o.valuationAmount)}</p>
              </div>
              <div className="min-w-[6rem]">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm text-foreground">{fmtD((o as any).createdAt)}</p>
              </div>
              <div className="min-w-[6rem]">{statusBadge(o.status)}</div>
              <div className="ml-auto">
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination — server-side */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {totalCount} exchange{totalCount === 1 ? '' : 's'} · page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-white/40 bg-card/70 backdrop-blur-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-white/40 bg-card/70 backdrop-blur-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showNew && (
        <NewExchangeModal
          onClose={() => setShowNew(false)}
          onSaved={handleQuickSaved}
          presetQuery={locationState?.quickAction ? locationState?.presetQuery : undefined}
        />
      )}
      {detail && (
        <ExchangeDetailDrawer
          purchase={detail}
          onClose={() => setDetail(null)}
          onStatusChange={changeStatus}
          onRefresh={load}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   NEW EXCHANGE MODAL  (max-w-4xl, two-column layout)
══════════════════════════════════════════════════════════════════════════════ */
const NewExchangeModal: React.FC<{ onClose: () => void; onSaved: () => void; presetQuery?: string }> = ({ onClose, onSaved, presetQuery }) => {
  const { formatCurrency, formatWeight } = useLocaleFormat();
  const { store } = useStore();
  const paymentModes = getPaymentModes(store?.countryCode);
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState('');
  const [rates, setRates]       = useState<MetalRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [saving, setSaving]     = useState(false);

  const [f, setF] = useState({
    item_description: '',
    metal: 'Gold',
    purity_label: '22K (916)', purity_pct: '91.6',
    assayed_purity_pct: '', test_method: 'visual' as TestMethod,
    gross_weight: '', stone_deduction: '', net_weight: '',
    rate_per_gram: '', amount_deduction: '',
    voucher_type: 'credit' as VoucherType,
    payment_mode: 'cash' as PaymentMode,
    notes: '',
  });

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    setRatesLoading(true);
    getCurrentRates()
      .then(r => setRates(r || []))
      .catch(() => {})
      .finally(() => setRatesLoading(false));
  }, []);

  const autoFillRate = () => {
    const match =
      rates.find(r => r.metal?.toLowerCase() === f.metal.toLowerCase() &&
        (r.purityLabel === f.purity_label || r.purityPct === Number(f.purity_pct))) ??
      rates.find(r => r.metal?.toLowerCase() === f.metal.toLowerCase());
    if (match) set('rate_per_gram', String(match.ratePerGram));
  };

  const purities = PURITIES[f.metal] ?? [];
  const finalPurityPct = f.assayed_purity_pct || f.purity_pct;

  const computed = computeValuationLocal({
    grossWeight:     Number(f.gross_weight)     || 0,
    stoneDeduction:  Number(f.stone_deduction)  || 0,
    purityPct:       Number(finalPurityPct)      || 0,
    netWeight:       f.net_weight ? Number(f.net_weight) : undefined,
    ratePerGram:     Number(f.rate_per_gram)    || 0,
    amountDeduction: Number(f.amount_deduction) || 0,
  });

  const onMetalChange = (metal: string) => {
    const first = (PURITIES[metal] ?? [])[0];
    setF(p => ({
      ...p, metal,
      purity_label: first?.label ?? '', purity_pct: String(first?.pct ?? ''),
      rate_per_gram: '',
    }));
  };

  const onPurityChange = (label: string) => {
    const p = purities.find(x => x.label === label);
    setF(prev => ({ ...prev, purity_label: label, purity_pct: String(p?.pct ?? '') }));
  };

  const save = async () => {
    if (!f.metal || !f.gross_weight || !f.rate_per_gram) return;
    setSaving(true);
    try {
      await createOldGold({
        customer_id:          customer?.id ?? null,
        item_description:     f.item_description || null,
        metal:                f.metal,
        purity_label:         f.purity_label || null,
        purity_pct:           Number(f.purity_pct) || null,
        claimed_purity_label: f.purity_label || null,
        claimed_purity_pct:   Number(f.purity_pct) || null,
        assayed_purity_pct:   f.assayed_purity_pct ? Number(f.assayed_purity_pct) : null,
        test_method:          f.test_method,
        gross_weight:         Number(f.gross_weight),
        stone_deduction:      f.stone_deduction ? Number(f.stone_deduction) : undefined,
        net_weight:           f.net_weight ? Number(f.net_weight) : undefined,
        rate_per_gram:        Number(f.rate_per_gram),
        amount_deduction:     f.amount_deduction ? Number(f.amount_deduction) : undefined,
        voucher_type:         f.voucher_type,
        payment_mode:         f.voucher_type === 'cash' ? f.payment_mode : null,
        notes:                f.notes || null,
      });
      onSaved();
    } finally { setSaving(false); }
  };

  const showValuation = Number(f.gross_weight) > 0 && Number(f.rate_per_gram) > 0;
  const canSave = !!f.metal && !!f.gross_weight && !!f.rate_per_gram;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-5xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center">
              <Coins className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">New Old Gold Purchase</h2>
              <p className="text-xs text-muted-foreground">Value customer metal · issue credit or cash settlement</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* Customer */}
              <div className={sectionCls}>
                <h3 className={sectionHeadCls}><User className="h-3.5 w-3.5" /> Customer</h3>
                <CustomerSearchSelect
                  selected={customer}
                  onSelect={setCustomer}
                  onQuickAddRequested={(prefill) => { setQuickAddPrefill(prefill || ''); setIsQuickAddOpen(true); }}
                  initialQuery={presetQuery}
                />
              </div>

              {/* Item Description */}
              <div className={sectionCls}>
                <h3 className={sectionHeadCls}><Package className="h-3.5 w-3.5" /> Item Details</h3>
                <div>
                  <label className={labelCls}>Item Description</label>
                  <input className={inputCls} placeholder="e.g. Gold necklace, bangle set, ring…"
                    value={f.item_description} onChange={e => set('item_description', e.target.value)} />
                </div>
              </div>

              {/* Metal & Purity */}
              <div className={sectionCls}>
                <h3 className={sectionHeadCls}><Coins className="h-3.5 w-3.5" /> Metal & Purity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Metal *</label>
                    <select className={inputCls} value={f.metal} onChange={e => onMetalChange(e.target.value)}>
                      {METALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Claimed Purity *</label>
                    <select className={inputCls} value={f.purity_label} onChange={e => onPurityChange(e.target.value)}>
                      <option value="">— select —</option>
                      {purities.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Assay section */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5" /> Assayed / Tested Purity
                    <span className="font-normal normal-case text-muted-foreground ml-1">optional</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Test Method</label>
                      <select className={inputCls} value={f.test_method}
                        onChange={e => set('test_method', e.target.value as TestMethod)}>
                        {Object.entries(TEST_METHOD_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Actual Purity %</label>
                      <input className={inputCls} type="number" min="0" max="100" step="0.1"
                        placeholder={`e.g. ${f.purity_pct}`}
                        value={f.assayed_purity_pct} onChange={e => set('assayed_purity_pct', e.target.value)} />
                    </div>
                  </div>
                  {f.assayed_purity_pct && Number(f.assayed_purity_pct) !== Number(f.purity_pct) && (
                    <p className="text-xs text-primary bg-primary/10 rounded px-2 py-1">
                      Assay differs from claimed — using <strong>{f.assayed_purity_pct}%</strong> for valuation
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-4">

              {/* Weight */}
              <div className={sectionCls}>
                <h3 className={sectionHeadCls}><Scale className="h-3.5 w-3.5" /> Weight</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Gross Weight (g) *</label>
                    <input className={inputCls} type="number" min="0" step="0.001" placeholder="0.000"
                      value={f.gross_weight} onChange={e => set('gross_weight', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Stone Deduction (g)</label>
                    <input className={inputCls} type="number" min="0" step="0.001" placeholder="0.000"
                      value={f.stone_deduction} onChange={e => set('stone_deduction', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Net Weight (g)</label>
                    <input className={inputCls} type="number" min="0" step="0.001" placeholder="Auto"
                      value={f.net_weight} onChange={e => set('net_weight', e.target.value)} />
                    <p className="text-[10px] text-muted-foreground mt-1">Leave blank to auto-compute</p>
                  </div>
                </div>
              </div>

              {/* Valuation */}
              <div className={sectionCls}>
                <h3 className={sectionHeadCls}><Banknote className="h-3.5 w-3.5" /> Valuation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Rate per Gram *</label>
                    <div className="flex gap-2">
                      <input className={`${inputCls} flex-1`} type="number" min="0" step="0.01" placeholder="0.00"
                        value={f.rate_per_gram} onChange={e => set('rate_per_gram', e.target.value)} />
                      <Button variant="outline" size="sm" onClick={autoFillRate} disabled={ratesLoading}
                        title="Auto-fill from current metal rates" className="shrink-0 px-2.5">
                        {ratesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      </Button>
                    </div>
                    {rates.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Rates available — click ⚡ to auto-fill
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Additional Deductions</label>
                    <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00"
                      value={f.amount_deduction} onChange={e => set('amount_deduction', e.target.value)} />
                  </div>
                </div>

                {/* Live preview */}
                {showValuation && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
                      Live Valuation Preview
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Wt</p>
                        <p className="font-bold text-foreground mt-1">{formatWeight(computed.netWeight)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rate/g</p>
                        <p className="font-bold text-foreground mt-1">{formatCurrency(Number(f.rate_per_gram))}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Deductions</p>
                        <p className="font-bold text-rose-500 mt-1">- {formatCurrency(Number(f.amount_deduction) || 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Voucher Value</p>
                        <p className="text-xl font-bold text-primary mt-1">
                          {formatCurrency(computed.valuationAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Settlement */}
              <div className={sectionCls}>
                <h3 className={sectionHeadCls}><CreditCard className="h-3.5 w-3.5" /> Settlement</h3>
                <div>
                  <label className={labelCls}>Settlement Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([['credit', 'Store Credit Voucher'], ['cash', 'Cash Payment']] as const).map(([v, label]) => (
                      <button key={v} type="button" onClick={() => set('voucher_type', v)}
                        className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all text-left ${
                          f.voucher_type === v
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {f.voucher_type === 'cash' && (
                  <div>
                    <label className={labelCls}>Payment Mode</label>
                    <div className="flex flex-wrap gap-1.5">
                      {paymentModes.map(m => (
                        <button key={m} type="button" onClick={() => set('payment_mode', m)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            f.payment_mode === m
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}>
                          {PAYMENT_MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea className={inputCls} rows={3}
                    placeholder="Item condition, special instructions…"
                    value={f.notes} onChange={e => set('notes', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <div className="text-sm">
            {showValuation ? (
              <span className="font-semibold text-primary">
                Voucher value: {formatCurrency(computed.valuationAmount)}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">Enter weight & rate to preview value</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || !canSave}>
              {saving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Creating…</>
                : 'Create Purchase'}
            </Button>
          </div>
        </div>
      </div>

      <QuickAddCustomerModal
        isOpen={isQuickAddOpen}
        prefillName={quickAddPrefill}
        onClose={() => setIsQuickAddOpen(false)}
        onCreated={(hit) => { setCustomer(hit); setIsQuickAddOpen(false); }}
      />
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   DETAIL DRAWER
══════════════════════════════════════════════════════════════════════════════ */
const ExchangeDetailDrawer: React.FC<{
  purchase: OldGoldPurchase;
  onClose: () => void;
  onStatusChange: (o: OldGoldPurchase, s: OldGoldStatus) => void;
  onRefresh: () => void;
}> = ({ purchase: o, onClose, onStatusChange }) => {
  const { formatDate, formatCurrency, formatWeight, weightUnitLabel } = useLocaleFormat();
  const { store } = useStore();
  const fmtD = (d: any) => { const s = toIsoDate(d); return s ? formatDate(s) : '—'; };

  const legacyStoreCtx = {
    storeName:    store?.name,
    storeAddress: store?.address ?? undefined,
    storePhone:   store?.phone ?? undefined,
    storeEmail:   store?.email ?? undefined,
    currencyCode: store?.currencyCode,
    countryCode:  store?.countryCode,
  };

  // Try the published old_gold_voucher template first; fall back to the
  // hand-rolled thermal voucher if the store has none published yet — same
  // null-means-fallback contract as renderRepairWithTemplate.
  const handlePrintVoucher = useCallback(async () => {
    try {
      const rendered = await renderOldGoldWithTemplate(o, {
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
        const win = window.open('', '_blank', 'width=420,height=700');
        if (win) {
          win.document.write(rendered.html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 400);
        }
        return;
      }
    } catch { /* fall through to the legacy voucher */ }
    printOldGoldVoucher(o, legacyStoreCtx);
  }, [o, store, formatDate, formatCurrency]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{o.voucherNo}</span>
                {statusBadge(o.status)}
              </div>
              <p className="text-base font-semibold text-foreground">
                {[o.customerFirstName, o.customerLastName].filter(Boolean).join(' ') || 'Walk-in Customer'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {o.metal}{o.purityLabel ? ` · ${o.purityLabel}` : ''}
                {(o as any).itemDescription ? ` · ${(o as any).itemDescription}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Voucher value hero */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Voucher Value</p>
            <p className="text-4xl font-bold text-primary mt-1">
              {formatCurrency(o.valuationAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-2 capitalize">
              {o.status}
              {(o as any).voucherType === 'cash' ? ' · Cash settlement' : ' · Store credit'}
            </p>
          </div>

          {/* Key info grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Voucher Date', value: fmtD((o as any).createdAt) },
              { label: 'Settlement',   value: (o as any).voucherType === 'cash' ? 'Cash' : 'Store Credit' },
              ...(o.status === 'credited' ? [{ label: 'Issued On', value: fmtD((o as any).creditedAt) }] : []),
              ...(o.status === 'redeemed' ? [{ label: 'Redeemed On', value: fmtD((o as any).redeemedAt) }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-lg px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Weight & Valuation breakdown */}
          <div className="border border-border rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Weight & Valuation
            </p>
            {[
              { label: 'Metal',            value: o.metal },
              { label: 'Claimed Purity',   value: (o as any).claimedPurityLabel ?? o.purityLabel ?? '—' },
              { label: 'Assayed Purity',   value: o.purityPct ? `${o.purityPct}%` : '—' },
              { label: 'Test Method',      value: (o as any).testMethod ? TEST_METHOD_LABELS[(o as any).testMethod as TestMethod] : '—' },
              { label: `Gross Weight (${weightUnitLabel})`, value: formatWeight(o.grossWeight) },
              { label: 'Stone Deduction',  value: o.stoneDeduction ? `-${o.stoneDeduction}g` : '—' },
              { label: `Net Weight (${weightUnitLabel})`,   value: formatWeight(o.netWeight) },
              { label: 'Rate / g',         value: formatCurrency(o.ratePerGram) },
              { label: 'Amt. Deduction',   value: o.amountDeduction ? `- ${formatCurrency(o.amountDeduction)}` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm py-1 border-b border-border/60 last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border font-semibold">
              <span className="text-foreground">Voucher Value</span>
              <span className="text-primary">{formatCurrency(o.valuationAmount)}</span>
            </div>
          </div>

          {/* Notes */}
          {o.notes && (
            <div className="border border-border rounded-xl p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{o.notes}</p>
            </div>
          )}

          {/* Print voucher */}
          <Button variant="outline" size="sm" className="w-full gap-1.5"
            onClick={() => { void handlePrintVoucher(); }}>
            <Printer className="h-3.5 w-3.5" /> Print Voucher
          </Button>

          {/* Status actions */}
          {o.status === 'valued' && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5"
                  onClick={() => onStatusChange(o, 'credited')}>
                  <CreditCard className="h-3.5 w-3.5" /> Issue Voucher
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  onClick={() => onStatusChange(o, 'cancelled')}>
                  <Ban className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>
          )}

          {o.status === 'credited' && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 flex-1"
                  onClick={() => onStatusChange(o, 'redeemed')}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Redeemed
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  onClick={() => onStatusChange(o, 'cancelled')}>
                  <Ban className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>
          )}

          {o.status === 'redeemed' && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3.5">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Voucher fully redeemed
              </p>
              {(o as any).redeemedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Redeemed on {formatDate((o as any).redeemedAt.slice(0, 10))}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OldGoldPage;
