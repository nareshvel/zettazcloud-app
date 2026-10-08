import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Phone, Mail, Globe, MoreHorizontal, Trash2,
  FileText, Truck, Wallet, Loader2, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/services/axiosConfig';
import { getSupplierById, deleteSupplier } from '@/services/supplierService';
import { setBreadcrumbLabel } from '@/utils/breadcrumbLabels';
import SupplierFormModal from '@/components/suppliers/SupplierFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MetricCard from '@/components/MetricCard';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import { useIndustry } from '@/hooks/useIndustry';
import type { Supplier } from '@/types';

// ── Types matching the /api/suppliers/:id/360 payload (snake_case) ───────────

interface Supplier360 {
  kpis: {
    po_count: number;
    po_total: number;
    open_po_count: number;
    open_po_value: number;
    grn_count: number;
    total_received: number;
    last_received_at: string | null;
    payment_count: number;
    total_paid: number;
    expense_count: number;
    unpaid_expense_total: number;
    memo_open: { count: number; value: number };
  };
  purchase_orders: any[];
  receipts: any[];
  payments: any[];
  expenses: any[];
  memos: any[];
}

// ── Small presentation helpers (mirrors CustomerDetailsPage) ────────────────

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  unpaid: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  DRAFT: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
  ORDERED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  partially_returned: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  CANCELLED: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
  cancelled: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
  voided: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
};

const StatusChip: React.FC<{ status?: string | null }> = ({ status }) => {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const cls = STATUS_STYLES[status] || 'bg-muted text-muted-foreground';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
};

interface MiniTableProps {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}

const MiniTable: React.FC<MiniTableProps> = ({ headers, rows, empty }) => {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/40">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${i === headers.length - 1 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              {cells.map((c, j) => (
                <td key={j} className={`px-4 py-3 text-sm whitespace-nowrap ${j === headers.length - 1 ? 'text-right font-medium' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-xs text-muted-foreground uppercase tracking-wider">{label}</dt>
    <dd className="mt-0.5 text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

// ── Page ────────────────────────────────────────────────────────────────────

const SupplierDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useDateFormatting();
  const { industry } = useIndustry();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [view360, setView360] = useState<Supplier360 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [sup, viewRes] = await Promise.all([
        getSupplierById(id),
        axiosInstance.get(`/api/suppliers/${id}/360`),
      ]);
      if (!sup?.id) throw new Error('Supplier not found');
      setSupplier(sup);
      setView360(viewRes.data?.data ?? null);
      if (sup.supplierName) setBreadcrumbLabel(`/suppliers/${id}`, sup.supplierName);
    } catch (error) {
      console.error('Error loading supplier details:', error);
      toast.error('Failed to load supplier details');
      navigate('/suppliers');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => setBreadcrumbLabel(`/suppliers/${id}`, null), [id]);

  const confirmDeleteSupplier = async () => {
    if (!supplier?.id) return;
    try {
      await deleteSupplier(supplier.id);
      toast.success('Supplier deleted successfully');
      navigate('/suppliers');
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('Failed to delete supplier');
    } finally {
      setShowDeleteConfirm(false);
      setShowMoreOptions(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium text-foreground">Supplier not found</h2>
        <button className="mt-4 text-primary hover:underline inline-flex items-center" onClick={() => navigate('/suppliers')}>
          <ArrowLeft size={16} className="mr-1" /> Back to Suppliers
        </button>
      </div>
    );
  }

  const k = view360?.kpis;
  const n = (a?: any[]) => a?.length ?? 0;
  const money = (v?: number | string | null) => formatCurrency(parseFloat(String(v)) || 0);
  const isJewelry = industry === 'jewelry';

  const initials = (supplier.supplierName || '?')
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  const outstanding = (k?.unpaid_expense_total ?? 0) + (k?.open_po_value ?? 0) + (k?.memo_open.value ?? 0);

  const address = [
    supplier.addressLine1,
    supplier.addressLine2,
    [supplier.city, supplier.stateProvince].filter(Boolean).join(', '),
    supplier.postalCode,
    supplier.country,
  ].filter(Boolean).join('\n');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'pos', label: `Purchase Orders (${k?.po_count ?? 0})` },
    { id: 'receipts', label: `Receipts (${k?.grn_count ?? 0})` },
    { id: 'payments', label: `Payments (${k?.payment_count ?? 0})` },
    { id: 'expenses', label: `Expenses (${k?.expense_count ?? 0})` },
    ...(isJewelry || n(view360?.memos) ? [{ id: 'memos', label: `Memos (${n(view360?.memos)})` }] : []),
  ];

  return (
    <div className="p-4 md:p-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/suppliers')}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Back to suppliers"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-semibold text-foreground truncate">{supplier.supplierName}</h1>
              <StatusChip status={supplier.isActive ? 'active' : 'cancelled'} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap mt-0.5">
              {supplier.contactPerson && <span>{supplier.contactPerson}</span>}
              {supplier.email && <span>· {supplier.email}</span>}
              {supplier.phone && <span>· {supplier.phone}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/purchase-orders', { state: { supplierId: supplier.id } })}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium"
          >
            <FileText size={16} /> New Purchase Order
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm"
          >
            <Pencil size={15} /> Edit
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="More options"
            >
              <MoreHorizontal size={20} />
            </button>
            {showMoreOptions && (
              <div className="absolute right-0 mt-2 w-44 bg-card rounded-lg shadow-lg z-20 border border-border py-1">
                <button
                  onClick={() => { setShowMoreOptions(false); setShowDeleteConfirm(true); }}
                  className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted inline-flex items-center gap-2"
                >
                  <Trash2 size={15} /> Delete supplier
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title="Total Received"
          value={money(k?.total_received)}
          icon={<Truck />}
          footerText={`${k?.grn_count ?? 0} goods received note${k?.grn_count === 1 ? '' : 's'}`}
          iconBgClass="bg-emerald-100"
          iconClass="text-emerald-600"
          footerBgClass="bg-emerald-50"
          footerTextClass="text-emerald-700"
        />
        <MetricCard
          title="Outstanding"
          value={money(outstanding)}
          icon={<Wallet />}
          footerText={`${k?.open_po_count ?? 0} open PO${k?.open_po_count === 1 ? '' : 's'} · ${money(k?.unpaid_expense_total)} expenses`}
          iconBgClass="bg-amber-100"
          iconClass="text-amber-600"
          footerBgClass="bg-amber-50"
          footerTextClass="text-amber-700"
        />
        <MetricCard
          title="Total Paid"
          value={money(k?.total_paid)}
          icon={<Building2 />}
          footerText={`${k?.payment_count ?? 0} payment${k?.payment_count === 1 ? '' : 's'} recorded`}
          iconBgClass="bg-blue-100"
          iconClass="text-blue-600"
          footerBgClass="bg-blue-50"
          footerTextClass="text-blue-700"
        />
        <MetricCard
          title="Last Receipt"
          value={k?.last_received_at ? formatDate(k.last_received_at) : '—'}
          icon={<Truck />}
          footerText={`${k?.po_count ?? 0} purchase order${k?.po_count === 1 ? '' : 's'} lifetime`}
          iconBgClass="bg-purple-100"
          iconClass="text-purple-600"
          footerBgClass="bg-purple-50"
          footerTextClass="text-purple-700"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-4 overflow-x-auto">
        <nav className="flex gap-5 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {activeTab === 'overview' && (
          <div className="divide-y divide-border">
            {/* Contact */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Building2 size={15} className="text-muted-foreground" /> CONTACT
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <DetailRow label="Contact person" value={supplier.contactPerson} />
                <DetailRow label="Email" value={supplier.email && (
                  <a href={`mailto:${supplier.email}`} className="text-primary hover:underline inline-flex items-center gap-1.5">
                    <Mail size={13} /> {supplier.email}
                  </a>
                )} />
                <DetailRow label="Phone" value={supplier.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={13} /> {supplier.phone}
                  </span>
                )} />
                <DetailRow label="Website" value={supplier.website && (
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1.5">
                    <Globe size={13} /> {supplier.website}
                  </a>
                )} />
                <DetailRow label="Tax ID" value={supplier.taxId} />
                <DetailRow label="Payment terms" value={supplier.defaultPaymentTerms} />
              </div>
            </div>

            {/* Address */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">ADDRESS</h3>
              {address
                ? <p className="text-sm text-foreground whitespace-pre-line">{address}</p>
                : <p className="text-sm text-muted-foreground">No address on file.</p>}
            </div>

            {/* Details */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">DETAILS</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <DetailRow label="Status" value={supplier.isActive ? 'Active' : 'Inactive'} />
                <DetailRow label="Supplier since" value={supplier.createdAt ? formatDate(supplier.createdAt) : undefined} />
                <DetailRow label="On memo" value={k ? `${k.memo_open.count} open · ${money(k.memo_open.value)}` : undefined} />
                <DetailRow label="On order" value={k ? `${k.open_po_count} PO · ${money(k.open_po_value)}` : undefined} />
              </div>
              {supplier.notes && (
                <div className="mt-4">
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</h4>
                  <p className="text-sm text-foreground whitespace-pre-line">{supplier.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pos' && (
          <MiniTable
            headers={['PO #', 'Ordered', 'Expected', 'Status', 'Total']}
            empty="No purchase orders for this supplier."
            rows={(view360?.purchase_orders ?? []).map((p) => [
              <span className="font-medium">{p.purchase_order_number}</span>,
              p.order_date ? formatDate(p.order_date) : '—',
              p.expected_delivery_date ? formatDate(p.expected_delivery_date) : '—',
              <StatusChip status={p.status} />,
              money(p.total_amount),
            ])}
          />
        )}

        {activeTab === 'receipts' && (
          <MiniTable
            headers={['GRN', 'Received', 'Received value', 'Status', 'Grand total']}
            empty="No goods received from this supplier."
            rows={(view360?.receipts ?? []).map((g) => [
              <span className="font-medium">{g.grn_number}</span>,
              g.received_date ? formatDate(g.received_date) : '—',
              money(g.total_received_value),
              <StatusChip status={g.status} />,
              money(g.grand_total),
            ])}
          />
        )}

        {activeTab === 'payments' && (
          <MiniTable
            headers={['Payment #', 'Date', 'Method', 'Status', 'Amount']}
            empty="No payments recorded for this supplier."
            rows={(view360?.payments ?? []).map((p) => [
              <span className="font-medium">{p.payment_number}</span>,
              p.payment_date ? formatDate(p.payment_date) : formatDate(p.created_at),
              p.payment_method || '—',
              <StatusChip status={p.status} />,
              money(p.amount),
            ])}
          />
        )}

        {activeTab === 'expenses' && (
          <MiniTable
            headers={['Expense #', 'Date', 'Category', 'Status', 'Amount']}
            empty="No expenses linked to this supplier."
            rows={(view360?.expenses ?? []).map((e) => [
              <span className="font-medium">{e.expense_number}</span>,
              e.expense_date ? formatDate(e.expense_date) : formatDate(e.created_at),
              <span className="capitalize">{e.category || '—'}</span>,
              <StatusChip status={e.status} />,
              money(e.amount),
            ])}
          />
        )}

        {activeTab === 'memos' && (
          <MiniTable
            headers={['Memo #', 'Issued', 'Due', 'Direction', 'Status', 'Value']}
            empty="No memo transactions for this supplier."
            rows={(view360?.memos ?? []).map((m) => [
              <span className="font-medium">{m.memo_no}</span>,
              m.issue_date ? formatDate(m.issue_date) : '—',
              m.due_date ? formatDate(m.due_date) : '—',
              <span className="capitalize">{m.direction === 'out' ? 'Out to supplier' : 'In from supplier'}</span>,
              <StatusChip status={m.status} />,
              money(m.total_value),
            ])}
          />
        )}
      </div>

      {/* Modals */}
      {isEditModalOpen && (
        <SupplierFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialData={supplier}
          onSubmitSuccess={() => {
            setIsEditModalOpen(false);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
        title="Delete supplier?"
        description={`Are you sure you want to delete ${supplier.supplierName}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteSupplier}
      />
    </div>
  );
};

export default SupplierDetailsPage;
