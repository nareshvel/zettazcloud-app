import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUpIcon, TrendingDownIcon, DollarSignIcon, PackageIcon, ShoppingCartIcon, RefreshCwIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Loader2 } from 'lucide-react';

// Import React Query hook
import { useDashboardData } from '@/hooks/useDashboardData';

// Import contexts
import { useCurrency } from '@/contexts/LocalizationContext';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Dashboard: React.FC = () => {
  const { formatCurrency } = useCurrency();
  const { data: dashboardData, isLoading, error, refetch } = useDashboardData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">Error loading dashboard data</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          <RefreshCwIcon className="h-4 w-4 inline mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>No dashboard data available</p>
      </div>
    );
  }

  const {
    salesSummary,
    salesChart,
    categorySales,
    products,
    transactions,
    store,
    metadata
  } = dashboardData;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 dark:text-muted-foreground">Welcome back! Here's what's happening with your store.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 flex items-center"
        >
          <RefreshCwIcon className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(salesSummary?.todayTotal || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {salesSummary?.todayChange && salesSummary.todayChange > 0 ? (
                <TrendingUpIcon className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDownIcon className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={salesSummary?.todayChange && salesSummary.todayChange > 0 ? 'text-green-500' : 'text-red-500'}>
                {salesSummary?.todayChange ? `${salesSummary.todayChange > 0 ? '+' : ''}${salesSummary.todayChange.toFixed(1)}%` : '0%'}
              </span>
              <span className="ml-1">from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(salesSummary?.weekTotal || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {salesSummary?.weekChange && salesSummary.weekChange > 0 ? (
                <TrendingUpIcon className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDownIcon className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={salesSummary?.weekChange && salesSummary.weekChange > 0 ? 'text-green-500' : 'text-red-500'}>
                {salesSummary?.weekChange ? `${salesSummary.weekChange > 0 ? '+' : ''}${salesSummary.weekChange.toFixed(1)}%` : '0%'}
              </span>
              <span className="ml-1">from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <PackageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {products?.filter(p => p.quantity <= p.lowStockThreshold).length || 0} low stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ShoppingCartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesSummary?.todayTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesChart?.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(value), 'Sales']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Sales Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categorySales || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total"
                >
                  {(categorySales || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [formatCurrency(value), 'Sales']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions && transactions.length > 0 ? (
              transactions.slice(0, 5).map((transaction: any) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">Transaction #{transaction.id}</p>
                      <p className="text-sm text-gray-500 dark:text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(transaction.total)}</p>
                    <Badge variant="secondary" className="text-xs">
                      {transaction.paymentMethod}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-muted-foreground text-center py-4">No recent transactions</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {products && products.filter(p => p.quantity <= p.lowStockThreshold).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Low Stock Alert</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {products
                .filter(p => p.quantity <= p.lowStockThreshold)
                .slice(0, 5)
                .map((product: any) => (
                  <div key={product.id} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="destructive">
                      {product.quantity} left
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      {metadata && (
        <div className="text-xs text-gray-500 dark:text-muted-foreground text-center">
          Data loaded at {new Date(metadata.timestamp).toLocaleString()} • 
          Query time: {metadata.queryTime}ms
        </div>
      )}
    </div>
  );
};

export default Dashboard;
