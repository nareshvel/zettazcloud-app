import React, { useState, ChangeEvent, KeyboardEvent } from 'react';
import {
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';

export interface ColumnDefinition<T> {
  accessor: keyof T | string;
  Header: string | React.ReactNode;
  Cell?: (data: T, accessor: keyof T | string) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  mobileLabel?: string; // Label to show on mobile card view
  hideOnMobile?: boolean; // Hide this column on mobile
  priority?: number; // Lower number = higher priority (shown first on mobile)
}

export interface ResponsiveTableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  isLoading?: boolean;
  noDataMessage?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
  mobileCardView?: boolean; // Enable card view on mobile (default: true)
}

const ResponsiveTable = <T extends {}>({ 
  columns,
  data,
  isLoading = false,
  noDataMessage = "No data available.",
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
  mobileCardView = true,
}: ResponsiveTableProps<T>) => {

  const [pageInput, setPageInput] = useState<string>(currentPage.toString());

  const paginatedData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    if (!itemsPerPage) return data;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  React.useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handleGoToPage = () => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    }
  };

  const handleInputKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  const renderCellContent = (item: T, column: ColumnDefinition<T>) => {
    if (column.Cell) {
      return column.Cell(item, column.accessor);
    }
    if (typeof column.accessor === 'string' && column.accessor) {
      const value = column.accessor.split('.').reduce((obj, key) => (obj as any)?.[key], item);
      return value !== undefined && value !== null ? String(value) : '-';
    }
    return '-';
  };

  if (isLoading) {
    return <div className="text-center text-text-secondary py-8">Loading data...</div>;
  }

  if (!data.length && !isLoading) {
    return <div className="text-center text-text-secondary py-8">{noDataMessage}</div>;
  }

  // Sort columns by priority for mobile view
  const sortedColumns = mobileCardView 
    ? [...columns].sort((a, b) => (a.priority || 999) - (b.priority || 999))
    : columns;

  return (
    <div className="bg-background-card shadow-card overflow-hidden border border-border">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="table min-w-full divide-y divide-border">
          <thead className="bg-primary/10"> 
            <tr>
              {columns.map((col, index) => (
                <th 
                  key={index} 
                  scope="col" 
                  className={`px-6 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider ${col.headerClassName || ''}`}
                >
                  {col.Header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-background-card divide-y divide-border">
            {paginatedData.map((item, rowIndex) => (
              <tr key={rowIndex} className="even:bg-black/5 dark:even:bg-white/5 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors duration-150">
                {columns.map((col, colIndex) => (
                  <td 
                    key={colIndex} 
                    className={`px-6 py-4 whitespace-nowrap text-sm text-text-DEFAULT ${col.className || ''}`}
                  >
                    {renderCellContent(item, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      {mobileCardView && (
        <div className="md:hidden divide-y divide-border">
          {paginatedData.map((item, rowIndex) => (
            <div 
              key={rowIndex} 
              className="p-4 hover:bg-primary/5 transition-colors duration-150"
            >
              <div className="space-y-3">
                {sortedColumns
                  .filter(col => !col.hideOnMobile)
                  .map((col, colIndex) => {
                    const content = renderCellContent(item, col);
                    const label = col.mobileLabel || (typeof col.Header === 'string' ? col.Header : '');
                    
                    return (
                      <div key={colIndex} className="flex justify-between items-start gap-3">
                        {label && (
                          <span className="text-xs font-medium text-text-secondary uppercase tracking-wide min-w-[100px]">
                            {label}
                          </span>
                        )}
                        <div className={`flex-1 text-sm text-text-DEFAULT text-right ${col.className || ''}`}>
                          {content}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 0 && (
        <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-background-card">
          {/* Results count - hidden on mobile, shown on desktop */}
          <div className="hidden sm:flex flex-1 justify-start items-center text-sm text-text-secondary">
            {itemsPerPage && totalItems !== undefined && (
              <span>
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
              </span>
            )}
          </div>

          {/* Mobile-friendly pagination */}
          <div className="flex items-center justify-center gap-1 w-full sm:w-auto">
            {/* First page - hidden on mobile */}
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="hidden sm:inline-flex p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="First page"
            >
              <ChevronsLeft size={20} />
            </button>

            {/* Previous page */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>
            
            {/* Page input */}
            <div className="flex items-center gap-1">
              <span className="text-sm text-text-secondary">Page</span>
              <input 
                type="number" 
                value={pageInput}
                onChange={handlePageInputChange}
                onKeyPress={handleInputKeyPress}
                className="w-12 px-2 py-1 border border-border rounded-md text-sm text-center bg-background-main focus:ring-1 focus:ring-primary focus:border-primary"
                min="1"
                max={totalPages}
              />
              <span className="text-sm text-text-secondary">of {totalPages}</span>
            </div>

            {/* Next page */}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={20} />
            </button>

            {/* Last page - hidden on mobile */}
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="hidden sm:inline-flex p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Last page"
            >
              <ChevronsRight size={20} />
            </button>
          </div>

          {/* Mobile results count */}
          <div className="sm:hidden text-xs text-text-secondary text-center w-full">
            {itemsPerPage && totalItems !== undefined && (
              <span>
                {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsiveTable;
