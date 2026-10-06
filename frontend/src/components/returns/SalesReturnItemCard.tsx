import React from 'react';
import { Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/locale/currencyUtils';

interface SalesReturnItemCardProps {
  item: {
    id: string;
    product_name: string;
    product_sku: string;
    product_description?: string;
    category_name?: string;
    original_quantity: number;
    unit_price: number;
    total_price?: number;
    item_tax?: number;
    item_discount?: number;
    total_returned: number;
    returnable_quantity: number;
    net_unit_price?: number;
    tax_per_unit?: number;
  };
  onAddItem: (item: any) => void;
  isSelected?: boolean;
}

export const SalesReturnItemCard: React.FC<SalesReturnItemCardProps> = ({
  item,
  onAddItem,
  isSelected = false
}) => {
  // Ensure we have fallback values for display
  const productName = item.product_name || 'Unknown Product';
  const productSku = item.product_sku || 'N/A';
  const categoryName = item.category_name || 'Uncategorized';
  const originalQty = item.original_quantity || 0;
  const returnableQty = item.returnable_quantity || 0;
  const unitPrice = item.unit_price || 0;
  const totalPrice = item.total_price || (unitPrice * originalQty);
  const itemTax = item.item_tax || 0;
  const itemDiscount = item.item_discount || 0;
  const totalReturned = item.total_returned || 0;

  return (
    <div className="border border-gray-200 dark:border-border rounded-lg p-4 hover:bg-gray-50 dark:bg-muted/50 transition-colors">
      {/* Header with Product Name and Add Button */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-lg text-gray-900 dark:text-foreground">{productName}</h4>
          {item.product_description && (
            <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">{item.product_description}</p>
          )}
        </div>
        <button
          onClick={() => onAddItem(item)}
          disabled={isSelected || returnableQty <= 0}
          className="flex items-center justify-center w-10 h-10 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
          title={isSelected ? 'Already added' : returnableQty <= 0 ? 'No quantity available' : 'Add to return'}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Product Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
        <div>
          <span className="text-gray-500 dark:text-muted-foreground">SKU:</span>
          <div className="font-medium">{productSku}</div>
        </div>
        <div>
          <span className="text-gray-500 dark:text-muted-foreground">Category:</span>
          <div className="font-medium">{categoryName}</div>
        </div>
        <div>
          <span className="text-gray-500 dark:text-muted-foreground">Original Qty:</span>
          <div className="font-medium">{originalQty}</div>
        </div>
        <div>
          <span className="text-gray-500 dark:text-muted-foreground">Available to Return:</span>
          <div className="font-medium text-green-600">{returnableQty}</div>
        </div>
      </div>

      {/* Pricing Information */}
      <div className="bg-gray-100 dark:bg-muted p-3 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-muted-foreground">Unit Price:</span>
            <div className="font-medium">{formatCurrency(unitPrice)}</div>
          </div>
          <div>
            <span className="text-gray-500 dark:text-muted-foreground">Total Price:</span>
            <div className="font-medium">{formatCurrency(totalPrice)}</div>
          </div>
          {itemTax > 0 && (
            <div>
              <span className="text-gray-500 dark:text-muted-foreground">Tax:</span>
              <div className="font-medium">{formatCurrency(itemTax)}</div>
            </div>
          )}
          {itemDiscount > 0 && (
            <div>
              <span className="text-gray-500 dark:text-muted-foreground">Discount:</span>
              <div className="font-medium text-green-600">-{formatCurrency(itemDiscount)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Already Returned Warning */}
      {totalReturned > 0 && (
        <div className="mt-3 bg-yellow-50 border border-yellow-200 p-2 rounded text-sm">
          <span className="text-yellow-800">
            ⚠️ {totalReturned} units already returned from this item
          </span>
        </div>
      )}

      {/* No Return Available Warning */}
      {returnableQty <= 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 p-2 rounded text-sm">
          <span className="text-red-800">
            ❌ No units available for return
          </span>
        </div>
      )}
    </div>
  );
};

export default SalesReturnItemCard;
