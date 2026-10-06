import { fetchApi } from './api';

/** Client for the employee module mounted at /api/employees. */

export interface Employee {
  id: string;
  employeeCode?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  commissionPct?: number | null;
  isSalesStaff?: boolean | number;
  paytimeEmployeeId?: string | null;
  isActive?: boolean | number;
  storeId?: string | null;
  userId?: string | null;
}

export interface EmployeePerformance {
  achieved: number;
  numSales: number;
  target: number | null;
  incentivePct: number | null;
  bonusFlat: number | null;
  computedIncentive: number;
  metTarget: boolean | null;
}

const unwrap = <T,>(r: any): T => (r && r.data !== undefined ? r.data : r);

export async function listEmployees(): Promise<Employee[]> {
  return unwrap<Employee[]>(await fetchApi<any>('/employees'));
}

export async function createEmployee(payload: Partial<Employee>): Promise<{ id: string; userId?: string | null }> {
  return unwrap(await fetchApi<any>('/employees', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateEmployee(id: string, payload: Partial<Employee>): Promise<void> {
  await fetchApi(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deactivateEmployee(id: string): Promise<void> {
  await fetchApi(`/employees/${id}`, { method: 'DELETE' });
}

export async function setTarget(id: string, payload: {
  periodType?: string; periodStart: string; periodEnd: string;
  targetAmount: number; incentivePct?: number | null; bonusFlat?: number | null; notes?: string;
}): Promise<{ id: string }> {
  return unwrap(await fetchApi<any>(`/employees/${id}/targets`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function getPerformance(id: string, periodStart: string, periodEnd: string): Promise<EmployeePerformance> {
  return unwrap<EmployeePerformance>(
    await fetchApi<any>(`/employees/${id}/performance?period_start=${periodStart}&period_end=${periodEnd}`)
  );
}

export interface EmployeePerformanceSummaryRow {
  employeeId: string;
  firstName: string;
  lastName: string | null;
  jobTitle: string | null;
  commissionPct: number | null;
  isSalesStaff: boolean | number;
  achieved: number;
  numSales: number;
  target: number | null;
  incentivePct: number | null;
  bonusFlat: number | null;
  computedIncentive: number;
  metTarget: boolean | null;
}

export async function getPerformanceSummary(periodStart: string, periodEnd: string): Promise<EmployeePerformanceSummaryRow[]> {
  return unwrap<EmployeePerformanceSummaryRow[]>(
    await fetchApi<any>(`/employees/performance-summary?period_start=${periodStart}&period_end=${periodEnd}`)
  );
}

export async function paytimeStatus(): Promise<{ configured: boolean }> {
  return unwrap(await fetchApi<any>('/employees/paytime/status'));
}

export async function pushPaytimeIncentive(
  employeeId: string,
  payload: { periodStart: string; periodEnd: string; amount: number; note?: string }
): Promise<any> {
  return unwrap(await fetchApi<any>(`/employees/${employeeId}/paytime/sync`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}
