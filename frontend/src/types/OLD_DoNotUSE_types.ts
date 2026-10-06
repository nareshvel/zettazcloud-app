export interface Product {
  id: string;
  tenantId: string; // Was tenant_id
  storeId?: string | null; // Added to match DB
  categoryId?: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: number; // Selling price
  costPrice?: number | null; // Cost price, matches DB
  stockQuantity: number; // Was quantity_in_stock, changed to stockQuantity
  lowStockThreshold?: number | null; // Renamed from reorderLevel, matches DB
  supplierId?: string | null; // Was supplier_id
  isActive: boolean;
  createdAt: string; // Was created_at
  updatedAt: string; // Was updated_at
  createdByUserId?: string | null; // Added to match DB
  updatedByUserId?: string | null; // Added to match DB
  
  // Optional fields based on common POS needs & existing fields
  imageUrl?: string | null; // Was image_url
  tags?: string[];
  brand?: string; // Consider changing to brandId if a brands table is used
  unitOfMeasure?: string; // Was unit_of_measure
  trackInventory: boolean; // Explicit flag for tracking inventory

  // Fields for product-specific discounts and tax class (from existing interface)
  specificDiscountType?: 'percentage' | 'fixed' | null;
  specificDiscountValue?: number | null;
  taxClassId?: string | null; 
}

export interface Category {
  id: string;
  tenantId?: string; // Optional, if categories are tenant-specific
  name: string;
  description?: string | null;
  parentId?: string | null; // For sub-categories
  imageUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Customer {
  id: string; // UUID
  tenant_id: string; // UUID, identifies the business/tenant
  store_id?: string | null; // UUID, if customer is specific to a store
  first_name: string;
  last_name?: string | null;
  birth_date?: string | null; // ISO date format (YYYY-MM-DD)
  email?: string | null;
  website?: string | null; // URL for business website
  phone_number?: string | null;
  preferred_communication?: 'email' | 'phone' | 'sms' | 'mail' | null; // Customer's preferred contact method
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  country_id?: string | null; // Reference to the countries table
  company_name?: string | null; // Company name for business customers
  currency_code?: string | null; // Customer's preferred currency
  notes?: string | null;
  referral_source?: string | null; // How the customer found the business
  customer_type: string; // e.g., 'INDIVIDUAL', 'BUSINESS', 'RETAIL', 'WHOLESALE'
  credit_limit: number; // Default to 0 if not applicable
  outstanding_credit: number; // Current balance owed by customer
  is_active: boolean; // Soft delete or deactivate customer
  created_by_user_id: string; // UUID of user who created the customer
  updated_by_user_id: string; // UUID of user who last updated
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  // Fields for discounts and payment
  default_discount_type?: 'percentage' | 'fixed' | null;
  default_discount_value?: number | null;
  default_tax_class_id?: string | null; // Customer-specific default tax class
  preferred_payment_method?: string | null; // Customer's preferred payment method
}

export interface NewCustomerData {
  first_name: string;
  last_name?: string | null;
  birth_date?: string | null; // ISO date format (YYYY-MM-DD)
  email?: string | null;
  website?: string | null; // URL for business website
  phone_number?: string | null;
  preferred_communication?: 'email' | 'phone' | 'sms' | 'mail' | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  country_id?: string | null; // Reference to the countries table
  notes?: string | null;
  referral_source?: string | null; // How the customer found the business
  customer_type: string; // e.g., 'INDIVIDUAL', 'BUSINESS', 'RETAIL', 'WHOLESALE'
  store_id?: string | null; // Optional: associates customer with a specific store
  // Financial fields
  credit_limit?: number | null;
  default_discount_type?: 'percentage' | 'fixed' | null;
  default_discount_value?: number | null;
  preferred_payment_method?: string | null; // Customer's preferred payment method
}

export interface HeldOrder {
  id: string; // Unique identifier for the held order
  items: CartItem[]; // The actual cart items
  customer: Customer | null; // Customer associated at the time of hold
  totalAmount: number; // Total amount at the time of hold
  heldAt: string; // ISO string timestamp of when it was held
  name?: string; // Optional: A user-given name or auto-generated (e.g., "Order @ 10:15 AM")
  discount_value?: number; // Optional discount value
  discount_type?: 'percentage' | 'fixed'; // Optional discount type
}

// Defines the structure of an item within a sale, for API and backend processing
export interface SaleItem {
  productId: string;
  quantity: number;
  price: number; // Price at the time of sale
  name: string; // Product name at the time of sale (for record keeping)
  // Optional: discount_per_item, tax_per_item if calculated at item level
}

// Define Store interface
export interface Store {
  id: string;
  tenant_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  currency_code?: string; // e.g., 'USD', 'INR'
  tax_rate?: number; // e.g., 0.10 for 10%
  discount_application_preference?: 'BEFORE_TAX' | 'AFTER_TAX' | null;
  // Add other store-specific settings as needed
  created_at?: string;
  updated_at?: string;
}

// Define User interface
export interface User {
  id: string;
  name?: string | null; // Full name of the user
  tenant_id?: string | null;
  store_id?: string | null; // User's default or assigned store_id
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string; // e.g., 'admin', 'manager', 'cashier'
  is_active: boolean;
  currency_code?: string;
  allowNegativeStock?: boolean; // Tenant setting for allowing negative stock

  // Fields from actual backend response for direct access (temporary for CartContext fallback)
  tax_config?: {
    rules?: any[]; // Consider defining more strictly if the structure of rules is known
    default_rate?: number | null;
    default_tax_class_id?: string | null; // Added for store's default tax class ID
  } | null;
  discount_application_rule?: 'BEFORE_TAX' | 'AFTER_TAX' | string | null; // string for broader compatibility if backend sends other values

  // Ideal nested store object - authService should eventually populate this
  store?: Store | null; 
  // Deprecated fields that might still be in use or old references - review and remove if truly unused
  created_at?: string;
  updated_at?: string;

  // New field for default tax class ID from store config
  defaultTaxClassId?: string | null;
}

// Credentials for login
export interface LoginCredentials {
  email: string;
  password?: string;
  otp?: string; // Optional for OTP-based login
}

// New Tax-related interfaces
export interface TaxClass {
  id: string;
  tenantId: string; 
  name: string;
  description?: string | null; 
  isActive: boolean;
  is_default?: boolean; 
  createdAt: string; 
  updatedAt: string; 
}

export interface TaxClassRate {
  id: string;
  taxClassId: string; 
  taxRateName: string; 
  rate: number; // e.g., 0.05 for 5%
  priority: number;
  isCompound: boolean; 
  is_active?: boolean; 
  is_inclusive?: boolean; 
  createdAt: string; 
  updatedAt: string; 
}

// Interface for detailed tax breakdown for receipts
export interface AppliedTaxDetail {
  id: string; // Unique ID for the detail record
  sale_id: string; // Foreign key to the sales table, populated on sale creation
  tax_class_id: string;
  tax_rate_id: string;
  tax_name: string; // e.g., "General Sales Tax" or "Electronics Tax"
  tax_rate_percentage: number; // The rate applied as a percentage (e.g., 8.25 for 8.25%)
  tax_amount: number; // The total tax amount calculated for this specific rate/class
  taxable_base_amount: number; // The portion of the subtotal this tax was applied to
  // isProductSpecific?: boolean; // Optional: flag if this tax was due to a product-specific setting - can be added later if needed
}

// General API Response structure
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status?: string | number; // e.g., 'success', 200, 404
  // Add other common API response fields if necessary, like pagination info
}

export interface PaginatedApiResponse<T = any> extends ApiResponse<T[]> { // T is now an array for paginated data
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}
