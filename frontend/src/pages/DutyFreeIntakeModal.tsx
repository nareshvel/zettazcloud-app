import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import type { TravellerContext } from '@/services/salesService';
import { Button } from '@/components/ui/button';
import { Plane, Ship, HelpCircle, X, ArrowRight, User as UserIcon, UserPlus, Loader2, Phone, Mail, MapPin, Pencil } from 'lucide-react';
import CustomerSearchSelect, { CustomerHit, mapToCustomerHit, mapCustomerHitToCustomer } from '@/components/customers/CustomerSearchSelect';
import DatePickerInput from '@/components/ui/DatePickerInput';
import { createCustomer } from '@/services/api';
import { COUNTRIES } from '@/data/localization/countries';

/**
 * Duty-Free Sale intake step (Sales Hub, §4.2 of
 * docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md).
 *
 * Captures the customer AND traveller ID + travel method in one screen
 * *before* the item grid, mirroring the "ask up front" pattern travel-retail
 * POS systems use. Deliberately generic on travel fields — not every
 * duty-free traveller carries a passport or arrives by air (e.g. Caribbean
 * cruise traffic on a seaman's book, by vessel).
 *
 * Customer capture is intentionally folded into this same screen rather than
 * left as a separate "Select Customer" step on `/pos`. A customer is
 * required (unlike the optional picker on `/pos`) and there are exactly two
 * paths, both landing in the same left column (2026-08-25 feedback round 2):
 *
 *  - EXISTING customer: search (`CustomerSearchSelect`, reused from POS so
 *    behavior can't drift) and select — the match is then shown as a
 *    read-only, clearly labeled card (name, code/type, phone, email,
 *    address), not just a compact chip.
 *  - NEW customer: name/contact/address are collected inline, in this same
 *    screen, as plain fields — deliberately NOT created on their own submit
 *    button. The record is only created when "Continue to Sale" is clicked,
 *    together with the traveller context, so quick-adding a walk-in costs
 *    zero extra clicks over an existing customer. The search box stays
 *    visible above the new-customer form the whole time, so a cashier who
 *    starts typing a new customer's details can still switch to search and
 *    select an existing match instead without losing their place.
 *
 * Scope: Option A (approved 2026-08-25) — traveller data only threads
 * through to the sale as print/record metadata. It does not change tax
 * calculation; zero-rating still depends on the store's own
 * `sales_mode` configuration, unchanged by anything typed here.
 */

const inputCls = (invalid?: boolean) =>
  `w-full px-3.5 py-2.5 border ${invalid ? 'border-red-400' : 'border-border'} rounded-lg shadow-sm focus:outline-none ` +
  `focus:ring-2 ${invalid ? 'focus:ring-red-300' : 'focus:ring-primary/40'} focus:border-primary bg-background text-foreground ` +
  'placeholder:text-muted-foreground transition-colors text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';
const requiredMark = <span className="text-destructive">*</span>;

const ID_TYPES: { value: NonNullable<TravellerContext['travellerIdType']>; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'seaman_book', label: "Seaman's Book" },
  { value: 'other', label: 'Other' },
];

const TRAVEL_TYPES: { value: NonNullable<TravellerContext['travelMethodType']>; label: string; icon: React.ElementType }[] = [
  { value: 'flight', label: 'Flight', icon: Plane },
  { value: 'vessel', label: 'Vessel', icon: Ship },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

const today = () => new Date().toISOString().slice(0, 10);

type NewCustomerForm = {
  firstName: string; lastName: string; phone: string; email: string;
  addressLine1: string; addressLine2: string; city: string;
  stateProvince: string; postalCode: string; country: string;
};

const BLANK_NEW_CUSTOMER: NewCustomerForm = {
  firstName: '', lastName: '', phone: '', email: '',
  addressLine1: '', addressLine2: '', city: '', stateProvince: '', postalCode: '', country: '',
};

interface DutyFreeIntakeModalProps {
  onClose: () => void;
}

const DutyFreeIntakeModal: React.FC<DutyFreeIntakeModalProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { setTravellerContext, setSelectedCustomer } = useCart();

  // Existing customer, chosen via search.
  const [existingCustomer, setExistingCustomer] = useState<CustomerHit | null>(null);
  // New-customer inline form — shown instead of (never alongside) an existing selection.
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>(BLANK_NEW_CUSTOMER);
  const [newCustomerError, setNewCustomerError] = useState('');
  const [showCustomerRequired, setShowCustomerRequired] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  // Traveller fields (everything except the explicitly-optional "Detail")
  // are mandatory for a duty-free sale — set once Continue is clicked with
  // any of them empty, cleared live as each field is filled in.
  const [showTravellerRequired, setShowTravellerRequired] = useState(false);

  const [travellerIdType, setTravellerIdType] = useState<TravellerContext['travellerIdType']>('passport');
  const [travellerIdNumber, setTravellerIdNumber] = useState('');
  const [travellerIdCountry, setTravellerIdCountry] = useState('');
  const [travelMethodType, setTravelMethodType] = useState<TravellerContext['travelMethodType']>('flight');
  const [travelMethodRef, setTravelMethodRef] = useState('');
  const [travelMethodDetail, setTravelMethodDetail] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');

  const travelRefLabel = travelMethodType === 'vessel' ? 'Vessel Name' : travelMethodType === 'flight' ? 'Flight Number' : 'Reference';

  const isTravellerComplete = () =>
    travellerIdNumber.trim() !== '' &&
    travellerIdCountry.trim() !== '' &&
    travelMethodRef.trim() !== '' &&
    destination.trim() !== '' &&
    !!departureDate;

  const setNewField = (k: keyof NewCustomerForm, v: string) => setNewCustomer((f) => ({ ...f, [k]: v }));

  const handleSelectExisting = (hit: CustomerHit | null) => {
    setExistingCustomer(hit);
    if (hit) {
      // An existing match wins over a half-typed new-customer draft.
      setShowNewForm(false);
      setNewCustomer(BLANK_NEW_CUSTOMER);
      setNewCustomerError('');
      setShowCustomerRequired(false);
    }
  };

  const openNewCustomerForm = (prefillName?: string) => {
    setShowNewForm(true);
    setShowCustomerRequired(false);
    if (prefillName) setNewCustomer((f) => ({ ...f, firstName: prefillName }));
  };

  const finalizeContinue = (hit: CustomerHit) => {
    const context: TravellerContext = {
      travellerIdType,
      travellerIdNumber: travellerIdNumber.trim() || undefined,
      travellerIdCountry: travellerIdCountry.trim() || undefined,
      travelMethodType,
      travelMethodRef: travelMethodRef.trim() || undefined,
      travelMethodDetail: travelMethodDetail.trim() || undefined,
      destination: destination.trim() || undefined,
      departureDate: departureDate || undefined,
    };
    setSelectedCustomer(mapCustomerHitToCustomer(hit));
    setTravellerContext(context);
    navigate('/pos', { state: { fromSalesHub: true } });
  };

  const handleContinue = async () => {
    // Evaluate — and surface — every problem at once rather than one at a
    // time, so a cashier who clicks Continue on a mostly-empty screen isn't
    // sent back and forth.
    const travellerOk = isTravellerComplete();
    setShowTravellerRequired(!travellerOk);

    if (!existingCustomer && !showNewForm) {
      setShowCustomerRequired(true);
      return;
    }

    if (!travellerOk) {
      // Customer side is fine (or in progress) but traveller details aren't
      // — block here so we never create a new customer record for a sale
      // that can't proceed yet.
      return;
    }

    if (existingCustomer) {
      finalizeContinue(existingCustomer);
      return;
    }

    if (!newCustomer.firstName.trim()) {
      setNewCustomerError('First name is required.');
      return;
    }

    setNewCustomerError('');
    setCreatingCustomer(true);
    try {
      const created: any = await createCustomer({
        firstName: newCustomer.firstName.trim(),
        lastName: newCustomer.lastName.trim() || null,
        phoneNumber: newCustomer.phone.trim() || null,
        email: newCustomer.email.trim() || null,
        addressLine1: newCustomer.addressLine1.trim() || null,
        addressLine2: newCustomer.addressLine2.trim() || null,
        city: newCustomer.city.trim() || null,
        stateProvince: newCustomer.stateProvince.trim() || null,
        postalCode: newCustomer.postalCode.trim() || null,
        country: newCustomer.country || null,
        customerType: 'retail',
      } as any);
      finalizeContinue(mapToCustomerHit((created as any)?.customer ?? created));
    } catch (e: any) {
      setNewCustomerError(e?.message ?? 'Could not create this customer — try again.');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const fullName = [existingCustomer?.firstName, existingCustomer?.lastName].filter(Boolean).join(' ');
  const addressParts = existingCustomer
    ? [existingCustomer.addressLine1, existingCustomer.addressLine2, existingCustomer.city, existingCustomer.stateProvince, existingCustomer.postalCode, existingCustomer.country].filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">Duty-Free Sale</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Capture the customer and traveller details before ringing up items.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border overflow-y-auto">
          {/* Left column — Customer */}
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" /> Customer
            </div>

            {existingCustomer ? (
              /* ── Existing customer: read-only, clearly labeled card ── */
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-primary text-sm font-bold select-none">
                      {(existingCustomer.firstName?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className={labelCls}>Name</div>
                      <div className="text-sm font-semibold text-foreground truncate">{fullName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {existingCustomer.customerCode && (
                          <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{existingCustomer.customerCode}</span>
                        )}
                        {existingCustomer.customerType && (
                          <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full capitalize">
                            {existingCustomer.customerType.toLowerCase().replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectExisting(null)}
                    className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded"
                    title="Change customer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-primary/15">
                  <div className="pt-3">
                    <div className={labelCls}><Phone className="inline h-3 w-3 mr-1 -mt-0.5" />Phone</div>
                    <div className="text-sm text-foreground">{existingCustomer.phone || '—'}</div>
                  </div>
                  <div className="pt-3">
                    <div className={labelCls}><Mail className="inline h-3 w-3 mr-1 -mt-0.5" />Email</div>
                    <div className="text-sm text-foreground truncate">{existingCustomer.email || '—'}</div>
                  </div>
                </div>
                <div>
                  <div className={labelCls}><MapPin className="inline h-3 w-3 mr-1 -mt-0.5" />Address</div>
                  <div className="text-sm text-foreground">{addressParts.length > 0 ? addressParts.join(', ') : '—'}</div>
                </div>
              </div>
            ) : (
              <>
                <CustomerSearchSelect
                  selected={null}
                  onSelect={handleSelectExisting}
                  onQuickAddRequested={openNewCustomerForm}
                  placeholder="Search by name, phone or customer code…"
                />

                {!showNewForm && showCustomerRequired && (
                  <p className="text-xs text-destructive">Select or add a customer to continue — required for a duty-free sale.</p>
                )}

                {showNewForm && (
                  /* ── New customer: name/contact/address collected here,
                     created only when "Continue to Sale" is clicked. ── */
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" /> New Customer
                      </p>
                      <button
                        type="button"
                        onClick={() => { setShowNewForm(false); setNewCustomer(BLANK_NEW_CUSTOMER); setNewCustomerError(''); }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Discard new customer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>First Name *</label>
                        <input className={inputCls()} placeholder="First name" value={newCustomer.firstName}
                          onChange={(e) => setNewField('firstName', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Last Name</label>
                        <input className={inputCls()} placeholder="Last name" value={newCustomer.lastName}
                          onChange={(e) => setNewField('lastName', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Phone</label>
                        <input className={inputCls()} type="tel" placeholder="Phone number" value={newCustomer.phone}
                          onChange={(e) => setNewField('phone', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input className={inputCls()} type="email" placeholder="Email" value={newCustomer.email}
                          onChange={(e) => setNewField('email', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Address Line 1</label>
                      <input className={inputCls()} placeholder="Street, P.O. box…" value={newCustomer.addressLine1}
                        onChange={(e) => setNewField('addressLine1', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>City</label>
                        <input className={inputCls()} placeholder="City" value={newCustomer.city}
                          onChange={(e) => setNewField('city', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>State / Province</label>
                        <input className={inputCls()} placeholder="State" value={newCustomer.stateProvince}
                          onChange={(e) => setNewField('stateProvince', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Postal Code</label>
                        <input className={inputCls()} placeholder="Postal code" value={newCustomer.postalCode}
                          onChange={(e) => setNewField('postalCode', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Country</label>
                        <select className={inputCls()} value={newCustomer.country} onChange={(e) => setNewField('country', e.target.value)}>
                          <option value="">Select country…</option>
                          {COUNTRIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Created automatically when you click "Continue to Sale" — no extra step.
                    </p>
                    {newCustomerError && <p className="text-xs text-destructive">{newCustomerError}</p>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right column — Traveller & travel details */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Traveller ID Type</label>
                <select
                  className={inputCls()}
                  value={travellerIdType}
                  onChange={(e) => setTravellerIdType(e.target.value as TravellerContext['travellerIdType'])}
                >
                  {ID_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>ID Number {requiredMark}</label>
                <input
                  className={inputCls(showTravellerRequired && !travellerIdNumber.trim())}
                  value={travellerIdNumber}
                  onChange={(e) => setTravellerIdNumber(e.target.value)}
                  placeholder="e.g. N1234567"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Issuing Country {requiredMark}</label>
              <input
                className={inputCls(showTravellerRequired && !travellerIdCountry.trim())}
                value={travellerIdCountry}
                onChange={(e) => setTravellerIdCountry(e.target.value)}
                placeholder="e.g. United States"
              />
            </div>

            <div>
              <label className={labelCls}>Travel Method</label>
              <div className="flex gap-2">
                {TRAVEL_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTravelMethodType(value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      travelMethodType === value
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-border text-text-secondary hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{travelRefLabel} {requiredMark}</label>
                <input
                  className={inputCls(showTravellerRequired && !travelMethodRef.trim())}
                  value={travelMethodRef}
                  onChange={(e) => setTravelMethodRef(e.target.value)}
                  placeholder={travelMethodType === 'vessel' ? 'e.g. MSC Seaside' : 'e.g. AA123'}
                />
              </div>
              <div>
                <label className={labelCls}>Detail (optional)</label>
                <input
                  className={inputCls()}
                  value={travelMethodDetail}
                  onChange={(e) => setTravelMethodDetail(e.target.value)}
                  placeholder="e.g. Terminal / gate"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Destination {requiredMark}</label>
                <input
                  className={inputCls(showTravellerRequired && !destination.trim())}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. London"
                />
              </div>
              <div>
                <label className={labelCls}>Departure Date {requiredMark}</label>
                <DatePickerInput
                  value={departureDate}
                  onChange={setDepartureDate}
                  minDate={today()}
                  maxDate="2099-12-31"
                />
              </div>
            </div>

            {showTravellerRequired && !isTravellerComplete() && (
              <p className="text-xs text-destructive">Complete all traveller details to continue — required for a duty-free sale.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} disabled={creatingCustomer}>Cancel</Button>
          <Button onClick={handleContinue} disabled={creatingCustomer}>
            {creatingCustomer
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating customer…</>
              : <>Continue to Sale <ArrowRight className="h-4 w-4 ml-1.5" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DutyFreeIntakeModal;
