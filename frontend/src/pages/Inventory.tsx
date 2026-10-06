import { useState } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import { useFormattingBridge } from '../utils/formatBridge';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { ArrowDown, ArrowUp, RefreshCw, Filter, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const Inventory = () => {
  const { products, categories, updateProductStock, refreshProducts, isLoading } = useInventory();
  const { formatCurrency } = useFormattingBridge();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [stockAdjustmentModalOpen, setStockAdjustmentModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter products by search term and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (product.barcode?.includes(searchTerm) ?? false);
    
    const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const handleStockAdjustment = (productId: string) => {
    setSelectedProduct(productId);
    setAdjustmentQuantity(0);
    setAdjustmentReason('');
    setStockAdjustmentModalOpen(true);
  };

  const submitStockAdjustment = async () => {
    if (!selectedProduct || adjustmentQuantity === 0) return;
    
    setIsProcessing(true);
    try {
      await updateProductStock(selectedProduct, adjustmentQuantity);
      toast.success(`Stock adjusted successfully`);
      setStockAdjustmentModalOpen(false);
    } catch (error) {
      toast.error('Failed to adjust stock');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-0 bg-gray-50 dark:bg-muted/50 min-h-screen">
      <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-foreground">Inventory Management</h1>
            
            <div className="mt-3 sm:mt-0">
              <button
                onClick={() => refreshProducts()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-border rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-50 dark:bg-muted/50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400 dark:text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search by name, SKU, or barcode..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-border rounded-lg focus:ring-ring focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex-shrink-0 flex items-center">
              <Filter size={18} className="text-gray-400 dark:text-muted-foreground mr-2" />
              <select
                className="px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-ring focus:border-blue-500"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Inventory Table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
                <span className="mt-2 text-gray-700 dark:text-foreground">Loading inventory data...</span>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-100 dark:border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 dark:bg-muted/50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                        Product
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                        Price
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                        Current Stock
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-card divide-y divide-gray-200">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50 dark:bg-muted/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-muted">
                                {product.imageUrl ? (
                                  <img
                                    src={normalizeImageUrl(product.imageUrl) || ''}
                                    alt={product.name}
                                    className="h-10 w-10 object-cover"
                                    onError={(e) => {
                                      const target = e.currentTarget as HTMLImageElement;
                                      target.onerror = null;
                                      target.src = '/images/placeholder-logo.png';
                                    }}
                                  />
                                ) : (
                                  <div className="h-10 w-10 flex items-center justify-center bg-gray-200 dark:bg-muted">
                                    <span className="text-xs text-gray-400 dark:text-muted-foreground">No img</span>
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-foreground">{product.name}</div>
                                <div className="text-xs text-gray-500 dark:text-muted-foreground">SKU: {product.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-foreground">{getCategoryName(product.categoryId)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-foreground">{formatCurrency(product.price)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              product.stockQuantity === 0 
                                ? 'bg-red-100 text-red-800' 
                                : product.stockQuantity < 10 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {product.stockQuantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleStockAdjustment(product.id)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-border text-xs font-medium rounded-md text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-50 dark:bg-muted/50"
                            >
                              Adjust Stock
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-muted-foreground">
                          No products found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      
      {/* Stock Adjustment Modal */}
      {stockAdjustmentModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-card rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground mb-4">Adjust Stock Quantity</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    Product
                  </label>
                  <div className="text-gray-900 dark:text-foreground">
                    {products.find(p => p.id === selectedProduct)?.name}
                  </div>
                </div>
                
                <div>
                  <label htmlFor="adjustmentQuantity" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    Adjustment Quantity
                  </label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setAdjustmentQuantity(prev => prev > 0 ? prev - 1 : prev)}
                      className="inline-flex items-center justify-center p-2 border border-gray-300 dark:border-border rounded-l-md bg-gray-50 dark:bg-muted/50 text-gray-500 dark:text-muted-foreground hover:bg-gray-100 dark:bg-muted"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <input
                      type="number"
                      id="adjustmentQuantity"
                      value={adjustmentQuantity}
                      onChange={(e) => setAdjustmentQuantity(parseInt(e.target.value) || 0)}
                      className="block w-full border-y border-gray-300 dark:border-border py-2 text-center focus:outline-none focus:ring-ring focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setAdjustmentQuantity(prev => prev + 1)}
                      className="inline-flex items-center justify-center p-2 border border-gray-300 dark:border-border rounded-r-md bg-gray-50 dark:bg-muted/50 text-gray-500 dark:text-muted-foreground hover:bg-gray-100 dark:bg-muted"
                    >
                      <ArrowUp size={16} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground">
                    Use positive values to add stock, negative values to remove stock.
                  </p>
                </div>
                
                <div>
                  <label htmlFor="adjustmentReason" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    Reason (optional)
                  </label>
                  <textarea
                    id="adjustmentReason"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    rows={3}
                    className="block w-full border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-ring focus:border-blue-500"
                    placeholder="Why are you adjusting the stock?"
                  ></textarea>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setStockAdjustmentModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-border rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-50 dark:bg-muted/50"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                
                <button
                  onClick={submitStockAdjustment}
                  disabled={isProcessing || adjustmentQuantity === 0}
                  className={`
                    px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white 
                    ${isProcessing || adjustmentQuantity === 0 ? 'bg-primary/60 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}
                  `}
                >
                  {isProcessing ? 'Updating...' : 'Update Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;