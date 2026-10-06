import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { salesReturnService, SalesReturn, SalesReturnStats } from '../services/salesReturnService';
import useReturnReceipt from '@/hooks/useReturnReceipt';
import ReturnProcessingModal from '../components/returns/ReturnProcessingModal';
import { CheckCircle, XCircle, Eye, Printer, DollarSign, RotateCcw, Plus, Loader2, Search, Clock } from 'lucide-react';
import { toast } from 'sonner';
import ReceiptModal from '@/components/Receipt/ReceiptModal';
// removed unused useStore

const PAGE_SIZE = 20;

const SalesReturnPage: React.FC = () => {
  const { formatCurrency, formatDate } = useLocaleFormat();
  // no store reference needed here
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as { quickAction?: boolean; fromSalesHub?: boolean; presetQuery?: string; presetRecordId?: string } | null;
  const fromSalesHub = !!navState?.fromSalesHub;
  const quickActionHandled = useRef(false);

  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [searchInput, setSearchInput] = useState(''); // what the user is typing
  const [searchTerm, setSearchTerm] = useState('');    // debounced value actually queried
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<SalesReturnStats | null>(null);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const {
    isReceiptModalOpen,
    receiptContent,
    showReceiptForReturn,
    closeReceiptModal,
    autoPrint,
    printerSettings,
  } = useReturnReceipt();

  // Debounce the search box so we're not hitting the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change resets back to page 1 — otherwise you can land on a
  // now-nonexistent page (e.g. narrowing search from 5 pages to 1).
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  // Load returns data — server-side search/status/pagination, not a client-
  // side filter over the full table. That client-side approach only ever
  // "worked" because the whole list was small; it's the wrong shape once a
  // store has hundreds or thousands of returns, and it also meant search
  // could only match fields already sitting in memory (return number/reason)
  // rather than anything the backend could actually look up, like customer
  // name/email/phone (now joined server-side — see salesReturnController.js).
  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await salesReturnService.getAllReturns({
        page,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setReturns(response.data || []);
      setTotalPages(response.pagination?.pages || 1);
      setTotalCount(response.pagination?.total || (response.data || []).length);
    } catch (error) {
      console.error('Error loading returns:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load sales returns: ' + errorMessage);
      setReturns([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, searchTerm]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const statsData = await salesReturnService.getReturnStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // The list is now already filtered/paginated server-side; this is just
  // the current page's rows.
  const filteredReturns = returns;

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Arriving from the Sales Hub's "Sales Return" tile means the cashier
  // wants to find a sale and process a return right away, not land on a
  // passive list — auto-open the processing modal once on mount.
  useEffect(() => {
    if (navState?.quickAction && !quickActionHandled.current) {
      quickActionHandled.current = true;
      setShowProcessingModal(true);
    }
  }, [navState]);

  const handleNewReturn = () => {
    setShowProcessingModal(true);
  };

  const handleModalClose = () => {
    setShowProcessingModal(false);
    if (fromSalesHub) navigate('/sales-hub');
  };

  const handleModalSuccess = async (createdId?: string) => {
    setShowProcessingModal(false);
    await loadReturns();
    await loadStats();
    if (createdId) {
      try {
        const full = await salesReturnService.getReturnById(createdId);
        if (!full || !full.id) throw new Error('Invalid return payload');
        await showReceiptForReturn(full);
      } catch (e) {
        // Non-blocking
      }
    }
    if (fromSalesHub) navigate('/sales-hub');
  };

  const handleViewReturn = async (returnData: SalesReturn) => {
    try {
      const full = await salesReturnService.getReturnById(returnData.id);
      if (!full || !full.id) throw new Error('Invalid return payload');
      await showReceiptForReturn(full, { previewOnly: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load sales return: ' + msg);
    }
  };

  const handlePrintReturn = async (returnData: SalesReturn) => {
    try {
      const full = await salesReturnService.getReturnById(returnData.id);
      if (!full || !full.id) throw new Error('Invalid return payload');
      await showReceiptForReturn(full);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to print receipt: ' + msg);
    }
  };

  // delete/cancel handler will be added when backend supports it

  // Printing is handled by useReturnReceipt; no openReturnReceipt needed

  // Brand navy for everything decorative (header, buttons, active states).
  // Status colors below are semantic, not decorative — green/amber/red
  // communicate pending/completed/cancelled at a glance, same convention
  // this app already uses in Cart.tsx totals and elsewhere; flattening them
  // to navy would remove a real, useful signal, not just "add another color."
  const kpiItems = [
    { key: '' as string, label: 'All Returns', value: stats?.totalReturns || 0, icon: RotateCcw, color: 'text-primary' },
    { key: 'completed' as const, label: 'Completed', value: stats?.completedReturns || 0, icon: CheckCircle, color: 'text-emerald-600' },
    { key: 'pending' as const, label: 'Pending', value: stats?.pendingReturns || 0, icon: Clock, color: 'text-amber-600' },
    { key: 'cancelled' as const, label: 'Cancelled', value: (stats?.totalReturns || 0) - (stats?.completedReturns || 0) - (stats?.pendingReturns || 0), icon: XCircle, color: 'text-rose-600' },
  ] as const;

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; icon: typeof CheckCircle; cls: string }> = {
      completed: { label: 'Completed', icon: CheckCircle, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
      pending: { label: 'Pending', icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header — glass hero, brand navy (not a per-page accent color). */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shadow-sm shrink-0">
            <RotateCcw className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight">Sales Returns</h1>
            <p className="text-sm text-muted-foreground">Process a return or exchange.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fromSalesHub && (
            <Button
              variant="outline"
              onClick={() => navigate('/sales-hub')}
              className="rounded-full border-primary/30 text-primary hover:bg-primary/5"
            >
              Back to Hub
            </Button>
          )}
          <Button
            onClick={handleNewReturn}
            className="rounded-full gap-1.5 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0 shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Return
          </Button>
        </div>
      </div>

      {/* KPI strip — glass cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiItems.map((item) => {
          const Icon = item.icon;
          const active = statusFilter === item.key;
          return (
            <button
              key={item.label}
              onClick={() => setStatusFilter(active ? '' : item.key)}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all backdrop-blur-md ${
                active
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-white/40 bg-card/70 hover:border-primary/40 hover:shadow-md'
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

      {/* Search — glass pill, no separate export button (backend doesn't
          support export for this list yet, and it's a rarely-needed action
          for a counter transaction screen). Now matches customer name/
          email/phone too, not just return number/reason — see
          salesReturnController.js's getAllReturns for the join that makes
          this possible. */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by return #, customer name, email, or phone…"
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-white/40 bg-card/70 backdrop-blur-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Returns list — glass cards, not a table, so this holds up on a
          counter tablet without horizontal scrolling. */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading returns…
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <RotateCcw className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No sales returns found.</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredReturns.map((returnItem) => (
            <div
              key={returnItem.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="min-w-[7rem]">
                <p className="text-xs text-muted-foreground">Return #</p>
                <p className="font-semibold text-sm text-foreground">{returnItem.returnNumber || '-'}</p>
              </div>
              <div className="min-w-[7rem]">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm text-foreground">{returnItem.returnDate ? formatDate(returnItem.returnDate) : '-'}</p>
              </div>
              <div className="min-w-[9rem] flex-1">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="text-sm text-foreground truncate">{returnItem.customerName || 'Walk-in Customer'}</p>
              </div>
              <div className="min-w-[6rem]">
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="font-semibold text-sm text-foreground">{formatCurrency(returnItem.totalReturnAmount || 0)}</p>
              </div>
              <div className="min-w-[7rem]">{statusBadge(returnItem.status)}</div>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                  onClick={() => handleViewReturn(returnItem)}
                  title="View Details"
                  aria-label="View Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                  onClick={() => handlePrintReturn(returnItem)}
                  title="Print Receipt"
                  aria-label="Print Receipt"
                >
                  <Printer className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination — server-side, so this stays fast and usable however
          many returns a store accumulates over time, instead of the old
          approach of loading every return ever made into the browser at
          once and filtering client-side. */}
      {!isLoading && totalCount > 0 && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {totalCount} return{totalCount === 1 ? '' : 's'} · page {page} of {totalPages}
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

      {/* Modals */}
      {showProcessingModal && (
        <ReturnProcessingModal
          isOpen={showProcessingModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          presetQuery={navState?.quickAction ? navState?.presetQuery : undefined}
          presetRecordId={navState?.quickAction ? navState?.presetRecordId : undefined}
        />
      )}
      {isReceiptModalOpen && receiptContent && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={closeReceiptModal}
          receiptContent={{ html: receiptContent.html, css: receiptContent.css }}
          autoPrint={autoPrint}
          printerSettings={printerSettings || undefined}
          title="Return Receipt"
        />
      )}
    </div>
  );
};

export default SalesReturnPage;
