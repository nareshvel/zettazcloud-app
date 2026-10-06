import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Store as StoreIcon, Plus, Check, Loader2, Trash2, Star, RotateCcw, Clock, AlertTriangle, X, Share2 } from 'lucide-react';
import { useOptionalStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  switchStore,
  deleteStore,
  setDefaultStore,
  getDeletedStores,
  restoreStore,
  DeletedStore,
} from '@/services/storeService';
import { shareExistingProductsAcrossStores } from '@/services/productService';
import CreateStoreModal from '../stores/CreateStoreModal';

/**
 * Tenant Admin-only tab on the Profile page — list every store, switch into
 * one, create a new one, change the default store, or delete a non-default
 * one (soft delete + 30-day restore window). Mirrors the same Current/Switch/
 * Create actions already in the TopBar dropdown, but as a proper page.
 *
 * Deletion rules (see backend/routes/store.routes.js):
 *   - The default store can never be deleted here — only by deleting the
 *     entire tenant account. Change the default first via "Set as default".
 *   - A non-default store CAN be deleted even with products/sales/users —
 *     the confirm dialog makes that explicit — but it's a soft delete with a
 *     30-day restore window, not immediate data loss.
 *
 * See docs/17-migration-and-roadmap/19_Store_Creation_And_Switching.md.
 */
const StoresTab: React.FC = () => {
  const storeCtx = useOptionalStore();
  const { user } = useAuth();
  // Same field precedence UserProfilePage.tsx's Business tab uses for the
  // same data. Shown as context above the list — a company running several
  // differently-named/-typed stores (see docs/17-migration-and-roadmap/
  // 22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md) otherwise has no
  // visual cue here that they all belong to the same company.
  const companyName: string = (user as any)?.tenantName || (user as any)?.tenant?.name || '';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletedStores, setDeletedStores] = useState<DeletedStore[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; wasCurrent: boolean } | null>(null);
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const stores = storeCtx?.accessibleStores || [];

  const loadDeletedStores = async () => {
    setDeletedLoading(true);
    try {
      const list = await getDeletedStores();
      setDeletedStores(Array.isArray(list) ? list : []);
    } catch {
      setDeletedStores([]);
    } finally {
      setDeletedLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedStores();
  }, []);

  const handleSwitch = async (storeId: string) => {
    if (busyId) return;
    setBusyId(storeId);
    try {
      await switchStore(storeId);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to switch store.');
      setBusyId(null);
    }
  };

  const handleSetDefault = async (storeId: string, name: string) => {
    if (busyId) return;
    setBusyId(storeId);
    try {
      await setDefaultStore(storeId);
      toast.success(`${name} is now your default store`);
      await storeCtx?.refreshAccessibleStores();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to set default store.');
    } finally {
      setBusyId(null);
    }
  };

  // Opens the in-app confirm dialog below rather than window.confirm() —
  // the browser-native dialog can't carry our styling or the conditional
  // "you'll be switched" note, and some users find an unbranded native
  // confirm() confusing/untrustworthy inside an app.
  const handleDelete = (storeId: string, name: string) => {
    if (busyId) return;
    const target = stores.find((s) => s.id === storeId);
    setConfirmTarget({ id: storeId, name, wasCurrent: !!target?.isCurrent });
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    const { id: storeId, name, wasCurrent } = confirmTarget;
    setConfirmTarget(null);
    setBusyId(storeId);
    try {
      await deleteStore(storeId);
      // If the store just deleted was the one the session is currently bound
      // to, its JWT's store_id now points at a soft-deleted store — every
      // request after this would fail scope checks (e.g. GET
      // /api/jurisdiction/current) until the session moves to a store that
      // still exists. switchStore() mints a fresh token and reloads, so do
      // that immediately rather than leaving the user stranded.
      if (wasCurrent) {
        const remaining = stores.filter((s) => s.id !== storeId);
        const next = remaining.find((s) => s.isDefault) || remaining[0];
        if (next) {
          toast.success(`${name} deleted — switching you to ${next.name}`);
          await switchStore(next.id);
          return;
        }
      }
      toast.success(`${name} deleted — it can be restored within 30 days`);
      await storeCtx?.refreshAccessibleStores();
      await loadDeletedStores();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete store.');
    } finally {
      setBusyId(null);
    }
  };

  const handleShareExisting = async () => {
    setShowShareConfirm(false);
    setIsSharing(true);
    try {
      const { converted, skipped } = await shareExistingProductsAcrossStores();
      if (converted === 0) {
        toast.success('Nothing to do — every product is already shared across stores.');
      } else {
        toast.success(
          `${converted} product${converted === 1 ? '' : 's'} now shared across all stores` +
          (skipped ? ` (${skipped} skipped — already had a listing)` : '')
        );
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to share existing products.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleRestore = async (storeId: string, name: string) => {
    if (busyId) return;
    setBusyId(storeId);
    try {
      await restoreStore(storeId);
      toast.success(`${name} restored`);
      await storeCtx?.refreshAccessibleStores();
      await loadDeletedStores();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to restore store.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <StoreIcon className="h-4 w-4 text-primary" /> Stores
            </h3>
            {companyName && (
              <p className="mt-0.5 text-xs text-muted-foreground">{companyName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {stores.length > 1 && (
              <button
                type="button"
                onClick={() => setShowShareConfirm(true)}
                disabled={isSharing}
                title="Make every existing product visible at every store"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground text-xs font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isSharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                Share existing products
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Create Store
            </button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Manage every store in your business — switch between them, add a new one, change which
          one is your default, or delete a store you no longer need.
        </p>

        {stores.length > 1 && (
          <p className="text-xs text-muted-foreground -mt-2">
            New products are shared across all stores automatically. Products created before you
            added another store are still tied to their original store — use{' '}
            <span className="font-medium text-foreground">"Share existing products"</span> above to
            make them visible everywhere too (their current stock and pricing won't change).
          </p>
        )}

        {stores.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No stores found.</p>
        )}

        {stores.length > 0 && (
          <ul className="divide-y divide-border">
            {stores.map((s) => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
                  {s.isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 shrink-0">
                      <Star className="h-3 w-3 fill-current" /> Default
                    </span>
                  )}
                  {s.isCurrent && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                      <Check className="h-3 w-3" /> Current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleSwitch(s.id)}
                      disabled={busyId === s.id}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Switch to this store'}
                    </button>
                  )}
                  {!s.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(s.id, s.name)}
                      disabled={busyId === s.id}
                      title="Set as default store"
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id, s.name)}
                    disabled={busyId === s.id || s.isDefault}
                    title={s.isDefault ? 'The default store cannot be deleted — set a different store as default first' : 'Delete store'}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Your default store can't be deleted directly — it can only be removed by deleting your
          entire tenant account. Set a different store as default first if you need to delete this
          one. Deleting any other store is allowed even if it has products, sales, or other data;
          it's soft-deleted with a 30-day restore window before that data is permanently purged.
        </p>

        {isCreateOpen && (
          <CreateStoreModal
            onClose={() => setIsCreateOpen(false)}
            onCreated={async (newStoreId) => {
              setIsCreateOpen(false);
              await storeCtx?.refreshAccessibleStores();
              handleSwitch(newStoreId);
            }}
          />
        )}
      </div>

      {(deletedLoading || deletedStores.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" /> Recently deleted
          </h3>

          {deletedLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {deletedStores.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.daysRemaining > 0
                        ? `Permanently deleted in ${s.daysRemaining} day${s.daysRemaining === 1 ? '' : 's'}`
                        : 'Permanently deleted very soon'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(s.id, s.name)}
                    disabled={busyId === s.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
                  >
                    {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showShareConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" /> Share existing products
              </h3>
              <button
                type="button"
                onClick={() => setShowShareConfirm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-foreground">
                Make every product currently tied to a single store visible at all of your stores?
              </p>
              <p className="text-sm text-muted-foreground">
                Each product's current stock, price, and cost tracking stay exactly as they are at
                the store it already belongs to — nothing changes there. Other stores (including
                any new one) will then be able to find it and receive stock into it, starting from
                zero. This only affects products that aren't already shared, and it's safe to run
                more than once.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowShareConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleShareExisting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Share products
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Delete store
              </h3>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-foreground">
                Delete <span className="font-semibold">"{confirmTarget.name}"</span>?
              </p>
              <p className="text-sm text-muted-foreground">
                This store — and any products, sales, or other data it has — will be soft-deleted
                immediately and permanently purged in 30 days. You can restore it any time before
                then from "Recently deleted" below.
              </p>
              {confirmTarget.wasCurrent && (
                <p className="text-sm text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
                  You're currently signed into this store — you'll be switched to another one.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Delete store
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoresTab;
