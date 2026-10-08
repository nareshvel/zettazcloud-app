import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import CategoryTaxClassManager from '@/components/tax/CategoryTaxClassManager'; 
import { Edit3, Package, AlertTriangle, XCircle, SlidersHorizontal, Trash2, Loader2 } from 'lucide-react'; 
import ProductFormModal from '@/components/inventory/ProductFormModal';
import ProductFilterModal, { ProductFilters } from '@/components/inventory/ProductFilterModal';
import StockAdjustmentModal from '@/components/modals/StockAdjustmentModal'; 
import ConfirmationModal from '@/components/modals/ConfirmationModal'; 
import ProductStockStatusModal from '@/components/modals/ProductStockStatusModal'; 
import { Product, Category } from '@/types'; 
import { getCategories } from '@/services/api'; 
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/services/productService'; 
import { toast } from 'react-toastify';
import UniversalListControls, { ExportFormat } from '@/components/UniversalListControls';
import ResponsiveTable, { ColumnDefinition } from '@/components/ResponsiveTable';
import PageHeader from '@/components/common/PageHeader';
import ExcelJS from 'exceljs';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Import default export
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import ProductImport from '@/components/inventory/ProductImport'; // Import ProductImport
import { normalizeImageUrl } from '@/utils/imageUtils';
// import SettingsTaxes from '@/components/settings/SettingsTaxes'; // Keep for reference if needed later

const ProductsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useDateFormatting();
  const [products, setProducts] = useState<Product[]>([]); 
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null); 
  const [isModalOpen, setIsModalOpen] = useState(false); // For ProductFormModal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // For ProductFormModal
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for StockAdjustmentModal
  const [isStockAdjustmentModalOpen, setIsStockAdjustmentModalOpen] = useState(false);
  const [productForAdjustment, setProductForAdjustment] = useState<Product | null>(null);

  // Filter state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ProductFilters>({
    categories: [],
    stockStatus: 'all',
    activeStatus: 'all',
    priceRange: {
      min: '',
      max: ''
    }
  });
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Or make this configurable

  const [categories, setCategories] = useState<Category[]>([]);
  // Image URLs will be normalized via utils; no direct backend URL usage here

  const storeCurrency = user?.store?.currencyCode;
  const userCurrency = user?.currencyCode;
  const effectiveCurrencyCode = storeCurrency || userCurrency || 'USD';

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // For delete loading state

  // State for ProductStockStatusModal
  const [isStockStatusModalOpen, setIsStockStatusModalOpen] = useState(false);
  const [stockStatusModalTitle, setStockStatusModalTitle] = useState('');
  const [stockStatusModalProducts, setStockStatusModalProducts] = useState<Product[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false); // State for import modal

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // getProducts() now returns Product[] directly or throws an error
      // getCategories() also returns Category[] directly
      const [fetchedProducts, fetchedCategories] = await Promise.all([
        getProducts(), 
        getCategories('active'), // Fetch only active categories for product dropdown
      ]);

      setProducts(fetchedProducts);

      if (fetchedCategories && Array.isArray(fetchedCategories)) {
        const processedCategories = fetchedCategories.map(cat => ({
          ...cat,
          isActive: cat.isActive === undefined ? true : cat.isActive, // Default to true if undefined
        }));
        setCategories(processedCategories);
      } else {
        console.error('Failed to fetch categories or no categories returned. Response:', fetchedCategories); 
        // setError(prevError => `${prevError ? prevError + ' ' : ''}Failed to fetch categories or no categories returned.`);
        // Consider if this should be a user-facing error or just a console log if categories are optional for basic product display
        setCategories([]); // Ensure categories is an empty array if fetch fails
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errorMsg); // Overwrite or append based on desired behavior, here overwriting for simplicity
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Added fetchData to dependency array

  // Handlers for ProductFormModal
  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  // Deep-link: open the create form when launched from the bottom-nav
  // quick actions (?new=1). The param is stripped so a refresh won't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
      handleAddProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleEditProduct = useCallback((product: Product) => { 
    setSelectedProduct(product);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => { 
    setIsModalOpen(false);
    setSelectedProduct(null);
  }, []);

  // Handlers for StockAdjustmentModal
  const handleOpenStockAdjustmentModal = useCallback((product: Product | null = null) => {
    setProductForAdjustment(product);
    setIsStockAdjustmentModalOpen(true);
  }, []);

  const handleCloseStockAdjustmentModal = useCallback(() => {
    setIsStockAdjustmentModalOpen(false);
    setProductForAdjustment(null);
  }, []);

  const handleStockAdjustmentSuccess = useCallback(async (adjustedProduct: Product) => {
    // Update the products list to reflect the new stock quantity
    // While local update is fast, fetchData ensures all data is fresh and filters re-apply.
    // setProducts(prevProducts => 
    //   prevProducts.map(p => 
    //     p.id === adjustedProduct.id ? { ...p, stockQuantity: adjustedProduct.stockQuantity } : p
    //   )
    // );
    toast.success(`Stock for ${adjustedProduct.name} adjusted successfully.`);
    await fetchData(); // Re-fetch all products to ensure table and filters are updated
    handleCloseStockAdjustmentModal(); 
  }, [fetchData, handleCloseStockAdjustmentModal]); // Added fetchData to dependencies

  const handleSaveProduct = useCallback(async (productData: Partial<Product>, imageFile: File | null, isNew: boolean) => {
    setIsLoading(true);
    try {
      const formData = new FormData();

      const fieldMappings: { [key: string]: string } = {
        categoryId: 'category_id',          // Modal sends 'categoryId', backend req.body needs 'category_id'
        stockQuantity: 'stock_quantity',    // Modal sends 'stockQuantity', backend req.body needs 'stock_quantity'
        costPrice: 'purchase_price',        // Modal sends 'costPrice', backend req.body needs 'purchase_price' (for cost_price SQL logic)
        lowStockThreshold: 'low_stock_threshold', // Modal sends 'lowStockThreshold', backend req.body needs 'low_stock_threshold'
        isActive: 'is_active',             // Modal sends 'isActive', backend req.body needs 'is_active'
        taxClassId: 'tax_class_id',         // Modal sends 'taxClassId', backend req.body needs 'tax_class_id'
        shareAcrossStores: 'share_across_stores' // Create-time-only tenant-wide sharing choice
      };

      // --- Explicitly handle dynamic attributes + cost-code pricing fields ---
      // (FormData is not auto snake_cased by the api client, so send backend keys directly.)
      const pd: any = { ...productData };
      if (pd.attributes && typeof pd.attributes === 'object') {
        formData.append('attributes', JSON.stringify(pd.attributes));
      }
      delete pd.attributes;
      if (pd.purchasePrice !== undefined && pd.purchasePrice !== null && pd.purchasePrice !== '') {
        formData.append('purchase_price', String(pd.purchasePrice));
        delete pd.costPrice; // prefer explicit purchase price over the legacy Cost Price field
      }
      delete pd.purchasePrice;
      if (pd.handlingCostPct !== undefined && pd.handlingCostPct !== null && pd.handlingCostPct !== '') {
        formData.append('handling_cost_pct', String(pd.handlingCostPct));
      }
      delete pd.handlingCostPct;
      if (pd.markupPct !== undefined && pd.markupPct !== null && pd.markupPct !== '') {
        formData.append('markup_pct', String(pd.markupPct));
      }
      delete pd.markupPct;

      Object.entries(pd).forEach(([key, value]) => {
        const backendKey = fieldMappings[key] || key; // Use mapped key or original key if no mapping exists
        
        // Skip stockQuantity when editing (not new product)
        // Stock changes should only be made through Stock Adjustment feature
        if (key === 'stockQuantity' && !isNew) {
          console.log('[ProductsPage] Skipping stockQuantity for edit operation');
          return; // Skip this field
        }
        
        // Special handling for taxClassId/tax_class_id
        if (key === 'taxClassId') {
          // Always include tax_class_id in the request, even if null
          // This ensures the backend knows we want to update this field
          if (value === null || value === '') {
            // For null/empty values, explicitly set tax_class_id to null
            formData.append('tax_class_id', 'null');
          } else {
            // Only include valid tax class IDs
            // IMPORTANT: Send as string to prevent parsing issues on the backend
            // Debug logging removed for cleaner console output
            formData.append('tax_class_id', String(value));
          }
        } 
        // Handle all other fields
        else if (value !== undefined && value !== null) {
          const stringValue = String(value); // Ensure value is a string for FormData
          formData.append(backendKey, stringValue);
        }
        // Do nothing if value is undefined or null for non-taxClassId fields
      });

      if (imageFile) {
        formData.append('image', imageFile, imageFile.name);
      }

      if (isNew && pd.shareAcrossStores) {
        // Tenant-wide shared product — no store_id at all (products.store_id
        // stays NULL). The backend provisions a store_product_listings row
        // per active store after insert. This is the default for new
        // products (2026-09-08) — ProductFormModal.tsx only sets this false
        // when the user checks "Restrict to this store only". See
        // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
        await createProduct(formData);
      } else if (isNew) {
        // Enhanced store ID resolution with multiple fallback options
        let storeId: string | null = null;

        // Try multiple ways to get store ID
        if (user?.storeId) {
          storeId = user.storeId;
          console.log('[ProductsPage] Store ID found in user.storeId:', storeId);
        } else if (user?.store?.id) {
          storeId = user.store.id;
          console.log('[ProductsPage] Store ID found in user.store.id:', storeId);
        } else {
          // Try to get from localStorage as fallback
          try {
            const storedStoreId = localStorage.getItem('store_id');
            if (storedStoreId) {
              storeId = storedStoreId;
              console.log('[ProductsPage] Store ID found in localStorage:', storeId);
            }
          } catch (error) {
            console.warn('[ProductsPage] Could not access localStorage for store_id:', error);
          }
        }
        
        if (storeId) {
          formData.append('store_id', storeId);
          console.log('[ProductsPage] Using store_id for product creation:', storeId);
        } else {
          console.error('[ProductsPage] CRITICAL: User store_id not available. User object:', {
            hasUser: !!user,
            userStoreId: user?.storeId,
            userStore: user?.store,
            userStoreId_nested: user?.store?.id
          });
          toast.error('Your store information is missing. Cannot create product.');
          setIsLoading(false);
          return; // Stop execution if store_id is missing
        }
        // createProduct now returns Product directly or throws an error
        await createProduct(formData); 
      } else if (selectedProduct && selectedProduct.id) {
        // updateProduct now returns Product directly or throws an error
        await updateProduct(selectedProduct.id, formData); 
      } else {
        throw new Error('Product ID is missing for update.');
      }

      // If we reach here, the operation was successful because errors would have been thrown and caught.
      toast.success(`Product ${isNew ? 'added' : 'updated'} successfully!`);
      await fetchData(); 
      handleModalClose();

    } catch (error) {
      console.error('Error saving product:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred while saving.';
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedProduct, fetchData, handleModalClose]);

  const handleRefreshCategories = async () => {
    // Refetch categories specifically, or all data if simpler
    // For now, let's refetch all data as fetchData already handles both products and categories
    // If performance becomes an issue, we can create a more targeted fetchCategories function.
    await fetchData(); 
    // Optionally, you might want to toast a success message or handle errors here if fetchData doesn't already.
  };

  // Apply both search and filters to products
  useEffect(() => {
    // First, filter by search term
    let filtered = products;
    
    if (searchTerm.trim()) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(lowercasedSearch) ||
        product.sku?.toLowerCase().includes(lowercasedSearch) ||
        product.barcode?.toLowerCase().includes(lowercasedSearch) ||
        product.description?.toLowerCase().includes(lowercasedSearch) ||
        product.categoryName?.toLowerCase().includes(lowercasedSearch)
      );
    }
    
    // Then apply additional filters if active
    if (hasActiveFilters) {
      // Filter by categories
      if (activeFilters.categories.length > 0) {
        filtered = filtered.filter(product => 
          product.categoryId && activeFilters.categories.includes(product.categoryId)
        );
      }
      
      // Filter by stock status
      if (activeFilters.stockStatus !== 'all') {
        filtered = filtered.filter(product => {
          if (activeFilters.stockStatus === 'in_stock') return product.stockQuantity > 0;
          if (activeFilters.stockStatus === 'out_of_stock') return product.stockQuantity <= 0;
          if (activeFilters.stockStatus === 'low_stock') {
            return product.stockQuantity > 0 && product.lowStockThreshold !== null && product.lowStockThreshold !== undefined && product.stockQuantity <= product.lowStockThreshold;
          }
          return true;
        });
      }
      
      // Filter by active status
      if (activeFilters.activeStatus !== 'all') {
        filtered = filtered.filter(product => {
          if (activeFilters.activeStatus === 'active') {
            return product.isActive === true;
          } else {
            return product.isActive === false;
          }
        });
      }
      
      // Filter by price range
      if (activeFilters.priceRange.min !== '') {
        filtered = filtered.filter(product => 
          product.price >= Number(activeFilters.priceRange.min)
        );
      }
      
      if (activeFilters.priceRange.max !== '') {
        filtered = filtered.filter(product => 
          product.price <= Number(activeFilters.priceRange.max)
        );
      }
    }
    
    setFilteredProducts(filtered);
    setCurrentPage(1); // Reset to first page whenever filters change
  }, [products, searchTerm, activeFilters, hasActiveFilters]);

  // Effect to adjust current page if it becomes invalid after data changes
  useEffect(() => {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0 && filteredProducts.length === 0) {
      // If no products match filters, reset to page 1 (or handle as preferred)
      setCurrentPage(1);
    } else if (currentPage === 0 && totalPages > 0) {
      // Ensure current page is at least 1 if there are pages
      setCurrentPage(1);
    }
  }, [filteredProducts, itemsPerPage, currentPage]);

  // Pagination logic
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  // Pagination slicing is now handled by the ReusableTable component

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  // Calculate counts for metric cards
  const activeProductsCount = useMemo(() => products.filter(p => p.isActive).length, [products]);
  
  const lowStockItems = useMemo(() => 
    products.filter(p => p.stockQuantity > 0 && typeof p.lowStockThreshold === 'number' && p.stockQuantity < p.lowStockThreshold)
  , [products]);
  const lowStockCount = useMemo(() => lowStockItems.length, [lowStockItems]);

  const outOfStockItems = useMemo(() => 
    products.filter(p => p.stockQuantity <= 0)
  , [products]);
  const outOfStockCount = useMemo(() => outOfStockItems.length, [outOfStockItems]);

  // Handlers for ProductStockStatusModal
  const handleOpenStockStatusModal = (title: string, items: Product[]) => {
    setStockStatusModalTitle(title);
    setStockStatusModalProducts(items);
    setIsStockStatusModalOpen(true);
  };

  const handleCloseStockStatusModal = () => {
    setIsStockStatusModalOpen(false);
    setStockStatusModalTitle('');
    setStockStatusModalProducts([]);
  };

  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
  };

  const getFilteredProductsForExport = useCallback((): Product[] => {
    // This function can be expanded if specific transformations are needed for export
    // For now, it returns the currently filtered products
    return filteredProducts;
  }, [filteredProducts]);

  const handleExport = async (format: ExportFormat) => { 
    // Debug: Log user and store information
    // Debug logging removed for cleaner console output
    // Debug logging removed for cleaner console output
    // Debug logging removed for cleaner console output

    const dataToExport = getFilteredProductsForExport(); 
    if (dataToExport.length === 0) {
      toast.warn('No data available to export.');
      return;
    }

    const currencyFormat = `${effectiveCurrencyCode} #,##0.00;[Red]-${effectiveCurrencyCode} #,##0.00`;
    const tenantNameForFilename = user?.store?.name?.replace(/\s+/g, '_') || 'export';
    const exportDateTime = formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const reportInfoLines = [
      `${user?.store?.name || 'Store Report'}`, 
      `Product List`,
      `Export Date: ${exportDateTime}`,
    ];

    // Define columns for Excel and CSV here, as columnsToExport is removed from signature
    // This can be made dynamic later if UniversalListControls is updated
    const exportFileColumns = ['name', 'sku', 'categoryName', 'price', 'stockQuantity', 'supplierName', 'costPrice', 'isActive', 'barcode', 'updatedAt'];
    const exportFileHeaders = ['Product Name', 'SKU', 'Category', 'Price', 'Stock', 'Supplier', 'Cost Price', 'Active', 'Barcode', 'Last Updated'];

    if (format === 'pdf') {
      const doc = new jsPDF();
      const pdfHeaderTenantName = user?.store?.name || 'Store Name'; 
      const pdfFileTenantNameSegment = user?.store?.name?.replace(/\s+/g, '_') || 'Store'; 

      // PDF Header
      doc.setFontSize(18);
      doc.text(pdfHeaderTenantName, 14, 22); 
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Export Date: ${exportDateTime}`, 14, 29); 

      // PDF Table Content
      const pdfExportHeaders = ["S.No.", "Product Name", "Category", "Price", "Stock"]; 
      
      // Prepare data for PDF
      const pdfTableBodyData = dataToExport.map((product, index) => {
          return [
            index + 1, // Serial Number
            product.name,
            product.categoryName || 'N/A',
            typeof product.price === 'number' ? product.price.toFixed(2) : 'N/A',
            product.stockQuantity !== undefined && product.stockQuantity !== null ? product.stockQuantity : 'N/A',
          ];
        });

      autoTable(doc, {
        head: [pdfExportHeaders],
        body: pdfTableBodyData,
        startY: 35, 
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { 
          fillColor: [22, 160, 133]
        }, 
        columnStyles: { 
          0: { cellWidth: 15 },    // S.No. column
          1: { cellWidth: 'auto' }, // Product Name
          2: { cellWidth: 40 },    // Category
          3: { cellWidth: 25, halign: 'right' },    // Price (right-aligned)
          4: { cellWidth: 25, halign: 'right' }     // Stock (right-aligned)
        },
        didParseCell: (data) => {
          if (data.section === 'head') {
            if (data.column.index === 3 || data.column.index === 4) { // Price (3) and Stock (4) headers
              data.cell.styles.halign = 'right';
            }
          }
        },
        didDrawPage: (data: { pageNumber: number; settings: { margin: { left: number } } }) => {
          // Footer
          const pageCount = (doc.internal as any).getNumberOfPages();
          doc.setFontSize(10);
          doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });

      doc.save(`products-${pdfFileTenantNameSegment}-${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
      toast.success('Products exported as PDF.');
    } else if (format === 'excel') {
      try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Products');

        reportInfoLines.forEach(line => {
          worksheet.addRow([line]);
        });
        worksheet.addRow([]); 

        worksheet.addRow(exportFileHeaders);

        dataToExport.forEach((product: Product) => {
          const rowData = exportFileColumns.map(colKey => {
            const key = colKey as keyof Product;
            if (key === 'price' || key === 'costPrice') {
              return typeof product[key] === 'number' ? product[key] : undefined;
            } else if (key === 'isActive') {
              return product[key] ? 'Yes' : 'No';
            } else if (key === 'updatedAt') { 
              return product[key] ? formatDate(new Date(product[key] as string), 'yyyy-MM-dd HH:mm') : 'N/A';
            } else if (key === 'stockQuantity') {
                return typeof product[key] === 'number' ? product[key] : undefined;
            }
            return product[key] !== undefined && product[key] !== null ? product[key] : 'N/A';
          });
          worksheet.addRow(rowData);
        });
        
        // Apply currency formatting to price and cost price columns
        const priceColLetter = String.fromCharCode(65 + exportFileColumns.indexOf('price'));
        const costPriceColLetter = String.fromCharCode(65 + exportFileColumns.indexOf('costPrice'));
        worksheet.getColumn(priceColLetter).numFmt = currencyFormat;
        worksheet.getColumn(costPriceColLetter).numFmt = currencyFormat;

        worksheet.addRow([]); 
        worksheet.addRow([`Powered by ZettaZ Cloud POS`]);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `products-${tenantNameForFilename}-${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Products exported as Excel.');
      } catch (error) {
        console.error('Error exporting Excel:', error);
        toast.error('Failed to export products as Excel.');
      }
    } else if (format === 'csv') {
      try {
        const csvReportHeader = reportInfoLines.join('\n') + '\n\n';
        const csvDataContent = dataToExport.map((product: Product) => 
          exportFileColumns.map(colKey => {
            const key = colKey as keyof Product;
            let val = product[key];
            if (key === 'price' || key === 'costPrice') {
              // For CSV, use the raw number or 'N/A' if not a number
              val = typeof val === 'number' ? val.toFixed(2) : 'N/A'; 
            } else if (key === 'isActive') {
              val = val ? 'Yes' : 'No';
            } else if (key === 'updatedAt') { 
              val = val ? formatDate(new Date(val as string), 'yyyy-MM-dd HH:mm') : 'N/A';
            }
            // Escape commas and quotes for CSV
            const cellValue = (val !== undefined && val !== null) ? String(val) : '';
            return `"${cellValue.replace(/"/g, '""')}"`;
          }).join(',')
        ).join('\n');
        const csvReportFooter = `\n\nPowered by ZettaZ Cloud POS`;
        const finalCsvData = csvReportHeader + exportFileHeaders.join(',') + '\n' + csvDataContent + csvReportFooter;

        const blob = new Blob([finalCsvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `products-${tenantNameForFilename}-${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Products exported as CSV.');
      } catch (error) {
        console.error('Error exporting CSV:', error);
        toast.error('Failed to export products as CSV.');
      }
    } 
  };


  const handleApplyFilters = (filters: ProductFilters) => {
    const hasFilters = (
      filters.categories.length > 0 ||
      filters.stockStatus !== 'all' ||
      filters.activeStatus !== 'all' ||
      filters.priceRange.min !== '' ||
      filters.priceRange.max !== ''
    );
    
    setActiveFilters(filters);
    setHasActiveFilters(hasFilters);
    
    if (hasFilters) {
      toast.success('Filters applied successfully');
    } else {
      toast.info('All filters cleared');
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    setProductToDelete({ id: productId, name: productName });
    setIsDeleteModalOpen(true);
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProduct(productToDelete.id);
      toast.success(`Product "${productToDelete.name}" deleted successfully.`);
      await fetchData(); // Refresh the product list
    } catch (error) {
      console.error('Failed to delete product:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast.error(`Failed to delete product "${productToDelete.name}". ${errorMessage}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };

  // Define columns for the ResponsiveTable
  const columns: ColumnDefinition<Product>[] = useMemo(() => [
    { 
      accessor: 'name', 
      Header: 'Product', 
      mobileLabel: 'Product',
      priority: 1,
      Cell: (product) => {
        return (
          <div className="flex items-center">
            {/* Image Container with standard styling */}
            <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border mr-3">
              {product.imageUrl ? (
                <img
                  src={normalizeImageUrl(product.imageUrl) || ''}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                // Standard placeholder div
                <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-muted">
                  <span className="text-xs text-gray-400 dark:text-muted-foreground">No Img</span>
                </div>
              )}
            </div>
            {/* Text Container */}
            <div className="ml-1"> 
              <div className="text-sm font-medium text-gray-900 dark:text-foreground">{product.name}</div>
              {product.sku && <div className="text-xs text-gray-500 dark:text-muted-foreground">SKU: {product.sku}</div>}
            </div>
          </div>
        );
      },
      className: 'font-medium text-text' 
    },
    {
      Header: 'Category',
      accessor: 'categoryName',
      mobileLabel: 'Category',
      priority: 3,
      Cell: (data: Product) => { 
        if (data.categoryName) return data.categoryName; 
        if (!data.categoryId) return <span className="text-gray-500 dark:text-muted-foreground">N/A</span>;
        const category = categories.find(cat => cat.id === data.categoryId);
        return category ? category.name : <span className="text-red-500">Unknown</span>;
      },
    },
    { 
      accessor: 'price', 
      Header: 'Price',
      mobileLabel: 'Price',
      priority: 2,
      Cell: (data: Product) => formatCurrency(Number(data.price)),
    },
    { 
      accessor: 'stockQuantity', 
      Header: 'Stock',
      mobileLabel: 'Stock',
      priority: 4,
      Cell: (data: Product) => { 
        const stockVal = data.stockQuantity;
        const stock = Number(stockVal);

        if (isNaN(stock)) {
          return <span className="text-gray-500 dark:text-muted-foreground">N/A</span>;
        }

        const isLowStock = data.lowStockThreshold != null && stock < data.lowStockThreshold;
        const isOutOfStock = stock <= 0;
        return (
          <span className={`${isOutOfStock ? 'text-danger-text font-semibold' : isLowStock ? 'text-warning-text font-semibold' : ''}`}>
            {stock} 
          </span>
        );
      },
    },
    { 
      accessor: 'isActive', 
      Header: 'Status',
      mobileLabel: 'Status',
      priority: 5,
      Cell: (product) => (
        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${product.isActive ? 'bg-success-light text-success-text' : 'bg-danger-light text-danger-text'}`}>
          {product.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
      className: 'text-center',
      headerClassName: 'text-center'
    },
    { 
      accessor: 'id',
      Header: 'Actions',
      mobileLabel: '', // No label for actions on mobile
      priority: 6,
      Cell: (product) => (
        <div className="flex items-center justify-center md:justify-center space-x-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}
            className="text-primary hover:text-primary-dark p-1.5 md:p-1 rounded-md hover:bg-primary-light transition-colors duration-150"
            title="Edit Product"
          >
            <Edit3 size={18} className="md:w-4 md:h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenStockAdjustmentModal(product); }}
            className="text-primary hover:text-primary/80 p-1.5 md:p-1 rounded-md hover:bg-blue-100 transition-colors duration-150"
            title="Adjust Stock"
          >
            <SlidersHorizontal size={18} className="md:w-4 md:h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id, product.name); }}
            className="text-danger hover:text-danger-dark p-1.5 md:p-1 rounded-md hover:bg-danger-light transition-colors duration-150"
            title="Delete Product"
          >
            <Trash2 size={18} className="md:w-4 md:h-4" />
          </button>
        </div>
      ),
      className: 'text-center',
    },
  ], [categories, effectiveCurrencyCode, handleEditProduct, handleOpenStockAdjustmentModal, handleDeleteProduct]);

  if (location.pathname === '/products/tax-classes') {
    return (
      <div className="p-4 md:p-6 bg-background-main min-h-screen">
        <CategoryTaxClassManager />
      </div>
    );
  }
  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Package}
        title="Products"
        subtitle="Manage your product inventory, track stock levels, and organize catalog items."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Products', value: activeProductsCount, icon: Package, color: 'text-primary', onClick: undefined as (() => void) | undefined },
          { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, color: 'text-warning-600', onClick: () => handleOpenStockStatusModal('Low Stock Items', lowStockItems) },
          { label: 'Out of Stock', value: outOfStockCount, icon: XCircle, color: 'text-danger-600', onClick: () => handleOpenStockStatusModal('Out of Stock Items', outOfStockItems) },
        ].map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{isLoading ? '…' : item.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </>
          );
          const cls = `flex items-center gap-3 rounded-xl border border-r-4 p-3.5 text-left transition-all ${
            item.onClick ? 'border-border border-r-primary/40 bg-card hover:border-primary/40 cursor-pointer' : 'border-border border-r-primary/40 bg-card'
          }`;
          return item.onClick ? (
            <button key={item.label} onClick={item.onClick} className={cls}>
              {content}
            </button>
          ) : (
            <div key={item.label} className={cls}>
              {content}
            </div>
          );
        })}
      </div>

      {/* Universal List Controls */}
      <UniversalListControls
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onImportClick={handleOpenImportModal}
        entityType="product"
        currentPage="products"
        showImportButton={true}
        placeholderText="Search products by name, SKU, barcode or description..."
        onExportClick={handleExport}
        newButtonText="New"
        onNewButtonClick={handleAddProduct}
        showFilterButton={true}
        showExportButton={true}
        showNewButton={true}
        onStockAdjustClick={() => handleOpenStockAdjustmentModal(null)}
        showStockAdjustButton={false}
        stockAdjustButtonText="Adjust Stock"
        stockAdjustButtonIcon={<SlidersHorizontal size={16} />}
        showTaxClassButton={true}
      />

      {error && <div className="bg-danger-light text-danger-text p-4 rounded-lg">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        {isLoading && filteredProducts.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No products found.</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={filteredProducts}
            isLoading={false}
            noDataMessage="No products found matching your search criteria."
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            itemsPerPage={itemsPerPage}
            totalItems={totalItems}
            mobileCardView={true}
            onRowClick={(product) => navigate(`/products/${product.id}`)}
          />
        )}
      </div>

      {isModalOpen && (
        <ProductFormModal 
          isOpen={isModalOpen}
          product={selectedProduct} 
          categories={categories} 
          onClose={handleModalClose} 
          onSave={(productData, imageFile, isNew) => handleSaveProduct(productData, imageFile, isNew)} 
          onRefreshCategories={handleRefreshCategories} // Pass the new handler
        />
      )}
      
      {isFilterModalOpen && (
        <ProductFilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          onApplyFilters={handleApplyFilters}
          categories={categories}
          currentFilters={activeFilters}
        />
      )}

      {/* Product Import Modal */}
      {isImportModalOpen && (
        <ProductImport 
          categories={categories} 
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={() => {
            fetchData(); // Refresh the products list
            // Force refresh inventory context to update POS screen
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('inventoryUpdated'));
            }
            toast.success('Products imported successfully!');
          }}
        />
      )}

      {/* Stock Adjustment Modal */}
      {isStockAdjustmentModalOpen && (
        <StockAdjustmentModal
          isOpen={isStockAdjustmentModalOpen}
          onClose={handleCloseStockAdjustmentModal}
          productToAdjust={productForAdjustment}
          onAdjustmentSuccess={handleStockAdjustmentSuccess}
        />
      )}

      {productToDelete && (
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={executeDeleteProduct}
          title={`Delete Product: ${productToDelete.name}`}
          message={`Are you sure you want to delete the product "${productToDelete.name}"? This action cannot be undone.`}
          variant="danger"
          confirmButtonText="Delete Product"
          isConfirmLoading={isDeleting}
        />
      )}

      <ProductStockStatusModal
        isOpen={isStockStatusModalOpen}
        onClose={handleCloseStockStatusModal}
        title={stockStatusModalTitle}
        products={stockStatusModalProducts}
        currencyCode={effectiveCurrencyCode}
      />
    </div>
  );
};

export default ProductsPage;
