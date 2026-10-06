import { 
  ArrowUpRight, 
  // ArrowDownRight removed as it's no longer used
  CreditCard, 
  DollarSign, 
  Smartphone, 
  Wallet
} from 'lucide-react';
import { SalesSummary as SalesSummaryType, PaymentSummary } from '@/types';
import { useCurrency } from '@/contexts/LocalizationContext';

interface SalesSummaryProps {
  salesData: SalesSummaryType;
  paymentData?: PaymentSummary;
}

const SalesSummary = ({ salesData, paymentData }: SalesSummaryProps) => {
  const { formatCurrency } = useCurrency();
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${paymentData ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-6`}>
      {/* Total Sales */}
      <div className="bg-white dark:bg-card rounded-lg shadow-sm p-6 border border-gray-100 dark:border-border">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-500 dark:text-muted-foreground font-medium">Total Sales</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-foreground mt-1">
              {formatCurrency(salesData.totalSales)}
            </h3>
          </div>
          <div className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center bg-green-100 text-green-800">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            {/* Period comparison is not in our consolidated type, using placeholder value */}
            5%
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-muted-foreground mt-4">vs. previous period</p>
      </div>

      {/* Transactions */}
      <div className="bg-white dark:bg-card rounded-lg shadow-sm p-6 border border-gray-100 dark:border-border">
        <p className="text-sm text-gray-500 dark:text-muted-foreground font-medium">Transactions</p>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-foreground mt-1">
          {salesData.transactionCount}
        </h3>
        <p className="text-sm text-gray-500 dark:text-muted-foreground mt-4">
          Avg. Order: {formatCurrency(salesData.averageTicketSize)}
        </p>
      </div>

      {/* Payment Methods - Conditionally rendered */}
      {paymentData && (
        <div className="bg-white dark:bg-card rounded-lg shadow-sm p-6 border border-gray-100 dark:border-border md:col-span-2">
          <p className="text-sm text-gray-500 dark:text-muted-foreground font-medium mb-4">Payment Methods</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">Cash</p>
                <p className="font-medium">{formatCurrency(paymentData.methods.find(m => m.method === 'cash')?.amount || 0)}</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">Card</p>
                <p className="font-medium">{formatCurrency(paymentData.methods.find(m => m.method === 'card')?.amount || 0)}</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                <Smartphone className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">Phone</p>
                <p className="font-medium">{formatCurrency(paymentData.methods.find(m => m.method === 'upi')?.amount || 0)}</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mr-3">
                <Wallet className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">Wallet</p>
                <p className="font-medium">{formatCurrency(paymentData.methods.find(m => m.method === 'wallet')?.amount || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesSummary;