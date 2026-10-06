# Technical Documentation

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **State Management**: React Context API. 
  - `AuthContext`: Manages user authentication state, including user details, tenant ID, store ID, and store-specific configurations like `tax_config` and `discount_application_rule`.
  - `CartContext`: Manages the shopping cart state, including items, subtotal, applied discounts, and tax. It utilizes `tax_config` and `discount_application_rule` from `AuthContext` to perform accurate calculations for totals, applying discounts before or after tax as per store settings. See 'Dynamic Tax Calculation' for more details on tax handling.
  - **Dynamic Tax Calculation System**: 
    The Zettaz Cloud POS system implements a flexible dynamic tax calculation mechanism primarily within the `CartContext.tsx` on the frontend. This system allows for both store-wide default taxes and product-specific tax rules.

    **Core Entities (assumed backend support):**
    -   `TaxClass`: Represents a classification for taxes (e.g., "General Sales Tax", "Electronics Tax"). Each product can be associated with a `TaxClass` via its `taxClassId` field.
    -   `TaxClassRate`: Defines specific rates for a `TaxClass` (e.g., a "State GST" rate of 5% for the "General Sales Tax" class). Includes properties like `rate`, `taxRateName`, `priority`, `isCompound`, and `is_active`.

    **Frontend Logic (`CartContext.tsx`):
    1.  **Data Fetching**: On initialization, `CartContext` fetches all available `TaxClass` entities and all their associated `TaxClassRate` entities. These are stored in `taxClasses` (array of `TaxClass`) and `allTaxRates` (a `Record<string, TaxClassRate[]>`, mapping `taxClassId` to its rates) states, respectively.
    2.  **Default Tax Configuration**: The system determines a default store tax configuration based on `user.defaultTaxClassId` (from `AuthContext`) or a tax class marked as `is_default`.
    3.  **Item-Level Tax Calculation (`calculateTax` function):**
        *   For each item in the cart, the system first checks if the `item.product` has a specific `taxClassId`.
        *   If a `product.taxClassId` exists, it attempts to find an active `TaxClassRate` from `allTaxRates[product.taxClassId]`. The first active rate found (considering priority if multiple active rates were supported, though current logic picks the first active one) is used.
        *   If no specific product tax class is found, or if its associated rates are inactive, the system falls back to the store's default active tax configuration.
        *   If no applicable tax rate is found (neither specific nor default), the item's tax is zero.
    4.  **Tax Breakdown (`appliedTaxDetails`):**
        *   During tax calculation for each item, details about the applied tax (e.g., tax name like "State Sales Tax", the rate percentage, and the calculated tax amount for that item under that specific tax) are collected.
        *   These details are aggregated across all items and stored in the `appliedTaxDetails: AppliedTaxDetail[]` state in `CartContext`. Each object in this array typically contains `taxName`, `rate` (e.g., 0.05 for 5%), and `amount` (the total tax amount collected under this specific tax name/rate for the whole cart).
    5.  **Checkout Process**: When a sale is finalized, the `appliedTaxDetails` array is included in the `saleData` object sent to the `createSale` function in `salesService.ts`. This service then includes it as `applied_tax_details` in the payload to the backend API (`POST /sales`). This allows for detailed tax reporting and receipt generation.

    **Discount Interaction:**
    -   The system respects the `discountApplicationPreference` ('BEFORE_TAX' or 'AFTER_TAX') to apply discounts either to the pre-tax subtotal or the post-tax subtotal, affecting the final taxable amount accordingly.

    This dynamic system ensures accurate tax calculations based on granular product settings or store-wide defaults and provides a clear breakdown for reporting and receipts.

  - **POS Screen (`POSScreen.tsx`) UI/UX Enhancements (as of 2025-05-23):**
    The `POSScreen.tsx` component has undergone significant UI/UX updates to ensure a consistent and user-friendly experience on both desktop and mobile devices. The primary goal was to restore and refine the mobile layout to match a specific target design, emphasizing clarity and ease of use.

    -   **Responsive Design Strategy**:
        -   Tailwind CSS utility classes are used extensively for responsive breakpoints (e.g., `md:` prefixes).
        -   Specific components or layouts are conditionally rendered or styled for mobile (`<768px`) vs. desktop views.

    -   **Header Area**:
        -   **Desktop**: Displays the Zettaz logo, screen title ("Point of Sale"), notification icon, sync status icon, and a user menu (initials icon with a logout option).
        -   **Mobile**: A simplified header shows the Zettaz logo on the left and the user menu (initials icon) on the right. Notification and sync icons are hidden to save space.

    -   **Main Content Area**:
        -   **Desktop**: Features a two-column layout. The left column contains the product search, category filters, and the scrollable `ProductGrid.tsx`. The right column displays the `Cart.tsx` component.
        -   **Mobile**: The `ProductGrid.tsx` (with product search and category filters above it) becomes the primary scrollable content, taking the full width available.

    -   **Mobile-Specific Navigation Elements (Normal Flow, Not Fixed Overlay)**:
        -   **Search and Cart Bar**: Positioned directly below the main scrollable content area (product grid). This bar includes:
            -   A search input field on the left.
            -   A cart icon (with an item count badge) on the right. Tapping this icon opens a full-screen mobile cart modal.
        -   **Final Footer Line**: The very last element on the mobile screen, appearing below the Search and Cart Bar. It displays " 2025 Zettaz Cloud" and "Terminal #1".

    -   **Footer Area**:
        -   **Desktop**: A standard footer displays copyright information, application version, terminal ID, and the last sync time.
        -   **Mobile**: The desktop footer is hidden. The essential information (copyright and terminal ID) is presented in the "Final Footer Line" described above.

    -   **Modals**: All modals (Add Customer, Customer Action, Held Orders, Payment, Mobile Cart) are structured to be available and functional on both desktop and mobile views, ensuring consistent access to all features.

- **UI Components**: Custom components with Tailwind CSS
- **Routing**: React Router
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MySQL 8.0+
- **Authentication**: JWT
- **API Documentation**: OpenAPI/Swagger (Note: The `/api/auth/login` endpoint is crucial for providing store-specific configurations like `tax_config` and `discount_application_rule` to the frontend upon successful user login.)

### Image and Static Asset Handling

The system handles image uploads for products and categories, storing them in specific server-side directories and making them accessible via defined URL paths.

**1. Product Images:**
   - **Storage Path (Server-side):** `backend/uploads/TENANT_ID/STORE_ID/`
   - **Filename Convention:** `timestamp_sanitizedOriginalName.webp` (e.g., `1678886400000_my_product_image.webp`)
   - **URL Path (Client-side):** `/uploads/TENANT_ID/STORE_ID/timestamp_sanitizedOriginalName.webp`
   - **Serving Mechanism:** Served via `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` middleware in `backend/server.js`.
   - **Processing:** Uploaded product images are processed (resized and converted to WebP format) using the `sharp` library before being saved.
   - **Dynamic Directory Creation:** Tenant and store-specific directories under `backend/uploads/` are created on-the-fly if they don't exist when an image is uploaded.

**2. Category Images:**
   - **Storage Path (Server-side):** `backend/public/uploads/categories/`
   - **Filename Convention:** `timestamp_sanitizedOriginalName.webp` (e.g., `1678886500000_electronics_category.webp`)
   - **URL Path (Client-side):** `/uploads/categories/timestamp_sanitizedOriginalName.webp`
   - **Serving Mechanism:** Files in `backend/public/uploads/categories/` are made accessible via the `/uploads/categories/` URL path. This is typically achieved if `backend/public/` is served at the root (e.g. `app.use(express.static('public'))`), making `public/uploads/categories/` map to `/uploads/categories/`.
   - **Processing:** Similar to product images, category images are processed to WebP.

**3. General Static Assets & Configuration:**
   - The `backend/server.js` configures static asset serving as follows:
     - `app.use(express.static('public'))`: Makes contents of the `public` directory (e.g., `backend/public/`) available at the root of the server's URL space. For instance, a file at `backend/public/robots.txt` would be accessible via `/robots.txt`.
     - `app.use('/images', express.static(path.join(__dirname, 'public/images')))`: Serves files from `backend/public/images/` specifically under the `/images/` URL path. (e.g., `backend/public/images/default_avatar.png` -> `/images/default_avatar.png`).
     - `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))`: Serves files from `backend/uploads/` (primarily for dynamic product images) specifically under the `/uploads/` URL path.
   - This layered setup allows for organized access to different types of static content, separating dynamically generated user content (like product images) from more static application assets (like default UI images or category images if stored in `public`).

### Database Schema

#### Products
```sql
CREATE TABLE products (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  barcode VARCHAR(100),
  sku VARCHAR(100),
  stock_quantity INT NOT NULL DEFAULT 0,
  category_id VARCHAR(36),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Sales
```sql
CREATE TABLE sales (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  store_id VARCHAR(36) NOT NULL,
  cashier_id VARCHAR(36) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status ENUM('completed', 'refunded', 'voided') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Stores (Relevant Columns for Discount/Tax Logic)
```sql
ALTER TABLE stores
  ADD COLUMN tax_config JSON COMMENT 'Stores tax configuration, e.g., {\"default_rate\": 0.10, \"rules\": []}',
  ADD COLUMN discount_application_rule VARCHAR(20) DEFAULT 'BEFORE_TAX' COMMENT 'Rule for applying discounts: BEFORE_TAX or AFTER_TAX';
```

Details:
-   `tax_config` (JSON): Stores the tax configuration for the store. A common structure is `{"default_rate": 0.05}` for a 5% tax. Can be extended for more complex rules.
-   `discount_application_rule` (VARCHAR): Determines if discounts are applied before tax calculation (`'BEFORE_TAX'`) or after tax calculation (`'AFTER_TAX'`).

## Project Structure

```
zettaz-cloud-enterprize/
├── backend/               # Backend server code
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Custom middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   ├── server.js         # Main server file
│   └── package.json
│
├── frontend/             # Frontend React application
│   ├── public/           # Static files
│   └── src/
│       ├── assets/      # Images, fonts, etc.
│       ├── components/   # Reusable components
│       ├── contexts/     # React contexts
│       ├── hooks/        # Custom hooks
│       ├── pages/        # Page components
│       ├── services/     # API services
│       ├── types/        # TypeScript types
│       ├── utils/        # Utility functions
│       ├── App.tsx       # Main App component
│       └── main.tsx      # Entry point
│
└── docs/                # Documentation
    ├── README.md
    ├── IMPLEMENTATION_PLAN.md
    ├── PROGRESS.md
    └── TECHNICAL.md
```

## Environment Variables

### Backend (.env)
```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=zettaz_pos
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=Zettaz POS
```

## Development Workflow

1. **Setup**
   ```bash
   # Install dependencies
   npm install
   
   # Set up environment variables
   cp .env.example .env
   
   # Start development servers
   npm run dev
   ```

2. **Branching Strategy**
   - `main` - Production-ready code
   - `develop` - Integration branch for features
   - `feature/*` - New features
   - `bugfix/*` - Bug fixes
   - `hotfix/*` - Critical production fixes

3. **Commit Message Format**
   ```
   type(scope): short description
   
   [optional body]
   ```
   
   Types:
   - feat: New feature
   - fix: Bug fix
   - docs: Documentation changes
   - style: Code style changes
   - refactor: Code refactoring
   - test: Adding tests
   - chore: Build process or tooling changes

## Testing

### Running Tests
```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd ../frontend
npm test
```

### Test Coverage
```bash
# Backend coverage
cd backend
npm run test:coverage

# Frontend coverage
cd ../frontend
npm run test:coverage
```

## Deployment

### Prerequisites
- Docker
- Docker Compose
- AWS/GCP account (for cloud deployment)

### Production Build
```bash
# Build Docker images
docker-compose -f docker-compose.prod.yml build

# Start containers
docker-compose -f docker-compose.prod.yml up -d
```

### Monitoring
- Application logs: `docker-compose logs -f`
- Database health: `docker-compose exec db mysqladmin ping`
- API health: `curl http://localhost:3000/health`

## Troubleshooting

### Common Issues
1. **Database Connection Issues**
   - Verify database is running
   - Check credentials in .env
   - Ensure correct port forwarding

2. **CORS Errors**
   - Verify frontend URL is in CORS whitelist
   - Check API base URL in frontend config

3. **Build Failures**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility
   - Verify all required environment variables are set

## Security Considerations

1. **Authentication**
   - Always use HTTPS in production
   - Implement rate limiting
   - Use secure, HTTP-only cookies for JWT

2. **Data Protection**
   - Encrypt sensitive data at rest
   - Implement proper input validation
   - Use parameterized queries to prevent SQL injection

3. **API Security**
   - Implement proper CORS policies
   - Validate all input
   - Implement proper error handling

## Performance Optimization

### Frontend
- Code splitting with React.lazy()
- Image optimization
- Memoization with React.memo and useMemo
- Virtualized lists for large datasets

### Backend
- Database indexing
- Query optimization
- Response caching
- Connection pooling

## Scaling

### Vertical Scaling
- Increase server resources (CPU, RAM)
- Optimize database queries
- Implement caching layer (Redis)

### Horizontal Scaling
- Load balancing
- Database read replicas
- Microservices architecture (future)

## Store ID Handling in Sales

### Current Situation (Workaround)
Currently, the Point of Sale (POS) system is configured to operate as if for a single, predefined store. When creating a sale, the `store_id` is hardcoded as a fallback in `frontend/src/services/salesService.ts` if it's not present in the `currentUser` object (which it currently isn't).

**Temporary Fallback Store ID:** `'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c'`

This was implemented to allow immediate testing of the checkout functionality, as the backend requires a valid UUID for `store_id` due to foreign key constraints with the `stores` table.

### Future Enhancement: Multi-Store Support & Proper `store_id` Handling
The current approach is a temporary measure. The long-term plan is to implement proper multi-store capabilities and robust `store_id` handling:

1.  **Backend API Enhancements:**
    *   The user authentication response (`/api/auth/login` or `/api/auth/me`) should include the `store_id` (or a list of accessible `store_ids`) associated with the authenticated user.
    *   If a user is associated with multiple stores, an API endpoint might be needed to allow the user to select an active store for the session.

2.  **Frontend Logic Updates:**
    *   The `currentUser` object (managed by `AuthContext` or similar) should store the `store_id` received from the backend.
    *   The `salesService.ts` should rely on `currentUser.store_id` to get the active store ID for sales transactions.
    *   The hardcoded fallback for `store_id` should be removed. Instead, if `store_id` is missing, the system should either:
        *   Prevent the sale and notify the user that store information is missing.
        *   Prompt the user to select a store (if they have access to multiple and none is set as default/active).

3.  **Database Considerations:**
    *   Ensure the `users` table (or a linking table like `user_stores`) correctly maps users to their accessible stores.

This enhancement will enable true multi-store functionality, allowing a single tenant to manage sales across multiple physical locations or sales channels, with transactions correctly attributed to each store.
