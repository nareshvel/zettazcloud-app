import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface RefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export const RefreshProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
    // console.log('Refresh triggered, new key:', refreshKey + 1);
  }, [refreshKey]); // Include refreshKey in dependencies for correctness, though not strictly necessary for this increment logic

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = (): RefreshContextType => {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
};
