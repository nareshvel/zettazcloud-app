import React, { useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';

const SecuritySettings: React.FC = () => {
  const { t } = useI18n();
  const tSettings = (key: string, fallback: string) => t(key, { ns: 'settings', defaultValue: fallback });

  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

  const handleToggle2FA = () => {
    setIsTwoFactorEnabled(prev => !prev);
    toast.success(
      isTwoFactorEnabled
        ? tSettings('security.2fa_disabled_success', 'Two-Factor Authentication disabled.')
        : tSettings('security.2fa_enabled_success', 'Two-Factor Authentication enabled.')
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">{tSettings('security.title', 'Account Security')}</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Protect your account with additional verification steps.</p>
        </div>
        <div className="p-5 space-y-3">
          <div className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${isTwoFactorEnabled ? 'border-green-200 bg-green-50' : 'border-gray-200 dark:border-border bg-gray-50'}`}>
            <div className={`mt-0.5 p-2 rounded-lg ${isTwoFactorEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
              {isTwoFactorEnabled
                ? <ShieldCheck className="h-5 w-5 text-green-600" />
                : <ShieldOff className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 dark:text-foreground">{tSettings('security.2fa_title', 'Two-Factor Authentication (2FA)')}</h4>
              <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{tSettings('security.2fa_description', 'Require a verification code in addition to your password when signing in.')}</p>
              <p className={`text-xs mt-1.5 font-medium ${isTwoFactorEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                {isTwoFactorEnabled ? '● Enabled' : '○ Disabled'}
              </p>
            </div>
            <button
              onClick={handleToggle2FA}
              className={`shrink-0 px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                isTwoFactorEnabled
                  ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                  : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
              }`}
            >
              {isTwoFactorEnabled ? tSettings('buttons.disable', 'Disable') : tSettings('buttons.enable', 'Enable')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;
