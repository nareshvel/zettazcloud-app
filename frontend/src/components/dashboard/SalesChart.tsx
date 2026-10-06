import { DateSalesData } from '@/types';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, TooltipProps } from 'recharts';

interface SalesChartProps {
  data: DateSalesData[];
  title: string;
}

const SalesChart = ({ data, title }: SalesChartProps) => {
  // Format the data for Recharts
  const chartData = data.map(item => ({
    date: item.date,
    formattedDate: formatDate(item.date),
    totalSales: item.totalSales || 0,
    transactions: item.transactions || 0
  }));

  // Calculate summary metrics
  const totalSales = chartData.reduce((sum, item) => sum + item.totalSales, 0);
  const totalTransactions = chartData.reduce((sum, item) => sum + item.transactions, 0);
  const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;
  const periodDays = chartData.length;
  
  // Helper to format currency values consistently
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };
  
  // Helper to format dates consistently
  function formatDate(dateStr: string) {
    try {
      return format(parseISO(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  }
  
  // Check if we have any data with sales
  const hasSalesData = chartData.some(item => item.totalSales > 0);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-card p-3 shadow-lg border rounded-md">
          <p className="font-medium">{formatDate(data.date)}</p>
          <p className="text-primary font-medium">{formatCurrency(data.totalSales)}</p>
          <p className="text-gray-600 dark:text-muted-foreground text-sm">
            {data.transactions} {data.transactions === 1 ? 'transaction' : 'transactions'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom empty state
  if (!hasSalesData) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-6 border border-border">
        <h3 className="text-lg font-medium text-card-foreground mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-muted-foreground text-center">
            <p>No sales data available for the selected period.</p>
            <p className="text-sm mt-2">Try selecting a different date range.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm p-6 border border-border">
      <h3 className="text-lg font-medium text-card-foreground mb-4">{title}</h3>
      
      {/* Chart section */}
      <div className="mb-6" style={{ height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="formattedDate" 
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tick={{ fontSize: 12, fill: '#6B7280' }} 
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value).split('.')[0]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="totalSales" 
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.totalSales > 0 ? '#3B82F6' : '#E5E7EB'}
                  stroke={entry.totalSales > 0 ? '#2563EB' : '#D1D5DB'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Summary section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-border pt-4">
        <div className="p-3 bg-card rounded-md border border-border/40">
          <div className="text-xs text-muted-foreground">Period</div>
          <div className="font-medium mt-1">{periodDays} days</div>
        </div>
        <div className="p-3 bg-card rounded-md border border-border/40">
          <div className="text-xs text-muted-foreground">Transactions</div>
          <div className="font-medium mt-1">{totalTransactions}</div>
        </div>
        <div className="p-3 bg-card rounded-md border border-border/40">
          <div className="text-xs text-muted-foreground">Total Sales</div>
          <div className="font-medium mt-1">{formatCurrency(totalSales)}</div>
        </div>
        <div className="p-3 bg-card rounded-md border border-border/40">
          <div className="text-xs text-muted-foreground">Avg. Ticket</div>
          <div className="font-medium mt-1">{formatCurrency(avgTicket)}</div>
        </div>
      </div>
    </div>
  );
};

export default SalesChart;