import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserCircle, ShieldCheck, Bell, Building2, CreditCard, Loader2, Store as StoreIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getIndustries, getTenantIndustry, setTenantIndustry, setTenantName, getTenantProfile, updateTenantProfile } from '@/services/industryService';
import { clearIndustryCache } from '@/hooks/useIndustry';
import { getMyProfile, MeProfile } from '@/services/profileService';
import SettingsBilling from '../components/settings/SettingsBilling';
import PageHeader from '../components/common/PageHeader';
import ProfileSidebarCard from '../components/profile/ProfileSidebarCard';
import ProfileInfoCard from '../components/profile/ProfileInfoCard';
import ChangePasswordCard from '../components/profile/ChangePasswordCard';
import TwoFactorCard from '../components/profile/TwoFactorCard';
import SessionsCard from '../components/profile/SessionsCard';
import NotificationsCard from '../components/profile/NotificationsCard';
import StoresTab from '../components/profile/StoresTab';
import { COUNTRIES } from '@/data/localization/countries';

type TabId = 'profile' | 'security' | 'notifications' | 'business' | 'stores' | 'subscription';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: UserCircle },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'stores', label: 'Stores', icon: StoreIcon },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
];

const UserProfilePage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * The auth context can briefly hold a null user (e.g. a re-validation after
   * the tab has been backgrounded). Fall back to the cached user from storage,
   * same pattern as Sidebar.tsx's `effectiveUser`, so the Tenant Admin-only
   * tabs don't flicker away.
   */
  const cachedUser = useMemo(() => {
    if (user) return user;
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [user]);
  const effectiveUser: any = user || cachedUser;
  const isTenantAdmin = !!effectiveUser?.systemRoles?.includes('Tenant Admin');

  const visibleTabs = TABS.filter((tab) => tab.id === 'profile' || tab.id === 'security' || tab.id === 'notifications' || isTenantAdmin);

  const getTabFromUrl = (): TabId => {
    const tabId = new URLSearchParams(location.search).get('tab') as TabId | null;
    return tabId && visibleTabs.some((t) => t.id === tabId) ? tabId : 'profile';
  };

  const [activeTab, setActiveTab] = useState<TabId>(getTabFromUrl());

  useEffect(() => {
    const tabId = getTabFromUrl();
    if (tabId !== activeTab) setActiveTab(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, isTenantAdmin]);

  const handleTabClick = (tabId: TabId) => {
    setActiveTab(tabId);
    navigate(`${location.pathname}?tab=${tabId}`);
  };

  // ── Profile identity (hero + info card) ───────────────────────────────
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    // Seed instantly from the cached auth user (avoids a blank flash), then
    // overwrite with GET /users/me once it resolves for phone/avatar, which
    // aren't necessarily present on the cached auth user object.
    if (effectiveUser) {
      setProfile({
        id: effectiveUser.id,
        name: effectiveUser.name || '',
        email: effectiveUser.email || '',
        phoneNumber: effectiveUser.phoneNumber || null,
        profilePictureUrl: effectiveUser.profilePictureUrl || effectiveUser.avatar || null,
      });
    }
    getMyProfile()
      .then(setProfile)
      .catch(() => { /* falls back to whatever the cache seeded */ })
      .finally(() => setProfileLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Business tab (Tenant Admin only) ──────────────────────────────────────
  const [businessName, setBusinessName] = useState('');
  const [initialBusinessName, setInitialBusinessName] = useState('');
  const [industries, setIndustries] = useState<{ code: string; name: string; description?: string }[]>([]);
  const [industryCode, setIndustryCode] = useState<string>('');
  const [initialIndustry, setInitialIndustry] = useState<string>('');
  const [businessSaving, setBusinessSaving] = useState(false);

  // Company profile — contact/communication info for the COMPANY itself,
  // distinct from any individual store's own address/phone/email (see
  // General Settings for the per-store fields, and docs/17-migration-and-
  // roadmap/22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md for why
  // this needed its own columns rather than living only in onboarding's
  // one-time settings JSON write).
  const [companyProfile, setCompanyProfile] = useState({
    address: '', city: '', state: '', postalCode: '', countryCode: '',
    phone: '', email: '', website: '',
  });
  const [initialCompanyProfile, setInitialCompanyProfile] = useState(companyProfile);

  useEffect(() => {
    if (!isTenantAdmin) return;
    const cachedTenantName = effectiveUser?.tenantName || effectiveUser?.tenant?.name || '';
    setBusinessName(cachedTenantName);
    setInitialBusinessName(cachedTenantName);

    getTenantProfile()
      .then((profile) => {
        const name = profile?.name || '';
        setBusinessName(name);
        setInitialBusinessName(name);

        const loadedProfile = {
          address: profile?.address || '',
          city: profile?.city || '',
          state: profile?.state || '',
          postalCode: profile?.postalCode || '',
          countryCode: profile?.countryCode || '',
          phone: profile?.phone || '',
          email: profile?.email || '',
          website: profile?.website || '',
        };
        setCompanyProfile(loadedProfile);
        setInitialCompanyProfile(loadedProfile);
      })
      .catch(() => { /* falls back to whatever the cache seeded, if anything */ });

    Promise.all([getIndustries(), getTenantIndustry()])
      .then(([list, code]) => {
        setIndustries(list || []);
        setIndustryCode(code || 'general_retail');
        setInitialIndustry(code || 'general_retail');
      })
      .catch(() => { /* industry selector simply won't render */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTenantAdmin]);

  const handleBusinessSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessSaving(true);
    try {
      const nameChanged = businessName.trim() && businessName.trim() !== initialBusinessName;
      if (nameChanged) {
        await setTenantName(businessName.trim());
        setInitialBusinessName(businessName.trim());
      }

      const industryChanged = industryCode && industryCode !== initialIndustry;
      if (industryChanged) {
        await setTenantIndustry(industryCode);
        clearIndustryCache();
      }

      const profileChanges = Object.fromEntries(
        Object.entries(companyProfile).filter(
          ([key, value]) => value !== (initialCompanyProfile as any)[key],
        ),
      );
      const profileChanged = Object.keys(profileChanges).length > 0;
      if (profileChanged) {
        await updateTenantProfile(profileChanges);
        setInitialCompanyProfile(companyProfile);
      }

      toast.success('Business settings saved successfully!');

      if (industryChanged) {
        setInitialIndustry(industryCode);
        setTimeout(() => window.location.reload(), 900);
      }
    } catch (error: any) {
      console.error('Failed to save business settings:', error);
      toast.error(error?.response?.data?.message || 'Failed to save business settings.');
    } finally {
      setBusinessSaving(false);
    }
  };

  const roleLabel = isTenantAdmin
    ? 'Tenant Admin'
    : (effectiveUser?.systemRoles?.[0] || effectiveUser?.roles?.[0] || null);

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader title="My Profile" subtitle="Manage your personal information, security, and preferences." />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        <ProfileSidebarCard
          name={profile?.name || effectiveUser?.name || 'User'}
          email={profile?.email || effectiveUser?.email || ''}
          userId={profile?.id || effectiveUser?.id || 'user'}
          avatarUrl={profile?.profilePictureUrl || null}
          onAvatarChange={(url) => setProfile((prev) => prev ? { ...prev, profilePictureUrl: url } : prev)}
          roleLabel={roleLabel}
          tabs={visibleTabs}
          activeTab={activeTab}
          onTabChange={(id) => handleTabClick(id as TabId)}
        />

        <div className="min-w-0">
          {activeTab === 'profile' && (
            profileLoading && !profile ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading profile…
              </div>
            ) : (
              <ProfileInfoCard
                name={profile?.name || ''}
                email={profile?.email || ''}
                phoneNumber={profile?.phoneNumber || ''}
                onSaved={({ name, phoneNumber }) =>
                  setProfile((prev) => prev ? { ...prev, name, phoneNumber } : prev)
                }
              />
            )
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <ChangePasswordCard />
              <TwoFactorCard />
              <SessionsCard />
            </div>
          )}

          {activeTab === 'notifications' && (
            <NotificationsCard />
          )}

          {activeTab === 'business' && isTenantAdmin && (
            <form onSubmit={handleBusinessSave}>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Business settings
                </h3>
                <p className="text-sm text-warning-text bg-warning-light rounded-lg px-3 py-2">
                  These settings affect your whole business across every store — not just this profile.
                </p>
                <div>
                  <label htmlFor="businessName" className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Business Name
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    placeholder="e.g. Zettaz Jewellers Group"
                  />
                </div>
                {industries.length > 0 && (
                  <div>
                    <label htmlFor="industryCode" className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Business Type
                    </label>
                    <select
                      id="industryCode"
                      name="industryCode"
                      value={industryCode}
                      onChange={(e) => setIndustryCode(e.target.value)}
                      className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    >
                      {industries.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
                    </select>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      This is your company-wide default — it applies to every store that hasn't been given its own override.
                      Determines which product fields and features are available for those stores. Changing hides fields from the
                      previous type but never deletes data. To give one specific store a different business type (e.g. a jewellery
                      counter within an otherwise general-retail company), use that store's General Settings instead — it won't
                      affect this default or any other store.
                    </p>
                  </div>
                )}

                <div className="pt-1 border-t border-border">
                  <h4 className="text-xs font-semibold text-foreground mt-4 mb-1">Company Contact Information</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Your company's own contact details — distinct from any individual store's address, phone, or email
                    (those are set per-store in that store's General Settings).
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="companyAddress" className="block text-xs font-medium text-muted-foreground mb-1.5">Address</label>
                      <input
                        type="text" id="companyAddress"
                        value={companyProfile.address}
                        onChange={(e) => setCompanyProfile((p) => ({ ...p, address: e.target.value }))}
                        className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyCity" className="block text-xs font-medium text-muted-foreground mb-1.5">City</label>
                      <input
                        type="text" id="companyCity"
                        value={companyProfile.city}
                        onChange={(e) => setCompanyProfile((p) => ({ ...p, city: e.target.value }))}
                        className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyState" className="block text-xs font-medium text-muted-foreground mb-1.5">State / Province</label>
                      <input
                        type="text" id="companyState"
                        value={companyProfile.state}
                        onChange={(e) => setCompanyProfile((p) => ({ ...p, state: e.target.value }))}
                        className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyPostalCode" className="block text-xs font-medium text-muted-foreground mb-1.5">Postal Code</label>
                      <input
                        type="text" id="companyPostalCode"
                        value={companyProfile.postalCode}
                        onChange={(e) => setCompanyProfile((p) => ({ ...p, postalCode: e.target.value }))}
                        className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyCountryCode" className="block text-xs font-medium text-muted-foreground mb-1.5">Country</label>
                      <select
                        id="companyCountryCode"
                        value={companyProfile.countryCode}
                        onChange={(e) => setCompanyProfile((p) => ({ ...p, countryCode: e.target.value }))}
                        className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      >
                        <option value="">Select country...</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="companyPhone" className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
                      <input
                        type="tel" id="companyPhone"
                        value={companyProfile.phone}
                        onChange={(e) => setCompanyProfile((p) => ({ ...p, phone: e.target.value }))}
                        className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="companyEmail" className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                      <input
                        type="email" id="companyEmail"
                        value={companyProfile.email}
                        onChange={(e) => setCompanyProfile((p) => ({ ...p, email: e.target.value }))}
                        className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        placeholder="hello@yourcompany.com"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="companyWebsite" className="block text-xs font-medium text-muted-foreground mb-1.5">Website</label>
                      <input
                        type="url" id="companyWebsite"
                        value={companyProfile.website}
                        onChange={(e) => setCompanyProfile((p) => ({ ...p, website: e.target.value }))}
                        className="block w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        placeholder="https://yourcompany.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={businessSaving}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-60"
                  >
                    {businessSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeTab === 'stores' && isTenantAdmin && (
            <StoresTab />
          )}

          {activeTab === 'subscription' && isTenantAdmin && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <SettingsBilling />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
