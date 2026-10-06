/**
 * QuickAddCustomerModal
 *
 * Universal "add customer" modal used from Layaway, Repairs, POS, Old Gold, Savings Schemes.
 *
 * Sections (all always available, collapsed by default except Essential):
 *   1. Essential     — name, type, phone, email  (always open)
 *   2. Identity      — DOB, gender, nationality, ID type, ID number (expandable)
 *   3. Address       — full address (expandable)
 *   4. Financial     — tax ID / VAT, credit limit, notes (expandable)
 *
 * Emits ISO birthDate; nationality/idType/idNumber captured for duty-free compliance.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, ChevronUp, CreditCard, DollarSign, Globe, Hash,
  Loader2, Mail, MapPin, Phone, ShieldCheck, User, UserPlus, X,
} from 'lucide-react';
import { createCustomer } from '@/services/api';
import { Button } from '@/components/ui/button';
import { CustomerHit, mapToCustomerHit } from './CustomerSearchSelect';
import { COUNTRIES } from '@/data/localization/countries';
import DatePickerInput from '@/components/ui/DatePickerInput';

// ── shared styles ─────────────────────────────────────────────────────────────
const inp = (err?: string) =>
  `w-full px-3.5 py-2.5 border ${err ? 'border-red-400' : 'border-border'} rounded-lg shadow-sm ` +
  `focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background ` +
  `text-foreground placeholder:text-muted-foreground transition-colors text-sm`;
const lbl = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';
const ico = 'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 pointer-events-none';

export interface QuickAddCustomerModalProps {
  isOpen: boolean;
  prefillName?: string;
  onClose: () => void;
  onCreated: (customer: CustomerHit) => void;
}

type CustomerTypeValue = 'INDIVIDUAL' | 'BUSINESS' | 'RETAIL' | 'WHOLESALE' | 'TOURIST';

const CUSTOMER_TYPES: { value: CustomerTypeValue; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'RETAIL',     label: 'Retail'     },
  { value: 'BUSINESS',   label: 'Business'   },
  { value: 'WHOLESALE',  label: 'Wholesale'  },
  { value: 'TOURIST',    label: 'Tourist'    },
];

type FormState = {
  firstName: string; lastName: string; phone: string; email: string;
  customerType: CustomerTypeValue;
  // identity
  birthDate: string; gender: string;
  nationality: string; idType: string; idNumber: string;
  // address
  addressLine1: string; addressLine2: string; city: string;
  stateProvince: string; postalCode: string; country: string;
  // financial
  taxIdNumber: string; creditLimit: string; notes: string;
};

const BLANK: FormState = {
  firstName: '', lastName: '', phone: '', email: '',
  customerType: 'INDIVIDUAL',
  birthDate: '', gender: '',
  nationality: '', idType: '', idNumber: '',
  addressLine1: '', addressLine2: '', city: '',
  stateProvince: '', postalCode: '', country: '',
  taxIdNumber: '', creditLimit: '', notes: '',
};

const ID_TYPES = [
  { value: 'passport',          label: 'Passport' },
  { value: 'national_id',       label: 'National ID' },
  { value: 'drivers_license',   label: "Driver's License" },
  { value: 'residence_permit',  label: 'Residence Permit' },
  { value: 'other',             label: 'Other' },
];

// Collapsible section wrapper
const Section: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ icon: Icon, label, open, onToggle, children }) => (
  <div className="rounded-xl border border-border overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
    {open && <div className="p-4 space-y-3 bg-muted/10">{children}</div>}
  </div>
);

const QuickAddCustomerModal: React.FC<QuickAddCustomerModalProps> = ({
  isOpen, prefillName = '', onClose, onCreated,
}) => {
  const [form, setForm] = useState<FormState>({ ...BLANK, firstName: prefillName });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openIdentity,  setOpenIdentity]  = useState(false);
  const [openAddress,   setOpenAddress]   = useState(false);
  const [openFinancial, setOpenFinancial] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ ...BLANK, firstName: prefillName });
      setError('');
      setSaving(false);
      setOpenIdentity(false);
      setOpenAddress(false);
      setOpenFinancial(false);
      setTimeout(() => firstRef.current?.focus(), 80);
    }
  }, [isOpen, prefillName]);

  if (!isOpen) return null;

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));
  const isPersonal = ['INDIVIDUAL', 'TOURIST'].includes(form.customerType);

  const save = async () => {
    if (!form.firstName.trim()) { setError('First name is required.'); return; }
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) { setError('Invalid email address.'); return; }
    setSaving(true); setError('');
    try {
      const created: any = await createCustomer({
        firstName:     form.firstName.trim(),
        lastName:      form.lastName.trim()      || null,
        phoneNumber:   form.phone.trim()         || null,
        email:         form.email.trim()         || null,
        customerType:  form.customerType,
        birthDate:     isPersonal && form.birthDate ? form.birthDate : null,
        gender:        isPersonal && form.gender    ? form.gender    : null,
        nationality:   form.nationality.trim()   || null,
        idType:        form.idType               || null,
        idNumber:      form.idNumber.trim()      || null,
        addressLine1:  form.addressLine1.trim()  || null,
        addressLine2:  form.addressLine2.trim()  || null,
        city:          form.city.trim()          || null,
        stateProvince: form.stateProvince.trim() || null,
        postalCode:    form.postalCode.trim()    || null,
        country:       form.country              || null,
        taxIdNumber:   form.taxIdNumber.trim()   || null,
        creditLimit:   form.creditLimit          ? parseFloat(form.creditLimit) : undefined,
        notes:         form.notes.trim()         || null,
        isActive: true,
      } as any);
      onCreated(mapToCustomerHit((created as any)?.customer ?? created));
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create customer.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Add New Customer</h3>
              <p className="text-xs text-muted-foreground">Required fields marked with *</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* ── Essential ─────────────────────────────────────────── */}
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>First Name <span className="text-red-400">*</span></label>
                <input ref={firstRef} className={inp()} placeholder="First name"
                  value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && save()} />
              </div>
              <div>
                <label className={lbl}>Last Name</label>
                <input className={inp()} placeholder="Last name"
                  value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Phone</label>
                <div className="relative">
                  <Phone className={ico} />
                  <input className={inp() + ' pl-9'} type="tel" placeholder="+1 (555) 000-0000"
                    value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={lbl}>Email</label>
                <div className="relative">
                  <Mail className={ico} />
                  <input className={inp() + ' pl-9'} type="email" placeholder="email@example.com"
                    value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Customer type pills */}
            <div>
              <label className={lbl}>Customer Type <span className="text-red-400">*</span></label>
              <div className="flex gap-2 flex-wrap">
                {CUSTOMER_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => set('customerType', t.value)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      form.customerType === t.value
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Identity & Contact ────────────────────────────────── */}
          <Section icon={ShieldCheck} label="Identity & Contact" open={openIdentity} onToggle={() => setOpenIdentity(x => !x)}>
            {isPersonal && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Date of Birth</label>
                  <DatePickerInput
                    value={form.birthDate}
                    onChange={v => set('birthDate', v)}
                    maxDate="today"
                    minDate="1920-01-01"
                  />
                </div>
                <div>
                  <label className={lbl}>Gender</label>
                  <select className={inp()} value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className={lbl}>Nationality</label>
              <div className="relative">
                <Globe className={ico} />
                <select className={inp() + ' pl-9'} value={form.nationality} onChange={e => set('nationality', e.target.value)}>
                  <option value="">Select nationality…</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>ID Type</label>
                <div className="relative">
                  <CreditCard className={ico} />
                  <select className={inp() + ' pl-9'} value={form.idType} onChange={e => set('idType', e.target.value)}>
                    <option value="">Select type…</option>
                    {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>ID / Passport Number</label>
                <div className="relative">
                  <Hash className={ico} />
                  <input className={inp() + ' pl-9'} placeholder="Document number"
                    value={form.idNumber} onChange={e => set('idNumber', e.target.value)} />
                </div>
              </div>
            </div>
          </Section>

          {/* ── Address ───────────────────────────────────────────── */}
          <Section icon={MapPin} label="Address" open={openAddress} onToggle={() => setOpenAddress(x => !x)}>
            <div>
              <label className={lbl}>Address Line 1</label>
              <input className={inp()} placeholder="Street, P.O. box…"
                value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Address Line 2</label>
              <input className={inp()} placeholder="Apt, suite, unit…"
                value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>City</label>
                <input className={inp()} placeholder="City"
                  value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>State / Province</label>
                <input className={inp()} placeholder="State"
                  value={form.stateProvince} onChange={e => set('stateProvince', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Postal Code</label>
                <input className={inp()} placeholder="Postal code"
                  value={form.postalCode} onChange={e => set('postalCode', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Country</label>
                <div className="relative">
                  <Globe className={ico} />
                  <select className={inp() + ' pl-9'} value={form.country} onChange={e => set('country', e.target.value)}>
                    <option value="">Select country…</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Financial ─────────────────────────────────────────── */}
          <Section icon={DollarSign} label="Financial" open={openFinancial} onToggle={() => setOpenFinancial(x => !x)}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tax ID / VAT</label>
                <div className="relative">
                  <Hash className={ico} />
                  <input className={inp() + ' pl-9'} placeholder="Tax / VAT number"
                    value={form.taxIdNumber} onChange={e => set('taxIdNumber', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={lbl}>Credit Limit</label>
                <div className="relative">
                  <DollarSign className={ico} />
                  <input className={inp() + ' pl-9'} type="number" placeholder="0.00" step="0.01"
                    value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <textarea className={inp()} rows={2} placeholder="Any notes about this customer…"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2 bg-muted/20 flex-shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1 gap-2" onClick={save} disabled={saving || !form.firstName.trim()}>
            {saving
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
              : <><UserPlus className="h-3.5 w-3.5" /> Create Customer</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickAddCustomerModal;
