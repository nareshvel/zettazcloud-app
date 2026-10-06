import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { X, Calendar, Tag, Percent, Package, CheckCircle, Settings, Plus, Trash2, AlertCircle } from 'lucide-react';
import { PromotionalOffer, OfferRule, RuleType } from '@/types/discount';

// Define the PriceTier interface locally if not already available in types
interface PriceTier {
  id: string;
  quantity: number;
  price: number;
}

// Extend PromotionalOffer to include priceTiers
interface ExtendedPromotionalOffer extends PromotionalOffer {
  priceTiers?: PriceTier[];
}
import { fetchApi } from '@/services/api';
import NumericInput from '@/components/ui/NumericInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAuth } from '@/contexts/AuthContext';

interface OfferFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (offer: Partial<ExtendedPromotionalOffer>) => void;
  offer: ExtendedPromotionalOffer | null;
}

// Tab configuration for wizard navigation
const TABS = [
  { id: 'basic', label: 'Basic Info', icon: Package, description: 'Name, type, and description' },
  { id: 'discount', label: 'Discount', icon: Percent, description: 'Configure discount values' },
  { id: 'rules', label: 'Rules', icon: Settings, description: 'Product and category rules' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, description: 'Dates and usage limits' },
  { id: 'review', label: 'Review', icon: CheckCircle, description: 'Review and submit' }
];

const OfferFormModalTabbed: React.FC<OfferFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  offer
}) => {
  const isEditing = !!offer;
  const { user } = useAuth();
  const { format: formatCurrency } = useCurrencyFormatter();
  
  // Tab navigation state
  const [currentTab, setCurrentTab] = useState('basic');
  const [completedTabs, setCompletedTabs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Form state
  const [formData, setFormData] = useState<Partial<ExtendedPromotionalOffer>>({
    name: '',
    description: '',
    offerType: undefined,
    discountValue: 0,
    minimumQuantity: 1,
    minimumPurchaseAmount: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    maxTotalUses: 0,
    maxUsesPerCustomer: 0,
    priority: 0,
    isActive: true,
    appliesToAllStores: false,
    rules: [],
    priceTiers: []
  } as any);

  // Entity loading state
  const [products, setProducts] = useState<Array<{id: string, name: string}>>([]);
  const [categories, setCategories] = useState<Array<{id: string, name: string}>>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Rule form state
  const [selectedRuleType, setSelectedRuleType] = useState<RuleType>('all_products');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});



  // Tiered pricing handlers
  const handleAddPriceTier = () => {
    // Add a new tier with more logical increments
    const newTiers = [...(formData.priceTiers || [])];
    const lastTier = newTiers.length > 0 ? newTiers[newTiers.length - 1] : null;
    const minQuantity = formData.minimumQuantity || 1;
    const discountVal = formData.discountValue || 0;
    
    // Create more intuitive quantity increments
    let newQuantity;
    if (!lastTier) {
      // First tier after base: double the minimum quantity
      newQuantity = minQuantity * 2;
      // Round to nearest multiple of 5 for better UX
      newQuantity = Math.ceil(newQuantity / 5) * 5;
    } else if (minQuantity < 10) {
      // For small quantities, increment by 5
      newQuantity = lastTier.quantity + 5;
    } else {
      // For larger quantities, increment by 10
      newQuantity = lastTier.quantity + 10;
    }
    
    // Better pricing logic: 5-10% discount from previous tier
    const discountFactor = 0.95; // 5% discount
    const newPrice = lastTier 
      ? Math.round((lastTier.price * discountFactor) * 100) / 100
      : Math.round((discountVal * discountFactor) * 100) / 100;
    
    newTiers.push({
      id: `tier-${Date.now()}`,
      quantity: newQuantity,
      price: newPrice,
    });
    
    setFormData((prev: Partial<ExtendedPromotionalOffer>) => ({
      ...prev,
      priceTiers: newTiers
    }));
  };

  const handleUpdatePriceTier = (index: number, field: string, value: number | null) => {
    const updatedTiers = [...(formData.priceTiers || [])];
    updatedTiers[index] = { 
      ...updatedTiers[index], 
      [field]: value !== null ? value : 0 
    };
    
    setFormData((prev: Partial<ExtendedPromotionalOffer>) => ({ 
      ...prev, 
      priceTiers: updatedTiers 
    }));
  };

  const handleRemovePriceTier = (index: number) => {
    const updatedTiers = [...(formData.priceTiers || [])];
    updatedTiers.splice(index, 1);
    
    setFormData((prev: Partial<ExtendedPromotionalOffer>) => ({ 
      ...prev, 
      priceTiers: updatedTiers 
    }));
  };

  // Handle form input changes
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
    else if (['discountValue', 'minimumQuantity', 'minimumPurchaseAmount', 'maxTotalUses', 'maxUsesPerCustomer', 'priority'].includes(name)) {
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

  // Handle date changes with fixed timezone handling
  const handleDateChange = (field: string) => (date: Date | undefined) => {
    if (!date) {
      setFormData(prev => ({ ...prev, [field]: '' }));
      return;
    }

    // IMPORTANT FIX: Force date to be in local time zone at 12:00 PM to avoid any date shifting
    // Copy the date to avoid mutating the original
    const localDate = new Date(date);
    
    // Set the time to noon (12:00:00) in the local timezone to avoid any crossing of date boundaries
    localDate.setHours(12, 0, 0, 0);
    
    // Create a properly formatted ISO date string (YYYY-MM-DD) without time part
    // This avoids timezone issues when the date is later parsed
    const isoDate = localDate.toISOString().split('T')[0];
    
    console.log(`Date picker: Selected ${field}:`, {
      originalDate: date.toString(),
      selectedDay: date.getDate(),
      formattedIsoDate: isoDate,
    });
    
    setFormData(prev => ({
      ...prev,
      [field]: isoDate
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Validate current tab
  const validateCurrentTab = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentTab === 'basic') {
      if (!formData.name?.trim()) {
        newErrors.name = 'Name is required';
      }
      if (!formData.offerType) {
        newErrors.offerType = 'Offer type is required';
      }
    }

    if (currentTab === 'discount') {
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
    }

    if (currentTab === 'rules') {
      // Validate rules for specific offer types
      if (['buy_x_get_y', 'bundle_price', 'tiered_pricing'].includes(formData.offerType as string) && 
          (!formData.rules || formData.rules.length === 0)) {
        newErrors.rules = 'At least one product or category rule must be defined for this offer type';
      }
    }

    if (currentTab === 'schedule') {
      // Validate dates
      if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate all tabs (used on final submission)
  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Basic tab
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.offerType) {
      newErrors.offerType = 'Offer type is required';
    }

    // Discount tab
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

    // Rules tab
    if ([
      'buy_x_get_y',
      'bundle_price',
      'tiered_pricing',
    ].includes(formData.offerType as string) && (!formData.rules || formData.rules.length === 0)) {
      newErrors.rules = 'At least one product or category rule must be defined for this offer type';
    }

    // Schedule tab
    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle tab navigation - advances to next tab if validation passes
  const goToNextTab = () => {
    // Validate current tab before allowing navigation
    if (validateCurrentTab()) {
      const currentIndex = TABS.findIndex(tab => tab.id === currentTab);
      
      if (currentIndex < TABS.length - 1) {
        // Mark current tab as completed
        if (!completedTabs.includes(currentTab)) {
          setCompletedTabs(prev => [...prev, currentTab]);
        }
        
        // Set the next tab as current
        const nextTabId = TABS[currentIndex + 1].id;
        
        // Explicitly log when navigating to the Review tab
        if (nextTabId === 'review') {
          console.log('Navigating to Review tab - form NOT submitted yet');
          // Reset submission status when navigating to review tab
          setSubmissionStatus('idle');
        }
        
        setCurrentTab(nextTabId);
      }
    }
  };

  const goToPreviousTab = () => {
    const currentIndex = TABS.findIndex(tab => tab.id === currentTab);
    if (currentIndex > 0) {
      setCurrentTab(TABS[currentIndex - 1].id);
    }
  };

  // Guard direct tab clicks: allow backward navigation, validate when moving forward
  const attemptGoToTab = (targetId: string) => {
    const currentIndex = TABS.findIndex(tab => tab.id === currentTab);
    const targetIndex = TABS.findIndex(tab => tab.id === targetId);
    if (targetIndex > currentIndex) {
      if (!validateCurrentTab()) return;
    }
    // Reset submission status when moving to review by navigation
    if (targetId === 'review') {
      setSubmissionStatus('idle');
    }
    setCurrentTab(targetId);
  };
  
  // Create refs to track data fetching status
  const productFetchingRef = useRef(false);
  const categoryFetchingRef = useRef(false);

  // Entity fetching functions - optimized to prevent duplicate calls
  const fetchProductsIfNeeded = async () => {
    // Skip if we already have products or if a fetch is in progress
    if (products.length > 0 || productFetchingRef.current) {
      console.log('Skipping product fetch - already loaded or in progress');
      return;
    }
    
    // Mark that we're fetching products
    productFetchingRef.current = true;
    setLoadingEntities(true);
    console.log('Fetching products...');
    
    try {
      const data = await fetchApi<any>('/products?limit=100');
      console.log('Products API response:', data);
      
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
      }
      
      console.log('Formatted products:', formattedProducts);
      setProducts(formattedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
      setProducts([]);
    } finally {
      setLoadingEntities(false);
      productFetchingRef.current = false;
    }
  };

  const fetchCategoriesIfNeeded = async () => {
    // Skip if we already have categories or if a fetch is in progress
    if (categories.length > 0 || categoryFetchingRef.current) {
      console.log('Skipping category fetch - already loaded or in progress');
      return;
    }
    
    // Mark that we're fetching categories
    categoryFetchingRef.current = true;
    setLoadingEntities(true);
    console.log('Fetching categories...');
    
    try {
      const data = await fetchApi<any>('/categories');
      console.log('Categories API response:', data);
      
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
      }
      
      console.log('Formatted categories:', formattedCategories);
      setCategories(formattedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
      setCategories([]);
    } finally {
      setLoadingEntities(false);
      categoryFetchingRef.current = false;
    }
  };

  // Rule management
  const getEntityName = (rule: OfferRule): string => {
    if (rule.ruleType === 'all_products') return 'All Products';
    if (rule.ruleType === 'product') {
      const product = products.find(p => p.id === rule.entityId);
      return product ? product.name : 'Unknown Product';
    }
    if (rule.ruleType === 'category') {
      const category = categories.find(c => c.id === rule.entityId);
      return category ? category.name : 'Unknown Category';
    }
    return 'Unknown';
  };

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
      rules: [...(prev.rules || []), newRule as OfferRule]
    }));

    // Clear rules error proactively after adding a rule
    if (errors.rules) {
      setErrors(prev => ({
        ...prev,
        rules: ''
      }));
    }

    // Reset form
    setSelectedRuleType('all_products');
    setSelectedEntityId('');
    setSelectedQuantity(1);
  };

  const handleRemoveRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules?.filter((_, i) => i !== index) || []
    }));

    // On remove, re-evaluate rules error in case list becomes empty
    if (['buy_x_get_y', 'bundle_price', 'tiered_pricing'].includes(formData.offerType as string)) {
      const remaining = (formData.rules || []).filter((_, i) => i !== index);
      setErrors(prev => ({
        ...prev,
        rules: remaining.length === 0 ? 'At least one product or category rule must be defined for this offer type' : ''
      }));
    } else if (errors.rules) {
      // For offer types that don't require rules, ensure error is cleared
      setErrors(prev => ({ ...prev, rules: '' }));
    }
  };

  // Handle explicit form submission (only when user clicks Create/Update on Review tab)
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent default browser submission behavior
    e.preventDefault();
    
    // Safety check - we should only be submitting from the review tab
    if (currentTab !== 'review') {
      console.log('Not on review tab, no submission should happen');
      return;
    }
    
    // Validate all tabs/fields before final submission
    if (!validateAll()) {
      console.log('Validation failed, not submitting');
      return;
    }

    // Ensure we have a user and storeId
    if (!user || !user.storeId) {
      console.error('User or store ID not available');
      return;
    }

    console.log('Starting submission process for offer');
    setIsSubmitting(true);
    setSubmissionStatus('idle');
    
    try {
      // Actually save the data
      await onSave(formData);
      console.log('Offer saved successfully');
      
      // Update status to show success message
      setSubmissionStatus('success');
      
      // Show success feedback for a moment before closing
      setTimeout(() => {
        console.log('Closing modal after successful submission');
        onClose();
      }, 2500); // Give user time to see success state
    } catch (error) {
      console.error('Error saving offer:', error);
      setSubmissionStatus('error');
      setIsSubmitting(false); // Reset submitting state on error
    }
  };

  // Load offer data when editing
  useEffect(() => {
    if (offer && isEditing) {
      console.log('Debug - OfferFormModalTabbed - Editing offer:', offer);
      console.log('Debug - OfferFormModalTabbed - Price tiers:', offer.priceTiers);
      setFormData({
        ...offer,
        // Ensure numeric fields are properly converted from strings to numbers
        discountValue: offer.discountValue ? Number(offer.discountValue) : 0,
        minimumQuantity: offer.minimumQuantity ? Number(offer.minimumQuantity) : 1,
        minimumPurchaseAmount: offer.minimumPurchaseAmount ? Number(offer.minimumPurchaseAmount) : 0,
        maxTotalUses: offer.maxTotalUses ? Number(offer.maxTotalUses) : 0,
        maxUsesPerCustomer: offer.maxUsesPerCustomer ? Number(offer.maxUsesPerCustomer) : 0,
        priority: offer.priority ? Number(offer.priority) : 0,
        startDate: offer.startDate ? new Date(offer.startDate).toISOString().split('T')[0] : '',
        endDate: offer.endDate ? new Date(offer.endDate).toISOString().split('T')[0] : '',
        // Ensure boolean coercion for controlled checkbox
        isActive: offer.isActive === undefined ? false : Boolean(offer.isActive),
        // storeId null/undefined means this offer applies tenant-wide
        appliesToAllStores: (offer as any).storeId == null,
        rules: offer.rules || [],
        priceTiers: offer.priceTiers || []
      } as any);

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
        appliesToAllStores: false,
        maxTotalUses: 0,
        maxUsesPerCustomer: 0,
        priority: 0,
        rules: [],
        priceTiers: []
      });
    }
  }, [offer, isEditing]);

  // Add effect to fetch products and categories when Rules tab is active
  useEffect(() => {
    if (isOpen && currentTab === 'rules') {
      console.log('Rules tab is active, fetching products and categories');
      fetchProductsIfNeeded();
      fetchCategoriesIfNeeded();
    }
  }, [isOpen, currentTab]);

  // Re-validate rules requirement when rules or offer type change to prevent stale error messages
  useEffect(() => {
    const requiresRules = ['buy_x_get_y', 'bundle_price', 'tiered_pricing'].includes(formData.offerType as string);
    if (requiresRules) {
      if ((formData.rules || []).length > 0) {
        if (errors.rules) {
          setErrors(prev => ({ ...prev, rules: '' }));
        }
      } else {
        // Only set the error while on rules or review tabs to avoid noisy validation elsewhere
        if (currentTab === 'rules' || currentTab === 'review') {
          setErrors(prev => ({
            ...prev,
            rules: 'At least one product or category rule must be defined for this offer type'
          }));
        }
      }
    } else {
      if (errors.rules) {
        setErrors(prev => ({ ...prev, rules: '' }));
      }
    }
  }, [formData.rules, formData.offerType, currentTab]);

  // Effect to properly handle modal visibility
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
      
      // When opening, only reset if we're not in the middle of a submission
      if (!isSubmitting && submissionStatus === 'idle') {
        // Only reset to basic tab if this is a fresh open, not during submission
        setCurrentTab('basic');
        setCompletedTabs([]);
        setErrors({});
      }
    } else {
      document.body.classList.remove('overflow-hidden');
    }

    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen, isSubmitting, submissionStatus]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Only reset form fields and tab navigation when modal actually closes
      // NOT when transitioning between tabs
      setCurrentTab('basic'); // Start at the beginning tab when reopened
      setCompletedTabs([]); 
      setErrors({});
      setSubmissionStatus('idle');
      setIsSubmitting(false);
      
      // Reset entity selection states
      setProducts([]);
      setCategories([]);
      setLoadingEntities(false);
      setSelectedRuleType('product');
      setSelectedEntityId('');
      setSelectedQuantity(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-[#0f1f3d] rounded-t-lg">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <Tag className="mr-2" />
            {isEditing ? 'Edit Offer' : 'Create New Offer'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/50 px-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              const isCompleted = completedTabs.includes(tab.id);
              
              return (
                <button
                  key={tab.id}
                  onClick={() => attemptGoToTab(tab.id)}
                  className={`
                    flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive 
                      ? 'border-blue-500 text-primary' 
                      : 'border-transparent text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:text-foreground hover:border-gray-300'
                    }
                  `}
                  type="button"
                >
                  <Icon className={`mr-2 h-4 w-4 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                  {tab.label}
                  {isCompleted && <CheckCircle className="ml-2 h-4 w-4 text-green-500" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {currentTab === 'basic' && (
              <BasicInfoTab 
                formData={formData}
                errors={errors}
                onChange={handleChange}
              />
            )}
            {currentTab === 'discount' && (
              <DiscountTab 
                formData={formData}
                errors={errors}
                onNumericChange={handleNumericChange}
                formatCurrency={formatCurrency}
                onAddPriceTier={handleAddPriceTier}
                onUpdatePriceTier={handleUpdatePriceTier}
                onRemovePriceTier={handleRemovePriceTier}
              />
            )}
            {currentTab === 'rules' && (
              <RulesTab 
                formData={formData}
                errors={errors}
                products={products}
                categories={categories}
                loadingEntities={loadingEntities}
                selectedRuleType={selectedRuleType}
                setSelectedRuleType={setSelectedRuleType}
                selectedEntityId={selectedEntityId}
                setSelectedEntityId={setSelectedEntityId}
                selectedQuantity={selectedQuantity}
                setSelectedQuantity={setSelectedQuantity}
                onAddRule={handleAddRule}
                onRemoveRule={handleRemoveRule}
                getEntityName={getEntityName}
              />
            )}
            {currentTab === 'schedule' && (
              <ScheduleTab
                formData={formData}
                errors={errors}
                onDateChange={handleDateChange}
                onNumericChange={handleNumericChange}
                onChange={handleChange}
                isEditing={isEditing}
              />
            )}
            {currentTab === 'review' && (
              <ReviewTab 
                formData={formData}
                formatCurrency={formatCurrency}
                getEntityName={getEntityName}
                isSubmitting={isSubmitting}
                submissionStatus={submissionStatus}
              />
            )}
          </div>
          
          {/* Tab Navigation Footer */}
          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/50">
            <button
              type="button"
              onClick={goToPreviousTab}
              disabled={currentTab === 'basic'}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-foreground bg-gray-200 dark:bg-muted border border-gray-300 dark:border-border rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-foreground bg-gray-200 dark:bg-muted border border-gray-300 dark:border-border rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              
              {currentTab === 'review' ? (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e)}
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      {isEditing ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-1 h-4 w-4" />
                      {isEditing ? 'Update Offer' : 'Create Offer'}
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goToNextTab}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Tab Components
const BasicInfoTab = ({ formData, errors, onChange }: any) => (
  <div className="space-y-6">
    <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-4 flex items-center">
        <Package className="mr-2 text-blue-500" size={20} />
        Basic Information
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
            Offer Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name || ''}
            onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., Summer Sale 20% Off"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
            Offer Type <span className="text-red-500">*</span>
          </label>
          <select
            name="offerType"
            value={formData.offerType || ''}
            onChange={onChange}
            className="w-full p-2 border border-gray-300 dark:border-border rounded-md focus:ring-ring focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select an offer type</option>
            <option value="fixed_discount">Fixed Amount Off</option>
            <option value="percentage_discount">Percentage Discount</option>
            <option value="buy_x_get_y">Buy X Get Y Free</option>
            <option value="bundle_price">Bundle Pricing</option>
            <option value="tiered_pricing">Tiered Pricing</option>
          </select>
          {errors.offerType && <p className="mt-1 text-sm text-red-500">{errors.offerType}</p>}
        </div>
        
        {formData.offerType && (
          <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-100">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">How this offer works:</h4>
            {formData.offerType === 'fixed_discount' && (
              <div className="text-sm text-gray-700 dark:text-foreground">
                <p>Applies a fixed dollar amount discount to eligible products.</p>
                <p className="mt-1 text-primary font-medium">Example: "$5 Off Any Item" - Customers get $5 off a qualifying product.</p>
              </div>
            )}
            {formData.offerType === 'percentage_discount' && (
              <div className="text-sm text-gray-700 dark:text-foreground">
                <p>Applies a percentage discount to eligible products.</p>
                <p className="mt-1 text-primary font-medium">Example: "20% Off All Bakery Items" - Customers get 20% off qualifying bakery products.</p>
              </div>
            )}
            {formData.offerType === 'buy_x_get_y' && (
              <div className="text-sm text-gray-700 dark:text-foreground">
                <p>Customers buy a specified quantity of items and receive additional items free.</p>
                <p className="mt-1 text-primary font-medium">Example: "Buy 2 Coffees, Get 1 Free" - When a customer buys 2 coffees, they receive 1 additional coffee at no cost.</p>
              </div>
            )}
            {formData.offerType === 'bundle_price' && (
              <div className="text-sm text-gray-700 dark:text-foreground">
                <p>Set a special price when customers purchase multiple items together.</p>
                <p className="mt-1 text-primary font-medium">Example: "Lunch Special: Sandwich, Chips & Drink for $10.99" - When purchased together, the bundle costs $10.99 instead of the individual prices.</p>
              </div>
            )}
            {formData.offerType === 'tiered_pricing' && (
              <div className="text-sm text-gray-700 dark:text-foreground">
                <p>Price per unit decreases as quantity purchased increases.</p>
                <p className="mt-1 text-primary font-medium">Example: "T-shirts: $20 each, $18 each when buying 5+, $15 each when buying 10+" - The more customers buy, the less each item costs.</p>
              </div>
            )}
          </div>
        )}
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description || ''}
            onChange={onChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Describe this promotional offer..."
          />
        </div>
      </div>
    </div>
  </div>
);

interface DiscountTabProps {
  formData: Partial<ExtendedPromotionalOffer>;
  errors: Record<string, string>;
  onNumericChange: (field: string) => (value: number | null) => void;
  formatCurrency: (value: number | undefined) => string;
  onAddPriceTier: () => void;
  onUpdatePriceTier: (index: number, field: string, value: number | null) => void;
  onRemovePriceTier: (index: number) => void;
}

const DiscountTab = ({ 
  formData, 
  errors, 
  onNumericChange, 
  formatCurrency,
  onAddPriceTier,
  onUpdatePriceTier,
  onRemovePriceTier
}: DiscountTabProps) => (
  <div className="space-y-6">
    <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-4 flex items-center">
        <Percent className="mr-2 text-blue-500" size={20} />
        Discount Configuration
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
            {formData.offerType === 'percentage_discount' ? 'Discount Percentage' : 
             formData.offerType === 'bundle_price' ? 'Bundle Price' :
             formData.offerType === 'tiered_pricing' ? 'Base Price (Tier 1)' :
             formData.offerType === 'buy_x_get_y' ? 'Free Items Quantity' :
             'Discount Value'}
            <span className="text-red-500">*</span>
          </label>
          <NumericInput
            value={formData.discountValue || 0}
            onChange={onNumericChange('discountValue')}
            min={0}
            step={formData.offerType === 'percentage_discount' ? 1 : 0.01}
            placeholder={formData.offerType === 'percentage_discount' ? '20' : '10.00'}
          />
          {errors.discountValue && <p className="mt-1 text-sm text-red-500">{errors.discountValue}</p>}
        </div>
        
        {formData.offerType === 'buy_x_get_y' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Required Purchase Quantity (X) <span className="text-red-500">*</span>
            </label>
            <NumericInput
              value={formData.minimumQuantity || 1}
              onChange={onNumericChange('minimumQuantity')}
              min={1}
              step={1}
              placeholder="3"
            />
            {errors.minimumQuantity && <p className="mt-1 text-sm text-red-500">{errors.minimumQuantity}</p>}
          </div>
        )}
        
        {formData.offerType === 'bundle_price' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Bundle Quantity <span className="text-red-500">*</span>
            </label>
            <NumericInput
              value={formData.minimumQuantity || 2}
              onChange={onNumericChange('minimumQuantity')}
              min={2}
              step={1}
              placeholder="3"
            />
            {errors.minimumQuantity && <p className="mt-1 text-sm text-red-500">{errors.minimumQuantity}</p>}
          </div>
        )}
        
        {formData.offerType === 'tiered_pricing' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Base Tier Quantity (Min) <span className="text-red-500">*</span>
            </label>
            <NumericInput
              value={formData.minimumQuantity || 1}
              onChange={onNumericChange('minimumQuantity')}
              min={1}
              step={1}
              placeholder="10"
            />
            {errors.minimumQuantity && <p className="mt-1 text-sm text-red-500">{errors.minimumQuantity}</p>}
          </div>
        )}
        
        {formData.offerType !== 'tiered_pricing' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Minimum Purchase Amount
            </label>
            <NumericInput
              value={formData.minimumPurchaseAmount || 0}
              onChange={onNumericChange('minimumPurchaseAmount')}
              min={0}
              step={0.01}
              placeholder="0.00"
            />
          </div>
        )}
      </div>
      
      {/* Tiered Pricing Configuration */}
      {formData.offerType === 'tiered_pricing' && (
        <div className="mt-6 border-t border-gray-200 dark:border-border pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-900 dark:text-foreground">Tiered Pricing Configuration</h4>
            <button
              type="button"
              onClick={onAddPriceTier}
              className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-primary/90 flex items-center"
            >
              <Plus className="mr-1" size={14} />
              Add Tier
            </button>
          </div>
          
          <div className="mt-3 p-4 bg-blue-50 rounded-lg">
            <div className="text-sm space-y-4">
              <div className="p-3 bg-blue-100 rounded border border-blue-200">
                <p className="font-medium text-blue-800">How Tiered Pricing Works:</p>
                <p className="text-primary mt-1">The more items a customer buys, the better price they get on ALL items in their purchase.</p>
                <p className="text-primary mt-1">For example, with tiers of 10+ items at $10.00 and 20+ items at $9.50:</p>
                <ul className="list-disc pl-5 text-primary">
                  <li>A customer buying 15 items pays $10.00 each</li>
                  <li>A customer buying 20+ items pays $9.50 each</li>
                </ul>
              </div>
            
              <table className="w-full border-collapse">
                <thead className="bg-blue-200 text-blue-800">
                  <tr>
                    <th className="p-2 text-left rounded-tl">Quantity</th>
                    <th className="p-2 text-left">Price Per Item</th>
                    <th className="p-2 text-center rounded-tr">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-card">
                  {/* Base tier (always present) */}
                  <tr className="bg-blue-100 border-b border-blue-200">
                    <td className="p-2">
                      <div className="flex items-center">
                        <span className="bg-primary text-white text-xs rounded px-2 py-1 mr-2">BASE</span>
                        <span>{formData.minimumQuantity}+ items</span>
                      </div>
                    </td>
                    <td className="p-2">{formatCurrency(formData.discountValue || 0)}</td>
                    <td className="p-2 text-center text-gray-500 dark:text-muted-foreground">-</td>
                  </tr>
                  
                  {/* Additional tiers */}
                  {formData.priceTiers?.map((tier: PriceTier, index: number) => (
                    <tr key={tier.id || index} className="border-b border-blue-100 hover:bg-blue-50">
                      <td className="p-2">
                        <div className="flex items-center">
                          <span className="bg-blue-200 text-blue-800 text-xs rounded px-2 py-1 mr-2">TIER {index + 1}</span>
                          <div className="flex items-center">
                            <NumericInput
                              value={tier.quantity}
                              onChange={(value) => onUpdatePriceTier(index, 'quantity', value)}
                              min={formData.minimumQuantity ? formData.minimumQuantity + 1 : 2}
                              step={1}
                              className="w-24"
                            />
                            <span className="ml-2">+ items</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center">
                          <span className="mr-2">$</span>
                          <NumericInput
                            value={tier.price}
                            onChange={(value) => onUpdatePriceTier(index, 'price', value)}
                            min={0}
                            step={0.01}
                            className="w-24"
                          />
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => onRemovePriceTier(index)}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                          title="Remove this tier"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {(formData.priceTiers?.length === 0 || !formData.priceTiers) && (
                <div className="text-primary italic py-2">
                  Click "Add Tier" to create volume-based pricing tiers. More tiers = more savings for higher quantities.
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-3 text-sm text-gray-600 dark:text-muted-foreground">
            <span className="font-medium">How tiered pricing works:</span>
            <p>When customers purchase items in quantities that meet or exceed a tier threshold, they'll automatically get the better per-item price for their entire purchase.</p>
            <p className="mt-1"><strong>Example:</strong> With a base tier of 20+ items at $9.00 and a second tier of 40+ items at $8.10, customers who buy:</p>
            <ul className="list-disc pl-5 mt-1">
              <li>25 items will pay $9.00 each ($225 total)</li>
              <li>45 items will pay $8.10 each ($364.50 total)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  </div>
);

const RulesTab = ({ 
  formData, 
  errors, 
  products, 
  categories, 
  loadingEntities,
  selectedRuleType,
  setSelectedRuleType,
  selectedEntityId,
  setSelectedEntityId,
  selectedQuantity,
  setSelectedQuantity,
  onAddRule,
  onRemoveRule,
  getEntityName 
}: any) => (
  <div className="space-y-6">
    <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-4 flex items-center">
        <Settings className="mr-2 text-blue-500" size={20} />
        Product & Category Rules
      </h3>
      
      <p className="text-gray-600 dark:text-muted-foreground mb-6">
        Configure which products or categories this offer applies to. For {formData.offerType === 'buy_x_get_y' ? 'Buy X Get Y' : formData.offerType === 'bundle_price' ? 'Bundle' : 'Tiered Pricing'} offers, rules are required.
      </p>
      
      {/* Help Text for Bundle and specific offer types */}
      {formData.offerType === 'bundle_price' && (
        <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-100">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">Bundle Offer Tip:</h4>
          <p className="text-sm text-gray-700 dark:text-foreground">
            You can add multiple products or categories to your bundle. Each item added below will be part of the bundled offer.
            When customers purchase all items in the bundle, they'll receive the special bundle price.
          </p>
        </div>
      )}
      
      {formData.offerType === 'buy_x_get_y' && (
        <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-100">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">Buy X Get Y Offer Tip:</h4>
          <p className="text-sm text-gray-700 dark:text-foreground">
            First, select the qualifying product(s) or category that customers must buy. 
            Then add a separate rule for the product they'll receive for free.
          </p>
        </div>
      )}
      
      {/* Add New Rule Section */}
      <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-4 mb-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-foreground mb-3">Add New Rule</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Rule Type</label>
            <select
              value={selectedRuleType}
              onChange={(e) => setSelectedRuleType(e.target.value as RuleType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all_products">All Products</option>
              <option value="product">Specific Product</option>
              <option value="category">Product Category</option>
            </select>
          </div>
          
          {selectedRuleType === 'product' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Product</label>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loadingEntities}
              >
                <option value="">Select product</option>
                {products.map((product: any) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              {loadingEntities && <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Loading products...</p>}
            </div>
          )}
          
          {selectedRuleType === 'category' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">Category</label>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loadingEntities}
              >
                <option value="">Select category</option>
                {categories.map((category: any) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {loadingEntities && <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Loading categories...</p>}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              {selectedRuleType === 'product' ? 'Minimum Quantity of This Product' : 
               selectedRuleType === 'category' ? 'Minimum Quantity from This Category' : 
               'Quantity'}
            </label>
            <NumericInput
              value={selectedQuantity}
              onChange={(value) => setSelectedQuantity(value || 1)}
              min={1}
              step={1}
              placeholder="1"
            />
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
              {selectedRuleType === 'product' ? 
                'Minimum quantity of this specific product needed to qualify for the offer' :
                selectedRuleType === 'category' ? 
                'Minimum quantity from this category needed to qualify for the offer' :
                'Minimum quantity needed to qualify for the offer'
              }
            </p>
          </div>
          
          <div className="flex items-end">
            <button
              type="button"
              onClick={onAddRule}
              disabled={selectedRuleType !== 'all_products' && !selectedEntityId}
              className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Plus className="mr-1" size={16} />
              Add Rule
            </button>
          </div>
        </div>
      </div>
      
      {/* Applied Rules List */}
      {formData.rules && formData.rules.length > 0 ? (
        <div>
          <h4 className="text-md font-medium text-gray-900 dark:text-foreground mb-3">Applied Rules</h4>
          <div className="space-y-2">
            {formData.rules.map((rule: any, index: number) => (
              <div key={rule.id || `rule-${index}`} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <CheckCircle className="text-green-500 mr-2" size={16} />
                  <span className="text-sm text-gray-900 dark:text-foreground">
                    {getEntityName(rule)} {rule.quantity > 1 && `(Qty: ${rule.quantity})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveRule(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-muted-foreground">
          <Settings size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No rules configured yet.</p>
          <p className="text-sm">Add rules above to specify which products this offer applies to.</p>
        </div>
      )}
      
      {errors.rules && <p className="mt-4 text-sm text-red-500">{errors.rules}</p>}
    </div>
  </div>
);

const ScheduleTab = ({ formData, errors, onDateChange, onNumericChange, onChange, isEditing }: any) => (
  <div className="space-y-6">
    <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-4 flex items-center">
        <Calendar className="mr-2 text-blue-500" size={20} />
        Schedule & Usage Limits
      </h3>
      
      <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-100">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">Scheduling Tips:</h4>
        <p className="text-sm text-gray-700 dark:text-foreground">
          <span className="font-medium">Start Date</span> is required and defaults to today. If no <span className="font-medium">End Date</span> is set, the offer will run indefinitely.
          <br/>
          <span className="font-medium">Usage Limits</span> control how many times this offer can be used in total and per customer. Set to 0 for unlimited uses.
        </p>
      </div>
      
      {/* Schedule Section */}
      <div className="mb-8">
        <h4 className="text-md font-medium text-gray-900 dark:text-foreground mb-4">Offer Schedule</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <DatePicker
              date={formData.startDate ? new Date(`${formData.startDate}T12:00:00`) : new Date()}
              setDate={onDateChange('startDate')}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              End Date
            </label>
            <DatePicker
              date={formData.endDate ? new Date(`${formData.endDate}T12:00:00`) : undefined}
              setDate={onDateChange('endDate')}
            />
            {errors.endDate && <p className="mt-1 text-sm text-red-500">{errors.endDate}</p>}
          </div>
        </div>
      </div>
      
      {/* Usage Limits Section */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-foreground mb-4">Usage Limits</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Max Total Uses
            </label>
            <NumericInput
              value={formData.maxTotalUses || 0}
              onChange={onNumericChange('maxTotalUses')}
              min={0}
              step={1}
              placeholder="0 (unlimited)"
            />
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Leave 0 for unlimited</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Max Uses Per Customer
            </label>
            <NumericInput
              value={formData.maxUsesPerCustomer || 0}
              onChange={onNumericChange('maxUsesPerCustomer')}
              min={0}
              step={1}
              placeholder="0 (unlimited)"
            />
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Leave 0 for unlimited</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Priority
            </label>
            <NumericInput
              value={formData.priority || 0}
              onChange={onNumericChange('priority')}
              min={0}
              step={1}
              placeholder="0"
            />
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">Higher number = higher priority</p>
          </div>
        </div>
      </div>
      
      {/* Active Status */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-border">
        <label className="flex items-center">
          <input
            type="checkbox"
            name="isActive"
            checked={!!formData.isActive}
            onChange={onChange}
            className="h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border rounded"
          />
          <span className="ml-2 text-sm font-medium text-gray-900 dark:text-foreground">
            Activate this offer immediately
          </span>
        </label>
      </div>

      {/* Store Scope */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-border">
        {isEditing ? (
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-foreground">Store scope</p>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
              {formData.appliesToAllStores
                ? 'This offer applies to all stores (tenant-wide default). Scope cannot be changed after creation.'
                : 'This offer applies to a specific store only. Scope cannot be changed after creation.'}
            </p>
          </div>
        ) : (
          <label className="flex items-center">
            <input
              type="checkbox"
              name="appliesToAllStores"
              checked={!!formData.appliesToAllStores}
              onChange={onChange}
              className="h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border rounded"
            />
            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-foreground">
              Apply to all stores (tenant-wide default)
            </span>
          </label>
        )}
      </div>
    </div>
  </div>
);

const ReviewTab = ({ formData, formatCurrency, getEntityName, isSubmitting, submissionStatus }: any) => (
  <div className="space-y-6 relative">
    {/* Full-screen loading overlay when submitting */}
    {isSubmitting && (
      <div className="absolute inset-0 bg-white dark:bg-card bg-opacity-70 flex items-center justify-center z-10 rounded-lg">
        <div className="flex flex-col items-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mb-2"></div>
          <p className="text-primary font-medium">{formData.id ? 'Updating Offer...' : 'Creating Offer...'}</p>
        </div>
      </div>
    )}
    <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-4 flex items-center">
        <CheckCircle className="mr-2 text-green-500" size={20} />
        Review Your Offer
      </h3>
      
      {/* Success Message */}
      {submissionStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
          <div className="flex items-center">
            <CheckCircle className="text-green-500 mr-2" size={20} />
            <p className="text-green-700 font-medium">
              Offer successfully {formData.id ? 'updated' : 'created'}!
            </p>
          </div>
          <p className="text-green-600 text-sm mt-1">This window will close automatically...</p>
        </div>
      )}
      
      {/* Error Message */}
      {submissionStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="text-red-500 mr-2" size={20} />
            <p className="text-red-700 font-medium">
              Error {formData.id ? 'updating' : 'creating'} offer. Please try again.
            </p>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-foreground mb-3">Basic Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">Name:</span>
              <p className="font-medium">{formData.name || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">Type:</span>
              <p className="font-medium">{formData.offerType?.replace('_', ' ') || 'Not specified'}</p>
            </div>
            {formData.description && (
              <div className="md:col-span-2">
                <span className="text-gray-600 dark:text-muted-foreground">Description:</span>
                <p className="font-medium">{formData.description}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Discount Configuration */}
        <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-foreground mb-3">Discount Configuration</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">
                {formData.offerType === 'percentage_discount' ? 'Discount:' : 
                 formData.offerType === 'bundle_price' ? 'Bundle Price:' :
                 formData.offerType === 'tiered_pricing' ? 'Base Price:' :
                 formData.offerType === 'buy_x_get_y' ? 'Free Items:' :
                 'Discount Value:'}
              </span>
              <p className="font-medium">
                {formData.offerType === 'percentage_discount' 
                  ? `${formData.discountValue}%` 
                  : formData.offerType === 'buy_x_get_y'
                  ? `${formData.discountValue} items`
                  : formatCurrency(formData.discountValue || 0)
                }
              </p>
            </div>
            {formData.minimumQuantity > 1 && (
              <div>
                <span className="text-gray-600 dark:text-muted-foreground">
                  {formData.offerType === 'buy_x_get_y' ? 'Required Quantity:' :
                   formData.offerType === 'bundle_price' ? 'Bundle Quantity:' :
                   formData.offerType === 'tiered_pricing' ? 'Base Tier Quantity:' :
                   'Minimum Quantity:'}
                </span>
                <p className="font-medium">{formData.minimumQuantity}</p>
              </div>
            )}
            {formData.minimumPurchaseAmount > 0 && (
              <div>
                <span className="text-gray-600 dark:text-muted-foreground">Minimum Purchase:</span>
                <p className="font-medium">{formatCurrency(formData.minimumPurchaseAmount)}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Rules */}
        {formData.rules && formData.rules.length > 0 && (
          <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-foreground mb-3">Product Rules</h4>
            <div className="space-y-2">
              {formData.rules.map((rule: any, index: number) => (
                <div key={rule.id || `rule-${index}`} className="flex items-center text-sm">
                  <CheckCircle className="text-green-500 mr-2" size={16} />
                  <span>{getEntityName(rule)} {rule.quantity > 1 && `(Qty: ${rule.quantity})`}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Price Tiers - Show only for tiered pricing offers */}
        {formData.offerType === 'tiered_pricing' && (
          <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-foreground mb-3">Tiered Pricing Configuration</h4>
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-md">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="text-left py-2 px-4 border-b border-gray-200 dark:border-border">Quantity</th>
                    <th className="text-left py-2 px-4 border-b border-gray-200 dark:border-border">Price Per Item</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Base tier */}
                  <tr className="bg-blue-50 border-b border-gray-200 dark:border-border">
                    <td className="py-2 px-4">
                      <div className="flex items-center">
                        <span className="bg-primary text-white text-xs rounded px-2 py-1 mr-2">BASE</span>
                        {formData.minimumQuantity}+ items
                      </div>
                    </td>
                    <td className="py-2 px-4">{formatCurrency(formData.discountValue || 0)}</td>
                  </tr>
                  
                  {/* Additional tiers */}
                  {formData.priceTiers && formData.priceTiers.map((tier: any, index: number) => (
                    <tr key={tier.id || `tier-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-4">
                        <div className="flex items-center">
                          <span className="bg-blue-200 text-blue-800 text-xs rounded px-2 py-1 mr-2">TIER {index + 1}</span>
                          {tier.quantity}+ items
                        </div>
                      </td>
                      <td className="py-2 px-4">{formatCurrency(tier.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {(!formData.priceTiers || formData.priceTiers.length === 0) && (
              <div className="text-gray-500 dark:text-muted-foreground italic py-2">
                No additional price tiers configured. Only the base tier will apply.
              </div>
            )}
          </div>
        )}
        
        {/* Schedule & Limits */}
        <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-foreground mb-3">Schedule & Limits</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">Start Date:</span>
              <p className="font-medium">{formData.startDate || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">End Date:</span>
              <p className="font-medium">{formData.endDate || 'No end date'}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">Max Total Uses:</span>
              <p className="font-medium">{formData.maxTotalUses || 'Unlimited'}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">Max Uses Per Customer:</span>
              <p className="font-medium">{formData.maxUsesPerCustomer || 'Unlimited'}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">Priority:</span>
              <p className="font-medium">{formData.priority || 0}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-muted-foreground">Status:</span>
              <p className="font-medium">{formData.isActive ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default OfferFormModalTabbed;
