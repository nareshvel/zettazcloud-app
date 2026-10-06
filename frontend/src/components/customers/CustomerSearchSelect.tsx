/**
 * CustomerSearchSelect
 *
 * Reusable component for searching and selecting a customer with:
 *  - Live search dropdown with rich result rows
 *  - Rich selected-customer card (avatar, code, type badge, phone, email, address)
 *  - Inline quick-add form OR a callback to open a full quick-add modal
 *
 * Usage:
 *   <CustomerSearchSelect selected={customer} onSelect={setCustomer} />
 *   <CustomerSearchSelect selected={customer} onSelect={setCustomer} allowQuickAdd={false} />
 */

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { User, X, Loader2, UserPlus } from 'lucide-react';
import { searchCustomers, createCustomer } from '@/services/api';
import { Button } from '@/components/ui/button';

/* ── Standardised customer hit type ─────────────────────────────────────── */
export interface CustomerHit {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  customerCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  customerType?: string | null;
}

/** Map a raw API customer row (snake_case or camelCase) to CustomerHit */
export function mapToCustomerHit(c: any): CustomerHit {
  return {
    id:           c.id,
    firstName:    c.first_name    ?? c.firstName    ?? '',
    lastName:     c.last_name     ?? c.lastName     ?? null,
    phone:        c.phone_number  ?? c.phoneNumber  ?? c.phone ?? null,
    email:        c.email         ?? null,
    customerCode: c.customer_code ?? c.customerCode ?? null,
    addressLine1: c.address_line1 ?? c.addressLine1 ?? null,
    addressLine2: c.address_line2 ?? c.addressLine2 ?? null,
    city:         c.city          ?? null,
    stateProvince:c.state_province ?? c.stateProvince ?? null,
    postalCode:   c.postal_code   ?? c.postalCode   ?? null,
    country:      c.country       ?? null,
    customerType: c.customer_type ?? c.customerType ?? null,
  };
}

/**
 * Map a {@link CustomerHit} (the shape this component and the search API
 * return) to the richer `Customer` shape `CartContext.setSelectedCustomer`
 * expects. Shared by every screen that lets a cashier attach a customer to a
 * cart (POS, Sales Hub duty-free intake) so the conversion — and its
 * `isTaxExempt` handling — can't drift between callers.
 */
export function mapCustomerHitToCustomer(hit: CustomerHit): import('@/types').Customer {
  const customer = {
    id: hit.id,
    tenantId: '',
    firstName: hit.firstName,
    lastName: hit.lastName ?? null,
    email: hit.email ?? null,
    phoneNumber: hit.phone ?? null,
    customerCode: hit.customerCode ?? null,
    customerType: (hit.customerType as any) ?? 'INDIVIDUAL',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    addressLine1: hit.addressLine1 ?? null,
    addressLine2: hit.addressLine2 ?? null,
    city: hit.city ?? null,
    stateProvince: hit.stateProvince ?? null,
    postalCode: hit.postalCode ?? null,
    country: hit.country ?? null,
  };
  return {
    ...customer,
    isTaxExempt:
      (customer as any).is_tax_exempt === true ||
      (customer as any).is_tax_exempt === 1,
  } as import('@/types').Customer;
}

/* ── Shared input / label styles ─────────────────────────────────────────── */
const inputCls =
  'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background text-foreground placeholder:text-muted-foreground transition-colors text-sm';
const labelCls =
  'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';

/* ══════════════════════════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════════════════════════ */
export interface CustomerSearchSelectProps {
  /** Currently selected customer, or null */
  selected: CustomerHit | null;
  /** Called when a customer is selected or cleared */
  onSelect: (c: CustomerHit | null) => void;
  /** Show the inline quick-add form when no result found (default: true) */
  allowQuickAdd?: boolean;
  /** If provided, called instead of showing the inline form */
  onQuickAddRequested?: (prefillName?: string) => void;
  placeholder?: string;
  /**
   * Pre-fill the search box with this value on mount and fire the search
   * immediately (skipping the debounce wait) — used by Sales Hub quick
   * actions that already captured the customer name the cashier typed.
   */
  initialQuery?: string;
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
const CustomerSearchSelect: React.FC<CustomerSearchSelectProps> = ({
  selected,
  onSelect,
  allowQuickAdd = true,
  onQuickAddRequested,
  placeholder = 'Search by name or phone…',
  initialQuery,
}) => {
  const [q, setQ]                   = useState(initialQuery || '');
  const [hits, setHits]             = useState<CustomerHit[]>([]);
  const [open, setOpen]             = useState(false);
  const [busy, setBusy]             = useState(false);
  const [noResults, setNoResults]   = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [quickForm, setQuickForm]   = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [quickSaving, setQuickSaving] = useState(false);
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null);

  /* Search */
  useEffect(() => {
    const id = setTimeout(async () => {
      if (q.length < 2) { setHits([]); setNoResults(false); return; }
      setBusy(true);
      try {
        const res = await searchCustomers(q);
        const mapped = (res as any[]).map(mapToCustomerHit);
        setHits(mapped);
        setNoResults(mapped.length === 0);
        if (inputRef.current) {
          const r = inputRef.current.getBoundingClientRect();
          setDropRect({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width });
        }
        setOpen(true);
      } catch { setHits([]); } finally { setBusy(false); }
    }, 280);
    return () => clearTimeout(id);
  }, [q]);

  /* Preset from a Sales Hub quick action — fire the search immediately on
     mount instead of waiting on the 280ms debounce above (q was already
     seeded with initialQuery via initial state). */
  useEffect(() => {
    if (!initialQuery || initialQuery.trim().length < 2) return;
    (async () => {
      setBusy(true);
      try {
        const res = await searchCustomers(initialQuery);
        const mapped = (res as any[]).map(mapToCustomerHit);
        setHits(mapped);
        setNoResults(mapped.length === 0);
        if (inputRef.current) {
          const r = inputRef.current.getBoundingClientRect();
          setDropRect({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width });
        }
        setOpen(true);
      } catch { setHits([]); } finally { setBusy(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Close on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleAddClick = (prefill?: string) => {
    if (onQuickAddRequested) {
      onQuickAddRequested(prefill);
    } else {
      setShowInlineAdd(true);
      setQuickForm(f => ({ ...f, firstName: prefill?.trim() ?? '' }));
      setOpen(false);
    }
  };

  const saveQuickCustomer = async () => {
    if (!quickForm.firstName) return;
    setQuickSaving(true);
    try {
      const created: any = await createCustomer({
        firstName:   quickForm.firstName,
        lastName:    quickForm.lastName  || null,
        phoneNumber: quickForm.phone     || null,
        email:       quickForm.email     || null,
        customerType: 'retail',
      } as any);
      onSelect(mapToCustomerHit((created as any)?.customer ?? created));
      setShowInlineAdd(false);
      setQ('');
    } catch { /* ignore — parent can show toast */ }
    finally { setQuickSaving(false); }
  };

  /* ── Selected: rich card ─────────────────────────────────────────────── */
  if (selected) {
    const addrParts = [
      selected.addressLine1, selected.addressLine2,
      selected.city, selected.stateProvince, selected.postalCode,
    ].filter(Boolean);

    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-primary text-sm font-bold select-none">
            {(selected.firstName?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground text-sm">
                {[selected.firstName, selected.lastName].filter(Boolean).join(' ')}
              </span>
              {selected.customerCode && (
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {selected.customerCode}
                </span>
              )}
              {selected.customerType && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">
                  {selected.customerType.toLowerCase().replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {selected.phone && <span className="text-xs text-muted-foreground">📞 {selected.phone}</span>}
              {selected.email && <span className="text-xs text-muted-foreground">✉ {selected.email}</span>}
            </div>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded"
            title="Remove customer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {addrParts.length > 0 && (
          <div className="border-t border-primary/15 px-4 py-2 bg-primary/[0.03]">
            <p className="text-xs text-muted-foreground">📍 {addrParts.join(', ')}</p>
          </div>
        )}
      </div>
    );
  }

  /* ── Search input + dropdown + quick-add ─────────────────────────────── */
  return (
    <div ref={ref} className="space-y-2">
      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            className={`${inputCls} pl-9 ${allowQuickAdd ? 'pr-9' : ''}`}
            placeholder={placeholder}
            value={q}
            onChange={e => { setQ(e.target.value); setShowInlineAdd(false); }}
            onFocus={() => {
              if (hits.length > 0 && inputRef.current) {
                const r = inputRef.current.getBoundingClientRect();
                setDropRect({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width });
                setOpen(true);
              }
            }}
            autoComplete="off"
          />
          {busy && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        {allowQuickAdd && (
          <button
            type="button"
            onClick={() => handleAddClick(q || undefined)}
            title="Add new customer"
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown — rendered in a portal to escape overflow:hidden ancestors */}
      {open && (hits.length > 0 || noResults) && dropRect && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top:   dropRect.top,
            left:  dropRect.left,
            width: dropRect.width,
            zIndex: 9999,
          }}
          className="bg-card border border-border rounded-lg shadow-xl overflow-hidden"
        >
          {hits.slice(0, 7).map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => { onSelect(c); setQ(''); setOpen(false); setNoResults(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 text-left text-sm border-b border-border last:border-0"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary text-xs font-bold">
                {(c.firstName?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">
                  {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                  {c.customerCode && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{c.customerCode}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[c.phone, c.email, c.city].filter(Boolean).join(' · ')}
                </p>
              </div>
            </button>
          ))}
          {noResults && (
            <div className="px-3 py-2.5 text-sm text-muted-foreground border-b border-border">
              No customers found for "<strong>{q}</strong>"
            </div>
          )}
          {allowQuickAdd && (
            <button
              type="button"
              onMouseDown={() => handleAddClick(q)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-primary/5 text-sm text-primary font-medium"
            >
              <UserPlus className="h-4 w-4" /> Add new customer
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Inline quick-add form */}
      {showInlineAdd && allowQuickAdd && !onQuickAddRequested && (
        <div className="border border-primary/30 rounded-xl bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> New Customer
            </p>
            <button onClick={() => setShowInlineAdd(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>First Name *</label>
              <input className={inputCls} placeholder="First name" value={quickForm.firstName}
                onChange={e => setQuickForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input className={inputCls} placeholder="Last name" value={quickForm.lastName}
                onChange={e => setQuickForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} placeholder="Phone number" value={quickForm.phone}
                onChange={e => setQuickForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" placeholder="Email" value={quickForm.email}
                onChange={e => setQuickForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={saveQuickCustomer}
            disabled={quickSaving || !quickForm.firstName}
          >
            {quickSaving
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              : <><UserPlus className="h-3.5 w-3.5" /> Create & Select</>}
          </Button>
        </div>
      )}

    </div>
  );
};

export default CustomerSearchSelect;
