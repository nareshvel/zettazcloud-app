import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SalesHubPage from './SalesHubPage';

// The header's user menu renders <Link> (Dashboard/Settings), which needs a
// Router context even though navigation itself is mocked below.
const renderHub = () => render(<SalesHubPage />, { wrapper: MemoryRouter });

/**
 * Sales Hub landing screen — search-first redesign
 * (docs/17-migration-and-roadmap/14_Sales_Hub_Search_First_Redesign.md,
 * superseding the original bento-grid design in
 * docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md).
 *
 * Covers this screen's own behavior: the two hero tiles ("New sale" navigates
 * straight to /pos, "Duty-free sale" opens the intake modal instead), the
 * universal search (debounced call to GET /api/sales-hub/search, rendering
 * per-customer and standalone results with contextual actions), the
 * permission-filtered "Start something new" shortcuts, the Duty-Free intake
 * flow itself (customer capture + traveller details, both required before
 * "Continue to Sale" can proceed), and the fullscreen header's store
 * branding + role-aware user menu (this is the only screen a cashier sees
 * post-login — see Login.tsx's getRedirectPath — so it must carry its own
 * way out to Settings/Sign out, and to Dashboard for anyone who isn't a
 * cashier).
 */

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const setTravellerContext = vi.fn();
const setSelectedCustomer = vi.fn();
vi.mock('@/contexts/CartContext', () => ({
  useCart: () => ({ setTravellerContext, setSelectedCustomer }),
}));

// DutyFreeIntakeModal embeds CustomerSearchSelect, which hits the customer
// search/create API directly — stub it so both the "existing customer"
// search and the "new customer" creation (deferred to Continue, not the
// inline form's own submit) can be driven from these tests without a
// network call.
const searchCustomersMock = vi.fn(async () => [] as any[]);
const createCustomerMock = vi.fn(async (payload: any) => ({
  id: 'cust-new-1',
  first_name: payload.firstName,
  last_name: payload.lastName,
  phone_number: payload.phoneNumber,
  email: payload.email,
  customer_type: 'retail',
}));
vi.mock('@/services/api', () => ({
  searchCustomers: (q: string) => searchCustomersMock(q),
  createCustomer: (payload: any) => createCustomerMock(payload),
}));

// The universal search bar — stub it so tests control exactly what a query
// returns without a network call, matching the debounced call the page makes.
const searchSalesHubMock = vi.fn(async () => ({ customers: [], standaloneRecords: [] }));
vi.mock('@/services/salesHubService', () => ({
  searchSalesHub: (q: string) => searchSalesHubMock(q),
  // Glance badges (repairs ready / memos overdue) — stubbed to empty so the
  // page mounts without a network call.
  getSalesHubGlance: () => Promise.resolve({ repairsReady: 0, memosOverdue: 0 }),
}));

// The store's retail profile (business type + duty-free flag) drives the
// Duty-Free hero tile and the industry-filtered "start something new"
// shortcuts. Default to a duty-free jewelry store so the existing tests
// below (written before this gating existed) keep passing unchanged.
let mockRetailProfile: any = { isDutyFree: true, industryCode: 'jewelry' };
vi.mock('@/services/retailProfileService', () => ({
  getRetailProfile: () => Promise.resolve(mockRetailProfile),
}));

// The "Promotions" shortcut's read-only offers modal — stub the data hook
// and currency formatter so tests don't need a real LocalizationProvider.
let mockOffers: any[] = [];
vi.mock('@/hooks/usePromotionalOffersData', () => ({
  usePromotionalOffersData: () => ({ data: mockOffers, isLoading: false, error: null, lastUpdated: null, refresh: vi.fn() }),
}));
vi.mock('@/contexts/LocalizationContext', () => ({
  useCurrency: () => ({ formatCurrency: (n: number) => `$${n}`, currencySymbol: '$' }),
  useDateFormatting: () => ({
    formatDate: (d: string) => d,
    formatDateTime: (d: string) => d,
    formatTime: (d: string) => d,
  }),
}));

const logoutMock = vi.fn();
// A cashier with the permissions a real jewelry-counter cashier role would
// carry — the hero tiles and shortcut row are permission-gated
// (hasAnyPermission), so a mock user with no permissions array would hide
// everything this file needs to click.
let mockUser: any = {
  id: 'u1', first_name: 'Priya', last_name: 'Nair', email: 'priya@store.example', role: 'cashier',
  permissions: ['sales.create', 'sales.view', 'sales.return', 'inventory.view'],
};
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: logoutMock }),
}));

let mockStore: any = { name: 'Diamond Republic', logoUrl: null };
vi.mock('@/contexts/StoreContext', () => ({
  useStore: () => ({ store: mockStore }),
}));

describe('SalesHubPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setTravellerContext.mockReset();
    setSelectedCustomer.mockReset();
    createCustomerMock.mockClear();
    searchCustomersMock.mockClear();
    searchCustomersMock.mockResolvedValue([]);
    searchSalesHubMock.mockClear();
    searchSalesHubMock.mockResolvedValue({ customers: [], standaloneRecords: [] });
    logoutMock.mockReset();
    mockUser = {
      id: 'u1', first_name: 'Priya', last_name: 'Nair', email: 'priya@store.example', role: 'cashier',
      permissions: ['sales.create', 'sales.view', 'sales.return', 'inventory.view'],
    };
    mockStore = { name: 'Diamond Republic', logoUrl: null };
    mockRetailProfile = { isDutyFree: true, industryCode: 'jewelry' };
    mockOffers = [];
  });

  it('"New sale" navigates straight to /pos', () => {
    renderHub();
    fireEvent.click(screen.getByText('New sale'));
    expect(navigateMock).toHaveBeenCalledWith('/pos', { state: { fromSalesHub: true } });
  });

  it('"Duty-free sale" opens the intake step instead of navigating immediately', async () => {
    renderHub();
    fireEvent.click(await screen.findByText('Duty-free sale'));

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByText('Capture the customer and traveller details before ringing up items.')).toBeInTheDocument();
  });

  it('hides both hero tiles when the user cannot sell', () => {
    mockUser = { id: 'u3', first_name: 'Dana', email: 'dana@store.example', role: 'stock_clerk', permissions: [] };
    renderHub();
    expect(screen.queryByText('New sale')).not.toBeInTheDocument();
    expect(screen.queryByText('Duty-free sale')).not.toBeInTheDocument();
  });

  it('hides the Duty-free sale tile for a store that is not duty-free', async () => {
    mockRetailProfile = { isDutyFree: false, industryCode: 'jewelry' };
    renderHub();
    expect(await screen.findByText('New sale')).toBeInTheDocument();
    expect(screen.queryByText('Duty-free sale')).not.toBeInTheDocument();
  });

  it('shows only the permission-filtered "start something new" shortcuts', async () => {
    mockUser = {
      id: 'u4', first_name: 'Sam', email: 'sam@store.example', role: 'cashier',
      permissions: ['sales.view'], // no inventory.view, no sales.return
    };
    renderHub();
    expect(await screen.findByText('Repair')).toBeInTheDocument();
    expect(screen.getByText('Layaway plan')).toBeInTheDocument();
    expect(screen.queryByText('Memo out')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales return')).not.toBeInTheDocument();
  });

  it('shows only the industry-appropriate shortcuts for a non-jewelry store', async () => {
    mockRetailProfile = { isDutyFree: false, industryCode: 'apparel' };
    renderHub();
    // Universal shortcuts still show.
    expect(await screen.findByText('Memo out')).toBeInTheDocument();
    expect(screen.getByText('Special order')).toBeInTheDocument();
    expect(screen.getByText('Sales return')).toBeInTheDocument();
    // Jewelry-only shortcuts are hidden for an apparel store.
    expect(screen.queryByText('Old gold buy')).not.toBeInTheDocument();
    expect(screen.queryByText('Layaway plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Savings enrollment')).not.toBeInTheDocument();
    // Repair is allowed for jewelry + electronics only, not apparel.
    expect(screen.queryByText('Repair')).not.toBeInTheDocument();
  });

  it('a "start something new" shortcut navigates with the quick-action state', async () => {
    renderHub();
    fireEvent.click(await screen.findByText('Repair'));
    expect(navigateMock).toHaveBeenCalledWith('/repairs', { state: { quickAction: true, fromSalesHub: true } });
  });

  describe('Promotions tile', () => {
    it('opens a read-only offers list instead of navigating away', async () => {
      mockOffers = [{
        id: 'o1', name: 'Summer Sale', offerType: 'percentage_discount', isActive: true,
        startDate: '2026-01-01', endDate: '2026-12-31', priority: 1, currentTotalUses: 0,
        minimumQuantity: 1, discountValue: 20,
      }];
      renderHub();
      fireEvent.click(await screen.findByText('Promotions'));

      expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('promotion'), expect.anything());
      expect(screen.getByText('Current promotions')).toBeInTheDocument();
      expect(screen.getByText('Summer Sale')).toBeInTheDocument();
      expect(screen.getByText('20% off')).toBeInTheDocument();
    });

    it('shows an empty state when there are no offers', async () => {
      mockOffers = [];
      renderHub();
      fireEvent.click(await screen.findByText('Promotions'));
      expect(screen.getByText('No promotional offers have been set up yet.')).toBeInTheDocument();
    });

    it('closes via the X button', async () => {
      renderHub();
      fireEvent.click(await screen.findByText('Promotions'));
      expect(screen.getByText('Current promotions')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByText('Current promotions')).not.toBeInTheDocument();
    });

    it('shows a search box and filters the list once there are enough offers', async () => {
      mockOffers = Array.from({ length: 12 }, (_, i) => ({
        id: `o${i}`, name: `Offer ${i}`, offerType: 'percentage_discount', isActive: true,
        startDate: '2026-01-01', priority: 1, currentTotalUses: 0, minimumQuantity: 1, discountValue: 10,
      }));
      renderHub();
      fireEvent.click(await screen.findByText('Promotions'));

      const search = screen.getByPlaceholderText('Search by name or code…');
      expect(screen.getByText('Offer 0')).toBeInTheDocument();
      expect(screen.getByText('Offer 11')).toBeInTheDocument();

      fireEvent.change(search, { target: { value: 'Offer 3' } });
      expect(screen.getByText('Offer 3')).toBeInTheDocument();
      expect(screen.queryByText('Offer 0')).not.toBeInTheDocument();
    });

    it('hides the search box for a short list', async () => {
      mockOffers = [{
        id: 'o1', name: 'Summer Sale', offerType: 'percentage_discount', isActive: true,
        startDate: '2026-01-01', priority: 1, currentTotalUses: 0, minimumQuantity: 1, discountValue: 20,
      }];
      renderHub();
      fireEvent.click(await screen.findByText('Promotions'));
      expect(screen.queryByPlaceholderText('Search by name or code…')).not.toBeInTheDocument();
    });
  });

  it('does not search until at least 2 characters are typed', () => {
    renderHub();
    fireEvent.change(screen.getByPlaceholderText(/Search name, phone, email/), { target: { value: 'a' } });
    expect(searchSalesHubMock).not.toHaveBeenCalled();
  });

  it('searches and renders a customer result with their open records', async () => {
    searchSalesHubMock.mockResolvedValueOnce({
      customers: [{
        id: 'cust-1', name: 'Priya Menon', phone: '555-0100', email: 'priya.menon@example.com',
        records: [{
          type: 'repair', id: 'r1', label: 'Repair #R-1001', status: 'ready',
          statusLabel: 'Ready for pickup', action: 'check-in', actionLabel: 'Check in', date: null,
        }],
      }],
      standaloneRecords: [],
    });

    renderHub();
    fireEvent.change(screen.getByPlaceholderText(/Search name, phone, email/), { target: { value: 'Priya' } });

    await waitFor(() => expect(searchSalesHubMock).toHaveBeenCalledWith('Priya'), { timeout: 1000 });
    expect(await screen.findByText('Priya Menon')).toBeInTheDocument();
    expect(screen.getByText(/555-0100/)).toBeInTheDocument();
    expect(screen.getByText('Repair #R-1001')).toBeInTheDocument();
  });

  it('clicking a customer\'s record navigates to its destination with quick-action state', async () => {
    searchSalesHubMock.mockResolvedValueOnce({
      customers: [{
        id: 'cust-1', name: 'Priya Menon', phone: null, email: null,
        records: [{
          type: 'repair', id: 'r1', label: 'Repair #R-1001', status: 'ready',
          statusLabel: 'Ready for pickup', action: 'check-in', actionLabel: 'Check in', date: null,
        }],
      }],
      standaloneRecords: [],
    });

    renderHub();
    fireEvent.change(screen.getByPlaceholderText(/Search name, phone, email/), { target: { value: 'Priya' } });
    fireEvent.click(await screen.findByText('Repair #R-1001'));

    expect(navigateMock).toHaveBeenCalledWith('/repairs', {
      state: {
        quickAction: true, fromSalesHub: true, presetQuery: 'Priya Menon', presetRecordId: 'r1',
      },
    });
  });

  it('renders a standalone (no-customer-match) record result', async () => {
    searchSalesHubMock.mockResolvedValueOnce({
      customers: [],
      standaloneRecords: [{
        type: 'sale', id: 's1', label: 'Sale #1042', status: 'completed',
        statusLabel: 'Completed', action: 'return', actionLabel: 'Return item', date: null,
      }],
    });

    renderHub();
    fireEvent.change(screen.getByPlaceholderText(/Search name, phone, email/), { target: { value: '1042' } });

    expect(await screen.findByText('Sale #1042')).toBeInTheDocument();
    expect(screen.getByText('Return item')).toBeInTheDocument();
  });

  it('shows a no-matches message when the search returns nothing', async () => {
    renderHub();
    fireEvent.change(screen.getByPlaceholderText(/Search name, phone, email/), { target: { value: 'zzz' } });

    await waitFor(() => expect(searchSalesHubMock).toHaveBeenCalledWith('zzz'));
    expect(await screen.findByText(/No matches for "zzz"/)).toBeInTheDocument();
  });

  it('shows a search error message when the search fails', async () => {
    searchSalesHubMock.mockRejectedValueOnce(new Error('network down'));
    renderHub();
    fireEvent.change(screen.getByPlaceholderText(/Search name, phone, email/), { target: { value: 'Priya' } });

    expect(await screen.findByText('Search failed. Try again.')).toBeInTheDocument();
  });

  describe('Duty-Free intake', () => {
    const openIntake = async () => {
      renderHub();
      fireEvent.click(await screen.findByText('Duty-free sale'));
    };

    it('blocks "Continue to Sale" until a customer is selected', async () => {
      await openIntake();

      fireEvent.change(screen.getByPlaceholderText('e.g. N1234567'), { target: { value: 'N9999999' } });
      fireEvent.click(screen.getByRole('button', { name: /Continue to Sale/ }));

      expect(screen.getByText(/Select or add a customer to continue/)).toBeInTheDocument();
      expect(setTravellerContext).not.toHaveBeenCalled();
      expect(setSelectedCustomer).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
    });

    const fillRequiredTravellerFields = () => {
      fireEvent.change(screen.getByPlaceholderText('e.g. N1234567'), { target: { value: 'N9999999' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. United States'), { target: { value: 'Canada' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. AA123'), { target: { value: 'AA123' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. London'), { target: { value: 'London' } });
      const dateInput = screen.getByPlaceholderText('MM/DD/YYYY');
      fireEvent.change(dateInput, { target: { value: '12/25/2026' } });
      fireEvent.blur(dateInput);
    };

    it('blocks "Continue to Sale" until traveller details are complete, even with a customer selected', async () => {
      await openIntake();

      fireEvent.click(screen.getByTitle('Add new customer'));
      fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Alex' } });
      // No traveller fields filled in.
      fireEvent.click(screen.getByRole('button', { name: /Continue to Sale/ }));

      expect(screen.getByText(/Complete all traveller details to continue/)).toBeInTheDocument();
      expect(createCustomerMock).not.toHaveBeenCalled();
      expect(setTravellerContext).not.toHaveBeenCalled();
      expect(setSelectedCustomer).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('creates a new customer only when "Continue to Sale" is clicked, not before', async () => {
      await openIntake();

      // Opening the new-customer form must NOT hit the API yet.
      fireEvent.click(screen.getByTitle('Add new customer'));
      expect(screen.getByText('New Customer')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Alex' } });
      fireEvent.change(screen.getByPlaceholderText('Street, P.O. box…'), { target: { value: '221B Baker St' } });
      expect(createCustomerMock).not.toHaveBeenCalled();

      fillRequiredTravellerFields();
      fireEvent.click(screen.getByRole('button', { name: /Continue to Sale/ }));

      // The single Continue click both creates the customer and completes the intake.
      await waitFor(() => expect(createCustomerMock).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Alex', addressLine1: '221B Baker St' })
      ));
      expect(setSelectedCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cust-new-1', firstName: 'Alex' })
      );
      expect(setTravellerContext).toHaveBeenCalledWith(
        expect.objectContaining({ travellerIdNumber: 'N9999999', travellerIdCountry: 'Canada', travelMethodType: 'flight', destination: 'London', departureDate: '2026-12-25' })
      );
      expect(navigateMock).toHaveBeenCalledWith('/pos', { state: { fromSalesHub: true } });
    });

    it('shows an existing customer as a labeled read-only card once selected', async () => {
      searchCustomersMock.mockResolvedValueOnce([
        { id: 'cust-existing-1', first_name: 'Priya', last_name: 'Menon', phone_number: '555-0100', email: 'priya.menon@example.com', city: 'Miami' },
      ]);

      await openIntake();
      fireEvent.change(screen.getByPlaceholderText('Search by name, phone or customer code…'), { target: { value: 'Priya' } });
      fireEvent.mouseDown(await screen.findByText('Priya Menon'));

      expect(screen.getByText('555-0100')).toBeInTheDocument();
      expect(screen.getByText('priya.menon@example.com')).toBeInTheDocument();
      // The new-customer form must not also be showing.
      expect(screen.queryByText('New Customer')).not.toBeInTheDocument();
    });

    it('lets the cashier switch to an existing customer while a new-customer draft is open', async () => {
      searchCustomersMock.mockResolvedValueOnce([
        { id: 'cust-existing-2', first_name: 'Sam', last_name: 'Ortiz' },
      ]);

      await openIntake();

      fireEvent.click(screen.getByTitle('Add new customer'));
      fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Draft Name' } });

      // The search box stays usable even with the new-customer draft open.
      fireEvent.change(screen.getByPlaceholderText('Search by name, phone or customer code…'), { target: { value: 'Sam' } });
      fireEvent.mouseDown(await screen.findByText('Sam Ortiz'));

      expect(screen.queryByText('New Customer')).not.toBeInTheDocument();
      expect(screen.getByText('Sam Ortiz')).toBeInTheDocument();
    });

    it('canceling the duty-free intake closes it without capturing anything', async () => {
      await openIntake();
      fireEvent.click(screen.getByText('Cancel'));

      expect(setTravellerContext).not.toHaveBeenCalled();
      expect(setSelectedCustomer).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
      expect(screen.queryByText('Capture the customer and traveller details before ringing up items.')).not.toBeInTheDocument();
    });
  });

  it('shows the store name in the header and greets the signed-in user', () => {
    renderHub();
    expect(screen.getAllByText('Diamond Republic').length).toBeGreaterThan(0);
    expect(screen.getByText(/Priya/)).toBeInTheDocument();
  });

  it('falls back to a lettermark when the store has no logo', () => {
    mockStore = { name: 'Diamond Republic', logoUrl: null };
    renderHub();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  // The Dashboard link is gated on `dashboard.view` — the same gate the
  // Sidebar's Dashboard nav item uses. It became meaningful after
  // migration 2026-09-03_remove_dashboard_view_from_cashier_roles.sql
  // stripped the grant from Cashier/Sales Associate; earlier iterations
  // used isAdminUser because back then every cashier held the permission
  // and it could gate nothing.
  it('hides the Dashboard link in the user menu for a cashier without dashboard.view', () => {
    mockUser = { id: 'u1', first_name: 'Priya', email: 'priya@store.example', role: 'cashier', permissions: ['sales.create'] };
    renderHub();
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('hides the Dashboard link even with no role string at all (RBAC-assigned role, legacy `role` field empty)', () => {
    mockUser = { id: 'u3', first_name: 'Jordan', email: 'jordan@store.example', permissions: ['sales.create'] };
    renderHub();
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows the Dashboard link for a non-admin user holding dashboard.view (e.g. Senior Cashier)', () => {
    mockUser = { id: 'u4', first_name: 'Nadia', email: 'nadia@store.example', role: 'senior_cashier', permissions: ['sales.create', 'dashboard.view'] };
    renderHub();
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows the Dashboard link in the user menu for a tenant admin', () => {
    mockUser = { id: 'u2', first_name: 'Alex', email: 'alex@store.example', role: 'tenant_admin', permissions: [] };
    renderHub();
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('signs out and redirects to /login', async () => {
    renderHub();
    fireEvent.click(screen.getByLabelText('User menu'));
    fireEvent.click(screen.getByText('Sign out'));
    expect(logoutMock).toHaveBeenCalled();
  });
});
