import { Component, ErrorInfo, ReactNode, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster as SonnerToaster } from 'sonner';
import TitleTooltip from './components/common/TitleTooltip';
import { I18nextProvider } from 'react-i18next';

// Import i18n initialization
import i18n from './i18n';

// Core context provider
import { AuthProvider } from './contexts/AuthContext';

// New application structure components
import { AppProviders } from './contexts/AppProviders';
import AppRoutes from './AppRoutes';
import ProtectedRoute from './components/ProtectedRoute';

// Public page components
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import OnboardingWizard from './pages/OnboardingWizard';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsConditionsPage from './pages/TermsConditionsPage';
import PrintAgentPage from './pages/PrintAgentPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Error boundary to catch and display runtime errors
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '20px', color: 'red', backgroundColor: '#fff'}}>
          <h1 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '10px'}}>Something went wrong</h1>
          <details style={{border: '1px solid #eee', padding: '10px', marginTop: '10px'}}>
            <summary style={{fontWeight: 'bold', cursor: 'pointer'}}>Error details</summary>
            <pre style={{marginTop: '10px', whiteSpace: 'pre-wrap'}}>{this.state.error?.toString()}</pre>
          </details>
          <button 
            style={{
              marginTop: '15px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SonnerToaster richColors position="top-right" />
            <TitleTooltip />
            <AuthProvider>
              <Routes>
                {/* Public routes that do not require authentication */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/verify-email" element={<EmailVerificationPage />} />
                <Route path="/onboarding" element={<OnboardingWizard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsConditionsPage />} />
                <Route path="/print-agent" element={<PrintAgentPage />} />

                {/* Protected routes - single wildcard route handles all authenticated pages */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AppProviders>
                        <AppRoutes />
                      </AppProviders>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </Router>
        </Suspense>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default App;