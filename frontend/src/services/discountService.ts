import { fetchApi } from './api';
import { 
  PromotionalOffer, 
  CartItemDiscount, 
  OfferType 
} from '@/types/discount';
import { Product } from '@/types';

// Utility to notify UI that offers changed and invalidate local cache
const notifyOffersUpdated = () => {
  try {
    localStorage.removeItem('cache_promotional_offers');
  } catch (e) {
    console.warn('Failed to clear offers cache:', e);
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('promotional_offers_updated'));
    } catch {
      // noop
    }
  }
};

// Define interfaces for API responses
interface ApiResponse<T> {
  data?: T;
  success?: boolean;
  message?: string;
  [key: string]: any;
}

// Interface for API offer format (camelCase properties)
interface ApiOffer {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  offerType?: string | null; // Changed from offer_type
  type?: string | null; // Retained for flexibility if API sends 'type'
  discountValue?: string | number | null; // Changed from discount_value, API sends string
  value?: number | null; // Retained for flexibility
  startDate?: string | null; // Changed from start_date
  endDate?: string | null; // Changed from end_date
  minimumQuantity?: number | null; // Changed from minimum_quantity
  maxTotalUses?: number | null; // Changed from usage_limit and to camelCase
  currentTotalUses?: number | null; // Changed from usage_count and to camelCase
  isActive?: boolean | number | null; // Changed from is_active, API sends 1/0
  priority?: number | null;
  rules?: any[] | null;
  createdAt?: string | null; // Changed from created_at
  updatedAt?: string | null; // Changed from updated_at
  tenantId?: string | null; // Changed from tenant_id
  storeId?: string | null; // Changed from store_id
}

// Define types for internal discount processing
interface CartItemWithDiscount {
  product: Product;
  quantity: number;
  appliedDiscounts: CartItemDiscount[];
  originalPrice: number;
  finalPrice: number;
  // Unit price is equivalent to product price
  unitPrice?: number;
}

interface DiscountApplicationResult {
  updatedItems: CartItemWithDiscount[];
  totalDiscount: number;
  subtotalBeforeDiscount?: number;
  subtotalAfterDiscount?: number;
  // Backend-expected fields for promotions persistence
  salePromotionsAmount?: number;
  appliedOffersSnapshot?: any[];
  offerAudits?: any[];
  itemDiscountAudits?: any[];
  perItem?: any[];
}

// Map backend offer type names to frontend enum values
const mapOfferType = (apiType: string | null | undefined): OfferType => {
  // Handle null or undefined with a default value
  if (apiType === null || apiType === undefined || apiType.trim() === '') {
    return 'percentage_discount'; // Default
  }
  
  switch(apiType) {
    case 'percentage':
      return 'percentage_discount';
    case 'fixed':
      return 'fixed_discount';
    case 'buy_x_get_y':
    case 'bundle_price':
    case 'tiered_pricing':
      return apiType as OfferType;
    default:
      return 'percentage_discount';
  }
};

// Map frontend offerType back to API expected values
const mapOfferTypeToApi = (frontendType: string | null | undefined): string | null => {
  if (!frontendType) return null;
  switch (frontendType) {
    case 'percentage_discount':
      return 'percentage';
    case 'fixed_discount':
      return 'fixed';
    case 'buy_x_get_y':
    case 'bundle_price':
    case 'tiered_pricing':
      return frontendType;
    default:
      return null;
  }
};

// Transform API offer to frontend model
const transformApiOffer = (apiOffer: ApiOffer): PromotionalOffer => {
  // Skip offers with no ID
  if (!apiOffer || !apiOffer.id) {
    console.warn('Skipping offer with no ID:', apiOffer);
    // Return a placeholder offer that won't be used
    return { 
      id: 'invalid-offer', 
      name: 'Invalid Offer',
      description: '',
      offerType: 'percentage_discount',
      discountValue: 0,
      startDate: '',
      endDate: '',
      minimumQuantity: 1,
      maxTotalUses: 0, // Changed from usageLimit
      currentTotalUses: 0, // Changed from usageCount
      priority: 0, // Added required field
      isActive: false,
      rules: [],
      createdAt: '',
      updatedAt: '',
      tenantId: '',
      storeId: ''
    };
  }
  
  // Ensure we always have a valid string ID by filtering out null/undefined values
  // Using type guard to make TypeScript happy
  const id = (typeof apiOffer.id === 'string' && apiOffer.id.length > 0) 
    ? apiOffer.id 
    : `generated-${Date.now()}`; // Generate a unique ID if missing
  
  // Normalize rules if present (handle snake_case from backend)
  const normalizedRules = Array.isArray((apiOffer as any).rules)
    ? ((apiOffer as any).rules as any[]).map((rule: any) => {
        const rt = String(rule.ruleType ?? rule.rule_type ?? '').toLowerCase();
        const entityId = rule.entityId != null
          ? String(rule.entityId)
          : (rule.entity_id != null ? String(rule.entity_id) : undefined);
        return {
          id: String(rule.id ?? ''),
          tenantId: rule.tenantId ?? rule.tenant_id ?? '',
          storeId: rule.storeId ?? rule.store_id ?? '',
          offerId: rule.offerId ?? rule.offer_id ?? id,
          ruleType: rt as any,
          entityId,
          quantity: Number(rule.quantity ?? 1),
          createdAt: rule.createdAt ?? rule.created_at ?? undefined,
          updatedAt: rule.updatedAt ?? rule.updated_at ?? undefined,
        };
      })
    : [];

  // Normalize offerType and discount values from multiple possible API shapes
  const rawOfferType = (apiOffer.offerType ?? apiOffer.type ?? '') as string | null;
  const rawDiscountValue = (apiOffer.discountValue ?? apiOffer.value ?? 0) as string | number | null;

  return {
    id: id, // Now safely typed as string
    name: apiOffer.name || '',
    description: apiOffer.description || '',
    offerType: mapOfferType(typeof rawOfferType === 'string' ? rawOfferType : ''),
    discountValue: parseFloat(String(rawDiscountValue || 0)),
    startDate: apiOffer.startDate || '',
    endDate: apiOffer.endDate || '',
    minimumQuantity: Number(apiOffer.minimumQuantity || 1),
    maxTotalUses: Number(apiOffer.maxTotalUses || 0),
    currentTotalUses: Number(apiOffer.currentTotalUses || 0),
    priority: Number(apiOffer.priority || 0),
    isActive: Boolean(apiOffer.isActive),
    rules: normalizedRules,
    createdAt: apiOffer.createdAt || '',
    updatedAt: apiOffer.updatedAt || '',
    tenantId: apiOffer.tenantId || '',
    storeId: apiOffer.storeId || ''
  };
};

// Mock promotional offers data for testing
export const mockPromotionalOffers: PromotionalOffer[] = [
  {
    id: '101',
    tenantId: 'tenant1',
    storeId: 'store1',
    name: '10% Off Keyboards',
    description: 'Get 10% off on all keyboard purchases',
    offerType: 'percentage_discount',
    discountValue: 10,
    startDate: '2023-01-01T00:00:00Z',
    endDate: '2023-12-31T23:59:59Z',
    isActive: true,
    priority: 1,
    currentTotalUses: 0,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    minimumQuantity: 1,
    rules: [
      {
        id: '1001',
        tenantId: 'tenant1',
        storeId: 'store1',
        offerId: '101',
        ruleType: 'product',
        entityId: 'product1',
        quantity: 1,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }
    ]
  },
  {
    id: '102',
    tenantId: 'tenant1',
    storeId: 'store1',
    name: '$5 Off Mice',
    description: 'Get $5 off on all mouse purchases',
    offerType: 'fixed_discount',
    discountValue: 5,
    startDate: '2023-01-01T00:00:00Z',
    endDate: '2023-12-31T23:59:59Z',
    isActive: true,
    priority: 1,
    currentTotalUses: 0,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    minimumQuantity: 1,
    rules: [
      {
        id: '1002',
        tenantId: 'tenant1',
        storeId: 'store1',
        offerId: '102',
        ruleType: 'product',
        entityId: 'product2',
        quantity: 1,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }
    ]
  },
  {
    id: '103',
    tenantId: 'tenant1',
    storeId: 'store1',
    name: '15% Off Monitors',
    description: 'Get 15% off on all monitor purchases',
    offerType: 'percentage_discount',
    discountValue: 15,
    startDate: '2023-01-01T00:00:00Z',
    endDate: '2023-12-31T23:59:59Z',
    isActive: true,
    priority: 1,
    currentTotalUses: 0,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    minimumQuantity: 1,
    rules: [
      {
        id: '1003',
        tenantId: 'tenant1',
        storeId: 'store1',
        offerId: '103',
        ruleType: 'product',
        entityId: 'product3',
        quantity: 1,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }
    ]
  }
];
// Get all active promotional offers
export const getActiveOffers = async (): Promise<PromotionalOffer[]> => {
  try {
    // The fetchApi function automatically includes tenant and store headers.
    const endpoint = '/public/promotional-offers/active';

    // Fetch data using the reusable fetchApi function.
    // The backend is expected to return an object with a 'data' property containing the offers array.
    const response = await fetchApi<ApiResponse<ApiOffer[]>>(endpoint);

    // Check if the response has data and it is an array
    if (response && Array.isArray(response.data)) {
      const offers = response.data.map(transformApiOffer);
      return await enrichOffersWithRules(offers);
    }

    // Handle cases where the API response is not as expected
    console.error('getActiveOffers received an unexpected response format:', response);
    throw new Error('Unexpected response format');

  } catch (error) {
    console.error('Error fetching active offers:', error);
    // In case of error, return an empty array to prevent UI crashes
    return [];
  }
};

// Get offers for a specific product
export const getOffersForProduct = async (productId: string): Promise<PromotionalOffer[]> => {
  try {
    const response = await fetchApi(`/promotional-offers/product/${productId}`) as { data: PromotionalOffer[] };
    if (response && response.data) {
      return response.data;
    }
    
    // Fallback to filtering mock offers if API call fails
    return mockPromotionalOffers.filter(offer => {
      if (!offer.rules || !Array.isArray(offer.rules)) return false;
      
      return offer.rules.some(rule => 
        rule.ruleType === 'product' && 
        rule.entityId === productId
      );
    });
  } catch (error) {
    console.error(`Error fetching offers for product ${productId}:`, error);
    return [];
  }
};

// Create a new promotional offer
export const createOffer = async (offer: Partial<PromotionalOffer>): Promise<PromotionalOffer | null> => {
  try {
    // Transform camelCase to snake_case for backend
    const transformedOffer = {
      name: offer.name,
      description: offer.description,
      offer_type: mapOfferTypeToApi(offer.offerType as string) || undefined,
      discount_value: offer.discountValue,
      minimum_quantity: offer.minimumQuantity,
      minimum_purchase_amount: offer.minimumPurchaseAmount,
      start_date: offer.startDate,
      end_date: offer.endDate,
      is_active: offer.isActive,
      priority: offer.priority,
      max_uses_per_customer: offer.maxUsesPerCustomer,
      max_total_uses: offer.maxTotalUses,
      // Normalize rules to backend shape
      rules: Array.isArray(offer.rules)
        ? offer.rules.map(r => ({
            rule_type: (r.ruleType as string)?.toLowerCase(),
            entity_id: r.entityId != null ? String(r.entityId) : undefined,
            quantity: r.quantity ?? 1,
          }))
        : undefined,
      price_tiers: offer.priceTiers,
      // Explicit opt-in to a tenant-wide default offer (store_id NULL on the
      // backend) instead of scoping to the currently active store — see
      // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §4.
      applies_to_all_stores: (offer as any).appliesToAllStores || undefined,
    };

    const response = await fetchApi<ApiResponse<PromotionalOffer>>('/promotional-offers', {
      method: 'POST',
      body: JSON.stringify(transformedOffer)
    });
    const created = response.data || null;
    if (created) notifyOffersUpdated();
    return created;
  } catch (error) {
    console.error('Error creating offer:', error);
    throw error;
  }
};

// Update an existing promotional offer
export const updateOffer = async (offerId: string, offer: Partial<PromotionalOffer>): Promise<PromotionalOffer | null> => {
  try {
    // Transform camelCase to snake_case for backend
    const transformedOffer = {
      name: offer.name,
      description: offer.description,
      // Backend update controller reads camelCase offerType and writes it to offer_type
      offerType: mapOfferTypeToApi(offer.offerType as string) || undefined,
      discountValue: offer.discountValue,
      startDate: offer.startDate,
      endDate: offer.endDate,
      isActive: offer.isActive,
      minimumQuantity: offer.minimumQuantity,
      minimumPurchaseAmount: offer.minimumPurchaseAmount,
      maxTotalUses: offer.maxTotalUses,
      maxUsesPerCustomer: offer.maxUsesPerCustomer,
      priority: offer.priority,
      // Normalize rules to backend shape (update endpoint expects camelCase per comment? ensure both)
      rules: Array.isArray(offer.rules)
        ? offer.rules.map(r => ({
            // Provide both shapes to maximize compatibility
            ruleType: (r.ruleType as string)?.toLowerCase(),
            entityId: r.entityId != null ? String(r.entityId) : undefined,
            quantity: r.quantity ?? 1,
            rule_type: (r.ruleType as string)?.toLowerCase(),
            entity_id: r.entityId != null ? String(r.entityId) : undefined,
          }))
        : undefined,
      priceTiers: offer.priceTiers
    };
    
    // Prefer explicit headers from the offer payload to guarantee correct scoping
    const headers: Record<string, string> = {};
    if (offer.tenantId) headers['x-tenant-id'] = offer.tenantId;
    if (offer.storeId) headers['store-id'] = offer.storeId;

    const response = await fetchApi<ApiResponse<PromotionalOffer>>(`/promotional-offers/${offerId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(transformedOffer)
    });
    const updated = response.data || null;
    if (updated) notifyOffersUpdated();
    return updated;
  } catch (error) {
    console.error('Error updating offer:', error);
    throw error;
  }
};

// Get offer by ID with complete details
export const getOfferById = async (offerId: string): Promise<PromotionalOffer | null> => {
  try {
    const response = await fetchApi<ApiResponse<ApiOffer>>(`/promotional-offers/${offerId}`);
        if (response && response.data) {
      return transformApiOffer(response.data);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching offer ${offerId}:`, error);
    throw error;
  }
};

// Delete a promotional offer
export const deleteOffer = async (offerId: string): Promise<boolean> => {
  try {
    await fetchApi(`/promotional-offers/${offerId}`, {
      method: 'DELETE'
    });
    notifyOffersUpdated();
    return true;
  } catch (error) {
    console.error(`Error deleting offer ${offerId}:`, error);
    throw error;
  }
};

// Apply item-wise discounts to cart items
// Check if a product has any active offers applicable to it
export const hasActiveOffersForProduct = async (productId: string): Promise<boolean> => {
  try {
    // Get all offers for the product
    const offers = await getOffersForProduct(productId);
    return offers.length > 0;
  } catch (error) {
    console.error('Error checking for active offers:', error);
    return false;
  }
};

// Check if a product has any active offers from a cached list
export const hasActiveOfferForProductSync = (productId: string, cachedOffers: PromotionalOffer[]): boolean => {
  if (!cachedOffers?.length) return false;
  
  // Filter offers that apply to this product based on rules
  const applicableOffers = cachedOffers.filter(offer => {
    if (!offer.isActive) return false;
    
    // Check if the offer applies to this product through rules
    if (offer.rules && Array.isArray(offer.rules)) {
      return offer.rules.some(rule => 
        rule.ruleType === 'product' && 
        rule.entityId === productId
      );
    }
    return false;
  });
  
  return applicableOffers.length > 0;
};

// Get all promotional offers
export const getAllOffers = async (): Promise<PromotionalOffer[]> => {
    try {
    // Try the authenticated endpoint first
    const endpoint = '/promotional-offers';
    // Fetch data using the reusable fetchApi function.
    // The backend is expected to return an object with a 'data' property containing the offers array.
    const response = await fetchApi<ApiResponse<ApiOffer[]>>(endpoint);
    const typedResponse = response as ApiResponse<ApiOffer[]>;
    
    if (typedResponse?.data && Array.isArray(typedResponse.data)) {
            const offers = typedResponse.data
        .filter(apiOffer => apiOffer && apiOffer.id) // Filter out any offers without IDs
        .map(apiOffer => transformApiOffer(apiOffer));
            const enrichedOffers = await enrichOffersWithRules(offers);
            return enrichedOffers;
    }

    // If we got here but have no data, use the getActiveOffers function as fallback
    // This ensures we at least get the active offers via the public endpoint
    return await getActiveOffers();
  } catch (error) {
    // Fall back to the public API for active offers
    try {
      const fallbackOffers = await getActiveOffers();
            return fallbackOffers;
    } catch (fallbackError) {
                  return mockPromotionalOffers;
    }
  }
};

// Get all active promotional offers (getAllActiveOffers function to avoid duplicated getActiveOffers)
export const getAllActiveOffers = async (): Promise<PromotionalOffer[]> => {
  try {
    // Try authenticated endpoint first
    try {
      const response = await fetchApi('/promotional-offers/active');
      const typedResponse = response as ApiResponse<ApiOffer[]>;
      
      if (typedResponse?.data && Array.isArray(typedResponse.data)) {
        const mapped = typedResponse.data
          .filter(apiOffer => apiOffer && apiOffer.id) // Filter out any offers without IDs
          .map(apiOffer => transformApiOffer(apiOffer));
        // Always enrich with rules, since many endpoints omit rules by default
        return await enrichOffersWithRules(mapped);
      }
      // If we got here but have no valid data, fall through to next approach
    } catch (authError) {
      console.log('Authenticated endpoint failed, falling back to public endpoint');
      // Continue to public endpoint
    }
    
    // Fall back to the public endpoint
    const active = await getActiveOffers(); // This uses the public endpoint with tenant/store params
    return await enrichOffersWithRules(active);
  } catch (error) {
    console.error('All attempts to fetch active offers failed:', error);
    return mockPromotionalOffers.filter(offer => offer.isActive);
  }
};

export const applyItemWiseDiscounts = (
  cartItems: CartItemWithDiscount[], 
  offers: PromotionalOffer[]
): DiscountApplicationResult => {
  // Initialize result with backend-expected structure
  const result: DiscountApplicationResult = {
    updatedItems: [],
    totalDiscount: 0,
    subtotalBeforeDiscount: 0,
    subtotalAfterDiscount: 0,
    // Add backend-expected fields
    salePromotionsAmount: 0,
    appliedOffersSnapshot: [],
    offerAudits: [],
    itemDiscountAudits: [],
    perItem: []
  };

  // Calculate subtotal before discount
  result.subtotalBeforeDiscount = cartItems.reduce(
    (total, item) => total + (item.product.price * item.quantity),
    0
  );

  // Sort offers by priority (higher priority first)
  const sortedOffers = [...offers].sort((a, b) => b.priority - a.priority);

  // Process each cart item
  const processedItems = cartItems.map(item => {
    // Create a new cart item with discount fields
    const itemWithDiscount: CartItemWithDiscount = {
      ...item,
      originalPrice: item.product.price,
      appliedDiscounts: [],
      finalPrice: item.product.price
    };

    // Find applicable offers for this item
    const applicableOffers = sortedOffers.filter(offer => 
      isOfferApplicableToItem(offer, item.product, cartItems)
    );

    // Apply each applicable offer
    applicableOffers.forEach(offer => {
      const discount = calculateDiscount(offer, itemWithDiscount);
      
      if (discount.discountAmount > 0) {
        // Add to applied discounts
        itemWithDiscount.appliedDiscounts.push(discount);

        // Update final price for percentage/fixed/tiered only.
        // For buy_x_get_y we do NOT prorate per-unit price; keep unit price unchanged.
        if (offer.offerType !== 'buy_x_get_y') {
          itemWithDiscount.finalPrice -= discount.discountAmount / item.quantity;
        }
        
        // Update total discount amount
        result.totalDiscount += discount.discountAmount;
      }
    });

    return itemWithDiscount;
  });

  result.updatedItems = processedItems;
  result.subtotalAfterDiscount = result.subtotalBeforeDiscount - result.totalDiscount;
  
  // Populate backend-expected fields
  result.salePromotionsAmount = result.totalDiscount;
  result.appliedOffersSnapshot = sortedOffers.filter(() => 
    processedItems.some(item => item.appliedDiscounts.length > 0)
  ).map(offer => ({
    id: offer.id,
    name: offer.name,
    offerType: offer.offerType,
    discountValue: offer.discountValue,
    priority: offer.priority
  }));
  
  // Create per-item data for backend persistence
  result.perItem = processedItems.map((item, index) => {
    const perUnit = item.appliedDiscounts.reduce((sum, d) => sum + d.discountAmount, 0) / item.quantity;
    const applied = item.appliedDiscounts.map(d => ({
      offerName: d.offerName,
      discountAmount: d.discountAmount,
      // Prefer explicit discount type if available; fallback to offerName
      offerType: (d as any).discountType || d.offerName
    }));
    return {
      // snake_case keys
      item_index: index,
      product_id: item.product.id,
      promo_discount_per_unit: perUnit,
      final_unit_price: item.finalPrice,
      applied_discounts_json: applied,
      // camelCase duplicates for compatibility
      itemIndex: index,
      productId: item.product.id,
      promoDiscountPerUnit: perUnit,
      finalUnitPrice: item.finalPrice,
      appliedDiscountsJson: applied,
    };
  });
  
  // Create offer audits for backend
  result.offerAudits = result.appliedOffersSnapshot.map(offer => ({
    offer_id: offer.id,
    offer_name: offer.name,
    offer_type: offer.offerType,
    discount_value: offer.discountValue,
    priority: offer.priority,
    total_discount_amount: processedItems.reduce((sum, item) => 
      sum + item.appliedDiscounts.filter(d => d.offerName === offer.name)
        .reduce((itemSum, d) => itemSum + d.discountAmount, 0), 0
    )
  }));

  return result;
};

// Check if an offer is applicable to a specific product
const isOfferApplicableToItem = (
  offer: PromotionalOffer, 
  product: Product,
  allCartItems: CartItemWithDiscount[]
): boolean => {
  
  // Check if offer is active
  if (!offer.isActive) {
        return false;
  }

  // Check offer dates
  const now = new Date();
  const startDate = new Date(offer.startDate);
  if (now < startDate) return false;

  if (offer.endDate) {
    const endDate = new Date(offer.endDate);
    if (now > endDate) return false;
  }

  // Check if offer has reached maximum uses
  if (offer.maxTotalUses && offer.currentTotalUses >= offer.maxTotalUses) {
    return false;
  }

  // Check minimum purchase requirements
  if (offer.minimumPurchaseAmount) {
    const cartTotal = allCartItems.reduce(
      (total, item) => total + (item.product.price * item.quantity),
      0
    );
    if (cartTotal < offer.minimumPurchaseAmount) return false;
  }

  // Recognize direct association via Bulk Apply: product.promotionalOfferId === offer.id
  // This allows products explicitly linked to an offer to receive it even if the offer has no rules.
  const associatedOfferId = (product as any).promotionalOfferId != null
    ? String((product as any).promotionalOfferId)
    : undefined;
  if (associatedOfferId && String(offer.id) === associatedOfferId) {
    return true;
  }

  // Check if offer rules apply to this product
  if (!offer.rules || offer.rules.length === 0) {
    if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
      console.debug('[Offers] Skipping offer with no rules:', offer.id, offer.name);
    }
    return false;
  }

  const ruleMatched = offer.rules.some(rule => {
    const ruleTypeRaw = String((rule as any).ruleType ?? (rule as any).rule_type ?? '').toLowerCase();
    const normalizedRuleType = (() => {
      if (['category', 'product_category', 'category_id'].includes(ruleTypeRaw)) return 'category';
      if (['product', 'product_id'].includes(ruleTypeRaw)) return 'product';
      return ruleTypeRaw;
    })();
    const entityId = (rule as any).entityId != null
      ? String((rule as any).entityId)
      : ((rule as any).entity_id != null ? String((rule as any).entity_id) : undefined);
    const productId = product.id != null ? String(product.id) : undefined;
    const categoryIdCandidates = [
      (product as any).categoryId,
      (product as any).category_id,
      (product as any).category?.id,
    ];
    const firstDefined = categoryIdCandidates.find(v => v !== undefined && v !== null);
    const categoryId = firstDefined != null ? String(firstDefined) : undefined;

    
    if (normalizedRuleType === 'all_products') {
            return true;
    }
    if (normalizedRuleType === 'product' && entityId && productId && entityId === productId) {
            return true;
    }
    if (normalizedRuleType === 'category' && entityId && categoryId && entityId === categoryId) {
            return true;
    }
    
        return false;
  });

    return ruleMatched;
};

// Calculate discount amount for a specific offer and item
const calculateDiscount = (
  offer: PromotionalOffer, 
  item: CartItemWithDiscount
): CartItemDiscount => {
  const discount: CartItemDiscount = {
    offerId: offer.id,
    offerName: offer.name,
    discountType: offer.offerType,
    discountValue: offer.discountValue,
    discountAmount: 0
  };

  const lineTotal = item.product.price * item.quantity;

  switch (offer.offerType) {
    case 'percentage_discount': {
      // Apply percentage discount
      discount.discountAmount = lineTotal * (offer.discountValue / 100);
      break;
    }
      
    case 'fixed_discount': {
      // Apply fixed discount per item
      discount.discountAmount = Math.min(offer.discountValue * item.quantity, lineTotal);
      break;
    }
      
    case 'buy_x_get_y': {
      // Example: Buy 2 get 1 free (discountValue = 1)
      // For every X+Y items, Y items are free
      const x = offer.minimumQuantity;
      const y = offer.discountValue;
      
      if (item.quantity >= x) {
        const sets = Math.floor(item.quantity / (x + y));
        const freeItems = Math.min(sets * y, item.quantity - (sets * x));
        discount.discountAmount = freeItems * item.product.price;
        // Attach metadata for UI/receipts to know how many items are free
        (discount as any).freeQuantity = freeItems;
      }
      break;
    }
      
    case 'bundle_price': {
      // Bundle price: When buying X items, total price is fixed
      if (item.quantity >= offer.minimumQuantity) {
        const bundles = Math.floor(item.quantity / offer.minimumQuantity);
        const bundleDiscount = (offer.minimumQuantity * item.product.price) - offer.discountValue;
        discount.discountAmount = bundles * bundleDiscount;
      }
      break;
    }
      
    case 'tiered_pricing': {
      // Tiered pricing: Apply different prices based on quantity tiers
      if (item.quantity >= offer.minimumQuantity) {
        // Use product price as the base price (fall back if unitPrice isn't available)
        const baseUnitPrice = item.unitPrice || item.product.price;
        
        // Default price is the base tier price (discountValue represents the price, not a percentage)
        let pricePerItem = offer.discountValue || baseUnitPrice;
        
        // Sort price tiers by quantity in descending order to find the highest applicable tier
        const sortedTiers = [...(offer.priceTiers || [])]
          .sort((a, b) => b.quantity - a.quantity);
          
        // Find the highest tier that applies to this quantity
        for (const tier of sortedTiers) {
          if (item.quantity >= tier.quantity) {
            pricePerItem = tier.price;
            break;
          }
        }
        
        // Calculate total discount amount based on the difference between original price and tiered price
        const originalTotal = item.quantity * baseUnitPrice;
        const discountedTotal = item.quantity * pricePerItem;
        discount.discountAmount = Math.max(0, originalTotal - discountedTotal);
        
        // Store the applied tier price for display
        discount.appliedTierPrice = pricePerItem;
        discount.appliedTierQuantity = item.quantity;
      }
      break;
    }
  }

  // Round to 2 decimal places
  discount.discountAmount = Math.round(discount.discountAmount * 100) / 100;
  
  return discount;
};

// Helper: if an offer is missing rules, fetch full details to populate rules so rule-based applicability works
const enrichOffersWithRules = async (offers: PromotionalOffer[]): Promise<PromotionalOffer[]> => {
  try {
    if (!offers || offers.length === 0) return offers;
    const needsEnrichment = offers.some(o => !o.rules || o.rules.length === 0);
    if (!needsEnrichment) return offers;

    const enriched = await Promise.all(
      offers.map(async (o) => {
        if (o.rules && o.rules.length > 0) return o;
        try {
          const full = await getOfferById(o.id);
          if (full && full.rules && full.rules.length > 0) {
            // Merge key fields, prefer latest from full
            return { ...o, ...full } as PromotionalOffer;
          }
        } catch (e) {
          // ignore per-offer failures
        }
        return o;
      })
    );
    return enriched;
  } catch (e) {
    // On any error, just return original offers
    return offers;
  }
};
