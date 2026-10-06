import React, { useState, useEffect } from 'react';
import { User } from '../../services/userService';
import { getUserRoles, fetchRoles, assignRolesToUser } from '../../services/roleService';
import { UserCheck, AlertCircle, Loader2, Shield, Users, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '../ui/badge';

// --- Types ---
interface RolesManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  // Optional callback to update only the affected row in parent
  onRolesSaved?: (userId: string, role: { id: string; name: string }) => void;
}

interface SimpleRoleState {
  id: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  isSelected: boolean;
  permissionCount: number;
  category: 'admin' | 'management' | 'sales' | 'other';
}

// Helper function to categorize roles
const categorizeRole = (roleName: string): 'admin' | 'management' | 'sales' | 'other' => {
  const name = roleName.toLowerCase();
  if (name.includes('admin') || name.includes('owner')) return 'admin';
  if (name.includes('manager') || name.includes('supervisor')) return 'management';
  if (name.includes('cashier') || name.includes('sales') || name.includes('clerk')) return 'sales';
  return 'other';
};

// Helper function to get category icon
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'admin': return <Shield className="h-4 w-4" />;
    case 'management': return <Users className="h-4 w-4" />;
    case 'sales': return <Settings className="h-4 w-4" />;
    default: return <UserCheck className="h-4 w-4" />;
  }
};

// Helper function to get category color
const getCategoryColor = (category: string) => {
  switch (category) {
    case 'admin': return 'bg-red-100 text-red-800 border-red-200';
    case 'management': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'sales': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground border-gray-200';
  }
};

// --- Component ---
const RolesManagementModal: React.FC<RolesManagementModalProps> = ({ open, onOpenChange, user, onRolesSaved }) => {
  const [roles, setRoles] = useState<SimpleRoleState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      loadRoles();
    } else {
      resetState();
    }
  }, [open, user]);

  const resetState = () => {
    setRoles([]);
    setError(null);
    setIsLoading(false);
    setIsSaving(false);
  };

  const loadRoles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allRoles, userRoles] = await Promise.all([
        fetchRoles(),
        user ? getUserRoles(user.id) : Promise.resolve([])
      ]);
      
      const userRoleIds = userRoles.map(r => r.id).filter(Boolean);
      const userRoleNames = userRoles.map(r => r.name).filter(Boolean);
      const userRoleNameSet = new Set(userRoleNames.map(n => String(n).toLowerCase().trim()));
      
      const processedRoles = allRoles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isSystemRole: role.isSystemRole || false,
        // Preselect if backend matched by id or only provided name (case-insensitive)
        isSelected: userRoleIds.includes(role.id) || userRoleNameSet.has(String(role.name).toLowerCase().trim()),
        permissionCount: role.permissions?.length || 0,
        category: categorizeRole(role.name)
      }));
      setRoles(processedRoles);
    } catch (err) {
      setError('Failed to load roles. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelect = (roleId: string) => {
    setRoles(prevRoles => 
      prevRoles.map(role => 
        role.id === roleId 
          ? { ...role, isSelected: true }
          : { ...role, isSelected: false }
      )
    );
  };

  const handleSaveRoles = async () => {
    if (!user) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      const selectedRole = roles.find(role => role.isSelected);
      const selectedRoleIds = selectedRole ? [selectedRole.id] : [];
      await assignRolesToUser(user.id, selectedRoleIds);
      onOpenChange(false);
      // Notify parent to update only this user's row (no full page refresh)
      if (user && selectedRole && onRolesSaved) {
        onRolesSaved(user.id, { id: selectedRole.id, name: selectedRole.name });
      }
    } catch (error) {
      console.error('🔴 SAVE FAILED:', error);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Group roles by category
  const groupedRoles = roles.reduce((acc, role) => {
    if (!acc[role.category]) {
      acc[role.category] = [];
    }
    acc[role.category].push(role);
    return acc;
  }, {} as Record<string, SimpleRoleState[]>);

  const categoryOrder = ['admin', 'management', 'sales', 'other'];
  const categoryLabels = {
    admin: 'Administrative Roles',
    management: 'Management Roles', 
    sales: 'Sales & Operations',
    other: 'Other Roles'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Manage User Roles {user?.name ? `- ${user.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            Select the roles you want to assign to this user. Each role comes with a predefined set of permissions.
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="bg-destructive/10 p-3 rounded-md flex items-start gap-2 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading roles...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {categoryOrder.map(category => {
                const categoryRoles = groupedRoles[category];
                if (!categoryRoles || categoryRoles.length === 0) return null;
                
                return (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      {getCategoryIcon(category)}
                      <h3 className="font-semibold text-lg">{categoryLabels[category as keyof typeof categoryLabels]}</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryRoles.map(role => (
                        <div 
                          key={role.id} 
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                            role.isSelected 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 dark:border-border bg-white dark:bg-card hover:border-gray-300'
                          }`}
                          onClick={() => handleRoleSelect(role.id)}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="userRole"
                              checked={role.isSelected}
                              onChange={() => handleRoleSelect(role.id)}
                              className="h-4 w-4 text-primary focus:ring-ring border-gray-300 dark:border-border"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-gray-900 dark:text-foreground">{role.name}</h4>
                                {role.isSystemRole && (
                                  <Badge variant="outline" className="text-xs">
                                    <Shield className="h-3 w-3 mr-1" />
                                    System
                                  </Badge>
                                )}
                              </div>
                              
                              <p className="text-sm text-gray-600 dark:text-muted-foreground mb-2">
                                {role.description || 'No description available'}
                              </p>
                              
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${getCategoryColor(role.category)}`}
                                >
                                  {role.permissionCount} permissions
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {Object.keys(groupedRoles).length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
                  <UserCheck className="h-12 w-12 text-gray-400 dark:text-muted-foreground mb-4" />
                  <p className="text-gray-500 dark:text-muted-foreground font-medium">No roles available</p>
                  <p className="text-sm text-gray-400 dark:text-muted-foreground">Contact your administrator to set up user roles.</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter className="pt-6 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-500 dark:text-muted-foreground">
              {roles.filter(r => r.isSelected).length} of {roles.length} roles selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={(e) => {
                  console.log('[MODAL DEBUG] Save button clicked, preventing defaults');
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isSaving && !isLoading) {
                    console.log('[MODAL DEBUG] Calling handleSaveRoles');
                    handleSaveRoles();
                  } else {
                    console.log('[MODAL DEBUG] Save button disabled, isSaving:', isSaving, 'isLoading:', isLoading);
                  }
                }} 
                disabled={isSaving || isLoading}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RolesManagementModal;
