/**
 * Forgot Password Page
 * Lets a user request a password reset email.
 */

import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172/api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/public/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
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
            <h1 className="text-3xl font-bold text-primary-900 mb-2">Forgot your password?</h1>
            <p className="text-gray-600 dark:text-muted-foreground">
              Enter the email address associated with your account and we'll send you a link to reset your password.
            </p>
          </div>

          {submitted ? (
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-6 text-center">
              <CheckCircle className="h-10 w-10 text-primary-700 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-primary-900 mb-2">Check your email</h2>
              <p className="text-gray-600 dark:text-muted-foreground text-sm">
                If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
                The link expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
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

              {error && (
                <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                  <p className="text-sm text-danger-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-700 hover:bg-primary-800 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              Remembered your password?{' '}
              <Link to="/login" className="text-primary-700 hover:text-primary-900 font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950 items-center justify-center relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-24 w-[28rem] h-[28rem] bg-primary-700/30 rounded-full blur-3xl" aria-hidden="true" />
        <div className="relative max-w-md px-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">We've got you covered</h2>
          <p className="text-primary-200 leading-relaxed">
            Password reset links expire after an hour for your security. If you don't see the email, check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
