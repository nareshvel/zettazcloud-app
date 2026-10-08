import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import AddGoodsReceivedModal from '@/components/goods-receiving/AddGoodsReceivedModal';
import type { GrnResponse } from '@/types';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import UniversalListControls from '@/components/UniversalListControls';
import PageHeader from '@/components/common/PageHeader';
import { Loader2, CheckCircle, AlertCircle, Eye, FileText, FileX, MoreVertical, Edit3, Printer, Trash2, DollarSign } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { grnService } from '@/services/grnService';
import PrintPreviewModal from '@/components/PrintPreviewModal';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 10;

// Full GRN response is already typed in the service layer

const GoodsReceivingPage: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, formatDate } = useLocaleFormat();
  
  // Helper function to safely get tenant ID (convert null to undefined)
  const getSafeTenantId = () => user?.tenantId || undefined;
  const [grns, setGrns] = useState<GrnResponse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [grnToDelete, setGrnToDelete] = useState<GrnResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Store the GRN ID for editing or viewing, not the full object
  const [grnToEdit, setGrnToEdit] = useState<string | undefined>(undefined);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printContent, setPrintContent] = useState('');
  const [printTitle, setPrintTitle] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  // We're using totalPages for pagination instead of totalItems
  const [totalGrns, setTotalGrns] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Item counts for each GRN - we'll use this to avoid multiple API calls for item counts
  const [grnItemCounts, setGrnItemCounts] = useState<Record<string, number>>({});

  // Function to convert snake_case keys to camelCase
  const snakeToCamel = (str: string): string => {
    return str.replace(/_([a-z])/g, (_match, p1) => p1.toUpperCase());
  };

  // Function to transform an object's keys from snake_case to camelCase
  const transformObjectKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(transformObjectKeys);
    }
    
    const newObj: any = {};
    
    Object.keys(obj).forEach((key) => {
      const camelKey = snakeToCamel(key);
      newObj[camelKey] = transformObjectKeys(obj[key]);
    });
    
    return newObj;
  };

  // No need to fetch store settings separately anymore
  // The localization context handles that for us

  // Function to fetch GRNs
  const getGrns = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create filters object with current pagination and search
      const filters: Record<string, string | number | boolean> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };
      
      // Add tenant_id which is required by the API
      if (user?.tenantId) {
        filters.tenant_id = user.tenantId;
      }
      
      // Use the store ID from the GRNs themselves - don't filter by user store ID
      // This allows all GRNs for the tenant to be displayed regardless of store assignment
      
      // Add search term if provided
      if (searchTerm) {
        filters.search = searchTerm;
      }
      
      const response = await grnService.getGrns(filters);
      
      let grnData: GrnResponse[] = [];
      if (response && response.data) {
        grnData = Array.isArray(response.data) ? response.data : [];
        setGrns(grnData);
        setTotalGrns(response.totalItems || 0);
        setTotalPages(response.totalPages || 1);
      } else {
        // Fallback if response or response.data is not as expected
        console.warn('Unexpected response structure from getGrns');
        setGrns([]);
        setTotalGrns(0);
        setTotalPages(1);
      }
      
      // Fetch item counts for each GRN - using the new grnData from current API response
      const itemCounts: Record<string, number> = {};
      const fetchItemCountPromises = grnData.map(async (grn) => {
        try {
          const fullGrn = await grnService.getGrnById(grn.id, getSafeTenantId());
          if (fullGrn?.items) {
            itemCounts[grn.id] = fullGrn.items.length;
          } else {
            itemCounts[grn.id] = 0;
          }
        } catch (err) {
          // Set to 0 if there's an error
          itemCounts[grn.id] = 0;
        }
      });
      
      // Wait for all item count fetches to complete
      await Promise.all(fetchItemCountPromises).catch(err => console.error('Error fetching item counts:', err));
      setGrnItemCounts(itemCounts);
      
      // Calculate total items across all GRNs for metrics
      // Not storing the total items count, as we're using totalGrns for metrics instead
      
    } catch (err) {
      console.error('Error fetching GRNs:', err);
      setError('Failed to fetch goods received notes');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm]);

  // Fetch GRNs when component mounts or dependencies change
  useEffect(() => {
    getGrns();
  }, [getGrns, currentPage]);

  const handleAddNewGrn = () => {
    setGrnToEdit(undefined);
    setViewOnly(false);
    setIsEditModalOpen(true);
  };

  // Deep-link: open the create form when launched from the bottom-nav
  // quick actions (?new=1). The param is stripped so a refresh won't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
      handleAddNewGrn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleGrnAddedOrUpdated = () => {
    setGrnToEdit(undefined);
    // Reset to first page and refetch
    setCurrentPage(1);
    getGrns();
  };
  
  // Function to handle viewing a GRN
  const handleViewGrn = (grn: GrnResponse) => {
    setGrnToEdit(grn.id);
    setViewOnly(true);
    setIsEditModalOpen(true);
  };

  const handleEdit = (grn: GrnResponse) => {
    setGrnToEdit(grn.id);
    setViewOnly(false);
    setIsEditModalOpen(true);
  };
  
  // handleChangeToDraft function removed - simplified workflow with always COMPLETED status
  
  const handleDeleteGrn = (grn: GrnResponse) => {
    setGrnToDelete(grn);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteGrn = async () => {
    if (!grnToDelete) return;
    
    setIsDeleting(true);
    try {
      // Get the tenant ID from the user context
      const tenantId = getSafeTenantId();
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }
      
      // Call the API to delete the GRN with tenant ID
      await grnService.deleteGrn(grnToDelete.id, tenantId);
      
      // Close the dialog and refresh GRNs
      setIsDeleteDialogOpen(false);
      setGrnToDelete(null);
      
      // Show success message
      toast.success(`GRN ${grnToDelete.grnNumber} has been deleted`);
      
      // Refresh the list
      getGrns();
    } catch (err) {
      console.error('Failed to delete GRN:', err);
      toast.error('Failed to delete GRN: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };
  
  const cancelDeleteGrn = () => {
    setIsDeleteDialogOpen(false);
    setGrnToDelete(null);
  };
  
  const handlePrintGrn = async (grn: GrnResponse) => {
    try {
      setIsLoading(true);
      // Fetch the full GRN with items
      const grnFull = await grnService.getGrnById(grn.id, getSafeTenantId());
      
      // Calculate item totals and overall total
      const itemsWithTotals = grnFull.items?.map(item => {
        // Extract values safely from different property conventions
        const unitCost = (item as any).unit_cost_price || (item as any).unitCostPrice || item.costPrice || 0;
        const quantity = (item as any).quantity_received || item.quantityReceived || 0;
        const lineTotal = quantity * unitCost;
        return { ...item, calculatedTotal: lineTotal, unitCost };
      }) || [];
      
      const totalValue = itemsWithTotals.reduce((sum, item) => sum + item.calculatedTotal, 0);
      
      // Generate HTML content for printing
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="margin-bottom: 5px;">Goods Received Note</h1>
            <h2 style="margin-top: 0;">${grnFull.grnNumber || (grnFull as any).grn_number || 'Unknown'}</h2>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div>
              <p><strong>Supplier:</strong> ${grnFull.supplierName || (grnFull as any).supplier_name || 'N/A'}</p>
              <p><strong>PO Number:</strong> ${grnFull.purchaseOrderNumber || (grnFull as any).purchase_order_number || (grnFull as any).poNumber || 'N/A'}</p>
              <p><strong>Invoice #:</strong> ${grnFull.supplierInvoiceNumber || (grnFull as any).supplier_invoice_number || 'N/A'}</p>
            </div>
            <div>
              <p><strong>Date Received:</strong> ${formatDate(grnFull.receivedDate || (grnFull as any).received_date)}</p>
              <p><strong>Status:</strong> ${grnFull.status || 'N/A'}</p>
              <p><strong>GRN #:</strong> ${grnFull.grnNumber || (grnFull as any).grn_number || 'Unknown'}</p>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f2f2f2;">
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Item</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">SKU</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Qty</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Unit Cost</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsWithTotals.map(item => `
                <tr>
                  <td style="padding: 10px; text-align: left; border: 1px solid #ddd;">${item.productName || (item as any).product_name || 'Unknown Product'}</td>
                  <td style="padding: 10px; text-align: left; border: 1px solid #ddd;">${item.productSku || (item as any).product_sku || ''}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${(item as any).quantity_received || item.quantityReceived || 0}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatCurrency(item.unitCost)}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatCurrency(item.calculatedTotal)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>Subtotal:</strong></td>
                <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatCurrency(totalValue)}</td>
              </tr>
              <tr>
                <td colspan="4" style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>Tax:</strong></td>
                <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatCurrency(grnFull.totalTaxPaid || (grnFull as any).total_tax_paid || 0)}</td>
              </tr>
              <tr>
                <td colspan="4" style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>Shipping:</strong></td>
                <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatCurrency(grnFull.shippingHandlingPaid || (grnFull as any).shipping_handling_paid || 0)}</td>
              </tr>
              <tr>
                <td colspan="4" style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>Other Charges:</strong></td>
                <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${formatCurrency(grnFull.otherChargesPaid || (grnFull as any).other_charges_paid || 0)}</td>
              </tr>
              <tr>
                <td colspan="4" style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>Total:</strong></td>
                <td style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>${formatCurrency(
                  totalValue + 
                  (parseFloat(grnFull.totalTaxPaid || (grnFull as any).total_tax_paid || '0') || 0) + 
                  (parseFloat(grnFull.shippingHandlingPaid || (grnFull as any).shipping_handling_paid || '0') || 0) + 
                  (parseFloat(grnFull.otherChargesPaid || (grnFull as any).other_charges_paid || '0') || 0)
                )}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          <div>
            <p><strong>Notes:</strong> ${grnFull.notes || 'N/A'}</p>
          </div>
        </div>
      `;
      setPrintContent(htmlContent);
      setPrintTitle(`GRN - ${grnFull.grnNumber || (grnFull as any).grn_number || 'Unknown'}`);
      setIsPrintModalOpen(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to prepare GRN for printing: ${errorMessage}`);
    } finally {
        setIsLoading(false);
    }
  };

  const columns: ColumnDefinition<GrnResponse>[] = useMemo(() => [
    // 1. Date Received
    { 
      Header: 'Date Received', 
      accessor: 'receivedDate', 
      Cell: (item: GrnResponse) => formatDate(item.receivedDate)
    },
    // 2. GRN Number
    { 
      Header: 'GRN Number', 
      accessor: 'grnNumber',
      Cell: (item: GrnResponse) => item.grnNumber
    },
    // 3. Supplier
    { 
      Header: 'Supplier', 
      accessor: 'supplierName', 
      Cell: (item: GrnResponse) => item.supplierName || 'N/A'
    },
    // 4. Total Value (right aligned with currency)
    { 
      Header: 'Total Value', 
      accessor: 'totalReceivedValue', 
      Cell: (item: GrnResponse) => (
        <div className="text-right font-medium">
          {formatCurrency(item.totalReceivedValue || 0)}
        </div>
      ),
      className: 'text-right'
    },
    // 5. Status with icons only
    { 
      Header: 'Status', 
      accessor: 'status',
      className: 'text-center',
      Cell: (item: GrnResponse) => {
        if (item.status === 'COMPLETED') {
          return (
            <div className="flex items-center justify-center" title="Completed">
              <CheckCircle size={18} className="text-green-500" />
            </div>
          );
        } else if (item.status === 'DRAFT') {
          return (
            <div className="flex items-center justify-center" title="Draft">
              <AlertCircle size={18} className="text-amber-500" />
            </div>
          );
        } else if (item.status === 'CANCELLED') {
          return (
            <div className="flex items-center justify-center" title="Cancelled">
              <FileX size={18} className="text-red-500" />
            </div>
          );
        } else {
          return (
            <div className="flex items-center justify-center" title={item.status}>
              <FileText size={18} className="text-blue-500" />
            </div>
          );
        }
      }
    },
    // 7. Actions with dropdown menu
    { 
      Header: 'Actions', 
      accessor: 'id', 
      Cell: (item: GrnResponse) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleViewGrn(item)}>
              <Eye className="mr-2 h-4 w-4 text-blue-500" />
              <span>View</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleEdit(item)}
              disabled={item.status === 'COMPLETED'}
            >
              <Edit3 className="mr-2 h-4 w-4" />
              <span>Edit</span>
            </DropdownMenuItem>
            {/* Change to Draft option removed - simplified workflow */}
            <DropdownMenuItem onClick={() => handlePrintGrn(item)}>
              <Printer className="mr-2 h-4 w-4" />
              <span>Print</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDeleteGrn(item)}
              disabled={item.status === 'POSTED'}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: 'text-center'
    },
  ], [handleViewGrn, handleEdit, handleDeleteGrn, handlePrintGrn, grnItemCounts]);

  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  if (error) return <div className="text-red-500 text-center p-4">Error loading GRNs: {error}</div>;
  
  // No longer need separate noGrnsMessage as we've integrated it into the main return

  const thisMonthGrns = grns.filter(grn => {
    const grnDate = new Date(grn.receivedDate);
    const currentDate = new Date();
    return grnDate.getMonth() === currentDate.getMonth() && grnDate.getFullYear() === currentDate.getFullYear();
  }).length;
  const activeSuppliers = new Set(grns.map(grn => grn.supplierName).filter(Boolean)).size;
  const totalValue = grns.reduce((sum, grn) => {
    const value = grn.totalReceivedValue;
    const numericValue = parseFloat(value as any);
    return sum + (!isNaN(numericValue) ? numericValue : 0);
  }, 0);

  return (
    <TooltipProvider>
      <div className="p-4 sm:p-6 space-y-5 min-h-screen">
        <PageHeader
          icon={FileText}
          title="Goods Receiving Notes"
          subtitle="Record and track goods received from suppliers."
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total GRNs', value: totalGrns, icon: FileText, color: 'text-blue-600' },
            { label: 'This Month', value: thisMonthGrns, icon: CheckCircle, color: 'text-green-600' },
            { label: 'Suppliers', value: activeSuppliers, icon: FileText, color: 'text-indigo-600' },
            { label: 'Total Value', value: formatCurrency(totalValue), icon: DollarSign, color: 'text-emerald-600' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl border border-border border-r-4 border-r-primary/40 bg-card p-3.5"
              >
                <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <UniversalListControls
          searchTerm={searchTerm}
          onSearchChange={(value) => setSearchTerm(value)}
          placeholderText="Search GRNs by number, supplier or date..."
          newButtonText="New GRN"
          onNewButtonClick={handleAddNewGrn}
          showFilterButton={false}
          showExportButton={false}
          showNewButton={true}
          currentPage="goods-received"
        />

        {/* Table container */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 px-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading GRNs…
            </div>
          ) : grns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No Goods Receiving Notes found.</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first GRN to get started.</p>
              <Button onClick={handleAddNewGrn}>Add New GRN</Button>
            </div>
          ) : (
            <ReusableTable<GrnResponse>
              columns={columns}
              data={grns}
              isLoading={false}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              noDataMessage="No Goods Receiving Notes found."
            />
          )}
        </div>

      {/* Add/Edit GRN Modal */}
      {isEditModalOpen && (
        <AddGoodsReceivedModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setGrnToEdit(undefined);
            setViewOnly(false);
          }}
          storeId={user?.storeId || ''}
          tenantId={user?.tenantId || ''}
          onGrnAdded={handleGrnAddedOrUpdated} 
          grnToEdit={grnToEdit}
          viewOnly={viewOnly}
        />
      )}

      {/* Confirmation dialog for deleting GRN */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the Goods Received Note <strong>{grnToDelete?.grnNumber}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeleteGrn} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteGrn} 
              disabled={isDeleting}
              className="bg-danger hover:bg-danger-dark text-white"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Preview Modal */}
      {isPrintModalOpen && (
        <PrintPreviewModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          content={printContent}
          title={printTitle}
        />
      )}
    </div>
    </TooltipProvider>
  );
};

export default GoodsReceivingPage;
