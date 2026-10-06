import React, { useState, useEffect } from 'react';
import { Category } from '@/types';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';

export interface ProductFilters {
  categories: string[];
  stockStatus: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  activeStatus: 'all' | 'active' | 'inactive';
  priceRange: {
    min: number | '';
    max: number | '';
  };
}

const defaultFilters: ProductFilters = {
  categories: [],
  stockStatus: 'all',
  activeStatus: 'all',
  priceRange: {
    min: '',
    max: ''
  }
};

interface ProductFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: ProductFilters) => void;
  categories: Category[];
  currentFilters: ProductFilters;
}

const ProductFilterModal: React.FC<ProductFilterModalProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  categories,
  currentFilters
}) => {
  const [filters, setFilters] = useState<ProductFilters>(currentFilters || defaultFilters);

  useEffect(() => {
    if (isOpen) {
      setFilters(currentFilters || defaultFilters);
    }
  }, [isOpen, currentFilters]);

  const handleCategoryChange = (categoryId: string) => {
    setFilters(prev => {
      const newCategories = prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId];
      
      return {
        ...prev,
        categories: newCategories
      };
    });
  };

  const handleStockStatusChange = (status: ProductFilters['stockStatus']) => {
    setFilters(prev => ({
      ...prev,
      stockStatus: status
    }));
  };

  const handleActiveStatusChange = (status: ProductFilters['activeStatus']) => {
    setFilters(prev => ({
      ...prev,
      activeStatus: status
    }));
  };

  const handlePriceChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? '' : Number(value);
    
    setFilters(prev => ({
      ...prev,
      priceRange: {
        ...prev.priceRange,
        [type]: numValue
      }
    }));
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
  };

  const handleApplyFilters = () => {
    onApplyFilters(filters);
    onClose(); // ModalBase will handle closing via its own onClose, but this ensures filter application logic is complete
  };

  const modalFooter = (
    <div className="flex justify-end space-x-2">
      <Button variant="outline" onClick={handleClearFilters}>
        Clear Filters
      </Button>
      <Button onClick={handleApplyFilters}>
        Apply Filters
      </Button>
    </div>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Products"
      size="4xl"
      footerContent={modalFooter}
    >
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[calc(80vh-150px)] overflow-y-auto">
        {/* Categories */}
        <div className="bg-blue-50 p-3 rounded-md">
          <h4 className="font-medium text-blue-800 mb-2 border-b border-blue-200 pb-1">Categories</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {categories.length > 0 ? (
              categories.map(category => (
                <div key={category.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`category-${category.id}`}
                    checked={filters.categories.includes(category.id)}
                    onChange={() => handleCategoryChange(category.id)}
                    className="mr-2 h-4 w-4 rounded border-blue-300 text-primary focus:ring-ring"
                  />
                  <label htmlFor={`category-${category.id}`} className={`text-sm ${filters.categories.includes(category.id) ? 'text-primary font-medium' : 'text-primary'}`}>
                    {category.name}
                  </label>
                </div>
              ))
            ) : (
              <p className="text-primary italic text-sm">No categories available</p>
            )}
          </div>
        </div>

        {/* Stock Status */}
        <div className="bg-green-50 p-3 rounded-md">
          <h4 className="font-medium text-green-800 mb-2 border-b border-green-200 pb-1">Stock Status</h4>
          <div className="space-y-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'in_stock', label: 'In Stock', color: 'text-green-600' },
              { value: 'low_stock', label: 'Low Stock', color: 'text-amber-600' },
              { value: 'out_of_stock', label: 'Out of Stock', color: 'text-red-600' }
            ].map(option => (
              <div key={option.value} className="flex items-center">
                <input
                  type="radio"
                  id={`stock-${option.value}`}
                  name="stockStatus"
                  value={option.value}
                  checked={filters.stockStatus === option.value}
                  onChange={() => handleStockStatusChange(option.value as ProductFilters['stockStatus'])}
                  className="mr-2 h-4 w-4 border-green-300 text-green-600 focus:ring-green-500"
                />
                <label 
                  htmlFor={`stock-${option.value}`} 
                  className={`text-sm ${filters.stockStatus === option.value ? 'font-medium' : ''} ${option.color || 'text-green-600'}`}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Active Status */}
        <div className="bg-violet-50 p-3 rounded-md">
          <h4 className="font-medium text-violet-800 mb-2 border-b border-violet-200 pb-1">Status</h4>
          <div className="space-y-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active', color: 'text-green-600' },
              { value: 'inactive', label: 'Inactive', color: 'text-red-600' }
            ].map(option => (
              <div key={option.value} className="flex items-center">
                <input
                  type="radio"
                  id={`active-${option.value}`}
                  name="activeStatus"
                  value={option.value}
                  checked={filters.activeStatus === option.value}
                  onChange={() => handleActiveStatusChange(option.value as ProductFilters['activeStatus'])}
                  className="mr-2 h-4 w-4 border-violet-300 text-violet-600 focus:ring-violet-500"
                />
                <label 
                  htmlFor={`active-${option.value}`} 
                  className={`text-sm ${filters.activeStatus === option.value ? 'font-medium' : ''} ${option.color || 'text-violet-600'}`}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="bg-amber-50 p-3 rounded-md">
          <h4 className="font-medium text-amber-800 mb-2 border-b border-amber-200 pb-1">Price Range</h4>
          <div className="flex space-x-3">
            <div className="flex-1">
              <label htmlFor="min-price" className="block text-xs text-amber-700 mb-1">
                Min ($)
              </label>
              <input
                type="number"
                id="min-price"
                value={filters.priceRange.min}
                onChange={(e) => handlePriceChange('min', e.target.value)}
                min="0"
                step="0.01"
                className="w-full p-1.5 text-sm border border-amber-300 rounded focus:ring-amber-500 focus:border-amber-500 text-amber-900 bg-white dark:bg-card"
                placeholder="Min"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="max-price" className="block text-xs text-amber-700 mb-1">
                Max ($)
              </label>
              <input
                type="number"
                id="max-price"
                value={filters.priceRange.max}
                onChange={(e) => handlePriceChange('max', e.target.value)}
                min="0"
                step="0.01"
                className="w-full p-1.5 text-sm border border-amber-300 rounded focus:ring-amber-500 focus:border-amber-500 text-amber-900 bg-white dark:bg-card"
                placeholder="Max"
              />
            </div>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

export default ProductFilterModal;
