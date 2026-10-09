// Consolidated types for frontend/src/types/index.ts

// General API Response structure (aligned with services/api.ts)
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  error?: string;
  token?: string;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

// Store & Auth Related Types
export interface Store {
  id: string;
  tenantId: string; // Matches User.tenantId
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null; // Store logo URL (used across app: receipts, reports, etc.)
  currencyCode?: string; // e.g., 'USD', 'INR'
  currencyDecimalPlaces?: number; // Default store currency decimal places if applicable
  dateFormat?: string; // Store's preferred date format (e.g., 'MMM dd, yyyy')
  timeFormat?: string; // Store's preferred time format (e.g., 'hh:mm A')
  timezone?: string; // Store's timezone (e.g., 'America/New_York')
  taxConfig?: TaxConfig | null; // Changed from tax_config
  discountApplicationPreference?: 'BEFORE_TAX' | 'AFTER_TAX' | null; // Changed from discount_application_rule or discount_application_preference
  allowNegativeStock?: boolean; // Store-level setting for allowing negative stock
  requireOpenRegister?: boolean; // When on, the backend refuses sales until a drawer session is open for this store
  // New localization fields
  numberFormat?: string; // e.g., '1,234.56' or '1.234,56'
  decimalPrecision?: number; // Default decimal precision for numbers (e.g., 2 for currency, 3 for weights)
  localeCode?: string; // BCP 47 language tag, e.g., 'en-US', 'fr-CA'
  languageCode?: string; // ISO 639-1 language code (e.g., 'en', 'fr')
  countryCode?: string; // ISO 3166-1 alpha-2 code (e.g., 'US', 'IN')
  measurementSystem?: 'metric' | 'imperial'; // Default measurement system
  defaultTaxBasis?: 'INCLUSIVE' | 'EXCLUSIVE' | null; // Store's default tax basis (inclusive or exclusive pricing)
  theme?: 'light' | 'dark'; // UI theme preference
  // This store's own business-type override (stores.industry_code). null/undefined
  // means it inherits the tenant's company-wide default — see GET /api/industry/tenant
  // and docs/17-migration-and-roadmap/22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md.
  industryCode?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StoreDetails { // For simpler store listings or when full Store object isn't needed
  id: string;
  name: string;
}

export interface TaxConfig {
  // Defining both camelCase and snake_case for compatibility
  defaultRate?: number;
  default_rate?: number;
  rules?: unknown[]; // Consider defining more strictly if the structure of rules is known
  defaultTaxClassId?: string | null;
  default_tax_class_id?: string | null;
  [key: string]: unknown; // Allows for other dynamic properties if the JSON structure varies
}

export interface User {
  id: string;
  tenantId?: string | null; // Changed from tenant_id
  storeId?: string | null; // Changed from store_id
  username: string;
  email: string;
  name?: string | null; // Full name of the user
  first_name?: string | null;
  last_name?: string | null;
  role: string; // e.g., 'admin', 'manager', 'cashier' (string for flexibility)
  roles?: string[]; // Array of role strings (e.g., 'admin', 'manager', 'cashier')
  isActive: boolean; // Changed from is_active
  currencyCode?: string; // User's preferred currency, might inherit from store. Changed from currency_code
  allowNegativeStock?: boolean; // Tenant setting for allowing negative stock
  taxConfig?: TaxConfig | null; // Changed from tax_config
  discountApplicationRule?: 'BEFORE_TAX' | 'AFTER_TAX' | string | null; // string for broader compatibility. Changed from discount_application_rule
  store?: Store | null; // Nested store object for easy access to store details
  defaultTaxClassId?: string | null; // User's or store's default tax class ID
  created_at?: string;
  updated_at?: string;
  // RBAC system properties
  permissions?: string[]; // Array of permission strings (e.g., 'products.view', 'tax.view')
  systemRoles?: string[]; // Array of system-level roles (e.g., 'Tenant Admin')
  // Tenant onboarding information
  tenant?: {
    id: string;
    setup_completed: boolean;
    onboarding_step: string;
    settings: any;
  } | null;
}

export interface LoginCredentials {
  email: string;
  password?: string; // Optional if OTP is primary
  otp?: string; // Optional for OTP-based login
}

// Product & Category Types
export interface Product {
  id: string;
  tenantId: string; // Was tenant_id, ensure consistency
  storeId?: string | null;
  categoryId?: string | null; // Changed from categoryId: string to optional
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: number; // Selling price
  costPrice?: number | null;
  stockQuantity: number;
  lowStockThreshold?: number | null;
  supplierId?: string | null;
  supplierName?: string; // Added for export and potential display
  isActive: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  brand?: string;
  unitOfMeasure?: string;
  trackInventory: boolean;
  // Legacy discount fields (to be migrated to promotional offers)
  specificDiscountType?: 'percentage' | 'fixed' | null;
  specificDiscountValue?: number | null;
  specific_discount_type?: 'percentage' | 'fixed' | null; // Backend snake_case version
  specific_discount_value?: number | null; // Backend snake_case version
  taxClassId?: string | null; // Was tax_class_id
  promotionalOfferId?: string | null;
  categoryName?: string; // Added for displaying category name directly
  taxClassName?: string; // Populated by backend JOIN
  // Jewelry-only defaults — meaningless/unused for non-jewelry tenants.
  purity?: string | null;
  hsnCode?: string | null;
  defaultGrossWeight?: number | null;
  defaultNetWeight?: number | null;
  defaultMakingChargeType?: 'per_gram' | 'percentage' | 'flat' | null;
  defaultMakingChargeValue?: number | null;
  defaultWastagePct?: number | null;
}

// Result of a jewelry weight-pricing calculation applied to a single cart line.
export interface JewelryLinePricing {
  purity: string | null;
  grossWeight: number | null;
  netWeight: number | null;
  ratePerGram: number | null;
  wastagePct: number | null;
  makingChargeType: 'per_gram' | 'percentage' | 'flat' | null;
  makingChargeValue: number | null;
  stoneValue: number | null;
  metalValue: number;
  wastageValue: number;
  makingCharge: number;
  lineTotal: number; // total for ONE unit — multiplied by quantity for the cart line
  hsnCode?: string | null;
  snapshot?: Record<string, unknown>;
}

export interface ProductListResponse {
  products: Product[];
  results?: number; // Optional: if you want to use the count returned by the API
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
  product_count?: number; // Number of products associated with the category
}

// Cart, Sale, & Order Types
export interface CartItem {
  product: Product;
  quantity: number;
}

// Enhanced CartItem interface with item-specific discount support
export interface EnhancedCartItem extends CartItem {
  originalPrice: number;
  appliedDiscounts: import('./discount').CartItemDiscount[];
  finalPrice: number;
  jewelryPricing?: JewelryLinePricing | null;
}

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'online';

// Defines the structure of an item within a sale, for API and backend processing
export interface SaleItem {
  productId: string;
  id?: string;  // Optional: For backward compatibility or specific use cases
  quantity: number;
  price: number; // Price at the time of sale
  name?: string; // Product name at the time of sale (for record keeping, optional)
  discount?: number; // Optional discount applied to this item
}

export interface Sale { // Represents a completed sale transaction
  id: string;
  tenantId: string;
  storeId: string;
  cashierId: string; // User ID of the cashier
  items: SaleItem[];
  subtotal: number;
  tax: number; // Total tax amount for the sale
  discountAmount?: number; // Optional: Overall discount amount for the sale
  discountType?: 'percentage' | 'fixed' | null; // Optional: Type of overall discount
  discountValue?: number; // Optional: Value of the overall discount (e.g., 10 for 10% or 5 for $5)
  total: number; // Final amount after all calculations
  paymentMethod: PaymentMethod;
  status: 'completed' | 'refunded' | 'voided';
  createdAt: string;
  customerName?: string;
  cashierName?: string;
  employeeName?: string; // From some existing backend responses
  paymentMethodName?: string; // Display name of the payment method, e.g., "Cash", "Card", "Phone"
  // Database fields for promotions persistence
  promotions_amount?: number; // Snake case from database
  promotionsAmount?: number; // Camel case variant
  manual_discount_amount?: number; // Snake case from database
  manualDiscountAmount?: number; // Camel case variant
  discount_amount?: number; // Snake case from database
  applied_offers_json?: string; // Applied offers JSON from database
}

// For creating a new sale (payload to API)
export interface SaleData {
  items: CartItem[]; // Items from the cart
  subTotal: number;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number; // Overall discount amount for the sale
  customerId?: string;
  paymentMethod: string; // Align with PaymentMethod type if possible, or keep as string if backend expects specific values
  transactionId?: string; // Optional: external transaction ID from payment gateway
  notes?: string;
  appliedTaxDetails?: AppliedTaxDetail[]; // Breakdown of taxes applied, for display/record
}

// For displaying applied tax details in UI (e.g., CartContext, receipts)
export interface AppliedTaxDetail {
  name: string; // e.g., "GST", "VAT"
  rate: number; // e.g., 0.05 for 5%
  amount: number; // Calculated tax amount for this specific tax
  isCompound?: boolean;
  priority?: number;
}

// For backend records of applied tax, distinct from the one for CartContext display
export interface AppliedTaxDetailRecord {
  id: string;
  sale_id: string;
  tax_class_id: string;
  tax_rate_id: string;
  tax_name: string;
  tax_rate_percentage: number;
  tax_amount: number;
  taxable_base_amount: number;
}

export interface HeldOrder {
  id: string; // Unique identifier for the held order
  items: CartItem[]; // The actual cart items
  customer?: Customer | null; // Customer associated at the time of hold
  customerName?: string; // Fallback or quick display name
  totalAmount?: number; // Total amount at the time of hold
  timestamp?: number; // Unix timestamp for when it was held (from index.ts)
  heldAt?: string; // ISO string timestamp (from types.ts) - choose one or make consistent
  name?: string; // Optional: A user-given name or auto-generated
  notes?: string;
  discount_value?: number;
  discount_type?: 'percentage' | 'fixed' | 'fixedAmount';
}

// Customer Types
export interface CustomerAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface Customer {
  id: string; // UUID — internal key only, never displayed in the UI
  /** Human-friendly sequential code shown to staff, e.g. CU-000123. */
  customerCode?: string | null;
  tenantId: string; // UUID, identifies the business/tenant
  storeId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  customerType: 'INDIVIDUAL' | 'BUSINESS' | 'WALK_IN';
  isActive: boolean;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string

  // Personal details
  gender?: 'male' | 'female' | 'other';
  dob?: string; // YYYY-MM-DD
  birthDate?: string | null; // alias for dob
  dateOfBirth?: string | null; // camelCase alias from backend date_of_birth

  // Address
  address?: CustomerAddress;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;

  // Business details
  companyName?: string | null;
  website?: string | null;
  taxId?: string | null;
  taxIdNumber?: string | null; // alias for taxId
  isTaxExempt?: boolean;

  // Financial details
  creditLimit?: number;
  outstandingCredit?: number;
  totalSalesValue?: number;
  total_sales_value?: number; // Alias for backend consistency
  currencyCode?: string | null;
  defaultDiscountType?: 'percentage' | 'fixed' | 'fixedAmount' | null;
  defaultDiscountValue?: number | null;

  // Loyalty and History
  lastPurchaseDate?: string | null;
  totalVisits?: number;
  totalSpent?: number;
  loyaltyId?: string | null;
  loyaltyPoints?: number;
  tags?: string[];

  // Preferences
  communicationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  preferredCommunication?: 'email' | 'phone' | 'sms' | 'mail' | null;
  preferredPaymentMethod?: string | null;

  // Other
  notes?: string | null;
  referralSource?: string | null;
  defaultTaxClassId?: string | null;

  // Audit
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}

// Purchase Order & GRN Types



export interface Supplier {
  id: string;
  tenantId: string;
  supplierName: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  website?: string | null;
  taxId?: string | null; // For VAT, EIN, etc.
  defaultPaymentTerms?: string | null; // e.g., "Net 30"
  notes?: string | null;
  isActive: boolean;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
}

// For creating a new customer (payload to API)
export interface NewCustomerData {
  firstName: string;
  lastName?: string | null;
  birthDate?: string | null;
  email?: string | null;
  website?: string | null;
  phoneNumber?: string | null;
  preferredCommunication?: 'email' | 'phone' | 'sms' | 'mail' | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  countryId?: string | null;
  notes?: string | null;
  referralSource?: string | null;
  customerType: string;
  storeId?: string | null; // Optional: associates customer with a specific store
  creditLimit?: number | null;
  defaultDiscountType?: 'percentage' | 'fixed' | 'fixedAmount' | null;
  defaultDiscountValue?: number | null;
  preferredPaymentMethod?: string | null;
  // Fields from CreateCustomerPayload if they are meant for creation
  loyaltyId?: string | null;
  taxIdNumber?: string | null;
  isTaxExempt?: boolean; // Whether this customer is exempt from taxes
  isActive?: boolean; // Typically true on creation
}

// This might be for a specific update or a different customer endpoint
export interface CreateCustomerPayload {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  customerType?: string;
  loyaltyId?: string | null;
  taxIdNumber?: string | null;
  notes?: string | null;
  creditLimit?: number;
  isActive?: boolean;
  defaultDiscountType?: 'percentage' | 'fixed' | 'fixedAmount' | null;
  defaultDiscountValue?: number | null;
}

// Tax System Types
export interface TaxClass {
  id: string;
  tenantId: string; // From types.ts
  name: string;
  description?: string | null; // From types.ts
  isActive: boolean | number;
  is_active?: boolean | number; // Snake_case variant
  isDefault?: boolean | number; // From types.ts
  is_default?: boolean | number; // Snake_case variant
  createdAt: string; // From types.ts (was optional in index.ts)
  updatedAt: string; // From types.ts (was optional in index.ts)
}

export interface TaxClassRate {
  id: string;
  taxClassId: string;
  taxRateName: string; // Name of the specific rate, e.g., "Standard Rate"
  tax_rate_name?: string; // Snake_case variant
  rate: string | number; // The actual tax rate, e.g., 0.05 for 5%
  priority: number; // For compound taxes
  isCompound: boolean;
  // Fields from types.ts
  description?: string | null;
  taxCode?: string | null; // External tax code if applicable
  isActive?: boolean | number; // If this specific rate is active
  is_active?: boolean | number; // Snake_case variant
  createdAt: string; // Was optional in index.ts
  updatedAt: string; // Was optional in index.ts
}

export interface TaxClassesResponsePayload {
  count: number;
  data: TaxClass[]; // This is the actual array of tax classes
  // Add any other potential pagination/metadata fields here if they exist
}

// API-specific response types for /api/users/me
export interface BackendStoreForApi {
  id: string;
  tenant_id?: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency_code?: string;
  currency_decimal_places?: number;
  date_format?: string; // Store's preferred date format in snake_case
  time_format?: string; // Store's preferred time format in snake_case
  timezone?: string; // Store's timezone
  tax_config?: TaxConfig; // Keeping it simple for now, can be more specific
  discount_application_preference?: string;
  discount_application_rule?: string; // For fallback
  allow_negative_stock?: boolean; // Store-level setting from backend
  // New localization fields
  number_format?: string; // Number format pattern, e.g., '1,234.56' or '1.234,56'
  decimal_precision?: number; // Default decimal precision
  locale_code?: string; // BCP 47 language tag
  language_code?: string; // ISO 639-1 language code
  country_code?: string; // ISO 3166-1 alpha-2 code
  measurement_system?: 'metric' | 'imperial'; // Default measurement system
}

// Duplicate Store interface removed

export interface BackendUserForApi {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  username?: string | null;
  role?: string; // Made optional since it's being replaced by systemRoles
  is_active?: boolean;
  tenant_id?: string | null;
  store_id?: string | null; // If store is not nested
  store?: BackendStoreForApi | null; // If store is a nested object
  store_currency_code?: string | null; // Added for /api/users/me response
  tax_config?: TaxConfig; // Keeping it simple
  discount_application_rule?: string | null;
  currency_code?: string | null;
  allow_negative_stock?: boolean;
  default_tax_class_id?: string | null;
  // RBAC fields
  permissions?: string[];
  systemRoles?: string[];
  roles?: string[]; // Additional roles field from backend response
  roleNames?: string[]; // Role names from RBAC service
  // Tenant onboarding status — populated by /auth/login and /users/me so
  // the frontend can redirect to /onboarding when setup is incomplete.
  // Without this, Login.tsx's `user.tenant` check is always undefined
  // and every user skips onboarding (audit Gap 3).
  tenant?: {
    id: string;
    name: string;
    setup_completed: boolean;
    onboarding_step: string;
    settings?: any;
    industry_code?: string | null;
  } | null;
  // Add any other fields returned by /api/users/me that are used
}

export interface UserMeResponseData {
  // Token can be at the root level or in a nested property
  token?: string;
  
  // User data might be nested under 'user' or at the root
  user?: BackendUserForApi;
  
  // Common fields that might be at the root level
  id?: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string;
  username?: string | null;
  role?: string;
  is_active?: boolean;
  tenant_id?: string | null;
  store_id?: string | null;
  permissions?: string[];
  systemRoles?: string[];
  roles?: string[];
  
  // For nested response structures (e.g., { data: { user, token } })
  data?: {
    user?: BackendUserForApi;
    token?: string;
  };
}

// Dashboard & Report Types (primarily from index.ts)
import { DateRange } from 'react-day-picker';
export interface SalesSummary {
  totalRevenue: number;       // Total revenue for the current year
  totalSales: number;         // Total number of sales transactions for the current year
  totalItems: number;         // Total items sold (all time)
  averageOrderValue: number;  // Average value per order for the current year

  // Optional fields for potential future use or if other parts of the app expect them
  todaySales?: number;
  yesterdaySales?: number;
  transactionCount?: number; // Yearly transaction count is now in 'totalSales'
  averageTicketSize?: number; // Yearly average order value is now in 'averageOrderValue'
  yesterdayTransactionCount?: number;
  yesterdayAverageTicketSize?: number;
  lastMonthTotalSales?: number;
  totalRevenueThisMonth?: number; // Added for monthly revenue
}

export interface CategorySalesSummaryItem {
  categoryId: string | number;
  categoryName: string;
  totalRevenue: number;
}

export interface PaymentSummary {
  methods: {
    method: PaymentMethod;
    amount: number;
    percentage: number;
    count: number;
  }[];
}

export interface TopSellingProduct {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface InventorySummary {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface ReportFilter {
  startDate: string;
  endDate: string;
  storeId?: string;
  categoryId?: string;
  accountStatus?: string;
  dateRange?: DateRange;
  supplierId?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  limit?: number;
  offset?: number;
}

// Specific types for Sales Reports
export type ReportSaleStatus = 'completed' | 'refunded' | 'voided' | 'pending';

// Consider if 'NO_PAYMENT' from MEMORY[7a60b9b6-4a98-4810-ad4a-42e53751ed79]
// should be part of a general PaymentMethod type or specific to reports.
// The existing PaymentMethod type is: 'cash' | 'card' | 'upi' | 'wallet' | 'online'.
// For SalesReportTransaction, using string for paymentMethod for now, but a union type is preferable.

export interface SalesReportTransaction {
  id: string; // Sale ID
  transactionDate: string; // ISO string, e.g., "2023-10-26T10:30:00Z"
  customerName?: string; // Optional, could be 'Guest' or actual customer name
  totalItems: number; // Total number of unique products or total quantity of all items
  subtotalAmount: number; // Sum of (item price * quantity) before discounts and taxes
  discountAmount: number; // Total discount applied to the sale
  taxAmount: number; // Total tax applied to the sale
  totalAmount: number; // Final amount paid by the customer (subtotal - discount + tax)
  paymentMethod: string; // User-friendly payment method name, e.g., "Cash", "Visa ****1234", "No Payment Required"
  paymentMethodCode?: string; // Backend code for payment method, e.g., "CASH", "CARD_VISA", "NO_PAYMENT"
  status: ReportSaleStatus; // 'completed', 'refunded', 'voided', 'pending'
  cashierId?: string; // ID of the user who processed the sale
  cashierName?: string; // Name of the cashier
  storeId?: string; // ID of the store where the sale occurred
  storeName?: string; // Name of the store
  notes?: string; // Any notes associated with the sale
  // items?: SaleItem[]; // Optional: Array of items in the sale, if detailed drill-down is needed directly in this structure. See existing SaleItem.
}

export interface TransactionItem {
  id: string;
  productId?: string; // Making this optional since we might not have it in all APIs
  name: string;
  quantity: number;
  price: number;
  discountAmount?: number;
  taxAmount?: number;
  total: number;
  sku?: string;
  notes?: string;
}

export interface TransactionDetail {
  id: string;
  date?: string; // Date string format
  transactionDate?: string; // Keeping for compatibility with SalesReportTransaction
  localDate?: string; // Formatted local date string
  local_date?: string; // Underscore version for backend compatibility
  customer?: string;
  customerId?: string;
  customerName?: string; // For compatibility with SalesReportTransaction
  customerPhone?: string;
  customerEmail?: string;
  cashier?: string;
  cashierId?: string;
  cashierName?: string; // For compatibility with SalesReportTransaction
  items: TransactionItem[];
  subtotal: number;
  subtotalAmount?: number; // For compatibility with SalesReportTransaction
  tax: number;
  taxAmount?: number; // For compatibility with SalesReportTransaction
  discount: number;
  discountAmount?: number; // For compatibility with SalesReportTransaction
  total: number;
  totalAmount?: number; // For compatibility with SalesReportTransaction
  totalItems?: number; // For compatibility with SalesReportTransaction
  status: string;
  paymentMethod?: string;
  payment_method_display?: string; // Display-friendly payment method name
  paymentMethodCode?: string;
  storeId?: string;
  storeName?: string;
  receiptNumber?: string;
  returnPolicy?: string;
  notes?: string;
  paymentDetails?: {
    method: string;
    reference?: string;
    changeAmount?: number;
    tenderAmount?: number;
  };
  returnedFrom?: string; // Original transaction ID if this is a return
}

export interface SalesChartDataPoint {
  date: string; // Date string (e.g., "YYYY-MM-DD") for the x-axis
  totalSales: number; // Aggregated sales amount for the period
  transactions?: number; // Number of transactions in the period
}

export interface DateSalesData {
  date: string;
  totalSales: number;
  transactions?: number;
}

// Inventory Report Types
export interface InventoryReportItem {
  productId: string;
  productName: string;
  sku?: string;
  categoryName?: string;
  supplierName?: string;
  currentStock: number;
  costPrice?: number; // For calculating stockValue
  stockValue: number; // currentStock * costPrice
  reorderLevel?: number; // Also known as lowStockThreshold
  lastSoldDate?: string | null; // ISO Date string or null
  lastReceivedDate?: string | null; // ISO Date string or null
}

export interface InventorySummaryMetrics {
  totalUniqueItems: number; // Count of unique products
  totalItemsInStock: number; // Sum of currentStock for all items
  totalStockValue: number; // Sum of stockValue for all items
  lowStockItemsCount: number; // Count of items where currentStock <= reorderLevel
  outOfStockItemsCount: number; // Count of items where currentStock === 0
}

// Payment Report Types
export interface PaymentReportItem {
  id: string; // Payment transaction ID
  date: string; // ISO date string of the payment
  invoiceId: string; // Associated invoice or sale ID
  customerName?: string; // Optional customer name
  paymentMethod: string; // e.g., "Cash", "Credit Card", "Online"
  amount: number; // Payment amount
  status: 'Completed' | 'Pending' | 'Failed' | 'Refunded'; // Payment status
  processedBy: string; // Name or ID of the user/cashier who processed it
}

export interface PaymentSummaryMetrics {
  totalRevenue: number; // Sum of all successful payment amounts
  totalTransactions: number; // Count of all successful transactions
  averageTransactionValue: number; // totalRevenue / totalTransactions
  paymentsByMethod: Array<{
    method: string;
    count: number;
    totalAmount: number;
  }>; // Breakdown of payments by method
  totalRefunds?: number; // Optional: total amount refunded
  netRevenue?: number; // Optional: totalRevenue - totalRefunds
}

// Customer Value Report Types
export interface CustomerValueReportItem {
  customerId: string;
  customerName: string;
  totalSpent: number;
  transactionCount: number;
  averagePurchaseValue: number;
  firstPurchaseDate: string; // ISO Date string
  lastPurchaseDate: string; // ISO Date string
  customerSegment?: 'VIP' | 'Loyal' | 'New' | 'At Risk' | 'Churned'; // Example segments
}

export interface CustomerValueSummaryMetrics {
  totalUniqueCustomers: number;
  averageLifetimeValue: number; // Sum of all totalSpent / totalUniqueCustomers
  topCustomerBySpending?: {
    customerId: string;
    name: string;
    amount: number;
  };
  topCustomerByFrequency?: {
    customerId: string;
    name: string;
    count: number;
  };
  newCustomersThisPeriod?: number; // Count of customers whose firstPurchaseDate is within the report period
}

// Charge Account Report Types
export interface ChargeAccountReportItem {
  customerId: string;
  customerName: string;
  accountType: string; // e.g., 'Store Credit', 'Layaway', 'On Account'
  currentBalance: number;
  creditLimit?: number;
  lastPurchaseDate?: string | null; // Changed from lastTransactionDate, made optional and nullable
  accountStatus: 'Active' | 'Over Limit' | 'Zero Balance' | 'Paid Off' | 'Inactive' | 'Suspended'; // Added backend statuses
  daysOverdue?: number;
}

export interface ChargeAccountSummaryMetrics {
  totalAccounts: number;
  totalOutstandingBalance: number;
  totalCreditLimit: number;
  averageBalancePerAccount: number;
  accountsOverLimit: number;
  utilizationRate: number; // Expressed as a decimal, e.g., 0.75 for 75%
}

// Purchase Order Types
export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  quantityOrdered: number;
  costPrice: number;
  quantityReceived?: number;
  lineTotal: number;
  createdAt?: string;
  purchaseOrderId?: string;
  remainingQuantity?: number;
  status?: string | null;
  itemReceivedStatus?: string;
  updatedAt?: string;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  storeId?: string;
  supplierId: string;
  supplierName?: string; // Joined from suppliers table
  purchaseOrderNumber?: string;
  orderDate: string; // Or Date object, handle conversion as needed
  expectedDeliveryDate?: string; // Or Date object
  status: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  items?: PurchaseOrderItem[];
  hasGrn?: boolean; // Indicates if the PO has associated GRNs // Included when fetching a single PO
  
  // Keeping snake_case aliases for backwards compatibility
  tenant_id?: string;
  store_id?: string;
  supplier_id?: string;
  supplier_name?: string;
  purchase_order_number?: string;
  order_date?: string;
  expected_delivery_date?: string;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
  created_by_user_id?: string;
  updated_by_user_id?: string;
}

// Specific statuses allowed when creating or for the status dropdown in the modal
export type PurchaseOrderCreationStatus = 'DRAFT' | 'ORDERED';

export type PurchaseOrderModalMode = 'create' | 'edit' | 'view';

// Tenant and Store Management
export interface Tenant {
  id: string;
  name: string;
  description?: string;
  // other product fields
}

// Goods Received Note (GRN) Types
export type GrnStatus = 'DRAFT' | 'POSTED' | 'CANCELLED' | 'COMPLETED';

export interface GrnItem { // Represents a GRN item, for display or after creation
  id: string;
  grnId?: string; // Added to link back to GRN
  productId: string;
  productName?: string; // Was product_name, now optional
  productSku?: string; // Added, and now optional
  purchaseOrderItemId?: string; // Was purchase_order_item_id
  quantityOrdered?: number; // Was quantity_ordered
  quantityReceived: number; // Was quantity_received
  unitCostPrice: number; // Was unit_cost_price
  totalCost?: number; // Added, typically quantityReceived * unitCostPrice
  batchNumber?: string;
  expiryDate?: string;
  createdAt?: string; // Added
  updatedAt?: string; // Added
}

// Renamed back to GrnItemData, properties converted to snake_case for API payload
export interface GrnItemData { // For items being submitted in a new GRN
  purchase_order_item_id: string | null; // Link to PO item if applicable
  purchase_order_id?: string | null; // Added for direct PO linking
  product_id: string;
  product_name?: string; // For context, not usually sent if product_id is key
  product_sku?: string;  // For context
  quantity_ordered?: number | null; // How many were on the PO line initially (for reference)
  quantity_received: number;
  unit_cost_price: number;
  tax_rate?: number; // Tax rate applied to this line item for the GRN
  po_number?: string; // PO number this item came from (for reference)
  // quantity_pending is more of a display/calculation concern in SelectPoItemsModal
  // rather than a core field of a GRN item itself once it's on the GRN.
  // If needed for backend, it can be added back.
}

export interface CreateGrnData {
  tenant_id: string; // Added: Required by backend
  supplier_id?: string;
  purchase_order_id: string | null; // Changed to non-optional string | null
  store_id: string;
  user_id: string; // User performing the action (often maps to created_by_user_id or similar)
  grn_number?: string; 
  invoice_number?: string; 
  received_date: string; // ISO date string
  notes: string | null; // Changed to non-optional string | null for testing
  items: GrnItemData[]; // Uses snake_case GrnItemData
  received_by_user_id: string; // Explicitly who received it, if different from user_id or for specific logging
  supplier_invoice_number: string | null; 
  supplier_invoice_date: string | null; // Changed to non-optional string | null
  total_tax_paid?: number;
  shipping_handling_paid?: number;
  other_charges_paid?: number;
  status: GrnStatus; // e.g., 'POSTED' or 'DRAFT'
}

export interface Grn { // Represents a GRN object, for frontend use (camelCase)
  id: string;
  grnNumber: string; // e.g., GRN-2023-0001, likely auto-generated by backend
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string | null; // Denormalized for display
  supplierId?: string | null; // Can be from PO or direct
  supplierName?: string | null; // Denormalized for display
  storeId?: string; // Added
  userId?: string; // Added
  invoiceNumber?: string; // Added (general invoice number)
  receivedDate: string;
  status: GrnStatus; // Updated status type
  notes?: string;
  items: GrnItem[];
  receivedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
  supplierInvoiceNumber?: string | null; // Was supplier_invoice_number
  supplierInvoiceDate?: string | null; // Was supplier_invoice_date
  totalTaxPaid?: number | null; // Was total_tax_paid
  shippingHandlingPaid?: number | null; // Was shipping_handling_paid
  otherChargesPaid?: number | null; // Was other_charges_paid
  totalGrnCost?: number | null; // Was total_grn_cost (if it existed with this name)
}

// This type represents the structure of a single GRN object as returned by the GET /grn list endpoint.
// It assumes that snake_case fields from the backend are converted to camelCase by fetchApi.
// It does not include the 'items' array, as that's fetched separately for individual GRNs.
export interface GrnResponse {
  id: string;
  tenantId: string;
  storeId?: string;
  grnNumber: string;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  receivedDate: string;
  notes?: string | null;
  userId: string; // Creator (from grn.user_id)
  receivedByUserId?: string; // Receiver (from grn.received_by_user_id)
  status: GrnStatus; // e.g., 'COMPLETED', 'DRAFT'
  totalReceivedValue?: number | null; // from grn.total_received_value
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: string | null;
  totalTaxPaid?: number | null;
  shippingHandlingPaid?: number | null;
  otherChargesPaid?: number | null;
  createdAt: string;
  updatedAt: string;

  // Joined fields from backend query
  supplierName?: string | null;
  receivedByUserName?: string | null; // from u.name as received_by_user_name
  purchaseOrderNumber?: string | null;
}

// Stock Movement Types