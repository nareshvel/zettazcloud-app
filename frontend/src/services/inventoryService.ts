import { Product, Category } from '@/types';
import {
  getProducts as fetchAllProducts,
  deleteProduct as deleteProductFromService,
  updateProductStockLevel as updateProductStockLevelInService
} from './productService';
import * as api from './api';

const API_BASE = '/products';

// Get all products
export const getProducts = async (params?: { tenant_id?: string, store_id?: string }): Promise<Product[]> => {
  return await fetchAllProducts(params); 
};

// Get all categories
export const getCategories = async (status?: 'active' | 'inactive' | 'all'): Promise<Category[]> => {
  return await api.getCategories(status);
};

// Create a new product
export const createProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
  return await api.fetchApi<Product>(`${API_BASE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });
};

// Check if product with SKU exists
export const getProductBySku = async (sku: string): Promise<Product | null> => {
  try {
    const products = await getProducts();
    const product = products.find(p => p.sku === sku);
    return product || null;
  } catch (error) {
    console.error('Error checking product by SKU:', error);
    return null;
  }
};

// Update an existing product
export const updateProduct = async (id: string, productData: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Product> => {
  return await api.fetchApi<Product>(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });
};

// Delete a product
export const deleteProduct = async (id: string): Promise<void> => {
  await deleteProductFromService(id); 
};

// Update product stock level
export const updateProductStockLevel = async (id: string, newStockLevel: number): Promise<void> => {
  await updateProductStockLevelInService(id, newStockLevel); 
};

// Create a new category
export const createCategory = async (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> => {
  return await api.fetchApi<Category>('/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(categoryData),
  });
};

// Update an existing category
export const updateCategory = async (id: string, categoryData: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Category> => {
  return await api.fetchApi<Category>(`/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(categoryData),
  });
};