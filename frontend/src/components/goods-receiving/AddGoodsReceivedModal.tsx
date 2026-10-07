import React, { useState, useEffect, useRef, useMemo } from 'react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
// Alert, AlertDescription, AlertTitle were removed as they are no longer used
import { AlertCircle, AlertTriangle, Loader2, PlusCircle, Trash2, XCircle } from 'lucide-react'; 
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

import { getSuppliers } from '@/services/supplierService';
import { searchProducts } from '@/services/productService'; 
import { getPurchaseOrders } from '@/services/purchaseOrderService';
import { grnService } from '@/services/grnService'; 
import { getStoreDetails } from '@/services/api'; 
import { useAuth } from '@/contexts/AuthContext';
import { DatePicker } from '@/components/ui/DatePicker'; 
import NumericInput from '@/components/ui/NumericInput'; 
import SelectPoItemsModal, { GrnItemData as ModalPoItemData } from './SelectPoItemsModal'; 
import { useFormattingBridge } from '../../utils/formatBridge';

// Centralized type imports (assuming @/types/index.ts or similar)
import type { Supplier, Product, PurchaseOrder, CreateGrnData, Store } from '@/types';

// Helper function to parse values for NumericInput
const parseNumericInputValue = (value: string | number): number | undefined => {
  if (typeof value === 'number') {
    return isNaN(value) ? undefined : value;
  }
  if (typeof value === 'string') {
    if (value.trim() === '') return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
};

interface GrnItemUIData {
  clientId: string; // For UI key and local management
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity_received: number;
  unit_cost_price: number;
  tax_rate: number; // In UI, this should always be a number
  line_total: number;
  tax_amount_for_line: number; // Amount of tax for this line
  line_total_with_tax: number; // Line total including tax
  is_tax_amount_direct: boolean; // Flag indicating if tax amount was directly entered (true) or calculated from rate (false)
  purchase_order_item_id?: string; // From PO item if applicable
  purchase_order_id?: string;     // Parent PO ID for linking
  po_number?: string;             // From PO item if applicable
  max_receivable_po_qty?: number; // Max qty that could have been received from PO for this item selection (original pending on PO line)
  // Fields for manual items or future enhancements, not directly from PO item selection modal
  batch_number?: string;
  expiry_date?: Date | null;
  remarks?: string;
  isFromPO: boolean; // To distinguish PO items from manually added ones for UI/logic
}

interface AddGoodsReceivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  tenantId: string;
  onGrnAdded: () => void;
  grnToEdit?: string; // GRN ID for edit mode
  viewOnly?: boolean; // If true, the modal will be in view-only mode (not editable)
}

interface SupplierOption {
  id: string;
  supplierName: string;
}

const AddGoodsReceivedModal = ({ isOpen, onClose, storeId, tenantId, onGrnAdded, grnToEdit, viewOnly = false }: AddGoodsReceivedModalProps): React.ReactNode => {
  // Determine if we're in edit mode or view-only mode
  const isEditMode = !!grnToEdit;
  const isViewMode = viewOnly;
  const { user } = useAuth();
  const manualSearchInputRef = useRef<HTMLInputElement>(null);
  const { formatCurrency } = useFormattingBridge();

  // Form State
  const [grnItems, setGrnItems] = useState<GrnItemUIData[]>([]);
  const [receivedDate, setReceivedDate] = useState<Date | undefined>(new Date());
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState<string>('');
  const [grnNumber, setGrnNumber] = useState<string>('Auto-generated');
  // Simplified GRN status: Always COMPLETED and non-editable
  type GrnStatusType = 'COMPLETED';
  const [status, setStatus] = useState<GrnStatusType>('COMPLETED'); // Always COMPLETED
  
  // Determine if GRN should be read-only (view mode only, since status is always COMPLETED)
  const isGrnReadOnly = useMemo(() => isViewMode, [isViewMode]);
  
  const [totalTaxPaidInput, setTotalTaxPaidInput] = useState<number | string>('');
  const [shippingHandlingPaid, setShippingHandlingPaid] = useState<number | string>('');
  const [otherChargesPaid, setOtherChargesPaid] = useState<number | string>('');

  // Supplier state management
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | undefined>();
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [supplierFetchError, setSupplierFetchError] = useState<string | null>(null);
  
  // Purchase Order state management
  const [availablePos, setAvailablePos] = useState<PurchaseOrder[]>([]); 
  const [isLoadingPOs, setIsLoadingPOs] = useState(false);
  const [poFetchError, setPoFetchError] = useState<string | null>(null);
  const [isSelectPoItemsModalOpen, setIsSelectPoItemsModalOpen] = useState(false);
  
  // Form state management
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [errorMessage, setError] = useState<string | null>(null);
  const [isConfirmCancelModalOpen, setIsConfirmCancelModalOpen] = useState(false);
  
  // GRN loading state for edit mode
  const [isLoadingGrn, setIsLoadingGrn] = useState(false);
  const [grnFetchError, setGrnFetchError] = useState<string | null>(null);
  
  // Product search state management
  const [manualProductSearchTerm, setManualProductSearchTerm] = useState<string>('');
  const [manualSearchResults, setManualSearchResults] = useState<Product[]>([]);
  const [isLoadingManualSearch, setIsLoadingManualSearch] = useState(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);
  
  // Store details state
  const [storeDetails, setStoreDetails] = useState<Store | null>(null);
  const [isLoadingStoreDetails, setIsLoadingStoreDetails] = useState(false);
  const [storeDetailsFetchError, setStoreDetailsFetchError] = useState<string | null>(null);
  
  // Combined loading state for UI that needs a simple isLoading flag
  const isLoading = useMemo(() => {
    return isLoadingSuppliers || 
           isLoadingPOs || 
           isFormSubmitting || 
           isLoadingStoreDetails || 
           isLoadingManualSearch || 
           isLoadingGrn;
  }, [isLoadingSuppliers, isLoadingPOs, isFormSubmitting, isLoadingStoreDetails, isLoadingManualSearch, isLoadingGrn]); 
  // We'll use the currency code directly rather than storing the full store details
  const dirty = useMemo(() => {
    return (
      grnItems.length > 0 || !!selectedSupplier || supplierInvoiceNumber !== '' || notes !== '' || totalTaxPaidInput !== '' || shippingHandlingPaid !== '' || otherChargesPaid !== ''
    );
  }, [grnItems, selectedSupplier, supplierInvoiceNumber, notes, totalTaxPaidInput, shippingHandlingPaid, otherChargesPaid]);

  // Calculated Totals
  const subTotalAmount = grnItems.reduce((acc, item) => acc + item.line_total, 0);
  const totalCalculatedItemTax = grnItems.reduce((acc, item) => acc + item.tax_amount_for_line, 0);
  const finalTotalTaxPaid = parseFloat(totalTaxPaidInput.toString()) || totalCalculatedItemTax;
  const grandTotalCost = 
    subTotalAmount + 
    finalTotalTaxPaid + 
    (parseFloat(shippingHandlingPaid.toString()) || 0) + 
    (parseFloat(otherChargesPaid.toString()) || 0);

  const resetForm = () => {
    setGrnItems([]);
    setReceivedDate(new Date());
    setSupplierInvoiceNumber('');
    setSupplierInvoiceDate(undefined);
    setNotes('');
    setTotalTaxPaidInput('');
    setShippingHandlingPaid('');
    setOtherChargesPaid('');
    setSelectedSupplier(undefined);
    setAvailablePos([]);
    setManualProductSearchTerm('');
    setManualSearchResults([]);
    setError(null);
    setStatus('COMPLETED' as GrnStatusType); // Always COMPLETED
  };

  // Function to load GRN data for editing
  const loadGrnForEditing = async (grnId: string) => {
    try {
      setIsLoadingGrn(true); // Use GRN-specific loading state
      setGrnFetchError(null);
      setError(null);
      
      const grnData = await grnService.getGrnById(grnId, tenantId);
      console.log('Complete GRN data loaded:', grnData);
      
      // Set basic GRN details
      setGrnNumber(grnData.grnNumber || 'Unknown');
      setNotes(grnData.notes || '');
      setSupplierInvoiceNumber(grnData.supplierInvoiceNumber || '');
      
      // Set status from GRN data, but always use COMPLETED in simplified workflow
      const grnStatus = 'COMPLETED' as GrnStatusType;
      setStatus(grnStatus); // Always COMPLETED in simplified workflow
      
      // Handle dates
      if (grnData.receivedDate) {
        setReceivedDate(new Date(grnData.receivedDate));
      }
      
      if (grnData.supplierInvoiceDate) {
        setSupplierInvoiceDate(new Date(grnData.supplierInvoiceDate));
      }
      
      // Set financial details
      setTotalTaxPaidInput(grnData.totalTaxPaid?.toString() || '0');
      setShippingHandlingPaid(grnData.shippingHandlingPaid?.toString() || '0');
      setOtherChargesPaid(grnData.otherChargesPaid?.toString() || '0');
      
      // Set supplier - create a supplier option directly from GRN data
      // Type assertion to handle both camelCase and snake_case properties
      const grnDataAny = grnData as any;
      
      if (grnData.supplierId || grnDataAny.supplier_id) {
        // Handle both camelCase and snake_case property names
        const supplierId = grnData.supplierId || grnDataAny.supplier_id;
        
        // Get supplier name from all possible fields
        let supplierName = 'Unknown Supplier';
        if (grnData.supplierName) supplierName = grnData.supplierName;
        else if (grnDataAny.supplier_name) supplierName = grnDataAny.supplier_name;
        
        console.log('Setting supplier from GRN data', { 
          supplierId, 
          supplierName 
        });
        
        // Create a supplier option with the correct interface
        const supplierOption: SupplierOption = {
          id: supplierId,
          supplierName: supplierName
        };
        
        // Set it directly from the GRN data
        setSelectedSupplier(supplierOption);
        
        // If we're editing (not viewing), fetch additional data
        if (!isViewMode) {
          // Fetch suppliers to populate the dropdown if needed
          const allSuppliers = await getSuppliers({ tenant_id: tenantId });
          console.log('Fetched all suppliers:', allSuppliers.length);
          setSuppliers(allSuppliers.map(s => ({
            id: s.id,
            supplierName: s.supplierName
          })));
          
          // In edit mode, load available purchase orders for the supplier
          // but skip in view-only mode to avoid unnecessary API calls
          if (supplierId && !viewOnly) {
            try {
              const pos = await getPurchaseOrders({ tenant_id: tenantId, supplier_id: supplierId });
              console.log(`Loaded ${pos.length} purchase orders for supplier ${supplierId}`);
              setAvailablePos(pos);
            } catch (err) {
              console.error('Error loading purchase orders for supplier:', err);
              toast.error("Failed to load purchase orders");
            }
          }
        }
      }
      
      // Set items - using type assertion since we're using ExtendedGrnResponse
      console.log('GRN data for item mapping:', grnData);
      
      // Transform to ensure items is always an array
      const transformedResponse: any = {
        ...grnData,
        // Ensure items is always an array
        items: Array.isArray(grnData.items) ? grnData.items : []
      };
      
      console.log('Transformed GRN response:', transformedResponse);
      
      // Add warning if no items found
      if (!transformedResponse.items || transformedResponse.items.length === 0) {
        console.warn('No items found for this GRN. The user will need to add items manually.');
      }
      
      if (transformedResponse.items && Array.isArray(transformedResponse.items)) {
        console.log('GRN items to map:', transformedResponse.items);
        
        const mappedItems: GrnItemUIData[] = transformedResponse.items.map((item: any) => {
          console.log('Mapping GRN item:', item);
          
          // Get product details - handle multiple possible API response formats
          const productId = item.productId || item.product_id || '';
          const productName = item.productName || item.product_name || '';
          const productSku = item.productSku || item.product_sku || '';
          
          // Handle numeric values with proper conversion and fallbacks, using camelCase from API
          const quantityReceived = parseFloat(String(item.quantityReceived || 0));
          const unitCostPrice = parseFloat(String(item.unitCostPrice || 0));
          const taxRate = parseFloat(String(item.taxRate || 0));

          // Calculate line total if not provided
          let lineTotal = parseFloat(String(item.lineTotal || 0));
          if (lineTotal === 0 && quantityReceived && unitCostPrice) {
            lineTotal = quantityReceived * unitCostPrice;
          }

          // Calculate tax amount if not provided
          let taxAmount = parseFloat(String(item.taxAmount || 0));
          if (taxAmount === 0 && lineTotal && taxRate > 0) {
            taxAmount = lineTotal * (taxRate / 100);
          }
          
          const lineTotalWithTax = lineTotal + taxAmount;
          
          // Debug the mapping
          console.log('Item mapping details:', {
            productId,
            productName,
            productSku,
            quantityReceived,
            unitCostPrice,
            taxRate,
            lineTotal,
            taxAmount
          });
          
          return {
            clientId: uuidv4(),
            product_id: productId,
            product_name: productName,
            product_sku: productSku,
            quantity_received: quantityReceived,
            unit_cost_price: unitCostPrice,
            tax_rate: taxRate,
            line_total: lineTotal,
            tax_amount_for_line: taxAmount,
            line_total_with_tax: lineTotalWithTax,
            is_tax_amount_direct: false,
            purchase_order_item_id: item.purchaseOrderItemId || item.purchase_order_item_id,
            purchase_order_id: item.purchaseOrderId || item.purchase_order_id,
            po_number: item.poNumber || item.po_number,
            batch_number: item.batchNumber || item.batch_number || '',
            remarks: item.remarks || '',
            isFromPO: !!(item.purchaseOrderId || item.purchase_order_id),
            expiry_date: item.expiryDate || item.expiry_date ? new Date(item.expiryDate || item.expiry_date) : null,
            max_receivable_po_qty: item.maxReceivablePoQty || item.max_receivable_po_qty || undefined
          };
        });
        
        setGrnItems(mappedItems);
      }
    } catch (err: any) {
      console.error('Error loading GRN for editing:', err);
      const errorMsg = `Failed to load GRN: ${err.message || 'Unknown error'}`;
      setError(errorMsg);
      setGrnFetchError(errorMsg);
      toast.error('Failed to load goods received note data');
    } finally {
      setIsLoadingGrn(false);
    }
  };

  // Consolidated useEffect for loading data when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const loadModalData = async () => {
      // Use more specific loading states instead of a single loading flag
      setIsLoadingStoreDetails(true);
      try {
        setError(null); // Reset general error message
        
        // Always load store details first
        if (storeId) {
          console.log('Loading store details first with store ID:', storeId);
          await loadStoreDetails();
        } else {
          console.log('No store ID provided for details loading');
        }
        
        // Different loading strategy based on mode
        if (grnToEdit) {
          // VIEW or EDIT mode
          console.log('Loading GRN for viewing/editing:', grnToEdit);
          await loadGrnForEditing(grnToEdit);
        } else {
          // CREATE mode
          resetForm(); // Explicitly reset form only when creating a new GRN
          if (user?.tenantId || tenantId) {
            const tenantIdToUse = tenantId || user?.tenantId || '';
            console.log('Loading all suppliers for create mode with tenant ID:', tenantIdToUse);
            
            setIsLoadingSuppliers(true);
            setSupplierFetchError(null);
            try {
              const allSuppliers: Supplier[] = await getSuppliers({ tenant_id: tenantIdToUse });
              console.log('Loaded suppliers for create mode:', allSuppliers);
              
              const supplierOptions: SupplierOption[] = allSuppliers.map(s => ({ 
                id: s.id, 
                supplierName: s.supplierName || (s as any).name || s.id
              }));
              setSuppliers(supplierOptions);
            } catch (error) {
              console.error('Error loading suppliers:', error);
              setSupplierFetchError('Failed to load suppliers. Please try again.');
              toast.error('Error loading suppliers. Please try again.');
            } finally {
              setIsLoadingSuppliers(false);
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading modal data:', err);
        const errorMessage = `Failed to load necessary data: ${err.message || 'Unknown error'}`;
        setError(errorMessage);
        toast.error('Failed to initialize GRN form. Please try again.');
        
        // Make sure we reset form to prevent partial data issues
        resetForm();
      } finally {
        // Clear all loading states to ensure UI isn't stuck in loading state
        setIsLoadingStoreDetails(false);
        setIsLoadingSuppliers(false);
        setIsLoadingPOs(false);
        setIsLoadingGrn(false);
        setIsLoadingManualSearch(false);
      }
    };
    
    loadModalData();
  }, [isOpen, user?.tenantId, grnToEdit, isEditMode, tenantId, storeId]);

  // Load store details including currency
  const loadStoreDetails = async () => {
    setIsLoadingStoreDetails(true);
    setStoreDetailsFetchError(null);
    
    try {
      if (storeId) {
        console.log('Loading store details for store ID:', storeId);
        const details = await getStoreDetails(storeId);
        
        if (!details) {
          throw new Error('No store details returned from API');
        }
        
        console.log('Store details loaded:', details); 
        setStoreDetails(details as Store);
      } else {
        console.log('No storeId provided.');
        setStoreDetailsFetchError('No store ID provided');
      }
    } catch (error) {
      console.error('Failed to load store details:', error);
      setError('Failed to load store details. Please try again.');
      setStoreDetailsFetchError('Failed to load store details');
      toast.error('Error loading store details. Some currency formatting may be unavailable.');
    } finally {
      setIsLoadingStoreDetails(false);
    }
  };

  const handleCloseAttempt = () => {
    // Only show confirmation if user has started entering data
    if (dirty && !isViewMode) {
      setIsConfirmCancelModalOpen(true);
    } else {
      // No changes made, we can just close
      resetForm();
      onClose();
    }
  };

  // Handle supplier selection and load available POs
  const handleSupplierChange = async (supplierId: string) => {
    console.log('Supplier changed to:', supplierId);
    const selected = suppliers.find(s => s.id === supplierId);
    setSelectedSupplier(selected);
    
    // Clear previous items if supplier changes
    setGrnItems(prevItems => prevItems.filter(item => !item.isFromPO));
    
    // Reset available POs immediately to ensure UI is in sync
    setAvailablePos([]);
    
    // Only proceed if we have all required data
    if (!selected || !user?.tenantId || !storeId) {
      console.log('Missing required data to fetch POs', { selected, tenantId: user?.tenantId, storeId });
      return;
    }
    
    console.log('Fetching POs for supplier:', selected.supplierName);
    setIsLoadingPOs(true);
    setPoFetchError(null);
    
    try {
      // Make sure we're using the correct parameter names (snake_case) for the API
      // For GRN creation, we want POs that can receive goods (including DRAFT status)
      const poParams = {
        supplier_id: supplierId,
        tenant_id: user.tenantId || '',
        store_id: storeId,
        for_grn: 'true', // Special flag to get only POs suitable for GRN creation
      };
      
      console.log('PO fetch params:', poParams);
      const pos = await getPurchaseOrders(poParams);
      console.log('Purchase orders fetched:', pos?.length || 0, pos);
      
      // Log any issues with the POs to help with debugging
      if (pos && pos.length > 0) {
        console.log('Sample PO data:', pos[0]);
      } else {
        console.log('No POs found for supplier', supplierId);
      }
      
      // Ensure we always set an array, even if the API returns null/undefined
      setAvailablePos(pos || []);
    } catch (error) {
      console.error('Failed to load POs:', error);
      setError('Failed to load purchase orders for this supplier');
      setPoFetchError('Failed to load purchase orders. Please try again.');
      toast.error('Error loading purchase orders. Please try again.');
      setAvailablePos([]);
    } finally {
      setIsLoadingPOs(false);
    }
  };

  useEffect(() => {
    if (manualProductSearchTerm.trim().length < 2) { setManualSearchResults([]); return; }
    setIsLoadingManualSearch(true);
    const timerId = setTimeout(() => performManualProductSearch(), 500);
    return () => clearTimeout(timerId);
  }, [manualProductSearchTerm, user?.tenantId]);

  const performManualProductSearch = async () => {
    if (!user?.tenantId || manualProductSearchTerm.trim().length < 2) return;
    
    try {
      setIsLoadingManualSearch(true);
      setProductSearchError(null);
      
      console.log('Searching products with term:', manualProductSearchTerm);
      const results = await searchProducts(manualProductSearchTerm, user.tenantId); 
      console.log(`Found ${results?.length || 0} products matching search term`);
      
      setManualSearchResults(results || []);
      
      if (results?.length === 0) {
        console.log('No products found for search term:', manualProductSearchTerm);
      }
    } catch (err) { 
      console.error('Product search error:', err);
      setProductSearchError('Failed to search products. Please try again.');
      toast.error('Failed to search products. Please try again.');
      setManualSearchResults([]);
    } finally { 
      setIsLoadingManualSearch(false); 
    }
  };

  // Enhanced tax calculation that can work with either tax rate or direct tax amount
  const recalculateGrnItemFinancials = (itemData: {
    quantity_received: number;
    unit_cost_price: number;
    tax_rate: number;
    tax_amount_for_line?: number; // Optional direct tax amount input
    is_tax_amount_direct?: boolean; // Flag indicating if tax amount was directly entered
  }): { 
    line_total: number; 
    tax_amount_for_line: number; 
    tax_rate: number; 
    line_total_with_tax: number; 
    is_tax_amount_direct: boolean 
  } => {
    const quantity = itemData.quantity_received || 0;
    const unitCost = itemData.unit_cost_price || 0;
    const lineTotal = quantity * unitCost;
    
    let taxAmount: number;
    let taxRateValue: number;
    const isTaxAmountDirect = itemData.is_tax_amount_direct || false;
    
    if (isTaxAmountDirect && itemData.tax_amount_for_line !== undefined) {
      // If tax amount was directly entered, calculate the equivalent tax rate
      taxAmount = itemData.tax_amount_for_line;
      taxRateValue = lineTotal > 0 ? (taxAmount / lineTotal) * 100 : 0;
    } else {
      // Otherwise use the tax rate to calculate tax amount
      taxRateValue = itemData.tax_rate || 0;
      taxAmount = lineTotal * (taxRateValue / 100);
    }
    
    const lineTotalWithTax = lineTotal + taxAmount;

    return {
      line_total: lineTotal,
      tax_amount_for_line: taxAmount,
      tax_rate: taxRateValue,
      line_total_with_tax: lineTotalWithTax,
      is_tax_amount_direct: isTaxAmountDirect
    };
  };

  const handleGrnItemChange = (clientId: string, field: keyof GrnItemUIData, value: any) => {
    setGrnItems(prevItems => {
      return prevItems.map(item => {
        if (item.clientId === clientId) {
          // Create updated item with the new field value
          const updatedItem = { ...item, [field]: value };
          
          // Handle tax-related fields specially
          if (field === 'tax_amount_for_line') {
            // If tax amount is directly edited, calculate with direct tax amount
            const recalculated = recalculateGrnItemFinancials({
              quantity_received: updatedItem.quantity_received,
              unit_cost_price: updatedItem.unit_cost_price,
              tax_rate: updatedItem.tax_rate,
              tax_amount_for_line: value,
              is_tax_amount_direct: true
            });
            return { ...updatedItem, ...recalculated };
          } else if (field === 'tax_rate') {
            // If tax rate is edited, calculate based on rate
            const recalculated = recalculateGrnItemFinancials({
              quantity_received: updatedItem.quantity_received,
              unit_cost_price: updatedItem.unit_cost_price,
              tax_rate: value,
              is_tax_amount_direct: false
            });
            return { ...updatedItem, ...recalculated };
          } else if (['quantity_received', 'unit_cost_price'].includes(field as string)) {
            // Recalculate all financials when quantity or price changes
            // Preserve whether tax was directly entered or calculated from rate
            const recalculated = recalculateGrnItemFinancials({
              quantity_received: updatedItem.quantity_received,
              unit_cost_price: updatedItem.unit_cost_price,
              tax_rate: updatedItem.tax_rate,
              tax_amount_for_line: updatedItem.tax_amount_for_line,
              is_tax_amount_direct: updatedItem.is_tax_amount_direct
            });
            return { ...updatedItem, ...recalculated };
          }
          
          return updatedItem;
        }
        return item;
      });
    });
  };

  const addManualProductToGrnItems = (product: Product) => {
    const financials = recalculateGrnItemFinancials({
      quantity_received: 0, // Initial quantity
      unit_cost_price: product.costPrice ?? 0,
      tax_rate: 0, // Default tax rate
      is_tax_amount_direct: false // Default to using tax rate
    });

    const newItem: GrnItemUIData = {
      clientId: uuidv4(),
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku || undefined,
      quantity_received: 0,
      unit_cost_price: product.costPrice ?? 0,
      // tax_rate comes from financials
      ...financials,
      purchase_order_item_id: undefined,
      po_number: undefined,
      isFromPO: false,
      batch_number: undefined,
      expiry_date: null,
      remarks: undefined,
    };
    setGrnItems(prevItems => [...prevItems, newItem]);
    setManualProductSearchTerm('');
    setManualSearchResults([]);
    manualSearchInputRef.current?.focus();
  };

  const removeGrnItem = (clientId: string) => {
    setGrnItems(prevItems => prevItems.filter(item => item.clientId !== clientId));
  };

  const handlePoItemsSelected = (selectedPoItems: ModalPoItemData[]) => { 
    const newGrnItems = selectedPoItems.map((item): GrnItemUIData => {
      const quantityReceived = item.quantity_received;
      const unitCostPrice = item.unit_cost_price ?? 0;
      const taxRate = item.tax_rate ?? 0;
      
      const financials = recalculateGrnItemFinancials({
        quantity_received: quantityReceived,
        unit_cost_price: unitCostPrice,
        tax_rate: taxRate,
        is_tax_amount_direct: false // Default to using tax rate
      });

      const maxReceivableForPoItem = (item.quantity_received ?? 0) + (item.quantity_pending ?? 0);

      return {
        clientId: uuidv4(),
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity_received: quantityReceived,
        unit_cost_price: unitCostPrice,
        // tax_rate comes from financials
        ...financials,
        purchase_order_item_id: item.purchase_order_item_id,
        purchase_order_id: item.purchase_order_id, // Store the parent PO ID for linking
        po_number: item.po_number,
        max_receivable_po_qty: maxReceivableForPoItem,
        isFromPO: true,
        batch_number: undefined,
        expiry_date: null,
        remarks: undefined,
      };
    });

    setGrnItems(prevItems => {
      const updatedItems = [...prevItems];
      newGrnItems.forEach(newItem => {
        const existingIndex = updatedItems.findIndex(item => item.isFromPO && item.purchase_order_item_id === newItem.purchase_order_item_id);
        if (existingIndex !== -1) updatedItems[existingIndex] = newItem; 
        else updatedItems.push(newItem);
      });
      return updatedItems;
    });
    
    setIsSelectPoItemsModalOpen(false);
  };
  
  // Create a formatted GRN data object for submission to the API
  const createGrnForSubmission = (): CreateGrnData => {
    // Handle empty string and NaN cases for numeric inputs
    const sanitizeNumeric = (value: string | number): number => {
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return value;
    };

    // Format date for API (YYYY-MM-DD)
    const formatDate = (date: Date | undefined): string => {
      if (!date) return '';
      return format(date, 'yyyy-MM-dd');
    };

    // Find common PO ID if all items have the same purchase order
    let commonPoId: string | null = null;
    if (grnItems.some(item => item.purchase_order_id)) {
      const poIds = new Set<string>();
      
      grnItems.forEach(item => {
        if (item.purchase_order_id) {
          poIds.add(item.purchase_order_id);
        }
      });

      // If all items have the same PO, use that as the GRN's PO reference
      if (poIds.size === 1) {
        const poIdValue = Array.from(poIds)[0];
        commonPoId = poIdValue;
      }
    }

    // Ensure all required fields are present and properly formatted
    return {
      tenant_id: user?.tenantId || '',
      store_id: storeId || '',
      supplier_id: selectedSupplier?.id || '',
      received_date: formatDate(receivedDate),
      supplier_invoice_number: supplierInvoiceNumber || null,
      supplier_invoice_date: supplierInvoiceDate ? formatDate(supplierInvoiceDate) : null,
      notes: notes || null,
      purchase_order_id: commonPoId,
      total_tax_paid: sanitizeNumeric(totalTaxPaidInput),
      shipping_handling_paid: sanitizeNumeric(shippingHandlingPaid),
      other_charges_paid: sanitizeNumeric(otherChargesPaid),
      // Use status from form state
      status: status,
      user_id: user?.id || '',
      received_by_user_id: user?.id || '',
      items: grnItems.map(item => ({
        product_id: item.product_id,
        purchase_order_item_id: item.purchase_order_item_id || null,
        purchase_order_id: item.purchase_order_id || null, // Include item's specific PO ID
        quantity_ordered: item.max_receivable_po_qty || null, // Include ordered quantity from PO
        quantity_received: item.quantity_received,
        batch_number: item.batch_number || null,
        expiry_date: item.expiry_date ? formatDate(item.expiry_date) : null,
        unit_cost_price: item.unit_cost_price,
        tax_rate: item.tax_rate || 0,
        is_tax_amount_direct: !!item.is_tax_amount_direct,
        tax_amount_for_line: item.tax_amount_for_line || 0
      }))
    };
  };
  
  // Validates all GRN form inputs and returns validation errors if any
  const validateGrnForm = (): string | null => {
    // Check required fields
    if (!selectedSupplier || !storeId || !user?.tenantId) {
      return 'Missing required supplier information';
    }

    if (grnItems.length === 0) {
      return 'No items added to GRN';
    }

    if (!receivedDate) {
      return 'GRN date is required';
    }
    
    // If status is COMPLETED, check if invoice details are properly set
    if (status === 'COMPLETED') {
      if (!supplierInvoiceDate) {
        return 'Supplier invoice date is required for COMPLETED GRNs';
      }
    }

    // Check if any financial inputs are negative
    if (Number(totalTaxPaidInput) < 0) {
      return 'Total tax paid cannot be negative';
    }
    
    if (Number(shippingHandlingPaid) < 0) {
      return 'Shipping and handling amount cannot be negative';
    }
    
    if (Number(otherChargesPaid) < 0) {
      return 'Other charges amount cannot be negative';
    }

    // Validate individual items
    for (let i = 0; i < grnItems.length; i++) {
      const item = grnItems[i];
      
      // Check for valid quantities (must be positive numbers)
      if (!item.quantity_received || item.quantity_received <= 0) {
        return `Item #${i+1} (${item.product_name}) has an invalid quantity`;
      }
      
      // Check for valid cost prices (must be non-negative numbers)
      if (item.unit_cost_price === undefined || item.unit_cost_price < 0) {
        return `Item #${i+1} (${item.product_name}) has an invalid cost price`;
      }
      
      // Check for valid tax percentages (must be non-negative numbers)
      if (item.tax_rate === undefined || item.tax_rate < 0) {
        return `Item #${i+1} (${item.product_name}) has an invalid tax rate`;
      }
      
      // Check that products have been properly selected
      if (!item.product_id) {
        return `Item #${i+1} is missing a product selection`;
      }
    }

    // All validations passed
    return null;
  };

  const handleSaveGrn = async () => {
    // Validate the GRN form using our comprehensive validation function
    const validationError = validateGrnForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }
    
    // Show warnings for recommended but not required fields
    if (status === 'COMPLETED') {
      if (!supplierInvoiceNumber) {
        // Just a warning for invoice number - it's recommended but not required
        toast.warning('Supplier invoice number is recommended for COMPLETED GRNs');
      }
      
      // Note: We don't need to check for supplierInvoiceDate here since validateGrnForm 
      // already requires it for COMPLETED status and would have returned an error above
    }
    
    // All validations passed, proceed with save
    setIsFormSubmitting(true); 
    setError(null);

    try {
      // Create the GRN data and submit it
      const grnDataToSubmit = createGrnForSubmission();
      if (isEditMode && grnToEdit) {
        await grnService.updateGrn(grnToEdit, grnDataToSubmit, tenantId);
        toast.success('GRN updated successfully!');
      } else {
        await grnService.createGrn(grnDataToSubmit);
        toast.success('GRN created successfully!');
      }
      
      // Handle the response - First call onGrnAdded to trigger refresh
      onGrnAdded(); 
      
      // Then reset form and close modal
      resetForm(); 
      onClose(); 
    } catch (err: any) { 
      console.error('Failed to save GRN:', err);
      const errorMessage = err.message || 'Failed to save GRN. Please check console for details.';
      setError(errorMessage);
      toast.error(errorMessage); 
    } finally { 
      setIsFormSubmitting(false); 
    }
  };

  const handleConfirmCancel = () => {
    setIsConfirmCancelModalOpen(false);
    resetForm();
    onClose();
  };
  
  const handleCancelConfirmation = () => {
    setIsConfirmCancelModalOpen(false);
  };

  if (!isOpen) return null;
  
  // Status banner for simplified workflow - GRNs are always COMPLETED
  const statusBanner = !isViewMode ? (
    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
      <div className="flex items-center space-x-2">
        <p className="text-sm text-green-700 font-medium">GRN Status: COMPLETED</p>
        <p className="text-xs text-green-600">All GRNs are automatically completed and committed to inventory.</p>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Confirmation Modal */}
      <AlertDialog open={isConfirmCancelModalOpen} onOpenChange={setIsConfirmCancelModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this Goods Received Note. Are you sure you want to close without saving?
              Any changes you've made will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelConfirmation}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel}>Yes, discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Main Modal */}
      <ModalBase 
        title={
          viewOnly ? `View Goods Received Note ${grnNumber}` :
          isEditMode ? `Edit Goods Received Note ${grnNumber}` : 
          "Add New Goods Received Note"
        } 
        isOpen={isOpen} 
        onClose={handleCloseAttempt} 
        size="5xl"
        hideHeaderCloseButton={viewOnly}
        closeOnBackdropClick={false} // Prevent closing on backdrop click
        footerContent={
          viewOnly ? (
            <Button variant="outline" onClick={handleCloseAttempt}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCloseAttempt} disabled={isFormSubmitting}>Cancel</Button>
              <Button 
                onClick={handleSaveGrn} 
                disabled={isFormSubmitting || grnItems.length === 0} 
                className="ml-2"
              >
                {isFormSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save GRN'
                )}
              </Button>
            </>
          )
        }
    >
      <div className="space-y-4">
        {statusBanner}
        {errorMessage && (
          <div className="bg-red-50 p-3 rounded-md border border-red-200 mb-4 flex items-start">
            <AlertCircle className="h-4 w-4 text-red-500 mt-1 mr-2" />
            <div>
              <div className="font-semibold text-red-700">Error</div>
              <div className="text-red-600 text-sm">{errorMessage}</div>
            </div>
          </div>
        )}
        {grnFetchError && !errorMessage && isEditMode && (
          <div className="bg-red-50 p-3 rounded-md border border-red-200 mb-4 flex items-start">
            <AlertCircle className="h-4 w-4 text-red-500 mt-1 mr-2" />
            <div>
              <div className="font-semibold text-red-700">Error Loading GRN</div>
              <div className="text-red-600 text-sm">{grnFetchError}</div>
            </div>
          </div>
        )}
        {storeDetailsFetchError && (
          <div className="bg-amber-50 p-3 rounded-md border border-amber-200 mb-4 flex items-start">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-1 mr-2" />
            <div>
              <div className="font-semibold text-amber-700">Store Details Warning</div>
              <div className="text-amber-600 text-sm">{storeDetailsFetchError} - Currency formatting may be affected.</div>
            </div>
          </div>
        )}

        {/* Row 1: Supplier & PO Button */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 p-3 border-b pb-4">
          <div>
            <Label htmlFor="supplier">Supplier *</Label>
            {isEditMode || isViewMode ? (
              // In edit or view mode, show supplier name as plain text
              <div className="border rounded-md px-3 py-2 bg-muted">
                {selectedSupplier?.supplierName || 'Unknown Supplier'}
              </div>
            ) : (
              // In create mode, show dropdown
              <div className="space-y-2">
                <Select onValueChange={handleSupplierChange} value={selectedSupplier?.id || ''} disabled={isLoadingSuppliers}>
                  <SelectTrigger id="supplier">
                    {isLoadingSuppliers ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading suppliers...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select a supplier" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (<SelectItem key={s.id} value={s.id}>{s.supplierName}</SelectItem>))}
                  </SelectContent>
                </Select>
                {supplierFetchError && (
                  <div className="text-red-500 text-xs mt-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {supplierFetchError}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            {!isViewMode && (
              <>
                <Button 
                  onClick={() => setIsSelectPoItemsModalOpen(true)} 
                  disabled={!selectedSupplier || availablePos.length === 0 || isLoading} 
                  className="mt-6 w-full md:w-auto"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> 
                  {isLoadingPOs ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading POs...
                    </>
                  ) : (
                    `Select from PO(s) (${availablePos.length})`
                  )}
                </Button>
                
                {poFetchError && (
                  <div className="text-red-500 text-xs mt-2 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {poFetchError}
                  </div>
                )}

                {selectedSupplier && availablePos.length === 0 && !isLoadingPOs && !poFetchError && (
                  <div className="text-amber-500 text-xs mt-2 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    No available purchase orders for this supplier. You can still create a direct GRN.
                  </div>
                )}
                
                {selectedSupplier && !isLoading && (
                  <div className="text-muted-foreground text-xs mt-2">
                    {availablePos.length > 0 ? 
                      `${availablePos.length} purchase orders available with status ORDERED or PARTIALLY_RECEIVED` : 
                      "You can add items directly without a purchase order"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* GRN Details Section - 2 Column Layout */}
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-foreground">GRN Details</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-foreground">GRN Number</Label>
                <Input 
                  value={grnNumber} 
                  disabled 
                  className="bg-gray-50 dark:bg-muted/50 text-gray-600 dark:text-muted-foreground"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="receivedDate" className={`text-sm font-medium ${!receivedDate && dirty ? "text-red-600" : "text-gray-700 dark:text-foreground"}`}>
                    Received Date <span className="text-red-500">*</span>
                  </Label>
                  {!receivedDate && dirty && <span className="text-red-500 text-xs font-medium">Required</span>}
                </div>
                {isViewMode ? (
                  <div className="border rounded-md px-3 py-2 bg-gray-50 dark:bg-muted/50 text-gray-600 dark:text-muted-foreground">
                    {receivedDate?.toLocaleDateString() || '-'}
                  </div>
                ) : (
                  <div className={`${!receivedDate && dirty ? "border-red-500" : ""}`}>
                    <DatePicker 
                      date={receivedDate} 
                      setDate={(date) => {
                        // Prevent selecting future dates
                        const today = new Date();
                        if (date && date > today) {
                          toast.warning("GRN date cannot be in the future");
                          return;
                        }
                        setReceivedDate(date);
                      }}
                      className={`w-full ${!receivedDate && dirty ? "border-red-500" : ""}`}
                      disabled={isGrnReadOnly || isLoading} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supplierInvoiceNumber" className={`text-sm font-medium ${status === 'COMPLETED' && !supplierInvoiceNumber && dirty ? "text-amber-600" : "text-gray-700 dark:text-foreground"}`}>
                    Supplier Invoice No. <span className="text-amber-500">*</span>
                  </Label>
                  {status === 'COMPLETED' && !supplierInvoiceNumber && dirty && <span className="text-amber-500 text-xs font-medium">Recommended</span>}
                </div>
                {isViewMode ? (
                  <div className="border rounded-md px-3 py-2 bg-gray-50 dark:bg-muted/50 text-gray-600 dark:text-muted-foreground">
                    {supplierInvoiceNumber || '-'}
                  </div>
                ) : (
                  <Input 
                    id="supplierInvoiceNumber" 
                    value={supplierInvoiceNumber} 
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)} 
                    className={`${status === 'COMPLETED' && !supplierInvoiceNumber && dirty ? "border-amber-500 focus:border-amber-500" : ""}`}
                    disabled={isGrnReadOnly || isLoading}
                    placeholder="Enter invoice number"
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label 
                    htmlFor="supplierInvoiceDate" 
                    className={`text-sm font-medium ${status === 'COMPLETED' && !supplierInvoiceDate && dirty ? (supplierInvoiceNumber ? "text-red-600" : "text-amber-600") : "text-gray-700 dark:text-foreground"}`}
                  >
                    Supplier Invoice Date <span className={supplierInvoiceNumber ? "text-red-500" : "text-amber-500"}>*</span>
                  </Label>
                  {status === 'COMPLETED' && !supplierInvoiceDate && dirty && (
                    <span className={`text-xs font-medium ${supplierInvoiceNumber ? "text-red-500" : "text-amber-500"}`}>
                      {supplierInvoiceNumber ? "Required" : "Recommended"}
                    </span>
                  )}
                </div>
                {isViewMode ? (
                  <div className="border rounded-md px-3 py-2 bg-gray-50 dark:bg-muted/50 text-gray-600 dark:text-muted-foreground">
                    {supplierInvoiceDate?.toLocaleDateString() || '-'}
                  </div>
                ) : (
                  <div className={`${status === 'COMPLETED' && !supplierInvoiceDate && dirty ? (supplierInvoiceNumber ? "border-red-500" : "border-amber-500") : ""}`}>
                    <DatePicker 
                      date={supplierInvoiceDate} 
                      setDate={setSupplierInvoiceDate}
                      disabled={isGrnReadOnly || isLoading}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Manual Product Search */}
        {!isViewMode && (
          <div className="p-3 border-b pb-4 space-y-2">
            <Label htmlFor="manualProductSearch">Add Products Manually</Label>
            <div className="flex items-center space-x-2">
              <Input 
                id="manualProductSearch" 
                ref={manualSearchInputRef} 
                placeholder="Search by name/SKU (min 2 chars)" 
                value={manualProductSearchTerm} 
                onChange={(e) => setManualProductSearchTerm(e.target.value)} 
                disabled={isLoadingManualSearch} 
              />
              {isLoadingManualSearch && <Loader2 className="h-5 w-5 animate-spin ml-2" />}
              {manualProductSearchTerm && <Button variant="ghost" size="icon" onClick={() => {setManualProductSearchTerm(''); setManualSearchResults([]);}}><XCircle className="h-4 w-4"/></Button>}
            </div>

            {/* Error message display */}
            {productSearchError && (
              <div className="text-red-500 text-xs flex items-center mt-1">
                <AlertCircle className="h-3 w-3 mr-1" />
                {productSearchError}
              </div>
            )}
            
            {/* Search results display */}
            {manualSearchResults.length > 0 && (
              <div className="border max-h-40 overflow-y-auto rounded-md mt-2">
                {manualSearchResults.map(p => (
                  <div 
                    key={p.id} 
                    className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center" 
                    onClick={() => addManualProductToGrnItems(p)}
                  >
                    <span>{p.name} ({p.sku})</span>
                    <PlusCircle className="h-5 w-5 text-green-500" />
                  </div>
                ))}
              </div>
            )}
            
            {/* No results message */}
            {!isLoadingManualSearch && manualProductSearchTerm.trim().length >= 2 && manualSearchResults.length === 0 && !productSearchError && (
              <div className="text-amber-500 text-xs flex items-center mt-1">
                <AlertTriangle className="h-3 w-3 mr-1" />
                No products found matching your search. Try a different search term.
              </div>
            )}
          </div>
        )}

        {/* Row 4: GRN Items Table */}
        <div className="p-3 border-b pb-4">
          <h3 className="text-lg font-semibold mb-2">GRN Items ({grnItems.length})</h3>
          {grnItems.length === 0 ? (<p className="text-muted-foreground text-center py-4">No items added.</p>) : (
            <div className="overflow-x-auto -mx-1 px-1">
            <Table className="text-xs min-w-[760px]">
              <TableHeader><TableRow>
                  <TableHead className="w-[15%]">Product</TableHead>
                  <TableHead className="w-[100px]">Qty Rcvd*</TableHead>
                  <TableHead className="w-[100px]">Price*</TableHead>
                  <TableHead className="w-[90px]">Tax %</TableHead>
                  <TableHead className="w-[100px]">Tax Amt</TableHead>
                  <TableHead className="w-[100px]">Batch #</TableHead>
                  <TableHead className="w-[120px]">Expiry</TableHead>
                  <TableHead className="w-[120px] text-right">Line Total</TableHead>
                  <TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoadingGrn && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Loading goods received items...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingGrn && grnItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6">
                      <div className="text-sm text-muted-foreground">
                        No items added yet. {!isViewMode && "Add products using the options above."}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingGrn && grnItems.map((item) => ( 
                <TableRow key={item.clientId}>
                  <TableCell>{item.product_name || item.product_id}<br/><span className="text-xs text-muted-foreground">SKU: {item.product_sku} {item.isFromPO ? `(PO Pend: ${item.max_receivable_po_qty})` : ''}</span></TableCell>
                  <TableCell>
                    {isViewMode ? (
                      <div className="px-2 py-1">{item.quantity_received}</div>
                    ) : (
                      <NumericInput 
                        value={item.quantity_received} 
                        onChange={(newValue) => handleGrnItemChange(item.clientId, 'quantity_received', newValue ?? 0)} 
                        disabled={isGrnReadOnly || isLoading} 
                        className="w-full" 
                        min={0.01}
                        step={1}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {isViewMode ? (
                      <div className="px-2 py-1">{formatCurrency(item.unit_cost_price, storeDetails?.currencyCode)}</div>
                    ) : (
                      <NumericInput 
                        value={item.unit_cost_price} 
                        onChange={(newValue) => handleGrnItemChange(item.clientId, 'unit_cost_price', newValue ?? 0)} 
                        disabled={isGrnReadOnly || isLoading} 
                        className="w-full" 
                        min={0}
                        step={0.01}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {isViewMode ? (
                      <div className="px-2 py-1">{item.tax_rate}%</div>
                    ) : (
                      <NumericInput 
                        value={item.tax_rate} 
                        onChange={(newValue) => handleGrnItemChange(item.clientId, 'tax_rate', newValue ?? 0)} 
                        disabled={isGrnReadOnly || isLoading || item.is_tax_amount_direct} 
                        className="w-full" 
                        min={0}
                        step={0.1}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {isViewMode ? (
                      <div className="px-2 py-1">{formatCurrency(item.tax_amount_for_line, storeDetails?.currencyCode)}</div>
                    ) : (
                      <NumericInput 
                        value={item.tax_amount_for_line} 
                        onChange={(newValue) => handleGrnItemChange(item.clientId, 'tax_amount_for_line', newValue ?? 0)} 
                        disabled={isGrnReadOnly || isLoading || (!item.is_tax_amount_direct && item.isFromPO)} 
                        className="w-full" 
                        min={0}
                        step={0.01}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {isViewMode ? (
                      <div className="px-2 py-1">{item.batch_number || '-'}</div>
                    ) : (
                      <Input value={item.batch_number || ''} onChange={(e) => handleGrnItemChange(item.clientId, 'batch_number', e.target.value)} disabled={isGrnReadOnly || isLoading} placeholder="Optional" className="w-full" />
                    )}
                  </TableCell>
                  <TableCell>
                    {isViewMode ? (
                      <div className="px-2 py-1">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}</div>
                    ) : (
                      <DatePicker 
                        date={item.expiry_date || undefined} 
                        setDate={(d: Date | undefined) => handleGrnItemChange(item.clientId, 'expiry_date', d)} 
                        className="w-full" 
                        disabled={isGrnReadOnly || isLoading}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.line_total, storeDetails?.currencyCode)}</TableCell>
                  <TableCell>
                    {!isViewMode && (
                      <Button variant="ghost" size="icon" onClick={() => removeGrnItem(item.clientId)} disabled={isGrnReadOnly || isLoading}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>

        {/* Row 5: Notes & Summary */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 p-3">
          {/* Left column: Notes/Remarks */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-20"
              disabled={isGrnReadOnly || isLoading}
              placeholder="Add any additional notes about this GRN here..."
            />
          </div>
          
          {/* Right column: Summary & Financial Details */}
          <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
            <h4 className="font-semibold text-lg">Summary</h4>
            
            <div className="space-y-1.5">
              <div className="flex justify-between mb-2"><Label>Total Items:</Label><span>{grnItems.length}</span></div>
              <div className="flex justify-between mb-2">
                <Label>Subtotal:</Label>
                <span className="font-semibold">{formatCurrency(subTotalAmount, storeDetails?.currencyCode)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <Label>Tax Amount:</Label>
                <span className="font-semibold">{formatCurrency(finalTotalTaxPaid, storeDetails?.currencyCode)}</span>
              </div>
            </div>
            
            <hr className="my-2"/>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="totalTaxPaidInput">Total Tax Paid (Override)</Label>
                <div className="flex items-center">
                  <span className="mr-1">{storeDetails?.currencyCode || 'USD'}</span>
                  <NumericInput 
                    id="totalTaxPaidInput" 
                    value={parseNumericInputValue(totalTaxPaidInput)} 
                    onChange={(v) => setTotalTaxPaidInput(v !== null ? v : 0)} 
                    className="w-32" 
                    placeholder="Optional"
                    min={0}
                    step={0.01}
                    disabled={isGrnReadOnly || isLoading}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="shippingHandlingPaid">Shipping & Handling Paid</Label>
                <div className="flex items-center">
                  <span className="mr-1">{storeDetails?.currencyCode || 'USD'}</span>
                  <NumericInput 
                    id="shippingHandlingPaid" 
                    value={parseNumericInputValue(shippingHandlingPaid)} 
                    onChange={(v) => setShippingHandlingPaid(v !== null ? v : 0)} 
                    className="w-32" 
                    placeholder="Optional"
                    min={0}
                    step={0.01}
                    disabled={isGrnReadOnly || isLoading}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="otherChargesPaid">Other Charges Paid</Label>
                <div className="flex items-center">
                  <span className="mr-1">{storeDetails?.currencyCode || 'USD'}</span>
                  <NumericInput 
                    id="otherChargesPaid" 
                    value={parseNumericInputValue(otherChargesPaid)} 
                    onChange={(v) => setOtherChargesPaid(v !== null ? v : 0)} 
                    className="w-32" 
                    placeholder="Optional"
                    min={0}
                    step={0.01}
                    disabled={isGrnReadOnly || isLoading}
                  />
                </div>
              </div>
            </div>
            
            <hr className="my-2"/>
            
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <Label className="text-lg">Grand Total:</Label>
                <span className="font-bold text-xl">{formatCurrency(grandTotalCost, storeDetails?.currencyCode)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form content ends here, buttons are in the modal footer */}
      </div>

      {isSelectPoItemsModalOpen && selectedSupplier && (
        <SelectPoItemsModal
          isOpen={isSelectPoItemsModalOpen}
          onClose={() => setIsSelectPoItemsModalOpen(false)}
          supplier={selectedSupplier} // Pass the whole supplier object
          purchaseOrders={availablePos}
          onConfirmItems={handlePoItemsSelected} // Renamed from onItemsSelected
          existingGrnItems={grnItems.filter(item => !!item.purchase_order_item_id)} // Pass only items that are from a PO
        />
      )}
    </ModalBase>
    </>
  );
};

export default AddGoodsReceivedModal;
