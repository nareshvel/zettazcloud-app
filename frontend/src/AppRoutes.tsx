import React, { Suspense } from 'react';
import AppLayout from './components/layout/AppLayout';
import IndustryAwareLayout from './components/layout/IndustryAwareLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SALES_HUB_INDUSTRIES } from './utils/salesHubIndustries';
import IndustryRoute from './components/common/IndustryRoute';

// Eager: the three login-landing surfaces (Login.tsx getRedirectPath sends
// cashiers to /pos or /sales-hub, admins to /admin|/dashboard) — keep them in
// the main chunk so the first screen never flashes a loader.
import Dashboard from './pages/Dashboard';
import Pos from './pages/POSScreen';
import SalesHubPage from './pages/SalesHubPage';

// Lazy: everything else. This is what brings the 4.4MB main chunk down —
// heavy deps like exceljs/jspdf only load when a page that needs them is
// actually visited.
const Orders = React.lazy(() => import('./pages/OrdersPage'));
const Products = React.lazy(() => import('./pages/ProductsPage'));
const Customers = React.lazy(() => import('./pages/CustomersPage'));
const Suppliers = React.lazy(() => import('./pages/SuppliersPage'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Promotions = React.lazy(() => import('./pages/PromotionalOffersPage'));
const ApplyPromotionalOffersPage = React.lazy(() => import('./pages/ApplyPromotionalOffersPage'));
const GoodsReceiving = React.lazy(() => import('./pages/GoodsReceivingPage'));
const PurchaseOrders = React.lazy(() => import('./pages/PurchaseManagementPage'));
// `Inventory` (./pages/Inventory) intentionally unused — see the removed-route comment below.
const UserProfilePage = React.lazy(() => import('./pages/UserProfilePage'));
const RolesManagementPage = React.lazy(() => import('./pages/RolesManagementPage'));
const RolesDebugPage = React.lazy(() => import('./pages/RolesDebugPage'));
const SettingsPayments = React.lazy(() => import('./pages/SettingsPayments'));
const SalesReturnPage = React.lazy(() => import('./pages/SalesReturnPage'));
const EmployeesPage = React.lazy(() => import('./pages/EmployeesPage'));
const RepairsPage = React.lazy(() => import('./pages/RepairsPage'));
const OldGoldPage = React.lazy(() => import('./pages/OldGoldPage'));
const SerializedInventoryPage = React.lazy(() => import('./pages/SerializedInventoryPage'));
const MemoPage = React.lazy(() => import('./pages/MemoPage'));
const LayawayPage = React.lazy(() => import('./pages/LayawayPage'));
const SavingsSchemesPage = React.lazy(() => import('./pages/SavingsSchemesPage'));
const MetalRatesPage = React.lazy(() => import('./pages/MetalRatesPage'));
const CatalogSyncPage = React.lazy(() => import('./pages/CatalogSyncPage'));
const JewelryValuationReport = React.lazy(() => import('./pages/reports/JewelryValuationReport'));
const CycleCountPage = React.lazy(() => import('./pages/CycleCountPage'));
const StockCountPage = React.lazy(() => import('./pages/StockCountPage'));
const ExpensesPage = React.lazy(() => import('./pages/ExpensesPage'));
const PaymentsPage = React.lazy(() => import('./pages/PaymentsPage'));
const PrintJobHistory = React.lazy(() => import('./pages/PrintJobHistory'));
const PrintTemplateDesigner = React.lazy(() => import('./pages/PrintTemplateDesigner'));
const CustomerDetailsPage = React.lazy(() => import('./pages/CustomerDetailsPage'));

// New Reports Structure
const ReportsLayout = React.lazy(() => import('./pages/reports'));
const ReportsCenter = React.lazy(() => import('./pages/reports/ReportsCenter'));
const SalesReport = React.lazy(() => import('./pages/reports/SalesReport'));
const InventoryReportPage = React.lazy(() => import('./pages/reports/InventoryReportPage'));
const PaymentReportPage = React.lazy(() => import('./pages/reports/PaymentReportPage'));
const UserActivityReportPage = React.lazy(() => import('./pages/reports/UserActivityReportPage'));
const CustomerValueReportPage = React.lazy(() => import('./pages/reports/CustomerValueReportPage'));
const ChargeAccountReportPage = React.lazy(() => import('./pages/reports/ChargeAccountReportPage'));
const TaxCollectedReport = React.lazy(() => import('./pages/reports/TaxCollectedReport'));
const SalesReturnsReport = React.lazy(() => import('./pages/reports/SalesReturnsReport'));
const EmployeePerformanceReport = React.lazy(() => import('./pages/reports/EmployeePerformanceReport'));
const CategorySalesReport = React.lazy(() => import('./pages/reports/CategorySalesReport'));

// System-admin console (/system/*) — platform staff only, enforced both by
// SystemRoute here and by platform.* permission checks on every API call.
const SystemLayout = React.lazy(() => import('./components/system/SystemLayout'));
const SystemRoute = React.lazy(() => import('./components/system/SystemRoute'));
const SystemDashboard = React.lazy(() => import('./pages/system/Dashboard'));
const SystemTenants = React.lazy(() => import('./pages/system/Tenants'));
const SystemSubscriptions = React.lazy(() => import('./pages/system/Subscriptions'));
const SystemPlans = React.lazy(() => import('./pages/system/Plans'));
const SystemUsers = React.lazy(() => import('./pages/system/Users'));
const SystemRbac = React.lazy(() => import('./pages/system/Rbac'));
const SystemSupport = React.lazy(() => import('./pages/system/Support'));
const SystemAnnouncements = React.lazy(() => import('./pages/system/Announcements'));
const SystemAudit = React.lazy(() => import('./pages/system/Audit'));
const SystemHealth = React.lazy(() => import('./pages/system/Health'));

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <span className="loading loading-spinner loading-lg" aria-label="Loading page" />
  </div>
);

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* Fullscreen routes without AppLayout — the counter's own screens,
          no sidebar/topbar chrome. Sales staff land directly on one of these
          from login (see Login.tsx's getRedirectPath) and never need the
          admin shell to do their job. */}
      <Route path="pos" element={<Pos />} />
      <Route path="sales-hub" element={
        <IndustryRoute allow={[...SALES_HUB_INDUSTRIES]}><SalesHubPage /></IndustryRoute>
      } />

      {/* Sales-Hub-only routes for jewelry, ordinary sidebar routes for
          every other industry — same route, chrome decided at runtime by
          IndustryAwareLayout. See its file header for why this can't just be
          two separate routes. Repairs keeps its existing IndustryRoute guard
          (jewelry + electronics) — electronics tenants have no Sales Hub, so
          they still reach it through AppLayout's sidebar via that same
          route; IndustryAwareLayout only swaps chrome, IndustryRoute still
          decides who's allowed on the page at all. */}
      <Route element={<IndustryAwareLayout />}>
        <Route path="orders" element={<Orders />} />
        <Route path="sales-return" element={<SalesReturnPage />} />
        <Route path="repairs" element={
          <IndustryRoute allow={['jewelry', 'electronics']}><RepairsPage /></IndustryRoute>
        } />
        <Route path="old-gold" element={
          <IndustryRoute allow={['jewelry']}><OldGoldPage /></IndustryRoute>
        } />
        <Route path="savings-schemes" element={
          <IndustryRoute allow={['jewelry']}><SavingsSchemesPage /></IndustryRoute>
        } />
        <Route path="layaways" element={
          <IndustryRoute allow={['jewelry']}><LayawayPage /></IndustryRoute>
        } />
        <Route path="memos" element={<MemoPage />} />
      </Route>

      {/* Routes with AppLayout (sidebar and top bar) */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} /> {/* Root path */}
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="admin" element={<Dashboard />} />
        <Route path="products/*" element={<Products />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetailsPage />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="team" element={<EmployeesPage />} />
        <Route path="team/roles" element={<RolesManagementPage />} />
        <Route path="employees" element={<Navigate to="/team" replace />} />
        {/* Industry-specific modules — guarded so a bookmarked URL redirects.
            The backend enforces the same rule via requireIndustry middleware. */}
        <Route path="serialized-inventory" element={
          <IndustryRoute allow={['jewelry', 'electronics']}><SerializedInventoryPage /></IndustryRoute>
        } />
        <Route path="cycle-count" element={
          <IndustryRoute allow={['jewelry', 'electronics']}><CycleCountPage /></IndustryRoute>
        } />
        <Route path="stock-count" element={<StockCountPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="catalog-channels" element={<CatalogSyncPage />} />
        <Route path="metal-rates" element={
          <IndustryRoute allow={['jewelry']}><MetalRatesPage /></IndustryRoute>
        } />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/payments" element={<SettingsPayments />} />
        <Route path="print-templates" element={<PrintTemplateDesigner />} />
        <Route path="profile" element={<UserProfilePage />} />
        
        {/* Updated Reports Routing */}
        <Route path="reports" element={<ReportsLayout />}>
          <Route index element={<ReportsCenter />} />
          <Route path="sales" element={<SalesReport />} />
          <Route path="inventory" element={<InventoryReportPage />} />
          <Route path="payments" element={<PaymentReportPage />} />
          <Route path="user-activity" element={<UserActivityReportPage />} />
          <Route path="customer-value" element={<CustomerValueReportPage />} />
          <Route path="charge-accounts" element={<ChargeAccountReportPage />} />
          <Route path="jewelry-valuation" element={
            <IndustryRoute allow={['jewelry']}><JewelryValuationReport /></IndustryRoute>
          } />
          <Route path="tax" element={<TaxCollectedReport />} />
          <Route path="returns" element={<SalesReturnsReport />} />
          <Route path="employee-performance" element={<EmployeePerformanceReport />} />
          <Route path="category-sales" element={<CategorySalesReport />} />
          <Route path="print-jobs" element={<PrintJobHistory />} />
        </Route>
        
        <Route path="promotions" element={<Promotions />} />
        <Route path="promotions/apply" element={<ApplyPromotionalOffersPage />} />
        <Route path="goods-receiving" element={<GoodsReceiving />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        {/* `inventory` route intentionally removed 2026-08-31 — Inventory.tsx was a legacy,
            off-token duplicate of ProductsPage.tsx with no sidebar link or in-app navigation
            pointing to it (verified via a full grep for `/inventory` links/navigate calls).
            The file is left in place (frontend/src/pages/Inventory.tsx) in case something
            outside this repo still deep-links it; re-add the route if that turns up, but
            migrate it to ResponsiveTable + semantic tokens like ProductsPage.tsx first. */}
        <Route path="user-management" element={<Navigate to="/team" replace />} />
        <Route path="roles" element={<Navigate to="/team/roles" replace />} />
        <Route path="roles-debug" element={<RolesDebugPage />} />
      </Route>

      {/* System-admin console — its own shell (no tenant sidebar). Each page
          is additionally gated by a permission so staff roles see only what
          their platform role allows; the backend enforces the same names. */}
      <Route element={<SystemRoute><SystemLayout /></SystemRoute>}>
        <Route path="system" element={<SystemDashboard />} />
        <Route path="system/tenants" element={<SystemRoute perm="tenants.view"><SystemTenants /></SystemRoute>} />
        <Route path="system/billing" element={<SystemRoute perm="subscriptions.view"><SystemSubscriptions /></SystemRoute>} />
        <Route path="system/plans" element={<SystemRoute perm="plans.view"><SystemPlans /></SystemRoute>} />
        <Route path="system/users" element={<SystemRoute perm="platform.manage"><SystemUsers /></SystemRoute>} />
        <Route path="system/roles" element={<SystemRoute perm="platform.manage"><SystemRbac /></SystemRoute>} />
        <Route path="system/support" element={<SystemRoute perm="support.view"><SystemSupport /></SystemRoute>} />
        <Route path="system/announcements" element={<SystemRoute perm="platform.announcements.manage"><SystemAnnouncements /></SystemRoute>} />
        <Route path="system/audit" element={<SystemRoute perm="platform.audit.view"><SystemAudit /></SystemRoute>} />
        <Route path="system/health" element={<SystemRoute perm="platform.health.view"><SystemHealth /></SystemRoute>} />
      </Route>

      {/* Add other routes, like a 404 page, here */}
      {/* <Route path="*" element={<NotFoundPage />} /> */}
    </Routes>
    </Suspense>
  );
};

export default AppRoutes;
