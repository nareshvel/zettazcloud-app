import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit, Eye, Trash2, ShoppingCart, FileText, DollarSign, MoreVertical, Printer, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  NewPurchaseOrderData,
  getPurchaseOrderById
} from '@/services/purchaseOrderService';
import type { PurchaseOrder, PurchaseOrderModalMode } from '@/types';
import CreatePurchaseOrderModal from '@/components/purchaseorders/CreatePurchaseOrderModal';
import UniversalListControls from '@/components/UniversalListControls';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import PageHeader from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRefresh } from '@/contexts/RefreshContext';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';

import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PrintPreviewModal from '@/components/PrintPreviewModal'; // Assuming this path is correct

const ITEMS_PER_PAGE = 20;

const PurchaseManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { refreshKey, triggerRefresh } = useRefresh() ?? { refreshKey: 0, triggerRefresh: () => {} }; 
  const { formatCurrency } = useCurrency();
  const { formatDate } = useDateFormatting();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredPurchaseOrders, setFilteredPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<PurchaseOrderModalMode>('create');
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printContent, setPrintContent] = useState('');
  const [printTitle, setPrintTitle] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [poForAction, setPoForAction] = useState<PurchaseOrder | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalBody, setModalBody] = useState<React.ReactNode>('');
  const [showSoftDeleteButton, setShowSoftDeleteButton] = useState(false);
  const [showHardDeleteButton, setShowHardDeleteButton] = useState(false);
  const [softDeleteButtonText, setSoftDeleteButtonText] = useState('');
  const [hardDeleteButtonText, setHardDeleteButtonText] = useState('');

  const fetchPurchaseOrders = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const tenantId = user?.tenantId ?? undefined;
      if (!tenantId) {
        setFetchError("Tenant ID is not available. Cannot fetch purchase orders.");
        toast.error("Tenant ID is missing.");
        setPurchaseOrders([]);
        return;
      }
      const data = await getPurchaseOrders({ tenant_id: tenantId });
      setPurchaseOrders(data);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while fetching data.';
      setFetchError(`Failed to load purchase orders. Backend error: ${errorMessage}`);
      toast.error('An error occurred while fetching purchase orders.');
      setPurchaseOrders([]); 
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (user?.tenantId) {
      fetchPurchaseOrders();
    }
  }, [refreshKey, user?.tenantId, triggerRefresh]);

  useEffect(() => {
    let result = purchaseOrders;
    if (statusFilter) {
      result = result.filter(po => po.status === statusFilter);
    }
    if (searchTerm) {
      result = result.filter(po =>
        po.purchaseOrderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (po.supplierName && po.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        po.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredPurchaseOrders(result);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, purchaseOrders]);

  const handleAddNew = () => {
    setSelectedPurchaseOrder(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  // Deep-link: open the create form when launched from the bottom-nav
  // quick actions (?new=1). The param is stripped so a refresh won't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
      handleAddNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleEdit = async (poSummary: PurchaseOrder) => {
    if (!poSummary.id) {
      toast.error("Cannot edit PO without an ID.");
      return;
    }
    try {
      setIsLoading(true);
      const fullPo = await getPurchaseOrderById(poSummary.id);
      setSelectedPurchaseOrder(fullPo);
      setModalMode('edit');
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching full purchase order for edit:', error);
      toast.error('Failed to load purchase order details for editing.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = async (poSummary: PurchaseOrder) => {
    if (!poSummary.id) {
      toast.error("Cannot view PO without an ID.");
      return;
    }
    try {
      setIsLoading(true);
      const fullPo = await getPurchaseOrderById(poSummary.id);
      setSelectedPurchaseOrder(fullPo);
      setModalMode('view');
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching full purchase order for view:', error);
      toast.error('Failed to load purchase order details for viewing.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (purchaseOrder: PurchaseOrder) => {
    if (!purchaseOrder?.id) {
      toast.error("Cannot process action: PO ID is missing.");
      return;
    }
    setPoForAction(purchaseOrder);
    switch (purchaseOrder.status) {
      case 'DRAFT':
        if (purchaseOrder.purchase_order_number && purchaseOrder.purchase_order_number !== 'N/A') {
          setModalTitle(`Options for Draft PO #${purchaseOrder.purchase_order_number}`);
        } else {
          setModalTitle('Options for this Draft Purchase Order');
        }
        setModalBody(
          <>
            <p>You can cancel this draft purchase order to mark it as void.</p>
            <p className="mt-2">Alternatively, if it's no longer needed, you can permanently delete it. This action cannot be undone and removes the PO from the system.</p>
          </>
        );
        setShowSoftDeleteButton(true);
        setSoftDeleteButtonText('Cancel PO');
        setShowHardDeleteButton(true);
        setHardDeleteButtonText('Permanently Delete');
        break;
      case 'ORDERED':
        if (purchaseOrder.purchase_order_number && purchaseOrder.purchase_order_number !== 'N/A') {
          setModalTitle(`Cancel Purchase Order #${purchaseOrder.purchase_order_number}?`);
        } else {
          setModalTitle('Cancel this Purchase Order?');
        }
        setModalBody(
          <p>Are you sure you want to cancel this purchase order? This will change its status to 'Cancelled'. Once cancelled, it cannot be processed for receiving goods.</p>
        );
        setShowSoftDeleteButton(true);
        setSoftDeleteButtonText('Yes, Cancel This PO');
        setShowHardDeleteButton(false);
        setHardDeleteButtonText('');
        break;
      case 'CANCELLED':
        if (purchaseOrder.purchase_order_number && purchaseOrder.purchase_order_number !== 'N/A') {
          setModalTitle(`Permanently Delete PO #${purchaseOrder.purchase_order_number}?`);
        } else {
          setModalTitle('Permanently Delete this Purchase Order?');
        }
        setModalBody(
          <p>This purchase order is already cancelled. Do you want to permanently delete it from the system? This action cannot be undone.</p>
        );
        setShowSoftDeleteButton(false);
        setSoftDeleteButtonText('');
        setShowHardDeleteButton(true);
        setHardDeleteButtonText('Yes, Permanently Delete');
        break;
      case 'PARTIALLY_RECEIVED':
      case 'RECEIVED':
        if (purchaseOrder.purchase_order_number && purchaseOrder.purchase_order_number !== 'N/A') {
          setModalTitle(`Cancel Purchase Order #${purchaseOrder.purchase_order_number}?`);
        } else {
          setModalTitle('Cancel this Purchase Order?');
        }
        setModalBody(
          <>
            <p>This purchase order is currently marked as '{purchaseOrder.status}'.</p>
            <p className="mt-2">You can attempt to cancel it. However, if goods have already been fully received and recorded, cancellation might be prevented by the system to maintain data integrity.</p>
          </>
        );
        setShowSoftDeleteButton(true);
        setSoftDeleteButtonText('Attempt to Cancel PO');
        setShowHardDeleteButton(false); 
        setHardDeleteButtonText('');
        break;
      default:
        toast.error(`Cannot determine action for PO status: ${purchaseOrder.status}`);
        console.error(`Unhandled PO status for deletion: ${purchaseOrder.status}`);
        return; 
    }
    setIsConfirmModalOpen(true);
  };

  const executeDeleteConfirmation = async (hardDelete: boolean) => {
    if (!poForAction?.id || !user?.tenantId) {
      toast.error('Cannot delete PO: Missing PO ID or Tenant ID.');
      return;
    }
    try {
      setIsLoading(true);
      await deletePurchaseOrder(poForAction.id, user.tenantId, hardDelete);
      if (hardDelete) {
        if (poForAction.purchase_order_number) {
          toast.success(`Purchase Order #${poForAction.purchase_order_number} has been permanently deleted.`);
        } else {
          toast.success(`The selected Purchase Order has been permanently deleted.`);
        }
      } else { 
        if (poForAction.purchase_order_number) {
          toast.success(`Purchase Order #${poForAction.purchase_order_number} has been cancelled.`);
        } else {
          toast.success(`The selected Purchase Order has been cancelled.`);
        }
      }
      triggerRefresh(); 
    } catch (error: any) {
      console.error('Error processing purchase order deletion:', error);
      toast.error(error.message || 'Failed to process purchase order deletion.');
    } finally {
      setIsLoading(false);
      setIsConfirmModalOpen(false);
      setPoForAction(null);
    }
  };

  const handleCloseConfirmModal = () => {
    setIsConfirmModalOpen(false);
    setPoForAction(null);
  };

const handlePrintPo = async (po: PurchaseOrder) => {
    if (!po.id) {
      toast.error("Cannot print PO without an ID.");
      return;
    }
    try {
      setIsLoading(true);
      const fullPo = await getPurchaseOrderById(po.id);
      if (!fullPo) {
        toast.error("Could not fetch PO details for printing.");
        return;
      }

      // Simplified HTML content for now, can be expanded like GRN's
      const itemsHtml = fullPo.items?.map(item => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.productName || 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.quantityOrdered || 0}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(item.costPrice || 0)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency((item.quantityOrdered || 0) * (item.costPrice || 0))}</td>
        </tr>
      `).join('') || '';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h1 style="text-align: center;">${user?.store?.name || 'Store'}</h1>
          <h2 style="text-align: center;">Purchase Order: ${fullPo.purchaseOrderNumber || 'N/A'}</h2>
          <p><strong>Supplier:</strong> ${fullPo.supplierName || 'N/A'}</p>
          <p><strong>Order Date:</strong> ${fullPo.orderDate ? formatDate(new Date(fullPo.orderDate)) : 'N/A'}</p>
          <p><strong>Status:</strong> ${fullPo.status}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f2f2f2;">
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Quantity</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Unit Cost</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>Grand Total:</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>${formatCurrency(fullPo.totalAmount || 0)}</strong></td>
              </tr>
            </tfoot>
          </table>
          <p style="margin-top: 20px;"><strong>Notes:</strong> ${fullPo.notes || ''}</p>
        </div>
      `;

      setPrintContent(htmlContent);
      setPrintTitle(`${user?.store?.name || 'Store'} - Purchase Order - ${fullPo.purchaseOrderNumber || 'N/A'}`);
      setIsPrintModalOpen(true);
    } catch (error) {
      console.error('Error preparing PO for printing:', error);
      toast.error('Failed to prepare PO for printing.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPurchaseOrder(null);
  };

  const handleSavePurchaseOrder = async (data: NewPurchaseOrderData) => {
    try {
      const tenantId = user?.tenantId;
      if (!tenantId) {
        toast.error("Tenant ID is missing. Cannot save purchase order.");
        return;
      }
      const dataWithTenant = { ...data, tenant_id: tenantId };

      if (selectedPurchaseOrder && selectedPurchaseOrder.id) {
        await updatePurchaseOrder(selectedPurchaseOrder.id, dataWithTenant);
        toast.success('Purchase Order updated successfully!');
      } else {
        await createPurchaseOrder(dataWithTenant);
        toast.success('Purchase Order created successfully!');
      }
      triggerRefresh(); 
      handleModalClose();
    } catch (error) {
      console.error('Failed to save purchase order:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast.error(`Failed to save purchase order: ${errorMessage}`);
    }
  };

  const columns = useMemo<ColumnDefinition<PurchaseOrder>[]>(() => [
    { Header: 'PO Number', accessor: 'purchaseOrderNumber' },
    { Header: 'Supplier', accessor: 'supplierName' },
    {
      Header: 'Order Date',
      accessor: 'orderDate',
      Cell: (item: PurchaseOrder) => {
        if (!item) return 'N/A';
        const value = item.orderDate;
        return value ? formatDate(new Date(value)) : 'N/A';
      }
    },
    {
      Header: 'Expected Delivery',
      accessor: 'expectedDeliveryDate',
      Cell: (item: PurchaseOrder) => {
        if (!item) return 'N/A';
        const value = item.expectedDeliveryDate;
        return value ? formatDate(new Date(value)) : 'N/A';
      }
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: (item: PurchaseOrder) => {
        if (!item || typeof item.status === 'undefined') return <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 dark:bg-muted text-gray-800`}>N/A</span>;
        const status = item.status;
        let statusClass = 'bg-gray-200 dark:bg-muted text-gray-800';
        if (status === 'CANCELLED') statusClass = 'bg-red-200 text-red-800';
        else if (status === 'ORDERED') statusClass = 'bg-blue-200 text-blue-800';
        else if (status === 'PARTIALLY_RECEIVED') statusClass = 'bg-yellow-200 text-yellow-800';
        else if (status === 'DRAFT') statusClass = 'bg-purple-200 text-purple-800'; 
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusClass}`}>{status}</span>;
      }
    },
    {
      Header: 'Total Amount',
      accessor: 'totalAmount',
      headerClassName: 'text-right',
      className: 'text-right',
      Cell: (item: PurchaseOrder) => {
        if (!item) return formatCurrency(0);
        const value = item.totalAmount;
        return formatCurrency(Number(value || 0));
      }
    },
    {
      Header: 'Actions',
      accessor: 'id', 
      Cell: (item: PurchaseOrder) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleView(item)}>
                <Eye className="mr-2 h-4 w-4" /> View
              </DropdownMenuItem>
              {item.status === 'DRAFT' && (
                <DropdownMenuItem onClick={() => handleEdit(item)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handlePrintPo(item)}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </DropdownMenuItem>
              {(item.status === 'DRAFT' || item.status === 'ORDERED' || item.status === 'CANCELLED') && (
                <DropdownMenuItem onClick={() => handleDelete(item)} className={item.status === 'DRAFT' || item.status === 'CANCELLED' ? "text-red-600 hover:!text-red-700" : ""}>
                  <Trash2 className="mr-2 h-4 w-4" /> {item.status === 'ORDERED' ? 'Cancel PO' : 'Delete'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      headerClassName: 'text-right',
      cellClassName: 'text-right',
    },
  ], [formatCurrency, formatDate, user?.tenantId]); 

  const totalOpenPOs = purchaseOrders.filter(po => po.status === 'ORDERED' || po.status === 'DRAFT').length;
  const totalValuePOs = purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPurchaseOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPurchaseOrders, currentPage]);

  const totalPages = Math.ceil(filteredPurchaseOrders.length / ITEMS_PER_PAGE);

  

  const kpiStatuses = ['', 'DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const;
  const statusMeta: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    '':                { label: 'All POs', icon: ShoppingCart, color: 'text-blue-600' },
    'DRAFT':           { label: 'Draft', icon: FileText, color: 'text-purple-600' },
    'ORDERED':         { label: 'Open', icon: ShoppingCart, color: 'text-yellow-600' },
    'PARTIALLY_RECEIVED': { label: 'Partial', icon: ShoppingCart, color: 'text-orange-600' },
    'RECEIVED':        { label: 'Received', icon: CheckCircle, color: 'text-green-600' },
    'CANCELLED':       { label: 'Cancelled', icon: XCircle, color: 'text-red-600' },
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': purchaseOrders.length };
    kpiStatuses.slice(1).forEach(s => { counts[s] = purchaseOrders.filter(po => po.status === s).length; });
    return counts;
  }, [purchaseOrders]);

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={ShoppingCart}
        title="Purchase Orders"
        subtitle="Create, track, and manage purchase orders from suppliers."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiStatuses.map((s) => {
          const Meta = statusMeta[s];
          const active = statusFilter === s;
          return (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(active ? '' : s)}
              className={`flex items-center gap-3 rounded-xl border border-r-4 p-3.5 text-left transition-all ${
                active
                  ? 'border-primary border-r-primary bg-primary/5 shadow-sm'
                  : 'border-border border-r-primary/40 bg-card hover:border-primary/40'
              }`}
            >
              <Meta.icon className={`h-5 w-5 shrink-0 ${Meta.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{statusCounts[s] ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{Meta.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      <UniversalListControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholderText="Search PO #, Supplier, Status..."
        onNewButtonClick={handleAddNew}
        newButtonText="New"
        showFilterButton={false}
        showExportButton={true}
        onExportClick={(format) => alert(`Exporting as ${format}`)}
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 px-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading purchase orders…
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-8 text-center">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Unable to Load Purchase Orders</h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">{fetchError}</p>
          <Button onClick={fetchPurchaseOrders} variant="outline">
            Retry
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          {paginatedData.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No purchase orders found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <ReusableTable<PurchaseOrder>
              columns={columns}
              data={paginatedData}
              isLoading={false}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredPurchaseOrders.length}
              noDataMessage="No purchase orders found matching your criteria."
            />
          )}
        </div>
      )}

      {/* Unified Create/Edit/View Purchase Order Modal */}

      {isPrintModalOpen && (
        <PrintPreviewModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title={printTitle}
          content={printContent}
        />
      )}

      {isModalOpen && user?.tenantId && (
        <CreatePurchaseOrderModal
          isOpen={isModalOpen}
          mode={modalMode}
          onClose={handleModalClose}
          onSave={handleSavePurchaseOrder}
          existingPurchaseOrder={selectedPurchaseOrder}
          // tenantId={user.tenantId} // Removed as modal uses tenantId from context
        />
      )}

      {/* Confirmation Modal for Delete Actions */}
      {isConfirmModalOpen && (
        <ModalBase
          isOpen={isConfirmModalOpen}
          title={modalTitle}
          onClose={handleCloseConfirmModal}
          footerContent={
            <>
              <Button variant="outline" onClick={handleCloseConfirmModal}>
                Cancel
              </Button>
              {showSoftDeleteButton && (
                <Button
                  variant="destructive"
                  onClick={() => executeDeleteConfirmation(false)}
                  className="ml-2"
                >
                  {softDeleteButtonText}
                </Button>
              )}
              {showHardDeleteButton && (
                <Button
                  variant="destructive"
                  onClick={() => executeDeleteConfirmation(true)}
                  className="ml-2"
                >
                  {hardDeleteButtonText}
                </Button>
              )}
            </>
          }
        >
          <div className="text-sm text-gray-700 dark:text-foreground space-y-3">
            {modalBody}
          </div>
        </ModalBase>
      )}
    </div>
  );
};

export default PurchaseManagementPage;

