import { Play, CreditCard, Package, Users, Settings, BarChart3 } from 'lucide-react';
import { HelpCategory } from '../types';

export const helpCategories: HelpCategory[] = [
  { id: 'getting-started', label: 'Getting Started', icon: Play, color: 'bg-green-100 text-green-700', description: 'Essential setup guides' },
  { id: 'pos', label: 'Point of Sale', icon: CreditCard, color: 'bg-blue-100 text-blue-700', description: 'Transaction processing' },
  { id: 'inventory', label: 'Inventory', icon: Package, color: 'bg-purple-100 text-purple-700', description: 'Product management' },
  { id: 'users', label: 'User Management', icon: Users, color: 'bg-orange-100 text-orange-700', description: 'Roles & permissions' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'bg-gray-100 text-gray-700', description: 'System configuration' },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: 'bg-indigo-100 text-indigo-700', description: 'Analytics & insights' },
];
