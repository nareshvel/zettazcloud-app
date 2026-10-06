import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Product } from '@/types';
import DynamicProductFields from '../inventory/DynamicProductFields';
import { v4 as uuidv4 } from 'uuid';

interface POSQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: Product) => void;
  tenantId: string;
  storeId?: string;
}

const POSQuickAddModal: React.FC<POSQuickAddModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  tenantId,
  storeId,
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [attributes, setAttributes] = useState<Record<string, any>>({});
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!name.trim()) { setError('Item name is required.'); return; }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) { setError('Enter a valid price.'); return; }

    const customProduct: Product = {
      id: `custom-${uuidv4()}`,
      tenantId,
      storeId: storeId ?? null,
      name: name.trim(),
      price: parsedPrice,
      stockQuantity: 9999,
      isActive: true,
      trackInventory: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attributes,
    } as unknown as Product;

    onAdd(customProduct);
    // Reset
    setName('');
    setPrice('');
    setAttributes({});
    setError('');
    onClose();
  };

  const handleClose = () => {
    setName('');
    setPrice('');
    setAttributes({});
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-card rounded-xl shadow-2xl border border-gray-200 dark:border-border w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-border">
          <h3 className="text-base font-semibold text-gray-900 dark:text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Quick Add Item
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Gold Ring, Custom Item"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg text-sm bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">
              Price <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setError(''); }}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg text-sm bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Industry-specific dynamic fields */}
          <DynamicProductFields value={attributes} onChange={setAttributes} />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-border flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-border text-gray-700 dark:text-foreground text-sm font-medium hover:bg-gray-50 dark:hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSQuickAddModal;
