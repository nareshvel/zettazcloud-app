import { useState } from 'react';
import {
  Edit, 
  Trash2, 
  // Search, // Now handled by UniversalListControls
  // PlusCircle, // Icon now handled by UniversalListControls
  ArrowDownUp, 
  // Filter, // Now handled by UniversalListControls
  ChevronLeft, 
  ChevronRight,
  // Upload // Now handled by UniversalListControls
} from 'lucide-react';
import UniversalListControls from '../UniversalListControls'; // Corrected Import Path
import { Product, Category } from '@/types';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { normalizeImageUrl } from '@/utils/imageUtils';

interface ProductsListProps {
  products: Product[];
  categories: Category[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAddNew: () => void;
  onImportClick?: () => void; // Renamed to match UniversalListControls
  entityType?: string; // To pass to UniversalListControls
}

type SortField = 'name' | 'price' | 'costPrice' | 'stockQuantity' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const ProductsList = ({ 
  products, 
  categories, 
  onEdit, 
  onDelete, 
  onAddNew,
  onImportClick, 
  entityType
}: ProductsListProps) => {
  const { formatCurrency, formatNumber } = useLocaleFormat();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter products by search term and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (product.barcode || '').includes(searchTerm);
    
    const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'price':
        comparison = a.price - b.price;
        break;
      case 'costPrice':
        comparison = (a.costPrice || 0) - (b.costPrice || 0);
        break;
      case 'stockQuantity':
        comparison = a.stockQuantity - b.stockQuantity;
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  

  return (
    <div className="bg-white dark:bg-card rounded-lg shadow-sm border border-gray-100 dark:border-border">
      {/* Header with search and filters */}
      <div className="p-4 border-b border-gray-200 dark:border-border">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <UniversalListControls
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            placeholderText="Search by name, SKU, or barcode..."
            newButtonText="Add Product"
            onNewButtonClick={onAddNew}
            showNewButton={true}
            onImportClick={onImportClick} // Pass down from Products.tsx
            showImportButton={!!onImportClick} // Show if handler is provided
            entityType={entityType} // Pass down from Products.tsx
            // For now, filter button is not connected to category filter
            // We can add a specific category filter dropdown next to UniversalListControls
            // or enhance UniversalListControls later.
            showFilterButton={false} // Hiding generic filter button for now
            showExportButton={false} // Assuming no export functionality for products yet
          />
          {/* Category Filter - kept separate for now */}
          <div className="flex-shrink-0">
            <select
              className="px-3 py-2.5 border border-gray-300 dark:border-border rounded-lg focus:ring-ring focus:border-blue-500 bg-white dark:bg-card shadow-sm sm:text-sm"
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
      </div>
      
      {/* Products table */}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 dark:bg-muted/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                Product
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase cursor-pointer"
                onClick={() => toggleSort('price')}
              >
                <div className="flex items-center gap-1">
                  Price
                  <ArrowDownUp size={14} />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase cursor-pointer"
                onClick={() => toggleSort('costPrice')}
              >
                <div className="flex items-center gap-1">
                  Cost Price
                  <ArrowDownUp size={14} />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                Category
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase cursor-pointer"
                onClick={() => toggleSort('stockQuantity')}
              >
                <div className="flex items-center gap-1">
                  Stock
                  <ArrowDownUp size={14} />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-card divide-y divide-gray-200">
            {paginatedProducts.length > 0 ? (
              paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {/* Image Container with debug styles */}
                      <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-yellow-200 mr-3 border-2 border-red-500 flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={normalizeImageUrl(product.imageUrl) || ''}
                            alt={product.name}
                            className="h-full w-full object-cover" // Ensure image fills container
                          />
                        ) : (
                          // Placeholder div with debug styles
                          <div className="h-full w-full flex items-center justify-center bg-pink-200">
                            <span className="text-xs font-bold text-red-700">NO IMG</span>
                          </div>
                        )}
                      </div>
                      {/* Text Container */}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-foreground">{product.name}</div>
                        {product.sku && <div className="text-xs text-gray-500 dark:text-muted-foreground">SKU: {product.sku}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-foreground">{formatCurrency(product.price)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-muted-foreground">
                    {formatCurrency(product.costPrice || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs px-2 py-1 font-semibold leading-tight rounded-full bg-gray-100 dark:bg-muted text-gray-700 dark:text-foreground">
                      {product.categoryName || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-foreground">{formatNumber(product.stockQuantity ?? 0)}</div>
                    {product.lowStockThreshold && (product.stockQuantity ?? 0) <= product.lowStockThreshold && (
                      <div className="text-xs text-red-500">Low Stock</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      product.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 dark:bg-muted text-gray-800'
                    }`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onEdit(product)}
                      className="text-primary hover:text-blue-900 mr-3"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(product)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-muted-foreground">
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-border sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-foreground">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, sortedProducts.length)}
                </span>{' '}
                of <span className="font-medium">{sortedProducts.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-border bg-white dark:bg-card text-sm font-medium ${
                    currentPage === 1 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-500 dark:text-muted-foreground hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                {/* Page numbers */}
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      currentPage === i + 1
                        ? 'z-10 bg-blue-50 border-blue-500 text-primary'
                        : 'bg-white dark:bg-card border-gray-300 dark:border-border text-gray-500 dark:text-muted-foreground hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-border bg-white dark:bg-card text-sm font-medium ${
                    currentPage === totalPages 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-500 dark:text-muted-foreground hover:bg-gray-50'
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsList;