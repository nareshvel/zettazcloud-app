import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { searchProducts } from '../../services/productService';
import stockAdjustmentService, { StockAdjustmentPayload } from '../../services/stockAdjustmentService';
import { Product } from '@/types';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, Loader2, Search as SearchIcon, X } from 'lucide-react';
import { DatePicker } from '@/components/ui/DatePicker';

const REASON_CODES = [
  { value: 'CORRECTION', label: 'Stock Count Correction' },
  { value: 'DAMAGED', label: 'Damaged Goods' },
  { value: 'SPOILAGE', label: 'Spoilage/Expired' },
  { value: 'THEFT', label: 'Theft/Shrinkage' },
  { value: 'RECEIVED_STOCK', label: 'Received New Stock (Manual)' },
  { value: 'RETURN_TO_VENDOR', label: 'Return to Vendor' },
  { value: 'PROMOTION_ADJ', label: 'Promotional Adjustment' },
  { value: 'INITIAL_STOCK', label: 'Initial Stock Setup' },
  { value: 'OTHER', label: 'Other (Specify in Notes)' },
];

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToAdjust?: Product | null;
  onAdjustmentSuccess?: (adjustedProduct: Product) => void;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  productToAdjust,
  onAdjustmentSuccess,
}) => {
  const { user } = useAuth();
  const allowNegativeStock = useMemo(() => user?.store?.allowNegativeStock === true, [user]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [quantity, setQuantity] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'INCREMENT' | 'DECREMENT'>('INCREMENT');
  const [adjustmentDate, setAdjustmentDate] = useState<Date | undefined>(() => {
    const today = new Date();
    // Normalize to local start of day to avoid next-day shifts
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0].value);
  const [notes, setNotes] = useState('');
  const [calculatedNewStock, setCalculatedNewStock] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const resetFormState = useCallback(() => {
    setSearchTerm('');
    setSearchedProducts([]);
    setSelectedProduct(null);
    setQuantity('');
    setAdjustmentType('INCREMENT');
    setAdjustmentDate(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    });
    setReasonCode(REASON_CODES[0].value);
    setNotes('');
    setCalculatedNewStock(null);
    setError(null);
    setSuccessMessage(null);
    setQuantityError(null);
    setDateError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (productToAdjust) {
        setSelectedProduct(productToAdjust);
        setCalculatedNewStock(productToAdjust.stockQuantity);
      } else {
        searchInputRef.current?.focus();
      }
    } else {
      resetFormState(); 
    }
  }, [isOpen, productToAdjust, resetFormState]);
  

  useEffect(() => {
    if (selectedProduct) {
      const currentStock = selectedProduct.stockQuantity;
      const adjQty = parseFloat(quantity);

      // Validate quantity
      if (quantity && (isNaN(adjQty) || adjQty <= 0)) {
        setQuantityError('Please enter a valid positive number');
        setCalculatedNewStock(currentStock);
        return;
      } else {
        setQuantityError(null);
      }
      
      setCalculatedNewStock(adjustmentType === 'INCREMENT' ? currentStock + adjQty : currentStock - adjQty);
    } else {
      setCalculatedNewStock(null);
      setQuantityError(null);
    }
  }, [selectedProduct, quantity, adjustmentType]);

  // Date validation
  useEffect(() => {
    if (adjustmentDate) {
      const selectedDate = new Date(adjustmentDate);
      selectedDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day
      
      if (selectedDate.getTime() > today.getTime()) {
        setDateError('Adjustment date cannot be in the future');
      } else {
        setDateError(null);
      }
    }
  }, [adjustmentDate]);

  const handleSearch = useCallback(async (currentSearchTerm: string) => {
    if (!currentSearchTerm.trim() || productToAdjust) {
      setSearchedProducts([]);
      return;
    }
    if (!user?.tenantId) {
      setError('User session missing. Please log in again.');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setIsSearching(true);
    try {
      const products = await searchProducts(currentSearchTerm, user.tenantId);
      setSearchedProducts(products || []);
      if (currentSearchTerm.trim() && (!products || products.length === 0)) {
        setError('No products found matching your search.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.response?.data?.message || err.message || 'Search failed');
      setSearchedProducts([]);
    } finally {
      setIsSearching(false);
    }
  }, [user, productToAdjust]);

  useEffect(() => {
    if (productToAdjust || !searchTerm.trim() || selectedProduct) {
      setSearchedProducts([]); 
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, productToAdjust, selectedProduct, handleSearch]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setSearchedProducts([]);
    setError(null);
    setCalculatedNewStock(product.stockQuantity); 
    setQuantity(''); 
  };

  const handleClearSelectedProduct = () => {
    setSelectedProduct(null);
    setQuantity('');
    setCalculatedNewStock(null);
    setError(null);
    setSuccessMessage(null);
    if (searchInputRef.current) {
        searchInputRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !user?.id) {
      setError('Product and user information are required.');
      return;
    }
    
    // Validate form before submission
    if (quantityError || dateError) {
      setError('Please fix the validation errors before submitting.');
      return;
    }
    
    const adjQty = parseFloat(quantity);
    if (isNaN(adjQty) || adjQty <= 0) {
      setQuantityError('Please enter a valid positive quantity.');
      return;
    }

    if (calculatedNewStock !== null && calculatedNewStock < 0 && !allowNegativeStock) {
      setError('This adjustment would result in negative stock, which is not allowed.');
      return;
    }

    if (dateError) {
      setError('Please select a valid adjustment date.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const payload: StockAdjustmentPayload = {
      productId: selectedProduct.id,
      adjustmentType,
      quantity: adjQty,
      reasonCode,
      adjustmentDate: (adjustmentDate ? new Date(adjustmentDate) : new Date()).toISOString(), 
      notes: notes || undefined,
    };

    try {
      const response = await stockAdjustmentService.createAdjustment(payload);
      console.log('[StockAdjustmentModal] createAdjustment response:', response);
      const hasAfter = response && typeof response.stockAfterAdjustment === 'number';
      setSuccessMessage(
        hasAfter
          ? `Stock for ${selectedProduct.name} adjusted successfully. New quantity: ${response.stockAfterAdjustment}`
          : `Stock for ${selectedProduct.name} adjusted successfully.`
      );

      const updatedProduct: Product = {
        ...selectedProduct,
        stockQuantity: hasAfter ? response.stockAfterAdjustment : selectedProduct.stockQuantity,
      };

      if (onAdjustmentSuccess) {
        onAdjustmentSuccess(updatedProduct);
      }
      setTimeout(() => {
        onClose(); 
      }, 2000); 
    } catch (err: any) {
      console.error('Adjustment error:', err);
      setError(err.response?.data?.message || err.message || 'Stock adjustment failed.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const modalTitle = productToAdjust 
    ? `Adjust Stock: ${productToAdjust.name}` 
    : selectedProduct 
    ? `Adjust Stock: ${selectedProduct.name}` 
    : 'Adjust Stock';

  const renderProductSearch = () => (
    <div className="mb-4">
      <label htmlFor="productSearch" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Search Product</label>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-muted-foreground" />
        <Input
          id="productSearch"
          ref={searchInputRef}
          type="text"
          placeholder="Enter product name or SKU"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          disabled={!!productToAdjust}
        />
      </div>
      {isSearching && <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">Searching...</p>}
      {searchedProducts.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto border rounded-md bg-white dark:bg-card shadow">
          {searchedProducts.map((p) => (
            <li key={p.id} onClick={() => handleSelectProduct(p)} className="p-2 hover:bg-gray-100 dark:bg-muted cursor-pointer border-b last:border-b-0">
              {p.name} (SKU: {p.sku || 'N/A'}) - Stock: {isNaN(Number(p.stockQuantity)) ? 'N/A' : Number(p.stockQuantity)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderSelectedProductInfo = () => selectedProduct && (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
        <div className="flex justify-between items-start">
            <div className="flex-1">
                <div className="flex items-center mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-primary font-bold text-lg">
                            {selectedProduct.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-900 text-lg">{selectedProduct.name}</h4>
                        <p className="text-sm text-primary">
                            SKU: {selectedProduct.sku || 'N/A'} • 
                            Category: {selectedProduct.categoryName || 'N/A'}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    <div className="bg-white dark:bg-card p-3 rounded-md border border-blue-100">
                        <p className="text-xs font-medium text-primary uppercase tracking-wide">Current Stock</p>
                        <p className="text-xl font-bold text-blue-900">
                            {isNaN(Number(selectedProduct.stockQuantity)) ? 'N/A' : Number(selectedProduct.stockQuantity)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-card p-3 rounded-md border border-blue-100">
                        <p className="text-xs font-medium text-primary uppercase tracking-wide">Low Stock Threshold</p>
                        <p className="text-xl font-bold text-blue-900">
                            {selectedProduct.lowStockThreshold && !isNaN(Number(selectedProduct.lowStockThreshold)) 
                                ? Number(selectedProduct.lowStockThreshold) 
                                : 'Not set'}
                        </p>
                    </div>
                </div>
            </div>
            {!productToAdjust && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearSelectedProduct} 
                    className="text-blue-500 hover:text-primary hover:bg-blue-100 ml-2 flex-shrink-0"
                >
                    <X size={16} className="mr-1" /> Change Product
                </Button>
            )}
        </div>
    </div>
  );

  const renderAdjustmentForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quantity Input */}
      <div>
        <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
          Quantity to Adjust <span className="text-red-500">*</span>
        </label>
        <Input 
          id="quantity" 
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="0.01"
          step="0.01"
          placeholder="Enter quantity"
          className={`w-full ${quantityError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
          required 
        />
        {quantityError && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <AlertCircle size={14} className="mr-1" /> {quantityError}
          </p>
        )}
      </div>

      {/* Adjustment Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-3">
          Adjustment Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            adjustmentType === 'INCREMENT' 
              ? 'border-green-500 bg-green-50 text-green-700' 
              : 'border-gray-200 dark:border-border hover:border-gray-300'
          }`}>
            <Input 
              type="radio" 
              name="adjustmentType" 
              value="INCREMENT" 
              checked={adjustmentType === 'INCREMENT'} 
              onChange={() => setAdjustmentType('INCREMENT')} 
              className="mr-2 w-4 h-4 text-green-600 focus:ring-green-500" 
            />
            <span className="font-medium">Add Stock</span>
          </label>
          <label className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
            adjustmentType === 'DECREMENT' 
              ? 'border-red-500 bg-red-50 text-red-700' 
              : 'border-gray-200 dark:border-border hover:border-gray-300'
          }`}>
            <Input 
              type="radio" 
              name="adjustmentType" 
              value="DECREMENT" 
              checked={adjustmentType === 'DECREMENT'} 
              onChange={() => setAdjustmentType('DECREMENT')} 
              className="mr-2 w-4 h-4 text-red-600 focus:ring-red-500" 
            />
            <span className="font-medium">Remove Stock</span>
          </label>
        </div>
      </div>

      {/* Calculated New Stock Display */}
      {selectedProduct && calculatedNewStock !== null && !quantityError && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Current Stock</p>
              <p className="text-lg font-bold text-blue-900">
                  {isNaN(Number(selectedProduct.stockQuantity)) ? 'N/A' : Number(selectedProduct.stockQuantity)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-primary">
                {adjustmentType === 'INCREMENT' ? '+' : '-'} {quantity && !isNaN(Number(quantity)) ? quantity : '0'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-primary">New Stock</p>
              <p className={`text-lg font-bold ${
                calculatedNewStock < 0 && !allowNegativeStock 
                  ? 'text-red-600' 
                  : (selectedProduct.lowStockThreshold && calculatedNewStock < selectedProduct.lowStockThreshold)
                    ? 'text-orange-600' 
                    : 'text-green-600'
              }`}>
                {calculatedNewStock !== null && !isNaN(calculatedNewStock) ? calculatedNewStock : 'N/A'}
              </p>
            </div>
          </div>
          {calculatedNewStock < 0 && !allowNegativeStock && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle size={14} className="mr-1" /> This will result in negative stock
            </p>
          )}
        </div>
      )}

      {/* Adjustment Date */}
      <div>
        <label htmlFor="adjustmentDate" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
          Adjustment Date <span className="text-red-500">*</span>
        </label>
        <DatePicker 
          date={adjustmentDate}
          setDate={setAdjustmentDate}
          className={`w-full ${dateError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        />
        {dateError && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <AlertCircle size={14} className="mr-1" /> {dateError}
          </p>
        )}
      </div>

      {/* Reason Code */}
      <div>
        <label htmlFor="reasonCode" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
          Reason for Adjustment <span className="text-red-500">*</span>
        </label>
        <Select value={reasonCode} onValueChange={setReasonCode} required>
          <SelectTrigger id="reasonCode" className="w-full">
            <SelectValue placeholder="Select a reason for this adjustment" />
          </SelectTrigger>
          <SelectContent>
            {REASON_CODES.map(reason => (
              <SelectItem key={reason.value} value={reason.value}>
                {reason.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
          Notes <span className="text-gray-500 dark:text-muted-foreground">(Optional)</span>
        </label>
        <Textarea 
          id="notes" 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          placeholder="Add any additional notes about this adjustment..." 
          className="w-full resize-none"
          rows={3}
        />
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 flex items-center">
            <AlertCircle size={16} className="mr-2 flex-shrink-0" /> {error}
          </p>
        </div>
      )}
      
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 flex items-center">
            <CheckCircle size={16} className="mr-2 flex-shrink-0" /> {successMessage}
          </p>
        </div>
      )}
    </form>
  );

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg"
      footerContent={
        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isLoading}
            className="px-4 py-2"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              isLoading || 
              !!successMessage || 
              !selectedProduct || 
              !quantity || 
              !!quantityError || 
              !!dateError ||
              (calculatedNewStock !== null && calculatedNewStock < 0 && !allowNegativeStock)
            }
            className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-400"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Adjust Stock
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="max-h-[70vh] overflow-y-auto p-1 pr-3"> 
        {!productToAdjust && !selectedProduct && renderProductSearch()}
        {selectedProduct && renderSelectedProductInfo()}
        {selectedProduct && renderAdjustmentForm()}
        {!selectedProduct && !productToAdjust && !searchedProducts.length && !isSearching && (
            <p className="text-center text-gray-500 dark:text-muted-foreground py-8">Search for a product to begin adjustment.</p>
        )}
      </div>
    </ModalBase>
  );
};

export default StockAdjustmentModal;
