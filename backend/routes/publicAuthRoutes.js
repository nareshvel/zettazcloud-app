/**
 * Public Authentication Routes
 * Handles public signup, email verification, and related endpoints
 * No authentication required for these routes
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const signupService = require('../services/signupService');
const emailService = require('../services/emailService');

const router = express.Router();

// Rate limiting for signup endpoints
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signup attempts per hour per IP
  message: {
    success: false,
    message: 'Too many signup attempts. Please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 verification attempts per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 email checks per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many email check requests. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 password reset requests per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/public/auth/signup
 * Register a new user account
 */
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { name, email, password, phoneNumber, businessName, selectedPlan } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, password, phoneNumber'
      });
    }

    // Validate plan, if provided. Anything unrecognized falls back to the
    // service's own 'professional' default rather than being silently dropped or
    // rejecting the whole signup over a bad/stale query param.
    const VALID_SIGNUP_PLANS = ['starter', 'professional', 'enterprise'];
    const normalizedPlan = VALID_SIGNUP_PLANS.includes(selectedPlan) ? selectedPlan : undefined;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Validate password strength
    const passwordValidation = signupService.validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }
    
    // Validate phone number
    const phoneValidation = signupService.validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.message
      });
    }
    
    // Sanitize inputs
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phoneNumber: phoneValidation.formatted,
      businessName: businessName ? businessName.trim() : null,
      selectedPlan: normalizedPlan
    };
    
    // Register user
    const result = await signupService.registerUser(userData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          email: result.data.email,
          name: result.data.name,
          emailSent: result.data.emailSent
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Signup endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * POST /api/public/auth/verify-email
 * Verify user email with token
 */
router.post('/verify-email', verificationLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }
    
    // Verify email
    const result = await signupService.verifyEmail(token);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        token: result.token, // Include authentication token
        data: {
          email: result.data.email,
          name: result.data.name,
          tenantName: result.data.tenantName
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Email verification endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * POST /api/public/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', verificationLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Resend verification email
    const result = await signupService.resendVerificationEmail(email.toLowerCase().trim());
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          email: result.data.email,
          expiresAt: result.data.expiresAt
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Resend verification endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * GET /api/public/auth/check-email/:email
 * Check if email is available for registration
 */
router.get('/check-email/:email', emailCheckLimiter, async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Check email availability
    const result = await signupService.checkEmailAvailability(email.toLowerCase().trim());
    
    res.status(200).json({
      success: result.success,
      available: result.available,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Email check endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * GET /api/public/auth/password-strength
 * Check password strength (for frontend validation)
 */
router.post('/password-strength', emailCheckLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }
    
    const validation = signupService.validatePassword(password);
    
    res.status(200).json({
      success: true,
      isValid: validation.isValid,
      strength: validation.strength,
      errors: validation.errors
    });
    
  } catch (error) {
    console.error('❌ Password strength endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * POST /api/public/auth/forgot-password
 * Request a password reset email
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const result = await signupService.requestPasswordReset(email.toLowerCase().trim());

    // Always return 200 with a generic message to avoid leaking account existence
    res.status(200).json({
      success: result.success,
      message: result.message
    });

  } catch (error) {
    console.error('❌ Forgot password endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * POST /api/public/auth/reset-password
 * Reset password using a valid reset token
 */
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required'
      });
    }

    const result = await signupService.resetPassword(token, password);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors
      });
    }

  } catch (error) {
    console.error('❌ Reset password endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * GET /api/public/health
 * Health check endpoint for public services
 */
router.get('/health', async (req, res) => {
  try {
    // Test email service connection
    const emailHealthy = await emailService.testConnection();
    
    res.status(200).json({
      success: true,
      message: 'Public services are healthy',
      services: {
        email: emailHealthy ? 'healthy' : 'degraded',
        database: 'healthy' // If we reach here, DB is working
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(503).json({
      success: false,
      message: 'Some services are unavailable',
      services: {
        email: 'unknown',
        database: 'degraded'
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
