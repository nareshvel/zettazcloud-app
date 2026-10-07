import React, { useState, useEffect, FormEvent } from 'react';
import { fetchApi } from '@/services/api';
import { PlusCircle, Edit, Trash2, Info } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext'; // Added for store-level tax settings
import { useTaxConfig } from '@/contexts/TaxConfigContext';
import toast from 'react-hot-toast';
import { hasAnyPermission, hasPermission } from '@/utils/permissionUtils';

// Interfaces to match fetchApi camelCase conversion
interface TaxRate {
  id: string;
  taxClassId: string;
  taxRateName: string;
  rate: number;
  priority: number;
  isCompound: boolean;
}


interface TaxClass {
  id: string;
  tenant_id: string;
  store_id: string | null;
  name: string;
  description: string;
  rates_count: number;
}

const SettingsTaxes: React.FC = () => {
  const { store, updateStore } = useStore(); // Added for store-level tax settings
  const { user, isAuthenticated } = useAuth();
  const { taxConfig, updateTaxConfig, refreshTaxConfig } = useTaxConfig();

  // Write paths: tax class/rate CRUD → tax.create/edit/delete; store tax
  // basis + default-class flag → PATCH /stores/settings → stores.edit.
  const canCreateTax = hasPermission(user, 'tax.create');
  const canEditTax = hasPermission(user, 'tax.edit');
  const canDeleteTax = hasPermission(user, 'tax.delete');
  const canEditStoreTax = hasPermission(user, 'stores.edit');
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTaxClass, setCurrentTaxClass] = useState<Partial<TaxClass> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [editingRate, setEditingRate] = useState<Partial<TaxRate> | null>(null);
  
  // Note: We no longer build manual headers here. The centralized fetchApi
  // injects Authorization and mirrors tenant/store IDs from localStorage/JWT
  // ensuring both x- and non-x- header variants are present.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<TaxRate | null>(null);
  const [taxClassToDelete, setTaxClassToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDefaultInModal, setIsDefaultInModal] = useState(false);
  // Applies only when creating a new tax class (modalMode === 'add') — sends
  // appliesToAllStores so the backend creates a tenant-wide default row
  // (store_id NULL) instead of scoping it to the currently active store. See
  // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §4.
  const [appliesToAllStoresInModal, setAppliesToAllStoresInModal] = useState(false);
  const [selectedTaxBasis, setSelectedTaxBasis] = useState<'INCLUSIVE' | 'EXCLUSIVE'>(store?.defaultTaxBasis || 'EXCLUSIVE');
  const [isSavingTaxBasis, setIsSavingTaxBasis] = useState(false);
  const [hasUnsavedChangesTaxBasis, setHasUnsavedChangesTaxBasis] = useState(false);

  // Build explicit headers from contexts to guarantee valid tenant/store IDs are sent
  const buildAuthHeaders = React.useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    const tenantId = (user as any)?.tenantId || (user as any)?.tenant_id;
    const storeId = (store as any)?.id || (store as any)?.storeId || (store as any)?.store_id;
    if (tenantId) {
      headers['x-tenant-id'] = String(tenantId);
      headers['tenant-id'] = String(tenantId);
    }
    if (storeId && storeId !== 'null' && storeId !== null && storeId !== undefined) {
      headers['x-store-id'] = String(storeId);
      headers['store-id'] = String(storeId);
    }
    return headers;
  }, [user, store]);
  
  // Effect to update local selectedTaxBasis when store context changes
  useEffect(() => {
    if (store?.defaultTaxBasis) {
      setSelectedTaxBasis(store.defaultTaxBasis as 'INCLUSIVE' | 'EXCLUSIVE');
      setHasUnsavedChangesTaxBasis(false); // Reset unsaved changes flag
    }
  }, [store?.defaultTaxBasis]);

  // Get default tax class ID from tax config (handle both snake_case and camelCase)
  const defaultTaxClassId = taxConfig?.default_tax_class_id || taxConfig?.defaultTaxClassId || null;

  // --- API Fetching ---
  const fetchTaxClasses = async (backgroundRefresh = false) => {
    if (!backgroundRefresh) setIsLoading(true);
    setError(null);
    try {
      // Guard: only fetch if user has explicit tax.view permission
      const canViewTaxes = hasAnyPermission(user, ['tax.view']);
      if (!canViewTaxes) {
        setTaxClasses([]);
        return;
      }
      const result = await fetchApi<any>('/api/tax/tax-classes', { headers: buildAuthHeaders() });
      // Handle both formats: direct array or {data: [...]} structure
      const taxClassesData = Array.isArray(result) ? result : (result.data || []);
      setTaxClasses(taxClassesData);
      // We now get default tax class ID from the taxConfig context
    } catch (err) {
      // Swallow 403 errors gracefully when permissions are insufficient
      const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
        setTaxClasses([]);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      if (!backgroundRefresh) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      const canViewTaxes = hasAnyPermission(user, ['tax.view']);
      if (canViewTaxes) {
        fetchTaxClasses();
        // Refresh tax config to ensure we have the latest data
        refreshTaxConfig();
      } else {
        // No permission: ensure clean state without triggering errors
        setIsLoading(false);
        setTaxClasses([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const fetchRatesForClass = async (taxClassId: string) => {
    try {
      // Guard: require explicit tax.view to fetch rates
      const canViewTaxes = hasAnyPermission(user, ['tax.view']);
      if (!canViewTaxes) {
        setTaxRates([]);
        return;
      }
      const result = await fetchApi<any>(`/api/tax/tax-classes/${taxClassId}/rates`, { headers: buildAuthHeaders() });
      console.log('DEBUG: Raw tax rates API result:', result);
      // Handle both formats: direct array or {data: [...]} structure
      const taxRatesData = Array.isArray(result) ? result : (result.data || []);
      console.log('DEBUG: Processed tax rates data:', taxRatesData);
      console.log('DEBUG: First tax rate object:', taxRatesData[0]);
      setTaxRates(taxRatesData);
    } catch (err) {
      console.error('DEBUG: Tax rates fetch error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load rates.';
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
        setTaxRates([]);
        // do not set an error banner for permission-related skips
      } else {
        setError(msg);
      }
    }
  };

  // --- Modal Handling ---
  const handleOpenModal = (mode: 'add' | 'edit', taxClass: TaxClass | null = null) => {
    setModalMode(mode);
    if (mode === 'edit' && taxClass) {
      setCurrentTaxClass(taxClass);
      fetchRatesForClass(taxClass.id);
      setIsDefaultInModal(taxClass.id === defaultTaxClassId);
      setAppliesToAllStoresInModal(false); // scope can't be changed after creation
    } else {
      setCurrentTaxClass({ name: '', description: '' });
      setTaxRates([]);
      setIsDefaultInModal(false); // For new class, default is false
      setAppliesToAllStoresInModal(false);
    }
    setError(null); // Clear any previous errors when opening modal
    setIsModalOpen(true);
    setEditingRate(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentTaxClass(null);
    setTaxRates([]);
    setError(null);
  };

  // --- CRUD Operations ---
  const handleSaveTaxClass = async (e: FormEvent) => {
    e.preventDefault();
    if (modalMode === 'add' ? !canCreateTax : !canEditTax) return;
    if (!currentTaxClass || !currentTaxClass.name) {
      setError('Tax class name is required.');
      return;
    }

    setIsSaving(true);
    const method = modalMode === 'add' ? 'POST' : 'PUT';
    const url = modalMode === 'add' ? '/api/tax/tax-classes' : `/api/tax/tax-classes/${currentTaxClass.id}`;

    const body: Record<string, unknown> = {
      name: currentTaxClass.name,
      description: currentTaxClass.description || '',
      is_default: isDefaultInModal,
    };
    if (modalMode === 'add' && appliesToAllStoresInModal) {
      body.appliesToAllStores = true;
    }

    try {
      const responseData = await fetchApi<any>(url, {
        method,
        body: JSON.stringify(body),
        headers: buildAuthHeaders(),
      });
      const taxClassId = responseData?.data?.id || currentTaxClass.id;
      
      // Update the store's tax_config based on default setting
      try {
        // Fetch current store settings to get existing tax_config
        const store = await fetchApi<any>('/api/stores/settings');
        
        // Prepare the updated tax_config
        const currentTaxConfig = store.tax_config || store.taxConfig || {};
        let updatedTaxConfig;
        
        if (isDefaultInModal && taxClassId) {
          // Setting this tax class as default
          updatedTaxConfig = {
            ...currentTaxConfig,
            default_tax_class_id: taxClassId
          };
        } else if (!isDefaultInModal && taxClassId === (currentTaxConfig.default_tax_class_id || currentTaxConfig.defaultTaxClassId)) {
          // Unsetting this tax class as default (if it was the current default)
          updatedTaxConfig = {
            ...currentTaxConfig,
            default_tax_class_id: null
          };
        } else {
          // No change to default tax class needed
          updatedTaxConfig = currentTaxConfig;
        }
        
        // Only update if there's a change
        if (JSON.stringify(updatedTaxConfig) !== JSON.stringify(currentTaxConfig)) {
          // Update the store with the new tax_config
          await fetchApi<void>(`/api/stores/settings`, {
            method: 'PATCH',
            body: JSON.stringify({
              tax_config: updatedTaxConfig
            }),
          });
          
          // Update the tax config in the context for real-time updates
          // This will propagate changes to all components using the tax config
          updateTaxConfig(updatedTaxConfig);
          
          // Also refresh the tax config from backend to ensure consistency
          await refreshTaxConfig();
        }
      } catch (storeUpdateErr) {
        console.error('Error updating store tax config:', storeUpdateErr);
        // We don't want to fail the whole operation if just the store update fails
        // Just log it and continue
      }

      await fetchTaxClasses(true); // Background refresh
      
      // Ensure tax config is refreshed after any changes
      await refreshTaxConfig();
      
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during save.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTaxClass = (taxClassId: string) => {
    setTaxClassToDelete(taxClassId);
  };

  const confirmDeleteTaxClass = async () => {
    if (!canDeleteTax) return;
    if (!taxClassToDelete) return;
    const taxClassId = taxClassToDelete;
    setTaxClassToDelete(null);

    try {
      await fetchApi<void>(`/api/tax/tax-classes/${taxClassId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(),
      });

      await fetchTaxClasses(); // Refresh the list
      // If the deleted class was the default, defaultTaxClassId will be updated by fetchTaxClasses
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during deletion.');
    }
  };

  const handleSaveRate = async () => {
    if (editingRate?.id ? !canEditTax : !canCreateTax) return;
    if (!editingRate || !editingRate.taxRateName || editingRate.rate === undefined) {
      setError('Rate name and rate value are required.');
      return;
    }
    if (!currentTaxClass || !currentTaxClass.id) {
      setError('Cannot save rate without a selected tax class.');
      return;
    }

    setIsSaving(true);
    const isNewRate = !editingRate.id;
    const method = isNewRate ? 'POST' : 'PUT';
    const url = isNewRate
      ? `/api/tax/tax-classes/${currentTaxClass.id}/rates`
      : `/api/tax/tax-rates/${editingRate.id}`;

    const body = {
      tax_rate_name: editingRate.taxRateName,
      rate: editingRate.rate,
      priority: editingRate.priority || 0,
      is_compound: !!editingRate.isCompound,
    };

    try {
      await fetchApi<void>(url, {
        method,
        body: JSON.stringify(body),
        headers: buildAuthHeaders(),
      });

      setEditingRate(null); // Close the rate form
      await fetchRatesForClass(currentTaxClass.id); // Refresh rates for current class
      await fetchTaxClasses(true); // Background refresh to update rates_count
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while saving the rate.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRate = async () => {
    if (!canDeleteTax) return;
    if (!rateToDelete || !rateToDelete.id) {
      setError('No rate selected for deletion.');
      return;
    }
    if (!currentTaxClass || !currentTaxClass.id) {
      setError('Cannot delete rate without a selected tax class context.');
      return;
    }

    try {
      await fetchApi<void>(`/api/tax/tax-rates/${rateToDelete.id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(),
      });

      setShowDeleteConfirm(false);
      setRateToDelete(null);
      await fetchRatesForClass(currentTaxClass.id); // Refresh rates for current class
      await fetchTaxClasses(); // Refresh all tax classes to update rates_count
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during rate deletion.');
    }
  };

  // --- Main Render ---
  const handleSaveTaxBasis = async () => {
    if (!canEditStoreTax) return;
    if (!store || !updateStore) {
      toast.error('Store context is not available.');
      return;
    }
    setIsSavingTaxBasis(true);
    try {
      await updateStore({ defaultTaxBasis: selectedTaxBasis });
      toast.success('Store tax basis updated successfully!');
    } catch (error) {
      console.error('Failed to update store tax basis:', error);
      toast.error('Failed to update store tax basis. Please try again.');
    } finally {
      setIsSavingTaxBasis(false);
    }
  };

  if (isLoading) return <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-8 text-center text-sm text-gray-400 dark:text-muted-foreground">Loading tax settings…</div>;
  if (error && !isModalOpen) return <div className="bg-white dark:bg-card rounded-xl border border-red-200 p-8 text-center text-sm text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-5">
      {/* Store Tax Basis Configuration Section */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Store Pricing Tax Basis</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Define how taxes are handled in your product prices.</p>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-600 dark:text-muted-foreground mb-4">
            Determines whether prices you enter already include tax (inclusive) or if tax is added on top at checkout (exclusive).
          </p>
          <div className="space-y-3">
            {[
              { value: 'EXCLUSIVE', label: 'Tax Exclusive', desc: 'Prices do not include tax — tax is added at checkout.' },
              { value: 'INCLUSIVE', label: 'Tax Inclusive', desc: 'Prices already include tax — tax is itemized but not added to the total.' },
            ].map(opt => (
              <label key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  !canEditStoreTax ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                } ${
                  selectedTaxBasis === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-border hover:border-primary/30'
                }`}>
                <input type="radio" name="taxBasis" value={opt.value} checked={selectedTaxBasis === opt.value}
                  disabled={!canEditStoreTax}
                  onChange={() => { setSelectedTaxBasis(opt.value as 'EXCLUSIVE' | 'INCLUSIVE'); setHasUnsavedChangesTaxBasis(true); }}
                  className="mt-0.5 accent-primary" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-foreground">{opt.label}</div>
                  <div className="text-xs text-gray-500 dark:text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
          {hasUnsavedChangesTaxBasis && (
            <div className="mt-4 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <p>Changing tax basis affects all future transactions. Existing product prices are <strong>not</strong> automatically updated — review them after saving.</p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 bg-gray-50 dark:bg-muted/50 border-t border-gray-100 dark:border-border flex items-center justify-between gap-3">
          {!canEditStoreTax && (
            <p className="text-xs text-gray-500 dark:text-muted-foreground">View-only access — ask a manager to make changes.</p>
          )}
          <Button onClick={handleSaveTaxBasis} disabled={isSavingTaxBasis || !hasUnsavedChangesTaxBasis || !canEditStoreTax} size="sm" className="ml-auto">
            {isSavingTaxBasis ? 'Saving…' : 'Save Tax Basis'}
          </Button>
        </div>
      </div>

      {/* Tax Classes Section */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Tax Classes</h3>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Group rates into classes (e.g. Standard, Reduced, Zero).</p>
          </div>
          <Button size="sm" onClick={() => handleOpenModal('add')} disabled={!canCreateTax} title={!canCreateTax ? 'View-only access' : undefined}><PlusCircle className="mr-1.5 h-4 w-4" /> Add Tax Class</Button>
        </div>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/60"><tr>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">Name</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">Description</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">Status</th>
            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {taxClasses.map((tc) => (
              <tr key={tc.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-foreground">{tc.name}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-muted-foreground">{tc.description}</td>
                <td className="px-5 py-3.5 text-sm">
                  {tc.id === defaultTaxClassId && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Default</span>}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenModal('edit', tc)}><Edit className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteTaxClass(tc.id)} disabled={!canDeleteTax}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}><DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{modalMode === 'edit' ? 'Edit Tax Class' : 'Add New Tax Class'}</DialogTitle><DialogDescription>Details and rates for this tax class.</DialogDescription></DialogHeader>
        <form onSubmit={handleSaveTaxClass} className="mt-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4"><Label htmlFor="name" className="sm:text-right">Name</Label><Input id="name" value={currentTaxClass?.name || ''} onChange={(e) => setCurrentTaxClass(p => ({...p!, name: e.target.value}))} className="sm:col-span-3" required disabled={modalMode === 'add' ? !canCreateTax : !canEditTax} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4"><Label htmlFor="description" className="sm:text-right">Description</Label><Input id="description" value={currentTaxClass?.description || ''} onChange={(e) => setCurrentTaxClass(p => ({...p!, description: e.target.value}))} className="sm:col-span-3" disabled={modalMode === 'add' ? !canCreateTax : !canEditTax} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4"><Label htmlFor="is_default" className="sm:text-right">Set as Default</Label><Checkbox id="is_default" checked={isDefaultInModal} onCheckedChange={(checked) => setIsDefaultInModal(!!checked)} className="sm:col-span-3 justify-self-start" disabled={!canEditStoreTax} /></div>
            {modalMode === 'add' ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="applies_to_all_stores" className="sm:text-right">Applies To</Label>
                <div className="sm:col-span-3 flex items-center gap-2">
                  <Checkbox
                    id="applies_to_all_stores"
                    checked={appliesToAllStoresInModal}
                    onCheckedChange={(checked) => setAppliesToAllStoresInModal(!!checked)}
                    disabled={!canCreateTax}
                  />
                  <Label htmlFor="applies_to_all_stores" className="font-normal text-sm text-muted-foreground">
                    All stores (tenant-wide default — a store can still define its own tax classes to override this)
                  </Label>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right">Scope</Label>
                <span className="sm:col-span-3 text-sm text-muted-foreground">
                  {currentTaxClass?.store_id ? 'This store only' : 'All stores (tenant-wide default)'}
                </span>
              </div>
            )}
          </div>
          {modalMode === 'edit' && currentTaxClass && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex justify-between items-center mb-3"><h3 className="text-lg font-semibold">Tax Rates</h3><Button type="button" variant="outline" size="sm" onClick={() => setEditingRate({ taxRateName: '', rate: undefined, priority: 0, isCompound: false })} disabled={!canCreateTax}><PlusCircle className="mr-2 h-4 w-4" /> Add Rate</Button></div>
              {editingRate && (
                <div className="p-4 border rounded-lg mb-4 bg-gray-50 dark:bg-muted/50">
                  <h4 className="font-semibold mb-2">{editingRate.id ? 'Edit Rate' : 'Add New Rate'}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label htmlFor="taxRateName">Rate Name</Label><Input id="taxRateName" value={editingRate.taxRateName || ''} onChange={(e) => setEditingRate(p => ({...p!, taxRateName: e.target.value}))} required disabled={editingRate.id ? !canEditTax : !canCreateTax} /></div>
                    <div><Label htmlFor="rate">Rate (%)</Label><Input id="rate" type="number" value={editingRate.rate || ''} onChange={(e) => setEditingRate(p => ({...p!, rate: parseFloat(e.target.value)}))} required disabled={editingRate.id ? !canEditTax : !canCreateTax} /></div>
                    <div><Label htmlFor="priority">Priority</Label><Input id="priority" type="number" value={editingRate.priority || ''} onChange={(e) => setEditingRate(p => ({...p!, priority: parseInt(e.target.value, 10)}))} required disabled={editingRate.id ? !canEditTax : !canCreateTax} /></div>
                  </div>
                  <div className="flex items-center space-x-2 mt-4">
                    <Checkbox id="isCompound" checked={!!editingRate.isCompound} onCheckedChange={(c) => setEditingRate(p => ({...p!, isCompound: !!c}))} disabled={editingRate.id ? !canEditTax : !canCreateTax} />
                    <Label htmlFor="isCompound" className="cursor-pointer">Is Compound?</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger type="button">
                          <Info className="h-4 w-4 text-gray-400 dark:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={5} className="max-w-xs">
                          <p>Compound tax is calculated on the sum of the item price and other non-compound taxes.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4"><Button type="button" variant="ghost" onClick={() => setEditingRate(null)}>Cancel</Button><Button type="button" onClick={handleSaveRate} disabled={isSaving || (editingRate.id ? !canEditTax : !canCreateTax)}>{isSaving ? 'Saving...' : 'Save Rate'}</Button></div>
                </div>
              )}
              <table className="min-w-full text-sm"><thead><tr><th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2 text-right">Rate</th><th className="px-2 py-2 text-center">Priority</th><th className="px-2 py-2 text-right">Actions</th></tr></thead>
                <tbody>{taxRates.map(rate => (<tr key={rate.id}><td className="px-2 py-2 text-left">{rate.taxRateName}</td><td className="px-2 py-2 text-right">{rate.rate !== undefined ? `${rate.rate}%` : ''}</td><td className="px-2 py-2 text-center">{rate.priority}</td><td className="px-2 py-2 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => setEditingRate(rate)}>Edit</Button><Button type="button" variant="ghost" size="sm" className="text-red-600" disabled={!canDeleteTax} onClick={() => { setRateToDelete(rate); setShowDeleteConfirm(true); }}>Delete</Button></td></tr>))}</tbody>
              </table>
            </div>
          )}
          {error && isModalOpen && (
            <div className="mt-4 p-2 text-center text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}
          <DialogFooter className="mt-6"><Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button><Button type="submit" disabled={isSaving || (modalMode === 'add' ? !canCreateTax : !canEditTax)}>{isSaving ? 'Saving...' : 'Save Changes'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}><DialogContent>
          <DialogHeader><DialogTitle>Are you sure?</DialogTitle><DialogDescription>This will permanently delete the tax rate "{rateToDelete?.taxRateName}".</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button><Button variant="destructive" onClick={handleDeleteRate}>Delete</Button></DialogFooter>
      </DialogContent></Dialog>

      <ConfirmDialog
        open={!!taxClassToDelete}
        onOpenChange={(open) => { if (!open) setTaxClassToDelete(null); }}
        title="Delete tax class?"
        description="Are you sure you want to delete this tax class? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteTaxClass}
      />
    </div>
  );
};

export default SettingsTaxes;
