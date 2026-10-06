const { query } = require('../db');
const bcrypt = require('bcryptjs');
const signupService = require('../services/signupService');

/**
 * @route   POST /api/users/change-password
 * @desc    Change user password
 * @access  Private (requires authentication)
 */
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  // Use camelCase internally for consistency
  const currentPassword = current_password;
  const newPassword = new_password;
  const userId = (req.user?.id || "system"); // Provided by authenticate middleware
  const tenantId = (req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null); // Provided by authenticate middleware

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide your current and new passwords.' });
  }

  // Same rules enforced at signup (signupService.validatePassword) — kept in
  // sync so the requirement is consistent everywhere a password is set, not
  // just "8 characters" here vs. the fuller signup rule elsewhere.
  const validation = signupService.validatePassword(newPassword);
  if (!validation.isValid) {
    return res.status(400).json({
      message: `New password doesn't meet requirements: ${validation.errors.join('; ')}`,
      errors: validation.errors,
    });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({ message: 'New password must be different from your current password.' });
  }

  try {
    // Get current user from database
    const userQuery = 'SELECT id, password_hash FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1';
    const [user] = await query(userQuery, [userId, tenantId]);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if current password matches
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password in database
    const updateQuery = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?';
    await query(updateQuery, [newPasswordHash, userId, tenantId]);

    // Optionally, log this activity
    // await logActivity(userId, tenantId, 'PASSWORD_CHANGE', { userIdChanged: userId });

    res.status(200).json({ message: 'Password changed successfully.' });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error while changing password.', error: error.message });
  }
};
