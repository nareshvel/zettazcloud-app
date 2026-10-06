import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Store as StoreIcon, Loader2, Building2, Globe2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createStore, CreateStorePayload } from '@/services/storeService';
import { listIndustries, IndustryOption } from '@/services/retailProfileService';
import { LANGUAGES } from '@/data/localization/languages';
import { CURRENCIES } from '@/data/localization/currencies';
import { TIMEZONES } from '@/data/localization/timezones';
import { COUNTRIES } from '@/data/localization/countries';

interface CreateStoreModalProps {
  onClose: () => void;
  /** Called with the new store's id on success — TopBar switches into it. */
  onCreated: (newStoreId: string) => void;
}

type TabId = 'general' | 'localization';

// Same restriction LocalizationSettings.tsx applies — only languages we ship
// translations for.
const SUPPORTED_LANGUAGE_CODES = ['en', 'es', 'fr', 'hi', 'ta', 'te'];
const LANGUAGE_OPTIONS = LANGUAGES.filter((l) => SUPPORTED_LANGUAGE_CODES.includes(l.code));

// UI key <-> DB pattern string mapping for numberFormat — identical contract
// to LocalizationSettings.tsx's uiToDbNumberFormat/dbToUiNumberFormat, kept
// in sync here since the backend stores the raw pattern, not the UI key.
const NUMBER_FORMAT_TO_DB: Record<string, string> = {
  point_comma: '1,234.56',
  comma_point: '1.234,56',
  space_comma: '1 234 567,89',
};

interface WizardState {
  name: string;
  address: string;
  phone: string;
  email: string;
  languageCode: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  numberFormat: string; // UI key, converted to DB pattern on submit
  decimalPrecision: number;
  measurementSystem: 'metric' | 'imperial';
  dateFormat: string;
  timeFormat: string;
  theme: 'light' | 'dark';
  defaultTaxBasis: 'INCLUSIVE' | 'EXCLUSIVE';
  startEmptyCatalog: boolean;
  /** Empty string = inherit the tenant's company-wide default. */
  industryCode: string;
  isDutyFree: boolean;
}

const DEFAULT_STATE: WizardState = {
  name: '',
  address: '',
  phone: '',
  email: '',
  languageCode: 'en',
  countryCode: 'US',
  currencyCode: 'USD',
  timezone: 'UTC',
  numberFormat: 'point_comma',
  decimalPrecision: 2,
  measurementSystem: 'metric',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: 'hh:mm A',
  theme: 'light',
  defaultTaxBasis: 'EXCLUSIVE',
  startEmptyCatalog: false,
  industryCode: '',
  isDutyFree: false,
};

const inputCls = 'block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1.5';

/**
 * Full setup wizard — General + Localization tabs, matching every field the
 * existing Store Settings page collects (GeneralSettings.tsx /
 * LocalizationSettings.tsx), per the confirmed "full setup form" decision in
 * docs/17-migration-and-roadmap/19_Store_Creation_And_Switching.md.
 *
 * Business Type and duty-free are collected here too (added 2026-09-01) —
 * both are sent to POST /api/stores, which applies them via
 * retailProfileService.updateRetailProfile BEFORE provisioning the store's
 * print templates, so a store created as e.g. souvenir_gifts + duty-free
 * gets its correct documents immediately instead of the tenant's default
 * templates with a required follow-up trip to Settings to fix. Leaving
 * Business Type on "Inherit from company" (the default) reproduces the old
 * behavior exactly. Invoice-numbering is still configured after creation —
 * it has no sensible default to offer at creation time. Logo upload is still
 * excluded (no store id exists until after creation).
 */
const CreateStoreModal: React.FC<CreateStoreModalProps> = ({ onClose, onCreated }) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [form, setForm] = useState<WizardState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);

  useEffect(() => {
    listIndustries().then(setIndustries).catch(() => { /* dropdown just won't offer overrides */ });
  }, []);

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Deliberately NOT wired to a <form onSubmit> — see the plain <div> wrapper
  // below. An earlier version used <form onSubmit={handleSubmit}> with the
  // "Next: Localization" button as type="button", which should be inert for
  // submission purposes, but was still observed closing the modal on click
  // in the browser (reported, not reproduced from reading the code alone).
  // Removing form semantics entirely — no <form> element, no submit-type
  // button, "Create Store" wired directly to this handler via onClick —
  // eliminates the whole class of implicit-submission behaviors (Enter-key
  // auto-submit on a lone text field, a stray type="submit", etc.) rather
  // than relying on getting every button's `type` attribute right.
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Store name is required.');
      setActiveTab('general');
      return;
    }
    setSaving(true);
    setLimitError(null);
    try {
      const payload: CreateStorePayload = {
        name: form.name.trim(),
        address: form.address,
        phone: form.phone,
        email: form.email,
        languageCode: form.languageCode,
        countryCode: form.countryCode,
        currencyCode: form.currencyCode,
        timezone: form.timezone,
        numberFormat: NUMBER_FORMAT_TO_DB[form.numberFormat] || NUMBER_FORMAT_TO_DB.point_comma,
        decimalPrecision: form.decimalPrecision,
        measurementSystem: form.measurementSystem,
        dateFormat: form.dateFormat,
        timeFormat: form.timeFormat,
        theme: form.theme,
        defaultTaxBasis: form.defaultTaxBasis,
        catalogSharing: form.startEmptyCatalog ? 'empty' : 'shared',
        industryCode: form.industryCode || undefined,
        isDutyFree: form.isDutyFree,
      };
      const store = await createStore(payload);
      toast.success(`${store.name} created`);
      onCreated(store.id);
    } catch (error: any) {
      // withinUsageLimits() returns a 402 with a clear message when the plan's
      // `stores` limit is reached — surfaced inline with an upgrade link
      // rather than just a toast, since this is the one failure mode the
      // user can't just retry.
      const message = error?.message || 'Failed to create store.';
      if (error?.status === 402) {
        setLimitError(message);
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'localization', label: 'Localization', icon: Globe2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <StoreIcon className="h-4 w-4 text-primary" /> Create Store
          </h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-border shrink-0 px-2">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.id === 'general' && !form.name.trim() && (
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" title="Required field missing" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {limitError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {limitError}{' '}
                <Link to="/profile?tab=subscription" onClick={onClose} className="underline font-medium">
                  Upgrade your plan
                </Link>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Store Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    required
                    className={inputCls}
                    placeholder="e.g. Riverside Branch"
                  />
                </div>
                <div>
                  <label className={labelCls}>Store Address</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    rows={2}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email Address</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Default Tax Basis</label>
                  <select
                    value={form.defaultTaxBasis}
                    onChange={(e) => set('defaultTaxBasis', e.target.value as 'INCLUSIVE' | 'EXCLUSIVE')}
                    className={inputCls}
                  >
                    <option value="EXCLUSIVE">Exclusive (tax added at checkout)</option>
                    <option value="INCLUSIVE">Inclusive (prices include tax)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Business Type</label>
                  <select
                    value={form.industryCode}
                    onChange={(e) => set('industryCode', e.target.value)}
                    disabled
                    title="Per-store business type is on hold for now — every store in a company currently shares the same business type."
                    className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <option value="">Inherit from company</option>
                    {industries.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Temporarily disabled — mixed business types within one company aren't supported yet.
                    Every store currently inherits the company's business type; per-store overrides are
                    on hold until multi-business-type companies are fully supported.
                  </p>
                </div>
                <div className="pt-2 border-t border-border">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isDutyFree}
                      onChange={(e) => set('isDutyFree', e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border rounded"
                    />
                    <span className="text-sm text-foreground">
                      This store sells duty-free / export
                      <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                        Sales here won't be taxed, and the store gets a duty-free receipt/invoice
                        template in addition to its normal one. Requires capturing traveller ID at
                        checkout. Can be changed later from Store Settings.
                      </span>
                    </span>
                  </label>
                </div>
                <div className="pt-2 border-t border-border">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.startEmptyCatalog}
                      onChange={(e) => set('startEmptyCatalog', e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border rounded"
                    />
                    <span className="text-sm text-foreground">
                      Start with an empty catalog
                      <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                        By default, every product shared across all stores is made available here
                        immediately (with stock starting at 0). Check this to skip that — none of
                        the shared catalog will be sellable at this store until added later.
                        Store-specific products from other stores are never shared either way.
                      </span>
                    </span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store logo and invoice numbering can be configured after creation from Store
                  Settings.
                </p>
              </div>
            )}

            {activeTab === 'localization' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Language</label>
                  <select value={form.languageCode} onChange={(e) => set('languageCode', e.target.value)} className={inputCls}>
                    {LANGUAGE_OPTIONS.map((l) => <option key={l.code} value={l.code}>{`${l.name} — ${l.nativeName}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <select value={form.countryCode} onChange={(e) => set('countryCode', e.target.value)} className={inputCls}>
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{`${c.name} (${c.code})`}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Currency</label>
                  <select value={form.currencyCode} onChange={(e) => set('currencyCode', e.target.value)} className={inputCls}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{`${c.code} — ${c.name} (${c.symbol})`}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Timezone</label>
                  <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className={inputCls}>
                    {TIMEZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Number Format</label>
                  <select value={form.numberFormat} onChange={(e) => set('numberFormat', e.target.value)} className={inputCls}>
                    <option value="point_comma">1,234,567.89 — point decimal</option>
                    <option value="comma_point">1.234.567,89 — comma decimal</option>
                    <option value="space_comma">1 234 567,89 — space + comma</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Decimal Precision</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={form.decimalPrecision}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n) && n >= 0 && n <= 6) set('decimalPrecision', n);
                    }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Measurement System</label>
                  <select value={form.measurementSystem} onChange={(e) => set('measurementSystem', e.target.value as 'metric' | 'imperial')} className={inputCls}>
                    <option value="metric">Metric (kg, m, L)</option>
                    <option value="imperial">Imperial (lb, ft, gal)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date Format</label>
                  <select value={form.dateFormat} onChange={(e) => set('dateFormat', e.target.value)} className={inputCls}>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Time Format</label>
                  <select value={form.timeFormat} onChange={(e) => set('timeFormat', e.target.value)} className={inputCls}>
                    <option value="hh:mm A">12-hour (hh:mm AM/PM)</option>
                    <option value="HH:mm">24-hour (HH:mm)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Display Theme</label>
                  <select value={form.theme} onChange={(e) => set('theme', e.target.value as 'light' | 'dark')} className={inputCls}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-2 px-5 py-4 border-t border-border shrink-0">
            <div className="text-xs text-muted-foreground">
              {activeTab === 'general' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              {activeTab === 'general' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('localization')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                  Next: Localization
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? 'Creating…' : 'Create Store'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateStoreModal;
