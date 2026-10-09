import { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  CheckCircle2,
  RefreshCw,
  Printer,
  Activity,
  Unlink,
  Link as LinkIcon,
  AlertCircle,
  Loader2,
  Wifi,
  LockKeyhole,
  ServerCog,
  ArrowLeft,
  CircleDot,
  HardDrive,
  RotateCcw,
  XCircle,
  Play,
  History,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PrintAgentFleetSection from '@/components/print-agent/PrintAgentFleetSection';
import { hasPermission } from '@/utils/permissionUtils';
import {
  detectAgent,
  pairAgent,
  disconnectAgent,
  getAgentPrinters,
  getAgentDiagnostics,
  getAgentJobs,
  retryAgentJob,
  cancelAgentJob,
  testPrinter,
  getAgentPairings,
  isAgentPaired,
  getAgentClientId,
  setAgentToken,
  clearAgentToken,
  AgentHealth,
  AgentPrinter,
  AgentDiagnosticsResponse,
  AgentJobSummary,
  AgentClientInfo,
} from '@/services/printAgentV2Service';
import { getDevicePrinterOverride, setDevicePrinterOverride } from '@/services/printerService';

type PageStatus = 'idle' | 'checking' | 'available' | 'paired' | 'error';

const statusMeta: Record<PageStatus, { label: string; dot: string; text: string; surface: string }> = {
  idle: { label: 'Not checked', dot: 'bg-slate-400', text: 'text-slate-600', surface: 'bg-slate-100 dark:bg-slate-800' },
  checking: { label: 'Checking', dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700', surface: 'bg-blue-50 dark:bg-blue-950/30' },
  available: { label: 'Ready to pair', dot: 'bg-amber-500', text: 'text-amber-700', surface: 'bg-amber-50 dark:bg-amber-950/30' },
  paired: { label: 'Connected', dot: 'bg-emerald-500', text: 'text-emerald-700', surface: 'bg-emerald-50 dark:bg-emerald-950/30' },
  error: { label: 'Not detected', dot: 'bg-red-500', text: 'text-red-700', surface: 'bg-red-50 dark:bg-red-950/30' },
};

type PrintAgentManifest = {
  macos?: {
    version: string;
    url: string;
    latestUrl: string;
    filename: string;
    size: number;
    platform: string;
    signed: boolean;
    notarized: boolean;
  };
};

export default function PrintAgentPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const homeHref = isAuthenticated ? '/dashboard' : '/';
  const canManageFleet = isAuthenticated && hasPermission(user, 'settings.view');
  const [status, setStatus] = useState<PageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [port, setPort] = useState<number | null>(null);
  const [pairingCode, setPairingCode] = useState('');
  const [devicePrinter, setDevicePrinter] = useState<string | undefined>(getDevicePrinterOverride());
  const [printers, setPrinters] = useState<AgentPrinter[]>([]);
  const [diagnostics, setDiagnostics] = useState<AgentDiagnosticsResponse | null>(null);
  const [jobs, setJobs] = useState<AgentJobSummary[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [pairing, setPairing] = useState<AgentClientInfo | null>(null);
  const [manifest, setManifest] = useState<PrintAgentManifest | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleDetect = useCallback(async () => {
    setStatus('checking');
    setError(null);
    setHealth(null);
    try {
      const result = await detectAgent();
      setHealth(result.health);
      setPort(result.port);
      if (!isAgentPaired() && result.health.pairingCode) setPairingCode(result.health.pairingCode);
      setStatus(isAgentPaired() ? 'paired' : 'available');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not detect the Print Agent.');
      setStatus('error');
    }
  }, []);

  const loadResources = useCallback(async () => {
    if (port === null) return;
    setOpsError(null);
    try {
      const [printersResult, diagnosticsResult, jobsResult, pairingResult] = await Promise.all([
        getAgentPrinters(port),
        getAgentDiagnostics(port),
        getAgentJobs(port, { clientId: origin, limit: 50 }),
        getAgentPairings(port),
      ]);
      setPrinters(printersResult.printers || []);
      setDiagnostics(diagnosticsResult);
      setJobs(jobsResult.jobs || []);
      setPairing(pairingResult);
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : 'Could not load printer, diagnostic, or job data.');
    }
  }, [port, origin]);

  useEffect(() => {
    if (isAgentPaired()) {
      setStatus('paired');
      void handleDetect();
    }
  }, [handleDetect]);

  useEffect(() => {
    if (status === 'paired' && port !== null) void loadResources();
  }, [status, port, loadResources]);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const response = await fetch('/downloads/manifest.json');
        if (response.ok) {
          const data = await response.json();
          setManifest(data);
        }
      } catch {
        // Manifest not available, use fallback
      }
    };
    void fetchManifest();
  }, []);

  async function handlePair(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pairingCode.trim()) return;
    setStatus('checking');
    setError(null);
    try {
      const result = await pairAgent({ pairingCode: pairingCode.trim(), clientId: getAgentClientId(origin), origin });
      setAgentToken(result.token);
      setPort(result.port);
      setStatus('paired');
      setPairingCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pairing failed.');
      setStatus('available');
    }
  }

  async function handleDisconnect() {
    setStatus('checking');
    setError(null);
    try {
      if (port !== null) await disconnectAgent(port);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed, but local pairing was removed.');
    } finally {
      clearAgentToken();
      setStatus('available');
      setPrinters([]);
      setDiagnostics(null);
      setJobs([]);
      setPairing(null);
      setOpsError(null);
    }
  }

  async function handleRefreshJobs() {
    if (port === null) return;
    setJobsLoading(true);
    setOpsError(null);
    try {
      const result = await getAgentJobs(port, { clientId: origin, limit: 50 });
      setJobs(result.jobs || []);
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : 'Could not refresh job history.');
    } finally {
      setJobsLoading(false);
    }
  }

  async function handleRetryJob(id: string) {
    if (port === null) return;
    setActiveJobId(id);
    setOpsError(null);
    try {
      await retryAgentJob(port, id);
      await handleRefreshJobs();
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : `Could not retry job ${id}.`);
    } finally {
      setActiveJobId(null);
    }
  }

  async function handleCancelJob(id: string) {
    if (port === null) return;
    setActiveJobId(id);
    setOpsError(null);
    try {
      await cancelAgentJob(port, id);
      await handleRefreshJobs();
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : `Could not cancel job ${id}.`);
    } finally {
      setActiveJobId(null);
    }
  }

  async function handleTestPrinter(id: string) {
    if (port === null) return;
    setTestingPrinterId(id);
    setOpsError(null);
    try {
      await testPrinter(port, id);
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : `Could not test printer ${id}.`);
    } finally {
      setTestingPrinterId(null);
    }
  }

  const isBusy = status === 'checking';
  const agentVersion = health?.version || diagnostics?.version;
  const meta = statusMeta[status];
  const passedChecks = diagnostics?.checks?.filter((check) => check.passed).length || 0;
  const checkCount = diagnostics?.checks?.length || 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.history.length > 1 ? navigate(-1) : navigate(homeHref)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              aria-label="Go back to previous page"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link to={homeHref} aria-label="Zettaz home">
              <img src="/images/zettaz-cloud-logo-dark.png" alt="Zettaz" className="h-7 w-auto dark:brightness-0 dark:invert" />
            </Link>
          </div>
          <Badge variant="outline" className="gap-2 border-slate-200 bg-white/80 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-2xl sm:px-10 lg:px-12 lg:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.30),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_32%)]" />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                <ServerCog className="h-3.5 w-3.5" /> Local print service
              </div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Print locally. Quietly, securely, and without browser friction.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Zettaz Print Agent connects this browser to printers installed on your workstation and keeps print jobs on the local device.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><LockKeyhole className="h-4 w-4 text-emerald-400" /> Paired access</span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><HardDrive className="h-4 w-4 text-blue-400" /> Durable local queue</span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><Shield className="h-4 w-4 text-violet-400" /> Loopback only</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Agent status</span>
                <CircleDot className={`h-5 w-5 ${status === 'paired' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-amber-400'}`} />
              </div>
              <p className="mt-2 text-2xl font-semibold">{meta.label}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-black/20 p-3"><span className="block text-xs text-slate-400">Version</span><span className="mt-1 block font-medium">{agentVersion || '—'}</span></div>
                <div className="rounded-xl bg-black/20 p-3"><span className="block text-xs text-slate-400">Port</span><span className="mt-1 block font-medium">{port || '—'}</span></div>
                <div className="rounded-xl bg-black/20 p-3"><span className="block text-xs text-slate-400">Printers</span><span className="mt-1 block font-medium">{status === 'paired' ? printers.length : '—'}</span></div>
                <div className="rounded-xl bg-black/20 p-3"><span className="block text-xs text-slate-400">Platform</span><span className="mt-1 block font-medium capitalize">{health?.platform || diagnostics?.platform || '—'}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]" aria-label="Print Agent pairing">
          <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader className="border-b bg-white pb-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl"><Wifi className="h-5 w-5 text-blue-600" /> Connect this browser</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Detect the local service, pair once, and manage printers from this workstation.</p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${meta.surface} ${meta.text}`}><span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.label}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 bg-white p-6 dark:bg-slate-900">
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleDetect} disabled={isBusy} size="lg" className="gap-2">
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isBusy ? 'Checking…' : status === 'idle' ? 'Detect Agent' : 'Check connection'}
                </Button>
                {status === 'paired' && <Button variant="outline" size="lg" onClick={handleDisconnect} disabled={isBusy} className="gap-2"><Unlink className="h-4 w-4" />Disconnect</Button>}
              </div>

              {status === 'idle' && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950/50">
                  <p className="font-medium">Start with a local connection check</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">The Agent listens only on this computer. Detection does not send printer information to the cloud.</p>
                </div>
              )}

              {status === 'available' && (
                <form onSubmit={handlePair} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"><LinkIcon className="h-4 w-4" /></span><div><p className="font-semibold">Pair this browser</p><p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/70">Agent {agentVersion || ''} detected on port {port}. Confirm the code and connect securely.</p></div></div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Input type="text" inputMode="numeric" autoComplete="off" maxLength={12} value={pairingCode} onChange={(e) => { setPairingCode(e.target.value); setError(null); }} aria-label="Print Agent pairing code" className="h-11 max-w-xs bg-white font-mono text-lg tracking-[0.25em] dark:bg-slate-900" placeholder="000000" />
                    <Button type="submit" disabled={!pairingCode.trim() || isBusy} className="h-11 gap-2"><LinkIcon className="h-4 w-4" />Pair browser</Button>
                  </div>
                  {port !== null && !health?.pairingCode && (
                    <p className="mt-3 text-xs text-amber-800/80 dark:text-amber-200/70">
                      Code not shown for this origin — open{' '}
                      <a href={`http://127.0.0.1:${port}`} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">the agent's local page</a>
                      {' '}on this computer to read the 6-digit code.
                    </p>
                  )}
                </form>
              )}

              {status === 'paired' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /></span><div><p className="font-semibold text-emerald-950 dark:text-emerald-100">Secure connection active</p><p className="mt-1 text-sm text-emerald-800/70 dark:text-emerald-200/70">This browser can submit jobs to the local queue.</p></div></div>
                    <Button variant="secondary" size="sm" onClick={loadResources} disabled={isBusy} className="gap-2"><RefreshCw className="h-4 w-4" />Refresh details</Button>
                  </div>
                </div>
              )}

              {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
              <div aria-live="polite" className="sr-only">Current Print Agent status: {meta.label}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg ring-1 ring-slate-200 dark:ring-slate-800">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-violet-600" />At a glance</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Connection', meta.label],
                ['Agent version', agentVersion || 'Not detected'],
                ['Local endpoint', port ? `127.0.0.1:${port}` : 'Not detected'],
                ['Diagnostics', checkCount ? `${passedChecks}/${checkCount} checks passed` : 'Not loaded'],
              ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>)}
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" /> Pairing tokens are stored locally and printer jobs remain on this workstation.</div>
            </CardContent>
          </Card>
        </section>

        {status === 'paired' && port !== null && canManageFleet && <PrintAgentFleetSection port={port} printers={printers} />}

        <section className="mt-8" aria-label="Print Agent downloads">
          <h2 className="mb-4 text-xl font-semibold">Download the Print Agent</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <a
              href={manifest?.macos?.url || '/downloads/zettaz-print-agent-macos-latest.pkg'}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
            >
              <img src="/images/print-agent-icon.png" alt="Zettaz Print Agent" className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="flex-1">
                <p className="font-semibold">macOS</p>
                <p className="text-sm text-muted-foreground">
                  {manifest?.macos?.signed && manifest?.macos?.notarized
                    ? 'Signed and notarized'
                    : 'Unsigned'} · {manifest?.macos?.platform || 'Universal'}
                  {manifest?.macos?.size && ` · ${(manifest.macos.size / 1024 / 1024).toFixed(1)} MB`}
                </p>
              </div>
              <Badge variant="secondary">{manifest?.macos?.version || 'Latest'}</Badge>
            </a>
            <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/50">
              <img src="/images/print-agent-icon.png" alt="Zettaz Print Agent" className="h-12 w-12 shrink-0 rounded-xl opacity-40 grayscale" />
              <div className="flex-1">
                <p className="font-semibold text-slate-400">Windows</p>
                <p className="text-sm text-muted-foreground">Coming soon · Code signing pending</p>
              </div>
              <Badge variant="outline" className="text-slate-400">Soon</Badge>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            <p className="font-semibold">After installing on macOS:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>The Agent starts automatically and appears in the macOS menu bar.</li>
              <li>If it is not visible, open Zettaz Print Agent from Applications, then select Detect Agent here.</li>
            </ul>
          </div>
        </section>

        {status === 'paired' && (
          <section className="mt-6 grid gap-6 lg:grid-cols-2" aria-label="Print Agent configuration">
            <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Printer className="h-5 w-5 text-blue-600" />Available printers <Badge variant="secondary">{printers.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                {printers.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No printers were reported by this workstation.</div> : <ul className="space-y-2">{printers.map((printer) => <li key={printer.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40"><Printer className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{printer.name}</p><p className="truncate text-xs text-muted-foreground">{printer.id}</p></div></div><div className="flex items-center gap-2">{printer.isDefault && <Badge className="bg-emerald-600">Default</Badge>}{printer.isRaw && <Badge variant="outline">Raw</Badge>}{devicePrinter && (printer.id === devicePrinter || printer.name === devicePrinter) && <Badge className="bg-blue-600">This device</Badge>}<Button variant="outline" size="sm" title="Always use this printer on this computer, regardless of the store setting" onClick={() => { const key = printer.id || printer.name; const next = devicePrinter === key ? null : key; setDevicePrinterOverride(next); setDevicePrinter(next || undefined); }} className="h-8 gap-1.5 text-xs"><Printer className="h-3.5 w-3.5" />{devicePrinter === (printer.id || printer.name) ? 'Clear device default' : 'Use on this device'}</Button><Button variant="outline" size="sm" disabled={testingPrinterId === printer.id} onClick={() => handleTestPrinter(printer.id)} className="h-8 gap-1.5 text-xs">{testingPrinterId === printer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Test Print</Button></div></div><div className="mt-3 flex flex-wrap gap-2">{(printer.contentTypes ?? []).map((type) => <Badge key={`${printer.id}-ct-${type}`} variant="outline" className="font-mono text-[10px] uppercase">{type}</Badge>)}{(printer.mediaSizes ?? []).map((size) => <Badge key={`${printer.id}-ms-${size}`} variant="secondary" className="text-[10px]">{size}</Badge>)}</div></li>)}</ul>}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><HardDrive className="h-5 w-5 text-violet-600" />System diagnostics</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!diagnostics ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Run a refresh to load diagnostics.</div> : <>
                  <div className="grid grid-cols-2 gap-3">{[['Status', diagnostics.status], ['Version', diagnostics.version || 'Unknown'], ['Platform', diagnostics.platform || 'Unknown'], ['Checks', `${passedChecks}/${checkCount}`]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold capitalize">{value}</p></div>)}</div>
                  {diagnostics.checks && <ul className="space-y-2">{diagnostics.checks.map((check) => <li key={check.name} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${check.passed ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200'}`}>{check.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span><strong>{check.name}</strong>{check.message ? ` — ${check.message}` : ''}</span></li>)}</ul>}
                </>}
              </CardContent>
            </Card>
          </section>
        )}

        {status === 'paired' && (
          <section className="mt-6" aria-label="Print Agent operations">
            <h2 className="mb-4 text-xl font-semibold">Local operations</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5 text-blue-600" />Queue summary <Badge variant="secondary">{diagnostics?.queue?.total ?? 0}</Badge></CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnostics?.queue ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Queued', diagnostics.queue.queued],
                        ['Processing', diagnostics.queue.processing],
                        ['Completed', diagnostics.queue.completed],
                        ['Failed', diagnostics.queue.failed],
                        ['Cancelled', diagnostics.queue.cancelled],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="mt-1 text-lg font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Queue statistics are not available.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800 lg:col-span-2">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-lg"><Terminal className="h-5 w-5 text-violet-600" />Job history</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleRefreshJobs} disabled={jobsLoading} className="h-8 gap-2"><RefreshCw className={`h-3.5 w-3.5 ${jobsLoading ? 'animate-spin' : ''}`} />Refresh</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {jobs.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No local print jobs found for this browser.</div>
                  ) : (
                    <ul className="space-y-2">
                      {jobs.map((job) => (
                        <li key={job.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{job.id}</span>
                              <Badge variant="outline" className="text-[10px] uppercase">{job.contentType}</Badge>
                              <Badge className={job.state === 'completed' ? 'bg-emerald-600' : job.state === 'failed' ? 'bg-red-600' : job.state === 'cancelled' ? 'bg-slate-600' : 'bg-amber-500'}>{job.state}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{job.destination === 'system' ? job.printerId || 'System printer' : job.address || job.destination} · {job.copies} {job.copies === 1 ? 'copy' : 'copies'}{job.mediaSize ? ` · ${job.mediaSize}` : ''}</p>
                            {job.error && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{job.error}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {(job.state === 'failed' || job.state === 'cancelled') && (
                              <Button variant="outline" size="sm" disabled={activeJobId === job.id} onClick={() => handleRetryJob(job.id)} className="h-8 gap-1.5 text-xs">
                                {activeJobId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                Retry
                              </Button>
                            )}
                            {(job.state === 'queued' || job.state === 'processing') && (
                              <Button variant="outline" size="sm" disabled={activeJobId === job.id} onClick={() => handleCancelJob(job.id)} className="h-8 gap-1.5 text-xs">
                                {activeJobId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                Cancel
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><LinkIcon className="h-5 w-5 text-emerald-600" />Paired browser</CardTitle>
                </CardHeader>
                <CardContent>
                  {pairing ? (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                        <p className="text-xs text-muted-foreground">Client ID</p>
                        <p className="mt-1 break-all text-xs font-medium">{pairing.clientId || '—'}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                        <p className="text-xs text-muted-foreground">Origin</p>
                        <p className="mt-1 break-all text-xs font-medium">{pairing.origin || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {pairing.paired ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Paired</> : <><AlertCircle className="h-4 w-4 text-amber-500" /> Not paired</>}
                        {pairing.clients && pairing.clients.length > 0 && (
                          <span className="text-muted-foreground">· {pairing.clients.length} client{pairing.clients.length === 1 ? '' : 's'} connected</span>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isBusy} className="h-8 w-full gap-2"><Unlink className="h-3.5 w-3.5" />Disconnect</Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No pairing metadata available.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {opsError && <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{opsError}</span></div>}
          </section>
        )}

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: HardDrive, step: '01', title: 'Run the Agent', text: 'Start the local service on the same workstation as this browser.' },
            { icon: LinkIcon, step: '02', title: 'Pair securely', text: 'Detect the service and approve the six-digit pairing code once.' },
            { icon: Printer, step: '03', title: 'Route documents', text: 'Choose the detected printer in Settings and test each document route.' },
          ].map(({ icon: Icon, step, title, text }) => <div key={step} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950"><Icon className="h-4 w-4" /></span><span className="font-mono text-xs text-slate-400">{step}</span></div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
        </section>

        <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-slate-200 py-6 text-sm text-muted-foreground sm:flex-row dark:border-slate-800"><span>Zettaz Print Agent · Local printing infrastructure</span><span>Need help? Contact your onboarding specialist.</span></footer>
      </main>
    </div>
  );
}
