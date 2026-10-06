/**
 * storageService
 * -----------------------------------------------------------------------------
 * Thin storage abstraction for attachments (certificates, photos, documents).
 *
 * RECOMMENDATION (implemented): use the `local` driver now — it reuses the same
 * disk-backed `/uploads` pattern the app already uses for product images, so it
 * works today with no new credentials or dependencies. Everything goes through
 * this module and each attachment row records its `storage_driver`, so switching
 * to S3 later is a config change plus one new driver — not a refactor of every
 * call site.
 *
 * Operationally, the one thing to get right with `local` is that the uploads
 * directory must live on a PERSISTENT volume (not the container's ephemeral
 * filesystem) or files vanish on redeploy. If that can't be guaranteed in
 * production, flip STORAGE_DRIVER=s3 and implement the s3 driver below.
 *
 * Config (env):
 *   STORAGE_DRIVER   local (default) | s3
 *   UPLOAD_ROOT      absolute path for the local driver (default ./uploads)
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;

const DRIVER = process.env.STORAGE_DRIVER || 'local';
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.join(__dirname, '..', 'uploads');

/** Build a tenant-scoped storage key so files never collide across tenants. */
function buildKey(tenantId, entityType, fileName) {
  const safe = String(fileName).replace(/[^\w.\-]/g, '_');
  return path.posix.join(String(tenantId), 'attachments', String(entityType), `${Date.now()}_${safe}`);
}

const localDriver = {
  name: 'local',
  async save(key, buffer) {
    const full = path.join(UPLOAD_ROOT, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return { key, url: `/uploads/${key}` };
  },
  async remove(key) {
    try { await fs.unlink(path.join(UPLOAD_ROOT, key)); } catch (_) { /* already gone */ }
  },
  publicUrl(key) { return `/uploads/${key}`; },
};

const s3Driver = {
  name: 's3',
  async save() { throw new Error('storageService: s3 driver not configured. Set STORAGE_DRIVER=local or implement this driver.'); },
  async remove() { /* no-op until implemented */ },
  publicUrl(key) { return key; },
};

function driver() {
  return DRIVER === 's3' ? s3Driver : localDriver;
}

module.exports = {
  DRIVER,
  UPLOAD_ROOT,
  buildKey,
  driverName: () => driver().name,
  save: (key, buffer) => driver().save(key, buffer),
  remove: (key) => driver().remove(key),
  publicUrl: (key) => driver().publicUrl(key),
};
