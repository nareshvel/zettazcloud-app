import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Store,
  Sparkles,
  Building2,
  Globe,
  DollarSign,
  Clock
} from 'lucide-react';
import { COUNTRIES } from '../data/localization/countries';
import { CURRENCIES } from '../data/localization/currencies';
import { TIMEZONES } from '../data/localization/timezones';
import { getIndustries } from '@/services/industryService';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface BusinessInfo {
  businessName: string;
  businessType: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  website: string;
  countryCode: string;
  isDutyFree: boolean;
}

interface StoreInfo {
  storeName: string;
  currency: string;
  timezone: string;
}

const OnboardingWizard = () => {
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form data states
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    businessName: '',
    businessType: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    website: '',
    countryCode: 'US',
    isDutyFree: false
  });

  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    storeName: '',
    currency: 'USD',
    timezone: 'America/New_York'
  });

  // Real industry list — same call GeneralSettings.tsx makes (GET /api/industry/industries,
  // DB-backed, `is_active = 1` only) so this dropdown can never drift from Settings' list or
  // silently include an industry (e.g. pharmacy) that's deliberately held back elsewhere.
  const [industries, setIndustries] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    getIndustries()
      .then((list) => {
        setIndustries(list);
        // Default to general_retail (or whatever sorts first) once loaded, rather than
        // leaving the select on an empty value until the user makes a choice.
        setBusinessInfo((prev) => {
          if (prev.businessType) return prev;
          const fallback = list.find((i) => i.code === 'general_retail') || list[0];
          return fallback ? { ...prev, businessType: fallback.code } : prev;
        });
      })
      .catch(() => { /* dropdown simply won't render options; user can still type a business name and proceed */ });
  }, []);

  // Get user info from URL params (passed from email verification)
  const userEmail = searchParams.get('email') || '';
  const userName = searchParams.get('name') || '';

  // Fetch existing tenant/user data to pre-populate business information
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Use the correct token key — the verification page stores the
        // token as 'auth_token', not 'authToken'. Previously this used
        // 'authToken' which was always null, so the pre-population fetch
        // never ran and the business name entered at signup was silently
        // lost.
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.warn('No auth token found, cannot pre-populate business info');
          return;
        }

        // VITE_API_BASE_URL is the server ROOT without /api (e.g.
        // http://localhost:5172) — the /api segment must be added here.
        // Previously this fell back to 'http://localhost:5172/api' AND
        // appended /users/me, but when VITE_API_BASE_URL was set (which
        // it always is in .env.development.local), the URL became
        // http://localhost:5172/users/me — missing /api entirely → 404.
        const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172')
          .replace(/\/api\/?$/, '') + '/api';
        const response = await fetch(`${baseUrl}/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('User data for pre-population:', userData);
          
          // Pre-populate business information from user data
          // Check multiple possible sources for business name
          const businessName = userData.tenant?.name || 
                              userData.businessName || 
                              userData.user?.businessName ||
                              '';
          
          if (businessName) {
            setBusinessInfo(prev => ({
              ...prev,
              businessName: businessName,
              phone: userData.phone || userData.user?.phone || prev.phone
            }));
            
            // Also pre-populate store name based on business name
            setStoreInfo(prev => ({
              ...prev,
              storeName: businessName
            }));
          } else {
            // If no business name found, at least populate phone
            setBusinessInfo(prev => ({
              ...prev,
              phone: userData.phone || userData.user?.phone || prev.phone
            }));
          }
        } else {
          console.warn('Failed to fetch user data for pre-population:', response.status);
        }
      } catch (error) {
        console.error('Error fetching user data for onboarding:', error);
      }
    };

    fetchUserData();
  }, []); // Run once on component mount

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Zettaz Cloud',
      description: 'Let\'s get your business set up in just a few steps',
      icon: <Sparkles className="w-6 h-6" />,
      completed: false
    },
    {
      id: 'business',
      title: 'Business Information',
      description: 'Tell us about your business',
      icon: <Building2 className="w-6 h-6" />,
      completed: false
    },
    {
      id: 'store',
      title: 'Store Setup',
      description: 'Configure your first store',
      icon: <Store className="w-6 h-6" />,
      completed: false
    },
    {
      id: 'complete',
      title: 'Review & Complete',
      description: 'Review your settings and complete setup',
      icon: <CheckCircle className="w-6 h-6" />,
      completed: false
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    // Prevent multiple simultaneous submissions
    if (isLoading) {
      console.log('⚠️ Onboarding submission already in progress, ignoring duplicate request');
      return;
    }

    setIsLoading(true);
    
    try {
      // Validate required fields before submission
      if (!businessInfo.businessName || !businessInfo.businessType) {
        throw new Error('Please fill in all required business information');
      }
      
      if (!storeInfo.storeName || !storeInfo.currency || !storeInfo.timezone) {
        throw new Error('Please fill in all required store information');
      }

      // Submit onboarding data to backend
      const onboardingData = {
        businessInfo,
        storeInfo
      };

      console.log('✅ Submitting onboarding data:', onboardingData);
      
      // Get auth token from localStorage (using correct key)
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Submit to backend API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(onboardingData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Server error: ${response.status}`);
      }

      console.log('✅ Onboarding completed successfully:', result);

      // Persist refreshed token from backend so headers include correct tenant/store
      const refreshedToken = result?.data?.token;
      if (refreshedToken) {
        // Clear stale cached user — the onboarding completion may have
        // changed store_id / tenant settings, and a stale cache would
        // cause getCurrentUser() to return old data on the next page
        // load (e.g. mock store data on the settings page).
        localStorage.removeItem('currentUser');
        localStorage.removeItem('tenant_id');
        localStorage.removeItem('store_id');
        localStorage.setItem('auth_token', refreshedToken);
      }
      
      // Brief delay to show completion state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to dashboard after successful completion
      console.log('🔄 Redirecting to dashboard...');
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('❌ Onboarding error:', error);
      
      let errorMessage = 'Failed to complete onboarding. Please try again.';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show user-friendly error message
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderWelcomeStep = () => (
    <div className="text-center">
      <div className="mb-8">
        <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-4">
          Welcome to Zettaz Cloud, {userName}!
        </h2>
        <p className="text-lg text-gray-600 dark:text-muted-foreground mb-8">
          Your account has been verified successfully. Let's set up your business in just a few quick steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg">
          <Building2 className="w-8 h-8 text-primary mb-3 mx-auto" />
          <h3 className="font-semibold text-gray-900 dark:text-foreground mb-2">Business Setup</h3>
          <p className="text-sm text-gray-600 dark:text-muted-foreground">Configure your business information and preferences</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg">
          <Store className="w-8 h-8 text-green-600 mb-3 mx-auto" />
          <h3 className="font-semibold text-gray-900 dark:text-foreground mb-2">Store Configuration</h3>
          <p className="text-sm text-gray-600 dark:text-muted-foreground">Set up your first store and inventory settings</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <CheckCircle className="w-8 h-8 text-purple-600 mb-3 mx-auto" />
          <h3 className="font-semibold text-gray-900 dark:text-foreground mb-2">Ready to Go</h3>
          <p className="text-sm text-gray-600 dark:text-muted-foreground">Start processing sales and managing inventory</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <p className="text-sm text-blue-800">
          <strong>14-day free trial:</strong> No credit card required. Cancel anytime.
        </p>
      </div>
    </div>
  );

  const renderBusinessStep = () => (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">Business Information</h2>
        <p className="text-gray-600 dark:text-muted-foreground">Tell us about your business to personalize your experience</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              Business Name *
            </label>
            <input
              type="text"
              required
              value={businessInfo.businessName}
              onChange={(e) => setBusinessInfo({...businessInfo, businessName: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
              placeholder="Enter your business name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              Business Type *
            </label>
            <select
              required
              value={businessInfo.businessType}
              onChange={(e) => setBusinessInfo({...businessInfo, businessType: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
            >
              {industries.map(i => (
                <option key={i.code} value={i.code}>{i.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
            Business Address
          </label>
          <input
            type="text"
            value={businessInfo.address}
            onChange={(e) => setBusinessInfo({...businessInfo, address: e.target.value})}
            className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
            placeholder="Street address"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              City
            </label>
            <input
              type="text"
              value={businessInfo.city}
              onChange={(e) => setBusinessInfo({...businessInfo, city: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
              placeholder="City"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              State
            </label>
            <input
              type="text"
              value={businessInfo.state}
              onChange={(e) => setBusinessInfo({...businessInfo, state: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
              placeholder="State"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              ZIP Code
            </label>
            <input
              type="text"
              value={businessInfo.zipCode}
              onChange={(e) => setBusinessInfo({...businessInfo, zipCode: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
              placeholder="ZIP"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={businessInfo.phone}
              onChange={(e) => setBusinessInfo({...businessInfo, phone: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              Website (Optional)
            </label>
            <input
              type="url"
              value={businessInfo.website}
              onChange={(e) => setBusinessInfo({...businessInfo, website: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
              placeholder="https://www.yourbusiness.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
            <Globe className="inline w-4 h-4 mr-2" />
            Country *
          </label>
          <select
            required
            value={businessInfo.countryCode}
            onChange={(e) => setBusinessInfo({...businessInfo, countryCode: e.target.value})}
            className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
          >
            {COUNTRIES.map(country => (
              <option key={country.code} value={country.code}>
                {country.name} ({country.code})
              </option>
            ))}
          </select>
        </div>

        {/* Duty-free toggle — determines which print templates are seeded.
            A duty-free store sells to departing travellers with tax
            zero-rated, so it needs a duty-free invoice/receipt template
            in addition to the standard set for its industry. This flag
            is passed to the backend at onboarding completion, which sets
            store_jurisdiction_settings.sales_mode = 'duty_free' BEFORE
            provisioning templates so the correct duty-free templates are
            included. It can be changed later in Settings → General. */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={businessInfo.isDutyFree}
              onChange={(e) => setBusinessInfo({...businessInfo, isDutyFree: e.target.checked})}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-semibold text-gray-900 dark:text-foreground">
                Duty-Free Store
              </span>
              <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">
                Check this if your store sells duty-free or export goods to departing travellers.
                This will configure tax-free sales and add duty-free invoice templates for your industry.
                You can change this later in Settings.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderStoreStep = () => (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">Store Setup</h2>
        <p className="text-gray-600 dark:text-muted-foreground">Configure your first store location and preferences</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              Store Name *
            </label>
            <input
              type="text"
              required
              value={storeInfo.storeName}
              onChange={(e) => setStoreInfo({...storeInfo, storeName: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
              placeholder="Main Store, Downtown Location, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              Business Type
            </label>
            {/* Read-only — already chosen on the previous step, and nothing downstream
                reads a separate "store type", so asking the same question twice with an
                answer nobody used was just confusing. Shown here as confirmation, with a
                way back if it needs changing. */}
            <div className="w-full px-4 py-3 border border-gray-200 dark:border-border rounded-lg bg-gray-50 dark:bg-muted/40 text-gray-700 dark:text-muted-foreground flex items-center justify-between">
              <span>{industries.find(i => i.code === businessInfo.businessType)?.name || '—'}</span>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Change
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              <DollarSign className="inline w-4 h-4 mr-2" />
              Currency *
            </label>
            <select
              required
              value={storeInfo.currency}
              onChange={(e) => setStoreInfo({...storeInfo, currency: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
            >
              {CURRENCIES.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name} ({currency.symbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
              <Clock className="inline w-4 h-4 mr-2" />
              Timezone *
            </label>
            <select
              required
              value={storeInfo.timezone}
              onChange={(e) => setStoreInfo({...storeInfo, timezone: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-blue-500"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-2">What's Next?</h3>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Add your first products and inventory</li>
            <li>• Set up payment methods and tax settings</li>
            <li>• Invite team members and assign roles</li>
            <li>• Start processing your first sales</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div>
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">
          Review & Complete
        </h2>
        <p className="text-gray-600 dark:text-muted-foreground">
          Please review your settings below. Click <strong>Complete Setup</strong> to save and finish.
        </p>
      </div>

      {/* Business Information Review */}
      <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-foreground flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-primary" />
            Business Information
          </h3>
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="text-sm text-primary hover:underline font-medium"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><strong className="text-gray-700 dark:text-foreground">Business Name:</strong> <span className="text-gray-600 dark:text-muted-foreground">{businessInfo.businessName}</span></div>
          <div><strong className="text-gray-700 dark:text-foreground">Business Type:</strong> <span className="text-gray-600 dark:text-muted-foreground">{industries.find(i => i.code === businessInfo.businessType)?.name || businessInfo.businessType}</span></div>
          {businessInfo.address && <div><strong className="text-gray-700 dark:text-foreground">Address:</strong> <span className="text-gray-600 dark:text-muted-foreground">{[businessInfo.address, businessInfo.city, businessInfo.state, businessInfo.zipCode].filter(Boolean).join(', ')}</span></div>}
          {businessInfo.phone && <div><strong className="text-gray-700 dark:text-foreground">Phone:</strong> <span className="text-gray-600 dark:text-muted-foreground">{businessInfo.phone}</span></div>}
          {businessInfo.website && <div><strong className="text-gray-700 dark:text-foreground">Website:</strong> <span className="text-gray-600 dark:text-muted-foreground">{businessInfo.website}</span></div>}
          {businessInfo.countryCode && <div><strong className="text-gray-700 dark:text-foreground">Country:</strong> <span className="text-gray-600 dark:text-muted-foreground">{businessInfo.countryCode}</span></div>}
          {businessInfo.isDutyFree && <div><strong className="text-gray-700 dark:text-foreground">Sales Mode:</strong> <span className="text-blue-600 font-medium">Duty-Free</span></div>}
        </div>
      </div>

      {/* Store Setup Review */}
      <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-foreground flex items-center">
            <Store className="w-5 h-5 mr-2 text-primary" />
            Store Setup
          </h3>
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className="text-sm text-primary hover:underline font-medium"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><strong className="text-gray-700 dark:text-foreground">Store Name:</strong> <span className="text-gray-600 dark:text-muted-foreground">{storeInfo.storeName}</span></div>
          <div><strong className="text-gray-700 dark:text-foreground">Currency:</strong> <span className="text-gray-600 dark:text-muted-foreground">{CURRENCIES.find(c => c.code === storeInfo.currency)?.name || storeInfo.currency}</span></div>
          <div><strong className="text-gray-700 dark:text-foreground">Timezone:</strong> <span className="text-gray-600 dark:text-muted-foreground">{storeInfo.timezone}</span></div>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-blue-900 mb-3">Account Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><strong className="text-blue-900">Email:</strong> <span className="text-blue-800">{userEmail}</span></div>
          <div><strong className="text-blue-900">Name:</strong> <span className="text-blue-800">{userName}</span></div>
          {/* TODO (Stripe Billing Module, 2026-08-31): hardcoded — the trial
              is genuinely always 14 days at this exact moment (signup just
              completed), so this isn't wrong today, but it's not computed
              from real trial_end_date either. The real, always-correct
              trial countdown lives in Settings → Billing
              (SettingsBilling.tsx), which computes it from the live
              subscription's trial_end_date. */}
          <div><strong className="text-blue-900">Trial:</strong> <span className="text-blue-800">14 days remaining</span></div>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-muted-foreground">
        Click <strong>Complete Setup</strong> below to save your configuration and start using Zettaz Cloud.
      </p>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderWelcomeStep();
      case 1:
        return renderBusinessStep();
      case 2:
        return renderStoreStep();
      case 3:
        return renderCompleteStep();
      default:
        return renderWelcomeStep();
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return businessInfo.businessName.trim() !== '' && businessInfo.businessType !== '';
      case 2:
        return storeInfo.storeName.trim() !== '' && storeInfo.currency !== '' && storeInfo.timezone !== '';
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/images/zettaz-cloud-logo-dark.png" 
            alt="Zettaz Cloud Logo" 
            className="h-10 w-auto mx-auto mb-4" 
          />
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  index <= currentStep 
                    ? 'bg-primary border-blue-600 text-white' 
                    : 'bg-white dark:bg-card border-gray-300 dark:border-border text-gray-400'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-full h-0.5 mx-4 ${
                    index < currentStep ? 'bg-primary' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4">
            {steps.map((step, index) => (
              <div key={step.id} className="text-center" style={{ width: '200px' }}>
                <p className={`text-sm font-semibold ${
                  index <= currentStep ? 'text-primary' : 'text-gray-400'
                }`}>
                  {step.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-card rounded-2xl shadow-xl p-8 mb-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`inline-flex items-center px-6 py-3 border border-gray-300 dark:border-border rounded-lg text-sm font-semibold transition-colors duration-200 ${
              currentStep === 0
                ? 'text-gray-400 dark:text-muted-foreground cursor-not-allowed'
                : 'text-gray-700 dark:text-foreground hover:bg-gray-50'
            }`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className={`inline-flex items-center px-6 py-3 border border-transparent rounded-lg text-sm font-semibold text-white transition-all duration-200 ${
                isStepValid()
                  ? 'bg-primary hover:bg-primary/90 hover:shadow-lg transform hover:-translate-y-0.5'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isLoading || !isStepValid()}
              className={`inline-flex items-center px-8 py-3 border border-transparent rounded-lg text-sm font-semibold text-white transition-all duration-200 ${
                isLoading || !isStepValid()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Setting up...
                </>
              ) : (
                <>
                  Complete Setup
                  <CheckCircle className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
