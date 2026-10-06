import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, Building2, Cloud, Loader2, Plus, RefreshCw, Save, ShieldOff, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOptionalStore } from '@/contexts/StoreContext';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import type { AgentPrinter } from '@/services/printAgentV2Service';
import {
  createEnrollmentCode,
  enrollLocalAgent,
  FleetPrintAgent,
  getFleetPrintAgent,
  getFleetPrintAgents,
  getLocalFleetConfiguration,
  getLocalFleetStatus,
  LocalFleetStatus,
  PRINT_AGENT_CLOUD_BASE_URL,
  PrinterMapping,
  PrintAgentConfiguration,
  PrintAgentState,
  PrintAgentUpdateChannel,
  removeLocalFleetEnrollment,
  revokeFleetPrintAgent,
  updateFleetPrintAgent,
  updatePrinterMappings,
} from '@/services/printAgentFleetService';

const stateStyles: Record<PrintAgentState, string> = {
  online: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  degraded: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  offline: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

interface Props {
  port: number;
  printers: AgentPrinter[];
}

export default function PrintAgentFleetSection({ port, printers }: Props) {
  // /print-agent is a public, unauthenticated route (see App.tsx) so this
  // section can render without a StoreProvider ever mounting — `store` is
  // legitimately absent there, not an error condition, hence the optional
  // variant instead of the throwing useStore().
  const store = useOptionalStore()?.store;
  const { formatDate, formatTime } = useLocaleFormat();
  const formatTimestamp = (value?: string | null) => value ? `${formatDate(value)} ${formatTime(value)}` : 'Never';
  const [agents, setAgents] = useState<FleetPrintAgent[]>([]);
  const [localStatus, setLocalStatus] = useState<LocalFleetStatus | null>(null);
  const [localConfig, setLocalConfig] = useState<PrintAgentConfiguration | null>(null);
  const [selected, setSelected] = useState<FleetPrintAgent | null>(null);
  const [displayName, setDisplayName] = useState(() => `${store?.name || 'Zettaz'} workstation`);
  const [channel, setChannel] = useState<PrintAgentUpdateChannel>('stable');
  const [heartbeat, setHeartbeat] = useState(60);
  const [overrideChannel, setOverrideChannel] = useState(false);
  const [overrideHeartbeat, setOverrideHeartbeat] = useState(false);
  const [mappings, setMappings] = useState<PrinterMapping[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy('load');
    setError(null);
    try {
      const [fleet, status, configuration] = await Promise.all([
        getFleetPrintAgents(),
        getLocalFleetStatus(port),
        getLocalFleetConfiguration(port).catch(() => null),
      ]);
      setAgents(fleet);
      setLocalStatus(status);
      setLocalConfig(configuration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load fleet information.');
    } finally {
      setBusy(null);
    }
  }, [port]);

  useEffect(() => { void load(); }, [load]);

  async function enroll() {
    if (!displayName.trim()) return;
    setBusy('enroll');
    setError(null);
    setMessage(null);
    try {
      const enrollment = await createEnrollmentCode(store?.id);
      const status = await enrollLocalAgent(port, {
        code: enrollment.code,
        cloudBaseUrl: PRINT_AGENT_CLOUD_BASE_URL,
        displayName: displayName.trim(),
      });
      setLocalStatus(status);
      setMessage(`Workstation enrolled. Setup code expired ${formatTimestamp(enrollment.expiresAt)}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enroll this workstation.');
    } finally {
      setBusy(null);
    }
  }

  async function unenroll() {
    setBusy('unenroll');
    setError(null);
    try {
      await removeLocalFleetEnrollment(port);
      setLocalStatus({ enrolled: false });
      setLocalConfig(null);
      setMessage('Local fleet enrollment removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove enrollment.');
    } finally {
      setBusy(null);
    }
  }

  async function chooseAgent(agent: FleetPrintAgent) {
    setBusy(`agent-${agent.id}`);
    setError(null);
    try {
      const detail = await getFleetPrintAgent(agent.id);
      setSelected(detail);
      setDisplayName(detail.displayName);
      setChannel(detail.configuration?.workstationOverrides?.updateChannel || detail.updateChannel || 'stable');
      setHeartbeat(detail.configuration?.workstationOverrides?.heartbeatIntervalSeconds || detail.heartbeatIntervalSeconds || 60);
      setOverrideChannel(Boolean(detail.configuration?.workstationOverrides?.updateChannel));
      setOverrideHeartbeat(detail.configuration?.workstationOverrides?.heartbeatIntervalSeconds != null);
      setMappings(detail.printerMappings || detail.configuration?.printerMappings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load workstation.');
    } finally {
      setBusy(null);
    }
  }

  async function saveAgent() {
    if (!selected) return;
    setBusy('save');
    setError(null);
    try {
      const updated = await updateFleetPrintAgent(selected.id, {
        displayName: displayName.trim(),
        updateChannel: channel,
        heartbeatIntervalSeconds: heartbeat,
        workstationOverrides: {
          updateChannel: overrideChannel ? channel : null,
          heartbeatIntervalSeconds: overrideHeartbeat ? heartbeat : null,
        },
      });
      await updatePrinterMappings(selected.id, mappings);
      setSelected({ ...updated, printerMappings: mappings });
      setAgents((current) => current.map((agent) => agent.id === updated.id ? updated : agent));
      setMessage('Workstation configuration saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save workstation configuration.');
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!selected) return;
    setBusy('revoke');
    setError(null);
    try {
      await revokeFleetPrintAgent(selected.id);
      setAgents((current) => current.map((agent) => agent.id === selected.id ? { ...agent, state: 'revoked' } : agent));
      setSelected({ ...selected, state: 'revoked' });
      setMessage('Workstation access revoked.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke workstation.');
    } finally {
      setBusy(null);
    }
  }

  function addMapping() {
    setMappings((current) => [...current, { documentRoute: 'receipt', printerId: printers[0]?.id || '', printerName: printers[0]?.name, priority: current.length + 1, fallback: current.length > 0 }]);
  }

  return (
    <section className="mt-8 space-y-6" aria-label="Print Agent fleet management">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Cloud className="h-5 w-5 text-blue-600" />Print Agent fleet</h2><p className="mt-1 text-sm text-muted-foreground">Enroll this workstation and manage tenant-wide Agent policy without exposing device credentials.</p></div>
        <Button variant="outline" size="sm" onClick={load} disabled={busy === 'load'} className="gap-2"><RefreshCw className={`h-4 w-4 ${busy === 'load' ? 'animate-spin' : ''}`} />Refresh fleet</Button>
      </div>

      {(error || message) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200'}`}>{error && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}{error || message}</div>}

      <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-violet-600" />This workstation</CardTitle></CardHeader>
        <CardContent>
          {localStatus?.enrolled ? <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2"><p className="font-semibold">{localStatus.displayName || 'Enrolled workstation'}</p><Badge className={stateStyles[localStatus.state || 'online']}>{localStatus.state || 'enrolled'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Store: {localStatus.storeName || store?.name || localStatus.storeId || 'Tenant default'} · Channel: {localStatus.updateChannel || localConfig?.updateChannel || 'stable'}</p></div><Button variant="outline" onClick={unenroll} disabled={busy === 'unenroll'} className="gap-2"><ShieldOff className="h-4 w-4" />Remove enrollment</Button></div> : <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end"><div className="space-y-2"><Label htmlFor="fleet-display-name">Workstation display name</Label><Input id="fleet-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Front counter iMac" /></div><Button onClick={enroll} disabled={!displayName.trim() || busy === 'enroll'} className="gap-2">{busy === 'enroll' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}Create code and enroll</Button></div>}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
        <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5 text-blue-600" />Fleet workstations <Badge variant="secondary">{agents.length}</Badge></CardTitle></CardHeader><CardContent className="space-y-2">{agents.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No enrolled Print Agents.</div> : agents.map((agent) => <button type="button" key={agent.id} onClick={() => chooseAgent(agent)} className={`w-full rounded-xl border p-4 text-left transition hover:border-blue-400 ${selected?.id === agent.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800'}`}><div className="flex items-center justify-between gap-3"><span className="truncate font-semibold">{agent.displayName}</span><Badge className={stateStyles[agent.state]}>{agent.state}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{agent.storeName || agent.storeId || 'Tenant default'} · {agent.updateChannel} · Last seen {formatTimestamp(agent.lastSeenAt)}</p></button>)}</CardContent></Card>

        <Card className="border-0 shadow-md ring-1 ring-slate-200 dark:ring-slate-800"><CardHeader><CardTitle className="text-lg">Workstation policy</CardTitle></CardHeader><CardContent>{!selected ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Select a workstation to manage its policy and printer routes.</div> : <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="agent-name">Display name</Label><Input id="agent-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div><div className="space-y-2"><Label>Assigned store</Label><Input value={selected.storeName || selected.storeId || store?.name || 'Tenant default'} disabled /></div><div className="space-y-2"><Label>Current channel</Label><Input value={selected.updateChannel} disabled /></div></div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900"><p className="font-medium">Cloud-admin defaults</p><p className="mt-1 text-sm text-muted-foreground">Channel: {selected.configuration?.cloudDefaults?.updateChannel || selected.updateChannel} · Heartbeat: {selected.configuration?.cloudDefaults?.heartbeatIntervalSeconds || selected.heartbeatIntervalSeconds}s</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overrideChannel} onChange={(event) => setOverrideChannel(event.target.checked)} />Override update channel</label><Select value={channel} onValueChange={(value) => setChannel(value as PrintAgentUpdateChannel)} disabled={!overrideChannel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stable">Stable</SelectItem><SelectItem value="pilot">Pilot</SelectItem><SelectItem value="beta">Beta</SelectItem></SelectContent></Select></div><div className="space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overrideHeartbeat} onChange={(event) => setOverrideHeartbeat(event.target.checked)} />Override heartbeat interval</label><Input type="number" min={15} max={3600} value={heartbeat} disabled={!overrideHeartbeat} onChange={(event) => setHeartbeat(Number(event.target.value))} /></div></div></div>
          <div><div className="flex items-center justify-between"><div><p className="font-medium">Printer mappings</p><p className="text-sm text-muted-foreground">Add ordered primary and fallback printers for each document route.</p></div><Button variant="outline" size="sm" onClick={addMapping} className="gap-1"><Plus className="h-4 w-4" />Mapping</Button></div><div className="mt-3 space-y-3">{mappings.map((mapping, index) => <div key={`${index}-${mapping.documentRoute}`} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_90px_auto_auto]"><Input aria-label="Document route" value={mapping.documentRoute} onChange={(event) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, documentRoute: event.target.value } : item))} placeholder="receipt" /><Select value={mapping.printerId} onValueChange={(value) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, printerId: value, printerName: printers.find((printer) => printer.id === value)?.name } : item))}><SelectTrigger><SelectValue placeholder="Printer" /></SelectTrigger><SelectContent>{printers.map((printer) => <SelectItem key={printer.id} value={printer.id}>{printer.name}</SelectItem>)}</SelectContent></Select><Input aria-label="Priority" type="number" min={1} value={mapping.priority} onChange={(event) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, priority: Number(event.target.value) } : item))} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={mapping.fallback} onChange={(event) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, fallback: event.target.checked } : item))} />Fallback</label><Button variant="ghost" size="icon" onClick={() => setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove mapping"><Trash2 className="h-4 w-4" /></Button></div>)}</div></div>
          <div className="flex flex-wrap justify-between gap-3"><Button variant="destructive" onClick={revoke} disabled={selected.state === 'revoked' || busy === 'revoke'} className="gap-2"><ShieldOff className="h-4 w-4" />Revoke Agent</Button><Button onClick={saveAgent} disabled={!displayName.trim() || busy === 'save' || selected.state === 'revoked'} className="gap-2">{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save configuration</Button></div>
        </div>}</CardContent></Card>
      </div>
    </section>
  );
}
