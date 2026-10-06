import { Product } from '@/types';
import { useCurrency } from '@/contexts/LocalizationContext';
import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { normalizeImageUrl } from '@/utils/imageUtils';

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
}

const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  const { formatCurrency } = useCurrency();
  const [imageSource, setImageSource] = useState<string>('/images/default_product.png');
  const { hasActiveOfferForProduct } = useCart();
  
  useEffect(() => {
    if (product.imageUrl) {
      const finalImageUrl = normalizeImageUrl(product.imageUrl) || '/images/default_product.png';
      setImageSource(finalImageUrl);
    } else {
      setImageSource('/images/default_product.png');
    }
  }, [product.imageUrl, product.name]);
  

  
  // Surface up to 3 industry-specific attributes (e.g. jewelry purity/weight/hallmark)
  const attributeChips: string[] = (() => {
    const attrs = (product as any).attributes;
    if (!attrs || typeof attrs !== 'object') return [];
    return Object.entries(attrs)
      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
      .slice(0, 3)
      .map(([, v]) => String(v));
  })();

  const isOutOfStock = product.stockQuantity <= 0;
  const stockStatus = isOutOfStock ? 'out' : product.stockQuantity <= 5 ? 'low' : 'in';
  const stockStatusInfo = {
    out: { color: 'bg-red-500', animationClass: '' }, // Solid red, no animation for out of stock
    low: { color: 'bg-yellow-500', animationClass: 'animate-pulse-stock' }, // Solid yellow, pulse for low stock
    in: { color: 'bg-green-500', animationClass: 'animate-pulse-stock' } // Solid green, pulse for in stock
  }[stockStatus];

  return (
    <button 
      onClick={() => !isOutOfStock && onAddToCart()}
      disabled={isOutOfStock}
      className={`group h-full flex flex-col bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden transition-all duration-300 ${
        isOutOfStock 
          ? 'opacity-70 cursor-not-allowed' 
          : 'hover:shadow-lg hover:-translate-y-1 cursor-pointer'
      }`}
    >
      {/* Image Container - Slightly smaller with 4:3 aspect ratio */}
      <div className="relative w-full pt-[75%] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
        <img 
          src={imageSource} 
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/images/default_product.png';
          }}
        />

        {/* Stock Status Circle */}
        <div 
          title={stockStatus === 'out' ? 'Out of stock' : stockStatus === 'low' ? `Low stock (${product.stockQuantity})` : 'In stock'}
          className={`absolute top-3 right-3 w-3 h-3 rounded-full shadow-md ${stockStatusInfo.color} ${stockStatusInfo.animationClass}`}>
        </div>

        {/* Hover overlay for better feedback */}
        {!isOutOfStock && (
          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
        )}
      </div>
      
      {/* Product Details */}
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex-grow">
          <h3 className="font-semibold text-gray-900 dark:text-foreground text-sm sm:text-base mb-1 line-clamp-2 leading-tight min-h-[2.5rem] flex items-start">
            {product.name}
          </h3>
          {attributeChips.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {attributeChips.map((chip, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-auto pt-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900 dark:text-foreground">
                {formatCurrency(product.price)}
              </span>
              
              {product.id && hasActiveOfferForProduct(product.id) && (
                <div className="flex items-center mt-1">
                  <Tag className="h-3 w-3 text-primary mr-1" />
                  <span className="text-xs text-primary font-medium">
                    Special offer available
                  </span>
                </div>
              )}
            </div>
            
            {product.stockQuantity > 0 && (
              <span className={`text-xs px-2 py-1 rounded-full ${product.stockQuantity <= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                {product.stockQuantity} left
              </span>
            )}
          </div>
        </div>
        
        {/* Removed SKU/Barcode section as requested */}
      </div>
    </button>
  );
};

export default ProductCard;