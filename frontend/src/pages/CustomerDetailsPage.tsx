import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Phone, Mail, ExternalLink, MoreHorizontal } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '@/services/axiosConfig';
import CustomerFormModal from '@/components/customers/CustomerFormModal';
import CustomerContactsPanel from '@/components/customers/CustomerContactsPanel';
import CustomerActivityPanel from '@/components/customers/CustomerActivityPanel';
import type { Customer } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// Define tabs for the customer details
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'comments', label: 'Comments' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'mails', label: 'Mails' },
  { id: 'statement', label: 'Statement' }
];

const CustomerDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch customer details
  useEffect(() => {
    const fetchCustomerDetails = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        const response = await axiosInstance.get(`/api/customers/${id}`);
        // Backend GET /api/customers/:id returns customer object directly on success (200)
        if (response.status === 200 && response.data && Object.keys(response.data).length > 0) {
          setCustomer(response.data);
        } else {
          console.warn('Failed to load customer details or unexpected response for GET /api/customers/:id :', response);
          toast.error('Failed to load customer details');
          navigate('/customers');
        }
      } catch (error) {
        console.error('Error fetching customer details:', error);
        toast.error('Error loading customer details. Please try again.');
        navigate('/customers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerDetails();
  }, [id, navigate]);

  // Handle customer update
  const handleSaveCustomer = async (customerData: any) => {
    if (!customer?.id) return;
    
    try {
      const response = await axiosInstance.put(`/api/customers/${customer.id}`, customerData);
      // Backend PUT /api/customers/:id returns updated customer object directly on success (200)
      if (response.status === 200 && response.data && Object.keys(response.data).length > 0) {
        toast.success('Customer updated successfully');
        setCustomer(response.data);
      } else {
        console.warn('Failed to update customer or unexpected response for PUT /api/customers/:id :', response);
        toast.error('Failed to update customer');
      }
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer. Please try again.');
    }
  };

  // Handle customer deletion
  const handleDeleteCustomer = () => {
    if (!customer?.id) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customer?.id) return;
    try {
      const response = await axiosInstance.delete(`/api/customers/${customer.id}`);
      if (response.status === 200 || response.status === 204) {
        toast.success('Customer deleted successfully');
        navigate('/customers');
      } else {
        console.warn('Unexpected response for DELETE /api/customers/:id :', response);
        toast.error('Failed to delete customer');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer. Please try again.');
    } finally {
      setShowDeleteConfirm(false);
      setShowMoreOptions(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-medium">Customer not found</h2>
          <button 
            className="mt-4 text-primary hover:underline flex items-center justify-center mx-auto"
            onClick={() => navigate('/customers')}
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header with back button, customer name, and actions */}
      <div className="flex flex-wrap justify-between items-center mb-6">
        <div className="flex items-center mb-2 sm:mb-0">
          <button 
            onClick={() => navigate('/customers')}
            className="mr-3 p-2 rounded-full hover:bg-background-alt text-text-secondary"
            aria-label="Back to customers"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-semibold text-text-primary">
            {customer.first_name} {customer.last_name || ''}
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 bg-background-alt hover:bg-background-hover text-text-primary rounded-md"
          >
            Edit
          </button>
          <button
            onClick={() => navigate('/customers/new-transaction', { state: { customerId: customer.id } })}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md"
          >
            New Transaction
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="p-2 rounded-md hover:bg-background-alt"
              aria-label="More options"
            >
              <MoreHorizontal size={20} />
            </button>
            {showMoreOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-background-card rounded-md shadow-lg z-10 border border-border">
                <button
                  onClick={handleDeleteCustomer}
                  className="w-full text-left px-4 py-2 text-danger-text hover:bg-background-hover rounded-md"
                >
                  Delete Customer
                </button>
                <button
                  onClick={() => setShowMoreOptions(false)}
                  className="w-full text-left px-4 py-2 text-text-secondary hover:bg-background-hover rounded-md"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer details with sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left sidebar - Customer list */}
        <div className="w-full lg:w-64 bg-background-card rounded-lg shadow-md overflow-hidden h-fit">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-text-primary flex items-center">
              Active Customers
            </h3>
          </div>
          <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
            {/* Customer list would be dynamically generated here */}
            <div className="p-3 border-l-2 border-primary bg-background-hover">
              <div className="font-medium">{customer.first_name} {customer.last_name || ''}</div>
              <div className="text-sm text-text-secondary">
                {customer.outstanding_credit ? `$${customer.outstanding_credit.toFixed(2)}` : '$0.00'}
              </div>
            </div>
            {/* This would be a list of other customers */}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1">
          {/* Customer header card */}
          <div className="bg-background-card rounded-lg shadow-md p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between">
              <div>
                <h2 className="text-lg font-medium mb-4">{customer.first_name} {customer.last_name || ''}</h2>
                
                {/* Contact information */}
                <div className="flex flex-col space-y-2">
                  {customer.phone_number && (
                    <div className="flex items-center">
                      <Phone size={16} className="mr-2 text-text-secondary" />
                      <a href={`tel:${customer.phone_number}`} className="text-text-primary hover:text-primary">
                        {customer.phone_number}
                      </a>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center">
                      <Mail size={16} className="mr-2 text-text-secondary" />
                      <a href={`mailto:${customer.email}`} className="text-text-primary hover:text-primary">
                        {customer.email}
                      </a>
                    </div>
                  )}
                  {customer.website && (
                    <div className="flex items-center">
                      <ExternalLink size={16} className="mr-2 text-text-secondary" />
                      <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-text-primary hover:text-primary">
                        {customer.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Payment info */}
              <div className="mt-4 sm:mt-0">
                <div className="text-sm text-text-secondary mb-1">Payment due period</div>
                <div className="font-medium">Due On Receipt</div>
              </div>
            </div>
          </div>

          {/* Tabs navigation */}
          <div className="border-b border-border mb-6">
            <nav className="flex space-x-6">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="bg-background-card rounded-lg shadow-md overflow-hidden">
            {activeTab === 'overview' && (
              <div>
                {/* Address section */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-text-primary">ADDRESS</h3>
                    <button className="text-primary hover:text-primary-dark">
                      <Edit size={16} />
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="text-sm text-text-secondary mb-1">Billing Address</h4>
                    <div>
                      {customer.address_line1 && <div>{customer.address_line1}</div>}
                      {customer.address_line2 && <div>{customer.address_line2}</div>}
                      {customer.city && <div>{customer.city}{customer.state_province ? `, ${customer.state_province}` : ''}</div>}
                      {customer.postal_code && <div>{customer.postal_code}</div>}
                      {customer.country && <div>{customer.country}</div>}
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm text-text-secondary mb-1">Shipping Address</h4>
                    <div className="text-text-secondary italic">No Shipping Address - New Address</div>
                  </div>
                </div>

                {/* Other details section */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-text-primary">OTHER DETAILS</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <h4 className="text-sm text-text-secondary mb-1">Customer Type</h4>
                      <div>{customer.customer_type || 'Individual'}</div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm text-text-secondary mb-1">Default Currency</h4>
                      <div>{customer.currency_code || 'USD'}</div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm text-text-secondary mb-1">Portal Status</h4>
                      <div className="flex items-center">
                        <span className="inline-block w-2 h-2 rounded-full bg-danger-text mr-1"></span>
                        <span>Disabled</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm text-text-secondary mb-1">Portal Language</h4>
                      <div>English</div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm text-text-secondary mb-1">Source</h4>
                      <div>{customer.referral_source || 'Manual Entry'}</div>
                    </div>
                  </div>
                </div>

                {/* Contact persons section */}
                <div className="p-4">
                  <CustomerContactsPanel customerId={customer.id} />
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="p-6 text-center text-text-secondary">
                Comments feature coming soon
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="p-6 text-center text-text-secondary">
                No transactions found for this customer
              </div>
            )}

            {activeTab === 'mails' && (
              <div className="p-6 text-center text-text-secondary">
                Email communication history coming soon
              </div>
            )}

            {activeTab === 'statement' && (
              <div className="p-6 text-center text-text-secondary">
                Financial statements coming soon
              </div>
            )}
          </div>

          {/* Financial Summary */}
          <div className="mt-6 bg-background-card rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-text-primary">Receivables</h3>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-text-secondary mb-1">CURRENCY</div>
                <div>{customer.currency_code || 'USD'}</div>
              </div>
              <div>
                <div className="text-sm text-text-secondary mb-1">OUTSTANDING RECEIVABLES</div>
                <div>{customer.outstanding_credit ? `$${customer.outstanding_credit.toFixed(2)}` : '$0.00'}</div>
              </div>
              <div>
                <div className="text-sm text-text-secondary mb-1">UNUSED CREDITS</div>
                <div>$0.00</div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="mt-6 bg-background-card rounded-lg shadow-md overflow-hidden">
            <div className="p-4">
              <CustomerActivityPanel customerId={customer.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      <CustomerFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveCustomer}
        customer={customer}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
        title="Delete customer?"
        description={customer ? `Are you sure you want to delete ${customer.firstName} ${customer.lastName || ''}? This action cannot be undone.` : 'This action cannot be undone.'}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteCustomer}
      />
    </div>
  );
};

export default CustomerDetailsPage;
