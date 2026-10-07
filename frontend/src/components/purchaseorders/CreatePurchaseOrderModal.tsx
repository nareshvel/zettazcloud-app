import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, CalendarDays, Search } from 'lucide-react'; 
import ModalBase from '@/components/ui/ModalBase'; 

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Types from @/types
import type { Supplier, Product, PurchaseOrder, PurchaseOrderCreationStatus } from '@/types';

// Service functions and data interfaces from ../../services/*
import { 
  NewPurchaseOrderData, 
  NewPurchaseOrderItemData
} from '../../services/purchaseOrderService';
import { getSuppliers } from '../../services/supplierService';
import { getProducts } from '../../services/productService';

import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useFormattingBridge } from '../../utils/formatBridge';

export type PurchaseOrderModalMode = 'create' | 'edit' | 'view';

export interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: NewPurchaseOrderData) => void;
  existingPurchaseOrder?: PurchaseOrder | null;
  mode?: PurchaseOrderModalMode;
}

interface FormPurchaseOrderItem extends Omit<NewPurchaseOrderItemData, 'product_id'> {
  product_id: string;
  product_name?: string; 
  product_sku?: string;
}

const parseLocalDateString = (dateString: string): Date | undefined => {
  if (!dateString) return undefined;
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    // Check for NaN to ensure parts are valid numbers
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  // Fallback for invalid dateString format, or log an error
  console.warn('Invalid date string for parseLocalDateString:', dateString);
  return new Date(dateString); // Attempt direct parsing as a fallback, though it might be UTC-based
};

const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  existingPurchaseOrder, 
  mode: explicitMode 
}) => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const { formatCurrency } = useFormattingBridge();

  const [editingCostPrice, setEditingCostPrice] = useState<{ index: number; value: string } | null>(null);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [status, setStatus] = useState<PurchaseOrderCreationStatus>('DRAFT'); 
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<FormPurchaseOrderItem[]>([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const productSearchInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveMode = explicitMode || (existingPurchaseOrder ? 'edit' : 'create');
  const isViewMode = effectiveMode === 'view';

  const fetchInitialData = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      const tenantIdStr = String(user.tenantId);
      const [suppliersData, productsData] = await Promise.all([
        getSuppliers({ tenant_id: tenantIdStr }),
        getProducts({ tenant_id: tenantIdStr })
      ]);
      setSuppliers(suppliersData || []);
      setProducts(productsData || []);
      setFilteredProducts(productsData || []);
    } catch (error) {
      console.error('Failed to fetch initial data for PO modal:', error);
      toast.error('Could not load suppliers or products.');
    }
  }, [user?.tenantId]);

  // useEffect for fetching initial data (suppliers, products)
  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen, fetchInitialData]);

  // useEffect for initializing form fields based on mode, existing PO, and fetched data
  useEffect(() => {
    if (isOpen) {
      // Set initial state based on mode and existingPurchaseOrder
      setSelectedSupplierId(effectiveMode !== 'create' && existingPurchaseOrder ? existingPurchaseOrder.supplierId || '' : '');
      setPurchaseOrderNumber(effectiveMode !== 'create' && existingPurchaseOrder ? existingPurchaseOrder.purchase_order_number || '' : '');
      setOrderDate(
        effectiveMode !== 'create' && existingPurchaseOrder?.order_date 
          ? new Date(existingPurchaseOrder.order_date).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0]
      );
      setExpectedDeliveryDate(
        effectiveMode !== 'create' && existingPurchaseOrder?.expectedDeliveryDate 
          ? new Date(existingPurchaseOrder.expectedDeliveryDate).toISOString().split('T')[0] 
          : ''
      );
      setStatus(effectiveMode !== 'create' && existingPurchaseOrder ? (existingPurchaseOrder.status as PurchaseOrderCreationStatus || 'DRAFT') : 'DRAFT');
      setNotes(effectiveMode !== 'create' && existingPurchaseOrder ? existingPurchaseOrder.notes || '' : '');

      if (effectiveMode !== 'create' && existingPurchaseOrder?.items) {
        const poItems = existingPurchaseOrder.items.map((apiItem: any) => {
          const productId = apiItem.productId;
          const quantityOrdered = apiItem.quantityOrdered ?? 0;
          const costPrice = apiItem.costPrice ?? 0;
          // Ensure products array is available before trying to find productDetails
          const productDetails = products && products.length > 0 ? products.find(p => p.id === productId) : null;
          return {
            product_id: productId,
            quantity_ordered: quantityOrdered,
            cost_price: costPrice,
            product_name: productDetails?.name || 'Unknown Product',
            product_sku: productDetails?.sku || '',
            line_total: quantityOrdered * costPrice,
          };
        });
        setItems(poItems);
      } else {
        setItems([]); // Clear items for create mode or if no items exist
      }
    }
    // State reset on close is implicitly handled by component re-mounting due to conditional rendering in parent.
    // If the modal were always mounted and only hidden/shown, explicit reset logic in an 'else' block here would be more relevant.
  }, [isOpen, effectiveMode, existingPurchaseOrder, products, suppliers]);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(
        products.filter(p => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, products]);

  const handleAddItem = (product: Product) => {
    if (items.find(item => item.product_id === product.id)) {
      toast.error(`${product.name} is already in the order.`);
      return;
    }
    setItems([...items, { 
      product_id: product.id, 
      quantity_ordered: 1, 
      cost_price: product.costPrice || 0 
    }]);
    setSearchTerm(''); 
    productSearchInputRef.current?.focus();
  };

  const handleItemChange = (index: number, field: keyof FormPurchaseOrderItem, value: string | number) => {
    const newItems = [...items];
    if (field === 'cost_price') {
      const numericValue = Number(value);
      (newItems[index] as any)[field] = !isNaN(numericValue) ? numericValue : 0;
    } else if (field === 'quantity_ordered') {
      const qty = parseInt(String(value), 10);
      (newItems[index] as any)[field] = isNaN(qty) || qty < 0 ? 0 : qty; 
    } else {
      (newItems[index] as any)[field] = value;
    }
    setItems(newItems);
  };

  const handleCostPriceBlur = (index: number) => {
    if (editingCostPrice && editingCostPrice.index === index) {
      let numericValue = parseFloat(editingCostPrice.value);
      if (isNaN(numericValue) || numericValue < 0) {
        numericValue = 0;
      }
      // Use standard 2 decimal places for currency
      const roundedValue = parseFloat(numericValue.toFixed(2));
      handleItemChange(index, 'cost_price', roundedValue);
      setEditingCostPrice(null);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity_ordered * item.cost_price), 0);
  };

  const subtotal = calculateSubtotal();
  const taxRate = 0.0; 
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  const handleSubmitInternal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); 
    if (!selectedSupplierId) {
      toast.error('Please select a supplier.');
      return;
    }
    if (!expectedDeliveryDate) {
      toast.error('Please select an expected delivery date.');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item to the purchase order.');
      return;
    }

    setIsSubmitting(true);
    const poData: NewPurchaseOrderData = {
      tenant_id: user!.tenantId!,
      store_id: user?.store?.id, 
      supplier_id: selectedSupplierId,
      purchase_order_number: purchaseOrderNumber, 
      order_date: new Date(orderDate).toISOString(),
      expected_delivery_date: new Date(expectedDeliveryDate).toISOString(),
      status,
      notes,
      items: items.map(item => ({ 
        product_id: item.product_id,
        quantity_ordered: Number(item.quantity_ordered),
        cost_price: Number(item.cost_price)
      })),
    };

    try {
      await onSave(poData);
    } catch (error) {
      console.error('Failed to save purchase order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    switch (effectiveMode) {
      case 'view': return 'View Purchase Order';
      case 'edit': return 'Edit Purchase Order';
      case 'create':
      default: return 'Create Purchase Order';
    }
  };
  const modalTitle = getModalTitle();

  const modalFooterContent = (
    <>
      <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
        {isViewMode ? 'Close' : 'Cancel'}
      </Button>
      <Button onClick={() => handleSubmitInternal()} disabled={isSubmitting || !selectedSupplierId || items.length === 0 || isViewMode}>
        {effectiveMode === 'edit' ? 'Save Changes' : (effectiveMode === 'create' ? 'Create Purchase Order' : 'View Purchase Order')}
      </Button>
    </>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      footerContent={modalFooterContent}
      size="4xl" 
    >
      <form onSubmit={handleSubmitInternal} className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <div className="form-group">
            <label htmlFor="supplier">Supplier *</label>
            {existingPurchaseOrder ? (
              <Input
                type="text"
                id="supplier"
                value={suppliers.find(s => s.id === selectedSupplierId)?.supplierName || (selectedSupplierId ? 'Loading supplier...' : 'N/A')}
                disabled
                className="w-full mt-1"
              />
            ) : (
              <Select
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
                disabled={isSubmitting || isViewMode}
              >
                <SelectTrigger id="supplier" className="w-full">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <label htmlFor="poNumber" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">PO Number</label>
            <Input
              type="text"
              id="poNumber"
              value={purchaseOrderNumber}
              onChange={(e) => setPurchaseOrderNumber(e.target.value)}
              placeholder={isViewMode ? '' : "Optional (auto-generated if blank)"}
              disabled={isSubmitting || isViewMode || (effectiveMode === 'edit' && !!existingPurchaseOrder && existingPurchaseOrder.status !== 'DRAFT' && existingPurchaseOrder.purchase_order_number !== '')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <div>
            <label htmlFor="orderDate" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Order Date *</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !orderDate && "text-muted-foreground"
                  )}
                  disabled={isSubmitting || isViewMode}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {orderDate ? format(parseLocalDateString(orderDate) || new Date(), "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={parseLocalDateString(orderDate)}
                  onSelect={(date) => setOrderDate(date ? format(date, 'yyyy-MM-dd') : '')}
                  initialFocus
                  disabled={isViewMode}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label htmlFor="expectedDeliveryDate" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Expected Delivery Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expectedDeliveryDate && "text-muted-foreground"
                  )}
                  disabled={isSubmitting || isViewMode}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {expectedDeliveryDate ? format(parseLocalDateString(expectedDeliveryDate) || new Date(), "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={parseLocalDateString(expectedDeliveryDate)}
                  onSelect={(date) => setExpectedDeliveryDate(date ? format(date, 'yyyy-MM-dd') : '')}
                  initialFocus
                  disabled={isViewMode}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Status *</label>
            <Select value={status} onValueChange={(value) => setStatus(value as PurchaseOrderCreationStatus)} disabled={isSubmitting || isViewMode}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ORDERED">Ordered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Notes</label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isViewMode ? '' : "Enter any notes for this purchase order"}
              disabled={isSubmitting || isViewMode}
              className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 dark:border-border rounded-md"
              rows={3}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-border">
          <label htmlFor="productSearch" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Add Products</label>
           <div className="flex items-center">
            <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  id="productSearch"
                  ref={productSearchInputRef}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by product name or SKU..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  disabled={isSubmitting || isViewMode}
                />
            </div>
          </div>
          {searchTerm && filteredProducts.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-border rounded-md bg-white dark:bg-card shadow-lg z-10">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => handleAddItem(product)} 
                  className="px-4 py-2 hover:bg-gray-100 dark:bg-muted cursor-pointer text-sm"
                >
                  {product.name} ({product.sku}) - {formatCurrency(product.costPrice || 0)}
                </div>
              ))}
            </div>
          )}
          {searchTerm && filteredProducts.length === 0 && (
             <p className="text-sm text-gray-500 dark:text-muted-foreground mt-2">No products found matching "{searchTerm}".</p>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-6 flow-root">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-foreground sm:pl-0">Product</th>
                      <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-foreground">Quantity</th>
                      <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-foreground">Cost Price</th>
                      <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-foreground">Line Total</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:bg-card">
                    {items.map((item, index) => {
                      return (
                        <tr key={`${item.product_id}-${index}`}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-foreground sm:pl-0">
                            {isViewMode ? (
                              <Input type="text" value={item.product_name || item.product_id} disabled className="w-full" />
                            ) : (
                              <Select 
                                value={item.product_id}
                                onValueChange={(value) => handleItemChange(index, 'product_id', value)}
                                disabled={isViewMode}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-muted-foreground text-right">
                            <Input
                              type="number"
                              value={item.quantity_ordered}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'quantity_ordered', e.target.value)} 
                              className="w-full text-right"
                              placeholder="Qty"
                              disabled={isSubmitting || isViewMode}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-muted-foreground text-right">
                            <input
                              type="text" 
                              value={editingCostPrice?.index === index ? editingCostPrice.value : Number(item.cost_price || 0).toFixed(2)}
                              onFocus={(e) => setEditingCostPrice({ index, value: e.target.value })}
                              onChange={(e) => setEditingCostPrice({ index, value: e.target.value })}
                              onBlur={() => handleCostPriceBlur(index)}
                              className="w-28 px-2 py-1 border border-gray-300 dark:border-border rounded-md text-right sm:text-sm"
                              disabled={isSubmitting || isViewMode}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-muted-foreground text-right">
                            {formatCurrency(item.quantity_ordered * item.cost_price)}
                          </td>
                          <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                            {effectiveMode !== 'view' && (
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} disabled={isSubmitting} className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-border">
            <div className="w-full max-w-sm ml-auto space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-muted-foreground">Subtotal:</span>
                    <span className="font-medium text-gray-900 dark:text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-muted-foreground">Tax ({taxRate * 100}%):</span>
                    <span className="font-medium text-gray-900 dark:text-foreground">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-300 dark:border-border">
                    <span className="text-gray-900 dark:text-foreground">Grand Total:</span>
                    <span className="text-gray-900 dark:text-foreground">{formatCurrency(grandTotal)}</span>
                </div>
            </div>
          </div>
        )}
      </form>
    </ModalBase>
  );
};

export default CreatePurchaseOrderModal;
