# User Guides

This section provides comprehensive guides for end-users of the Zettaz Cloud Enterprise application, covering all major features and functionalities.

## Introduction

The Zettaz Cloud Enterprise application is a comprehensive multi-tenant business management system designed to handle various aspects of business operations including inventory management, purchase orders, goods received notes (GRN), and point of sale (POS).

These guides are intended for different user roles within the system, from store managers to inventory clerks and sales staff.

## User Roles and Permissions

The application supports several user roles, each with specific permissions:

1. **Administrator**
   - Full access to all system features
   - User management and permission settings
   - System configuration
   - Access to all reports and analytics

2. **Manager**
   - Access to operational dashboards
   - Approval of purchase orders
   - Access to sales and inventory reports
   - Staff management

3. **Inventory Clerk**
   - Creation and management of purchase orders
   - Processing of goods received notes (GRN)
   - Inventory adjustments and stock counts
   - Basic inventory reports

4. **Sales Associate**
   - Point of sale (POS) operations
   - Customer management
   - Basic sales reports
   - View inventory availability

5. **Accountant**
   - Financial reports
   - Purchase order review
   - Payment processing
   - Tax management

## Getting Started

### Logging In

1. Navigate to your organization's Zettaz Cloud Enterprise URL
2. Enter your username and password
3. Click "Login"
4. If this is your first login, you may be prompted to change your password

### Navigating the Dashboard

After logging in, you'll be taken to the main dashboard which includes:

1. **Quick Stats** - Shows key metrics relevant to your role
2. **Recent Activity** - Displays recent transactions and actions
3. **Alerts** - Highlights items requiring attention (low stock, pending approvals)
4. **Navigation Menu** - Access to all modules you have permission to use

### User Profile Management

To manage your user profile:

1. Click on your username in the top-right corner
2. Select "Profile" from the dropdown menu
3. From here you can:
   - Update your personal information
   - Change your password
   - Set notification preferences
   - Configure UI preferences

## Inventory Management

### Product Management

#### Viewing Products

1. Navigate to Inventory > Products
2. Use the search box to find specific products
3. Filter products by category, status, or other attributes
4. Click on a product to view detailed information

#### Adding a New Product

1. Navigate to Inventory > Products
2. Click the "Add Product" button
3. Fill in the required fields:
   - Product Name
   - SKU (Stock Keeping Unit)
   - Category
   - Description
   - Cost Price
   - Selling Price
   - Tax Rate
   - Initial Stock Quantity (if applicable)
4. Add product images if needed
5. Click "Save" to create the product

#### Editing Products

1. Navigate to Inventory > Products
2. Find the product you want to edit
3. Click the "Edit" button (pencil icon)
4. Update the product information
5. Click "Save" to apply changes

#### Managing Product Categories

1. Navigate to Inventory > Categories
2. View existing categories in a list or grid view
3. To add a new category, click "Add Category"
4. To edit a category, click the "Edit" button next to it
5. To delete a category, click the "Delete" button (ensure no products are using this category)

### Stock Management

#### Viewing Current Stock

1. Navigate to Inventory > Stock Levels
2. View current stock levels for all products
3. Use filters to sort by stock status (In Stock, Low Stock, Out of Stock)
4. Export the stock report if needed

#### Stock Adjustments

1. Navigate to Inventory > Stock Adjustments
2. Click "New Adjustment"
3. Select adjustment type:
   - Addition (increasing stock)
   - Reduction (decreasing stock)
   - Write-off (damaged goods)
   - Correction (fixing errors)
4. Select products and enter quantities
5. Add a reason for the adjustment
6. Click "Submit" to process the adjustment

#### Stock Transfers

For businesses with multiple locations:

1. Navigate to Inventory > Stock Transfers
2. Click "New Transfer"
3. Select source and destination locations
4. Add products and quantities to transfer
5. Schedule the transfer date
6. Click "Create Transfer"
7. Once the transfer is complete, mark it as "Received" at the destination

## Purchase Order Management

### Creating Purchase Orders

1. Navigate to Purchasing > Purchase Orders
2. Click "Create New Purchase Order"
3. Select a supplier from the dropdown
4. Set the expected delivery date
5. Add products by clicking "Add Item"
   - Select product from dropdown
   - Enter quantity
   - Verify unit price
   - Add any item notes
6. Continue adding all required items
7. Add any general notes or reference numbers
8. Select status:
   - "DRAFT" - to save for later editing
   - "ORDERED" - if the PO has been sent to the supplier
9. Click "Save Purchase Order"

### Managing Purchase Orders

#### Viewing Purchase Orders

1. Navigate to Purchasing > Purchase Orders
2. View list of all purchase orders
3. Filter by:
   - Status (DRAFT, ORDERED, PARTIALLY_RECEIVED, COMPLETED, CANCELLED)
   - Date range
   - Supplier
4. Click on any purchase order to view details

#### Editing a Purchase Order

1. Navigate to Purchasing > Purchase Orders
2. Find the purchase order you wish to edit
3. Click the "Edit" button
4. Make necessary changes
   - **Note**: You can only edit purchase orders in "DRAFT" status
5. Click "Save Changes"

#### Changing Purchase Order Status

1. Open the purchase order
2. Click the "Change Status" button
3. Select the new status:
   - DRAFT: Initial state, editable
   - ORDERED: Sent to supplier, no longer editable
   - PARTIALLY_RECEIVED: Some items received
   - COMPLETED: All items received
   - CANCELLED: Order cancelled
4. Add any notes explaining the status change
5. Click "Update Status"

**Important Note**: The system automatically updates the purchase order status based on GRN processing. When items are received through the GRN process, the purchase order status may change to PARTIALLY_RECEIVED or COMPLETED depending on whether all items have been received.

#### Purchase Order Tracking

1. Navigate to Purchasing > Purchase Order Tracking
2. View all purchase orders with their current status
3. See expected delivery dates and actual receipt dates
4. Track which items have been received and which are still pending

## Goods Received Note (GRN) Processing

### Creating a GRN

There are two ways to create a GRN:

#### Option 1: From Purchase Order

1. Navigate to Purchasing > Purchase Orders
2. Find the purchase order for which you're receiving goods
3. Click "Create GRN"
4. The system will pre-populate the GRN with the purchase order items
5. Adjust quantities if the received amount differs from the ordered amount
6. Add any notes regarding the delivery
7. Select status:
   - "DRAFT" - to save for later editing
   - "COMPLETED" - to finalize and update inventory
8. Click "Save GRN"

#### Option 2: Direct GRN

1. Navigate to Inventory > Goods Received
2. Click "Create New GRN"
3. Select a supplier
4. Select a related purchase order (optional)
5. Add products by clicking "Add Item"
   - Select product from dropdown
   - Enter received quantity
   - Enter unit cost
6. Add delivery notes, invoice number, etc.
7. Select status (DRAFT or COMPLETED)
8. Click "Save GRN"

### Managing GRNs

#### Viewing GRNs

1. Navigate to Inventory > Goods Received
2. View list of all GRNs
3. Filter by:
   - Status (DRAFT, COMPLETED)
   - Date range
   - Supplier
   - Related purchase order
4. Click on any GRN to view details

#### Editing a GRN

1. Navigate to Inventory > Goods Received
2. Find the GRN you wish to edit
3. Click the "Edit" button
4. Make necessary changes
   - **Note**: You can only edit GRNs in "DRAFT" status
5. Click "Save Changes"

#### Changing GRN Status

1. Open the GRN
2. Click the "Change Status" button
3. Select the new status:
   - DRAFT: Initial state, editable
   - COMPLETED: Finalized, inventory updated
4. Add any notes explaining the status change
5. Click "Update Status"

**Important Notes**:
- When a GRN is set to "COMPLETED", the system automatically:
  - Updates inventory quantities
  - Updates the product's last received date
  - Updates the purchase order's last GRN date
  - Updates the purchase order status if applicable
- If a GRN status is changed from "COMPLETED" back to "DRAFT", the system will reverse the inventory updates

### GRN and Inventory Impact

When processing a GRN as "COMPLETED":

1. The system increases the inventory quantity for each received product
2. The product's cost price may be updated based on the received cost
3. The product's "last_received_date" is updated
4. The purchase order's "last_grn_date" is updated
5. The purchase order status is updated based on receipt status

## Point of Sale (POS) Operations

### Starting a Sale

1. Navigate to Sales > Point of Sale
2. Select the appropriate register/terminal if prompted
3. Begin a new sale by clicking "New Sale"
4. Add products to the cart by:
   - Scanning barcode
   - Searching for product name or SKU
   - Browsing categories
5. For each product, specify:
   - Quantity
   - Any applicable discounts
6. The system automatically calculates taxes based on product tax settings

### Managing the Cart

1. To modify quantity:
   - Use + or - buttons
   - Or enter quantity directly
2. To remove an item:
   - Click the "Remove" button next to the item
3. To apply a discount:
   - Select the item
   - Click "Apply Discount"
   - Enter either percentage or fixed amount
4. To hold a sale for later:
   - Click "Hold Sale"
   - Enter a reference name
   - Click "Confirm"
5. To retrieve a held sale:
   - Click "Retrieve Sale"
   - Select from the list of held sales
   - Click "Load"

### Completing a Sale

1. When all items are added, click "Checkout"
2. Select payment method:
   - Cash
   - Credit/Debit Card
   - Gift Card
   - Multiple payment methods
3. For cash payments:
   - Enter amount tendered
   - System calculates change
4. For card payments:
   - Process through integrated payment terminal
   - Or enter approval code manually
5. Complete the sale by clicking "Complete Sale"
6. Receipt options:
   - Print receipt
   - Email receipt
   - Both
   - No receipt

### Offline Mode

If internet connection is lost:

1. POS automatically switches to offline mode
2. Limited functionality is available:
   - Can process sales for existing products in local cache
   - Cash payments only
   - Cannot access customer profiles or loyalty features
3. Once connection is restored:
   - Offline transactions are synchronized automatically
   - System notifies user when sync is complete

### Returns and Refunds

1. Navigate to Sales > Point of Sale
2. Click "Process Return"
3. Locate the original sale by:
   - Scanning receipt barcode
   - Entering receipt number
   - Searching by date/customer
4. Select items to return
5. Enter return reason
6. Process refund:
   - To original payment method
   - As store credit
   - As exchange for other products

## Reports and Analytics

### Accessing Reports

1. Navigate to Reports in the main menu
2. Select from available report categories:
   - Sales Reports
   - Inventory Reports
   - Purchase Reports
   - Financial Reports
   - User Activity Reports

### Sales Reports

#### Daily Sales Summary

1. Navigate to Reports > Sales > Daily Summary
2. Select date range
3. View:
   - Total sales amount
   - Number of transactions
   - Average transaction value
   - Payment method breakdown
   - Top selling products
   - Hourly sales distribution

#### Sales by Product

1. Navigate to Reports > Sales > By Product
2. Select date range
3. Filter by:
   - Product category
   - Brand
   - Individual products
4. View:
   - Quantity sold
   - Revenue generated
   - Profit margin
   - Comparison to previous period

### Inventory Reports

#### Stock Level Report

1. Navigate to Reports > Inventory > Stock Levels
2. View:
   - Current stock quantity by product
   - Value of inventory
   - Low stock items
   - Out of stock items
3. Filter by:
   - Category
   - Location
   - Stock status

#### Inventory Movement Report

1. Navigate to Reports > Inventory > Movement
2. Select date range
3. Filter by product or category
4. View:
   - Opening balance
   - Purchases (from GRNs)
   - Sales
   - Adjustments
   - Transfers
   - Closing balance

### Purchase Reports

#### Purchase Order Summary

1. Navigate to Reports > Purchasing > PO Summary
2. Select date range
3. Filter by:
   - Supplier
   - Status
4. View:
   - Total POs created
   - Total value
   - Status distribution
   - Average fulfillment time

#### Supplier Performance

1. Navigate to Reports > Purchasing > Supplier Performance
2. Filter by supplier
3. View:
   - On-time delivery rate
   - Order accuracy
   - Price consistency
   - Average lead time

### Exporting Reports

For all reports:

1. View the report on screen
2. Click "Export" button
3. Select format:
   - PDF
   - Excel
   - CSV
4. Select destination:
   - Download
   - Email
5. Click "Export" to generate the file

## User Management (Admin)

### Creating Users

1. Navigate to Administration > User Management
2. Click "Add User"
3. Enter user details:
   - First Name
   - Last Name
   - Email Address (will be their username)
   - Phone Number (optional)
   - Role (Administrator, Manager, Inventory Clerk, etc.)
   - Assign to location(s)
4. Set password options:
   - Generate temporary password
   - Require password change on first login
5. Click "Create User"

### Managing User Permissions

1. Navigate to Administration > User Management
2. Select a user from the list
3. Click "Edit Permissions"
4. Modify permissions by:
   - Selecting a predefined role
   - Customizing individual permissions
5. Click "Save Changes"

### Deactivating Users

1. Navigate to Administration > User Management
2. Find the user to deactivate
3. Click "Deactivate" button
4. Confirm the action
5. The user will no longer be able to log in, but their account history is preserved

## System Configuration (Admin)

### Business Settings

1. Navigate to Administration > Business Settings
2. Configure:
   - Company Name
   - Legal Business Name
   - Tax ID/Registration Number
   - Contact Information
   - Logo
   - Business Hours

### Location Management

1. Navigate to Administration > Locations
2. View existing locations
3. To add a new location:
   - Click "Add Location"
   - Enter name, address, contact details
   - Set inventory settings
   - Assign users
4. To edit a location:
   - Select the location
   - Click "Edit"
   - Update information
   - Click "Save"

### Tax Configuration

1. Navigate to Administration > Tax Settings
2. Configure tax rates:
   - Add tax rates with name, percentage, and applicability
   - Set tax categories for products
   - Configure tax exemptions
3. Set up tax display options:
   - Include in product price
   - Add at checkout

### Receipt Customization

1. Navigate to Administration > Receipt Settings
2. Customize:
   - Header information
   - Footer text
   - Terms and conditions
   - Receipt size and format
   - Additional information to display
3. Preview the receipt
4. Save changes

## Troubleshooting Common Issues

### Login Issues

**Problem**: Unable to log in
**Solutions**:
1. Verify username and password
2. Check if account is locked (too many failed attempts)
3. Clear browser cache and cookies
4. Try a different browser
5. Contact administrator for password reset

### Inventory Discrepancies

**Problem**: Physical inventory doesn't match system records
**Solutions**:
1. Check for unprocessed transactions (sales, GRNs, adjustments)
2. Verify all stock transfers are properly recorded
3. Check for items with similar names or SKUs
4. Perform a stock count and adjustment
5. Review recent user activity for the affected products

### GRN Processing Issues

**Problem**: Cannot complete a GRN
**Solutions**:
1. Verify that all required fields are completed
2. Check if any product quantities exceed reasonable limits
3. Ensure the purchase order exists and is in the correct status
4. Verify you have appropriate permissions
5. Check system logs for specific error messages

### POS Transaction Failures

**Problem**: Unable to complete a sale
**Solutions**:
1. Check internet connectivity
2. Verify payment terminal is functioning
3. Ensure products are active and in stock
4. Check for system notifications or alerts
5. Try restarting the POS application
6. Process the transaction in offline mode if needed

## Best Practices

### Inventory Management

1. Perform regular cycle counts to maintain accuracy
2. Process GRNs promptly when goods are received
3. Keep product information up to date (costs, prices, descriptions)
4. Use appropriate categories and tags for easy searching
5. Set minimum stock levels for critical items

### Purchase Order Processing

1. Create purchase orders in advance of need
2. Include accurate delivery addresses and contact information
3. Verify all items and quantities before changing status to ORDERED
4. Communicate with suppliers about expected delivery dates
5. Compare received goods against original purchase orders

### Point of Sale Operations

1. Count cash drawers at the beginning and end of shifts
2. Process returns with original receipts when possible
3. Train staff on discount policies and authorization
4. Regularly sync offline transactions
5. Back up transaction data daily

## Glossary of Terms

- **GRN (Goods Received Note)**: Document recording the receipt of goods from suppliers
- **PO (Purchase Order)**: Document sent to suppliers to order goods
- **SKU (Stock Keeping Unit)**: Unique identifier for each product
- **COGS (Cost of Goods Sold)**: The direct cost of products sold
- **Cycle Count**: Partial inventory count done on a rotating schedule
- **FIFO (First In, First Out)**: Inventory valuation method
- **LIFO (Last In, First Out)**: Alternative inventory valuation method
- **MOQ (Minimum Order Quantity)**: Smallest quantity a supplier will sell
- **Reorder Point**: Stock level that triggers new purchase orders
- **Stockout**: Situation where a product is unavailable in inventory
- **Shrinkage**: Inventory loss due to theft, damage, or errors
