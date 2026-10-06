import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, Minus, Loader2, Receipt } from 'lucide-react';
import { salesReturnService, ReturnableItem, SaleInfo, CreateSalesReturnRequest } from '../../services/salesReturnService';
import { getSaleById, searchSales, SaleSearchResult } from '../../services/salesService';
import { formatCurrency } from '../../utils/locale/currencyUtils';
import { toast } from 'sonner';

interface ReturnProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdId?: string) => void;
  presetQuery?: string;
  presetRecordId?: string;
}

interface ReturnItem {
  originalSaleItemId: string;
  productId: string;
  productName: string;
  productSku: string;
  originalQuantity: number;
  unitPrice: number;
  returnableQuantity: number;
  quantityReturned: number;
  condition: string;
  reason: string;
  finalPricePerUnit: number;
  discountPerUnit: number;
  taxPerUnit: number;
}

export const ReturnProcessingModal: React.FC<ReturnProcessingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  presetQuery,
  presetRecordId
}) => {
  // State for the modal's multi-step process
  // State management
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Sale lookup — search-as-you-type by receipt #, customer name,
  // email, or phone (see salesController.js's searchSales), not a raw
  // internal sale ID that nobody at a register has memorized.
  const [saleId, setSaleId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SaleSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presetHandledRef = useRef(false);
  const autoSelectAttemptedRef = useRef(false);
  const [initialSaleData, setInitialSaleData] = useState<any>(null); // For Step 1 display
  const [saleInfo, setSaleInfo] = useState<SaleInfo | null>(null); // For Step 2 display
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);

  // Step 2: Item selection
  const [selectedItems, setSelectedItems] = useState<ReturnItem[]>([]);

  // Step 3: Return details
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnReasonNotes, setReturnReasonNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState<string>('');

  // Reset modal state
  const resetModal = () => {
    setStep(1);
    setSaleId('');
    setSearchQuery('');
    setSearchResults([]);
    setInitialSaleData(null);
    setSaleInfo(null);
    setReturnableItems([]);
    setSelectedItems([]);
    setReturnReason('');
    setReturnReasonNotes('');
    setRefundMethod('');
    setLoading(false);
    presetHandledRef.current = false;
    autoSelectAttemptedRef.current = false;
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Debounced live search as the cashier types.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchSales(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Arriving from the Sales Hub with a preset query — pre-fill the search
  // box and fire the search immediately (no debounce wait) so results are
  // already showing when the modal opens.
  useEffect(() => {
    if (!isOpen || !presetQuery || presetHandledRef.current) return;
    presetHandledRef.current = true;
    setSearchQuery(presetQuery);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setIsSearching(true);
    (async () => {
      const results = await searchSales(presetQuery);
      setSearchResults(results);
      setIsSearching(false);
    })();
  }, [isOpen, presetQuery]);

  // If the Hub already told us exactly which sale the cashier wants and
  // results have loaded with exactly one match on that id, skip straight to
  // it. If the id isn't found or results are ambiguous, leave the list for
  // the cashier to tap — never error or block.
  useEffect(() => {
    if (!isOpen || !presetRecordId || autoSelectAttemptedRef.current) return;
    if (isSearching) return;
    if (searchResults.length === 0) return;
    autoSelectAttemptedRef.current = true;
    if (searchResults.length === 1 && searchResults[0].id === presetRecordId) {
      handleSelectSale(searchResults[0]);
    }
  }, [isOpen, presetRecordId, isSearching, searchResults]);

  // Step 1: pick a sale from search results, then load its returnable items.
  const handleSelectSale = async (result: SaleSearchResult) => {
    try {
      setLoading(true);
      setSaleId(result.id);

      const sale = await getSaleById(result.id);
      setInitialSaleData(sale);

      const { items, saleInfo } = await salesReturnService.getReturnableItems(result.id);
      setReturnableItems(items || []);
      setSaleInfo(saleInfo);

      if (items.length === 0) {
        toast.error('No returnable items found for this sale');
        return;
      }

      setStep(2);
    } catch (error) {
      console.error('Error looking up sale:', error);
      toast.error('Unable to load this sale. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Add item to return
  const handleAddItem = (item: ReturnableItem) => {
    // Check if already selected
    if (selectedItems.some(si => si.originalSaleItemId === item.id)) {
      toast.error('Item already added to return');
      return;
    }
    // Ensure item has returnable qty
    if (!item.returnableQuantity || item.returnableQuantity <= 0) {
      toast.error('No quantity available to return for this item');
      return;
    }

    const returnItem: ReturnItem = {
      originalSaleItemId: item.id,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      originalQuantity: item.originalQuantity,
      unitPrice: item.unitPrice,
      returnableQuantity: item.returnableQuantity,
      quantityReturned: Math.min(1, item.returnableQuantity || 0),
      condition: 'new',
      reason: '',
      finalPricePerUnit: item.finalPricePerUnit || item.unitPrice,
      discountPerUnit: item.discountPerUnit || 0,
      taxPerUnit: item.taxPerUnit || 0,
    };

    setSelectedItems([...selectedItems, returnItem]);
    toast.success(`${item.productName} added to return`);
  };

  // Update item quantity
  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > selectedItems[index].returnableQuantity) return;
    
    const updatedItems = [...selectedItems];
    updatedItems[index].quantityReturned = newQuantity;
    setSelectedItems(updatedItems);
  };

  // Update item condition
  const updateItemCondition = (index: number, condition: string) => {
    const updatedItems = [...selectedItems];
    updatedItems[index].condition = condition;
    setSelectedItems(updatedItems);
  };

  // Remove item from return
  const removeItem = (index: number) => {
    const updatedItems = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(updatedItems);
    toast.success('Item removed from return');
  };

  // Calculate total return amount
  const totalReturnAmount = selectedItems.reduce((sum, item) => {
    const itemAmount = (item.finalPricePerUnit || item.unitPrice || 0) * (item.quantityReturned || 0);
    return sum + (isNaN(itemAmount) ? 0 : itemAmount);
  }, 0);

  // Step 3: Process return
  const handleProcessReturn = async () => {
    if (!returnReason) {
      toast.error('Please select a return reason');
      return;
    }

    if (!refundMethod) {
      toast.error('Please select a refund method');
      return;
    }

    try {
      setLoading(true);
      // silent

      const returnRequest: CreateSalesReturnRequest = {
        original_sale_id: saleId,
        customer_id: initialSaleData?.customerId,
        return_reason: returnReason,
        return_reason_notes: returnReasonNotes,
        refund_method: refundMethod,
        items: selectedItems.map(item => ({
          original_sale_item_id: item.originalSaleItemId,
          product_id: item.productId,
          quantity_returned: item.quantityReturned,
          // send full per-unit economics
          base_unit_price: item.unitPrice || 0,
          discount_per_unit: item.discountPerUnit || 0,
          tax_per_unit: item.taxPerUnit || 0,
          unit_price: (item.finalPricePerUnit ?? item.unitPrice) || 0, // final unit refund
          return_condition: item.condition,
          restockable: item.condition === 'new'
        }))
      };

      const created = await salesReturnService.createReturn(returnRequest);
      
      toast.success('Sales return processed successfully!');
      onSuccess(created?.id);
      handleClose();
      
    } catch (error) {
      console.error('Error processing return:', error);
      toast.error('Failed to process return. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Process Sales Return - Step {step} of 3</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center p-4 border-b bg-gray-50 dark:bg-muted/50">
          <div className="flex items-center space-x-8">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-primary' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-300'}`}>
                1
              </div>
              <span>Sale Lookup</span>
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? 'bg-primary' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-primary' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-300'}`}>
                2
              </div>
              <span>Item Selection</span>
            </div>
            <div className={`w-16 h-1 ${step >= 3 ? 'bg-primary' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-primary' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary text-white' : 'bg-gray-300'}`}>
                3
              </div>
              <span>Return Details</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Sale Lookup */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Find the Sale</h3>
                <p className="text-sm text-gray-500 dark:text-muted-foreground mb-4">
                  Search by receipt number, customer name, email, or phone.
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/60" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search receipt #, name, email, or phone…"
                    autoFocus
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary/60" size={18} />
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-muted-foreground py-8">
                    No completed sales match "{searchQuery}".
                  </div>
                )}
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelectSale(result)}
                    disabled={loading}
                    className="w-full flex items-center justify-between gap-4 p-3 rounded-lg border border-primary/15 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt className="text-primary" size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-primary-900 dark:text-foreground truncate">
                          {result.documentNumber || result.id.slice(0, 8)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-muted-foreground truncate">
                          {result.customerName?.trim() || 'Walk-in'}
                          {result.customerPhone ? ` · ${result.customerPhone}` : ''}
                          {result.customerEmail ? ` · ${result.customerEmail}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-primary-900 dark:text-foreground">{formatCurrency(result.total)}</div>
                      <div className="text-xs text-gray-500 dark:text-muted-foreground">
                        {new Date(result.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Step 2: Item Selection */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Sale Information Header */}
            {saleInfo && (
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/15">
                <h3 className="text-lg font-semibold mb-2 text-primary-900 dark:text-foreground">Sale Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-primary">Receipt:</span>
                    <div className="font-medium text-primary-900 dark:text-foreground">
                      {initialSaleData?.documentNumber || saleInfo.id.slice(0, 8) + '...'}
                    </div>
                  </div>
                  <div>
                    <span className="text-primary">Subtotal:</span>
                    <div className="font-medium text-primary-900 dark:text-foreground">{formatCurrency(saleInfo.subtotal)}</div>
                  </div>
                  <div>
                    <span className="text-primary">Tax:</span>
                    <div className="font-medium text-primary-900 dark:text-foreground">{formatCurrency(saleInfo.taxAmount)}</div>
                  </div>
                  <div>
                    <span className="text-primary">Total:</span>
                    <div className="font-medium text-primary-900 dark:text-foreground">{formatCurrency(saleInfo.totalAmount)}</div>
                  </div>
                  <div>
                    <span className="text-primary">Discount:</span>
                    <div className="font-medium text-emerald-600">
                      {saleInfo.discountAmount > 0 ? `-${formatCurrency(saleInfo.discountAmount)}` : formatCurrency(0)}
                    </div>
                  </div>
                  {saleInfo.customerName && (
                    <div>
                      <span className="text-primary">Customer:</span>
                      <div className="font-medium text-primary-900 dark:text-foreground">{saleInfo.customerName}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Available Items */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Available Items for Return ({returnableItems.length})</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {returnableItems
                  .filter((item) => (item.returnableQuantity ?? 0) > 0)
                  .map((item) => {
                    const alreadySelected = selectedItems.some(si => si.originalSaleItemId === item.id);
                    const canAdd = (item.returnableQuantity ?? 0) > 0 && !alreadySelected;
                    return (
                      <div key={item.id} className="border border-gray-200 dark:border-border rounded-lg p-4 hover:bg-gray-50 dark:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-lg">{item.productName || 'Unknown Product'}</h4>
                                {item.productDescription ? (
                                  <p className="text-sm text-gray-600 dark:text-muted-foreground">{item.productDescription}</p>
                                ) : null}
                              </div>
                              <button
                                onClick={() => handleAddItem(item)}
                                disabled={!canAdd}
                                className="flex items-center justify-center w-10 h-10 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                                title={alreadySelected ? 'Already added' : ((item.returnableQuantity ?? 0) <= 0 ? 'No quantity available' : 'Add to return')}
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            </div>

                            {/* Product Details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                              <div>
                                <span className="text-gray-500 dark:text-muted-foreground">SKU:</span>
                                <div className="font-medium">{item.productSku || 'N/A'}</div>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-muted-foreground">Category:</span>
                                <div className="font-medium">{item.categoryName || 'Uncategorized'}</div>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-muted-foreground">Original Qty:</span>
                                <div className="font-medium">{item.originalQuantity}</div>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-muted-foreground">Available:</span>
                                <div className="font-medium text-green-600">{item.returnableQuantity}</div>
                              </div>
                            </div>

                            {/* Pricing Information */}
                            <div className="bg-gray-100 dark:bg-muted p-3 rounded-lg">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <span className="text-gray-500 dark:text-muted-foreground">Unit Price:</span>
                                  <div className="font-medium">{formatCurrency(item.unitPrice)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-muted-foreground">Discount/Unit:</span>
                                  <div className="font-medium text-green-600">-{formatCurrency(item.discountPerUnit || 0)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-muted-foreground">Tax/Unit:</span>
                                  <div className="font-medium">{formatCurrency(item.taxPerUnit || 0)}</div>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-muted-foreground">Refund Price/Unit:</span>
                                  <div className="font-bold text-primary">{formatCurrency(item.finalPricePerUnit || item.unitPrice)}</div>
                                </div>
                              </div>
                            </div>

                            {/* Already Returned Warning */}
                            {item.totalReturned > 0 ? (
                              <div className="mt-3 bg-yellow-50 border border-yellow-200 p-2 rounded text-sm">
                                <span className="text-yellow-800">
                                  Previously returned: {item.totalReturned} units
                                </span>
                                <div className="text-xs text-yellow-600 mt-1">
                                  Available to return: {item.returnableQuantity}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {selectedItems.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-3">Items to Return ({selectedItems.length})</h4>
                  <div className="space-y-3">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-sm text-gray-500 dark:text-muted-foreground">
                              SKU: {item.productSku} | Max returnable: {item.returnableQuantity}
                            </div>
                          </div>
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Remove item"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Quantity:</span>
                            <button
                              onClick={() => updateItemQuantity(index, item.quantityReturned - 1)}
                              disabled={item.quantityReturned <= 1}
                              className="w-8 h-8 rounded-full bg-gray-200 dark:bg-muted hover:bg-gray-300 disabled:opacity-50 flex items-center justify-center"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantityReturned}</span>
                            <button
                              onClick={() => updateItemQuantity(index, item.quantityReturned + 1)}
                              disabled={item.quantityReturned >= item.returnableQuantity}
                              className="w-8 h-8 rounded-full bg-gray-200 dark:bg-muted hover:bg-gray-300 disabled:opacity-50 flex items-center justify-center"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm">Condition:</span>
                            <select
                              value={item.condition}
                              onChange={(e) => updateItemCondition(index, e.target.value)}
                              className="px-2 py-1 border border-gray-300 dark:border-border rounded text-sm"
                            >
                              <option value="new">New</option>
                              <option value="used">Used</option>
                              <option value="damaged">Damaged</option>
                              <option value="defective">Defective</option>
                            </select>
                          </div>

                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-muted-foreground">Amount</div>
                            <div className="font-medium">
                              {(() => {
                                const amount = (item.finalPricePerUnit || item.unitPrice || 0) * (item.quantityReturned || 0);
                                return formatCurrency(isNaN(amount) ? 0 : amount);
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Return Amount:</span>
                      <span className="text-xl font-bold text-blue-900">{formatCurrency(isNaN(totalReturnAmount) ? 0 : totalReturnAmount)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
  {/* Step 3: Return Details */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Return Details</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">Return Reason *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a reason...</option>
                  <option value="defective">Defective Product</option>
                  <option value="wrong_item">Wrong Item Received</option>
                  <option value="customer_change_mind">Customer Changed Mind</option>
                  <option value="damaged">Damaged During Shipping</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Refund Method *</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select refund method...</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="store_credit">Store Credit</option>
                  <option value="exchange">Exchange</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Additional Notes</label>
                <textarea
                  value={returnReasonNotes}
                  onChange={(e) => setReturnReasonNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter any additional notes..."
                />
              </div>

              <div className="bg-gray-50 dark:bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Return Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Items to return:</span>
                    <span>{selectedItems.reduce((sum, item) => sum + (item.quantityReturned || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total products:</span>
                    <span>{selectedItems.reduce((sum, item) => sum + (item.quantityReturned || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg border-t pt-2">
                    <span>Total refund amount:</span>
                    <span>{formatCurrency(isNaN(totalReturnAmount) ? 0 : totalReturnAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 dark:bg-muted/50">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-gray-600 dark:text-muted-foreground hover:text-gray-800 dark:text-foreground transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 dark:text-muted-foreground hover:text-gray-800 dark:text-foreground transition-colors"
            >
              Cancel
            </button>
            
            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !initialSaleData) || (step === 2 && selectedItems.length === 0)}
                className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            )}
            
            {step === 3 && (
              <button
                onClick={handleProcessReturn}
                disabled={loading || !returnReason || !refundMethod}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Process Return'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnProcessingModal;
