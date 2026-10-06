// React import removed as it's not needed with modern JSX transform
import { AlertTriangle } from 'lucide-react';
import { Product } from '@/types';
import { normalizeImageUrl } from '@/utils/imageUtils';

interface LowStockProductsProps {
  products: Product[];
}

const LowStockProducts = ({ products }: LowStockProductsProps) => {
  // Sort by stock level (lowest first)
  const sortedProducts = [...products].sort((a, b) => a.stockQuantity - b.stockQuantity);

  return (
    <div className="bg-white dark:bg-card rounded-lg shadow-sm p-6 border border-gray-100 dark:border-border">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-800 dark:text-foreground">Low Stock Alert</h3>
        <AlertTriangle className="h-5 w-5 text-amber-500" />
      </div>
      
      {sortedProducts.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-500 dark:text-muted-foreground">
          <p>No low stock items</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedProducts.map((product) => (
            <div 
              key={product.id} 
              className="flex items-center justify-between border-b border-gray-100 dark:border-border pb-3 last:border-0 last:pb-0"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-100 dark:bg-muted rounded-md overflow-hidden mr-3">
                  {product.imageUrl ? (
                    <img 
                      src={normalizeImageUrl(product.imageUrl) || ''} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full w-full bg-gray-200 dark:bg-muted">
                      <span className="text-xs text-gray-400 dark:text-muted-foreground">No img</span>
                    </div>
                  )}
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-foreground">{product.name}</p>
                  <p className="text-xs text-gray-500 dark:text-muted-foreground">SKU: {product.sku}</p>
                </div>
              </div>
              
              <div>
                <span 
                  className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                    product.stockQuantity === 0 
                      ? 'bg-red-100 text-red-700' 
                      : product.stockQuantity < 5 
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {product.stockQuantity === 0 
                    ? 'Out of stock' 
                    : `${product.stockQuantity} left`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LowStockProducts;