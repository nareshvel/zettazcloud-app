import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { CartProvider, useCart } from './CartContext';

/**
 * Covers the Sales Hub duty-free wiring added to CartContext.tsx
 * (docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md, Option A):
 *
 *   - `travellerContext` starts null, is set by the Duty-Free intake form,
 *     and is cleared by `clearCart()` so it never leaks into the next sale.
 *   - `isDutyFreeStore` reflects the jurisdiction lookup (`getJurisdictionContext`)
 *     and fails open to `false` if that lookup rejects — a jurisdiction
 *     problem must never be the reason a normal sale looks duty-free, or the
 *     reason a cashier can't ring one up at all.
 *
 * Every dependency CartContext pulls in (auth, tax config, promotional
 * offers, tax-class API calls) is mocked so this exercises only the
 * duty-free/traveller behaviour, not the rest of the cart's arithmetic.
 */

// Stable references (vi.hoisted so they exist before the vi.mock factories
// below run, which are themselves hoisted above these imports). Returning a
// fresh object/array/function on every render would change identity on every
// call and re-trigger any effect keyed on it — turning a one-shot fetch
// effect into an infinite render loop.
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

const getJurisdictionContext = vi.fn();
vi.mock('@/services/jurisdictionService', () => ({
  getJurisdictionContext: (...args: unknown[]) => getJurisdictionContext(...args),
}));

vi.mock('@/services/salesService', () => ({
  createSale: vi.fn(),
}));

/** Minimal consumer exposing just what these tests need to assert on/drive. */
function TestConsumer() {
  const { travellerContext, setTravellerContext, isDutyFreeStore, clearCart } = useCart();
  return (
    <div>
      <div data-testid="duty-free">{String(isDutyFreeStore)}</div>
      <div data-testid="traveller">{travellerContext ? JSON.stringify(travellerContext) : 'none'}</div>
      <button
        onClick={() =>
          setTravellerContext({
            travellerIdType: 'passport',
            travellerIdNumber: 'N1234567',
            travelMethodType: 'flight',
            travelMethodRef: 'AA123',
          })
        }
      >
        set-traveller
      </button>
      <button onClick={() => clearCart()}>clear-cart</button>
    </div>
  );
}

function renderCart() {
  return render(
    <CartProvider>
      <TestConsumer />
    </CartProvider>
  );
}

describe('CartContext — duty-free traveller capture', () => {
  beforeEach(() => {
    getJurisdictionContext.mockReset();
    getJurisdictionContext.mockResolvedValue({ zeroRated: false, isDutyFree: false, isExport: false });
  });

  it('starts with no traveller context', async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId('duty-free')).toHaveTextContent('false'));
    expect(screen.getByTestId('traveller')).toHaveTextContent('none');
  });

  it('setTravellerContext makes the captured data available to the cart', async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId('duty-free')).toHaveTextContent('false'));

    fireEvent.click(screen.getByText('set-traveller'));

    await waitFor(() => {
      const text = screen.getByTestId('traveller').textContent || '';
      expect(text).toContain('N1234567');
      expect(text).toContain('passport');
      expect(text).toContain('AA123');
    });
  });

  it('clearCart resets travellerContext so it never leaks into the next sale', async () => {
    renderCart();
    await waitFor(() => expect(screen.getByTestId('duty-free')).toHaveTextContent('false'));

    fireEvent.click(screen.getByText('set-traveller'));
    await waitFor(() => expect(screen.getByTestId('traveller')).not.toHaveTextContent('none'));

    fireEvent.click(screen.getByText('clear-cart'));
    await waitFor(() => expect(screen.getByTestId('traveller')).toHaveTextContent('none'));
  });
});

describe('CartContext — isDutyFreeStore', () => {
  beforeEach(() => {
    getJurisdictionContext.mockReset();
  });

  it('reflects a duty-free store', async () => {
    getJurisdictionContext.mockResolvedValue({ zeroRated: true, isDutyFree: true, isExport: false });
    renderCart();
    await waitFor(() => expect(screen.getByTestId('duty-free')).toHaveTextContent('true'));
  });

  it('reflects an export store', async () => {
    getJurisdictionContext.mockResolvedValue({ zeroRated: true, isDutyFree: false, isExport: true });
    renderCart();
    await waitFor(() => expect(screen.getByTestId('duty-free')).toHaveTextContent('true'));
  });

  it('is false for a domestic store', async () => {
    getJurisdictionContext.mockResolvedValue({ zeroRated: false, isDutyFree: false, isExport: false });
    renderCart();
    await waitFor(() => expect(screen.getByTestId('duty-free')).toHaveTextContent('false'));
  });

  it('fails open to false when the jurisdiction lookup rejects', async () => {
    getJurisdictionContext.mockRejectedValue(new Error('network down'));
    renderCart();
    await waitFor(() => expect(screen.getByTestId('duty-free')).toHaveTextContent('false'));
  });
});
