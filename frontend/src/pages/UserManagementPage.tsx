import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Loader2 } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { debugLogUsers } from '../utils/debugLogger';
import { User, fetchUsers, FetchUsersParams, FetchUsersResponse, createUser, updateUser, updateUserStatus, deleteUser, resendInvitation, UserRoleType, UserStatusType } from '../services/userService';
import UsersTable from '../components/users/UsersTable';
import UniversalListControls, { ExportFormat } from '../components/UniversalListControls'; // ExportFormat might be used by onExportClick type
import { useI18n } from '../hooks/useI18n';
import toast from 'react-hot-toast';
import PaginationControls from '../components/ui/PaginationControls';
import UserFormModal from '../components/users/UserFormModal';
import RolesManagementModal from '../components/users/RolesManagementModal';

const UserManagementPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const tPage = (key: string, fallback: string) => t(`userManagement:${key}`, { defaultValue: fallback });

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [limit] = useState<number>(10); // Default items per page

  const [searchTerm, setSearchTerm] = useState<string>('');
  // Add other filter states here if needed, e.g., role, status

  // State for UserFormModal
  const [isUserFormModalOpen, setIsUserFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // State for RolesManagementModal
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadUsers = useCallback(async (fetchParams: FetchUsersParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const response: FetchUsersResponse = await fetchUsers(fetchParams);
      setUsers(response.users);
      setTotalUsers(response.totalUsers);
      // setCurrentPage directly here might be problematic if it's also a dep of useEffect that calls loadUsers.
      // The page number is part of fetchParams, so the response should reflect that.
      // If the API can return a different page than requested, that needs handling.
      // For now, assume API returns data for fetchParams.page
      // setCurrentPage should not be called here to prevent loops.
      // The currentPage state is managed by pagination controls and is an input to loadUsers.
      setTotalPages(response.totalPages);
    } catch (err) {
      console.error('Failed to load users:', err); // Keeping error logs for critical errors
      setError(tPage('errors.load_users_failed', 'Failed to load users. Please try again.'));
      toast.error(tPage('errors.load_users_failed_toast', 'Could not fetch users.'));
      setUsers([]);
      setTotalUsers(0);
      // Avoid resetting currentPage here if it's a dependency that triggers re-fetch, 
      // unless it's a specific error handling strategy (e.g. go to page 1 on error)
      // setCurrentPage(1); 
      setTotalPages(1);
    }
    setIsLoading(false);
  // Dependencies: `tPage` is removed. `fetchUsers` is stable if imported. State setters are stable.
  // `tPage` will be from closure. If `t` from `useI18n` is stable, this is fine.
  }, [/* tPage removed */]);

  // Stabilize the callback reference to prevent stale closure issues
  const handleRolesUpdated = useCallback(() => {
    try {
      setSelectedUserForRoles(null);
      setIsRolesModalOpen(false);
      loadUsers({ page: currentPage, limit, searchTerm });
      toast.success('Roles and permissions updated successfully');
    } catch (error) {
      setSelectedUserForRoles(null);
      setIsRolesModalOpen(false);
    }
  }, [currentPage, limit, searchTerm, loadUsers]);

  // Stable callback for modal onOpenChange
  const handleModalOpenChange = useCallback((open: boolean) => {
    setIsRolesModalOpen(open);
    if (!open) {
      setSelectedUserForRoles(null);
      setRefreshTrigger(prev => prev + 1);
      toast.success('Roles and permissions updated successfully');
    }
  }, []);

  // useEffect to load users when page, limit, or searchTerm changes.
  // loadUsers is memoized with useCallback and should be stable if its own dependencies are stable.
  useEffect(() => {
    loadUsers({ page: currentPage, limit, searchTerm });
  }, [loadUsers, currentPage, limit, searchTerm, refreshTrigger]);

  const handleSearch = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleAddUser = () => {
    setEditingUser(null); // Ensure it's a new user form
    setIsUserFormModalOpen(true);
  };

  const handleEditUser = (userId: string) => {
    const userToEdit = users.find(user => user.id === userId);
    if (userToEdit) {
      setEditingUser(userToEdit);
      setIsUserFormModalOpen(true);
    } else {
      toast.error(tPage('errors.user_not_found', 'User not found for editing.'));
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (!userToUpdate) {
        toast.error(tPage('toast.user_not_found', 'User not found.'));
        return;
      }
      // Use the dedicated updateUserStatus function with is_active: false
      await updateUserStatus(userId, false);
      toast.success(tPage('toast.user_deactivated_success', 'User deactivated successfully!'));
      // Refresh users list
      loadUsers({ page: currentPage, limit, searchTerm });
    } catch (error) {
      console.error('Failed to deactivate user:', error); // Keeping error logs for critical errors
      toast.error(tPage('toast.user_deactivated_error', 'Failed to deactivate user.'));
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (!userToUpdate) {
        toast.error(tPage('toast.user_not_found', 'User not found.'));
        return;
      }
      // Use the dedicated updateUserStatus function with is_active: true
      await updateUserStatus(userId, true);
      toast.success(tPage('toast.user_activated_success', 'User activated successfully!'));
      loadUsers({ page: currentPage, limit, searchTerm });
    } catch (error) {
      console.error('Failed to activate user:', error); // Keeping error logs for critical errors
      toast.error(tPage('toast.user_activated_error', 'Failed to activate user.'));
    }
  };

  const handleResendInvitation = async (userId: string) => {
    try {
      await resendInvitation(userId);
      toast.success(tPage('toast.invitation_resent', 'Invitation email has been resent successfully.'));
    } catch (error) {
      console.error('Failed to resend invitation:', error); // Keeping error logs for critical errors
      toast.error(tPage('toast.invitation_resend_error', 'Failed to resend invitation email.'));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId);
      toast.success(tPage('toast.user_deleted', 'User has been permanently deleted.'));
      // Refresh the user list
      loadUsers({ page: currentPage, limit, searchTerm });
    } catch (error) {
      console.error('Failed to delete user:', error); // Keeping error logs for critical errors
      toast.error(tPage('toast.user_delete_error', 'Failed to delete user.'));
    }
  };
  
  const handleManageRoles = (userId: string) => {
    const userToManage = users.find(u => u.id === userId);
    if (userToManage) {
      // Set the selected user and open the roles management modal
      setSelectedUserForRoles(userToManage);
      setIsRolesModalOpen(true);
      debugLogUsers('Opening role management modal for user:', userId);
    } else {
      toast.error(tPage('toast.user_not_found', 'User not found.'));
    }
  };

  const handleGlobalRolesManagement = () => {
    // Navigate to the dedicated Roles Management page instead of opening a modal
    navigate('/team/roles');
    debugLogUsers('Navigating to RolesManagementPage');
  };

  // Update only the affected user's role locally without a full reload
  const handleRolesSavedRow = useCallback((userId: string, role: { id: string; name: string }) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      return {
        ...u,
        roles: [{ id: role.id, name: role.name }] as any,
        roleNames: role.name, // immediate display in UsersTable
        role_names: role.name, // fallback key variant if used elsewhere
      };
    }));
    toast.success('User role updated');
  }, []);

  const handleSaveUser = async (userData: Partial<User> & { role?: UserRoleType; primaryStoreId?: string | null; status?: UserStatusType }, isNew: boolean) => {
    try {
      if (isNew) {
        await createUser(userData); // userService.createUser will handle role and primaryStoreId
        toast.success(tPage('success.user_created', 'User created successfully!'));
      } else if (editingUser?.id) {
        await updateUser(editingUser.id, userData); // userService.updateUser will handle role and primaryStoreId
        toast.success(tPage('success.user_updated', 'User updated successfully!'));
      } else {
        // This case should ideally not be reached if logic is sound
        throw new Error('User ID missing for update or operation type unclear.');
      }
      setIsUserFormModalOpen(false);
      // Refresh users list, go to page 1 if new user added, otherwise stay on current page
      loadUsers({ page: isNew ? 1 : currentPage, limit, searchTerm });
    } catch (error) {
      console.error('Failed to save user:', error); // Keeping error logs for critical errors
      // Ensure error is an instance of Error to access message property safely
      const errorMessage = error instanceof Error ? error.message : tPage('errors.save_user_failed', 'Failed to save user.');
      toast.error(errorMessage);
      // Re-throw to allow UserFormModal to handle its submitting state if needed
      throw error; 
    }
  };

  const activeUsers = users.filter(u => u.status === 'active').length;
  const inactiveUsers = users.filter(u => u.status === 'inactive' || u.status === 'deactivated').length;
  const pendingUsers = users.filter(u => u.status === 'pending').length;

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Users}
        title={tPage('title', 'User Management')}
        subtitle="Invite users, assign roles, and manage access permissions."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600' },
          { label: 'Active', value: activeUsers, icon: Users, color: 'text-green-600' },
          { label: 'Inactive', value: inactiveUsers, icon: Users, color: 'text-red-600' },
          { label: 'Pending', value: pendingUsers, icon: Users, color: 'text-amber-600' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border border-r-4 border-r-primary/40 bg-card p-3.5">
              <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <UniversalListControls
        searchTerm={searchTerm}
        onSearchChange={handleSearch}
        placeholderText={tPage('search.placeholder', 'Search users by name, email...')}
        newButtonText={tPage('buttons.new', 'New')}
        onNewButtonClick={handleAddUser}
        showManageRolesButton={true}
        onManageRolesClick={handleGlobalRolesManagement}
        manageRolesButtonText={tPage('buttons.manage_roles', 'Manage Roles & Permissions')}
        showImportButton={false}
        showExportButton={true}
        onExportClick={(format: ExportFormat) => debugLogUsers('Exporting users as', format)}
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 px-4">
          <Loader2 className="h-4 w-4 animate-spin" /> {tPage('loading', 'Loading users...')}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">{tPage('errors.error_title', 'Error!')} </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        {!isLoading && !error && (
          <>
            <UsersTable
              users={users}
              onEditUser={handleEditUser}
              onDeactivateUser={handleDeactivateUser}
              onActivateUser={handleActivateUser}
              onResendInvitation={handleResendInvitation}
              onDeleteUser={handleDeleteUser}
              onManageRoles={handleManageRoles}
              onRolesSaved={handleRolesSavedRow}
            />
            {totalUsers > 0 && (
              <div className="border-t border-border px-4 py-3">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  itemsPerPage={limit}
                  totalItems={totalUsers}
                />
              </div>
            )}
          </>
        )}
      </div>

      {isUserFormModalOpen && (
        <UserFormModal
          isOpen={isUserFormModalOpen}
          onClose={() => setIsUserFormModalOpen(false)}
          onSave={handleSaveUser} // Corrected: This was already correct, the lint error was misleading due to other issues.
          userToEdit={editingUser}
        />
      )}

      {/* Roles Management Modal */}
      <RolesManagementModal
        open={isRolesModalOpen}
        onOpenChange={handleModalOpenChange}
        user={selectedUserForRoles}
        onRolesSaved={handleRolesSavedRow}
      />
    </div>
  );
};

export default UserManagementPage;

