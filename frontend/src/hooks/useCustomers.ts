import { useState, useEffect, useCallback, useMemo } from 'react';
// Import Customer and CreateCustomerPayload from @/types.
// UpdateCustomerPayload will be Partial<Customer>.
// CustomersResponse is not imported from @/types; response structure is handled inline.
// NewCustomerData might not be needed if form submission uses CreateCustomerPayload.
import type { Customer, CreateCustomerPayload, NewCustomerData } from '@/types'; 
import { getCustomers, getCustomer, createCustomer as apiCreateCustomer, updateCustomer as apiUpdateCustomer } from '@/services/api';
import { toast } from 'react-toastify';

export interface AdvancedFilters {
  email: string;
  phone: string;
  customerType: string;
  status: string;
}

export interface UseCustomersOptions {
  initialItemsPerPage?: number;
}

export interface UseCustomersReturn {
  customers: Customer[];
  filteredCustomers: Customer[];
  totalCustomersCount: number;
  newCustomersThisMonthCount: number;
  activeCustomersCount: number;
  inactiveCustomersCount: number;
  isLoading: boolean;
  error: Error | null;
  currentPage: number;
  itemsPerPage: number;
  searchTerm: string;
  advancedFilters: AdvancedFilters;
  isFilterPanelOpen: boolean;
  customerToEdit: Customer | null;
  isModalOpen: boolean;
  fetchCustomersData: () => Promise<void>;
  handleSearchChange: (newSearchTerm: string) => void;
  handleAdvancedFilterChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  applyAdvancedFilters: () => void;
  resetAdvancedFilters: () => void;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (count: number) => void;
  toggleFilterPanel: () => void;
  openModalWithCustomer: (customer?: Customer) => Promise<void>;
  closeModal: () => void;
  handleFormSubmit: (data: CreateCustomerPayload | Partial<Customer>) => Promise<void>; // Changed NewCustomerData to CreateCustomerPayload and UpdateCustomerPayload to Partial<Customer>
  // Add functions for POS specific quick search and add if needed
}

const initialAdvancedFiltersState: AdvancedFilters = {
  email: '',
  phone: '',
  customerType: '',
  status: '',
};

export const useCustomers = (options?: UseCustomersOptions): UseCustomersReturn => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(options?.initialItemsPerPage || 10);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(initialAdvancedFiltersState);
  const [activeAdvancedFilters, setActiveAdvancedFilters] = useState<AdvancedFilters>(initialAdvancedFiltersState);

  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchCustomersData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In a real scenario, pagination and filtering would be done server-side.
      // For now, we fetch all and filter client-side, which is not scalable.
      // This will be adjusted if the API supports server-side filtering/pagination.
      const response = await getCustomers(); // Type is inferred or define inline if needed
      // Assuming response is an object like { customers: Customer[] }
      setCustomers(response.customers || []); 
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch customers'));
      toast.error('Failed to load customers.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomersData();
  }, [fetchCustomersData]);

  const filteredCustomers = useMemo(() => {
    return customers
      .filter(customer => {
        const term = searchTerm.toLowerCase();
        const nameMatch = customer.firstName?.toLowerCase().includes(term) || 
                          customer.lastName?.toLowerCase().includes(term);
        const emailMatch = customer.email?.toLowerCase().includes(term);
        const phoneMatch = customer.phoneNumber?.includes(searchTerm); // searchTerm for phone might not need toLowerCase if it's typically numbers
        return nameMatch || emailMatch || phoneMatch;
      })
      .filter(customer => 
        (!activeAdvancedFilters.email || customer.email?.toLowerCase().includes(activeAdvancedFilters.email.toLowerCase())) &&
        (!activeAdvancedFilters.phone || customer.phoneNumber?.includes(activeAdvancedFilters.phone)) && // Use phoneNumber
        (!activeAdvancedFilters.customerType || customer.customerType === activeAdvancedFilters.customerType) && // Use customerType
        (!activeAdvancedFilters.status || (activeAdvancedFilters.status === 'active' ? customer.isActive : !customer.isActive)) // Use isActive
      );
  }, [customers, searchTerm, activeAdvancedFilters]);

  // Metrics Calculations
  const totalCustomersCount = useMemo(() => filteredCustomers.length, [filteredCustomers]);
  
  const newCustomersThisMonthCount = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return filteredCustomers.filter(customer => {
      if (!customer.createdAt) return false; // Use createdAt
      const createdAtDate = new Date(customer.createdAt); // Use createdAt
      return createdAtDate.getMonth() === currentMonth && createdAtDate.getFullYear() === currentYear;
    }).length;
  }, [filteredCustomers]);

  const activeCustomersCount = useMemo(() => 
    filteredCustomers.filter(customer => customer.isActive).length // Use isActive
  , [filteredCustomers]);

  const inactiveCustomersCount = useMemo(() => 
    filteredCustomers.filter(customer => !customer.isActive).length // Use isActive
  , [filteredCustomers]);

  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleAdvancedFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAdvancedFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyAdvancedFilters = () => {
    setActiveAdvancedFilters(advancedFilters);
    setCurrentPage(1); // Reset to first page
  };

  const resetAdvancedFilters = () => {
    setAdvancedFilters(initialAdvancedFiltersState);
    setActiveAdvancedFilters(initialAdvancedFiltersState);
    setCurrentPage(1);
  };

  const toggleFilterPanel = () => setIsFilterPanelOpen(prev => !prev);

  const openModalWithCustomer = async (customer?: Customer) => {
    if (customer && customer.id) {
      setIsLoading(true); // Consider a specific loading state for the modal form
      try {
        const fullCustomerDetails = await getCustomer(customer.id);
        setCustomerToEdit(fullCustomerDetails);
      } catch (err) {
        console.error('Failed to fetch customer details for editing:', err);
        toast.error('Failed to load customer details. Please try again.');
        setError(err instanceof Error ? err : new Error('Failed to load customer details'));
        setIsLoading(false);
        return; // Don't open modal if fetching details fails
      }
      setIsLoading(false);
    } else {
      setCustomerToEdit(null); // For new customer
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCustomerToEdit(null);
  };

  // Updated handleFormSubmit to accept CreateCustomerPayload for new customers
  // and Partial<Customer> for updates. The 'id' check distinguishes them.
  const handleFormSubmit = async (data: CreateCustomerPayload | Partial<Customer>) => {
    setIsLoading(true); // Consider a specific loading state for form submission
    try {
      // Prepare data for API: convert nulls to undefined for optional numeric fields
      const apiPayload = { ...data };
      if (apiPayload.creditLimit === null) {
        apiPayload.creditLimit = undefined;
      }
      if (apiPayload.defaultDiscountValue === null) {
        apiPayload.defaultDiscountValue = undefined;
      }

      // Check if 'id' exists and is truthy to determine if it's an update (Partial<Customer> with id)
      // or creation (CreateCustomerPayload which might not have id or it's undefined)
      if ('id' in apiPayload && apiPayload.id) { 
        // This is an update operation, data should be Partial<Customer>
        // Ensure apiUpdateCustomer expects (id: string, payload: Partial<Customer>)
        await apiUpdateCustomer(apiPayload.id, apiPayload as Partial<Customer>); 
        toast.success('Customer updated successfully!');
      } else {
        // This is a create operation, data should be CreateCustomerPayload
        // Ensure customerType is a string, defaulting if undefined
        if (apiPayload.customerType === undefined) {
          apiPayload.customerType = 'INDIVIDUAL'; // Default value
        }
        // Asserting as NewCustomerData (or a compatible type for the API function)
        // as apiPayload now guarantees customerType is a string.
        await apiCreateCustomer(apiPayload as NewCustomerData); 
        toast.success('Customer created successfully!');
      }
      await fetchCustomersData(); // Refresh data
      closeModal();
    } catch (err) {
      console.error('Failed to save customer:', err);
      const errorMessage = (err instanceof Error && err.message) ? err.message : 'Failed to save customer. Please check the details and try again.';
      toast.error(errorMessage);
      setError(err instanceof Error ? err : new Error('Failed to save customer'));
    }
    setIsLoading(false);
  };

  return {
    customers,
    filteredCustomers,
    totalCustomersCount,
    newCustomersThisMonthCount,
    activeCustomersCount,
    inactiveCustomersCount,
    isLoading,
    error,
    currentPage,
    itemsPerPage,
    searchTerm,
    advancedFilters,
    isFilterPanelOpen,
    customerToEdit,
    isModalOpen,
    fetchCustomersData,
    handleSearchChange,
    handleAdvancedFilterChange,
    applyAdvancedFilters,
    resetAdvancedFilters,
    setCurrentPage,
    setItemsPerPage,
    toggleFilterPanel,
    openModalWithCustomer,
    closeModal,
    handleFormSubmit,
  };
};
