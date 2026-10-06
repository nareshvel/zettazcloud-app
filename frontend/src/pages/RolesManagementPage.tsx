import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, Plus, Trash2, Search, MoreHorizontal, Lock,
  Check, ChevronDown, FolderKanban, Eye, Loader2, AlertCircle
} from 'lucide-react';
import {
  fetchRoles,
  fetchPermissions,
  createRole,
  updateRole,
  deleteRole,
  type Role,
  type Permission
} from '../services/roleService';
import { useToast } from '../hooks/use-toast';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface RoleFormData {
  id?: string;
  name: string;
  description: string;
  permissions: string[];
  scope: 'tenant' | 'store' | 'system';
  isSystemRole?: boolean;
}

interface PermissionGroup {
  category: string;
  permissions: Permission[];
}

const getPermissionTranslationKey = (permission: Permission): { module: string; action: string } => {
  let module = '';
  let action = '';

  if (typeof permission?.name === 'string' && permission.name.includes('.')) {
    const parts = permission.name.split('.');
    action = parts[parts.length - 1];
    module = parts.slice(0, parts.length - 1).join('.');
  } else {
    const moduleParts = (permission.module || '').split('.');
    module = moduleParts.filter(Boolean).join('.') || 'other';
    action = permission.name || 'unknown';
  }

  if (module === 'subscription') {
    module = 'tenant.subscription';
  }

  return { module, action };
};

const formatModuleName = (module: string): string =>
  module
    .split(/[-.]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const RolesManagementPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    permissions: [],
    scope: 'tenant',
    isSystemRole: false,
  });
  const [permSearchTerm, setPermSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [rolesData, permissionsData] = await Promise.all([
        fetchRoles(),
        fetchPermissions()
      ]);
      setRoles(rolesData);
      setAllPermissions(permissionsData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load roles and permissions.');
      toast({ title: 'Error', description: 'Failed to load roles and permissions.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.scope || '').toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);

  const permissionGroups = useMemo<PermissionGroup[]>(() => {
    const groups: Record<string, Permission[]> = {};
    allPermissions.forEach((p) => {
      const { module } = getPermissionTranslationKey(p);
      const category = module || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });
    return Object.entries(groups)
      .map(([category, permissions]) => ({
        category,
        permissions: permissions.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [allPermissions]);

  const filteredPermissionGroups = useMemo(() => {
    const q = permSearchTerm.trim().toLowerCase();
    if (!q) return permissionGroups;
    return permissionGroups
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            g.category.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [permissionGroups, permSearchTerm]);

  useEffect(() => {
    if (permSearchTerm.trim()) {
      const expanded: Record<string, boolean> = {};
      filteredPermissionGroups.forEach((g) => { expanded[g.category] = true; });
      setExpandedGroups(expanded);
    }
  }, [permSearchTerm, filteredPermissionGroups]);

  const selectedCount = formData.permissions.length;
  const totalPermissions = allPermissions.length;

  const stats = useMemo(() => {
    const total = roles.length;
    const system = roles.filter((r) => r.isSystemRole).length;
    const custom = total - system;
    return { total, system, custom };
  }, [roles]);

  const resetForm = () => {
    setFormData({ name: '', description: '', permissions: [], scope: 'tenant', isSystemRole: false });
    setSelectedRole(null);
    setPermSearchTerm('');
    setExpandedGroups({});
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      id: role.id,
      name: role.name,
      description: role.description || '',
      permissions: Array.isArray(role.permissions)
        ? role.permissions.map((p: Permission | string) => (typeof p === 'string' ? p : p.id))
        : [],
      scope: role.scope || 'tenant',
      isSystemRole: role.isSystemRole,
    });
    setPermSearchTerm('');
    setExpandedGroups({});
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!roleToDelete) return;
    try {
      await deleteRole(roleToDelete.id);
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
      toast({ title: `${roleToDelete.name} deleted` });
    } catch {
      toast({ title: 'Failed to delete role', variant: 'destructive' });
    } finally {
      setRoleToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Role name is required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      if (formData.id) {
        await updateRole(formData.id, {
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
          scope: formData.scope,
        });
        toast({ title: `${formData.name} updated` });
      } else {
        await createRole({
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
          scope: formData.scope,
        });
        toast({ title: `${formData.name} created` });
      }
      setDialogOpen(false);
      resetForm();
      load(true);
    } catch (err) {
      toast({ title: 'Failed to save role', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (permissionId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter((id) => id !== permissionId),
    }));
  };

  const toggleGroup = (category: string, selectAll: boolean) => {
    const group = filteredPermissionGroups.find((g) => g.category === category);
    if (!group) return;
    const groupIds = group.permissions.map((p) => p.id);
    setFormData((prev) => ({
      ...prev,
      permissions: selectAll
        ? Array.from(new Set([...prev.permissions, ...groupIds]))
        : prev.permissions.filter((id) => !groupIds.includes(id)),
    }));
  };

  const toggleExpand = (category: string) => {
    setExpandedGroups((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const expandAll = () => {
    const expanded: Record<string, boolean> = {};
    filteredPermissionGroups.forEach((g) => { expanded[g.category] = true; });
    setExpandedGroups(expanded);
  };

  const collapseAll = () => {
    setExpandedGroups({});
  };

  const selectAllVisible = () => {
    const visibleIds = filteredPermissionGroups.flatMap((g) => g.permissions.map((p) => p.id));
    setFormData((prev) => ({
      ...prev,
      permissions: Array.from(new Set([...prev.permissions, ...visibleIds])),
    }));
  };

  const deselectAllVisible = () => {
    const visibleIds = new Set(filteredPermissionGroups.flatMap((g) => g.permissions.map((p) => p.id)));
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.filter((id) => !visibleIds.has(id)),
    }));
  };

  const isReadOnly = !!formData.isSystemRole;

  if (isLoading && roles.length === 0) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading roles and permissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center h-64 text-destructive">
        <AlertCircle className="h-8 w-8 mr-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Shield}
        title="Roles & Permissions"
        subtitle="Define what each team member can see and do across the system"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/team')}>Team Members</Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              <Plus className="h-4 w-4 mr-1.5" /> Create Role
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Roles', value: stats.total, icon: FolderKanban, color: 'text-blue-600' },
          { label: 'System Roles', value: stats.system, icon: Lock, color: 'text-violet-600' },
          { label: 'Custom Roles', value: stats.custom, icon: Users, color: 'text-amber-600' },
          { label: 'Permissions', value: totalPermissions, icon: Check, color: 'text-green-600' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
              <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roles by name, description or scope..."
            value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {filteredRoles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {roles.length === 0 ? 'No roles yet.' : 'No roles match your search.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {roles.length === 0 ? 'Create your first role to control access.' : 'Try a different search term.'}
          </p>
          {roles.length === 0 && (
            <Button variant="outline" size="sm" className="mt-4" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" /> Create Role
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredRoles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              allPermissions={allPermissions}
              onEdit={() => handleEdit(role)}
              onDelete={() => setRoleToDelete(role)}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-6xl h-[min(90vh,820px)] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b bg-card">
            <div className="flex items-center gap-3 pr-8">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {isReadOnly ? <Lock className="h-5 w-5 text-primary" /> : <Shield className="h-5 w-5 text-primary" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl">
                    {selectedRole ? (isReadOnly ? selectedRole.name : `Edit ${selectedRole.name}`) : 'Create a new role'}
                  </DialogTitle>
                  {isReadOnly && <Badge variant="secondary">System role</Badge>}
                </div>
                <DialogDescription className="mt-0.5">
                  {isReadOnly
                    ? 'Review the access included with this protected role.'
                    : 'Set the role identity and configure access from one workspace.'}
                </DialogDescription>
              </div>
              <div className="ml-auto hidden sm:flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{selectedCount}</span>
                <span className="text-xs text-muted-foreground">of {totalPermissions} permissions</span>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="grid flex-1 min-h-0 md:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="overflow-y-auto border-b md:border-b-0 md:border-r bg-muted/20 p-5 space-y-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="roleName">Role name *</Label>
                    <Input
                      id="roleName"
                      name="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Inventory Manager"
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="roleScope">Scope</Label>
                    <Select
                      value={formData.scope}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, scope: v as RoleFormData['scope'] }))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger id="roleScope">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tenant">Tenant</SelectItem>
                        <SelectItem value="store">Store</SelectItem>
                        <SelectItem value="system" disabled>System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="roleDescription">Description</Label>
                  <Textarea
                    id="roleDescription"
                    name="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Briefly describe what this role is for"
                    disabled={isReadOnly}
                    className="min-h-[100px]"
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Access coverage</span>
                    <span className="font-semibold text-foreground">{selectedCount}/{totalPermissions}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${totalPermissions ? (selectedCount / totalPermissions) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Choose only the access this role needs. You can adjust permissions by module on the right.
                  </p>
                </div>
                {isReadOnly && (
                  <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm text-muted-foreground flex items-start gap-2">
                    <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>This protected role is managed by the system and cannot be changed.</span>
                  </div>
                )}
              </aside>

              <section className="flex flex-col min-h-[420px] md:min-h-0 overflow-hidden p-5 bg-background">
                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <div>
                    <h3 className="text-base font-semibold">Permission access</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Grant access by module or choose individual actions.</p>
                  </div>
                  <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search modules, actions or descriptions..."
                        value={permSearchTerm}
                        onChange={(e) => setPermSearchTerm(e.target.value)}
                        className="pl-9 h-10 bg-card"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button type="button" variant="outline" size="sm" onClick={expandAll}>Expand all</Button>
                      <Button type="button" variant="outline" size="sm" onClick={collapseAll}>Collapse all</Button>
                      {!isReadOnly && (
                        <>
                          <Button type="button" variant="secondary" size="sm" onClick={selectAllVisible}>Select visible</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={deselectAllVisible}>Clear visible</Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">
                      {filteredPermissionGroups.length} modules shown
                    </span>
                    <span className="font-medium text-foreground">
                      {selectedCount} selected
                    </span>
                  </div>

                  <ScrollArea className="flex-1 rounded-xl border border-border bg-card/50">
                    <div className="p-3 space-y-3">
                      {filteredPermissionGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No permissions match your search.</p>
                      ) : (
                        filteredPermissionGroups.map((group) => {
                          const selectedInGroup = group.permissions.filter((p) => formData.permissions.includes(p.id)).length;
                          const isExpanded = !!expandedGroups[group.category] || !!permSearchTerm.trim();
                          const allSelected = group.permissions.length > 0 && group.permissions.every((p) => formData.permissions.includes(p.id));

                          return (
                            <div key={group.category} className="border rounded-lg bg-card overflow-hidden">
                              <div
                                onClick={() => toggleExpand(group.category)}
                                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                  <span className="font-medium text-sm">{formatModuleName(group.category)}</span>
                                  <Badge variant="outline" className="font-normal text-xs">
                                    {selectedInGroup}/{group.permissions.length}
                                  </Badge>
                                </div>
                                {!isReadOnly && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); toggleGroup(group.category, !allSelected); }}
                                  >
                                    {allSelected ? 'Deselect all' : 'Select all'}
                                  </Button>
                                )}
                              </div>

                              {isExpanded && (
                                <div className="p-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {group.permissions.map((permission) => {
                                      const checked = formData.permissions.includes(permission.id);
                                      return (
                                        <label
                                          key={permission.id}
                                          htmlFor={`perm-${permission.id}`}
                                          className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                                            checked
                                              ? 'border-primary/35 bg-primary/5'
                                              : 'border-transparent bg-muted/20 hover:border-border hover:bg-muted/40'
                                          } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                                        >
                                          <Checkbox
                                            id={`perm-${permission.id}`}
                                            checked={checked}
                                            onCheckedChange={(value) => togglePermission(permission.id, value as boolean)}
                                            disabled={isReadOnly}
                                            className="mt-0.5 shrink-0"
                                          />
                                          <span className="min-w-0">
                                            <span className="block text-sm font-medium leading-tight text-foreground">
                                              {permission.description || formatModuleName(permission.name)}
                                            </span>
                                            <span className="block mt-1 text-[11px] font-mono text-muted-foreground truncate">
                                              {permission.name}
                                            </span>
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </section>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-muted/30">
              {isReadOnly ? (
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                  <Button type="submit" disabled={isSaving || !formData.name.trim()}>
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    {selectedRole ? 'Save Changes' : 'Create Role'}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
        title={`Delete ${roleToDelete?.name}?`}
        description="This will permanently remove the role. Users assigned to it will lose these permissions."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
};

interface RoleCardProps {
  role: Role;
  allPermissions: Permission[];
  onEdit: () => void;
  onDelete: () => void;
}

const RoleCard: React.FC<RoleCardProps> = ({ role, allPermissions, onEdit, onDelete }) => {
  const rawPermissions = Array.isArray(role.permissions) ? role.permissions : [];
  const rolePermissions = rawPermissions
    .map((item) => {
      if (typeof item === 'string') return allPermissions.find((p) => p.id === item);
      return item as Permission;
    })
    .filter((p): p is Permission => !!p);
  const totalCount = rawPermissions.length;

  const modules = useMemo(() => {
    const counts: Record<string, number> = {};
    rolePermissions.forEach((p) => {
      const { module } = getPermissionTranslationKey(p);
      const category = module || 'other';
      counts[category] = (counts[category] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rolePermissions]);

  const visibleModules = modules.slice(0, 4);
  const hiddenCount = modules.length - visibleModules.length;

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {role.isSystemRole ? <Lock className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{role.name}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {role.scope ? role.scope.charAt(0).toUpperCase() + role.scope.slice(1) : 'Tenant'} scope
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onEdit}>
                <Eye className="h-4 w-4 mr-2" /> {role.isSystemRole ? 'View' : 'Edit'}
              </DropdownMenuItem>
              {!role.isSystemRole && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground mb-3 min-h-[20px]">
          {role.description || <span className="italic">No description</span>}
        </p>

        {modules.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {visibleModules.map(([module, count]) => (
              <Badge key={module} variant="outline" className="font-normal text-xs">
                {formatModuleName(module)} <span className="text-muted-foreground ml-1">{count}</span>
              </Badge>
            ))}
            {hiddenCount > 0 && (
              <Badge variant="outline" className="font-normal text-xs">+{hiddenCount} more</Badge>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            {totalCount} {totalCount === 1 ? 'permission' : 'permissions'}
          </span>
          {role.isSystemRole && <Badge variant="secondary" className="text-xs font-normal">System</Badge>}
        </div>
      </CardContent>
    </Card>
  );
};

export default RolesManagementPage;
