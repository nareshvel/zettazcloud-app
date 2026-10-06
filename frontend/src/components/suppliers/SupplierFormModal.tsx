import React, { useState, useEffect, ChangeEvent } from 'react';
import { X, Save, AlertCircle, Briefcase, User, Mail, Phone, Globe, Home, Info, Hash, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { Supplier } from '@/types';
import { createSupplier, updateSupplier, CreateSupplierData, UpdateSupplierData } from '@/services/supplierService';

// This type represents the data structure for the form's state.
// It's based on the Supplier type, using camelCase.
export type SupplierFormData = Omit<Supplier, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> & {
  id?: string; // id is optional for new suppliers
  // Add any fields that might be strings in form but other types in Supplier, if necessary
  // For now, assuming direct mapping for most fields or they are already strings.
};

export interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void; // Renamed from onSave, parent will handle actual save logic
  initialData: Supplier | null;
  isEditMode: boolean;
}

const SupplierFormModal: React.FC<SupplierFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmitSuccess, 
  initialData, 
  isEditMode 
}) => {
  const initialFormDataState: SupplierFormData = {
    supplierName: '',
    contactPerson: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    website: '',
    taxId: '',
    defaultPaymentTerms: '',
    notes: '',
    isActive: true,
  };

  const [formData, setFormData] = useState<SupplierFormData>(initialFormDataState);
  const [errors, setErrors] = useState<Partial<Record<keyof SupplierFormData, string>> & { general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData && isEditMode) {
      setFormData({
        ...initialFormDataState, // Start with defaults
        id: initialData.id,
        supplierName: initialData.supplierName || '',
        contactPerson: initialData.contactPerson || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        addressLine1: initialData.addressLine1 || '',
        addressLine2: initialData.addressLine2 || '',
        city: initialData.city || '',
        stateProvince: initialData.stateProvince || '',
        postalCode: initialData.postalCode || '',
        country: initialData.country || '',
        website: initialData.website || '',
        taxId: initialData.taxId || '',
        defaultPaymentTerms: initialData.defaultPaymentTerms || '',
        notes: initialData.notes || '',
        isActive: typeof initialData.isActive === 'boolean' ? initialData.isActive : true,
      });
    } else {
      setFormData(initialFormDataState);
    }
  }, [initialData, isEditMode]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const processedValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    if (errors[name as keyof SupplierFormData]) {
      setErrors(prev => ({ ...prev, [name as keyof SupplierFormData]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SupplierFormData, string>> = {};
    if (!formData.supplierName.trim()) newErrors.supplierName = 'Supplier name is required.';
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid.';
    // Add other validations as needed (e.g., phone format, postal code format for specific countries)
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
        toast.error('Please correct the form errors.');
        return;
    }
    setIsSubmitting(true);

    try {
      const payload: SupplierFormData = { ...formData };

      if (isEditMode && initialData?.id) {
        await updateSupplier(initialData.id, payload as UpdateSupplierData);
        toast.success('Supplier updated successfully!');
      } else {
        const { id, ...createPayload } = payload;
        await createSupplier(createPayload as CreateSupplierData);
        toast.success('Supplier created successfully!');
      }
      onSubmitSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save supplier:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save supplier. Please try again.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const renderInputField = (name: keyof SupplierFormData, label: string, placeholder: string = '', type: string = 'text', icon?: React.ReactNode) => (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
      <div className="relative">
        {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">{icon}</div>}
        <input
          type={type}
          id={name}
          name={name}
          value={formData[name] as string || ''}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full p-2.5 ${icon ? 'pl-10' : ''} border rounded-md shadow-sm focus:ring-primary focus:border-primary bg-white dark:bg-card text-text-primary border-border-input`}
        />
      </div>
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  const renderTextareaField = (name: keyof SupplierFormData, label: string, placeholder: string = '', icon?: React.ReactNode) => (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
      <div className="relative">
        {icon && <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none">{icon}</div>}
        <textarea
          id={name}
          name={name}
          value={formData[name] as string || ''}
          onChange={handleChange}
          placeholder={placeholder}
          rows={3}
          className={`w-full p-2.5 ${icon ? 'pl-10' : ''} border rounded-md shadow-sm focus:ring-primary focus:border-primary bg-white dark:bg-card text-text-primary border-border-input`}
        />
      </div>
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black flex justify-center items-center z-50 p-4 overflow-y-auto"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.75)', // 75% black opacity
        backdropFilter: 'blur(8px)',          // 8px blur (like Tailwind md)
        WebkitBackdropFilter: 'blur(8px)',    // Safari compatibility
      }}>
      <div 
          className="rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" // Removed bg-background-modal
          style={{ backgroundColor: 'white' }} // Added explicit opaque white background
        >
        <div className="flex justify-between items-center p-5 border-b bg-slate-800 border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <Briefcase size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              {isEditMode ? 'Edit Supplier' : 'Add New Supplier'}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-2 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {renderInputField('supplierName', 'Supplier Name*', 'e.g., Global Tech Supplies Inc.', 'text', <Briefcase size={16} className="text-gray-400 dark:text-muted-foreground" />)}
            {renderInputField('contactPerson', 'Contact Person', 'e.g., Jane Doe', 'text', <User size={16} className="text-gray-400 dark:text-muted-foreground" />)}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {renderInputField('email', 'Email Address', 'e.g., contact@supplier.com', 'email', <Mail size={16} className="text-gray-400 dark:text-muted-foreground" />)}
            {renderInputField('phone', 'Phone Number', 'e.g., +1-555-123-4567', 'tel', <Phone size={16} className="text-gray-400 dark:text-muted-foreground" />)}
          </div>

          <h3 className="text-md font-semibold text-text-secondary pt-3 pb-1 border-b border-border mb-3">Address Details</h3>
          {renderInputField('addressLine1', 'Address Line 1', 'e.g., 123 Supply Chain Rd', 'text', <Home size={16} className="text-gray-400 dark:text-muted-foreground" />)}
          {renderInputField('addressLine2', 'Address Line 2', 'e.g., Suite 400', 'text')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {renderInputField('city', 'City', 'e.g., Metropolis', 'text')}
            {renderInputField('stateProvince', 'State/Province', 'e.g., CA', 'text')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {renderInputField('postalCode', 'Postal Code', 'e.g., 90210', 'text')}
            {renderInputField('country', 'Country', 'e.g., USA', 'text')}
          </div>

          <h3 className="text-md font-semibold text-text-secondary pt-3 pb-1 border-b border-border mb-3">Additional Information</h3>
          {renderInputField('website', 'Website', 'e.g., www.supplier.com', 'url', <Globe size={16} className="text-gray-400 dark:text-muted-foreground" />)}
          {renderInputField('taxId', 'Tax ID / VAT No.', 'e.g., EIN, VAT ID', 'text', <Hash size={16} className="text-gray-400 dark:text-muted-foreground" />)}
          {renderInputField('defaultPaymentTerms', 'Default Payment Terms', 'e.g., Net 30, Due on Receipt', 'text', <FileText size={16} className="text-gray-400 dark:text-muted-foreground" />)}
          
          {renderTextareaField('notes', 'Notes', 'Any internal notes about this supplier...', <Info size={16} className="text-gray-400 dark:text-muted-foreground" />)}

          <div className="pt-2">
            <label htmlFor="isActive" className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary-dark border-gray-300 dark:border-border dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"
              />
              <span className="text-sm font-medium text-text-secondary">Active Supplier</span>
            </label>
          </div>

          {errors.general && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <AlertCircle size={20} className="text-red-500 mr-2" />
                <p className="text-sm text-red-700">{errors.general}</p>
              </div>
            </div>
          )}
        </form>

        <div className="flex justify-end items-center p-5 border-t border-border space-x-3">
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-100 dark:bg-muted focus:ring-4 focus:outline-none focus:ring-gray-300 rounded-lg border border-gray-200 dark:border-border dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-500 dark:focus:ring-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:ring-4 focus:outline-none focus:ring-primary-light rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            <Save size={18} className="mr-2" />
            {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Supplier')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierFormModal;
