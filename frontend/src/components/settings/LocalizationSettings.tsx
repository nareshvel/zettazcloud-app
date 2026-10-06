import React, { useState, useEffect } from 'react';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useI18n } from '../../hooks/useI18n';
import { useTheme } from '../../contexts/ThemeContext';
import { Store } from '../../types';
import toast from 'react-hot-toast';
import { LANGUAGES } from '@/data/localization/languages';
import { CURRENCIES } from '@/data/localization/currencies';
import { TIMEZONES } from '@/data/localization/timezones';
import { COUNTRIES } from '@/data/localization/countries';

const LocalizationSettings: React.FC = () => {
  const { store, updateStore } = useStore();
  const { user } = useAuth();
  const { t, changeLanguage } = useI18n();

  // Save path is PATCH /stores/settings → stores.edit (same as General).
  const canEdit = hasPermission(user, 'stores.edit');
  const { setTheme } = useTheme();

  const tSettings = (key: string, fallback: string) => t(key, { ns: 'settings', defaultValue: fallback });

  const [settings, setSettings] = useState({
    localeCode: 'en-US',
    languageCode: 'en',
    countryCode: 'US',
    currencyCode: 'USD',
    numberFormat: 'point_comma',
    decimalPrecision: 2,
    measurementSystem: 'metric',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: 'hh:mm A',
    timezone: 'UTC',
    theme: 'light' as 'light' | 'dark'
  });

  useEffect(() => {
    if (store) {
      // Map DB pattern (e.g., '1,234.56') to UI key (e.g., 'point_comma')
      const dbToUiNumberFormat = (pattern?: string) => {
        switch (pattern) {
          case '1,234.56':
            return 'point_comma';
          case '1.234,56':
            return 'comma_point';
          case '1 234 567,89':
            return 'space_comma';
          default:
            return 'point_comma';
        }
      };

      setSettings({
        localeCode: store.localeCode || 'en-US',
        languageCode: store.languageCode || 'en',
        countryCode: store.countryCode || 'US',
        currencyCode: store.currencyCode || 'USD',
        numberFormat: dbToUiNumberFormat(store.numberFormat as unknown as string),
        decimalPrecision: store.decimalPrecision || 2,
        measurementSystem: store.measurementSystem || 'metric',
        dateFormat: store.dateFormat || 'MM/DD/YYYY',
        timeFormat: store.timeFormat || 'hh:mm A',
        timezone: store.timezone || 'UTC',
        theme: (store.theme as 'light' | 'dark') || 'light'
      });
    }
  }, [store]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Basic numeric validation for decimalPrecision
    if (name === 'decimalPrecision') {
      const num = Number(value);
      if (!Number.isNaN(num) && num >= 0 && num <= 6) {
        setSettings(prev => ({ ...prev, [name]: num }));
      }
      return;
    }
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!store) {
      toast.error('Store context not available.');
      return;
    }

    try {
      // Map UI key to DB pattern string
      const uiToDbNumberFormat = (key: string) => {
        switch (key) {
          case 'point_comma':
            return '1,234.56';
          case 'comma_point':
            return '1.234,56';
          case 'space_comma':
            return '1 234 567,89';
          default:
            return '1,234.56';
        }
      };

      const updatedSettings: Partial<Store> = {
        id: store.id,
        tenantId: store.tenantId,
        ...settings,
        numberFormat: uiToDbNumberFormat(settings.numberFormat as unknown as string) as unknown as any,
        decimalPrecision: Number(settings.decimalPrecision),
        measurementSystem: settings.measurementSystem as 'metric' | 'imperial',
        theme: settings.theme,
      };
      await updateStore(updatedSettings);
      await changeLanguage(settings.languageCode);
      // Apply theme immediately and clear any session override so DB value is canonical
      localStorage.removeItem('zettaz-theme-override');
      setTheme(settings.theme);
      toast.success(tSettings('localization.save_success', 'Localization settings saved successfully!'));
    } catch (error) {
      console.error('Failed to save localization settings:', error);
      toast.error(tSettings('localization.save_error', 'Failed to save localization settings.'));
    }
  };

  // Only show languages we currently ship translations for (present under public/locales)
  const SUPPORTED_LANGUAGE_CODES = ['en', 'es', 'fr', 'hi', 'ta', 'te'];
  const languageOptions = LANGUAGES.filter(l => SUPPORTED_LANGUAGE_CODES.includes(l.code));
  const currencyOptions = CURRENCIES;
  const timezoneOptions = TIMEZONES;
  const countryOptions = COUNTRIES;

  const inputCls = 'block w-full px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg text-sm text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5';

  return (
    <form onSubmit={handleSave}>
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">{tSettings('localization.title', 'Localization Settings')}</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Regional format and display preferences for your store.</p>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="languageCode" className={labelCls}>{tSettings('localization.language', 'Language')}</label>
            <select name="languageCode" id="languageCode" value={settings.languageCode} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              {languageOptions.map(l => <option key={l.code} value={l.code}>{`${l.name} — ${l.nativeName}`}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="countryCode" className={labelCls}>{tSettings('localization.country', 'Country')}</label>
            <select name="countryCode" id="countryCode" value={settings.countryCode} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              {countryOptions.map(c => <option key={c.code} value={c.code}>{`${c.name} (${c.code})`}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="currencyCode" className={labelCls}>{tSettings('localization.currency', 'Currency')}</label>
            <select name="currencyCode" id="currencyCode" value={settings.currencyCode} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              {currencyOptions.map(c => <option key={c.code} value={c.code}>{`${c.code} — ${c.name} (${c.symbol})`}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="timezone" className={labelCls}>{tSettings('localization.timezone', 'Timezone')}</label>
            <select name="timezone" id="timezone" value={settings.timezone} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              {timezoneOptions.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="numberFormat" className={labelCls}>{tSettings('localization.number_format', 'Number Format')}</label>
            <select name="numberFormat" id="numberFormat" value={settings.numberFormat} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              <option value="point_comma">1,234,567.89 — point decimal</option>
              <option value="comma_point">1.234.567,89 — comma decimal</option>
              <option value="space_comma">1 234 567,89 — space + comma</option>
            </select>
          </div>
          <div>
            <label htmlFor="decimalPrecision" className={labelCls}>{tSettings('localization.decimal_precision', 'Decimal Precision')}</label>
            <input type="number" min={0} max={6} name="decimalPrecision" id="decimalPrecision" value={settings.decimalPrecision} onChange={handleChange} className={inputCls} disabled={!canEdit} />
            <p className="mt-1 text-xs text-gray-400 dark:text-muted-foreground">0–6 decimal places shown on prices.</p>
          </div>
          <div>
            <label htmlFor="measurementSystem" className={labelCls}>{tSettings('localization.measurement_system', 'Measurement System')}</label>
            <select name="measurementSystem" id="measurementSystem" value={settings.measurementSystem} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              <option value="metric">Metric (kg, m, L)</option>
              <option value="imperial">Imperial (lb, ft, gal)</option>
            </select>
          </div>
          <div>
            <label htmlFor="dateFormat" className={labelCls}>{tSettings('localization.date_format', 'Date Format')}</label>
            <select name="dateFormat" id="dateFormat" value={settings.dateFormat} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            </select>
          </div>
          <div>
            <label htmlFor="timeFormat" className={labelCls}>{tSettings('localization.time_format', 'Time Format')}</label>
            <select name="timeFormat" id="timeFormat" value={settings.timeFormat} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              <option value="hh:mm A">12-hour (hh:mm AM/PM)</option>
              <option value="HH:mm">24-hour (HH:mm)</option>
            </select>
          </div>
          <div>
            <label htmlFor="theme" className={labelCls}>Display Theme</label>
            <select name="theme" id="theme" value={settings.theme} onChange={handleChange} className={inputCls} disabled={!canEdit}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="mt-1 text-xs text-gray-400 dark:text-muted-foreground">Saved to your account — applies on every login.</p>
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

export default LocalizationSettings;
