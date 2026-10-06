# GRN Module - Comprehensive QA Test Plan

## Overview
This document outlines the systematic quality assurance process for the Goods Received Note (GRN) module, ensuring production readiness through comprehensive testing of all CRUD operations, status transitions, inventory management, and purchase order synchronization.

## Test Environment Setup
- **Backend**: Node.js with Express
- **Database**: MySQL with proper GRN tables
- **Frontend**: React TypeScript application
- **Authentication**: JWT-based multi-tenant system

## Database Schema Validation

### Core Tables
- **goods_received_notes**: GRN header records
- **grn_items**: Individual line items per GRN
- **purchase_orders**: Reference purchase orders
- **purchase_order_items**: Individual PO line items
- **products**: Product master data
- **inventory**: Stock levels and cost tracking

### Key Relationships
- GRN ↔ Purchase Orders (many-to-one)
- GRN Items ↔ Products (many-to-one)
- GRN Items ↔ Purchase Order Items (many-to-one)
- All tables scoped by tenant_id

## Test Cases

### 1. GRN Creation (POST /api/grn)

#### Test Case 1.1: Basic GRN Creation
**Objective**: Create a valid GRN with all required fields
**Preconditions**:
- Valid tenant_id and store_id
- Existing supplier_id
- Valid products with IDs
- Purchase order exists (optional)

**Test Data**:
```json
{
  "tenant_id": "valid-tenant-uuid",
  "store_id": "valid-store-uuid",
  "supplier_id": "valid-supplier-uuid",
  "received_date": "2024-01-15",
  "items": [
    {
      "product_id": "valid-product-uuid",
      "quantity_received": 100,
      "unit_cost_price": 25.50,
      "tax_rate": 8.25,
      "purchase_order_item_id": "valid-po-item-uuid"
    }
  ]
}
```

**Expected Results**:
- HTTP 201 Created
- Valid GRN ID returned
- GRN number generated (format: GRN-YYYY-MM-DD-NNN)
- Items correctly inserted into grn_items table
- Purchase order status updated appropriately

#### Test Case 1.2: Validation Errors
**Test Data**: Missing required fields
**Expected Results**: HTTP 400 with appropriate error messages

#### Test Case 1.3: Over-receiving Validation
**Test Data**: Quantity received > quantity ordered
**Expected Results**: 
- Success if store allows over-receiving
- Error if store doesn't allow over-receiving

### 2. GRN Retrieval (GET /api/grn)

#### Test Case 2.1: Get All GRNs
**Objective**: Retrieve paginated GRN list with filters
**Test Parameters**:
- tenant_id (required)
- page, limit (pagination)
- status filter (DRAFT, COMPLETED)
- date range filters

**Expected Results**:
- Correct pagination metadata
- All GRNs belong to specified tenant
- Items included when requested

#### Test Case 2.2: Get GRN by ID
**Objective**: Retrieve specific GRN with full details
**Expected Results**:
- Complete GRN header information
- All line items with product details
- Purchase order information
- Supplier information

### 3. GRN Status Updates (PATCH /api/grn/:id/status)

#### Test Case 3.1: Draft to Completed
**Objective**: Transition GRN from DRAFT to COMPLETED
**Preconditions**:
- GRN in DRAFT status
- Valid items with quantities > 0

**Expected Results**:
- Status updated to COMPLETED
- Inventory levels updated
- Weighted average cost recalculated
- Purchase order status updated

#### Test Case 3.2: Completed to Draft (Reversal)
**Objective**: Reverse GRN completion
**Expected Results**:
- Status reverted to DRAFT
- Inventory levels restored
- Purchase order status reverted

#### Test Case 3.3: Invalid Status Transition
**Test Data**: Attempt to transition to invalid status
**Expected Results**: HTTP 400 with error message

### 4. GRN Updates (PUT /api/grn/:id)

#### Test Case 4.1: Update GRN Details
**Objective**: Modify GRN header information
**Test Data**: Update notes, received_date, etc.
**Expected Results**:
- Header fields updated correctly
- Items remain unchanged
- Status remains unchanged

#### Test Case 4.2: Update GRN Items
**Objective**: Modify line items
**Test Data**: Add/remove/update items
**Expected Results**:
- Items correctly updated
- Totals recalculated
- Purchase order links maintained

### 5. GRN Deletion (DELETE /api/grn/:id)

#### Test Case 5.1: Delete Draft GRN
**Objective**: Delete GRN in DRAFT status
**Expected Results**:
- GRN soft deleted (status = DELETED)
- Items removed
- No inventory impact

#### Test Case 5.2: Delete Completed GRN
**Objective**: Delete GRN in COMPLETED status
**Expected Results**:
- Inventory reversal performed
- Purchase order status reverted
- GRN marked as DELETED

### 6. Inventory Impact Validation

#### Test Case 6.1: Stock Level Updates
**Objective**: Verify inventory updates on GRN completion
**Test Steps**:
1. Record initial stock levels
2. Create GRN with items
3. Complete GRN
4. Verify stock levels increased correctly

#### Test Case 6.2: Weighted Average Cost Calculation
**Objective**: Verify cost calculation accuracy
**Test Steps**:
1. Record initial product cost
2. Create GRN with different cost prices
3. Complete GRN
4. Verify new weighted average cost

### 7. Purchase Order Synchronization

#### Test Case 7.1: PO Status Updates
**Objective**: Verify PO status changes with GRN actions
**Test Scenarios**:
- Partial receipt → PARTIALLY_RECEIVED
- Full receipt → FULLY_RECEIVED
- Over receipt → FULLY_RECEIVED (if allowed)

#### Test Case 7.2: PO Item Quantity Tracking
**Objective**: Verify quantity received tracking
**Test Steps**:
1. Create PO with specific quantities
2. Create GRN linking to PO items
3. Verify quantities updated correctly
4. Test multiple GRNs against same PO

### 8. Multi-tenancy Validation

#### Test Case 8.1: Tenant Isolation
**Objective**: Ensure GRNs are isolated by tenant
**Test Steps**:
1. Create GRNs for tenant A
2. Attempt to access from tenant B
3. Verify access denied

#### Test Case 8.2: Cross-tenant Data Integrity
**Objective**: Ensure no cross-tenant contamination
**Test Steps**:
1. Create similar GRNs for multiple tenants
2. Verify all data correctly scoped
3. Check for any cross-tenant references

### 9. Error Handling and Edge Cases

#### Test Case 9.1: Database Connection Errors
**Objective**: Graceful handling of DB failures
**Expected Results**: HTTP 500 with meaningful error messages

#### Test Case 9.2: Concurrent Updates
**Objective**: Handle race conditions
**Test Steps**:
1. Multiple users updating same GRN
2. Verify optimistic locking prevents conflicts

#### Test Case 9.3: Invalid Data Handling
**Objective**: Validate input sanitization
**Test Data**: SQL injection attempts, invalid UUIDs
**Expected Results**: Proper validation errors

### 10. Performance Testing

#### Test Case 10.1: Large GRN Creation
**Objective**: Handle GRNs with many items
**Test Data**: GRN with 100+ items
**Expected Results**: Reasonable response time (<5 seconds)

#### Test Case 10.2: Pagination Performance
**Objective**: Efficient retrieval of large datasets
**Test Data**: 1000+ GRNs
**Expected Results**: Fast pagination with proper indexing

## Test Data Preparation

### Sample Data Creation Scripts
```sql
-- Create test suppliers
INSERT INTO suppliers (id, tenant_id, supplier_name, contact_email) VALUES
('test-supplier-1', 'test-tenant-1', 'Test Supplier 1', 'supplier1@test.com');

-- Create test products
INSERT INTO products (id, tenant_id, name, sku, cost_price) VALUES
('test-product-1', 'test-tenant-1', 'Test Product 1', 'SKU001', 20.00);

-- Create test purchase orders
INSERT INTO purchase_orders (id, tenant_id, supplier_id, po_number, status) VALUES
('test-po-1', 'test-tenant-1', 'test-supplier-1', 'PO-2024-001', 'PENDING');

-- Create test purchase order items
INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity_ordered) VALUES
('test-po-item-1', 'test-po-1', 'test-product-1', 100);
```

### Test Execution Checklist

- [ ] Database schema validation
- [ ] API endpoint testing
- [ ] Frontend integration testing
- [ ] Multi-tenant isolation testing
- [ ] Inventory impact validation
- [ ] Purchase order synchronization testing
- [ ] Error handling verification
- [ ] Performance benchmarking
- [ ] Security testing
- [ ] Documentation review

## Success Criteria

### Functional Requirements
- All CRUD operations work correctly
- Status transitions handle inventory properly
- Purchase orders update correctly
- Multi-tenant isolation maintained
- Error handling is comprehensive

### Performance Requirements
- GRN creation: <3 seconds for 50 items
- GRN retrieval: <1 second for single record
- List retrieval: <2 seconds for 100 records

### Security Requirements
- All endpoints require authentication
- Tenant isolation enforced
- Input validation prevents SQL injection
- UUID format validation

## Test Results Documentation

### Test Execution Log
| Test Case | Status | Notes | Issues Found |
|-----------|--------|--------|--------------|
| TC-1.1 Basic GRN Creation | Pending | - | - |
| TC-1.2 Validation Errors | Pending | - | - |
| TC-2.1 Get All GRNs | Pending | - | - |
| TC-3.1 Status Transition | Pending | - | - |
| TC-4.1 GRN Updates | Pending | - | - |
| TC-5.1 GRN Deletion | Pending | - | - |
| TC-6.1 Inventory Updates | Pending | - | - |
| TC-7.1 PO Synchronization | Pending | - | - |
| TC-8.1 Multi-tenancy | Pending | - | - |
| TC-9.1 Error Handling | Pending | - | - |

### Issue Tracking
| Issue ID | Description | Severity | Status |
|----------|-------------|----------|--------|
| - | - | - | - |

## Next Steps
1. Execute all test cases systematically
2. Document any issues found
3. Fix identified bugs
4. Re-test fixed functionality
5. Create automated test suite
6. Performance optimization
7. Security review
8. Production deployment checklist
