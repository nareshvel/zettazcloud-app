/**
 * Test helpers for testing GRN and inventory management functions
 */

const mockGrnData = {
  id: 'mock-grn-id',
  grn_number: 'GRN-2506-00001',
  status: 'COMPLETED',
  store_id: 'mock-store-id',
  supplier_id: 'mock-supplier-id',
  supplier_invoice_number: 'INV-12345',
  supplier_invoice_date: '2023-05-30',
  notes: 'Test GRN',
  total_tax_paid: 100,
  shipping_handling_paid: 50,
  other_charges_paid: 10
};

const mockGrnItems = [
  {
    id: 'mock-grn-item-1',
    grn_id: 'mock-grn-id',
    product_id: 'mock-product-1',
    quantity_received: 10,
    price_per_unit: 20,
    tax_rate: 0.1,
    purchase_order_id: 'mock-po-id',
    purchase_order_item_id: 'mock-po-item-1'
  },
  {
    id: 'mock-grn-item-2',
    grn_id: 'mock-grn-id',
    product_id: 'mock-product-2',
    quantity_received: 5,
    price_per_unit: 30,
    tax_rate: 0.1,
    purchase_order_id: 'mock-po-id',
    purchase_order_item_id: 'mock-po-item-2'
  }
];

const mockProducts = [
  {
    id: 'mock-product-1',
    name: 'Product 1',
    sku: 'SKU001',
    current_stock: 50
  },
  {
    id: 'mock-product-2',
    name: 'Product 2',
    sku: 'SKU002',
    current_stock: 30
  }
];

/**
 * Set up mocks for database queries in GRN tests
 * @param {Object} sandbox - Sinon sandbox
 * @param {Object} connectionStub - Connection stub
 */
const setupGrnStatusChangeMocks = (sandbox, connectionStub) => {
  // Mock GRN query
  connectionStub.query.withArgs(
    sandbox.match(/SELECT id, status, grn_number, store_id FROM goods_received_notes/),
    sandbox.match.array
  ).resolves([mockGrnData]);

  // Mock GRN items query
  connectionStub.query.withArgs(
    sandbox.match(/SELECT \* FROM grn_items/),
    sandbox.match.array
  ).resolves(mockGrnItems);

  // Mock product queries
  connectionStub.query.withArgs(
    sandbox.match(/SELECT id, current_stock FROM products/),
    sandbox.match(['mock-product-1', sandbox.match.any])
  ).resolves([mockProducts[0]]);

  connectionStub.query.withArgs(
    sandbox.match(/SELECT id, current_stock FROM products/),
    sandbox.match(['mock-product-2', sandbox.match.any])
  ).resolves([mockProducts[1]]);

  // Mock update product stock query
  connectionStub.query.withArgs(
    sandbox.match(/UPDATE products SET current_stock/),
    sandbox.match.array
  ).resolves({ affectedRows: 1 });

  // Mock insert inventory log query
  connectionStub.query.withArgs(
    sandbox.match(/INSERT INTO inventory_logs/),
    sandbox.match.array
  ).resolves({ insertId: 'mock-log-id' });

  // Mock update purchase order item status query
  connectionStub.query.withArgs(
    sandbox.match(/UPDATE purchase_order_items/),
    sandbox.match.array
  ).resolves({ affectedRows: 1 });

  // Mock update purchase order status query
  connectionStub.query.withArgs(
    sandbox.match(/UPDATE purchase_orders/),
    sandbox.match.array
  ).resolves({ affectedRows: 1 });

  // Mock update GRN status query
  connectionStub.query.withArgs(
    sandbox.match(/UPDATE goods_received_notes SET status/),
    sandbox.match.array
  ).resolves({ affectedRows: 1 });
};

/**
 * Set up mocks for GRN deletion tests
 * @param {Object} sandbox - Sinon sandbox
 * @param {Object} connectionStub - Connection stub
 */
const setupGrnDeletionMocks = (sandbox, connectionStub) => {
  // Set up common mocks
  setupGrnStatusChangeMocks(sandbox, connectionStub);

  // Mock delete GRN items query
  connectionStub.query.withArgs(
    sandbox.match(/DELETE FROM grn_items/),
    sandbox.match.array
  ).resolves({ affectedRows: mockGrnItems.length });

  // Mock delete GRN query
  connectionStub.query.withArgs(
    sandbox.match(/DELETE FROM goods_received_notes/),
    sandbox.match.array
  ).resolves({ affectedRows: 1 });
};

/**
 * Set up mocks for GRN editing tests
 * @param {Object} sandbox - Sinon sandbox
 * @param {Object} connectionStub - Connection stub
 */
const setupGrnEditingMocks = (sandbox, connectionStub) => {
  // Mock get GRN query
  connectionStub.query.withArgs(
    sandbox.match(/SELECT \* FROM goods_received_notes/),
    sandbox.match.array
  ).resolves([mockGrnData]);

  // Mock GRN items query
  connectionStub.query.withArgs(
    sandbox.match(/SELECT \* FROM grn_items/),
    sandbox.match.array
  ).resolves(mockGrnItems);

  // Mock product queries
  connectionStub.query.withArgs(
    sandbox.match(/SELECT id, current_stock FROM products/),
    sandbox.match(['mock-product-1', sandbox.match.any])
  ).resolves([mockProducts[0]]);

  // Mock update GRN query
  connectionStub.query.withArgs(
    sandbox.match(/UPDATE goods_received_notes/),
    sandbox.match.array
  ).resolves({ affectedRows: 1 });

  // Mock update GRN item query
  connectionStub.query.withArgs(
    sandbox.match(/UPDATE grn_items/),
    sandbox.match.array
  ).resolves({ affectedRows: 1 });

  // Mock insert GRN item query
  connectionStub.query.withArgs(
    sandbox.match(/INSERT INTO grn_items/),
    sandbox.match.array
  ).resolves({ insertId: 'new-grn-item-id' });

  // Mock delete GRN item query
  connectionStub.query.withArgs(
    sandbox.match(/DELETE FROM grn_items WHERE id = ?/),
    sandbox.match.array
  ).resolves({ affectedRows: 1 });

  // Mock PO items query
  connectionStub.query.withArgs(
    sandbox.match(/SELECT COUNT.*FROM purchase_order_items/),
    sandbox.match.array
  ).resolves([{ total: 3, received: 2 }]);
};

module.exports = {
  mockGrnData,
  mockGrnItems,
  mockProducts,
  setupGrnStatusChangeMocks,
  setupGrnDeletionMocks,
  setupGrnEditingMocks
};
