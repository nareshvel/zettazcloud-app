import { HelpArticle } from '../types';

export const posArticles: HelpArticle[] = [
  {
    id: 'pos-basics',
    title: 'Using the POS System',
    category: 'pos',
    content: `
# Point of Sale Guide 💳

## Processing a Sale - Step by Step

### 1. Add Products
- **Barcode Scanning**: Use handheld scanner or camera
- **Manual Search**: Type product name or SKU
- **Quick Add**: Click favorite products from sidebar
- **Bulk Add**: Scan multiple items quickly

**Example Workflow:**
\`\`\`
1. Scan barcode → Product appears in cart
2. Adjust quantity if needed (click qty field)
3. Apply item discount if applicable
4. Continue scanning more items
\`\`\`

### 2. Apply Discounts
- **Item Discounts**: Click item → Apply % or $ discount
- **Transaction Discounts**: Use "Apply Discount" button
- **Coupon Codes**: Enter promotional codes
- **Employee Discounts**: Special staff pricing

**Common Discount Scenarios:**
- Happy Hour: 20% off beverages 3-6 PM
- Bulk Discount: Buy 5 get 1 free
- Student Discount: 10% with valid ID
- Loyalty Rewards: Points-based discounts

### 3. Payment Processing
- **Cash**: Enter amount received → Calculate change
- **Card**: Process through integrated terminal
- **Split Payment**: Multiple payment methods
- **Gift Cards**: Redeem store credit

## Advanced Features
- **Hold Transactions**: Save incomplete sales
- **Customer Lookup**: Access purchase history
- **Returns/Exchanges**: Process refunds easily
- **Receipt Options**: Print, email, or SMS

## Best Practices 📋
- **Speed**: Aim for 30 seconds per transaction
- **Accuracy**: Double-check quantities and prices
- **Customer Service**: Greet customers warmly
- **Security**: Never leave POS unattended
- **End of Day**: Count cash drawer and run reports
    `,
    role: ['employee', 'manager', 'Tenant Admin'],
    tags: ['pos', 'sales', 'transactions'],
    lastUpdated: '2025-08-21'
  }
];
