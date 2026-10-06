# Codebase Structure

This document outlines the organization of the Zettaz Cloud Enterprise codebase, explaining the structure of both the frontend and backend components, as well as the key files and naming conventions used.

## Project Root Structure

The Zettaz Cloud Enterprise project is organized into several top-level directories:

```
zettaz-cloud-enterprize/
├── backend/             # Node.js/Express backend
├── frontend/            # React frontend
├── database/            # Database schema and migrations
├── docs/                # Project documentation
└── README.md            # Project root README
```

## Backend Structure

The backend is a Node.js/Express.js application organized according to the MVC (Model-View-Controller) pattern:

```
backend/
├── config/              # Configuration files
├── controllers/         # Business logic controllers
├── middleware/          # Express middleware
├── migrations/          # Database migration scripts
├── models/              # Data models
├── public/              # Static files
├── routes/              # API route definitions
├── scripts/             # Utility scripts
├── tests/               # Test files
├── uploads/             # File upload storage
├── utils/               # Utility functions
├── server.js            # Main application entry point
├── package.json         # Dependencies and scripts
└── .env                 # Environment variables (not in repository)
```

### Key Backend Directories

#### `config/`

Contains configuration files for different aspects of the application, such as database connections, authentication, and environment-specific settings.

#### `controllers/`

Contains controller modules that implement the business logic. Each module typically corresponds to a specific feature or entity:

- `authController.js` - Authentication logic
- `productController.js` - Product management
- `categoryController.js` - Category management
- `purchaseOrderController.js` - Purchase order handling
- `grnController.js` - Goods Received Notes processing
- `salesController.js` - Sales transactions
- etc.

#### `middleware/`

Contains Express middleware functions:

- `auth.js` - Authentication middleware
- `errorHandler.js` - Global error handling
- `tenantMiddleware.js` - Multi-tenancy enforcement
- `validation.js` - Request validation
- etc.

#### `models/`

Contains data models that represent the database schema, although the application uses direct SQL queries rather than an ORM.

#### `routes/`

Contains API route definitions that map HTTP endpoints to controller functions:

- `authRoutes.js`
- `productRoutes.js`
- `categoryRoutes.js`
- `purchaseOrderRoutes.js`
- `grnRoutes.js`
- `salesRoutes.js`
- etc.

#### `utils/`

Contains utility functions and helpers:

- `database.js` - Database connection and transaction utilities
- `fileUpload.js` - File upload handling
- `logger.js` - Logging utilities
- `validation.js` - Input validation helpers
- etc.

## Frontend Structure

The frontend is a React application using TypeScript:

```
frontend/
├── public/              # Public static assets
├── src/                 # Source code
│   ├── api/             # API client integration
│   ├── components/      # React components
│   ├── contexts/        # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── i18n/            # Internationalization resources
│   ├── lib/             # Third-party library integrations
│   ├── pages/           # Page components
│   ├── services/        # Service layer for API communication
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main application component
│   ├── index.tsx        # Application entry point
│   └── vite-env.d.ts    # Vite environment declarations
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite build configuration
```

### Key Frontend Directories

#### `src/components/`

Contains reusable React components organized by feature or module:

```
components/
├── common/              # Common UI components
├── inventory/           # Inventory-related components
├── pos/                 # Point of Sale components
├── purchase/            # Purchase order components
├── goods-receiving/     # GRN-related components
├── auth/                # Authentication components
├── layout/              # Layout components (header, sidebar, etc.)
└── ui/                  # Base UI components
```

#### `src/contexts/`

Contains React context providers for state management:

- `AuthContext.tsx` - Authentication state
- `CartContext.tsx` - Shopping cart state
- `NotificationContext.tsx` - Notification system
- etc.

#### `src/pages/`

Contains page-level components that correspond to different routes in the application:

- `LoginPage.tsx`
- `DashboardPage.tsx`
- `ProductsPage.tsx`
- `CategoriesPage.tsx`
- `PurchaseManagementPage.tsx`
- `GoodsReceivingPage.tsx`
- `POSScreen.tsx`
- etc.

#### `src/services/`

Contains service modules that handle communication with the backend API:

- `authService.ts`
- `productService.ts`
- `categoryService.ts`
- `purchaseOrderService.ts`
- `grnService.ts`
- `salesService.ts`
- etc.

#### `src/types/`

Contains TypeScript type definitions for the application:

- `auth.types.ts`
- `product.types.ts`
- `category.types.ts`
- `purchase.types.ts`
- `grn.types.ts`
- `sales.types.ts`
- etc.

## Naming Conventions

### Backend Naming Conventions

- **Files**: camelCase for files (`productController.js`, `authMiddleware.js`)
- **Directories**: lowercase with hyphens for multi-word directories (`user-profiles`)
- **Functions**: camelCase (`getProductById`, `createPurchaseOrder`)
- **Variables**: camelCase (`productId`, `orderStatus`)
- **SQL Columns**: snake_case (`product_id`, `order_status`)
- **Database Tables**: snake_case, plural (`products`, `purchase_orders`)

### Frontend Naming Conventions

- **Component Files**: PascalCase (`ProductCard.tsx`, `OrderTable.tsx`)
- **Context Files**: PascalCase followed by "Context" (`AuthContext.tsx`)
- **Hook Files**: camelCase, prefixed with "use" (`useAuth.ts`, `useProducts.ts`)
- **Service Files**: camelCase, suffixed with "Service" (`productService.ts`)
- **Type Files**: camelCase, suffixed with "types" (`product.types.ts`)
- **CSS Modules**: Same name as the component, suffixed with `.module.css`
- **Unit Test Files**: Same name as the file being tested, suffixed with `.test.ts` or `.test.tsx`

## Module Organization

The codebase follows a feature-based organization where related files for a specific feature are grouped together:

### Backend Module Example (GRN)

- `controllers/grnController.js` - GRN business logic
- `routes/grnRoutes.js` - GRN API endpoints
- `middleware/grnValidation.js` - GRN-specific validation rules

### Frontend Module Example (GRN)

- `components/goods-receiving/AddGoodsReceivedModal.tsx` - GRN creation modal
- `pages/GoodsReceivingPage.tsx` - GRN listing and management page
- `services/grnService.ts` - GRN API communication
- `types/grn.types.ts` - GRN TypeScript types

## Key Files

### Backend Key Files

- `server.js` - Application entry point, sets up Express server and middleware
- `config/database.js` - Database connection configuration
- `middleware/auth.js` - Authentication middleware
- `middleware/tenantMiddleware.js` - Multi-tenancy middleware

### Frontend Key Files

- `src/App.tsx` - Main application component with routing
- `src/contexts/AuthContext.tsx` - Authentication state provider
- `src/services/api.ts` - Base API client configuration
- `src/components/layout/AppLayout.tsx` - Main application layout

## Shared Code

Code that is shared between different parts of the application is organized in the following locations:

### Backend Shared Code

- `utils/` - General utility functions
- `middleware/` - Common middleware
- `config/` - Shared configuration

### Frontend Shared Code

- `components/common/` - Reusable UI components
- `utils/` - Utility functions
- `hooks/` - Reusable React hooks
- `contexts/` - Shared state management

## Conclusion

Understanding the codebase structure is essential for efficient development and maintenance. This organization helps maintain separation of concerns, enables code reuse, and facilitates collaboration between team members working on different features.
