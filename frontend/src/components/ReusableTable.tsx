import React, { useState, ChangeEvent, KeyboardEvent } from 'react';
import {
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';

export interface ColumnDefinition<T> {
  accessor: keyof T | string; // Allow string for nested or custom accessors
  Header: string | React.ReactNode;
  Cell?: (data: T, accessor: keyof T | string) => React.ReactNode;
  className?: string; // Applied to td
  headerClassName?: string; // Applied to th
  // Future: sortable?: boolean, width?: string | number
}

export interface ReusableTableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  isLoading?: boolean;
  noDataMessage?: string;
  // Pagination Props (omit for unpaginated tables)
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
  // Optional "records per page" dropdown. Only rendered when a change
  // handler is supplied — pass both this and itemsPerPageOptions to opt in.
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
  // Future: onSort?: (sortConfig: any) => void;
}

const ReusableTable = <T extends {}>({ 
  columns,
  data,
  isLoading = false,
  noDataMessage = "No data available.",
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  itemsPerPage,
  totalItems,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
}: ReusableTableProps<T>) => {

  const [pageInput, setPageInput] = useState<string>(currentPage?.toString() ?? '1');

  const paginatedData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return []; // Handle undefined/null data
    if (!itemsPerPage) return data; // Unpaginated
    const startIndex = ((currentPage ?? 1) - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, itemsPerPage]);

  React.useEffect(() => {
    setPageInput(currentPage?.toString() ?? '1');
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
    // Basic accessor logic (can be improved for nested paths)
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

  return (
    <div className="bg-background-card shadow-card overflow-hidden border border-border"> {/* Removed rounded-xl */}
      <div className="overflow-x-auto">
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

      {/* Pagination Controls */}
      {onPageChange && totalPages !== undefined && (totalPages > 1 || (onItemsPerPageChange && (totalItems ?? 0) > 0)) && (
        <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 border-t border-border bg-background-card">
          <div className="flex-1 flex justify-start items-center gap-3 text-sm text-text-secondary">
            {itemsPerPage && totalItems !== undefined && (
              <span>
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
              </span>
            )}
            {onItemsPerPageChange && (
              <label className="flex items-center gap-1.5">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                  className="px-2 py-1 border border-border rounded-md text-sm bg-background-main focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  {itemsPerPageOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <span>per page</span>
              </label>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="First page"
            >
              <ChevronsLeft size={20} />
            </button>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex items-center space-x-1">
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

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Last page"
            >
              <ChevronsRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReusableTable;
