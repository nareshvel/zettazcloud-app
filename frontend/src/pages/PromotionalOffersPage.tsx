import React, { useState, useEffect } from 'react';
import { usePromotionalOffersData } from '@/hooks/usePromotionalOffersData';
import { useNavigate } from 'react-router-dom';
import { 
  Edit, Trash2, Tag, Calendar
} from 'lucide-react';
import { PromotionalOffer } from '@/types/discount';
// Dynamic imports for discountService functions
import { useCurrency } from '@/contexts/LocalizationContext';
import { useStore } from '@/contexts/StoreContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import OfferFormModalTabbed from '@/components/promotions/OfferFormModalTabbed';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal';
import UniversalListControls, { FilterOption } from '@/components/UniversalListControls';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import PageHeader from '@/components/common/PageHeader';

const PromotionalOffersPage: React.FC = () => {
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { store } = useStore();
  
  // Data fetching
  const { data: offers, isLoading, error, refresh } = usePromotionalOffersData();

  // UI and filtering state
  const [filteredOffers, setFilteredOffers] = useState<PromotionalOffer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);

  const offerFilterOptions: FilterOption[] = [
    { value: null, label: 'All Statuses' },
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
  ];

  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<PromotionalOffer | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const totalPages = Math.ceil(filteredOffers.length / itemsPerPage);

  // Helper Functions (formatters)
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      const dateFormat = (store?.dateFormat?.replace('YYYY', 'yyyy')?.replace('DD', 'dd')) ?? 'MM/dd/yyyy';
      return format(date, dateFormat);
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Error';
    }
  };

  const formatOfferType = (type: string | undefined) => {
    if (!type) return 'Unknown';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatDiscountValue = (offer: PromotionalOffer) => {
    switch (offer.offerType) {
      case 'percentage_discount':
        return `${offer.discountValue}%`;
      case 'fixed_discount':
        return formatCurrency(Number(offer.discountValue));
      case 'buy_x_get_y':
        return `Buy ${offer.minimumQuantity}, Get ${offer.discountValue} Free`;
      case 'bundle_price':
        return `${offer.minimumQuantity} for ${formatCurrency(Number(offer.discountValue))}`;
      case 'tiered_pricing':
        return `${offer.discountValue}% off ${offer.minimumQuantity}+`;
      default:
        return `${offer.discountValue}`;
    }
  };
  
  // Define columns for the ReusableTable
  const columns: ColumnDefinition<PromotionalOffer>[] = [
    {
      accessor: 'name',
      Header: 'Name',
      Cell: (data: PromotionalOffer) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 rounded-full">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 dark:text-foreground">{data.name}</div>
            {data.description && (
              <div className="text-sm text-gray-500 dark:text-muted-foreground truncate max-w-xs">
                {data.description}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      accessor: 'offerType',
      Header: 'Type',
      Cell: (data: PromotionalOffer) => (
        <div className="text-sm text-gray-900 dark:text-foreground">{formatOfferType(data.offerType)}</div>
      )
    },
    {
      accessor: 'discountValue',
      Header: 'Value',
      Cell: (data: PromotionalOffer) => (
        <div className="text-sm text-gray-900 dark:text-foreground">{formatDiscountValue(data)}</div>
      )
    },
    {
      accessor: 'startDate',
      Header: 'Dates',
      Cell: (data: PromotionalOffer) => (
        <div className="flex items-center text-sm text-gray-900 dark:text-foreground">
          <Calendar size={14} className="mr-1" />
          <span>
            {formatDate(data.startDate)}
            {data.endDate ? ` - ${formatDate(data.endDate)}` : ' (No end date)'}
          </span>
        </div>
      )
    },
    {
      accessor: 'isActive',
      Header: 'Status',
      Cell: (data: PromotionalOffer) => (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
          data.isActive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 dark:bg-muted text-gray-600'
        }`}>
          {data.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      accessor: 'id',
      Header: 'Actions',
      Cell: (data: PromotionalOffer) => (
        <div className="flex justify-end">
          <button
            disabled={isActionLoading}
            onClick={async () => {
              setIsActionLoading(true);
              try {
                const { getOfferById } = await import('@/services/discountService');
                const completeOffer = await getOfferById(data.id);
                if (completeOffer) {
                  setCurrentOffer(completeOffer);
                  setIsFormModalOpen(true);
                } else {
                  toast.error('Could not load offer details');
                }
              } catch (error) {
                console.error('Error loading offer for edit:', error);
                toast.error('Failed to load offer details');
              } finally {
                setIsActionLoading(false);
              }
            }}
            className="text-primary hover:text-blue-900 mr-3 disabled:opacity-50"
          >
            <Edit size={18} />
          </button>
          <button
            disabled={isActionLoading}
            onClick={() => {
              setCurrentOffer(data);
              setIsDeleteModalOpen(true);
            }}
            className="text-red-600 hover:text-red-900 disabled:opacity-50"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )
    }
  ];
  
  // Filter and sort offers
  useEffect(() => {
    if (!offers) {
      setFilteredOffers([]);
      return;
    };
    let result = [...offers];
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(offer => 
        offer.name.toLowerCase().includes(lowerSearchTerm) ||
        (offer.description && offer.description.toLowerCase().includes(lowerSearchTerm))
      );
    }
    
    if (filterActive !== null) {
      result = result.filter(offer => offer.isActive === filterActive);
    }
    
    // Sorting logic can be re-added here if ReusableTable supports it in the future
    
    setFilteredOffers(result);
    setCurrentPage(1);
  }, [offers, searchTerm, filterActive]);
  
  // Event Handlers
  
  const handleSaveOffer = async (offerData: Partial<PromotionalOffer>) => {
    setIsActionLoading(true);
    try {
      const { createOffer, updateOffer } = await import('@/services/discountService');
      if (currentOffer) {
        await updateOffer(currentOffer.id, offerData);
        toast.success('Offer updated successfully');
      } else {
        await createOffer(offerData);
        toast.success('Offer created successfully');
      }
      refresh();
      setIsFormModalOpen(false);
      setCurrentOffer(null);
    } catch (err) {
      console.error('Error saving offer:', err);
      toast.error('Failed to save offer');
      // Rethrow so the modal can set error state / keep form open appropriately
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };
  
  const handleDeleteOffer = async () => {
    if (!currentOffer) return;
    setIsActionLoading(true);
    try {
      const { deleteOffer } = await import('@/services/discountService');
      await deleteOffer(currentOffer.id);
      toast.success('Offer deleted successfully');
      refresh();
      setIsDeleteModalOpen(false);
      setCurrentOffer(null);
    } catch (err) {
      console.error('Error deleting offer:', err);
      toast.error('Failed to delete offer');
    } finally {
      setIsActionLoading(false);
    }
  };

  const paginatedOffers = filteredOffers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (error) {
    return <div className="p-8 text-center text-red-600">Error loading offers: {error.message}</div>;
  }
  
  return (
    <>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <PageHeader
          icon={Tag}
          title="Promotional Offers"
          subtitle="Create, manage, and track your promotional campaigns and discount offers."
        />

        <UniversalListControls
          currentPage="promotions"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholderText="Search offers..."
          filterOptions={offerFilterOptions}
          currentFilterValue={filterActive}
          onFilterOptionSelect={(value) => setFilterActive(value as boolean | null)}
          defaultFilterButtonText="Status"
          newButtonText="New"
          onNewButtonClick={() => {
            setCurrentOffer(null);
            setIsFormModalOpen(true);
          }}
          showFilterButton={true}
          showExportButton={false}
          showNewButton={true}
          showBulkApplyButton={true}
          bulkApplyButtonText="Bulk Apply"
          onBulkApplyClick={() => navigate('/promotions/apply')}
        />

        <div className="bg-white dark:bg-card rounded-lg shadow-sm overflow-hidden">
          <ReusableTable
            columns={columns}
            data={paginatedOffers}
            isLoading={isLoading}
            noDataMessage={
              searchTerm || filterActive !== null
                ? "No offers found matching your search or filters."
                : "No promotional offers found. Click 'New Offer' to create your first offer."
            }
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredOffers.length}
          />
        </div>
      </div>

      {isFormModalOpen && (
        <OfferFormModalTabbed
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setCurrentOffer(null);
          }}
          onSave={handleSaveOffer}
          offer={currentOffer as any}
        />
      )}

      {isDeleteModalOpen && currentOffer && (
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteOffer}
          title="Delete Offer"
          message={`Are you sure you want to delete the offer "${currentOffer.name}"? This action cannot be undone.`}
        />
      )}
    </>
  );
};

export default PromotionalOffersPage;
