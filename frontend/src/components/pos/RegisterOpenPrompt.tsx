import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Vault } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionalStore } from '@/contexts/StoreContext';
import { useCurrency } from '@/contexts/LocalizationContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { financeService, MoneyAccount } from '@/services/financeService';

const DISMISS_KEY = 'zettaz_register_prompt_dismissed';

interface Props {
  storeId?: string;
}

/**
 * Soft-gate the register lifecycle: when a user who can open the register
 * lands on POS with no open session, nudge them to open it — once per
 * browser session (dismissal is stored in sessionStorage so it reminds
 * again next login but doesn't nag on every remount).
 *
 * Users without register.open get no prompt — a store may intentionally
 * have a manager open the register, and nagging a user who can't act on it
 * would be noise.
 */
const RegisterOpenPrompt = ({ storeId }: Props) => {
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const storeCtx = useOptionalStore();
  // Hard gate: when the store requires an open register, dismissal is not an
  // option — the backend refuses sales until a session is open anyway.
  const required = !!storeCtx?.store?.requireOpenRegister;
  const canOpen = hasAnyPermission(user, ['register.open', 'finance.manage']);

  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [float, setFloat] = useState('');
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashAccounts = useMemo(
    () => accounts.filter(a => a.isActive && a.accountType === 'asset'),
    [accounts],
  );
  const defaultSource = useMemo(
    () => cashAccounts.find(a => a.code === 'SAFE')?.id || cashAccounts[0]?.id || '',
    [cashAccounts],
  );

  const check = useCallback(async () => {
    if (!storeId || !canOpen) return;
    try {
      const { session } = await financeService.currentDrawerSession(storeId);
      if (!session && (required || !sessionStorage.getItem(DISMISS_KEY))) {
        const { accounts: accts } = await financeService.listAccounts().catch(() => ({ accounts: [] as MoneyAccount[] }));
        setAccounts(accts);
        const assets = accts.filter(a => a.isActive && a.accountType === 'asset');
        setSource(assets.find(a => a.code === 'SAFE')?.id || assets[0]?.id || '');
        setOpen(true);
      }
    } catch {
      // Can't tell → don't block the till on a lookup failure.
    } finally {
      setChecked(true);
    }
  }, [storeId, canOpen, required]);

  useEffect(() => { check(); }, [check]);

  // Hard gate also needs to catch a mid-shift close (a manager closing the
  // register from another screen while this POS stays open). Re-check when
  // the window regains focus — cheap, no polling.
  useEffect(() => {
    if (!required || open) return;
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [required, open, check]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  const doOpen = async () => {
    if (!storeId) return;
    const f = Number(float);
    if (!Number.isFinite(f) || f < 0) { setError('Enter the opening float (0 or more).'); return; }
    setSaving(true); setError(null);
    try {
      await financeService.openDrawer({ storeId, openingFloat: f, sourceAccountId: source || undefined });
      sessionStorage.setItem(DISMISS_KEY, '1');
      setOpen(false);
    } catch (e: any) {
      setError(e.message || 'Failed to open register.');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !required) dismiss(); }}>
      <DialogContent className="max-w-sm" onEscapeKeyDown={(e) => { if (required) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Vault className="h-5 w-5" /> {required ? 'Open the register to continue' : 'Open the register?'}</DialogTitle>
          <DialogDescription>
            {required
              ? 'This store requires an open register before any sale can be completed. Count the float and open the register to start selling.'
              : 'No register is open for this store. Opening one tracks today\'s cash against sales and paid-ins/outs.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Opening float</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
              <Input
                type="number" min="0" step="0.01" autoFocus
                value={float} onChange={e => setFloat(e.target.value)}
                className="h-12 text-lg font-semibold"
                style={{ paddingLeft: `calc(0.75rem + ${(currencySymbol || "")?.length || 1}ch + 6px)` }}
                placeholder="0.00"
              />
            </div>
          </div>
          {checked && cashAccounts.length > 0 && (
            <div>
              <Label>Funded from</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Store safe (default)" /></SelectTrigger>
                <SelectContent>
                  {cashAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {!required && <Button variant="ghost" onClick={dismiss}>Not now</Button>}
          <Button onClick={doOpen} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Open register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterOpenPrompt;
