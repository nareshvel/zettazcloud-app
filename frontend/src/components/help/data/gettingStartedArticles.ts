import { HelpArticle } from '../types';

export const gettingStartedArticles: HelpArticle[] = [
  {
    id: 'quick-start',
    title: 'Quick Start Guide',
    category: 'getting-started',
    content: `
# Welcome to Zettaz Cloud! 🎉

## First Steps
1. **Complete Your Profile** - Update your business information in Settings
   - Navigate to Settings → Business Profile
   - Add your business name, address, and contact details
   - Upload your logo for receipts and branding

2. **Configure Localization** - Set up your business location and currency
   - Navigate to Settings → Localization
   - Select your country and time zone
   - Choose your business currency (USD, EUR, GBP, etc.)
   - Set date and number formats for your region
   - Configure tax settings based on local regulations

3. **Set Up Tax Classes** - Configure tax rates for your location
   - Go to Settings → Tax Classes
   - Create tax classes like "Standard" (8.5%), "Food" (0%), "Luxury" (12%)
   - Example: Restaurant might have "Food" at 0% and "Beverages" at 8%

4. **Add Products** - Import or manually add your inventory
   - Use Inventory → Import Products for bulk uploads
   - Sample CSV format: Name, SKU, Price, Category, Tax Class
   - Example: "Cappuccino, CAP001, 4.50, Beverages, Standard"

5. **Configure Payment Methods** - Set up cash, card, and other payment options
   - Enable methods in Settings → Payment Methods
   - Set up card processing with your payment provider
   - Configure cash drawer settings

6. **Train Your Staff** - Add users and assign appropriate roles
   - Add team members in Users → Add User
   - Assign roles: Employee (basic POS), Manager (reports), Admin (full access)

## Key Features Overview
- **POS Screen**: Process sales transactions quickly with barcode scanning
- **Inventory**: Real-time stock tracking with low-stock alerts
- **Purchase Orders**: Automated reordering from suppliers
- **Reports**: Daily sales summaries, top products, profit margins
- **Settings**: Multi-location support, custom receipt templates

## Quick Tips 💡
- Use keyboard shortcuts: F1 (Help), F2 (Search Products), F3 (New Sale)
- Set up product favorites for faster checkout
- Enable email receipts to reduce paper costs
- Use the mobile app for inventory counts

## Need Help?
- Use the search function to find specific topics
- Watch video tutorials for visual guidance
- Contact support for personalized assistance
- Join our community forum for tips and tricks
    `,
    role: ['Tenant Admin', 'manager'],
    tags: ['onboarding', 'setup', 'basics', 'localization'],
    lastUpdated: '2025-08-21'
  }
];
