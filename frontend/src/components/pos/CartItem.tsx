import React, { useState } from 'react';
import { Trash2, PlusCircle, MinusCircle, Tag, Scale } from 'lucide-react';
import { EnhancedCartItem as CartItemType } from '@/types'; // Using enhanced cart item type
import { useCurrency } from '@/contexts/LocalizationContext';
import { useIndustry } from '@/hooks/useIndustry';
import ItemDiscountModal from './ItemDiscountModal';
import JewelryPricingModal from './JewelryPricingModal';

interface CartItemProps {
  item: CartItemType;
  onRemove: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity }) => {
  const { formatCurrency } = useCurrency();
  const { product, quantity, appliedDiscounts = [], finalPrice = product.price, jewelryPricing } = item;
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isJewelryModalOpen, setIsJewelryModalOpen] = useState(false);
  const { industry } = useIndustry();
  const isJewelry = industry === 'jewelry';
  
  // Calculate the total discount amount for this item
  const totalDiscountAmount = appliedDiscounts?.reduce(
    (sum, discount) => sum + discount.discountAmount,
    0
  ) || 0;
  
  // Check if this item has any discounts applied
  const hasDiscounts = appliedDiscounts && appliedDiscounts.length > 0;

  return (
    <>
      <div className="flex flex-col py-3 px-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-slate-800 truncate">{product.name}</h4>
            <div className="flex items-center text-sm">
              {hasDiscounts ? (
                <>
                  <span className="line-through text-slate-400 mr-2">
                    {formatCurrency(product.price)}
                  </span>
                  <span className="text-green-600 font-medium">
                    {formatCurrency(finalPrice)}
                  </span>
                </>
              ) : (
                <span className="text-slate-500">
                  {formatCurrency(product.price)}
                </span>
              )}
              <span className="text-slate-500 mx-1">x</span>
              <span className="text-slate-500">{quantity}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            {isJewelry && (
              <button
                onClick={() => setIsJewelryModalOpen(true)}
                className={`p-1 ${jewelryPricing ? 'text-amber-600 hover:text-amber-700' : 'text-slate-500 hover:text-primary'}`}
                aria-label="Weight & purity pricing"
                title="Weight & purity pricing"
              >
                <Scale size={18} />
              </button>
            )}
            <button
              onClick={() => setIsDiscountModalOpen(true)}
              className={`p-1 ${hasDiscounts ? 'text-green-600 hover:text-green-700' : 'text-slate-500 hover:text-primary'}`}
              aria-label="Apply discount"
              title="Apply item discount"
            >
              <Tag size={18} />
            </button>
            <button
              onClick={() => onUpdateQuantity(product.id, quantity - 1)}
              className="p-1 text-slate-500 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <MinusCircle size={20} />
            </button>
            <span className="w-6 text-center text-sm font-medium text-slate-700">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity(product.id, quantity + 1)}
              className="p-1 text-slate-500 hover:text-primary"
              aria-label="Increase quantity"
            >
              <PlusCircle size={20} />
            </button>
            <button
              onClick={() => onRemove(product.id)}
              className="p-1 text-red-500 hover:text-red-700"
              aria-label="Remove item"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        
        {/* Display applied discounts */}
        {hasDiscounts && (
          <div className="mt-1 text-xs text-green-600">
            {appliedDiscounts.map((discount, index) => (
              <div key={discount.offerId} className="flex items-center">
                <span className="mr-1">•</span>
                <span>{discount.offerName}: -{formatCurrency(discount.discountAmount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Item Discount Modal */}
      {isDiscountModalOpen && (
        <ItemDiscountModal
          isOpen={isDiscountModalOpen}
          onClose={() => setIsDiscountModalOpen(false)}
          productId={product.id}
          productName={product.name}
        />
      )}

      {/* Jewelry Weight & Purity Pricing Modal */}
      {isJewelryModalOpen && (
        <JewelryPricingModal
          isOpen={isJewelryModalOpen}
          onClose={() => setIsJewelryModalOpen(false)}
          productId={product.id}
          productName={product.name}
        />
      )}
    </>
  );
};

export default CartItem;
