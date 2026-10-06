import { useEffect, useState } from 'react';

interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}
import SalesSummary from '../components/dashboard/SalesSummary';
import SalesChart from '../components/dashboard/SalesChart';
import LowStockProducts from '../components/dashboard/LowStockProducts';
import { SalesSummary as SalesSummaryType, DateSalesData } from '@/types';
import { getSalesSummary, getSalesChartData } from '../services/salesService';
import { useInventory } from '../contexts/InventoryContext';

const AdminDashboard = () => {
  const [salesSummary, setSalesSummary] = useState<SalesSummaryType | null>(null);
  const [chartData, setChartData] = useState<DateSalesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters] = useState<DateRangeFilter>({ startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1), endDate: new Date() });
  const { getLowStockProducts } = useInventory();

  useEffect(() => {
    const fetchDashboardData = async (currentFilters: DateRangeFilter) => {
      const formattedFilters = {
        startDate: currentFilters.startDate.toISOString().split('T')[0],
        endDate: currentFilters.endDate.toISOString().split('T')[0],
      };
      setIsLoading(true);
      try {
        const [sales, chart] = await Promise.all([
          getSalesSummary(),
          getSalesChartData(formattedFilters)
        ]);
        
        setSalesSummary(sales);
        setChartData(chart);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData(filters);
  }, []);

  if (isLoading || !salesSummary) { 
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
          <span className="mt-2 text-text-secondary">Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  const lowStockProducts = getLowStockProducts();

  return (
    <div className="p-6">
      {/* Page Header Section */}
      <div className="pb-4 mb-6 border-b border-border">
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
      </div>
      
      <SalesSummary salesData={salesSummary} />
      
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart data={chartData} title="Weekly Sales Performance" />
      </div>
      
      <div className="mt-8">
        <LowStockProducts products={lowStockProducts} />
      </div>
    </div>
  );
};

export default AdminDashboard;