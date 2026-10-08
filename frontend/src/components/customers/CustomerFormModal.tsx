/**
 * CustomerFormModal — full add / edit customer modal (Customers page).
 *
 * Layout: 2 × 2 grid
 *   Top-left:    Identity & Contact
 *   Top-right:   Address
 *   Bottom-left: Financial
 *   Bottom-right: Notes & Status
 *
 * Fields adapt by customer type:
 *   INDIVIDUAL / TOURIST  → DOB, Gender, Loyalty ID; no Company / Website / Tax ID
 *   BUSINESS / RETAIL / WHOLESALE → Company, Website, Tax ID; no DOB / Gender
 */
import React, { useState, useEffect, ChangeEvent } from 'react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import {
  Save, Mail, Globe, Edit2, DollarSign, Info, Building, Hash,
  Loader2, User, Phone, MapPin, UserPlus, Star,
  BadgeCheck, MessageSquare, CreditCard,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useStore } from '@/contexts/StoreContext';
import DatePickerInput from '@/components/ui/DatePickerInput';
import { Customer, CreateCustomerPayload } from '@/types';
import { COUNTRIES } from '@/data/localization/countries';
import { CustomerHit, mapToCustomerHit } from './CustomerSearchSelect';

// ─── types ─────────────────────────────────────────────────────────────────────

export type CustomerFormData = CreateCustomerPayload & Partial<Omit<Customer, 'id'>> & {
  creditLimit?: string;
  defaultDiscountValue?: string;
  isTaxExempt?: boolean;
  firstName: string;
};

export interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerData: CreateCustomerPayload | Partial<Customer>, isNew: boolean) => Promise<void>;
  customer: Customer | null;
  currencySymbol?: string;
  onCreated?: (hit: CustomerHit) => void;
}

type CustomerTypeValue = 'INDIVIDUAL' | 'BUSINESS' | 'RETAIL' | 'WHOLESALE' | 'TOURIST';
type GenderValue = 'male' | 'female' | 'other' | '';

type FormState = {
  firstName: string; lastName: string; email: string; phoneNumber: string;
  customerType: CustomerTypeValue;
  birthDate: string; gender: GenderValue;
  addressLine1: string; addressLine2: string; city: string;
  stateProvince: string; postalCode: string; country: string;
  taxIdNumber: string; companyName: string; notes: string; isActive: boolean;
  creditLimit: string; defaultDiscountType: 'percentage' | 'fixedAmount' | null;
  defaultDiscountValue: string; website: string; loyaltyId: string;
  isTaxExempt: boolean; preferredCommunication: 'email' | 'phone' | 'sms' | 'mail' | null;
  nationality: string; idType: string; idNumber: string;
};

const BLANK: FormState = {
  firstName: '', lastName: '', email: '', phoneNumber: '',
  customerType: 'INDIVIDUAL', birthDate: '', gender: '',
  addressLine1: '', addressLine2: '', city: '', stateProvince: '',
  postalCode: '', country: '', taxIdNumber: '', companyName: '',
  notes: '', isActive: true, creditLimit: '',
  defaultDiscountType: null, defaultDiscountValue: '',
  website: '', loyaltyId: '', isTaxExempt: false, preferredCommunication: 'email',
  nationality: '', idType: '', idNumber: '',
};

// ─── customer types config ──────────────────────────────────────────────────────

const CUSTOMER_TYPES: { value: CustomerTypeValue; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'RETAIL',     label: 'Retail'     },
  { value: 'BUSINESS',   label: 'Business'   },
  { value: 'WHOLESALE',  label: 'Wholesale'  },
  { value: 'TOURIST',    label: 'Tourist'    },
];

// ─── style helpers ──────────────────────────────────────────────────────────────

const inp = (err?: string) =>
  `w-full px-3.5 py-2.5 border ${err ? 'border-red-400 ring-1 ring-red-300' : 'border-border'} ` +
  `rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary ` +
  `bg-background text-foreground placeholder:text-muted-foreground transition-colors text-sm`;

const lbl = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';
const ico = 'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 pointer-events-none';

const SectionCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-card rounded-xl border border-border p-5 shadow-sm h-full">{children}</div>
);

const SectionHead = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="h-3.5 w-3.5 text-primary" />
    </div>
    <span className="text-sm font-semibold text-foreground">{label}</span>
  </div>
);

// ─── live avatar ────────────────────────────────────────────────────────────────

const Avatar = ({ first, last, type }: { first: string; last: string; type: CustomerTypeValue }) => {
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
  const color: Record<CustomerTypeValue, string> = {
    INDIVIDUAL: 'from-slate-600 to-slate-700',
    RETAIL:     'from-slate-600 to-slate-700',
    BUSINESS:   'from-slate-600 to-slate-700',
    WHOLESALE:  'from-slate-600 to-slate-700',
    TOURIST:    'from-slate-600 to-slate-700',
  };
  return (
    <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${color[type]} flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md`}>
      {initials}
    </div>
  );
};

// ─── component ──────────────────────────────────────────────────────────────────

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen, onClose, onSave, customer, currencySymbol = '$', onCreated,
}) => {
  const [formData, setFormData] = useState<FormState>(BLANK);
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusiness = ['BUSINESS', 'RETAIL', 'WHOLESALE'].includes(formData.customerType);
  const isPersonal = ['INDIVIDUAL', 'TOURIST'].includes(formData.customerType);

  useEffect(() => {
    if (!isOpen) return;
    if (customer) {
      let taxExempt = false;
      if (customer.isTaxExempt !== undefined) taxExempt = customer.isTaxExempt;
      else if ((customer as any).is_tax_exempt !== undefined) {
        const v = (customer as any).is_tax_exempt;
        taxExempt = v === true || v === 1;
      }
      const cType = String(customer.customerType || '').toUpperCase() as CustomerTypeValue;
      const safeType: CustomerTypeValue = ['INDIVIDUAL','RETAIL','BUSINESS','WHOLESALE','TOURIST'].includes(cType)
        ? cType : 'INDIVIDUAL';

      setFormData({
        ...BLANK,
        firstName:    customer.firstName    || '',
        lastName:     customer.lastName     || '',
        email:        customer.email        || '',
        phoneNumber:  customer.phoneNumber  || '',
        companyName:  customer.companyName  || '',
        customerType: safeType,
        creditLimit:  customer.creditLimit?.toString() || '',
        notes:        customer.notes        || '',
        isActive:     customer.isActive !== undefined ? customer.isActive : true,
        addressLine1: customer.address?.street  || customer.addressLine1  || '',
        addressLine2: customer.addressLine2     || '',
        city:         customer.address?.city    || customer.city          || '',
        stateProvince: customer.address?.state  || customer.stateProvince || '',
        postalCode:   customer.address?.zipCode || customer.postalCode    || '',
        country:      customer.address?.country || customer.country       || '',
        website:      customer.website   || '',
        loyaltyId:    customer.loyaltyId || '',
        taxIdNumber:  customer.taxIdNumber || customer.taxId || '',
        isTaxExempt:  taxExempt,
        defaultDiscountType:
          customer.defaultDiscountType === 'fixed' ? 'fixedAmount'
          : (customer.defaultDiscountType as any || null),
        defaultDiscountValue: customer.defaultDiscountValue?.toString() || '',
        birthDate: customer.dateOfBirth ? customer.dateOfBirth.split('T')[0]
                 : customer.birthDate ? customer.birthDate.split('T')[0]
                 : customer.dob      ? customer.dob.split('T')[0]
                 : '',
        gender: ((customer as any).gender || '') as GenderValue,
        preferredCommunication: customer.preferredCommunication || 'email',
        nationality: (customer as any).nationality || '',
        idType:      (customer as any).idType      || (customer as any).id_type  || '',
        idNumber:    (customer as any).idNumber    || (customer as any).id_number || '',
      });
      setIsNewCustomer(false);
    } else {
      setFormData(BLANK);
      setIsNewCustomer(true);
    }
    setErrors({});
    setIsSubmitting(false);
  }, [customer, isOpen]);

  const set = (k: keyof FormState, v: any) => {
    setFormData(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: undefined }));
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let val: string | boolean | null = value;
    if (type === 'checkbox') val = (e.target as HTMLInputElement).checked;
    else if (name === 'defaultDiscountType' && value === '') val = null;
    set(name as keyof FormState, val);
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!formData.firstName.trim()) e.firstName = 'First name is required.';
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Invalid email address.';
    if (formData.creditLimit && isNaN(parseFloat(formData.creditLimit))) e.creditLimit = 'Must be a number.';
    if (formData.defaultDiscountValue && isNaN(parseFloat(formData.defaultDiscountValue))) e.defaultDiscountValue = 'Must be a number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) { toast.error('Please fix the highlighted fields.'); return; }
    setIsSubmitting(true);
    const payload: any = {
      ...formData,
      gender: formData.gender || null,
      creditLimit:          formData.creditLimit === '' ? undefined : parseFloat(formData.creditLimit),
      defaultDiscountValue: formData.defaultDiscountValue === '' ? undefined : parseFloat(formData.defaultDiscountValue),
      isActive:    Boolean(formData.isActive),
      isTaxExempt: Boolean(formData.isTaxExempt),
      defaultDiscountType: formData.defaultDiscountType === 'fixedAmount' ? 'fixed' : formData.defaultDiscountType,
      // Clear type-irrelevant fields on save
      ...(isPersonal ? { companyName: null, website: null, taxIdNumber: null } : {}),
      ...(isBusiness ? { birthDate: null, gender: null, loyaltyId: null } : {}),
      nationality: formData.nationality || null,
      idType:      formData.idType      || null,
      idNumber:    formData.idNumber    || null,
    };
    if (customer?.id && !isNewCustomer) payload.id = customer.id;
    try {
      await onSave(payload, isNewCustomer);
      toast.success(`Customer ${isNewCustomer ? 'created' : 'updated'} successfully!`);
      if (isNewCustomer && onCreated) {
        onCreated(mapToCustomerHit({ ...payload, id: payload.id ?? '' }));
      }
      onClose();
    } catch (err) {
      console.error('CustomerFormModal save error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── modal chrome ────────────────────────────────────────────────────────────

  const title = (
    <div className="flex items-center gap-3">
      <Avatar first={formData.firstName} last={formData.lastName} type={formData.customerType} />
      <div>
        <h2 className="text-base font-semibold text-white leading-tight">
          {isNewCustomer ? 'Add New Customer' : 'Edit Customer'}
        </h2>
        <p className="text-xs text-white/60 leading-tight">
          {(formData.firstName || formData.lastName)
            ? `${formData.firstName} ${formData.lastName}`.trim()
            : 'Fill in the details below'}
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <p className="text-xs text-muted-foreground">
        Fields marked <span className="text-red-400">*</span> are required
      </p>
      <div className="flex gap-2 ml-auto">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button form="customer-form" type="submit" disabled={isSubmitting} className="gap-2 min-w-[130px]">
          {isSubmitting
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
            : <><Save className="h-3.5 w-3.5" />{isNewCustomer ? 'Create Customer' : 'Save Changes'}</>}
        </Button>
      </div>
    </div>
  );

  // ── form ────────────────────────────────────────────────────────────────────

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="5xl"
      dialogClassName="bg-white dark:bg-card rounded-2xl overflow-hidden shadow-2xl border border-border"
      footerContent={footer}
    >
      <form id="customer-form" onSubmit={handleSubmit}>
        <div className="max-h-[calc(90vh-180px)] overflow-y-auto">

          {/* ── Customer type strip ─────────────────────────────────── */}
          <div className="px-6 pt-5 pb-4 border-b border-border bg-muted/20">
            <p className={lbl + ' mb-2'}>Customer Type <span className="text-red-400">*</span></p>
            <div className="flex gap-2 flex-nowrap overflow-x-auto pb-1 -mx-1 px-1">
              {CUSTOMER_TYPES.map(t => {
                const active = formData.customerType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('customerType', t.value)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 whitespace-nowrap ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 2 × 2 grid ─────────────────────────────────────────── */}
          <div className="p-3 sm:p-6 bg-muted/30 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

            {/* TOP-LEFT: Identity & Contact */}
            <SectionCard>
              <SectionHead icon={User} label="Identity & Contact" />
              <div className="space-y-3.5">

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>First Name <span className="text-red-400">*</span></label>
                    <input className={inp(errors.firstName)} name="firstName"
                      value={formData.firstName} onChange={handleChange}
                      placeholder="First name" autoFocus />
                    {errors.firstName && <p className="text-xs text-red-400 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className={lbl}>Last Name</label>
                    <input className={inp()} name="lastName"
                      value={formData.lastName} onChange={handleChange} placeholder="Last name" />
                  </div>
                </div>

                {/* Business only: company */}
                {isBusiness && (
                  <div>
                    <label className={lbl}>Company Name</label>
                    <div className="relative">
                      <Building className={ico} />
                      <input className={inp() + ' pl-9'} name="companyName"
                        value={formData.companyName} onChange={handleChange}
                        placeholder="Company or business name" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Phone</label>
                    <div className="relative">
                      <Phone className={ico} />
                      <input className={inp() + ' pl-9'} type="tel" name="phoneNumber"
                        value={formData.phoneNumber} onChange={handleChange}
                        placeholder="+1 555 000 0000" />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Email</label>
                    <div className="relative">
                      <Mail className={ico} />
                      <input className={inp(errors.email) + ' pl-9'} type="email" name="email"
                        value={formData.email} onChange={handleChange}
                        placeholder="email@example.com" />
                    </div>
                    {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                  </div>
                </div>

                {/* Personal only: DOB + gender */}
                {isPersonal && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Date of Birth</label>
                      <DatePickerInput
                        value={formData.birthDate}
                        onChange={v => set('birthDate', v)}
                        maxDate="today"
                        minDate="1920-01-01"
                      />
                    </div>
                    <div>
                      <label className={lbl}>Gender</label>
                      <select className={inp()} name="gender"
                        value={formData.gender} onChange={handleChange}>
                        <option value="">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Nationality */}
                <div>
                  <label className={lbl}>Nationality</label>
                  <div className="relative">
                    <Globe className={ico} />
                    <select className={inp() + ' pl-9'} name="nationality"
                      value={formData.nationality} onChange={handleChange}>
                      <option value="">Select nationality…</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* ID Type + Number */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>ID Type</label>
                    <div className="relative">
                      <CreditCard className={ico} />
                      <select className={inp() + ' pl-9'} name="idType"
                        value={formData.idType} onChange={handleChange}>
                        <option value="">Select type…</option>
                        <option value="passport">Passport</option>
                        <option value="national_id">National ID</option>
                        <option value="drivers_license">Driver's License</option>
                        <option value="residence_permit">Residence Permit</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>ID / Passport Number</label>
                    <div className="relative">
                      <Hash className={ico} />
                      <input className={inp() + ' pl-9'} name="idNumber"
                        value={formData.idNumber} onChange={handleChange}
                        placeholder="Document number" />
                    </div>
                  </div>
                </div>

                {/* Preferred contact */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Preferred Contact</label>
                    <div className="relative">
                      <MessageSquare className={ico} />
                      <select className={inp() + ' pl-9'} name="preferredCommunication"
                        value={formData.preferredCommunication || 'email'} onChange={handleChange}>
                        <option value="email">Email</option>
                        <option value="phone">Phone Call</option>
                        <option value="sms">SMS / WhatsApp</option>
                        <option value="mail">Post / Mail</option>
                      </select>
                    </div>
                  </div>
                  {/* Business: website in contact column */}
                  {isBusiness && (
                    <div>
                      <label className={lbl}>Website</label>
                      <div className="relative">
                        <Globe className={ico} />
                        <input className={inp() + ' pl-9'} type="url" name="website"
                          value={formData.website} onChange={handleChange}
                          placeholder="https://example.com" />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </SectionCard>

            {/* TOP-RIGHT: Address */}
            <SectionCard>
              <SectionHead icon={MapPin} label="Address" />
              <div className="space-y-3.5">
                <div>
                  <label className={lbl}>Address Line 1</label>
                  <input className={inp()} name="addressLine1" value={formData.addressLine1}
                    onChange={handleChange} placeholder="Street, P.O. box…" />
                </div>
                <div>
                  <label className={lbl}>Address Line 2</label>
                  <input className={inp()} name="addressLine2" value={formData.addressLine2}
                    onChange={handleChange} placeholder="Apt, suite, unit…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>City</label>
                    <input className={inp()} name="city" value={formData.city}
                      onChange={handleChange} placeholder="City" />
                  </div>
                  <div>
                    <label className={lbl}>State / Province</label>
                    <input className={inp()} name="stateProvince" value={formData.stateProvince}
                      onChange={handleChange} placeholder="State" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Postal Code</label>
                    <input className={inp()} name="postalCode" value={formData.postalCode}
                      onChange={handleChange} placeholder="Postal code" />
                  </div>
                  <div>
                    <label className={lbl}>Country</label>
                    <div className="relative">
                      <Globe className={ico} />
                      <select className={inp() + ' pl-9'} name="country"
                        value={formData.country} onChange={handleChange}>
                        <option value="">Select country…</option>
                        {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* BOTTOM-LEFT: Financial */}
            <SectionCard>
              <SectionHead icon={DollarSign} label="Financial" />
              <div className="space-y-3.5">

                {isBusiness && (
                  <div>
                    <label className={lbl}>Tax ID / VAT Number</label>
                    <div className="relative">
                      <Hash className={ico} />
                      <input className={inp() + ' pl-9'} name="taxIdNumber"
                        value={formData.taxIdNumber} onChange={handleChange}
                        placeholder="Tax ID or VAT number" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Credit Limit ({currencySymbol})</label>
                    <div className="relative">
                      <DollarSign className={ico} />
                      <input className={inp(errors.creditLimit) + ' pl-9'} name="creditLimit"
                        value={formData.creditLimit} onChange={handleChange} placeholder="0.00" />
                    </div>
                    {errors.creditLimit && <p className="text-xs text-red-400 mt-1">{errors.creditLimit}</p>}
                  </div>

                  {isPersonal && (
                    <div>
                      <label className={lbl}>Loyalty ID</label>
                      <div className="relative">
                        <Star className={ico} />
                        <input className={inp() + ' pl-9'} name="loyaltyId"
                          value={formData.loyaltyId} onChange={handleChange}
                          placeholder="Member / loyalty card" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Default discount */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Default Discount</label>
                    <select className={inp()} name="defaultDiscountType"
                      value={formData.defaultDiscountType || ''} onChange={handleChange}>
                      <option value="">No discount</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixedAmount">Fixed amount</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>
                      {formData.defaultDiscountType === 'percentage' ? 'Percentage (%)' : `Amount (${currencySymbol})`}
                    </label>
                    <div className="relative">
                      <span className={ico + ' text-xs font-bold'}>
                        {formData.defaultDiscountType === 'percentage' ? '%' : currencySymbol}
                      </span>
                      <input
                        className={inp(errors.defaultDiscountValue) + ' pl-9' + (!formData.defaultDiscountType ? ' opacity-40' : '')}
                        type="number" name="defaultDiscountValue"
                        value={formData.defaultDiscountValue} onChange={handleChange}
                        placeholder="0.00" step="0.01" disabled={!formData.defaultDiscountType}
                      />
                    </div>
                    {errors.defaultDiscountValue && <p className="text-xs text-red-400 mt-1">{errors.defaultDiscountValue}</p>}
                  </div>
                </div>

                {/* Tax exempt */}
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors group">
                  <input type="checkbox" name="isTaxExempt" checked={!!formData.isTaxExempt}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Tax Exempt</p>
                    <p className="text-xs text-muted-foreground">Purchases will not be taxed</p>
                  </div>
                  <BadgeCheck className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </label>

              </div>
            </SectionCard>

            {/* BOTTOM-RIGHT: Notes & Status */}
            <SectionCard>
              <SectionHead icon={Info} label="Notes & Status" />
              <div className="space-y-3.5">
                <div>
                  <label className={lbl}>Notes</label>
                  <textarea className={inp()} name="notes" value={formData.notes}
                    onChange={handleChange} rows={5}
                    placeholder="Preferences, special requests, relationship notes…" />
                </div>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors group">
                  <input type="checkbox" name="isActive" checked={!!formData.isActive}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Active Customer</p>
                    <p className="text-xs text-muted-foreground">Inactive customers are hidden from search &amp; POS</p>
                  </div>
                </label>
              </div>
            </SectionCard>

          </div>
        </div>
      </form>
    </ModalBase>
  );
};

export default CustomerFormModal;
