import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Clock,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Plus,
  Loader2,
  Search,
  Eye,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useStore } from '@/contexts/StoreContext';
import { ordersService, SalesOrder, SalesOrderStats } from '@/services/ordersService';
import { renderOrderWithTemplate } from '@/services/templateReceiptService';
import NewSalesOrderModal from '@/components/orders/NewSalesOrderModal';

const PAGE_SIZE = 20;

// location.state shape used to launch this page straight into the
// "New Sales Order" quick-action, matching the fromSalesHub precedent set by
// POSScreen.tsx / DutyFreeIntakeModal.tsx. `fromSalesHub: true` alone (no
// quickAction) would land on the full list with a "back to Hub" affordance;
// today the Sales Hub tile always sends both together.
interface OrdersPageLocationState {
  quickAction?: boolean;
  fromSalesHub?: boolean;
}

const OrdersPage: React.FC = () => {
  const { formatCurrency, formatDate } = useLocaleFormat();
  const { store } = useStore();

  // OrdersPage has never had a print path before this template — there is no
  // legacy document to fall back to, so a store with no published
  // order_acknowledgement template gets a clear message instead of a silent
  // no-op or a half-built fallback slip.
  const handlePrintOrder = useCallback(async (order: SalesOrder) => {
    try {
      const rendered = await renderOrderWithTemplate(order, {
        storeId: store?.id,
        logoUrl: store?.logoUrl,
        context: {
          store: {
            name: store?.name, address: store?.address, phone: store?.phone,
            email: store?.email, taxId: store?.taxId, currencyCode: store?.currencyCode,
          },
          formatDate,
        },
      });
      if (!rendered) {
        toast.info('No order acknowledgement template is published for this store yet. Set one up in Print Templates.');
        return;
      }
      const win = window.open('', '_blank', 'width=900,height=700');
      if (win) {
        win.document.write(rendered.html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
      }
    } catch {
      toast.error('Could not print the order acknowledgement.');
    }
  }, [store, formatDate]);
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as OrdersPageLocationState | null) || null;
  const fromSalesHub = Boolean(state?.fromSalesHub);

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<SalesOrderStats | null>(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(Boolean(state?.quickAction));

  // Debounce the search box — same 350ms pattern as SalesReturnPage.tsx.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await ordersService.getAllOrders({
        page,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setOrders(response.data || []);
      setTotalPages(response.pagination?.pages || 1);
      setTotalCount(response.pagination?.total || (response.data || []).length);
    } catch (error) {
      console.error('Error loading sales orders:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load sales orders: ' + msg);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, searchTerm]);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await ordersService.getOrderStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading sales order stats:', error);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleNewOrder = () => setShowNewOrderModal(true);

  // Mirrors RepairsPage.tsx's closeNew(): a quick-action launched from the
  // Sales Hub should always land the cashier back on the Hub when this modal
  // closes — on Cancel just as much as on a successful save — not strand
  // them on the full admin Orders list. Both handleModalSuccess and the
  // modal's own Cancel button route through this single function so neither
  // path can drift out of sync with the other again.
  const handleModalClose = () => {
    setShowNewOrderModal(false);
    if (fromSalesHub) navigate('/sales-hub');
  };

  const handleModalSuccess = async () => {
    await loadOrders();
    await loadStats();
    handleModalClose();
  };

  // Semantic status colors — same confirmed exception as SalesReturnPage.tsx:
  // green=fulfilled/delivered, amber=pending/processing, red=cancelled. Every
  // other decorative color on this page is navy (primary).
  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; icon: typeof CheckCircle; cls: string }> = {
      pending: { label: 'Pending', icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
      processing: { label: 'Processing', icon: Package, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
      shipped: { label: 'Shipped', icon: Truck, cls: 'bg-primary/10 text-primary dark:bg-primary/20' },
      delivered: { label: 'Delivered', icon: CheckCircle, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
      cancelled: { label: 'Cancelled', icon: XCircle, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400' },
    };
    const meta = map[status] || map.pending;
    const Icon = meta.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
        <Icon className="h-3 w-3" /> {meta.label}
      </span>
    );
  };

  const kpiItems = [
    { key: '', label: 'All Orders', value: stats?.totalOrders || 0, icon: ShoppingCart, color: 'text-primary' },
    { key: 'pending', label: 'Pending', value: stats?.pendingOrders || 0, icon: Clock, color: 'text-amber-600' },
    { key: 'processing', label: 'Processing', value: stats?.processingOrders || 0, icon: Package, color: 'text-amber-600' },
    { key: 'shipped', label: 'Shipped', value: stats?.shippedOrders || 0, icon: Truck, color: 'text-primary' },
    { key: 'delivered', label: 'Delivered', value: stats?.deliveredOrders || 0, icon: CheckCircle, color: 'text-emerald-600' },
    { key: 'cancelled', label: 'Cancelled', value: stats?.cancelledOrders || 0, icon: XCircle, color: 'text-rose-600' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header — glass hero, brand navy, matching SalesReturnPage.tsx. `flex-nowrap` +
          `min-w-0`/`truncate` on the title block (instead of `flex-wrap` on the outer
          row) keeps the New Order button on the same row as the title on mobile — this
          page's subtitle is long enough that `flex-wrap` was dropping the button to its
          own row below, unlike SalesReturnPage's shorter subtitle which never triggered
          the wrap. */}
      <div className="flex flex-nowrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shadow-sm shrink-0">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight">Sales Orders</h1>
            <p className="text-sm text-muted-foreground truncate">Track and manage customer orders from creation to delivery.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {fromSalesHub && (
            <Button variant="outline" onClick={() => navigate('/sales-hub')} className="rounded-full">
              Back to Hub
            </Button>
          )}
          <Button
            onClick={handleNewOrder}
            className="rounded-full gap-1.5 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0 shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Order
          </Button>
        </div>
      </div>

      {/* KPI strip — glass cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiItems.map((item) => {
          const Icon = item.icon;
          const active = statusFilter === item.key;
          return (
            <button
              key={item.key || 'all'}
              onClick={() => setStatusFilter(active ? '' : item.key)}
              className={`flex items-center gap-3 rounded-2xl border border-r-4 p-3.5 text-left transition-all backdrop-blur-md ${
                active
                  ? 'border-primary border-r-primary bg-primary/10 shadow-sm'
                  : 'border-white/40 border-r-primary/40 bg-card/70 hover:border-primary/40 hover:shadow-md'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search — glass pill, server-side */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by order #, customer name, email, or phone…"
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/40 bg-card/70 backdrop-blur-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Orders list — glass cards, not a table */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No sales orders found.</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters, or create a new order.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="min-w-[7rem]">
                <p className="text-xs text-muted-foreground">Order #</p>
                <p className="font-semibold text-sm text-foreground">{order.orderNumber || '-'}</p>
              </div>
              <div className="min-w-[7rem]">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm text-foreground">{order.createdAt ? formatDate(order.createdAt) : '-'}</p>
              </div>
              <div className="min-w-[9rem] flex-1">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="text-sm text-foreground truncate">{order.customerName || 'Walk-in Customer'}</p>
              </div>
              <div className="min-w-[6rem]">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold text-sm text-foreground">{formatCurrency(order.total || 0)}</p>
              </div>
              <div className="min-w-[7rem]">{statusBadge(order.status)}</div>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                  onClick={() => toast.info(`Order detail view for ${order.orderNumber} is coming soon.`)}
                  title="View Details"
                  aria-label="View Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                  onClick={() => { void handlePrintOrder(order); }}
                  title="Print Acknowledgement"
                  aria-label="Print Acknowledgement"
                >
                  <Printer className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination — server-side */}
      {!isLoading && totalCount > 0 && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {totalCount} order{totalCount === 1 ? '' : 's'} · page {page} of {totalPages}
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

      {showNewOrderModal && (
        <NewSalesOrderModal
          isOpen={showNewOrderModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default OrdersPage;
