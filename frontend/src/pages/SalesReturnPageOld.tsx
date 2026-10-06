import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import { salesReturnService, SalesReturn, SalesReturnStats } from '../services/salesReturnService';
import ReturnProcessingModal from '../components/returns/ReturnProcessingModal';
import ReturnDetailsModal from '../components/returns/ReturnDetailsModal';
import type { ColumnDefinition } from '@/components/ReusableTable';
import ReusableTable from '@/components/ReusableTable';
import UniversalListControls from '@/components/UniversalListControls';
import MetricCard from '@/components/MetricCard';
import { CheckCircle, XCircle, Eye, MoreVertical, Printer, Trash2, DollarSign, RotateCcw, Plus } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import PrintPreviewModal from '@/components/PrintPreviewModal';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

const SalesReturnPage: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useDateFormatting();
  
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<SalesReturn[]>([]);
  const [stats, setStats] = useState<SalesReturnStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);
  
  // Print modal states
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printContent, setPrintContent] = useState('');
  const [printTitle, setPrintTitle] = useState('');
  
  // Delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<SalesReturn | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load returns and stats
  const loadReturns = async () => {
    try {
      setLoading(true);
      const response = await salesReturnService.getAllReturns(filters);
      setReturns(response.data || []);
      setPagination(response.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (error) {
      console.error('Error loading returns:', error);
      toast.error('Failed to load sales returns');
      setReturns([]); // Ensure returns is always an array
      setPagination({ page: 1, limit: 20, total: 0, pages: 0 });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await salesReturnService.getReturnStats(30);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    loadReturns();
    loadStats();
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<SalesReturnFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // Handle return actions
  const handleCompleteReturn = async (returnId: string) => {
    try {
      await salesReturnService.completeReturn(returnId);
      toast.success('Return completed successfully');
      loadReturns();
      loadStats();
    } catch (error) {
      console.error('Error completing return:', error);
      toast.error('Failed to complete return');
    }
  };

  const handleCancelReturn = async (returnId: string) => {
    try {
      await salesReturnService.cancelReturn(returnId);
      toast.success('Return cancelled successfully');
      loadReturns();
      loadStats();
    } catch (error) {
      console.error('Error cancelling return:', error);
      toast.error('Failed to cancel return');
    }
  };

  const handleViewReturn = (returnData: SalesReturn) => {
    setSelectedReturn(returnData);
    setShowDetailsModal(true);
  };

  // Table columns configuration
  const columns = [
    {
      key: 'return_number',
      label: 'Return #',
      sortable: true,
      render: (value: string, row: SalesReturn) => (
        <div className="font-medium text-primary">
          {value}
        </div>
      )
    },
    {
      key: 'return_date',
      label: 'Return Date',
      sortable: true,
      render: (value: string) => formatDate(value)
    },
    {
      key: 'original_receipt_number',
      label: 'Original Receipt',
      render: (value: string) => (
        <span className="text-text-secondary">{value || 'N/A'}</span>
      )
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (value: string) => value || 'Walk-in Customer'
    },
    {
      key: 'return_reason',
      label: 'Reason',
      render: (value: string) => (
        <span className="capitalize text-sm">
          {value.replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'total_return_amount',
      label: 'Amount',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">
          {formatCurrency(value)}
        </span>
      )
    },
    {
      key: 'refund_method',
      label: 'Refund Method',
      render: (value: string) => (
        <span className="capitalize text-sm">
          {value.replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        const statusConfig = {
          pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
          completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
          cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' }
        };
        const config = statusConfig[value as keyof typeof statusConfig];
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: SalesReturn) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewReturn(row)}
            className="p-1 text-text-secondary hover:text-primary transition-colors"
            title="View Details"
          >
            <Eye size={16} />
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={() => handleCompleteReturn(row.id)}
                className="p-1 text-green-600 hover:text-green-700 transition-colors"
                title="Complete Return"
              >
                <CheckCircle size={16} />
              </button>
              <button
                onClick={() => handleCancelReturn(row.id)}
                className="p-1 text-red-600 hover:text-red-700 transition-colors"
                title="Cancel Return"
              >
                <XCircle size={16} />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  // Filter options
  const filterOptions = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { value: '', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' }
      ]
    },
    {
      key: 'return_reason',
      label: 'Return Reason',
      type: 'select' as const,
      options: [
        { value: '', label: 'All Reasons' },
        { value: 'defective', label: 'Defective' },
        { value: 'wrong_item', label: 'Wrong Item' },
        { value: 'customer_change_mind', label: 'Customer Changed Mind' },
        { value: 'damaged', label: 'Damaged' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      key: 'start_date',
      label: 'Start Date',
      type: 'date' as const
    },
    {
      key: 'end_date',
      label: 'End Date',
      type: 'date' as const
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Sales Returns</h1>
          <p className="text-text-secondary mt-1">
            Manage product returns and refunds
          </p>
        </div>
        <button
          onClick={() => setShowProcessingModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Plus size={20} />
          Process Return
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Returns"
            value={stats.total_returns.toString()}
            icon={RefreshCcw}
            footerText="Last 30 days"
          />
          <MetricCard
            title="Completed Returns"
            value={stats.completed_returns.toString()}
            icon={CheckCircle}
            footerText="Last 30 days"
          />
          <MetricCard
            title="Total Refunded"
            value={formatCurrency(stats.total_refund_amount)}
            icon={RefreshCcw}
            footerText="Last 30 days"
          />
          <MetricCard
            title="Avg Return Amount"
            value={formatCurrency(stats.avg_return_amount || 0)}
            icon={RefreshCcw}
            footerText="Last 30 days"
          />
        </div>
      )}

      {/* Controls and Table */}
      <div className="bg-background-card rounded-lg shadow-sm">
        <UniversalListControls
          searchPlaceholder="Search returns..."
          onSearch={(search) => handleFilterChange({ search })}
          onRefresh={loadReturns}
          filterOptions={filterOptions}
          onFilterChange={handleFilterChange}
          currentFilters={filters}
        />

        <ReusableTable
          data={returns}
          columns={columns}
          isLoading={loading}
          currentPage={pagination?.page || 1}
          totalPages={pagination?.pages || 0}
          onPageChange={handlePageChange}
          itemsPerPage={pagination?.limit || 20}
          totalItems={pagination?.total || 0}
          noDataMessage="No sales returns found"
        />
      </div>

      {/* Modals */}
      {showProcessingModal && (
        <ReturnProcessingModal
          isOpen={showProcessingModal}
          onClose={() => setShowProcessingModal(false)}
          onSuccess={() => {
            setShowProcessingModal(false);
            loadReturns();
            loadStats();
          }}
        />
      )}

      {showDetailsModal && selectedReturn && (
        <ReturnDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedReturn(null);
          }}
          returnData={selectedReturn}
          onComplete={() => {
            handleCompleteReturn(selectedReturn.id);
            setShowDetailsModal(false);
            setSelectedReturn(null);
          }}
          onCancel={() => {
            handleCancelReturn(selectedReturn.id);
            setShowDetailsModal(false);
            setSelectedReturn(null);
          }}
        />
      )}
    </div>
  );
};

export default SalesReturnPage;
