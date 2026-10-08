/**
 * Authentication Routes
 * Handles user authentication, login, and token management
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const { pool } = require('../config/db');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
// Import consolidated RBAC service
const rbacService = require('../services/rbacService');
const userSessionService = require('../services/userSessionService');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');

// Authentication middleware functions
const authMiddleware = require('../middleware/unifiedAuthMiddleware');

// Legacy middleware import (kept for reference during migration)
// const permissionMiddleware = require('../middleware/permissionMiddleware');

/**
 * @route POST /api/auth/login
 * @desc Login user and return token
 * @access Public
 */
router.post('/login', (req, res) => {
  // Pass the entire req, res to the login function
  // This ensures that last_login_at is properly updated
  authMiddleware.login(req, res);
});

/**
 * @route POST /api/auth/2fa/verify
 * @desc  Second step of login for users with 2FA enabled. Body: { pendingToken, code }.
 *        `code` may be a TOTP code or an unused backup code (checked in that order).
 *        On success, creates a real user_sessions row + issues a real full JWT with
 *        `sid`, exactly like a normal (non-2FA) login — mirrors the token-building
 *        shape in unifiedAuthMiddleware.js `login` (kept intentionally close so both
 *        paths produce an identical token shape; session creation itself is shared
 *        via userSessionService.createSession, per the session brief).
 * @access Public (gated by possession of a valid short-lived pendingToken)
 */
router.post('/2fa/verify', async (req, res) => {
  try {
    const { pendingToken, code } = req.body || {};
    if (!pendingToken || !code) {
      return res.status(400).json({ error: 'pendingToken and code are required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(pendingToken, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired pending token. Please log in again.' });
    }

    if (!decoded.pending2fa || !decoded.id) {
      return res.status(401).json({ error: 'Invalid pending token.' });
    }

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user || !user.totp_enabled || !user.totp_secret) {
      return res.status(401).json({ error: 'Two-factor authentication is not enabled for this account.' });
    }

    let codeIsValid = authenticator.verify({ token: String(code), secret: user.totp_secret });

    if (!codeIsValid) {
      // Fall back to checking unused backup codes.
      const [backupCodes] = await pool.query(
        'SELECT id, code_hash FROM user_backup_codes WHERE user_id = ? AND used_at IS NULL',
        [user.id]
      );
      for (const bc of backupCodes) {
        // eslint-disable-next-line no-await-in-loop
        const matches = await bcrypt.compare(String(code), bc.code_hash);
        if (matches) {
          codeIsValid = true;
          // eslint-disable-next-line no-await-in-loop
          await pool.query('UPDATE user_backup_codes SET used_at = NOW() WHERE id = ?', [bc.id]);
          break;
        }
      }
    }

    if (!codeIsValid) {
      return res.status(401).json({ error: 'Invalid verification code.' });
    }

    // From here on, mirror unifiedAuthMiddleware.js `login`'s token-building shape.
    let tenantId = user.tenant_id;
    let storeId = user.store_id;

    let rbacData = { roles: [], roleNames: [], permissions: [], systemRoles: [] };
    try {
      const rbacResult = await rbacService.getUserRolesAndPermissions(user.id, tenantId || null, storeId || null);
      if (rbacResult) {
        rbacData = {
          roles: Array.isArray(rbacResult.roles) ? rbacResult.roles : [],
          roleNames: Array.isArray(rbacResult.roleNames) ? rbacResult.roleNames : [],
          permissions: Array.isArray(rbacResult.permissions) ? rbacResult.permissions : [],
          systemRoles: Array.isArray(rbacResult.systemRoles) ? rbacResult.systemRoles : [],
        };
      }
    } catch (rbacError) {
      console.error('[2FA verify] Error getting RBAC data:', rbacError);
    }

    if (rbacData.roleNames.length === 0 && rbacData.permissions.length === 0) {
      rbacData.roleNames = ['user'];
      rbacData.permissions = ['dashboard.view'];
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: rbacData.permissions,
      roles: rbacData.roleNames,
      systemRoles: rbacData.systemRoles,
    };
    if (tenantId) {
      tokenPayload.tenant_id = tenantId;
      tokenPayload.tenantId = tenantId;
    }
    if (storeId) {
      tokenPayload.store_id = storeId;
      tokenPayload.storeId = storeId;
    }

    const sessionId = await userSessionService.createSession(req, { userId: user.id, tenantId });
    if (sessionId) {
      tokenPayload.sid = sessionId;
    }

    try {
      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    } catch (e) {
      console.error('[2FA verify] Failed to update last_login_at (non-blocking):', e.message);
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: tenantId,
        tenantId,
        store_id: storeId,
        storeId,
        roles: rbacData.roleNames || [],
        permissions: rbacData.permissions || [],
        systemRoles: rbacData.systemRoles || [],
      },
      token,
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Two-factor verification failed. Please try again.' });
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh token with updated permissions and roles
 * @access Private
 */
router.post('/refresh', authMiddleware.authenticate, async (req, res) => {
  try {
    const { tenantId, storeId } = req.body;
    
    // Get user data from authenticated request
    const user = {
      id: req.user?.id || "system",
      email: req.user?.email || "system@example.com",
      name: req.user.name
    };
    
    // Generate new token with updated context
    const tokenData = await authMiddleware.generateToken(user, tenantId, storeId);
    
    res.json(tokenData);
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Failed to refresh token. Please try again.' });
  }
});

/**
 * @route POST /api/auth/register
 * @desc Register a new system user
 * @access Private - Only for platform admins
 */
router.post('/register', 
  authenticate,
  requirePermission('platform.manage'),
  async (req, res) => {
    try {
      const { name, email, password } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email and password are required.' });
      }
      
      const result = await authMiddleware.register({ name, email, password });
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  });

/**
 * @route GET /api/auth/profile
 * @desc Get user profile with roles and permissions from consolidated RBAC service
 * @access Private
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    // User data is already in req.user from authenticate middleware
    const userId = req.user?.id || "system";
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
    const storeId = req.user?.store_id || req.query?.store_id || req.headers["x-store-id"] || null;
    
    // Get enhanced RBAC data from the consolidated service
    const rbacData = await rbacService.getUserRolesAndPermissions(userId, tenantId, storeId);
    
    // Enhance the user object with the detailed RBAC information
    const enhancedUser = {
      ...req.user,
      rbac: rbacData
    };
    
    res.json({ user: enhancedUser });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile. Please try again.' });
  }
});

/**
 * @route POST /api/auth/switch-tenant
 * @desc Switch to a different tenant context
 * @access Private
 */
router.post('/switch-tenant', authenticate, async (req, res) => {
  try {
    // Same camelCase/snake_case wire mismatch fixed in /switch-store above —
    // fetchApi sends this body as { tenant_id, store_id }, not { tenantId, storeId }.
    const { tenant_id: tenantId, store_id: storeId } = req.body;
    const userId = req.user?.id || "system";
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required.' });
    }
    
    // Verify that user has access to this tenant using the consolidated RBAC service
    const tenantRoles = await rbacService.getUserTenantRoles(userId, tenantId);
    
    if (!tenantRoles || tenantRoles.length === 0) {
      return res.status(403).json({ 
        message: 'You do not have permission to access this tenant.'
      });
    }
    
    // Get user data
    const user = {
      id: userId,
      email: req.user?.email || "system@example.com",
      name: req.user.name
    };
    
    // Generate new token with new tenant context and updated RBAC data
    // Note: authMiddleware still handles token generation
    const tokenData = await authMiddleware.generateToken(user, tenantId, storeId);
    
    res.json(tokenData);
  } catch (error) {
    console.error('Tenant switch error:', error);
    res.status(500).json({ message: 'Failed to switch tenant. Please try again.' });
  }
});

/**
 * @route POST /api/auth/switch-store
 * @desc Switch to a different store context within the same tenant
 * @access Private
 */
router.post('/switch-store', authenticate, async (req, res) => {
  try {
    // fetchApi (frontend/src/services/api.ts) converts every outgoing JSON
    // request body from camelCase to snake_case before it hits the wire, so
    // the frontend calling this with `{ storeId }` actually arrives here as
    // `{ store_id }` — reading camelCase `storeId` was always undefined,
    // which is why every switch-store call failed with "Store ID is
    // required." regardless of which UI button triggered it (same class of
    // bug fixed earlier in userRoutes.js's PATCH /me).
    const { store_id: storeId } = req.body;
    const userId = req.user?.id || "system";
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
    
    if (!tenantId) {
      return res.status(400).json({ message: 'You must be in a tenant context to switch stores.' });
    }
    
    if (!storeId) {
      return res.status(400).json({ message: 'Store ID is required.' });
    }
    
    // Verify user has access to this store using the consolidated RBAC service
    // Get roles with specific store scope
    const options = { storeId, scope: 'store' };
    const storeRoles = await rbacService.getUserTenantRoles(userId, tenantId, options);
    
    // Allow tenant admins to access any store in their tenant
    const isAdmin = await rbacService.isTenantAdmin(userId, tenantId);
    
    // If user is not a tenant admin and has no specific store roles, deny access
    if (!isAdmin && (!storeRoles || storeRoles.length === 0)) {
      return res.status(403).json({
        message: 'You do not have permission to access this store.'
      });
    }
    
    // Get user data
    const user = {
      id: userId,
      email: req.user?.email || "system@example.com",
      name: req.user.name
    };
    
    // Generate new token with new store context, keeping same tenant
    const tokenData = await authMiddleware.generateToken(user, tenantId, storeId);
    
    res.json(tokenData);
  } catch (error) {
    console.error('Store switch error:', error);
    res.status(500).json({ message: 'Failed to switch store. Please try again.' });
  }
});

module.exports = router;
