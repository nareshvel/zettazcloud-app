#!/usr/bin/env node
/**
 * Bootstrap a platform staff user (system-console login).
 *
 *   node scripts/create-platform-admin.js --email you@zettaz.com --name "You" --password 'Secret!234' [--role "System Admin"]
 *
 * The first admin must be created here (the console's own user-management
 * page requires an existing admin to reach it). Later staff are created via
 * System → System users.
 *
 * Idempotent: re-running with the same email updates the password and
 * re-asserts the role rather than failing.
 */
'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : dflt;
};

const email = String(arg('--email', '') || '').trim().toLowerCase();
const name = String(arg('--name', '') || '').trim();
const password = String(arg('--password', '') || '');
const roleName = String(arg('--role', 'System Admin') || 'System Admin');

const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };

(async () => {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) fail('--email is required and must be a valid email');
  if (!name) fail('--name is required');
  if (password.length < 10) fail('--password must be at least 10 characters');

  const [[role]] = await pool.query(
    'SELECT id, name FROM roles WHERE tenant_id IS NULL AND name = ?', [roleName]);
  if (!role) fail(`platform role "${roleName}" not found — run migrations first`);

  const hash = await bcrypt.hash(password, 10);

  const [existing] = await pool.query('SELECT id, tenant_id FROM users WHERE email = ?', [email]);
  let userId;
  if (existing.length) {
    userId = existing[0].id;
    if (existing[0].tenant_id !== PLATFORM_TENANT_ID) {
      fail(`${email} belongs to a tenant account — use a different email for platform staff`);
    }
    await pool.query(
      `UPDATE users SET name = ?, password_hash = ?, is_active = 1,
         email_verified = 1, signup_completed = 1, updated_at = NOW() WHERE id = ?`,
      [name, hash, userId]);
    console.log(`→ Updated existing platform user ${email}`);
  } else {
    userId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash,
                          is_active, email_verified, signup_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, 1, NOW(), NOW())`,
      [userId, PLATFORM_TENANT_ID, name, email, hash]);
    console.log(`→ Created platform user ${email}`);
  }

  // Assert the role (clear other platform roles first — one platform role per staff member)
  await pool.query(
    `DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ? AND r.tenant_id IS NULL`, [userId]);
  await pool.query(
    `INSERT INTO user_roles (id, user_id, role_id, scope, assigned_by, created_at)
     VALUES (?, ?, ?, 'tenant', '00000000-0000-0000-0000-000000000002', NOW())`,
    [uuidv4(), userId, role.id]);

  console.log(`✓ ${email} → ${roleName}. Sign in at /login — you'll land on /system.`);
})()
  .catch((e) => { console.error('✗', e.message); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch (_) {} process.exit(process.exitCode || 0); });
