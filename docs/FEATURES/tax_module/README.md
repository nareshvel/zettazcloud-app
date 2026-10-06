# Tax Module Documentation

## Overview

The Zettaz Cloud Tax Module provides a comprehensive tax management system for multi-store environments. This system supports:

- Item-wise taxation with multiple tax classes and rates
- Store-specific tax basis configuration (inclusive vs. exclusive)
- Customer tax exemptions
- Multiple tax scenarios to accommodate various business requirements

## Key Features

- **Store-Level Tax Configuration**: Each store can configure its own tax basis, tax classes, and rates
- **Product-Specific Tax Classes**: Individual products can be assigned to specific tax classes
- **Customer Tax Exemption**: Support for tax-exempt customers
- **Multi-Store Tax Management**: Centralized interface for managing taxes across multiple stores
- **Item-Wise Tax Calculation**: Tax calculated at the item level, supporting mixed tax rates on invoices
- **Tax Reporting**: Comprehensive tax reporting for accounting and compliance

## Core Tax Concepts

### Tax Basis: Inclusive vs. Exclusive

- **Tax Exclusive (Add-on Tax)**: Tax is calculated in addition to the displayed product price
  - Example: Item price = $10.00, Tax Rate = 10%. Customer pays $10.00 + $1.00 = $11.00

- **Tax Inclusive (Tax-embedded)**: The displayed product price already includes tax
  - Example: Item price = $11.00 (tax inclusive), Tax Rate = 10%. Tax amount = $11.00 - ($11.00 / 1.10) = $1.00. Net price = $10.00

### Tax Application Levels

- **Product/Item Level**: Different products can have different tax rates or be exempt
- **Customer Level**: Specific customers may be exempt from paying sales tax
- **Item-Wise Calculation**: Tax calculated individually for each item, then summed up

## Documentation Structure

The tax module documentation is organized into the following sections:

1. **[Database Schema](./database-schema.md)**: Details the database structure, including tables, fields, and relationships
2. **[Implementation Guide](./implementation-guide.md)**: Technical implementation details and business logic
3. **[POS Integration](./pos-integration.md)**: Specific details about how the tax module integrates with the POS system
4. **[Testing Guidelines](./testing-guidelines.md)**: Guidelines for testing tax functionality across various scenarios

## Implementation Status

### Completed Features

- ✅ Database schema for tax classes and rates
- ✅ Store-level tax basis configuration (inclusive vs. exclusive)
- ✅ Backend API for tax management
- ✅ Tax calculation logic for item-wise taxes
- ✅ Customer tax exemption handling
- ✅ Tax-inclusive pricing support
- ✅ Store settings UI for tax configuration
- ✅ Tax display in POS interface

### Pending Features

- ⏳ Enhanced tax reporting functionality
- ⏳ Tax export capabilities for accounting systems
- ⏳ Additional tax class configuration options
- ⏳ Tax overrides for specific sales scenarios

## Getting Started

To configure taxes for your store:

1. Navigate to **Settings > Taxes** in the admin panel
2. Configure your store's default tax basis (inclusive or exclusive)
3. Create tax classes for different product categories
4. Define tax rates for each tax class
5. Assign tax classes to products as needed

## Additional Resources

- [Tax Configuration Guide for Admins](../admin-guides/tax-configuration.md)
- [Developer API Reference for Tax Endpoints](../api-documentation/tax-endpoints.md)
- [Tax Calculation Technical Reference](../technical-reference/tax-calculation.md)
