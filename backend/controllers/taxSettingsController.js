const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// @desc    Get all tax classes for a store (including tenant-wide)
// @route   GET /api/v1/settings/taxes/classes
// @access  Private
exports.getTaxClasses = async (req, res) => {
  const { tenant_id, store_id } = req.user; // Assuming auth middleware provides this

  if (!tenant_id || !store_id) {
    return res.status(400).json({ success: false, message: 'Tenant and store information are required.' });
  }

  try {
    const pool = db.pool;

    // Fetch the store's default tax class ID first
    const [storeResult] = await pool.query('SELECT default_tax_class_id FROM stores WHERE id = ?', [store_id]);
    const defaultTaxClassId = storeResult[0]?.default_tax_class_id || null;

    // Fetch all tax classes that are either specific to this store OR are tenant-wide (store_id is NULL)
    const query = `
      SELECT 
        tc.*,
        (SELECT COUNT(*) FROM tax_class_rates tcr WHERE tcr.tax_class_id = tc.id) as rates_count
      FROM tax_classes tc
      WHERE tc.tenant_id = ? AND (tc.store_id = ? OR tc.store_id IS NULL)
      ORDER BY tc.name ASC
    `;
    
    const [taxClasses] = await pool.query(query, [tenant_id, store_id]);

    res.status(200).json({
      success: true,
      default_tax_class_id: defaultTaxClassId,
      data: taxClasses,
    });
  } catch (error) {
    console.error('Error fetching tax classes:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching tax classes.' });
  }
};

// @desc    Create a new tax class
// @route   POST /api/v1/settings/taxes/classes
// @access  Private
exports.createTaxClass = async (req, res) => {
  const { name, description, is_default, scope } = req.body; // scope can be 'store' or 'tenant'
  const { tenant_id, store_id, role } = req.user;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Tax class name is required.' });
  }

  let connection;
  try {
    const pool = db.pool;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const newTaxClassId = uuidv4();
    
    // Tenant-wide classes can only be created by owners and if scope is 'tenant'
    const isTenantWide = (role === 'owner' && scope === 'tenant');

    const newTaxClass = {
      id: newTaxClassId,
      tenant_id,
      store_id: isTenantWide ? null : store_id, // Null for tenant-wide, store_id for store-specific
      name,
      description: description || null,
    };

    await connection.query('INSERT INTO tax_classes SET ?', newTaxClass);

    // A default tax class must be store-specific.
    if (is_default && !isTenantWide) {
      await connection.query(
        'UPDATE stores SET default_tax_class_id = ? WHERE id = ? AND tenant_id = ?',
        [newTaxClassId, store_id, tenant_id]
      );
    } else if (is_default && isTenantWide) {
        // If they try to make a tenant-wide class default, we can't do that at a store level here.
        // We can ignore it or send a warning. For now, we ignore.
    }

    await connection.commit();

    const [createdClassRows] = await connection.query('SELECT * FROM tax_classes WHERE id = ?', [newTaxClassId]);

    res.status(201).json({
      success: true,
      data: createdClassRows[0],
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating tax class:', error);
    res.status(500).json({ success: false, message: 'Server error while creating tax class.' });
  } finally {
    if (connection) connection.release();
  }
};
// @desc    Update a tax class
// @route   PUT /api/v1/settings/taxes/classes/:id
// @access  Private
exports.updateTaxClass = async (req, res) => {
  const { id } = req.params;
  const { name, description, is_default } = req.body;
  const { tenant_id, store_id, role } = req.user;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Tax class name is required.' });
  }

  let connection;
  try {
    const pool = db.pool;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Find the tax class and verify ownership/permissions
    const [taxClassRows] = await connection.query('SELECT * FROM tax_classes WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    const taxClass = taxClassRows[0];

    if (!taxClass) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Tax class not found or access denied.' });
    }

    // 2. Check permissions for editing
    const isTenantWide = taxClass.store_id === null;
    if (isTenantWide && role !== 'owner') {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Managers cannot edit tenant-wide tax classes.' });
    }

    // 3. Update tax class details
    await connection.query(
      'UPDATE tax_classes SET name = ?, description = ? WHERE id = ?',
      [name, description || null, id]
    );

    // 4. Handle default status change
    if (typeof is_default === 'boolean') {
      if (isTenantWide && is_default) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'A tenant-wide tax class cannot be set as the store default.' });
      }

      const [storeRows] = await connection.query('SELECT default_tax_class_id FROM stores WHERE id = ?', [store_id]);
      const currentDefaultId = storeRows[0]?.default_tax_class_id;

      if (is_default && currentDefaultId !== id) {
        // Set this class as the new default
        await connection.query('UPDATE stores SET default_tax_class_id = ? WHERE id = ?', [id, store_id]);
      } else if (!is_default && currentDefaultId === id) {
        // Unset this class as default
        await connection.query('UPDATE stores SET default_tax_class_id = NULL WHERE id = ?', [store_id]);
      }
    }

    await connection.commit();

    const [updatedClassRows] = await connection.query('SELECT * FROM tax_classes WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      data: updatedClassRows[0],
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error updating tax class:', error);
    res.status(500).json({ success: false, message: 'Server error while updating tax class.' });
  } finally {
    if (connection) connection.release();
  }
};
// @desc    Delete a tax class
// @route   DELETE /api/v1/settings/taxes/classes/:id
// @access  Private
exports.deleteTaxClass = async (req, res) => {
  const { id } = req.params;
  const { tenant_id, store_id, role } = req.user;

  let connection;
  try {
    const pool = db.pool;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Find the tax class and verify ownership
    const [taxClassRows] = await connection.query('SELECT * FROM tax_classes WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    const taxClass = taxClassRows[0];

    if (!taxClass) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Tax class not found or access denied.' });
    }

    // 2. Check permissions for deleting
    const isTenantWide = taxClass.store_id === null;
    if (isTenantWide && role !== 'owner') {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Managers cannot delete tenant-wide tax classes.' });
    }

    // 3. Check for associated tax rates
    const [rateRows] = await connection.query('SELECT id FROM tax_class_rates WHERE tax_class_id = ? LIMIT 1', [id]);
    if (rateRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Cannot delete tax class. It has associated tax rates. Please remove the rates first.' });
    }

    // 4. Check if it's the default tax class for the store and unset it
    const [storeRows] = await connection.query('SELECT id FROM stores WHERE id = ? AND default_tax_class_id = ?', [store_id, id]);
    if (storeRows.length > 0) {
      await connection.query('UPDATE stores SET default_tax_class_id = NULL WHERE id = ?', [store_id]);
    }

    // 5. Delete the tax class
    await connection.query('DELETE FROM tax_classes WHERE id = ?', [id]);

    await connection.commit();

    res.status(200).json({ success: true, message: 'Tax class deleted successfully.' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error deleting tax class:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting tax class.' });
  } finally {
    if (connection) connection.release();
  }
};

// @desc    Get all tax rates for a specific tax class
// @route   GET /api/v1/settings/taxes/classes/:taxClassId/rates
// @access  Private
exports.getTaxRatesForClass = async (req, res) => {
  const { taxClassId } = req.params;
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null; // For security, ensure the class belongs to the tenant

  if (!taxClassId) {
    return res.status(400).json({ success: false, message: 'Tax Class ID is required.' });
  }

  try {
    const pool = db.pool;

    // First, verify the tax class belongs to the current tenant to prevent data leakage
    const [taxClassCheck] = await pool.query(
      'SELECT id FROM tax_classes WHERE id = ? AND tenant_id = ?',
      [taxClassId, tenant_id]
    );

    if (taxClassCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Tax class not found or access denied.' });
    }

    // Fetch all rates for the given tax class
    const [rates] = await pool.query(
      'SELECT * FROM tax_class_rates WHERE tax_class_id = ? ORDER BY tax_rate_name ASC',
      [taxClassId]
    );

    res.status(200).json({
      success: true,
      data: rates,
    });
  } catch (error) {
    console.error(`Error fetching tax rates for class ${taxClassId}:`, error);
    res.status(500).json({ success: false, message: 'Server error while fetching tax rates.' });
  }
};
// @desc    Create a new tax rate for a tax class
// @route   POST /api/v1/settings/taxes/classes/:taxClassId/rates
// @access  Private
exports.createTaxRate = async (req, res) => {
  const { taxClassId } = req.params;
  const { tax_rate_name, rate, priority, is_compound } = req.body;
  const { tenant_id, role } = req.user;

  // Enhanced validation for required fields
  if (!tax_rate_name || tax_rate_name.trim() === '') {
    return res.status(400).json({ success: false, message: 'Tax rate name is required and cannot be empty.' });
  }

  // Validate rate is a valid number and within acceptable range
  const numericRate = parseFloat(rate);
  if (isNaN(numericRate)) {
    return res.status(400).json({ success: false, message: 'Tax rate must be a valid number.' });
  }

  if (numericRate < 0 || numericRate > 100) {
    return res.status(400).json({ success: false, message: 'Tax rate must be between 0 and 100 percent.' });
  }

  try {
    const pool = db.pool;

    // 1. Verify the tax class exists and belongs to the tenant
    const [taxClassRows] = await pool.query(
      'SELECT * FROM tax_classes WHERE id = ? AND tenant_id = ?',
      [taxClassId, tenant_id]
    );

    if (taxClassRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tax class not found or access denied.' });
    }

    const taxClass = taxClassRows[0];

    // 2. Verify permissions for editing the class (tenant-wide vs store-specific)
    const isTenantWide = taxClass.store_id === null;
    if (isTenantWide && role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Managers cannot add rates to tenant-wide tax classes.' });
    }

    // Validate priority is a non-negative integer
    let validPriority = 0;
    if (priority !== undefined) {
      validPriority = parseInt(priority);
      if (isNaN(validPriority) || validPriority < 0) {
        validPriority = 0;
      }
    }

    // 3. Create the new tax rate
    const newRateId = uuidv4();
    const newRate = {
      id: newRateId,
      tax_class_id: taxClassId,
      tax_rate_name: tax_rate_name.trim(),
      rate: numericRate,
      priority: validPriority,
      is_compound: !!is_compound,
    };

    await pool.query('INSERT INTO tax_class_rates SET ?', newRate);

    const [createdRateRows] = await pool.query('SELECT * FROM tax_class_rates WHERE id = ?', [newRateId]);

    res.status(201).json({
      success: true,
      data: createdRateRows[0],
    });

  } catch (error) {
    console.error('Error creating tax rate:', error);
    res.status(500).json({ success: false, message: 'Server error while creating tax rate.' });
  }
};
// @desc    Update a tax rate
// @route   PUT /api/v1/settings/rates/:rateId
// @access  Private
exports.updateTaxRate = async (req, res) => {
  const { rateId } = req.params;
  const { tax_rate_name, rate, priority, is_compound } = req.body;
  const { tenant_id, role } = req.user;

  // Enhanced validation for required fields
  if (!tax_rate_name || tax_rate_name.trim() === '') {
    return res.status(400).json({ success: false, message: 'Tax rate name is required and cannot be empty.' });
  }

  // Validate rate is a valid number and within acceptable range
  const numericRate = parseFloat(rate);
  if (isNaN(numericRate)) {
    return res.status(400).json({ success: false, message: 'Tax rate must be a valid number.' });
  }

  if (numericRate < 0 || numericRate > 100) {
    return res.status(400).json({ success: false, message: 'Tax rate must be between 0 and 100 percent.' });
  }

  try {
    const pool = db.pool;

    // 1. Find the rate and its parent class to verify permissions
    const [rateRows] = await pool.query(
      `SELECT tcr.*, tc.tenant_id, tc.store_id 
       FROM tax_class_rates tcr 
       JOIN tax_classes tc ON tcr.tax_class_id = tc.id 
       WHERE tcr.id = ?`, 
      [rateId]
    );

    const existingRate = rateRows[0];

    if (!existingRate) {
      return res.status(404).json({ success: false, message: 'Tax rate not found.' });
    }

    if (existingRate.tenant_id !== tenant_id) {
      return res.status(403).json({ success: false, message: 'Access denied to this tax rate.' });
    }

    const isParentTenantWide = existingRate.store_id === null;
    if (isParentTenantWide && role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Managers cannot edit rates in tenant-wide tax classes.' });
    }

    // Validate priority is a non-negative integer
    let validPriority = 0;
    if (priority !== undefined) {
      validPriority = parseInt(priority);
      if (isNaN(validPriority) || validPriority < 0) {
        validPriority = 0;
      }
    }

    // 2. Update the tax rate
    const updatedRate = {
      tax_rate_name: tax_rate_name.trim(),
      rate: numericRate,
      priority: validPriority,
      is_compound: !!is_compound,
    };

    await pool.query('UPDATE tax_class_rates SET ? WHERE id = ?', [updatedRate, rateId]);

    const [updatedRateRows] = await pool.query('SELECT * FROM tax_class_rates WHERE id = ?', [rateId]);

    res.status(200).json({
      success: true,
      data: updatedRateRows[0],
    });

  } catch (error) {
    console.error('Error updating tax rate:', error);
    res.status(500).json({ success: false, message: 'Server error while updating tax rate.' });
  }
};
// @desc    Delete a tax rate
// @route   DELETE /api/v1/settings/rates/:rateId
// @access  Private
exports.deleteTaxRate = async (req, res) => {
  const { rateId } = req.params;
  const { tenant_id, role } = req.user;

  try {
    const pool = db.pool;

    // 1. Find the rate and its parent class to verify permissions
    const [rateRows] = await pool.query(
      `SELECT tcr.*, tc.tenant_id, tc.store_id 
       FROM tax_class_rates tcr 
       JOIN tax_classes tc ON tcr.tax_class_id = tc.id 
       WHERE tcr.id = ?`, 
      [rateId]
    );

    const existingRate = rateRows[0];

    if (!existingRate) {
      return res.status(404).json({ success: false, message: 'Tax rate not found.' });
    }

    if (existingRate.tenant_id !== tenant_id) {
      return res.status(403).json({ success: false, message: 'Access denied to this tax rate.' });
    }

    const isParentTenantWide = existingRate.store_id === null;
    if (isParentTenantWide && role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Managers cannot delete rates in tenant-wide tax classes.' });
    }

    // 2. Delete the tax rate
    await pool.query('DELETE FROM tax_class_rates WHERE id = ?', [rateId]);

    res.status(200).json({ success: true, message: 'Tax rate deleted successfully.' });

  } catch (error) {
    console.error('Error deleting tax rate:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting tax rate.' });
  }
};

// @desc    Set the default tax class for a store
// @route   PUT /api/v1/settings/taxes/store-default
// @access  Private
exports.setStoreDefaultTaxClass = async (req, res) => {
  const { tax_class_id } = req.body;
  const { tenant_id, store_id, role } = req.user;

  try {
    const pool = db.pool;

    // If tax_class_id is null, we're unsetting the default
    if (tax_class_id) {
      // Verify the tax class exists and belongs to the tenant
      const [taxClassRows] = await pool.query(
        'SELECT * FROM tax_classes WHERE id = ? AND tenant_id = ? AND (store_id = ? OR store_id IS NULL)',
        [tax_class_id, tenant_id, store_id]
      );

      if (taxClassRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Tax class not found or access denied.' });
      }

      // Tenant-wide classes cannot be set as default for a specific store
      const taxClass = taxClassRows[0];
      if (taxClass.store_id === null) {
        return res.status(400).json({ success: false, message: 'A tenant-wide tax class cannot be set as the store default.' });
      }
    }

    // Update the store's default tax class
    await pool.query(
      'UPDATE stores SET default_tax_class_id = ? WHERE id = ? AND tenant_id = ?',
      [tax_class_id || null, store_id, tenant_id]
    );

    res.status(200).json({
      success: true,
      message: tax_class_id ? 'Default tax class updated successfully.' : 'Default tax class removed.'
    });

  } catch (error) {
    console.error('Error setting default tax class:', error);
    res.status(500).json({ success: false, message: 'Server error while setting default tax class.' });
  }
};

// @desc    Get complete tax configuration for a store
// @route   GET /api/v1/settings/taxes/store-config
// @access  Private
exports.getStoreTaxConfig = async (req, res) => {
  const { tenant_id, store_id } = req.user;

  try {
    const pool = db.pool;

    // 1. Get store tax configuration
    const [storeRows] = await pool.query(
      'SELECT id, default_tax_class_id, default_tax_basis FROM stores WHERE id = ? AND tenant_id = ?',
      [store_id, tenant_id]
    );

    if (storeRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Store not found or access denied.' });
    }

    const store = storeRows[0];
    const defaultTaxClassId = store.default_tax_class_id;
    
    // Validate default_tax_basis - ensure it's either INCLUSIVE or EXCLUSIVE
    let pricesIncludeTax = store.default_tax_basis === 'INCLUSIVE';
    
    // If default_tax_basis is invalid or missing, default to EXCLUSIVE
    if (!['INCLUSIVE', 'EXCLUSIVE'].includes(store.default_tax_basis)) {
      console.warn(`Invalid default_tax_basis '${store.default_tax_basis}' for store ${store_id}, defaulting to EXCLUSIVE`);
      pricesIncludeTax = false;
      
      // Auto-correct the database value
      await pool.query(
        'UPDATE stores SET default_tax_basis = ? WHERE id = ?',
        ['EXCLUSIVE', store_id]
      );
    }

    // 2. Get all tax classes for this tenant (both store-specific and tenant-wide)
    const [taxClasses] = await pool.query(
      `SELECT 
        tc.*,
        (tc.id = ?) as is_default,
        (SELECT COUNT(*) FROM tax_class_rates tcr WHERE tcr.tax_class_id = tc.id) as rates_count
      FROM tax_classes tc
      WHERE tc.tenant_id = ? AND (tc.store_id = ? OR tc.store_id IS NULL)
      ORDER BY tc.name ASC`,
      [defaultTaxClassId, tenant_id, store_id]
    );

    // 3. Get all tax rates for the default tax class
    let defaultTaxRates = [];
    if (defaultTaxClassId) {
      [defaultTaxRates] = await pool.query(
        'SELECT * FROM tax_class_rates WHERE tax_class_id = ? ORDER BY priority ASC, tax_rate_name ASC',
        [defaultTaxClassId]
      );
      
      // Validate tax rates - ensure they are valid percentages
      defaultTaxRates = defaultTaxRates.map(rate => {
        // Validate that rate is a valid number
        if (isNaN(rate.rate)) {
          console.warn(`Invalid tax rate value '${rate.rate}' for rate ${rate.id}, defaulting to 0`);
          rate.rate = 0;
          
          // Auto-correct the database value
          pool.query(
            'UPDATE tax_class_rates SET rate = ? WHERE id = ?',
            [0, rate.id]
          ).catch(err => console.error('Error updating invalid tax rate:', err));
        }
        return rate;
      });
    }

    res.status(200).json({
      success: true,
      data: {
        store_id: store.id,
        default_tax_class_id: defaultTaxClassId,
        prices_include_tax: pricesIncludeTax,
        default_tax_basis: store.default_tax_basis,
        tax_classes: taxClasses,
        default_tax_rates: defaultTaxRates
      }
    });

  } catch (error) {
    console.error('Error fetching store tax configuration:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching tax configuration.' });
  }
};

// @desc    Update product tax class assignments
// @route   PUT /api/v1/settings/taxes/product-tax-class
// @access  Private
exports.updateProductTaxClass = async (req, res) => {
  const { product_id, tax_class_id } = req.body;
  const { tenant_id, store_id, role } = req.user;

  // Validate required fields
  if (!product_id) {
    return res.status(400).json({ success: false, message: 'Product ID is required.' });
  }

  try {
    const pool = db.pool;

    // 1. Verify the product exists and belongs to the tenant
    const [productRows] = await pool.query(
      'SELECT id, name, tax_class_id, store_id FROM products WHERE id = ? AND tenant_id = ?',
      [product_id, tenant_id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found or access denied.' });
    }

    const product = productRows[0];
    
    // 2. If a tax_class_id is provided, verify it exists and belongs to the tenant
    if (tax_class_id) {
      const [taxClassRows] = await pool.query(
        'SELECT * FROM tax_classes WHERE id = ? AND tenant_id = ? AND (store_id = ? OR store_id IS NULL)',
        [tax_class_id, tenant_id, store_id]
      );

      if (taxClassRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Tax class not found or access denied.' });
      }

      // Check if the tax class is tenant-wide or store-specific
      const taxClass = taxClassRows[0];
      const isTaxClassTenantWide = taxClass.store_id === null;
      
      // Only owners can assign tenant-wide tax classes to products
      if (isTaxClassTenantWide && role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Only owners can assign tenant-wide tax classes to products.' });
      }
    }

    // 3. Update the product's tax class
    await pool.query(
      'UPDATE products SET tax_class_id = ? WHERE id = ? AND tenant_id = ?',
      [tax_class_id || null, product_id, tenant_id]
    );

    // 4. Fetch the updated product to return in response
    const [updatedProductRows] = await pool.query(
      `SELECT p.*, tc.name as tax_class_name 
       FROM products p 
       LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id AND tc.tenant_id = p.tenant_id 
       WHERE p.id = ? AND p.tenant_id = ?`,
      [product_id, tenant_id]
    );

    const updatedProduct = updatedProductRows[0];

    res.status(200).json({
      success: true,
      message: tax_class_id ? 'Product tax class updated successfully.' : 'Product tax class removed.',
      data: {
        product_id: updatedProduct.id,
        product_name: updatedProduct.name,
        tax_class_id: updatedProduct.tax_class_id,
        tax_class_name: updatedProduct.tax_class_name
      }
    });

  } catch (error) {
    console.error('Error updating product tax class:', error);
    res.status(500).json({ success: false, message: 'Server error while updating product tax class.' });
  }
};

// @desc    Get tax classes for a product
// @route   GET /api/v1/settings/taxes/product/:productId
// @access  Private
exports.getProductTaxClass = async (req, res) => {
  const { productId } = req.params;
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;

  try {
    const pool = db.pool;

    // Get the product and its tax class
    const [productRows] = await pool.query(
      `SELECT p.id, p.name, p.tax_class_id, tc.name as tax_class_name, tc.store_id as tax_class_store_id
       FROM products p
       LEFT JOIN tax_classes tc ON p.tax_class_id = tc.id AND tc.tenant_id = p.tenant_id
       WHERE p.id = ? AND p.tenant_id = ?`,
      [productId, tenant_id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found or access denied.' });
    }

    const product = productRows[0];
    
    // Get all available tax classes for this product's store
    const [taxClassRows] = await pool.query(
      `SELECT tc.*, 
       (tc.id = ?) as is_current,
       (SELECT COUNT(*) FROM tax_class_rates tcr WHERE tcr.tax_class_id = tc.id) as rates_count
       FROM tax_classes tc
       WHERE tc.tenant_id = ? AND (tc.store_id = ? OR tc.store_id IS NULL)
       ORDER BY tc.name ASC`,
      [product.tax_class_id, tenant_id, product.store_id]
    );

    // Get tax rates for the product's current tax class
    let taxRates = [];
    if (product.tax_class_id) {
      [taxRates] = await pool.query(
        'SELECT * FROM tax_class_rates WHERE tax_class_id = ? ORDER BY priority ASC, tax_rate_name ASC',
        [product.tax_class_id]
      );
    }

    res.status(200).json({
      success: true,
      data: {
        product_id: product.id,
        product_name: product.name,
        tax_class_id: product.tax_class_id,
        tax_class_name: product.tax_class_name,
        is_tenant_wide: product.tax_class_store_id === null,
        available_tax_classes: taxClassRows,
        current_tax_rates: taxRates
      }
    });

  } catch (error) {
    console.error('Error fetching product tax class:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching product tax class.' });
  }
};
