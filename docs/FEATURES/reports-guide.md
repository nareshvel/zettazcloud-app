**Instructions for AI Agent: Creating Reports Page for Point of Sale (POS) Application**

**Objective:**
Design and implement a comprehensive **Reports Center Page** for a Point of Sale (POS) application. The page should provide detailed insights into sales, products, payments, and user activities to aid business decision-making. This will serve as a **single unified interface** for accessing all reports.

---

**1. General Requirements:**

* Responsive and user-friendly interface.
* Adhere to modern UI/UX design standards.
* Built using React for frontend, connected to a backend via API (assume NestJS).
* All data should be filterable by date range, store location (if multi-store), and user.
* **Prepare the system to accommodate Role-Based Access Control (RBAC)** in future phases. Design report accessibility to be permission-based, even if roles/permissions are not implemented yet.

---

**2. Reports Center Page Layout:**

**Unified Dashboard View:**

* Display all report categories on a single page using cards, tabs, or collapsible sections.
* Each card includes:

  * Report Title
  * Short Description
  * "View Report" button

**Report Categories:**

**A. Sales Reports**

* Daily, Weekly, Monthly Sales
* Sales by Product
* Sales by Category
* Sales by Payment Method
* Top-Selling Products
* Sales Returns

**B. Inventory Reports**

* Current Stock Levels
* Low Stock Alerts
* Stock Movement (In/Out)
* Expired/Expiring Items

**C. Payments & Transactions**

* Payment Summary (Cash, Card, UPI, Wallet, etc.)
* Transaction Volume
* Refunds and Voided Transactions
* Discounts Applied

**D. User Activity Reports**

* Sales by User/Cashier
* Shift Reports (Opening, Closing Balance)
* Login Activity

**E. Custom Reports**

* User-defined filters to generate ad hoc reports.
* Export options (PDF, Excel, CSV).

---

**3. Filters & Controls:**

* Global filters on top or in sidebar:

  * Date range picker
  * Store/location selector
  * Cashier/user selector
  * Product/category dropdown
* Export and Print buttons on individual report views

---

**4. Navigation & UX:**

* Use breadcrumbs (e.g., `Reports > Sales > Daily Sales`) to show navigation path.
* Clicking "View Report" opens the report within the same page (drawer, modal, or inline panel).
* Allow search functionality to find reports quickly.
* Enable favoriting/pinning frequently used reports.
* Add empty state messages with guidance if no data is found.

---

**5. Design Considerations:**

* Use tables, graphs, and charts for better visualization (e.g., bar, line, pie charts).
* Use color-coded indicators for critical insights (e.g., low stock, high returns).
* Enable data drill-down (click to view more details).
* Dashboard-style summary view with KPIs.

---

**6. Technical Notes:**

* Use React with Tailwind CSS or any component library for clean design.
* Use Chart.js or Recharts for charts.
* API endpoints should be designed for efficient querying and pagination.
* Prepare backend to support exporting large datasets.
* Modular design to accommodate future RBAC integration.

---

**NEW SECTION: Frontend Implementation Plan**

**A. Directory Structure (within `frontend/src/`)**

*   **`pages/reports/`**:
    *   `ReportsCenter.tsx`: Main dashboard for all report categories.
    *   `SalesReport.tsx`: Displays various sales-related reports (Daily, Weekly, By Product, etc.).
    *   `InventoryReportPage.tsx`: (Future) For inventory reports.
    *   `PaymentReportPage.tsx`: (Future) For payment reports.
    *   `UserActivityReportPage.tsx`: (Future) For user activity reports.
    *   `CustomReportPage.tsx`: (Future) For building and viewing custom reports.
*   **`components/reports/`**:
    *   `ReportCard.tsx`: Reusable card component for `ReportsCenter.tsx`.
    *   `DateRangePicker.tsx`: Global/local date range filter component.
    *   `ReportFilterControls.tsx`: Component for other filters (store, user, product).
    *   `ReportTable.tsx`: Reusable component for displaying tabular report data with sorting and pagination.
    *   `ReportChart.tsx`: Wrapper for chart library (e.g., Recharts) to display various chart types.
    *   `ReportPageLayout.tsx`: (Optional) A layout component for individual report pages, including breadcrumbs and common controls.
*   **`services/reportsService.ts`**:
    *   Functions for fetching data for different reports from the backend API.
    *   Handles API request construction, including filters and pagination parameters.
*   **`contexts/ReportContext.tsx`**: (Optional, consider if global state for filters or complex shared data becomes necessary)
    *   Manages shared state for global filters or complex report configurations.
*   **`types/reports.ts`**: (Or extend existing `types/index.ts`)
    *   TypeScript interfaces for report data structures (e.g., `SalesSummary`, `InventoryItemReport`, `PaymentTransaction`).

**B. Key Components & Functionality**

1.  **`ReportsCenter.tsx`**:
    *   Uses `ReportCard` to display links to different report categories.
    *   Navigation handled by `react-router-dom`.
2.  **Individual Report Pages (e.g., `SalesReport.tsx`)**:
    *   Will likely use sub-routes or internal tabs/sections to display different views (e.g., Daily Sales, Sales by Product).
    *   Integrates `DateRangePicker` and `ReportFilterControls`.
    *   Uses `ReportTable` and `ReportChart` to display data.
    *   Fetches data via `reportsService.ts`.
    *   Handles loading states and empty states.
3.  **`ReportFilterControls.tsx`**:
    *   Provides dropdowns/selectors for Store, User, Product/Category.
    *   State managed locally or via context.
    *   Triggers data refetch on filter change.
4.  **`ReportTable.tsx`**:
    *   Accepts data and column definitions.
    *   Implements client-side or server-side pagination and sorting.
    *   Option for "Export to CSV/Excel" (client-side generation or backend-assisted).
5.  **`ReportChart.tsx`**:
    *   Accepts data and chart type (bar, line, pie).
    *   Configurable options for labels, tooltips, etc.

**C. State Management**

*   Simple reports: Local component state (`useState`, `useEffect`) for filters, data, loading.
*   Complex reports / Global Filters: Consider `ReportContext` or a more robust state management library if shared state becomes extensive.
*   Filters will trigger API calls to `reportsService.ts` to fetch updated data.

**D. Routing (in `App.tsx`)**

*   `/reports`: Main reports center.
*   `/reports/sales`: Sales reports page (further sub-navigation internally).
*   `/reports/inventory`: Inventory reports page.
*   `/reports/payments`: Payment reports page.
*   `/reports/user-activity`: User activity reports page.
*   `/reports/custom`: Custom reports page.

---

**NEW SECTION: Task Checklist (Frontend - Phase 1 & Initial Scaffolding)**

**Phase 1: Planning & Initial Setup (Current Focus)**

*   [x] Analyze existing modules and routing for Reports page integration.
*   [x] Review `reports-guide.md` for requirements.
*   [x] Review database schema for relevant tables.
*   [x] Create `frontend/src/pages/reports/` directory.
*   [x] Create `ReportsCenter.tsx` as the main dashboard.
*   [x] Move existing sales report logic to `SalesReport.tsx`.
*   [x] Update `App.tsx` routing for `/reports` (to `ReportsCenter`) and `/reports/sales` (to `SalesReport`).
*   [ ] **(Current Task)** Update `reports-guide.md` with Frontend Implementation Plan and Task Checklist.
*   [ ] Define basic TypeScript types for Sales Report data in `types/reports.ts` or `types/index.ts`.
*   [ ] Create placeholder files for other main report pages:
    *   `InventoryReportPage.tsx`
    *   `PaymentReportPage.tsx`
    *   `UserActivityReportPage.tsx`
    *   `CustomReportPage.tsx`
*   [ ] Add routes in `App.tsx` for these placeholder pages.
*   [ ] Create basic `reportsService.ts` with a placeholder function for fetching sales data.

**Phase 2: Sales Report - Detailed Implementation**

*   [ ] Implement `DateRangePicker.tsx` component.
*   [ ] Integrate `DateRangePicker` into `SalesReport.tsx`.
*   [ ] Implement `ReportFilterControls.tsx` (initially for any sales-specific filters like payment method, if applicable).
*   [ ] Integrate `ReportFilterControls` into `SalesReport.tsx`.
*   [ ] Implement `ReportTable.tsx` component.
*   [ ] Display sales transaction data in `SalesReport.tsx` using `ReportTable`.
*   [ ] Implement `ReportChart.tsx` component (using Recharts or Chart.js).
*   [ ] Display a sales trend chart in `SalesReport.tsx` using `ReportChart`.
*   [ ] Connect `SalesReport.tsx` to `reportsService.ts` to fetch actual sales data (requires backend API endpoint).
*   [ ] Implement loading states and empty states for `SalesReport.tsx`.
*   [ ] Add "Export CSV" functionality to `SalesReport.tsx`.

**Phase 3: Inventory Reports (and subsequent modules)**

*   *Tasks to be detailed when starting this phase, similar to Sales Report.*

**General Tasks (Ongoing)**

*   [ ] Ensure responsive design for all report components.
*   [ ] Implement UI/UX best practices (breadcrumbs, clear navigation).
*   [ ] Write unit/integration tests for key components and services.
*   [ ] Prepare for RBAC by designing components to easily accept/check permissions in the future.

---

**7. Security & Performance:**

* Ensure API access for reports is designed to later support permission checks.
* Optimize report loading with lazy loading and caching if needed.
* Secure API handling for report data.

---

**8. Future Enhancements (Optional):**

* Scheduled email reports.
* Save and reuse custom report templates.
* Real-time data updates via websockets.
* Full Role-Based Access Control (RBAC) integration for report permissions.

---

End of Document.
