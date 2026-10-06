import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getCategories as fetchCategoriesAPI } from '@/services/api'; 
import axiosInstance from '@/services/axiosConfig';
import toast from 'react-hot-toast'; 
import { Edit3, Trash2, AlertTriangle as WarningIcon, CheckCircle as SuccessIcon, PlusCircle, ImageUp, RotateCcw } from 'lucide-react'; 
import type { Category as FrontendCategoryType } from '@/types'; 
import ModalBase from '@/components/ui/ModalBase'; 
import { Button } from '@/components/ui/button';

// Define a generic type for structured API responses from POST/PUT/PATCH etc.
interface ServiceResponse<T = any> {
  status: 'success' | 'error' | string; 
  data?: T;
  message?: string;
  [key: string]: any; // Allow other properties
}

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated: (newlySelectedCategoryId?: string) => void; 
}

const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  onCategoriesUpdated 
}) => {
  const [categories, setCategories] = useState<FrontendCategoryType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilterStatus, setCategoryFilterStatus] = useState<'active' | 'inactive' | 'all'>('active');

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentCategory, setCurrentCategory] = useState<FrontendCategoryType | null>(null);
  
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const categoryFormRef = useRef<HTMLFormElement>(null); 

  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172/api').replace(/\/$/, '');
  const SERVER_BASE_URL = API_BASE_URL.replace('/api', ''); // For serving static files like images

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const categoriesData: FrontendCategoryType[] = await fetchCategoriesAPI(categoryFilterStatus);
      setCategories(categoriesData); 
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      const errMsg = err.response?.data?.message || err.message || 'An unexpected error occurred while fetching categories.';
      setError(errMsg);
      toast.error(errMsg);
      setCategories([]); 
    }
    setIsLoading(false);
  }, [categoryFilterStatus]); 

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (!isEditing) {
        setCurrentCategory(null);
        setCategoryName('');
        setCategoryDescription('');
        setSelectedImageFile(null);
        if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(imagePreviewUrl);
        }
        setImagePreviewUrl(null);
        setError(null);
      }
    } else {
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null); 
      }
    }
  }, [isOpen, isEditing, fetchCategories]); 

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedImageFile(file);
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl); 
      }
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedImageFile(null);
      if (isEditing && currentCategory?.imageUrl) {
        const imagePath = currentCategory.imageUrl.startsWith('/') ? currentCategory.imageUrl : `/${currentCategory.imageUrl}`;
        setImagePreviewUrl(`${SERVER_BASE_URL}${imagePath}`);
      } else {
        if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(imagePreviewUrl);
        }
        setImagePreviewUrl(null);
      }
    }
  };

  const triggerImageUpload = () => {
    imageInputRef.current?.click();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData();
    formData.append('name', categoryName.trim());
    if (categoryDescription.trim()) {
      formData.append('description', categoryDescription.trim());
    }

    if (selectedImageFile) {
      formData.append('image', selectedImageFile); 
    } else if (isEditing && currentCategory && !imagePreviewUrl && currentCategory.imageUrl) {
      formData.append('image_url', ''); 
    }

    try {
      let createdOrUpdatedCategory: FrontendCategoryType | null = null;
      if (isEditing && currentCategory?.id) {
        const response = await axiosInstance.put<ServiceResponse<FrontendCategoryType>>(`/api/categories/${currentCategory.id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        createdOrUpdatedCategory = response.data.data ?? null; 
        toast.success('Category updated successfully!');
      } else {
        const response = await axiosInstance.post<ServiceResponse<FrontendCategoryType>>(`/api/categories`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        createdOrUpdatedCategory = response.data.data ?? null; 
        toast.success('Category created successfully!');
      }

      if (createdOrUpdatedCategory) {
        fetchCategories(); 
        onCategoriesUpdated(createdOrUpdatedCategory?.id); 
        setIsEditing(false);
        setCurrentCategory(null);
        setCategoryName('');
        setCategoryDescription('');
        setSelectedImageFile(null); 
        if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) { 
          URL.revokeObjectURL(imagePreviewUrl); 
        }
        setImagePreviewUrl(null); 
      }
    } catch (err: any) {
      console.error('Error saving category:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save category.';
      setError(errMsg);
      toast.error(errMsg);
    }
    setIsLoading(false);
  };

  const handleEdit = (category: FrontendCategoryType) => {
    setIsEditing(true);
    setCurrentCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || '');
    setSelectedImageFile(null); 
    
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (category.imageUrl) {
      const imagePath = category.imageUrl.startsWith('http') || category.imageUrl.startsWith('/') 
        ? category.imageUrl 
        : `${SERVER_BASE_URL}/${category.imageUrl.startsWith('/') ? category.imageUrl.substring(1) : category.imageUrl}`;
      setImagePreviewUrl(imagePath);
    } else {
      setImagePreviewUrl(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setCurrentCategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setSelectedImageFile(null);
    if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl); 
    }
    setImagePreviewUrl(null);
    setError(null); 
  };

  const handleToggleActive = async (categoryId: string, currentActiveState: boolean) => {
    setIsLoading(true);
    const newActiveState = !currentActiveState;
    try {
      await axiosInstance.put(`/api/categories/${categoryId}`, { is_active: newActiveState });
      toast.success(`Category ${newActiveState ? 'activated' : 'deactivated'} successfully!`);
      fetchCategories();
      onCategoriesUpdated();
    } catch (err: any) {
      console.error(`Error ${newActiveState ? 'activating' : 'deactivating'} category:`, err);
      const errMsg = err.response?.data?.message || err.message || `Failed to ${newActiveState ? 'activate' : 'deactivate'} category.`;
      setError(errMsg);
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'}
          max-w-md w-full bg-white dark:bg-card shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <WarningIcon className="h-10 w-10 text-red-500" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-foreground">
                  Operation Failed
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-muted-foreground">
                  {errMsg}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200 dark:border-border">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      ));
    } finally {
      setIsLoading(false);
    }
    setIsLoading(false);
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    const promise = () => new Promise<string>(async (resolve, reject) => {
      setIsLoading(true);
      try {
        await axiosInstance.delete(`/api/categories/${categoryId}`);
        // Successful deletion
        fetchCategories();
        onCategoriesUpdated();
        // If the deleted category was being edited, reset the form
        if (isEditing && currentCategory?.id === categoryId) {
          setIsEditing(false);
          setCurrentCategory(null);
          setCategoryName('');
          setCategoryDescription('');
          setSelectedImageFile(null);
          if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreviewUrl);
          }
          setImagePreviewUrl(null);
        }
        resolve(`Category "${categoryName}" deleted successfully!`);
      } catch (err: any) {
        const status = err.response?.status;
        const backendMessage = err.response?.data?.message;
        let errMsg = backendMessage || err.message || `Failed to delete category.`;

        // Provide more user-friendly error messages based on status codes
        if (status === 400) {
          // Bad Request - usually validation errors
          if (backendMessage?.includes('must be inactive')) {
            errMsg = `Cannot delete active category "${categoryName}". Please deactivate it first, then try deleting again.`;
          } else if (backendMessage?.includes('associated with')) {
            errMsg = `Cannot delete "${categoryName}" because it has products assigned to it. Please reassign or remove the products first.`;
          } else {
            errMsg = backendMessage || `Cannot delete "${categoryName}". Please check the category status and try again.`;
          }
        } else if (status === 404) {
          errMsg = `Category "${categoryName}" not found or you don't have permission to delete it.`;
        } else if (status === 403) {
          errMsg = `You don't have permission to delete categories.`;
        } else if (status >= 500) {
          errMsg = `Server error occurred while deleting "${categoryName}". Please try again later.`;
        }

        // Only log to console for unexpected errors (not user validation errors)
        if (status === 400 && backendMessage) {
          // User validation error - no need to log to console, just show user-friendly message
        } else if (status >= 500 || !status) {
          // Server errors or network errors - log for debugging
          console.error(`Error deleting category "${categoryName}":`, err);
        }
        
        reject(errMsg); // Reject promise for toast.promise error handling
      } finally {
        setIsLoading(false);
      }
    });

    toast.custom((t) => (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-30 backdrop-blur-sm">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-full bg-white dark:bg-card shadow-xl rounded-lg pointer-events-auto flex flex-col ring-1 ring-gray-900/10">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-border">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <WarningIcon className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-lg font-semibold text-gray-900 dark:text-foreground">Confirm Deletion</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            <p className="text-sm text-gray-700 dark:text-foreground">
              Are you sure you want to delete the category <span className="font-semibold">"{categoryName}"</span>? This action cannot be undone.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end space-x-3 p-4 bg-gray-50 dark:bg-muted/50 border-t border-gray-200 dark:border-border rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              className="px-4 py-2"
              onClick={() => toast.dismiss(t.id)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="px-4 py-2"
              onClick={() => {
                toast.dismiss(t.id);
                toast.promise(promise(), {
                  loading: 'Deleting category...', 
                  success: (message: string) => message,
                  error: (errMsg: string) => `Deletion Failed: ${errMsg}`,
                });
              }}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </div>
    ), { duration: Infinity, id: `delete-confirm-${categoryId}` }); // Keep toast open & give unique ID
  };

  const modalTitle = isEditing && currentCategory 
    ? `Edit Category: ${currentCategory.name}` 
    : isEditing 
    ? 'Add New Category' 
    : 'Manage Categories';

  const modalFooterContent = isEditing ? (
    <>
      <Button variant="outline" onClick={handleCancelEdit} disabled={isLoading}>
        <RotateCcw size={16} className="mr-2" />Cancel
      </Button>
      <Button type="submit" form="category-form" disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
        <SuccessIcon size={16} className="mr-2" />Save Category
      </Button>
    </>
  ) : (
    <Button variant="outline" onClick={onClose}>
      Close
    </Button>
  );

  return (
    <ModalBase 
      isOpen={isOpen} 
      onClose={onClose} 
      title={modalTitle} 
      footerContent={modalFooterContent}
      size="4xl" 
    >
      <div className="p-1">
        {error && !isEditing && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
            <WarningIcon size={20} className="mr-2" /> 
            <span>{error}</span>
          </div>
        )}

        {isEditing ? (
          <form ref={categoryFormRef} id="category-form" onSubmit={handleFormSubmit} className="space-y-4">
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
                <WarningIcon size={20} className="mr-2" /> 
                <span>{error}</span>
              </div>
            )}
            <div>
              <label htmlFor="categoryName" className="block text-sm font-medium text-gray-700 dark:text-foreground dark:text-gray-300">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-border dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                placeholder="e.g., Electronics"
              />
            </div>
            <div>
              <label htmlFor="categoryDescription" className="block text-sm font-medium text-gray-700 dark:text-foreground dark:text-gray-300">
                Description (Optional)
              </label>
              <textarea
                id="categoryDescription"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-border dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                placeholder="Brief description of the category"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground dark:text-gray-300">Category Image (Optional)</label>
              <div className="mt-2 flex items-center space-x-4">
                <div 
                  className="w-24 h-24 rounded-md border border-gray-300 dark:border-border dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-muted/50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:bg-muted dark:hover:bg-gray-600 transition-colors"
                  onClick={triggerImageUpload}
                  title="Click to upload or change image"
                >
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="Category Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-muted-foreground dark:text-gray-500 dark:text-muted-foreground">
                      <ImageUp size={20} className="mb-2" />
                      <span className="text-xs font-medium text-center">Click to Upload</span>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/gif, image/webp"
                  onChange={handleImageChange} 
                  ref={imageInputRef} 
                  className="hidden" 
                />
                <div className="flex flex-col space-y-1">
                  <Button type="button" variant="outline" onClick={triggerImageUpload} size="sm">
                    <ImageUp size={16} className="mr-2" /> Upload Image
                  </Button>
                  {imagePreviewUrl && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => {
                        setSelectedImageFile(null);
                        if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
                          URL.revokeObjectURL(imagePreviewUrl);
                        }
                        setImagePreviewUrl(null);
                        if (imageInputRef.current) imageInputRef.current.value = ''; 
                      }}
                    >
                      <Trash2 size={16} className="mr-2" /> Remove Image
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground dark:text-gray-400 dark:text-muted-foreground">Max file size: 2MB. Allowed types: JPG, PNG, GIF, WEBP.</p>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                {(['active', 'inactive', 'all'] as const).map(status => (
                  <Button
                    key={status}
                    variant={categoryFilterStatus === status ? 'default' : 'outline'}
                    onClick={() => setCategoryFilterStatus(status)}
                    size="sm"
                    className={`${categoryFilterStatus === status ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
              <Button onClick={() => { setIsEditing(true); setCurrentCategory(null); setCategoryName(''); setCategoryDescription(''); setImagePreviewUrl(null); setSelectedImageFile(null); setError(null); }} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle size={16} className="mr-2" /> Add Category
              </Button>
            </div>

            {isLoading && !categories.length ? (
              <div className="text-center py-4 text-gray-500 dark:text-muted-foreground dark:text-gray-400 dark:text-muted-foreground">Loading categories...</div>
            ) : !isLoading && !categories.length && !error ? (
              <div className="text-center py-4 text-gray-500 dark:text-muted-foreground dark:text-gray-400 dark:text-muted-foreground">No categories found for this filter.</div>
            ) : categories.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-muted/50 dark:bg-gray-800">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground dark:text-gray-300 uppercase tracking-wider w-16">Image</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground dark:text-gray-300 uppercase tracking-wider">Name</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground dark:text-gray-300 uppercase tracking-wider">Description</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-muted-foreground dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-card dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {categories.map((category) => (
                      <tr key={category.id} className={`${!category.isActive ? 'bg-gray-50 dark:bg-muted/50 dark:bg-gray-800/50 opacity-70' : ''}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="w-12 h-12 rounded-md border border-gray-200 dark:border-border dark:border-gray-700 flex items-center justify-center overflow-hidden bg-gray-100 dark:bg-muted dark:bg-gray-700">
                            {category.imageUrl ? (
                              <img 
                                src={category.imageUrl.startsWith('http') || category.imageUrl.startsWith('/') ? category.imageUrl : `${SERVER_BASE_URL}/${category.imageUrl.startsWith('/') ? category.imageUrl.substring(1) : category.imageUrl}`}
                                alt={category.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Replace broken image with placeholder
                                  const target = e.target as HTMLImageElement;
                                  target.outerHTML = `<div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-muted dark:bg-gray-600"><span class="text-xs text-gray-400 dark:text-muted-foreground dark:text-gray-300">No Image</span></div>`;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-muted dark:bg-gray-600">
                                <span className="text-xs text-gray-400 dark:text-muted-foreground dark:text-gray-300">No Image</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-foreground dark:text-white">{category.name}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-muted-foreground dark:text-gray-400 dark:text-muted-foreground max-w-xs truncate">
                          {category.description || <span className="italic text-gray-400 dark:text-muted-foreground dark:text-gray-500 dark:text-muted-foreground">No description</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${category.isActive ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'}`}>
                            {category.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(category)} title="Edit Category" className="text-primary hover:text-primary/80 dark:text-blue-400 dark:hover:text-blue-300">
                            <Edit3 size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleToggleActive(category.id, !!category.isActive)}
                            title={category.isActive ? 'Deactivate Category' : 'Activate Category'}
                            className={`${category.isActive ? 'text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300' : 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300'}`}
                          >
                            {category.isActive ? <WarningIcon size={16} /> : <SuccessIcon size={16} />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            title="Delete Category"
                            disabled={category.isActive || (typeof category.product_count === 'number' && category.product_count > 0)}
                            className={`text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ${category.isActive || (typeof category.product_count === 'number' && category.product_count > 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </ModalBase>
  );
};

export default CategoryManagementModal;
