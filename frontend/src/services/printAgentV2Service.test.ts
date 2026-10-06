import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  cancelAgentJob,
  clearAgentToken,
  detectAgent,
  disconnectAgent,
  getAgentDiagnostics,
  getAgentJobs,
  getAgentPairings,
  getAgentPrinters,
  getAgentToken,
  isAgentPaired,
  pairAgent,
  PRINT_AGENT_TOKEN_KEY,
  retryAgentJob,
  setAgentToken,
  testPrinter,
} from './printAgentV2Service';

describe('printAgentV2Service', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal(
      'fetch',
      vi.fn()
    );

    Object.defineProperty(window, 'localStorage', {
      writable: true,
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          store = {};
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('token helpers', () => {
    it('reads and writes the print agent token', () => {
      expect(getAgentToken()).toBeNull();
      setAgentToken('abc123');
      expect(getAgentToken()).toBe('abc123');
      expect(isAgentPaired()).toBe(true);
      clearAgentToken();
      expect(getAgentToken()).toBeNull();
      expect(isAgentPaired()).toBe(false);
      expect(store[PRINT_AGENT_TOKEN_KEY]).toBeUndefined();
    });
  });

  describe('detectAgent', () => {
    it('returns health and port when the agent responds on the first port', async () => {
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', version: '2.0.0-dev', platform: 'darwin' }),
      });

      const result = await detectAgent();
      expect(result.port).toBe(9419);
      expect(result.health).toEqual({ status: 'ok', version: '2.0.0-dev', platform: 'darwin' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('127.0.0.1:9419/v1/health');
    });

    it('falls back to the second port when the first fails', async () => {
      const mockFetch = fetch as Mock;
      mockFetch
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok', version: '2.0.0-dev' }),
        });

      const result = await detectAgent();
      expect(result.port).toBe(9420);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws a descriptive error when no agent is found', async () => {
      const mockFetch = fetch as Mock;
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(detectAgent()).rejects.toThrow('Zettaz Print Agent not detected');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('pairAgent', () => {
    it('pairs the browser and stores the returned token', async () => {
      const mockFetch = fetch as Mock;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok', version: '2.0.0-dev' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'secret-token' }),
        });

      const result = await pairAgent({
        pairingCode: '123456',
        clientId: 'http://localhost:5173',
        origin: 'http://localhost:5173',
      });

      expect(result.token).toBe('secret-token');
      expect(result.port).toBe(9419);
      expect(getAgentToken()).toBe('secret-token');
      expect(mockFetch.mock.calls[1][0]).toContain('/v1/pair');
      expect(mockFetch.mock.calls[1][1].body).toContain('123456');
    });

    it('rejects when the pairing code is too short', async () => {
      await expect(
        pairAgent({ pairingCode: '123', clientId: 'x', origin: 'x' }),
      ).rejects.toThrow('pairing code is required');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects when the pairing endpoint returns an error', async () => {
      const mockFetch = fetch as Mock;
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Forbidden',
          text: async () => 'invalid pairing code',
        });

      await expect(
        pairAgent({ pairingCode: '000000', clientId: 'x', origin: 'x' }),
      ).rejects.toThrow('Pairing failed: invalid pairing code');
    });
  });

  describe('getAgentPrinters', () => {
    it('fetches printers with a bearer token', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          printers: [{ id: 'p1', name: 'Receipt Printer', isDefault: true }],
        }),
      });

      const result = await getAgentPrinters(9419);
      expect(result.printers).toHaveLength(1);
      expect(result.printers[0].name).toBe('Receipt Printer');
      expect(mockFetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer my-token');
    });

    it('throws when no token is stored', async () => {
      await expect(getAgentPrinters(9419)).rejects.toThrow('not paired');
    });

    it('throws a 401-specific message when unauthorized', async () => {
      setAgentToken('bad-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '',
      });

      await expect(getAgentPrinters(9419)).rejects.toThrow('pairing is invalid or expired');
    });
  });

  describe('getAgentDiagnostics', () => {
    it('fetches diagnostics with a bearer token', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          version: '2.0.0-dev',
          checks: [{ name: 'cups', passed: true }],
        }),
      });

      const result = await getAgentDiagnostics(9419);
      expect(result.status).toBe('ok');
      expect(result.checks?.[0].passed).toBe(true);
      expect(mockFetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer my-token');
    });

    it('throws when no token is stored', async () => {
      await expect(getAgentDiagnostics(9419)).rejects.toThrow('not paired');
    });
  });

  describe('disconnectAgent', () => {
    it('calls DELETE /v1/pair and clears the token', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({ ok: true });

      await disconnectAgent(9419);
      expect(getAgentToken()).toBeNull();
      expect(mockFetch.mock.calls[0][0]).toContain('/v1/pair');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });

    it('still clears the token when the agent is unreachable', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockRejectedValue(new Error('Agent is down'));

      await disconnectAgent(9419);
      expect(getAgentToken()).toBeNull();
    });
  });

  describe('getAgentDiagnostics', () => {
    it('includes queue and client metadata when present', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          version: '2.0.0-dev',
          queue: { total: 5, queued: 2, processing: 1, completed: 1, failed: 1, cancelled: 0 },
          client: { clientId: 'http://localhost:5173', origin: 'http://localhost:5173', paired: true },
        }),
      });

      const result = await getAgentDiagnostics(9419);
      expect(result.queue).toEqual({ total: 5, queued: 2, processing: 1, completed: 1, failed: 1, cancelled: 0 });
      expect(result.client).toEqual({ clientId: 'http://localhost:5173', origin: 'http://localhost:5173', paired: true });
    });
  });

  describe('getAgentJobs', () => {
    it('fetches jobs with optional query params', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: 'job-1',
              clientId: 'http://localhost:5173',
              destination: 'system',
              printerId: 'p1',
              address: '',
              contentType: 'pdf',
              copies: 1,
              mediaSize: 'A4',
              state: 'completed',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const result = await getAgentJobs(9419, { state: 'completed', clientId: 'http://localhost:5173', limit: 10 });
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].state).toBe('completed');
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/v1/jobs?');
      expect(url).toContain('state=completed');
      expect(url).toContain('clientId=http%3A%2F%2Flocalhost%3A5173');
      expect(url).toContain('limit=10');
    });

    it('throws when no token is stored', async () => {
      await expect(getAgentJobs(9419)).rejects.toThrow('not paired');
    });
  });

  describe('retryAgentJob', () => {
    it('posts retry and returns the updated status', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'job-2', state: 'queued', updatedAt: '2026-01-01T00:00:00Z' }),
      });

      const result = await retryAgentJob(9419, 'job-2');
      expect(result.state).toBe('queued');
      expect(mockFetch.mock.calls[0][0]).toContain('/v1/jobs/job-2/retry');
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('throws when no token is stored', async () => {
      await expect(retryAgentJob(9419, 'job-2')).rejects.toThrow('not paired');
    });
  });

  describe('cancelAgentJob', () => {
    it('posts cancel and returns the updated status', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'job-3', state: 'cancelled', updatedAt: '2026-01-01T00:00:00Z' }),
      });

      const result = await cancelAgentJob(9419, 'job-3');
      expect(result.state).toBe('cancelled');
      expect(mockFetch.mock.calls[0][0]).toContain('/v1/jobs/job-3/cancel');
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('throws when no token is stored', async () => {
      await expect(cancelAgentJob(9419, 'job-3')).rejects.toThrow('not paired');
    });
  });

  describe('testPrinter', () => {
    it('posts a test print for the given printer', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'ok' }),
      });

      const result = await testPrinter(9419, 'printer-1');
      expect(result.state).toBe('ok');
      expect(mockFetch.mock.calls[0][0]).toContain('/v1/printers/printer-1/test');
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('throws when no token is stored', async () => {
      await expect(testPrinter(9419, 'printer-1')).rejects.toThrow('not paired');
    });
  });

  describe('getAgentPairings', () => {
    it('returns the current browser pairing metadata', async () => {
      setAgentToken('my-token');
      const mockFetch = fetch as Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clientId: 'http://localhost:5173', origin: 'http://localhost:5173', paired: true }),
      });

      const result = await getAgentPairings(9419);
      expect(result.paired).toBe(true);
      expect(result.origin).toBe('http://localhost:5173');
    });

    it('throws when no token is stored', async () => {
      await expect(getAgentPairings(9419)).rejects.toThrow('not paired');
    });
  });
});
