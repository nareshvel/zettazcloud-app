import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import PageHeader from '@/components/common/PageHeader';
import { useI18n } from '@/hooks/useI18n';
import { fetchPrintJobs, fetchPrintJobStatistics, retryPrintJob, cancelPrintJob, PrintJob } from '@/services/printService';
import { 
  RefreshCw, RotateCcw, Ban, Printer, FileText, Tag, Receipt, Loader2, AlertCircle, CheckCircle,
  Clock, XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { Button } from '@/components/ui/button';
import UniversalListControls from '@/components/UniversalListControls';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100',
  queued: 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100 animate-pulse',
  completed: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100',
  failed: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  receipt: <Receipt className="w-4 h-4" />,
  invoice: <FileText className="w-4 h-4" />,
  label: <Tag className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  test: <Printer className="w-4 h-4" />,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  queued: <Clock className="w-4 h-4" />,
  processing: <RefreshCw className="w-4 h-4 animate-spin" />,
  completed: <CheckCircle className="w-4 h-4" />,
  failed: <AlertCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

const ITEMS_PER_PAGE = 10;

const PrintJobHistory: React.FC = () => {
  const { t } = useI18n();
  const { toast } = useToast();
  const { store } = useStore();
  const { formatDate } = useDateFormatting();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [statistics, setStatistics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const [jobList, stats] = await Promise.all([
        fetchPrintJobs({ storeId: store?.id, limit: 100 }),
        fetchPrintJobStatistics(store?.id),
      ]);
      setJobs(jobList);
      setStatistics(stats);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load print jobs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (store?.id) {
      loadJobs();
    }
  }, [store?.id]);

  const handleRetry = async (jobId: string) => {
    try {
      await retryPrintJob(jobId);
      toast({ title: 'Success', description: 'Print job queued for retry' });
      loadJobs();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to retry print job', variant: 'destructive' });
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelPrintJob(jobId);
      toast({ title: 'Success', description: 'Print job cancelled' });
      loadJobs();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to cancel print job', variant: 'destructive' });
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = !searchTerm ||
        job.jobType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.documentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.printerName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, statusFilter]);

  const totalPages = useMemo(() => Math.ceil(filteredJobs.length / ITEMS_PER_PAGE), [filteredJobs]);

  const columns: ColumnDefinition<PrintJob>[] = useMemo(() => [
    {
      Header: 'Type',
      accessor: 'jobType',
      Cell: (job) => (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{TYPE_ICONS[job.jobType] || <FileText className="w-4 h-4" />}</span>
          <span className="capitalize">{job.jobType}</span>
        </div>
      ),
    },
    {
      Header: 'Document',
      accessor: 'documentType',
      Cell: (job) => <span className="capitalize">{job.documentType}</span>,
    },
    {
      Header: 'Printer',
      accessor: 'printerName',
      Cell: (job) => <span className="text-sm">{job.printerName || 'N/A'}</span>,
    },
    {
      Header: 'Created',
      accessor: 'createdAt',
      Cell: (job) => <span className="text-sm">{formatDate(job.createdAt)}</span>,
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: (job) => (
        <span className={`px-2 py-0.5 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full ${STATUS_STYLES[job.status] || STATUS_STYLES.pending}`}>
          {STATUS_ICONS[job.status]}
          {job.status}
        </span>
      ),
    },
    {
      Header: 'Retries',
      accessor: 'retryCount',
      Cell: (job) => <span className="text-sm">{job.retryCount} / {job.maxRetries}</span>,
      className: 'text-center',
    },
    {
      Header: 'Actions',
      accessor: 'id',
      headerClassName: 'text-right',
      className: 'text-right',
      Cell: (job) => (
        <div className="flex items-center justify-end gap-2">
          {job.status === 'failed' && (
            <Button variant="outline" size="sm" onClick={() => handleRetry(job.id)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          )}
          {['pending', 'queued', 'processing'].includes(job.status) && (
            <Button variant="outline" size="sm" onClick={() => handleCancel(job.id)}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          )}
        </div>
      ),
    },
  ], [formatDate, handleRetry, handleCancel]);

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Printer}
        title="Print Job History"
        subtitle="View and manage print jobs, retry failed prints, and monitor status"
      />

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: statistics.total || 0 },
          { label: 'Pending', value: statistics.pending || 0 },
          { label: 'Processing', value: statistics.processing || 0 },
          { label: 'Completed', value: statistics.completed || 0 },
          { label: 'Failed', value: statistics.failed || 0 },
          { label: 'Cancelled', value: statistics.cancelled || 0 },
        ].map((stat, index) => (
          <div key={index} className="rounded-xl border p-4 bg-card">
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <UniversalListControls
        searchTerm={searchTerm}
        onSearchChange={(value) => { setSearchTerm(value); setCurrentPage(1); }}
        placeholderText="Search by type, document, or printer..."
        filterOptions={[
          { value: '', label: 'All Statuses' },
          { value: 'pending', label: 'Pending' },
          { value: 'processing', label: 'Processing' },
          { value: 'completed', label: 'Completed' },
          { value: 'failed', label: 'Failed' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
        onFilterOptionSelect={(value) => { setStatusFilter(value as string); setCurrentPage(1); }}
        currentFilterValue={statusFilter}
        defaultFilterButtonText="Status"
        newButtonText="Refresh"
        onNewButtonClick={loadJobs}
        showExportButton={false}
      />

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading print jobs...
        </div>
      ) : (
        <ReusableTable
          columns={columns}
          data={filteredJobs}
          isLoading={loading}
          noDataMessage="No print jobs found."
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={ITEMS_PER_PAGE}
          totalItems={filteredJobs.length}
        />
      )}
    </div>
  );
};

export default PrintJobHistory;
