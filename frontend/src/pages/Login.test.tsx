import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

/**
 * Login's `getRedirectPath` decides where every user lands right after
 * signing in — this is the ONLY place that decision is made (App.tsx has no
 * other post-auth redirect; see docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md
 * and 06_Implementation_Changelog.md's Sales Hub iterations). Getting it
 * wrong means a cashier lands on the admin dashboard, or a jewelry tenant's
 * counter staff never see the Sales Hub they were just built.
 *
 * Covers: sales-floor users (non-admin, `sales.create`) go to the Sales Hub
 * for every industry except grocery (see utils/salesHubIndustries.ts) and to
 * POS for grocery; a jurisdiction lookup failure fails open to POS rather
 * than blocking login; admins go to `/admin`; a plain user with no sales
 * permission goes to `/dashboard`; incomplete onboarding takes priority over
 * all of the above.
 */

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const loginMock = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, isLoading: false, error: null }),
}));

const getTenantIndustry = vi.fn();
vi.mock('@/services/industryService', () => ({
  getTenantIndustry: (...args: unknown[]) => getTenantIndustry(...args),
}));

const renderLogin = () => render(<Login />, { wrapper: MemoryRouter });

async function submitLogin() {
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
}

const CASHIER = { id: 'u1', role: 'cashier', permissions: ['sales.create'] };
const MANAGER = { id: 'u2', role: 'manager', permissions: ['sales.create'] };
const TENANT_ADMIN = { id: 'u3', role: 'tenant_admin', permissions: [] };
const PLAIN_USER = { id: 'u4', role: 'staff', permissions: ['products.view'] };

describe('Login — post-login redirect', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    loginMock.mockReset();
    getTenantIndustry.mockReset();
    localStorage.clear();
  });

  it('sends a jewelry-tenant cashier to the Sales Hub, not the dashboard', async () => {
    loginMock.mockResolvedValue(CASHIER);
    getTenantIndustry.mockResolvedValue('jewelry');
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/sales-hub'));
    expect(localStorage.getItem('tenant_industry_code')).toBe('jewelry');
  });

  it('sends a grocery cashier straight to POS (the one industry without a Sales Hub)', async () => {
    loginMock.mockResolvedValue(CASHIER);
    getTenantIndustry.mockResolvedValue('grocery');
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/pos'));
  });

  it('sends an apparel cashier to the Sales Hub too (opened to all industries except grocery)', async () => {
    loginMock.mockResolvedValue(CASHIER);
    getTenantIndustry.mockResolvedValue('apparel');
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/sales-hub'));
  });

  it('a sales-floor manager (non-admin, sales.create) also lands on the Sales Hub for a jewelry tenant', async () => {
    loginMock.mockResolvedValue(MANAGER);
    getTenantIndustry.mockResolvedValue('jewelry');
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/sales-hub'));
  });

  it('fails open to POS when the industry lookup rejects', async () => {
    loginMock.mockResolvedValue(CASHIER);
    getTenantIndustry.mockRejectedValue(new Error('network down'));
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/pos'));
  });

  it('sends a tenant admin to /admin without ever resolving industry', async () => {
    loginMock.mockResolvedValue(TENANT_ADMIN);
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin'));
    expect(getTenantIndustry).not.toHaveBeenCalled();
  });

  it('sends a user with no sales.create permission to /dashboard', async () => {
    loginMock.mockResolvedValue(PLAIN_USER);
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
    expect(getTenantIndustry).not.toHaveBeenCalled();
  });

  it('incomplete onboarding takes priority over every other redirect', async () => {
    loginMock.mockResolvedValue({
      ...CASHIER,
      tenant: { setup_completed: false, onboarding_step: 'industry' },
    });
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/onboarding'));
    expect(getTenantIndustry).not.toHaveBeenCalled();
  });
});
