import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { 
  Banknote, 
  CreditCard, 
  Smartphone, 
  Landmark, 
  Gift, 
  Wallet, 
  CheckCircle,
  X as IconX, // Renamed X to IconX to avoid conflict if X is a type
  Loader
} from 'lucide-react';
import { PaymentMethod as ApiPaymentMethod } from '../../services/api';
import { Customer } from '@/types';
import { useAuth } from '../../contexts/AuthContext';
import { User as CurrentUser } from '../../types';
import { useFormattingBridge } from '../../utils/formatBridge';

// Extend ApiPaymentMethod to include the icon property used in Cart.tsx
export interface DisplayPaymentMethod extends Omit<ApiPaymentMethod, 'requires_terminal'> { // Omit snake_case if present
  icon?: React.ReactElement;
  requiresTerminal?: boolean; // Add camelCase version
}

// Define as a plain constant outside the component, as it's static and doesn't need useMemo here.
const noPaymentRequiredMethod: DisplayPaymentMethod = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'No Payment Required',
  code: 'NO_PAYMENT', // Internal code
  isActive: true,
  sort_order: 999,
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  availablePaymentMethods: DisplayPaymentMethod[];
  onConfirmPayment: (finalPaymentMethod: DisplayPaymentMethod) => Promise<void>; // Modified to take final method
  selectedCustomer: Customer | null; // Added selectedCustomer prop
  canChargeToAccount: boolean; // To determine if charge is generally allowed
  currencyCode?: string; // For formatting currency based on store settings
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  availablePaymentMethods,
  onConfirmPayment,
  currencyCode, // Destructure currencyCode
  selectedCustomer, // Destructure selectedCustomer
  canChargeToAccount, // Destructure canChargeToAccount
}) => {
  const { formatCurrency } = useFormattingBridge();
  const { user: currentUser } = useAuth() as { user: CurrentUser | null };
  const [amountTendered, setAmountTendered] = useState('');
  const [changeDue, setChangeDue] = useState(0);
  const [selectedMethodInModal, setSelectedMethodInModal] = useState<DisplayPaymentMethod | null>(null);
  const [disableConfirmButton, setDisableConfirmButton] = useState(false);
  const [chargeEligibilityMessage, setChargeEligibilityMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // RE-ADD isProcessing state

  // Determine active selectable payment methods for tabs
  const activeSelectablePaymentMethods = useMemo(() => {
    // Debug payment methods
    // console.log('Available payment methods:', availablePaymentMethods);
    
    // Filter out both 'NO_PAYMENT' code and any method with name 'No Payment Required'
    const filteredMethods = availablePaymentMethods
      .filter(pm => pm.isActive && pm.code !== 'NO_PAYMENT' && pm.name !== 'No Payment Required')
      .sort((a, b) => a.sort_order - b.sort_order);
      
    // console.log('Filtered active payment methods:', filteredMethods);
    return filteredMethods;
  }, [availablePaymentMethods]);

  useEffect(() => {
    if (totalAmount === 0) {
      // If total is zero, always select the internal 'NO_PAYMENT' method.
      // The UI will show a specific message instead of payment options.
      if (selectedMethodInModal?.code !== 'NO_PAYMENT') { // Avoid redundant state updates
        setSelectedMethodInModal(noPaymentRequiredMethod);
      }
    } else if (activeSelectablePaymentMethods.length > 0) {
      // If total is not zero and there are selectable tabs, ensure a valid tab is selected.
      const currentSelectionIsValidTab = selectedMethodInModal && activeSelectablePaymentMethods.some(pm => pm.id === selectedMethodInModal.id);
      if (!currentSelectionIsValidTab) {
        // Default to the first available tabbable payment method.
        setSelectedMethodInModal(activeSelectablePaymentMethods[0]);
      }
      // If current selection is already a valid tab, keep it.
    } else {
      // No selectable tabs and total is not zero (e.g., all payment methods inactive)
      setSelectedMethodInModal(null); 
    }
  }, [totalAmount, activeSelectablePaymentMethods, noPaymentRequiredMethod, selectedMethodInModal]);

  useEffect(() => {
    // Reset states when modal opens or totalAmount/selected method changes
    setAmountTendered('');
    setChangeDue(0);
    setChargeEligibilityMessage(null);
    setDisableConfirmButton(false); // Default to enabled, specific conditions below will disable

    if (!selectedMethodInModal) return;

    if (selectedMethodInModal.id === noPaymentRequiredMethod.id) {
      setChargeEligibilityMessage(null);
      setDisableConfirmButton(false); // Always allow confirming $0 sales
      return; 
    }

    if (selectedMethodInModal.code === 'cash') {
      setDisableConfirmButton(true); // For cash, disable until amount tendered is sufficient
    } else if (selectedMethodInModal.code === 'on_account') {
      let message: string | null = null;
      let disabled = false;

      if (!selectedCustomer) { // Walk-in or no customer selected
        message = 'Charge to Account is for registered customers. Please select or add a customer to use this payment method.';
        disabled = true;
      } else if (!canChargeToAccount) { // Selected customer is ineligible
        const creditLimitNumber = Number(selectedCustomer?.creditLimit) || 0;
        const outstandingCreditNumber = Number(selectedCustomer?.outstandingCredit) || 0;         
        message = `${selectedCustomer?.firstName} ${selectedCustomer?.lastName || ''} is not eligible for Charge to Account (Limit: ${formatCurrency(creditLimitNumber, currencyCode)}, Outstanding: ${formatCurrency(outstandingCreditNumber, currencyCode)}). Please choose another payment method.`;
        disabled = true;
      } else { // Selected customer is eligible
        const creditLimitNumber = Number(selectedCustomer?.creditLimit) || 0;
        const outstandingCreditNumber = Number(selectedCustomer?.outstandingCredit) || 0;
        const availableCredit = creditLimitNumber - outstandingCreditNumber;

        if (totalAmount > availableCredit) {
            message = `Order total (${formatCurrency(totalAmount, currencyCode)}) exceeds available credit. ` +
                      `Limit: ${formatCurrency(creditLimitNumber, currencyCode)}, ` +
                      `Outstanding: ${formatCurrency(outstandingCreditNumber, currencyCode)}, ` +
                      `Available: ${formatCurrency(availableCredit, currencyCode)} for ${selectedCustomer?.firstName}.`;
            disabled = true;
        } else {
            message = `Charge to ${selectedCustomer?.firstName} ${selectedCustomer?.lastName || ''}'s account. ` +
                      `Limit: ${formatCurrency(creditLimitNumber, currencyCode)}, ` +
                      `Outstanding: ${formatCurrency(outstandingCreditNumber, currencyCode)}, ` +
                      `Available: ${formatCurrency(availableCredit, currencyCode)}.`;
            disabled = false;
            // console.log('[PaymentModal] Sufficient credit available.');
        }
      }
      setChargeEligibilityMessage(message);
      // console.log('[PaymentModal] Charge Eligibility Message:', message);
      setDisableConfirmButton(disabled);
    } else {
      // For other methods like card, phone, etc. (non-cash, non-on_account)
      setDisableConfirmButton(false);
    }
  }, [selectedMethodInModal, totalAmount, currencyCode, selectedCustomer, canChargeToAccount]);

  // Effect for cash payment logic (calculating change, enabling/disabling confirm button)
  useEffect(() => {
    if (selectedMethodInModal?.code === 'cash') {
      const tendered = parseFloat(amountTendered);
      if (!isNaN(tendered) && tendered >= totalAmount) {
        setChangeDue(tendered - totalAmount);
        setDisableConfirmButton(false); // Cash specific: enable if tendered >= total
      } else {
        setChangeDue(0);
        setDisableConfirmButton(true); // Cash specific: disable if tendered < total or invalid
      }
    }
    // No else block: Do not interfere with disableConfirmButton for other payment methods here.
  }, [amountTendered, totalAmount, selectedMethodInModal]);

  // Quick-cash suggestions for the total actually due, instead of a fixed
  // 1/5/10/20/50/100 note grid that's often nowhere near the sale total.
  // Standard bill/note increments, rounded up from `total`, so a $187.40
  // sale offers "$190, $200, $250..." rather than "$1, $5, $10...". Clicking
  // one SETS the tendered amount to that round figure (this is "here's what
  // the customer probably handed you"), unlike the old buttons which added
  // to whatever was already typed — the separate "Exact Amount" button below
  // still covers the no-change case, so these 6 are always strictly > total.
  const suggestedCashAmounts = useMemo(() => {
    const exact = Math.round(totalAmount * 100) / 100;
    if (!(exact > 0)) return [];
    const increments = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    const amounts = new Set<number>();
    for (const inc of increments) {
      const rounded = Math.ceil(exact / inc) * inc;
      const value = Math.round(rounded * 100) / 100;
      if (value > exact) amounts.add(value);
      if (amounts.size >= 6) break;
    }
    // Fallback for when the bill increments above collapse onto too few distinct
    // values to fill 6 slots — e.g. a $980 total is already an exact multiple of
    // 1/5/10/20/50/100/200/500/1000, so every increment through 1000 rounds up to
    // the same $1,000, leaving only {1000, 2000, 5000, 10000} from the primary pass.
    // Fill the rest with the next plain multiples of 50 above the highest amount
    // already suggested, so the extra options stay genuinely nearby (e.g. $1,050,
    // $1,100...) rather than jumping straight to $20,000/$30,000.
    let nextBase = exact;
    while (amounts.size < 6) {
      nextBase = Math.ceil((nextBase + 1) / 50) * 50;
      amounts.add(nextBase); // Set dedupes automatically if this lands on an existing value
    }
    return Array.from(amounts)
      .sort((a, b) => a - b)
      .slice(0, 6)
      .map((value) => ({ value, label: formatCurrency(value, currencyCode) }));
  }, [totalAmount, currencyCode]);

  const handleAmountTenderedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setAmountTendered(value);
    }
  };

  const handleSuggestedAmountClick = (value: number) => {
    setAmountTendered(value.toFixed(2));
  };

  const handleClearAmountTendered = () => {
    setAmountTendered('');
  };

  const handleExactAmountClick = () => {
    // Set exact amount and immediately update the state
    const exactAmount = totalAmount.toFixed(2);
    setAmountTendered(exactAmount);
    
    // Force an update to the changeDue and button state
    if (selectedMethodInModal?.code === 'cash' && totalAmount > 0) {
      setChangeDue(0); // Exact amount means no change
      setDisableConfirmButton(false); // Enable the button immediately
    }
  };

  const handleConfirm = async () => {
    if (disableConfirmButton || isProcessing) return;
    if (selectedMethodInModal) {
      setIsProcessing(true);
      try {
        // Validate essential currentUser fields before proceeding
        if (!currentUser || !currentUser.id || !currentUser.storeId || !currentUser.tenantId) {
          toast.error('User session information incomplete. Please try logging out and back in.');
          console.error('Missing critical user data:', { 
            hasUser: !!currentUser, 
            hasId: currentUser ? !!currentUser.id : false,
            hasStoreId: currentUser ? !!currentUser.storeId : false,
            hasTenantId: currentUser ? !!currentUser.tenantId : false
          });
          setIsProcessing(false);
          return;
        }
        
        // Validate payment method before confirming
        // console.log('Selected payment method for confirmation:', selectedMethodInModal);
        if (!selectedMethodInModal.id) {
          console.error('Payment method is missing ID:', selectedMethodInModal);
          toast.error('Invalid payment method. Please select another payment option.');
          setIsProcessing(false);
          return;
        }

        await onConfirmPayment(selectedMethodInModal);
      } catch (error) {
        // console.error("Error during payment confirmation:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleTabClick = (method: DisplayPaymentMethod) => {
    setSelectedMethodInModal(method);
    if (method.code === 'cash' || selectedMethodInModal?.code === 'cash') {
      setAmountTendered('');
      setChangeDue(0);
    }
  };

  const getPaymentMethodIcon = (methodCode: string | undefined) => {
    switch (methodCode) {
      case 'cash': return <Banknote className="h-5 w-5 mr-2" />;
      case 'card':
      case 'credit_card':
        return <CreditCard className="h-5 w-5 mr-2" />;
      case 'phone':
      case 'upi': // Legacy UPI code for phone payments
        return <Smartphone className="h-5 w-5 mr-2" />;
      case 'on_account':
        return <Landmark className="h-5 w-5 mr-2" />;
      case 'gift_card':
        return <Gift className="h-5 w-5 mr-2" />;
      case 'NO_PAYMENT':
        return <CheckCircle className="h-5 w-5 mr-2 text-green-500" />;
      default:
        return <Wallet className="h-5 w-5 mr-2" />;
    }
  };

  if (!isOpen || !selectedMethodInModal) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-card rounded-xl shadow-2xl transform transition-all sm:max-w-md w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-border">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground flex items-center">
            {(totalAmount === 0 && selectedMethodInModal?.code === 'NO_PAYMENT')
              ? <CheckCircle size={22} className="mr-2.5 text-green-500" />
              : <Wallet size={22} className="mr-2.5 text-primary" />}
            {(totalAmount === 0 && selectedMethodInModal?.code === 'NO_PAYMENT') ? 'Order Complete' : 'Payment'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:hover:text-foreground transition-colors"
            disabled={isProcessing}
          >
            <IconX size={22} />
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="px-6 py-4 flex-grow overflow-y-auto">
          {totalAmount === 0 && selectedMethodInModal?.code === 'NO_PAYMENT' ? (
            <div className="p-4 border border-gray-200 dark:border-border rounded-xl bg-gray-50 dark:bg-muted/40 mb-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h4 className="text-lg font-semibold text-gray-800 dark:text-foreground">Order total is {formatCurrency(0, currencyCode)}.</h4>
              <p className="text-gray-500 dark:text-muted-foreground">No payment is required.</p>
            </div>
          ) : activeSelectablePaymentMethods.length > 0 && selectedMethodInModal && selectedMethodInModal.code !== 'NO_PAYMENT' ? (
            <>
              {/* Payment Method Tabs */}
              <div className="flex border-b border-gray-200 dark:border-border mb-4">
                {activeSelectablePaymentMethods.map((methodTab) => (
                  <button
                    key={methodTab.id}
                    onClick={() => handleTabClick(methodTab)}
                    disabled={isProcessing}
                    className={`flex-1 py-2.5 px-2 text-sm font-medium text-center border-b-2 focus:outline-none transition-colors flex items-center justify-center gap-1.5
                      ${selectedMethodInModal?.id === methodTab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground hover:border-gray-300 dark:hover:border-border'
                      }
                      ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {getPaymentMethodIcon(methodTab.code)}
                    {methodTab.name}
                  </button>
                ))}
              </div>

              {/* Instructions / eligibility messages */}
              <div className="mb-3 text-sm min-h-[36px]">
                {selectedMethodInModal.code === 'cash' && (
                  <p className="text-gray-500 dark:text-muted-foreground">Enter the amount tendered by the customer.</p>
                )}
                {selectedMethodInModal.code === 'on_account' && chargeEligibilityMessage && (
                  <p className={`font-medium ${disableConfirmButton ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-foreground'}`}>
                    {chargeEligibilityMessage}
                  </p>
                )}
              </div>

              {/* Paying with card */}
              {selectedMethodInModal.id !== noPaymentRequiredMethod.id && (
                <div className="rounded-xl border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/40 p-4 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-600 dark:text-muted-foreground flex items-center gap-1.5">
                      {getPaymentMethodIcon(selectedMethodInModal.code)}
                      Paying with: {selectedMethodInModal.name}
                    </span>
                    <span className="text-xl font-bold text-gray-900 dark:text-foreground">
                      {formatCurrency(totalAmount, currencyCode)}
                    </span>
                  </div>

                  {selectedMethodInModal.code === 'cash' && (
                    <>
                      {/* Amount tendered input */}
                      <input
                        type="text"
                        id="amountTendered"
                        value={amountTendered}
                        onChange={handleAmountTenderedChange}
                        placeholder={formatCurrency(0, currencyCode)}
                        className="w-full px-4 py-3 mb-4 border border-gray-300 dark:border-border rounded-lg text-lg text-right font-semibold bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        autoComplete="off"
                        disabled={isProcessing}
                      />
                      {/* Quick-cash suggestions, nearest round amounts above the total due.
                          `clamp()` shrinks the font to fit a 3-up grid cell instead of
                          overflowing the button (a large total like "US$10,000.00" is 13
                          characters — too wide for a ~110px cell at a fixed text size);
                          `truncate` + `title` is the last-resort fallback if a currency/
                          locale combination is still too wide even at the smallest size. */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {suggestedCashAmounts.map(amount => (
                          <button
                            key={amount.value}
                            onClick={() => handleSuggestedAmountClick(amount.value)}
                            disabled={isProcessing}
                            title={amount.label}
                            className="bg-white dark:bg-background hover:bg-gray-100 dark:hover:bg-muted border border-gray-200 dark:border-border text-gray-800 dark:text-foreground font-medium py-2 px-2 rounded-lg transition-colors disabled:opacity-50 truncate tabular-nums"
                            style={{ fontSize: 'clamp(0.7rem, 3.2vw, 0.875rem)' }}
                          >
                            {amount.label}
                          </button>
                        ))}
                      </div>
                      {/* Clear / Exact */}
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={handleClearAmountTendered}
                          disabled={isProcessing}
                          className="flex-1 bg-white dark:bg-background hover:bg-gray-100 dark:hover:bg-muted border border-gray-200 dark:border-border text-gray-700 dark:text-foreground font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleExactAmountClick}
                          disabled={isProcessing}
                          className="flex-1 bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 text-primary dark:text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Exact Amount
                        </button>
                      </div>
                      {/* Change due */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-border">
                        <span className="text-sm text-gray-500 dark:text-muted-foreground">Change Due</span>
                        <span className="text-2xl font-bold text-green-500 dark:text-green-400">
                          {formatCurrency(changeDue, currencyCode)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-muted-foreground">
              No payment methods available for this transaction.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-border">
          <button
            onClick={handleConfirm}
            disabled={isProcessing || disableConfirmButton}
            className="w-full flex items-center justify-center bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <><Loader className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
            ) : (totalAmount === 0 && selectedMethodInModal?.code === 'NO_PAYMENT') ? (
              <><CheckCircle size={20} className="mr-2" /> Complete Order</>
            ) : (
              <><CheckCircle size={20} className="mr-2" /> Confirm Payment ({formatCurrency(totalAmount, currencyCode)})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
