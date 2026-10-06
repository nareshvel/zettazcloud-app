import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { User, UserRoleType, UserStatusType } from '../../services/userService';
import { Store, fetchStores } from '../../services/storeService';
import { Role, fetchRoles } from '../../services/roleService';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { useI18n } from '../../hooks/useI18n';
import toast from 'react-hot-toast';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Partial<User> & { role?: UserRoleType; primaryStoreId?: string | null; status?: UserStatusType }, isNew: boolean) => Promise<void>;
  userToEdit?: User | null;
  // TODO: Potentially add stores list for store_id selection if applicable
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, userToEdit }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const tModal = (key: string, fallback: string) => t(`userManagement.modal:${key}`, { defaultValue: fallback });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<UserRoleType>('cashier'); // Default role
  const [storeId, setStoreId] = useState(''); // Optional
  const [stores, setStores] = useState<Store[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  const isNewUser = !userToEdit;
  const selectedRoleDetails = roles.find(roleOption => roleOption.id === role);
  const selectedPermissionCount = selectedRoleDetails?.permissions?.length || 0;

  // Fetch stores and roles for the dropdowns when the component mounts
  useEffect(() => {
    const loadStores = async () => {
      setIsLoadingStores(true);
      try {
        const storesData = await fetchStores();
        setStores(storesData);
      } catch (error) {
        console.error('Failed to load stores:', error);
        toast.error('Failed to load stores. Please try again.');
      } finally {
        setIsLoadingStores(false);
      }
    };
    
    const loadRoles = async () => {
      setIsLoadingRoles(true);
      try {
        const rolesData = await fetchRoles();
        setRoles(rolesData);
      } catch (error) {
        console.error('Failed to load roles:', error);
        toast.error('Failed to load roles. Please try again.');
      } finally {
        setIsLoadingRoles(false);
      }
    };
    
    loadStores();
    loadRoles();
  }, []);

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name || '');
      setEmail(userToEdit.email || '');
      setPassword(''); // Clear password field for existing users
      setPhoneNumber(userToEdit.phoneNumber || ''); // User type now has optional phoneNumber
      // Get the first roleName as the primary role for the form, default to first available role
      // Map API roleName to dropdown values
      let primaryRoleId = '';
      
      if (userToEdit.roles && userToEdit.roles.length > 0) {
        // Try to find the role ID from the fetched roles
        const userRoleName = userToEdit.roles[0].roleName;
        if (userRoleName && roles.length > 0) {
          const matchingRole = roles.find(role => role.name === userRoleName);
          if (matchingRole) {
            primaryRoleId = matchingRole.id; // Use role ID directly
          } else {
            // Fallback to first available role
            primaryRoleId = roles.length > 0 ? roles[0].id : '';
          }
        } else if (roles.length > 0) {
          // If roles are not loaded yet, use first available role as fallback
          primaryRoleId = roles[0].id;
        }
      } else if (roles.length > 0) {
        // For new users or users without roles, use first available role
        primaryRoleId = roles[0].id;
      }
      setRole(primaryRoleId);
      const roleStoreId = userToEdit.roles?.find((assignedRole) => assignedRole.scope === 'store')?.scopeId;
      setStoreId(userToEdit.primaryStoreId || userToEdit.storeId || roleStoreId || 'none');
      setIsActive(userToEdit.status ? userToEdit.status === 'active' : true);
    } else {
      // Reset form for new user
      setName('');
      setEmail('');
      setPassword('');
      setPhoneNumber('');
      setRole(roles.length > 0 ? roles[0].id : ''); // Use first available role ID
      setStoreId(stores.length === 1 ? stores[0].id : 'none');
      setIsActive(true);
    }
  }, [userToEdit, isOpen, roles, stores]); //Rerun when modal opens, userToEdit changes, or roles are loaded

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!name.trim()) {
        toast.error(tModal('errors.name_required', 'Name is required.'));
        setIsSubmitting(false);
        return;
    }
    if (!email.trim()) {
        toast.error(tModal('errors.email_required', 'Email is required.'));
        setIsSubmitting(false);
        return;
    }
    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
        toast.error(tModal('errors.email_invalid', 'Please enter a valid email address.'));
        setIsSubmitting(false);
        return;
    }

    const userData: Partial<User> & { role?: UserRoleType, password?: string } = {
      name,
      email,
      phoneNumber: phoneNumber || null,
      primaryStoreId: storeId === 'none' ? null : storeId, // Maps to primaryStoreId on User type
      status: isActive ? 'active' : 'inactive' as UserStatusType,
      // The 'role' field here is a simplified representation for the form.
      // The createUser/updateUser service functions will handle converting this
      // (along with primaryStoreId) into the UserRoleAssignment[] structure if needed.
      role: role, 
    };
    
    // Only include password for new users
    if (isNewUser) {
      if (!password.trim()) {
        toast.error(tModal('errors.password_required', 'Password is required for new users.'));
        setIsSubmitting(false);
        return;
      }
      userData.password = password;
    }

    if (!isNewUser && userToEdit?.id) {
      userData.id = userToEdit.id;
    }

    try {
      await onSave(userData, isNewUser);
      // onClose(); // Parent will handle closing on successful save
    } catch (error) {
      // Error is usually handled by onSave, but a fallback can be here
      console.error('Failed to save user:', error);
      // toast.error(tModal('errors.save_failed', 'Failed to save user.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-card text-card-foreground max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b flex-shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{isNewUser ? tModal('title.add', 'Create Login Account') : tModal('title.edit', 'Edit Login & Access')}</DialogTitle>
              <DialogDescription className="mt-1">
                {isNewUser ? 'Create an account and assign its store and role.' : 'Update account details, store assignment, role, and login status.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form id="user-form-main" onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* Full Name */}
              <div>
                <Label htmlFor="name" className="text-sm font-semibold text-foreground mb-1.5 block">{tModal('field.name', 'Full Name')}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="form-input w-full" placeholder={tModal('fields.name.placeholder', 'Enter full name')} disabled={isSubmitting} />
              </div>

              {/* Email Address */}
              <div>
                <Label htmlFor="email" className="text-sm font-semibold text-foreground mb-1.5 block">{tModal('field.email', 'Email Address')}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="form-input w-full" placeholder={tModal('fields.email.placeholder', 'Enter email address')} disabled={isNewUser ? isSubmitting : true} />
                {!isNewUser && <p className="text-xs text-muted-foreground mt-1">{tModal('fields.email.edit_note', 'Email cannot be changed.')}</p>}
              </div>

              {/* Phone Number */}
              <div>
                <Label htmlFor="phoneNumber" className="text-sm font-semibold text-foreground mb-1.5 block">{tModal('field.phoneNumber', 'Phone Number (Optional)')}</Label>
                <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="form-input w-full" placeholder={tModal('fields.phone.placeholder', 'Enter phone number')} disabled={isSubmitting} />
              </div>

              {/* Role */}
              <div>
                <Label htmlFor="role" className="text-sm font-semibold text-foreground mb-1.5 block">{tModal('field.role', 'Role')}</Label>
                <Select value={role} onValueChange={(value) => setRole(value as UserRoleType)} disabled={isSubmitting || isLoadingRoles}>
                  <SelectTrigger id="role" className="form-input w-full">
                    <SelectValue placeholder={isLoadingRoles ? 'Loading roles...' : tModal('fields.role.placeholder', 'Select a role')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    {roles.length > 0 ? (
                      roles.map((roleOption) => {
                        // Use role ID directly - this is what backend expects
                        return (
                          <SelectItem key={roleOption.id} value={roleOption.id}>
                            {roleOption.name}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="no-roles" disabled>
                        {isLoadingRoles ? 'Loading roles...' : 'No roles available'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedRoleDetails && (
                  <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-foreground">Permissions inherited from {selectedRoleDetails.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedPermissionCount} effective role permissions</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => { onClose(); navigate('/team/roles'); }}
                      >
                        Manage roles
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Password - Only for new users */}
              {isNewUser && (
                <div>
                  <Label htmlFor="password" className="text-sm font-semibold text-foreground mb-1.5 block">{tModal('field.password', 'Password')}</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="form-input w-full" 
                    placeholder={tModal('fields.password.placeholder', 'Enter password')} 
                    disabled={isSubmitting} 
                  />
                </div>
              )}
              
              {/* Store Dropdown - Spans full width */}
              <div className="md:col-span-2">
                <Label htmlFor="storeId" className="text-sm font-semibold text-foreground mb-1.5 block">{tModal('field.storeId', 'Store (Optional)')}</Label>
                <Select value={storeId} onValueChange={setStoreId} disabled={isSubmitting || isLoadingStores}>
                  <SelectTrigger id="storeId" className="form-input w-full">
                    <SelectValue placeholder={tModal('fields.storeId.placeholder', 'Select a store (optional)')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground max-h-[300px] overflow-y-auto">
                    <SelectItem value="none">None</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingStores && <p className="text-xs text-muted-foreground mt-1">Loading stores...</p>}
              </div>

              {/* Status Toggle - Spans full width */}
              <div className="md:col-span-2 flex items-center space-x-3 pt-2">
                <Switch
                  id="user-status-toggle"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={isSubmitting}
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
                />
                <Label htmlFor="user-status-toggle" className="text-sm font-semibold text-foreground cursor-pointer">
                  {isActive ? tModal('fields.status.active', 'User is Active') : tModal('fields.status.inactive', 'User is Inactive')}
                </Label>
              </div>
            </div> {/* End Grid Div */}
          </div> {/* End p-6 space-y-0 div */}
        </form>

        <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex-shrink-0 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {tModal('button.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={isSubmitting}
            type="submit"
            form="user-form-main"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {isSubmitting ? tModal('button.saving', 'Saving...') : (isNewUser ? tModal('button.saveUser', 'Create Account') : tModal('button.saveChanges', 'Save Changes'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserFormModal;
