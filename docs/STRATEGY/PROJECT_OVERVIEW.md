# Project Overview

## Zettaz Cloud Enterprise

**Tagline:** Comprehensive inventory and point-of-sale management for modern businesses

## Purpose & Goals

Zettaz Cloud Enterprise is a robust, scalable, and user-friendly enterprise resource planning (ERP) solution designed to streamline business operations for retail, wholesale, and distribution businesses. The system integrates inventory management, purchase order processing, goods received notes handling, point-of-sale operations, and comprehensive reporting into a unified platform.

### Primary Goals

- **Streamline Inventory Management:** Provide real-time tracking of stock levels, automated reordering, and inventory valuation
- **Simplify Purchase Workflows:** Manage the entire procurement cycle from purchase orders to goods receipt
- **Enhance Sales Operations:** Offer an intuitive POS interface that works both online and offline
- **Support Multi-tenancy:** Enable businesses to manage multiple stores/locations with centralized control
- **Deliver Actionable Insights:** Generate comprehensive reports and analytics for informed decision-making
- **Ensure Scalability:** Support businesses from small retailers to large enterprises with multiple locations

## Core Features

### Inventory Management
- Product catalog management with categories, tags, and attributes
- Barcode generation and scanning support
- Automated stock level tracking and alerts
- Weighted average cost (WAC) calculation
- Stock transfers between locations
- Batch and expiry date tracking

### Procurement
- Purchase order creation and management
- Supplier management and history
- Goods received notes (GRN) processing
- Stock commitment and reversal workflows
- Purchase order status tracking

### Point of Sale
- Intuitive touch-friendly interface
- Support for various payment methods
- Discount and promotion handling
- Receipt generation and printing
- Cash drawer management
- Customer management

### Reporting & Analytics
- Sales reporting by product, category, and store
- Inventory valuation reports
- Purchase history and supplier performance
- Profit margin analysis
- Customizable dashboards

### User Management
- Role-based access control
- Multi-tenancy support
- User activity logging
- Secure authentication

## Target Users & Use Cases

### Target Users
- **Retail Store Owners:** Single or multi-location retail businesses
- **Inventory Managers:** Staff responsible for maintaining optimal stock levels
- **Purchasing Managers:** Staff handling supplier relationships and procurement
- **Sales Staff:** Cashiers and sales associates using the POS system
- **Finance Teams:** Accountants and financial analysts reviewing sales and inventory data
- **Store Managers:** Overseeing daily operations and performance metrics

### Key Use Cases

#### Inventory Management
- Tracking inventory levels across multiple locations
- Managing product information including costs, prices, and attributes
- Conducting inventory counts and reconciliation
- Planning stock transfers between locations

#### Procurement Process
- Creating and managing purchase orders
- Receiving goods and updating inventory
- Managing supplier relationships and performance
- Tracking procurement costs and budget adherence

#### Point of Sale Operations
- Processing sales transactions quickly and accurately
- Managing customer information and purchase history
- Handling returns, exchanges, and refunds
- Closing shifts and reconciling cash drawers

#### Business Intelligence
- Analyzing sales trends and inventory performance
- Forecasting inventory needs and sales projections
- Reviewing profitability by product, category, or store
- Monitoring key performance indicators

## Tech Stack Overview

### Frontend
- **Framework:** React with TypeScript
- **UI Components:** Shadcn UI library with Tailwind CSS
- **State Management:** React Context API
- **Data Fetching:** Axios for API requests
- **Date Handling:** date-fns

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL
- **ORM:** Direct SQL queries with mysql2 package
- **Authentication:** JWT (JSON Web Tokens)
- **Validation:** Express validator

### Development Tools
- **Version Control:** Git
- **Package Management:** npm
- **Testing:** Jest (backend)
- **API Documentation:** Custom documentation

### Deployment & Infrastructure
- **Database Hosting:** Self-hosted MySQL
- **Application Hosting:** Flexible deployment options (cloud or on-premises)
- **CI/CD:** Manual deployment with potential for automation
