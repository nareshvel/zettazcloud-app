import React, { useState, useEffect } from 'react';
import { X, Calendar, Tag, Percent, DollarSign, Package, BarChart, Plus, Trash2, Hash, CheckCircle, FolderOpen } from 'lucide-react';
import { PromotionalOffer, OfferRule, RuleType, OfferType } from '@/types/discount';
import { fetchApi } from '@/services/api';
import NumericInput from '@/components/ui/NumericInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAuth } from '@/contexts/AuthContext';

interface OfferFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (offer: Partial<PromotionalOffer>) => void;
  offer: PromotionalOffer | null;
}

// Tab configuration removed - not currently used in this component

const OfferFormModal: React.FC<OfferFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  offer
}) => {
  const isEditing = !!offer;
  
  // Form submission state (tab navigation not implemented yet)
  
  // Form state
  const [formData, setFormData] = useState<Partial<PromotionalOffer>>({
    name: '',
    description: '',
    offerType: undefined,
    discountValue: 0,
    minimumQuantity: 1,
    minimumPurchaseAmount: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isActive: true,
    maxTotalUses: 0,
    priority: 0,
    rules: []
  });
  
  // Rules state
  const [selectedRuleType, setSelectedRuleType] = useState<RuleType>('all_products');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  
  // Products and categories for rule selection
  const [products, setProducts] = useState<{id: string, name: string}[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [loadingEntities, setLoadingEntities] = useState<boolean>(false);
  
  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Initialize the currency formatter
  const { format: formatCurrency } = useCurrencyFormatter();
  
  // Get store_id from auth context
  const { user } = useAuth();

  // Helper function to get entity name from ID
  const getEntityName = (rule: OfferRule): string => {
    if (rule.ruleType === 'all_products') {
      return 'All Products';
    } else if (rule.ruleType === 'product' && rule.entityId) {
      const product = products.find(p => p.id === rule.entityId);
      return product ? product.name : (loadingEntities ? 'Loading...' : `Product (${rule.entityId.slice(0, 8)}...)`);
    } else if (rule.ruleType === 'category' && rule.entityId) {
      const category = categories.find(c => c.id === rule.entityId);
      return category ? category.name : (loadingEntities ? 'Loading...' : `Category (${rule.entityId.slice(0, 8)}...)`);
    }
    return 'Unknown Rule';
  };

  // Function to fetch products (only when needed)
  const fetchProductsIfNeeded = async () => {
    if (products.length > 0 || loadingEntities) return; // Already loaded or loading
    
    setLoadingEntities(true);
    try {
      const data = await fetchApi<{ products: any[] } | any[]>('/products?limit=100');
      
      let formattedProducts: { id: string; name: string }[] = [];
      if (data && typeof data === 'object' && 'products' in data && Array.isArray(data.products)) {
        formattedProducts = data.products.map((product: any) => ({
          id: product.id,
          name: product.name
        }));
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        formattedProducts = data.data.map((product: any) => ({
          id: product.id,
          name: product.name
        }));
      } else if (Array.isArray(data)) {
        formattedProducts = data.map((product: any) => ({
          id: product.id,
          name: product.name
        }));
      } else {
        console.warn('Products data is not in expected format:', data);
      }
      
      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoadingEntities(false);
    }
  };

  // Function to fetch categories (only when needed)
  const fetchCategoriesIfNeeded = async () => {
    if (categories.length > 0 || loadingEntities) return; // Already loaded or loading
    
    setLoadingEntities(true);
    try {
      const data = await fetchApi<{ categories: any[] } | any[]>('/categories');
      
      let formattedCategories: { id: string; name: string }[] = [];
      if (data && typeof data === 'object' && 'categories' in data && Array.isArray(data.categories)) {
        formattedCategories = data.categories.map((category: any) => ({
          id: category.id,
          name: category.name
        }));
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        formattedCategories = data.data.map((category: any) => ({
          id: category.id,
          name: category.name
        }));
      } else if (Array.isArray(data)) {
        formattedCategories = data.map((category: any) => ({
          id: category.id,
          name: category.name
        }));
      } else {
        console.warn('Categories data is not in expected format:', data);
      }
      
      setCategories(formattedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoadingEntities(false);
    }
  };

  // Handle rule type change - fetch data only when needed
  const handleRuleTypeChange = (ruleType: RuleType) => {
    setSelectedRuleType(ruleType);
    setSelectedEntityId(''); // Reset entity selection
    
    // Lazy load only when needed
    if (ruleType === 'product') {
      fetchProductsIfNeeded();
    } else if (ruleType === 'category') {
      fetchCategoriesIfNeeded();
    }
  };

  // Handle adding a new rule
  const handleAddRule = () => {
    const newRule: Partial<OfferRule> & { entityName?: string } = {
      id: `temp-rule-${Date.now()}`,
      ruleType: selectedRuleType,
      entityId: selectedRuleType === 'all_products' ? undefined : selectedEntityId,
      quantity: selectedQuantity,
      entityName: getEntityName({ ruleType: selectedRuleType, entityId: selectedEntityId } as OfferRule)
    };
    
    setFormData(prev => ({
      ...prev,
      rules: [...(prev.rules || []), newRule as any]
    }));
    
    // Reset rule inputs
    setSelectedRuleType('all_products');
    setSelectedEntityId('');
    setSelectedQuantity(1);
  };
  
  // Handle removing a rule
  const handleRemoveRule = (ruleId: string) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).filter(rule => rule.id !== ruleId)
    }));
  };
  
  // Handle numeric input changes
  const handleNumericChange = (field: string) => (value: number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value || 0
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Handle date changes
  const handleDateChange = (field: string) => (date: Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: date ? date.toISOString().split('T')[0] : ''
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Handle change for form fields
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Handle checkbox inputs
    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData(prev => ({
        ...prev,
        [name]: target.checked
      }));
    }
    // For numeric fields, convert to number or keep as empty string if empty
    else if (['discountValue', 'minimumQuantity', 'minimumPurchaseAmount', 'maxTotalUses', 'priority'].includes(name)) {
      const numericValue = value === '' ? 0 : parseFloat(value);
      
      // Special handling for maxTotalUses - allow 0 for unlimited
      if (name === 'maxTotalUses') {
        setFormData(prev => ({
          ...prev,
          [name]: value === '' ? 0 : Math.max(0, numericValue)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: value === '' ? 0 : numericValue
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // Validate form before submission
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Basic required field validation
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.offerType) {
      newErrors.offerType = 'Offer type is required';
    }
    
    // Validate discount value based on offer type
    if (formData.offerType === 'percentage_discount') {
      if (formData.discountValue === undefined || formData.discountValue === null) {
        newErrors.discountValue = 'Discount percentage is required';
      } else if (formData.discountValue <= 0 || formData.discountValue > 100) {
        newErrors.discountValue = 'Discount percentage must be between 0 and 100';
      }
    } else if (formData.offerType === 'fixed_discount') {
      if (formData.discountValue === undefined || formData.discountValue === null) {
        newErrors.discountValue = 'Discount amount is required';
      } else if (formData.discountValue <= 0) {
        newErrors.discountValue = 'Discount amount must be greater than 0';
      }
    } else if (formData.offerType === 'buy_x_get_y') {
      if (formData.minimumQuantity === undefined || formData.minimumQuantity < 1) {
        newErrors.minimumQuantity = 'Required purchase quantity (X) must be at least 1';
      }
      if (formData.discountValue === undefined || formData.discountValue < 1) {
        newErrors.discountValue = 'Free items quantity (Y) must be at least 1';
      }
    } else if (formData.offerType === 'bundle_price') {
      if (formData.minimumQuantity === undefined || formData.minimumQuantity < 2) {
        newErrors.minimumQuantity = 'Bundle quantity must be at least 2';
      }
      if (formData.discountValue === undefined || formData.discountValue <= 0) {
        newErrors.discountValue = 'Bundle price must be greater than 0';
      }
    } else if (formData.offerType === 'tiered_pricing') {
      if (formData.minimumQuantity === undefined || formData.minimumQuantity < 1) {
        newErrors.minimumQuantity = 'Base tier quantity must be at least 1';
      }
      if (formData.discountValue === undefined || formData.discountValue <= 0) {
        newErrors.discountValue = 'Base tier price must be greater than 0';
      }
    }
    
    // Validate dates
    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }
    
    // Validate rules for specific offer types
    if (['buy_x_get_y', 'bundle_price', 'tiered_pricing'].includes(formData.offerType as string) && 
        (!formData.rules || formData.rules.length === 0)) {
      newErrors.rules = 'At least one product or category rule must be defined for this offer type';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    
    // Ensure we have a user and storeId
    if (!user || !user.storeId) {
      console.error('User or store ID not available');
      return;
    }
    
    onSave(formData);
  };
  
  // Initialize form with offer data when editing
  useEffect(() => {
    if (offer) {
      console.log('🔧 [OfferFormModal] Initializing form with offer:', offer);
      console.log('🔧 [OfferFormModal] Original offerType:', offer.offerType, 'Type:', typeof offer.offerType);
      
      // Handle potential snake_case to camelCase conversion for offerType
      let normalizedOfferType = offer.offerType;
      
      // If offerType comes as snake_case from backend, convert to expected format
      if (typeof offer.offerType === 'string') {
        const offerTypeMapping: Record<string, OfferType> = {
          'percentage_discount': 'percentage_discount',
          'fixed_discount': 'fixed_discount', 
          'buy_x_get_y': 'buy_x_get_y',
          'bundle_price': 'bundle_price',
          'tiered_pricing': 'tiered_pricing',
          // Handle potential backend variations
          'percent_discount': 'percentage_discount',
          'fixed_amount_discount': 'fixed_discount',
          'buy_get_free': 'buy_x_get_y'
        };
        
        normalizedOfferType = offerTypeMapping[offer.offerType] || offer.offerType;
      }
      
      console.log('🔧 [OfferFormModal] Normalized offerType:', normalizedOfferType);
      
      const formDataToSet = {
        ...offer,
        // Ensure offerType is properly normalized
        offerType: normalizedOfferType,
        // Ensure numeric fields are properly converted from strings to numbers
        discountValue: offer.discountValue ? Number(offer.discountValue) : 0,
        minimumQuantity: offer.minimumQuantity ? Number(offer.minimumQuantity) : 1,
        minimumPurchaseAmount: offer.minimumPurchaseAmount ? Number(offer.minimumPurchaseAmount) : 0,
        maxTotalUses: offer.maxTotalUses ? Number(offer.maxTotalUses) : 0,
        priority: offer.priority ? Number(offer.priority) : 0,
        startDate: offer.startDate ? new Date(offer.startDate).toISOString().split('T')[0] : '',
        endDate: offer.endDate ? new Date(offer.endDate).toISOString().split('T')[0] : '',
        rules: offer.rules || []
      };
      
      console.log('🔧 [OfferFormModal] Setting form data:', formDataToSet);
      setFormData(formDataToSet);

      // Preload entities for existing rules to display proper names
      if (offer.rules && offer.rules.length > 0) {
        const hasProductRules = offer.rules.some(rule => rule.ruleType === 'product');
        const hasCategoryRules = offer.rules.some(rule => rule.ruleType === 'category');
        
        if (hasProductRules) {
          fetchProductsIfNeeded();
        }
        if (hasCategoryRules) {
          fetchCategoriesIfNeeded();
        }
      }
    } else {
      // Reset form for new offer
      setFormData({
        name: '',
        description: '',
        offerType: undefined,
        discountValue: 0,
        minimumQuantity: 1,
        minimumPurchaseAmount: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        isActive: true,
        maxTotalUses: 0,
        priority: 0,
        rules: []
      });
    }
  }, [offer]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Clear loaded data when modal closes to free memory
      setProducts([]);
      setCategories([]);
      setLoadingEntities(false);
      setSelectedRuleType('all_products');
      setSelectedEntityId('');
      setSelectedQuantity(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-lg">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <Tag className="mr-2" />
            {isEditing ? 'Edit Offer' : 'Create New Offer'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>
        
        {/* Form Content */}
        <form id="offer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Basic Information */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
                <div className="flex items-center mb-4">
                  <Tag className="mr-2 text-blue-500" size={20} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-foreground">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                      Offer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="e.g., Summer Sale 20% Off"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                  </div>
                  
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                      Promotion Code
                    </label>
                    <input
                      type="text"
                      id="code"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="e.g., SUMMER20 (optional)"
                    />
                    <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Leave empty for automatic offers</div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Describe what this offer does and when it applies..."
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Offer Type Selection */}
            <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
              <div className="flex items-center mb-4">
                <BarChart className="mr-2 text-blue-500" size={20} />
                <h3 className="text-lg font-medium text-gray-900 dark:text-foreground">Offer Type & Configuration</h3>
              </div>
              
              <div>
                <label htmlFor="offerType" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                  Choose Offer Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="offerType"
                  name="offerType"
                  value={formData.offerType || ''}
                  onChange={(e) => {
                    console.log('🔧 [OfferFormModal] Dropdown changed to:', e.target.value);
                    handleChange(e);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select an offer type...</option>
                  <option value="percentage_discount">📊 Percentage Discount</option>
                  <option value="fixed_discount">💰 Fixed Amount Discount</option>
                  <option value="buy_x_get_y">🎁 Buy X Get Y Free</option>
                  <option value="bundle_price">📦 Bundle Price</option>
                  <option value="tiered_pricing">📈 Tiered Pricing</option>
                </select>
                {errors.offerType && <p className="mt-1 text-sm text-red-500">{errors.offerType}</p>}
                
                {/* Offer Type Description */}
                {formData.offerType && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-muted/50 rounded-lg border">
                    <div className="text-sm font-medium text-gray-800 dark:text-foreground mb-2">
                      {formData.offerType === 'percentage_discount' && '📊 How Percentage Discount Works'}
                      {formData.offerType === 'fixed_discount' && '💰 How Fixed Amount Discount Works'}
                      {formData.offerType === 'buy_x_get_y' && '🎁 How Buy X Get Y Free Works'}
                      {formData.offerType === 'bundle_price' && '📦 How Bundle Pricing Works'}
                      {formData.offerType === 'tiered_pricing' && '📈 How Tiered Pricing Works'}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-muted-foreground space-y-1">
                      {formData.offerType === 'percentage_discount' && (
                        <>
                          <div>• Customers get a percentage off their purchase</div>
                          <div>• <strong>Example:</strong> "25% off all electronics" - $100 item becomes $75</div>
                          <div>• Great for seasonal sales and general promotions</div>
                        </>
                      )}
                      {formData.offerType === 'fixed_discount' && (
                        <>
                          <div>• Customers get a fixed dollar amount off their purchase</div>
                          <div>• <strong>Example:</strong> "$10 off orders over $50" - $60 order becomes $50</div>
                          <div>• Perfect for encouraging larger purchases</div>
                        </>
                      )}
                      {formData.offerType === 'buy_x_get_y' && (
                        <>
                          <div>• Customers buy a certain quantity and get additional items free</div>
                          <div>• <strong>Example:</strong> "Buy 2 Get 1 Free" - Customer pays for 2, gets 3 total</div>
                          <div>• Excellent for moving inventory and increasing order size</div>
                        </>
                      )}
                      {formData.offerType === 'bundle_price' && (
                        <>
                          <div>• Customers get a special price when buying multiple items together</div>
                          <div>• <strong>Example:</strong> "3 T-shirts for $45" instead of $20 each ($60 total)</div>
                          <div>• Ideal for combo deals and package promotions</div>
                        </>
                      )}
                      {formData.offerType === 'tiered_pricing' && (
                        <>
                          <div>• Price per item decreases as customers buy more quantity</div>
                          <div>• <strong>Example:</strong> "1-5 items: $10 each, 6-10 items: $9 each, 11+ items: $8 each"</div>
                          <div>• Perfect for wholesale pricing and bulk sales</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Discount Configuration */}
            <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
              <div className="flex items-center mb-4">
                <div className="flex items-center">
                  {formData.offerType === 'percentage_discount' ? 
                    <Percent className="mr-1 text-blue-500" size={20} /> : 
                    <DollarSign className="mr-1 text-green-500" size={20} />
                  }
                  <h3 className="text-lg font-medium text-gray-900 dark:text-foreground">
                    {formData.offerType === 'percentage_discount' && 'Percentage Discount Configuration'}
                    {formData.offerType === 'fixed_discount' && 'Fixed Amount Discount Configuration'}
                    {formData.offerType === 'buy_x_get_y' && 'Buy X Get Y Free Configuration'}
                    {formData.offerType === 'bundle_price' && 'Bundle Pricing Configuration'}
                    {formData.offerType === 'tiered_pricing' && 'Tiered Pricing Configuration'}
                    {!formData.offerType && 'Discount Configuration'}
                  </h3>
                </div>
              </div>
              
              {/* Configuration Help Text */}
              {formData.offerType && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-800">
                    {formData.offerType === 'percentage_discount' && (
                      <div>
                        <strong>💡 Configuration Guide:</strong> Set the percentage discount customers will receive. 
                        You can also set minimum quantity or purchase amount requirements.
                      </div>
                    )}
                    {formData.offerType === 'fixed_discount' && (
                      <div>
                        <strong>💡 Configuration Guide:</strong> Set the fixed dollar amount customers will save. 
                        Typically used with minimum purchase requirements to encourage larger orders.
                      </div>
                    )}
                    {formData.offerType === 'buy_x_get_y' && (
                      <div>
                        <strong>💡 Configuration Guide:</strong> Set how many items customers get free (Y) and how many they need to buy (X). 
                        Don't forget to specify which products this applies to in the rules section below.
                      </div>
                    )}
                    {formData.offerType === 'bundle_price' && (
                      <div>
                        <strong>💡 Configuration Guide:</strong> Set the special bundle price and how many items are included. 
                        Make sure to add product rules below to specify which items are part of the bundle.
                      </div>
                    )}
                    {formData.offerType === 'tiered_pricing' && (
                      <div>
                        <strong>💡 Configuration Guide:</strong> Set your base price and minimum quantity for the first tier. 
                        Higher tiers will automatically offer better prices as customers buy more.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    <div className="flex items-center">
                      {formData.offerType === 'percentage_discount' ? 
                        <Percent className="mr-1 text-blue-500" size={16} /> : 
                        <DollarSign className="mr-1 text-green-500" size={16} />
                      }
                      <span>
                        {formData.offerType === 'percentage_discount' ? 'Discount Percentage (%)' : 
                         formData.offerType === 'fixed_discount' ? `Discount Amount (${formatCurrency(0).replace('0', '').trim()})` :
                         formData.offerType === 'buy_x_get_y' ? 'Free Items Quantity (Y)' :
                         formData.offerType === 'bundle_price' ? `Bundle Price (${formatCurrency(0).replace('0', '').trim()})` :
                         formData.offerType === 'tiered_pricing' ? 'Base Price (Tier 1)' : 'Discount Value'} <span className="text-red-500">*</span>
                      </span>
                    </div>
                  </label>
                  <NumericInput
                    value={formData.discountValue || 0}
                    onChange={handleNumericChange('discountValue')}
                    decimalPlaces={formData.offerType === 'percentage_discount' ? 2 : 2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errors.discountValue && <p className="mt-1 text-sm text-red-500">{errors.discountValue}</p>}
                </div>
                
                <div>
                  <label htmlFor="minimumQuantity" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    <div className="flex items-center">
                      <Package className="mr-1 text-blue-500" size={16} />
                      {formData.offerType === 'buy_x_get_y' ? 'Required Purchase Quantity (X)' :
                       formData.offerType === 'bundle_price' ? 'Bundle Quantity' :
                       formData.offerType === 'tiered_pricing' ? 'Base Tier Quantity (Min)' : 'Minimum Quantity'}
                    </div>
                  </label>
                  <NumericInput
                    value={formData.minimumQuantity || 1}
                    onChange={handleNumericChange('minimumQuantity')}
                    decimalPlaces={0}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errors.minimumQuantity && <p className="mt-1 text-sm text-red-500">{errors.minimumQuantity}</p>}
                </div>
              </div>

              {/* Tiered Pricing Configuration */}
              {formData.offerType === 'tiered_pricing' && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border">
                  <h4 className="text-md font-medium text-blue-900 mb-3">📊 Price Tiers Configuration</h4>
                  <div className="text-sm text-primary mb-4">
                    Define different price points based on quantity purchased. Base tier uses values above.
                  </div>
                  
                  <div className="bg-white dark:bg-card rounded p-3 border">
                    <div className="text-sm font-medium text-gray-700 dark:text-foreground mb-2">🎯 Tiered Pricing Example:</div>
                    <div className="text-xs text-gray-600 dark:text-muted-foreground space-y-1">
                      <div>• <strong>Tier 1:</strong> 1-{formData.minimumQuantity || 1} items = {formatCurrency(formData.discountValue || 0)} each</div>
                      <div>• <strong>Tier 2:</strong> {(formData.minimumQuantity || 1) + 1}-10 items = {formatCurrency((formData.discountValue || 0) * 0.9)} each</div>
                      <div>• <strong>Tier 3:</strong> 11+ items = {formatCurrency((formData.discountValue || 0) * 0.8)} each</div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                    <div className="text-sm font-medium text-yellow-800">⚡ Advanced Tier Configuration</div>
                    <div className="text-xs text-yellow-700 mt-1">
                      Full tiered pricing editor with custom tiers will be available in the next update. 
                      Current implementation uses base price with automatic 10% and 20% discounts for higher tiers.
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Configuration */}
              {!['tiered_pricing'].includes(formData.offerType as string) && (
                <div className="mt-4">
                  <label htmlFor="minimumPurchaseAmount" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                    <div className="flex items-center">
                      <DollarSign className="mr-1 text-green-500" size={16} />
                      Minimum Purchase Amount (Optional) {formatCurrency(0).replace('0', '').trim()}
                    </div>
                  </label>
                  <NumericInput
                    value={formData.minimumPurchaseAmount || 0}
                    onChange={handleNumericChange('minimumPurchaseAmount')}
                    decimalPlaces={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
            </div>
            
            {/* Validity and Limits */}
            <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
              <div className="flex items-center mb-4">
                <Calendar className="mr-2 text-blue-500" size={20} />
                <h3 className="text-lg font-medium text-gray-900 dark:text-foreground">Schedule & Usage Limits</h3>
              </div>
              
              {/* Help Text */}
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm text-green-800">
                  <strong>📅 Scheduling & Limits Guide:</strong> Control when your offer is active and how many times it can be used. 
                  This helps you manage your promotions budget and create urgency for customers.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date Range */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-800 dark:text-foreground mb-4 flex items-center">
                    <Calendar className="mr-2 text-blue-500" size={18} />
                    Offer Schedule
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <DatePicker
                        date={formData.startDate ? new Date(formData.startDate) : undefined}
                        setDate={handleDateChange('startDate')}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">When the offer becomes active</div>
                      {errors.startDate && <p className="mt-1 text-sm text-red-500">{errors.startDate}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                        End Date (Optional)
                      </label>
                      <DatePicker
                        date={formData.endDate ? new Date(formData.endDate) : undefined}
                        setDate={handleDateChange('endDate')}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Leave empty for indefinite duration</div>
                      {errors.endDate && <p className="mt-1 text-sm text-red-500">{errors.endDate}</p>}
                    </div>
                  </div>
                </div>

                {/* Usage Limits */}
                <div className="md:col-span-2">
                  <h4 className="text-md font-medium text-gray-800 dark:text-foreground mb-4 flex items-center">
                    <BarChart className="mr-2 text-green-500" size={18} />
                    Usage Limits
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="maxTotalUses" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                        Total Usage Limit
                      </label>
                      <NumericInput
                        value={formData.maxTotalUses || 0}
                        onChange={handleNumericChange('maxTotalUses')}
                        decimalPlaces={0}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">0 = unlimited usage</div>
                    </div>
                    
                    <div>
                      <label htmlFor="maxUsesPerCustomer" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                        Per Customer Limit
                      </label>
                      <NumericInput
                        value={formData.maxUsesPerCustomer || 0}
                        onChange={handleNumericChange('maxUsesPerCustomer')}
                        decimalPlaces={0}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">0 = no per-customer limit</div>
                    </div>
                    
                    <div>
                      <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                        Priority Level
                      </label>
                      <NumericInput
                        value={formData.priority || 0}
                        onChange={handleNumericChange('priority')}
                        decimalPlaces={0}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Higher number = higher priority</div>
                    </div>
                  </div>
                  
                  {/* Usage Limits Help */}
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-xs text-primary">
                      <strong>💡 Usage Tips:</strong>
                      <div className="mt-1 space-y-1">
                        <div>• <strong>Total Limit:</strong> Cap how many times this offer can be used across all customers</div>
                        <div>• <strong>Per Customer:</strong> Prevent abuse by limiting uses per individual customer</div>
                        <div>• <strong>Priority:</strong> When multiple offers apply, higher priority takes precedence</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Product Rules Section */}
            {['buy_x_get_y', 'bundle_price', 'tiered_pricing'].includes(formData.offerType as string) && (
              <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
                <div className="flex items-center mb-4">
                  <Package className="mr-2 text-blue-500" size={20} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-foreground">Product & Category Rules</h3>
                </div>
                
                {/* Rules Help Text */}
                <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-sm text-amber-800">
                    {formData.offerType === 'buy_x_get_y' && (
                      <div>
                        <strong>🎯 Rule Purpose:</strong> Define which products or categories this "Buy X Get Y" offer applies to. 
                        Customers must purchase the specified items to get the free items.
                      </div>
                    )}
                    {formData.offerType === 'bundle_price' && (
                      <div>
                        <strong>🎯 Rule Purpose:</strong> Select which products are included in your bundle. 
                        Customers must buy the specified quantity from these items to get the bundle price.
                      </div>
                    )}
                    {formData.offerType === 'tiered_pricing' && (
                      <div>
                        <strong>🎯 Rule Purpose:</strong> Choose which products have tiered pricing. 
                        The more customers buy from these items, the better price they get per item.
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Rule Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                      <div className="flex items-center">
                        <Tag className="mr-1 text-blue-500" size={16} />
                        Rule Type
                      </div>
                    </label>
                    <select
                      value={selectedRuleType}
                      onChange={(e) => handleRuleTypeChange(e.target.value as RuleType)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all_products">🌟 All Products</option>
                      <option value="product">🛍️ Specific Product</option>
                      <option value="category">📂 Product Category</option>
                    </select>
                    <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                      {selectedRuleType === 'all_products' && 'Applies to all products in your store'}
                      {selectedRuleType === 'product' && 'Choose a specific product'}
                      {selectedRuleType === 'category' && 'Choose an entire product category'}
                    </div>
                  </div>

                  {selectedRuleType !== 'all_products' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                        <div className="flex items-center">
                          {selectedRuleType === 'product' ? 
                            <Package className="mr-1 text-green-500" size={16} /> : 
                            <FolderOpen className="mr-1 text-purple-500" size={16} />
                          }
                          Select {selectedRuleType === 'product' ? 'Product' : 'Category'}
                        </div>
                      </label>
                      <select
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={loadingEntities}
                      >
                        <option value="">
                          {loadingEntities ? 'Loading...' : `Choose ${selectedRuleType}...`}
                        </option>
                        {selectedRuleType === 'product' && products.map(product => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                        {selectedRuleType === 'category' && categories.map(category => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                      <div className="flex items-center">
                        <Hash className="mr-1 text-blue-500" size={16} />
                        {formData.offerType === 'buy_x_get_y' ? 'Required Quantity (X)' : 
                         formData.offerType === 'bundle_price' ? 'Bundle Quantity' : 'Minimum Quantity'}
                      </div>
                    </label>
                    <NumericInput
                      value={selectedQuantity}
                      onChange={(value) => setSelectedQuantity(value || 1)}
                      decimalPlaces={0}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                      {formData.offerType === 'buy_x_get_y' && 'How many items customer must buy'}
                      {formData.offerType === 'bundle_price' && 'Items included in bundle'}
                      {formData.offerType === 'tiered_pricing' && 'Minimum items for this tier'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddRule}
                  disabled={selectedRuleType !== 'all_products' && !selectedEntityId}
                  className="mb-6 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Plus className="mr-2" size={16} />
                  Add Rule
                </button>

                {/* Applied Rules */}
                {formData.rules && formData.rules.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-3 flex items-center">
                      <CheckCircle className="mr-2 text-green-500" size={16} />
                      Applied Rules ({formData.rules.length})
                    </h5>
                    <ul className="space-y-3">
                      {formData.rules.map((rule, index) => (
                        <li key={rule.id || `rule-${index}`} className="flex items-center justify-between bg-gray-50 dark:bg-muted/50 p-2 rounded">
                          <div>
                            <span className="text-sm">
                              {getEntityName(rule)}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-muted-foreground block">
                              Qty: {rule.quantity} | Type: {rule.ruleType}
                            </span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveRule(rule.id)}
                            className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {errors.rules && <p className="text-red-500 text-xs mt-1">{errors.rules}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
        
        {/* Form Actions */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/50 px-6 py-4 rounded-b-lg">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={!!formData.isActive}
                onChange={handleChange}
                className="h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm font-medium text-gray-700 dark:text-foreground">
                Activate this offer immediately
              </label>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-foreground bg-gray-200 dark:bg-muted border border-gray-300 dark:border-border rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={false}
              className="px-6 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isEditing ? 'Update Offer' : 'Create Offer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferFormModal;
