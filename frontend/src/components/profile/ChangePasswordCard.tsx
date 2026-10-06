import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, Shield, Check, X } from 'lucide-react';
import { changePassword } from '@/services/userService';
import { useI18n } from '@/hooks/useI18n';

// Mirrors backend/services/signupService.js's validatePassword exactly — the
// same rule everywhere a password is ever set, so the client-side checklist
// here never disagrees with what the server will actually accept.
const PASSWORD_RULES: { key: string; label: string; test: (pw: string) => boolean }[] = [
  { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'number', label: 'One number', test: (pw) => /\d/.test(pw) },
  { key: 'special', label: 'One special character (!@#$%^&* etc.)', test: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

const ChangePasswordCard: React.FC = () => {
  const { t } = useI18n();
  const tSettings = (key: string, fallback: string) => t(key, { ns: 'settings', defaultValue: fallback });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);

  const ruleResults = useMemo(() => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(newPassword) })), [newPassword]);
  const allRulesPassed = ruleResults.every((r) => r.passed);
  const passwordsMatch = confirmPassword.length === 0 || confirmPassword === newPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allRulesPassed) {
      setNewPasswordTouched(true);
      toast.error(tSettings('security.password_requirements_error', 'Your new password doesn’t meet all the requirements below.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(tSettings('security.password_mismatch_error', 'New passwords do not match.'));
      return;
    }
    if (newPassword === currentPassword) {
      toast.error(tSettings('security.password_same_error', 'New password must be different from your current password.'));
      return;
    }

    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success(tSettings('security.password_change_success', 'Password changed successfully!'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNewPasswordTouched(false);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || tSettings('security.password_change_error_generic', 'Failed to change password.');
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" /> Change password
      </h3>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor="currentPassword" className="block text-xs font-medium text-muted-foreground mb-1.5">
            {tSettings('security.current_password_label', 'Current Password')}
          </label>
          <div className="relative">
            <KeyRound className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="block w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              placeholder="Enter your current password"
            />
          </div>
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-xs font-medium text-muted-foreground mb-1.5">
            {tSettings('security.new_password_label', 'New Password')}
          </label>
          <div className="relative">
            <KeyRound className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onBlur={() => setNewPasswordTouched(true)}
              required
              autoComplete="new-password"
              className="block w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              placeholder="Enter a new password"
            />
          </div>

          {/* Live requirements checklist — shown once the field has been
              touched, so it doesn't clutter the form before the user starts
              typing, but never hides the requirements behind a failed submit. */}
          {(newPasswordTouched || newPassword.length > 0) && (
            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {ruleResults.map((rule) => (
                <li key={rule.key} className={`flex items-center gap-1.5 text-xs ${rule.passed ? 'text-success-600' : 'text-muted-foreground'}`}>
                  {rule.passed ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 opacity-50" />}
                  {rule.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-muted-foreground mb-1.5">
            {tSettings('security.confirm_new_password_label', 'Confirm New Password')}
          </label>
          <div className="relative">
            <KeyRound className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={`block w-full pl-9 pr-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors
                ${passwordsMatch ? 'border-border focus:border-primary' : 'border-destructive focus:border-destructive'}`}
              placeholder="Confirm your new password"
            />
          </div>
          {!passwordsMatch && (
            <p className="mt-1.5 text-xs text-destructive">Passwords don't match yet.</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : tSettings('security.save_password_button', 'Save Password')}
        </button>
      </div>
    </form>
  );
};

export default ChangePasswordCard;
