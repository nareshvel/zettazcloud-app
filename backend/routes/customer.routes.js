const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { v4: uuidv4 } = require('uuid'); // Added for generating UUIDs

// Middleware for customer routes
router.use((req, res, next) => {
  // Process request without logging
  next();
});

/**
 * @route   GET /api/customers
 * @desc    Get all customers for the tenant
 * @access  Private (requires customers.view permission)
 */
router.get('/', requirePermission('customers.view'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
        c.id, c.customer_code, c.first_name, c.last_name, c.email, c.phone_number, c.customer_type, c.is_active, c.company_name, c.credit_limit, c.outstanding_credit, c.is_tax_exempt,
        (SELECT SUM(s.total) FROM sales s WHERE s.customer_id = c.id AND s.tenant_id = c.tenant_id) as total_sales_value
       FROM customers c
       WHERE c.tenant_id = ?
       ORDER BY c.first_name, c.last_name`,
      [tenant_id]
    );
    // Replace null total_sales_value with 0.00
    const customersWithSales = rows.map(customer => ({
      ...customer,
      total_sales_value: customer.total_sales_value === null ? 0.00 : parseFloat(customer.total_sales_value)
    }));

    res.json({
      status: 'success',
      results: customersWithSales.length,
      data: { customers: customersWithSales },
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch customers' });
  }
});

// Search customers
router.get('/search', requirePermission('customers.view'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
  const { term } = req.query;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  if (!term) {
    return res.status(400).json({ status: 'error', message: 'Search term is required' });
  }

  try {
    const searchTerm = `%${term}%`;
    const [rows] = await pool.execute(
      `SELECT id, customer_code, first_name, last_name, email, phone_number, customer_type, is_active, company_name, credit_limit, outstanding_credit, default_discount_type, default_discount_value
       FROM customers
       WHERE tenant_id = ? AND
             (customer_code LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone_number LIKE ? OR company_name LIKE ?)
       ORDER BY first_name, last_name LIMIT 50`,
      [tenant_id, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
    );
    res.json({
      status: 'success',
      results: rows.length,
      data: { customers: rows },
    });
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ status: 'error', message: 'Failed to search customers' });
  }
});

// GET a single customer by ID
router.get('/:id', requirePermission('customers.view'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
  const { id } = req.params;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM customers WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Customer not found' });
    }

    res.json({ status: 'success', data: { customer: rows[0] } });
  } catch (error) {
    console.error('Error fetching customer by ID:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch customer' });
  }
});

// GET a customer's 360 view: KPIs + recent records across all customer-linked modules
router.get('/:id/360', requirePermission('customers.view'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
  const { id } = req.params;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  try {
    const [cust] = await pool.execute(
      'SELECT id FROM customers WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );
    if (cust.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Customer not found' });
    }

    const LIMIT = 25;
    const [
      [sales], [salesAgg],
      [returns],
      [layaways], [layawayAgg],
      [memos], [memoAgg],
      [repairs], [repairAgg],
      [oldGold], [oldGoldAgg],
      [savings], [savingsAgg],
    ] = await Promise.all([
      pool.execute(
        `SELECT id, document_number, total, payment_status, status, created_at
           FROM sales WHERE tenant_id = ? AND customer_id = ?
           ORDER BY created_at DESC LIMIT ${LIMIT}`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT COUNT(*) AS sale_count, COALESCE(SUM(total), 0) AS lifetime_spend,
                MAX(created_at) AS last_sale_at
           FROM sales WHERE tenant_id = ? AND customer_id = ? AND status = 'completed'`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT id, return_number, total_return_amount, status, refund_method, return_date, created_at
           FROM sales_returns WHERE tenant_id = ? AND customer_id = ?
           ORDER BY created_at DESC LIMIT ${LIMIT}`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT id, plan_no, total_amount, down_payment, paid_amount, due_date, status, created_at
           FROM layaway_plans WHERE tenant_id = ? AND customer_id = ?
           ORDER BY created_at DESC LIMIT ${LIMIT}`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT COUNT(*) AS open_count, COALESCE(SUM(total_amount - paid_amount), 0) AS open_balance
           FROM layaway_plans WHERE tenant_id = ? AND customer_id = ? AND status = 'active'`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT id, memo_no, direction, total_value, issue_date, due_date, status, created_at
           FROM memo_transactions WHERE tenant_id = ? AND customer_id = ?
           ORDER BY created_at DESC LIMIT ${LIMIT}`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT COUNT(*) AS open_count, COALESCE(SUM(total_value), 0) AS open_balance
           FROM memo_transactions
           WHERE tenant_id = ? AND customer_id = ? AND direction = 'out'
             AND status IN ('open','partially_returned')`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT id, ticket_no, item_description, status, promised_date,
                estimated_cost, final_cost, advance_paid, balance_paid, created_at
           FROM repair_orders WHERE tenant_id = ? AND customer_id = ?
           ORDER BY created_at DESC LIMIT ${LIMIT}`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT COUNT(*) AS open_count,
                COALESCE(SUM(COALESCE(final_cost, estimated_cost, 0) - COALESCE(advance_paid, 0) - COALESCE(balance_paid, 0)), 0) AS open_balance
           FROM repair_orders
           WHERE tenant_id = ? AND customer_id = ? AND status IN ('received','in_progress','ready')`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT id, voucher_no, item_description, metal, net_weight, valuation_amount, status, created_at
           FROM old_gold_purchases WHERE tenant_id = ? AND customer_id = ?
           ORDER BY created_at DESC LIMIT ${LIMIT}`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT COUNT(*) AS open_count, COALESCE(SUM(valuation_amount), 0) AS open_balance
           FROM old_gold_purchases
           WHERE tenant_id = ? AND customer_id = ? AND status IN ('valued','credited')`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT id, enrollment_no, plan_id, start_date, maturity_date,
                paid_installments, total_paid, bonus_amount, status, created_at
           FROM savings_scheme_enrollments WHERE tenant_id = ? AND customer_id = ?
           ORDER BY created_at DESC LIMIT ${LIMIT}`,
        [tenant_id, id]
      ),
      pool.execute(
        `SELECT COUNT(*) AS open_count, COALESCE(SUM(total_paid), 0) AS open_balance
           FROM savings_scheme_enrollments WHERE tenant_id = ? AND customer_id = ? AND status = 'active'`,
        [tenant_id, id]
      ),
    ]);

    const num = (v) => parseFloat(v) || 0;
    res.json({
      status: 'success',
      data: {
        kpis: {
          sale_count: salesAgg[0].sale_count,
          lifetime_spend: num(salesAgg[0].lifetime_spend),
          last_sale_at: salesAgg[0].last_sale_at,
          return_count: returns.length,
          returns_total: returns.reduce((s, r) => s + num(r.total_return_amount), 0),
          layaway_open: { count: layawayAgg[0].open_count, balance: num(layawayAgg[0].open_balance) },
          memo_open: { count: memoAgg[0].open_count, balance: num(memoAgg[0].open_balance) },
          repair_open: { count: repairAgg[0].open_count, balance: num(repairAgg[0].open_balance) },
          old_gold_open: { count: oldGoldAgg[0].open_count, balance: num(oldGoldAgg[0].open_balance) },
          savings_open: { count: savingsAgg[0].open_count, balance: num(savingsAgg[0].open_balance) },
        },
        sales,
        returns,
        layaways,
        memos,
        repairs,
        old_gold: oldGold,
        savings,
      },
    });
  } catch (error) {
    console.error('Error fetching customer 360:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch customer 360 data' });
  }
});

// POST (create) a new customer
/**
 * @route   POST /api/customers
 * @desc    Create a new customer
 * @access  Private (requires customers.create permission)
 */
router.post('/', requirePermission('customers.create'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
  const created_by_user_id = req.user?.id;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  const {
    store_id = null,
    first_name,
    last_name = null,
    email = null,
    phone_number = null,
    address_line1 = null,
    address_line2 = null,
    city = null,
    state_province = null,
    postal_code = null,
    country = null,
    customer_type = 'INDIVIDUAL',
    loyalty_id = null,
    tax_id_number = null,
    notes = null,
    credit_limit = 0.00,
    is_active = true,
    is_tax_exempt = false,
    company_name = null,
    birth_date = null,
    gender = null,
    website = null,
    default_discount_type = null,
    default_discount_value = null,
    preferred_communication = null,
    nationality = null,
    id_type = null,
    id_number = null,
  } = req.body;

  if (!first_name) {
    return res.status(400).json({ status: 'error', message: 'First name is required.' });
  }

  const newCustomerId = uuidv4();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Allocate the next human-friendly customer code for this tenant (CU-000123).
    // The UUID stays the internal key; this code is what staff read out.
    let customerCode = null;
    try {
      await connection.query(
        'INSERT INTO customer_code_sequences (tenant_id, `last_value`) VALUES (?, 1) '
     + 'ON DUPLICATE KEY UPDATE `last_value` = `last_value` + 1',
        [tenant_id]
      );
      const [[seq]] = await connection.query(
        'SELECT `last_value` FROM customer_code_sequences WHERE tenant_id = ?', [tenant_id]
      );
      customerCode = `CU-${String(seq.last_value).padStart(6, '0')}`;
    } catch (seqErr) {
      // Migration not applied yet — continue without a code rather than blocking.
      console.warn('[CUSTOMERS] customer_code allocation skipped:', seqErr.message);
    }

    const [result] = await connection.query(
      `INSERT INTO customers (id, tenant_id, customer_code, store_id, first_name, last_name, email, phone_number,
                             address_line1, address_line2, city, state_province, postal_code, country,
                             customer_type, loyalty_id, tax_id_number, notes, credit_limit, is_active, is_tax_exempt,
                             created_by_user_id, updated_by_user_id, company_name,
                             birth_date, gender, website, default_discount_type, default_discount_value, preferred_communication,
                             nationality, id_type, id_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newCustomerId, tenant_id, customerCode, store_id, first_name, last_name, email, phone_number,
        address_line1, address_line2, city, state_province, postal_code, country,
        customer_type, loyalty_id, tax_id_number, notes, credit_limit, is_active, is_tax_exempt,
        created_by_user_id, created_by_user_id, company_name,
        birth_date || null, gender || null, website || null, default_discount_type || null,
        default_discount_value || null, preferred_communication || null,
        nationality || null, id_type || null, id_number || null,
      ]
    );

    if (result.affectedRows === 1) {
      const [rows] = await connection.query('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [newCustomerId, tenant_id]);
      await connection.commit();
      res.status(201).json({ status: 'success', data: { customer: rows[0] } });
    } else {
      await connection.rollback();
      res.status(500).json({ status: 'error', message: 'Failed to create customer' });
    }
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* ignore */ }
    console.error('Error creating customer:', error);
    // Check for duplicate email or phone for the same tenant if a unique constraint exists
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ status: 'error', message: 'Customer with this email or phone already exists for this tenant.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to create customer' });
  } finally {
    connection.release();
  }
});

// PUT (update) a customer by ID
/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer details
 * @access  Private (requires customers.update permission)
 */
router.put('/:id', requirePermission('customers.edit'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
  const updated_by_user_id = req.user?.id;
  const { id } = req.params;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  // Fetch existing customer to compare
  let existingCustomer;
  try {
    const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Customer not found or not authorized to update.' });
    }
    existingCustomer = rows[0];
  } catch (error) {
    console.error('Error fetching customer for update:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve customer before update.' });
  }

  // Fields that can be updated
  const {
    store_id = existingCustomer.store_id,
    first_name = existingCustomer.first_name,
    last_name = existingCustomer.last_name,
    email = existingCustomer.email,
    phone_number = existingCustomer.phone_number,
    address_line1 = existingCustomer.address_line1,
    address_line2 = existingCustomer.address_line2,
    city = existingCustomer.city,
    state_province = existingCustomer.state_province,
    postal_code = existingCustomer.postal_code,
    country = existingCustomer.country,
    customer_type = existingCustomer.customer_type,
    loyalty_id = existingCustomer.loyalty_id,
    tax_id_number = existingCustomer.tax_id_number,
    notes = existingCustomer.notes,
    credit_limit = existingCustomer.credit_limit,
    is_active = existingCustomer.is_active,
    is_tax_exempt = existingCustomer.is_tax_exempt,
    company_name = existingCustomer.company_name,
    // Previously missing fields
    birth_date = existingCustomer.birth_date,
    gender = existingCustomer.gender,
    website = existingCustomer.website,
    default_discount_type = existingCustomer.default_discount_type,
    default_discount_value = existingCustomer.default_discount_value,
    preferred_communication = existingCustomer.preferred_communication,
    nationality = existingCustomer.nationality,
    id_type = existingCustomer.id_type,
    id_number = existingCustomer.id_number,
  } = req.body;

  try {
    const [result] = await pool.execute(
      `UPDATE customers SET
        store_id = ?, first_name = ?, last_name = ?, email = ?, phone_number = ?,
        address_line1 = ?, address_line2 = ?, city = ?, state_province = ?, postal_code = ?, country = ?,
        customer_type = ?, loyalty_id = ?, tax_id_number = ?, notes = ?, credit_limit = ?,
        is_active = ?, is_tax_exempt = ?, company_name = ?,
        birth_date = ?, gender = ?, website = ?, default_discount_type = ?,
        default_discount_value = ?, preferred_communication = ?,
        nationality = ?, id_type = ?, id_number = ?,
        updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [
        store_id, first_name, last_name, email, phone_number,
        address_line1, address_line2, city, state_province, postal_code, country,
        customer_type, loyalty_id, tax_id_number, notes, credit_limit,
        is_active, is_tax_exempt, company_name,
        birth_date || null, gender || null, website || null,
        default_discount_type || null, default_discount_value || null,
        preferred_communication || null,
        nationality || null, id_type || null, id_number || null,
        updated_by_user_id, id, tenant_id
      ]
    );

    if (result.affectedRows === 1) {
      // Fetch the updated customer to return it
      const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
      res.json({ status: 'success', data: { customer: rows[0] } });
    } else {
      // This case should ideally be caught by the pre-fetch check
      res.status(404).json({ status: 'error', message: 'Customer not found or no changes made.' }); 
    }
  } catch (error) {
    console.error('Error updating customer:', error);
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ status: 'error', message: 'Update failed: Email or phone already exists for another customer in this tenant.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to update customer' });
  }
});

// DELETE a customer by ID
/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete a customer
 * @access  Private (requires customers.delete permission)
 */
router.delete('/:id', requirePermission('customers.delete'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;
  const { id } = req.params;

  if (!tenant_id) {
    return res.status(403).json({ status: 'error', message: 'Tenant ID not found for user.' });
  }

  try {
    // First, check if the customer exists and belongs to the tenant
    const [checkRows] = await pool.execute('SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Customer not found or not authorized to delete.' });
    }

    const [result] = await pool.execute(
      'DELETE FROM customers WHERE id = ? AND tenant_id = ?',
      [id, tenant_id]
    );

    if (result.affectedRows === 1) {
      res.json({ status: 'success', message: 'Customer deleted successfully' });
    } else {
      // This case should ideally be caught by the pre-check
      res.status(404).json({ status: 'error', message: 'Customer not found or already deleted' });
    }
  } catch (error) {
    console.error('Error deleting customer:', error);
    // Check for foreign key constraint errors if customers are linked to other tables (e.g., sales)
    if (error.code === 'ER_ROW_IS_REFERENCED_2') { // MySQL specific error code
        return res.status(409).json({ status: 'error', message: 'Cannot delete customer. They have associated records (e.g., sales transactions).' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to delete customer' });
  }
});

module.exports = router;
