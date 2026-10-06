import { HelpArticle } from '../types';

export const inventoryArticles: HelpArticle[] = [
  {
    id: 'inventory-management',
    title: 'Managing Your Inventory',
    category: 'inventory',
    content: `
# Inventory Management 📦

## Adding Products
1. **Manual Entry**: Add products one by one with full details
2. **Bulk Import**: Use Excel/CSV files to import multiple products
3. **Categories**: Organize products into logical categories
4. **Tax Classes**: Assign appropriate tax rates to products

## Stock Management
- **Track Quantities**: Monitor stock levels in real-time
- **Low Stock Alerts**: Get notified when items need reordering
- **Automatic Reordering**: Set up purchase orders when stock is low
- **Stock Adjustments**: Handle damaged, expired, or miscounted items

## Product Information
**Required Fields:**
- Product name and description
- SKU (Stock Keeping Unit)
- Price and cost information
- Category and subcategory
- Tax class assignment

**Optional Fields:**
- Barcode/UPC
- Supplier information
- Product images
- Weight and dimensions
- Expiration dates

## Inventory Reports
- **Stock Levels**: Current quantities on hand
- **Low Stock**: Items needing reorder
- **Product Performance**: Best and worst sellers
- **Valuation**: Total inventory value
- **Movement History**: Stock in/out tracking

TIP: Regular inventory counts help maintain accuracy and prevent stockouts.
    `,
    role: ['employee', 'manager', 'Tenant Admin'],
    tags: ['inventory', 'products', 'stock', 'management'],
    lastUpdated: '2025-08-21'
  }
];
