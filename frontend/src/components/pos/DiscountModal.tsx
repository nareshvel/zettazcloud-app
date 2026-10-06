import React, { useState, useEffect } from 'react';
import { X, Delete } from 'lucide-react'; // Import X for close, and others for numpad/type
import { useCurrency } from '@/contexts/LocalizationContext';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiscountValue: number;
  currentDiscountType: 'percentage' | 'fixed';
  onApplyDiscount: (value: number, type: 'percentage' | 'fixed') => void;
  subtotal: number;
}

const DiscountModal: React.FC<DiscountModalProps> = ({
  isOpen,
  onClose,
  currentDiscountValue,
  currentDiscountType,
  onApplyDiscount,
  subtotal
}) => {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [inputValue, setInputValue] = useState(''); // Initialize as empty string for placeholder to show
  const [selectedType, setSelectedType] = useState<'percentage' | 'fixed'>(
    currentDiscountType
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // We now get the currency symbol from our localization context

  useEffect(() => {
    // When modal opens, or current discount/type changes, update internal state
    setInputValue(currentDiscountValue > 0 ? String(currentDiscountValue) : '');
    setSelectedType(currentDiscountType);
    setValidationError(null); // Clear validation error when props change
  }, [isOpen, currentDiscountValue, currentDiscountType]);

  // Clear validation error when input or type changes
  useEffect(() => {
    if (validationError) {
      setValidationError(null);
    }
  }, [inputValue, selectedType]);

  if (!isOpen) {
    return null;
  }

  const handleNumpadInput = (key: string) => {
    if (key === 'backspace') {
      setInputValue(prev => prev.slice(0, -1));
    } else if (key === '.') {
      if (!inputValue.includes('.')) {
        // If input is empty and decimal is pressed, prepend with '0'
        setInputValue(prev => (prev === '' ? '0.' : prev + '.'));
      }
    } else { // Digit input
      setInputValue(prev => {
        const parts = prev.split('.');
        // If there's a decimal part and it already has 2 or more digits, don't add more
        if (parts.length > 1 && parts[1].length >= 2) {
          return prev;
        }
        // Prevent excessively long numbers before decimal, e.g., max 7 digits
        if (parts.length === 1 && parts[0].length >= 7 && prev !== '0') { // allow 0.xx
            return prev;
        }
        // If input is '0' and a non-zero digit is pressed, replace '0'
        if (prev === '0' && key !== '0') {
            return key;
        }
        // If input is '0' and '0' is pressed again, do nothing (prevent '00')
        if (prev === '0' && key === '0') {
            return prev;
        }
        return prev + key;
      });
    }
  };

  const handleApply = () => {
    const value = parseFloat(inputValue);

    if (inputValue.trim() === '') { // Allow applying if empty (effectively 0 discount)
      onApplyDiscount(0, selectedType);
      setValidationError(null);
      onClose();
      return;
    }

    if (isNaN(value) || value < 0) {
      setValidationError('Please enter a valid non-negative number for the discount.');
      return;
    }

    // Validation logic
    if (selectedType === 'fixed' && value > subtotal) {
      setValidationError(`Fixed discount cannot exceed subtotal of ${formatCurrency(subtotal)}.`);
      return;
    }

    if (selectedType === 'percentage' && value > 100) {
      setValidationError('Percentage discount cannot exceed 100%.');
      return;
    }

    setValidationError(null); // Clear error if all validations pass
    onApplyDiscount(value, selectedType);
    onClose();
  };

  const handleClearDiscount = () => {
    onApplyDiscount(0, 'fixed'); // Resets discount in context to 0, type to fixed
    setInputValue(''); // Clear input field as well
  };

  const numpadKeys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '.', '0', 'backspace'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl transform transition-all sm:align-middle sm:max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800 flex items-center">
            Apply Discount
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
            <X size={24} />
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="px-6 py-4 flex-grow overflow-y-auto">
          {/* Discount Type Selection */}
          <div className="mb-6">
            <span className="block text-sm font-medium text-slate-700 mb-2">Discount Type</span>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setSelectedType('percentage')}
                className={`flex-1 py-3 px-4 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-150 ease-in-out flex items-center justify-center
                  ${selectedType === 'percentage'
                    ? 'bg-primary text-white border-blue-600 ring-blue-500 shadow-md'
                    : 'bg-white dark:bg-card text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-blue-400'
                  }`}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('fixed')}
                className={`flex-1 py-3 px-4 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-150 ease-in-out flex items-center justify-center
                  ${selectedType === 'fixed'
                    ? 'bg-primary text-white border-blue-600 ring-blue-500 shadow-md'
                    : 'bg-white dark:bg-card text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-blue-400'
                  }`}
              >
                Fixed Amount ({currencySymbol})
              </button>
            </div>
          </div>

          {/* Discount Value Input */}
          <div className="mb-4">
            <label htmlFor="discountValueInput" className="block text-sm font-medium text-slate-700 mb-1">
              Discount Value {selectedType === 'percentage' ? '(%)' : `(${formatCurrency(subtotal)} Max)`} 
            </label>
            <input
              type="text" // Changed to text for numpad compatibility
              id="discountValueInput"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)} // Direct input still allowed, can be removed if numpad is exclusive
              placeholder="0.00"
              className="w-full text-2xl font-semibold text-right py-3 px-4 border-slate-300 focus:ring-ring focus:border-blue-500 rounded-md shadow-sm appearance-none bg-slate-50"
              inputMode="decimal"
            />
            {validationError && (
              <p className="text-red-600 text-sm mt-1 text-right">{validationError}</p>
            )}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {numpadKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleNumpadInput(key)}
                className={`py-3 px-2 rounded-md shadow-sm transition-colors text-lg font-medium 
                  ${key === 'backspace' 
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 col-span-1 flex items-center justify-center' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}
              >
                {key === 'backspace' ? <Delete size={24} /> : key}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex space-x-3">
          <button
            type="button"
            onClick={handleClearDiscount}
            className="flex-1 flex justify-center py-3 px-4 border border-slate-300 rounded-md shadow-sm text-lg font-medium text-slate-700 bg-white dark:bg-card hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiscountModal;
