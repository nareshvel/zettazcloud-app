import React from 'react';
import { BarChart3 } from 'lucide-react';
import { TopSellingProduct } from '@/types';
import { formatCurrency } from '../../utils/format';

interface TopSellingProductsProps {
  products: TopSellingProduct[];
}

const TopSellingProducts = ({ products }: TopSellingProductsProps) => {
  const maxRevenue = Math.max(...products.map(product => product.revenue));
  
  return (
    <div className="bg-white dark:bg-card rounded-lg shadow-sm p-6 border border-gray-100 dark:border-border">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-800 dark:text-foreground">Top Selling Products</h3>
        <BarChart3 className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
      </div>
      
      <div className="space-y-4">
        {products.map((product) => {
          const percentage = (product.revenue / maxRevenue) * 100;
          
          return (
            <div key={product.id}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-800 dark:text-foreground">{product.name}</span>
                <span className="text-sm text-gray-600 dark:text-muted-foreground">{formatCurrency(product.revenue)}</span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-muted rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                {product.quantity} units sold
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopSellingProducts;