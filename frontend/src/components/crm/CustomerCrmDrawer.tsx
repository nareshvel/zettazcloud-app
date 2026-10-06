/**
 * CustomerCrmDrawer
 * Slide-over panel for CRM data (wishlist, dob, anniversary) for an existing customer.
 * Opened from the Customers table via a "CRM" button.
 */

import { useState, useEffect } from 'react';
import { X, Heart, Calendar, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProfileExtra, saveProfileExtra, type ProfileExtra } from '@/services/crmService';
import CustomerWishlist from './CustomerWishlist';
import { useToast } from '@/hooks/use-toast';

interface Props {
  customerId: string;
  customerName: string;
  onClose: () => void;
}

export default function CustomerCrmDrawer({ customerId, customerName, onClose }: Props) {
  const { toast } = useToast();
  const [tab, setTab]           = useState<'wishlist' | 'dates'>('wishlist');
  const [profile, setProfile]   = useState<ProfileExtra>({ date_of_birth: null, anniversary_date: null });
  const [saving, setSaving]     = useState(false);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    getProfileExtra(customerId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [customerId]);

  const handleSaveDates = async () => {
    setSaving(true);
    try {
      await saveProfileExtra(customerId, profile);
      toast({ title: 'Dates saved' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/10 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-background shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="font-semibold">{customerName}</h2>
            <p className="text-xs text-muted-foreground">CRM — Wishlist & Reminders</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4">
          {(['wishlist', 'dates'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize
                ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'wishlist' ? <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> Wishlist</span>
                               : <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Dates</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'wishlist' && (
            <CustomerWishlist customerId={customerId} />
          )}

          {tab === 'dates' && (
            loaded ? (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Birthday and anniversary dates are used for upcoming reminder notifications on the dashboard.
                </p>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Date of birth</label>
                  <input
                    type="date"
                    value={profile.date_of_birth || ''}
                    onChange={e => setProfile(p => ({ ...p, date_of_birth: e.target.value || null }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Anniversary date</label>
                  <input
                    type="date"
                    value={profile.anniversary_date || ''}
                    onChange={e => setProfile(p => ({ ...p, anniversary_date: e.target.value || null }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Wedding anniversary or another significant date</p>
                </div>
                <Button onClick={handleSaveDates} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save dates
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
