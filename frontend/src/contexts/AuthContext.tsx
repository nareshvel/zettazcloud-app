import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, LoginCredentials } from '@/types';
import * as authService from '../services/authService';
import { PRINT_AGENT_TOKEN_KEY } from '../services/printAgentV2Service';

// Simple storage wrapper
const BrowserStorage = {
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      try {
        sessionStorage.setItem(key, value);
      } catch (sessionError) {
        console.warn(`Storage failed for ${key}:`, sessionError);
      }
    }
  },
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      try {
        return sessionStorage.getItem(key);
      } catch (sessionError) {
        console.warn(`Storage read failed for ${key}:`, sessionError);
        return null;
      }
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Storage remove failed for ${key}:`, error);
    }
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`Session storage remove failed for ${key}:`, error);
    }
  }
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<User | null>;
  /** Second step of a 2FA-gated login — see authService.verifyTwoFactorLogin(). */
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<User | null>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  checkAuthStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}



export const AuthProvider = ({ children }: AuthProviderProps) => {
  // Initialize user from localStorage
  const [user, setUser] = useState<User | null>(() => {
    try {
      const storedUser = BrowserStorage.getItem('currentUser');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication status
  const checkAuthStatus = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const token = BrowserStorage.getItem('auth_token');
      
      if (!token) {
        setUser(null);
        return false;
      }

      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        // Persist tenant_id and store_id to localStorage so the
        // StoreContext's fallback (localStorage.getItem('tenant_id'))
        // works even when the user object isn't available yet. This
        // mirrors what applySuccessfulLogin does for the login flow.
        if (currentUser.tenantId) {
          localStorage.setItem('tenant_id', currentUser.tenantId);
        }
        if (currentUser.storeId) {
          localStorage.setItem('store_id', currentUser.storeId);
        }
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize authentication state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = BrowserStorage.getItem('auth_token');
      if (token) {
        await checkAuthStatus();
      }
    };
    
    initializeAuth();
  }, [checkAuthStatus]);

  // Shared success-path handling for both a normal login and a completed
  // 2FA verification — both end up with the same resolved User and need
  // the same context state + storage side effects applied.
  const applySuccessfulLogin = useCallback((loggedInUser: User): User => {
    if (!loggedInUser.id) {
      throw new Error('Invalid user data received from server');
    }

    if (!loggedInUser.permissions) {
      loggedInUser.permissions = [];
    }

    const isManager = loggedInUser.role?.toLowerCase().includes('manager') ||
                     loggedInUser.roles?.some((r: string) => r.toLowerCase().includes('manager'));

    setUser(loggedInUser);

    BrowserStorage.setItem('currentUser', JSON.stringify(loggedInUser));

    if (loggedInUser.tenantId) {
      localStorage.setItem('tenant_id', loggedInUser.tenantId);
    }

    if (loggedInUser.storeId) {
      localStorage.setItem('store_id', loggedInUser.storeId);
    } else if (isManager) {
      const defaultStoreId = `default-${loggedInUser.tenantId || 'tenant'}`;
      localStorage.setItem('store_id', defaultStoreId);
    }

    return loggedInUser;
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<User | null> => {
    setIsLoading(true);
    setError(null);

    // Clear all auth-related data before attempting login
    ['auth_token', 'currentUser', 'user', 'tenant_id', 'store_id', 'user_roles', 'user_permissions'].forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    try {
      // Attempt to login and get user data
      const loggedInUser = await authService.loginUser(credentials);

      if (loggedInUser) {
        return applySuccessfulLogin(loggedInUser);
      } else {
        throw new Error('Login failed: Invalid response from server');
      }
    } catch (err: any) {
      // A pending-2FA signal is not a login failure — propagate it as-is so
      // the LoginPage can show the code-entry step. Don't clear storage
      // (nothing was stored yet) or surface a generic error for it.
      if (err instanceof authService.TwoFactorRequiredError) {
        setIsLoading(false);
        throw err;
      }

      // An unverified-email response (HTTP 403 with emailVerified: false)
      // is not a credentials error — the password was correct, but the user
      // hasn't clicked the verification link yet. Surface a dedicated error
      // type so Login.tsx can redirect to /verify-email instead of showing
      // a generic "Login failed" message (audit Gap 1).
      const respData = err?.response as any;
      if (err?.status === 403 && respData?.emailVerified === false) {
        const emailVerifiedError = new Error(
          respData?.error || 'Please verify your email address before logging in.'
        ) as Error & { emailVerified?: boolean; email?: string };
        emailVerifiedError.emailVerified = false;
        emailVerifiedError.email = respData?.email;
        setError(emailVerifiedError.message);
        setUser(null);
        setIsLoading(false);
        throw emailVerifiedError;
      }

      // Clear any partial auth data on error
      localStorage.removeItem('auth_token');
      localStorage.removeItem('currentUser');

      // Handle specific error cases
      let errorMsg = 'Login failed. Please check your credentials and try again.';

      if (err.response) {
        // Server responded with an error status
        errorMsg = err.response.data?.message || err.message;
      } else if (err.request) {
        // Request was made but no response received
        errorMsg = 'Unable to connect to the server. Please check your network connection.';
      }

      console.error('Login failed:', err?.message || err);

      setError(errorMsg);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [applySuccessfulLogin]);

  const verifyTwoFactor = useCallback(async (pendingToken: string, code: string): Promise<User | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const loggedInUser = await authService.verifyTwoFactorLogin(pendingToken, code);
      if (loggedInUser) {
        return applySuccessfulLogin(loggedInUser);
      }
      throw new Error('Verification failed: Invalid response from server');
    } catch (err: any) {
      let errorMsg = 'Invalid or expired code. Please try again.';
      if (err.response) {
        errorMsg = err.response.data?.message || err.message || errorMsg;
      } else if (err.request) {
        errorMsg = 'Unable to connect to the server. Please check your network connection.';
      }
      console.error('2FA verification failed:', err?.message || err);
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [applySuccessfulLogin]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // Store the current path for potential redirect after login
    const currentPath = window.location.pathname;
    const isAuthPath = ['/login', '/register', '/forgot-password'].some(path => 
      currentPath.startsWith(path)
    );
    
    try {
      // Attempt to call the logout API if available
      try {
        await authService.logoutUser();
      } catch (apiError) {
        // Ignore logout API failure, proceed with client-side cleanup
        // Continue with client-side cleanup even if API call fails
      }
      
      // Clear all auth-related data from all storage locations
      const authKeys = [
        'auth_token', 'refresh_token', 'currentUser', 'user', 
        'tenant_id', 'store_id', 'user_roles', 'user_permissions',
        'auth_status_last_check'
      ];
      
      authKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // Clear all cookies
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      });
      
      // Clear the user from state
      setUser(null);
      
      // Logout successful
      
      // If not already on an auth page, redirect to login
      if (!isAuthPath) {
        window.location.href = '/login';
      }
      
    } catch (err: any) {
      console.error('Logout failed:', {
        error: err,
        message: err.message,
        stack: err.stack
      });
      
      // Even if logout fails, we should still clear the local auth state
      // to prevent the app from being in an inconsistent state
      setUser(null);
      const agentToken = localStorage.getItem(PRINT_AGENT_TOKEN_KEY);
      localStorage.clear();
      sessionStorage.clear();
      if (agentToken) localStorage.setItem(PRINT_AGENT_TOKEN_KEY, agentToken);
      
      // Set a more user-friendly error message
      setError('There was a problem signing you out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      error,
      login,
      verifyTwoFactor,
      logout,
      isAuthenticated,
      checkAuthStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};