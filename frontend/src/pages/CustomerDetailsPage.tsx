import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Phone, Mail, Globe, MoreHorizontal, Trash2,
  ShoppingCart, Heart, Wallet, ReceiptText, RotateCcw, CalendarClock,
  Loader2, User,
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/services/axiosConfig';
import CustomerFormModal from '@/components/customers/CustomerFormModal';
import CustomerContactsPanel from '@/components/customers/CustomerContactsPanel';
import CustomerActivityPanel from '@/components/customers/CustomerActivityPanel';
import CustomerCrmDrawer from '@/components/crm/CustomerCrmDrawer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MetricCard from '@/components/MetricCard';
import { useCurrency } from '@/contexts/LocalizationContext';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { useIndustry } from '@/hooks/useIndustry';

// ── Types matching the /api/customers/:id/360 payload (snake_case, as returned) ─

interface Customer360Kpis {
  sale_count: number;
  lifetime_spend: number;
  last_sale_at: string | null;
  return_count: number;
  returns_total: number;
  layaway_open: { count: number; balance: number };
  memo_open: { count: number; balance: number };
  repair_open: { count: number; balance: number };
  old_gold_open: { count: number; balance: number };
  savings_open: { count: number; balance: number };
}

interface Customer360 {
  kpis: Customer360Kpis;
  sales: any[];
  returns: any[];
  layaways: any[];
  memos: any[];
  repairs: any[];
  old_gold: any[];
  savings: any[];
}

// ── Small presentation helpers ──────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  received: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  partially_returned: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  valued: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  credited: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  overdue: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  cancelled: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
  delivered: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
  redeemed: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
};

const StatusChip: React.FC<{ status?: string | null }> = ({ status }) => {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const cls = STATUS_STYLES[status] || 'bg-muted text-muted-foreground';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
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

const CustomerDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatDateTime } = useDateFormatting();
  const { industry } = useIndustry();

  const [customer, setCustomer] = useState<any>(null);
  const [view360, setView360] = useState<Customer360 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCrmOpen, setIsCrmOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [custRes, viewRes] = await Promise.all([
        axiosInstance.get(`/api/customers/${id}`),
        axiosInstance.get(`/api/customers/${id}/360`),
      ]);
      const cust = custRes.data?.data?.customer;
      if (!cust) throw new Error('Customer not found');
      setCustomer(cust);
      setView360(viewRes.data?.data ?? null);
    } catch (error) {
      console.error('Error loading customer details:', error);
      toast.error('Failed to load customer details');
      navigate('/customers');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleSaveCustomer = async (customerData: any) => {
    if (!customer?.id) return;
    try {
      const response = await axiosInstance.put(`/api/customers/${customer.id}`, customerData);
      const updated = response.data?.data?.customer;
      if (updated) {
        toast.success('Customer updated successfully');
        setCustomer(updated);
      }
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer');
    }
  };

  const confirmDeleteCustomer = async () => {
    if (!customer?.id) return;
    try {
      await axiosInstance.delete(`/api/customers/${customer.id}`);
      toast.success('Customer deleted successfully');
      navigate('/customers');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer');
    } finally {
      setShowDeleteConfirm(false);
      setShowMoreOptions(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h2 className="text-xl font-medium text-foreground">Customer not found</h2>
        <button className="mt-4 text-primary hover:underline inline-flex items-center" onClick={() => navigate('/customers')}>
          <ArrowLeft size={16} className="mr-1" /> Back to Customers
        </button>
      </div>
    );
  }

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  const initials = `${customer.first_name?.[0] ?? ''}${customer.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  const k = view360?.kpis;

  const isJewelry = industry === 'jewelry';
  const canRepairs = isJewelry || industry === 'electronics';
  const n = (a?: any[]) => a?.length ?? 0;
  const money = (v?: number | string | null) => formatCurrency(parseFloat(String(v)) || 0);

  // Show an industry-gated module tab when the industry allows it OR the
  // customer actually has records there (data wins over gating).
  const openBalance =
    (k?.layaway_open.balance ?? 0) + (k?.memo_open.balance ?? 0) +
    (k?.repair_open.balance ?? 0) + (k?.savings_open.balance ?? 0);
  const openItems =
    (k?.layaway_open.count ?? 0) + (k?.memo_open.count ?? 0) +
    (k?.repair_open.count ?? 0) + (k?.old_gold_open.count ?? 0) +
    (k?.savings_open.count ?? 0);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'sales', label: `Sales (${k?.sale_count ?? 0})` },
    { id: 'returns', label: `Returns (${n(view360?.returns)})` },
    ...(isJewelry || n(view360?.layaways) ? [{ id: 'layaways', label: `Layaways (${n(view360?.layaways)})` }] : []),
    ...(isJewelry || n(view360?.memos) ? [{ id: 'memos', label: `Memos (${n(view360?.memos)})` }] : []),
    ...(canRepairs || n(view360?.repairs) ? [{ id: 'repairs', label: `Repairs (${n(view360?.repairs)})` }] : []),
    ...(isJewelry || n(view360?.old_gold) ? [{ id: 'old-gold', label: `Old Gold (${n(view360?.old_gold)})` }] : []),
    ...(isJewelry || n(view360?.savings) ? [{ id: 'savings', label: `Savings (${n(view360?.savings)})` }] : []),
    { id: 'activity', label: 'Activity' },
  ];

  const address = [
    customer.address_line1,
    customer.address_line2,
    [customer.city, customer.state_province].filter(Boolean).join(', '),
    customer.postal_code,
    customer.country,
  ].filter(Boolean).join('\n');

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Back to customers"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-semibold text-foreground truncate">{fullName}</h1>
              <StatusChip status={customer.is_active ? 'active' : 'cancelled'} />
              {customer.is_tax_exempt ? <StatusChip status="valued" /> : null}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap mt-0.5">
              {customer.customer_code && <span>{customer.customer_code}</span>}
              {customer.company_name && <span>· {customer.company_name}</span>}
              <span className="capitalize">· {(customer.customer_type || 'individual').toLowerCase()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(isJewelry ? '/sales-hub' : '/pos', { state: { customerId: customer.id } })}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium"
          >
            <ShoppingCart size={16} /> New Sale
          </button>
          <button
            onClick={() => setIsCrmOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm"
            title="Wishlist & reminders"
          >
            <Heart size={16} className="text-rose-500" /> CRM
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
                  <Trash2 size={15} /> Delete customer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title="Lifetime Spend"
          value={money(k?.lifetime_spend)}
          icon={<Wallet />}
          footerText={`${k?.sale_count ?? 0} completed sale${k?.sale_count === 1 ? '' : 's'}`}
          iconBgClass="bg-emerald-100"
          iconClass="text-emerald-600"
          footerBgClass="bg-emerald-50"
          footerTextClass="text-emerald-700"
        />
        <MetricCard
          title="Open Balance"
          value={money(openBalance)}
          icon={<CalendarClock />}
          footerText={`${openItems} open item${openItems === 1 ? '' : 's'} across modules`}
          iconBgClass="bg-amber-100"
          iconClass="text-amber-600"
          footerBgClass="bg-amber-50"
          footerTextClass="text-amber-700"
        />
        <MetricCard
          title="On-Account Credit"
          value={money(customer.outstanding_credit)}
          icon={<ReceiptText />}
          footerText={customer.credit_limit ? `Credit limit ${money(customer.credit_limit)}` : 'No credit limit set'}
          iconBgClass="bg-blue-100"
          iconClass="text-blue-600"
          footerBgClass="bg-blue-50"
          footerTextClass="text-blue-700"
        />
        <MetricCard
          title="Last Purchase"
          value={k?.last_sale_at ? formatDate(k.last_sale_at) : '—'}
          icon={<RotateCcw />}
          footerText={`${k?.return_count ?? 0} return${k?.return_count === 1 ? '' : 's'} · ${money(k?.returns_total)}`}
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
                <User size={15} className="text-muted-foreground" /> CONTACT
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <DetailRow label="Email" value={customer.email && (
                  <a href={`mailto:${customer.email}`} className="text-primary hover:underline inline-flex items-center gap-1.5">
                    <Mail size={13} /> {customer.email}
                  </a>
                )} />
                <DetailRow label="Phone" value={customer.phone_number && (
                  <a href={`tel:${customer.phone_number}`} className="inline-flex items-center gap-1.5">
                    <Phone size={13} /> {customer.phone_number}
                  </a>
                )} />
                <DetailRow label="Website" value={customer.website && (
                  <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1.5">
                    <Globe size={13} /> {customer.website}
                  </a>
                )} />
                <DetailRow label="Preferred contact" value={customer.preferred_communication} />
                <DetailRow label="Preferred payment" value={customer.preferred_payment_method} />
                <DetailRow label="Referral source" value={customer.referral_source} />
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
                <DetailRow label="Customer code" value={customer.customer_code} />
                <DetailRow label="Type" value={customer.customer_type} />
                <DetailRow label="Currency" value={customer.currency_code} />
                <DetailRow label="Credit limit" value={customer.credit_limit != null ? money(customer.credit_limit) : undefined} />
                <DetailRow label="Payment terms" value={customer.payment_terms_days != null ? `Net ${customer.payment_terms_days}` : undefined} />
                <DetailRow label="Tax ID" value={customer.tax_id_number} />
                <DetailRow label="Tax exempt" value={customer.is_tax_exempt ? 'Yes' : 'No'} />
                <DetailRow label="Default discount" value={
                  customer.default_discount_value != null
                    ? customer.default_discount_type === 'percentage'
                      ? `${customer.default_discount_value}%`
                      : money(customer.default_discount_value)
                    : undefined
                } />
                <DetailRow label="Date of birth" value={customer.date_of_birth ? formatDate(customer.date_of_birth) : undefined} />
                <DetailRow label="Anniversary" value={customer.anniversary_date ? formatDate(customer.anniversary_date) : undefined} />
                <DetailRow label="Gender" value={customer.gender} />
                <DetailRow label="Nationality" value={customer.nationality} />
                {customer.id_number && (
                  <DetailRow label={`ID (${(customer.id_type || '').replace(/_/g, ' ')})`} value={customer.id_number} />
                )}
                <DetailRow label="Customer since" value={customer.created_at ? formatDate(customer.created_at) : undefined} />
              </div>
              {customer.notes && (
                <div className="mt-4">
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</h4>
                  <p className="text-sm text-foreground whitespace-pre-line">{customer.notes}</p>
                </div>
              )}
            </div>

            {/* Contacts */}
            <div className="p-5">
              <CustomerContactsPanel customerId={customer.id} />
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <MiniTable
            headers={['Document', 'Date', 'Payment', 'Status', 'Total']}
            empty="No sales recorded for this customer yet."
            rows={(view360?.sales ?? []).map((s) => [
              <span className="font-medium">{s.document_number || s.id.slice(0, 8)}</span>,
              formatDateTime(s.created_at),
              <StatusChip status={s.payment_status} />,
              <StatusChip status={s.status} />,
              money(s.total),
            ])}
          />
        )}

        {activeTab === 'returns' && (
          <MiniTable
            headers={['Return #', 'Date', 'Refund method', 'Status', 'Amount']}
            empty="No returns for this customer."
            rows={(view360?.returns ?? []).map((r) => [
              <span className="font-medium">{r.return_number}</span>,
              formatDate(r.return_date || r.created_at),
              r.refund_method || '—',
              <StatusChip status={r.status} />,
              money(r.total_return_amount),
            ])}
          />
        )}

        {activeTab === 'layaways' && (
          <MiniTable
            headers={['Plan', 'Started', 'Due', 'Paid', 'Status', 'Balance']}
            empty="No layaway plans for this customer."
            rows={(view360?.layaways ?? []).map((l) => [
              <span className="font-medium">{l.plan_no}</span>,
              formatDate(l.start_date || l.created_at),
              l.due_date ? formatDate(l.due_date) : '—',
              `${money(l.paid_amount)} / ${money(l.total_amount)}`,
              <StatusChip status={l.status} />,
              money((parseFloat(l.total_amount) || 0) - (parseFloat(l.paid_amount) || 0)),
            ])}
          />
        )}

        {activeTab === 'memos' && (
          <MiniTable
            headers={['Memo #', 'Issued', 'Due', 'Direction', 'Status', 'Value']}
            empty="No memo transactions for this customer."
            rows={(view360?.memos ?? []).map((m) => [
              <span className="font-medium">{m.memo_no}</span>,
              formatDate(m.issue_date || m.created_at),
              m.due_date ? formatDate(m.due_date) : '—',
              <span className="capitalize">{m.direction === 'out' ? 'Out to customer' : 'In from customer'}</span>,
              <StatusChip status={m.status} />,
              money(m.total_value),
            ])}
          />
        )}

        {activeTab === 'repairs' && (
          <MiniTable
            headers={['Ticket', 'Item', 'Promised', 'Paid', 'Status', 'Balance']}
            empty="No repair orders for this customer."
            rows={(view360?.repairs ?? []).map((r) => [
              <span className="font-medium">{r.ticket_no}</span>,
              <span className="max-w-[220px] truncate inline-block align-middle" title={r.item_description}>{r.item_description}</span>,
              r.promised_date ? formatDate(r.promised_date) : '—',
              money((parseFloat(r.advance_paid) || 0) + (parseFloat(r.balance_paid) || 0)),
              <StatusChip status={r.status} />,
              money((parseFloat(r.final_cost ?? r.estimated_cost) || 0) - (parseFloat(r.advance_paid) || 0) - (parseFloat(r.balance_paid) || 0)),
            ])}
          />
        )}

        {activeTab === 'old-gold' && (
          <MiniTable
            headers={['Voucher', 'Item', 'Metal', 'Status', 'Valuation']}
            empty="No old-gold purchases for this customer."
            rows={(view360?.old_gold ?? []).map((o) => [
              <span className="font-medium">{o.voucher_no}</span>,
              <span className="max-w-[220px] truncate inline-block align-middle" title={o.item_description}>{o.item_description || '—'}</span>,
              o.metal || '—',
              <StatusChip status={o.status} />,
              money(o.valuation_amount),
            ])}
          />
        )}

        {activeTab === 'savings' && (
          <MiniTable
            headers={['Enrollment', 'Started', 'Matures', 'Installments', 'Status', 'Paid']}
            empty="No savings scheme enrollments for this customer."
            rows={(view360?.savings ?? []).map((s) => [
              <span className="font-medium">{s.enrollment_no}</span>,
              formatDate(s.start_date || s.created_at),
              s.maturity_date ? formatDate(s.maturity_date) : '—',
              s.paid_installments ?? '—',
              <StatusChip status={s.status} />,
              money(s.total_paid),
            ])}
          />
        )}

        {activeTab === 'activity' && (
          <div className="p-5">
            <CustomerActivityPanel customerId={customer.id} />
          </div>
        )}
      </div>

      {/* Modals / drawers */}
      <CustomerFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveCustomer}
        customer={customer}
      />

      {isCrmOpen && (
        <CustomerCrmDrawer
          customerId={customer.id}
          customerName={fullName || 'Customer'}
          onClose={() => setIsCrmOpen(false)}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
        title="Delete customer?"
        description={`Are you sure you want to delete ${fullName}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteCustomer}
      />
    </div>
  );
};

export default CustomerDetailsPage;
