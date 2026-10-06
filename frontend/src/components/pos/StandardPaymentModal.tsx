import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  Banknote, 
  CreditCard, 
  Smartphone, 
  UserCircle,
  X as IconX,
  Loader,
  CheckCircle,
  Settings
} from 'lucide-react';
import { Customer } from '@/types';
import { useFormattingBridge } from '../../utils/formatBridge';
import { paymentService, PaymentMethod } from '../../services/paymentService';

// Icon mapping for payment methods
const getPaymentIcon = (iconName: string, code: string) => {
  switch (iconName || code) {
    case 'cash':
      return <Banknote className="w-6 h-6" />;
    case 'credit-card':
    case 'card':
      return <CreditCard className="w-6 h-6" />;
    case 'phone':
    case 'smartphone':
      return <Smartphone className="w-6 h-6" />;
    case 'user':
    case 'on_account':
      return <UserCircle className="w-6 h-6" />;
    case 'check-circle':
    case 'none':
      return <CheckCircle className="w-6 h-6" />;
    default:
      return <Settings className="w-6 h-6" />;
  }
};

interface StandardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirmPayment: (paymentMethodCode: string) => Promise<void>;
  selectedCustomer: Customer | null;
  currencyCode?: string;
}

const StandardPaymentModal: React.FC<StandardPaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  onConfirmPayment,
  selectedCustomer,
  currencyCode = 'USD'
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const { formatCurrency } = useFormattingBridge();

  // Load payment methods from database
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        setIsLoadingMethods(true);
        const methods = await paymentService.getPaymentMethods();
        const activeMethods = methods
          .filter(method => method.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setPaymentMethods(activeMethods);
      } catch (error) {
        console.error('Failed to load payment methods:', error);
        toast.error('Failed to load payment methods');
      } finally {
        setIsLoadingMethods(false);
      }
    };

    if (isOpen) {
      loadPaymentMethods();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePaymentMethodSelect = (methodCode: string) => {
    // Check if customer is required for charge account payments
    if (methodCode === 'on_account' && !selectedCustomer) {
      toast.error('This payment method requires a customer to be selected. Walk-in customers cannot use charge accounts.');
      return;
    }
    
    setSelectedPaymentMethod(methodCode);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPaymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirmPayment(selectedPaymentMethod);
      onClose();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setSelectedPaymentMethod('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-card rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Select Payment Method</h2>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:text-muted-foreground disabled:opacity-50"
          >
            <IconX className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-muted-foreground mb-2">Total Amount</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-foreground">
              {formatCurrency(totalAmount, currencyCode)}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {isLoadingMethods ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-gray-400 dark:text-muted-foreground" />
              <span className="ml-2 text-gray-500 dark:text-muted-foreground">Loading payment methods...</span>
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-muted-foreground">
              <p>No payment methods available</p>
            </div>
          ) : (
            paymentMethods.map((method) => {
              const isDisabled = method.code === 'on_account' && !selectedCustomer;
              const isSelected = selectedPaymentMethod === method.code;
              
              return (
                <button
                  key={method.id}
                  onClick={() => handlePaymentMethodSelect(method.code)}
                  disabled={isDisabled || isProcessing}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 flex items-center space-x-3 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-primary'
                      : isDisabled
                      ? 'border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/50 text-gray-400 dark:text-muted-foreground cursor-not-allowed'
                      : 'border-gray-200 dark:border-border hover:border-gray-300 dark:border-border hover:bg-gray-50'
                  }`}
                >
                  <div className={`${isSelected ? 'text-primary' : isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                    {getPaymentIcon(method.icon, method.code)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{method.name}</p>
                    {method.code === 'on_account' && (
                      <p className="text-xs text-gray-500 dark:text-muted-foreground">Requires customer selection</p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white dark:bg-card rounded-full"></div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {selectedCustomer && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-muted/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-muted-foreground">Selected Customer:</p>
            <p className="font-medium">{selectedCustomer.firstName} {selectedCustomer.lastName || ''}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-border rounded-lg text-gray-700 dark:text-foreground hover:bg-gray-50 dark:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmPayment}
            disabled={!selectedPaymentMethod || isProcessing}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              'Confirm Payment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StandardPaymentModal;
