/**
 * Signup Service for Public Registration
 * Handles user registration, email verification, and tenant provisioning
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
// Centralized JWT secret — enforces a real secret in production (see config/constants.js).
const { JWT_SECRET } = require('../config/constants');
const emailService = require('./emailService');
const subscriptionService = require('./subscriptionService');
const PermissionSeedingService = require('./permissionSeedingService');
const TenantProvisioningService = require('./tenantProvisioningService');
const templateProvisioningService = require('./templateProvisioningService');

// Single source of truth for the trial length — the landing page (frontend/src/pages/
// LandingPage.tsx) promises "14-Day Free Trial" in several places; this used to be
// hardcoded separately here as 30 days, silently contradicting that promise. Change it
// once, here, if the trial length ever changes — and update the landing page copy and
// OnboardingWizard.tsx's "Trial: N days remaining" summary line to match.
const TRIAL_LENGTH_DAYS = 14;

class SignupService {
  /**
   * Register a new user with email verification
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} - Registration result
   */
  async registerUser(userData) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const { name, email, password, phoneNumber, businessName, selectedPlan = 'professional' } = userData;

      // Validate required fields
      if (!name || !email || !password || !phoneNumber) {
        throw new Error('Missing required fields: name, email, password, phoneNumber');
      }

      // Check if email already exists
      const [existingUsers] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingUsers.length > 0) {
        throw new Error('Email address is already registered');
      }

      // Generate verification token and expiry
      const verificationToken = emailService.generateVerificationToken();
      const verificationExpiry = emailService.generateVerificationExpiry();

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create tenant — a lightweight row so users.tenant_id (NOT NULL) has
      // a valid FK target. All heavy provisioning (store, roles, payment
      // methods, subscription, print templates) is deferred to
      // verifyEmail() so that an unverified signup leaves only 2 orphan
      // rows (tenant + user) instead of 30+ tables of data. The tenant
      // name is the business name if provided, otherwise the person's name
      // + "'s Business" — the onboarding wizard can change it later.
      const tenantId = uuidv4();
      const tenantName = businessName || `${name}'s Business`;

      await connection.execute(`
        INSERT INTO tenants (
          id, name, created_at, updated_at,
          setup_completed, trial_started_at, onboarding_step
        ) VALUES (?, ?, NOW(), NOW(), FALSE, NOW(), 'email_verification')
      `, [tenantId, tenantName]);

      // Create user — NOT assigned to a store yet (store_id = NULL). The
      // store is created during verifyEmail() and the user is linked to it
      // at that point. email_verified = FALSE blocks login until the user
      // clicks the verification link (see unifiedAuthMiddleware.js login
      // handler).
      const userId = uuidv4();
      await connection.execute(`
        INSERT INTO users (
          id, name, email, password_hash, phone_number, tenant_id, store_id,
          email_verified, verification_token, verification_expires,
          signup_completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, FALSE, ?, ?, FALSE, NOW(), NOW())
      `, [
        userId, name, email, hashedPassword, phoneNumber, tenantId,
        verificationToken, verificationExpiry
      ]);

      // Store the selected plan on the tenant settings so verifyEmail()
      // can use it when creating the trial subscription. We can't pass it
      // through the verification token (which is opaque), so we stash it
      // here.
      await connection.execute(
        `UPDATE tenants SET settings = JSON_OBJECT('selectedPlan', ?) WHERE id = ?`,
        [selectedPlan, tenantId]
      );

      // Commit transaction — only tenant + user rows exist at this point.
      await connection.commit();

      // Send verification email asynchronously (non-blocking)
      emailService.sendVerificationEmail(email, name, verificationToken).catch(error => {
        console.error(`Failed to send verification email to ${email}:`, error);
      });

      // NOTE: No store, roles, payment methods, subscription, or background
      // provisioning happens here — all of that is deferred to
      // verifyEmail() so unverified signups don't create orphan data.
      // Previously this created 30+ rows across 7 tables immediately,
      // which is why a user could see a store right after signup without
      // ever verifying their email (audit Gap 2 + 5).

      console.log(`✅ User registered (pending verification): ${email}`);

      return {
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        data: {
          userId,
          tenantId,
          storeId: null,
          email,
          name,
          emailSent: true // Email is sent asynchronously
        }
      };

    } catch (error) {
      await connection.rollback();
      console.error('❌ Registration failed:', error);

      return {
        success: false,
        message: error.message || 'Registration failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Provision tenant infrastructure after email verification.
   *
   * This creates the default store, Tenant Admin role, payment methods,
   * payment settings, trial subscription, and runs background provisioning
   * (Store Manager/Cashier roles, print templates). Called from verifyEmail()
   * after the user's email is confirmed.
   *
   * Previously all of this happened at signup time in registerUser(), which
   * meant an unverified signup created 30+ rows across 7 tables — including
   * a store the user could see if they managed to log in. Deferring it here
   * means unverified signups leave only 2 orphan rows (tenant + user).
   *
   * @param {Object} connection - DB connection (inside a transaction)
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - User ID (the verified user)
   * @param {string} tenantName - Tenant name (for store naming)
   * @param {string} email - User email (for store contact)
   * @param {string} phoneNumber - User phone (for store contact)
   */
  async provisionTenantAfterVerification(connection, tenantId, userId, tenantName, email, phoneNumber) {
    // 1. Create default store
    const storeId = uuidv4();
    await connection.execute(`
      INSERT INTO stores (
        id, name, tenant_id, address, phone, email,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      storeId,
      `${tenantName} - Main Store`,
      tenantId,
      'Address to be updated',
      phoneNumber,
      email
    ]);

    // 2. Link user to the store
    await connection.execute(
      'UPDATE users SET store_id = ?, updated_at = NOW() WHERE id = ?',
      [storeId, userId]
    );

    // 3. Create tenant admin role
    const tenantAdminRoleId = require('crypto').randomUUID();
    await connection.execute(`
      INSERT INTO roles (id, name, description, tenant_id, is_system_role, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      tenantAdminRoleId,
      'Tenant Admin',
      'Full administrative access to tenant resources',
      tenantId,
      1,
      userId
    ]);

    // 4. Assign the tenant admin role to the user
    await connection.execute(
      'INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, NOW())',
      [userId, tenantAdminRoleId]
    );

    // Do NOT assign all permissions to Tenant Admin here. Admin bypass handles full access.
    console.log(`✅ Created and assigned Tenant Admin role to user: ${userId}`);

    // 5. Create default payment methods
    const defaultPaymentMethods = [
      [uuidv4(), tenantId, 'Cash', 'cash', true, false, 'cash', 1],
      [uuidv4(), tenantId, 'Credit/Debit Card', 'card', true, true, 'credit-card', 2],
      [uuidv4(), tenantId, 'Phone', 'phone', true, true, 'phone', 3],
      [uuidv4(), tenantId, 'Charge', 'ON_ACCOUNT', true, false, 'user', 4],
      [uuidv4(), tenantId, 'No Payment Required', 'none', true, false, 'check-circle', 99]
    ];

    await connection.execute(`
      INSERT INTO payment_methods (
        id, tenant_id, name, code, is_active, requires_terminal,
        icon, sort_order, created_at, updated_at
      ) VALUES
      ${defaultPaymentMethods.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(', ')}
    `, defaultPaymentMethods.flat());

    console.log(`✅ Created default payment methods for tenant: ${tenantId}`);

    // 6. Create default payment settings
    await connection.execute(`
      INSERT INTO tenant_payment_settings (
        tenant_id, default_currency, allow_partial_payments,
        created_at, updated_at
      ) VALUES (?, ?, ?, NOW(), NOW())
    `, [tenantId, 'USD', true]);

    console.log(`✅ Created payment settings for tenant: ${tenantId}`);

    // 7. Create trial subscription — read the selected plan from tenant
    // settings (stashed at signup time) or default to 'professional'.
    let selectedPlan = 'professional';
    try {
      const [[tenantRow]] = await connection.execute(
        'SELECT settings FROM tenants WHERE id = ?',
        [tenantId]
      );
      if (tenantRow?.settings) {
        const settings = typeof tenantRow.settings === 'string'
          ? JSON.parse(tenantRow.settings)
          : tenantRow.settings;
        if (settings?.selectedPlan) {
          selectedPlan = settings.selectedPlan;
        }
      }
    } catch (e) { /* fall back to default */ }

    await this.createTrialSubscription(connection, tenantId, selectedPlan);

    return storeId;
  }
  
  /**
   * Verify user email with token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} - Verification result
   */
  async verifyEmail(token) {
    const connection = await pool.getConnection();
    
    try {
      // Find user by verification token
      const [users] = await connection.execute(`
        SELECT u.id, u.name, u.email, u.tenant_id, u.phone_number, u.verification_expires,
               u.email_verified,
               t.name as tenant_name
        FROM users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE u.verification_token = ? AND u.email_verified = FALSE
      `, [token]);
      
      if (users.length === 0) {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }
      
      const user = users[0];
      
      // Check if user is already verified (idempotency protection)
      if (user.email_verified) {
        console.log(`ℹ️ Email already verified for user: ${user.email} - returning existing token`);
        
        // Generate JWT token for already verified user
        const jwtSecret = JWT_SECRET;
        const tokenPayload = {
          id: user.id,
          email: user.email,
          tenant_id: user.tenant_id,
          store_id: null,
          roles: [],
          permissions: []
        };
        
        const jwtToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '24h' });
        
        return {
          success: true,
          message: 'Email already verified successfully',
          token: jwtToken,
          data: {
            email: user.email,
            name: user.name,
            tenantName: user.tenant_name
          }
        };
      }
      
      // Check if token has expired
      if (new Date() > new Date(user.verification_expires)) {
        return {
          success: false,
          message: 'Verification token has expired. Please request a new one.'
        };
      }
      
      await connection.beginTransaction();
      
      // Update user as verified
      await connection.execute(`
        UPDATE users 
        SET email_verified = TRUE, 
            verification_token = NULL, 
            verification_expires = NULL,
            signup_completed = TRUE,
            updated_at = NOW()
        WHERE id = ?
      `, [user.id]);
      
      // Update tenant onboarding step
      await connection.execute(`
        UPDATE tenants
        SET onboarding_step = 'store_setup',
            updated_at = NOW()
        WHERE id = ?
      `, [user.tenant_id]);

      // Provision tenant infrastructure (store, roles, payment methods,
      // subscription) — this was deferred from registerUser() so that
      // unverified signups don't create orphan data. Check if a store
      // already exists first (idempotency: if the user re-verifies or
      // the token is submitted twice, we don't want duplicate stores).
      const [existingStores] = await connection.execute(
        'SELECT id FROM stores WHERE tenant_id = ? LIMIT 1',
        [user.tenant_id]
      );

      let storeId = null;
      if (existingStores.length === 0) {
        storeId = await this.provisionTenantAfterVerification(
          connection,
          user.tenant_id,
          user.id,
          user.tenant_name,
          user.email,
          user.phone_number || ''
        );
        console.log(`✅ Tenant provisioned after verification: store=${storeId}`);
      } else {
        storeId = existingStores[0].id;
        console.log(`ℹ️ Store already exists for tenant ${user.tenant_id}, skipping provisioning`);
      }

      // Check if welcome email was already sent (prevent duplicates)
      const [emailLogRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ? AND action = "welcome_email_sent"',
        [user.id]
      );
      
      const welcomeEmailAlreadySent = emailLogRows[0].count > 0;
      let emailSent = false; // Initialize emailSent variable
      
      if (!welcomeEmailAlreadySent) {
        console.log(`📧 Sending welcome email to ${user.email}...`);
        // Send welcome email
        emailSent = await emailService.sendWelcomeEmail(
          user.email,
          user.name,
          user.tenant_name
        );
        
        if (emailSent) {
          // Log that welcome email was sent to prevent duplicates
          await connection.execute(`
            INSERT INTO audit_logs (id, user_id, tenant_id, action, details, ip_address, user_agent, created_at)
            VALUES (UUID(), ?, ?, 'welcome_email_sent', JSON_OBJECT('email', ?, 'timestamp', NOW()), 'system', 'email_service', NOW())
          `, [user.id, user.tenant_id, user.email]);
          console.log(`✅ Welcome email sent successfully to ${user.email}`);
        } else {
          console.log(`⚠️ Failed to send welcome email to ${user.email}`);
        }
      } else {
        console.log(`ℹ️ Welcome email already sent to ${user.email}, skipping duplicate`);
        emailSent = true; // Email was already sent previously
      }
      
      await connection.commit();

      console.log(`✅ Email verified successfully: ${user.email}`);

      // Background provisioning — seed Store Manager and Cashier roles,
      // ensure store, enable default features, and provision print templates.
      // This runs AFTER commit in its own try/catch so a failure never
      // rolls back the verification. Moved here from registerUser() so
      // it only runs for verified users (audit Gap 5).
      setImmediate(async () => {
        try {
          await TenantProvisioningService.provisionTenant(user.tenant_id, { requestedBy: user.id });
          console.log(`✅ Background: Tenant provisioning completed for tenant: ${user.tenant_id}`);
        } catch (error) {
          console.error(`❌ Background: Tenant provisioning failed for tenant ${user.tenant_id}:`, error);
        }

        // Print templates — General Retail set (business type isn't known
        // until onboarding). The onboarding wizard re-provisions if the
        // tenant picks a different industry.
        try {
          const result = await templateProvisioningService.provisionTenantTemplates(
            user.tenant_id, { publish: true, createdBy: user.id },
          );
          const created = result.reduce((n, r) => n + (r.created ? r.created.length : 0), 0);
          console.log(`✅ Background: ${created} print template(s) provisioned for tenant: ${user.tenant_id}`);
        } catch (error) {
          console.error(`❌ Background: Template provisioning failed for tenant ${user.tenant_id}:`, error);
        }
      });

      // Generate JWT token for authenticated access to onboarding
      const jwtSecret = JWT_SECRET;
      const tokenPayload = {
        id: user.id,
        email: user.email,
        tenant_id: user.tenant_id,
        store_id: storeId, // Now set — store was created during provisioning
        roles: [],
        permissions: []
      };
      
      const jwtToken = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: '24h' // Token valid for 24 hours
      });
      
      return {
        success: true,
        message: 'Email verified successfully! Welcome to Zettaz Cloud POS.',
        token: jwtToken, // Add authentication token
        data: {
          userId: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          name: user.name,
          tenantName: user.tenant_name,
          emailSent
        }
      };
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Email verification failed:', error);
      
      return {
        success: false,
        message: 'Email verification failed. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      };
    } finally {
      connection.release();
    }
  }
  
  /**
   * Resend verification email
   * @param {string} email - User email
   * @returns {Promise<Object>} - Resend result
   */
  async resendVerificationEmail(email) {
    const connection = await pool.getConnection();
    
    try {
      // Find unverified user
      const [users] = await connection.execute(`
        SELECT id, name, email, verification_token, verification_expires
        FROM users 
        WHERE email = ? AND email_verified = FALSE
      `, [email]);
      
      if (users.length === 0) {
        return {
          success: false,
          message: 'Email not found or already verified'
        };
      }
      
      const user = users[0];
      
      // Generate new verification token if needed
      let verificationToken = user.verification_token;
      let verificationExpiry = user.verification_expires;
      
      // If token expired or doesn't exist, generate new one
      if (!verificationToken || new Date() > new Date(verificationExpiry)) {
        verificationToken = emailService.generateVerificationToken();
        verificationExpiry = emailService.generateVerificationExpiry();
        
        await connection.execute(`
          UPDATE users 
          SET verification_token = ?, 
              verification_expires = ?,
              updated_at = NOW()
          WHERE id = ?
        `, [verificationToken, verificationExpiry, user.id]);
      }
      
      // Send verification email
      const emailSent = await emailService.sendVerificationEmail(
        user.email,
        user.name,
        verificationToken
      );
      
      if (!emailSent) {
        return {
          success: false,
          message: 'Failed to send verification email. Please try again later.'
        };
      }
      
      console.log(`✅ Verification email resent: ${email}`);
      
      return {
        success: true,
        message: 'Verification email sent! Please check your inbox.',
        data: {
          email: user.email,
          expiresAt: verificationExpiry
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to resend verification email:', error);
      
      return {
        success: false,
        message: 'Failed to resend verification email. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      };
    } finally {
      connection.release();
    }
  }
  
  /**
   * Check if email is available for registration
   * @param {string} email - Email to check
   * @returns {Promise<Object>} - Availability result
   */
  async checkEmailAvailability(email) {
    try {
      const [users] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      return {
        success: true,
        available: users.length === 0,
        message: users.length === 0 ? 'Email is available' : 'Email is already registered'
      };
      
    } catch (error) {
      console.error('❌ Failed to check email availability:', error);
      
      return {
        success: false,
        message: 'Failed to check email availability',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      };
    }
  }
  
  /**
   * Create trial subscription for new tenant
   * @param {Object} connection - Database connection
   * @param {string} tenantId - Tenant ID
   * @param {string} selectedPlan - Selected plan name (starter, professional, enterprise)
   */
  async createTrialSubscription(connection, tenantId, selectedPlan = 'professional') {
    try {
      // Plan name mapping for database lookup
      const planNameMap = {
        'starter': 'Starter',
        'professional': 'Professional', 
        'enterprise': 'Enterprise'
      };
      
      const dbPlanName = planNameMap[selectedPlan] || 'Professional';
      
      // Find the plan in the correct plans table (used by foreign key)
      const [plans] = await connection.execute(
        'SELECT id FROM plans WHERE name = ? AND is_active = 1',
        [dbPlanName]
      );
      
      if (plans.length === 0) {
        console.log(`⚠️ Plan '${dbPlanName}' not found in plans table`);
        console.log(`ℹ️ User signup will continue without trial subscription`);
        return; // Don't fail signup, just skip subscription
      }
      
      const planId = plans[0].id;
      console.log(`✅ Found plan '${dbPlanName}' with ID: ${planId}`);
      
      // Create subscription with proper dates
      const subscriptionId = require('crypto').randomUUID();
      const startDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + TRIAL_LENGTH_DAYS);
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 year subscription
      
      await connection.execute(`
        INSERT INTO subscriptions (
          id, tenant_id, plan_id, status, 
          start_date, end_date, trial_end_date, auto_renew,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        subscriptionId, tenantId, planId, 'trial',
        startDate.toISOString().split('T')[0], // Convert to DATE format
        endDate.toISOString().split('T')[0],
        trialEndDate.toISOString().split('T')[0],
        1 // auto_renew = true
      ]);
      
      console.log(`✅ Trial subscription created for tenant: ${tenantId}`);
      
    } catch (error) {
      console.error('❌ Failed to create trial subscription:', error);
      // Don't throw error - subscription creation failure shouldn't block user registration
    }
  }
  
  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} - Validation result
   */
  validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }
  
  /**
   * Calculate password strength score
   * @param {string} password - Password to analyze
   * @returns {string} - Strength level
   */
  calculatePasswordStrength(password) {
    let score = 0;
    
    // Length bonus
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    
    // Character variety bonus
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    
    // Complexity bonus
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) score += 1;
    if (/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)) score += 1;
    
    if (score <= 3) return 'weak';
    if (score <= 6) return 'medium';
    return 'strong';
  }
  
  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {Object} - Validation result
   */
  validatePhoneNumber(phoneNumber) {
    // Basic phone number validation (can be enhanced based on requirements)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    return {
      isValid: phoneRegex.test(cleanPhone),
      formatted: cleanPhone,
      message: phoneRegex.test(cleanPhone) ? 'Valid phone number' : 'Invalid phone number format'
    };
  }

  /**
   * Request a password reset for the given email.
   * Always resolves with a generic success result so callers cannot use this
   * endpoint to enumerate registered email addresses.
   * @param {string} email - Email address requesting a reset
   * @returns {Promise<Object>} - Result (always success:true unless an unexpected error occurs)
   */
  async requestPasswordReset(email) {
    try {
      const [users] = await pool.execute(
        'SELECT id, name, email FROM users WHERE email = ? AND is_active = 1',
        [email]
      );

      if (users.length > 0) {
        const user = users[0];
        const resetToken = emailService.generateVerificationToken();
        const resetExpiry = new Date();
        resetExpiry.setHours(resetExpiry.getHours() + 1); // 1 hour expiry for password resets

        await pool.execute(
          'UPDATE users SET password_reset_token = ?, password_reset_expires = ?, updated_at = NOW() WHERE id = ?',
          [resetToken, resetExpiry, user.id]
        );

        emailService.sendPasswordResetEmail(user.email, user.name, resetToken).catch(error => {
          console.error(`Failed to send password reset email to ${user.email}:`, error);
        });
      }

      // Generic response regardless of whether the email was found
      return {
        success: true,
        message: 'If an account exists for this email, a password reset link has been sent.'
      };

    } catch (error) {
      console.error('❌ Failed to process password reset request:', error);
      return {
        success: false,
        message: 'Failed to process password reset request. Please try again later.'
      };
    }
  }

  /**
   * Reset a user's password using a valid reset token
   * @param {string} token - Password reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} - Result
   */
  async resetPassword(token, newPassword) {
    try {
      if (!token) {
        return { success: false, message: 'Reset token is required' };
      }

      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors
        };
      }

      const [users] = await pool.execute(
        'SELECT id, password_reset_expires FROM users WHERE password_reset_token = ?',
        [token]
      );

      if (users.length === 0) {
        return { success: false, message: 'This password reset link is invalid or has already been used.' };
      }

      const user = users[0];
      if (!user.password_reset_expires || new Date() > new Date(user.password_reset_expires)) {
        return { success: false, message: 'This password reset link has expired. Please request a new one.' };
      }

      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await pool.execute(
        `UPDATE users
         SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW()
         WHERE id = ?`,
        [hashedPassword, user.id]
      );

      return { success: true, message: 'Your password has been reset successfully. You can now sign in.' };

    } catch (error) {
      console.error('❌ Failed to reset password:', error);
      return {
        success: false,
        message: 'Failed to reset password. Please try again later.'
      };
    }
  }
}

module.exports = new SignupService();
