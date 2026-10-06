import React, { ReactNode } from 'react';
import { StoreProvider } from './StoreContext';
import { LocalizationProvider } from './LocalizationContext';
import { InventoryProvider } from './InventoryContext';
import { RefreshProvider } from './RefreshContext';
import { TaxConfigProvider } from './TaxConfigContext';
import { CartProvider } from './CartContext';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeContext';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
    <QueryProvider>
      <StoreProvider>
        <LocalizationProvider>
          <InventoryProvider>
            <RefreshProvider>
              <TaxConfigProvider>
                <CartProvider>{children}</CartProvider>
              </TaxConfigProvider>
            </RefreshProvider>
          </InventoryProvider>
        </LocalizationProvider>
      </StoreProvider>
    </QueryProvider>
    </ThemeProvider>
  );
};
