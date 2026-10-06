import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Product, Category } from '@/types';
import { 
  getProducts, 
  getCategories, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  updateProductStockLevel
} from '../services/inventoryService';

interface InventoryContextType {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  isInventoryLoaded: boolean;
  error: string | null;
  refreshProducts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  fetchInventoryData: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  editProduct: (id: string, productData: Partial<Product>) => Promise<Product>;
  removeProduct: (id: string) => Promise<void>;
  updateProductStock: (id: string, quantityChange: number) => Promise<void>;
  getLowStockProducts: () => Product[];
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

interface InventoryProviderProps {
  children: ReactNode;
}

export const InventoryProvider = ({ children }: InventoryProviderProps) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInventoryLoaded, setIsInventoryLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTenantId, setCurrentTenantId] = useState<string | undefined>(user?.tenantId || undefined);
  
  // Reset inventory state when user or tenant changes
  useEffect(() => {
    // If user is null (logged out) or tenant has changed, reset inventory state
    if (!user || user.tenantId !== currentTenantId) {
      setProducts([]);
      setCategories([]);
      setIsInventoryLoaded(false);
      setCurrentTenantId(user?.tenantId || undefined);
      // Removed console.log to reduce console clutter
    }
  }, [user, currentTenantId]);

  const refreshProducts = async () => {
    try {
      // Pass the tenant_id to ensure proper tenant isolation
      // Ensure tenantId is either a string or undefined, not null
      const tenantId = user?.tenantId || undefined;
      const data = await getProducts({
        tenant_id: tenantId
      });
      setProducts(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const refreshCategories = async () => {
    try {
      const data = await getCategories('active'); // Fetch only active categories for inventory operations
      setCategories(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const fetchInventoryData = async () => {
    if (isInventoryLoaded) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([refreshProducts(), refreshCategories()]);
      setIsInventoryLoaded(true);
    } catch (err) {
      console.error('Failed to fetch inventory data:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const forceRefresh = useCallback(async () => {
    setIsInventoryLoaded(false);
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([refreshProducts(), refreshCategories()]);
      setIsInventoryLoaded(true);
    } catch (err) {
      console.error('Failed to force refresh inventory data:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [refreshProducts, refreshCategories]);

  // Listen for inventory update events (e.g., from product import)
  useEffect(() => {
    const handleInventoryUpdate = () => {
      if (isInventoryLoaded) {
        forceRefresh();
      }
    };

    window.addEventListener('inventoryUpdated', handleInventoryUpdate);
    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
    };
  }, [isInventoryLoaded, forceRefresh]);

  const addProduct = async (productData: Omit<Product, 'id'>) => {
    try {
      // Use the correct type as defined in inventoryService.ts
      const newProduct = await createProduct(productData as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>);
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const editProduct = async (id: string, productData: Partial<Product>) => {
    try {
      // Use the correct type as defined in inventoryService.ts
      const updatedProduct = await updateProduct(id, productData as Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>);
      setProducts(prev => 
        prev.map(product => 
          product.id === id ? { ...product, ...updatedProduct } : product
        )
      );
      return updatedProduct;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const removeProduct = async (id: string) => {
    try {
      await deleteProduct(id);
      setProducts(prev => prev.filter(product => product.id !== id));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const updateProductStock = async (id: string, quantityChange: number) => {
    const productToUpdate = products.find(p => p.id === id);

    if (!productToUpdate) {
      // If inventory isn't loaded yet, skip the stock update gracefully
      // The stock will be correct when inventory is next refreshed from the server
      console.warn(`Product with id ${id} not found in local inventory state. Skipping local stock update.`);
      return; // Don't throw error, just skip the local update
    }

    const newStockLevel = productToUpdate.stockQuantity + quantityChange;

    try {
      await updateProductStockLevel(id, newStockLevel);
      // Update the stock quantity directly since the API doesn't return the updated product
      setProducts(prev => 
        prev.map(product => 
          product.id === id 
            ? { ...product, stockQuantity: newStockLevel }
            : product
        )
      );
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const getLowStockProducts = () => {
    return products.filter(product => product.stockQuantity < 10);
  };

  const value = {
    products,
    categories,
    isLoading,
    isInventoryLoaded,
    error,
    refreshProducts,
    refreshCategories,
    fetchInventoryData,
    forceRefresh,
    addProduct,
    editProduct,
    removeProduct,
    updateProductStock,
    getLowStockProducts
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};