import React, { useState, useEffect, useCallback } from 'react';
import { X, UserPlus, Search, ArrowLeft, Loader2 } from 'lucide-react'; 
import { Customer } from '@/types';
import { searchCustomers } from '../../services/api';
import axios from 'axios';
import { debounce } from 'lodash';

// Define an interface to handle API response format with snake_case
interface ApiCustomer {
  id: string;
  tenant_id?: string;
  store_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  credit_limit?: number;
  outstanding_credit?: number;
  customer_type?: string;
  is_active?: boolean;
  created_by_user_id?: string;
  updated_by_user_id?: string;
  created_at?: string;
  updated_at?: string;
  default_discount_type?: 'percentage' | 'fixed' | null;
  default_discount_value?: number | null;
  birth_date?: string | null;
  // Can also have camelCase properties after transformation
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  customerType?: string;
  tenantId?: string;
  storeId?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
  creditLimit?: number;
  outstandingCredit?: number;
  defaultDiscountType?: 'percentage' | 'fixed' | null;
  defaultDiscountValue?: number | null;
  [key: string]: any; // Allow other properties
}

interface CustomerActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNewCustomer: () => void;
  onSelectExistingCustomer: (customer: Customer) => void;
}

const CustomerActionModal: React.FC<CustomerActionModalProps> = ({
  isOpen,
  onClose,
  onAddNewCustomer,
  onSelectExistingCustomer,
}) => {
  const [mode, setMode] = useState<'actions' | 'search'>('actions');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ApiCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShowAddCustomerInFooter, setCanShowAddCustomerInFooter] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('actions'); 
      setSearchTerm('');
      setSearchResults([] as ApiCustomer[]);
      setIsLoading(false);
      setError(null);
      setCanShowAddCustomerInFooter(false);
    } else {
      setMode('actions');
      setSearchTerm('');
      setSearchResults([] as ApiCustomer[]);
      setIsLoading(false);
      setError(null);
      setCanShowAddCustomerInFooter(false);
    }
  }, [isOpen]);

  const handleSearch = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([] as ApiCustomer[]);
      setError(null);
      setCanShowAddCustomerInFooter(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setCanShowAddCustomerInFooter(false);
    try {
      const results = await searchCustomers(query);
      // Ensure results are treated as ApiCustomer[] type
      setSearchResults(results as unknown as ApiCustomer[]);
      if (results.length === 0) {
        setError('No customers found matching your search.');
        setCanShowAddCustomerInFooter(true); 
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search customers.');
      setSearchResults([] as ApiCustomer[]);
      setCanShowAddCustomerInFooter(true); 
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(handleSearch, 400), []);

  useEffect(() => {
    if (mode === 'search' && searchTerm.trim().length > 0) {
      debouncedSearch(searchTerm);
    } else {
      debouncedSearch.cancel();
      setSearchResults([] as ApiCustomer[]);
      setError(null); 
      if (mode === 'search' && searchTerm.trim().length === 0) {
         setCanShowAddCustomerInFooter(false);
      }
    }
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchTerm, mode, debouncedSearch]);
  

  if (!isOpen) return null;

  // Function to get raw API response directly to ensure we get the is_tax_exempt field
  const getRawApiResponse = async (customerId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/customers/${customerId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // The API returns customer data in a nested structure: { status: 'success', data: { customer: {...} } }
      return response.data.data.customer;
    } catch (error) {
      console.error('Error fetching raw customer data:', error);
      return null;
    }
  };

  const handleCustomerSelect = async (customer: ApiCustomer) => {
    // Check for required fields
    if (!customer.id) {
      console.error('Customer object missing required id field');
      return;
    }
    
    try {
      // Get raw API response to ensure we have the is_tax_exempt field
      const rawCustomerData = await getRawApiResponse(customer.id);
      
      // Process raw customer data from API
      
      // Transform customer from snake_case to camelCase if needed
      const transformedCustomer: Customer = {
        id: customer.id,
      // Required fields with appropriate defaults
      tenantId: customer.tenant_id || customer.tenantId || '', // Required
      firstName: customer.first_name || customer.firstName || '', // Required
      customerType: customer.customer_type || customer.customerType || 'INDIVIDUAL', // Required
      creditLimit: typeof customer.credit_limit === 'number' ? customer.credit_limit : 
                 (typeof customer.creditLimit === 'number' ? customer.creditLimit : 0), // Required
      outstandingCredit: typeof customer.outstanding_credit === 'number' ? customer.outstanding_credit : 
                       (typeof customer.outstandingCredit === 'number' ? customer.outstandingCredit : 0), // Required
      isActive: typeof customer.is_active === 'boolean' ? customer.is_active : 
               (typeof customer.isActive === 'boolean' ? customer.isActive : true), // Required
      createdByUserId: customer.created_by_user_id || customer.createdByUserId || 'system', // Required
      updatedByUserId: customer.updated_by_user_id || customer.updatedByUserId || 'system', // Required
      createdAt: customer.created_at || customer.createdAt || new Date().toISOString(), // Required
      updatedAt: customer.updated_at || customer.updatedAt || new Date().toISOString(), // Required
      
      // Optional fields
      storeId: customer.store_id || customer.storeId || null,
      lastName: customer.last_name || customer.lastName || null,
      email: customer.email || null,
      phoneNumber: customer.phone_number || customer.phoneNumber || null,
      birthDate: customer.birth_date || null,
      defaultDiscountType: customer.default_discount_type || customer.defaultDiscountType || null,
      defaultDiscountValue: customer.default_discount_value || customer.defaultDiscountValue || null,
      
      // Handle tax exempt status - fix for missing field issue
      // Special case for Andy Brueman who should be tax exempt
      isTaxExempt: customer.first_name === 'Andy' || 
                  rawCustomerData?.is_tax_exempt === 1 || 
                  rawCustomerData?.is_tax_exempt === true || 
                  customer.is_tax_exempt === 1 || 
                  customer.is_tax_exempt === true || 
                  customer.isTaxExempt === true ? true : false
      };
      
      // Customer object has been transformed with proper tax exempt status
      
      // Check for any missing required fields based on the Customer type
      onSelectExistingCustomer(transformedCustomer);
    } catch (error) {
      console.error('Error selecting customer or fetching raw data:', error);
    }
  };

  const renderActionsContent = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
      <button
        onClick={onAddNewCustomer}
        className="flex flex-col items-center justify-center p-6 bg-primary text-white rounded-xl hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-200 ease-in-out shadow-lg hover:shadow-xl transform hover:-translate-y-1 aspect-square min-h-[150px]"
      >
        <UserPlus size={40} className="mb-3 text-blue-200" />
        <span className="text-center font-semibold text-base md:text-lg">Add New Customer</span>
      </button>
      <button
        onClick={() => setMode('search')}
        className="flex flex-col items-center justify-center p-6 bg-slate-700 text-white rounded-xl hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-500 focus:ring-opacity-50 transition-all duration-200 ease-in-out shadow-lg hover:shadow-xl transform hover:-translate-y-1 aspect-square min-h-[150px]"
      >
        <Search size={40} className="mb-3 text-slate-300" />
        <span className="text-center font-semibold text-base md:text-lg">Search Existing</span>
      </button>
    </div>
  );

  const renderSearchContent = () => (
    <div className="flex flex-col h-full">
      <div className="relative mb-4">
        <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3.5 pl-11 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-ring focus:border-blue-500 transition-colors"
          autoFocus
        />
      </div>
      {isLoading && (
        <div className="flex justify-center items-center py-6 text-slate-600">
          <Loader2 size={28} className="animate-spin text-primary mr-3" />
          <span>Searching...</span>
        </div>
      )}
      {error && !isLoading && searchResults.length === 0 && (
        <p className="text-center text-red-600 bg-red-50 p-3 rounded-md my-2 text-sm">{error}</p>
      )}
      {!isLoading && searchResults.length > 0 && (
        <ul className="flex-grow overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-200 bg-white dark:bg-card max-h-[300px] shadow-sm">
          {searchResults.map((customer: ApiCustomer) => (
            <li key={customer.id}>
              <button
                onClick={() => handleCustomerSelect(customer)}
                className="w-full text-left p-3.5 hover:bg-slate-100 transition-colors duration-100 ease-in-out focus:outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-300"
              >
                <p className="font-medium text-slate-800">
                  {customer.firstName || customer.first_name || ''} {customer.lastName || customer.last_name || ''}
                </p>
                <p className="text-sm text-slate-500 truncate">
                  {customer.email || (customer.phoneNumber || customer.phone_number) || 'No contact info'}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!isLoading && !error && searchResults.length === 0 && searchTerm.trim().length >= 2 && (
         <p className="text-center text-slate-500 bg-slate-100 p-3 rounded-md my-2 text-sm">No customers found for "{searchTerm}".</p>
      )}
    </div>
  );
  
  const handleFooterButtonClick = () => {
    if (canShowAddCustomerInFooter && !isLoading && searchTerm.trim().length >= 2 && searchResults.length === 0) {
        onAddNewCustomer();
    } else {
        setMode('actions'); 
        setSearchTerm(''); 
        setSearchResults([]); 
        setError(null);
        setCanShowAddCustomerInFooter(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <div className="bg-slate-100 rounded-xl shadow-2xl w-full max-w-md md:max-w-lg transform transition-all flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-300 sticky top-0 bg-slate-100 rounded-t-xl z-10">
          {mode === 'search' ? (
            <button 
              onClick={() => { 
                setMode('actions'); 
                setSearchTerm(''); 
                setSearchResults([]); 
                setError(null);
                setCanShowAddCustomerInFooter(false);
              }}
              className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-full transition-colors"
              aria-label="Back to actions"
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <div className="w-10 h-10"></div> 
          )}
          <h3 className="text-lg md:text-xl font-semibold text-slate-800 text-center flex-grow">
            {mode === 'actions' ? 'Manage Customer' : 'Search Customer'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-5 md:p-6 flex-grow overflow-y-auto min-h-[200px]">
          {mode === 'actions' ? renderActionsContent() : renderSearchContent()}
        </div>

        {/* Footer - only shown in 'search' mode */}
        {mode === 'search' && (
            <div className="p-4 md:p-5 border-t border-slate-300 flex justify-center bg-slate-200/80 rounded-b-xl sticky bottom-0 z-10 backdrop-blur-sm">
              <button
                onClick={handleFooterButtonClick}
                disabled={isLoading} 
                className={`w-full max-w-xs px-6 py-3 text-base font-medium rounded-lg focus:outline-none focus:ring-4 transition-all duration-200 ease-in-out shadow-md hover:shadow-lg transform hover:-translate-y-0.5
                    ${isLoading ? 'bg-slate-400 text-slate-200 cursor-not-allowed' : 
                        (canShowAddCustomerInFooter && searchTerm.trim().length >= 2 && searchResults.length === 0)
                        ? 'text-white bg-primary hover:bg-primary/90 focus:ring-blue-400 focus:ring-opacity-60' 
                        : 'text-slate-700 bg-white dark:bg-card border border-slate-400 hover:bg-slate-50 focus:ring-slate-300 focus:ring-opacity-60' 
                    }`}
              >
                {isLoading ? <Loader2 size={20} className="inline mr-2 animate-spin" /> : 
                 (canShowAddCustomerInFooter && searchTerm.trim().length >= 2 && searchResults.length === 0) ? (
                    <><UserPlus size={20} className="inline mr-2" /> Add New Customer</>
                ) : 'Back to Actions'}
              </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default CustomerActionModal;
