import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CartItem, Product, HeldOrder, Customer, TaxClass, TaxClassRate, AppliedTaxDetail, JewelryLinePricing } from '@/types/index';
import { CartItemDiscount, PromotionalOffer } from '@/types/discount';
import toast from 'react-hot-toast';

import { usePromotionalOffersData } from '../hooks/usePromotionalOffersData';
import { createSale } from '@/services/salesService';
import type { TravellerContext } from '@/services/salesService';
import { getTaxClasses, getTaxClassRates, getStoreTaxConfig } from '@/services/api';
import { getJurisdictionContext } from '@/services/jurisdictionService';
import { useAuth } from './AuthContext';
import { useTaxConfig } from './TaxConfigContext';
import { v4 as uuidv4 } from 'uuid';

export type { TravellerContext };
// Dynamic import for discountService - cached locally
let cachedApplyItemWiseDiscounts: any = null;

type DiscountType = 'percentage' | 'fixed' | 'fixedAmount';

interface DiscountState {
  value: number;
  type: DiscountType;
  appliedAmount: number;
}

// Enhanced CartItem interface with item-specific discount support
interface EnhancedCartItem extends CartItem {
  originalPrice: number;
  appliedDiscounts: CartItemDiscount[];
  finalPrice: number;
  jewelryPricing?: JewelryLinePricing | null;
}

interface TaxConfigState {
  taxClass?: TaxClass;
  taxRate?: TaxClassRate;
  displayName: string;
  effectiveRate: number;
}

interface CartContextType {
  items: EnhancedCartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: (options?: { silent?: boolean }) => void;
  calculateTotal: () => number;
  calculateSubtotal: () => number;
  calculateTax: () => number;
  getTaxBreakdown: () => AppliedTaxDetail[];
  checkout: (paymentMethodId: string, customerId?: string | null) => Promise<{ id: string } | null>;
  isProcessing: boolean;
  discount: DiscountState;
  setDiscount: (value: number, type: DiscountType) => void;
  heldOrders: HeldOrder[];
  holdCurrentOrder: (name?: string) => void;
  restoreHeldOrder: (orderId: string) => void;
  deleteHeldOrder: (orderId: string) => void;
  
  // Customer related properties
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;

  // Sales employee attribution (optional, for commission/targets)
  selectedEmployeeId: string | null;
  setSelectedEmployeeId: (id: string | null) => void;

  // Duty-free traveller capture (Sales Hub — optional, only set when the sale
  // started from the Duty-Free Sale flow)
  travellerContext: TravellerContext | null;
  setTravellerContext: (context: TravellerContext | null) => void;

  // Whether the acting store is configured duty-free/export. Sales at such a
  // store are zero-rated automatically (see createSaleController.js) — this
  // is surfaced so the UI can show the same $0 tax the backend will charge,
  // and so a screen like the Hub knows to offer the Duty-Free Sale flow.
  isDutyFreeStore: boolean;

  // Per-transaction sales-mode override (Option B —
  // docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md §5). Lets a single
  // sale be rung as duty_free/export/domestic regardless of the store's own
  // default. The backend independently re-checks the acting user's
  // sales.override_tax_mode permission and silently falls back to the
  // store's default if they don't have it — this is convenience state for
  // the UI, never trusted as authorization.
  salesModeOverride: 'domestic' | 'duty_free' | 'export' | null;
  setSalesModeOverride: (mode: 'domestic' | 'duty_free' | 'export' | null) => void;

  // Tax related properties
  discountApplicationPreference: 'before_tax' | 'after_tax';
  taxClasses: TaxClass[];
  allTaxRates: TaxClassRate[];
  activeTaxConfig: TaxConfigState | null;
  appliedTaxDetails: AppliedTaxDetail[];
  
  // Promotional offers related properties and methods
  activeOffers: PromotionalOffer[];
  availableOffers: PromotionalOffer[];
  hasActiveOfferForProduct: (productId: string) => boolean;
  refreshOffers: () => Promise<void>;
  applyItemDiscount: (productId: string, offerId: string) => void;
  removeItemDiscount: (productId: string, offerId: string) => void;
  calculateItemDiscounts: () => number;

  // Jewelry weight-pricing — sets/clears the captured purity/weight/making
  // breakdown for a cart line, overriding its unit price for this sale.
  setJewelryPricing: (productId: string, pricing: JewelryLinePricing | null) => void;
}

const LOCAL_STORAGE_HELD_ORDERS_KEY = 'heldOrders';

const CartContext = createContext<CartContextType | null>(null);

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider = ({ children }: CartProviderProps): JSX.Element => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { taxConfig, pricesIncludeTax } = useTaxConfig();

  const [items, setItems] = useState<EnhancedCartItem[]>([]);
  
  // Load discountService function dynamically and cache it
  useEffect(() => {
    const loadDiscountService = async () => {
      try {
        const { applyItemWiseDiscounts } = await import('@/services/discountService');
        cachedApplyItemWiseDiscounts = applyItemWiseDiscounts;
      } catch (error) {
        console.error('Failed to load discountService:', error);
      }
    };
    loadDiscountService();
  }, []);
  // Use the cached promotional offers hook
  const { data: rawAvailableOffers, refresh: refreshPromotionalOffers } = usePromotionalOffersData();
  const availableOffers = rawAvailableOffers || [];
  const [activeOffers, setActiveOffers] = useState<PromotionalOffer[]>([]);
  
  // Debug log when offers change
  useEffect(() => {
    }, [availableOffers, activeOffers]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCustomerDiscountActive, setIsCustomerDiscountActive] = useState(false);
  const [isCustomerTaxExempt, setIsCustomerTaxExempt] = useState(false);
  const [cartSubtotal, setCartSubtotal] = useState<number>(0);
  const [cartTotalTax, setCartTotalTax] = useState<number>(0);
  const [cartTotal, setCartTotal] = useState<number>(0);
  const [appliedTaxDetails, _setAppliedTaxDetails] = useState<AppliedTaxDetail[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [selectedCustomerState, setSelectedCustomerState] = useState<Customer | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [travellerContext, setTravellerContext] = useState<TravellerContext | null>(null);
  const [isDutyFreeStore, setIsDutyFreeStore] = useState(false);
  const [salesModeOverride, setSalesModeOverride] = useState<'domestic' | 'duty_free' | 'export' | null>(null);
  const [zeroRateReasonForStore, setZeroRateReasonForStore] = useState<'duty_free' | 'export' | null>(null);
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [allTaxRates, setAllTaxRates] = useState<TaxClassRate[]>([]);
  const [activeTaxConfig, setActiveTaxConfig] = useState<TaxConfigState | null>(null);
  const [discountState, setDiscountState] = useState<DiscountState>({
    value: 0,
    type: 'percentage',
    appliedAmount: 0,
  });
  const [discountApplicationPreference, setDiscountApplicationPreference] = useState<'before_tax' | 'after_tax'>('before_tax');

  useEffect(() => {
    if (!isAuthLoading && user) {
      const pref = user.discountApplicationRule || user.store?.discountApplicationPreference || 'before_tax';
      setDiscountApplicationPreference(pref as 'before_tax' | 'after_tax'); // Cast to expected type
      
      // Fetch available offers when user is authenticated
      refreshPromotionalOffers();
    }
  }, [user, isAuthLoading]);

  // Resolve whether the acting store is duty-free/export once per session.
  // Failure is silent and defaults to false (ordinary tax applies) — a
  // jurisdiction-lookup problem here must not be the reason a cashier cannot
  // ring up a normal, non-duty-free sale.
  useEffect(() => {
    if (!user || isAuthLoading) {
      setIsDutyFreeStore(false);
      setZeroRateReasonForStore(null);
      return;
    }
    let active = true;
    getJurisdictionContext()
      .then((ctx) => {
        if (!active) return;
        setIsDutyFreeStore(Boolean(ctx?.zeroRated));
        setZeroRateReasonForStore(ctx?.isDutyFree ? 'duty_free' : ctx?.isExport ? 'export' : null);
      })
      .catch((error) => {
        console.error('CartContext: Error fetching jurisdiction context:', error);
        if (active) {
          setIsDutyFreeStore(false);
          setZeroRateReasonForStore(null);
        }
      });
    return () => { active = false; };
  }, [user, isAuthLoading]);

  useEffect(() => {
    const fetchTaxData = async () => {
      if (!user || isAuthLoading) {
        setTaxClasses([]);
        setAllTaxRates([]);
        return;
      }
      try {
        const taxClassesResponse = await getTaxClasses();
        const actualTaxClasses = Array.isArray(taxClassesResponse)
          ? taxClassesResponse
          : (taxClassesResponse && (taxClassesResponse as any).data) || [];

        // Check if the data array exists and has items
        if (actualTaxClasses && Array.isArray(actualTaxClasses) && actualTaxClasses.length > 0) {
          setTaxClasses(actualTaxClasses);

          const ratesRecord: Record<string, TaxClassRate[]> = {};
          if (actualTaxClasses.length > 0) {
            const allRatesPromises = actualTaxClasses.map((tc) =>
              getTaxClassRates(tc.id).then((ratesResp: unknown) => {
                // Unwrap common shapes: array or { data: [...] }
                const ratesArray: any[] = Array.isArray(ratesResp)
                  ? ratesResp as any[]
                  : (ratesResp && (ratesResp as any).data) || [];
                return {
                  taxClassId: String(tc.id),
                  // Attach taxClassId to each rate so downstream filters can match (as string)
                  rates: ratesArray.map((r: any) => ({ ...r, taxClassId: String(tc.id) }))
                };
              })
            );
            const allRatesResponses = await Promise.all(allRatesPromises);

            allRatesResponses.forEach((item: { taxClassId: string; rates: TaxClassRate[] }) => {
              if (item.rates && Array.isArray(item.rates)) { // Check item.rates
                ratesRecord[item.taxClassId] = item.rates; // Populate the record
              }
            });
          }
          // Convert the record to a flattened array of TaxClassRate objects
          const flattenedRates: TaxClassRate[] = Object.values(ratesRecord).flat();
          setAllTaxRates(flattenedRates); // Set as flattened array

          // Determine activeTaxConfig (store's default tax)
          // Prefer defaultTaxClassId from taxConfig, else from tax classes response payload
          const storeDefaultTaxClassId = taxConfig?.defaultTaxClassId
            || (!Array.isArray(taxClassesResponse) && ((taxClassesResponse as any).defaultTaxClassId || (taxClassesResponse as any).default_tax_class_id));
          let defaultTaxClass: TaxClass | undefined = undefined;

          if (storeDefaultTaxClassId) {
            // Use product-specific tax class if available
            defaultTaxClass = actualTaxClasses.find((tc) => {
              return tc.id === storeDefaultTaxClassId &&
                (tc.isActive === true || tc.isActive === 1 || tc.is_active === true || tc.is_active === 1);
            });
          }
          // Fallback to a class marked as is_default if no specific store default or user default
          if (!defaultTaxClass) {
            // Check both camelCase and snake_case for default and active status
            defaultTaxClass = actualTaxClasses.find((tc) => {
              return (
                (tc.isDefault === true || tc.isDefault === 1 || tc.is_default === true || tc.is_default === 1) &&
                (tc.isActive === true || tc.isActive === 1 || tc.is_active === true || tc.is_active === 1)
              );
            });
          }

          if (defaultTaxClass && ratesRecord[String(defaultTaxClass.id)]) {
            // Try both camelCase and snake_case for active status and accept boolean/number/string
            let activeRate = ratesRecord[String(defaultTaxClass.id)].find((r: any) => {
              const v = r.isActive !== undefined ? r.isActive : r.is_active;
              return v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
            }) as any;
            // If no explicit active rate, fall back to first available
            if (!activeRate && ratesRecord[String(defaultTaxClass.id)].length > 0) {
              activeRate = ratesRecord[String(defaultTaxClass.id)][0] as any;
            }
            if (activeRate) {
              // Set active tax config using the found tax rate
              // Convert rate to number - it comes as string from DB but we need number for calculations
              let rateValue = typeof activeRate.rate === 'string' ? parseFloat(activeRate.rate) : Number(activeRate.rate);
              
              // Check if the rate is already in decimal form (e.g., 0.0825) or percentage form (e.g., 8.25)
              // If it's greater than 1, assume it's in percentage form and convert to decimal
              if (rateValue > 1) {
                rateValue = rateValue / 100;
              }
              
              // Get tax rate name from either camelCase or snake_case property
              const taxRateName = activeRate.taxRateName || activeRate.tax_rate_name || 'Tax';
              
              // Now set the active tax config with the properly formatted rate
              const newActiveTaxConfig = {
                taxClass: defaultTaxClass,
                taxRate: activeRate,
                effectiveRate: rateValue, // Now correctly in decimal form (e.g., 0.0825 for 8.25%)
                displayName: `${taxRateName} (${rateValue > 1 ? rateValue.toFixed(2) : (rateValue * 100).toFixed(2)}%)` // Display percentage correctly
              };
              
              // Set the active tax configuration
              setActiveTaxConfig(newActiveTaxConfig);

            } else {
              setActiveTaxConfig(null);
            }
          } else {
            setActiveTaxConfig(null);
          }
        } else {
          setTaxClasses([]);
          setAllTaxRates([]);
        }
      } catch (error: any) {
        console.error('CartContext: Error fetching tax data:', error);
        
        // Fallback: fetch minimal store tax config so POS can still calculate tax without permissions
        try {
          const cfg = await getStoreTaxConfig();
          const defaultClassId = cfg?.defaultTaxClassId || null;
          const effectiveRates = Array.isArray(cfg?.defaultTaxRates) ? cfg.defaultTaxRates : [];
          const derivedPricesInclusive = String(cfg?.defaultTaxBasis || 'EXCLUSIVE').toUpperCase() === 'INCLUSIVE';

          // Populate minimal tax classes and rates so calculations can proceed
          const minimalClasses = Array.isArray(cfg?.taxClasses) && cfg.taxClasses.length > 0
            ? cfg.taxClasses
            : (defaultClassId ? [{ id: String(defaultClassId), name: 'Default Tax', isActive: true, isDefault: true }] as any : []);

          setTaxClasses(minimalClasses as any);
          setAllTaxRates(effectiveRates as any);

          // Determine active rate
          let activeRate: any = effectiveRates.find((r: any) => {
            const v = r?.isActive ?? r?.is_active;
            return v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
          });
          if (!activeRate && effectiveRates.length > 0) activeRate = effectiveRates[0];

          if (defaultClassId && activeRate) {
            let rateValue = typeof activeRate.rate === 'string' ? parseFloat(activeRate.rate) : Number(activeRate.rate);
            if (rateValue > 1) rateValue = rateValue / 100;
            setActiveTaxConfig({
              taxClass: { id: String(defaultClassId) } as any,
              taxRate: activeRate,
              effectiveRate: rateValue,
              displayName: `${activeRate.taxRateName || 'Tax'} (${(rateValue * 100).toFixed(2)}%)`
            });
          } else {
            setActiveTaxConfig(null);
          }

          // Note: pricesIncludeTax is sourced from TaxConfigContext; this fallback does not override it.
          if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
            console.debug('[POS Tax][Fallback] Applied store-config fallback', { derivedPricesInclusive, defaultClassId, rates: effectiveRates?.length });
          }
        } catch (fallbackErr) {
          // Final fallback: no tax config available
          if (error?.message?.includes('403')) {
            console.log('CartContext: No permission for detailed tax endpoints; store-config fallback also failed. Proceeding without tax.');
          } else {
            toast.error('Failed to load tax configurations.');
          }
          setTaxClasses([]);
          setAllTaxRates([]);
          setActiveTaxConfig(null);
        }
      }
    };

    fetchTaxData();
  }, [user, isAuthLoading]);

  useEffect(() => {
    // Update active tax config when taxConfig changes
    if (taxClasses.length > 0 && Object.keys(allTaxRates).length > 0) {
      // Use the default tax class ID from taxConfig if available (camelCase after fetchApi conversion)
      const defaultTaxClassId = taxConfig?.defaultTaxClassId;

      
      let defaultTaxClass = defaultTaxClassId
        ? taxClasses.find((tc) => tc.id === defaultTaxClassId && tc.isActive)
        : undefined;

      // Fallback if the default tax class from taxConfig isn't found or active
      if (!defaultTaxClass) {
        // Check both camelCase and snake_case for default and active status
        defaultTaxClass = taxClasses.find((tc) => {
          return (
            (tc.isDefault === true || tc.isDefault === 1 || tc.is_default === true || tc.is_default === 1) &&
            (tc.isActive === true || tc.isActive === 1 || tc.is_active === true || tc.is_active === 1)
          );
        });
      }

      // Create a type-safe way to check if tax rates exist for a class ID
      const taxRatesForClass = (classId: string): TaxClassRate[] => {
        const cid = String(classId);
        return allTaxRates.filter(rate => {
          // Handle both standard and legacy property names
          const rateClassId = (rate as any).tax_class_id ?? (rate as any).taxClassId;
          return String(rateClassId) === cid;
        });
      };
      
      if (defaultTaxClass) {
        const relevantRates = taxRatesForClass(defaultTaxClass.id);
        // Try both camelCase and snake_case for active status and accept boolean/number/string
        let activeRate = relevantRates.find((r: any) => {
          const v = r.isActive !== undefined ? r.isActive : r.is_active;
          return v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
        }) as any;
        // Fallback to first available rate if none marked active
        if (!activeRate && relevantRates.length > 0) {
          activeRate = relevantRates[0] as any;
        }
        if (activeRate) {
          // Set active tax config using the found tax rate
          // Convert rate to number - it comes as string from DB but we need number for calculations
          let rateValue = typeof activeRate.rate === 'string' ? parseFloat(activeRate.rate) : Number(activeRate.rate);
          
          // Check if the rate is already in percentage form (e.g., 8.25 instead of 0.0825)
          // If the rate is > 1, assume it's in percentage form and convert to decimal
          if (rateValue > 1) {
            rateValue = rateValue / 100;
          }
          
          const newActiveTaxConfig = {
            taxClass: defaultTaxClass,
            taxRate: activeRate,
            effectiveRate: rateValue, // Store as decimal (e.g., 0.0825 for 8.25%)
            displayName: `${activeRate.taxRateName} (${(rateValue * 100).toFixed(2)}%)` // Convert to percentage for display
          };
          setActiveTaxConfig(newActiveTaxConfig);
        } else {
          setActiveTaxConfig(null); // Explicitly set to null
        }
      } else {
        setActiveTaxConfig(null); // Explicitly set to null
      }
    }
  }, [taxClasses, allTaxRates, taxConfig]); // Removed activeTaxConfig from dependencies

  useEffect(() => {
    const storedHeldOrders = localStorage.getItem(LOCAL_STORAGE_HELD_ORDERS_KEY);
    if (storedHeldOrders) {
      try {
        const parsedOrders = JSON.parse(storedHeldOrders) as HeldOrder[];
        setHeldOrders(parsedOrders);
      } catch (error) {
        console.error("Failed to parse held orders from localStorage:", error);
        localStorage.removeItem(LOCAL_STORAGE_HELD_ORDERS_KEY); // Clear corrupted data
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_HELD_ORDERS_KEY, JSON.stringify(heldOrders));
  }, [heldOrders]);

  // Function to refresh offers (useful when navigating)
  const refreshOffers = useCallback(async () => {
    await refreshPromotionalOffers();
  }, [refreshPromotionalOffers]);
  
  // Set active offers by filtering the list of available offers.
  useEffect(() => {
    const active = availableOffers.filter(offer => {
      const now = new Date();
      // Handle missing or invalid dates gracefully
      const hasStart = !!offer.startDate;
      const hasEnd = !!offer.endDate;
      const startDate = hasStart ? new Date(offer.startDate as any) : null;
      const endDate = hasEnd ? new Date(offer.endDate as any) : null;

      const startValid = !startDate || !isNaN(startDate.getTime());
      const endValid = !endDate || !isNaN(endDate.getTime());

      const startsOk = !startDate || (startValid && startDate <= now);
      const endsOk = !endDate || (endValid && endDate >= now);

      const isActive = offer.isActive && startsOk && endsOk;
      

      if (offer.isActive && (!startValid || !endValid)) {
        // eslint-disable-next-line no-console
        console.warn('[Promotions] Offer has invalid date(s); treating as open range:', {
          id: offer.id,
          name: offer.name,
          startDate: offer.startDate,
          endDate: offer.endDate
        });
      }

      return isActive;
    });
    setActiveOffers(active);
  }, [availableOffers]);

  // Initialize cart state from localStorage on component mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        // Ensure all cart items have the required discount fields
        const enhancedCart = parsedCart.map((item: CartItem) => ({
          ...item,
          originalPrice: item.product.price,
          appliedDiscounts: (item as any).appliedDiscounts || [],
          finalPrice: (item as any).finalPrice || item.product.price
        }));
        setItems(enhancedCart);
      } catch (error) {
        console.error('Failed to parse saved cart:', error);
        localStorage.removeItem('cart');
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);
  
  // Listen for route changes to refresh offers when returning to relevant pages
  useEffect(() => {
    const handleRouteChange = () => {
      refreshOffers();
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [refreshOffers]);

  // Check if a product has any active offers
  const hasActiveOfferForProduct = useCallback((productId: string): boolean => {
    if (!activeOffers || activeOffers.length === 0) return false;
    
    return activeOffers.some(offer => {
      // Check if offer has rules that apply to this product
      return offer.rules && offer.rules.some(rule => {
        return rule.ruleType === 'product' && rule.entityId === productId;
      });
    });
  }, [activeOffers]);

  // Mirrors createSaleController.js's isZeroRatedSale/overrideHonored
  // resolution exactly, so the till shows the same total it will actually
  // charge (the backend is still the source of truth — this is display
  // only, and re-verifies everything independently):
  //   1. An override requesting duty_free/export is only honored when
  //      traveller evidence was actually captured for this sale — a manual
  //      override permission lets someone CORRECT the tax mode, not zero-
  //      rate a sale with no export justification. An override to
  //      'domestic' needs no evidence, since removing an exemption is
  //      always safe.
  //   2. Otherwise, automatic zero-rating requires the same evidence —
  //      traveller data captured via the Duty-Free Sale intake — not just
  //      the store being duty-free-capable. A plain walk-in checkout at a
  //      duty-free-configured store is taxed like any other domestic sale.
  const hasTravellerEvidence = Boolean(travellerContext);
  const overrideRequestsZeroRating = salesModeOverride === 'duty_free' || salesModeOverride === 'export';
  const overrideHonored = Boolean(salesModeOverride) && (!overrideRequestsZeroRating || hasTravellerEvidence);
  const effectiveIsDutyFreeSale = overrideHonored
    ? overrideRequestsZeroRating
    : hasTravellerEvidence && isDutyFreeStore;

  // Calculate totals and taxes for the cart without updating state
  // This breaks the circular dependency by not using other callback functions
  const calculateTotalsAndTaxes = useCallback(() => {
    // Use the pricesIncludeTax value from TaxConfigContext
    const isTaxInclusive = pricesIncludeTax;

    // Check if the selected customer is tax exempt, OR the acting store is
    // configured duty-free/export — a duty-free store's sales carry no local
    // consumption tax regardless of the customer or the product's tax class
    // (createSaleController.js enforces the same rule server-side; this just
    // makes the till show the same total it will actually charge).
    const customerTaxExemptStatus = selectedCustomerState?.isTaxExempt === true ||
                             (selectedCustomerState as any)?.is_tax_exempt === true ||
                             (selectedCustomerState as any)?.is_tax_exempt === 1 ||
                             effectiveIsDutyFreeSale;

    // Update the state variable
    setIsCustomerTaxExempt(customerTaxExemptStatus);

    // Skip tax calculation if customer is tax exempt
    if (customerTaxExemptStatus) {
      // If customer is tax exempt, set zero tax and update totals
      setCartTotalTax(0);
      _setAppliedTaxDetails([]);

      // Calculate raw subtotal first
      const rawSubtotal = items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
      }, 0);

      const currentSubtotal = Math.round(rawSubtotal * 100) / 100;

      // Apply promotional discounts before manual discount
      const promoResult = cachedApplyItemWiseDiscounts ? cachedApplyItemWiseDiscounts(items as any, activeOffers || []) : { totalDiscount: 0, updatedItems: items };
      const promoDiscountAmount = Math.max(0, Math.round((promoResult.totalDiscount || 0) * 100) / 100);
      const subtotalAfterPromos = Math.max(0, Math.round((currentSubtotal - promoDiscountAmount) * 100) / 100);

      // Calculate manual discount
      let calculatedDiscountAmount = 0;
      if (discountState.value > 0) {
        if (discountState.type === 'percentage') {
          calculatedDiscountAmount = Math.round((subtotalAfterPromos * (discountState.value / 100)) * 100) / 100;
        } else if (discountState.type === 'fixed') {
          calculatedDiscountAmount = Math.min(discountState.value, subtotalAfterPromos);
        }
      }

      // Update discount state with calculated manual amount (promos are item-level)
      setDiscountState(prev => ({ ...prev, appliedAmount: calculatedDiscountAmount }));

      // Final total is subtotal after promos minus manual discount (no tax)
      const finalTotal = Math.max(0, subtotalAfterPromos - calculatedDiscountAmount);
      setCartSubtotal(currentSubtotal); // keep showing pre-promo subtotal, as before
      setCartTotal(finalTotal);

      return; // Exit early since no tax calculation is needed
    }
    
    // Continue with normal tax calculation for non-exempt customers
    
    // Calculate raw subtotal first
    const rawSubtotal = items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);
    
    // Round to exactly 2 decimal places to avoid floating point issues
    const currentSubtotal = Math.round(rawSubtotal * 100) / 100;

    // Apply promotional discounts (item-wise like buy_x_get_y) before manual cart discounts
    const promoResult = cachedApplyItemWiseDiscounts ? cachedApplyItemWiseDiscounts(items as any, activeOffers || []) : { totalDiscount: 0, updatedItems: items };
    const promoDiscountAmount = Math.max(0, Math.round((promoResult.totalDiscount || 0) * 100) / 100);
    const subtotalAfterPromos = Math.max(0, Math.round((currentSubtotal - promoDiscountAmount) * 100) / 100);
    // Build per-product promo discount map (line-level). This lets us subtract promos from tax base per item.
    const promoDiscountByProduct: Record<string, number> = {};
    if (promoResult?.updatedItems && Array.isArray(promoResult.updatedItems)) {
      promoResult.updatedItems.forEach((ui: any) => {
        const linePromo = Array.isArray(ui.appliedDiscounts)
          ? ui.appliedDiscounts.reduce((sum: number, d: any) => sum + Number(d?.discountAmount || 0), 0)
          : 0;
        promoDiscountByProduct[ui.product?.id] = Math.round(linePromo * 100) / 100;
      });
    }
    
    // Calculate discount amount with proper rounding
    let calculatedDiscountAmount = 0;
    if (discountState.value > 0) {
      if (discountState.type === 'percentage') {
        // Apply manual discount on top of promo-adjusted subtotal
        calculatedDiscountAmount = Math.round((subtotalAfterPromos * (discountState.value / 100)) * 100) / 100;
      } else if (discountState.type === 'fixed') {
        calculatedDiscountAmount = Math.min(discountState.value, subtotalAfterPromos);
      }
    }
    
    // Calculate subtotal after discount with proper rounding
    const subtotalAfterDiscount = Math.round((subtotalAfterPromos - calculatedDiscountAmount) * 100) / 100;
    
    // Calculate tax
    let cartTax = 0;

    // Use the freshly-computed customerTaxExemptStatus from this same
    // function call, NOT the isCustomerTaxExempt state variable — setState
    // (line ~594 above) doesn't take effect until the next render, so
    // reading the state here reads last render's value. That's stale by
    // exactly one toggle: switching the tax-mode override from Duty-Free
    // back to Domestic computed customerTaxExemptStatus = false correctly,
    // called setIsCustomerTaxExempt(false), then immediately fell into this
    // same branch checking the STILL-true value from before the switch —
    // tax stayed 0 until some unrelated dependency (e.g. adding another
    // item) happened to re-run this function a second time.
    if (customerTaxExemptStatus) {
      // Customer is tax exempt, skip all tax calculations
      cartTax = 0;
      // Return early with tax set to 0
      return {
        subtotal: currentSubtotal,
        discountAmount: calculatedDiscountAmount,
        subtotalAfterDiscount,
        tax: 0,
        total: subtotalAfterDiscount,
        items: items.map(item => ({
          ...item,
          lineTotal: item.product.price * item.quantity
        }))
      };
    } else {
      if (isTaxInclusive) {
        // For tax-inclusive pricing, we need to extract the tax that's already included in the price
        
        // Get the tax rate from the active tax config (e.g., 0.0825 for 8.25%)
        let taxRate = activeTaxConfig?.effectiveRate || 0;
        
        // Calculate with tax rate
        
        if (taxRate > 0) {
          // For tax-inclusive prices, the formula to extract tax is:
          // tax = price * (tax_rate / (1 + tax_rate))
          const taxRateFactor = taxRate / (1 + taxRate);
          
          // Calculate tax directly from the subtotal after discount
          cartTax = Math.round((subtotalAfterDiscount * taxRateFactor) * 100) / 100;
          
          // Tax has been extracted from the inclusive price
        }
      } else {
        // For tax-exclusive pricing, calculate tax normally or fallback to default rate
        if (items.length > 0 && taxClasses.length > 0) {

          // Group items by tax class for itemized tax calculation
          const itemsByTaxClass: Record<string, EnhancedCartItem[]> = {};
          
          // Process each cart item
          items.forEach(item => {
            // Determine which tax class to use (product > customer > store default)
            let effectiveTaxClassId: string | null = null;
            
            // 1. Check if product has explicit tax class setting (including null for tax-exempt)
            if ('taxClassId' in item.product) {
              // Product has explicit tax class setting
              // - If taxClassId is a string (UUID), use that tax class
              // - If taxClassId is explicitly null, the product is tax-exempt (no tax)
              // - If taxClassId is undefined or empty string, treat as null (tax-exempt)
              const productTaxClass = item.product.taxClassId;
              effectiveTaxClassId = (productTaxClass && productTaxClass.trim() !== '') ? productTaxClass : null;
            }
            // 2. Check customer default tax class (only if product doesn't have explicit setting)
            else if (selectedCustomerState?.defaultTaxClassId) {
              effectiveTaxClassId = selectedCustomerState.defaultTaxClassId;
            }
            // 3. Check store default tax class from taxConfig (only if no explicit product or customer setting)
            else if (taxConfig?.defaultTaxClassId) {
              effectiveTaxClassId = taxConfig.defaultTaxClassId;
            }
            // 4. Check activeTaxConfig (fallback)
            else if (activeTaxConfig?.taxClass?.id) {
              effectiveTaxClassId = activeTaxConfig.taxClass.id;
            }
            
            if (effectiveTaxClassId) {
              const key = String(effectiveTaxClassId);
              if (!itemsByTaxClass[key]) {
                itemsByTaxClass[key] = [];
              }
              itemsByTaxClass[key].push(item);
            }
          });

          // Calculate tax for each group
          Object.keys(itemsByTaxClass).forEach(taxClassId => {
            const groupItems = itemsByTaxClass[taxClassId];

            // Get tax rates for this tax class ID safely
            let taxRates = Array.isArray(allTaxRates) 
              ? allTaxRates.filter(rate => {
                  // Handle both camelCase and snake_case field names
                  const rateClassId = (rate as any).taxClassId || (rate as any).tax_class_id;
                  return String(rateClassId) === String(taxClassId);
                })
              : (allTaxRates && taxClassId in allTaxRates) 
                ? allTaxRates[taxClassId as keyof typeof allTaxRates] || [] 
                : [];

            // Fallback: if no rates found but this group is the store's active default class, use activeTaxConfig.taxRate
            if ((!taxRates || taxRates.length === 0) && activeTaxConfig?.taxClass?.id && String(activeTaxConfig.taxClass.id) === String(taxClassId) && activeTaxConfig.taxRate) {
              taxRates = [activeTaxConfig.taxRate as unknown as TaxClassRate];
            }

            // Calculate total amount for this tax class (always)
            let taxableAmount = 0;
            groupItems.forEach(item => {
              const itemAmount = item.product.price * item.quantity;
              // Subtract line-level promotional discounts from the taxable base
              const itemPromoDiscount = promoDiscountByProduct[item.product.id] || 0;
              if (discountApplicationPreference === 'before_tax') {
                // Apply discount before calculating tax
                let itemDiscountAmount = 0;
                if (discountState.type === 'percentage') {
                  itemDiscountAmount = (itemAmount * discountState.value) / 100;
                } else if (discountState.type === 'fixed' && subtotalAfterPromos > 0) {
                  // Distribute fixed discount proportionally
                  itemDiscountAmount = (itemAmount / subtotalAfterPromos) * discountState.value;
                }
                taxableAmount += Math.max(0, (itemAmount - itemPromoDiscount - itemDiscountAmount));
              } else {
                taxableAmount += Math.max(0, (itemAmount - itemPromoDiscount));
              }
            });
            taxableAmount = Math.round(taxableAmount * 100) / 100;

            if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
              // eslint-disable-next-line no-console
              console.debug('[POS Tax][Group]', { taxClassId, groupSize: groupItems.length, taxableAmount });
            }

            if (taxRates.length > 0) {
              // Apply each rate attached to this class
              taxRates.forEach((rate: TaxClassRate) => {
                let rateValue = typeof rate.rate === 'string' ? parseFloat(rate.rate) : Number(rate.rate);
                const calculationRate = rateValue > 1 ? rateValue / 100 : rateValue;
                const taxAmount = Math.round((taxableAmount * calculationRate) * 100) / 100;
                cartTax += taxAmount;
              });
            } else {
              if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
                // eslint-disable-next-line no-console
                console.debug('[POS Tax][No Rates]', { taxClassId, groupSize: groupItems.length });
              }
            }
          });

        // Strict mode: no fallback tax application
      }
    }
    }
    
    // Temporary debug to trace tax calc (Vite dev flag)
    if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[POS Tax]', {
        isTaxInclusive,
        discountApplicationPreference,
        activeTaxConfig,
        subtotalAfterDiscount,
        cartTaxBeforeRound: cartTax
      });
    }
    // Ensure proper rounding for tax
    const roundedTax = Math.round(cartTax * 100) / 100;
    
    // Calculate final total based on tax inclusivity
    let finalTotal;
    
    if (isTaxInclusive) {
      // For tax-inclusive pricing, the total is just the subtotal after discount
      // since the tax is already included in the price
      finalTotal = subtotalAfterDiscount;
      // Final total already includes tax
    } else {
      // For tax-exclusive pricing, add tax to the subtotal after discount
      finalTotal = Math.round((subtotalAfterDiscount + roundedTax) * 100) / 100;
      // Final total calculated by adding tax to the subtotal after discount
    }
    
    return {
      // Expose subtotal before promos for UI if needed, but for now keep existing meaning
      subtotal: currentSubtotal,
      // Manual discount amount (cart-level). Promo discounts are reflected in totals via subtotalAfterPromos
      discountAmount: calculatedDiscountAmount,
      tax: roundedTax,
      total: finalTotal
    };
  }, [items, discountState, taxClasses, allTaxRates, activeTaxConfig, selectedCustomerState, discountApplicationPreference, pricesIncludeTax, activeOffers, effectiveIsDutyFreeSale]);

  // This useEffect is already defined earlier in the file, so removing the duplicate

  // Update totals and taxes when relevant cart data changes
  useEffect(() => {
    // Skip calculations during initial render when tax data might not be loaded
    // Allow calculations even without tax classes for new tenants
    if (taxClasses.length === 0 && Object.keys(allTaxRates).length === 0 && items.length > 0) {
      // Calculate totals with fallback to store default tax when no tax classes/rates
      const rawSubtotal = items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
      }, 0);
      
      const currentSubtotal = Math.round(rawSubtotal * 100) / 100;
      setCartSubtotal(currentSubtotal);
      
      // Apply promotional discounts before manual cart discount (no tax scenario)
      const promoResult = cachedApplyItemWiseDiscounts ? cachedApplyItemWiseDiscounts(items as any, activeOffers || []) : { totalDiscount: 0, updatedItems: items };
      const promoDiscountAmount = Math.max(0, Math.round((promoResult.totalDiscount || 0) * 100) / 100);
      const subtotalAfterPromos = Math.max(0, Math.round((currentSubtotal - promoDiscountAmount) * 100) / 100);

      // Calculate manual discount based on subtotal after promos
      let calculatedDiscountAmount = 0;
      if (discountState.value > 0) {
        if (discountState.type === 'percentage') {
          calculatedDiscountAmount = Math.round((subtotalAfterPromos * (discountState.value / 100)) * 100) / 100;
        } else if (discountState.type === 'fixed') {
          calculatedDiscountAmount = Math.min(discountState.value, subtotalAfterPromos);
        }
      }

      // Persist manual discount applied amount (promo discounts are item-level)
      setDiscountState(prev => ({ ...prev, appliedAmount: calculatedDiscountAmount }));

      // Fallback tax calculation using store default rate if available.
      // A duty-free/export store has no tax to fall back to, regardless of
      // whether a store default rate happens to be configured.
      const effRate = effectiveIsDutyFreeSale
        ? 0
        : (typeof activeTaxConfig?.effectiveRate === 'number' ? activeTaxConfig.effectiveRate : 0);
      let fallbackTax = 0;
      let finalTotal = 0;
      if (effRate > 0) {
        if (pricesIncludeTax) {
          // Extract included tax from subtotalAfterDiscount
          const subtotalAfterDiscount = Math.round((subtotalAfterPromos - calculatedDiscountAmount) * 100) / 100;
          const taxRateFactor = effRate / (1 + effRate);
          fallbackTax = Math.round((subtotalAfterDiscount * taxRateFactor) * 100) / 100;
          finalTotal = subtotalAfterDiscount; // inclusive
        } else {
          // Add tax on top for exclusive pricing
          const subtotalAfterDiscount = Math.round((subtotalAfterPromos - calculatedDiscountAmount) * 100) / 100;
          fallbackTax = Math.round((subtotalAfterDiscount * effRate) * 100) / 100;
          finalTotal = Math.round((subtotalAfterDiscount + fallbackTax) * 100) / 100;
        }
      } else {
        // No configured rate; treat as no tax
        fallbackTax = 0;
        finalTotal = Math.max(0, subtotalAfterPromos - calculatedDiscountAmount);
      }

      setCartTotalTax(fallbackTax);
      setCartTotal(finalTotal);
      _setAppliedTaxDetails([]);
      
      return;
    }
    
    // Proceed even if tax classes are present but rates are not yet loaded; we'll use fallback
    // We call calculateTotalsAndTaxes directly, but don't include it in the dependency array
    const results = calculateTotalsAndTaxes();
    
    // Only update state if results are available
    if (results) {
      // Update all the state values at once
      setCartSubtotal(results.subtotal);
      setDiscountState(prev => ({
        ...prev,
        appliedAmount: results.discountAmount
      }));
      setCartTotalTax(results.tax);
      setCartTotal(results.total);
    }
    
    // Log the tax basis and calculation results for debugging
  }, [items, discountState.value, discountState.type, selectedCustomerState, discountApplicationPreference, taxClasses, allTaxRates, activeTaxConfig, pricesIncludeTax, activeOffers, effectiveIsDutyFreeSale]);
  // ^ We include all dependencies that calculateTotalsAndTaxes uses, except for the function itself

  // Sync item-level promotional discounts (e.g., buy_x_get_y) into cart items for accurate line display
  useEffect(() => {
    if (!items || items.length === 0) return;
    const promo = cachedApplyItemWiseDiscounts ? cachedApplyItemWiseDiscounts(items as any, activeOffers || []) : { totalDiscount: 0, updatedItems: items };

    // Merge updated discounts into items without disrupting other fields
    const merged = items.map((item) => {
      const updated = promo.updatedItems.find((u: any) => u.product.id === item.product.id);
      if (!updated) return item;

      const existingSignature = JSON.stringify({ d: item.appliedDiscounts, f: item.finalPrice });
      const updatedSignature = JSON.stringify({ d: updated.appliedDiscounts, f: updated.finalPrice });
      if (existingSignature === updatedSignature) return item;

      return {
        ...item,
        appliedDiscounts: updated.appliedDiscounts,
        finalPrice: updated.finalPrice,
      };
    });

    // Only set if there is any change to avoid loops
    const changed = merged.some((it, idx) => it !== items[idx]);
    if (changed) {
      setItems(merged);
    }
  }, [items, activeOffers]);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    setItems(prevItems => {
      // Check if product already exists in cart
      const existingItemIndex = prevItems.findIndex(item => item.product.id === product.id);
      
      if (existingItemIndex !== -1) {
        // Update quantity of existing item
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity
        };
        return updatedItems;
      } else {
        // Create new cart item with discount fields initialized
        const newItem: EnhancedCartItem = { 
          product, 
          quantity,
          originalPrice: product.price,
          appliedDiscounts: [] as CartItemDiscount[],
          finalPrice: product.price
        };
        
        // First check if product has an associated promotional offer (new system)
        if (product.promotionalOfferId) {
          // Find the offer in available offers
          const associatedOffer = availableOffers.find(offer => offer.id === product.promotionalOfferId);
          
          if (associatedOffer) {
            // Calculate discount amount based on offer type
            let discountAmount = 0;
            
            if (associatedOffer.offerType === 'percentage_discount') {
              discountAmount = (product.price * associatedOffer.discountValue / 100) * quantity;
            } else if (associatedOffer.offerType === 'fixed_discount') {
              discountAmount = associatedOffer.discountValue * quantity;
            }
            
            // Round discount amount to 2 decimal places
            discountAmount = Math.round(discountAmount * 100) / 100;

            const newDiscount: CartItemDiscount = {
              offerId: associatedOffer.id,
              offerName: associatedOffer.name,
              discountType: associatedOffer.offerType,
              discountValue: associatedOffer.discountValue,
              discountAmount: discountAmount,
            };

            // Apply the discount to the new item
            newItem.appliedDiscounts.push(newDiscount);
            
            // Calculate final price after discount
            newItem.finalPrice = Math.max(0, (newItem.originalPrice * newItem.quantity) - discountAmount) / newItem.quantity;
            
            console.log(`Applied product-specific offer ${associatedOffer.name} to ${product.name}`);
          }
        } 
        // Fall back to legacy specific discount fields if no promotional offer is applied
        else if (product.specific_discount_type && product.specific_discount_value) {
          // Calculate discount amount based on legacy discount type
          let discountAmount = 0;
          
          if (product.specific_discount_type === 'percentage') {
            discountAmount = (product.price * product.specific_discount_value / 100) * quantity;
          } else if (product.specific_discount_type === 'fixed') {
            discountAmount = product.specific_discount_value * quantity;
          }
          
          // Round discount amount to 2 decimal places
          discountAmount = Math.round(discountAmount * 100) / 100;
          
          // Create a discount object for this product-specific discount
          // Map the legacy discount types to valid OfferType values
          const mappedDiscountType = product.specific_discount_type === 'percentage' ? 'percentage_discount' : 
                                     product.specific_discount_type === 'fixed' ? 'fixed_discount' : 'fixed_discount';
          
          const productDiscount: CartItemDiscount = {
            offerId: `product-${product.id}`,
            offerName: 'Product-specific Discount',
            discountType: mappedDiscountType,
            discountValue: product.specific_discount_value,
            discountAmount
          };
          
          // Apply the discount to the new item
          newItem.appliedDiscounts = [productDiscount];
          
          // Calculate final price after discount
          const effectiveDiscount = Math.min(discountAmount, product.price * quantity);
          newItem.finalPrice = Math.max(0, product.price - (effectiveDiscount / quantity));
          
          console.log(`Applied legacy discount (${product.specific_discount_type}: ${product.specific_discount_value}) to ${product.name}`);
        }
        
        return [...prevItems, newItem];
      }
    });
    
    // Show success toast
    // toast.success(`${product.name} added to cart`);
  }, [availableOffers]);
  
  // Apply a specific discount offer to a cart item
  const applyItemDiscount = useCallback((productId: string, offerId: string) => {
    // Find the offer to apply
    const offerToApply = availableOffers.find(offer => offer.id === offerId);
    if (!offerToApply) {
      toast.error('Promotional offer not found');
      return;
    }
    
    setItems(prevItems => {
      // Find the item to apply discount to
      const itemIndex = prevItems.findIndex(item => item.product.id === productId);
      if (itemIndex === -1) {
        toast.error('Product not found in cart');
        return prevItems;
      }
      
      const item = prevItems[itemIndex];
      
      // Check if this offer is already applied to this item
      if (item.appliedDiscounts.some(discount => discount.offerId === offerId)) {
        toast('This offer is already applied to this item');
        return prevItems;
      }
      
      // Calculate discount amount based on offer type
      let discountAmount = 0;
      const itemPrice = item.product.price;
      
      if (offerToApply.offerType === 'percentage_discount') {
        discountAmount = (itemPrice * offerToApply.discountValue / 100) * item.quantity;
      } else if (offerToApply.offerType === 'fixed_discount') {
        discountAmount = offerToApply.discountValue * item.quantity;
      }
      
      // Round discount amount to 2 decimal places
      discountAmount = Math.round(discountAmount * 100) / 100;
      
      // Create new discount object
      const newDiscount: CartItemDiscount = {
        offerId: offerToApply.id,
        offerName: offerToApply.name,
        discountType: offerToApply.offerType,
        discountValue: offerToApply.discountValue,
        discountAmount
      };
      
      // Create updated item with new discount applied
      const updatedItem = {
        ...item,
        appliedDiscounts: [...item.appliedDiscounts, newDiscount],
      };
      
      // Recalculate final price after all discounts
      const totalDiscountAmount = updatedItem.appliedDiscounts.reduce(
        (sum, discount) => sum + discount.discountAmount, 0
      );
      
      // Ensure discount doesn't exceed item price
      const maxDiscount = item.originalPrice * item.quantity;
      const effectiveDiscount = Math.min(totalDiscountAmount, maxDiscount);
      
      updatedItem.finalPrice = Math.max(0, item.originalPrice - (effectiveDiscount / item.quantity));
      
      // Create new items array with updated item
      const updatedItems = [...prevItems];
      updatedItems[itemIndex] = updatedItem;
      
      //toast.success(`Applied ${offerToApply.name} to ${item.product.name}`);
      return updatedItems;
    });
  }, [availableOffers]);
  
  // Remove a specific discount offer from a cart item
  const removeItemDiscount = useCallback((productId: string, offerId: string) => {
    setItems(prevItems => {
      // Find the item to remove discount from
      const itemIndex = prevItems.findIndex(item => item.product.id === productId);
      if (itemIndex === -1) {
        toast.error('Product not found in cart');
        return prevItems;
      }
      
      const item = prevItems[itemIndex];
      
      // Check if this offer is applied to this item
      if (!item.appliedDiscounts.some(discount => discount.offerId === offerId)) {
        toast('This offer is not applied to this item');
        return prevItems;
      }
      
      // Create updated item with discount removed
      const updatedItem = {
        ...item,
        appliedDiscounts: item.appliedDiscounts.filter(discount => discount.offerId !== offerId)
      };
      
      // Recalculate final price after removing discount
      const totalDiscountAmount = updatedItem.appliedDiscounts.reduce(
        (sum, discount) => sum + discount.discountAmount, 0
      );
      
      updatedItem.finalPrice = Math.max(0, item.originalPrice - (totalDiscountAmount / item.quantity));
      
      // Create new items array with updated item
      const updatedItems = [...prevItems];
      updatedItems[itemIndex] = updatedItem;
      
      //toast.success(`Removed discount from ${item.product.name}`);
      return updatedItems;
    });
  }, []);
  
  // Set or clear the jewelry weight-pricing breakdown for a cart line.
  //
  // calculateTotalsAndTaxes/checkout/tax-breakdown/etc. all read
  // `item.product.price` directly (not `originalPrice`/`finalPrice` — those
  // only affect the item-discount display path), so the only way for the
  // captured weight-pricing total to actually flow into subtotal/tax/checkout
  // is to override the per-unit price on a cloned `product` object, exactly
  // like every other read site expects. `appliedDiscounts` still layer on
  // top of this new base price unchanged.
  const setJewelryPricing = useCallback((productId: string, pricing: JewelryLinePricing | null) => {
    setItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.product.id === productId);
      if (itemIndex === -1) {
        toast.error('Product not found in cart');
        return prevItems;
      }

      const item = prevItems[itemIndex];
      const basePrice = pricing ? pricing.lineTotal : (item.jewelryPricing ? (item as any).__catalogPrice ?? item.product.price : item.product.price);
      const catalogPrice = pricing ? ((item as any).__catalogPrice ?? item.product.price) : basePrice;

      const totalDiscountAmount = item.appliedDiscounts.reduce(
        (sum, discount) => sum + discount.discountAmount, 0
      );
      const maxDiscount = basePrice * item.quantity;
      const effectiveDiscount = Math.min(totalDiscountAmount, maxDiscount);

      const updatedItem: any = {
        ...item,
        product: { ...item.product, price: basePrice },
        jewelryPricing: pricing,
        originalPrice: basePrice,
        finalPrice: Math.max(0, basePrice - (effectiveDiscount / item.quantity)),
        __catalogPrice: catalogPrice, // remembered so clearing pricing restores the real catalog price
      };

      const updatedItems = [...prevItems];
      updatedItems[itemIndex] = updatedItem;
      return updatedItems;
    });
  }, []);

  // Calculate total discounts applied at the item level
  const calculateItemDiscounts = useCallback(() => {
    // Compute promotions directly from current items + active offers to avoid
    // relying on the async merge effect timing.
    const promoResult = cachedApplyItemWiseDiscounts ? cachedApplyItemWiseDiscounts(items as any, activeOffers || []) : { totalDiscount: 0, updatedItems: items };
    const total = Math.max(0, Number(promoResult?.totalDiscount || 0));
    // Round to 2 decimals for consistent currency display
    return Math.round(total * 100) / 100;
  }, [items, activeOffers]);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback((options?: { silent?: boolean }) => {
    setItems([]);
    // Reset discount state and customer discount flag
    setDiscountState({ value: 0, type: 'percentage', appliedAmount: 0 });
    setIsCustomerDiscountActive(false);
    setSelectedCustomerState(null); // Also clear the selected customer
    setTravellerContext(null); // Duty-free traveller capture belongs to this one sale only
    setSalesModeOverride(null); // Tax-mode override belongs to this one sale only

    if (!options?.silent) {
      toast.success('Cart cleared');
    }
  }, []);

  // These functions return the pre-calculated values from state
  const calculateSubtotal = useCallback(() => cartSubtotal, [cartSubtotal]);
  const calculateTax = useCallback(() => cartTotalTax, [cartTotalTax]);
  
  // Return the pre-calculated total from state
  const calculateTotal = useCallback(() => cartTotal, [cartTotal]);
  

  

  
  // Get detailed tax breakdown by tax class
  const getTaxBreakdown = useCallback(() => {
    if (isCustomerTaxExempt) {
      return [];
    }
    
    // Return the pre-calculated tax details
    return appliedTaxDetails;
  }, [isCustomerTaxExempt, appliedTaxDetails]);

  const checkout = useCallback(async (paymentMethodId: string, customerId?: string | null) => {
    // Fixed UUID to code mapping - these UUIDs match the current database records
    const fixedUuidMapping: { [key: string]: string } = {
      'e9ca7524-35f4-11f0-8297-525400144492': 'cash',
      'e9ca7670-35f4-11f0-8297-525400144492': 'card', // Fixed UUID for card
      'e9ca76b3-35f4-11f0-8297-525400144492': 'phone',
      'e9ca75b4-35f4-11f0-8297-525400144492': 'on_account',
      '00000000-0000-0000-0000-0000000044492': 'none'
    };

    // Standardized payment method handling - support both new codes and UUIDs
    let paymentMethodCode = paymentMethodId;
    
    // Check if it's already a valid code (lowercase)
    const validCodes = ['cash', 'card', 'phone', 'on_account', 'none'];
    if (validCodes.includes(paymentMethodId.toLowerCase())) {
      paymentMethodCode = paymentMethodId.toLowerCase();
    }
    // Check if it's a UUID format - send as-is for backend lookup
    else if (paymentMethodId.length === 36 && paymentMethodId.includes('-')) {
      paymentMethodCode = paymentMethodId; // Send UUID as-is
    }
    // Fallback for fixed UUID mapping (if needed)
    else if (fixedUuidMapping[paymentMethodId]) {
      paymentMethodCode = fixedUuidMapping[paymentMethodId];
    }

    // Validate customer selection for charge account payments
    if (paymentMethodCode === 'on_account' || paymentMethodId === 'e9ca75b4-35f4-11f0-8297-525400148990') {
      if (!selectedCustomerState || selectedCustomerState.id === undefined) {
        toast.error('Charge account payments require a customer to be selected. Walk-in customers cannot use charge accounts.');
        return null;
      }
    }

    setIsProcessing(true);
    try {
      // Get user from localStorage or context if available
      const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Compute promotions result at checkout to send to backend for persistence
      const promoResultAtCheckout = cachedApplyItemWiseDiscounts ? cachedApplyItemWiseDiscounts(items as any, activeOffers || []) : { totalDiscount: 0, updatedItems: items };
      
      // Calculate tax per unit for each item (17% tax rate)
      const taxRate = 0.17;
      
      // Build detailed per-item promotion data for backend
      const perItemPromotionData = items.map((item, index) => {
        const updatedItem = promoResultAtCheckout?.updatedItems?.[index];
        const itemPromotionDiscount = updatedItem ? 
          (updatedItem.appliedDiscounts || []).reduce((sum: number, d: any) => sum + (Number(d.discountAmount) || 0), 0) : 0;
        
        const promoDiscountPerUnit = item.quantity > 0 ? itemPromotionDiscount / item.quantity : 0;
        const finalUnitPrice = item.product.price - promoDiscountPerUnit;
        const taxPerUnit = finalUnitPrice * taxRate;
        
        return {
          // snake_case keys
          item_index: index,
          product_id: item.product.id,
          promo_discount_per_unit: Number(promoDiscountPerUnit.toFixed(4)),
          final_unit_price: Number(finalUnitPrice.toFixed(4)),
          tax_per_unit: Number(taxPerUnit.toFixed(4)),
          applied_discounts_json: updatedItem?.appliedDiscounts || [],
          // camelCase duplicates
          itemIndex: index,
          productId: item.product.id,
          promoDiscountPerUnit: Number(promoDiscountPerUnit.toFixed(4)),
          finalUnitPrice: Number(finalUnitPrice.toFixed(4)),
          taxPerUnit: Number(taxPerUnit.toFixed(4)),
          appliedDiscountsJson: updatedItem?.appliedDiscounts || [],
        };
      });

      // Build applied offers snapshot for sales table
      const appliedOffersSnapshot = (activeOffers || [])
        .filter(offer => {
          // Check if this offer was actually applied to any items
          return items.some((_, idx) => {
            const updatedItem = promoResultAtCheckout?.updatedItems?.[idx];
            return updatedItem?.appliedDiscounts?.some((d: any) => d.offerId === offer.id);
          });
        })
        .map(offer => ({
          offer_id: offer.id,
          offer_name: offer.name,
          offer_type: offer.offerType,
          discount_value: offer.discountValue,
          priority: offer.priority || 1
        }));

      // Structure promotions data exactly as backend expects
      const promotionsPayload = {
        salePromotionsAmount: Number(promoResultAtCheckout?.totalDiscount || 0),
        appliedOffersSnapshot: appliedOffersSnapshot,
        perItem: perItemPromotionData,
        offerAudits: appliedOffersSnapshot, // For audit table
        itemDiscountAudits: [] // Will be populated by backend from perItem data
      };
      

      const salePayload = {
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
          name: item.product.name,
          // Jewelry weight-pricing capture (undefined for non-jewelry lines) —
          // metalPricingService.buildSnapshot() shape, see
          // 2026-09-03_jewelry_weight_pricing_checkout_capture.sql.
          ...(item.jewelryPricing ? {
            purity: item.jewelryPricing.purity,
            grossWeight: item.jewelryPricing.grossWeight,
            netWeight: item.jewelryPricing.netWeight,
            makingCharge: item.jewelryPricing.makingCharge,
            wastageValue: item.jewelryPricing.wastageValue,
            metalValue: item.jewelryPricing.metalValue,
            hsnCode: item.jewelryPricing.hsnCode,
            pricingSnapshot: item.jewelryPricing.snapshot,
          } : {}),
        })),
        subtotal: calculateSubtotal(),
        discountType: discountState.value > 0 ? (discountState.type === 'fixedAmount' ? 'fixed' as const : (discountState.type === 'percentage' ? 'percentage' as const : 'fixed' as const)) : undefined,
        discountValue: discountState.value > 0 ? discountState.value : undefined,
        discountAmount: discountState.appliedAmount,
        tax: calculateTax(),
        total: calculateTotal(),
        tenantId: userInfo?.tenantId || undefined,
        storeId: userInfo?.storeId || undefined,
        cashierId: userInfo?.id || undefined,
        paymentMethodId: paymentMethodCode,
        customerId: customerId || selectedCustomerState?.id || undefined,
        employeeId: selectedEmployeeId || undefined,
        // Send structured promotions data
        promotions: promotionsPayload,
        promoResult: promotionsPayload,
        cartPromotions: promotionsPayload,
        // Duty-free traveller capture (Sales Hub) — undefined on an ordinary
        // sale. The backend independently re-derives sales_mode/zero-rating
        // from the store's own jurisdiction setting rather than trusting this
        // payload for anything tax-related; this only carries the traveller
        // identification through to printing.
        ...(travellerContext ? { travellerContext } : {}),
        // Per-transaction tax-mode override — backend re-verifies permission
        // and silently falls back to the store default if not authorized.
        ...(salesModeOverride ? { salesModeOverride } : {}),
      };

      const saleConfirmation = await createSale(salePayload);

      // createSale returns { saleId: string }
      if (saleConfirmation && saleConfirmation.saleId) {
        toast.success('Checkout successful!');
        // Build a prefetched sale object with full details BEFORE clearing the cart
        const itemDetails = items.map((item) => {
          const itemDiscountTotal = (item.appliedDiscounts || []).reduce((sum, d) => sum + (Number(d.discountAmount) || 0), 0);
          const perUnit = item.quantity > 0 ? itemDiscountTotal / item.quantity : 0;
          return {
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.price,
            name: item.product.name,
            // Provide multiple casings for receiptService compatibility
            discount: itemDiscountTotal,
            discountAmount: itemDiscountTotal,
            discount_amount: itemDiscountTotal,
            discountPerUnit: perUnit,
            discount_per_unit: perUnit,
          } as any;
        });

        const subtotalVal = calculateSubtotal();
        const taxVal = calculateTax();
        const totalVal = calculateTotal();
        const overallDiscount = Number(discountState?.appliedAmount || 0);

        // Read user info preferentially from 'currentUser' (set by login), fallback to legacy 'user'
        const currentUserLS = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const legacyUserLS = JSON.parse(localStorage.getItem('user') || '{}');
        const receiptUser = currentUserLS && Object.keys(currentUserLS).length ? currentUserLS : legacyUserLS;

        const prefetchedSale: any = {
          id: saleConfirmation.saleId,
          // Best-effort IDs if available in local storage/state
          tenantId: receiptUser?.tenantId || undefined,
          storeId: receiptUser?.storeId || undefined,
          cashierId: receiptUser?.id || undefined,
          items: itemDetails,
          subtotal: subtotalVal,
          tax: taxVal,
          discountAmount: overallDiscount,
          discountType: overallDiscount > 0 ? (discountState.type === 'fixedAmount' ? 'fixed' : discountState.type) : undefined,
          discountValue: discountState?.value || 0,
          total: totalVal,
          // Include a friendly payment method hint when possible
          paymentMethod: typeof paymentMethodCode === 'string' ? paymentMethodCode : 'cash',
          status: 'completed',
          createdAt: new Date().toISOString(),
          // Duty-free: what the backend independently derived and actually
          // charged (see createSaleController.js), not re-derived here — so
          // the immediate post-checkout print reflects the recorded sale even
          // if this tab's jurisdiction cache is stale. Falls back to this
          // session's own resolution so a reprint still self-suppresses
          // correctly if, for some reason, the backend didn't echo it back.
          zeroRateReason: zeroRateReasonForStore || undefined,
          ...(travellerContext ? {
            travellerIdType: travellerContext.travellerIdType,
            travellerIdNumber: travellerContext.travellerIdNumber,
            travellerIdCountry: travellerContext.travellerIdCountry,
            travelMethodType: travellerContext.travelMethodType,
            travelMethodRef: travellerContext.travelMethodRef,
            travelMethodDetail: travellerContext.travelMethodDetail,
            destination: travellerContext.destination,
            departureDate: travellerContext.departureDate,
          } : {}),
        };

        // Now clear the cart and reset states
        clearCart({ silent: true });
        setDiscountState({ value: 0, type: 'percentage', appliedAmount: 0 }); // Reset discount
        setSelectedCustomerState(null); // Reset customer
        setTravellerContext(null); // Reset duty-free traveller capture
        setSalesModeOverride(null); // Reset per-transaction tax-mode override

        // Return detailed sale for downstream receipt printing
        return prefetchedSale;
      } else {
        // This case implies an issue with createSale returning unexpected successful response or no saleId
        toast.error('Checkout failed: Could not retrieve sale ID after creation.');
        return null; // Indicate failure by returning null
      }
    } catch (error: any) { // Catching error thrown by fetchApi (which includes parsed error message)
      console.error('Checkout error:', error);
      // error.message should contain the message from fetchApi's error handling
      toast.error(error.message || 'Checkout failed due to an unexpected error.');
      return null; // Indicate failure by returning null
    } finally {
      setIsProcessing(false);
    }
  }, [items, calculateSubtotal, discountState, calculateTax, calculateTotal, selectedCustomerState, selectedEmployeeId, travellerContext, zeroRateReasonForStore, clearCart]);

  const holdCurrentOrder = useCallback((name?: string) => {
    if (isRestoring) { // Check isRestoring flag
      toast('Order restoration in progress. Please wait a moment.');
      return;
    }
    if (items.length === 0) {
      toast.error('Cannot hold an empty cart.');
      return;
    }
    const newHeldOrder: HeldOrder = {
      id: uuidv4(),
      items: [...items],
      customer: selectedCustomerState,
      totalAmount: calculateTotal(),
      heldAt: new Date().toISOString(),
      name: name || `Order @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      discount_value: discountState.value,
      discount_type: discountState.type,
    };

    setHeldOrders((prevHeldOrders) => [...prevHeldOrders, newHeldOrder]);
    clearCart({ silent: true });
    setSelectedCustomerState(null);
    // Do not reset discountState here, as it might be a global/persistent setting
    toast.success(`${newHeldOrder.name} has been put on hold.`);
  }, [
    items,
    isRestoring,
    selectedCustomerState,
    discountState,
    calculateTotal,
    clearCart,
  ]);

  const restoreHeldOrder = useCallback((orderId: string) => {
    const orderToRestore = heldOrders.find((o) => o.id === orderId);
    if (!orderToRestore) {
      toast.error('Order not found for restoration.');
      return;
    }

    // Set flag to prevent cart item sync issues during restoration
    setIsRestoring(true);

    // Clear current cart items and discount before restoring
    setItems([]);
    setDiscountState({ value: 0, type: 'percentage', appliedAmount: 0 });

    // Restore items with all required EnhancedCartItem properties
    setItems(orderToRestore.items.map((item) => {
      // Cast to any to handle potential missing properties in the saved order item
      const savedItem = item as any;
      return {
        product: item.product,
        quantity: item.quantity,
        originalPrice: item.product.price,
        appliedDiscounts: savedItem.appliedDiscounts || [] as CartItemDiscount[],
        finalPrice: savedItem.finalPrice || item.product.price
      } as EnhancedCartItem;
    }));

    // Restore customer if present
    if (orderToRestore.customer) {
      setSelectedCustomerState(orderToRestore.customer);
    } else {
      setSelectedCustomerState(null); // Clear customer if none was associated
    }

    // Restore discount if present
    if (orderToRestore.discount_value !== undefined && orderToRestore.discount_type) {
      // Directly set the discount state, calculation will happen via useEffect or explicitly
      setDiscountState({
        value: orderToRestore.discount_value,
        type: orderToRestore.discount_type as DiscountType,
        appliedAmount: 0 // This will be recalculated by calculateTotalsAndTaxes
      });
    } else {
      setDiscountState({ value: 0, type: 'percentage', appliedAmount: 0 });
    }
    
    // Remove the restored order from held orders
    setHeldOrders(prev => prev.filter(o => o.id !== orderId));
    toast.success(`Order "${orderToRestore.name || orderId}" restored.`);
    
    // Recalculate totals with restored items and discount
    // The recalculateTotalsAndTaxes will be triggered by items/discountState changes via useEffect

    // Reset flag after restoration process is complete
    // Use a timeout to ensure all state updates have propagated before resetting
    setTimeout(() => {
      setIsRestoring(false);
    }, 0);
  }, [heldOrders]); // Added dependencies

  const deleteHeldOrder = useCallback((orderId: string) => {
    setHeldOrders(prevHeldOrders => prevHeldOrders.filter(order => order.id !== orderId));
    toast.success('Held order deleted.');
  }, []); // Added dependencies

  const customSetDiscount = useCallback((value: number, type: DiscountType) => {
    setDiscountState({ value, type, appliedAmount: 0 }); // appliedAmount will be recalculated
    setIsCustomerDiscountActive(false); // Manual discount overrides/clears customer default flag
  }, []);

  const customSetSelectedCustomer = useCallback((customer: Customer | null) => {
    // Set the customer state directly
    setSelectedCustomerState(customer);

    if (customer) {
      // A customer is being selected
      if (customer.defaultDiscountValue != null && customer.defaultDiscountType) {
        // Customer has a default discount
        setDiscountState({
          value: customer.defaultDiscountValue,
          type: customer.defaultDiscountType,
          appliedAmount: 0, // Will be recalculated
        });
        setIsCustomerDiscountActive(true);
        // Discount is applied silently, toast only confirms selection.
        const customerName = customer.firstName || 'Customer';
        toast.success(`Selected: ${customerName}.`);
      } else {
        // Customer has no default discount
        if (isCustomerDiscountActive) {
          // A previous customer's discount was active, clear it
          setDiscountState({ value: 0, type: 'percentage', appliedAmount: 0 });
          setIsCustomerDiscountActive(false);
          const customerName = customer.firstName || 'Customer';
          toast(`Selected: ${customerName}. Previous customer discount removed.`, { icon: 'ℹ️' }); // Use general toast with info icon
        } else {
          // Simply selecting a customer with no discount, and no previous discount was active
          const customerName = customer.firstName || 'Customer';
          toast.success(`Selected: ${customerName}.`);
        }
      }
    } else {
      // Customer is being deselected (customer is null)
      if (isCustomerDiscountActive) {
        // A customer discount was active, clear it
        setDiscountState({ value: 0, type: 'percentage', appliedAmount: 0 });
        setIsCustomerDiscountActive(false);
        // No need for toast messages here
      }
      // No need for additional handling when no discount was active
    }
  }, [isCustomerDiscountActive]);

  // Use the custom function for setting selected customer
  const setSelectedCustomer = customSetSelectedCustomer;
  
  const contextValue: CartContextType = {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    calculateTotal,
    calculateSubtotal,
    calculateTax,
    getTaxBreakdown,
    checkout,
    isProcessing,
    discount: discountState,
    setDiscount: customSetDiscount, // Use custom function
    heldOrders,
    holdCurrentOrder,
    restoreHeldOrder,
    deleteHeldOrder,
    selectedCustomer: selectedCustomerState,
    setSelectedCustomer, // Use custom function
    selectedEmployeeId,
    setSelectedEmployeeId,
    travellerContext,
    setTravellerContext,
    isDutyFreeStore,
    salesModeOverride,
    setSalesModeOverride,
    discountApplicationPreference,
    taxClasses,
    allTaxRates,
    activeTaxConfig,
    appliedTaxDetails,
    // New promotional offers and item-wise discount methods
    availableOffers,
    activeOffers,
    hasActiveOfferForProduct,
    refreshOffers,
    applyItemDiscount,
    removeItemDiscount,
    calculateItemDiscounts,
    setJewelryPricing,
  };

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>;
};