import React, { useState } from 'react';
import { X, Search, Plus, Minus, AlertCircle } from 'lucide-react';
import { salesReturnService, ReturnableItem, SaleInfo, CreateSalesReturnRequest } from '../../services/salesReturnService';
import { getSaleById } from '../../services/salesService';
import { formatCurrency } from '../../utils/locale/currencyUtils';
import { toast } from 'react-hot-toast';

interface ReturnProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ReturnItem {
  original_sale_item_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  original_quantity: number;
  unit_price: number;
  returnable_quantity: number;
  quantity_returned: number;
  condition: string;
  reason: string;
}

export const ReturnProcessingModal: React.FC<ReturnProcessingModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  // State management
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Sale lookup
  const [saleId, setSaleId] = useState('');
  const [saleData, setSaleData] = useState<any>(null);
  const [saleInfo, setSaleInfo] = useState<SaleInfo | null>(null);
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
    setSaleData(null);
    setSaleInfo(null);
    setReturnableItems([]);
    setSelectedItems([]);
    setReturnReason('');
    setReturnReasonNotes('');
    setRefundMethod('');
    setLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Step 1: Sale lookup
  const handleSaleLookup = async () => {
    if (!saleId.trim()) {
      toast.error('Please enter a sale ID');
      return;
    }

    try {
      setLoading(true);
      
      // Get sale details
      const sale = await getSaleById(saleId);
      setSaleData(sale);
      
      // Get returnable items with enhanced data
      const { items, saleInfo } = await salesReturnService.getReturnableItems(saleId);
      setReturnableItems(items);
      setSaleInfo(saleInfo);
      
      if (items.length === 0) {
        toast.error('No returnable items found for this sale');
        return;
      }
      
      setStep(2);
    } catch (error) {
      console.error('Error looking up sale:', error);
      toast.error('Sale not found or no returnable items available');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Add item to return
  const handleAddItem = (item: ReturnableItem) => {
    // Check if already selected
    if (selectedItems.some(si => si.original_sale_item_id === item.id)) {
      toast.error('Item already added to return');
      return;
    }

    const returnItem: ReturnItem = {
      original_sale_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      original_quantity: item.original_quantity,
      unit_price: item.unit_price,
      returnable_quantity: item.returnable_quantity,
      quantity_returned: 1,
      condition: 'New',
      reason: ''
    };

    setSelectedItems([...selectedItems, returnItem]);
    toast.success(`${item.product_name} added to return`);
  };

  // Update item quantity
  const updateItemQuantity = (index: number, newQuantity: number) => {
    const updatedItems = [...selectedItems];
    const item = updatedItems[index];
    
    if (newQuantity > 0 && newQuantity <= item.returnable_quantity) {
      updatedItems[index] = { ...item, quantity_returned: newQuantity };
      setSelectedItems(updatedItems);
    }
  };

  // Update item condition
  const updateItemCondition = (index: number, condition: string) => {
    const updatedItems = [...selectedItems];
    updatedItems[index] = { ...updatedItems[index], condition };
    setSelectedItems(updatedItems);
  };

  // Remove item from return
  const removeItem = (index: number) => {
    const updatedItems = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(updatedItems);
    toast.success('Item removed from return');
  };

  // Calculate total return amount
  const totalReturnAmount = selectedItems.reduce(
    (sum, item) => sum + (item.unit_price * item.quantity_returned), 
    0
  );

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

      const returnRequest: CreateSalesReturnRequest = {
        original_sale_id: saleId,
        customer_id: saleData?.customer_id,
        return_reason: returnReason,
        return_reason_notes: returnReasonNotes,
        refund_method: refundMethod,
        items: selectedItems.map(item => ({
          original_sale_item_id: item.original_sale_item_id,
          quantity: item.quantity_returned,
          condition: item.condition,
          reason: item.reason || returnReason
        }))
      };

      await salesReturnService.createSalesReturn(returnRequest);
      
      toast.success('Sales return processed successfully!');
      onSuccess();
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
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Enter Sale Information</h3>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">Sale ID or Receipt Number</label>
                    <input
                      type="text"
                      value={saleId}
                      onChange={(e) => setSaleId(e.target.value)}
                      placeholder="Enter sale ID..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      onKeyPress={(e) => e.key === 'Enter' && handleSaleLookup()}
                    />
                  </div>
                  <button
                    onClick={handleSaleLookup}
                    disabled={loading}
                    className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Search size={16} />
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {saleData && (
                <div className="bg-gray-50 dark:bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Sale Found</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-muted-foreground">Receipt:</span> {saleData.receipt_number}
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-muted-foreground">Total:</span> {formatCurrency(saleData.total)}
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-muted-foreground">Customer:</span> {saleData.customer_name || 'Walk-in'}
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-muted-foreground">Date:</span> {new Date(saleData.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Item Selection */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Sale Information Header */}
              {saleInfo && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold mb-2 text-blue-900">Sale Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-primary">Sale ID:</span>
                      <div className="font-medium text-blue-900">{saleInfo.id.slice(0, 8)}...</div>
                    </div>
                    <div>
                      <span className="text-primary">Subtotal:</span>
                      <div className="font-medium text-blue-900">{formatCurrency(saleInfo.subtotal)}</div>
                    </div>
                    <div>
                      <span className="text-primary">Tax:</span>
                      <div className="font-medium text-blue-900">{formatCurrency(saleInfo.tax_amount)}</div>
                    </div>
                    <div>
                      <span className="text-primary">Total:</span>
                      <div className="font-medium text-blue-900">{formatCurrency(saleInfo.total_amount)}</div>
                    </div>
                    {saleInfo.discount_amount > 0 && (
                      <div>
                        <span className="text-primary">Discount:</span>
                        <div className="font-medium text-green-600">-{formatCurrency(saleInfo.discount_amount)}</div>
                      </div>
                    )}
                    {saleInfo.customer_name && (
                      <div>
                        <span className="text-primary">Customer:</span>
                        <div className="font-medium text-blue-900">{saleInfo.customer_name}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Available Items */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Available Items for Return ({returnableItems.length})</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {returnableItems.map((item) => (
                    <div key={item.id} className="border border-gray-200 dark:border-border rounded-lg p-4 hover:bg-gray-50 dark:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-lg">{item.product_name || 'Unknown Product'}</h4>
                              {item.product_description && (
                                <p className="text-sm text-gray-600 dark:text-muted-foreground">{item.product_description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleAddItem(item)}
                              disabled={selectedItems.some(si => si.original_sale_item_id === item.id)}
                              className="flex items-center justify-center w-10 h-10 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                              title={selectedItems.some(si => si.original_sale_item_id === item.id) ? 'Already added' : 'Add to return'}
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                          
                          {/* Product Details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                            <div>
                              <span className="text-gray-500 dark:text-muted-foreground">SKU:</span>
                              <div className="font-medium">{item.product_sku || 'N/A'}</div>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-muted-foreground">Category:</span>
                              <div className="font-medium">{item.category_name || 'Uncategorized'}</div>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-muted-foreground">Original Qty:</span>
                              <div className="font-medium">{item.original_quantity}</div>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-muted-foreground">Available to Return:</span>
                              <div className="font-medium text-green-600">{item.returnable_quantity}</div>
                            </div>
                          </div>

                          {/* Pricing Information */}
                          <div className="bg-gray-100 dark:bg-muted p-3 rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-muted-foreground">Unit Price:</span>
                                <div className="font-medium">{formatCurrency(item.unit_price)}</div>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-muted-foreground">Total Price:</span>
                                <div className="font-medium">{formatCurrency(item.total_price || (item.unit_price * item.original_quantity))}</div>
                              </div>
                              {item.item_tax > 0 && (
                                <div>
                                  <span className="text-gray-500 dark:text-muted-foreground">Tax:</span>
                                  <div className="font-medium">{formatCurrency(item.item_tax)}</div>
                                </div>
                              )}
                              {item.item_discount > 0 && (
                                <div>
                                  <span className="text-gray-500 dark:text-muted-foreground">Discount:</span>
                                  <div className="font-medium text-green-600">-{formatCurrency(item.item_discount)}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Already Returned Warning */}
                          {item.total_returned > 0 && (
                            <div className="mt-3 bg-yellow-50 border border-yellow-200 p-2 rounded text-sm">
                              <span className="text-yellow-800">
                                ⚠️ {item.total_returned} units already returned from this item
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Items to Return ({selectedItems.length})</h4>
                  <div className="space-y-3">
                    {selectedItems.map((item, index) => (
                      <div key={index} className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-sm text-gray-600 dark:text-muted-foreground">
                              SKU: {item.product_sku} | Max returnable: {item.returnable_quantity}
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
                              onClick={() => updateItemQuantity(index, item.quantity_returned - 1)}
                              disabled={item.quantity_returned <= 1}
                              className="w-8 h-8 rounded-full bg-gray-200 dark:bg-muted hover:bg-gray-300 disabled:opacity-50 flex items-center justify-center"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity_returned}</span>
                            <button
                              onClick={() => updateItemQuantity(index, item.quantity_returned + 1)}
                              disabled={item.quantity_returned >= item.returnable_quantity}
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
                              <option value="New">New</option>
                              <option value="Used">Used</option>
                              <option value="Damaged">Damaged</option>
                              <option value="Defective">Defective</option>
                            </select>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-muted-foreground">Amount</div>
                            <div className="font-medium">
                              {formatCurrency(item.unit_price * item.quantity_returned)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Return Amount:</span>
                      <span className="text-xl font-bold text-blue-900">{formatCurrency(totalReturnAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
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
                  <option value="Defective">Defective Product</option>
                  <option value="Wrong Item">Wrong Item Received</option>
                  <option value="Customer Changed Mind">Customer Changed Mind</option>
                  <option value="Damaged">Damaged During Shipping</option>
                  <option value="Not as Described">Not as Described</option>
                  <option value="Other">Other</option>
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
                  <option value="Original Payment Method">Original Payment Method</option>
                  <option value="Cash">Cash</option>
                  <option value="Store Credit">Store Credit</option>
                  <option value="Exchange">Exchange</option>
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
                    <span>{selectedItems.reduce((sum, item) => sum + item.quantity_returned, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total products:</span>
                    <span>{selectedItems.reduce((sum, item) => sum + item.quantity_returned, 0)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg border-t pt-2">
                    <span>Total refund amount:</span>
                    <span>{formatCurrency(totalReturnAmount)}</span>
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
                disabled={step === 1 && !saleData || step === 2 && selectedItems.length === 0}
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
