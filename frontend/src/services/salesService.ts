import { SaleItem, SalesSummary, DateSalesData, Sale } from '@/types'; // Added Sale type
import * as api from './api';

/**
 * Traveller data captured by the Sales Hub's Duty-Free Sale intake (see
 * docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md). Generic field names
 * on purpose — not every duty-free traveller carries a passport or departs by
 * flight (e.g. Caribbean cruise-ship traffic on a seaman's book, by vessel).
 * Defined here (a service, lower-level than the cart context that also uses
 * it) rather than in CartContext.tsx, so this file doesn't import a context.
 */
export interface TravellerContext {
  travellerIdType?: 'passport' | 'national_id' | 'seaman_book' | 'other';
  travellerIdNumber?: string;
  travellerIdCountry?: string;
  travelMethodType?: 'flight' | 'vessel' | 'other';
  travelMethodRef?: string;
  travelMethodDetail?: string;
  destination?: string;
  departureDate?: string;
}

// Define a simplified response type for createSale, if needed, or return directly from api.createSale
export interface CreateSaleServiceResponse {
  saleId: string;
}

// This type remains for internal use or for components expecting full Sale details
export interface SaleDetails {
  id: string;
  tenantId: string;
  storeId?: string;
  cashierId: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export interface SaleData {
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethodId: string;
  customerId?: string;
  employeeId?: string;
  cashierId?: string;
  tenantId?: string;
  storeId?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  // Promotions payload computed on the client. Any of these keys will be accepted by the backend.
  promoResult?: any;
  promotions?: any;
  cartPromotions?: any;
  // Duty-free traveller capture (Sales Hub) — absent on an ordinary sale.
  travellerContext?: TravellerContext;
}

export const createSale = async (saleData: SaleData): Promise<CreateSaleServiceResponse> => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  const storeId = saleData.storeId || currentUser.storeId;
  const cashierId = saleData.cashierId || currentUser.id;
  const tenantId = saleData.tenantId || currentUser.tenantId;

  if (!storeId) {
    console.error('Store ID is missing from both saleData and currentUser. Cannot create sale.');
    throw new Error('Store ID is essential for creating a sale and is missing.');
  }
  if (!cashierId) {
    console.error('Cashier ID is missing from both saleData and currentUser. Cannot create sale.');
    throw new Error('Cashier ID is essential for creating a sale and is missing.');
  }
  if (!tenantId) {
    console.error('Tenant ID is missing from both saleData and currentUser. Cannot create sale.');
    throw new Error('Tenant ID is essential for creating a sale and is missing.');
  }

  const payload: api.CreateSaleData = {
    items: saleData.items.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price })),
    tenantId: tenantId,
    store_id: storeId,
    cashier_id: cashierId,
    subtotal: saleData.subtotal,
    tax: saleData.tax,
    totalAmount: saleData.total,
    paymentMethodId: saleData.paymentMethodId,
    payment_method_id: saleData.paymentMethodId, // Snake case version for backend
    // Include discount information - both camelCase and snake_case versions
    discountAmount: saleData.discountAmount,
    discount_amount: saleData.discountAmount,
    discountType: saleData.discountType,
    discountValue: saleData.discountValue,

    customerId: saleData.customerId,
    // Also include snake_case version to ensure it's properly received by the backend
    customer_id: saleData.customerId,
    // Sales employee credited for commission/targets (optional)
    employeeId: saleData.employeeId,
    employee_id: saleData.employeeId,
    // Pass-through promotions under multiple aliases for backend normalization
    promoResult: saleData.promoResult || saleData.promotions || saleData.cartPromotions,
    promotions: saleData.promotions || saleData.promoResult || saleData.cartPromotions,
    cartPromotions: saleData.cartPromotions || saleData.promoResult || saleData.promotions,
    // Duty-free traveller capture (Sales Hub) — flattened onto the payload
    // since the backend column set is flat, not nested. fetchApi converts
    // these camelCase keys to snake_case before the request leaves the
    // browser (see createSaleController.js's matching destructuring).
    travellerIdType: saleData.travellerContext?.travellerIdType,
    travellerIdNumber: saleData.travellerContext?.travellerIdNumber,
    travellerIdCountry: saleData.travellerContext?.travellerIdCountry,
    travelMethodType: saleData.travellerContext?.travelMethodType,
    travelMethodRef: saleData.travellerContext?.travelMethodRef,
    travelMethodDetail: saleData.travellerContext?.travelMethodDetail,
    destination: saleData.travellerContext?.destination,
    departureDate: saleData.travellerContext?.departureDate,
  };

  try {
    const response = await api.createSale(payload);

    return {
      saleId: response.saleId,
    };
  } catch (error: unknown) {
    console.error('Error in createSale (salesService):', error);
    if (error instanceof Error) {
      throw new Error(`Sale creation failed: ${error.message}`);
    }
    throw new Error('An unexpected error occurred during sale creation.');
  }
};

/** A single row from GET /sales/search — enough to pick the right sale
 * without needing its full line-item detail yet. */
export interface SaleSearchResult {
  id: string;
  documentNumber?: string;
  total: number;
  createdAt: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

/**
 * Search completed sales by document/receipt number, customer name, email,
 * or phone. Backs the Sales Return flow's "find the sale" step — replaces
 * the old requirement of pasting the raw internal sale UUID, which nobody
 * at a register actually has memorized or written down.
 */
export const searchSales = async (query: string): Promise<SaleSearchResult[]> => {
  if (!query || !query.trim()) return [];
  try {
    return await api.fetchApi<SaleSearchResult[]>(`/sales/search?q=${encodeURIComponent(query.trim())}`);
  } catch (error) {
    console.error('Error searching sales:', error);
    return [];
  }
};

export const getSaleById = async (saleId: string): Promise<Sale | null> => {
  try {
    // Assuming api.getSale(id) fetches the full sale details from the general api service
    const saleDetails = await api.getSale(saleId);
    if (!saleDetails) {
      console.error(`Sale with ID ${saleId} not found.`);
      return null;
    }
    return saleDetails as Sale; // Cast to Sale type, ensure Sale is defined in @/types
  } catch (error: unknown) {
    console.error(`Error fetching sale by ID ${saleId}:`, error);
    if (error instanceof Error) {
      // Re-throw a more specific error or handle as appropriate
      throw new Error(`Failed to fetch sale details for ID ${saleId}: ${error.message}`);
    }
    // For unexpected errors not carrying an Error instance
    throw new Error(`An unexpected error occurred while fetching sale details for ID ${saleId}.`);
  }
};

export const getSalesSummary = async (): Promise<SalesSummary | null> => {
  try {
    const apiData = await api.getSalesSummary().catch(error => {
      console.error('Error fetching sales summary:', error);
      // Return a default summary with zeros if the API call fails
      return {
        totalRevenue: 0,
        totalSales: 0,
        totalItems: 0,
        averageOrderValue: 0,
        totalRevenueThisMonth: 0
      };
    });
    
    // The API returns a simpler object, so we map it to the more detailed SalesSummary type
    // used by the UI, providing defaults for any missing data.
    return {
      // Direct mappings from the updated API response
      totalRevenue: apiData?.totalRevenue || 0,
      totalSales: apiData?.totalSales || 0, // This is now the yearly transaction COUNT
      totalItems: apiData?.totalItems || 0,   // This is all-time items sold
      averageOrderValue: apiData?.averageOrderValue || 0,
      totalRevenueThisMonth: apiData?.totalRevenueThisMonth || 0,

      // Optional fields with placeholder logic (as before, for UI comparisons)
      todaySales: (apiData.totalRevenueThisMonth || apiData.totalRevenue || 0) * 0.05, // Placeholder
      yesterdaySales: (apiData.totalRevenueThisMonth || apiData.totalRevenue || 0) * 0.045, // Placeholder
      
      transactionCount: apiData.totalSales || 0, // Using yearly transaction count
      averageTicketSize: apiData.averageOrderValue || 0, // Using yearly AOV

      lastMonthTotalSales: (apiData.totalRevenueThisMonth || apiData.totalRevenue || 0) * 0.8, // Placeholder
      yesterdayTransactionCount: Math.round((apiData.totalSales || 0) * 0.9), // Placeholder
      yesterdayAverageTicketSize: (apiData.averageOrderValue || 0) * 0.98, // Placeholder
    };
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    return null; // Return null on error as the UI expects
  }
};

export const getSalesChartData = async (filters: { startDate: string, endDate: string }): Promise<DateSalesData[]> => {
  try {
    // Assuming api.getSalesChartData() fetches data from the general api service
    const chartData = await api.getSalesChartData(filters); // Pass filters to the API call
    return chartData;
  } catch (error) {
    console.error('Error fetching sales chart data:', error);
    throw error; // Re-throw to be handled by the component
  }
};