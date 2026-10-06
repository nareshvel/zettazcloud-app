import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Tag, Search } from 'lucide-react';
import { Product, Category } from '@/types/index';
import { PromotionalOffer } from '@/types/discount';
import { getProducts, updateProduct } from '@/services/productService';
import { getCategories } from '@/services/inventoryService';
// Dynamic import for discountService
import { useCurrency } from '@/contexts/LocalizationContext';
import { useStore } from '../contexts/StoreContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';

const ApplyPromotionalOffersPage: React.FC = () => {
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { store } = useStore();
  
  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [products, setProducts] = useState<Product[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<PromotionalOffer[]>([]);
  
  // Selection states
  const [selectedOffer, setSelectedOffer] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [selectAll, setSelectAll] = useState<boolean>(false);
  
  // UI states
  const [saving, setSaving] = useState<boolean>(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Function to refresh products data
  const refreshProducts = async () => {
    try {
      const productsData = await getProducts();

      setProducts(productsData);
    } catch (error) {
      console.error('Error refreshing products:', error);
      toast.error('Failed to refresh products data.');
    }
  };





  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { getActiveOffers } = await import('@/services/discountService');
        const [productsData, categoriesData, offersData] = await Promise.all([
          getProducts(),
          getCategories('active'), // Fetch only active categories for promotional offers
          getActiveOffers()
        ]);



        setProducts(productsData);
        setCategories(categoriesData);
        setOffers(offersData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Memoize filtered products for performance
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesCategory = !filterCategory || product.categoryId === filterCategory;
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesCategory && matchesSearch;
    });
  }, [products, filterCategory, searchTerm]);

  // Only show active offers within the valid date window in the dropdown
  const dropdownOffers = useMemo(() => {
    const now = new Date();
    return (offers || []).filter((offer) => {
      if (!offer) return false;
      // must be flagged active
      if (!offer.isActive) return false;
      // start date check (if provided)
      if (offer.startDate) {
        const start = new Date(offer.startDate);
        if (!isNaN(start.getTime()) && now < start) return false;
      }
      // end date check (if provided)
      if (offer.endDate) {
        const end = new Date(offer.endDate);
        if (!isNaN(end.getTime()) && now > end) return false;
      }
      return true;
    });
  }, [offers]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, searchTerm]);

  // Handle toggling select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
    setSelectAll(!selectAll);
  };

  // Effect to update selectAll checkbox if all items are manually selected
  useEffect(() => {
    if (filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedProducts, filteredProducts]);

  // Run async tasks with a maximum concurrency
  async function runInBatches<T>(tasks: Array<() => Promise<T>>, concurrency = 5): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency).map((fn) => fn());
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
    return results;
  }

  const handleApplyOffer = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    if (!selectedOffer) {
      toast.error('Please select an offer to apply');
      return;
    }

    setSaving(true);
    
    try {
      // Prepare tasks to update each selected product with the promotional offer
      const tasks = selectedProducts.map((productId) => {
        return () => {
          const product = products.find(p => p.id === productId);
          if (!product) return Promise.resolve(undefined);
          
          // Create FormData for the product update
          const formData = new FormData();
          formData.append('promotionalOfferId', selectedOffer === 'none' ? '' : selectedOffer);
          
          // Call updateProduct with productId and formData
          return updateProduct(productId, formData);
        };
      });
      
      // Run with limited concurrency (max 5 at a time)
      await runInBatches(tasks, 5);
      
      toast.success(`Successfully applied offer to ${selectedProducts.length} products`);
      
      // Refresh product list with the latest data
      await refreshProducts();
      
      // Dispatch global events so other parts of the app can refresh their caches
      try {
        // Notify listeners (e.g., CartContext via usePromotionalOffersData) that offers may have changed relevance
        window.dispatchEvent(new Event('promotional_offers_updated'));
        // Also let POS/product caches know products were updated (for promotionalOfferId visibility)
        window.dispatchEvent(new Event('products_updated'));
      } catch (e) {
        console.error('Error dispatching global refresh events', e);
      }
      
      // Clear selections
      setSelectedProducts([]);
      setSelectAll(false);
    } catch (error) {
      console.error('Error applying offer:', error);
      toast.error('Failed to apply offer. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Check if any selected products have offers applied
  const hasSelectedProductsWithOffers = () => {
    return selectedProducts.some(productId => {
      const product = products.find(p => p.id === productId);
      return product && product.promotionalOfferId;
    });
  };

  // Handle removing offer from products
  const handleRemoveOffer = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    if (!hasSelectedProductsWithOffers()) {
      toast('None of the selected products have offers to remove');
      return;
    }

    setSaving(true);
    
    try {
      // Prepare tasks to remove promotional offer from each applicable product
      const tasks = selectedProducts.map((productId) => {
        return () => {
          const product = products.find(p => p.id === productId);
          if (!product || !product.promotionalOfferId) return Promise.resolve(undefined);
          
          // Create FormData for removing the promotional offer
          const formData = new FormData();
          formData.append('promotionalOfferId', ''); // Empty string to remove the offer
          
          return updateProduct(productId, formData);
        };
      });
      
      const results = await runInBatches(tasks, 5);
      const successCount = results.filter(result => result !== undefined).length;
      
      toast.success(`Successfully removed offers from ${successCount} products`);
      
      // Refresh product list with the latest data
      await refreshProducts();
      
      // Dispatch global events so other parts of the app can refresh their caches
      try {
        window.dispatchEvent(new Event('promotional_offers_updated'));
        window.dispatchEvent(new Event('products_updated'));
      } catch (e) {
        console.error('Error dispatching global refresh events', e);
      }
      
      // Clear selections
      setSelectedProducts([]);
      setSelectAll(false);
    } catch (error) {
      console.error('Error removing offers:', error);
      toast.error('Failed to remove offers. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Toggle individual product selection
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };
  
  // Define table columns
  const columns: ColumnDefinition<Product>[] = [
    {
      accessor: 'selection',
      Header: (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={handleSelectAll}
            className="rounded border-gray-300 dark:border-border text-primary focus:ring-primary"
          />
        </div>
      ),
      Cell: (item: Product) => (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={selectedProducts.includes(item.id)}
            onChange={() => toggleProductSelection(item.id)}
            className="rounded border-gray-300 dark:border-border text-primary focus:ring-primary"
          />
        </div>
      ),
    },
    {
      accessor: 'name',
      Header: 'Product Name',
      Cell: (item: Product) => (
        <div className="flex flex-col">
          <span className="font-medium">{item.name}</span>
          <span className="text-xs text-text-secondary">{item.sku}</span>
        </div>
      ),
    },
    {
      accessor: 'category',
      Header: 'Category',
      Cell: (item: Product) => {
        const category = categories.find(c => c.id === item.categoryId);
        return <span>{category?.name || 'Uncategorized'}</span>;
      },
    },
    {
      accessor: 'price',
      Header: 'Price',
      Cell: (item: Product) => (
        <span>{formatCurrency(item.price)}</span>
      ),
    },
    {
      accessor: 'currentOffer',
      Header: 'Current Offer',
      Cell: (item: Product) => {
        const offer = offers.find(o => o.id === item.promotionalOfferId);
        return (
          <div className="flex items-center">
            {item.promotionalOfferId ? (
              <>
                <Tag size={16} className="text-green-600 mr-2" />
                <span className="text-green-600">
                  {offer?.name || 'Unknown Offer'}
                </span>
              </>
            ) : (
              <span className="text-text-secondary">No offer applied</span>
            )}
          </div>
        );
      },
    },
    {
      accessor: 'offerPeriod',
      Header: 'Offer Period',
      Cell: (item: Product) => {
        const offer = offers.find(o => o.id === item.promotionalOfferId);
        if (!offer) return <span className="text-text-secondary">-</span>;
        
        const formatDate = (dateStr?: string) => {
          if (!dateStr) return '';
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'N/A';
            
            // Convert store.dateFormat (e.g., 'MM/DD/YYYY') to date-fns format (e.g., 'MM/dd/yyyy')
            const dateFormat = (store?.dateFormat?.replace('YYYY', 'yyyy')?.replace('DD', 'dd')) ?? 'MM/dd/yyyy';
            return format(date, dateFormat);
          } catch (e) {
            console.error('Error formatting date:', e);
            return 'N/A';
          }
        };
        
        const startDate = formatDate(offer.startDate);
        const endDate = offer.endDate ? formatDate(offer.endDate) : 'Ongoing';
        
        return (
          <div className="flex flex-col">
            <span className="text-xs">From: {startDate}</span>
            <span className="text-xs">To: {endDate}</span>
          </div>
        );
      },
    },
  ];

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Handle page change
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Apply Promotional Offers</h1>
          <p className="text-text-secondary mt-1">Bulk apply promotional offers to products</p>
        </div>
        <button
          onClick={() => navigate('/promotions')}
          className="mt-4 md:mt-0 bg-background-card hover:bg-secondary-light border border-border text-text-secondary font-medium py-2 px-4 rounded-lg flex items-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-75"
        >
          <X size={18} className="mr-2" />
          Back to Offers
        </button>
      </div>

      {/* Filters */}
      <div className="bg-background-card border border-border rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-text-secondary mb-1">Search Products</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or SKU"
                className="pl-10 pr-4 py-2 border border-border rounded-lg w-full bg-background-main placeholder-text-placeholder focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm shadow-sm transition-colors duration-150 ease-in-out"
              />
              <Search size={18} className="absolute left-3 top-2.5 text-text-placeholder" />
            </div>
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-text-secondary mb-1">Filter by Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="py-2 px-3 border border-border rounded-lg w-full bg-background-main text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm shadow-sm transition-colors duration-150 ease-in-out"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-text-secondary mb-1">Select Offer to Apply</label>
            <select
              value={selectedOffer}
              onChange={(e) => setSelectedOffer(e.target.value)}
              className="py-2 px-3 border border-border rounded-lg w-full bg-background-main text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm shadow-sm transition-colors duration-150 ease-in-out"
              disabled={saving}
            >
              <option value="">Select an offer...</option>
              <option value="none">Remove Offer</option>
              {dropdownOffers.map((offer) => {
                // Direct approach with hardcoded formatting
                let displayText = offer.name;
                
                // Add discount info if available
                if (offer.offerType === 'percentage_discount' && typeof offer.discountValue === 'number') {
                  displayText += ` (${offer.discountValue}% off)`;
                } else if (offer.offerType === 'fixed_discount' && typeof offer.discountValue === 'number') {
                  displayText += ` (${formatCurrency(offer.discountValue)} off)`;
                }
                
                // Add date range if available
                if (offer.startDate || offer.endDate) {
                  // Format dates according to store settings
                  const formatDate = (dateString: string | null | undefined) => {
                    if (!dateString) return '';
                    try {
                      const date = new Date(dateString);
                      // Convert store.dateFormat (e.g., 'MM/DD/YYYY') to date-fns format (e.g., 'MM/dd/yyyy')
                      const dateFormat = (store?.dateFormat?.replace('YYYY', 'yyyy')?.replace('DD', 'dd')) ?? 'MM/dd/yyyy';
                      return format(date, dateFormat);
                    } catch (e) {
                      console.error('Error formatting date:', e);
                      return dateString;
                    }
                  };
                  
                  const startDate = offer.startDate ? formatDate(offer.startDate) : '';
                  const endDate = offer.endDate ? formatDate(offer.endDate) : 'Ongoing';
                  displayText += ` - ${startDate || 'Start'} to ${endDate}`;
                }
                
                return (
                  <option key={offer.id} value={offer.id}>
                    {displayText}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button
          onClick={handleApplyOffer}
          disabled={selectedProducts.length === 0 || saving}
          className={`bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-6 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-dark focus:ring-opacity-75 ${(selectedProducts.length === 0 || saving) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saving ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            <>
              <Tag size={18} className="mr-2" />
              Apply to {selectedProducts.length} Selected
            </>
          )}
        </button>
        <button
          onClick={handleRemoveOffer}
          disabled={selectedProducts.length === 0 || saving || !hasSelectedProductsWithOffers()}
          className={`bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-6 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 ${(selectedProducts.length === 0 || saving || !hasSelectedProductsWithOffers()) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <X size={18} className="mr-2" />
          Remove Offers
        </button>
      </div>

      {/* Selection Summary */}
      <div className="mb-4 text-text-secondary">
        <span>{selectedProducts.length} of {filteredProducts.length} products selected</span>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-background-card border border-border rounded-lg p-8 text-center">
          <p className="text-text-secondary">No products found matching your filters.</p>
        </div>
      ) : (
        <div className="bg-background-card border border-border rounded-lg overflow-hidden">
          <ReusableTable
            data={currentItems}
            columns={columns}
            isLoading={loading}
            noDataMessage="No products found"
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            itemsPerPage={itemsPerPage}
            totalItems={filteredProducts.length}
          />
        </div>
      )}
    </div>
  );
};

export default ApplyPromotionalOffersPage;
