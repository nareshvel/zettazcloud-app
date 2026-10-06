import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { addCustomer } from '../../services/api';
import { Customer } from '@/types';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded: (customer: Customer) => void;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerAdded,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [preferredCommunication, setPreferredCommunication] = useState<'email' | 'phone' | 'sms' | 'mail' | null>(null);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [customerType, setCustomerType] = useState<'INDIVIDUAL' | 'BUSINESS'>('INDIVIDUAL');
  const [isTaxExempt, setIsTaxExempt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const firstNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhoneNumber('');
      setPreferredCommunication(null);
      setReferralSource(null);
      setNotes('');
      setCustomerType('INDIVIDUAL');
      setIsTaxExempt(false);
      setError(null);
      setIsLoading(false);
      setTimeout(() => {
        firstNameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Check for store ID in multiple possible locations
    const storeId = user?.storeId || user?.store?.id;
    if (!storeId) {
      setError("Store information is missing. Cannot add customer.");
      setIsLoading(false);
      return;
    }

    if (!firstName.trim()) {
      setError("First name is required.");
      setIsLoading(false);
      return;
    }
    if (email.trim() && !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    try {
      // Create a customer object that matches the Partial<Customer> type expected by addCustomer
      const customerData = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        preferredCommunication: preferredCommunication || undefined,
        referralSource: referralSource || undefined,
        notes: notes.trim() || undefined,
        customerType: customerType,
        isActive: true,
        isTaxExempt: isTaxExempt,
        storeId: storeId,
      };
      const newCustomer = await addCustomer(customerData);
      
      onCustomerAdded(newCustomer);
      onClose();

    } catch (err: any) {
      console.error('Error adding customer:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClass = "w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-ring focus:border-blue-500 sm:text-sm placeholder-slate-400";
  const labelBaseClass = "block text-sm font-medium text-slate-700 mb-1.5";

  const modalFooter = (
    <div className="flex justify-end gap-3">
      <Button variant="outline" onClick={onClose} disabled={isLoading}>
        Cancel
      </Button>
      <Button type="submit" form="add-customer-form" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Add Customer
      </Button>
    </div>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Customer"
      size="2xl"
      footerContent={modalFooter}
    >
      <form onSubmit={handleSubmit} id="add-customer-form" className="space-y-5 py-1">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <label htmlFor="firstName" className={labelBaseClass}>First Name <span className="text-red-500">*</span></label>
            <Input
              type="text"
              id="firstName"
              ref={firstNameInputRef}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputBaseClass}
              required
              disabled={isLoading}
              placeholder="e.g., John"
            />
          </div>
          <div>
            <label htmlFor="lastName" className={labelBaseClass}>Last Name</label>
            <Input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputBaseClass}
              disabled={isLoading}
              placeholder="e.g., Doe"
            />
          </div>
          <div>
            <label htmlFor="email" className={labelBaseClass}>Email</label>
            <Input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBaseClass}
              disabled={isLoading}
              placeholder="e.g., john.doe@example.com"
            />
          </div>
          <div>
            <label htmlFor="phoneNumber" className={labelBaseClass}>Phone Number</label>
            <Input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={inputBaseClass}
              disabled={isLoading}
              placeholder="e.g., (555) 123-4567"
            />
          </div>
        </div>

        <div>
          <label htmlFor="customerType" className={labelBaseClass}>Customer Type</label>
          <Select
            value={customerType}
            onValueChange={(value: string) => {
              if (value === 'INDIVIDUAL' || value === 'BUSINESS') {
                setCustomerType(value);
              }
            }}
            disabled={isLoading}
          >
            <SelectTrigger id="customerType" className={inputBaseClass}><SelectValue placeholder="Select customer type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INDIVIDUAL">Individual</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isTaxExempt"
            checked={isTaxExempt}
            onChange={(e) => setIsTaxExempt(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-border text-primary focus:ring-ring"
            disabled={isLoading}
          />
          <label htmlFor="isTaxExempt" className={`${labelBaseClass} mb-0`}>
            Tax Exempt Customer
          </label>
          <div className="text-sm text-gray-500 dark:text-muted-foreground">(Customer will not be charged taxes)</div>
        </div>
        
        <div>
          <label htmlFor="preferredCommunication" className={labelBaseClass}>Preferred Contact Method</label>
          <Select
            value={preferredCommunication || ''}
            onValueChange={(value) => setPreferredCommunication(value ? value as 'email' | 'phone' | 'sms' | 'mail' : null)}
            disabled={isLoading}
          >
            <SelectTrigger id="preferredCommunication" className={inputBaseClass}><SelectValue placeholder="Select a contact method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="mail">Mail</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="referralSource" className={labelBaseClass}>Referral Source (Optional)</label>
          <Input
            type="text"
            id="referralSource"
            value={referralSource || ''}
            onChange={(e) => setReferralSource(e.target.value || null)}
            className={inputBaseClass}
            disabled={isLoading}
            placeholder="e.g., Friend, Advertisement"
          />
        </div>

        <div>
          <label htmlFor="notes" className={labelBaseClass}>Notes (Optional)</label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputBaseClass} min-h-[80px]`}
            disabled={isLoading}
            placeholder="Enter any relevant notes about the customer..."
          />
        </div>
      </form>
    </ModalBase>
  );
};

export default AddCustomerModal;
