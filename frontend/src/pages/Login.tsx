import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User } from '@/types';
import { hasPermission } from '@/utils/permissionUtils';
import { getTenantIndustry } from '@/services/industryService';
import { hasSalesHub } from '@/utils/salesHubIndustries';
import { TwoFactorRequiredError } from '@/services/authService';
import { Eye, EyeOff, Mail, Lock, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';

const Login = () => {
  const { login, verifyTwoFactor, isLoading, error: authError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── 2FA second step ────────────────────────────────────────────────────
  // Set only when loginUser() signals `requiresTwoFactor` via
  // TwoFactorRequiredError. While set, the form below renders the
  // code-entry screen instead of the email/password screen. The pending
  // token is short-lived (5 min) server-side; an expired/invalid token
  // surfaces as a normal verify error and we tell the user to start over
  // rather than leaving them stuck on a dead screen.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Function to determine redirect path based on user roles and permissions
  const getRedirectPath = async (user: User | null): Promise<string> => {
    if (!user) return '/login';

    // Check if onboarding is incomplete - highest priority check.
    // Check both snake_case and camelCase because fetchApi auto-converts
    // keys to camelCase, but cached users may have either form.
    if (user.tenant) {
      const setupCompleted = user.tenant.setup_completed ?? (user.tenant as any).setupCompleted;
      const onboardingStep = user.tenant.onboarding_step ?? (user.tenant as any).onboardingStep;
      if (!setupCompleted || onboardingStep !== 'completed') {
        console.log('User onboarding incomplete, redirecting to onboarding wizard');
        console.log('Tenant setup_completed:', setupCompleted);
        console.log('Tenant onboarding_step:', onboardingStep);
        return '/onboarding';
      }
    }

    // Check if user has admin/system role or any admin-level permissions
    const isAdminUser = user.role === 'tenant_admin' ||
                       user.systemRoles?.includes('admin') ||
                       user.permissions?.some(p => p.startsWith('system.')) ||
                       user.permissions?.some(p => p.startsWith('tenant.'));

    // Sales-floor users (non-admin, can create sales) land on the counter
    // screen, not the admin dashboard. Every industry except grocery gets
    // the Sales Hub — a single screen covering New/Duty-Free Sale, and
    // (where relevant) Repairs, Old Gold, Memo, Layaway, Savings Schemes and
    // Returns — so a cashier never needs to see the sidebar/dashboard at
    // all. Grocery is scan-and-go with no customer-relationship lookups, so
    // it keeps going straight to POS. See utils/salesHubIndustries.ts for
    // the single source of truth on which industries qualify.
    if (hasPermission(user, 'sales.create') && !isAdminUser) {
      try {
        const industryCode = await getTenantIndustry();
        if (industryCode) {
          // Warm the cache `useIndustry()` reads on the Hub/Sidebar so they
          // don't re-fetch what we just resolved.
          localStorage.setItem('tenant_industry_code', industryCode);
        }
        if (hasSalesHub(industryCode)) {
          return '/sales-hub';
        }
      } catch (err) {
        console.warn('[LOGIN] Could not resolve tenant industry for redirect, defaulting to POS:', err);
      }
      return '/pos';
    }

    // Redirect to /admin for admin users
    if (isAdminUser) {
      return '/admin';
    }

    // Default to dashboard for regular users
    return '/dashboard';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      // Attempt to login through the AuthContext
      const userData = await login({ email, password });

      if (userData) {
        // If we have user data, determine the redirect path based on role
        const redirectPath = await getRedirectPath(userData);
        navigate(redirectPath);
      } else {
        // If login failed but didn't throw an error, the AuthContext has
        // already set `error` (authError) with the server's message — don't
        // overwrite it with a generic string. Only fall back to the generic
        // message if the context didn't set one.
        if (!authError) {
          setLoginError('Login failed. Please check your credentials and try again.');
        }
      }
    } catch (err: any) {
      // A user with 2FA enabled doesn't fail here — switch to the
      // code-entry step instead of showing an error.
      if (err instanceof TwoFactorRequiredError) {
        setPendingToken(err.pendingToken);
        setTwoFactorError('');
        setTwoFactorCode('');
        return;
      }
      // An unverified-email response (HTTP 403, emailVerified: false) —
      // redirect to the verification page with the user's email pre-filled
      // instead of showing a generic error (audit Gap 1).
      if (err?.emailVerified === false) {
        const emailParam = err.email ? `?email=${encodeURIComponent(err.email)}` : '';
        navigate(`/verify-email${emailParam}`);
        return;
      }
      // Display the error message to the user
      const errorMessage = err.message || 'An unexpected error occurred during login';
      console.error('[LOGIN FORM] Login error:', err);
      setLoginError(errorMessage);
    }
  };

  const handleVerifyTwoFactor = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    setTwoFactorError('');
    setVerifying(true);
    try {
      const userData = await verifyTwoFactor(pendingToken, twoFactorCode.trim());
      if (userData) {
        const redirectPath = await getRedirectPath(userData);
        navigate(redirectPath);
      } else {
        setTwoFactorError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      const message: string = err?.message || err?.response?.data?.message || '';
      const expired = /expired|invalid.*token|pending.*token/i.test(message);
      if (expired) {
        setTwoFactorError('Your login session has expired. Please go back and sign in again.');
      } else {
        setTwoFactorError(message || 'Invalid code. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    setPendingToken(null);
    setTwoFactorCode('');
    setTwoFactorError('');
  };



  return (
    <div className="min-h-screen bg-white dark:bg-card flex">
      {/* Left column - form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="w-full max-w-md mx-auto">
          {/* Back to Home */}
          <div className="mb-8">
            <Link to="/" className="inline-flex items-center text-gray-500 dark:text-muted-foreground hover:text-primary-900 transition-colors text-sm" aria-label="Back to Home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <Link to="/" aria-label="Go to Home" className="inline-flex items-center mb-8">
              <img src="/images/zettaz-cloud-logo-dark.png" alt="Zettaz Cloud" className="h-10 w-auto" />
            </Link>
            <h1 className="text-3xl font-bold text-primary-900 mb-2">Welcome back</h1>
            <p className="text-gray-600 dark:text-muted-foreground">Sign in to your Zettaz Cloud POS account</p>
          </div>

          {/* 2FA code-entry step */}
          {pendingToken ? (
            <form onSubmit={handleVerifyTwoFactor} className="space-y-6">
              <div className="rounded-lg border border-border bg-primary-50 dark:bg-primary-950/40 px-4 py-3 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary-700 dark:text-primary-300 mt-0.5 shrink-0" />
                <p className="text-sm text-primary-900 dark:text-primary-100">
                  Enter the 6-digit code from your authenticator app, or one of your backup codes.
                </p>
              </div>

              <div>
                <label htmlFor="twoFactorCode" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                  Verification code
                </label>
                <input
                  id="twoFactorCode"
                  name="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="block w-full px-4 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 tracking-[0.3em] text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="000000"
                />
              </div>

              {twoFactorError && (
                <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                  <p className="text-sm text-danger-700">{twoFactorError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || twoFactorCode.trim().length === 0}
                className="w-full bg-primary-700 hover:bg-primary-800 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {verifying ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Verifying...
                  </>
                ) : (
                  'Verify and sign in'
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full inline-flex items-center justify-center py-2.5 text-sm font-medium text-gray-500 dark:text-muted-foreground hover:text-primary-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to sign in
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 dark:text-muted-foreground hover:text-primary-700 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 dark:text-muted-foreground hover:text-primary-700 transition-colors" />
                  )}
                </button>
              </div>
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-sm text-primary-700 hover:text-primary-900 font-medium transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Error Message */}
            {(loginError || authError) && (
              <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                <p className="text-sm text-danger-700">{loginError || authError}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-700 hover:bg-primary-800 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          )}

          {/* Divider + Sign Up (hidden during the 2FA step) */}
          {!pendingToken && (
          <>
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-card text-gray-500 dark:text-muted-foreground">New to Zettaz Cloud?</span>
              </div>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center w-full py-3 px-4 border border-border rounded-lg text-sm font-semibold text-primary-900 bg-white dark:bg-card hover:bg-gray-50 dark:bg-muted/50 transition-all duration-200"
            >
              Create Your Account
            </Link>
          </div>
          </>
          )}

          {/* Footer */}
          <div className="mt-10 text-center">
            <p className="text-sm text-gray-400 dark:text-muted-foreground">
              &copy; 2025 Zettaz Cloud. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right column - brand panel (hidden on small screens) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950 items-center justify-center relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-24 w-[28rem] h-[28rem] bg-primary-700/30 rounded-full blur-3xl" aria-hidden="true" />
        <div className="relative max-w-md px-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Run your entire business from one platform</h2>
          <p className="text-primary-200 leading-relaxed">
            Sales, inventory, and reporting — all in one cloud-native POS built for growing businesses.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
