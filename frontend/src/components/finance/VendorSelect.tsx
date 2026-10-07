import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Vendor } from '@/services/financeService';

/**
 * Searchable vendor (supplier) combobox — type to filter the tenant's
 * suppliers, click to select, or create a new vendor inline via the
 * finance vendors endpoint (no suppliers.* permission needed).
 */
export default function VendorSelect({
  vendors, value, onChange, onAdd, disabled, placeholder = 'Search vendors…',
}: {
  vendors: Vendor[];
  value: Vendor | null;
  onChange: (v: Vendor | null) => void;
  onAdd?: (name: string) => Promise<Vendor>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(v =>
      v.supplierName.toLowerCase().includes(q) ||
      (v.contactPerson || '').toLowerCase().includes(q)
    );
  }, [vendors, query]);

  const exact = filtered.some(v => v.supplierName.toLowerCase() === query.trim().toLowerCase());

  const pick = (v: Vendor) => { onChange(v); setOpen(false); setQuery(''); };

  const addNew = async () => {
    const name = query.trim();
    if (!name || !onAdd) return;
    setBusy(true);
    try {
      const v = await onAdd(name);
      pick(v);
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 mt-1 h-11 rounded-md border bg-muted/40 px-3">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate font-medium">{value.supplierName}</span>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground" aria-label="Clear vendor">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative mt-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-10 h-11"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-56 overflow-y-auto">
          {filtered.map(v => (
            <button
              key={v.id} type="button"
              className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center gap-2"
              onClick={() => pick(v)}
            >
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{v.supplierName}</span>
                {(v.contactPerson || v.phone) && (
                  <span className="block text-xs text-muted-foreground truncate">
                    {[v.contactPerson, v.phone].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            </button>
          ))}
          {query.trim() && !exact && onAdd && (
            adding ? (
              <div className="p-3 border-t space-y-2">
                <p className="text-xs text-muted-foreground">Create vendor “{query.trim()}”:</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addNew} disabled={busy}>
                    {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add vendor
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted/60 text-primary flex items-center gap-2 border-t"
                onClick={() => setAdding(true)}
              >
                <Plus className="h-4 w-4" /> Add “{query.trim()}” as new vendor
              </button>
            )
          )}
          {!filtered.length && !query.trim() && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {onAdd ? 'No vendors yet — type a name to add one.' : 'No vendors found.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
