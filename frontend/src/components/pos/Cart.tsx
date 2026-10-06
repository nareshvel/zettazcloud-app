import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Trash2, 
  CreditCard,
  DollarSign,
  Smartphone,
  Gift,
  Loader2,
  ShoppingCart,
  Edit,
  User,
  UserCheck, // For sales staff attribution
  Archive, // For Hold Cart
  ArchiveRestore, // For View Held Orders
  Landmark, // For Bank Transfer icon, consistent with PaymentModal
  Info // Added for tax breakdown tooltip
} from 'lucide-react';
import { useCart } from '../../contexts/CartContext.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useInventory } from '../../contexts/InventoryContext';
import { useCurrency } from '@/contexts/LocalizationContext';
import { useTaxConfig } from '@/contexts/TaxConfigContext';
import { Customer } from '@/types';
import { paymentService, PaymentMethod as ApiPaymentMethod } from '../../services/paymentService';
import toast from 'react-hot-toast';
import PaymentModal from './PaymentModal.tsx';
import type { DisplayPaymentMethod } from './PaymentModal.tsx';
import DiscountModal from './DiscountModal.tsx';
import NameInputModal from './NameInputModal.tsx';
import ConfirmationModal from '../../components/modals/POSConfirmationModal';
import { useReceipt } from '../../hooks/useReceipt'; // Added for receipt printing
import CartItem from './CartItem';
import { listEmployees, Employee } from '@/services/employeeService';
import { hasPermission } from '@/utils/permissionUtils';
import { ShieldAlert } from 'lucide-react';

interface CartProps {
  selectedCustomer: Customer | null;
  onSelectCustomerClick: () => void;
  onViewHeldOrders: () => void;
  onCheckoutSuccess?: () => void;
}

const Cart: React.FC<CartProps> = memo(({ 
  selectedCustomer, 
  onSelectCustomerClick, 
  onViewHeldOrders, 
  onCheckoutSuccess
}) => {
  const { 
    items, 
    clearCart, 
    calculateTotal,
    calculateSubtotal,
    calculateTax,
    getTaxBreakdown, 
    checkout, 
    isProcessing,
    setDiscount, 
    holdCurrentOrder, 
    heldOrders,
    discount: currentCartDiscount, 
    discountApplicationPreference, 
    removeFromCart,
    updateQuantity,
    calculateItemDiscounts,
    selectedEmployeeId,
    setSelectedEmployeeId,
    isDutyFreeStore,
    salesModeOverride,
    setSalesModeOverride,
    travellerContext,
    // activeTaxConfig // Commented out as it's not used
  } = useCart();
  const { user } = useAuth();
  const { refreshProducts: refreshInventoryProducts } = useInventory();
  const { showReceiptForSale } = useReceipt(); // Added for receipt printing 
  
  // Determine effective currency code
  const storeCurrency = user?.store?.currencyCode;
  const userCurrency = user?.currencyCode;
  const { formatCurrency } = useCurrency();
  const effectiveCurrencyCode = storeCurrency || userCurrency || 'USD';
  
  // Get tax configuration to know if prices include tax
  const { pricesIncludeTax } = useTaxConfig();
  
  // Check if the selected customer is tax exempt
  const isCustomerTaxExempt = selectedCustomer?.isTaxExempt === true;

  // Sales staff for optional per-sale attribution (commissions/targets)
  const [salesStaff, setSalesStaff] = useState<Employee[]>([]);
  useEffect(() => {
    let active = true;
    listEmployees()
      .then((list) => { if (active) setSalesStaff((list || []).filter((e) => e.isActive !== false && e.isSalesStaff !== false)); })
      .catch(() => { if (active) setSalesStaff([]); });
    return () => { active = false; };
  }, []);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [basePaymentMethods, setBasePaymentMethods] = useState<DisplayPaymentMethod[]>([]);
  const [finalPaymentMethods, setFinalPaymentMethods] = useState<DisplayPaymentMethod[]>([]);
  const [canChargeToAccount, setCanChargeToAccount] = useState(false);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<DisplayPaymentMethod | null>(null);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isNameInputModalOpen, setIsNameInputModalOpen] = useState(false);
  const [isClearCartConfirmModalOpen, setIsClearCartConfirmModalOpen] = useState(false);

  const hasFetchedPaymentMethodsRef = useRef(false); 

  useEffect(() => {
    if (selectedCustomer) { 
      const customerType = selectedCustomer.customerType || (selectedCustomer as any).customer_type || '';
      const eligible = 
        customerType.toLowerCase() !== 'walk-in' || 
        (typeof selectedCustomer.creditLimit === 'number' && selectedCustomer.creditLimit > 0);
      setCanChargeToAccount(eligible);
    } else {
      setCanChargeToAccount(false);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    let processedMethods = [...basePaymentMethods];
    setFinalPaymentMethods(processedMethods);

    if (processedMethods.length > 0) {
      if (!selectedPaymentMethod || !processedMethods.find(m => m.id === selectedPaymentMethod.id)) {
        setSelectedPaymentMethod(processedMethods[0]);
      }
    } else {
      setSelectedPaymentMethod(null); 
    }
  }, [basePaymentMethods, selectedPaymentMethod]); 

  useEffect(() => {
    const fetchMethods = async () => {
      setIsLoadingPaymentMethods(true);
      try {
        const paymentMethodsArray = await paymentService.getPaymentMethods(); // Use new paymentService
        
        if (paymentMethodsArray && Array.isArray(paymentMethodsArray)) {
          const activeMethods = paymentMethodsArray
            .filter((method: ApiPaymentMethod) => method.isActive) 
            .map((method: ApiPaymentMethod): DisplayPaymentMethod => ({
              id: method.id,
              name: method.name,
              code: method.code.toLowerCase(), 
              isActive: method.isActive, 
              requiresTerminal: method.requiresTerminal, // Fixed property name
              icon: getCartPaymentMethodIcon(method.code.toLowerCase()), 
              sort_order: method.sortOrder, // Fixed property name
            }));
          
          if (activeMethods.length > 0) {
            setBasePaymentMethods(activeMethods);
          } else {
            console.warn('API returned no active payment methods.');
            setBasePaymentMethods([]); // Set to empty if API returns none
          }
        } else {
          console.error('Failed to fetch payment methods, no data in response:', paymentMethodsArray);
          setBasePaymentMethods([]); // Set to empty if API returns none
          toast.error('Could not load payment methods.');
        }
      } catch (error) {
        console.error('Error fetching payment methods:', error);
        setBasePaymentMethods([]); // Set to empty if API returns none
        toast.error('Error loading payment methods.');
      } finally {
        setIsLoadingPaymentMethods(false);
      }
    };

    if (!hasFetchedPaymentMethodsRef.current) {
      fetchMethods();
      hasFetchedPaymentMethodsRef.current = true;
    }
  }, []); 

  const getCartPaymentMethodIcon = (code: string) => {
    switch (code) {
      case 'cash': return <DollarSign className="h-5 w-5" />;
      case 'card': return <CreditCard className="h-5 w-5" />;
      case 'on_account': return <User className="h-5 w-5" />;
      case 'online': return <Smartphone className="h-5 w-5" />;
      case 'gift_card': return <Gift className="h-5 w-5" />;
      case 'bank_transfer': return <Landmark className="h-5 w-5" />;
      case 'phone': return <Smartphone className="h-5 w-5" />;
      default: return <CreditCard className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />; 
    }
  };

  const subtotal = calculateSubtotal();
  const taxAmount = calculateTax();
  const totalAmount = calculateTotal();
  // Promotions (item-level) total discount
  const promotionsAmount = typeof calculateItemDiscounts === 'function' ? calculateItemDiscounts() : 0;



  const handleInitiateCheckout = () => { 
    if (items.length === 0) {
      toast.error('Cart is empty.');
      return;
    }
    if (!selectedPaymentMethod && finalPaymentMethods.length > 0) {
      setSelectedPaymentMethod(finalPaymentMethods[0]);
    } else if (finalPaymentMethods.length === 0) {
      toast.error('No payment methods available.');
      return;
    }
    setIsPaymentModalOpen(true);
  };

  const handleApplyDiscount = (value: number, type: 'percentage' | 'fixed') => { 
    setDiscount(value, type); 
    setIsDiscountModalOpen(false);
  };

  const handleHoldOrderWithName = (name: string) => {
    if (items.length === 0) {
      toast.error("Cannot hold an empty cart.");
      return;
    }
    holdCurrentOrder(name); 
    toast.success(`Order held as "${name}".`);
    setIsNameInputModalOpen(false);
  };

  const handleClearCartRequest = () => {
    setIsClearCartConfirmModalOpen(true);
  };

  const handleActualClearCart = () => {
    clearCart();
    setIsClearCartConfirmModalOpen(false);
  };

  const handlePaymentSubmit = async (
    paymentDataFromModal: DisplayPaymentMethod 
  ) => {
    setIsPaymentModalOpen(false);
    if (!user || !user.id || !user.tenantId || !user.storeId) {
      toast.error('User information is incomplete. Cannot proceed with checkout.');
      return;
    }

    // Debug logging for payment method
    // Validate payment method has an ID
    if (!paymentDataFromModal || !paymentDataFromModal.id) {
      toast.error('Invalid payment method selected. Missing payment method ID.');
      return;
    }

    const finalPaymentMethodId = paymentDataFromModal.id;

    try {
      // Assuming checkout now returns the sale object on success, or null/undefined on failure
      const newSale = await checkout(finalPaymentMethodId, selectedCustomer?.id);

      if (newSale && typeof newSale === 'object') { // Check if newSale is a valid sale object
        // CartContext.checkout() might still show its own success toast.
        // We might want to coordinate toasts later if they become duplicative.

        // Inventory is deducted server-side inside createSaleController's own
        // transaction (see CLAUDE.md), but InventoryContext's product list is
        // only fetched once per session (isInventoryLoaded latches true and
        // fetchInventoryData() then no-ops). Without this, the POS grid keeps
        // showing pre-sale stock_quantity until a hard refresh.
        // Use refreshProducts() (not forceRefresh()) — forceRefresh flips
        // isInventoryLoaded to false first, and POSScreen gates the entire
        // product grid behind that flag, so it would unmount the whole grid
        // into a loading spinner for every checkout. refreshProducts() just
        // re-fetches and calls setProducts(), so React reconciles in place —
        // only the stock_quantity text on affected cards changes, nothing
        // flashes. Fire-and-forget so a slow refetch never delays print.
        refreshInventoryProducts().catch((refreshError) => {
          console.error('Failed to refresh inventory after sale:', refreshError);
        });

        // Attempt to print the receipt for POS (no browser fallback)
        try {
          await showReceiptForSale(newSale, { mode: 'print', disableFallback: true });
        } catch (printError: any) {
          console.error('Error attempting to print POS receipt:', printError);
          toast.error('Sale complete, but error during receipt printing.'); // Inform user about print issue
        }

        if (onCheckoutSuccess) {
          onCheckoutSuccess(); 
        }
      } else {
        // If checkout returns falsy, CartContext should have already shown a relevant toast
        // console.log('Checkout was not successful or did not return a sale object.');
      }
    } catch (error: any) {
      // This catch block might be redundant if CartContext.checkout handles its own errors and returns boolean
      // However, it can catch unexpected errors from the checkout call itself if it throws
      console.error('Checkout failed:', error);
      toast.error(error.message || 'Checkout failed. Please try again.');
    }
  };

  const handlePaymentSubmitWrapper = async (methodFromModal: DisplayPaymentMethod) => {
    await handlePaymentSubmit(methodFromModal);
  };

  const handleHoldOrder = () => { 
    if (items.length === 0) {
      toast.error("Cannot hold an empty cart.");
      return;
    }
    setIsNameInputModalOpen(true); 
  };

  if (isLoadingPaymentMethods) { 
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-2">Loading payment options...</p>
      </div>
    );
  }

  const discountValueForModal: number = Number(currentCartDiscount.value) || 0;

  const renderCustomerDisplay = () => {
    if (selectedCustomer && selectedCustomer.firstName) { 
      const customerName = `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim();
      return (
        <div className="flex items-center text-sm">
          <User size={16} className="mr-2 text-primary" />
          <span className="font-medium text-gray-700 dark:text-foreground">
            For: {customerName}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center text-sm">
        <User size={16} className="mr-2 text-gray-500 dark:text-muted-foreground" />
        <span className="text-gray-500 dark:text-muted-foreground">Walk-in Customer</span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-card rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-foreground flex items-center">
            <ShoppingCart className="mr-2 h-6 w-6 text-primary" /> Current Sale
          </h2>
          <button 
            onClick={handleClearCartRequest} 
            className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition-colors"
            title="Clear Cart"
            aria-label="Clear Cart"
          >
            <Trash2 size={20} />
          </button>
        </div>
        <div className="mt-3 mb-1 flex items-center justify-between">
          {renderCustomerDisplay()}
          <button
            onClick={onSelectCustomerClick}
            className="p-1.5 text-primary hover:text-primary/80 hover:bg-blue-50 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus:ring-opacity-50"
            title="Add or Select Customer"
          >
            <Edit size={18} />
          </button>
        </div>
        {salesStaff.length > 0 && (
          <div className="mt-2 flex items-center text-sm">
            <UserCheck size={16} className="mr-2 text-gray-500 dark:text-muted-foreground" />
            <select
              value={selectedEmployeeId || ''}
              onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
              className="flex-1 border border-gray-200 dark:border-border rounded px-2 py-1 text-sm text-gray-700 dark:text-foreground"
              title="Attribute this sale to a staff member"
            >
              <option value="">Sales staff (optional)</option>
              {salesStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName || ''}</option>
              ))}
            </select>
          </div>
        )}
        {hasPermission(user, 'sales.override_tax_mode') && (
          <div className="mt-2 flex items-center text-sm">
            <ShieldAlert size={16} className="mr-2 text-amber-500 shrink-0" />
            <select
              value={salesModeOverride || ''}
              onChange={(e) => setSalesModeOverride((e.target.value || null) as any)}
              className="flex-1 border border-gray-200 dark:border-border rounded px-2 py-1 text-sm text-gray-700 dark:text-foreground"
              title="Override this sale's tax mode away from the automatic default"
            >
              {/* The automatic default is now evidence-based, not just the
                  store's own flag — a plain walk-in is taxed even at a
                  duty-free-configured store; only a sale that actually went
                  through Duty-Free Sale intake (travellerContext present)
                  auto-zero-rates. This label mirrors createSaleController.js's
                  real resolution instead of the old always-store-default text. */}
              <option value="">
                Tax mode: Automatic ({travellerContext && isDutyFreeStore ? 'Duty-free/Export' : 'Domestic'})
              </option>
              <option value="domestic">Override: Domestic (taxed)</option>
              {/* Zero-rating options are disabled without traveller evidence
                  — a manual override can CORRECT the tax mode, but cannot
                  manufacture export eligibility a walk-in doesn't have. The
                  backend enforces the same rule independently and ignores
                  either option if selected without travellerContext, so
                  this is a UX guardrail, not the actual security boundary. */}
              <option value="duty_free" disabled={!travellerContext}>
                Override: Duty-Free (zero-rated){!travellerContext ? ' — requires traveller info' : ''}
              </option>
              <option value="export" disabled={!travellerContext}>
                Override: Export (zero-rated){!travellerContext ? ' — requires traveller info' : ''}
              </option>
            </select>
          </div>
        )}
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar px-4">
        {items.length === 0 ? (
          <p className="text-slate-500 text-center py-10">Your cart is empty.</p>
        ) : (
          items.map(item => (
            <CartItem 
              key={item.product.id} 
              item={item} 
              onRemove={removeFromCart}
              onUpdateQuantity={updateQuantity}
            />
          ))
        )}
      </div>

      <div className="p-4 border-t bg-gray-50 dark:bg-muted/50">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {promotionsAmount > 0 && (
            <div className="flex justify-between items-center py-1 text-sm">
              <span className="text-gray-700 dark:text-foreground">Promotions</span>
              <span className="text-green-600">-{formatCurrency(promotionsAmount)}</span>
            </div>
          )}

          {(() => {
            const interactiveDiscountLine = (
              <div className="flex justify-between items-center py-1 text-sm">
                <button
                  onClick={() => setIsDiscountModalOpen(true)}
                  className="text-primary hover:text-primary/80 font-medium disabled:text-gray-400 dark:text-muted-foreground disabled:cursor-not-allowed"
                  disabled={items.length === 0} 
                >
                  {currentCartDiscount.appliedAmount > 0
                    ? (currentCartDiscount.type === 'percentage'
                      ? `Change Discount (${currentCartDiscount.value}%)`
                      : `Change Discount (${formatCurrency(currentCartDiscount.value)} Max)`)
                    : 'Apply Discount'}
                </button>
                {currentCartDiscount.appliedAmount > 0 && (
                  <span className="text-green-600">
                    -{formatCurrency(currentCartDiscount.appliedAmount)}
                  </span>
                )}
              </div>
            );

            // Get detailed tax breakdown
            const taxBreakdown = getTaxBreakdown();
            const hasTaxBreakdown = taxBreakdown.length > 0;
            
            // Create the tax line items
            const taxLineItems = (
              <>
                {isCustomerTaxExempt ? (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="flex items-center">
                      <span className="text-green-600 font-medium">Tax Exempt</span>
                      {selectedCustomer && (
                        <span className="ml-1 text-xs text-gray-500 dark:text-muted-foreground">
                          ({selectedCustomer.firstName} {selectedCustomer.lastName})
                        </span>
                      )}
                    </span>
                    <span>{formatCurrency(0)}</span>
                  </div>
                ) : (
                  // Standard tax display with tooltip/info icon
                  <div className="flex justify-between text-sm mt-1">
                    <span className="flex items-center">
                      <span>Tax{pricesIncludeTax ? ' (Included)' : ''}</span>
                      {hasTaxBreakdown && (
                        <div className="relative group ml-1">
                          <Info size={14} className="text-gray-500 dark:text-muted-foreground cursor-help" />
                          <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-card shadow-lg rounded-md p-2 z-50 hidden group-hover:block">
                            <div className="text-xs font-medium mb-1">Tax Breakdown:</div>
                            {taxBreakdown.map((tax, index) => (
                              <div key={index} className="flex justify-between text-xs">
                                <span>{tax.name || 'Tax'}</span>
                                <span>{formatCurrency(tax.amount || 0)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </span>
                    <span className={pricesIncludeTax ? 'text-gray-500 dark:text-muted-foreground italic' : ''}>
                      {formatCurrency(taxAmount)}
                    </span>
                  </div>
                )}
              </>
            );

            if (discountApplicationPreference === 'before_tax') {
              return (
                <>
                  {interactiveDiscountLine}
                  {taxLineItems}
                </>
              );
            } else { 
              return (
                <>
                  {taxLineItems}
                  {interactiveDiscountLine}
                </>
              );
            }
          })()}

          <div className="flex justify-between font-semibold text-base border-t pt-2 mt-2">
            <span>Total</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="flex space-x-2 mt-4">
          <button
            onClick={items.length > 0 ? handleHoldOrder : (heldOrders.length > 0 ? onViewHeldOrders : () => { })}
            disabled={items.length === 0 && heldOrders.length === 0}
            className={`flex-grow basis-3/10 w-[30%] flex items-center justify-center p-3 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400
              ${items.length > 0 
                ? 'bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-400' 
                : heldOrders.length > 0 
                  ? 'bg-teal-500 hover:bg-teal-600 text-white focus:ring-teal-400'    
                  : 'bg-gray-300 cursor-not-allowed text-gray-500'}
            `}
          >
            {items.length > 0 ? (
              <Archive size={18} className="mr-2" />
            ) : (
              <ArchiveRestore size={18} className="mr-2" />
            )}
            {items.length > 0 
              ? 'Hold'
              : heldOrders.length > 0
                ? `Held (${heldOrders.length})`
                : 'Hold'}
          </button>

          <button
            onClick={handleInitiateCheckout}
            disabled={items.length === 0 || isProcessing}
            className="flex-grow basis-7/10 w-[70%] flex items-center justify-center p-3 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:bg-gray-300 disabled:text-gray-500 dark:text-muted-foreground transition-colors" 
          >
            {isProcessing ? (
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
            ) : (
              <CreditCard size={18} className="mr-2" />
            )}
            Checkout
          </button>
        </div>

      </div>
      {isPaymentModalOpen && (
        <PaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          totalAmount={totalAmount} 
          availablePaymentMethods={finalPaymentMethods} 
          onConfirmPayment={handlePaymentSubmitWrapper} 
          currencyCode={effectiveCurrencyCode} 
          selectedCustomer={selectedCustomer || null} 
          canChargeToAccount={canChargeToAccount}
        />
      )}
      {isDiscountModalOpen && (
        <DiscountModal 
          isOpen={isDiscountModalOpen}
          onClose={() => setIsDiscountModalOpen(false)}
          subtotal={subtotal} 
          currentDiscountValue={discountValueForModal} 
          currentDiscountType={currentCartDiscount.type === 'fixedAmount' ? 'fixed' : currentCartDiscount.type as 'fixed' | 'percentage'}   
          onApplyDiscount={handleApplyDiscount}
        />
      )}
      {isNameInputModalOpen && (
        <NameInputModal
          isOpen={isNameInputModalOpen}
          onClose={() => setIsNameInputModalOpen(false)}
          onSubmit={handleHoldOrderWithName}
          title="Hold Order As"
          promptText="Order Name"
          submitButtonText="Hold Order"
        />
      )}
      {isClearCartConfirmModalOpen && (
        <ConfirmationModal
          isOpen={isClearCartConfirmModalOpen}
          onClose={() => setIsClearCartConfirmModalOpen(false)}
          onConfirm={handleActualClearCart}
          title="Confirm Clear Cart"
          message="Are you sure you want to remove all items from the cart?"
        />
      )}
    </div>
  );
});

export default memo(Cart);
