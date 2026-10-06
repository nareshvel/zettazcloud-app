import { fetchApi } from './api';
import { debugLogUsers } from '../utils/debugLogger';

export interface UserRoleAssignment {
  roleName: string; // e.g., 'Tenant Admin', 'Store Manager', 'Cashier'
  scope: 'tenant' | 'store';
  scopeId?: string; // storeId if scope is 'store'
  scopeName?: string; // Optional: storeName if scope is 'store', for easier display
}

// Backend role structure that the API expects
export interface BackendRoleAssignment {
  id: string; // Role ID from database
  scope: 'tenant' | 'store';
  store_id?: string | null; // Store ID if scope is 'store'
  // Fallback fields for compatibility
  roleName?: string;
  scopeId?: string;
}

export type UserRoleType = 'tenant_admin' | 'manager' | 'cashier' | 'staff' | string; // Allow other strings for flexibility
export type UserStatusType = User['status'];

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  roles: UserRoleAssignment[] | BackendRoleAssignment[];
  roleNames?: string; // snake_case role_names from API gets converted to camelCase
  lastLogin?: string | null; // timestamp - converted from last_login
  createdAt?: string | null; // timestamp - converted from created_at
  updatedAt?: string | null; // timestamp - converted from updated_at
  status: 'active' | 'inactive' | 'invited' | 'pending';
  // User permissions
  permissions?: string[]; // Array of permission IDs the user has
  // Legacy properties - keeping for backward compatibility
  role_names?: string;
  last_login?: string | null; 
  lastLoginAt?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  statusReason?: string | null;
  username?: string | null;
  phoneNumber?: string | null;
  storeId?: string | null;
  primaryStoreId?: string | null; // For simplified form handling, actual store assignments are in roles
  tenantId: string; 
}

export interface FetchUsersParams {
  limit?: number;
  page?: number;
  searchTerm?: string;
  role?: string; // Role name or ID for filtering
  status?: 'active' | 'inactive' | 'pending' | 'invited';
  storeId?: string; // To fetch users for a specific store
  sortBy?: keyof User | string; // Allow string for custom sort keys from backend
  sortOrder?: 'asc' | 'desc';
}

export interface FetchUsersResponse {
  users: User[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
}

// Mock users removed as we're now using the live database

/**
 * Fetches a list of users from the live database.
 */
export const fetchUsers = async (params: FetchUsersParams = {}): Promise<FetchUsersResponse> => {
  debugLogUsers('Fetching users with params:', params);
  
  const queryParams = new URLSearchParams();
  // Backend expects limit and page (for offset calculation)
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.searchTerm) queryParams.append('search', params.searchTerm);
  if (params?.role) queryParams.append('role', params.role);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.storeId) queryParams.append('storeId', params.storeId);
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
  
  try {
    // The backend response has a different structure than what our frontend expects
    // Backend returns: { users: [{ id, username, email }], currentPage, totalPages, totalUsers }
    // But our frontend expects: { users: [{ id, name, email, status, roles, ... }], currentPage, totalPages, totalUsers }
    debugLogUsers('Making API request to: ', `/users?${queryParams.toString()}`);
    const response = await fetchApi<any>(`/users?${queryParams.toString()}`);
    debugLogUsers('API RESPONSE DATA:', response);
    
    if (response.users && response.users.length > 0) {
      // API response debug
      const firstUser = response.users[0];
      debugLogUsers('API RESPONSE - First user full object:', JSON.stringify(firstUser, null, 2));
      debugLogUsers('API RESPONSE - All properties:', Object.keys(firstUser));
      
      // Check if the automatic camelCase conversion happened
      debugLogUsers('lastLogin exists?', 'lastLogin' in firstUser);
      debugLogUsers('last_login exists?', 'last_login' in firstUser);
      
      // Check date values
      debugLogUsers('lastLogin value:', firstUser.lastLogin);
      debugLogUsers('last_login value:', firstUser.last_login);
    }
    
    // Transform the response to match our frontend's expected structure
    const transformedResponse: FetchUsersResponse = {
      users: response.users.map((user: any) => {
        
        // Convert legacy role to proper role assignment array
        let roleAssignments: UserRoleAssignment[] = [];
        
        // If backend sends proper role assignments, use them
        if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
          roleAssignments = user.roles.map((role: any) => ({
            roleName: role.name || '',
            scope: role.scope || 'tenant',
            scopeId: role.storeId || role.store_id || null,
            scopeName: role.storeName || role.store_name || null
          }));
        } 
        // Otherwise convert legacy role field to a role assignment
        else if (user.role) {
          // Transform the legacy role into the new format
          const roleName = user.role.charAt(0).toUpperCase() + user.role.slice(1);
          roleAssignments = [{
            roleName: roleName === 'Admin' ? 'Tenant Admin' : 
                     roleName === 'Manager' ? 'Store Manager' : 
                     'Cashier',
            scope: roleName === 'Admin' ? 'tenant' : 'store',
            scopeId: user.tenantId || '1',
            scopeName: roleName === 'Admin' ? 'Main Tenant' : 'Main Store'
          }];
        }
        
        
        const transformedUser = {
          id: user.id,
          email: user.email || user.username || '',
          name: user.name || user.username || '',
          username: user.username || null,
          status: user.status,
          roles: roleAssignments,
          // Role names can come in different formats from different API versions
          roleNames: user.roleNames || user.role_names || '',
          tenantId: user.tenantId || user.tenant_id || '',
          phoneNumber: user.phoneNumber || user.phone_number || null,
          storeId: user.storeId || user.store_id || null,
          primaryStoreId: user.primaryStoreId || user.primary_store_id || user.storeId || user.store_id || roleAssignments.find(role => role.scope === 'store')?.scopeId || null,
          // Login timestamps with fallbacks - don't fall back to updatedAt to avoid misleading info
          lastLogin: user.lastLogin || user.last_login || user.lastLoginAt || null,
          // Created and updated timestamps with fallbacks
          createdAt: user.createdAt || user.created_at || null,
          updatedAt: user.updatedAt || user.updated_at || null,
        };
        
        return transformedUser;
      }),
      totalUsers: response.totalUsers,
      totalPages: response.totalPages,
      currentPage: response.currentPage,
    };
    
    return transformedResponse;
  } catch (error) {
    console.error('Error fetching users from database:', error); // Keeping error logs for critical errors
    // Return an empty response structure to prevent UI crashes
    return {
      users: [],
      totalUsers: 0,
      totalPages: 1,
      currentPage: params.page || 1,
    };
  }
};

/**
 * Creates a new user in the live database.
 */
export const createUser = async (userData: Partial<User>): Promise<User> => {
  debugLogUsers('Creating user with data:', userData);

  if (!userData.email || !userData.name) {
    throw new Error('Email and Name are required to create a user.');
  }

  // Handle the simplified role case in the frontend
  const userDataToSend = { ...userData };
  
  // If a simple role property exists (from a simplified form)
  const simpleRole = (userData as any).role as UserRoleType;
  const simpleStoreId = userData.primaryStoreId;
  
  if (simpleRole && (!userData.roles || userData.roles.length === 0)) {
    // simpleRole is now a role ID directly from the form
    const backendRole: BackendRoleAssignment = {
      id: simpleRole, // simpleRole is now the role ID directly
      scope: simpleStoreId ? 'store' : 'tenant',
      store_id: simpleStoreId || null
    };
    userDataToSend.roles = [backendRole];
  }
  userDataToSend.storeId = simpleStoreId || null;
  
  // Remove the simplified fields that backend doesn't expect
  delete (userDataToSend as any).role;
  delete userDataToSend.primaryStoreId;
  
  debugLogUsers('Final user data to send to backend (createUser):', userDataToSend);

  try {
    const newUser = await fetchApi<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userDataToSend)
    });
    return newUser;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error; // Rethrow to allow the UI to handle the error
  }
};

/**
 * Updates an existing user in the live database.
 */
export const updateUser = async (userId: string, userData: Partial<User>): Promise<User> => {
  debugLogUsers(`Updating user ${userId} with data:`, userData);

  // Handle the simplified role case in the frontend
  const userDataToSend = { ...userData };
  
  // Similar to createUser, handle simplified role/storeId from form if present
  const simpleRole = (userData as any).role as UserRoleType;
  const simpleStoreId = userData.primaryStoreId;
  
  if (simpleRole && (!userData.roles || userData.roles.length === 0)) {
    // simpleRole is now a role ID directly from the form
    const backendRole: BackendRoleAssignment = {
      id: simpleRole, // simpleRole is now the role ID directly
      scope: simpleStoreId ? 'store' : 'tenant',
      store_id: simpleStoreId || null
    };
    userDataToSend.roles = [backendRole];
  }
  userDataToSend.storeId = simpleStoreId || null;
  
  // Remove the simplified fields that backend doesn't expect
  delete (userDataToSend as any).role;
  delete userDataToSend.primaryStoreId;
  
  debugLogUsers('Final user data to send to backend:', userDataToSend);
  
  try {
    // Use the real API endpoint
    const updatedUser = await fetchApi<User>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userDataToSend)
    });
    
    debugLogUsers('User update successful:', updatedUser);
    return updatedUser;
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    throw error; // Rethrow to allow the UI to handle the error
  }
};

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/**
 * Calls the API to change the user's password.
 * NOTE: This already uses the real API endpoint.
 */
export const changePassword = async (payload: ChangePasswordPayload): Promise<{ message: string }> => {
  try {
    const response = await fetchApi<{ message: string }>('/users/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return response;
  } catch (error) {
    console.error('Error changing password:', error);
    // Re-throw the error to be caught by the calling function (e.g., in the component)
    // This allows the component to display specific error messages from the API
    throw error;
  }
};

/**
 * Updates a user's active status (activate or deactivate)
 * @param userId ID of the user to update
 * @param isActive Boolean indicating whether to activate (true) or deactivate (false) the user
 * @returns Promise with message on successful update
 */
export const updateUserStatus = async (userId: string, isActive: boolean): Promise<{ message: string }> => {
  try {
    // The backend expects is_active as a field in the payload
    const response = await fetchApi<{ message: string }>(`/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_active: isActive }),
    });
    
    return response;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
}

/**
 * Permanently deletes a user from the system
 * @param userId ID of the user to delete
 * @returns Promise with message confirming deletion
 */
export const deleteUser = async (userId: string): Promise<{ message: string, id: string }> => {
  try {
    const response = await fetchApi<{ message: string, id: string }>(`/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Resend invitation email to user
 * @param userId ID of the user to resend invitation to
 * @returns Promise with message confirming email sent
 */
export const resendInvitation = async (userId: string): Promise<{ message: string }> => {
  try {
    const response = await fetchApi<{ message: string }>(`/users/${userId}/resend-invitation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response;
  } catch (error) {
    console.error('Error resending invitation:', error);
    throw error;
  }
};
