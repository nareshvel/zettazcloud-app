/**
 * Signup Page Component
 * User registration form with a professional design matching the app's navy brand system.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  Loader2,
  ArrowLeft,
  Mail,
  User,
  Phone,
  Building,
  Lock,
  X
} from 'lucide-react';
import PolicyModal from '../components/PolicyModal';
// Direct API configuration to ensure reliability
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172/api';

interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
  businessName: string;
  agreeToTerms: boolean;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  phoneNumber?: string;
  agreeToTerms?: string;
}

interface PasswordStrength {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  errors: string[];
}

interface PlanConfig {
  name: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}

// Plan configurations
const PLAN_CONFIGS: Record<string, PlanConfig> = {
  starter: {
    name: 'Starter',
    price: 'Free 14-Day Trial',
    description: 'Perfect for small businesses',
    features: [
      'Up to 1,000 transactions/month',
      'Basic reporting',
      'Email support',
      'No credit card required'
    ]
  },
  professional: {
    name: 'Professional',
    price: 'Free 14-Day Trial',
    description: 'For growing businesses',
    features: [
      'Up to 10,000 transactions/month',
      'Advanced analytics',
      'Priority support',
      'Multi-location support',
      'Upgrade anytime after trial'
    ],
    popular: true
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Custom Trial Available',
    description: 'For large organizations',
    features: [
      'Unlimited transactions',
      'Custom integrations',
      '24/7 phone support',
      'Dedicated account manager'
    ]
  }
};

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get plan from URL parameter or default to 'professional'
  const [selectedPlan, setSelectedPlan] = useState(searchParams.get('plan') || 'professional');

  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    businessName: '',
    agreeToTerms: false
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  // Email availability check
  useEffect(() => {
    const checkEmailAvailability = async () => {
      if (formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setEmailCheckLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/api/public/auth/check-email/${encodeURIComponent(formData.email)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();
          setEmailAvailable(data.available);
        } catch (error) {
          console.error('Email check failed:', error);
          setEmailAvailable(null);
        } finally {
          setEmailCheckLoading(false);
        }
      } else {
        setEmailAvailable(null);
      }
    };

    const debounceTimer = setTimeout(checkEmailAvailability, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData.email]);

  // Password strength check
  useEffect(() => {
    const checkPasswordStrength = async () => {
      if (formData.password) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/public/auth/password-strength`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: formData.password }),
          });

          const data = await response.json();
          setPasswordStrength(data);
        } catch (error) {
          console.error('Password strength check failed:', error);
          setPasswordStrength(null);
        }
      } else {
        setPasswordStrength(null);
      }
    };

    const debounceTimer = setTimeout(checkPasswordStrength, 300);
    return () => clearTimeout(debounceTimer);
  }, [formData.password]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = 'checked' in e.target ? e.target.checked : false;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear validation error when user starts typing
    if (validationErrors[name as keyof ValidationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    } else if (emailAvailable === false) {
      errors.email = 'This email is already registered';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (passwordStrength && !passwordStrength.isValid) {
      errors.password = 'Password does not meet requirements';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Phone number validation - supports international and domestic formats
    if (!formData.phoneNumber) {
      errors.phoneNumber = 'Phone number is required';
    } else {
      // Clean the phone number by removing spaces, dashes, parentheses, and dots
      const cleanedPhone = formData.phoneNumber.replace(/[\s\-\(\)\.]/g, '');
      
      // More flexible regex that supports:
      // - Optional + for international
      // - Leading zeros (for many countries)
      // - 7-15 digits total (standard international range)
      // - US format: 10 digits
      // - International format: 7-15 digits with optional country code
      const phoneRegex = /^[\+]?[0-9]{7,15}$/;
      
      if (!phoneRegex.test(cleanedPhone)) {
        errors.phoneNumber = 'Please enter a valid phone number (7-15 digits)';
      } else if (cleanedPhone.length < 7) {
        errors.phoneNumber = 'Phone number must be at least 7 digits';
      } else if (cleanedPhone.length > 15) {
        errors.phoneNumber = 'Phone number must be no more than 15 digits';
      }
    }

    // Terms agreement validation
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = 'You must agree to the terms of service';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/public/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          phoneNumber: formData.phoneNumber.trim(),
          businessName: formData.businessName.trim() || undefined,
          selectedPlan
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to email verification page
        navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
      } else {
        setSubmitError(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if form is valid by filtering out undefined validation errors
  const hasValidationErrors = Object.values(validationErrors).some(error => error !== undefined);
  const isFormValid = !hasValidationErrors && 
                     formData.name && 
                     formData.email && 
                     formData.password && 
                     formData.confirmPassword && 
                     formData.phoneNumber && 
                     formData.agreeToTerms &&
                     emailAvailable !== false &&
                     passwordStrength?.isValid;

  const getPasswordStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak': return 'text-danger-600';
      case 'medium': return 'text-warning-600';
      case 'strong': return 'text-success-600';
      default: return 'text-gray-500';
    }
  };

  const getPasswordStrengthWidth = (strength: string) => {
    switch (strength) {
      case 'weak': return 'w-1/3';
      case 'medium': return 'w-2/3';
      case 'strong': return 'w-full';
      default: return 'w-0';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-muted/50">
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" aria-label="Go to Home" className="inline-flex items-center justify-center mb-6">
              <img src="/images/zettaz-cloud-logo-dark.png" alt="Zettaz Cloud" className="h-10 w-auto" />
            </Link>
            <h1 className="text-3xl font-bold text-primary-900 mb-2">Create your account</h1>
            <p className="text-gray-600 dark:text-muted-foreground">Join businesses using Zettaz Cloud POS</p>
          </div>

          {/* Selected Plan Summary */}
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-white dark:bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wide mb-0.5">
                  Selected plan
                </p>
                <p className="text-primary-900 font-bold">
                  {(PLAN_CONFIGS[selectedPlan] ?? PLAN_CONFIGS.professional).name}
                  <span className="ml-2 font-normal text-sm text-gray-500 dark:text-muted-foreground">
                    {(PLAN_CONFIGS[selectedPlan] ?? PLAN_CONFIGS.professional).price}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanSelector(true)}
                className="shrink-0 text-sm font-semibold text-primary-700 hover:text-primary-900 underline transition-colors"
              >
                Change plan
              </button>
            </div>
          </div>

          {/* Plan Selection Modal */}
          {showPlanSelector && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-card border border-border rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-primary-900">Choose Your Plan</h3>
                  <button
                    type="button"
                    onClick={() => setShowPlanSelector(false)}
                    className="text-gray-400 dark:text-muted-foreground hover:text-primary-900 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(PLAN_CONFIGS).map(([planKey, plan]) => (
                    <div
                      key={planKey}
                      className={`relative bg-white dark:bg-card border rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                        selectedPlan === planKey
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-border hover:border-primary-300'
                      }`}
                      onClick={() => {
                        setSelectedPlan(planKey);
                        setShowPlanSelector(false);
                      }}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-primary-700 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            Most Popular
                          </span>
                        </div>
                      )}
                      
                      <div className="text-center">
                        <h4 className="text-xl font-bold text-primary-900 mb-2">{plan.name}</h4>
                        <div className="text-2xl font-bold text-primary-900 mb-1">{plan.price}</div>
                        <p className="text-gray-500 dark:text-muted-foreground text-sm mb-4">{plan.description}</p>
                        
                        <div className="space-y-2 mb-4 text-left">
                          {plan.features.map((feature, index) => (
                            <div key={index} className="flex items-center text-gray-600 dark:text-muted-foreground text-sm">
                              <CheckCircle className="w-4 h-4 text-primary-700 mr-2 flex-shrink-0" />
                              {feature}
                            </div>
                          ))}
                        </div>
                        
                        <button className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                          selectedPlan === planKey
                            ? 'bg-primary-700 text-white'
                            : 'bg-gray-100 dark:bg-muted text-primary-900 hover:bg-gray-200'
                        }`}>
                          {selectedPlan === planKey ? 'Selected' : 'Select Plan'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Signup Form */}
          <div className="bg-white dark:bg-card border border-border rounded-xl shadow-card p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Personal Information */}
                <div className="space-y-6">
                  {/* Name Field */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
                      </div>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-3 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="Enter your full name"
                      />
                    </div>
                    {validationErrors.name && (
                      <p className="mt-1 text-sm text-danger-600">{validationErrors.name}</p>
                    )}
                  </div>

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
                        value={formData.email}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-10 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="Enter your email"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        {emailCheckLoading ? (
                          <Loader2 className="h-5 w-5 text-gray-400 dark:text-muted-foreground animate-spin" />
                        ) : emailAvailable === true ? (
                          <CheckCircle className="h-5 w-5 text-success-500" />
                        ) : emailAvailable === false ? (
                          <XCircle className="h-5 w-5 text-danger-500" />
                        ) : null}
                      </div>
                    </div>
                    {validationErrors.email && (
                      <p className="mt-1 text-sm text-danger-600">{validationErrors.email}</p>
                    )}
                  </div>

                  {/* Phone Number Field */}
                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
                      </div>
                      <input
                        id="phoneNumber"
                        name="phoneNumber"
                        type="tel"
                        autoComplete="tel"
                        required
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-3 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="Enter your phone number"
                      />
                    </div>
                    {validationErrors.phoneNumber && (
                      <p className="mt-1 text-sm text-danger-600">{validationErrors.phoneNumber}</p>
                    )}
                  </div>
                </div>

                {/* Right Column - Account Security & Business Info */}
                <div className="space-y-6">
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
                        autoComplete="new-password"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-12 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="Create a password"
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
                    
                    {/* Password Strength Indicator */}
                    {formData.password && passwordStrength && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500 dark:text-muted-foreground">Password strength:</span>
                          <span className={`text-xs font-medium ${getPasswordStrengthColor(passwordStrength.strength)}`}>
                            {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              passwordStrength.strength === 'weak' ? 'bg-danger-500' :
                              passwordStrength.strength === 'medium' ? 'bg-warning-500' : 'bg-success-500'
                            } ${getPasswordStrengthWidth(passwordStrength.strength)}`}
                          ></div>
                        </div>
                        {passwordStrength.errors.length > 0 && (
                          <ul className="mt-1 text-xs text-danger-600 space-y-1">
                            {passwordStrength.errors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    
                    {validationErrors.password && (
                      <p className="mt-1 text-sm text-danger-600">{validationErrors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                      Confirm Password
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
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-12 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="Confirm your password"
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
                    {validationErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-danger-600">{validationErrors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Business Name Field */}
                  <div>
                    <label htmlFor="businessName" className="block text-sm font-semibold text-gray-700 dark:text-foreground mb-2">
                      Business Name <span className="text-gray-400 dark:text-muted-foreground">(Optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />
                      </div>
                      <input
                        id="businessName"
                        name="businessName"
                        type="text"
                        autoComplete="organization"
                        value={formData.businessName}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-3 py-3 bg-white dark:bg-card border border-border rounded-lg text-gray-900 dark:text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="Enter your business name"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms Agreement */}
              <div className="col-span-2">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="agreeToTerms"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleInputChange}
                    className="mt-1 w-4 h-4 text-primary-700 bg-white dark:bg-card border-border rounded focus:ring-primary-500 focus:ring-2"
                    required
                  />
                  <label htmlFor="agreeToTerms" className="text-sm text-gray-600 dark:text-muted-foreground leading-relaxed">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-primary-700 hover:text-primary-900 underline focus:outline-none"
                    >
                      Terms & Conditions
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className="text-primary-700 hover:text-primary-900 underline focus:outline-none"
                    >
                      Privacy Policy
                    </button>
                  </label>
                </div>
              </div>
              {validationErrors.agreeToTerms && (
                <p className="text-sm text-danger-600">{validationErrors.agreeToTerms}</p>
              )}

              {/* Submit Error - Full Width */}
              {submitError && (
                <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                  <p className="text-sm text-danger-700">{submitError}</p>
                </div>
              )}

              {/* Submit Button - Full Width */}
              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full bg-primary-700 hover:bg-primary-800 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-card text-gray-500 dark:text-muted-foreground">Already have an account?</span>
                </div>
              </div>
            </div>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-primary-700 hover:text-primary-900 font-semibold transition-colors duration-200"
              >
                Sign in here
              </Link>
            </div>
          </div>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="inline-flex items-center text-gray-500 dark:text-muted-foreground hover:text-primary-900 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Policy Modals */}
      <PolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        type="privacy"
      />
      
      <PolicyModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        type="terms"
      />
    </div>
  );
};

export default SignupPage;
