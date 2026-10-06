# Goods Received Notes (GRN) Module Test Plan

## Overview

This test plan provides a systematic approach to verifying the functionality, reliability, and security of the GRN module. It includes both frontend and backend testing scenarios, covering the critical workflow paths and edge cases.

## Prerequisites

Before testing, ensure you have:

1. A test environment with multiple tenants configured
2. At least two different stores per tenant
3. Test suppliers with active purchase orders in various statuses
4. Test products with varying inventory levels
5. Test users with appropriate permissions

## Test Scenarios

### 1. GRN Creation

#### 1.1 Basic GRN Creation

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-C-1 | Create a new GRN with manually added items | GRN created successfully with DRAFT status |
| GRN-C-2 | Create a new GRN from an existing PO | GRN created with items from selected PO |
| GRN-C-3 | Create a GRN with COMPLETED status | GRN created and stock levels updated |
| GRN-C-4 | Create a GRN with multiple POs | All selected PO items added to GRN |
| GRN-C-5 | Create a GRN without supplier invoice details in DRAFT status | GRN saved successfully |
| GRN-C-6 | Create a GRN without supplier invoice details in COMPLETED status | Validation error displayed |

#### 1.2 GRN Number Generation

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-N-1 | Create GRNs for the same tenant but different stores | GRN numbers are unique per store |
| GRN-N-2 | Create multiple GRNs for the same store in sequence | GRN numbers increment correctly |
| GRN-N-3 | Create GRNs for different tenants with the same store ID | GRN numbers are tenant-specific |
| GRN-N-4 | Create a GRN without specifying a store ID | Error message about required store ID |

#### 1.3 Input Validation

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-V-1 | Enter negative quantities | Validation error displayed |
| GRN-V-2 | Enter non-numeric characters in numeric fields | Field validation prevents entry |
| GRN-V-3 | Set received date in the future | Validation error displayed |
| GRN-V-4 | Create a GRN with no items | Validation error displayed |
| GRN-V-5 | Submit a GRN with missing required fields | Validation errors for each missing field |

### 2. GRN Status Management

#### 2.1 Status Transitions

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-S-1 | Change GRN from DRAFT to COMPLETED | Stock levels updated correctly |
| GRN-S-2 | Attempt to change COMPLETED to DRAFT when stock levels allow | GRN reverted successfully |
| GRN-S-3 | Attempt to change COMPLETED to DRAFT when stock insufficient | Error message with details |
| GRN-S-4 | Change DRAFT to DRAFT (no change) | Success message, no data changes |
| GRN-S-5 | Attempt CANCELLED to DRAFT transition | Error message about restricted transition |

#### 2.2 Inventory Impact

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-I-1 | Complete a GRN and check stock level increase | Stock quantities updated correctly |
| GRN-I-2 | Complete a GRN and check weighted average cost updates | WAC calculated correctly |
| GRN-I-3 | Reverse a GRN and check stock level decrease | Stock quantities decreased correctly |
| GRN-I-4 | Reverse a GRN and check weighted average cost restoration | WAC properly restored |
| GRN-I-5 | Complete a GRN with zero cost items | WAC handled without errors |
| GRN-I-6 | Complete a GRN with very large quantities/costs | No overflow or precision issues |

### 3. Purchase Order Integration

#### 3.1 PO Updates

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-P-1 | Complete a GRN linked to a PO | PO status updated correctly |
| GRN-P-2 | Create GRN with partial PO quantities | PO status set to PARTIALLY_RECEIVED |
| GRN-P-3 | Create GRN with full PO quantities | PO status set to RECEIVED |
| GRN-P-4 | Reverse a GRN linked to a PO | PO status restored correctly |
| GRN-P-5 | Create GRN against multiple POs | All affected POs updated correctly |
| GRN-P-6 | Create a GRN with over-receiving (more than PO quantity) | Warning displayed, GRN created |

#### 3.2 Multi-tenancy Security

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-MT-1 | Access PO items from a different tenant | No data returned, proper filtering applied |
| GRN-MT-2 | Attempt to create GRN for PO from another tenant | Validation error or no data shown |
| GRN-MT-3 | Check PO status updates only affect correct tenant | Only intended tenant's PO updated |
| GRN-MT-4 | Verify JOIN conditions for purchase_order_items and purchase_orders on tenant_id | Proper tenant filtering applied |
| GRN-MT-5 | Test PO item access without tenant_id in purchase_order_items table | Queries correctly use purchase_orders.tenant_id |

### 4. Edge Cases and Error Handling

#### 4.1 Loading States

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-L-1 | Check supplier loading state | Loading spinner shown, correct resolution |
| GRN-L-2 | Check PO loading state | Loading spinner shown, correct resolution |
| GRN-L-3 | Check manual product search loading | Loading spinner shown, correct resolution |
| GRN-L-4 | Check GRN loading in edit mode | Loading spinner shown, correct resolution |
| GRN-L-5 | Simulate slow API responses | UI remains responsive with loading indicators |

#### 4.2 Error States

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-E-1 | Simulate API error for suppliers | Error state shown, recovery option available |
| GRN-E-2 | Simulate API error for POs | Error state shown, recovery option available |
| GRN-E-3 | Simulate API error for product search | Error state shown, recovery option available |
| GRN-E-4 | Simulate API error for GRN save | Error toast with details, data preserved |
| GRN-E-5 | Simulate server errors during WAC calculation | Error handled gracefully, transaction rolled back |
| GRN-E-6 | Attempt division by zero in WAC calculation | Handled gracefully with fallback |

#### 4.3 Transaction Integrity

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-T-1 | Simulate error during GRN creation transaction | All changes rolled back properly |
| GRN-T-2 | Simulate error during GRN status update transaction | No partial updates, database consistent |
| GRN-T-3 | Test transaction rollback during complex WAC calculations | No inventory inconsistencies |
| GRN-T-4 | Force server shutdown during transaction | Database remains in consistent state |

### 5. UI/UX Testing

#### 5.1 Responsive Design

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-U-1 | Test form on different screen sizes | Layout adapts appropriately |
| GRN-U-2 | Test table responsiveness | Horizontal scrolling works correctly |
| GRN-U-3 | Test modal dialogs on mobile | Proper sizing and interaction |

#### 5.2 Accessibility

| Test ID | Description | Expected Result |
| ------- | ----------- | --------------- |
| GRN-A-1 | Tab navigation through the form | All controls accessible via keyboard |
| GRN-A-2 | Screen reader compatibility | ARIA labels used appropriately |
| GRN-A-3 | Color contrast for text and controls | Meets WCAG standards |

## Automated Testing Plan

The following areas should be covered by automated tests:

### Frontend Tests

1. **Unit Tests**
   - Component rendering tests
   - Form validation logic
   - Currency formatting utility
   - State management functions
   - Loading state behavior
   - Granular loading state indicators

2. **Integration Tests**
   - API interaction
   - Form submission flows
   - Modal interaction patterns
   - Error handling scenarios
   - Recovery from API failures

### Backend Tests

1. **Unit Tests**
   - GRN number generation with store uniqueness
   - Weighted average cost calculation with edge cases
   - Status transition validation
   - Reversal validation functions
   - Transaction integrity verification

2. **Integration Tests**
   - Complete GRN workflow
   - Database transaction integrity
   - Multi-tenancy security
   - PO status update correlation
   - Tenant isolation verification

## Test Data Requirements

Each test should use appropriate test data that includes:

1. Multiple tenants (at least 2)
2. Multiple stores per tenant (at least 2)
3. Suppliers with various states (active, inactive)
4. Products with various stock levels:
   - Zero stock
   - Low stock (<10)
   - High stock (>1000)
5. Purchase orders in different states:
   - DRAFT
   - ORDERED
   - PARTIALLY_RECEIVED
   - RECEIVED
   - CANCELLED

## Test Execution Process

1. Execute tests by category in the order presented
2. Document any failures with screenshots and error messages
3. Retest after fixes
4. Perform regression testing on related modules (Purchase Orders, Inventory)
5. Execute performance tests under different load conditions

## Bug Reporting Template

For any issues found during testing, use the following template:

```
Bug ID: GRN-BUG-[Number]
Test Case: [Test ID]
Priority: [Critical/High/Medium/Low]
Environment: [Dev/Staging/Production]
Browser/Device: [If applicable]
Description:
Steps to Reproduce:
Expected Result:
Actual Result:
Screenshots/Logs:
```

## Sign-off Criteria

The GRN module will be considered ready for production when:

1. All critical and high-priority test cases pass
2. No known security vulnerabilities exist
3. Performance meets SLA requirements
4. All documented features function as specified
5. User documentation is complete and accurate
