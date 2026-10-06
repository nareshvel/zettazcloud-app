# API Reference

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints (except `/auth/login`) require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

## API Endpoints

### Authentication

#### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "token": "jwt.token.here",
    "user": {
      "id": "user-123",
      "name": "John Doe",
      "email": "user@example.com",
      "role": "cashier",
      "tenant_id": "tenant-abc",
      "store_id": "store-xyz",
      "tax_config": {
        "default_rate": 0.10, 
        "rules": [] 
      },
      "discount_application_rule": "BEFORE_TAX" 
    }
  }
}
```

### Products

#### Get All Products
```http
GET /products
```

**Query Parameters:**
- `category` - Filter by category ID
- `search` - Search term
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "prod-123",
      "name": "Product Name",
      "description": "Product description",
      "price": 19.99,
      "stock_quantity": 100,
      "category_id": "cat-123",
      "created_at": "2025-05-20T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pages": 1,
    "limit": 20
  }
}
```

#### Create Product
```http
POST /products
```

**Request Body:**
```json
{
  "name": "New Product",
  "description": "Product description",
  "price": 29.99,
  "stock_quantity": 50,
  "category_id": "cat-123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "prod-124",
    "name": "New Product",
    "description": "Product description",
    "price": 29.99,
    "stock_quantity": 50,
    "category_id": "cat-123",
    "created_at": "2025-05-20T10:05:00Z"
  }
}
```

### Sales

#### Create Sale
```http
POST /sales
```

**Request Body:**
```json
{
  "items": [
    {
      "product_id": "prod-123",
      "quantity": 2,
      "price": 19.99
    }
  ],
  "subtotal": 39.98,
  "discount_value": 5.00,
  "discount_type": "fixed",
  "tax_amount": 4.00,
  "total_amount": 38.98,
  "payment_method_id": "e9ca7524-35f4-11f0-8297-525400148990",
  "tenant_id": "d7f267da-d5d9-4a15-b0d3-31ca710a4492",
  "store_id": "f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c",
  "cashier_id": "a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d",
  "customer_id": "cust-789",
  "amount_tendered": 50.00,
  "change_due": 11.02,
  "applied_tax_details": [
    {
      "taxClassName": "Standard Sales Tax",
      "taxRateName": "General Sales Tax",
      "taxRate": 0.0825,
      "taxAmount": 3.22,
      "taxableAmount": 38.98
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Sale created successfully",
  "data": {
    "saleId": "sale-uuid-generated-by-backend"
  }
}
```

#### Get Sales History
```http
GET /sales/history
```

**Query Parameters:**
- `start_date` - Start date (YYYY-MM-DD)
- `end_date` - End date (YYYY-MM-DD)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "sale-123",
      "total": 43.98,
      "payment_method": "card",
      "created_at": "2025-05-20T10:10:00Z",
      "items": [
        {
          "id": "item-123",
          "product_name": "Product Name",
          "quantity": 2,
          "price": 19.99
        }
      ]
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pages": 1,
    "limit": 20
  }
}
```

### Categories

#### Get All Categories
```http
GET /categories
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "cat-123",
      "name": "Electronics",
      "description": "Electronic items",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Cart

#### Get Cart
```http
GET /cart
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "item-123",
        "productId": "prod-123",
        "name": "Product Name",
        "quantity": 2,
        "price": 19.99,
        "subtotal": 39.98
      }
    ],
    "totalItems": 2,
    "subtotal": 39.98,
    "tax": 4.80,
    "total": 44.78
  }
}
```

#### Add Item to Cart
```http
POST /cart/items
```

**Request Body:**
```json
{
  "productId": "prod-123",
  "quantity": 1
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "item-123",
    "productId": "prod-123",
    "name": "Product Name",
    "quantity": 1,
    "price": 19.99,
    "subtotal": 19.99
  }
}
```

## Payment Endpoints

### Get Payment Methods
```http
GET /payment-methods
```

**Purpose:** Retrieves a list of all active payment methods configured for the tenant.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "e9ca7524-35f4-11f0-8297-525400148990",
      "tenant_id": "d7f267da-d5d9-4a15-b0d3-31ca710a4492",
      "name": "Cash",
      "code": "CASH",
      "is_active": true,
      "requires_terminal": false,
      "icon": "cash",
      "sort_order": 1,
      "created_at": "2025-05-21T03:37:25.000Z",
      "updated_at": "2025-05-21T03:37:25.000Z"
    },
    {
      "id": "e9ca75b4-35f4-11f0-8297-525400148990",
      "tenant_id": "d7f267da-d5d9-4a15-b0d3-31ca710a4492",
      "name": "Charge to Account",
      "code": "ON_ACCOUNT",
      "is_active": true,
      "requires_terminal": false,
      "icon": "Person",
      "sort_order": 4,
      "created_at": "2025-05-21T03:37:25.000Z",
      "updated_at": "2025-05-22T16:00:37.000Z"
    }
    // ... other payment methods
  ]
}
```

### Process Payment
```http
POST /payment/process
```

**Request Body:**
```json
{
  "saleId": "sale_123",
  "paymentMethodId": "pm_123",
  "amount": 44.78,
  "tenderAmount": 50.00,
  "terminalId": "term_123",
  "metadata": {
    "referenceNumber": "REF123456",
    "cardLast4": "4242",
    "cardType": "visa"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "transactionId": "txn_123",
    "saleId": "sale_123",
    "amount": 44.78,
    "change": 5.22,
    "status": "completed",
    "paymentMethod": {
      "id": "pm_123",
      "name": "Cash",
      "code": "CASH"
    },
    "processedAt": "2025-05-20T15:30:00Z"
  }
}
```

### Get Transaction
```http
GET /payment/transactions/:transactionId
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "txn_123",
    "saleId": "sale_123",
    "paymentMethodId": "pm_123",
    "terminalId": "term_123",
    "amount": 44.78,
    "currency": "USD",
    "status": "completed",
    "transactionId": "gateway_txn_123",
    "referenceId": "REF123456",
    "cardLast4": "4242",
    "cardType": "visa",
    "metadata": {
      "authCode": "AUTH123"
    },
    "createdAt": "2025-05-20T15:30:00Z",
    "updatedAt": "2025-05-20T15:30:05Z"
  }
}
```

### Refund Transaction
```http
POST /payment/refund
```

**Request Body:**
```json
{
  "transactionId": "txn_123",
  "amount": 10.00,
  "reason": "Customer return"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "ref_123",
    "originalTransactionId": "txn_123",
    "amount": 10.00,
    "status": "completed",
    "referenceId": "REFUND123",
    "processedAt": "2025-05-20T16:00:00Z"
  }
}
```

### Get Payment Settings
```http
GET /payment/settings
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "defaultCurrency": "USD",
    "allowPartialPayments": true,
    "allowTips": true,
    "defaultTipPercentage": 15.0,
    "receiptSettings": {
      "header": "Thank you for your purchase!",
      "footer": "Please visit us again!"
    }
  }
}
```

### Update Payment Settings
```http
PUT /payment/settings
```

**Request Body:**
```json
{
  "defaultCurrency": "USD",
  "allowPartialPayments": true,
  "allowTips": true,
  "defaultTipPercentage": 18.0,
  "receiptSettings": {
    "header": "Thank you for shopping with us!",
    "footer": "Have a great day!"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "defaultCurrency": "USD",
    "allowPartialPayments": true,
    "allowTips": true,
    "defaultTipPercentage": 18.0,
    "receiptSettings": {
      "header": "Thank you for shopping with us!",
      "footer": "Have a great day!"
    },
    "updatedAt": "2025-05-20T16:30:00Z"
  }
}
```

## Tax Configuration

### Get All Tax Classes
```http
GET /tax-classes
```

**Purpose:** Retrieves a list of all tax classes configured for the tenant.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "92bd6f00-36f9-11f0-8297-525400148990",
      "tenantId": "d7f267da-d5d9-4a15-b0d3-31ca710a4492",
      "name": "Standard Sales Tax",
      "is_active": true,
      "is_default": true,
      "created_at": "2025-05-22T10:43:18.000Z",
      "updated_at": "2025-05-22T10:43:18.000Z"
    }
    // ... other tax classes
  ]
}
```

### Get Tax Rates for a Tax Class
```http
GET /tax-class-rates/:classId
```

**Path Parameters:**
- `classId` (string, UUID): The ID of the tax class for which to retrieve rates.

**Purpose:** Retrieves all active tax rates associated with a specific tax class.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "92bfa003-36f9-11f0-8297-525400148990",
      "taxClassId": "92bd6f00-36f9-11f0-8297-525400148990",
      "taxRateName": "General Sales Tax",
      "rate": 0.0825,
      "priority": 0,
      "is_compound": false,
      "is_active": true,
      "created_at": "2025-05-22T10:43:18.000Z",
      "updated_at": "2025-05-22T10:43:18.000Z"
    }
    // ... other tax rates for the class
  ]
}
```

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Product not found"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

## Rate Limiting
- 100 requests per minute per IP address
- Additional requests will receive a 429 status code

## Versioning
API versioning is handled through the URL path:
```
/api/v1/endpoint
```

## Webhooks
### Available Events
- `sale.completed` - Triggered when a sale is completed
- `inventory.low` - Triggered when inventory is low

### Webhook Payload Example
```json
{
  "event": "sale.completed",
  "data": {
    "sale_id": "sale-123",
    "total": 43.98,
    "items": [
      {
        "product_id": "prod-123",
        "quantity": 2,
        "price": 19.99
      }
    ]
  },
  "timestamp": "2025-05-20T10:15:00Z"
}
```

## Changelog

### v1.0.0 (2025-05-20)
- Initial release
- Basic CRUD operations for products and categories
- Sales processing
- Authentication system

## Deprecation Policy
- Endpoints will be marked as deprecated in the documentation at least 3 months before removal
- Deprecated endpoints will continue to work for 6 months after deprecation notice
- Breaking changes will result in a new API version

## Frontend Component Reference (as of 2025-05-23)

This section details key frontend components, their props, state, and context interactions.

### 1. `POSScreen.tsx`

-   **Location**: `frontend/src/pages/POSScreen.tsx`
-   **Purpose**: Main screen for Point of Sale operations. Handles product display, cart management, customer interactions, and navigation between different POS states.

-   **Key Props**: None directly, as it's a top-level page component.

-   **Internal State Variables (Illustrative examples, not exhaustive)**:
    -   `searchTerm`: `string` - For product search input.
    -   `selectedCategoryId`: `string | null` - For category filter.
    -   `isMobileView`: `boolean` - Tracks if the view is mobile-sized.
    -   `isMobileCartOpen`: `boolean` - Controls visibility of the full-screen mobile cart modal.
    -   `isAddCustomerModalOpen`, `isCustomerActionModalOpen`, `isHeldOrdersModalOpen`: `boolean` - Control visibility of respective modals (though often managed via `ModalContext`).
    -   `currentTime`: `Date` - For displaying sync time.

-   **Context Usage**:
    -   **`useAuth()` (`AuthContext`)**: 
        -   Accesses `currentUser` for user details, `tenant_id`, `store_id`, and store-specific configurations (`tax_config`, `discount_application_rule`).
        -   Uses `logout()` function.
    -   **`useInventory()` (`InventoryContext`)**: 
        -   Accesses `inventory`, `categories`, `inventoryLoading`, `inventoryError`.
        -   Uses `fetchInventoryData()`, `fetchCategoriesData()`.
    -   **`useCart()` (`CartContext`)**: 
        -   Accesses `cartContext.items`, `cartContext.selectedCustomer`, `cartContext.totalItems`, etc.
        -   Uses various cart manipulation functions from the context (e.g., `addItemToCart`, `holdOrder`, `setSelectedCustomer`).
    -   **`useModal()` (`ModalContext`)**: 
        -   Accesses modal states (e.g., `isPaymentModalOpen`).
        -   Uses functions to open/close modals (e.g., `openPaymentModal`, `closePaymentModal`, `openCustomerActionModal`).

-   **Key Child Components Rendered**:
    -   `ProductGrid.tsx`: Displays products based on search/filter.
    -   `Cart.tsx`: Displays cart details and actions.
    -   `AddCustomerModal.tsx`, `CustomerActionModal.tsx`, `HeldOrdersModal.tsx`, `PaymentModal.tsx` (conditionally rendered based on modal states).

-   **Core Responsibilities**:
    -   Orchestrating the display of products and cart information.
    -   Handling user input for search and filtering.
    -   Managing the visibility and interaction with various modals (customer, held orders, payment).
    -   Providing a responsive layout for desktop and mobile views, including specific mobile navigation elements (search/cart bar, final footer line).

### 2. `Cart.tsx`

-   **Location**: `frontend/src/components/pos/Cart.tsx`
-   **Purpose**: Displays the contents of the shopping cart, calculates totals, and provides actions like customer selection, discount application, holding orders, and proceeding to checkout.

-   **Key Props**:
    -   `selectedCustomer`: `Customer | null` - The currently selected customer for the cart.
    -   `onSelectCustomerClick`: `() => void` - Callback to open the customer selection/action modal.
    -   `onViewHeldOrders`: `() => void` - Callback to open the held orders modal.
    -   `onCheckoutSuccess`: `() => void` - Callback executed after a successful checkout.
    -   `isMobileView`: `boolean` - (Currently has a lint warning for being unused) Intended to indicate if the cart is being rendered in a mobile context, potentially for layout adjustments.

-   **Context Usage**:
    -   **`useCart()` (`CartContext`)**: Extensive usage to access and modify cart state (`items`, `subtotal`, `discountValue`, `taxAmount`, `totalAmount`, `appliedDiscount`, `appliedTaxDetails`), and to call cart functions (`updateItemQuantity`, `removeItemFromCart`, `applyDiscount`, `clearDiscount`, `checkout`, `holdOrder`).
    -   **`useAuth()` (`AuthContext`)**: Accesses `currentUser` for store configurations (`tax_config`, `discount_application_rule`) used in displaying tax/discount information and calculations.
    -   **`useModal()` (`ModalContext`)**: Uses `openPaymentModal()` to initiate the checkout process.

-   **Core Responsibilities**:
    -   Rendering list of items in the cart with quantities and prices.
    -   Displaying subtotal, discount, tax, and final total, respecting store's discount application rule.
    -   Allowing quantity adjustments and item removal.
    -   Displaying selected customer or providing an option to select/add one.
    -   Handling discount application (fixed or percentage).
    -   Initiating the payment process.
    -   Providing an option to hold the current order.

### 3. `ProductGrid.tsx`

-   **Location**: `frontend/src/components/pos/ProductGrid.tsx`
-   **Purpose**: Displays a grid of available products, allowing users to add them to the cart.

-   **Key Props**:
    -   `products`: `Product[]` - Array of products to display.
    -   `onAddToCart`: `(product: Product) => void` - Callback when a product's "Add to Cart" button is clicked.
    -   `isLoading`: `boolean` - Indicates if products are currently being loaded.
    -   `error`: `string | null` - Displays an error message if product fetching failed.

-   **Context Usage**: Minimal direct context usage; primarily receives data via props from `POSScreen.tsx`.

-   **Core Responsibilities**:
    -   Rendering individual product cards (image, name, price).
    -   Handling the "Add to Cart" action for each product.
    -   Displaying loading or error states related to product fetching.
