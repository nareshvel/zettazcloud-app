import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useIndustry } from '@/hooks/useIndustry';
import {
  Building, Bell, Shield, Coins, Printer, Landmark, WalletCards, Hash, Link2, ChevronRight, Layers, Settings as SettingsIcon,
  Gem, Share2,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';

import GeneralSettings from '../components/settings/GeneralSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import NotificationsSettings from '../components/settings/NotificationsSettings';
import LocalizationSettings from '../components/settings/LocalizationSettings';
import PrinterSettings from '../components/settings/PrinterSettings';
import SettingsTaxes from '../components/settings/SettingsTaxes';
import CostCodeSettings from '../components/settings/CostCodeSettings';
import SettingsPayments from '../components/settings/SettingsPayments';
import PaytimeSettings from '../components/settings/PaytimeSettings';
import IndustryFieldSettings from '../components/settings/IndustryFieldSettings';
import MetalRatesPage from './MetalRatesPage';
import CatalogSyncPage from './CatalogSyncPage';

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ElementType;
  component: React.ElementType;
  description: string;
  /** Restrict this tab to specific tenant industries, same convention as Sidebar.tsx. */
  industries?: string[];
}

interface SettingsGroup {
  label: string;
  tabs: SettingsTab[];
}

const GROUPS: SettingsGroup[] = [
  {
    label: 'Store',
    tabs: [
      { id: 'general',      label: 'General',      icon: Building,     component: GeneralSettings,      description: 'Store name, contact info and business type' },
      // Coins, not Globe — this tab's most-used field is Currency, not
      // language/region; a currency-shaped icon reads faster than a generic
      // globe for what's actually being configured here.
      { id: 'localization', label: 'Localization',  icon: Coins,        component: LocalizationSettings, description: 'Language, currency, date and number formats' },
    ],
  },
  {
    label: 'Operations',
    tabs: [
      // Landmark (government/tax-office building) reads as "tax" far more
      // directly than a bare Percent sign, which is too generic — percent
      // signs show up all over the app for discounts, margins, etc.
      { id: 'taxes',        label: 'Taxes',         icon: Landmark,     component: SettingsTaxes,        description: 'Tax classes, rates and store tax configuration' },
      { id: 'printer',      label: 'Printers',      icon: Printer,      component: PrinterSettings,      description: 'Receipt printer mode, paper size and templates' },
      { id: 'costCode',     label: 'Cost Code',     icon: Hash,         component: CostCodeSettings,     description: 'Tag cipher to encode cost prices for staff' },
    ],
  },
  {
    label: 'Commerce',
    tabs: [
      { id: 'paymentGateways', label: 'Payments',   icon: WalletCards,  component: SettingsPayments,     description: 'Payment methods and gateway configuration' },
    ],
  },
  {
    label: 'Catalog',
    tabs: [
      // Coins — Metal Rates is about pricing/valuation, not the jewelry
      // itself, so it keeps Gem free for Sales Hub (see Sidebar.tsx) rather
      // than two unrelated nav items competing for the same icon.
      { id: 'metalRates', label: 'Metal Rates', icon: Coins, component: MetalRatesPage, description: 'Rate cards, history and market-rate publishing', industries: ['jewelry'] },
      { id: 'catalogChannels', label: 'Sales Channels', icon: Share2, component: CatalogSyncPage, description: 'Catalog sync to external marketplaces' },
    ],
  },
  {
    label: 'People',
    tabs: [
      { id: 'security',      label: 'Security',     icon: Shield,       component: SecuritySettings,     description: 'Two-factor auth and account security' },
      { id: 'notifications', label: 'Notifications',icon: Bell,         component: NotificationsSettings,description: 'Email and in-app notification preferences' },
    ],
  },
  {
    label: 'Integrations',
    tabs: [
      { id: 'paytime', label: 'Paytime', icon: Link2, component: PaytimeSettings, description: 'Connect Paytime payroll for employee incentives' },
    ],
  },
  {
    label: 'Advanced',
    tabs: [
      { id: 'industryFields', label: 'Industry Fields', icon: Layers, component: IndustryFieldSettings, description: 'Show, hide, relabel or add custom product fields for your industry' },
    ],
  },
];

const ALL_TABS = GROUPS.flatMap(g => g.tabs);

const Settings: React.FC = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { industry } = useIndustry();

  // Same industry-gating convention as Sidebar.tsx: a tab without an
  // `industries` list is shown to everyone; while industry is still
  // resolving, gated tabs stay hidden to avoid a flash of the wrong menu.
  const visibleGroups = GROUPS
    .map((group) => ({
      ...group,
      tabs: group.tabs.filter((tab) => !tab.industries || (industry && tab.industries.includes(industry))),
    }))
    .filter((group) => group.tabs.length > 0);

  const getTabFromUrl = () => {
    const tabId = new URLSearchParams(location.search).get('tab');
    return ALL_TABS.some(tab => tab.id === tabId) ? tabId! : 'general';
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl());

  useEffect(() => {
    const tabId = getTabFromUrl();
    if (tabId !== activeTab) setActiveTab(tabId);
  }, [location.search]);

  const handleTabClick = (tab: SettingsTab) => {
    setActiveTab(tab.id);
    navigate(`${location.pathname}?tab=${tab.id}`);
  };

  const currentTab = ALL_TABS.find(tab => tab.id === activeTab)!;
  const ActiveComponent = currentTab.component;

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={SettingsIcon}
        title={t('settings:title', { defaultValue: 'Settings' })}
        subtitle={t('settings:subtitle', { defaultValue: 'Manage your store settings and preferences.' })}
      />

      <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Mobile dropdown ── */}
          <div className="lg:hidden">
            <select
              value={activeTab}
              onChange={(e) => {
                const tab = ALL_TABS.find((t) => t.id === e.target.value);
                if (tab) handleTabClick(tab);
              }}
              className="block w-full px-3 py-2.5 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {visibleGroups.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.tabs.map(tab => (
                    <option key={tab.id} value={tab.id}>{tab.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* ── Desktop sidebar ── */}
          <aside className="hidden lg:block w-56 shrink-0">
            <nav className="sticky top-24 space-y-6">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-muted-foreground">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.tabs.map((tab) => {
                      const active = activeTab === tab.id;
                      return (
                        <li key={tab.id}>
                          <button
                            onClick={() => handleTabClick(tab)}
                            className={`
                              w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                              ${active
                                ? 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary border-l-2 border-primary'
                                : 'text-gray-600 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted/60 hover:text-gray-900 dark:hover:text-foreground border-l-2 border-transparent'}
                            `}
                          >
                            <tab.icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-gray-400 dark:text-muted-foreground'}`} />
                            <span className="flex-1 text-left">{tab.label}</span>
                            {active && <ChevronRight className="h-3.5 w-3.5 text-primary/60" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* ── Content area ── */}
          <div className="flex-1 min-w-0">
            <ActiveComponent />
          </div>
        </div>
      </div>
  );
};

export default Settings;
