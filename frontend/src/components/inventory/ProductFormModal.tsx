import React, { useState, useEffect, ChangeEvent } from 'react';
import { Product, Category, TaxClass } from '@/types';
import { PromotionalOffer } from '@/types/discount';
import { UploadCloud, ListPlus, PackagePlus, Edit3, Loader2, Tag, Package, Layers, ReceiptText, Info } from 'lucide-react';
import CategoryManagementModal from '@/components/categories/CategoryManagementModal';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { getTaxClasses } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { useInventory } from '@/contexts/InventoryContext';
import { useTaxConfig } from '@/contexts/TaxConfigContext';
import { normalizeImageUrl } from '@/utils/imageUtils';
import DynamicProductFields from './DynamicProductFields';
import SectionHeader from '@/components/ui/SectionHeader';
import { getTenantIndustry } from '@/services/industryService';
import { getProductStoreListings, updateProductStoreListing, StoreListing } from '@/services/productService';

const INDUSTRY_NAME_PLACEHOLDER: Record<string, string> = {
  jewelry:        "e.g. Gold Ring 22kt, Diamond Pendant",
  apparel:        "e.g. Men's Slim Fit Jeans, Cotton Kurti",
  electronics:    'e.g. Samsung 65" QLED TV, USB-C Hub',
  pharmacy:       'e.g. Paracetamol 500mg, Vitamin D3',
  grocery:        'e.g. Basmati Rice 5kg, Cold-Pressed Olive Oil',
  general_retail: 'e.g. Wireless Mouse, Travel Mug',
  souvenir_gifts: 'e.g. Eiffel Tower Keychain, City Skyline Mug',
};

interface ProductFormModalProps {
  isOpen: boolean;
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (productData: Partial<Product>, imageFile: File | null, isNew: boolean) => void;
  onRefreshCategories: () => void;
}

// SectionHeader lives in components/ui/SectionHeader.tsx (shared with
// DynamicProductFields.tsx so the industry-attributes block matches every
// other section's icon + label + divider style instead of inventing its own).

// ── Per-store price/stock overrides for a tenant-wide shared product ───────
// Stock itself is deliberately read-only here — it's changed via the
// existing Stock Adjustment flow (scoped to whichever store is current),
// same as a store-owned product, so every stock change keeps its
// stock_adjustments audit row. See
// docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
const StoreListingsSection: React.FC<{ productId: string }> = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [listings, setListings] = useState<StoreListing[]>([]);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProductStoreListings(productId)
      .then((res) => {
        if (cancelled) return;
        setBasePrice(res.basePrice);
        setListings(res.listings);
      })
      .catch((err) => console.error('Failed to load store listings:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);

  const savePrice = async (storeId: string) => {
    const raw = draftPrices[storeId];
    const priceValue = raw === undefined || raw === '' ? null : Number(raw);
    setSavingStoreId(storeId);
    try {
      const updated = await updateProductStoreListing(productId, storeId, { price: priceValue });
      setListings((prev) => prev.map((l) => (l.storeId === storeId ? { ...l, price: updated.price } : l)));
      setDraftPrices((prev) => { const next = { ...prev }; delete next[storeId]; return next; });
    } catch (err) {
      console.error('Failed to update store listing price:', err);
    } finally {
      setSavingStoreId(null);
    }
  };

  const toggleListed = async (storeId: string, nextIsActive: boolean) => {
    setSavingStoreId(storeId);
    try {
      const updated = await updateProductStoreListing(productId, storeId, { isActive: nextIsActive });
      setListings((prev) => prev.map((l) => (l.storeId === storeId ? { ...l, isActive: updated.isActive } : l)));
    } catch (err) {
      console.error('Failed to update store listing status:', err);
    } finally {
      setSavingStoreId(null);
    }
  };

  return (
    <div>
      <SectionHeader icon={Layers} title="Store Pricing & Stock" />
      <p className="text-xs text-gray-500 dark:text-muted-foreground mb-3">
        This product is shared across all stores. Leave a store's price blank to use the
        base price ({basePrice}). Stock is store-specific — adjust it from that store via
        Stock Adjustment. Uncheck "Listed" to hide this product from a specific store
        without affecting the other stores.
      </p>
      {loading ? (
        <p className="text-sm text-gray-500 dark:text-muted-foreground">Loading store listings…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-muted-foreground">Store</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-muted-foreground">Price Override</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-muted-foreground">Stock</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-muted-foreground">Listed</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.storeId} className={`border-t border-border ${!l.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2">{l.storeName}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder={String(basePrice)}
                      value={draftPrices[l.storeId] ?? (l.price ?? '')}
                      onChange={(e) => setDraftPrices((prev) => ({ ...prev, [l.storeId]: e.target.value }))}
                      disabled={!l.isActive}
                      className="w-28 px-2 py-1 border border-border rounded bg-background-input text-sm disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-muted-foreground">{l.stockQuantity}</td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={l.isActive}
                        onChange={(e) => toggleListed(l.storeId, e.target.checked)}
                        disabled={savingStoreId === l.storeId}
                        className="h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border rounded"
                      />
                      <span className="text-xs text-gray-500 dark:text-muted-foreground">
                        {l.isActive ? 'Listed' : 'Unlisted'}
                      </span>
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => savePrice(l.storeId)}
                      disabled={savingStoreId === l.storeId || draftPrices[l.storeId] === undefined || !l.isActive}
                      className="text-xs text-primary font-medium disabled:opacity-40"
                    >
                      {savingStoreId === l.storeId ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  product,
  categories,
  onClose,
  onSave,
  onRefreshCategories,
}) => {
  const isNewProduct = !product;

  const [availableOffers, setAvailableOffers] = useState<PromotionalOffer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', description: '', price: 0, costPrice: 0,
    stockQuantity: 0, categoryId: '', barcode: '', sku: '',
    imageUrl: '', isActive: true, lowStockThreshold: 0, taxClassId: null,
  });

  // Products are shared across all stores by default (2026-09-08 product-
  // owner decision — opting in per product was judged too much friction).
  // This checkbox is the opt-OUT: check it to restrict the new product to
  // only the store it's being created in. It's a create-time-only choice —
  // a shared product's price/stock live per-store in
  // store_product_listings rather than on the product row itself, so it
  // can't be safely toggled after other stores may already be relying on
  // either model. A shared product can still be hidden from a specific
  // store later via the per-store "Unlisted" toggle further down. See
  // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
  const [restrictToThisStore, setRestrictToThisStore] = useState(false);

  const [industryCode, setIndustryCode] = useState<string>('');
  useEffect(() => { getTenantIndustry().then(setIndustryCode).catch(() => {}); }, []);

  const [attributes, setAttributes] = useState<Record<string, any>>({});
  const [pricing, setPricing] = useState({ purchasePrice: '', handlingCostPct: '', markupPct: '' });

  // Jewelry-only defaults — prefill the POS cart's weight-pricing step.
  // Meaningless (and unused) for non-jewelry tenants; all nullable on the backend.
  const [jewelryDetails, setJewelryDetails] = useState({
    purity: '',
    hsnCode: '',
    defaultGrossWeight: '',
    defaultNetWeight: '',
    defaultMakingChargeType: '',
    defaultMakingChargeValue: '',
    defaultWastagePct: '',
  });

  useEffect(() => {
    const p = product as any;
    setAttributes(p?.attributes || {});
    setPricing({
      purchasePrice: p?.purchasePrice ?? '',
      handlingCostPct: p?.handlingCostPct ?? '',
      markupPct: p?.markupPct ?? '',
    });
    setJewelryDetails({
      purity: p?.purity ?? '',
      hsnCode: p?.hsnCode ?? '',
      defaultGrossWeight: p?.defaultGrossWeight ?? '',
      defaultNetWeight: p?.defaultNetWeight ?? '',
      defaultMakingChargeType: p?.defaultMakingChargeType ?? '',
      defaultMakingChargeValue: p?.defaultMakingChargeValue ?? '',
      defaultWastagePct: p?.defaultWastagePct ?? '',
    });
  }, [product]);

  const numOrNull = (v: any) =>
    v === '' || v === null || v === undefined ? null : Number(v);

  const derivedCost = (() => {
    const pp = numOrNull(pricing.purchasePrice);
    const h = numOrNull(pricing.handlingCostPct);
    if (pp == null) return null;
    return Math.round(pp * (1 + (h || 0) / 100) * 100) / 100;
  })();

  const derivedSelling = (() => {
    if (derivedCost == null) return null;
    const m = numOrNull(pricing.markupPct);
    return Math.round(derivedCost * (1 + (m || 0) / 100) * 100) / 100;
  })();

  const handlePricingChange = (e: ChangeEvent<HTMLInputElement>) =>
    setPricing(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleJewelryChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setJewelryDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [isLoadingTaxClasses, setIsLoadingTaxClasses] = useState(false);
  const { user } = useAuth();
  const { taxConfig } = useTaxConfig();

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      if (product) {
        setFormData(prev => ({
          ...prev,
          name: product.name || '',
          description: product.description || '',
          price: product.price || 0,
          costPrice: product.costPrice || 0,
          stockQuantity: product.stockQuantity || 0,
          categoryId: product.categoryId || prev.categoryId || (categories.length > 0 ? categories[0].id : ''),
          barcode: product.barcode || '',
          sku: product.sku || '',
          imageUrl: product.imageUrl || '',
          isActive: product.isActive === undefined ? true : product.isActive,
          lowStockThreshold: product.lowStockThreshold || 0,
          taxClassId: product.taxClassId ?? prev.taxClassId ?? null,
        }));
        setImagePreviewUrl(normalizeImageUrl(product.imageUrl));
        setSelectedFile(null);
      } else {
        setFormData(prev => ({
          ...prev,
          name: prev.name || '',
          description: prev.description || '',
          price: typeof prev.price === 'number' ? prev.price : 0,
          costPrice: typeof prev.costPrice === 'number' ? prev.costPrice : 0,
          stockQuantity: typeof prev.stockQuantity === 'number' ? prev.stockQuantity : 0,
          categoryId: prev.categoryId || (categories.length > 0 ? categories[0].id : ''),
          barcode: prev.barcode || '',
          sku: prev.sku || '',
          imageUrl: prev.imageUrl || '',
          isActive: prev.isActive === undefined ? true : !!prev.isActive,
          lowStockThreshold: typeof prev.lowStockThreshold === 'number' ? prev.lowStockThreshold : 0,
          taxClassId: prev.taxClassId ?? null,
        }));
        setImagePreviewUrl(null);
        setSelectedFile(null);
      }
    }
  }, [product, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(prev => {
      if (!prev.categoryId && categories.length > 0) return { ...prev, categoryId: categories[0].id };
      if (prev.categoryId && !categories.some(c => c.id === prev.categoryId))
        return { ...prev, categoryId: categories.length > 0 ? categories[0].id : '' };
      return prev;
    });
  }, [categories, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchOffers = async () => {
      setIsLoadingOffers(true);
      try {
        const { getActiveOffers } = await import('@/services/discountService');
        const offers = await getActiveOffers();
        setAvailableOffers(offers);
        setSelectedOfferId(product?.promotionalOfferId ?? null);
      } catch { /* silent */ } finally { setIsLoadingOffers(false); }
    };
    fetchOffers();
  }, [isOpen, product]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchTaxData = async () => {
      setIsLoadingTaxClasses(true);
      try {
        const canViewTaxes = hasAnyPermission(user, ['tax.view', 'settings.view']);
        if (!canViewTaxes) {
          const defaultId = (taxConfig as any)?.defaultTaxClassId || (taxConfig as any)?.default_tax_class_id || null;
          if (defaultId) {
            setTaxClasses([{ id: defaultId, name: 'Store Default Tax' } as unknown as TaxClass]);
            setFormData(prev => ({ ...prev, taxClassId: prev.taxClassId ?? defaultId }));
          } else { setTaxClasses([]); }
          return;
        }
        const response = await getTaxClasses();
        const taxData: TaxClass[] = Array.isArray(response) ? response : (response as any)?.data ?? [];
        setTaxClasses(taxData);
        const defaultId = (taxConfig as any)?.defaultTaxClassId || (taxConfig as any)?.default_tax_class_id || null;
        if (defaultId && taxData.some(tc => tc.id === defaultId))
          setFormData(prev => ({ ...prev, taxClassId: prev.taxClassId ?? defaultId }));
      } catch (error) {
        const msg = error instanceof Error ? error.message : '';
        if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
          const defaultId = (taxConfig as any)?.defaultTaxClassId || (taxConfig as any)?.default_tax_class_id || null;
          if (defaultId) {
            setTaxClasses([{ id: defaultId, name: 'Store Default Tax' } as unknown as TaxClass]);
            setFormData(prev => ({ ...prev, taxClassId: prev.taxClassId ?? defaultId }));
          } else { setTaxClasses([]); }
        } else { setTaxClasses([]); }
      } finally { setIsLoadingTaxClasses(false); }
    };
    fetchTaxData();
  }, [isOpen, user, taxConfig]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (name === 'taxClassId') {
      const valid = value === '' ? null : taxClasses.some(tc => tc.id === value) ? value : null;
      setFormData(prev => ({ ...prev, [name]: valid }));
    } else if (name === 'price' || name === 'costPrice') {
      if (value === '' || /^\d*\.?\d*$/.test(value))
        setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : value }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
      setFormData(prev => ({ ...prev, imageUrl: '' }));
    } else {
      setSelectedFile(null);
      setImagePreviewUrl(normalizeImageUrl(product?.imageUrl));
    }
  };

  const { refreshProducts } = useInventory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.categoryId) {
      alert('Product Name and Category are required.');
      return;
    }
    setIsSaving(true);
    try {
      const productData: any = {
        ...formData,
        promotionalOfferId: selectedOfferId,
        attributes,
        purchasePrice: numOrNull(pricing.purchasePrice),
        handlingCostPct: numOrNull(pricing.handlingCostPct),
        markupPct: numOrNull(pricing.markupPct),
      };
      if (industryCode === 'jewelry') {
        productData.purity = jewelryDetails.purity || null;
        productData.hsnCode = jewelryDetails.hsnCode || null;
        productData.defaultGrossWeight = numOrNull(jewelryDetails.defaultGrossWeight);
        productData.defaultNetWeight = numOrNull(jewelryDetails.defaultNetWeight);
        productData.defaultMakingChargeType = jewelryDetails.defaultMakingChargeType || null;
        productData.defaultMakingChargeValue = numOrNull(jewelryDetails.defaultMakingChargeValue);
        productData.defaultWastagePct = numOrNull(jewelryDetails.defaultWastagePct);
      }
      if (isNewProduct) {
        // Shared by default; the checkbox opts OUT into a store-specific product.
        productData.shareAcrossStores = !restrictToThisStore;
      }
      if ((!formData.price || formData.price === 0) && derivedSelling != null)
        productData.price = derivedSelling;
      await onSave(productData, selectedFile, isNewProduct);
      await refreshProducts();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategoriesUpdated = (newlySelectedCategoryId?: string) => {
    onRefreshCategories();
    if (newlySelectedCategoryId)
      setFormData(prev => ({ ...prev, categoryId: newlySelectedCategoryId }));
    setIsCategoryModalOpen(false);
  };

  // ── Shared style tokens ───────────────────────────────────────────────────
  const inputCls = "w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background-input text-text placeholder-text-secondary transition-colors duration-150 text-sm";
  const labelCls = "block text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-1.5 uppercase tracking-wide";

  const modalTitle = (
    <div className="flex items-center gap-2">
      {isNewProduct
        ? <PackagePlus size={20} className="text-primary-foreground/80" />
        : <Edit3 size={20} className="text-primary-foreground/80" />}
      <span>{isNewProduct ? 'Add New Product' : `Edit Product`}</span>
      {!isNewProduct && (
        <span className="text-primary-foreground/60 font-normal text-sm truncate max-w-[240px]">
          — {product?.name}
        </span>
      )}
    </div>
  );

  const modalFooter = (
    <div className="flex items-center justify-between w-full">
      {/* Active toggle in footer-left */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            name="isActive"
            checked={formData.isActive || false}
            onChange={handleChange}
            className="sr-only"
          />
          <div className={`w-9 h-5 rounded-full transition-colors ${formData.isActive ? 'bg-primary' : 'bg-gray-300 dark:bg-muted'}`} />
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
        <span className="text-sm text-gray-600 dark:text-muted-foreground">
          {formData.isActive ? 'Active' : 'Inactive'}
        </span>
      </label>
      {isNewProduct && (
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={restrictToThisStore}
            onChange={(e) => setRestrictToThisStore(e.target.checked)}
            className="mt-0.5 h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border rounded"
          />
          <span className="text-sm text-gray-600 dark:text-muted-foreground">
            Restrict to this store only
            <span className="block text-xs text-gray-400 dark:text-muted-foreground/70 font-normal">
              By default this product is shared across all stores. Check this to keep it
              exclusive to the store you're creating it in.
            </span>
          </span>
        </label>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSaving} form="product-form">
          {isSaving ? <><Loader2 size={16} className="animate-spin mr-1.5" />Saving…</> : 'Save Product'}
        </Button>
      </div>
    </div>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="5xl"
      footerContent={modalFooter}
    >
      <form
        onSubmit={handleSubmit}
        id="product-form"
        className="flex flex-col lg:flex-row gap-0 max-h-[calc(85vh-130px)] overflow-hidden"
      >
        {/* ── LEFT: scrollable fields ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* BASIC INFO */}
          <div>
            <SectionHeader icon={Info} title="Basic Info" />
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className={labelCls}>
                  Product Name <span className="text-red-500 normal-case font-normal">*</span>
                </label>
                <input
                  type="text" name="name" id="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className={inputCls}
                  required
                  placeholder={INDUSTRY_NAME_PLACEHOLDER[industryCode] ?? 'e.g. Product Name'}
                />
              </div>

              <div>
                <label htmlFor="description" className={labelCls}>Description</label>
                <textarea
                  name="description" id="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className={inputCls}
                  placeholder="Brief product description…"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="categoryId" className={labelCls + ' mb-0'}>
                    Category <span className="text-red-500 normal-case font-normal">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 px-2 py-0.5 rounded hover:bg-primary/5 transition-colors"
                  >
                    <ListPlus size={13} /> Manage
                  </button>
                </div>
                <select
                  name="categoryId" id="categoryId"
                  value={formData.categoryId || ''}
                  onChange={handleChange}
                  className={inputCls}
                  required
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PRICING */}
          <div>
            <SectionHeader icon={Tag} title="Pricing" />
            <div className="space-y-4">
              {/* Sales Price + Cost Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className={labelCls}>Sales Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">$</span>
                    <input
                      type="text" name="price" id="price"
                      value={formData.price === 0 ? '' : String(formData.price)}
                      onChange={handleChange}
                      className={inputCls + ' pl-7'}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="costPrice" className={labelCls}>Cost Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">$</span>
                    <input
                      type="text" name="costPrice" id="costPrice"
                      value={formData.costPrice === 0 ? '' : String(formData.costPrice)}
                      onChange={handleChange}
                      className={inputCls + ' pl-7'}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Derived pricing flow */}
              <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-3.5 border border-border/60">
                <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide mb-2.5">
                  Calculate from purchase cost
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Purchase Price</label>
                    <input type="number" name="purchasePrice" min="0" step="0.01"
                      value={pricing.purchasePrice} onChange={handlePricingChange}
                      className={inputCls} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelCls}>Handling %</label>
                    <input type="number" name="handlingCostPct" min="0" step="0.01"
                      value={pricing.handlingCostPct} onChange={handlePricingChange}
                      className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Markup %</label>
                    <input type="number" name="markupPct" min="0" step="0.01"
                      value={pricing.markupPct} onChange={handlePricingChange}
                      className={inputCls} placeholder="0" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-muted-foreground">
                  <span>Derived cost: <strong className="text-gray-700 dark:text-foreground">{derivedCost ?? '—'}</strong></span>
                  <span className="text-gray-300">·</span>
                  <span>Suggested selling: <strong className="text-gray-700 dark:text-foreground">{derivedSelling ?? '—'}</strong></span>
                </div>
              </div>

              {industryCode === 'jewelry' && (
                <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-3.5 border border-border/60">
                  <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide mb-2.5">
                    Jewelry Details
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Purity</label>
                      <input type="text" name="purity"
                        value={jewelryDetails.purity} onChange={handleJewelryChange}
                        className={inputCls} placeholder="e.g. 22K, 916" />
                    </div>
                    <div>
                      <label className={labelCls}>HSN Code</label>
                      <input type="text" name="hsnCode"
                        value={jewelryDetails.hsnCode} onChange={handleJewelryChange}
                        className={inputCls} placeholder="e.g. 7113" />
                    </div>
                    <div>
                      <label className={labelCls}>Wastage %</label>
                      <input type="number" name="defaultWastagePct" min="0" step="0.01"
                        value={jewelryDetails.defaultWastagePct} onChange={handleJewelryChange}
                        className={inputCls} placeholder="0" />
                    </div>
                    <div>
                      <label className={labelCls}>Default Gross Weight (g)</label>
                      <input type="number" name="defaultGrossWeight" min="0" step="0.001"
                        value={jewelryDetails.defaultGrossWeight} onChange={handleJewelryChange}
                        className={inputCls} placeholder="0.000" />
                    </div>
                    <div>
                      <label className={labelCls}>Default Net Weight (g)</label>
                      <input type="number" name="defaultNetWeight" min="0" step="0.001"
                        value={jewelryDetails.defaultNetWeight} onChange={handleJewelryChange}
                        className={inputCls} placeholder="0.000" />
                    </div>
                    <div>
                      <label className={labelCls}>Making Charge Type</label>
                      <select name="defaultMakingChargeType"
                        value={jewelryDetails.defaultMakingChargeType} onChange={handleJewelryChange}
                        className={inputCls}>
                        <option value="">None</option>
                        <option value="per_gram">Per Gram</option>
                        <option value="percentage">Percentage</option>
                        <option value="flat">Flat</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Making Charge Value</label>
                      <input type="number" name="defaultMakingChargeValue" min="0" step="0.01"
                        value={jewelryDetails.defaultMakingChargeValue} onChange={handleJewelryChange}
                        className={inputCls} placeholder="0.00" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                    These prefill the cart's weight-pricing step at checkout — the cashier can adjust for the actual weighed piece.
                  </p>
                </div>
              )}

              {/* Tax + Promo side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="taxClassId" className={labelCls}>Tax Class</label>
                  <select name="taxClassId" id="taxClassId"
                    value={formData.taxClassId || ''} onChange={handleChange}
                    className={inputCls} disabled={isLoadingTaxClasses}>
                    <option value="">None (No Tax)</option>
                    {isLoadingTaxClasses
                      ? <option disabled>Loading…</option>
                      : taxClasses.map(tc => <option key={tc.id} value={tc.id}>{tc.name || 'Store Default Tax'}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="promotionalOfferId" className={labelCls}>Promo Offer</label>
                  <select name="promotionalOfferId" id="promotionalOfferId"
                    value={selectedOfferId || ''} onChange={(e) => {
                      const v = e.target.value;
                      setSelectedOfferId(v === '' ? null : v);
                      setFormData(prev => ({ ...prev, promotionalOfferId: v === '' ? null : v }));
                    }}
                    className={inputCls} disabled={isLoadingOffers}>
                    <option value="">None</option>
                    {isLoadingOffers
                      ? <option disabled>Loading…</option>
                      : availableOffers.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name} — {o.offerType === 'percentage_discount'
                            ? `${o.discountValue}%`
                            : `$${parseFloat(o.discountValue.toString()).toFixed(2)}`}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* INVENTORY */}
          <div>
            <SectionHeader icon={Package} title="Inventory" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="stockQuantity" className={labelCls}>Stock Quantity</label>
                <input
                  type="number" name="stockQuantity" id="stockQuantity"
                  value={formData.stockQuantity}
                  onChange={handleChange}
                  className={`${inputCls} ${!isNewProduct ? 'opacity-50 cursor-not-allowed' : ''}`}
                  step="1" min="0"
                  placeholder="0"
                  disabled={!isNewProduct}
                  readOnly={!isNewProduct}
                />
                {!isNewProduct && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Use Stock Adjustment to change quantity
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="lowStockThreshold" className={labelCls}>Low Stock Alert</label>
                <input
                  type="number" name="lowStockThreshold" id="lowStockThreshold"
                  value={formData.lowStockThreshold || 0}
                  onChange={handleChange}
                  className={inputCls}
                  step="1" min="0" placeholder="0"
                />
              </div>
            </div>
          </div>

          {!isNewProduct && (product as any)?.isSharedProduct && (
            <StoreListingsSection productId={product!.id} />
          )}

          {/* IDENTIFIERS */}
          <div>
            <SectionHeader icon={ReceiptText} title="Identifiers" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="barcode" className={labelCls}>Barcode</label>
                <input type="text" name="barcode" id="barcode"
                  value={formData.barcode || ''} onChange={handleChange}
                  className={inputCls} placeholder="UPC, EAN, ISBN…" />
              </div>
              <div>
                <label htmlFor="sku" className={labelCls}>SKU</label>
                <input type="text" name="sku" id="sku"
                  value={formData.sku || ''} onChange={handleChange}
                  className={inputCls} placeholder="e.g. PROD-001" />
              </div>
            </div>
          </div>

          {/* INDUSTRY FIELDS */}
          <DynamicProductFields value={attributes} onChange={setAttributes} />

        </div>

        {/* ── RIGHT: image panel ───────────────────────────────────────────── */}
        <div className="lg:w-64 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-gray-50/60 dark:bg-muted/20 px-5 py-5 flex flex-col gap-4">
          <div>
            <SectionHeader icon={Layers} title="Product Image" />
            <label
              htmlFor="productImage"
              className="block w-full aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer overflow-hidden bg-white dark:bg-card relative group"
            >
              <input
                type="file" name="productImage" id="productImage"
                accept="image/*" onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Product preview"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400 group-hover:text-primary transition-colors p-4 text-center">
                  <UploadCloud size={36} />
                  <p className="text-xs font-medium">Click to upload</p>
                  <p className="text-[11px] text-gray-400">PNG, JPG up to 5 MB</p>
                </div>
              )}
            </label>
            {selectedFile && (
              <p className="text-xs text-muted-foreground mt-2 truncate text-center">{selectedFile.name}</p>
            )}
            {imagePreviewUrl && (
              <button
                type="button"
                onClick={() => { setImagePreviewUrl(null); setSelectedFile(null); setFormData(p => ({ ...p, imageUrl: '' })); }}
                className="mt-2 w-full text-xs text-red-500 hover:text-red-600 hover:underline text-center"
              >
                Remove image
              </button>
            )}
          </div>
        </div>
      </form>

      {isCategoryModalOpen && (
        <CategoryManagementModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          onCategoriesUpdated={handleCategoriesUpdated}
        />
      )}
    </ModalBase>
  );
};

export default ProductFormModal;
