import { useMemo } from 'react';
import { useOptionalStore } from '@/contexts/StoreContext';

// Map DB-stored number pattern to a locale that uses equivalent grouping/decimal separators
function localeForNumberPattern(pattern?: string): string {
  switch (pattern) {
    case '1,234.56':
      return 'en-US'; // comma group, dot decimal
    case '1.234,56':
      return 'de-DE'; // dot group, comma decimal
    case '1 234 567,89':
      return 'fr-FR'; // space group, comma decimal
    default:
      return 'en-US';
  }
}

/* ─── weight unit config ──────────────────────────────────────────────────── */
export type WeightUnit = 'g' | 'oz' | 'tola' | 'baht' | 'kg';

const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  g:    'g',
  oz:   'oz',
  tola: 'tola',
  baht: 'baht',
  kg:   'kg',
};

// Grams per unit (for display conversion if raw values are always stored in grams)
const GRAMS_PER_UNIT: Record<WeightUnit, number> = {
  g:    1,
  oz:   31.1035,
  tola: 11.6638,
  baht: 15.244,
  kg:   1000,
};

export function useLocaleFormat() {
  // Optional, not the throwing useStore(): this hook is used from
  // PrintAgentFleetSection, which renders on the public, unauthenticated
  // /print-agent route (see App.tsx) where no StoreProvider ever mounts.
  // Every value below already has a sensible default, so an absent store
  // just means "use the defaults" rather than a crash.
  const store = useOptionalStore()?.store;

  const numberLocale = useMemo(() => localeForNumberPattern(store?.numberFormat as unknown as string), [store?.numberFormat]);
  const timeZone = store?.timezone || 'UTC';
  const currency = store?.currencyCode || 'USD';
  const decimalPrecision = typeof store?.decimalPrecision === 'number' ? store!.decimalPrecision : 2;
  const locale = store?.localeCode || 'en-US';
  // Weight unit comes from tenant_pricing_settings via store or falls back to 'g'
  const weightUnit: WeightUnit = ((store as any)?.weightUnit as WeightUnit) || 'g';

  const numberFormatter = useMemo(() => new Intl.NumberFormat(numberLocale, {
    minimumFractionDigits: decimalPrecision,
    maximumFractionDigits: decimalPrecision,
  }), [numberLocale, decimalPrecision]);

  const currencyFormatter = useMemo(() => new Intl.NumberFormat(numberLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimalPrecision,
    maximumFractionDigits: decimalPrecision,
  }), [numberLocale, currency, decimalPrecision]);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone,
  }), [locale, timeZone]);

  const timeFormatter12 = useMemo(() => new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone,
  }), [locale, timeZone]);

  const timeFormatter24 = useMemo(() => new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone,
  }), [locale, timeZone]);

  function formatNumber(value: number | string | null | undefined): string {
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) return '';
    return numberFormatter.format(num);
  }

  function formatCurrency(value: number | string | null | undefined): string {
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) return '';
    return currencyFormatter.format(num);
  }

  function formatDate(date: Date | string | number): string {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    // Use store's dateFormat setting if available
    const storeFormat = store?.dateFormat;
    if (storeFormat) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      // Convert store format to actual date string
      return storeFormat
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day);
    }
    
    // Fallback to Intl formatter
    return dateFormatter.format(d);
  }

  function formatTime(date: Date | string | number): string {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const use12 = (store?.timeFormat || 'hh:mm A') === 'hh:mm A';
    return (use12 ? timeFormatter12 : timeFormatter24).format(d);
  }

  /**
   * Format a weight value stored in grams into the org's preferred weight unit.
   * e.g. formatWeight(31.1035) → "1.000 oz" when weightUnit='oz'
   *      formatWeight(10)      → "10.000 g"  when weightUnit='g'
   *      formatWeight(10)      → "0.858 tola" when weightUnit='tola'
   *
   * @param grams  Value in grams (as stored in DB)
   * @param dp     Decimal places, defaults to 3
   * @param showUnit  Whether to append the unit label
   */
  function formatWeight(grams: number | null | undefined, dp = 3, showUnit = true): string {
    if (grams == null || isNaN(Number(grams))) return '—';
    const converted = Number(grams) / GRAMS_PER_UNIT[weightUnit];
    const formatted = new Intl.NumberFormat(numberLocale, {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(converted);
    return showUnit ? `${formatted} ${WEIGHT_UNIT_LABELS[weightUnit]}` : formatted;
  }

  /** The current org weight unit label (for column headers etc.) */
  const weightUnitLabel = WEIGHT_UNIT_LABELS[weightUnit];

  return {
    formatNumber,
    formatCurrency,
    formatDate,
    formatTime,
    formatWeight,
    weightUnit,
    weightUnitLabel,
    numberLocale,
    timeZone,
  };
}
