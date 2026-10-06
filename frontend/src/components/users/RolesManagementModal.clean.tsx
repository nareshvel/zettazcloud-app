import React, { useState, useEffect } from 'react';
import { User } from '../../services/userService';
import { Role, Permission, assignRolesToUser, getUserRoles, fetchRoles } from '../../services/roleService';
import { UserCheck, AlertCircle, Loader2, Shield, Info, ChevronRight, ChevronDown, Search, Filter } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/use-toast';
import { fetchApi } from '../../services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// --- Types ---
interface RolesManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onRolesUpdated?: () => void;
}

interface PermissionWithAssignmentState extends Permission {
  assigned: boolean;
}

interface PermissionResponse {
  permissions: PermissionWithAssignmentState[];
}

enum FilterType {
  ALL = 'all',
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned'
}

interface RoleUIState extends Omit<Role, 'permissions'> {
  isExpanded: boolean;
  isSelected: boolean;
  rolePermissions?: string[]; // Original permissions from Role
  permissions: PermissionUIState[]; // UI state permissions
  isLoadingPermissions: boolean;
  hasLoadedPermissions: boolean;
  permissionError: string | null;
}

interface PermissionUIState extends Permission {
  isAssigned: boolean;
  isToggling: boolean;
}

// --- Component ---
const RolesManagementModal: React.FC<RolesManagementModalProps> = ({ open, onOpenChange, user, onRolesUpdated }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleUIState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoleIds, setExpandedRoleIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>(FilterType.ALL);

  useEffect(() => {
    if (open && user) {
      loadRoles();
    } else {
      resetState();
    }
  }, [open, user]);

  const resetState = () => {
    setRoles([]);
    setExpandedRoleIds([]);
    setError(null);
    setSearchTerm('');
    setFilterType(FilterType.ALL);
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
      const userRoleIds = userRoles.map(r => r.id);
      setRoles(
        allRoles.map(role => ({
          ...role,
          isExpanded: false,
          isSelected: userRoleIds.includes(role.id),
          permissions: [],
          isLoadingPermissions: false,
          hasLoadedPermissions: false,
          permissionError: null
        }))
      );
    } catch (err) {
      setError(t('errors.load_roles_failed'));
      toast({ title: t('errors.error'), description: t('errors.load_roles_failed'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setRoles(prev => prev.map(role => role.id === roleId ? { ...role, isSelected: !role.isSelected } : role));
  };

  const toggleRoleExpansion = async (roleId: string) => {
    setExpandedRoleIds(prev => prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]);
    const role = roles.find(r => r.id === roleId);
    if (!role || role.hasLoadedPermissions || role.isLoadingPermissions) return;
    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, isLoadingPermissions: true, permissionError: null } : r));
    try {
      const resp = await fetchApi(`/roles/permissions/${roleId}?isSystemRole=${role.isSystemRole || false}`) as PermissionResponse;
      setRoles(prev => prev.map(r => r.id === roleId ? {
        ...r,
        permissions: (resp.permissions || []).map(p => ({ ...p, isAssigned: p.assigned, isToggling: false })),
        isLoadingPermissions: false,
        hasLoadedPermissions: true
      } : r));
    } catch {
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, isLoadingPermissions: false, permissionError: t('errors.load_permissions_failed') } : r));
      toast({ title: t('errors.error'), description: t('errors.load_permissions_failed'), variant: 'destructive' });
    }
  };

  const togglePermission = (roleId: string, permissionId: string) => {
    setRoles(prev => prev.map(role => role.id === roleId ? {
      ...role,
      permissions: role.permissions.map(p => p.id === permissionId ? { ...p, isAssigned: !p.isAssigned } : p)
    } : role));
  };

  const handleSaveRoles = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const selectedRoleIds = roles.filter(r => r.isSelected).map(r => r.id);
      await assignRolesToUser(user.id, selectedRoleIds);
      toast({ title: t('success.roles_updated'), description: t('success.roles_update_description') });
      onRolesUpdated?.();
      onOpenChange(false);
    } catch {
      toast({ title: t('errors.error'), description: t('errors.save_roles_failed'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchTerm.toLowerCase());
    switch (filterType) {
      case FilterType.ASSIGNED: return matchesSearch && role.isSelected;
      case FilterType.UNASSIGNED: return matchesSearch && !role.isSelected;
      case FilterType.ALL:
      default: return matchesSearch;
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {t('roles.manage_roles')} {user?.name || ''}
          </DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/10 p-3 rounded-md flex items-start gap-2 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 my-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('roles.search_roles')} className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={v => setFilterType(v as FilterType)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('roles.filter_roles')} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FilterType.ALL}>{t('roles.filter_all')}</SelectItem>
              <SelectItem value={FilterType.ASSIGNED}>{t('roles.filter_assigned')}</SelectItem>
              <SelectItem value={FilterType.UNASSIGNED}>{t('roles.filter_unassigned')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6 border-t border-b">
          {isLoading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2" />
              <p>{t('roles.no_roles_found')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredRoles.map(role => (
                <div key={role.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Checkbox checked={role.isSelected} onCheckedChange={() => toggleRole(role.id)} id={`role-${role.id}`} />
                      <div>
                        <label htmlFor={`role-${role.id}`} className="font-medium cursor-pointer">{role.name}</label>
                        {role.isSystemRole && (
                          <Badge variant="outline" className="ml-2 font-normal">
                            <Shield className="h-3 w-3 mr-1" />
                            {t('roles.system_role')}
                          </Badge>
                        )}
                        <p className="text-sm text-muted-foreground max-w-prose">{role.description || t('roles.no_description')}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleRoleExpansion(role.id)} className="ml-2">
                      {t('roles.permissions')}
                      {expandedRoleIds.includes(role.id) ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronRight className="h-4 w-4 ml-2" />}
                    </Button>
                  </div>
                  {expandedRoleIds.includes(role.id) && (
                    <div className="mt-3 ml-10 pl-4 border-l">
                      {role.isLoadingPermissions && (
                        <div className="flex items-center text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {t('roles.loading_permissions')}
                        </div>
                      )}
                      {role.permissionError && (
                        <div className="text-sm text-destructive py-2 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {role.permissionError}
                        </div>
                      )}
                      {role.hasLoadedPermissions && role.permissions.length === 0 && (
                        <div className="text-sm text-muted-foreground py-2">{t('roles.no_permissions')}</div>
                      )}
                      {role.hasLoadedPermissions && role.permissions.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                          {role.permissions.map(permission => (
                            <div key={permission.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-accent/50">
                              <Checkbox checked={permission.isAssigned} onCheckedChange={() => togglePermission(role.id, permission.id)} id={`permission-${role.id}-${permission.id}`} />
                              <div>
                                <label htmlFor={`permission-${role.id}-${permission.id}`} className="text-sm font-medium cursor-pointer">{permission.name}</label>
                                <p className="text-xs text-muted-foreground">{permission.description || t('roles.no_description')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveRoles} disabled={isSaving || isLoading}>
            {isSaving ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />{t('common.saving')}</>) : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RolesManagementModal;
