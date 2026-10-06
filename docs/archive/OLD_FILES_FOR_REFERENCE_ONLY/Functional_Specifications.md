# Functional Document: Zettaz Cloud POS

Date: 2025-05-23

## 1. POS Screen (`POSScreen.tsx`)

### 1.1. Overview
The POS screen is the primary interface for cashiers to conduct sales, manage products, and interact with customer and cart information. It is designed to be responsive, providing a tailored experience for both desktop and mobile devices.

### 1.2. Layout

#### 1.2.1. Desktop Layout
- **Header**: Displays the Zettaz logo, screen title ("Point of Sale"), notification icon, sync status icon, and user menu (initials icon with logout option).
- **Main Area**: Divided into two main vertical sections:
    - **Left Section (Product Area)**:
        - Search bar for products.
        - Category filter dropdown.
        - Grid display of products (`ProductGrid.tsx`). Each product card shows image, name, price, and an "Add to Cart" button.
    - **Right Section (Cart Area)**:
        - Displays the current cart contents (`Cart.tsx`).
        - Shows customer information (if selected) or a button to select/add a customer.
        - Lists cart items with quantity and price.
        - Displays subtotal, discount (if any), tax, and total.
        - Provides options for holding the order, applying discounts, and proceeding to payment.
- **Footer**: Displays copyright information, application version, terminal ID, and last sync time.

#### 1.2.2. Mobile Layout
- **Header**: Simplified header displaying the Zettaz logo (left) and user menu (initials icon, right). Notification and sync icons are hidden.
- **Main Content Area**:
    - The product grid (`ProductGrid.tsx`) is the primary scrollable content.
    - Category filter and search input are available above the product grid.
- **Search and Cart Bar**: A bar located below the main scrollable content area (product grid). It is a normal flow element. It contains:
    - A search input field on the left.
    - A cart icon (with item count badge) on the right, which opens a full-screen mobile cart modal.
- **Final Footer Line**: The last element on the screen, appearing below the Search and Cart Bar as a normal flow element. It displays "© 2025 Zettaz Cloud" and "Terminal #1".
- **Mobile Cart Modal**: A full-screen modal that slides in from the right, displaying the full cart contents and actions, similar to the desktop cart area.

### 1.3. Core Functionalities

#### 1.3.1. Product Management
- **View Products**: Products are displayed in a grid format.
- **Search Products**: Users can search for products using the search bar. The grid updates dynamically.
- **Filter by Category**: Users can filter products by selecting a category from a dropdown.

#### 1.3.2. Cart Management
- **Add to Cart**: Products can be added to the cart from the product grid.
- **View Cart**:
    - Desktop: Cart is always visible in the right panel.
    - Mobile: Cart is accessible via a cart icon in the Search and Cart Bar, opening a full-screen modal.
- **Cart Calculations**: Subtotal, discounts (if applicable), taxes (dynamic, item-level), and total are calculated and displayed.
- **Hold Order**: Current cart can be put on hold.
- **Recall Held Order**: Previously held orders can be recalled into the cart.

#### 1.3.3. Customer Management (via Modals)
- **Select Customer**: An existing customer can be associated with the current sale.
- **Add New Customer**: A new customer can be added to the system.

#### 1.3.4. Checkout Process
- **Initiate Payment**: From the cart (desktop panel or mobile modal), users can proceed to the payment modal to complete the sale.

#### 1.3.5. User Session
- **Logout**: Users can log out via the user menu in the header.

### 1.4. Context Dependencies
The POS Screen relies on several React Contexts for its data and functionality:
- `AuthContext`: Provides user authentication details, store configurations (like tax rules), and logout functionality.
- `InventoryContext`: Manages product and category data, including fetching and state (loading, errors).
- `CartContext`: Manages all aspects of the shopping cart, including items, customer information, calculations, and actions like adding items or holding orders.
- `ModalContext`: Manages the state (open/closed) of various modals used on the screen (e.g., `AddCustomerModal`, `CustomerActionModal`, `HeldOrdersModal`, `PaymentModal`).

### 1.5. Key UI Components Utilized
- `ProductGrid.tsx`: Displays products.
- `Cart.tsx`: Manages and displays cart details and actions.
- Various Modals: `AddCustomerModal.tsx`, `CustomerActionModal.tsx`, `HeldOrdersModal.tsx`, `PaymentModal.tsx` (via `ModalContext`).
