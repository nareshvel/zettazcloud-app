/**
 * PaytimeSettings
 * Settings card for Paytime payroll integration.
 * The two env vars (PAYTIME_BASE_URL + PAYTIME_API_KEY) are set on the server;
 * this component shows live status and lets admins verify the connection.
 *
 * Mounted in Settings → Paytime tab (or the General integrations section).
 */

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Link2, RefreshCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paytimeStatus } from '@/services/employeeService';
import { useToast } from '@/hooks/use-toast';

export default function PaytimeSettings() {
  const { toast }           = useToast();
  const [status, setStatus] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const r = await paytimeStatus();
      setStatus(r.configured);
    } catch { setStatus(false); }
    finally { setChecking(false); }
  };

  useEffect(() => { check(); }, []);

  return (
    <div className="space-y-4">
      {/* Connection status card */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Connection Status</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Live check against the server environment variables.</p>
        </div>
        <div className="p-5">
          <div className={`flex items-center gap-3 rounded-lg p-4 border transition-colors ${
            status ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}>
            {status == null || checking ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-muted-foreground shrink-0" />
            ) : status ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-amber-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-foreground">
                {checking ? 'Checking connection…' : status ? 'Connected' : 'Not configured'}
              </div>
              <div className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">
                {status
                  ? 'PAYTIME_BASE_URL and PAYTIME_API_KEY are set in the server environment.'
                  : 'Set PAYTIME_BASE_URL and PAYTIME_API_KEY in your server .env to enable this integration.'}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={check} disabled={checking} className="shrink-0">
              <RefreshCcw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">How to connect</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Follow these steps to link your Paytime account.</p>
        </div>
        <div className="p-5">
          <ol className="space-y-3">
            {[
              <>In Paytime, generate an API key under <strong>Settings → API Access</strong>.</>,
              <>Copy the API base URL (e.g. <code className="font-mono bg-gray-100 dark:bg-muted px-1 rounded text-xs">https://app.paytime.com/api</code>).</>,
              <>Add the following to your <code className="font-mono bg-gray-100 dark:bg-muted px-1 rounded text-xs">backend/.env</code>:
                <pre className="mt-2 rounded-lg bg-gray-900 text-gray-100 p-3 text-xs font-mono overflow-x-auto">
{`PAYTIME_BASE_URL=https://app.paytime.com/api\nPAYTIME_API_KEY=your_api_key_here`}
                </pre>
              </>,
              <>Restart the backend — status above should turn green.</>,
              <>Go to <strong>Employees</strong>, set the <em>Paytime employee ID</em> per employee, then use <strong>Push incentive</strong> to sync bonuses.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-sm text-gray-600 dark:text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
