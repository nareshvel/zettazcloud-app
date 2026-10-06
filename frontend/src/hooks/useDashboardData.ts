/**
 * Custom hook for optimized dashboard data fetching with React Query
 * Replaces multiple sequential API calls with single batched request
 */

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export interface DashboardData {
  salesSummary: {
    totalSales: number;
    totalRevenue: string | number;
    avgOrderValue: string | number;
    uniqueCustomers: number;
  };
  salesChartData: Array<{
    date: string;
    revenue: number;
  }>;
  categorySalesData: Array<{
    id: string;
    category_name: string;
    sales_count: number;
    items_sold: string | number;
    revenue: string | number;
    avg_price: string | number;
  }>;
  inventoryMetrics: {
    totalProducts: number;
    lowStockItems: number;
    inventoryStatusData: Array<{
      name: string;
      value: number;
      color: string;
    }>;
  };
  recentTransactions: Array<{
    id: string;
    total: number;
    paymentMethod: string;
    createdAt: string;
  }>;
  paymentMethodsData: Array<any>;
  storeData: any;
  metadata: {
    generatedAt: string;
    dataRanges: {
      salesChart: { startDate: string; endDate: string };
      transactions: { startDate: string; endDate: string };
    };
  };
}

/**
 * Fetch all dashboard data in a single optimized API call
 */
const fetchDashboardData = async (): Promise<DashboardData> => {
  // Ensure we have an auth token before making the request
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token available');
  }

  const data = await fetchApi<DashboardData>('/dashboard', {
    method: 'GET',
  });

  return data;
};

/**
 * Hook for dashboard data with React Query caching and optimization
 */
export const useDashboardData = () => {
  const { isAuthenticated, user } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard-data'],
    queryFn: fetchDashboardData,
    enabled: isAuthenticated && !!user, // Only fetch when authenticated and user exists
    staleTime: 2 * 60 * 1000, // 2 minutes - data is fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: true, // Refetch when component mounts
    retry: 2, // Retry failed requests 2 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

/**
 * Hook for invalidating dashboard data cache
 */
export const useInvalidateDashboard = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
  };
};

// Import useQueryClient for cache invalidation
import { useQueryClient } from '@tanstack/react-query';
