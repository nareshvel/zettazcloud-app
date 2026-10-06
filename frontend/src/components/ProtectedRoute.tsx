import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute component that enforces authentication and onboarding.
 *
 * 1. Redirects unauthenticated users to /login.
 * 2. Redirects authenticated users with incomplete onboarding to
 *    /onboarding — unless they're already there. Without this guard a
 *    user who manually navigates to /pos after login would bypass the
 *    onboarding check in Login.tsx's getRedirectPath (audit Gap 6).
 *
 * /onboarding is registered as a PUBLIC route in App.tsx (outside this
 * guard), so this redirect never creates a loop.
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading state while AuthContext is initializing
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
          <span className="mt-2 text-gray-700 dark:text-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check onboarding status — if the tenant hasn't completed setup,
  // force the user to /onboarding regardless of which protected route
  // they tried to access. This is a defense-in-depth check that backs
  // up Login.tsx's getRedirectPath redirect.
  // Check both snake_case and camelCase because fetchApi auto-converts
  // keys to camelCase, but cached users may have either form.
  if (user?.tenant) {
    const setupCompleted = user.tenant.setup_completed ?? (user.tenant as any).setupCompleted;
    const onboardingStep = user.tenant.onboarding_step ?? (user.tenant as any).onboardingStep;
    if (!setupCompleted || onboardingStep !== 'completed') {
      return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
    }
  }

  // Authorized access
  return <>{children}</>;
};

export default ProtectedRoute;