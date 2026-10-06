import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listEmployees, createEmployee, updateEmployee, deactivateEmployee,
  setTarget, getPerformance, paytimeStatus, pushPaytimeIncentive,
  Employee, EmployeePerformance,
} from '@/services/employeeService';
import { fetchUsers, updateUser, User, UserRoleType, UserStatusType } from '@/services/userService';
import { fetchRoles, assignRolesToUser, Role } from '@/services/roleService';
import { fetchStores, Store } from '@/services/storeService';
import {
  UserPlus, Target, TrendingUp, Loader2, Contact, Send, Search,
  MoreHorizontal, Pencil, Trash2, Users, ShieldCheck,
  Store as StoreIcon, Briefcase, Link2, Link2Off, KeyRound,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/common/PageHeader';
import UserFormModal from '@/components/users/UserFormModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── helpers ──────────────────────────────────────────────────────── */
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

/* ── main page ────────────────────────────────────────────────────── */
const EmployeesPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [paytimeReady, setPaytimeReady] = useState(false);

  // filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');

  // modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [initialUser, setInitialUser] = useState<User | null>(null);
  const [editingAccessUser, setEditingAccessUser] = useState<User | null>(null);
  const [perfEmployee, setPerfEmployee] = useState<Employee | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);

  /* ── load ──────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empList, ptStatus, userResp, roleList, storeList] = await Promise.all([
        listEmployees(),
        paytimeStatus().catch(() => ({ configured: false })),
        fetchUsers({ limit: 200 }).catch(() => ({ users: [] as User[], totalUsers: 0, totalPages: 1, currentPage: 1 })),
        fetchRoles().catch(() => [] as Role[]),
        fetchStores().catch(() => [] as Store[]),
      ]);
      setEmployees(empList);
      setPaytimeReady(ptStatus.configured);
      setUsers(userResp.users);
      setRoles(roleList);
      setStores(storeList);
    } catch {
      toast({ title: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Lightweight refresh: only re-fetches employees + users (no loading spinner)
  const refreshList = useCallback(async () => {
    try {
      const [empList, userResp] = await Promise.all([
        listEmployees(),
        fetchUsers({ limit: 200 }).catch(() => ({ users: [] as User[], totalUsers: 0, totalPages: 1, currentPage: 1 })),
      ]);
      setEmployees(empList);
      setUsers(userResp.users);
    } catch {
      // silent - data will be stale but page won't break
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── derive KPIs ──────────────────────────────────────────────── */
  const linkedUserIds = useMemo(() => new Set(employees.flatMap(e => e.userId ? [e.userId] : [])), [employees]);
  const accessOnlyUsers = useMemo(() => users.filter(user => !linkedUserIds.has(user.id)), [users, linkedUserIds]);
  const totalStaff = employees.length + accessOnlyUsers.length;
  const activeStaff = employees.filter(e => e.isActive !== 0 && e.isActive !== false).length
    + accessOnlyUsers.filter(user => user.status === 'active').length;
  const linkedAccounts = users.length;
  const missingAccounts = employees.filter(e => !e.userId && e.isActive !== 0 && e.isActive !== false).length;

  /* ── build user lookup ────────────────────────────────────────── */
  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  /* ── filtered list ────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (statusFilter === 'active' && (e.isActive === 0 || e.isActive === false)) return false;
      if (statusFilter === 'inactive' && e.isActive !== 0 && e.isActive !== false) return false;
      if (storeFilter !== 'all' && e.storeId !== storeFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const fullName = `${e.firstName} ${e.lastName || ''}`.toLowerCase();
        const code = (e.employeeCode || '').toLowerCase();
        const title = (e.jobTitle || '').toLowerCase();
        const email = (e.email || '').toLowerCase();
        if (!fullName.includes(q) && !code.includes(q) && !title.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [employees, statusFilter, storeFilter, searchTerm]);

  const filteredAccessOnlyUsers = useMemo(() => accessOnlyUsers.filter(user => {
    if (statusFilter === 'active' && user.status !== 'active') return false;
    if (statusFilter === 'inactive' && user.status === 'active') return false;
    if (storeFilter !== 'all' && user.primaryStoreId !== storeFilter && user.storeId !== storeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!user.name.toLowerCase().includes(q) && !user.email.toLowerCase().includes(q) && !(user.roleNames || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [accessOnlyUsers, statusFilter, storeFilter, searchTerm]);

  const visibleMemberCount = filtered.length + filteredAccessOnlyUsers.length;

  /* ── handlers ─────────────────────────────────────────────────── */
  const handleAdd = () => { setEditingEmployee(null); setInitialUser(null); setFormOpen(true); };
  const handleEdit = (emp: Employee) => { setEditingEmployee(emp); setInitialUser(null); setFormOpen(true); };
  const handleAddEmployeeProfile = (user: User) => { setEditingEmployee(null); setInitialUser(user); setFormOpen(true); };
  const handleSaveAccessUser = async (userData: Partial<User> & { role?: UserRoleType; primaryStoreId?: string | null; status?: UserStatusType }) => {
    if (!editingAccessUser) return;
    await updateUser(editingAccessUser.id, userData);
    toast({ title: `${userData.name || editingAccessUser.name} updated` });
    setEditingAccessUser(null);
    refreshList();
  };
  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateEmployee(deactivateTarget.id);
      toast({ title: `${deactivateTarget.firstName} deactivated` });
      setDeactivateTarget(null);
      refreshList();
    } catch {
      toast({ title: 'Failed to deactivate', variant: 'destructive' });
    }
  };

  const handlePushIncentive = async (emp: Employee) => {
    if (!emp.paytimeEmployeeId) {
      toast({ title: 'Paytime employee ID not set', description: 'Edit the employee and add their Paytime ID first.', variant: 'destructive' });
      return;
    }
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      const perf = await getPerformance(emp.id, start, end);
      if (!perf.computedIncentive || perf.computedIncentive <= 0) {
        toast({ title: 'No incentive to push', description: 'Computed incentive is zero for this period.' });
        return;
      }
      const result = await pushPaytimeIncentive(emp.id, {
        periodStart: start, periodEnd: end, amount: perf.computedIncentive,
        note: `Zettaz sales incentive ${start} - ${end}`,
      });
      if (result.ok) {
        toast({ title: 'Incentive pushed to Paytime', description: `Amount: ${perf.computedIncentive}` });
      } else {
        toast({ title: 'Push failed', description: result.reason || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Push failed', description: message, variant: 'destructive' });
    }
  };

  /* ── render ────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Contact}
        title="Team Management"
        subtitle={`Manage people, employment profiles, login access, and performance${paytimeReady ? ' · Paytime connected' : ''}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/team/roles')}>
              <ShieldCheck className="h-4 w-4 mr-1.5" /> Roles & Permissions
            </Button>
            <Button onClick={handleAdd}><UserPlus className="h-4 w-4 mr-1.5" /> Add Team Member</Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Team Members', value: totalStaff, icon: Users, color: 'text-blue-600' },
          { label: 'Active', value: activeStaff, icon: Users, color: 'text-green-600' },
          { label: 'Login Accounts', value: linkedAccounts, icon: KeyRound, color: 'text-violet-600' },
          { label: 'No Login', value: missingAccounts, icon: Link2Off, color: 'text-amber-600' },
        ].map(item => {
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

      {/* Toolbar: search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, title, email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {stores.length > 1 && (
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading team...
        </div>
      ) : visibleMemberCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Contact className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {totalStaff === 0 ? 'No team members yet.' : 'No matches found.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalStaff === 0 ? 'Add your first team member to get started.' : 'Try adjusting your search or filters.'}
          </p>
          {totalStaff === 0 && (
            <Button variant="outline" size="sm" className="mt-4" onClick={handleAdd}>
              <UserPlus className="h-4 w-4 mr-1" /> Add Team Member
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Profile</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Store</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(emp => (
                <EmployeeRow
                  key={`employee-${emp.id}`}
                  employee={emp}
                  linkedUser={emp.userId ? userMap.get(emp.userId) : undefined}
                  stores={stores}
                  paytimeReady={paytimeReady}
                  onEdit={() => handleEdit(emp)}
                  onEditAccess={emp.userId && userMap.get(emp.userId) ? () => setEditingAccessUser(userMap.get(emp.userId)!) : undefined}
                  onPerformance={() => setPerfEmployee(emp)}
                  onDeactivate={() => setDeactivateTarget(emp)}
                  onPushIncentive={() => handlePushIncentive(emp)}
                />
              ))}
              {filteredAccessOnlyUsers.map(user => (
                <AccessOnlyRow
                  key={`user-${user.id}`}
                  user={user}
                  stores={stores}
                  onEditAccess={() => setEditingAccessUser(user)}
                  onAddEmployeeProfile={() => handleAddEmployeeProfile(user)}
                />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            Showing {visibleMemberCount} of {totalStaff} team members
          </div>
        </div>
      )}

      {/* Modals */}
      {formOpen && (
        <EmployeeFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          employee={editingEmployee}
          initialUser={initialUser}
          users={users}
          roles={roles}
          stores={stores}
          employees={employees}
          onSaved={() => { setFormOpen(false); refreshList(); }}
        />
      )}
      {editingAccessUser && (
        <UserFormModal
          isOpen={!!editingAccessUser}
          onClose={() => setEditingAccessUser(null)}
          onSave={(userData) => handleSaveAccessUser(userData)}
          userToEdit={editingAccessUser}
        />
      )}
      {perfEmployee && (
        <PerformanceDialog employee={perfEmployee} onClose={() => setPerfEmployee(null)} />
      )}
      <DeactivateConfirmDialog
        employee={deactivateTarget}
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
};

/* ── table row ────────────────────────────────────────────────────── */
interface EmployeeRowProps {
  employee: Employee;
  linkedUser?: User;
  stores: Store[];
  paytimeReady: boolean;
  onEdit: () => void;
  onEditAccess?: () => void;
  onPerformance: () => void;
  onDeactivate: () => void;
  onPushIncentive: () => void;
}

const EmployeeRow: React.FC<EmployeeRowProps> = ({
  employee, linkedUser, stores, paytimeReady, onEdit, onEditAccess, onPerformance, onDeactivate, onPushIncentive,
}) => {
  const isActive = employee.isActive !== 0 && employee.isActive !== false;
  const storeName = stores.find(s => s.id === employee.storeId)?.name;

  // derive role from linked user
  const firstRole = linkedUser?.roles?.[0];
  const roleName = linkedUser
    ? (linkedUser.roleNames || linkedUser.role_names || firstRole?.roleName || '')
    : '';

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      {/* Name + code + email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
            {employee.firstName[0]}{(employee.lastName || '')[0] || ''}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {employee.firstName} {employee.lastName || ''}
              {employee.employeeCode && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">#{employee.employeeCode}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {employee.email || 'No email'}
              {employee.commissionPct != null && <span className="ml-1.5">({employee.commissionPct}% commission)</span>}
            </p>
          </div>
        </div>
      </td>
      {/* Job Title */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-foreground">{employee.jobTitle || <span className="text-muted-foreground italic">Not set</span>}</span>
      </td>
      {/* Store */}
      <td className="px-4 py-3 hidden lg:table-cell">
        {storeName ? (
          <Badge variant="outline" className="font-normal"><StoreIcon className="h-3 w-3 mr-1" />{storeName}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </td>
      {/* Role */}
      <td className="px-4 py-3 hidden sm:table-cell">
        {linkedUser ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="font-normal">
              <ShieldCheck className="h-3 w-3 mr-1" />{roleName || 'User'}
            </Badge>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs italic">No account</span>
        )}
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant={isActive ? 'success' : 'destructive'} className="text-xs">
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" /> Edit profile
            </DropdownMenuItem>
            {onEditAccess && (
              <DropdownMenuItem onClick={onEditAccess}>
                <KeyRound className="h-4 w-4 mr-2" /> Manage login & access
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onPerformance}>
              <TrendingUp className="h-4 w-4 mr-2" /> Performance & Targets
            </DropdownMenuItem>
            {paytimeReady && (
              <DropdownMenuItem onClick={onPushIncentive}>
                <Send className="h-4 w-4 mr-2" /> Push Incentive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {isActive && (
              <DropdownMenuItem onClick={onDeactivate} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Deactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};

interface AccessOnlyRowProps {
  user: User;
  stores: Store[];
  onEditAccess: () => void;
  onAddEmployeeProfile: () => void;
}

const AccessOnlyRow: React.FC<AccessOnlyRowProps> = ({ user, stores, onEditAccess, onAddEmployeeProfile }) => {
  const storeId = user.primaryStoreId || user.storeId;
  const storeName = stores.find(store => store.id === storeId)?.name;
  const roleName = user.roleNames || user.role_names || 'No role';
  const isActive = user.status === 'active';
  const initials = user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-600 text-xs font-semibold shrink-0">
            {initials || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <Badge variant="outline" className="font-normal"><KeyRound className="h-3 w-3 mr-1" />Access only</Badge>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {storeName ? (
          <Badge variant="outline" className="font-normal"><StoreIcon className="h-3 w-3 mr-1" />{storeName}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">All stores</span>
        )}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <Badge variant="secondary" className="font-normal"><ShieldCheck className="h-3 w-3 mr-1" />{roleName}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={isActive ? 'success' : 'destructive'} className="text-xs">{isActive ? 'Active' : 'Inactive'}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onEditAccess}><KeyRound className="h-4 w-4 mr-2" />Edit login & access</DropdownMenuItem>
            <DropdownMenuItem onClick={onAddEmployeeProfile}><Briefcase className="h-4 w-4 mr-2" />Add employee profile</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};

/* ── Employee form dialog (Add / Edit) ────────────────────────────── */
interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  initialUser: User | null;
  users: User[];
  roles: Role[];
  stores: Store[];
  employees: Employee[];
  onSaved: () => void;
}

const EmployeeFormDialog: React.FC<EmployeeFormDialogProps> = ({
  open, onOpenChange, employee, initialUser, users, roles, stores, employees, onSaved,
}) => {
  const { toast } = useToast();
  const isEdit = !!employee;
  const isAddingProfile = !employee && !!initialUser;
  const hasExistingAccount = (isEdit && !!employee.userId) || isAddingProfile;

  // employee profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [commissionPct, setCommissionPct] = useState('');
  const [isSalesStaff, setIsSalesStaff] = useState(true);
  const [paytimeEmployeeId, setPaytimeEmployeeId] = useState('');
  const [storeId, setStoreId] = useState('none');

  // system access - for NEW team members: create account inline
  const [createAccount, setCreateAccount] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('none');
  const [accountActive, setAccountActive] = useState(true);

  // for EDIT: link to existing user account (when no account linked yet)
  const [linkMode, setLinkMode] = useState<'none' | 'existing'>('none');
  const [linkUserId, setLinkUserId] = useState('none');

  const [saving, setSaving] = useState(false);

  // available users (not already linked to another employee)
  const availableUsers = useMemo(() => {
    const linkedUserIds = new Set(
      employees
        .filter(e => e.userId && (!employee || e.id !== employee.id))
        .map(e => e.userId!)
    );
    return users.filter(u => !linkedUserIds.has(u.id));
  }, [users, employees, employee]);

  // linked user info for display
  const linkedUser = useMemo(() => {
    if (initialUser) return initialUser;
    if (!employee?.userId) return null;
    return users.find(u => u.id === employee.userId) || null;
  }, [employee, initialUser, users]);

  // hydrate on open
  useEffect(() => {
    if (employee) {
      setFirstName(employee.firstName || '');
      setLastName(employee.lastName || '');
      setEmployeeCode(employee.employeeCode || '');
      setJobTitle(employee.jobTitle || '');
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
      setCommissionPct(employee.commissionPct != null ? String(employee.commissionPct) : '');
      setIsSalesStaff(employee.isSalesStaff !== 0 && employee.isSalesStaff !== false);
      setPaytimeEmployeeId(employee.paytimeEmployeeId || '');
      setStoreId(employee.storeId || 'none');
      // edit mode
      setCreateAccount(false);
      setLoginEmail('');
      setPassword('');
      const account = employee.userId ? users.find(user => user.id === employee.userId) : null;
      setSelectedRoleId(roles.find(role => role.name === account?.roleNames)?.id || 'none');
      setAccountActive(account?.status !== 'inactive');
      setLinkMode('none');
      setLinkUserId('none');
    } else if (initialUser) {
      const [first, ...rest] = initialUser.name.trim().split(/\s+/);
      setFirstName(first || ''); setLastName(rest.join(' ')); setEmployeeCode(''); setJobTitle('');
      setEmail(initialUser.email || ''); setPhone(initialUser.phoneNumber || ''); setCommissionPct(''); setIsSalesStaff(true);
      setPaytimeEmployeeId('');
      setStoreId(initialUser.primaryStoreId || initialUser.storeId || (stores.length === 1 ? stores[0].id : 'none'));
      setCreateAccount(false);
      setLoginEmail(initialUser.email || '');
      setPassword('');
      setSelectedRoleId(roles.find(role => role.name === initialUser.roleNames)?.id || 'none');
      setAccountActive(initialUser.status !== 'inactive');
      setLinkMode('existing');
      setLinkUserId(initialUser.id);
    } else {
      // new mode - defaults
      setFirstName(''); setLastName(''); setEmployeeCode(''); setJobTitle('');
      setEmail(''); setPhone(''); setCommissionPct(''); setIsSalesStaff(true);
      setPaytimeEmployeeId('');
      setStoreId(stores.length === 1 ? stores[0].id : 'none');
      setCreateAccount(true);
      setLoginEmail('');
      setPassword('');
      setSelectedRoleId(roles.length > 0 ? roles[0].id : 'none');
      setAccountActive(true);
      setLinkMode('none');
      setLinkUserId('none');
    }
  }, [employee, initialUser, open, roles, stores, users]);

  // sync email fields: when employee email changes and create-account is on, mirror it
  useEffect(() => {
    if (!isEdit && createAccount && !loginEmail) {
      setLoginEmail(email);
    }
    // only auto-sync when email changes, not loginEmail
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast({ title: 'First name is required', variant: 'destructive' });
      return;
    }

    // validate account creation fields
    if (!isEdit && createAccount) {
      const accountEmail = loginEmail.trim() || email.trim();
      if (!accountEmail) {
        toast({ title: 'Email is required to create a login account', variant: 'destructive' });
        return;
      }
      if (!password.trim()) {
        toast({ title: 'Password is required for the new account', variant: 'destructive' });
        return;
      }
      if (password.trim().length < 6) {
        toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      // For edit mode, handle linking to existing user
      let editLinkUserId: string | null = null;
      if (linkMode === 'existing' && linkUserId !== 'none') {
        editLinkUserId = linkUserId;
      }

      // Build employee payload
      const empPayload: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        employeeCode: employeeCode.trim() || null,
        jobTitle: jobTitle.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        commissionPct: commissionPct === '' ? null : Number(commissionPct),
        isSalesStaff: isSalesStaff ? 1 : 0,
        paytimeEmployeeId: paytimeEmployeeId.trim() || null,
        storeId: storeId === 'none' ? null : storeId,
        userId: editLinkUserId || (hasExistingAccount ? employee?.userId : null),
      };

      // For new team member: attach account creation fields to the same request
      if (!isEdit && createAccount) {
        empPayload.createAccount = true;
        empPayload.accountEmail = loginEmail.trim() || email.trim();
        empPayload.accountPassword = password.trim();
        if (selectedRoleId !== 'none') {
          empPayload.roleId = selectedRoleId;
        }
      }
      if (isEdit && linkedUser) {
        empPayload.accountStatus = accountActive ? 'active' : 'inactive';
        if (selectedRoleId !== 'none') empPayload.accountRoleId = selectedRoleId;
      }

      if (isEdit) {
        await updateEmployee(employee.id, empPayload as Partial<Employee>);

        // assign role if linking to existing user
        if (editLinkUserId && selectedRoleId !== 'none') {
          try {
            await assignRolesToUser(editLinkUserId, [selectedRoleId]);
          } catch {
            toast({ title: 'Employee saved but role assignment failed', variant: 'destructive' });
          }
        }

        toast({ title: `${firstName} updated` });
      } else {
        const result = await createEmployee(empPayload as Partial<Employee>);
        const hasAccount = !!result.userId;
        toast({ title: `${firstName} added to the team${hasAccount ? ' with login account' : ''}` });
      }

      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Team Member' : isAddingProfile ? 'Add Employee Profile' : 'Add Team Member'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update employment details, store assignment, and login access.'
              : isAddingProfile
              ? `Add employment details for ${initialUser?.name}. Their existing login will stay linked.`
              : 'Add a new team member with an optional login account for POS access.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Section 1: Employee Profile */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-primary" /> Employee Profile
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name *</Label>
                <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employeeCode">Employee code</Label>
                <Input id="employeeCode" value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} placeholder="e.g. EMP-001" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input id="jobTitle" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Sales Associate" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empEmail">Email</Label>
                <Input id="empEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="employee@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
              </div>
            </div>
          </div>

          {/* Section 2: Store & Compensation */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" /> Store & Compensation
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stores.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Store assignment</Label>
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No store assigned</SelectItem>
                      {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="commissionPct">Commission %</Label>
                <Input id="commissionPct" type="number" step="0.01" value={commissionPct} onChange={e => setCommissionPct(e.target.value)} placeholder="e.g. 5.00" />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch checked={isSalesStaff} onCheckedChange={setIsSalesStaff} id="salesStaff" />
                  <Label htmlFor="salesStaff" className="text-sm font-normal">Sales staff</Label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paytimeId">Paytime Employee ID</Label>
                <Input id="paytimeId" value={paytimeEmployeeId} onChange={e => setPaytimeEmployeeId(e.target.value)} placeholder="Paytime ID (optional)" />
              </div>
            </div>
          </div>

          {/* Section 3: System Access */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-primary" /> System Access
            </h4>

            {/* NEW team member: create account toggle */}
            {!isEdit && !isAddingProfile && (
              <>
                <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <Switch checked={createAccount} onCheckedChange={setCreateAccount} id="createAccount" />
                  <div>
                    <Label htmlFor="createAccount" className="text-sm font-medium cursor-pointer">Create login account</Label>
                    <p className="text-xs text-muted-foreground">Allow this person to log into the POS system.</p>
                  </div>
                </div>
                {createAccount && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="loginEmail">Login email *</Label>
                      <Input
                        id="loginEmail" type="email"
                        value={loginEmail || email}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="login@company.com"
                      />
                      <p className="text-xs text-muted-foreground">Used for signing in. Defaults to employee email.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password" type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role *</Label>
                      <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Determines what this person can access.</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* EDIT: already has account */}
            {hasExistingAccount && linkedUser && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-green-50/60 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-foreground">Login account linked</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {linkedUser.email}
                    {linkedUser.roleNames && <> · <span className="font-medium text-foreground">{linkedUser.roleNames}</span></>}
                  </div>
                </div>
                {isEdit && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>
                          {roles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-border p-3 self-end">
                      <Switch checked={accountActive} onCheckedChange={setAccountActive} id="accountActive" />
                      <div>
                        <Label htmlFor="accountActive" className="cursor-pointer">Login active</Label>
                        <p className="text-xs text-muted-foreground">Controls access to the POS.</p>
                      </div>
                    </div>
                  </div>
                )}
                {isAddingProfile && (
                  <p className="text-xs text-muted-foreground">An employee profile will be added to this existing login account.</p>
                )}
              </div>
            )}

            {/* EDIT: no account yet - offer to link */}
            {isEdit && !hasExistingAccount && (
              <>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2Off className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-foreground">No login account</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This team member cannot log into the POS. Link an existing user account below if needed.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Link existing account</Label>
                    <Select value={linkUserId} onValueChange={v => { setLinkUserId(v); setLinkMode(v !== 'none' ? 'existing' : 'none'); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No account</SelectItem>
                        {availableUsers.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {linkMode === 'existing' && roles.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Assign role</Label>
                      <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Keep current role</SelectItem>
                          {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !firstName.trim()}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...</> : isEdit ? 'Save Changes' : isAddingProfile ? 'Add Employee Profile' : 'Add Team Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ── Performance dialog ───────────────────────────────────────────── */
const PerformanceDialog: React.FC<{ employee: Employee; onClose: () => void }> = ({ employee, onClose }) => {
  const [start, setStart] = useState(firstOfMonth());
  const [end, setEnd] = useState(today());
  const [perf, setPerf] = useState<EmployeePerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetVal, setTargetVal] = useState('');
  const [incentivePct, setIncentivePct] = useState('');
  const [bonusFlat, setBonusFlat] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setPerf(await getPerformance(employee.id, start, end)); }
    catch { setPerf(null); } finally { setLoading(false); }
  }, [employee.id, start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveTarget = async () => {
    setMsg(null);
    try {
      await setTarget(employee.id, {
        periodType: 'monthly', periodStart: start, periodEnd: end,
        targetAmount: Number(targetVal) || 0,
        incentivePct: incentivePct === '' ? null : Number(incentivePct),
        bonusFlat: bonusFlat === '' ? null : Number(bonusFlat),
      });
      setMsg('Target saved.');
      refresh();
    } catch {
      toast({ title: 'Failed to save target', variant: 'destructive' });
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee.firstName} {employee.lastName || ''} - Performance</DialogTitle>
          <DialogDescription>View sales performance and set targets for this team member.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-auto" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-auto" />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
        ) : perf ? (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Achieved" value={perf.achieved} />
            <StatCard label="Sales count" value={perf.numSales} />
            <StatCard label="Target" value={perf.target ?? '-'} />
            <StatCard label="Computed incentive" value={perf.computedIncentive} highlight={perf.metTarget ? 'green' : undefined} />
            {perf.target != null && (
              <div className="col-span-2 text-sm">
                {perf.metTarget
                  ? <span className="text-green-600 font-medium">Target met</span>
                  : <span className="text-muted-foreground">Below target</span>}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">No data for this period.</p>
        )}

        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" /> Set target for this period
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input type="number" placeholder="Target amount" value={targetVal} onChange={e => setTargetVal(e.target.value)} />
            <Input type="number" placeholder="Incentive % over target" value={incentivePct} onChange={e => setIncentivePct(e.target.value)} />
            <Input type="number" placeholder="Flat bonus" value={bonusFlat} onChange={e => setBonusFlat(e.target.value)} />
          </div>
          {msg && <p className="text-xs text-green-600 mt-2">{msg}</p>}
          <div className="flex justify-end mt-3">
            <Button onClick={saveTarget}>Save target</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ── stat card ────────────────────────────────────────────────────── */
const StatCard: React.FC<{ label: string; value: string | number; highlight?: 'green' }> = ({ label, value, highlight }) => (
  <div className={`rounded-lg p-3 ${highlight === 'green' ? 'bg-green-50 dark:bg-green-950/20' : 'bg-muted/50'}`}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold text-foreground">{value}</div>
  </div>
);

/* ── deactivate confirmation ──────────────────────────────────────── */
const DeactivateConfirmDialog: React.FC<{
  employee: Employee | null;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ employee, onConfirm, onCancel }) => (
  <Dialog open={!!employee} onOpenChange={open => { if (!open) onCancel(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Deactivate Team Member</DialogTitle>
        <DialogDescription>
          Are you sure you want to deactivate <strong>{employee?.firstName} {employee?.lastName || ''}</strong>?
          They will no longer appear in active staff lists.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="destructive" onClick={onConfirm}>Deactivate</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default EmployeesPage;
