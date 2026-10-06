/**
 * Reset Password Page
 * Lets a user set a new password using a token from their reset email.
 */

import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Loader2, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172/api';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors([]);

    if (!token) {
      setError('This reset link is missing a token. Please request a new one.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/public/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(data.message || 'Failed to reset password. Please try again.');
        if (Array.isArray(data.errors)) {
          setFieldErrors(data.errors);
        }
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-card flex">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <Link to="/login" className="inline-flex items-center text-gray-500 dark:text-muted-foreground hover:text-primary-900 transition-colors text-sm" aria-label="Back to Login">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back to Login</span>
            </Link>
          </div>

          <div className="mb-8">
            <Link to="/" aria-label="Go to Home" className="inline-flex items-center mb-8">
              <img src="/images/zettaz-cloud-logo-dark.png" alt="Zettaz Cloud" className="h-10 w-auto" />
            </Link>
            <h1 className="text-3xl font-bold text-primary-900 mb-2">Reset your password</h1>
            <p className="text-gray-600 dark:text-muted-foreground">Choose a new password for your account.</p>
          </div>

          {!token && !success && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-6 flex items-start">
              <XCircle className="h-5 w-5 text-danger-500 mr-3 mt-0.5 shrink-0" />
              <p className="text-sm text-danger-700">
                This reset link is invalid or missing a token. Please request a new password reset link.
              </p>
            </div>
          )}

          {success ? (
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-6 text-center">
              <CheckCircle className="h-10 w-10 text-primary-700 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-primary-900 mb-2">Password reset successfully</h2>
              <p className="text-gray-600 dark:text-muted-foreground text-sm">Redirecting you to sign in...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-12 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                    placeholder="Enter a new password"
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
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-12 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 dark:text-muted-foreground hover:text-primary-700 transition-colors" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 dark:text-muted-foreground hover:text-primary-700 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              {(error || fieldErrors.length > 0) && (
                <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                  {error && <p className="text-sm text-danger-700">{error}</p>}
                  {fieldErrors.length > 0 && (
                    <ul className="mt-1 text-sm text-danger-700 space-y-1 list-disc list-inside">
                      {fieldErrors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !token}
                className="w-full bg-primary-700 hover:bg-primary-800 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <Link to="/forgot-password" className="text-sm text-primary-700 hover:text-primary-900 font-medium transition-colors">
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950 items-center justify-center relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-24 w-[28rem] h-[28rem] bg-primary-700/30 rounded-full blur-3xl" aria-hidden="true" />
        <div className="relative max-w-md px-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Keep your account secure</h2>
          <p className="text-primary-200 leading-relaxed">
            Choose a strong password with a mix of letters, numbers, and symbols to keep your business data safe.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
