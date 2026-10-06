import React, { useState, useEffect } from 'react';
import { X, Search, Tag, Percent, DollarSign } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { PromotionalOffer, CartItemDiscount } from '@/types/discount';
import { useCurrency } from '@/contexts/LocalizationContext';
import { EnhancedCartItem } from '@/types/index';

interface ItemDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}

const ItemDiscountModal: React.FC<ItemDiscountModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName
}) => {
  const { availableOffers, applyItemDiscount, removeItemDiscount, items } = useCart();
  const { formatCurrency } = useCurrency();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOffers, setFilteredOffers] = useState<PromotionalOffer[]>([]);
  
  // Find the current cart item
  const cartItem = items.find(item => item.product.id === productId);
  
  // Filter offers when search term or available offers change
  useEffect(() => {
    if (!availableOffers) {
      setFilteredOffers([]);
      return;
    }
    
    if (!searchTerm) {
      setFilteredOffers(availableOffers);
      return;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = availableOffers.filter(offer => 
      offer.name.toLowerCase().includes(lowerSearchTerm) || 
      offer.description?.toLowerCase().includes(lowerSearchTerm)
    );
    
    setFilteredOffers(filtered);
  }, [searchTerm, availableOffers]);
  
  if (!isOpen || !cartItem) return null;
  
  // Check if a discount is already applied to this item
  const isDiscountApplied = (offerId: string) => {
    return cartItem.appliedDiscounts.some(discount => discount.offerId === offerId);
  };
  
  // Format discount value based on type. PromotionalOffer (see
  // discountService.ts's transformApiOffer) carries `offerType`/
  // `discountValue` — this used to read `offer.type`/`offer.value`, fields
  // that don't exist on the type, so every offer rendered the literal
  // string "undefined" here instead of "20%" etc.
  const formatDiscountValue = (offer: PromotionalOffer) => {
    switch (offer.offerType) {
      case 'percentage_discount':
        return `${offer.discountValue}%`;
      case 'fixed_discount':
        return formatCurrency(offer.discountValue);
      default:
        return `${offer.discountValue}`;
    }
  };

  // Get icon based on offer type
  const getOfferIcon = (offerType: string) => {
    switch (offerType) {
      case 'percentage_discount':
        return <Percent className="h-4 w-4" />;
      case 'fixed_discount':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Tag className="h-4 w-4" />;
    }
  };
  
  // Handle applying or removing a discount
  const toggleDiscount = (offer: PromotionalOffer) => {
    if (isDiscountApplied(offer.id)) {
      removeItemDiscount(productId, offer.id);
    } else {
      applyItemDiscount(productId, offer.id);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-foreground">
            Item Discounts: {productName}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:text-muted-foreground p-1 rounded-full hover:bg-gray-100 dark:bg-muted"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Search */}
        <div className="px-6 py-4 border-b">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Search offers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        
        {/* Offers List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredOffers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-muted-foreground">
              No offers available
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredOffers.map(offer => (
                <li 
                  key={offer.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    isDiscountApplied(offer.id) 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleDiscount(offer)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        isDiscountApplied(offer.id) 
                          ? 'bg-blue-100 text-primary' 
                          : 'bg-gray-100 dark:bg-muted text-gray-600'
                      }`}>
                        {getOfferIcon(offer.offerType)}
                      </div>
                      <div>
                        <h4 className="font-medium">{offer.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-muted-foreground">
                          {formatDiscountValue(offer)}
                        </p>
                      </div>
                    </div>
                    <div className={`h-6 w-6 rounded-full border flex items-center justify-center ${
                      isDiscountApplied(offer.id)
                        ? 'border-blue-500 bg-primary text-white'
                        : 'border-gray-300'
                    }`}>
                      {isDiscountApplied(offer.id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {offer.description && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-muted-foreground">{offer.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemDiscountModal;
