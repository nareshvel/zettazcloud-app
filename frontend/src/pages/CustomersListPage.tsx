import React, { useState, useEffect, useMemo } from 'react';
import { Edit, Trash2, Users, TrendingUp, CreditCard, CheckCircle, AlertTriangle } from 'lucide-react'; 
import { toast } from 'react-toastify';
import axiosInstance from '@/services/axiosConfig'; 
import type { Customer } from '@/types';
import CustomerFormModal, { CustomerFormModalProps } from '@/components/customers/CustomerFormModal';
import CustomerFilterModal, { CustomerFilters, CustomerFilterModalProps } from '@/components/customers/CustomerFilterModal';
import UniversalListControls, { ExportFormat, UniversalListControlsProps } from '@/components/UniversalListControls';
import ReusableTable, { ColumnDefinition, ReusableTableProps } from '@/components/ReusableTable';
import MetricCard from '@/components/MetricCard';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRefresh } from '@/contexts/RefreshContext';
import { useCurrency } from '@/contexts/LocalizationContext';
import ConfirmationModal from '@/components/modals/ConfirmationModal'; // Added import

const CustomersListPage: React.FC = () => {
  const { refreshKey, triggerRefresh } = useRefresh() ?? { refreshKey: 0, triggerRefresh: () => fetchCustomers() }; 
  const { formatCurrency, currencySymbol } = useCurrency();
  
  // We have direct access to currencySymbol from useCurrency hook

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<CustomerFilters>({
    customerTypes: [],
    creditStatus: 'all',
    activeStatus: 'all',
    creditRange: {
      min: '', 
      max: ''  
    },
    hasCompany: 'all'
  });
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [uniqueCustomerTypes, setUniqueCustomerTypes] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); 

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false); // Added state for delete confirm modal
  const [customerToDeleteId, setCustomerToDeleteId] = useState<string | null>(null); // Added state for customer ID to delete
  const [isDeleting, setIsDeleting] = useState(false); // Added state for delete loading

  const parseCurrency = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined || String(value).trim() === '') return 0;
    const num = parseFloat(String(value).replace(/[^0-9.-]+/g,"")); 
    return isNaN(num) ? 0 : num;
  };

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/customers');
      if (response.data?.status === 'success' && response.data?.data?.customers) {
        const customersData = response.data.data.customers;
        
        const normalizedCustomers: Customer[] = customersData.map((customer: any): Customer => {
          const parsedCreditLimit = parseCurrency(customer.creditLimit ?? customer.credit_limit);
          const parsedOutstandingCredit = parseCurrency(customer.outstandingCredit ?? customer.outstanding_credit);
          const parsedTotalSalesValue = parseCurrency(customer.totalSalesValue ?? customer.total_sales_value);

          return {
            id: customer.id,
            tenantId: customer.tenantId ?? customer.tenant_id,
            storeId: customer.storeId ?? customer.store_id,
            firstName: customer.firstName ?? customer.first_name ?? '',
            lastName: customer.lastName ?? customer.last_name,
            email: customer.email,
            phoneNumber: customer.phoneNumber ?? customer.phone_number,
            notes: customer.notes,
            customerType: customer.customerType ?? customer.customer_type ?? 'retail',
            creditLimit: parsedCreditLimit,
            outstandingCredit: parsedOutstandingCredit,
            totalSalesValue: parsedTotalSalesValue,
            isActive: typeof customer.isActive === 'boolean' ? customer.isActive : (customer.is_active === 1 || String(customer.is_active).toLowerCase() === 'true'),
            companyName: customer.companyName ?? customer.company_name,
            createdAt: customer.createdAt ?? customer.created_at ?? new Date().toISOString(),
            updatedAt: customer.updatedAt ?? customer.updated_at ?? new Date().toISOString(),
            createdByUserId: customer.createdByUserId ?? customer.created_by_user_id ?? 'system',
            updatedByUserId: customer.updatedByUserId ?? customer.updated_by_user_id ?? 'system',
          };
        });
        setCustomers(normalizedCustomers);
        setFilteredCustomers(normalizedCustomers); 

        const types = Array.from(new Set(normalizedCustomers.map((c: Customer) => c.customerType).filter(Boolean) as string[]));
        setUniqueCustomerTypes(types);

      } else {
        toast.error(response.data?.message || 'Failed to fetch customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('An error occurred while fetching customers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [refreshKey]);

  useEffect(() => {
    let result = customers;
    if (searchTerm) {
      result = result.filter(customer =>
        `${customer.firstName} ${customer.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phoneNumber?.includes(searchTerm)
      );
    }

    if (activeFilters.customerTypes.length > 0) {
      result = result.filter(customer => activeFilters.customerTypes.includes(customer.customerType));
    }
    if (activeFilters.creditStatus !== 'all') {
      result = result.filter(customer => {
        const outstanding = parseCurrency(customer.outstandingCredit);
        return activeFilters.creditStatus === 'has_credit' ? outstanding > 0 : outstanding === 0;
      });
    }
    if (activeFilters.activeStatus !== 'all') {
      result = result.filter(customer => customer.isActive === (activeFilters.activeStatus === 'active'));
    }
    if (activeFilters.creditRange.min !== '' || activeFilters.creditRange.max !== '') {
      result = result.filter(customer => {
        const limit = parseCurrency(customer.creditLimit);
        const minVal = activeFilters.creditRange.min !== '' ? parseFloat(String(activeFilters.creditRange.min)) : -Infinity;
        const maxVal = activeFilters.creditRange.max !== '' ? parseFloat(String(activeFilters.creditRange.max)) : Infinity;
        return limit >= minVal && limit <= maxVal;
      });
    }
    if (activeFilters.hasCompany !== 'all') {
      result = result.filter(customer => {
        const hasComp = !!customer.companyName;
        return activeFilters.hasCompany === 'yes' ? hasComp : !hasComp;
      });
    }
    
    setFilteredCustomers(result);
    setHasActiveFilters(
      activeFilters.customerTypes.length > 0 ||
      activeFilters.creditStatus !== 'all' ||
      activeFilters.activeStatus !== 'all' ||
      activeFilters.creditRange.min !== '' ||
      activeFilters.creditRange.max !== '' ||
      activeFilters.hasCompany !== 'all'
    );
    setCurrentPage(1); 
  }, [searchTerm, customers, activeFilters]);

  const handleDelete = (customerId: string) => {
    setCustomerToDeleteId(customerId); // Set customer ID to delete
    setIsDeleteConfirmOpen(true);      // Open confirmation modal
  };

  const executeDelete = async () => {
    if (!customerToDeleteId) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/api/customers/${customerToDeleteId}`);
      toast.success('Customer deleted successfully');
      triggerRefresh();
    } catch (err) {
      toast.error('Failed to delete customer. Please try again.');
      console.error('Delete error:', err);
    } finally {
      setIsDeleteConfirmOpen(false);
      setCustomerToDeleteId(null);
      setIsDeleting(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsAddModalOpen(true);
  };

  const columns = useMemo<ColumnDefinition<Customer>[]>(() => [
    {
      Header: 'Code',
      accessor: 'customerCode',
      Cell: (customer: Customer) => (
        customer.customerCode
          ? <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{customer.customerCode}</span>
          : <span className="text-muted-foreground/40 text-xs">—</span>
      )
    },
    {
      Header: 'Name',
      accessor: 'firstName',
      Cell: (customer: Customer) => (
        <div className="flex items-center">
          {customer.isActive ?
            <CheckCircle className="text-green-500 mr-2 flex-shrink-0" size={18} /> :
            <AlertTriangle className="text-red-500 mr-2 flex-shrink-0" size={18} />
          }
          <span>{`${customer.firstName} ${customer.lastName || ''}`}</span>
        </div>
      )
    },
    { Header: 'Email', accessor: 'email' },
    { Header: 'Phone', accessor: 'phoneNumber' },
    { Header: 'Company', accessor: 'companyName' },
    { Header: 'Type', accessor: 'customerType' },
    { Header: 'Credit Limit', accessor: 'creditLimit', Cell: (customer: Customer) => <div className="text-right w-full pr-2">{formatCurrency(parseCurrency(customer.creditLimit))}</div> },
    { Header: 'Outstanding', accessor: 'outstandingCredit', Cell: (customer: Customer) => <div className="text-right w-full pr-2">{formatCurrency(parseCurrency(customer.outstandingCredit))}</div> },
    { Header: 'Total Sales', accessor: 'totalSalesValue', Cell: (customer: Customer) => <div className="text-right w-full pr-2">{formatCurrency(parseCurrency(customer.totalSalesValue))}</div> },
    {
      Header: 'Actions',
      accessor: 'id', 
      Cell: (customer: Customer) => (
        <div className="flex items-center justify-center space-x-2">
          <button onClick={() => handleEdit(customer)} className="text-primary hover:text-primary/80 p-1">
            <Edit size={18} />
          </button>
          <button onClick={() => handleDelete(customer.id)} className="text-red-600 hover:text-red-800 p-1">
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ], [currencySymbol, triggerRefresh]);

  const totalSales = useMemo(() => 
    customers.reduce((sum, customer) => sum + parseCurrency(customer.totalSalesValue), 0),
  [customers]);

  const totalOutstanding = useMemo(() => 
    customers.reduce((sum, customer) => sum + parseCurrency(customer.outstandingCredit), 0),
  [customers]);

  const handleExport = async (format: ExportFormat) => {
    const dataToExport = filteredCustomers;

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Customers');
      
      worksheet.columns = [
        { header: 'First Name', key: 'firstName', width: 20 },
        { header: 'Last Name', key: 'lastName', width: 20 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Phone', key: 'phoneNumber', width: 20 },
        { header: 'Company Name', key: 'companyName', width: 25 },
        { header: 'Customer Type', key: 'customerType', width: 15 },
        { header: 'Credit Limit', key: 'creditLimit', width: 15, style: { numFmt: `${currencySymbol}#,##0.00` } },
        { header: 'Outstanding Credit', key: 'outstandingCredit', width: 18, style: { numFmt: `${currencySymbol}#,##0.00` } },
        { header: 'Total Sales', key: 'totalSalesValue', width: 15, style: { numFmt: `${currencySymbol}#,##0.00` } },
        { header: 'Is Active', key: 'isActive', width: 10 },
      ];

      dataToExport.forEach(customer => {
        worksheet.addRow({
          ...customer,
          creditLimit: parseCurrency(customer.creditLimit),
          outstandingCredit: parseCurrency(customer.outstandingCredit),
          totalSalesValue: parseCurrency(customer.totalSalesValue),
          isActive: customer.isActive ? 'Yes' : 'No',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'customers.xlsx';
      link.click();
      URL.revokeObjectURL(link.href);

    } else if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text("Customer List", 14, 15);

      doc.setFont('times'); 
      console.log('Currency symbol for PDF:', currencySymbol);

      // Define headers with styles for specific alignment
      type HAlignType = 'left' | 'center' | 'right' | 'justify'; 
      const tableHeaders = [
        { content: 'Name', styles: { halign: 'left' as HAlignType } },
        { content: 'Email', styles: { halign: 'left' as HAlignType } },
        { content: 'Phone', styles: { halign: 'left' as HAlignType } },
        { content: 'Credit Limit', styles: { halign: 'right' as HAlignType } },
        { content: 'Outstanding', styles: { halign: 'right' as HAlignType } },
        { content: 'Total Sales', styles: { halign: 'right' as HAlignType } },
      ];

      const tableRows: (string | number)[][] = [];

      dataToExport.forEach(customer => {
        const customerData = [
          `${customer.firstName} ${customer.lastName || ''}`.trim(),
          customer.email || '',
          customer.phoneNumber || '',
          parseCurrency(customer.creditLimit).toFixed(2),
          parseCurrency(customer.outstandingCredit).toFixed(2),
          parseCurrency(customer.totalSalesValue).toFixed(2),
        ];
        tableRows.push(customerData);
      });

      autoTable(doc, {
        head: [tableHeaders], // Use the new headers array
        body: tableRows,
        startY: 20,
        theme: 'grid',
        headStyles: { 
          fillColor: [41, 128, 185], 
          textColor: 255,
          // General header styles if any, specific ones are in tableHeaders
        }, 
        columnStyles: {
          0: { cellWidth: 60 }, // Name
          1: { cellWidth: 60 }, // Email
          2: { cellWidth: 40 }, // Phone
          3: { halign: 'right', cellWidth: 30 }, // Credit Limit Data
          4: { halign: 'right', cellWidth: 30 }, // Outstanding Data
          5: { halign: 'right', cellWidth: 40 }, // Total Sales Data
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(10);
          doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });
      doc.save('customer_list.pdf');
    } else if (format === 'csv') {
      const headers = [
        'First Name', 'Last Name', 'Email', 'Phone', 
        'Company Name', 'Customer Type', 'Credit Limit', 
        'Outstanding Credit', 'Total Sales', 'Is Active'
      ];

      const csvRows = [
        headers.join(','), // Header row
        ...dataToExport.map(customer => {
          return [
            customer.firstName || '',
            customer.lastName || '',
            customer.email || '',
            customer.phoneNumber || '',
            customer.companyName || '',
            customer.customerType || '',
            parseCurrency(customer.creditLimit).toString(),
            parseCurrency(customer.outstandingCredit).toString(),
            parseCurrency(customer.totalSalesValue).toString(),
            customer.isActive ? 'Yes' : 'No',
          ].join(',');
        })
      ];

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'customers.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><div className="loader">Loading Customers...</div></div>;
  }

  const universalListControlsProps: UniversalListControlsProps = {
    searchTerm: searchTerm,
    onSearchChange: setSearchTerm,
    placeholderText: "Search customers by name, email, or phone...", 
    onExportClick: handleExport, 
    newButtonText: "New", 
    onNewButtonClick: () => setIsAddModalOpen(true), 
    showFilterButton: true, 
    showExportButton: true,
    showNewButton: true, 
  };

  const customerFilterModalProps: CustomerFilterModalProps = {
    isOpen: isFilterModalOpen,
    onClose: () => setIsFilterModalOpen(false),
    currentFilters: activeFilters,
    onApplyFilters: setActiveFilters,
    customerTypes: uniqueCustomerTypes,
    onClearFilters: () => {
      setActiveFilters({
        customerTypes: [], creditStatus: 'all', activeStatus: 'all', 
        creditRange: { min: '', max: '' }, hasCompany: 'all'
      });
      setHasActiveFilters(false);
    }
  };

  const customerFormModalProps: CustomerFormModalProps = {
    isOpen: isAddModalOpen,
    onClose: () => {
      setIsAddModalOpen(false);
      setSelectedCustomer(null);
    },
    onSave: async (savedCustomerData: any, isNew: boolean) => { 
      const endpoint = isNew ? '/customers' : `/customers/${selectedCustomer?.id}`;
      const method = isNew ? 'post' : 'put';
      try {
        await axiosInstance[method](endpoint, savedCustomerData);
        toast.success(`Customer ${isNew ? 'added' : 'updated'} successfully!`);
        triggerRefresh();
        setIsAddModalOpen(false);
        setSelectedCustomer(null);
      } catch (error) {
        toast.error(`Failed to ${isNew ? 'add' : 'update'} customer.`);
      }
    },
    customer: selectedCustomer,
    currencySymbol: currencySymbol,
  };

  const reusableTableProps: ReusableTableProps<Customer> = {
    columns: columns,
    data: currentItems,
    isLoading: isLoading,
    currentPage: currentPage,
    totalPages: totalPages,
    onPageChange: paginate,
    itemsPerPage: itemsPerPage,
    totalItems: filteredCustomers.length,
    noDataMessage: (searchTerm || hasActiveFilters) ? 'No customers match your criteria.' : 'No customers found. Add one!'
  };

  return (
    <div className="container mx-auto p-4 bg-gray-50 dark:bg-muted/50 min-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-foreground">Customer Management</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard title="Total Customers" value={customers.length.toString()} icon={<Users className="text-blue-500" />} footerText={`All customers in the system`} iconBgClass="bg-blue-100" iconClass="text-primary" footerBgClass="bg-blue-50" footerTextClass="text-primary" />
        <MetricCard title="Total Sales Value" value={formatCurrency(totalSales)} icon={<TrendingUp className="text-green-500" />} footerText={`From all customers`} iconBgClass="bg-green-100" iconClass="text-green-600" footerBgClass="bg-green-50" footerTextClass="text-green-700" />
        <MetricCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={<CreditCard className="text-red-500" />} footerText={`Across all customers`} iconBgClass="bg-red-100" iconClass="text-red-600" footerBgClass="bg-red-50" footerTextClass="text-red-700" />
      </div>

      {/* UniversalListControls without the card wrapper, add margin-bottom for spacing */}
      <div className="mb-4">
        <UniversalListControls {...universalListControlsProps} />
      </div>

      {isFilterModalOpen && (
        <CustomerFilterModal {...customerFilterModalProps} />
      )}

      {isAddModalOpen && (
        <CustomerFormModal {...customerFormModalProps} />
      )}

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={executeDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to delete this customer? This action cannot be undone.`}
        confirmButtonText="Delete"
        variant="danger"
        isConfirmLoading={isDeleting} // Pass loading state
      />

      <div className="bg-white dark:bg-card shadow-md rounded-lg overflow-x-auto">
        <ReusableTable<Customer> {...reusableTableProps} />
      </div>
      
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center space-x-2">
          <button 
            onClick={() => paginate(currentPage - 1)} 
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-300 text-gray-700 dark:text-foreground rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button 
              key={page} 
              onClick={() => paginate(page)} 
              className={`px-4 py-2 rounded-md transition-colors ${currentPage === page ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-muted text-gray-700 dark:text-foreground hover:bg-gray-300'}`}
            >
              {page}
            </button>
          ))}
          <button 
            onClick={() => paginate(currentPage + 1)} 
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-300 text-gray-700 dark:text-foreground rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomersListPage;
