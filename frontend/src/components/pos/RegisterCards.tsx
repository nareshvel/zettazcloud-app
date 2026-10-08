import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, FileText, Loader2, Lock, PlayCircle, Vault,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/LocalizationContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { financeService, MoneyAccount } from '@/services/financeService';
import RegisterReportDialog from '@/components/finance/RegisterReportDialog';

interface Props {
  storeId?: string;
}

type Action = 'open' | 'paid_in' | 'paid_out' | 'close';
type Status = { open: boolean; session: { id: string; sessionNo?: string; openedAt: string; openedByName?: string } | null } | null;

/**
 * Register lifecycle actions on Sales Hub — for users who operate the
 * register but may not hold register.view (the Cash Register page itself).
 * Each button renders only when the matching action permission is held.
 *
 * The open/closed flag comes from the /status endpoint which returns no
 * financial figures, so this stays safe for blind-close roles. When status
 * can't be determined (transient failure) every permitted action still
 * renders — the backend's own errors (409 already-open, no-session) carry
 * the message.
 */
const RegisterCards = ({ storeId }: Props) => {
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const canOpenAction = hasAnyPermission(user, ['register.open', 'finance.manage']);
  const canMove = hasAnyPermission(user, ['register.movement', 'finance.manage']);
  const canClose = hasAnyPermission(user, ['register.close', 'finance.manage']);
  const canReport = hasAnyPermission(user, ['register.view', 'finance.manage']);
  // Account pickers need the accounts list, which sits behind finance.view —
  // register-only users get backend defaults (float funded from SAFE, paid-in
  // credited from SAFE, paid-out debited to the expense account).
  const canPickAccounts = hasAnyPermission(user, ['finance.view', 'finance.manage']);

  const [status, setStatus] = useState<Status>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fFloat, setFFloat] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fReason, setFReason] = useState('');
  const [fCount, setFCount] = useState('');
  const [fAccount, setFAccount] = useState('');

  const assetAccounts = useMemo(
    () => accounts.filter(a => a.isActive && a.accountType === 'asset'),
    [accounts],
  );
  // Paid-out destinations: safe drops go to an asset account, petty cash to
  // an expense account — offer both.
  const paidOutAccounts = useMemo(
    () => accounts.filter(a => a.isActive && (a.accountType === 'asset' || a.accountType === 'expense')),
    [accounts],
  );

  const refresh = useCallback(async () => {
    if (!storeId) return;
    try {
      setStatus(await financeService.drawerStatus(storeId));
    } catch {
      setStatus(null);
    }
  }, [storeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const openDialog = async (a: Action) => {
    setError(null);
    setFFloat(''); setFAmount(''); setFReason(''); setFCount(''); setFAccount('');
    if (canPickAccounts) {
      try {
        const { accounts: accts } = await financeService.listAccounts();
        setAccounts(accts);
        const assets = accts.filter((x: MoneyAccount) => x.isActive && x.accountType === 'asset');
        if (a === 'open' || a === 'paid_in') {
          setFAccount(assets.find(x => x.code === 'SAFE')?.id || assets[0]?.id || '');
        }
      } catch {
        setAccounts([]);
      }
    }
    setAction(a);
  };

  const submit = async () => {
    if (!storeId || !action) return;
    setSaving(true); setError(null);
    try {
      if (action === 'open') {
        const f = Number(fFloat);
        if (!Number.isFinite(f) || f < 0) { setError('Enter the opening float (0 or more).'); setSaving(false); return; }
        await financeService.openDrawer({ storeId, openingFloat: f, sourceAccountId: fAccount || undefined });
        toast.success('Register open.');
      } else if (action === 'paid_in' || action === 'paid_out') {
        const amt = Number(fAmount);
        if (!Number.isFinite(amt) || amt <= 0) { setError('Enter an amount greater than zero.'); setSaving(false); return; }
        if (!status?.session) { setError('No register is open for this store.'); setSaving(false); return; }
        await financeService.drawerMovement(status.session.id, {
          direction: action, amount: amt,
          reason: fReason.trim() || undefined,
          counterpartAccountId: fAccount || undefined,
        });
        toast.success(action === 'paid_in' ? 'Paid-in recorded.' : 'Paid-out recorded.');
      } else {
        const c = Number(fCount);
        if (!Number.isFinite(c) || c < 0) { setError('Enter the counted cash (0 or more).'); setSaving(false); return; }
        if (!status?.session) { setError('No register is open for this store.'); setSaving(false); return; }
        await financeService.closeDrawer(status.session.id, c);
        toast.success('Register closed.');
        // Offer the Z-report only where the role can actually view it.
        if (canReport) setReportSessionId(status.session.id);
      }
      setAction(null);
      await refresh();
    } catch (e: any) {
      setError(e.message || 'That didn\'t work — try again.');
    } finally { setSaving(false); }
  };

  if (!canOpenAction && !canMove && !canClose && !canReport) return null;

  const open = status?.open === true;
  const session = status?.session;

  return (
    <>
      <div className="rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm p-4 mb-7">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Vault className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Cash register</p>
            <p className="text-xs text-muted-foreground truncate">
              {status === null
                ? 'Status unavailable'
                : open
                  ? `${session?.sessionNo || 'Session'} open${session?.openedByName ? ` · ${session.openedByName}` : ''}`
                  : 'Closed'}
            </p>
          </div>
          <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${
            open ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
          }`}>
            {status === null ? '—' : open ? 'Open' : 'Closed'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {canOpenAction && !open && (
            <Button size="sm" variant="outline" onClick={() => openDialog('open')}
              className="bg-white/50 border-white/60 hover:bg-white/80">
              <PlayCircle className="h-4 w-4 mr-1.5" /> Open register
            </Button>
          )}
          {canMove && open && (
            <>
              <Button size="sm" variant="outline" onClick={() => openDialog('paid_in')}
                className="bg-white/50 border-white/60 hover:bg-white/80">
                <ArrowDownToLine className="h-4 w-4 mr-1.5" /> Paid in
              </Button>
              <Button size="sm" variant="outline" onClick={() => openDialog('paid_out')}
                className="bg-white/50 border-white/60 hover:bg-white/80">
                <ArrowUpFromLine className="h-4 w-4 mr-1.5" /> Paid out
              </Button>
            </>
          )}
          {canReport && open && session && (
            <Button size="sm" variant="outline" onClick={() => setReportSessionId(session.id)}
              className="bg-white/50 border-white/60 hover:bg-white/80">
              <FileText className="h-4 w-4 mr-1.5" /> X-report
            </Button>
          )}
          {canClose && open && (
            <Button size="sm" onClick={() => openDialog('close')}>
              <Lock className="h-4 w-4 mr-1.5" /> Close register
            </Button>
          )}
        </div>
      </div>

      {/* Open register */}
      <Dialog open={action === 'open'} onOpenChange={(o) => { if (!o) setAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open register</DialogTitle>
            <DialogDescription>Count the starting cash in the till — that becomes the opening float.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Opening float</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                <Input type="number" min="0" step="0.01" autoFocus
                  value={fFloat} onChange={e => setFFloat(e.target.value)}
                  className="h-12 text-lg font-semibold"
                  style={{ paddingLeft: `calc(0.75rem + ${(currencySymbol || "")?.length || 1}ch + 6px)` }}
                  placeholder="0.00" />
              </div>
            </div>
            {canPickAccounts && assetAccounts.length > 0 && (
              <div>
                <Label>Funded from</Label>
                <Select value={fAccount} onValueChange={setFAccount}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Store safe (default)" /></SelectTrigger>
                  <SelectContent>
                    {assetAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Open register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paid in / paid out */}
      <Dialog open={action === 'paid_in' || action === 'paid_out'} onOpenChange={(o) => { if (!o) setAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{action === 'paid_in' ? 'Paid in' : 'Paid out'}</DialogTitle>
            <DialogDescription>
              {action === 'paid_in'
                ? 'Cash added to the register mid-shift (e.g. topping up change).'
                : 'Cash removed from the register (e.g. a safe drop or petty cash).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Amount</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                <Input type="number" min="0" step="0.01" autoFocus
                  value={fAmount} onChange={e => setFAmount(e.target.value)}
                  className="h-12 text-lg font-semibold"
                  style={{ paddingLeft: `calc(0.75rem + ${(currencySymbol || "")?.length || 1}ch + 6px)` }}
                  placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input className="mt-1" value={fReason} onChange={e => setFReason(e.target.value)}
                placeholder={action === 'paid_in' ? 'Float top-up…' : 'Safe drop, petty cash…'} />
            </div>
            {canPickAccounts && (action === 'paid_out' ? paidOutAccounts : assetAccounts).length > 0 && (
              <div>
                <Label>{action === 'paid_in' ? 'From account' : 'To account'}</Label>
                <Select value={fAccount} onValueChange={setFAccount}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Default account" /></SelectTrigger>
                  <SelectContent>
                    {(action === 'paid_out' ? paidOutAccounts : assetAccounts).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {action === 'paid_in' ? 'Record paid-in' : 'Record paid-out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close register — always blind here: no expected figure is shown, so
          this card is safe for roles that never see finance data. */}
      <Dialog open={action === 'close'} onOpenChange={(o) => { if (!o) setAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close register</DialogTitle>
            <DialogDescription>Count the cash in the till and enter the total.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Counted cash</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                <Input type="number" min="0" step="0.01" autoFocus
                  value={fCount} onChange={e => setFCount(e.target.value)}
                  className="h-12 text-lg font-semibold"
                  style={{ paddingLeft: `calc(0.75rem + ${(currencySymbol || "")?.length || 1}ch + 6px)` }}
                  placeholder="0.00" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Close register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RegisterReportDialog
        sessionId={reportSessionId}
        storeId={storeId || ''}
        onClose={() => { setReportSessionId(null); refresh(); }}
      />
    </>
  );
};

export default RegisterCards;
