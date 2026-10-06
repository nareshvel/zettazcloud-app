import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  listRepairsPaged, getRepair, createRepair, updateRepair, setRepairStatus, sendRepairEmail,
  collectBalance, getRepairStats,
  RepairOrder, RepairStatus, RepairStats, PaymentMode, PAYMENT_MODES, PAYMENT_MODE_LABELS,
} from '@/services/repairService';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { printJobCard, printCollectionReceipt } from '@/services/repairPrintService';
import { renderRepairWithTemplate } from '@/services/templateReceiptService';
import { getStoreDetails } from '@/services/api';
import { useOptionalStore } from '@/contexts/StoreContext';
import CustomerSearchSelect, { CustomerHit } from '@/components/customers/CustomerSearchSelect';
import QuickAddCustomerModal from '@/components/customers/QuickAddCustomerModal';
import DatePickerInput from '@/components/ui/DatePickerInput';
import { Button } from '@/components/ui/button';
import {
  Wrench, Plus, Loader2, X, ChevronRight, User, Clock, Search,
  CheckCircle2, AlertCircle, Truck, Ban, Banknote, FileText,
  Printer, Mail, Package, Shield, Hash,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

const today = () => new Date().toISOString().slice(0, 10);

const inputCls =
  'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background text-foreground placeholder:text-muted-foreground transition-colors text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';
const sectionCls = 'border border-border rounded-xl p-4 bg-card space-y-3';

const STATUSES: RepairStatus[] = ['received', 'in_progress', 'ready', 'delivered', 'cancelled'];
const JOB_TYPES = [
  'Resize / Size Change', 'Rhodium Plating', 'Polish & Clean', 'Stone Setting',
  'Stone Replacement', 'Chain Repair', 'Clasp Repair', 'Soldering / Joining',
  'Engraving', 'Restringing (Beads/Pearls)', 'Prong Re-tipping',
  'Earring Post Repair', 'Pendant Bail Repair', 'Redesign / Custom Work', 'Other',
];
const METALS = ['Gold 22K', 'Gold 18K', 'Gold 14K', 'Gold 9K', 'White Gold', 'Rose Gold', 'Silver 925', 'Silver 999', 'Platinum', 'Diamond Only', 'Stainless Steel', 'Other'];
const STONE_TYPES = ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Coral', 'Topaz', 'Amethyst', 'Turquoise', 'Other'];

// Semantic status colors — an explicit, confirmed exception to the
// navy-only decoration rule (same convention as SalesReturnPage.tsx's
// statusBadge). received/in_progress are workflow-in-flight states shown in
// navy/amber, ready/delivered are success states in green, cancelled is the
// failure state in red/gray. Nothing else on this page uses non-navy color.
const statusMeta: Record<RepairStatus, { icon: React.ElementType; color: string; badgeCls: string; label: string }> = {
  received:    { icon: Clock,        color: 'text-primary',    badgeCls: 'bg-primary/10 text-primary',                                             label: 'Received' },
  in_progress: { icon: Wrench,       color: 'text-amber-600',  badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',    label: 'In Progress' },
  ready:       { icon: CheckCircle2, color: 'text-emerald-600',badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'Ready' },
  delivered:   { icon: Truck,        color: 'text-emerald-700',badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'Delivered' },
  cancelled:   { icon: Ban,          color: 'text-rose-600',   badgeCls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',         label: 'Cancelled' },
};

const StatusBadge: React.FC<{ status: RepairStatus }> = ({ status }) => {
  const meta = statusMeta[status] ?? statusMeta.received;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badgeCls}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
};

export interface StoreCtx {
  storeName?: string; storeAddress?: string; storePhone?: string; storeEmail?: string;
}

const PAGE_SIZE = 20;

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
const RepairsPage: React.FC = () => {
  const { formatDate, formatCurrency } = useLocaleFormat();
  const location = useLocation();
  const navigate = useNavigate();

  // Sales Hub's "Repair Intake" tile navigates here with { quickAction: true,
  // fromSalesHub: true } — quickAction opens the New Repair modal immediately
  // on mount (the tile promises a focused intake action, not a landing on the
  // management screen), fromSalesHub follows the same precedent as
  // POSScreen.tsx / DutyFreeIntakeModal.tsx for returning to the Hub
  // afterward. The list underneath still loads in the background and is one
  // click away (close the modal) — this doubles as the "View All" secondary
  // action rather than a separate menu item, since per-page nav for these
  // hub-only features was removed from the sidebar.
  const navState = (location.state as { quickAction?: boolean; fromSalesHub?: boolean; presetQuery?: string } | null) ?? null;
  const quickAction = Boolean(navState?.quickAction);
  const fromSalesHub = Boolean(navState?.fromSalesHub);

  const [orders, setOrders]           = useState<RepairOrder[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [stats, setStats]             = useState<RepairStats | null>(null);
  const [showNew, setShowNew]         = useState(quickAction);
  const [detail, setDetail]           = useState<RepairOrder | null>(null);
  const [storeCtx, setStoreCtx]       = useState<StoreCtx>({});

  useEffect(() => {
    getStoreDetails().then((s: any) => setStoreCtx({
      storeName: s?.name, storeAddress: s?.address, storePhone: s?.phone, storeEmail: s?.email,
    })).catch(() => {});
  }, []);

  const activeStore = useOptionalStore()?.store;

  // Try the published repair_ticket template first; fall back to the
  // hand-rolled job card if the store has none published yet. Mirrors
  // renderSaleWithTemplate's null-means-fallback contract — a cashier must
  // always get a printable job card, template or not.
  const handlePrintJobCard = useCallback(async (order: RepairOrder) => {
    try {
      const rendered = await renderRepairWithTemplate(order, {
        storeId: activeStore?.id,
        logoUrl: activeStore?.logoUrl,
        context: {
          store: {
            name: storeCtx.storeName,
            address: storeCtx.storeAddress,
            phone: storeCtx.storePhone,
            email: storeCtx.storeEmail,
            taxId: activeStore?.taxId,
            currencyCode: activeStore?.currencyCode,
          },
          formatDate,
          formatCurrency,
        },
      });
      if (rendered) {
        const win = window.open('', '_blank', 'width=800,height=900');
        if (win) {
          win.document.write(rendered.html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 400);
        }
        return;
      }
    } catch { /* fall through to the legacy job card */ }
    printJobCard(order, storeCtx);
  }, [activeStore, storeCtx, formatDate, formatCurrency]);

  // Debounce search, same 350ms pattern as SalesReturnPage.tsx.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRepairsPaged({
        page, limit: PAGE_SIZE, status: statusFilter || undefined, search: searchTerm || undefined,
      });
      setOrders(res.data);
      setTotalPages(res.pagination.pages || 1);
      setTotalCount(res.pagination.total ?? res.data.length);
    } catch { setOrders([]); } finally { setLoading(false); }
  }, [page, statusFilter, searchTerm]);

  const loadStats = useCallback(async () => {
    try { setStats(await getRepairStats()); } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const openDetail = async (o: RepairOrder) => {
    try { setDetail(await getRepair(o.id)); } catch { setDetail(o); }
  };

  const advance = async (o: RepairOrder, status: RepairStatus, note?: string) => {
    await setRepairStatus(o.id, status, note);
    if (status === 'delivered') {
      try { await printCollectionReceipt(o, storeCtx); } catch {}
    }
    load(); loadStats();
    if (detail?.id === o.id) { try { setDetail(await getRepair(o.id)); } catch {} }
  };

  const isOverdue = (o: RepairOrder) =>
    (o.status === 'received' || o.status === 'in_progress') && !!o.promisedDate && o.promisedDate < today();

  const closeNew = () => {
    setShowNew(false);
    load(); loadStats();
    if (fromSalesHub) navigate('/sales-hub');
  };

  const kpiItems: { key: string; label: string; icon: React.ElementType; count: number; colorCls: string }[] = [
    { key: '',            label: 'All Tickets',  icon: Wrench,       count: stats?.total ?? 0,      colorCls: 'text-primary' },
    { key: 'received',    label: 'Received',     icon: Clock,        count: stats?.received ?? 0,   colorCls: statusMeta.received.color },
    { key: 'in_progress', label: 'In Progress',  icon: statusMeta.in_progress.icon, count: stats?.inProgress ?? 0, colorCls: statusMeta.in_progress.color },
    { key: 'ready',       label: 'Ready',        icon: statusMeta.ready.icon,       count: stats?.ready ?? 0,      colorCls: statusMeta.ready.color },
    { key: 'delivered',   label: 'Delivered',    icon: statusMeta.delivered.icon,   count: stats?.delivered ?? 0,  colorCls: statusMeta.delivered.color },
    { key: 'cancelled',   label: 'Cancelled',    icon: statusMeta.cancelled.icon,   count: stats?.cancelled ?? 0,  colorCls: statusMeta.cancelled.color },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header — glass hero, brand navy gradient icon chip. */}
      <div className="flex flex-nowrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shadow-sm shrink-0">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight">Repairs & Custom Orders</h1>
            <p className="text-sm text-muted-foreground truncate">Manage repair tickets from intake through delivery.</p>
          </div>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="rounded-full gap-1.5 shrink-0 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0 shadow-sm"
        >
          <Plus className="h-4 w-4" /> New Repair
        </Button>
      </div>

      {/* KPI strip — glass cards, status colors are the confirmed semantic exception. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiItems.map(item => {
          const Icon = item.icon;
          const active = statusFilter === item.key;
          return (
            <button
              key={item.label}
              onClick={() => setStatusFilter(active ? '' : item.key)}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all backdrop-blur-md ${
                active ? 'border-primary bg-primary/10 shadow-sm' : 'border-white/40 bg-card/70 hover:border-primary/40 hover:shadow-md'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${item.colorCls}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{item.count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search — glass pill, server-side across ticket #, item, customer name/email/phone. */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by ticket #, item, customer name, email, or phone…"
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/40 bg-card/70 backdrop-blur-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* List — glass rows, not a table. */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading repair tickets…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <Wrench className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No repair tickets found.</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create first ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map(o => {
            const overdue = isOverdue(o);
            const balance = (o.finalCost ?? o.estimatedCost ?? 0) - (o.advancePaid ?? 0);
            return (
              <div
                key={o.id}
                onClick={() => openDetail(o)}
                className={`group flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border bg-card/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer ${
                  overdue ? 'border-rose-300/60 dark:border-rose-800/60' : 'border-white/40'
                }`}
              >
                <div className="min-w-[6.5rem]">
                  <p className="text-xs text-muted-foreground">Ticket</p>
                  <p className="font-mono text-xs font-semibold text-foreground bg-muted inline-block px-2 py-0.5 rounded mt-0.5">{o.ticketNo}</p>
                </div>
                <div className="min-w-[9rem] flex-1">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <User className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {[o.customerFirstName, o.customerLastName].filter(Boolean).join(' ') || <span className="italic text-muted-foreground">Walk-in</span>}
                    </span>
                  </div>
                </div>
                <div className="min-w-[10rem] flex-1">
                  <p className="text-xs text-muted-foreground">Item</p>
                  <p className="text-sm text-foreground truncate">{o.itemDescription}</p>
                  {o.metal && <p className="text-xs text-muted-foreground">{o.metal}{o.weight ? ` · ${o.weight}g` : ''}</p>}
                </div>
                <div className="min-w-[6rem]">
                  <p className="text-xs text-muted-foreground">Balance Due</p>
                  <p className="text-sm font-semibold text-foreground">{balance > 0 ? formatCurrency(balance) : <span className="text-emerald-600">Paid</span>}</p>
                </div>
                <div className="min-w-[7rem]">
                  <p className="text-xs text-muted-foreground">Ready Date</p>
                  {o.promisedDate ? (
                    <span className={`text-sm ${overdue ? 'text-rose-600 font-semibold' : 'text-foreground'}`}>
                      {overdue && <AlertCircle className="h-3.5 w-3.5 inline mr-1 text-rose-500" />}
                      {formatDate(o.promisedDate.slice(0, 10))}
                    </span>
                  ) : <span className="text-sm text-foreground">—</span>}
                </div>
                <div className="min-w-[7rem]"><StatusBadge status={o.status} /></div>
                <div className="ml-auto">
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination — server-side, same footer pattern as SalesReturnPage.tsx. */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {totalCount} ticket{totalCount === 1 ? '' : 's'} · page {page} of {totalPages}
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
        <NewRepairModal
          storeCtx={storeCtx}
          onPrintJobCard={handlePrintJobCard}
          onClose={() => closeNew()}
          onSaved={(created) => { if (!created) closeNew(); else { load(); loadStats(); } }}
          presetQuery={quickAction ? navState?.presetQuery : undefined}
        />
      )}
      {detail && (
        <RepairDetailDrawer
          order={detail}
          storeCtx={storeCtx}
          onPrintJobCard={handlePrintJobCard}
          onClose={() => setDetail(null)}
          onStatusChange={advance}
          onRefresh={async () => { try { setDetail(await getRepair(detail.id)); } catch {} load(); loadStats(); }}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   NEW REPAIR MODAL  — max-w-5xl two-column layout
══════════════════════════════════════════════════════════════════════════════ */
const NewRepairModal: React.FC<{
  storeCtx: StoreCtx;
  onPrintJobCard: (order: RepairOrder) => void | Promise<void>;
  onClose: () => void;
  onSaved: (created?: RepairOrder) => void;
  presetQuery?: string;
}> = ({ storeCtx, onPrintJobCard, onClose, onSaved, presetQuery }) => {
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState('');
  const [f, setF] = useState({
    item_description: '', metal: '', weight: '', problem_description: '',
    work_required: '', estimated_cost: '', advance_paid: '', advance_payment_mode: 'cash' as PaymentMode,
    promised_date: '', notes: '', job_type: '', condition_notes: '', goldsmith_name: '',
    serial_no: '', stone_type: '', stone_count: '', stone_weight: '',
    stone_condition: '', insurance_value: '', warranty_days: '',
  });
  const [saving, setSaving]           = useState(false);
  const [createdOrder, setCreatedOrder] = useState<RepairOrder | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const balance = f.estimated_cost && f.advance_paid
    ? Number(f.estimated_cost) - Number(f.advance_paid) : null;

  const save = async () => {
    if (!f.item_description) return;
    setSaving(true);
    try {
      // Build extended notes from extra fields
      const extraLines = [
        f.condition_notes     ? `Condition: ${f.condition_notes}` : '',
        f.goldsmith_name      ? `Goldsmith: ${f.goldsmith_name}` : '',
        f.serial_no           ? `Serial No: ${f.serial_no}` : '',
        f.stone_type          ? `Stone: ${f.stone_type}${f.stone_count ? ` × ${f.stone_count}` : ''}${f.stone_weight ? ` (${f.stone_weight}ct)` : ''}` : '',
        f.stone_condition     ? `Stone condition: ${f.stone_condition}` : '',
        f.insurance_value     ? `Insurance value: ₹${f.insurance_value}` : '',
        f.warranty_days       ? `Warranty: ${f.warranty_days} days` : '',
        f.notes,
      ].filter(Boolean).join('\n');

      const result = await createRepair({
        customer_id:            customer?.id ?? null,
        item_description:       f.item_description,
        metal:                  f.metal || null,
        weight:                 f.weight ? Number(f.weight) : null,
        problem_description:    f.problem_description || null,
        work_required:          f.work_required || null,
        job_type:               f.job_type || null,
        condition_notes:        f.condition_notes || null,
        goldsmith_name:         f.goldsmith_name || null,
        estimated_cost:         f.estimated_cost ? Number(f.estimated_cost) : null,
        advance_paid:           f.advance_paid   ? Number(f.advance_paid)   : null,
        advance_payment_mode:   f.advance_paid   ? f.advance_payment_mode   : null,
        promised_date:          f.promised_date  || null,
        notes:                  extraLines || null,
        received_date:          today(),
      } as any);

      const localOrder: RepairOrder = {
        id:                (result as any).id,
        ticketNo:          (result as any).ticket_no ?? (result as any).ticketNo ?? '',
        customerId:        customer?.id ?? null,
        customerFirstName: customer?.firstName ?? null,
        customerLastName:  customer?.lastName  ?? null,
        customerPhone:     customer?.phone     ?? null,
        customerEmail:     customer?.email     ?? null,
        itemDescription:   f.item_description,
        metal:             f.metal || null,
        weight:            f.weight ? Number(f.weight) : null,
        workRequired:      f.work_required || f.job_type || null,
        estimatedCost:     f.estimated_cost ? Number(f.estimated_cost) : null,
        advancePaid:       f.advance_paid   ? Number(f.advance_paid)   : null,
        promisedDate:      f.promised_date  || null,
        status:            'received',
        receivedDate:      today(),
        notes:             extraLines || null,
      } as any;

      onSaved(localOrder);
      setCreatedOrder(localOrder);
    } finally { setSaving(false); }
  };

  /* ── Post-creation panel ── */
  if (createdOrder) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-8 text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Ticket Created!</h2>
            <p className="text-sm text-muted-foreground mb-1">
              <span className="font-mono font-semibold text-foreground">{createdOrder.ticketNo}</span>
              {' · '}{[createdOrder.customerFirstName, createdOrder.customerLastName].filter(Boolean).join(' ') || 'Walk-in Customer'}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              {createdOrder.itemDescription}{createdOrder.estimatedCost ? ` · Est. ${fmt(createdOrder.estimatedCost)}` : ''}
            </p>
            <div className="space-y-2.5">
              <Button className="w-full gap-2" onClick={() => onPrintJobCard(createdOrder)}>
                <Printer className="h-4 w-4" /> Print Job Card
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={() => setShowEmailModal(true)}>
                <Mail className="h-4 w-4" /> Email to Customer
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>Done</Button>
            </div>
          </div>
        </div>
        {showEmailModal && (
          <RepairEmailModal order={createdOrder} defaultDocType="job_card" onClose={() => setShowEmailModal(false)} />
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-6xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">New Repair Ticket</h2>
              <p className="text-xs text-muted-foreground">Item intake · track till delivery</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {/* Two-column body */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* LEFT — Customer + Item Details + Stones */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-5 border-r border-border">

            {/* Customer */}
            <div className={sectionCls}>
              <h3 className={labelCls + ' flex items-center gap-1.5'}><User className="h-3.5 w-3.5" /> Customer</h3>
              <CustomerSearchSelect
                selected={customer}
                onSelect={setCustomer}
                onQuickAddRequested={(prefill) => { setQuickAddPrefill(prefill || ''); setIsQuickAddOpen(true); }}
                initialQuery={presetQuery}
              />
            </div>
            <QuickAddCustomerModal
              isOpen={isQuickAddOpen}
              prefillName={quickAddPrefill}
              onClose={() => setIsQuickAddOpen(false)}
              onCreated={(hit) => { setCustomer(hit); setIsQuickAddOpen(false); }}
            />

            {/* Item Details */}
            <div className={sectionCls}>
              <h3 className={labelCls + ' flex items-center gap-1.5'}><Package className="h-3.5 w-3.5" /> Item Details</h3>
              <div>
                <label className={labelCls}>Item Description *</label>
                <input className={inputCls} placeholder="e.g. Gold necklace with diamond pendant, approx 15g"
                  value={f.item_description} onChange={e => set('item_description', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Metal / Material</label>
                  <select className={inputCls} value={f.metal} onChange={e => set('metal', e.target.value)}>
                    <option value="">— select —</option>
                    {METALS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Weight (g)</label>
                  <input className={inputCls} type="number" min="0" step="0.001" placeholder="0.000"
                    value={f.weight} onChange={e => set('weight', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Serial / Hallmark No.</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input className={`${inputCls} pl-8`} placeholder="BIS/BIS22K/stamp"
                      value={f.serial_no} onChange={e => set('serial_no', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Insurance Value (₹)</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input className={`${inputCls} pl-8`} type="number" min="0" placeholder="Declared value"
                      value={f.insurance_value} onChange={e => set('insurance_value', e.target.value)} />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Item Condition / Intake Notes</label>
                <textarea className={inputCls} rows={2} placeholder="Existing scratches, bent prongs, tarnish, missing stones…"
                  value={f.condition_notes} onChange={e => set('condition_notes', e.target.value)} />
              </div>
            </div>

            {/* Stones */}
            <div className={sectionCls}>
              <h3 className={labelCls + ' flex items-center gap-1.5'}>💎 Stone Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Stone Type</label>
                  <select className={inputCls} value={f.stone_type} onChange={e => set('stone_type', e.target.value)}>
                    <option value="">— if applicable —</option>
                    {STONE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Stone Condition</label>
                  <select className={inputCls} value={f.stone_condition} onChange={e => set('stone_condition', e.target.value)}>
                    <option value="">— select —</option>
                    <option value="Good — secure in setting">Good — secure in setting</option>
                    <option value="Loose — needs re-setting">Loose — needs re-setting</option>
                    <option value="Chipped / cracked">Chipped / cracked</option>
                    <option value="Missing — needs replacement">Missing — needs replacement</option>
                    <option value="Not applicable">Not applicable</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Stone Count</label>
                  <input className={inputCls} type="number" min="0" placeholder="No. of stones"
                    value={f.stone_count} onChange={e => set('stone_count', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Total Carat Weight</label>
                  <input className={inputCls} type="number" min="0" step="0.01" placeholder="e.g. 0.50"
                    value={f.stone_weight} onChange={e => set('stone_weight', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Work + Cost + Schedule */}
          <div className="w-[46%] shrink-0 overflow-y-auto p-6 space-y-5">

            {/* Work Required */}
            <div className={sectionCls}>
              <h3 className={labelCls + ' flex items-center gap-1.5'}><Wrench className="h-3.5 w-3.5" /> Work Required</h3>
              <div>
                <label className={labelCls}>Job Type</label>
                <select className={inputCls} value={f.job_type} onChange={e => set('job_type', e.target.value)}>
                  <option value="">— select —</option>
                  {JOB_TYPES.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Problem Description</label>
                <textarea className={inputCls} rows={2} placeholder="What the customer says is wrong…"
                  value={f.problem_description} onChange={e => set('problem_description', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Work Instructions (for goldsmith)</label>
                <textarea className={inputCls} rows={2} placeholder="Specific goldsmith instructions…"
                  value={f.work_required} onChange={e => set('work_required', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Assigned Goldsmith / Workshop</label>
                <input className={inputCls} placeholder="Name or workshop"
                  value={f.goldsmith_name} onChange={e => set('goldsmith_name', e.target.value)} />
              </div>
            </div>

            {/* Cost & Schedule */}
            <div className={sectionCls}>
              <h3 className={labelCls + ' flex items-center gap-1.5'}><Banknote className="h-3.5 w-3.5" /> Cost & Schedule</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Estimated Cost</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <input className={`${inputCls} pl-7`} type="number" min="0" step="0.01" placeholder="0.00"
                      value={f.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Advance Collected</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <input className={`${inputCls} pl-7`} type="number" min="0" step="0.01" placeholder="0.00"
                      value={f.advance_paid} onChange={e => set('advance_paid', e.target.value)} />
                  </div>
                </div>
              </div>
              {/* Advance payment mode — only show if advance entered */}
              {Number(f.advance_paid) > 0 && (
                <div>
                  <label className={labelCls}>Advance Payment Mode</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_MODES.map(m => (
                      <button key={m} type="button"
                        onClick={() => set('advance_payment_mode', m)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          f.advance_payment_mode === m
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                        }`}>
                        {PAYMENT_MODE_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Received Date</label>
                  <DatePickerInput value={today()} onChange={() => {}} disabled />
                </div>
                <div>
                  <label className={labelCls}>Ready / Completion Date</label>
                  <DatePickerInput
                    value={f.promised_date}
                    onChange={v => set('promised_date', v)}
                    minDate={today()}
                    maxDate="2099-12-31"
                  />
                </div>
              </div>

              {/* Balance preview */}
              {balance !== null && (
                <div className={`rounded-lg px-3 py-2.5 text-sm flex justify-between items-center ${balance > 0 ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'}`}>
                  <span className="text-muted-foreground">Balance due on delivery</span>
                  <span className={`font-bold ${balance > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-600'}`}>{balance > 0 ? fmt(balance) : 'Fully Paid'}</span>
                </div>
              )}

              <div>
                <label className={labelCls}>Warranty After Repair (days)</label>
                <input className={inputCls} type="number" min="0" placeholder="e.g. 90"
                  value={f.warranty_days} onChange={e => set('warranty_days', e.target.value)} />
              </div>
            </div>

            {/* Internal Notes */}
            <div className={sectionCls}>
              <h3 className={labelCls + ' flex items-center gap-1.5'}><FileText className="h-3.5 w-3.5" /> Internal Notes</h3>
              <textarea className={inputCls} rows={3} placeholder="Any additional notes not shown to the customer…"
                value={f.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <p className="text-xs text-muted-foreground">
            {customer
              ? <><span className="text-foreground font-medium">{[customer.firstName, customer.lastName].filter(Boolean).join(' ')}</span>{customer.phone ? ` · ${customer.phone}` : ''}</>
              : 'No customer linked — will be saved as walk-in'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || !f.item_description}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Creating…</> : 'Create Ticket'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   DETAIL DRAWER
══════════════════════════════════════════════════════════════════════════════ */
const STATUS_FLOW: RepairStatus[] = ['received', 'in_progress', 'ready', 'delivered'];

const RepairDetailDrawer: React.FC<{
  order: RepairOrder;
  storeCtx: StoreCtx;
  onPrintJobCard: (order: RepairOrder) => void | Promise<void>;
  onClose: () => void;
  onStatusChange: (o: RepairOrder, s: RepairStatus, note?: string) => void;
  onRefresh: () => void;
}> = ({ order, storeCtx, onPrintJobCard, onClose, onStatusChange, onRefresh }) => {
  const { formatDate, formatCurrency } = useLocaleFormat();
  const [editFinal, setEditFinal]       = useState(false);
  const [finalCost, setFinalCost]       = useState(String(order.finalCost ?? order.estimatedCost ?? ''));
  const [saving, setSaving]             = useState(false);
  const [emailDocType, setEmailDocType] = useState<'job_card' | 'status_update' | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCollectBalance, setShowCollectBalance] = useState(false);
  const [balanceAmt, setBalanceAmt]     = useState('');
  const [balanceMode, setBalanceMode]   = useState<PaymentMode>('cash');
  const [collectingSaving, setCollectingSaving] = useState(false);

  const totalPaid = (order.advancePaid ?? 0) + (order.balancePaid ?? 0);
  const balance   = (order.finalCost ?? order.estimatedCost ?? 0) - totalPaid;
  const fmtD = (d?: string | null) => d ? formatDate(d.slice(0, 10)) : '—';
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const isActive   = order.status !== 'delivered' && order.status !== 'cancelled';

  const saveFinal = async () => {
    setSaving(true);
    try {
      await updateRepair(order.id, { final_cost: Number(finalCost) } as any);
      setEditFinal(false); onRefresh();
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full">

          {/* Header */}
          <div className="px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{order.ticketNo}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-base font-semibold text-foreground">
                  {[order.customerFirstName, order.customerLastName].filter(Boolean).join(' ') || 'Walk-in Customer'}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{order.itemDescription}</p>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <button title="Print Job Card" onClick={() => onPrintJobCard(order)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Printer className="h-4 w-4" />
                </button>
                <button title="Email Customer" onClick={() => setEmailDocType('status_update')}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Mail className="h-4 w-4" />
                </button>
                <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground ml-1"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Status timeline */}
            <div className="mt-4 flex items-center gap-1">
              {STATUS_FLOW.map((s, idx) => {
                const done   = idx <= currentIdx && order.status !== 'cancelled';
                const active = idx === currentIdx;
                return (
                  <React.Fragment key={s}>
                    <div className={`flex items-center gap-1 ${active ? 'flex-shrink-0' : ''}`}>
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {done && idx < currentIdx ? '✓' : idx + 1}
                      </div>
                      {active && <span className="text-xs font-semibold text-primary capitalize">{s.replace('_', ' ')}</span>}
                    </div>
                    {idx < STATUS_FLOW.length - 1 && (
                      <div className={`flex-1 h-0.5 min-w-[8px] rounded ${idx < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Key info */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Metal',              value: `${order.metal ?? '—'}${order.weight ? ` · ${order.weight}g` : ''}` },
                { label: 'Job Type',           value: (order as any).jobType ?? order.workRequired ?? '—' },
                { label: 'Received',           value: fmtD(order.receivedDate) },
                { label: 'Ready / Completion', value: fmtD(order.promisedDate) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Problem & notes */}
            {order.problemDescription && (
              <div className="border border-border rounded-xl p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Problem</p>
                <p className="text-sm text-foreground">{order.problemDescription}</p>
              </div>
            )}
            {order.notes && (
              <div className="border border-border rounded-xl p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notes & Details</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}

            {/* Cost breakdown */}
            <div className="border border-border rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost Breakdown</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Cost</span>
                  <span className="font-medium">{fmtC(order.estimatedCost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Final Cost</span>
                  {editFinal ? (
                    <div className="flex items-center gap-1.5">
                      <input className="w-28 px-2 py-1 border border-border rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        type="number" value={finalCost} onChange={e => setFinalCost(e.target.value)} />
                      <Button size="sm" onClick={saveFinal} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                      <button onClick={() => setEditFinal(false)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fmtC(order.finalCost)}</span>
                      {isActive && <button onClick={() => setEditFinal(true)} className="text-xs text-primary hover:underline">Edit</button>}
                    </div>
                  )}
                </div>
                {(order.advancePaid ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Advance Paid{order.advancePaymentMode ? ` · ${PAYMENT_MODE_LABELS[order.advancePaymentMode]}` : ''}</span>
                    <span className="font-medium">- {fmtC(order.advancePaid)}</span>
                  </div>
                )}
                {(order.balancePaid ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Balance Paid{order.balancePaymentMode ? ` · ${PAYMENT_MODE_LABELS[order.balancePaymentMode]}` : ''}</span>
                    <span className="font-medium">- {fmtC(order.balancePaid)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Balance Due</span>
                  <span className={balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600'}>
                    {balance > 0 ? fmtC(balance) : 'Fully Paid'}
                  </span>
                </div>
              </div>
            </div>

            {/* History */}
            {(order.history ?? []).length > 0 && (
              <div className="border border-border rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Status History</p>
                <div className="space-y-2">
                  {(order.history as any[]).map((h, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium capitalize">{h.status.replace('_', ' ')}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{h.createdAt?.slice(0, 10)}</span>
                        {h.note && <p className="text-muted-foreground text-xs mt-0.5">{h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collect Balance panel */}
            {isActive && balance > 0 && (
              <div className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collect Balance</p>
                  <button onClick={() => setShowCollectBalance(v => !v)}
                    className="text-xs text-primary hover:underline">
                    {showCollectBalance ? 'Hide' : 'Collect Now'}
                  </button>
                </div>
                {showCollectBalance && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
                      <input
                        type="number"
                        placeholder={String(balance)}
                        value={balanceAmt}
                        onChange={e => setBalanceAmt(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Payment Mode</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PAYMENT_MODES.map(m => (
                          <button key={m} type="button"
                            onClick={() => setBalanceMode(m)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              balanceMode === m
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border text-muted-foreground hover:border-primary/50'
                            }`}>
                            {PAYMENT_MODE_LABELS[m]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!balanceAmt || Number(balanceAmt) <= 0 || collectingSaving}
                      onClick={async () => {
                        setCollectingSaving(true);
                        try {
                          await collectBalance(order.id, {
                            amount: Number(balanceAmt),
                            paymentMode: balanceMode,
                            markDelivered: true,
                          });
                          setShowCollectBalance(false);
                          setBalanceAmt('');
                          onRefresh();
                        } catch (err: any) {
                          alert(err.message ?? 'Failed to collect balance');
                        } finally {
                          setCollectingSaving(false);
                        }
                      }}
                      className="w-full gap-1.5"
                    >
                      {collectingSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Confirm & Mark Delivered
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Ready banner */}
            {order.status === 'ready' && (
              <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4" /> Ready for pickup
                </p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEmailDocType('status_update')}>
                  <Mail className="h-3.5 w-3.5" /> Notify Customer
                </Button>
              </div>
            )}

            {/* Delivered banner */}
            {order.status === 'delivered' && (
              <div className="rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-4 space-y-2">
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Item delivered · {order.deliveredDate ?? ''}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => printCollectionReceipt(order, storeCtx)}>
                    <Printer className="h-3.5 w-3.5" /> Reprint Receipt
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEmailDocType('status_update')}>
                    <Mail className="h-3.5 w-3.5" /> Email Customer
                  </Button>
                </div>
              </div>
            )}

            {/* Status actions */}
            {isActive && !showCancelConfirm && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Advance to Next Stage</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FLOW.filter((_, idx) => idx > currentIdx).map(s => (
                    <Button key={s} variant="outline" size="sm" onClick={() => onStatusChange(order, s)} className="capitalize">
                      Mark {s.replace('_', ' ')}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(true)}
                    className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {showCancelConfirm && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Cancel this repair ticket?</p>
                <p className="text-xs text-red-600/80">This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCancelConfirm(false)}>Back</Button>
                  <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                    onClick={() => { setShowCancelConfirm(false); onStatusChange(order, 'cancelled'); }}>
                    Cancel Ticket
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {emailDocType && (
        <RepairEmailModal order={order} defaultDocType={emailDocType} onClose={() => setEmailDocType(null)} />
      )}
    </>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   EMAIL MODAL
══════════════════════════════════════════════════════════════════════════════ */
const RepairEmailModal: React.FC<{
  order: RepairOrder;
  defaultDocType: 'job_card' | 'status_update';
  onClose: () => void;
}> = ({ order, defaultDocType, onClose }) => {
  const defaultSubject = (dt: string) =>
    dt === 'job_card' ? `Your Repair Ticket ${order.ticketNo}` : `Update on Your Repair – ${order.ticketNo}`;

  const [to, setTo]           = useState((order as any).customerEmail ?? '');
  const [docType, setDocType] = useState<'job_card' | 'status_update'>(defaultDocType);
  const [subject, setSubject] = useState(defaultSubject(defaultDocType));
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => { setSubject(defaultSubject(docType)); }, [docType]);

  const send = async () => {
    if (!to) return;
    setSending(true); setError('');
    try {
      await sendRepairEmail(order.id, { to, subject, message, docType });
      setSent(true);
    } catch (e: any) { setError(e?.message ?? 'Failed to send'); } finally { setSending(false); }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-base font-semibold mb-2">Email Sent!</h3>
          <p className="text-sm text-muted-foreground mb-4">Sent to <strong>{to}</strong></p>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Email Customer</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!(order as any).customerEmail && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              No email on file — enter one below.
            </div>
          )}
          <div>
            <label className={labelCls}>To</label>
            <input className={inputCls} type="email" placeholder="customer@example.com" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Document Type</label>
            <select className={inputCls} value={docType} onChange={e => setDocType(e.target.value as any)}>
              <option value="job_card">Repair Job Card</option>
              <option value="status_update">Status Update</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Subject</label>
            <input className={inputCls} value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Message (optional)</label>
            <textarea className={inputCls} rows={3} placeholder="Additional message…" value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-muted-foreground">
            A summary of ticket <strong>{order.ticketNo}</strong> will be embedded in the email.
          </p>
        </div>
        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 gap-2" onClick={send} disabled={sending || !to}>
            {sending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</> : <><Mail className="h-3.5 w-3.5" /> Send</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RepairsPage;
