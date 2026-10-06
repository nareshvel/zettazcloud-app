import React, { useState, useEffect } from 'react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';

export interface CustomerFilters {
  customerTypes: string[];
  creditStatus: 'all' | 'has_credit' | 'no_credit';
  activeStatus: 'all' | 'active' | 'inactive';
  creditRange: {
    min: number | '';
    max: number | '';
  };
  hasCompany: 'all' | 'yes' | 'no';
}

const defaultFilters: CustomerFilters = {
  customerTypes: [],
  creditStatus: 'all',
  activeStatus: 'all',
  creditRange: {
    min: '',
    max: ''
  },
  hasCompany: 'all'
};

export interface CustomerFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: CustomerFilters) => void;
  onClearFilters?: () => void;
  customerTypes: string[];
  currentFilters: CustomerFilters;
}

const CustomerFilterModal: React.FC<CustomerFilterModalProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  onClearFilters,
  customerTypes,
  currentFilters
}) => {
  const [filters, setFilters] = useState<CustomerFilters>(currentFilters || defaultFilters);

  useEffect(() => {
    if (isOpen) {
      setFilters(currentFilters || defaultFilters);
    }
  }, [isOpen, currentFilters]);

  const handleCustomerTypeChange = (type: string) => {
    setFilters(prev => {
      const newTypes = prev.customerTypes.includes(type)
        ? prev.customerTypes.filter(t => t !== type)
        : [...prev.customerTypes, type];
      
      return {
        ...prev,
        customerTypes: newTypes
      };
    });
  };

  const handleCreditStatusChange = (status: CustomerFilters['creditStatus']) => {
    setFilters(prev => ({
      ...prev,
      creditStatus: status
    }));
  };

  const handleActiveStatusChange = (status: CustomerFilters['activeStatus']) => {
    setFilters(prev => ({
      ...prev,
      activeStatus: status
    }));
  };

  const handleCompanyStatusChange = (status: CustomerFilters['hasCompany']) => {
    setFilters(prev => ({
      ...prev,
      hasCompany: status
    }));
  };

  const handleCreditRangeChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? '' : Number(value);
    
    setFilters(prev => ({
      ...prev,
      creditRange: {
        ...prev.creditRange,
        [type]: numValue
      }
    }));
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
    if (onClearFilters) {
      onClearFilters();
    }
  };

  const handleApplyFilters = () => {
    onApplyFilters(filters);
    onClose();
  };

  const footer = (
    <div className="flex justify-end space-x-3">
      {onClearFilters && (
        <Button variant="outline" onClick={handleClearFilters}>
          Clear Filters
        </Button>
      )}
      <Button onClick={handleApplyFilters} className="bg-primary text-primary-foreground hover:bg-primary/90">
        Apply Filters
      </Button>
    </div>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Filters"
      size="4xl"
      footerContent={footer}
    >
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(85vh-150px)] overflow-y-auto">
        {/* Customer Types */}
        <div className="bg-blue-50 p-3 rounded-md">
          <h4 className="font-medium text-blue-800 mb-2 border-b border-blue-200 pb-1">Customer Types</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {customerTypes.length > 0 ? (
              customerTypes.map(type => (
                <div key={type} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`type-${type}`}
                    checked={filters.customerTypes.includes(type)}
                    onChange={() => handleCustomerTypeChange(type)}
                    className="mr-2 h-4 w-4 rounded border-blue-300 text-primary focus:ring-ring"
                  />
                  <label htmlFor={`type-${type}`} className={`text-sm ${filters.customerTypes.includes(type) ? 'text-primary font-medium' : 'text-primary'}`}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                </div>
              ))
            ) : (
              <p className="text-primary italic text-sm">No customer types available</p>
            )}
          </div>
        </div>

        {/* Company Status */}
        <div className="bg-purple-50 p-3 rounded-md">
          <h4 className="font-medium text-purple-800 mb-2 border-b border-purple-200 pb-1">Company Status</h4>
          <div className="space-y-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'yes', label: 'Has Company', color: 'text-purple-600' },
              { value: 'no', label: 'Individual', color: 'text-gray-600' }
            ].map(option => (
              <div key={option.value} className="flex items-center">
                <input
                  type="radio"
                  id={`company-${option.value}`}
                  name="hasCompany"
                  value={option.value}
                  checked={filters.hasCompany === option.value}
                  onChange={() => handleCompanyStatusChange(option.value as CustomerFilters['hasCompany'])}
                  className="mr-2 h-4 w-4 border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <label 
                  htmlFor={`company-${option.value}`} 
                  className={`text-sm ${filters.hasCompany === option.value ? 'font-medium' : ''} ${option.color || 'text-purple-600'}`}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Credit Status */}
        <div className="bg-green-50 p-3 rounded-md">
          <h4 className="font-medium text-green-800 mb-2 border-b border-green-200 pb-1">Credit Status</h4>
          <div className="space-y-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'has_credit', label: 'Has Outstanding Credit', color: 'text-amber-600' },
              { value: 'no_credit', label: 'No Outstanding Credit', color: 'text-green-600' }
            ].map(option => (
              <div key={option.value} className="flex items-center">
                <input
                  type="radio"
                  id={`credit-${option.value}`}
                  name="creditStatus"
                  value={option.value}
                  checked={filters.creditStatus === option.value}
                  onChange={() => handleCreditStatusChange(option.value as CustomerFilters['creditStatus'])}
                  className="mr-2 h-4 w-4 border-green-300 text-green-600 focus:ring-green-500"
                />
                <label 
                  htmlFor={`credit-${option.value}`} 
                  className={`text-sm ${filters.creditStatus === option.value ? 'font-medium' : ''} ${option.color || 'text-green-600'}`}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Active Status */}
        <div className="bg-red-50 p-3 rounded-md">
          <h4 className="font-medium text-red-800 mb-2 border-b border-red-200 pb-1">Active Status</h4>
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
                  onChange={() => handleActiveStatusChange(option.value as CustomerFilters['activeStatus'])}
                  className="mr-2 h-4 w-4 border-red-300 text-red-600 focus:ring-red-500"
                />
                <label 
                  htmlFor={`active-${option.value}`} 
                  className={`text-sm ${filters.activeStatus === option.value ? 'font-medium' : ''} ${option.color || 'text-red-600'}`}
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Credit Range */}
        <div className="bg-yellow-50 p-3 rounded-md col-span-1 md:col-span-2 lg:col-span-1">
          <h4 className="font-medium text-yellow-800 mb-2 border-b border-yellow-200 pb-1">Credit Range</h4>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.creditRange.min}
              onChange={(e) => handleCreditRangeChange('min', e.target.value)}
              className="w-full p-2 border border-yellow-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-sm"
            />
            <span className="text-yellow-700">-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.creditRange.max}
              onChange={(e) => handleCreditRangeChange('max', e.target.value)}
              className="w-full p-2 border border-yellow-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-sm"
            />
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

export default CustomerFilterModal;
