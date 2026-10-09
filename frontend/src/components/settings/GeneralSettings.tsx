import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useI18n } from '../../hooks/useI18n';
import { Store } from '../../types';
import toast from 'react-hot-toast';
import { getRetailProfile, updateRetailProfile, listIndustries, IndustryOption } from '@/services/retailProfileService';
import { ImagePlus, X, UploadCloud, Image } from 'lucide-react';
import axiosInstance from '../../services/axiosConfig';
import { normalizeImageUrl } from '../../utils/imageUtils';

const GeneralSettings: React.FC = () => {
  const { store, updateStore } = useStore();
  const { user } = useAuth();
  const { t } = useI18n();

  // The save path writes PATCH /stores/:id, which requires stores.edit —
  // view-only users get a read-only form instead of a 403 on save.
  const canEdit = hasPermission(user, 'stores.edit');

  const tSettings = (key: string, fallback: string) => t(key, { ns: 'settings', defaultValue: fallback });

  const [generalSettings, setGeneralSettings] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    logoUrl: ''
  });

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Business Type — a company-wide DEFAULT is set in UserProfilePage.tsx's
  // "Business" tab (Tenant Admin only), but each store may now override it
  // (see docs/17-migration-and-roadmap/22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md).
  // '' = inherit the company default; any other value = this store's own override.
  const [industryOptions, setIndustryOptions] = useState<IndustryOption[]>([]);
  const [industryOverride, setIndustryOverride] = useState<string>('');
  const [initialIndustryOverride, setInitialIndustryOverride] = useState<string>('');
  const [resolvedIndustryLabel, setResolvedIndustryLabel] = useState<string>('');

  // Duty-free — sits beside Business Type because the two together decide which
  // documents this store gets. Unlike business type, this one also decides
  // whether tax is charged at all, so it is confirmed before saving.
  const [isDutyFree, setIsDutyFree] = useState<boolean>(false);
  const [initialDutyFree, setInitialDutyFree] = useState<boolean>(false);
  const [dutyFreeAvailable, setDutyFreeAvailable] = useState<boolean>(false);

  // Register enforcement — a stores.require_open_register flag; on, the POS
  // cannot complete a sale until a drawer session is open for this store.
  const [requireRegister, setRequireRegister] = useState<boolean>(false);

  // Document numbering. Two independent decisions: whether a gapless number is
  // ISSUED, and whether it is PRINTED — and printing differs by document,
  // because a till slip is identified by its barcode while an invoice is
  // settled against its number.
  const [numbering, setNumbering] = useState({
    sequential: false, onReceipt: false, onInvoice: true,
  });
  const [initialNumbering, setInitialNumbering] = useState(numbering);
  const [numberingMandatory, setNumberingMandatory] = useState(false);

  useEffect(() => {
    if (store) {
      setGeneralSettings({
        name: store.name || '',
        phone: store.phone || '',
        email: store.email || '',
        address: store.address || '',
        logoUrl: store.logoUrl || ''
      });
      setRequireRegister(!!store.requireOpenRegister);
    }
  }, [store]);

  useEffect(() => {
    // Duty-free lives on the store's jurisdiction settings, not on the store
    // row, so it is loaded separately. If the call fails the toggle stays
    // hidden rather than defaulting to "domestic" — showing an unchecked box
    // we could not verify would misreport a duty-free store as taxable.
    getRetailProfile()
      .then((profile) => {
        setIsDutyFree(profile.isDutyFree);
        setInitialDutyFree(profile.isDutyFree);
        setDutyFreeAvailable(true);

        const loaded = {
          sequential: profile.sequentialNumbering,
          onReceipt: profile.showNumberOnReceipt,
          onInvoice: profile.showNumberOnInvoice,
        };
        setNumbering(loaded);
        setInitialNumbering(loaded);
        setNumberingMandatory(profile.sequentialNumberingMandatory);

        setResolvedIndustryLabel(profile.industryLabel);
        const override = profile.industryIsOverride ? profile.industryCode : '';
        setIndustryOverride(override);
        setInitialIndustryOverride(override);
      })
      .catch(() => setDutyFreeAvailable(false));

    listIndustries().then(setIndustryOptions).catch(() => setIndustryOptions([]));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGeneralSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB.'); return; }
    const storeId = store?.id;
    if (!storeId) { toast.error('Store not loaded.'); return; }
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'logo');
      form.append('label', 'Store Logo');
      const res = await axiosInstance.post(`/api/attachments/store/${storeId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const rawUrl: string = res.data?.data?.url;
      if (!rawUrl) throw new Error('No URL returned');
      // Store only the relative path; consumers resolve it with normalizeImageUrl
      const url = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl;
      setGeneralSettings(prev => ({ ...prev, logoUrl: url }));
      toast.success('Logo uploaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!store) {
      toast.error('Store context not available.');
      return;
    }

    // Duty-free decides whether tax is charged at all, so it gets an explicit
    // confirmation. Flipping it by accident means either charging tax that
    // should not be charged, or failing to charge tax that should be — both are
    // the kind of mistake that surfaces at an audit rather than at the till.
    const dutyFreeChanged = dutyFreeAvailable && isDutyFree !== initialDutyFree;
    if (dutyFreeChanged) {
      const message = isDutyFree
        ? 'Switch this store to DUTY-FREE?\n\nSales will be zero-rated — no tax will be charged — and traveller details may be required at checkout.'
        : 'Switch this store back to DOMESTIC?\n\nSales will be taxed at the local rate from now on.';
      if (!window.confirm(message)) return;
    }

    try {
      const updatedSettings: Partial<Store> = {
        id: store.id,
        tenantId: store.tenantId,
        requireOpenRegister: requireRegister,
        ...generalSettings
      };
      await updateStore(updatedSettings);

      const numberingChanged = dutyFreeAvailable && (
        numbering.sequential !== initialNumbering.sequential
        || numbering.onReceipt !== initialNumbering.onReceipt
        || numbering.onInvoice !== initialNumbering.onInvoice
      );
      // '' -> a real code (new override), a code -> '' (reset to inherit), or
      // one code -> a different code (changed override). null on the wire
      // means "reset to inherit"; a string means "override to this code".
      const industryChanged = dutyFreeAvailable && industryOverride !== initialIndustryOverride;

      const numberingPatch = numberingChanged ? {
        sequentialNumbering: numbering.sequential,
        showNumberOnReceipt: numbering.onReceipt,
        showNumberOnInvoice: numbering.onInvoice,
      } : {};
      const industryPatch = industryChanged ? {
        industryCode: (industryOverride === '' ? null : industryOverride) as any,
      } : {};

      // Sent together, whenever any of the three changed, so a single save
      // cannot leave parts of the profile disagreeing with each other.
      if (dutyFreeChanged || numberingChanged || industryChanged) {
        const profile = await updateRetailProfile({
          ...(dutyFreeChanged ? { isDutyFree } : {}),
          ...numberingPatch,
          ...industryPatch,
        });
        if (dutyFreeChanged) setInitialDutyFree(isDutyFree);
        if (numberingChanged) setInitialNumbering(numbering);
        if (industryChanged) {
          setInitialIndustryOverride(industryOverride);
          setResolvedIndustryLabel(profile.industryLabel);
        }

        // Switching to duty-free (or business type) can add a document the
        // store didn't have. Say so — otherwise a new template appears in
        // the list with no explanation of where it came from.
        const added = profile.provisionedTemplates || [];
        if (added.length) {
          toast.success(
            added.length === 1
              ? `Added "${added[0].name}" to your print templates.`
              : `Added ${added.length} print templates for this profile.`,
          );
        }
      }

      toast.success(tSettings('general.save_success', 'General settings saved successfully!'));
    } catch (error) {
      console.error('Failed to save general settings:', error);
      toast.error(tSettings('general.save_error', 'Failed to save general settings.'));
    }
  };

  const inputCls = 'block w-full px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg text-sm text-gray-900 dark:text-foreground placeholder:text-gray-400 dark:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5';

  return (
    <form onSubmit={handleSave}>
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">{tSettings('general.store_information', 'Store Information')}</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Basic details about your store location and contact.</p>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="name" className={labelCls}>{tSettings('general.store_name', 'Store Name')}</label>
              <input type="text" name="name" id="name" value={generalSettings.name} onChange={handleChange} className={inputCls} placeholder="e.g. Zettaz Jewellers" disabled={!canEdit} />
            </div>
            <div>
              <label htmlFor="phone" className={labelCls}>{tSettings('general.phone', 'Phone Number')}</label>
              <input type="text" name="phone" id="phone" value={generalSettings.phone} onChange={handleChange} className={inputCls} placeholder="+1 (555) 000-0000" disabled={!canEdit} />
            </div>
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>{tSettings('general.email', 'Email Address')}</label>
            <input type="email" name="email" id="email" value={generalSettings.email} onChange={handleChange} className={inputCls} placeholder="store@example.com" disabled={!canEdit} />
          </div>
          <div>
            <label htmlFor="address" className={labelCls}>{tSettings('general.address', 'Store Address')}</label>
            <textarea name="address" id="address" value={generalSettings.address} onChange={handleChange} rows={3} className={inputCls} disabled={!canEdit}></textarea>
          </div>

          {/* Store Logo */}
          <div>
            <label className={labelCls}>{tSettings('general.store_logo', 'Store Logo')}</label>
            <div className="relative inline-block">
              {/* Single tile: shows the logo (click to replace) or the upload
                  prompt when empty. Drag & drop works in both states. */}
              <div
                onDragOver={e => { if (!canEdit) return; e.preventDefault(); setLogoDragOver(true); }}
                onDragLeave={() => setLogoDragOver(false)}
                onDrop={e => { if (!canEdit) return; e.preventDefault(); setLogoDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleLogoUpload(f); }}
                onClick={() => { if (canEdit) logoInputRef.current?.click(); }}
                className={`group relative w-40 h-28 rounded-xl border-2 overflow-hidden transition-colors
                  ${!canEdit ? 'border-gray-200 dark:border-border opacity-80'
                    : `cursor-pointer ${logoDragOver ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-border hover:border-primary/50 hover:bg-gray-50'}`}
                  ${!generalSettings.logoUrl ? 'border-dashed' : 'border-solid'}`}
                title={!canEdit ? 'You have view-only access to store settings'
                  : generalSettings.logoUrl ? 'Click or drop a file to replace the logo' : undefined}
              >
                {generalSettings.logoUrl ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-muted/50 p-2">
                      <img
                        src={normalizeImageUrl(generalSettings.logoUrl) || undefined}
                        alt="Store logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    {/* Replace hint — visible on hover for editors */}
                    {canEdit && !logoUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-medium text-white">Click to replace</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2">
                    {logoUploading
                      ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                      : <UploadCloud className="h-6 w-6 text-gray-400 dark:text-muted-foreground" />}
                    <span className="text-xs text-gray-500 dark:text-muted-foreground text-center">
                      {logoUploading ? 'Uploading…' : canEdit ? 'Click or drag & drop' : 'No logo yet'}
                    </span>
                    {canEdit && <span className="text-xs text-gray-400 dark:text-muted-foreground">PNG, JPG, WebP · max 2 MB</span>}
                  </div>
                )}
                {/* Uploading overlay over the logo state too */}
                {logoUploading && generalSettings.logoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-card/70">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={!canEdit}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
                />
              </div>
              {generalSettings.logoUrl && canEdit && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setGeneralSettings(prev => ({ ...prev, logoUrl: '' })); }}
                  className="absolute -top-2 -right-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-0.5 shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors z-10"
                  title="Remove logo"
                >
                  <X className="h-3.5 w-3.5 text-gray-500 dark:text-muted-foreground hover:text-red-500" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-muted-foreground mt-2">Logo used across the app: receipts, reports, and more. Recommended: transparent PNG, min 300px wide.</p>
          </div>

          {/*
            Business Type. A company-wide default lives in My Profile's
            Business tab. Per-store override is temporarily on hold — mixed
            business types within one company aren't fully supported yet
            (see CLAUDE.md / 2026-09-02 decision) — so the control below is
            disabled rather than removed, in case per-store override is
            re-enabled later.
          */}
          {dutyFreeAvailable && (
            <div>
              <label htmlFor="industryOverride" className={labelCls}>
                Business Type
              </label>
              <select
                id="industryOverride"
                name="industryOverride"
                value={industryOverride}
                onChange={(e) => setIndustryOverride(e.target.value)}
                disabled
                title="Per-store business type is on hold for now — every store in a company currently shares the same business type."
                className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <option value="">{`Inherit from company (currently: ${resolvedIndustryLabel || 'General Retail'})`}</option>
                {industryOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-muted-foreground">
                Temporarily disabled — mixed business types within one company aren't supported yet. Every store currently follows the company's business type.
              </p>
            </div>
          )}

          {/*
            Duty-free sits directly beneath Business Type: together they decide
            which documents this store gets. It is rendered only once the current
            value has actually been loaded — an unchecked box we could not verify
            would tell a duty-free operator they are taxable.
          */}
          {dutyFreeAvailable && (
            <div>
              <label htmlFor="isDutyFree" className="flex items-start gap-3 cursor-pointer">
                <input
                  id="isDutyFree"
                  name="isDutyFree"
                  type="checkbox"
                  checked={isDutyFree}
                  onChange={(e) => setIsDutyFree(e.target.checked)}
                  disabled={!canEdit}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-border text-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                />
                <span>
                  <span className={labelCls}>
                    {tSettings('general.duty_free_store', 'Duty-Free Store')}
                  </span>
                  <span className="block mt-1 text-xs text-gray-500 dark:text-muted-foreground">
                    {tSettings(
                      'general.duty_free_help',
                      'Sales are zero-rated for export — no local tax is charged — and duty-free documents become available alongside your normal ones. Travellers may be asked for passport or boarding-pass details at checkout.',
                    )}
                  </span>
                </span>
              </label>

              {isDutyFree !== initialDutyFree && (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-500">
                  {isDutyFree
                    ? tSettings('general.duty_free_pending_on', 'Not saved yet — saving will stop tax being charged on new sales.')
                    : tSettings('general.duty_free_pending_off', 'Not saved yet — saving will start charging local tax on new sales.')}
                </p>
              )}
            </div>
          )}

          {/*
            Document numbering.
            Two independent decisions, grouped so the difference is visible:
              * is a gapless number ISSUED for each sale?
              * is it PRINTED, and on which documents?
            Most shops want the second off for till slips — the barcode does that
            job — and on for A4 invoices, which is what the defaults give them.
          */}
          {dutyFreeAvailable && (
            <div className="pt-1">
              <p className={labelCls}>
                {tSettings('general.document_numbering', 'Document Numbering')}
              </p>

              <label htmlFor="seqNumbering" className="flex items-start gap-3 mt-2 cursor-pointer">
                <input
                  id="seqNumbering"
                  type="checkbox"
                  checked={numbering.sequential || numberingMandatory}
                  disabled={numberingMandatory || !canEdit}
                  onChange={(e) => setNumbering({ ...numbering, sequential: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-border text-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                />
                <span className="text-sm text-gray-700 dark:text-foreground">
                  {tSettings('general.seq_numbering', 'Issue sequential invoice numbers')}
                  <span className="block mt-0.5 text-xs text-gray-500 dark:text-muted-foreground">
                    {numberingMandatory
                      ? tSettings('general.seq_numbering_required', 'Required in your country — this cannot be turned off.')
                      : tSettings('general.seq_numbering_help', 'Gives every sale a gapless number such as INV-2026-000417. Without it, sales are identified by a short reference.')}
                  </span>
                </span>
              </label>

              <label htmlFor="showNumInvoice" className="flex items-start gap-3 mt-3 cursor-pointer">
                <input
                  id="showNumInvoice"
                  type="checkbox"
                  checked={numbering.onInvoice}
                  disabled={!canEdit}
                  onChange={(e) => setNumbering({ ...numbering, onInvoice: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-border text-primary focus:ring-2 focus:ring-primary/40"
                />
                <span className="text-sm text-gray-700 dark:text-foreground">
                  {tSettings('general.show_number_invoice', 'Print the number on A4 / Letter invoices')}
                  <span className="block mt-0.5 text-xs text-gray-500 dark:text-muted-foreground">
                    {tSettings('general.show_number_invoice_help', 'Recommended. Wholesale, trade and high-value customers settle against the invoice number — it goes on their remittance and purchase orders.')}
                  </span>
                </span>
              </label>

              <label htmlFor="showNumReceipt" className="flex items-start gap-3 mt-3 cursor-pointer">
                <input
                  id="showNumReceipt"
                  type="checkbox"
                  checked={numbering.onReceipt}
                  disabled={!canEdit}
                  onChange={(e) => setNumbering({ ...numbering, onReceipt: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-border text-primary focus:ring-2 focus:ring-primary/40"
                />
                <span className="text-sm text-gray-700 dark:text-foreground">
                  {tSettings('general.show_number_receipt', 'Print the number on till receipts')}
                  <span className="block mt-0.5 text-xs text-gray-500 dark:text-muted-foreground">
                    {tSettings('general.show_number_receipt_help', 'Usually unnecessary — receipts carry a barcode or QR code that staff scan for returns and lookups. Turn on if your customers quote the number instead.')}
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Register enforcement — a store policy, not tied to duty-free. */}
          <div className="pt-1">
            <p className={labelCls}>
              {tSettings('general.register_section', 'Cash Register')}
            </p>
            <label htmlFor="requireOpenRegister" className="flex items-start gap-3 mt-2 cursor-pointer">
              <input
                id="requireOpenRegister"
                type="checkbox"
                checked={requireRegister}
                disabled={!canEdit}
                onChange={(e) => setRequireRegister(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-border text-primary focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-sm text-gray-700 dark:text-foreground">
                {tSettings('general.require_register', 'Require an open register before selling')}
                <span className="block mt-0.5 text-xs text-gray-500 dark:text-muted-foreground">
                  {tSettings('general.require_register_help', 'When on, the POS cannot complete a sale until a register session is open for this store — cash accountability enforced at the till. When off, the open-register prompt is a dismissable reminder.')}
                </span>
              </span>
            </label>
          </div>
        </div>
        <div className="px-5 py-4 bg-gray-50 dark:bg-muted/50 border-t border-gray-100 dark:border-border flex items-center justify-between gap-3">
          {!canEdit && (
            <p className="text-xs text-gray-500 dark:text-muted-foreground">
              {tSettings('general.view_only', 'View-only access — ask a manager to make changes.')}
            </p>
          )}
          <button type="submit" disabled={!canEdit} className="ml-auto px-5 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {tSettings('buttons.save_changes', 'Save Changes')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default GeneralSettings;
