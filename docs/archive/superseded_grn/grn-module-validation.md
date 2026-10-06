# GRN Module Validation Rules and Business Logic

## Overview

This document outlines the validation rules, business logic, and workflows for the Goods Received Note (GRN) module. It is intended for developers working on the system as well as for user documentation purposes.

## Validation Rules

### Form-Level Validation

1. **Required Fields:**
   - Supplier: Required for all GRNs
   - Date Received: Required and cannot be in the future
   - Items: At least one item must be present
   - Supplier Invoice Number: Required when GRN status is COMPLETED
   - Supplier Invoice Date: Required when GRN status is COMPLETED

2. **Numeric Field Validation:**
   - Quantity Received: Must be greater than 0
   - Unit Cost Price: Must be greater than or equal to 0
   - Tax Rate: Must be greater than or equal to 0
   - Tax Amount: Must be greater than or equal to 0
   - Shipping/Handling: Must be greater than or equal to 0
   - Other Charges: Must be greater than or equal to 0

3. **Status Validation:**
   - DRAFT status: Minimal validation, allows saving with incomplete information
   - COMPLETED status: Strict validation, all required fields must be present

### Item-Level Validation

1. **Quantity Validation:**
   - For items linked to Purchase Orders (POs):
     - System warns if the quantity received exceeds the receivable quantity from the PO
     - Over-receiving is allowed but with warning indicators
   - For manually added items (not from POs):
     - Quantity must be greater than 0

2. **Price Validation:**
   - Unit cost price must be non-negative
   - System calculates line totals, tax amounts, and totals with tax

3. **Batch and Expiry:**
   - Batch number is optional
   - Expiry date is optional but must be valid if provided

## Business Logic

### GRN Status Transitions

1. **DRAFT → COMPLETED:**
   - Runs full validation of all fields
   - Updates inventory quantities (increases stock)
   - Updates product cost prices (weighted average)
   - Updates product last_received_date
   - Updates Purchase Order status (PARTIALLY_RECEIVED or RECEIVED)
   - Updates Purchase Order last_grn_date
   - Creates inventory transaction records

2. **COMPLETED → DRAFT:**
   - Reverses all inventory operations
   - Restores original cost prices
   - Updates Purchase Order status to revert any changes

### Inventory Impact

1. **Stock Updates:**
   - Stock quantity is increased when GRN status is set to COMPLETED
   - Weighted average cost price is calculated based on:
     - Current stock quantity and value
     - Newly received quantity and value
   - Full calculation: 
     ```
     New Avg Cost = (Current Stock × Current Avg Cost + Received Qty × Received Unit Cost) ÷ (Current Stock + Received Qty)
     ```

2. **Multi-Location Handling:**
   - GRN affects inventory in the specific store location specified
   - Each store maintains separate inventory records

## User Workflows

### Create New GRN

1. Open the GRN module and click "Create GRN"
2. Select a supplier
3. Add items via one of the following methods:
   - Select from available POs (automatically populates items)
   - Manual product search (add products individually)
4. Set quantities and adjust prices as needed
5. (Optional) Add batch numbers and expiry dates
6. (Optional) Add shipping costs and other charges
7. Add notes if necessary
8. Save as DRAFT or complete the GRN:
   - For DRAFT: Click "Save as Draft"
   - For COMPLETED: Enter supplier invoice details and click "Complete GRN"

### Edit Existing GRN

1. Locate the GRN in the list and click "Edit"
2. Make necessary changes to quantities, prices, or other details
3. Click "Save" to update the GRN

### Change GRN Status

1. Open the GRN in edit mode
2. Change status using the status dropdown
3. For DRAFT → COMPLETED:
   - Enter all required fields (supplier invoice details, etc.)
   - Click "Save" to complete the GRN
4. For COMPLETED → DRAFT:
   - Confirm the reversal of inventory operations
   - Click "Save" to change the status

## Error Handling

1. **Field Validation Errors:**
   - Displayed inline next to the relevant fields
   - Red border highlights invalid fields
   - Error summary at form level when submitting with errors

2. **API Errors:**
   - Toast notifications display server-side errors
   - Generic error handling with specific messages when available

3. **Over-receiving Warnings:**
   - Yellow warning indicators when receiving more than the PO quantity
   - Warning toast notifications with option to proceed

## Loading States

The GRN module implements granular loading states for different operations:

1. **Supplier Loading:**
   - Displays loading spinner in supplier dropdown while fetching suppliers
   - Shows error message if supplier loading fails

2. **PO Loading:**
   - Displays loading spinner in PO selection button
   - Shows error state if PO loading fails

3. **Manual Product Search:**
   - Shows loading state during product search
   - Provides error feedback for failed searches

4. **Store Details Loading:**
   - Loads store information (including currency) for proper formatting
   - Shows warnings if store details cannot be loaded

5. **GRN Loading (Edit Mode):**
   - Shows loading indicator when fetching GRN details
   - Displays table loading state while items are being loaded
