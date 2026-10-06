import React, { useState, useEffect, ChangeEvent, FocusEvent, useRef } from 'react';
import { Input, InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NumericInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  decimalPlaces?: number;
  allowNegative?: boolean;
  className?: string;
}

const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  decimalPlaces = 2,
  allowNegative = false,
  className,
  onBlur,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement === inputRef.current) {
      // If the input is focused, don't overwrite user's typing
      return;
    }
    if (value === null || value === undefined || isNaN(Number(value))) {
      setDisplayValue('');
    } else {
      const numericValue = Number(value);
      setDisplayValue(numericValue.toFixed(decimalPlaces));
    }
  }, [value, decimalPlaces]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Basic validation: allow numbers, one decimal point, optional negative sign
    // More robust regex might be needed for stricter validation during typing
    const validCharRegex = allowNegative ? /^-?[0-9]*\.?[0-9]*$/ : /^[0-9]*\.?[0-9]*$/;

    if (inputValue === '' || (allowNegative && inputValue === '-')) {
      setDisplayValue(inputValue);
    } else if (validCharRegex.test(inputValue)) {
      // Further check for multiple decimal points or too many decimal digits
      const parts = inputValue.split('.');
      if (parts.length > 2) return; // More than one decimal point
      if (parts[1] && parts[1].length > decimalPlaces) return; // Too many decimal digits

      setDisplayValue(inputValue);
    } 
    // Else, invalid character, do nothing or revert (current behavior: do nothing)
  };

  const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    let numericValue: number | null;
    const parsed = parseFloat(displayValue);

    if (isNaN(parsed)) {
      numericValue = null;
    } else {
      numericValue = parseFloat(parsed.toFixed(decimalPlaces));
      if (!allowNegative && numericValue < 0) {
        numericValue = 0; // Or Math.abs(numericValue) if negative not allowed
      }
    }
    
    onChange(numericValue);

    // Update displayValue to the formatted version after parent state is updated
    // This ensures consistency if onChange triggers a re-render with the new value
    if (numericValue !== null) {
      setDisplayValue(numericValue.toFixed(decimalPlaces));
    } else {
      // If value became null (e.g. user cleared input or typed invalid chars)
      // and the prop 'value' is also null/undefined, displayValue should be empty.
      // This is handled by useEffect if 'value' prop changes to null/undefined.
      // If user just cleared it, displayValue is already '', which is fine.
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleInputChange}
      onBlur={handleInputBlur}
      className={cn('text-right', className)}
      placeholder={props.placeholder ?? (0).toFixed(decimalPlaces)} // Show format in placeholder
      {...props}
    />
  );
};

export default NumericInput;
