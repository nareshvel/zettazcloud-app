import { fetchApi } from './api';
import { buildAgentUrl, getAgentToken } from './printAgentV2Service';

export type PrintAgentState = 'online' | 'degraded' | 'offline' | 'revoked';
export type PrintAgentUpdateChannel = 'stable' | 'pilot' | 'beta';

export interface PrinterMapping {
  documentRoute: string;
  printerId: string;
  printerName?: string;
  priority: number;
  fallback: boolean;
}

export interface PrintAgentConfiguration {
  updateChannel: PrintAgentUpdateChannel;
  heartbeatIntervalSeconds: number;
  cloudDefaults?: {
    updateChannel?: PrintAgentUpdateChannel;
    heartbeatIntervalSeconds?: number;
  };
  workstationOverrides?: {
    updateChannel?: PrintAgentUpdateChannel | null;
    heartbeatIntervalSeconds?: number | null;
  };
  printerMappings?: PrinterMapping[];
}

export interface FleetPrintAgent {
  id: string;
  displayName: string;
  state: PrintAgentState;
  storeId?: string | null;
  storeName?: string | null;
  updateChannel: PrintAgentUpdateChannel;
  heartbeatIntervalSeconds: number;
  lastSeenAt?: string | null;
  version?: string | null;
  platform?: string | null;
  configuration?: PrintAgentConfiguration;
  printerMappings?: PrinterMapping[];
}

export interface EnrollmentCode {
  code: string;
  expiresAt: string;
}

export interface LocalFleetStatus {
  enrolled: boolean;
  agentId?: string;
  displayName?: string;
  storeId?: string | null;
  storeName?: string | null;
  updateChannel?: PrintAgentUpdateChannel;
  state?: PrintAgentState;
  lastHeartbeatAt?: string | null;
}

export interface LocalFleetEnrollmentPayload {
  code: string;
  cloudBaseUrl: string;
  displayName: string;
}

export interface UpdateFleetAgentPayload {
  displayName?: string;
  storeId?: string | null;
  updateChannel?: PrintAgentUpdateChannel;
  heartbeatIntervalSeconds?: number;
  workstationOverrides?: PrintAgentConfiguration['workstationOverrides'];
}

export const PRINT_AGENT_CLOUD_BASE_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5172').replace(/\/api\/?$/, '');

export function createEnrollmentCode(storeId?: string): Promise<EnrollmentCode> {
  return fetchApi<EnrollmentCode>('/print-agents/enrollment-codes', {
    method: 'POST',
    body: JSON.stringify(storeId ? { storeId } : {}),
  });
}

interface FleetAgentWire {
  id: string;
  displayName?: string;
  status?: string;
  storeId?: string | null;
  storeName?: string | null;
  updateChannel?: PrintAgentUpdateChannel;
  heartbeatInterval?: number;
  lastSeen?: string | null;
  version?: string | null;
  platform?: string | null;
  workstationOverrides?: { updateChannel?: PrintAgentUpdateChannel | null; heartbeatInterval?: number | null };
  printerMappings?: Array<{ documentRoute: string; localPrinterId: string; printerName?: string; priority: number; isFallback: boolean }>;
}

function normalizeState(status?: string): PrintAgentState {
  if (status === 'online' || status === 'offline' || status === 'revoked') return status;
  return status === 'error' ? 'degraded' : 'offline';
}

function normalizeAgent(agent: FleetAgentWire): FleetPrintAgent {
  const printerMappings = (agent.printerMappings || []).map((mapping) => ({
    documentRoute: mapping.documentRoute,
    printerId: mapping.localPrinterId,
    printerName: mapping.printerName,
    priority: mapping.priority,
    fallback: mapping.isFallback,
  }));
  const heartbeatIntervalSeconds = agent.heartbeatInterval || 300;
  const overrides = agent.workstationOverrides;
  return {
    id: agent.id,
    displayName: agent.displayName || agent.id,
    state: normalizeState(agent.status),
    storeId: agent.storeId,
    storeName: agent.storeName,
    updateChannel: agent.updateChannel || 'stable',
    heartbeatIntervalSeconds,
    lastSeenAt: agent.lastSeen,
    version: agent.version,
    platform: agent.platform,
    printerMappings,
    configuration: {
      updateChannel: agent.updateChannel || 'stable',
      heartbeatIntervalSeconds,
      cloudDefaults: { updateChannel: agent.updateChannel || 'stable', heartbeatIntervalSeconds },
      workstationOverrides: overrides ? {
        updateChannel: overrides.updateChannel,
        heartbeatIntervalSeconds: overrides.heartbeatInterval,
      } : undefined,
      printerMappings,
    },
  };
}

export async function getFleetPrintAgents(): Promise<FleetPrintAgent[]> {
  const agents = await fetchApi<FleetAgentWire[]>('/print-agents');
  return agents.map(normalizeAgent);
}

export async function getFleetPrintAgent(id: string): Promise<FleetPrintAgent> {
  return normalizeAgent(await fetchApi<FleetAgentWire>(`/print-agents/${encodeURIComponent(id)}`));
}

export async function updateFleetPrintAgent(id: string, payload: UpdateFleetAgentPayload): Promise<FleetPrintAgent> {
  await fetchApi(`/print-agents/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: payload.displayName,
      updateChannel: payload.updateChannel,
      heartbeatInterval: payload.heartbeatIntervalSeconds,
      workstationOverrides: payload.workstationOverrides ? {
        updateChannel: payload.workstationOverrides.updateChannel,
        heartbeatInterval: payload.workstationOverrides.heartbeatIntervalSeconds,
      } : undefined,
    }),
  });
  return getFleetPrintAgent(id);
}

export async function updatePrinterMappings(id: string, printerMappings: PrinterMapping[]): Promise<FleetPrintAgent> {
  await fetchApi(`/print-agents/${encodeURIComponent(id)}/printer-mappings`, {
    method: 'PUT',
    body: JSON.stringify({ mappings: printerMappings.map((mapping) => ({
      documentRoute: mapping.documentRoute,
      localPrinterId: mapping.printerId,
      printerName: mapping.printerName,
      priority: mapping.priority,
      isFallback: mapping.fallback,
      enabled: true,
    })) }),
  });
  return getFleetPrintAgent(id);
}

export function revokeFleetPrintAgent(id: string): Promise<void> {
  return fetchApi<void>(`/print-agents/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
}

async function localFleetRequest<T>(port: number, path: string, options: RequestInit = {}): Promise<T> {
  const token = getAgentToken();
  if (!token) throw new Error('Pair with the local Print Agent before managing fleet enrollment.');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(buildAgentUrl(port, path), {
    ...options,
    headers,
    mode: 'cors',
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Print Agent fleet request failed (${response.status})${body ? `: ${body}` : ''}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function enrollLocalAgent(port: number, payload: LocalFleetEnrollmentPayload): Promise<LocalFleetStatus> {
  return localFleetRequest<LocalFleetStatus>(port, '/v1/fleet/enroll', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getLocalFleetStatus(port: number): Promise<LocalFleetStatus> {
  return localFleetRequest<LocalFleetStatus>(port, '/v1/fleet/status');
}

export function removeLocalFleetEnrollment(port: number): Promise<void> {
  return localFleetRequest<void>(port, '/v1/fleet/enrollment', { method: 'DELETE' });
}

export function getLocalFleetConfiguration(port: number): Promise<PrintAgentConfiguration> {
  return localFleetRequest<PrintAgentConfiguration>(port, '/v1/fleet/configuration');
}
