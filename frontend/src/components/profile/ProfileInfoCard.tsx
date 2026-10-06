import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Save, Loader2 } from 'lucide-react';
import { updateMyProfile } from '@/services/profileService';

interface ProfileInfoCardProps {
  name: string;
  email: string;
  phoneNumber: string;
  onSaved: (fields: { name: string; phoneNumber: string }) => void;
}

/**
 * Editable name/phone, read-only email (no endpoint accepts email edits by
 * design — the backend intentionally keeps email verification/change out of
 * scope here).
 */
const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({ name, email, phoneNumber, onSaved }) => {
  const [formName, setFormName] = useState(name);
  const [formPhone, setFormPhone] = useState(phoneNumber);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setFormName(name); }, [name]);
  useEffect(() => { setFormPhone(phoneNumber); }, [phoneNumber]);

  const dirty = formName.trim() !== (name || '').trim() || formPhone.trim() !== (phoneNumber || '').trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      const payload: { name?: string; phoneNumber?: string } = {};
      if (formName.trim() !== (name || '').trim()) payload.name = formName.trim();
      if (formPhone.trim() !== (phoneNumber || '').trim()) payload.phoneNumber = formPhone.trim();

      const updated = await updateMyProfile(payload);
      onSaved({ name: updated.name, phoneNumber: updated.phoneNumber || '' });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <User className="h-4 w-4 text-primary" /> Personal information
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="profileName" className="block text-xs font-medium text-muted-foreground mb-1.5">Full name</label>
          <input
            id="profileName"
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="profilePhone" className="block text-xs font-medium text-muted-foreground mb-1.5">Phone number</label>
          <div className="relative">
            <Phone className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="profilePhone"
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              placeholder="+1 555 000 0000"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email address</label>
          <div className="relative">
            <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              disabled
              readOnly
              className="block w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Email can't be changed from here — contact your admin if this needs to change.</p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>
    </form>
  );
};

export default ProfileInfoCard;
