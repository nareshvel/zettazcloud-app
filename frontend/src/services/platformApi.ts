/**
 * Platform Admin API client — one typed surface for every /api/platform/*
 * endpoint (the system-admin console). fetchApi unwraps {status, data} and
 * auto-camelCases keys, so all types here are camelCase.
 */
import { fetchApi } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantRow {
  id: string;
  name: string;
  industryCode: string | null;
  status: 'active' | 'suspended' | 'pending_deletion';
  createdAt: string;
  suspendedReason: string | null;
  suspendedAt: string | null;
  deletionDueAt: string | null;
  subStatus: string | null;
  billingCycle: string | null;
  trialEndDate: string | null;
  endDate: string | null;
  gracePeriodEndsAt: string | null;
  planName: string | null;
  userCount: number;
  storeCount: number;
  productCount: number;
  lastLoginAt: string | null;
  healthScore: number;
  healthStatus: 'healthy' | 'watch' | 'at_risk';
  flags: string[];
}

export interface TenantDetail {
  tenant: Record<string, unknown> & { id: string; name: string; status: string };
  subscription: (Record<string, unknown> & { planName?: string }) | null;
  admins: Array<{ id: string; name: string; email: string; isActive: boolean; lastLoginAt: string | null; totpEnabled: boolean }>;
  stores: Array<{ id: string; name: string; isActive: boolean; createdAt: string }>;
  counts: { users: number; stores: number; products: number; sales: number };
}

export interface Overview {
  tenants: { total: number; active: number; suspended: number; pendingDeletion: number; newThisMonth: number };
  revenue: { mrr: Record<string, number>; paying: number; trials: number; trialsEnding7d: number; pastDue: number };
  usage: { staff: number; activeStaff7d: number; stores: number; products: number; sales30d: number };
  attention: Array<{ id: string; name: string; status: string; healthScore: number; flags: string[] }>;
}

export interface SubscriptionRow {
  id: string;
  tenantId: string;
  tenantName: string;
  planId: string | null;
  planName: string | null;
  status: string;
  billingCycle: string | null;
  startDate: string | null;
  endDate: string | null;
  trialEndDate: string | null;
  gracePeriodEndsAt: string | null;
  autoRenew: number;
  priceMonthly: number | null;
  priceYearly: number | null;
  currency: string | null;
  updatedAt: string;
}

export interface BillingIssue extends SubscriptionRow {
  failedAttempts: number;
  issue: 'payment_grace' | 'trial_ending' | 'lapsed';
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number | null;
  currency: string;
  features: Record<string, boolean> | null;
  limits: Record<string, number> | null;
  isActive: boolean;
  stripePriceIdMonthly?: string | null;
  stripePriceIdYearly?: string | null;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  systemRoles: string[];
}

export interface PlatformRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Array<{ permissionId: string; name: string; description: string | null; module: string }>;
}

export interface AuditEntry {
  id: string;
  tenantId: string;
  tenantName: string | null;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  severity: string | null;
  status: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  severity: 'info' | 'warning' | 'critical';
  audience: 'all' | 'trial' | 'active' | 'past_due';
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Ticket {
  id: string;
  tenantId: string;
  tenantName?: string;
  userId: string | null;
  userEmail?: string | null;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorUserId: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  body: string;
  isPlatformReply: boolean;
  createdAt: string;
}

export interface HealthReport {
  database: 'up' | 'down';
  uptimeSeconds: number;
  node: string;
  jobs: Array<{ jobName: string; startedAt: string; finishedAt: string | null; status: string; message: string | null }>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export const platformApi = {
  overview: () => fetchApi<Overview>('/platform/overview'),
  health: () => fetchApi<HealthReport>('/platform/health'),

  tenants: () => fetchApi<TenantRow[]>('/platform/tenants'),
  tenant: (id: string) => fetchApi<TenantDetail>(`/platform/tenants/${id}`),
  createTenant: (body: {
    name: string; adminName: string; adminEmail: string; adminPassword: string;
    adminPhone?: string; industryCode?: string; planName?: string; trialDays?: number;
  }) => fetchApi<{ tenantId: string; userId: string }>('/platform/tenants', { method: 'POST', body: JSON.stringify(body) }),
  updateTenant: (id: string, body: Record<string, unknown>) =>
    fetchApi(`/platform/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  suspendTenant: (id: string, reason: string) =>
    fetchApi(`/platform/tenants/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resumeTenant: (id: string) => fetchApi(`/platform/tenants/${id}/resume`, { method: 'POST' }),
  scheduleDeletion: (id: string, days: number, reason: string) =>
    fetchApi(`/platform/tenants/${id}/schedule-deletion`, { method: 'POST', body: JSON.stringify({ days, reason }) }),
  cancelDeletion: (id: string) => fetchApi(`/platform/tenants/${id}/cancel-deletion`, { method: 'POST' }),
  tenantFeatures: (id: string) =>
    fetchApi<Array<{ key: string; override: string; effective: boolean }>>(`/platform/tenants/${id}/features`),
  setTenantFeature: (id: string, featureKey: string, state: 'default' | 'on' | 'off') =>
    fetchApi(`/platform/tenants/${id}/features`, { method: 'PUT', body: JSON.stringify({ featureKey, state }) }),
  impersonate: (id: string, reason: string) =>
    fetchApi<{ token: string; tenantName: string; expiresAt: string; actingAs: string }>(
      `/platform/tenants/${id}/impersonate`, { method: 'POST', body: JSON.stringify({ reason }) }),

  subscriptions: (status?: string) =>
    fetchApi<SubscriptionRow[]>(`/platform/subscriptions${status ? `?status=${status}` : ''}`),
  updateSubscription: (id: string, body: Record<string, unknown>) =>
    fetchApi<SubscriptionRow>(`/platform/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  billingIssues: () => fetchApi<BillingIssue[]>('/platform/billing/issues'),
  runDunning: () => fetchApi('/platform/billing/run-dunning', { method: 'POST' }),

  plans: () => fetchApi<Plan[]>('/platform/plans'),
  createPlan: (body: Record<string, unknown>) => fetchApi<Plan>('/platform/plans', { method: 'POST', body: JSON.stringify(body) }),
  updatePlan: (id: string, body: Record<string, unknown>) => fetchApi<Plan>(`/platform/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  systemUsers: () => fetchApi<SystemUser[]>('/platform/users'),
  tenantUsers: () => fetchApi<Array<Record<string, unknown>>>('/platform/tenant-users'),
  createSystemUser: (body: { name: string; email: string; password: string; roleName?: string }) =>
    fetchApi('/platform/users', { method: 'POST', body: JSON.stringify(body) }),
  updateSystemUser: (id: string, body: Record<string, unknown>) =>
    fetchApi(`/platform/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSystemUser: (id: string) => fetchApi(`/platform/users/${id}`, { method: 'DELETE' }),

  platformRoles: () => fetchApi<PlatformRole[]>('/platform/rbac/roles'),
  platformPermissions: () => fetchApi<Array<{ id: string; name: string; description: string | null; module: string }>>('/platform/rbac/permissions'),
  updatePlatformRolePermissions: (roleId: string, permissionIds: string[]) =>
    fetchApi(`/platform/rbac/roles/${roleId}/permissions`, { method: 'PUT', body: JSON.stringify({ permissionIds }) }),

  audit: (params?: { tenantId?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.tenantId) q.set('tenantId', params.tenantId);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return fetchApi<AuditEntry[]>(`/platform/audit${qs ? `?${qs}` : ''}`);
  },

  announcements: () => fetchApi<Announcement[]>('/platform/announcements'),
  createAnnouncement: (body: Record<string, unknown>) =>
    fetchApi('/platform/announcements', { method: 'POST', body: JSON.stringify(body) }),
  updateAnnouncement: (id: string, body: Record<string, unknown>) =>
    fetchApi(`/platform/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  tickets: (status?: string) => fetchApi<Ticket[]>(`/platform/tickets${status ? `?status=${status}` : ''}`),
  ticket: (id: string) => fetchApi<{ ticket: Ticket; messages: TicketMessage[] }>(`/platform/tickets/${id}`),
  replyTicket: (id: string, body: string) =>
    fetchApi(`/platform/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  updateTicketStatus: (id: string, status: string) =>
    fetchApi(`/platform/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

/** Authenticated gzip download of a tenant export. */
export const downloadTenantExport = async (tenantId: string) => {
  const token = localStorage.getItem('auth_token');
  const base = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || '';
  const res = await fetch(`${base}/api/platform/tenants/${tenantId}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tenant-${tenantId}-export.json.gz`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/** Compact currency formatting — $12.4K style for dashboards. */
export const money = (v: number | string | null | undefined, currency = 'USD', compact = true) => {
  const n = Number(v || 0);
  const sym = currency.toUpperCase() === 'USD' ? '$' : `${currency.toUpperCase()} `;
  if (compact && Math.abs(n) >= 1000) return `${sym}${(n / 1000).toFixed(1)}K`;
  return `${sym}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

export const ago = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 0) return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
