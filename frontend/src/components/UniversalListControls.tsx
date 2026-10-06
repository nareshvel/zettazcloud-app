import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter as FilterIcon, Plus, UploadCloud, Download, ChevronDown, ChevronRight, FileText, FileSpreadsheet, FileType, Printer, Percent, Tag, Settings2, SlidersHorizontal, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export type ExportFormat = 'csv' | 'pdf' | 'excel';

export type FilterOption = {
  value: any;
  label: string;
  icon?: React.ReactNode; // Optional icon for each filter option
};

export interface UniversalListControlsProps {
  // Current page/entity type to conditionally show buttons
  currentPage?: 'products' | 'customers' | 'suppliers' | 'inventory' | 'orders' | string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholderText: string;
  // Props for Filter Dropdown
  filterOptions?: FilterOption[];
  onFilterOptionSelect?: (value: any) => void;
  currentFilterValue?: any;
  defaultFilterButtonText?: string;
  onExportClick?: (format: ExportFormat) => void;
  newButtonText: string;
  onNewButtonClick: () => void;
  showFilterButton?: boolean;
  showExportButton?: boolean;
  showNewButton?: boolean;
  newButtonIcon?: React.ReactNode;
  // Props for a custom filter panel toggle (renders a button next to Export)
  showFilterPanelButton?: boolean;
  onFilterPanelButtonClick?: () => void;
  filterPanelButtonText?: string;
  filterPanelActive?: boolean;
  // Props for Stock Adjust button
  onStockAdjustClick?: () => void;
  showStockAdjustButton?: boolean;
  stockAdjustButtonText?: string;
  stockAdjustButtonIcon?: React.ReactNode;
  // Future: filtersAppliedCount?: number;
  onPrint?: () => void;
  showPrintButton?: boolean;
  exportOptions?: ExportFormat[];
  // Props for Import button
  onImportClick?: () => void;
  showImportButton?: boolean;
  importButtonText?: string;
  importButtonIcon?: React.ReactNode;
  entityType?: string; // To conditionally show buttons like 'Import' based on context
  // Props for Tax Class Management button
  showTaxClassButton?: boolean;
  // Props for Bulk Apply button
  showBulkApplyButton?: boolean;
  bulkApplyButtonText?: string;
  onBulkApplyClick?: () => void;
  // Props for Manage Roles button
  showManageRolesButton?: boolean;
  onManageRolesClick?: () => void;
  manageRolesButtonText?: string;
  manageRolesButtonIcon?: React.ReactNode;
}

const UniversalListControls: React.FC<UniversalListControlsProps> = ({
  searchTerm,
  onSearchChange,
  placeholderText,
  // Filter props
  filterOptions,
  onFilterOptionSelect,
  currentFilterValue,
  defaultFilterButtonText = 'Filter',
  // Export props
  onExportClick,
  newButtonText,
  onNewButtonClick,
  showFilterButton = true,
  showExportButton = true,
  showNewButton = true,
  newButtonIcon,
  showFilterPanelButton = false,
  onFilterPanelButtonClick,
  filterPanelButtonText = 'Filters',
  filterPanelActive = false,
  // Destructure Stock Adjust props
  onStockAdjustClick,
  showStockAdjustButton = true, // Default to true if handler is provided, can be overridden
  stockAdjustButtonText = 'Adjust Stock',
  stockAdjustButtonIcon,
  onPrint,
  showPrintButton = false, // Default to false, enable as needed
  exportOptions,
  // Destructure Import props
  onImportClick,
  showImportButton = false, // Default to false, enable by parent
  importButtonText = 'Import',
  importButtonIcon,
  entityType,
  currentPage,
  showTaxClassButton = false,
  // Destructure Bulk Apply props
  showBulkApplyButton = false,
  bulkApplyButtonText = 'Bulk Apply',
  onBulkApplyClick,
  // Destructure Manage Roles props
  showManageRolesButton = false,
  onManageRolesClick,
  manageRolesButtonText = 'Manage Roles',
  manageRolesButtonIcon,
}) => {
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
        setExpandedAction(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExport = (format: ExportFormat) => {
    onExportClick?.(format);
    setIsExportDropdownOpen(false);
    setIsActionsDropdownOpen(false);
    setExpandedAction(null);
  };

  // Whether to show the consolidated actions menu (products page with Import + Export + Tax Classes)
  const showActionsMenu = showImportButton && onImportClick && entityType === 'product'
    && showExportButton && onExportClick
    && showTaxClassButton && currentPage === 'products';

  return (
    <div className="py-4">
      {/* Single row at every breakpoint: search shrinks (min-w-0 lets the flex item
          actually shrink below its content size) while the action buttons stay a
          fixed-size, non-wrapping cluster on the right — this is what keeps mobile
          from stacking into two rows. */}
      <div className="flex flex-row justify-between items-center gap-2 sm:gap-4 px-3">
        {/* Left: Search Bar */}
        <div className="relative flex-1 min-w-0 sm:max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-placeholder" />
          <input
            type="text"
            placeholder={placeholderText}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-3 sm:pr-4 py-2.5 border border-border rounded-lg w-full bg-background-main placeholder-text-placeholder focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm shadow-sm transition-colors duration-150 ease-in-out"
          />
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap justify-end overflow-x-auto sm:overflow-visible">
          {showFilterButton && filterOptions && onFilterOptionSelect && (
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setIsFilterDropdownOpen(prev => !prev)}
                className={`border text-text-secondary font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-75 ${currentFilterValue !== undefined && currentFilterValue !== null && filterOptions.find(opt => opt.value === currentFilterValue) ? 'bg-primary-extralight border-primary text-primary' : 'bg-background-card hover:bg-secondary-light border-border'}`}
                title={filterOptions.find(opt => opt.value === currentFilterValue)?.label || defaultFilterButtonText}
                aria-label={filterOptions.find(opt => opt.value === currentFilterValue)?.label || defaultFilterButtonText}
                aria-haspopup="true"
                aria-expanded={isFilterDropdownOpen}
              >
                <FilterIcon size={18} />
                <ChevronDown size={16} className={`ml-1 transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isFilterDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-popover text-popover-foreground border border-border rounded-md shadow-lg z-20 py-1">
                  {filterOptions.map((option) => (
                    <button 
                      key={String(option.value)} // Ensure key is a string
                      onClick={() => {
                        onFilterOptionSelect(option.value);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center ${option.value === currentFilterValue ? 'bg-primary-light text-primary-foreground font-semibold' : 'text-text-primary hover:bg-background-hover'}`}
                    >
                      {option.icon && <span className="mr-2">{option.icon}</span>}
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showBulkApplyButton && onBulkApplyClick && (
            <button
              onClick={onBulkApplyClick}
              className="bg-green-600 hover:bg-green-700 text-white font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
              title={bulkApplyButtonText}
              aria-label={bulkApplyButtonText}
            >
              <Tag size={18} />
            </button>
          )}

          {/* Consolidated Actions Menu (Import / Export / Tax Classes) — products page only */}
          {showActionsMenu && (
            <div className="relative" ref={actionsDropdownRef}>
              <button
                onClick={() => { setIsActionsDropdownOpen(prev => !prev); setExpandedAction(null); }}
                className="bg-background-card hover:bg-secondary-light border border-border text-text-secondary font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-75"
                title="More actions"
                aria-label="More actions"
                aria-haspopup="true"
                aria-expanded={isActionsDropdownOpen}
              >
                <MoreHorizontal size={18} />
              </button>
              {isActionsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-popover text-popover-foreground border border-border rounded-md shadow-lg z-20 py-1">
                  {/* Import */}
                  <button
                    onClick={() => { onImportClick?.(); setIsActionsDropdownOpen(false); setExpandedAction(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background-hover flex items-center"
                  >
                    {importButtonIcon || <UploadCloud size={16} className="mr-2 text-text-secondary" />}
                    {importButtonText}
                  </button>

                  {/* Export — expands inline to show format options */}
                  <button
                    onClick={() => setExpandedAction(expandedAction === 'export' ? null : 'export')}
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background-hover flex items-center justify-between"
                  >
                    <span className="flex items-center">
                      <Download size={16} className="mr-2 text-text-secondary" />
                      Export
                    </span>
                    <ChevronRight size={14} className={`text-text-secondary transition-transform duration-200 ${expandedAction === 'export' ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedAction === 'export' && (
                    <div className="py-1">
                      {(exportOptions || ['csv', 'excel', 'pdf']).map((format) => {
                        let IconComponent = FileText;
                        let label = format.toUpperCase();
                        if (format === 'excel') { IconComponent = FileSpreadsheet; label = 'Excel'; }
                        if (format === 'pdf') { IconComponent = FileType; label = 'PDF'; }
                        if (format === 'csv') { IconComponent = FileText; label = 'CSV'; }
                        return (
                          <button
                            key={format}
                            onClick={() => handleExport(format)}
                            className="w-full text-left pl-10 pr-4 py-2 text-sm text-text-primary hover:bg-background-hover flex items-center"
                          >
                            <IconComponent size={14} className="mr-2 text-text-secondary" /> {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Manage Tax Classes */}
                  <button
                    onClick={() => { navigate('/products/tax-classes'); setIsActionsDropdownOpen(false); setExpandedAction(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background-hover flex items-center"
                  >
                    <Percent size={16} className="mr-2 text-text-secondary" />
                    Manage Tax Classes
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Standalone Import button — non-products pages that still need it */}
          {showImportButton && onImportClick && entityType === 'product' && !showActionsMenu && (
            <button
              onClick={onImportClick}
              className="bg-primary-extralight hover:bg-primary-light text-primary font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75"
              title={importButtonText}
              aria-label={importButtonText}
            >
              {importButtonIcon || <UploadCloud size={18} />}
            </button>
          )}

          {showFilterPanelButton && onFilterPanelButtonClick && (
            <button
              onClick={onFilterPanelButtonClick}
              className={`border font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-75 ${filterPanelActive ? 'bg-primary-extralight border-primary text-primary' : 'bg-background-card hover:bg-secondary-light border-border text-text-secondary'}`}
              title={filterPanelButtonText}
              aria-label={filterPanelButtonText}
            >
              <SlidersHorizontal size={18} />
            </button>
          )}

          {showExportButton && onExportClick && !showActionsMenu && (
            <div className="relative" ref={exportDropdownRef}>
              <button 
                onClick={() => setIsExportDropdownOpen(prev => !prev)}
                className="bg-background-card hover:bg-secondary-light border border-border text-text-secondary font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-75"
                title="Export"
                aria-label="Export"
              >
                <Download size={18} />
                <ChevronDown size={16} className={`ml-1 transition-transform duration-200 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-popover text-popover-foreground border border-border rounded-md shadow-lg z-20 py-1">
                  {(exportOptions || ['csv', 'excel', 'pdf']).map((format) => {
                    let IconComponent = FileText;
                    let label = format.toUpperCase();
                    if (format === 'excel') { IconComponent = FileSpreadsheet; label = 'Excel'; }
                    if (format === 'pdf') { IconComponent = FileType; label = 'PDF'; }
                    if (format === 'csv') { IconComponent = FileText; label = 'CSV'; }

                    return (
                      <button 
                        key={format}
                        onClick={() => handleExport(format)}
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background-hover flex items-center"
                      >
                        <IconComponent size={14} className="mr-2 text-text-secondary" /> {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showPrintButton && onPrint && (
            <button 
              onClick={onPrint}
              className="bg-background-card hover:bg-secondary-light border border-border text-text-secondary font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-75"
              title="Print"
              aria-label="Print"
            >
              <Printer size={18} />
            </button>
          )}

          {showStockAdjustButton && onStockAdjustClick && (
            <button 
              onClick={onStockAdjustClick}
              className="bg-background-card hover:bg-secondary-light border border-border text-text-secondary font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-75"
              title={stockAdjustButtonText}
              aria-label={stockAdjustButtonText}
            >
              {stockAdjustButtonIcon || <SlidersHorizontal size={18} />}
            </button>
          )}
          
          {/* Tax Class Management Button - Only show on products page (standalone, when not in actions menu) */}
          {showTaxClassButton && currentPage === 'products' && !showActionsMenu && (
            <button
              onClick={() => navigate('/products/tax-classes')}
              className="bg-background-card hover:bg-secondary-light border border-border text-text-secondary font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-75"
              title="Manage Tax Classes"
              aria-label="Manage Tax Classes"
            >
              <Percent size={18} />
            </button>
          )}

          {/* Manage Roles Button */}
          {showManageRolesButton && onManageRolesClick && (
            <button
              onClick={onManageRolesClick}
              className="flex items-center justify-center h-9 w-9 px-0 text-text-secondary bg-background-card border border-border rounded-lg shadow-sm hover:bg-secondary-light hover:text-primary focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-light transition-colors duration-150 ease-in-out"
              title={manageRolesButtonText}
              aria-label={manageRolesButtonText}
            >
              {manageRolesButtonIcon || <Settings2 size={18} />}
            </button>
          )}

          {showNewButton && (
            <button
              onClick={onNewButtonClick}
              title={newButtonText}
              aria-label={newButtonText}
              className="bg-primary hover:bg-primary-dark text-white font-medium h-9 w-9 px-0 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-dark focus:ring-opacity-75"
            >
              {newButtonIcon || <Plus size={18} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UniversalListControls;
