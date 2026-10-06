import { HelpArticle } from '../types';

export const settingsArticles: HelpArticle[] = [
  {
    id: 'business-profile-setup',
    title: 'Business Profile Configuration',
    category: 'settings',
    content: `
# Business Profile Setup ⚙️

## Basic Information
1. **Business Details**
   - Company name and legal entity name
   - Business address and contact information
   - Tax identification numbers (EIN, VAT, etc.)
   - Business registration details

2. **Branding Elements**
   - Upload your business logo (recommended: 300x300px PNG)
   - Choose brand colors for receipts and reports
   - Add tagline or business description
   - Set up social media links

## Contact Information
- **Primary Contact**: Main business phone and email
- **Support Contact**: Customer service details
- **Billing Contact**: Accounting and finance contact
- **Emergency Contact**: After-hours contact information

## Legal & Compliance
- Business license numbers
- Health department permits (for food businesses)
- Professional certifications
- Insurance information

TIP: Keep all information current as it appears on receipts and legal documents.
    `,
    role: ['Tenant Admin'],
    tags: ['settings', 'profile', 'branding', 'legal'],
    lastUpdated: '2025-08-21'
  },
  {
    id: 'localization-settings',
    title: 'Localization & Regional Settings',
    category: 'settings',
    content: `
# Localization Settings 🌍

## Regional Configuration
1. **Country & Region**
   - Select your business country
   - Choose state/province for tax calculations
   - Set time zone for accurate reporting
   - Configure daylight saving time preferences

2. **Currency Settings**
   - Primary business currency (USD, EUR, GBP, CAD, etc.)
   - Exchange rate sources for multi-currency support
   - Currency display format (symbol position, decimals)
   - Rounding rules for cash transactions

## Date & Time Formats
- **Date Format**: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
- **Time Format**: 12-hour (AM/PM) or 24-hour
- **Week Start**: Sunday or Monday
- **Fiscal Year**: Calendar year or custom period

## Number & Measurement
- **Number Format**: Decimal separator (. or ,)
- **Thousands Separator**: Comma, space, or period
- **Measurement Units**: Imperial or Metric
- **Weight Units**: Pounds, kilograms, ounces

## Language & Communication
- **Default Language**: Interface language
- **Receipt Language**: Customer-facing text
- **Email Templates**: Localized messaging
- **Customer Communications**: Regional preferences

EXAMPLE: US restaurant would use USD currency, MM/DD/YYYY dates, Imperial measurements, and English language.
    `,
    role: ['Tenant Admin'],
    tags: ['settings', 'localization', 'currency', 'regional'],
    lastUpdated: '2025-08-21'
  },
  {
    id: 'tax-configuration',
    title: 'Tax Classes & Configuration',
    category: 'settings',
    content: `
# Tax Configuration ⚙️

## Tax Class Setup
1. **Standard Tax Classes**
   - **Standard Rate**: General merchandise tax (e.g., 8.25%)
   - **Food & Beverage**: Restaurant/grocery tax rates
   - **Non-Taxable**: Exempt items (medications, groceries)
   - **Luxury Tax**: High-value items with additional tax

2. **Location-Based Taxes**
   - **State Tax**: Base state sales tax rate
   - **County Tax**: Additional county tax
   - **City Tax**: Municipal tax rates
   - **Special Districts**: Tourism, transit, or special taxes

## Tax Calculation Rules
- **Compound Tax**: Tax on tax calculations
- **Inclusive vs Exclusive**: Tax included in price or added
- **Rounding Rules**: How to handle fractional cents
- **Exemption Handling**: Tax-exempt customers and items

## Common Tax Scenarios
**Restaurant Example:**
- Food items: 0% (many states)
- Alcoholic beverages: 8.25% + liquor tax
- Takeout containers: Standard rate
- Delivery fees: Service tax rate

**Retail Example:**
- Clothing under $100: Tax-exempt (some states)
- Electronics: Standard rate + recycling fee
- Gift cards: No tax on purchase
- Services: Different rate than goods

## Compliance Features
- **Tax Reports**: Automated tax filing reports
- **Audit Trail**: Complete transaction tax history
- **Rate Updates**: Automatic tax rate changes
- **Multi-Jurisdiction**: Support for multiple locations

WARNING: Always consult with a tax professional for your specific business requirements and local regulations.
    `,
    role: ['Tenant Admin', 'manager'],
    tags: ['settings', 'tax', 'compliance', 'rates'],
    lastUpdated: '2025-08-21'
  },
  {
    id: 'payment-methods-setup',
    title: 'Payment Methods Configuration',
    category: 'settings',
    content: `
# Payment Methods Setup 💳

## Supported Payment Types
1. **Cash Payments**
   - Enable/disable cash acceptance
   - Cash drawer configuration
   - Change calculation settings
   - Cash counting and reconciliation

2. **Card Payments**
   - **Credit Cards**: Visa, MasterCard, American Express
   - **Debit Cards**: PIN and signature options
   - **Contactless**: Tap-to-pay, Apple Pay, Google Pay
   - **Gift Cards**: Store-branded gift card system

## Payment Processor Setup
**Stripe Integration:**
- API keys configuration
- Webhook endpoints
- Fee structure setup
- Dispute handling

**Square Integration:**
- Application ID and access tokens
- Device pairing for card readers
- Inventory synchronization
- Transaction reconciliation

## Advanced Payment Features
- **Split Payments**: Multiple payment methods per transaction
- **Partial Payments**: Layaway and installment options
- **Refund Processing**: Full and partial refunds
- **Tip Handling**: Automatic tip prompts and distribution

## Security & Compliance
- **PCI Compliance**: Secure card data handling
- **Encryption**: End-to-end payment encryption
- **Tokenization**: Secure card storage for returns
- **Fraud Prevention**: Real-time transaction monitoring

## Cash Management
- **Opening Till**: Starting cash amounts
- **Cash Drops**: Secure cash removal during shifts
- **Closing Procedures**: End-of-day cash counting
- **Variance Tracking**: Cash over/short reporting

TIP: Enable multiple payment methods to accommodate all customer preferences and increase sales.
    `,
    role: ['Tenant Admin', 'manager'],
    tags: ['settings', 'payments', 'processors', 'security'],
    lastUpdated: '2025-08-21'
  },
  {
    id: 'receipt-templates',
    title: 'Receipt Templates & Printing',
    category: 'settings',
    content: `
# Receipt Templates ⚙️

## Template Customization
1. **Header Section**
   - Business logo and name
   - Address and contact information
   - Tax ID and license numbers
   - Custom welcome message

2. **Transaction Details**
   - Item listing format
   - Price and tax display
   - Discount and promotion codes
   - Payment method information

3. **Footer Section**
   - Return policy statement
   - Social media and website links
   - Loyalty program information
   - Custom thank you message

## Receipt Types
- **Sales Receipts**: Standard customer receipts
- **Return Receipts**: Product return documentation
- **Gift Receipts**: Price-hidden gift receipts
- **Email Receipts**: Digital receipt templates

## Printer Configuration
**Thermal Printers:**
- Paper width settings (58mm, 80mm)
- Print density and speed
- Auto-cut configuration
- Logo printing optimization

**Network Printers:**
- IP address configuration
- Driver installation
- Print queue management
- Backup printer setup

## Legal Requirements
- **Required Information**: Date, time, transaction ID
- **Tax Details**: Tax rates and amounts
- **Business Information**: Legal name and address
- **Return Policy**: Clear return terms

## Environmental Options
- **Email-First**: Prompt for email before printing
- **SMS Receipts**: Text message receipt delivery
- **QR Codes**: Digital receipt access
- **Print Reduction**: Minimize paper usage

EXAMPLE: Coffee shop might include WiFi password, daily specials, and loyalty program signup on receipts.
    `,
    role: ['Tenant Admin', 'manager'],
    tags: ['settings', 'receipts', 'printing', 'templates'],
    lastUpdated: '2025-08-21'
  },
  {
    id: 'user-roles-permissions',
    title: 'User Roles & Permissions',
    category: 'settings',
    content: `
# User Management & Permissions ⚙️

## Default User Roles
1. **Tenant Admin**
   - Full system access and configuration
   - User management and role assignment
   - Financial reports and sensitive data
   - System settings and integrations

2. **Manager**
   - Daily operations management
   - Staff scheduling and performance
   - Sales reports and inventory oversight
   - Limited system configuration

3. **Employee**
   - POS system operation
   - Basic inventory functions
   - Customer service features
   - Personal sales tracking

4. **Cashier**
   - Transaction processing only
   - Limited product lookup
   - Basic customer functions
   - No administrative access

## Permission Categories
**Sales & POS:**
- Process transactions
- Apply discounts
- Process returns/exchanges
- Access customer information

**Inventory Management:**
- Add/edit products
- Adjust stock levels
- Create purchase orders
- Generate inventory reports

**Financial Access:**
- View sales reports
- Access profit/loss data
- Manage pricing
- Process refunds

**Administrative Functions:**
- User management
- System configuration
- Integration setup
- Backup and security

## Custom Role Creation
1. **Define Role Purpose**: Specific job function
2. **Select Permissions**: Granular access control
3. **Set Limitations**: Time, location, or amount restrictions
4. **Test Access**: Verify appropriate functionality

## Security Best Practices
- **Unique Logins**: Individual user accounts
- **Strong Passwords**: Enforce password policies
- **Regular Reviews**: Audit user access quarterly
- **Immediate Removal**: Deactivate terminated employees

WARNING: Limit administrative access to trusted personnel only. Regular permission audits help maintain security.
    `,
    role: ['Tenant Admin'],
    tags: ['settings', 'users', 'permissions', 'security', 'roles'],
    lastUpdated: '2025-08-21'
  },
  {
    id: 'integrations-setup',
    title: 'Third-Party Integrations',
    category: 'settings',
    content: `
# System Integrations ⚙️

## Accounting Software
1. **QuickBooks Integration**
   - Automatic transaction sync
   - Chart of accounts mapping
   - Tax category alignment
   - Invoice and payment matching

2. **Xero Integration**
   - Real-time financial data sync
   - Bank reconciliation support
   - Multi-currency handling
   - Automated journal entries

## E-commerce Platforms
**Shopify Sync:**
- Product catalog synchronization
- Inventory level updates
- Order fulfillment tracking
- Customer data integration

**WooCommerce Connection:**
- WordPress site integration
- Product and pricing sync
- Stock management across channels
- Unified customer database

## Marketing & CRM
- **Mailchimp**: Email marketing automation
- **Salesforce**: Customer relationship management
- **HubSpot**: Lead tracking and nurturing
- **Constant Contact**: Newsletter and promotions

## Delivery & Logistics
**DoorDash Integration:**
- Menu synchronization
- Order management
- Delivery tracking
- Commission reconciliation

**UberEats Connection:**
- Real-time menu updates
- Automated order processing
- Delivery fee management
- Performance analytics

## Analytics & Reporting
- **Google Analytics**: Website traffic correlation
- **Facebook Pixel**: Social media ROI tracking
- **Tableau**: Advanced data visualization
- **Power BI**: Business intelligence dashboards

## Setup Process
1. **API Configuration**: Obtain and configure API keys
2. **Data Mapping**: Align fields between systems
3. **Testing**: Verify data accuracy and sync
4. **Monitoring**: Set up alerts for sync failures

## Troubleshooting
- **Sync Failures**: Check API limits and credentials
- **Data Mismatches**: Verify field mappings
- **Performance Issues**: Monitor sync frequency
- **Error Logs**: Review integration error reports

TIP: Start with one integration at a time to ensure proper configuration and testing.
    `,
    role: ['Tenant Admin'],
    tags: ['settings', 'integrations', 'api', 'sync', 'third-party'],
    lastUpdated: '2025-08-21'
  }
];
