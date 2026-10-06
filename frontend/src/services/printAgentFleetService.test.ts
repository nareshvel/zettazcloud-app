import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from './api';
import {
  createEnrollmentCode,
  enrollLocalAgent,
  getFleetPrintAgents,
  getLocalFleetConfiguration,
  getLocalFleetStatus,
  removeLocalFleetEnrollment,
  revokeFleetPrintAgent,
  updateFleetPrintAgent,
  updatePrinterMappings,
} from './printAgentFleetService';

vi.mock('./api', () => ({ fetchApi: vi.fn() }));
vi.mock('./printAgentV2Service', () => ({
  buildAgentUrl: (port: number, path: string) => `http://127.0.0.1:${port}${path}`,
  getAgentToken: () => 'browser-token',
}));

describe('printAgentFleetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates scoped enrollment codes using fetchApi conventions', async () => {
    vi.mocked(fetchApi).mockResolvedValue({ code: 'ONE-TIME', expiresAt: '2026-01-01T00:05:00Z' });
    await createEnrollmentCode('store-1');
    expect(fetchApi).toHaveBeenCalledWith('/print-agents/enrollment-codes', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ storeId: 'store-1' }),
    }));
  });

  it('loads and updates fleet agents and mappings', async () => {
    vi.mocked(fetchApi).mockResolvedValue([]);
    await getFleetPrintAgents();
    await updateFleetPrintAgent('agent/1', { updateChannel: 'pilot', heartbeatIntervalSeconds: 45 });
    await updatePrinterMappings('agent/1', [{ documentRoute: 'receipt', printerId: 'p1', priority: 1, fallback: false }]);
    await revokeFleetPrintAgent('agent/1');
    expect(fetchApi).toHaveBeenCalledWith('/print-agents');
    expect(fetchApi).toHaveBeenCalledWith('/print-agents/agent%2F1', expect.objectContaining({ method: 'PUT' }));
    expect(fetchApi).toHaveBeenCalledWith('/print-agents/agent%2F1/printer-mappings', expect.objectContaining({ method: 'PUT' }));
    expect(fetchApi).toHaveBeenCalledWith('/print-agents/agent%2F1/revoke', { method: 'POST' });
  });

  it('enrolls locally without persisting or returning a device token', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ enrolled: true, agentId: 'a1' }) } as Response);
    const result = await enrollLocalAgent(9419, { code: 'ONE-TIME', cloudBaseUrl: 'https://cloud.example', displayName: 'Till 1' });
    expect(result).toEqual({ enrolled: true, agentId: 'a1' });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://127.0.0.1:9419/v1/fleet/enroll');
    expect((options?.headers as Headers).get('Authorization')).toBe('Bearer browser-token');
    expect(options?.body).toBe(JSON.stringify({ code: 'ONE-TIME', cloudBaseUrl: 'https://cloud.example', displayName: 'Till 1' }));
  });

  it('loads local status and configuration and removes enrollment', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ enrolled: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ updateChannel: 'stable', heartbeatIntervalSeconds: 60 }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await getLocalFleetStatus(9419);
    await getLocalFleetConfiguration(9419);
    await removeLocalFleetEnrollment(9419);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:9419/v1/fleet/status',
      'http://127.0.0.1:9419/v1/fleet/configuration',
      'http://127.0.0.1:9419/v1/fleet/enrollment',
    ]);
    expect(vi.mocked(fetch).mock.calls[2][1]?.method).toBe('DELETE');
  });
});
