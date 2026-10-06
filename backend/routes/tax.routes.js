const express = require('express');
const router = express.Router();
const { pool } = require('../db');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { v4: uuidv4 } = require('uuid');

// --- Tax Classes Routes ---

/**
 * @route   GET /api/tax/tax-classes
 * @desc    Get all tax classes for the tenant
 * @access  Private (requires tax.view permission)
 */
// Export getTaxClasses function so it can be imported elsewhere
async function getTaxClasses(req, res) {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  try {
    const [taxClasses] = await pool.execute(
      'SELECT * FROM tax_classes WHERE tenant_id = ? AND is_active = true ORDER BY name ASC',
      [tenant_id]
    );
    res.json(taxClasses);
  } catch (error) {
    console.error('Error fetching tax classes:', error);
    res.status(500).json({ message: 'Failed to fetch tax classes', error: error.message });
  }
}

// Register the tax classes route
router.get('/tax-classes', requirePermission('tax.view'), getTaxClasses);

/**
 * @route   POST /api/tax/tax-classes
 * @desc    Create a new tax class
 * @access  Private (requires tax.create permission)
 */
router.post('/tax-classes', requirePermission('tax.create'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const { name, description, is_active = true, is_default = false, appliesToAllStores = false } = req.body;

  console.log(`[TAX CLASS CREATE] Starting for tenant: ${tenant_id}, user: ${req.user?.id}`);

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Tax class name is required.' });
  }
  if (!tenant_id) {
    return res.status(400).json({ message: 'Missing tenant ID in request.' });
  }

  const newClassId = uuidv4();
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Resolve store_id once and validate presence. `appliesToAllStores: true`
    // (explicit opt-in from the client) skips resolution entirely and
    // creates a tenant-wide default row (store_id = NULL) — see
    // docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §4.
    // A store with its own tax classes REPLACES this default for that store
    // (see taxCalculationService.js's getTaxClassesWithRates).
    let store_id = null;

    if (!appliesToAllStores) {
      store_id = req.user?.store_id || req.headers['x-store-id'] || req.headers['store-id'];

      console.log(`[TAX CLASS CREATE] Resolved store_id: ${store_id} from user: ${req.user?.store_id}, headers: ${req.headers['x-store-id']} | ${req.headers['store-id']}`);

      // Fallback: if store_id missing, resolve the tenant's active default/first store
      if (!store_id) {
        const [defaultStoreRows] = await connection.execute(
          'SELECT id FROM stores WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1',
          [tenant_id]
        );
        if (Array.isArray(defaultStoreRows) && defaultStoreRows.length > 0) {
          store_id = defaultStoreRows[0].id;
          console.log(`Resolved missing store_id using tenant ${tenant_id}'s active store: ${store_id}`);
        } else {
          await connection.rollback();
          return res.status(400).json({ message: 'No active store found for tenant. Please create a store before adding tax classes.' });
        }
      }

      // Validate the store exists for the tenant to avoid FK or data integrity errors
      const [storeRows] = await connection.execute(
        'SELECT id FROM stores WHERE id = ? AND tenant_id = ? AND is_active = 1',
        [store_id, tenant_id]
      );

      console.log(`[TAX CLASS CREATE] Store validation query result: ${storeRows.length} rows for store ${store_id}, tenant ${tenant_id}`);

      if (!Array.isArray(storeRows) || storeRows.length === 0) {
        await connection.rollback();
        console.log(`[TAX CLASS CREATE] Store validation failed - store ${store_id} not found for tenant ${tenant_id}`);
        return res.status(400).json({ message: 'Invalid store ID for this tenant' });
      }
    } else {
      console.log(`[TAX CLASS CREATE] appliesToAllStores=true — creating tenant-wide default tax class for tenant ${tenant_id}`);
    }

    console.log(`[TAX CLASS CREATE] Proceeding with INSERT: tenant_id=${tenant_id}, store_id=${store_id}, name=${name}`);

    const [result] = await connection.execute(
      'INSERT INTO tax_classes (id, tenant_id, store_id, name, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [newClassId, tenant_id, store_id, name, description, is_active === false ? 0 : 1]
    );

    console.log(`[TAX CLASS CREATE] INSERT successful, affectedRows: ${result.affectedRows}`);

    // If this is a default tax class, update the store's default_tax_class_id
    // AFTER INSERT. Only meaningful for a store-specific class — a
    // tenant-wide class (store_id NULL) has no single store row to point at.
    if ((is_default === true || is_default === 1) && store_id) {
      await connection.execute(
        'UPDATE stores SET default_tax_class_id = ? WHERE id = ? AND tenant_id = ?',
        [newClassId, store_id, tenant_id]
      );
      console.log(`[TAX CLASS CREATE] Set new tax class ${newClassId} as default for store ${store_id}`);
    }

    await connection.commit();

    if (result.affectedRows === 1) {
      const [newClass] = await connection.execute('SELECT * FROM tax_classes WHERE id = ?', [newClassId]);
      res.status(201).json(newClass[0]);
    } else {
      res.status(500).json({ message: 'Failed to create tax class due to an unexpected database issue.' });
    }
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating tax class:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A tax class with this name already exists for your tenant.' });
    }
    // Map common MySQL errors to client-friendly messages
    const code = error.code || '';
    if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({ message: 'Invalid reference. Please ensure the store or related IDs are valid.' });
    }
    if (code === 'ER_TRUNCATED_WRONG_VALUE' || code === 'ER_BAD_NULL_ERROR' || code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ message: 'Invalid data provided. Please check the input fields.' });
    }
    res.status(500).json({ message: 'Internal server error while creating tax class.' });
  } finally {
    if (connection) connection.release();
  }
});

// GET a specific tax class by ID
router.get('/tax-classes/:id', authenticate, async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const { id } = req.params;
  try {
    const [taxClass] = await pool.execute(
      'SELECT * FROM tax_classes WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );
    if (taxClass.length === 0) {
      return res.status(404).json({ message: 'Tax class not found or access denied.' });
    }
    res.json(taxClass[0]);
  } catch (error) {
    console.error('Error fetching tax class:', error);
    res.status(500).json({ message: 'Failed to fetch tax class', error: error.message });
  }
});

// PUT update a specific tax class by ID
/**
 * @route   PUT /api/tax/tax-classes/:id
 * @desc    Update a tax class
 * @access  Private (requires tax.edit permission)
 */
router.put('/tax-classes/:id', requirePermission('tax.edit'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const { id } = req.params;
  const { name, description, is_active, is_default } = req.body;

  if (name !== undefined && (name === null || name.trim() === '')) {
    return res.status(400).json({ message: 'Tax class name cannot be empty.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingClasses] = await connection.execute(
      'SELECT * FROM tax_classes WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (existingClasses.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Tax class not found or access denied.' });
    }

    // If this tax class is being set as default, update the store's default_tax_class_id
    if (is_default === true || is_default === 1) {
      const store_id = req.user?.store_id || req.headers['x-store-id'] || req.headers['store-id'] || existingClasses[0].store_id;
      if (store_id) {
        await connection.execute(
          'UPDATE stores SET default_tax_class_id = ? WHERE id = ? AND tenant_id = ?',
          [id, store_id, tenant_id]
        );
        console.log(`Updated default tax class to ${id} for store ${store_id}`);
      } else {
        console.warn('No store_id available to set default tax class');
      }
    }

    const updateFields = [];
    const values = [];

    if (name !== undefined) { updateFields.push('name = ?'); values.push(name); }
    if (description !== undefined) { updateFields.push('description = ?'); values.push(description); }
    if (is_active !== undefined) { updateFields.push('is_active = ?'); values.push(is_active); }
    // Note: is_default is handled separately by updating stores.default_tax_class_id

    if (updateFields.length === 0) {
      await connection.rollback();
      return res.status(200).json({ message: 'No changes detected.', data: existingClasses[0] });
    }

    updateFields.push('updated_at = NOW()');
    const sql = `UPDATE tax_classes SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`;
    values.push(id, tenant_id);

    const [result] = await connection.execute(sql, values);
    await connection.commit();

    if (result.affectedRows === 1) {
      const [updatedClass] = await pool.execute('SELECT * FROM tax_classes WHERE id = ?', [id]);
      res.status(200).json(updatedClass[0]);
    } else {
      res.status(404).json({ message: 'Tax class not found or no changes made.' });
    }
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error updating tax class:', error);
    if (error.code === 'ER_DUP_ENTRY' && name !== undefined) {
      return res.status(409).json({ message: 'Another tax class with this name already exists for your tenant.' });
    }
    res.status(500).json({ message: 'Internal server error while updating tax class.', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE a specific tax class by ID (soft delete)
/**
 * @route   DELETE /api/tax/tax-classes/:id
 * @desc    Delete a tax class
 * @access  Private (requires tax.delete permission)
 */
router.delete('/tax-classes/:id', requirePermission('tax.delete'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const { id } = req.params;
  try {
    const store_id = req.user?.store_id || req.headers['x-store-id'] || req.headers['store-id'];
    if (!store_id) {
      return res.status(400).json({ message: 'Missing store ID in request headers' });
    }
    
    const [storeCheck] = await pool.execute(
      'SELECT default_tax_class_id FROM stores WHERE id = ? AND tenant_id = ?',
      [store_id, tenant_id]
    );
    
    if (storeCheck.length > 0 && storeCheck[0].default_tax_class_id === id) {
      return res.status(400).json({ message: 'Cannot delete the default tax class. Set another class as default first.' });
    }

    const [taxClass] = await pool.execute(
      'SELECT id FROM tax_classes WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (taxClass.length === 0) {
      return res.status(404).json({ message: 'Tax class not found or access denied.' });
    }

    const [result] = await pool.execute(
      'UPDATE tax_classes SET is_active = false, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Tax class deactivated successfully.' });
    } else {
      res.status(404).json({ message: 'Tax class not found or no changes made.' });
    }
  } catch (error) {
    console.error('Error deactivating tax class:', error);
    res.status(500).json({ message: 'Internal server error while deactivating tax class.', details: error.message });
  }
});

// --- Tax Class Rates Routes (nested under a specific tax class) ---

// GET all rates for a specific tax class
router.get('/tax-classes/:classId/rates', authenticate, async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const { classId } = req.params;

  try {
    const [taxClassCheck] = await pool.execute(
      'SELECT id FROM tax_classes WHERE id = ? AND tenant_id = ?',
      [classId, tenant_id]
    );
    if (taxClassCheck.length === 0) {
      return res.status(404).json({ message: 'Tax class not found or access denied.' });
    }

    const [rates] = await pool.execute(
      'SELECT * FROM tax_class_rates WHERE tax_class_id = ? ORDER BY priority ASC, tax_rate_name ASC',
      [classId]
    );
    res.json(rates);
  } catch (error) {
    console.error('Error fetching tax class rates:', error);
    res.status(500).json({ message: 'Failed to fetch tax class rates', error: error.message });
  }
});

// POST a new rate for a specific tax class
/**
 * @route   POST /api/tax/tax-classes/:classId/rates
 * @desc    Create a new tax rate for a tax class
 * @access  Private (requires tax.create permission)
 */
router.post('/tax-classes/:classId/rates', requirePermission('tax.create'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const store_id = req.user?.store_id || req.headers['x-store-id'] || req.headers['store-id'];
  const { classId } = req.params;
  const { tax_rate_name, rate, priority = 0, is_compound = false, is_active = true } = req.body;

  if (!tax_rate_name || tax_rate_name.trim() === '') {
    return res.status(400).json({ message: 'Tax rate name is required.' });
  }
  if (rate === undefined || typeof rate !== 'number') {
    return res.status(400).json({ message: 'Rate is required and must be a number.' });
  }

  const newRateId = uuidv4();

  try {
    const [taxClassCheck] = await pool.execute(
      'SELECT id FROM tax_classes WHERE id = ? AND tenant_id = ?',
      [classId, tenant_id]
    );
    if (taxClassCheck.length === 0) {
      return res.status(404).json({ message: 'Tax class not found or access denied. Cannot add rate.' });
    }

    const [result] = await pool.execute(
      'INSERT INTO tax_class_rates (id, tax_class_id, tax_rate_name, rate, priority, is_compound, is_active, store_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [newRateId, classId, tax_rate_name, rate, priority, is_compound, is_active, store_id]
    );

    if (result.affectedRows === 1) {
      const [newRate] = await pool.execute('SELECT * FROM tax_class_rates WHERE id = ?', [newRateId]);
      res.status(201).json(newRate[0]);
    } else {
      res.status(500).json({ message: 'Failed to create tax rate due to an unexpected database issue.' });
    }
  } catch (error) {
    console.error('Error creating tax rate:', error);
    res.status(500).json({ message: 'Internal server error while creating tax rate.', details: error.message });
  }
});

// --- Individual Tax Rate Routes ---
// (Checks tenancy via tax_class_id)

// GET a specific tax rate by ID
router.get('/tax-rates/:rateId', authenticate, async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const { rateId } = req.params;

  try {
    const [rates] = await pool.execute(
      `SELECT tcr.* 
       FROM tax_class_rates tcr
       JOIN tax_classes tc ON tcr.tax_class_id = tc.id
       WHERE tcr.id = ? AND tc.tenant_id = ?`,
      [rateId, tenant_id]
    );

    if (rates.length === 0) {
      return res.status(404).json({ message: 'Tax rate not found or access denied.' });
    }
    res.json(rates[0]);
  } catch (error) {
    console.error('Error fetching tax rate:', error);
    res.status(500).json({ message: 'Failed to fetch tax rate', error: error.message });
  }
});

// PUT update a specific tax rate by ID
/**
 * @route   PUT /api/tax/tax-rates/:rateId
 * @desc    Update a tax rate
 * @access  Private (requires tax.edit permission)
 */
router.put('/tax-rates/:rateId', requirePermission('tax.edit'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const { rateId } = req.params;
  const { tax_rate_name, rate, priority, is_compound, is_active, tax_class_id } = req.body;

  if (tax_rate_name !== undefined && (tax_rate_name === null || tax_rate_name.trim() === '')) {
    return res.status(400).json({ message: 'Tax rate name cannot be empty.' });
  }
  if (rate !== undefined && typeof rate !== 'number') {
    return res.status(400).json({ message: 'Rate must be a number.' });
  }
  if (tax_class_id !== undefined && (tax_class_id === null || tax_class_id.trim() === '')) {
    return res.status(400).json({ message: 'Tax class ID cannot be empty if provided for update.' });
  }

  try {
    const [existingRates] = await pool.execute(
      `SELECT tcr.*, tc.tenant_id 
       FROM tax_class_rates tcr
       JOIN tax_classes tc ON tcr.tax_class_id = tc.id
       WHERE tcr.id = ? AND tc.tenant_id = ?`,
      [rateId, tenant_id]
    );

    if (existingRates.length === 0) {
      return res.status(404).json({ message: 'Tax rate not found or access denied.' });
    }

    if (tax_class_id !== undefined && tax_class_id !== existingRates[0].tax_class_id) {
      const [newTaxClassCheck] = await pool.execute(
        'SELECT id FROM tax_classes WHERE id = ? AND tenant_id = ?',
        [tax_class_id, tenant_id]
      );
      if (newTaxClassCheck.length === 0) {
        return res.status(400).json({ message: 'New tax class ID is invalid or does not belong to this tenant.' });
      }
    }

    const updateFields = [];
    const values = [];

    if (tax_rate_name !== undefined) { updateFields.push('tax_rate_name = ?'); values.push(tax_rate_name); }
    if (rate !== undefined) { updateFields.push('rate = ?'); values.push(rate); }
    if (priority !== undefined) { updateFields.push('priority = ?'); values.push(priority); }
    if (is_compound !== undefined) { updateFields.push('is_compound = ?'); values.push(is_compound); }
    if (is_active !== undefined) { updateFields.push('is_active = ?'); values.push(is_active); }
    if (tax_class_id !== undefined) { updateFields.push('tax_class_id = ?'); values.push(tax_class_id); }

    if (updateFields.length === 0) {
      return res.status(200).json({ message: 'No changes detected.', data: existingRates[0] });
    }

    updateFields.push('updated_at = NOW()');
    const sql = `UPDATE tax_class_rates SET ${updateFields.join(', ')} WHERE id = ?`;
    values.push(rateId);

    const [result] = await pool.execute(sql, values);

    if (result.affectedRows === 1) {
      const [updatedRate] = await pool.execute('SELECT * FROM tax_class_rates WHERE id = ?', [rateId]);
      res.status(200).json(updatedRate[0]);
    } else {
      res.status(404).json({ message: 'Tax rate not found or no changes made.' });
    }
  } catch (error) {
    console.error('Error updating tax rate:', error);
    res.status(500).json({ message: 'Internal server error while updating tax rate.', details: error.message });
  }
});

// DELETE a specific tax rate by ID (soft delete)
/**
 * @route   DELETE /api/tax/tax-rates/:rateId
 * @desc    Delete a tax rate
 * @access  Private (requires tax.delete permission)
 */
router.delete('/tax-rates/:rateId', requirePermission('tax.delete'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || req.headers["tenant-id"] || null;
  const { rateId } = req.params;

  try {
    const [existingRates] = await pool.execute(
      `SELECT tcr.id 
       FROM tax_class_rates tcr
       JOIN tax_classes tc ON tcr.tax_class_id = tc.id
       WHERE tcr.id = ? AND tc.tenant_id = ?`,
      [rateId, tenant_id]
    );

    if (existingRates.length === 0) {
      return res.status(404).json({ message: 'Tax rate not found or access denied.' });
    }

    const [result] = await pool.execute(
      'UPDATE tax_class_rates SET is_active = false, updated_at = NOW() WHERE id = ?',
      [rateId]
    );

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Tax rate deactivated successfully.' });
    } else {
      res.status(404).json({ message: 'Tax rate not found or no changes made.' });
    }
  } catch (error) {
    console.error('Error deactivating tax rate:', error);
    res.status(500).json({ message: 'Internal server error while deactivating tax rate.', details: error.message });
  }
});

module.exports = router;
module.exports.getTaxClasses = getTaxClasses;
