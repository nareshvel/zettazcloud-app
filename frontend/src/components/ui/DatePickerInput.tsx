/**
 * DatePickerInput
 * - Text input in org date format (store.dateFormat)
 * - Auto-inserts separator after each segment as you type
 * - Validates on blur — rejects future dates and pre-1920
 * - Calendar popover (DayPicker) with month + year dropdowns
 * - Emits / receives ISO "YYYY-MM-DD"
 */
import React, { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { CalendarDays } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import 'react-day-picker/dist/style.css';

// ── helpers ──────────────────────────────────────────────────────────────────

function storeToDateFns(sf: string) {
  return sf.replace('YYYY', 'yyyy').replace('DD', 'dd');
}

function isoToDisplay(iso: string, sf: string): string {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.split('-');
  return sf.replace('YYYY', y).replace('MM', m).replace('DD', d);
}

function displayToIso(display: string, sf: string, maxD: Date, minD: Date): string | null {
  // extract parts based on format order
  const sep = sf.includes('/') ? '/' : '-';
  const parts = display.split(sep);
  const fParts = sf.split(sep);
  if (parts.length !== 3) return null;

  const map: Record<string, string> = {};
  fParts.forEach((token, i) => { map[token] = parts[i]; });

  const y = parseInt(map['YYYY'], 10);
  const m = parseInt(map['MM'], 10);
  const d = parseInt(map['DD'], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  if (date > maxD) return null;
  if (date < minD) return null;

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Auto-inserts separator after day/month segments as user types */
function autoFormat(raw: string, sf: string): string {
  const sep    = sf.includes('/') ? '/' : '-';
  const digits = raw.replace(/\D/g, '');
  const isYearFirst = sf.startsWith('YYYY');

  if (isYearFirst) {
    const y = digits.slice(0, 4);
    const m = digits.slice(4, 6);
    const d = digits.slice(6, 8);
    let r = y;
    if (digits.length > 4) r += sep + m;
    if (digits.length > 6) r += sep + d;
    return r;
  }
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 4);
  const p3 = digits.slice(4, 8);
  let r = p1;
  if (digits.length > 2) r += sep + p2;
  if (digits.length > 4) r += sep + p3;
  return r;
}

// ── component ─────────────────────────────────────────────────────────────────

export interface DatePickerInputProps {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxDate?: Date | string;
  minDate?: Date | string;
}

function toDate(v: Date | string | undefined, fallback: Date): Date {
  if (!v) return fallback;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : d;
}

const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false,
  maxDate,
  minDate,
}) => {
  const maxD = toDate(maxDate, new Date());
  const minD = toDate(minDate, new Date(1920, 0, 1));
  const { store } = useStore();
  const sf      = store?.dateFormat || 'MM/DD/YYYY';

  const [text,   setText]   = useState(() => isoToDisplay(value, sf));
  const [error,  setError]  = useState('');
  const [open,   setOpen]   = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const prevIso      = useRef(value);

  // Sync when value changes externally
  useEffect(() => {
    if (value !== prevIso.current) {
      prevIso.current = value;
      setText(isoToDisplay(value, sf));
      setError('');
    }
  }, [value, sf]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const commit = (iso: string) => {
    prevIso.current = iso;
    onChange(iso);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(autoFormat(e.target.value, sf));
    setError('');
  };

  const handleBlur = () => {
    if (!text.trim()) { commit(''); return; }
    const iso = displayToIso(text, sf, maxD, minD);
    if (!iso) {
      setError(`Enter a valid date — ${sf}`);
      setText(isoToDisplay(value, sf)); // revert
    } else {
      commit(iso);
      setText(isoToDisplay(iso, sf));
      setError('');
    }
  };

  const handleDayClick = (day: Date) => {
    const iso = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0'),
    ].join('-');
    commit(iso);
    setText(isoToDisplay(iso, sf));
    setError('');
    setOpen(false);
  };

  const selected = (() => {
    if (!value) return undefined;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? undefined : dt;
  })();

  const inputBase = [
    'w-full pl-3.5 pr-9 py-2.5 text-xs border rounded-lg shadow-sm bg-background',
    'transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40',
    'focus:border-primary placeholder:text-muted-foreground text-foreground',
    error ? 'border-red-400 focus:ring-red-300' : 'border-border hover:border-primary/50',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder ?? sf}
        className={inputBase}
      />

      {/* Calendar toggle button */}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
      >
        <CalendarDays className="h-3.5 w-3.5" />
      </button>

      {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}

      {/* Calendar popover */}
      {open && (
        <div className="absolute z-50 mt-1.5 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <DayPicker
            mode="single"
            selected={selected}
            onDayClick={handleDayClick}
            defaultMonth={selected ?? (maxD.getTime() < Date.now() ? maxD : new Date())}
            fromDate={minD}
            toDate={maxD}
            captionLayout="dropdown-buttons"
            fromYear={minD.getFullYear()}
            toYear={maxD.getFullYear()}
            showOutsideDays
            styles={{ root: { margin: 0, padding: '10px' } }}
            classNames={{
              months:             'flex flex-col',
              month:              'space-y-2',
              caption:            'flex justify-center items-center gap-1 relative pb-1',
              caption_label:      'hidden',
              caption_dropdowns:  'flex gap-1',
              dropdown:           'text-xs bg-background border border-border rounded-md px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer',
              nav:                'flex items-center gap-1',
              nav_button:         'h-6 w-6 rounded-md border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors',
              nav_button_previous:'absolute left-0',
              nav_button_next:    'absolute right-0',
              table:              'w-full border-collapse',
              head_row:           'flex',
              head_cell:          'text-muted-foreground w-8 text-[10px] font-medium uppercase text-center',
              row:                'flex w-full mt-0.5',
              cell:               'w-8 h-8 text-center p-0',
              day:                'w-8 h-8 text-[11px] font-normal rounded-md hover:bg-muted transition-colors flex items-center justify-center',
              day_selected:       'bg-primary text-primary-foreground hover:bg-primary',
              day_today:          'border border-primary text-foreground font-semibold',
              day_outside:        'text-muted-foreground opacity-40',
              day_disabled:       'opacity-25 cursor-not-allowed',
              day_hidden:         'invisible',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DatePickerInput;
