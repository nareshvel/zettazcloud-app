/**
 * Email Verification Page Component
 * Handles email verification with token and resend functionality
 * Part of the public signup flow
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw,
  ArrowLeft,
  Clock
} from 'lucide-react';

// Use environment-configured API base URL (fallback to local dev, base without trailing /api)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172';

interface VerificationState {
  email?: string;
  name?: string;
}

const EmailVerificationPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error' | 'expired'>('pending');
  const [message, setMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Get email and name from navigation state or URL params
  const state = location.state as VerificationState;
  const email = state?.email || searchParams.get('email') || '';
  const name = state?.name || 'User';
  const token = searchParams.get('token');

  // Auto-verify if token is present in URL (with duplicate prevention)
  useEffect(() => {
    if (token && verificationStatus === 'pending' && !isVerifying) {
      console.log('🔍 Auto-verifying email with token:', token.substring(0, 8) + '...');
      verifyEmail(token);
    }
  }, [token]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const verifyEmail = async (verificationToken: string) => {
    // Prevent duplicate verification attempts
    if (isVerifying) {
      console.log('⚠️ Email verification already in progress, ignoring duplicate request');
      return;
    }
    
    if (verificationStatus === 'success') {
      console.log('✅ Email already verified successfully, skipping duplicate verification');
      return;
    }

    setIsVerifying(true);
    setMessage('');

    try {
      console.log('📧 Verifying email with token:', verificationToken.substring(0, 8) + '...');
      
      const response = await fetch(`${API_BASE_URL}/api/public/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();
      console.log('📧 Verification response:', { success: data.success, message: data.message });

      if (data.success) {
        setVerificationStatus('success');
        setMessage(data.message);
        
        // Store authentication token if provided
        if (data.token || data.data?.token) {
          const token = data.token || data.data?.token;
          // Clear any stale cached user from a PREVIOUS login session.
          // Without this, getCurrentUser() returns the old cached user
          // (with the old tenant_id) instead of fetching /users/me,
          // which sends the wrong tenant_id to /stores/settings and
          // produces mock store data on the settings page.
          localStorage.removeItem('currentUser');
          localStorage.removeItem('tenant_id');
          localStorage.removeItem('store_id');
          localStorage.setItem('auth_token', token);
          console.log('✅ Auth token stored after email verification (stale cache cleared)');
        }
        
        // Store user data if provided
        if (data.data?.user) {
          localStorage.setItem('currentUser', JSON.stringify(data.data.user));
        }
        
        // Redirect to onboarding wizard after successful verification
        setTimeout(() => {
          const params = new URLSearchParams({
            email: data.data?.email || '',
            name: data.data?.name || ''
          });
          navigate(`/onboarding?${params.toString()}`);
        }, 2000);
      } else {
        if (data.message.includes('expired')) {
          setVerificationStatus('expired');
        } else {
          setVerificationStatus('error');
        }
        setMessage(data.message);
      }
    } catch (error) {
      console.error('Email verification error:', error);
      setVerificationStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!email) {
      setMessage('Email address is required to resend verification.');
      return;
    }

    setIsResending(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/public/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Verification email sent! Please check your inbox.');
        setResendCooldown(60); // 60 second cooldown
      } else {
        setMessage(data.message || 'Failed to resend verification email.');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      setMessage('Network error. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const renderVerificationContent = () => {
    if (isVerifying) {
      return (
        <div className="text-center">
          <Loader2 className="h-16 w-16 text-primary-700 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary-900 mb-2">Verifying Your Email</h2>
          <p className="text-gray-600 dark:text-muted-foreground">
            Please wait while we verify your email address...
          </p>
        </div>
      );
    }

    switch (verificationStatus) {
      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-success-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-900 mb-2">Email Verified Successfully!</h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-4">
              Welcome to Zettaz Cloud POS, {name}! Your account is now active.
            </p>
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              Redirecting you to set up your store...
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="h-16 w-16 text-danger-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-6">
              {message || 'The verification link is invalid or has expired.'}
            </p>
            {email && (
              <button
                onClick={resendVerificationEmail}
                disabled={isResending || resendCooldown > 0}
                className="bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto"
              >
                {isResending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Resend in {resendCooldown}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </button>
            )}
          </div>
        );

      case 'expired':
        return (
          <div className="text-center">
            <Clock className="h-16 w-16 text-warning-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-900 mb-2">Verification Link Expired</h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-6">
              Your verification link has expired. Please request a new one.
            </p>
            {email && (
              <button
                onClick={resendVerificationEmail}
                disabled={isResending || resendCooldown > 0}
                className="bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto"
              >
                {isResending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Resend in {resendCooldown}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Send New Verification Email
                  </>
                )}
              </button>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center">
            <Mail className="h-16 w-16 text-primary-700 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-900 mb-2">Check Your Email</h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-4">
              We've sent a verification link to:
            </p>
            <p className="text-lg font-medium text-primary-900 mb-6">
              {email || 'your email address'}
            </p>
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-primary-900 mb-2">Next Steps:</h3>
              <ol className="text-sm text-primary-800 space-y-1 list-decimal list-inside">
                <li>Check your email inbox (and spam folder)</li>
                <li>Click the verification link in the email</li>
                <li>You'll be redirected back here automatically</li>
              </ol>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-muted-foreground">
                Didn't receive the email?
              </p>
              {email && (
                <button
                  onClick={resendVerificationEmail}
                  disabled={isResending || resendCooldown > 0}
                  className="bg-gray-100 dark:bg-muted hover:bg-gray-200 dark:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-primary-900 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center mx-auto"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Resend in {resendCooldown}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resend Email
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-muted/50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center text-gray-500 dark:text-muted-foreground hover:text-primary-900 transition-colors mb-6 text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <Link to="/" className="inline-flex items-center justify-center">
            <img src="/images/zettaz-cloud-logo-dark.png" alt="Zettaz Cloud" className="h-10 w-auto" />
          </Link>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {renderVerificationContent()}
          
          {/* Status Message */}
          {message && verificationStatus !== 'success' && (
            <div className={`mt-6 p-4 rounded-md ${
              verificationStatus === 'error' || verificationStatus === 'expired'
                ? 'bg-red-50 border border-red-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <p className={`text-sm ${
                verificationStatus === 'error' || verificationStatus === 'expired'
                  ? 'text-red-800'
                  : 'text-green-800'
              }`}>
                {message}
              </p>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-border">
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-900 dark:text-foreground mb-2">Need Help?</h3>
              <p className="text-xs text-gray-600 dark:text-muted-foreground mb-3">
                If you're having trouble with email verification, here are some tips:
              </p>
              <ul className="text-xs text-gray-600 dark:text-muted-foreground space-y-1 text-left">
                <li>• Check your spam or junk mail folder</li>
                <li>• Make sure you're checking the correct email address</li>
                <li>• Add noreply@zettaz.com to your contacts</li>
                <li>• Try resending the verification email</li>
              </ul>
              <div className="mt-4">
                <a 
                  href="mailto:support@zettaz.com" 
                  className="text-primary-700 hover:text-primary-900 text-sm font-medium"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>

          {/* Alternative Actions */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-card text-gray-500 dark:text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                to="/signup"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-border rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-50 dark:bg-muted/50"
              >
                Sign Up Again
              </Link>
              <Link
                to="/login"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-border rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-foreground bg-white dark:bg-card hover:bg-gray-50 dark:bg-muted/50"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;
