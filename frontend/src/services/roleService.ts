import { fetchApi } from './api';

export interface Role {
  id: string;
  name: string;
  description?: string;
  scope: 'tenant' | 'store' | 'system';
  scopeId?: string; // Will be the tenant_id or store_id depending on scope
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
  isSystemRole?: boolean; // Indicates if this is a predefined system role
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  module: string; // Module/group the permission belongs to (e.g., 'dashboard', 'reports', 'products')
  created_at: string;
  updated_at: string;
  // Optional fields that might be present in the frontend
  category?: string; // For grouping in the UI
  assigned?: boolean; // Flag indicating if this permission is assigned to a role
}

export interface RoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  scope: 'tenant' | 'store';
  scopeId: string;
  roleName?: string; // May be included when joined with roles table
}

/**
 * Fetch all available roles for the current tenant/store context
 * @returns Promise resolving to array of roles
 */
export const fetchRoles = async (): Promise<Role[]> => {
  try {
    // Debug logging removed for cleaner console output
    // Make the API call with includePermissions parameter
    const response = await fetchApi<any>('/roles?includePermissions=true', {
      method: 'GET',
    });
    
    // Debug logging removed for cleaner console output
    
    // Handle empty response
    if (!response) {
      console.error('Roles API returned empty response');
      return [];
    }
    
    // Parse the roles from the response
    const parsedRoles = parseRolesResponse(response);
    // Debug logging removed for cleaner console output
    return parsedRoles;
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }
};

/**
 * Parse different role response formats into a consistent Role[] array
 * @export - made available for debug purposes
 */
export const parseRolesResponse = (response: any): Role[] => {
  // Debug logging removed for cleaner console output
  // Debug logging removed for cleaner console output
  
  // Check if response is a direct role object
  if (isRoleObject(response)) {
    // Debug logging removed for cleaner console output
    const role = convertToRole(response);
    return role ? [role] : [];
  }
  
  // Check if response has a roles property
  if (response && typeof response === 'object' && 'roles' in response) {
    // Debug logging removed for cleaner console output
    const roles = response.roles;
    
    // Case: roles is a direct role object
    if (isRoleObject(roles)) {
      // Debug logging removed for cleaner console output
      const role = convertToRole(roles);
      return role ? [role] : [];
    }
    
    // Case: roles is an array
    if (Array.isArray(roles)) {
      // Debug logging removed for cleaner console output
      const parsedRoles = roles
        .map(convertToRole)
        .filter((role): role is Role => role !== null);
      // Debug logging removed for cleaner console output
      return parsedRoles;
    }
    
    // Case: roles is an object mapping IDs to role data
    if (typeof roles === 'object' && roles !== null && !Array.isArray(roles)) {
      // Debug logging removed for cleaner console output
      return Object.values(roles)
        .map(convertToRole)
        .filter((role): role is Role => role !== null);
    }
  }
  
  // Case: response is an array of roles
  if (Array.isArray(response)) {
    // Debug logging removed for cleaner console output
    return response
      .map(convertToRole)
      .filter((role): role is Role => role !== null);
  }
  
  // No recognizable format found
  console.warn('Unrecognized roles response format:', response);
  return [];
};

/**
 * Type guard to check if an object is a valid role object
 */
const isRoleObject = (obj: any): obj is Partial<Role> => {
  return obj && 
    typeof obj === 'object' && 
    !Array.isArray(obj) && 
    'id' in obj && 
    'name' in obj;
};

/**
 * Convert any role-like object to a proper Role
 */
const convertToRole = (data: any): Role | null => {
  try {
    if (!data) {
      // Debug logging removed for cleaner console output
      return null;
    }
    
    // Debug logging removed for cleaner console output
    
    // Handle flat array format [id, tenant_id, name, description, isSystemRole, createdAt, updatedAt]
    if (Array.isArray(data) && data.length >= 7 && typeof data[0] === 'string' && typeof data[2] === 'string') {
      // Debug logging removed for cleaner console output
      return {
        id: String(data[0]),
        name: String(data[2]),
        description: data[3] != null ? String(data[3]) : undefined,
        scope: 'tenant' as const, // Default scope
        isSystemRole: Boolean(data[4]),
        createdAt: data[5] != null ? String(data[5]) : undefined,
        updatedAt: data[6] != null ? String(data[6]) : undefined,
        permissions: [],
      };
    }
    
    // Handle object format
    if (typeof data === 'object' && !Array.isArray(data) && 'id' in data && 'name' in data) {
      // Debug logging removed for cleaner console output
      return {
        id: String(data.id),
        name: String(data.name),
        description: data.description != null ? String(data.description) : undefined,
        scope: (data.scope || 'tenant') as Role['scope'],
        isSystemRole: Boolean(data.isSystemRole),
        createdAt: data.createdAt != null ? String(data.createdAt) : undefined,
        updatedAt: data.updatedAt != null ? String(data.updatedAt) : undefined,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error converting role data:', error, data);
    return null;
  }
};

/**
 * Fetch all available permissions that can be assigned to roles
 * @param roleId Optional roleId to fetch permissions for a specific role
 * @param isSystemRole Whether this is a system role (defaults to false for tenant roles)
 * @returns Promise resolving to array of permissions
 */
export const fetchPermissions = async (roleId?: string, isSystemRole = false): Promise<any[]> => {
  try {
    // Use the correct endpoint structure based on backend implementation
    let endpoint;
    let queryParams = '';
    
    if (roleId) {
      // When fetching for a specific role, we need to specify if it's a system role
      endpoint = `/roles/permissions/${roleId}`;
      queryParams = `?isSystemRole=${isSystemRole}`;
      // Debug logging removed for cleaner console output
    } else {
      // Use the correct production endpoint for fetching tenant permissions
      endpoint = '/permissions/tenant';
      // Debug logging removed for cleaner console output
    }
    
    const fullUrl = `${endpoint}${queryParams}`;
    // Debug logging removed for cleaner console output
    
    // Make the API call with explicit headers to ensure authentication
    const response = await fetchApi<any>(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Auth token should be automatically added by fetchApi
      },
    });
    
    // Handle different response formats
    if (!response) {
      console.warn('[DEBUG] Empty response from permissions API');
      return [];
    }
    
    // Debug logging removed for cleaner console output
    
    // If response is in the test endpoint format { success: true, permissions: [...] }
    if (response && typeof response === 'object' && 'success' in response && 'permissions' in response) {
      const permissions = response.permissions;
      if (Array.isArray(permissions)) {
        // Debug logging removed for cleaner console output
        return permissions;
      }
    }
    
    // If response is directly an array of permissions
    if (Array.isArray(response)) {
      // Debug logging removed for cleaner console output
      return response;
    }
    
    // If response contains a permissions property
    if (response && typeof response === 'object' && 'permissions' in response) {
      const permissions = response.permissions;
      if (Array.isArray(permissions)) {
        // Debug logging removed for cleaner console output
        return permissions;
      }
    }
    
    console.warn('[DEBUG] Unrecognized permissions response format:', response);
    return [];
  } catch (error) {
    console.error('[DEBUG] Error fetching permissions:', error);
    throw error;
  }
};

/**
 * Create a new role with specified permissions
 * @param roleData The role data to create
 * @returns Promise resolving to the created role
 */
export const createRole = async (roleData: Omit<Role, 'id'>): Promise<Role> => {
  try {
    // Prepare backend-compatible payload
    const permissionsArray = Array.isArray(roleData.permissions)
      ? Array.from(new Set(roleData.permissions.map((p: any) => (typeof p === 'string' ? p : p?.id).toString()).filter(Boolean)))
      : [];
    const payload: Record<string, unknown> = {
      name: roleData.name,
      description: roleData.description ?? '',
      permissions: permissionsArray,
      permissionIds: permissionsArray,
    };

    const response = await fetchApi<any>('/roles/tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    // Handle different response formats
    if (response && typeof response === 'object' && 'role' in response) {
      return response.role;
    }
    
    return response;
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
};

/**
 * Update an existing role
 * @param roleId ID of the role to update
 * @param roleData The role data to update
 * @returns Promise resolving to the updated role
 */
export const updateRole = async (roleId: string, roleData: Partial<Role>): Promise<Role> => {
  try {
    // Prepare backend-compatible payload
    const permissionsArray = Array.isArray(roleData.permissions)
      ? Array.from(new Set(roleData.permissions.map((p: any) => (typeof p === 'string' ? p : p?.id).toString()).filter(Boolean)))
      : undefined;
    const payload: Record<string, unknown> = {};
    if (typeof roleData.name === 'string') payload.name = roleData.name;
    if (typeof roleData.description === 'string') payload.description = roleData.description;
    if (permissionsArray) {
      payload.permissions = permissionsArray;
      payload.permissionIds = permissionsArray; // some backends expect permission_ids; api.ts converts to snake_case
    }

    const response = await fetchApi<any>(`/roles/tenant/${roleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
    });
    
    // Handle different response formats
    if (response && typeof response === 'object' && 'role' in response) {
      return response.role;
    }
    
    return response;
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
};

/**
 * Delete a role
 * @param roleId ID of the role to delete
 * @returns Promise resolving to a success message
 */
export const deleteRole = async (roleId: string): Promise<{ success: boolean }> => {
  try {
    const response = await fetchApi<{ success: boolean }>(`/roles/tenant/${roleId}`, {
      method: 'DELETE',
    });
    
    return response;
  } catch (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
};

/**
 * Assign roles to a user
 * @param userId User ID to assign roles to
 * @param roleIds Array of role IDs to assign
 * @returns Promise resolving to a success message
 */
export const assignRolesToUser = async (userId: string, roleIds: string[]): Promise<{success: boolean}> => {
  try {
    const response = await fetchApi<{success: boolean}>(`/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleIds }),
    });
    
    return response;
  } catch (error) {
    console.error('Error assigning roles to user:', error);
    throw error;
  }
};

/**
 * Get roles assigned to a user
 * @param userId User ID to get roles for
 * @returns Promise resolving to array of roles
 */
export const getUserRoles = async (userId: string): Promise<Role[]> => {
  try {
    const response = await fetchApi<any>(`/users/${userId}/roles`, {
      method: 'GET',
    });
    
    // Prefer roles property when present
    const raw = response && typeof response === 'object' && 'roles' in response ? (response as any).roles : response;
    
    // Normalize to array
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    
    // Robust normalization: support strings (role IDs) and objects, allow name fallback to id
    const normalized: Role[] = list
      .map((r: any) => {
        if (typeof r === 'string') {
          return { id: r, name: r, description: undefined, scope: 'tenant', permissions: [] } as Role;
        }
        // Support nested role objects: { role: { id, name, ... } }
        const nested = r?.role ?? r?.Role;
        const id = (nested?.id ?? nested?.roleId) ?? r?.id ?? r?.roleId ?? r?.role_id ?? r?.roleID;
        const name = (nested?.name ?? nested?.roleName ?? nested?.role_name) ?? r?.name ?? r?.roleName ?? r?.role_name ?? r?.display_name ?? r?.displayName ?? id;
        const finalId = id ?? name; // fallback to name as id when backend omits id
        if (!finalId) return null;
        return {
          id: String(finalId),
          name: String(name),
          description: r?.description != null ? String(r.description) : undefined,
          scope: (r?.scope || 'tenant') as Role['scope'],
          isSystemRole: Boolean(r?.isSystemRole ?? r?.is_system_role),
          createdAt: r?.createdAt ? String(r.createdAt) : undefined,
          updatedAt: r?.updatedAt ? String(r.updatedAt) : undefined,
          permissions: Array.isArray(r?.permissions) ? r.permissions : [],
        } as Role;
      })
      .filter((x: Role | null): x is Role => x !== null);
    
    return normalized;
  } catch (error) {
    console.error('🟡 ERROR - Error getting user roles:', error);
    throw error;
  }
};
