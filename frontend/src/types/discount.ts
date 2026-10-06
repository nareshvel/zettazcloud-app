// Types for promotional offers and discounts
import { Product } from './index';

export type OfferType = 'buy_x_get_y' | 'percentage_discount' | 'fixed_discount' | 'bundle_price' | 'tiered_pricing';
export type RuleType = 'product' | 'category' | 'all_products';

// PriceTier interface for tiered pricing offers
export interface PriceTier {
  id?: string;
  quantity: number;
  price: number;
}

export interface PromotionalOffer {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  description?: string;
  code?: string; // Optional promotion code
  offerType: OfferType;
  isActive: boolean;
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
  priority: number;
  maxUsesPerCustomer?: number;
  maxTotalUses?: number;
  currentTotalUses: number;
  minimumQuantity: number;
  minimumPurchaseAmount?: number;
  discountValue: number;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  rules?: OfferRule[]; // Associated rules
  priceTiers?: PriceTier[]; // Price tiers for tiered pricing offers
}

export interface OfferRule {
  id: string;
  tenantId: string;
  storeId: string;
  offerId: string;
  ruleType: RuleType;
  entityId?: string; // Product ID or Category ID
  quantity: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfferUsage {
  id: string;
  tenantId: string;
  storeId: string;
  offerId: string;
  customerId: string;
  orderId: string;
  usedAt: string;
}

// Interface for cart item discounts
export interface CartItemDiscount {
  offerId: string;
  offerName: string;
  discountType: OfferType;
  discountValue: number;
  discountAmount: number; // Calculated discount amount
  appliedTierPrice?: number; // Price per item for tiered pricing
  appliedTierQuantity?: number; // Quantity tier that was applied
  appliedTierDescription?: string; // Human-readable description of the applied tier
}

// Enhanced CartItem interface with discount support
export interface CartItemWithDiscount {
  product: Product;
  quantity: number;
  originalPrice: number; // Original product price
  unitPrice: number; // Price per single unit
  appliedDiscounts: CartItemDiscount[]; // List of applied discounts
  finalPrice: number; // Price after all discounts
}

// Interface for discount application result
export interface DiscountApplicationResult {
  cartItems: CartItemWithDiscount[];
  totalDiscountAmount: number;
  subtotalBeforeDiscount: number;
  subtotalAfterDiscount: number;
}

// Interface for discount service
export interface DiscountService {
  getAvailableOffers(): Promise<PromotionalOffer[]>;
  applyDiscounts(cartItems: CartItemWithDiscount[]): Promise<DiscountApplicationResult>;
}
