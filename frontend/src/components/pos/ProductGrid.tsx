import { useState, useEffect, forwardRef } from 'react';
import { Search, Barcode, Plus } from 'lucide-react';
import { Product } from '@/types';
import { useInventory } from '../../contexts/InventoryContext';
import { useCart } from '../../contexts/CartContext';
import ProductCard from './ProductCard';

interface ProductGridProps {
  currencyCode?: string;
  searchTerm: string;
  onSearchTermChange: (newTerm: string) => void;
  onQuickAdd?: () => void;
}

const ProductGrid = forwardRef<HTMLInputElement, ProductGridProps>(
  ({ currencyCode, searchTerm, onSearchTermChange, onQuickAdd }, ref) => {
  const { products, categories, isLoading } = useInventory();
  const { addToCart } = useCart();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  useEffect(() => {
    // console.log('ProductGrid: Filtering products. All products from context:', products);
    // console.log('ProductGrid: Current categoryFilter:', categoryFilter, '(type:', typeof categoryFilter + ')');
    // console.log('ProductGrid: Current searchTerm:', searchTerm);

    let result = [...products];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(
        product => 
          product.name.toLowerCase().includes(searchLower) || 
          (product.barcode || '').includes(searchTerm) || 
          (product.sku || '').toLowerCase().includes(searchLower)
      );
      // console.log('ProductGrid: After search filter:', [...result]);
    }
    
    // Apply category filter
    if (categoryFilter && categoryFilter !== 'all') {
      result = result.filter(product => {
        // Optional: Detailed logging for a few items if needed during intense debugging
        // if (product.name.includes("Test Product")) { // Example condition
        //   console.log(`ProductGrid: Comparing product ${product.name} (ID: ${product.id}) categoryId ('${product.categoryId}', type: ${typeof product.categoryId}) with filter ('${categoryFilter}', type: ${typeof categoryFilter})`);
        // }
        return product.categoryId === categoryFilter;
      });
      // console.log('ProductGrid: After category filter:', [...result]);
    }
    
    // Only show active products
    result = result.filter(product => product.isActive);
    // console.log('ProductGrid: After isActive filter:', [...result]);
    
    setFilteredProducts(result);
  }, [products, searchTerm, categoryFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search and filters */}
      <div className="p-4 border-b dark:border-border">
        {/* Search + Quick Add row */}
        <div className="hidden md:flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400 dark:text-muted-foreground" />
            </div>
            <input
              ref={ref}
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-ring focus:border-blue-500 bg-white dark:bg-background text-gray-900 dark:text-foreground"
              placeholder="Search products by name or barcode..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
            />
          </div>
          {onQuickAdd && (
            <button
              onClick={onQuickAdd}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              title="Quick add custom item"
            >
              <Plus size={16} />
              Quick Add
            </button>
          )}
        </div>
        
        <div className="mt-4 flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
              categoryFilter === 'all' 
                ? 'bg-blue-100 text-primary' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryFilter(category.id)}
              className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap shadow-sm ${
                categoryFilter === category.id
                  ? 'bg-primary text-white ring-2 ring-blue-500 ring-offset-1'
                  : 'bg-white dark:bg-card text-gray-700 dark:text-foreground border border-gray-200 dark:border-border hover:bg-gray-50 dark:bg-muted/50 focus:ring-2 focus:ring-blue-300 focus:ring-offset-1'
              }`}
            >
              <Barcode size={20} className="mb-1" />
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Products grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5">
            {filteredProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onAddToCart={() => addToCart(product)} 
                currencyCode={currencyCode}
              />
            ))}
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-card rounded-xl border-2 border-dashed border-gray-200 dark:border-border">
            <svg className="w-12 h-12 text-gray-400 dark:text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-1">No products found</h3>
            <p className="text-gray-500 dark:text-muted-foreground max-w-md">
              Try adjusting your search or filter to find what you're looking for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
);

export default ProductGrid;