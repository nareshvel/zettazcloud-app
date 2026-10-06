/**
 * Zettaz Print Agent v2 local service.
 *
 * Talks directly to the Go Agent running on the user's workstation.
 * Never sends print jobs or pairing secrets to the Zettaz Cloud backend.
 */

export const PRINT_AGENT_TOKEN_KEY = 'zettaz-print-agent-token';
export const PRINT_AGENT_HOST = '127.0.0.1';
export const PRINT_AGENT_PORTS = [9419, 9420];

export interface AgentHealth {
  status: 'ok' | string;
  agent?: string;
  version?: string;
  platform?: string;
  paired?: boolean;
  pairingCode?: string;
}

export interface AgentPrintersResponse {
  printers: AgentPrinter[];
}

export interface AgentPrinter {
  id: string;
  name: string;
  isDefault?: boolean;
  isRaw?: boolean;
  contentTypes?: string[];
  mediaSizes?: string[];
}

export interface AgentDiagnosticsResponse {
  status: 'ok' | string;
  version?: string;
  platform?: string;
  listen?: string;
  printerCount?: number;
  printerError?: string;
  printers?: AgentPrinter[];
  checks?: AgentCheck[];
  message?: string;
  queue?: AgentJobStats;
  client?: AgentClientInfo;
}

export interface AgentCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface AgentJobStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface AgentJobSummary {
  id: string;
  clientId: string;
  destination: string;
  printerId: string;
  address: string;
  contentType: string;
  copies: number;
  mediaSize: string;
  state: string;
  error?: string;
  updatedAt: string;
}

export interface AgentJobsResponse {
  jobs: AgentJobSummary[];
}

export interface AgentJobStatus {
  id: string;
  state: string;
  error?: string;
  updatedAt: string;
}

export interface AgentClientInfo {
  clientId: string;
  origin: string;
  paired: boolean;
}

export interface AgentPairingResponse {
  clientId: string;
  origin: string;
  paired: boolean;
}

export interface AgentTestPrintResponse {
  state: string;
}

export interface PairingPayload {
  pairingCode: string;
  clientId: string;
  origin: string;
}

export interface PairingResult {
  token: string;
}

export type AgentState = 'idle' | 'checking' | 'available' | 'paired' | 'error';

const AGENT_TIMEOUT_MS = 3000;

function getStoredItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors (e.g. private browsing).
  }
}

function removeStoredItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

export function getAgentToken(): string | null {
  return getStoredItem(PRINT_AGENT_TOKEN_KEY);
}

export function setAgentToken(token: string): void {
  setStoredItem(PRINT_AGENT_TOKEN_KEY, token);
}

export function clearAgentToken(): void {
  removeStoredItem(PRINT_AGENT_TOKEN_KEY);
}

export function buildAgentUrl(port: number, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `http://${PRINT_AGENT_HOST}:${port}${normalized}`;
}

/**
 * Try to reach the agent on one of the known ports.
 * Returns the health payload and the port that answered.
 */
export async function detectAgent(): Promise<{ health: AgentHealth; port: number }> {
  const errors: string[] = [];

  for (const port of PRINT_AGENT_PORTS) {
    try {
      const response = await fetch(buildAgentUrl(port, '/v1/health'), {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      });

      if (!response.ok) {
        errors.push(`port ${port}: HTTP ${response.status}`);
        continue;
      }

      const health = (await response.json()) as AgentHealth;
      return { health, port };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`port ${port}: ${message}`);
    }
  }

  throw new Error(`Zettaz Print Agent not detected on ports ${PRINT_AGENT_PORTS.join(', ')}. ${errors.join('; ')}`);
}

/**
 * A normal cross-origin fetch to the agent can fail for two very different
 * reasons that look identical to JS (both throw a generic "Failed to fetch"):
 * either nothing is listening on the port at all, or something IS listening
 * but its CORS origin allowlist (see print-agent/internal/agent/server.go's
 * `cors` middleware) rejected this page's origin outright — the agent
 * returns a real 403 in that case, but the browser hides the response body
 * and status from JS when the CORS headers don't clear it, so both cases
 * collapse to the same caught exception in detectAgent().
 *
 * A `mode: 'no-cors'` request sidesteps that: the browser will still send it
 * and NOT throw as long as some HTTP server answers on that port, even one
 * that rejects the origin — the response just comes back opaque (unreadable)
 * rather than erroring. So "no-cors succeeds" reliably means "a server is
 * listening here", letting us tell "not installed/not running" apart from
 * "running, but this origin isn't in its ZETTAZ_AGENT_ALLOWED_ORIGINS list"
 * instead of silently treating both as the same not-detected case.
 */
export async function probeAnyAgentListening(): Promise<boolean> {
  for (const port of PRINT_AGENT_PORTS) {
    try {
      await fetch(buildAgentUrl(port, '/v1/health'), {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      });
      // An opaque no-cors response still means *something* answered.
      return true;
    } catch {
      // Truly nothing there on this port — try the next one.
      continue;
    }
  }
  return false;
}

async function requestWithToken<T>(
  port: number,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAgentToken();
  if (!token) {
    throw new Error('Print Agent is not paired. Pair with the agent first.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildAgentUrl(port, path), {
    ...options,
    mode: 'cors',
    cache: 'no-store',
    headers,
    signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
  });

  if (response.status === 401) {
    throw new Error('Print Agent pairing is invalid or expired. Disconnect and pair again.');
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Print Agent returned HTTP ${response.status}${body ? `: ${body}` : ''}`);
  }

  return (await response.json()) as T;
}

/**
 * Pair this browser origin with the local agent.
 * Requires the 6-digit pairing code shown by the agent UI / tray menu.
 */
export async function pairAgent(payload: PairingPayload): Promise<{ token: string; port: number }> {
  const { pairingCode, clientId, origin } = payload;

  if (!pairingCode || pairingCode.length < 4) {
    throw new Error('A pairing code is required.');
  }

  const { port } = await detectAgent();

  const response = await fetch(buildAgentUrl(port, '/v1/pair'), {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingCode, clientId, origin }),
    signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pairing failed: ${body || response.statusText}`);
  }

  const result = (await response.json()) as PairingResult;
  if (!result.token) {
    throw new Error('Pairing response did not include a token.');
  }

  setAgentToken(result.token);
  return { token: result.token, port };
}

/**
 * Remove this browser's pairing from the local agent.
 */
export async function disconnectAgent(port: number): Promise<void> {
  const token = getAgentToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    await fetch(buildAgentUrl(port, '/v1/pair'), {
      method: 'DELETE',
      mode: 'cors',
      cache: 'no-store',
      headers,
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    });
  } catch {
    // Best-effort: the agent may already be gone.
  } finally {
    clearAgentToken();
  }
}

export async function getAgentPrinters(port: number): Promise<AgentPrintersResponse> {
  return requestWithToken<AgentPrintersResponse>(port, '/v1/printers', { method: 'GET' });
}

export async function getAgentDiagnostics(port: number): Promise<AgentDiagnosticsResponse> {
  return requestWithToken<AgentDiagnosticsResponse>(port, '/v1/diagnostics', { method: 'GET' });
}

export async function getAgentJobs(
  port: number,
  options: { state?: string; clientId?: string; limit?: number } = {},
): Promise<AgentJobsResponse> {
  const params = new URLSearchParams();
  if (options.state) params.set('state', options.state);
  if (options.clientId) params.set('clientId', options.clientId);
  if (typeof options.limit === 'number' && options.limit > 0) params.set('limit', String(options.limit));
  const query = params.toString();
  return requestWithToken<AgentJobsResponse>(port, `/v1/jobs${query ? `?${query}` : ''}`, { method: 'GET' });
}

export async function retryAgentJob(port: number, id: string): Promise<AgentJobStatus> {
  return requestWithToken<AgentJobStatus>(port, `/v1/jobs/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  });
}

export async function cancelAgentJob(port: number, id: string): Promise<AgentJobStatus> {
  return requestWithToken<AgentJobStatus>(port, `/v1/jobs/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}

export async function testPrinter(port: number, id: string): Promise<AgentTestPrintResponse> {
  return requestWithToken<AgentTestPrintResponse>(port, `/v1/printers/${encodeURIComponent(id)}/test`, {
    method: 'POST',
  });
}

export async function getAgentPairings(port: number): Promise<AgentPairingResponse> {
  return requestWithToken<AgentPairingResponse>(port, '/v1/pairings', { method: 'GET' });
}

export function isAgentPaired(): boolean {
  return Boolean(getAgentToken());
}
