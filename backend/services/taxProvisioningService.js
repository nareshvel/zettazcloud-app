/**
 * Tax Provisioning Service
 * Creates default tax configuration for new tenants
 */

const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class TaxProvisioningService {
  /**
   * Create default tax configuration for a new tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} storeId - Store ID
   * @param {Object} options - Configuration options
   * @param {Object} connection - Database connection (optional)
   * @returns {Promise<Object>} result summary
   */
  static async createDefaultTaxConfiguration(tenantId, storeId, options = {}, connection = null) {
    if (!tenantId || !storeId) {
      throw new Error('tenantId and storeId are required');
    }

    const shouldCloseConnection = !connection;
    if (!connection) {
      connection = await pool.getConnection();
    }

    const created = {
      taxClasses: [],
      taxRates: [],
      storeDefaultSet: false
    };

    try {
      if (shouldCloseConnection) {
        await connection.beginTransaction();
      }

      // 1. Check if tax classes already exist for this tenant/store
      const [existingTaxClasses] = await connection.execute(
        'SELECT id FROM tax_classes WHERE tenant_id = ? AND (store_id = ? OR store_id IS NULL) LIMIT 1',
        [tenantId, storeId]
      );

      if (existingTaxClasses.length > 0) {
        console.log(`✅ Tax classes already exist for tenant ${tenantId}, skipping creation`);
        return { success: true, created, message: 'Tax configuration already exists' };
      }

      // 2. Create default tax classes
      const defaultTaxClasses = [
        {
          name: 'Standard Tax',
          description: 'Standard tax rate for most products',
          is_default: true,
          is_active: true,
          store_specific: true
        },
        {
          name: 'Tax Exempt',
          description: 'No tax applied',
          is_default: false,
          is_active: true,
          store_specific: true
        }
      ];

      let defaultTaxClassId = null;

      for (const taxClass of defaultTaxClasses) {
        const taxClassId = uuidv4();
        
        await connection.execute(`
          INSERT INTO tax_classes (
            id, name, description, tenant_id, store_id, 
            is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          taxClassId,
          taxClass.name,
          taxClass.description,
          tenantId,
          taxClass.store_specific ? storeId : null,
          taxClass.is_active ? 1 : 0
        ]);

        created.taxClasses.push({
          id: taxClassId,
          name: taxClass.name,
          is_default: taxClass.is_default
        });

        if (taxClass.is_default) {
          defaultTaxClassId = taxClassId;
        }

        console.log(`✅ Created tax class: ${taxClass.name} (${taxClassId})`);
      }

      // 3. Create default tax rates for Standard Tax class
      if (defaultTaxClassId) {
        const defaultTaxRatePercent = options.defaultTaxRate || 10.0; // 10% default
        const defaultTaxRate = {
          tax_rate_name: 'Sales Tax',
          rate: defaultTaxRatePercent / 100, // tax_class_rates.rate is stored as a fraction (0.10 = 10%)
          priority: 1,
          is_active: true
        };

        const taxRateId = uuidv4();

        await connection.execute(`
          INSERT INTO tax_class_rates (
            id, tax_class_id, store_id, tax_rate_name, rate,
            priority, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          taxRateId,
          defaultTaxClassId,
          storeId,
          defaultTaxRate.tax_rate_name,
          defaultTaxRate.rate,
          defaultTaxRate.priority,
          defaultTaxRate.is_active ? 1 : 0
        ]);

        created.taxRates.push({
          id: taxRateId,
          name: defaultTaxRate.tax_rate_name,
          rate: defaultTaxRatePercent,
          tax_class_id: defaultTaxClassId
        });

        console.log(`✅ Created tax rate: ${defaultTaxRate.tax_rate_name} (${defaultTaxRatePercent}%)`);
      }

      // 4. Set the default tax class for the store
      if (defaultTaxClassId) {
        await connection.execute(
          'UPDATE stores SET default_tax_class_id = ?, default_tax_basis = ? WHERE id = ? AND tenant_id = ?',
          [defaultTaxClassId, 'EXCLUSIVE', storeId, tenantId]
        );

        created.storeDefaultSet = true;
        console.log(`✅ Set default tax class for store ${storeId}: ${defaultTaxClassId}`);
      }

      if (shouldCloseConnection) {
        await connection.commit();
      }

      console.log(`✅ Tax configuration created successfully for tenant ${tenantId}`);

      return {
        success: true,
        tenantId,
        storeId,
        created,
        defaultTaxClassId,
        message: 'Default tax configuration created successfully'
      };

    } catch (error) {
      if (shouldCloseConnection) {
        await connection.rollback();
      }
      console.error(`❌ Error creating tax configuration for tenant ${tenantId}:`, error);
      throw error;
    } finally {
      if (shouldCloseConnection) {
        connection.release();
      }
    }
  }

  /**
   * Validate and fix tax configuration for existing tenants
   * @param {string} tenantId - Tenant ID (optional, processes all if null)
   * @returns {Promise<Object>} validation results
   */
  static async validateAndFixTaxConfiguration(tenantId = null) {
    const connection = await pool.getConnection();
    const results = {
      tenantsProcessed: 0,
      tenantsFixed: 0,
      errors: []
    };

    try {
      await connection.beginTransaction();

      // Get tenants and their stores that need tax configuration
      let query = `
        SELECT t.id as tenant_id, t.name as tenant_name,
               s.id as store_id, s.name as store_name,
               s.default_tax_class_id,
               COUNT(tc.id) as tax_class_count
        FROM tenants t
        JOIN stores s ON t.id = s.tenant_id AND s.is_active = 1
        LEFT JOIN tax_classes tc ON t.id = tc.tenant_id AND (tc.store_id = s.id OR tc.store_id IS NULL)
      `;
      
      let params = [];
      if (tenantId) {
        query += ' WHERE t.id = ?';
        params.push(tenantId);
      }
      
      query += ' GROUP BY t.id, s.id HAVING tax_class_count = 0 OR default_tax_class_id IS NULL';

      const [tenantsNeedingFix] = await connection.execute(query, params);

      for (const tenant of tenantsNeedingFix) {
        try {
          console.log(`🔧 Fixing tax configuration for tenant: ${tenant.tenant_name} (${tenant.tenant_id})`);
          
          await this.createDefaultTaxConfiguration(
            tenant.tenant_id,
            tenant.store_id,
            { defaultTaxRate: 10.0 },
            connection
          );

          results.tenantsFixed++;
          console.log(`✅ Fixed tax configuration for tenant: ${tenant.tenant_name}`);
        } catch (error) {
          console.error(`❌ Failed to fix tenant ${tenant.tenant_id}:`, error.message);
          results.errors.push({
            tenantId: tenant.tenant_id,
            tenantName: tenant.tenant_name,
            error: error.message
          });
        }

        results.tenantsProcessed++;
      }

      await connection.commit();
      
      console.log(`✅ Tax configuration validation complete: ${results.tenantsFixed}/${results.tenantsProcessed} tenants fixed`);
      
      return results;

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error during tax configuration validation:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get tax configuration status for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} tax configuration status
   */
  static async getTaxConfigurationStatus(tenantId, storeId) {
    const connection = await pool.getConnection();

    try {
      // Check store default tax class
      const [storeRows] = await connection.execute(
        'SELECT default_tax_class_id, default_tax_basis FROM stores WHERE id = ? AND tenant_id = ?',
        [storeId, tenantId]
      );

      if (storeRows.length === 0) {
        return { configured: false, error: 'Store not found' };
      }

      const store = storeRows[0];
      const hasDefaultTaxClass = !!store.default_tax_class_id;

      // Count tax classes for this tenant/store
      const [taxClassRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM tax_classes WHERE tenant_id = ? AND (store_id = ? OR store_id IS NULL)',
        [tenantId, storeId]
      );

      const taxClassCount = taxClassRows[0]?.count || 0;

      // Count tax rates if default tax class exists
      let taxRateCount = 0;
      if (hasDefaultTaxClass) {
        const [taxRateRows] = await connection.execute(
          'SELECT COUNT(*) as count FROM tax_class_rates WHERE tax_class_id = ?',
          [store.default_tax_class_id]
        );
        taxRateCount = taxRateRows[0]?.count || 0;
      }

      const configured = hasDefaultTaxClass && taxClassCount > 0 && taxRateCount > 0;

      return {
        configured,
        details: {
          hasDefaultTaxClass,
          defaultTaxClassId: store.default_tax_class_id,
          defaultTaxBasis: store.default_tax_basis,
          taxClassCount,
          taxRateCount
        }
      };

    } catch (error) {
      console.error('Error checking tax configuration status:', error);
      return { configured: false, error: error.message };
    } finally {
      connection.release();
    }
  }
}

module.exports = TaxProvisioningService;
