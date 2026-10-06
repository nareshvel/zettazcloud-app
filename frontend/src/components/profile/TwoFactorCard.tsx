import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck, ShieldOff, Loader2, KeyRound, Copy, Check, AlertTriangle } from 'lucide-react';
import {
  getTwoFactorStatus,
  setupTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  TwoFactorSetup,
} from '@/services/profileService';

type Stage = 'loading' | 'idle' | 'enabling-qr' | 'enabling-code' | 'backup-codes' | 'disabling';

const TwoFactorCard: React.FC = () => {
  const [stage, setStage] = useState<Stage>('loading');
  const [enabled, setEnabled] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTwoFactorStatus()
      .then((s) => { setEnabled(s.enabled); setStage('idle'); })
      .catch(() => { setStage('idle'); });
  }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const data = await setupTwoFactor();
      setSetupData(data);
      setStage('enabling-qr');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to start 2FA setup.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;
    setBusy(true);
    try {
      const result = await confirmTwoFactor(setupData.secret, code.trim());
      setBackupCodes(result.backupCodes);
      setAcknowledged(false);
      setStage('backup-codes');
      setEnabled(true);
      toast.success('Two-factor authentication enabled');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await disableTwoFactor(password);
      setEnabled(false);
      setPassword('');
      setStage('idle');
      toast.success('Two-factor authentication disabled');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Incorrect password.');
    } finally {
      setBusy(false);
    }
  };

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  const finishBackupCodes = () => {
    setStage('idle');
    setSetupData(null);
    setCode('');
    setBackupCodes([]);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Two-factor authentication
        </h3>
        {stage !== 'loading' && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${enabled ? 'bg-success-light text-success-text' : 'bg-muted text-muted-foreground'}`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Require a 6-digit code from an authenticator app (or a backup code) at sign-in, in addition to your password.
      </p>

      {stage === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
        </div>
      )}

      {stage === 'idle' && !enabled && (
        <button
          type="button"
          onClick={startSetup}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Enable two-factor authentication
        </button>
      )}

      {stage === 'idle' && enabled && (
        <button
          type="button"
          onClick={() => setStage('disabling')}
          className="inline-flex items-center gap-2 px-4 py-2 border border-destructive/40 text-destructive hover:bg-destructive/10 text-sm font-medium rounded-lg transition-colors"
        >
          <ShieldOff className="h-4 w-4" /> Disable two-factor authentication
        </button>
      )}

      {stage === 'disabling' && (
        <form onSubmit={handleDisable} className="space-y-3 max-w-sm">
          <p className="text-xs text-muted-foreground">Confirm your password to disable two-factor authentication.</p>
          <div className="relative">
            <KeyRound className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="Your password"
              className="block w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !password}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {busy ? 'Disabling…' : 'Confirm disable'}
            </button>
            <button
              type="button"
              onClick={() => { setStage('idle'); setPassword(''); }}
              className="px-4 py-2 border border-border text-sm font-medium rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {stage === 'enabling-qr' && setupData && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <img
              src={setupData.qrCodeDataUrl}
              alt="2FA QR code"
              className="w-40 h-40 rounded-lg border border-border bg-white p-2 shrink-0"
            />
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.).</p>
              <p>Can't scan it? Enter this code manually:</p>
              <code className="block text-xs bg-muted px-2 py-1.5 rounded break-all">{setupData.secret}</code>
            </div>
          </div>

          <form onSubmit={handleConfirm} className="flex flex-col sm:flex-row gap-3 sm:items-end max-w-md">
            <div className="flex-1">
              <label htmlFor="totpConfirm" className="block text-xs font-medium text-muted-foreground mb-1.5">Enter the 6-digit code to confirm</label>
              <input
                id="totpConfirm"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="000000"
                className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={busy || code.trim().length === 0}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => { setStage('idle'); setSetupData(null); setCode(''); }}
              className="px-4 py-2 border border-border text-sm font-medium rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {stage === 'backup-codes' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-warning/40 bg-warning-light/40 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-warning-text mt-0.5 shrink-0" />
            <p className="text-xs text-warning-text">
              Save these backup codes now — each one is shown only once and can be used to sign in if you lose access to your authenticator app.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-muted rounded-lg p-4">
            {backupCodes.map((c) => (
              <span key={c} className="text-foreground">{c}</span>
            ))}
          </div>

          <button
            type="button"
            onClick={copyBackupCodes}
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy all codes'}
          </button>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            I've saved these backup codes somewhere safe.
          </label>

          <button
            type="button"
            onClick={finishBackupCodes}
            disabled={!acknowledged}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default TwoFactorCard;
