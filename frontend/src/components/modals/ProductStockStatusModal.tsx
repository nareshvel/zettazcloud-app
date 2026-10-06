// frontend/src/components/modals/ProductStockStatusModal.tsx
import React, { useState, useMemo } from 'react';
import { Product } from '@/types'; // Assuming Product type path
import UniversalListControls, { ExportFormat } from '@/components/UniversalListControls'; // Assuming path
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable'; // Assuming path
import { formatCurrency } from '@/utils/format'; // Assuming path
import ModalBase from '@/components/ui/ModalBase'; // Import ModalBase
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format as formatDateFn } from 'date-fns';

interface ProductStockStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  products: Product[];
  currencyCode: string; // For formatting price
}

const ProductStockStatusModal: React.FC<ProductStockStatusModalProps> = ({
  isOpen,
  onClose,
  title,
  products,
  currencyCode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useMemo(() => {
    let result = products;
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = products.filter((product) =>
        product.name.toLowerCase().includes(lowerSearchTerm) ||
        (product.sku && product.sku.toLowerCase().includes(lowerSearchTerm))
      );
    }
    setFilteredProducts(result);
    setCurrentPage(1); 
  }, [products, searchTerm]);

  const columns: ColumnDefinition<Product>[] = useMemo(() => [
    { Header: 'Product Name', accessor: 'name', Cell: (product: Product) => <div className="min-w-[150px]">{product.name}</div> },
    { Header: 'SKU', accessor: 'sku', Cell: (product: Product) => product.sku || 'N/A' },
    {
      Header: 'Stock Qty',
      accessor: 'stockQuantity',
      Cell: (product: Product) => product.stockQuantity ?? 0,
    },
    {
      Header: 'Low Stock Threshold',
      accessor: 'lowStockThreshold',
      Cell: (product: Product) => product.lowStockThreshold ?? 'N/A',
    },
    {
      Header: 'Price',
      accessor: 'price',
      Cell: (product: Product) => formatCurrency(product.price, currencyCode),
    },
    {
      Header: 'Status',
      accessor: 'isActive',
      Cell: (product: Product) => (
        <span
          className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
            product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {product.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    { Header: 'Category', accessor: 'categoryName', Cell: (product: Product) => product.categoryName || 'N/A' },
  ], [currencyCode]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => Math.ceil(filteredProducts.length / itemsPerPage), [filteredProducts, itemsPerPage]);

  const handleExport = async (format: ExportFormat) => {
    const exportData = filteredProducts.map((p) => ({
      Name: p.name,
      SKU: p.sku || 'N/A',
      'Stock Qty': p.stockQuantity ?? 0,
      'Low Stock Threshold': p.lowStockThreshold ?? 'N/A',
      Price: formatCurrency(p.price, currencyCode),
      Category: p.categoryName || 'N/A',
      Status: p.isActive ? 'Active' : 'Inactive',
    }));

    if (exportData.length === 0) {
      return;
    }

    const timestamp = formatDateFn(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `${title.replace(/\s+/g, '_')}_${timestamp}`;

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(title.substring(0, 30)); 
      worksheet.columns = Object.keys(exportData[0] || {}).map((key) => ({ header: key, key: key, width: 20 }));
      worksheet.addRows(exportData);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      autoTable(doc, {
        head: [Object.keys(exportData[0] || {})],
        body: exportData.map((row) => Object.values(row)),
        startY: 20,
        didDrawPage: (data) => {
          doc.setFontSize(18);
          doc.text(title, data.settings.margin.left, 15);
        },
      });
      doc.save(`${filename}.pdf`);
    } else if (format === 'csv') {
      const headers = Object.keys(exportData[0] || {}).join(',');
      const csvRows = exportData.map((row) => 
        Object.values(row).map(val => {
          const strVal = String(val);
          if (strVal.includes(',') || strVal.includes('\n') || strVal.includes('"')) {
            return `"${strVal.replace(/"/g, '""')}"`;
          }
          return strVal;
        }).join(',')
      );
      const csvString = `${headers}\n${csvRows.join('\n')}`;
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const tableHtml = `
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; font-size: 10pt; }
              th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
              th { background-color: #f2f2f2; }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
              .print-controls { 
                text-align: center; 
                margin: 20px 0; 
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 4px;
              }
              .print-button {
                background-color: #4CAF50;
                border: none;
                color: white;
                padding: 8px 16px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 14px;
                margin: 4px 2px;
                cursor: pointer;
                border-radius: 4px;
              }
              .close-button {
                background-color: #f44336;
                border: none;
                color: white;
                padding: 8px 16px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 14px;
                margin: 4px 2px;
                cursor: pointer;
                border-radius: 4px;
              }
              @media print {
                .print-controls { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="print-controls no-print">
              <button class="print-button" onclick="window.print();">Print</button>
              <button class="close-button" onclick="window.close();">Close</button>
            </div>
            <h2>${title}</h2>
            <table>
              <thead>
                <tr>
                  ${columns.map((col) => `<th>${col.Header}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${filteredProducts.map((product) => `
                  <tr>
                    <td>${product.name}</td>
                    <td>${product.sku || 'N/A'}</td>
                    <td>${product.stockQuantity ?? 0}</td>
                    <td>${product.lowStockThreshold ?? 'N/A'}</td>
                    <td>${formatCurrency(product.price, currencyCode)}</td>
                    <td>${product.isActive ? 'Active' : 'Inactive'}</td>
                    <td>${product.categoryName || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>
              // Auto-print with fallback for closing
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  // Set up the afterprint handler
                  if (window.matchMedia) {
                    const mediaQueryList = window.matchMedia('print');
                    mediaQueryList.addEventListener('change', function(mql) {
                      if (!mql.matches) {
                        // Print dialog was closed/completed
                        setTimeout(function() {
                          // Give a small delay before closing to ensure the user sees the result
                          // This helps with browsers that might not trigger onafterprint
                          window.close();
                        }, 1000);
                      }
                    });
                  }
                  
                  // Standard afterprint handler (works in most browsers)
                  window.onafterprint = function() { 
                    setTimeout(function() {
                      window.close();
                    }, 1000);
                  };
                }, 500);
              }
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(tableHtml);
      printWindow.document.close();
    }
  };

  return (
    <ModalBase isOpen={isOpen} onClose={onClose} title={title} size="2xl">
      <div className="flex flex-col h-[calc(80vh-100px)] md:h-[calc(75vh-100px)]"> 
        <UniversalListControls
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm} 
          placeholderText="Search by name or SKU..."
          onExportClick={handleExport}
          onPrint={handlePrint} 
          showExportButton={true}
          showPrintButton={true} 
          showFilterButton={false} 
          showNewButton={false}    
          newButtonText=""
          onNewButtonClick={() => {}}
        />
        <div className="flex-grow overflow-y-auto mt-4"> 
          {paginatedProducts.length > 0 ? (
            <ReusableTable
              columns={columns}
              data={paginatedProducts}
              isLoading={false} 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage} 
              itemsPerPage={itemsPerPage}
              totalItems={filteredProducts.length}
            />
          ) : (
            <div className="text-center py-10 text-gray-500 dark:text-muted-foreground">
              No products found matching your criteria.
            </div>
          )}
        </div>
      </div>
    </ModalBase>
  );
};

export default ProductStockStatusModal;
