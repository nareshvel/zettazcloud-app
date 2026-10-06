/**
 * System-Wide Payment Methods Controller
 * Provides common payment methods + tenant-specific configured methods
 */

const { query, queryOne } = require('../db');

/**
 * Get all available payment methods for the current tenant
 * Combines system-wide methods + tenant-configured gateway methods
 */
const getPaymentMethods = async (req, res) => {
  try {
    console.log('[SYSTEM PAYMENT METHODS] Request from user:', req.user?.id, 'tenant:', req.user?.tenant_id);
    
    // System-wide payment methods (always available to all tenants)
    const systemMethods = [
      {
        id: 'cash',
        name: 'Cash',
        code: 'cash',
        isActive: true,
        requiresTerminal: false,
        icon: 'cash',
        sortOrder: 1,
        type: 'system'
      },
      {
        id: 'charge',
        name: 'Charge to Account',
        code: 'ON_ACCOUNT',
        isActive: true,
        requiresTerminal: false,
        icon: 'user',
        sortOrder: 4,
        type: 'system'
      },
      {
        id: 'none',
        name: 'No Payment Required',
        code: 'none',
        isActive: true,
        requiresTerminal: false,
        icon: 'check-circle',
        sortOrder: 99,
        type: 'system'
      }
    ];

    // Get tenant's payment gateway configurations
    const paymentGateways = await query(
      `SELECT gateway_type, is_enabled, configuration 
       FROM payment_gateways 
       WHERE tenant_id = ? AND is_enabled = 1`,
      [req.user.tenant_id]
    );

    console.log('[SYSTEM PAYMENT METHODS] Found payment gateways:', paymentGateways.length);

    // Get tenant's terminal/hardware settings
    const terminalSettings = await queryOne(
      `SELECT has_card_terminal, terminal_type 
       FROM tenant_payment_settings 
       WHERE tenant_id = ?`,
      [req.user.tenant_id]
    );

    // Build tenant-specific methods based on configurations
    const tenantMethods = [];

    // Add card payment if terminal is available
    if (terminalSettings?.has_card_terminal) {
      tenantMethods.push({
        id: 'card',
        name: 'Credit/Debit Card',
        code: 'card',
        isActive: true,
        requiresTerminal: true,
        icon: 'credit-card',
        sortOrder: 2,
        type: 'terminal'
      });
    }

    // Add gateway-based payment methods
    paymentGateways.forEach(gateway => {
      switch (gateway.gateway_type) {
        case 'stripe':
          tenantMethods.push({
            id: 'stripe',
            name: 'Credit Card (Stripe)',
            code: 'stripe',
            isActive: true,
            requiresTerminal: false,
            icon: 'credit-card',
            sortOrder: 3,
            type: 'gateway'
          });
          break;
        case 'paypal':
          tenantMethods.push({
            id: 'paypal',
            name: 'PayPal',
            code: 'paypal',
            isActive: true,
            requiresTerminal: false,
            icon: 'paypal',
            sortOrder: 5,
            type: 'gateway'
          });
          break;
        case 'upi':
          tenantMethods.push({
            id: 'upi',
            name: 'UPI',
            code: 'upi',
            isActive: true,
            requiresTerminal: false,
            icon: 'phone',
            sortOrder: 6,
            type: 'gateway'
          });
          break;
      }
    });

    // Combine and sort all methods
    const allMethods = [...systemMethods, ...tenantMethods]
      .sort((a, b) => a.sortOrder - b.sortOrder);

    console.log('[SYSTEM PAYMENT METHODS] Returning methods:', allMethods.length, 'for tenant:', req.user.tenant_id);
    allMethods.forEach(method => {
      console.log(`  - ${method.name} (${method.code}) - Type: ${method.type}`);
    });

    res.json({
      status: 'success',
      data: allMethods
    });
  } catch (error) {
    console.error('Error fetching system payment methods:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch payment methods'
    });
  }
};

/**
 * Update tenant payment gateway configurations
 */
const updatePaymentGateway = async (req, res) => {
  const { gatewayType, isEnabled, configuration } = req.body;
  
  try {
    // Update or insert payment gateway configuration
    await query(`
      INSERT INTO payment_gateways (tenant_id, gateway_type, is_enabled, configuration, updated_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        is_enabled = VALUES(is_enabled),
        configuration = VALUES(configuration),
        updated_at = NOW()
    `, [req.user.tenant_id, gatewayType, isEnabled, JSON.stringify(configuration)]);

    res.json({
      status: 'success',
      message: `${gatewayType} gateway updated successfully`
    });
  } catch (error) {
    console.error('Error updating payment gateway:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update payment gateway'
    });
  }
};

/**
 * Update tenant terminal settings
 */
const updateTerminalSettings = async (req, res) => {
  const { hasCardTerminal, terminalType } = req.body;
  
  try {
    await query(`
      INSERT INTO tenant_payment_settings (tenant_id, has_card_terminal, terminal_type, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        has_card_terminal = VALUES(has_card_terminal),
        terminal_type = VALUES(terminal_type),
        updated_at = NOW()
    `, [req.user.tenant_id, hasCardTerminal, terminalType]);

    res.json({
      status: 'success',
      message: 'Terminal settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating terminal settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update terminal settings'
    });
  }
};

module.exports = {
  getPaymentMethods,
  updatePaymentGateway,
  updateTerminalSettings
};
