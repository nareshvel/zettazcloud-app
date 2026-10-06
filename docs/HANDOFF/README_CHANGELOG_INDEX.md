# Changelog

This document maintains a chronological record of notable changes for the Zettaz Cloud Enterprise application.

## Version 2.0.0 (Planned)

### Features
- Advanced reporting dashboard with customizable widgets
- Mobile app integration for inventory management
- Customer loyalty program implementation
- Enhanced tax calculation system with multiple tax jurisdictions support
- Integration with additional payment gateways

## Version 1.5.0 (Current)

### Features
- Offline mode support for Point of Sale operations
- Multi-location inventory transfers
- Enhanced dashboard with improved sales analytics
- Product bundle creation and management
- Customer credit account management

### Improvements
- Optimized database queries for faster report generation
- Reduced initial loading time by 40%
- Enhanced mobile responsiveness for all modules
- Upgraded to React 18 and implemented Suspense for improved loading states
- Enhanced frontend type safety with TypeScript strict mode

### Bug Fixes
- Fixed pagination in product search results
- Corrected tax calculation for discounted items
- Resolved issue with duplicate SKUs in product import
- Fixed date filtering in sales reports
- Addressed printer compatibility issues in POS module

## Version 1.4.0

### Features
- Implemented advanced inventory forecasting
- Added barcode scanning support for mobile devices
- Enhanced user permission system with custom role creation
- Integrated with third-party shipping providers
- Added bulk product import/export functionality

### Improvements
- Upgraded backend to Node.js 18
- Enhanced database connection pooling for better performance
- Improved error messages and validation feedback
- Added comprehensive input validation across all forms
- Enhanced security with improved password policies

### Bug Fixes
- Fixed "poItems is not iterable" error in GRN controller by correctly destructuring MySQL2 query results
- Fixed "Cannot read properties of undefined (reading 'status')" error by properly handling the destructuring of purchase order status query results
- Resolved GRN creation process to respect the status selected in the UI instead of hardcoding to 'COMPLETED'
- Added robust error handling for missing products in GRN controller's updateGrnStatus function
- Fixed column name inconsistency in inventory operations by standardizing on 'current_stock_quantity'
- Fixed 'Unknown column tenant_id in where clause' error in GRN creation by properly JOINing purchase_order_items with purchase_orders table

## Version 1.3.0

### Features
- Added Point of Sale (POS) module with touchscreen support
- Implemented held orders functionality in POS
- Added support for multiple payment methods in a single transaction
- Implemented product variant management (size, color, etc.)
- Added role-based dashboard views

### Improvements
- Enhanced purchase order approval workflow
- Added last GRN date tracking to purchase orders
- Modified GRN creation to update product 'last_received_date'
- Improved multi-tenant isolation in API endpoints
- Enhanced search functionality across all modules

### Bug Fixes
- Fixed inventory counting discrepancies in GRN processing
- Resolved user session timeout issues
- Fixed purchase order status not updating correctly after partial GRN
- Addressed issues with date handling in reports
- Fixed search functionality in product selector

## Version 1.2.0

### Features
- Implemented Goods Received Note (GRN) module
- Added GRN to Purchase Order synchronization
- Implemented inventory adjustment tracking
- Added product image management
- Implemented basic reporting for inventory and purchases

### Improvements
- Enhanced database schema with proper indexes
- Improved multi-tenant data isolation
- Added audit logging for inventory transactions
- Enhanced UI for mobile devices
- Improved error handling and user feedback

### Bug Fixes
- Fixed issues with inventory quantity calculations
- Resolved purchase order duplication bug
- Fixed supplier filtering in purchase order creation
- Addressed product search performance issues
- Fixed date format inconsistencies in exports

## Version 1.1.0

### Features
- Added Purchase Order management module
- Implemented supplier management
- Added product categories and tagging
- Implemented basic inventory tracking
- Added user management with role-based permissions

### Improvements
- Enhanced authentication security
- Improved application loading performance
- Added input validation across forms
- Enhanced UI with responsive design
- Implemented error boundary for better error handling

### Bug Fixes
- Fixed login issues on certain browsers
- Resolved data loading issues in product listing
- Fixed user permission checking in API routes
- Addressed styling inconsistencies across pages
- Fixed memory leaks in React components

## Version 1.0.0 (Initial Release)

### Features
- Multi-tenant architecture
- User authentication and authorization
- Basic product management
- Simple inventory tracking
- Responsive dashboard
- Role-based access control
- Company profile management
- Basic user management
- Database schema foundations
- Security implementations with JWT

## How to Read This Changelog

Each version is organized into three categories:

- **Features**: New functionality added to the application
- **Improvements**: Enhancements to existing features
- **Bug Fixes**: Resolution of issues and bugs

Version numbers follow the Semantic Versioning system:

- **Major version** (X.0.0): Significant changes that may include API changes, major UI overhauls, or substantial new features
- **Minor version** (0.X.0): New features and enhancements that don't break backward compatibility
- **Patch version** (0.0.X): Bug fixes and minor improvements

## Notable Technical Improvements

### Database Schema Evolution
- Added 'last_grn_date' column to purchase_orders table (v1.3.0)
- Added 'last_received_date' column to products table (v1.3.0)
- Standardized on 'current_stock_quantity' for all inventory operations (v1.4.0)
- Enhanced foreign key constraints for better data integrity (v1.2.0)

### Error Handling Patterns
- Implemented graceful handling for missing products during GRN status updates (v1.4.0)
- Enhanced MySQL2 query result handling to properly destructure [rows, fields] format (v1.4.0)
- Added comprehensive transaction management with proper rollback (v1.2.0)
- Improved tenant isolation checking in all database queries (v1.3.0)

### Frontend Improvements
- Migrated to React 18 (v1.5.0)
- Implemented TypeScript strict mode (v1.5.0)
- Added Suspense boundaries for better loading states (v1.5.0)
- Enhanced form validation with schema-based validation (v1.4.0)
- Improved error message display and handling (v1.3.0)

## Future Roadmap Highlights

Planned for upcoming versions:

- API documentation with Swagger/OpenAPI (v2.1.0)
- Enhanced analytics with business intelligence features (v2.0.0)
- Multi-currency support (v2.2.0)
- Integration with accounting systems (v2.3.0)
- Advanced inventory forecasting with ML-based predictions (v3.0.0)
- White-label capabilities for resellers (v3.0.0)
