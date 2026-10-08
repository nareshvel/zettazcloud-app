import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { CartProvider, useCart, type CheckoutTenderLeg } from './CartContext';

/**
 * Covers the split-tender wiring in CartContext.checkout()
 * (frontend/src/contexts/CartContext.tsx):
 *
 *   - tenderLegs[] becomes salePayload.tenders with normalized method codes
 *     and cent-rounded amounts; paymentMethodId falls back to the first leg.
 *   - A single leg (or none) keeps the legacy single-tender payload shape —
 *     no `tenders` key at all.
 *   - Any on_account leg without a selected customer aborts before createSale.
 *
 * The backend re-validates the leg sum against the sale total, so these tests
 * only assert the payload contract, not the arithmetic.
 */

const stableMocks = vi.hoisted(() => ({
  authUser: { id: 'user-1', tenantId: 'tenant-1', storeId: 'store-1' },
  offersData: [] as unknown[],
  refreshOffers: () => Promise.resolve(),
}));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: stableMocks.authUser, isLoading: false }),
}));

vi.mock('./TaxConfigContext', () => ({
  useTaxConfig: () => ({ taxConfig: null, pricesIncludeTax: false }),
}));

vi.mock('../hooks/usePromotionalOffersData', () => ({
  usePromotionalOffersData: () => ({
    data: stableMocks.offersData, isLoading: false, error: null, lastUpdated: null,
    refresh: stableMocks.refreshOffers,
  }),
}));

vi.mock('@/services/api', () => ({
  getTaxClasses: vi.fn(async () => []),
  getTaxClassRates: vi.fn(async () => []),
  getStoreTaxConfig: vi.fn(async () => ({})),
}));

vi.mock('@/services/jurisdictionService', () => ({
  getJurisdictionContext: vi.fn(async () => ({ zeroRated: false, isDutyFree: false, isExport: false })),
}));

const createSale = vi.fn();
vi.mock('@/services/salesService', () => ({
  createSale: (...args: unknown[]) => createSale(...args),
}));

const PRODUCT = { id: 'prod-1', name: 'Test Item', price: 100 } as any;
const CUSTOMER = { id: 'cust-1', name: 'Account Customer' } as any;

type Api = {
  checkout: (pmId: string, customerId?: string | null, legs?: CheckoutTenderLeg[]) => Promise<{ id: string } | null>;
  addToCart: (p: any, q?: number) => void;
  setSelectedCustomer: (c: any) => void;
};

let api: Api;

function Probe() {
  const cart = useCart();
  api = {
    checkout: cart.checkout,
    addToCart: cart.addToCart,
    setSelectedCustomer: cart.setSelectedCustomer,
  };
  return <div data-testid="count">{cart.items.length}</div>;
}

function renderCart() {
  return render(<CartProvider><Probe /></CartProvider>);
}

const lastPayload = () => createSale.mock.calls.at(-1)?.[0];

describe('CartContext — split tender', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(stableMocks.authUser));
    createSale.mockReset();
    createSale.mockResolvedValue({ saleId: 'sale-1' });
  });

  it('sends tenders[] with normalized codes and cent-rounded amounts', async () => {
    renderCart();
    await waitFor(() => expect(api).toBeTruthy());
    await act(async () => api.addToCart(PRODUCT, 1));

    const sale = await api.checkout('cash', null, [
      { methodId: 'cash', amount: 60.005 },
      { methodId: 'card', amount: 40 },
    ]);
    expect(sale?.id).toBe('sale-1');
    expect(createSale).toHaveBeenCalledTimes(1);
    const payload = lastPayload();
    expect(payload.tenders).toEqual([
      { method: 'cash', amount: 60.01 },
      { method: 'card', amount: 40 },
    ]);
    expect(payload.paymentMethodId).toBe('cash'); // first leg, not 'split'
  });

  it('omits tenders entirely for a normal single-method checkout', async () => {
    renderCart();
    await waitFor(() => expect(api).toBeTruthy());
    await act(async () => api.addToCart(PRODUCT, 1));

    await api.checkout('cash');
    const payload = lastPayload();
    expect(payload).not.toHaveProperty('tenders');
    expect(payload.paymentMethodId).toBe('cash');
  });

  it('treats a one-element legs array as a single tender', async () => {
    renderCart();
    await waitFor(() => expect(api).toBeTruthy());
    await act(async () => api.addToCart(PRODUCT, 1));

    await api.checkout('card', null, [{ methodId: 'card', amount: 50 }]);
    const payload = lastPayload();
    expect(payload).not.toHaveProperty('tenders');
  });

  it('rejects an on_account leg when no customer is selected', async () => {
    renderCart();
    await waitFor(() => expect(api).toBeTruthy());
    await act(async () => api.addToCart(PRODUCT, 1));

    const result = await api.checkout('cash', null, [
      { methodId: 'cash', amount: 60 },
      { methodId: 'on_account', amount: 40 },
    ]);
    expect(result).toBeNull();
    expect(createSale).not.toHaveBeenCalled();
  });

  it('allows an on_account leg when a customer is selected', async () => {
    renderCart();
    await waitFor(() => expect(api).toBeTruthy());
    await act(async () => {
      api.addToCart(PRODUCT, 1);
      api.setSelectedCustomer(CUSTOMER);
    });

    const sale = await api.checkout('cash', null, [
      { methodId: 'cash', amount: 60 },
      { methodId: 'on_account', amount: 40 },
    ]);
    expect(sale?.id).toBe('sale-1');
    const payload = lastPayload();
    expect(payload.tenders?.[1]).toEqual({ method: 'on_account', amount: 40 });
    expect(payload.customerId).toBe('cust-1');
  });
});
