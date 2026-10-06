import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Search, CheckSquare, Square, AlertCircle, Check, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCategories, updateProductTaxClass } from '@/services/api';
import { Category } from '@/types';
import { useTaxClassesData } from '@/hooks/useTaxClassesData';
import { useProductsData } from '@/hooks/useProductsData';

interface CategoryTaxClassManagerProps {
  onClose?: () => void;
}

const CategoryTaxClassManager: React.FC<CategoryTaxClassManagerProps> = ({ onClose }) => {
  const navigate = useNavigate();
  
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTaxClass, setSelectedTaxClass] = useState<string>('');
  
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [productsPerPage] = useState<number>(10);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  // Use our custom hooks for cached data fetching
  const { data: taxClassData, isLoading: taxLoading, error: taxError } = useTaxClassesData();
  const { data: productsData, isLoading: productsLoading, error: productsError, refresh: refreshProductsData } = useProductsData();
  
  // Derived state from hook data
  const taxClasses = taxClassData?.taxClasses || [];
  const taxRates = taxClassData?.taxRates || [];
  const products = productsData || [];
  const isLoading = taxLoading || productsLoading;
  
  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Fetch categories
        const categoriesData = await getCategories('all'); // Fetch all categories for tax management
        setCategories(categoriesData || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load categories');
      }
    };
    
    fetchCategories();
  }, []);
  
  // Set default tax class when tax classes data is loaded
  useEffect(() => {
    if (taxClasses.length > 0 && !selectedTaxClass) {
      // Find default tax class
      const defaultClass = taxClasses.find(tc => tc.isDefault || tc.is_default);
      if (defaultClass) {
        setSelectedTaxClass(defaultClass.id);
      } else if (taxClasses[0]) {
        // Fallback to first tax class
        setSelectedTaxClass(taxClasses[0].id);
      }
    }
  }, [taxClasses, selectedTaxClass]);
  
  // Show error messages from hooks
  useEffect(() => {
    if (taxError) {
      console.error('Error loading tax classes:', taxError);
      toast.error('Failed to load tax configuration');
    }
    
    if (productsError) {
      console.error('Error loading products:', productsError);
      toast.error('Failed to load products');
    }
  }, [taxError, productsError]);
  
  // Handle category change
  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(event.target.value);
    setSelectedProducts([]);
    setSelectAll(false);
  };
  
  // Handle tax class change
  const handleTaxClassChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTaxClass(event.target.value);
  };
  
  // Memoize filtered products for performance
  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    
    // Filter by category if selected
    if (selectedCategory) {
      filtered = filtered.filter(product => product.categoryId === selectedCategory);
    }
    
    // Filter by search term if provided
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchLower) || 
        (product.sku && product.sku.toLowerCase().includes(searchLower))
      );
    }
    
    return filtered;
  }, [products, selectedCategory, searchTerm]);

  // Handle side-effects of filter changes
  useEffect(() => {
    setIsSearching(searchTerm.trim() !== '');
    
    // Reset selection and pagination when filters change
    setSelectedProducts([]);
    setSelectAll(false);
    setCurrentPage(1);
  }, [selectedCategory, searchTerm]);
  
  // Handle product selection
  const handleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
  };
  
  // Handle select all products - only select products in the filtered category
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts([]);
    } else {
      // Only select products from the filtered products list
      setSelectedProducts(filteredProducts.map(product => product.id));
    }
    setSelectAll(!selectAll);
  };
  
  // No longer need inventory context since we use our custom hook

  // Handle save
  const handleSave = async () => {
    if (!selectedTaxClass || selectedProducts.length === 0) {
      toast.error('Please select tax class and at least one product');
      return;
    }
    
    setIsSaving(true);
    const total = selectedProducts.length;
    let success = 0;
    
    try {
      for (const productId of selectedProducts) {
        try {
          const taxClassIdToSend = selectedTaxClass === 'none' ? null : selectedTaxClass;
          await updateProductTaxClass(productId, taxClassIdToSend);
          success++;
        } catch (error) {
          console.error(`Failed to update product ${productId}:`, error);
          // Continue with next product
        }
      }
      
      setSuccessCount(success);
      setShowSuccessMessage(true);
      
      if (success > 0) {
        // Refresh product data using our hook's refresh function
        refreshProductsData();
      }
      
      // Show success/fail toast
      if (success === total) {
        toast.success(`Successfully updated ${success} products`);
      } else {
        toast.success(`Updated ${success} of ${total} products`);
      }
    } catch (error) {
      console.error('Error in bulk update:', error);
      toast.error('Failed to update some products');
    } finally {
      setIsSaving(false);
      setSelectedProducts([]);
      setSelectAll(false);
    }
  };
  
  // Handle back button
  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/products');
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <button 
          onClick={handleBack}
          className="mr-4 p-2 rounded-full hover:bg-gray-100 dark:bg-muted"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Manage Product Tax Classes</h1>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Selection Controls */}
          <div className="bg-white dark:bg-card p-6 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                  Filter by Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  className="w-full border border-gray-300 dark:border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                  Assign Tax Class
                </label>
                <select
                  value={selectedTaxClass}
                  onChange={handleTaxClassChange}
                  className="w-full border border-gray-300 dark:border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select Tax Class</option>
                  <option value="none">None (No Tax)</option>
                  {taxClasses && taxClasses.length > 0 ? (
                    taxClasses.map((taxClass) => (
                      <option key={taxClass.id} value={taxClass.id}>
                        {(() => {
                        const relevantRate = taxRates.find(r => r.taxClassId === taxClass.id); // Assuming one primary rate per class for simplicity
                        const rateDisplayValue = relevantRate ? relevantRate.rate : 0;
                        return `${taxClass.name}${rateDisplayValue > 0 ? ` (${(rateDisplayValue * 100).toFixed(2)}%)` : ''}`;
                      })()}
                      </option>
                    ))
                  ) : (
                    <option disabled>No tax classes available</option>
                  )}
                </select>
              </div>
            </div>
            
            {/* Search and Filter - 2 column with save button */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-gray-400 dark:text-muted-foreground" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products by name or SKU"
                  className="pl-10 w-full border border-gray-300 dark:border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedProducts.length === 0 || !selectedTaxClass}
                  className="bg-primary text-white px-4 py-2 rounded-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} className="mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Products Table */}
          <div className="bg-white dark:bg-card p-6 rounded-lg shadow overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="mr-2 h-5 w-5 rounded border-gray-300 dark:border-border text-primary focus:ring-ring"
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-medium text-gray-700 dark:text-foreground cursor-pointer">
                  Select All Products {selectedCategory ? 'in this Category' : ''}
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700 dark:text-foreground">
                  {selectedProducts.length} product(s) selected
                </span>
                {selectedProducts.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {selectedProducts.length}
                  </span>
                )}
              </div>
            </div>
            
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                {isSearching ? (
                  <div className="flex flex-col items-center">
                    <Search size={48} className="text-gray-400 dark:text-muted-foreground mb-2" />
                    <p className="text-gray-500 dark:text-muted-foreground">No products found matching "{searchTerm}"</p>
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="mt-2 text-primary hover:text-primary/80"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <AlertCircle size={48} className="text-gray-400 dark:text-muted-foreground mb-2" />
                    <p className="text-gray-500 dark:text-muted-foreground">No products found in this category</p>
                    {selectedCategory && (
                      <button 
                        onClick={() => setSelectedCategory('')}
                        className="mt-2 text-primary hover:text-primary/80"
                      >
                        View all products
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 dark:bg-muted/50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                        Select
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                        Product
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                        SKU
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                        Current Tax Class
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-card divide-y divide-gray-200">
                    {/* Calculate pagination */}
                    {filteredProducts
                      .slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage)
                      .map((product) => (
                      <tr key={product.id} className={selectedProducts.includes(product.id) ? 'bg-blue-50' : 'hover:bg-gray-50'} onClick={() => handleProductSelection(product.id)}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {selectedProducts.includes(product.id) ? (
                              <CheckSquare size={20} className="text-primary" />
                            ) : (
                              <Square size={20} className="text-gray-400 dark:text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {/* Display product image or fallback icon */}
                            <div className="h-10 w-10 rounded-md mr-3 bg-gray-200 dark:bg-muted flex items-center justify-center text-gray-500 dark:text-muted-foreground">
                              <ShoppingCart size={16} />
                            </div>
                            <div className="text-sm font-medium text-gray-900 dark:text-foreground">
                              {product.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-muted-foreground">
                          {product.sku || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.categoryName ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              {product.categoryName}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-muted-foreground">Uncategorized</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.taxClassName || 'None'}
                          {!product.taxClassName && (
                            <span className="text-yellow-600"> (No tax class)</span>
                          )}
                          {product.taxClassId && (
                            <span className="text-xs text-gray-500 dark:text-muted-foreground ml-1">
                              {(() => {
                                const matchingRate = taxRates.find(rate => rate.taxClassId === product.taxClassId);
                                return matchingRate ? `(${matchingRate.rate}%)` : '';
                              })()}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Pagination Controls */}
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-border px-4 py-3 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-border bg-white dark:bg-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-foreground hover:bg-gray-50 dark:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredProducts.length / productsPerPage)))}
                      disabled={currentPage >= Math.ceil(filteredProducts.length / productsPerPage)}
                      className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-border bg-white dark:bg-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-foreground hover:bg-gray-50 dark:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-foreground">
                        Showing <span className="font-medium">{Math.min((currentPage - 1) * productsPerPage + 1, filteredProducts.length)}</span> to{' '}
                        <span className="font-medium">{Math.min(currentPage * productsPerPage, filteredProducts.length)}</span> of{' '}
                        <span className="font-medium">{filteredProducts.length}</span> products
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 dark:text-muted-foreground ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-muted/50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Previous</span>
                          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        
                        {/* Page numbers */}
                        {Array.from({ length: Math.min(5, Math.ceil(filteredProducts.length / productsPerPage)) }, (_, i) => {
                          // Logic to show pages around current page
                          const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
                          let pageNum;
                          
                          if (totalPages <= 5) {
                            // If 5 or fewer pages, show all
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            // If near the start
                            pageNum = i + 1;
                            if (i === 4) pageNum = totalPages;
                          } else if (currentPage >= totalPages - 2) {
                            // If near the end
                            pageNum = totalPages - 4 + i;
                          } else {
                            // In the middle
                            pageNum = currentPage - 2 + i;
                          }
                          
                          // Add ellipsis
                          if ((i === 3 && pageNum !== 4 && totalPages > 5) || 
                              (i === 1 && pageNum !== 2 && currentPage > 3)) {
                            return (
                              <span key={`ellipsis-${i}`} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-foreground ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                                ...
                              </span>
                            );
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === pageNum ? 'bg-primary text-white' : 'text-gray-900 dark:text-foreground ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredProducts.length / productsPerPage)))}
                          disabled={currentPage >= Math.ceil(filteredProducts.length / productsPerPage)}
                          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 dark:text-muted-foreground ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-muted/50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Next</span>
                          <ArrowLeft className="h-5 w-5 rotate-180" aria-hidden="true" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Success Message */}
            {showSuccessMessage && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-start">
                <Check size={20} className="text-green-500 mr-2 mt-0.5" />
                <div>
                  <p className="text-green-800 font-medium">Tax classes updated successfully!</p>
                  <p className="text-green-700 text-sm">{successCount} product(s) were updated.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryTaxClassManager;
