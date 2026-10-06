import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, Loader2 } from 'lucide-react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferences,
} from '@/services/profileService';

type ToggleKey = 'emailPaymentFailed' | 'emailTrialEnding' | 'emailSubscriptionRenewed' | 'emailLowStock' | 'emailNewSaleSummary';

const TOGGLES: { key: ToggleKey; label: string; description: string; live: boolean }[] = [
  {
    key: 'emailPaymentFailed',
    label: 'Payment failed',
    description: 'Get notified when a subscription payment fails.',
    live: true,
  },
  {
    key: 'emailTrialEnding',
    label: 'Trial ending soon',
    description: 'A heads-up before your trial period ends.',
    live: false,
  },
  {
    key: 'emailSubscriptionRenewed',
    label: 'Subscription renewed',
    description: 'Confirmation each time your subscription renews.',
    live: false,
  },
  {
    key: 'emailLowStock',
    label: 'Low stock alerts',
    description: 'Alerts when inventory drops below its reorder point.',
    live: false,
  },
  {
    key: 'emailNewSaleSummary',
    label: 'New sale summary',
    description: 'A digest email summarizing new sales.',
    live: false,
  },
];

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50
      ${checked ? 'bg-primary' : 'bg-muted'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </button>
);

const NotificationsCard: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ToggleKey | null>(null);

  useEffect(() => {
    getNotificationPreferences()
      .then(setPrefs)
      .catch(() => toast.error('Failed to load notification preferences.'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: ToggleKey, value: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSavingKey(key);
    try {
      const updated = await updateNotificationPreferences({ [key]: value });
      setPrefs(updated);
    } catch (e: any) {
      setPrefs(previous);
      toast.error(e?.response?.data?.message || 'Failed to update preference.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" /> Email notifications
      </h3>
      <p className="text-xs text-muted-foreground mb-4">Choose which emails you'd like to receive.</p>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
        </div>
      )}

      {!loading && prefs && (
        <ul className="divide-y divide-border">
          {TOGGLES.map((toggle) => (
            <li key={toggle.key} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
                  {toggle.label}
                  {!toggle.live && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Coming soon</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{toggle.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {savingKey === toggle.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <Toggle
                  checked={!!prefs[toggle.key]}
                  onChange={(v) => handleToggle(toggle.key, v)}
                  disabled={savingKey === toggle.key}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">
        Only "Payment failed" is wired to a real email today — the others save your preference now and will start sending once their triggers ship.
      </p>
    </div>
  );
};

export default NotificationsCard;
