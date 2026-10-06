const express = require('express');
const router = express.Router();
const { pool } = require('../db');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { v4: uuidv4 } = require('uuid');

// Middleware to log requests to these routes
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Supplier Route: ${req.method} ${req.originalUrl}`);
  next();
});

/**
 * @route   GET /api/suppliers
 * @desc    Get all suppliers for the authenticated user's tenant
 * @access  Private (requires suppliers.view permission)
 */
router.get('/', requirePermission('suppliers.view'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM suppliers WHERE tenant_id = ? ORDER BY supplier_name',
      [tenant_id]
    );
    res.json({
      status: 'success',
      results: rows.length,
      data: { suppliers: rows },
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch suppliers' });
  }
});

/**
 * @route   GET /api/suppliers/:id
 * @desc    Get a single supplier by ID
 * @access  Private (requires suppliers.view permission)
 */
router.get('/:id', requirePermission('suppliers.view'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
  const { id } = req.params;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Supplier not found or not authorized.' });
    }

    res.json({ status: 'success', data: { supplier: rows[0] } });
  } catch (error) {
    console.error('Error fetching supplier by ID:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch supplier' });
  }
});

/**
 * @route   POST /api/suppliers
 * @desc    Create a new supplier
 * @access  Private (requires suppliers.create permission)
 */
router.post('/', requirePermission('suppliers.create'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
  const created_by_user_id = req.user?.id || 'system';

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  const {
    supplier_name,
    contact_person = null,
    email = null,
    phone = null,
    address_line1 = null,
    address_line2 = null,
    city = null,
    state_province = null,
    postal_code = null,
    country = null,
    website = null,
    tax_id = null,
    default_payment_terms = null,
    notes = null,
    is_active = true,
  } = req.body;

  if (!supplier_name) {
    return res.status(400).json({ status: 'error', message: 'Supplier name is required.' });
  }

  const newSupplierId = uuidv4();

  try {
    const [result] = await pool.execute(
      `INSERT INTO suppliers (id, tenant_id, supplier_name, contact_person, email, phone, 
                            address_line1, address_line2, city, state_province, postal_code, country, 
                            website, tax_id, default_payment_terms, notes, is_active, created_by_user_id, updated_by_user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [
        newSupplierId, tenant_id, supplier_name, contact_person, email, phone,
        address_line1, address_line2, city, state_province, postal_code, country,
        website, tax_id, default_payment_terms, notes, is_active,
        created_by_user_id, created_by_user_id
      ]
    );

    if (result.affectedRows === 1) {
      const [rows] = await pool.execute('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?', [newSupplierId, tenant_id]);
      res.status(201).json({ status: 'success', data: { supplier: rows[0] } });
    } else {
      res.status(500).json({ status: 'error', message: 'Failed to create supplier' });
    }
  } catch (error) {
    console.error('Error creating supplier:', error);
    if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('uq_supplier_email_tenant'))) { 
        return res.status(409).json({ status: 'error', message: 'Supplier with this email already exists for this tenant.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to create supplier' });
  }
});

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update a supplier by ID
 * @access  Private (requires suppliers.update permission)
 */
router.put('/:id', requirePermission('suppliers.update'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
  const updated_by_user_id = req.user?.id || 'system';
  const { id } = req.params;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  // Fetch existing supplier to ensure it belongs to the tenant
  try {
    const [existing] = await pool.execute('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Supplier not found or not authorized to update.' });
    }
  } catch (error) {
    console.error('Error fetching supplier for update check:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve supplier before update.' });
  }

  // Build SET clause dynamically
  const fieldsToUpdate = {};
  const allowedFields = [
    'supplier_name', 'contact_person', 'email', 'phone', 'address_line1', 'address_line2',
    'city', 'state_province', 'postal_code', 'country', 'website', 'tax_id',
    'default_payment_terms', 'notes', 'is_active'
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      fieldsToUpdate[key] = req.body[key];
    }
  }

  if (Object.keys(fieldsToUpdate).length === 0 && req.body.is_active === undefined) { 
    return res.status(400).json({ status: 'error', message: 'No valid fields provided for update.' });
  }

  fieldsToUpdate.updated_by_user_id = updated_by_user_id;

  const setClauses = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(fieldsToUpdate), id, tenant_id];

  try {
    const [result] = await pool.execute(
      `UPDATE suppliers SET ${setClauses} WHERE id = ? AND tenant_id = ?`,
      values
    );

    // Check if the update was successful
    // affectedRows = 0 can mean "no changes needed" which is still a success
    // We need to check if the supplier still exists to distinguish between "not found" and "no changes"
    if (result.affectedRows >= 0) {
      // Verify the supplier still exists (it should, since we checked before)
      const [rows] = await pool.execute('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
      if (rows.length > 0) {
        // Supplier exists, update was successful (even if no changes were made)
        res.json({ status: 'success', data: { supplier: rows[0] } });
      } else {
        // Supplier doesn't exist anymore (shouldn't happen, but handle it)
        res.status(404).json({ status: 'error', message: 'Supplier not found after update attempt.' });
      }
    } else {
      // This shouldn't happen with MySQL, but handle it just in case
      res.status(500).json({ status: 'error', message: 'Unexpected database result during update.' });
    }
  } catch (error) {
    console.error('Error updating supplier:', error);
     if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('uq_supplier_email_tenant'))) { 
        return res.status(409).json({ status: 'error', message: 'Supplier with this email already exists for this tenant.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to update supplier' });
  }
});

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete a supplier by ID
 * @access  Private (requires suppliers.delete permission)
 */
router.delete('/:id', requirePermission('suppliers.delete'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
  const { id } = req.params;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  try {
    const [result] = await pool.execute(
      'DELETE FROM suppliers WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (result.affectedRows === 1) {
      res.status(200).json({ status: 'success', message: 'Supplier deleted successfully.' });
      // Or res.status(204).send(); for no content response
    } else {
      res.status(404).json({ status: 'error', message: 'Supplier not found or not authorized to delete.' });
    }
  } catch (error) {
    console.error('Error deleting supplier:', error);
    // Check for foreign key constraint errors if suppliers are linked to products
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || (error.message && error.message.includes('violates foreign key constraint'))) { 
        return res.status(409).json({ status: 'error', message: 'Cannot delete supplier. It is referenced by existing products.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to delete supplier' });
  }
});

module.exports = router;
