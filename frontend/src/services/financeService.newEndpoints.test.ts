import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchApi } from './api';
import { financeService } from './financeService';

/**
 * Contract tests for the finance-completeness endpoints added in
 * backend/routes/finance.routes.js — each assertion pins the URL, HTTP
 * method, and body shape the backend actually serves, so a drift between
 * the frontend call and the Express route fails here first.
 */

vi.mock('./api', () => ({ fetchApi: vi.fn() }));
const api = vi.mocked(fetchApi);

const lastCall = () => {
  const [url, opts] = api.mock.calls.at(-1)!;
  return { url: url as string, opts: opts as any, body: opts?.body ? JSON.parse(opts.body as string) : undefined };
};

describe('financeService — period lock', () => {
  beforeEach(() => api.mockReset());

  it('GETs /finance/period-lock', async () => {
    api.mockResolvedValue({ lock: null } as any);
    await financeService.getPeriodLock();
    expect(lastCall().url).toBe('/finance/period-lock');
  });

  it('PUTs lockedThrough (+ optional notes) to set the lock', async () => {
    api.mockResolvedValue({ lock: null } as any);
    await financeService.setPeriodLock('2026-09-30', 'Q3 close');
    const { url, opts, body } = lastCall();
    expect(url).toBe('/finance/period-lock');
    expect(opts.method).toBe('PUT');
    expect(body).toEqual({ lockedThrough: '2026-09-30', notes: 'Q3 close' });
  });

  it('sends null lockedThrough to clear the lock', async () => {
    api.mockResolvedValue({ lock: null } as any);
    await financeService.setPeriodLock(null);
    expect(lastCall().body.lockedThrough).toBeNull();
  });
});

describe('financeService — tax remittance', () => {
  beforeEach(() => api.mockReset());

  it('GETs the accrued tax-payable balance', async () => {
    api.mockResolvedValue({ accountId: 'a1', balance: 500, remittedTotal: 100 } as any);
    const res = await financeService.getTaxPayable();
    expect(lastCall().url).toBe('/finance/tax-payable');
    expect(res.balance).toBe(500);
  });

  it('POSTs a remittance with tender + period fields', async () => {
    api.mockResolvedValue({ id: 'r1', entryNumber: 'JE-9' } as any);
    await financeService.createTaxRemittance({
      amount: 250,
      paidFromAccountId: 'acct-bank',
      periodFrom: '2026-09-01',
      periodTo: '2026-09-30',
      reference: 'TRN-123',
    });
    const { url, opts, body } = lastCall();
    expect(url).toBe('/finance/tax-remittance');
    expect(opts.method).toBe('POST');
    expect(body.amount).toBe(250);
    expect(body.paidFromAccountId).toBe('acct-bank');
    expect(body.reference).toBe('TRN-123');
  });
});

describe('financeService — reconciliations', () => {
  beforeEach(() => api.mockReset());

  it('lists sessions with snake_case query params', async () => {
    api.mockResolvedValue({ reconciliations: [] } as any);
    await financeService.listReconciliations({ accountId: 'acct-1', status: 'open' });
    const { url } = lastCall();
    expect(url).toContain('/finance/reconciliations?');
    expect(url).toContain('account_id=acct-1');
    expect(url).toContain('status=open');
  });

  it('POSTs a new session (account, statement date, statement balance)', async () => {
    api.mockResolvedValue({ id: 'rec-1' } as any);
    await financeService.createReconciliation({ accountId: 'acct-1', statementDate: '2026-10-31', statementBalance: 1000 });
    const { url, opts, body } = lastCall();
    expect(url).toBe('/finance/reconciliations');
    expect(opts.method).toBe('POST');
    expect(body).toEqual({ accountId: 'acct-1', statementDate: '2026-10-31', statementBalance: 1000 });
  });

  it('toggles cleared lines via POST /:id/lines', async () => {
    api.mockResolvedValue({} as any);
    await financeService.setReconciliationLines('rec-1', ['line-1', 'line-2'], true);
    const { url, opts, body } = lastCall();
    expect(url).toBe('/finance/reconciliations/rec-1/lines');
    expect(opts.method).toBe('POST');
    expect(body).toEqual({ lineIds: ['line-1', 'line-2'], cleared: true });
  });

  it('completes with an adjustment account when the statement differs', async () => {
    api.mockResolvedValue({ clearedBalance: 1000, difference: 0, adjustmentEntryId: 'je-1' } as any);
    await financeService.completeReconciliation('rec-1', 'acct-adjust');
    const { url, opts, body } = lastCall();
    expect(url).toBe('/finance/reconciliations/rec-1/complete');
    expect(opts.method).toBe('POST');
    expect(body.adjustmentAccountId).toBe('acct-adjust');
  });
});
