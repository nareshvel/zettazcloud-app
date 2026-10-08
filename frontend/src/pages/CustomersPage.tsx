import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Edit3,
  Users, UserX, CalendarPlus, Heart, UserCheck, Loader2, UserPlus
} from 'lucide-react';
import type { Customer, CreateCustomerPayload, NewCustomerData } from '@/types';
import { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } from '@/services/api';
import { toast } from 'sonner';
import CustomerFormModal from '@/components/customers/CustomerFormModal';
import UniversalListControls, { ExportFormat } from '@/components/UniversalListControls';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import PageHeader from '@/components/common/PageHeader';
import CustomerCrmDrawer from '@/components/crm/CustomerCrmDrawer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// Define the expected shape of the getCustomer API response based on runtime observation
interface GetCustomerApiResponse {
  customer: Customer;
} 

// Define a specific type for updates, which is a partial of the creation payload
type UpdateCustomerPayload = Partial<CreateCustomerPayload>;
// A type for the form data, can be used for both create and update
type CustomerFormData = NewCustomerData | UpdateCustomerPayload;

const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [crmCustomer, setCrmCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  
  // Search and Advanced Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState({ email: '', phone: '', type: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'new'>('all');

  // Pagination state (ReusableTable handles its own page input)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCustomers();
      if (response && Array.isArray(response.customers)) {
        setCustomers(response.customers);
      } else {
        setCustomers([]);
        console.warn('Customers data is not in the expected format or is missing:', response);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('Error fetching customers:', err);
      setError(errorMessage);
      toast.error(`Failed to fetch customers: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  // Deep-link: open the create form when launched from the bottom-nav
  // quick actions (?new=1). The param is stripped so a refresh won't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
      handleAddCustomer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleEditCustomer = useCallback(async (customer: Customer) => {
    try {
      // Assert to the specific GetCustomerApiResponse interface
      const response = (await getCustomer(customer.id)) as unknown as GetCustomerApiResponse;
      
      // The API actually returns data in the shape { customer: { ...actualCustomerData } }
      // We need to pass the actualCustomerData to the modal.
      // API may return { customer: {...} } or the customer object directly
      const customerData = (response as any).customer ?? response;
      if (customerData && customerData.id) {
        setSelectedCustomer(customerData as Customer);
      } else {
        console.error("DEBUGGING: API response did not contain expected customer data:", response);
        toast.error("Failed to load customer details: unexpected data format.");
        setSelectedCustomer(null);
        return;
      }
      setIsModalOpen(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load customer details.';
      console.error('Error fetching full customer details:', err);
      toast.error(errorMsg);
    }
  }, []);

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleSaveCustomer = async (customerData: CustomerFormData, isNew: boolean) => {
    try {
      if (isNew) {
        await createCustomer(customerData as NewCustomerData);
        toast.success('Customer added successfully!');
      } else {
        if (!selectedCustomer?.id) throw new Error('No customer selected for update.');
        await updateCustomer(selectedCustomer.id, customerData as UpdateCustomerPayload);
        toast.success('Customer updated successfully!');
      }
      fetchData(); 
      handleModalClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('Error saving customer:', err);
      toast.error(`Failed to save customer: ${errorMsg}`);
    }
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await deleteCustomer(customerToDelete.id);
      toast.success('Customer deleted successfully!');
      fetchData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('Error deleting customer:', err);
      toast.error(`Failed to delete customer: ${errorMsg}`);
    } finally {
      setCustomerToDelete(null);
    }
  };

  // Handler for UniversalListControls search input
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); 
  };

  // Handler for advanced filter panel inputs
  const handleAdvancedFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAdvancedFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1); 
  };



  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const nameMatch = `${customer.firstName} ${customer.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const emailMatch = advancedFilters.email ? customer.email?.toLowerCase().includes(advancedFilters.email.toLowerCase()) : true;
      const phoneMatch = advancedFilters.phone ? customer.phoneNumber?.includes(advancedFilters.phone) : true;
      const typeMatch = advancedFilters.type ? customer.customerType === advancedFilters.type : true;

      let statusMatch = true;
      if (statusFilter === 'active') statusMatch = customer.isActive === true;
      else if (statusFilter === 'inactive') statusMatch = customer.isActive === false;
      else if (statusFilter === 'new') {
        const customerDate = new Date(customer.createdAt);
        const today = new Date();
        statusMatch = customerDate.getFullYear() === today.getFullYear() && customerDate.getMonth() === today.getMonth();
      }

      return nameMatch && emailMatch && phoneMatch && typeMatch && statusMatch;
    });
  }, [customers, searchTerm, advancedFilters, statusFilter]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleExport = (format: ExportFormat) => {
    toast.info(`Exporting ${filteredCustomers.length} customers as ${format.toUpperCase()}...`);
    if (filteredCustomers.length === 0) {
      toast.warning('No data to export.');
      return;
    }
    if (format === 'csv') {
      const headers = ['FirstName', 'LastName', 'Email', 'Phone', 'Type', 'Status', 'CreatedAt'];
      const csvData = filteredCustomers.map(c => 
        [ c.firstName, c.lastName || '', c.email || '', c.phoneNumber || '', 
          c.customerType, c.isActive ? 'Active' : 'Inactive', new Date(c.createdAt).toISOString() ]
        .map(field => `"${String(field).replace(/"/g, '""')}"`) 
        .join(',')
      ).join('\n');
      const csvContent = `${headers.join(',')}\n${csvData}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', 'customers.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } else if (format === 'pdf') {
      if (filteredCustomers.length > 200) {
        toast.warning('PDF export is limited to 200 customers for performance reasons.');
        return;
      }
      // PDF export logic would go here
      toast.info('PDF export is not yet implemented.');
    }
  };

  // Metrics Calculations
  const totalCustomersCount = customers.length;
  const newCustomersThisMonthCount = useMemo(() => 
    customers.filter(c => {
      const customerDate = new Date(c.createdAt);
      const today = new Date();
      return customerDate.getFullYear() === today.getFullYear() && customerDate.getMonth() === today.getMonth();
    }).length
  , [customers]);
  const activeCustomersCount = useMemo(() => customers.filter(c => c.isActive).length, [customers]);
  const inactiveCustomersCount = useMemo(() => customers.filter(c => !c.isActive).length, [customers]);

  // Column definitions for ReusableTable
  const columns = useMemo((): ColumnDefinition<Customer>[] => [
    {
      Header: 'Code',
      accessor: 'customerCode',
      Cell: (customer) => (
        <span className="font-mono text-xs">{customer.customerCode || '—'}</span>
      ),
      headerClassName: 'w-24',
    },
    {
      Header: 'Name',
      accessor: 'firstName',
      Cell: (customer) => `${customer.firstName} ${customer.lastName || ''}`,
      headerClassName: 'w-1/4',
    },
    {
      Header: 'Email',
      accessor: 'email',
      Cell: (customer) => customer.email || 'N/A',
    },
    {
      Header: 'Phone',
      accessor: 'phoneNumber',
      Cell: (customer) => customer.phoneNumber || 'N/A',
    },
    {
      Header: 'Type',
      accessor: 'customerType',
    },
    {
      Header: 'Status',
      accessor: 'isActive',
      Cell: (customer) => (
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${customer.isActive ? 'bg-success-light text-success-dark' : 'bg-danger-light text-danger-dark'}`}>
          {customer.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
      headerClassName: 'text-center',
      className: 'text-center',
    },
    {
      Header: 'Actions',
      accessor: 'id', 
      Cell: (customer) => (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleEditCustomer(customer); }}
            className="text-primary hover:text-primary-hover p-1 rounded-md hover:bg-primary/10 transition-colors"
            title="Edit customer"
            aria-label={`Edit ${customer.firstName}`}
          >
            <Edit3 size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCrmCustomer(customer); }}
            className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 transition-colors"
            aria-label={`CRM for ${customer.firstName}`}
            title="Wishlist & reminders"
          >
            <Heart size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer); }}
            className="text-danger hover:text-danger-hover p-1 rounded-md hover:bg-danger/10 transition-colors"
            title="Delete customer"
            aria-label={`Delete ${customer.firstName}`}
          >
            <UserX size={18} />
          </button>
        </div>
      ),
      headerClassName: 'text-center',
      className: 'text-center',
    },
  ], [handleEditCustomer, handleDeleteCustomer]);

  const kpiItems = [
    { key: 'all', label: 'Total Customers', value: totalCustomersCount, icon: Users, color: 'text-blue-600' },
    { key: 'new', label: 'New This Month', value: newCustomersThisMonthCount, icon: CalendarPlus, color: 'text-purple-600' },
    { key: 'active', label: 'Active Customers', value: activeCustomersCount, icon: UserCheck, color: 'text-green-600' },
    { key: 'inactive', label: 'Inactive Customers', value: inactiveCustomersCount, icon: UserX, color: 'text-red-600' },
  ] as const;

  const anyAdvancedFilterApplied = advancedFilters.email || advancedFilters.phone || advancedFilters.type;

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Users}
        title="Customers"
        subtitle="Manage your customer database, view activity, and keep contact details up to date."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiItems.map((item) => {
          const Icon = item.icon;
          const active = statusFilter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setStatusFilter(active ? 'all' : item.key as typeof statusFilter)}
              className={`flex items-center gap-3 rounded-xl border border-r-4 p-3.5 text-left transition-all ${
                active
                  ? 'border-primary border-r-primary bg-primary/5 shadow-sm'
                  : 'border-border border-r-primary/40 bg-card hover:border-primary/40'
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

      <UniversalListControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        placeholderText="Search by name..."
        onExportClick={handleExport}
        newButtonText="New"
        newButtonIcon={<UserPlus size={18} className="sm:mr-2" />}
        onNewButtonClick={handleAddCustomer}
        showFilterButton={false}
        showExportButton={true}
        showNewButton={true}
        currentPage="customers"
        exportOptions={['csv']}
        showFilterPanelButton={true}
        onFilterPanelButtonClick={() => setShowAdvancedFilters(prev => !prev)}
        filterPanelButtonText="Filters"
        filterPanelActive={showAdvancedFilters || Boolean(anyAdvancedFilterApplied)}
      />

      {/* Advanced Filter Panel */}
      {showAdvancedFilters && (
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Advanced Filters</h3>
            {anyAdvancedFilterApplied && (
              <button
                onClick={() => setAdvancedFilters({ email: '', phone: '', type: '' })}
                className="text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" name="email" placeholder="Filter by email" value={advancedFilters.email} onChange={handleAdvancedFilterChange} className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm" />
            <input type="text" name="phone" placeholder="Filter by phone" value={advancedFilters.phone} onChange={handleAdvancedFilterChange} className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm" />
            <select name="type" value={advancedFilters.type} onChange={handleAdvancedFilterChange} className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm">
              <option value="">All Types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Business</option>
            </select>
          </div>
        </div>
      )}

      {error && <p className="text-center py-10 text-danger-text">Error: {error}</p>}
      {!error && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 px-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No customers found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <ReusableTable<Customer>
              columns={columns}
              data={filteredCustomers}
              isLoading={false}
              onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
              noDataMessage="No customers found. Try adjusting your filters or search term."
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={itemsPerPage}
              totalItems={filteredCustomers.length}
              onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
            />
          )}
        </div>
      )}

      {isModalOpen && (
        <CustomerFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleSaveCustomer}
          customer={selectedCustomer}
        />
      )}

      {crmCustomer && (
        <CustomerCrmDrawer
          customerId={crmCustomer.id}
          customerName={[crmCustomer.firstName, crmCustomer.lastName].filter(Boolean).join(' ') || 'Customer'}
          onClose={() => setCrmCustomer(null)}
        />
      )}

      <ConfirmDialog
        open={!!customerToDelete}
        onOpenChange={(open) => { if (!open) setCustomerToDelete(null); }}
        title="Delete customer?"
        description={customerToDelete ? `Are you sure you want to delete ${customerToDelete.firstName} ${customerToDelete.lastName || ''}? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteCustomer}
      />
    </div>
  );
}

export default CustomersPage;
