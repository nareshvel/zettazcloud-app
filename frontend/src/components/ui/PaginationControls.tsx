import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button'; // Assuming your Button component is here

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number; // Optional, for 'Showing X-Y of Z' message
  totalItems?: number;   // Optional, for 'Showing X-Y of Z' message
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
}) => {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5; // Max number of page buttons to show
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - halfPagesToShow);
      let endPage = Math.min(totalPages, currentPage + halfPagesToShow);

      if (currentPage - halfPagesToShow <= 0) {
        endPage = maxPagesToShow;
      }
      if (currentPage + halfPagesToShow >= totalPages) {
        startPage = totalPages - maxPagesToShow + 1;
      }
      
      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) {
          pageNumbers.push('...');
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageNumbers.push('...');
        }
        pageNumbers.push(totalPages);
      }
    }
    return pageNumbers;
  };

  if (totalPages <= 1) {
    return null; // Don't render pagination if only one page or no pages
  }

  const showingStart = totalItems && itemsPerPage ? (currentPage - 1) * itemsPerPage + 1 : '';
  const showingEnd = totalItems && itemsPerPage ? Math.min(currentPage * itemsPerPage, totalItems) : '';

  return (
    <div className="mt-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
      {totalItems && itemsPerPage && (
        <div className="text-sm text-gray-700 dark:text-foreground dark:text-gray-300">
          Showing <span className="font-semibold">{showingStart}</span> to <span className="font-semibold">{showingEnd}</span> of <span className="font-semibold">{totalItems}</span> results
        </div>
      )}
      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
          className="px-2.5 py-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Previous</span>
        </Button>

        {getPageNumbers().map((page, index) =>
          typeof page === 'number' ? (
            <Button
              key={`page-${page}`}
              variant={currentPage === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
              className="px-3 py-1.5 h-auto min-w-[36px]"
            >
              {page}
            </Button>
          ) : (
            <span key={`ellipsis-${index}`} className="px-3 py-1.5 text-sm text-gray-500 dark:text-muted-foreground dark:text-gray-400 dark:text-muted-foreground">
              {page}
            </span>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
          className="px-2.5 py-1.5"
        >
          <span className="hidden sm:inline mr-1">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default PaginationControls;
