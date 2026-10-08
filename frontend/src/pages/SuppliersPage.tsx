import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Users, Briefcase, Ban, Plus, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import type { Supplier } from '@/types';
import { getSuppliers, deleteSupplier } from '@/services/supplierService';
import SupplierFormModal from '@/components/suppliers/SupplierFormModal';
import PageHeader from '@/components/common/PageHeader';
import UniversalListControls, { ExportFormat } from '@/components/UniversalListControls';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRefresh } from '@/contexts/RefreshContext';
import ConfirmationModal from '@/components/modals/ConfirmationModal';

const SuppliersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshKey, triggerRefresh } = useRefresh() ?? { refreshKey: 0, triggerRefresh: () => fetchSuppliers() }; 

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); 

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [supplierToDeleteId, setSupplierToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const fetchedSuppliers = await getSuppliers();
      setSuppliers(fetchedSuppliers);
      setFilteredSuppliers(fetchedSuppliers); 
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('An error occurred while fetching suppliers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [refreshKey]);

  useEffect(() => {
    let result = suppliers;
    if (activeFilter === 'active') {
      result = result.filter(s => s.isActive);
    } else if (activeFilter === 'inactive') {
      result = result.filter(s => !s.isActive);
    }
    if (searchTerm) {
      result = result.filter(supplier =>
        supplier.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.phone?.includes(searchTerm) ||
        supplier.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredSuppliers(result);
    setCurrentPage(1);
  }, [searchTerm, suppliers, activeFilter]);

  const handleDelete = (supplierId: string) => {
    setSupplierToDeleteId(supplierId);
    setIsDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!supplierToDeleteId) return;
    setIsDeleting(true);
    try {
      await deleteSupplier(supplierToDeleteId);
      toast.success('Supplier deleted successfully');
      triggerRefresh(); // This will call fetchSuppliers due to refreshKey dependency
    } catch (err) {
      toast.error('Failed to delete supplier. Please try again.');
      console.error('Delete error:', err);
    } finally {
      setIsDeleteConfirmOpen(false);
      setSupplierToDeleteId(null);
      setIsDeleting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsAddModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedSupplier(null);
    setIsAddModalOpen(true);
  };

  const columns = useMemo<ColumnDefinition<Supplier>[]>(() => [
    {
      Header: 'Supplier Name',
      accessor: 'supplierName',
      Cell: (item) => <span className="font-medium">{item.supplierName}</span>,
    },
    {
      Header: 'Contact Person',
      accessor: 'contactPerson',
    },
    {
      Header: 'Email',
      accessor: 'email',
      Cell: (item) => item.email ? <a href={`mailto:${item.email}`} className="text-primary hover:underline">{item.email}</a> : 'N/A',
    },
    {
      Header: 'Phone',
      accessor: 'phone',
    },
    {
      Header: 'Status',
      accessor: 'isActive',
      Cell: (item) => (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {item.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      Header: 'Actions',
      accessor: 'id', // Accessor is needed, can be any unique key like 'id'
      Cell: (item) => (
        <div className="flex space-x-2">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="p-1 text-primary hover:text-primary/80">
            <Edit size={18} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-1 text-red-600 hover:text-red-800">
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ], [handleEdit, handleDelete]);

  const paginatedSuppliers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSuppliers, currentPage, itemsPerPage]);

  const totalSuppliers = filteredSuppliers.length;
  const activeSuppliers = filteredSuppliers.filter(s => s.isActive).length;

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Suppliers');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 30 },
      { header: 'Supplier Name', key: 'supplierName', width: 30 },
      { header: 'Contact Person', key: 'contactPerson', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Address Line 1', key: 'addressLine1', width: 30 },
      { header: 'City', key: 'city', width: 20 },
      { header: 'State/Province', key: 'stateProvince', width: 20 },
      { header: 'Postal Code', key: 'postalCode', width: 15 },
      { header: 'Country', key: 'country', width: 20 },
      { header: 'Website', key: 'website', width: 30 },
      { header: 'Tax ID', key: 'taxId', width: 20 },
      { header: 'Default Payment Terms', key: 'defaultPaymentTerms', width: 25 },
      { header: 'Active', key: 'isActive', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    filteredSuppliers.forEach(supplier => {
      worksheet.addRow({
        ...supplier,
        isActive: supplier.isActive ? 'Yes' : 'No',
        createdAt: supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString() : 'N/A',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'suppliers.xlsx';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Supplier Name', 'Contact Person', 'Email', 'Phone', 'Status']],
      body: filteredSuppliers.map(s => [
        s.supplierName,
        s.contactPerson || 'N/A',
        s.email || 'N/A',
        s.phone || 'N/A',
        s.isActive ? 'Active' : 'Inactive',
      ]),
    });
    doc.save('suppliers.pdf');
  };

  const handleExport = (format: ExportFormat) => {
    if (format === 'excel') {
      exportToExcel();
    } else if (format === 'pdf') {
      exportToPDF();
    } else {
      toast.info("CSV export not implemented yet.");
    }
  };

  const totalPages = Math.ceil(totalSuppliers / itemsPerPage);

  if (isLoading && suppliers.length === 0) {
    return <div className="p-4 text-center">Loading suppliers...</div>;
  }

  const kpiItems = [
    { key: null as 'active' | 'inactive' | null, label: 'All Suppliers', value: totalSuppliers, icon: Users, color: 'text-blue-600' },
    { key: 'active' as const, label: 'Active', value: activeSuppliers, icon: Briefcase, color: 'text-green-600' },
    { key: 'inactive' as const, label: 'Inactive', value: totalSuppliers - activeSuppliers, icon: Ban, color: 'text-red-600' },
  ] as const;

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Briefcase}
        title="Supplier Management"
        subtitle="Manage your supplier relationships, contact information, and status."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpiItems.map((item) => {
          const Icon = item.icon;
          const active = activeFilter === item.key;
          return (
            <button
              key={item.label}
              onClick={() => setActiveFilter(active ? null : item.key)}
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
        onSearchChange={setSearchTerm}
        onExportClick={handleExport}
        placeholderText="Search by name, email, phone..."
        onNewButtonClick={handleAdd}
        newButtonText="New"
        newButtonIcon={<Plus size={18} className="sm:mr-2" />}
        showFilterButton={false}
      />

      {isLoading && suppliers.length > 0 && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Refreshing supplier data…
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        {isLoading && suppliers.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading suppliers…
          </div>
        ) : paginatedSuppliers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {searchTerm || activeFilter ? 'No suppliers match your search or filter.' : 'No suppliers found. Add a new one to get started!'}
            </p>
          </div>
        ) : (
          <ReusableTable
            columns={columns}
            data={paginatedSuppliers}
            isLoading={false}
            noDataMessage={searchTerm ? "No suppliers match your search." : "No suppliers found. Add a new one to get started!"}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={totalSuppliers}
            onRowClick={(supplier) => navigate(`/suppliers/${supplier.id}`)}
          />
        )}
      </div>

      {isAddModalOpen && (
        <SupplierFormModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setSelectedSupplier(null);
          }}
          initialData={selectedSupplier}
          onSubmitSuccess={() => {
            setIsAddModalOpen(false);
            setSelectedSupplier(null);
            triggerRefresh();
          }}
          isEditMode={!!selectedSupplier}
        />
      )}

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={executeDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to delete this supplier? This action cannot be undone.`}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        variant="danger"
        isConfirmLoading={isDeleting}
      />
    </div>
  );
};

export default SuppliersListPage;
