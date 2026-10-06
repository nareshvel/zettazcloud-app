import { SalesReportTransaction, SalesChartDataPoint, ReportFilter, InventoryReportItem, InventorySummaryMetrics, PaymentReportItem, PaymentSummaryMetrics, CustomerValueReportItem, CustomerValueSummaryMetrics, ChargeAccountReportItem, ChargeAccountSummaryMetrics, TransactionDetail } from '../types';
import { fetchApi } from './api';

// Define the API response structure
interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
}

/**
 * Fetches sales transaction data based on provided filters.
 * @param filters - Optional filters for the sales data (e.g., dateRange, storeId).
 * @returns A promise resolving to an ApiResponse containing an array of sales transactions.
 */
export const getSalesTransactions = async (
  filters?: ReportFilter
): Promise<ApiResponse<SalesReportTransaction[]>> => {
  // Fetch sales transactions
  // Construct query parameters from filters
  const queryParams = new URLSearchParams();
  if (filters?.startDate) queryParams.append('startDate', filters.startDate);
  if (filters?.endDate) queryParams.append('endDate', filters.endDate);
  if (filters?.storeId) queryParams.append('storeId', filters.storeId);
  if (filters?.limit !== undefined) queryParams.append('limit', String(filters.limit));
  if (filters?.offset !== undefined) queryParams.append('offset', String(filters.offset));

  try {
    // Call the real API endpoint
    const responseData = await fetchApi<SalesReportTransaction[] | { data: SalesReportTransaction[] }>(`/reports/sales/transactions?${queryParams.toString()}`);
    
    // Handle different response structures
    if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray((responseData as any).data)) {
      return { status: 'success', data: (responseData as { data: SalesReportTransaction[] }).data };
    }
    
    // If backend sends array directly
    if (Array.isArray(responseData)) {
      return { status: 'success', data: responseData as SalesReportTransaction[] };
    }
    
    console.error('Unexpected data format for sales transactions:', responseData);
    return { status: 'error', error: 'Unexpected data format' };
  } catch (error) {
    console.error('Error fetching sales transactions:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Fetches sales data formatted for chart display.
 * @param filters - Optional filters for the sales chart data.
 * @returns A promise resolving to an ApiResponse containing an array of sales chart data points.
 */
/**
 * Fetches detailed information for a specific transaction including line items
 * @param transactionId - The ID of the transaction to fetch
 * @returns A promise resolving to an ApiResponse containing detailed transaction data
 */
export const getTransactionDetails = async (
  transactionId: string
): Promise<ApiResponse<TransactionDetail>> => {
  // Fetch transaction details
  
  try {
    // First, get the basic sale data from sales table
    const saleResponse = await fetchApi<any>(`/sales/${transactionId}`);
    
    // Then get the items for this sale
    const itemsResponse = await fetchApi<any[]>(`/sales/${transactionId}/items`);
    
    // If we have both data points, combine them into our TransactionDetail structure
    if (saleResponse && itemsResponse) {
      // Map the sale items to our TransactionItem structure
      const items = Array.isArray(itemsResponse) ? itemsResponse.map(item => ({
        id: item.id,
        name: item.productName || item.name || 'Product', // Use product name or fallback
        price: parseFloat(item.price),
        quantity: item.quantity,
        total: parseFloat(item.price) * item.quantity,
        // Preserve identifiers needed for client-side discount enrichment
        productId: item.productId || item.product_id || item.productID || undefined,
        categoryId: item.categoryId || item.category_id || undefined,
        sku: item.sku || item.SKU || undefined,
      })) : [];

      // Construct a complete transaction detail object
      // Process sale response data
      
      // Format the date in local timezone
      const formatDate = (dateString: string) => {
        if (!dateString) return '';
        
        try {
          const date = new Date(dateString);
          return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(date);
        } catch (e) {
          console.error('Error formatting date:', e);
          return dateString;
        }
      };
      
      // Map payment method to friendly name
      const getPaymentMethodName = (paymentId: string): string => {
        // Common payment method mappings
        const paymentMethods: Record<string, string> = {
          'cash': 'Cash',
          'card': 'Credit Card',
          'credit': 'Credit Card',
          'credit_card': 'Credit Card',
          'debit': 'Debit Card',
          'debit_card': 'Debit Card',
          'mobile': 'Mobile Payment',
          'check': 'Check',
          'gift': 'Gift Card',
          'store_credit': 'Store Credit'
        };
        
        if (!paymentId) return 'Cash';
        
        // If the backend already provided a display name, use it
        if (saleResponse.payment_method_name) return saleResponse.payment_method_name;
        if (saleResponse.payment_method_display) return saleResponse.payment_method_display;
        
        // Try to extract readable name from UUID if it contains known payment methods
        const lowerPaymentId = paymentId.toLowerCase();
        for (const [key, value] of Object.entries(paymentMethods)) {
          if (lowerPaymentId.includes(key)) {
            return value;
          }
        }
        
        // If no match found, just call it 'Cash' as default
        return 'Cash';
      };
      
      // Format dates and handle payment method
      const formattedDate = formatDate(saleResponse.created_at || saleResponse.createdAt);
      const paymentMethodName = getPaymentMethodName(saleResponse.payment_method || saleResponse.paymentMethod);
      
      // Process formatted date and payment method
      
      // Parse numerical values
      const subtotal = parseFloat(saleResponse.subtotal) || 0;
      const tax = parseFloat(saleResponse.tax) || 0;
      const total = parseFloat(saleResponse.total) || 0;
      
      // Get discount from discount_amount field
      let discount = parseFloat(saleResponse.discount_amount || 0);
      // If the API doesn't provide a discount, attempt to calculate one from subtotal + tax - total
      if (!discount && subtotal !== undefined && total !== undefined) {
        discount = Math.round((subtotal + (tax || 0) - total) * 100) / 100;
      }
      
      const transactionDetail: TransactionDetail = {
        id: saleResponse.id,
        date: saleResponse.created_at || saleResponse.createdAt,
        // Use our newly formatted date
        local_date: formattedDate,
        localDate: formattedDate,
        customer: saleResponse.customer_name || saleResponse.customerName || 'Guest',
        customerId: saleResponse.customer_id || saleResponse.customerId,
        cashier: saleResponse.cashier_name || saleResponse.cashierName || 'Unknown',
        subtotal: subtotal,
        tax: tax,
        discount: discount,
        total: total,
        status: saleResponse.status || 'completed',
        // Use our mapped payment method name
        paymentMethod: paymentMethodName,
        payment_method_display: paymentMethodName,
        storeId: saleResponse.store_id || saleResponse.storeId,
        items: items
      };

      return { status: 'success', data: transactionDetail };
    }
    
    throw new Error('Could not fetch complete transaction details');
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const getSalesChartData = async (
  filters?: ReportFilter
): Promise<ApiResponse<SalesChartDataPoint[]>> => {
  // Fetch sales chart data
  
  // Construct query parameters from filters
  const queryParams = new URLSearchParams();
  if (filters?.startDate) queryParams.append('startDate', filters.startDate);
  if (filters?.endDate) queryParams.append('endDate', filters.endDate);
  if (filters?.storeId) queryParams.append('storeId', filters.storeId);

  try {
    // Call the real API endpoint
    const responseData = await fetchApi<SalesChartDataPoint[] | { data: SalesChartDataPoint[] }>(`/reports/sales/chart?${queryParams.toString()}`);
    
    // Handle different response structures
    if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray((responseData as any).data)) {
      return { status: 'success', data: (responseData as { data: SalesChartDataPoint[] }).data };
    }
    
    // If backend sends array directly
    if (Array.isArray(responseData)) {
      return { status: 'success', data: responseData as SalesChartDataPoint[] };
    }
    
    console.error('Unexpected data format for sales chart data:', responseData);
    return { status: 'error', error: 'Unexpected data format' };
  } catch (error) {
    console.error('Error fetching sales chart data:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Add more functions here for other reports (Inventory, Payments, etc.)
// e.g., export const getInventorySummary = async (...) => { ... };

/**
 * Fetches inventory report items based on provided filters.
 * @param filters - Optional filters for the inventory data.
 * @returns A promise resolving to an ApiResponse containing an array of inventory report items.
 */
export const getInventoryReportItems = async (
  filters?: ReportFilter
): Promise<ApiResponse<InventoryReportItem[]>> => {
  // Fetch inventory report items
  
  // Construct query parameters from filters
  const queryParams = new URLSearchParams();
  if (filters?.categoryId) queryParams.append('categoryId', filters.categoryId);
  if (filters?.supplierId) queryParams.append('supplierId', filters.supplierId);
  if (filters?.lowStock) queryParams.append('lowStock', String(filters.lowStock));
  if (filters?.outOfStock) queryParams.append('outOfStock', String(filters.outOfStock));
  if (filters?.storeId) queryParams.append('storeId', filters.storeId);

  try {
    // Call the real API endpoint
    const responseData = await fetchApi<InventoryReportItem[] | { data: InventoryReportItem[] }>(`/reports/inventory/items?${queryParams.toString()}`);
    
    // Handle different response structures
    if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray((responseData as any).data)) {
      return { status: 'success', data: (responseData as { data: InventoryReportItem[] }).data };
    }
    
    // If backend sends array directly
    if (Array.isArray(responseData)) {
      return { status: 'success', data: responseData as InventoryReportItem[] };
    }
    
    console.error('Unexpected data format for inventory report items:', responseData);
    return { status: 'error', error: 'Unexpected data format' };
  } catch (error) {
    console.error('Error fetching inventory report items:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Fetches inventory summary metrics.
 * @param filters - Optional filters for the summary data.
 * @returns A promise resolving to an ApiResponse containing inventory summary metrics.
 */
export const getInventorySummaryMetrics = async (
  filters?: ReportFilter
): Promise<ApiResponse<InventorySummaryMetrics>> => {
  // Fetch inventory summary metrics
  
  // Construct query parameters from filters
  const queryParams = new URLSearchParams();
  if (filters?.storeId) queryParams.append('storeId', filters.storeId);

  try {
    // Call the real API endpoint
    const responseData = await fetchApi<InventorySummaryMetrics | { data: InventorySummaryMetrics }>(`/reports/inventory/summary?${queryParams.toString()}`);
    
    // Handle different response structures
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      return { status: 'success', data: (responseData as { data: InventorySummaryMetrics }).data };
    }
    
    // If backend sends the object directly
    if (responseData && typeof responseData === 'object' && !('data' in responseData)) {
      return { status: 'success', data: responseData as InventorySummaryMetrics };
    }
    
    console.error('Unexpected data format for inventory summary metrics:', responseData);
    return { status: 'error', error: 'Unexpected data format' };
  } catch (error) {
    console.error('Error fetching inventory summary metrics:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Fetches payment report items from the API
 * @param filters - Optional filters for the payment data (e.g., dateRange, storeId, paymentMethod)
 * @returns A promise resolving to an ApiResponse containing an array of payment report items
 */
export const getPaymentReportItems = async (
  filters?: ReportFilter
): Promise<ApiResponse<PaymentReportItem[]>> => {
  try {
    // Fetch payment report items
    const queryParams = new URLSearchParams();
    
    // Add all required filters
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.storeId) queryParams.append('storeId', filters.storeId);
    
    // Call the real API endpoint
    const url = `/reports/payments/items?${queryParams.toString()}`;
    const responseData = await fetchApi<PaymentReportItem[] | { data: PaymentReportItem[] }>(url);
    
    // Handle different response formats (direct array or object with data field)
    if (responseData && typeof responseData === 'object') {
      if (Array.isArray(responseData)) {
        return { status: 'success', data: responseData };
      } else if ('data' in responseData && Array.isArray((responseData as any).data)) {
        return { status: 'success', data: (responseData as { data: PaymentReportItem[] }).data };
      }
    }
    
    console.error('Unexpected data format for payment report items:', responseData);
    return { status: 'error', error: 'Unexpected data format' };
  } catch (error) {
    console.error('Error fetching payment report items:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Fetches payment summary metrics from the API
 * @param filters - Optional filters for the payment summary data
 * @returns A promise resolving to an ApiResponse containing payment summary metrics
 */
export const getPaymentSummaryMetrics = async (
  filters?: ReportFilter
): Promise<ApiResponse<PaymentSummaryMetrics>> => {
  try {
    // Fetch payment summary metrics
    const queryParams = new URLSearchParams();
    
    // Add all required filters
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.storeId) queryParams.append('storeId', filters.storeId);
    
    // Call the real API endpoint
    const url = `/reports/payments/summary?${queryParams.toString()}`;
    const responseData = await fetchApi<PaymentSummaryMetrics | { data: PaymentSummaryMetrics }>(url);
    
    // Handle different response formats (direct object or object with data field)
    if (responseData && typeof responseData === 'object') {
      if ('totalRevenue' in responseData) {
        return { status: 'success', data: responseData as PaymentSummaryMetrics };
      } else if ('data' in responseData && typeof responseData.data === 'object') {
        return { status: 'success', data: (responseData as { data: PaymentSummaryMetrics }).data };
      }
    }
    
    console.error('Unexpected data format for payment summary metrics:', responseData);
    return { status: 'error', error: 'Unexpected data format' };
  } catch (error) {
    console.error('Error fetching payment summary metrics:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const getCustomerValueReport = async (
  filters?: ReportFilter
): Promise<ApiResponse<CustomerValueReportItem[]>> => {
  // Fetch customer value report
  const queryParams = new URLSearchParams();
  if (filters?.startDate) queryParams.append('startDate', filters.startDate);
  if (filters?.endDate) queryParams.append('endDate', filters.endDate);
  // Add other filters like storeId if applicable and passed
  // if (filters?.storeId) queryParams.append('storeId', filters.storeId);

  // The fetchApi function will handle the { status: 'success', data: ... } wrapper if the backend sends it.
  // If the backend sends the array directly, fetchApi should also handle that.
  // Assuming the backend endpoint returns data directly or wrapped in a 'data' field.
  const responseData = await fetchApi<CustomerValueReportItem[] | { data: CustomerValueReportItem[] }>(`/reports/customer-value?${queryParams.toString()}`);
  
  // Check if responseData is wrapped and extract data if necessary
  if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray((responseData as any).data)) {
    return { status: 'success', data: (responseData as { data: CustomerValueReportItem[] }).data };
  }
  // If backend sends array directly and fetchApi returns it as T
  if (Array.isArray(responseData)) {
    return { status: 'success', data: responseData as CustomerValueReportItem[] };
  }
  // Fallback or error handling if data is not in expected format
  console.error('Unexpected data format for customer value report:', responseData);
  return { status: 'error', error: 'Unexpected data format' };
};

export const getCustomerValueSummaryMetrics = async (
  filters?: ReportFilter
): Promise<ApiResponse<CustomerValueSummaryMetrics>> => {
  // Fetch customer value summary metrics
  const queryParams = new URLSearchParams();
  if (filters?.startDate) queryParams.append('startDate', filters.startDate);
  if (filters?.endDate) queryParams.append('endDate', filters.endDate);
  // if (filters?.storeId) queryParams.append('storeId', filters.storeId);

  // Assuming the backend endpoint returns data directly or wrapped in a 'data' field.
  const responseData = await fetchApi<CustomerValueSummaryMetrics | { data: CustomerValueSummaryMetrics }>(`/reports/customer-value/summary?${queryParams.toString()}`);

  // Check if responseData is wrapped and extract data if necessary
  if (responseData && typeof responseData === 'object' && 'data' in responseData && typeof (responseData as any).data === 'object') {
    return { status: 'success', data: (responseData as { data: CustomerValueSummaryMetrics }).data };
  }
  // If backend sends the object directly
  if (responseData && typeof responseData === 'object' && !('data' in responseData)) {
     return { status: 'success', data: responseData as CustomerValueSummaryMetrics };
  }
  
  console.error('Unexpected data format for customer value summary metrics:', responseData);
  return { status: 'error', error: 'Unexpected data format' };
};

// Charge Account Report Service Functions
export const getChargeAccountReport = async (
  filters?: ReportFilter
): Promise<ApiResponse<ChargeAccountReportItem[]>> => {
  // Fetch charge account report
  const queryParams = new URLSearchParams();
  if (filters?.startDate) queryParams.append('startDate', filters.startDate);
  if (filters?.endDate) queryParams.append('endDate', filters.endDate);
  if (filters?.accountStatus) queryParams.append('accountStatus', filters.accountStatus);
  // if (filters?.storeId) queryParams.append('storeId', filters.storeId);

  const responseData = await fetchApi<ChargeAccountReportItem[] | { data: ChargeAccountReportItem[] }>(`/reports/charge-account?${queryParams.toString()}`);

  if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray((responseData as any).data)) {
    return { status: 'success', data: (responseData as { data: ChargeAccountReportItem[] }).data };
  }
  if (Array.isArray(responseData)) {
    return { status: 'success', data: responseData as ChargeAccountReportItem[] };
  }
  console.error('Unexpected data format for charge account report:', responseData);
  return { status: 'error', error: 'Unexpected data format' };
};

export const getChargeAccountSummaryMetrics = async (
  filters?: ReportFilter
): Promise<ApiResponse<ChargeAccountSummaryMetrics>> => {
  // Fetch charge account summary metrics
  const queryParams = new URLSearchParams();
  if (filters?.startDate) queryParams.append('startDate', filters.startDate);
  if (filters?.endDate) queryParams.append('endDate', filters.endDate);
  // if (filters?.storeId) queryParams.append('storeId', filters.storeId);

  const responseData = await fetchApi<ChargeAccountSummaryMetrics | { data: ChargeAccountSummaryMetrics }>(`/reports/charge-account/summary?${queryParams.toString()}`);

  if (responseData && typeof responseData === 'object' && 'data' in responseData && typeof (responseData as any).data === 'object') {
    return { status: 'success', data: (responseData as { data: ChargeAccountSummaryMetrics }).data };
  }
  if (responseData && typeof responseData === 'object' && !('data' in responseData)) {
    return { status: 'success', data: responseData as ChargeAccountSummaryMetrics };
  }
  console.error('Unexpected data format for charge account summary metrics:', responseData);
  return { status: 'error', error: 'Unexpected data format' };
};
