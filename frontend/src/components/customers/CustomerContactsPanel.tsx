import React, { useState, useEffect } from 'react';
import { Edit, Plus, Trash, X } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../../services/axiosConfig';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ContactPerson {
  id: string;
  customer_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomerContactsPanelProps {
  customerId: string;
}

const CustomerContactsPanel: React.FC<CustomerContactsPanelProps> = ({ customerId }) => {
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactPerson | null>(null);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  
  // Form data for new/edit contact
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    is_primary: false
  });

  // Fetch contacts
  const fetchContacts = async () => {
    if (!customerId) return;
    
    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`/api/customers/${customerId}/contacts`);
      if (response.data?.success) {
        setContacts(response.data.data || []);
      } else {
        console.error('Failed to fetch contacts:', response.data?.message);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [customerId]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      is_primary: false
    });
    setSelectedContact(null);
  };

  // Handle add contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name) {
      toast.error('First name is required');
      return;
    }

    try {
      const response = await axiosInstance.post(`/api/customers/${customerId}/contacts`, formData);
      if (response.data?.success) {
        toast.success('Contact added successfully');
        setContacts(prev => [...prev, response.data.data]);
        setIsAddModalOpen(false);
        resetForm();
      } else {
        toast.error(response.data?.message || 'Failed to add contact');
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      toast.error('An error occurred while adding the contact');
    }
  };

  // Handle edit contact
  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedContact?.id || !formData.first_name) {
      toast.error('First name is required');
      return;
    }

    try {
      const response = await axiosInstance.put(`/api/customers/${customerId}/contacts/${selectedContact.id}`, formData);
      if (response.data?.success) {
        toast.success('Contact updated successfully');
        setContacts(prev => prev.map(c => c.id === selectedContact.id ? response.data.data : c));
        setIsEditModalOpen(false);
        resetForm();
      } else {
        toast.error(response.data?.message || 'Failed to update contact');
      }
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('An error occurred while updating the contact');
    }
  };

  // Handle delete contact
  const handleDeleteContact = (contactId: string) => {
    setContactToDelete(contactId);
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete) return;
    try {
      const response = await axiosInstance.delete(`/api/customers/${customerId}/contacts/${contactToDelete}`);
      if (response.data?.success) {
        toast.success('Contact deleted successfully');
        setContacts(prev => prev.filter(c => c.id !== contactToDelete));
      } else {
        toast.error(response.data?.message || 'Failed to delete contact');
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('An error occurred while deleting the contact');
    } finally {
      setContactToDelete(null);
    }
  };

  // Open edit modal
  const openEditModal = (contact: ContactPerson) => {
    setSelectedContact(contact);
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      position: contact.position || '',
      is_primary: contact.is_primary
    });
    setIsEditModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-text-primary">CONTACT PERSONS</h3>
        <button 
          onClick={() => setIsAddModalOpen(true)} 
          className="text-primary hover:text-primary-dark"
        >
          <Plus size={16} />
        </button>
      </div>
      
      {isLoading ? (
        <div className="py-6 text-center text-text-secondary">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mx-auto"></div>
          <div className="mt-2">Loading contacts...</div>
        </div>
      ) : contacts.length === 0 ? (
        <div className="py-6 text-center text-text-secondary">
          No contact persons found
        </div>
      ) : (
        <div className="divide-y divide-border">
          {contacts.map(contact => (
            <div key={contact.id} className="py-3 flex justify-between items-start">
              <div>
                <div className="font-medium">{contact.first_name} {contact.last_name || ''}</div>
                {contact.position && <div className="text-sm text-text-secondary">{contact.position}</div>}
                {contact.email && (
                  <div className="text-sm mt-1">
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="text-sm">
                    <a href={`tel:${contact.phone}`} className="text-text-secondary">{contact.phone}</a>
                  </div>
                )}
                {contact.is_primary && (
                  <div className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 inline-block mt-1">
                    Primary Contact
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => openEditModal(contact)}
                  className="p-1 text-text-secondary hover:text-primary rounded-full hover:bg-background-hover"
                >
                  <Edit size={14} />
                </button>
                <button 
                  onClick={() => handleDeleteContact(contact.id)}
                  className="p-1 text-text-secondary hover:text-danger-text rounded-full hover:bg-background-hover"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-background-card rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Add Contact Person</h3>
              <button onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }} className="p-1 rounded-full hover:bg-background-hover">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddContact}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Position</label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_primary"
                    name="is_primary"
                    checked={formData.is_primary}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="is_primary" className="ml-2 block text-sm text-text-primary">
                    Set as primary contact
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-border rounded-md text-text-secondary hover:bg-background-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  Add Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-background-card rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Edit Contact Person</h3>
              <button onClick={() => {
                setIsEditModalOpen(false);
                resetForm();
              }} className="p-1 rounded-full hover:bg-background-hover">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditContact}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Position</label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background-alt focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit_is_primary"
                    name="is_primary"
                    checked={formData.is_primary}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="edit_is_primary" className="ml-2 block text-sm text-text-primary">
                    Set as primary contact
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-border rounded-md text-text-secondary hover:bg-background-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  Update Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!contactToDelete}
        onOpenChange={(open) => { if (!open) setContactToDelete(null); }}
        title="Delete contact?"
        description="Are you sure you want to delete this contact person? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteContact}
      />
    </div>
  );
};

export default CustomerContactsPanel;
