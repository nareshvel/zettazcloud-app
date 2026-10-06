import React, { useState } from 'react';
import { User } from '../../services/userService';
// Role-related imports are handled by RolesManagementModal
import { MoreVertical, Edit, Trash2, UserX, Send, UserCheck, ShieldCheck } from 'lucide-react';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';
import RolesManagementModal from './RolesManagementModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { useI18n } from '../../hooks/useI18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// Define the UserRoleAssignment interface based on your API response
interface UserRoleAssignment {
  id: string;
  roleName?: string;
  name?: string;
  display_name?: string;
  scope?: string;
  description?: string;
}

interface UsersTableProps {
  users: User[];
  onEditUser: (userId: string) => void;
  onDeactivateUser: (userId: string) => void;
  onActivateUser: (userId: string) => void;
  onResendInvitation: (userId: string) => void;
  onDeleteUser?: (userId: string) => void;
  onManageRoles?: (userId: string) => void;
  onRolesSaved?: (userId: string, role: { id: string; name: string }) => void;
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRoles = (roles: any[] | string | undefined): string => {
  if (!roles) return 'No roles assigned';
  
  if (typeof roles === 'string') {
    return roles;
  }
  
  if (Array.isArray(roles)) {
    return roles.map(role => {
      if (typeof role === 'string') {
        return role;
      } else if (typeof role === 'object' && role !== null) {
        return role.roleName || role.name || role.display_name || role.id;
      }
      return '?';
    }).join(', ');
  }
  
  return 'Unknown';
};

const StatusBadge = ({ status }: { status?: string }) => {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-700';
  
  if (status === 'active') {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
  } else if (status === 'inactive') {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
  } else if (status === 'invited') {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-700';
  } else if (status === 'pending') {
    bgColor = 'bg-blue-100';
    textColor = 'text-blue-700';
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
    </span>
  );
};

const UsersTable: React.FC<UsersTableProps> = ({ users, onEditUser, onDeactivateUser, onActivateUser, onResendInvitation, onDeleteUser, onManageRoles, onRolesSaved }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const tUsers = (key: string, fallback: string) => t(`users.table.${key}`, { defaultValue: fallback });
  
  const { user: currentUser } = useAuth();
  
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToManageRoles, setUserToManageRoles] = useState<User | null>(null);
  const [isRolesModalOpen, setRolesModalOpen] = useState(false);

  // Check if user is current logged-in user
  const isCurrentUser = (userId: string): boolean => {
    return Boolean(currentUser && currentUser.id === userId);
  };

  // Check if user is the only tenant admin
  const isOnlyTenantAdmin = (user: User): boolean => {
    // Check if this user is a tenant admin
    const isTenantAdmin = user.roles && Array.isArray(user.roles) && 
      user.roles.some(role => 
        (typeof role === 'object' && 
         ((role as UserRoleAssignment).roleName === 'Tenant Admin' || (role as UserRoleAssignment).name === 'Tenant Admin')) || 
        (typeof role === 'string' && role === 'Tenant Admin')
      );
    
    // If they are, check if they're the only one
    if (isTenantAdmin) {
      const tenantAdmins = users.filter(u => {
        // Assuming formatRoles returns a string with role names
        return formatRoles(u.roles).includes('Tenant Admin');
      });
      return tenantAdmins.length <= 1;
    }
    
    return false;
  };
  
  // Handler for when roles are updated via the modal (removed - handled by modal directly)

  if (!users || users.length === 0) {
    return <p className="text-center text-gray-500 dark:text-muted-foreground py-8">{tUsers('no_users_found', 'No users found.')}</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-border text-left">
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-muted-foreground">{tUsers('column.name', 'Name')}</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-muted-foreground">{tUsers('column.email', 'Email')}</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-muted-foreground">{tUsers('column.roles', 'Roles')}</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-muted-foreground">{tUsers('column.last_login', 'Last Login')}</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-muted-foreground">{tUsers('column.status', 'Status')}</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-muted-foreground" style={{width: '80px'}}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-200 dark:border-border hover:bg-gray-50 dark:bg-muted/50">
                <td className="px-4 py-3">{user.name || user.email || tUsers('unnamed', 'Unnamed user')}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{formatRoles(user.roleNames || user.role_names || user.roles)}</td>
                <td className="px-4 py-3">{formatDate(user.lastLogin || user.last_login)}</td>
                <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center justify-center p-1 rounded-md hover:bg-gray-100 dark:bg-muted">
                        <MoreVertical size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {onEditUser && (
                        <DropdownMenuItem onClick={() => onEditUser(user.id)}>
                          <Edit size={16} className="mr-3" /> {tUsers('action.edit', 'Edit User')}
                        </DropdownMenuItem>
                      )}
                      
                      {onResendInvitation && user.status === 'invited' && (
                        <DropdownMenuItem onClick={() => onResendInvitation(user.id)}>
                          <Send size={16} className="mr-3" /> {tUsers('action.resend_invitation', 'Resend Invitation')}
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuSeparator />
                      
                      {(user.status && user.status !== 'inactive') ? (
                        <DropdownMenuItem
                          onClick={() => onDeactivateUser(user.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <UserX size={16} className="mr-3" /> {tUsers('action.deactivate', 'Deactivate User')}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onActivateUser(user.id)}
                          className="text-green-600 focus:text-green-600 focus:bg-green-50"
                        >
                          <UserCheck size={16} className="mr-3" /> {tUsers('action.activate', 'Activate User')}
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuSeparator />
                      
                      {onManageRoles && (
                        <DropdownMenuItem 
                          onClick={() => {
                            setUserToManageRoles(user);
                            setRolesModalOpen(true);
                          }}
                        >
                          <ShieldCheck size={16} className="mr-3" /> {tUsers('action.manage_roles', 'Manage Roles & Permissions')}
                        </DropdownMenuItem>
                      )}
                      
                      {onDeleteUser && (
                        <DropdownMenuItem 
                          onClick={() => {
                            if (isCurrentUser(user.id)) {
                              toast({
                                title: tUsers('error.cannot_delete_title', 'Action Not Allowed'),
                                description: tUsers('error.cannot_delete_self', 'You cannot delete your own account'),
                                variant: 'destructive'
                              });
                            } else if (isOnlyTenantAdmin(user)) {
                              toast({
                                title: tUsers('error.cannot_delete_title', 'Action Not Allowed'),
                                description: tUsers('error.cannot_delete_only_admin', 'Cannot delete the only tenant administrator'),
                                variant: 'destructive'
                              });
                            } else {
                              setUserToDelete(user);
                              setIsConfirmDeleteOpen(true);
                            }
                          }}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          disabled={isCurrentUser(user.id) || isOnlyTenantAdmin(user)}
                        >
                          <Trash2 size={16} className="mr-3" /> {tUsers('action.delete', 'Delete User')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={() => {
          if (userToDelete && onDeleteUser) {
            onDeleteUser(userToDelete.id);
            setUserToDelete(null);
          }
          setIsConfirmDeleteOpen(false);
        }}
        title={tUsers('delete_modal.title', 'Delete User')}
        message={tUsers('delete_modal.message', 'Are you sure you want to permanently delete this user? This action cannot be undone.')}
      />
      
      {/* Roles Management Modal */}
      <RolesManagementModal 
        open={isRolesModalOpen}
        onOpenChange={setRolesModalOpen}
        user={userToManageRoles}
        onRolesSaved={onRolesSaved}
      />
    </>
  );
};

export default UsersTable;
