import React, { useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import toast from 'react-hot-toast';

const Toggle: React.FC<{
  id: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
  badge?: string;
}> = ({ id, checked, onChange, label, description, badge }) => (
  <div className="flex items-center gap-4 py-4">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-foreground cursor-pointer">{label}</label>
        {badge && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">{badge}</span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{description}</p>
    </div>
    <label htmlFor={id} className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" id={id} className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-10 h-5 bg-gray-200 dark:bg-muted rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/30
        peer-checked:bg-primary
        after:content-[''] after:absolute after:top-0.5 after:left-[2px]
        after:bg-white dark:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all
        peer-checked:after:translate-x-5 after:shadow-sm" />
    </label>
  </div>
);

const NotificationsSettings: React.FC = () => {
  const { t } = useI18n();
  const tSettings = (key: string, fallback: string) => t(key, { ns: 'settings', defaultValue: fallback });

  const [preferences, setPreferences] = useState({
    productUpdates: true,
    promotionalOffers: false,
    securityAlerts: true,
  });

  const handleChange = (key: keyof typeof preferences) => {
    setPreferences(prev => {
      const next = !prev[key];
      toast.success(`${key} notifications ${next ? 'enabled' : 'disabled'}.`);
      return { ...prev, [key]: next };
    });
  };

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">{tSettings('notifications.title', 'Notification Preferences')}</h3>
        <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Choose what you want to be notified about.</p>
      </div>
      <div className="px-5 divide-y divide-gray-100">
        <Toggle
          id="productUpdates"
          label={tSettings('notifications.product_updates_label', 'Product Updates')}
          description={tSettings('notifications.product_updates_desc', 'New features, improvements and release notes.')}
          checked={preferences.productUpdates}
          onChange={() => handleChange('productUpdates')}
        />
        <Toggle
          id="promotionalOffers"
          label={tSettings('notifications.promotional_offers_label', 'Promotional Offers')}
          description={tSettings('notifications.promotional_offers_desc', 'Special deals, discounts and seasonal promotions.')}
          checked={preferences.promotionalOffers}
          onChange={() => handleChange('promotionalOffers')}
        />
        <Toggle
          id="securityAlerts"
          label={tSettings('notifications.security_alerts_label', 'Security Alerts')}
          description={tSettings('notifications.security_alerts_desc', 'Login attempts, password changes and critical account events.')}
          checked={preferences.securityAlerts}
          onChange={() => handleChange('securityAlerts')}
          badge="Recommended"
        />
      </div>
    </div>
  );
};

export default NotificationsSettings;
