import React from 'react';
import AppLayout from './components/layout/AppLayout';
import IndustryAwareLayout from './components/layout/IndustryAwareLayout';
import { Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Pos from './pages/POSScreen';
import SalesHubPage from './pages/SalesHubPage';
import { SALES_HUB_INDUSTRIES } from './utils/salesHubIndustries';
import Orders from './pages/OrdersPage';
import Products from './pages/ProductsPage';
import Customers from './pages/CustomersPage';
import Suppliers from './pages/SuppliersPage';
import Settings from './pages/Settings';
import Promotions from './pages/PromotionalOffersPage';
import ApplyPromotionalOffersPage from './pages/ApplyPromotionalOffersPage';
import GoodsReceiving from './pages/GoodsReceivingPage';
import PurchaseOrders from './pages/PurchaseManagementPage';
// `Inventory` (./pages/Inventory) intentionally unused — see the removed-route comment below.
import UserProfilePage from './pages/UserProfilePage';
import RolesManagementPage from './pages/RolesManagementPage';
import RolesDebugPage from './pages/RolesDebugPage';
import SettingsPayments from './pages/SettingsPayments';
import SalesReturnPage from './pages/SalesReturnPage';
import EmployeesPage from './pages/EmployeesPage';
import RepairsPage from './pages/RepairsPage';
import OldGoldPage from './pages/OldGoldPage';
import SerializedInventoryPage from './pages/SerializedInventoryPage';
import IndustryRoute from './components/common/IndustryRoute';
import MemoPage from './pages/MemoPage';
import LayawayPage from './pages/LayawayPage';
import SavingsSchemesPage from './pages/SavingsSchemesPage';
import MetalRatesPage from './pages/MetalRatesPage';
import CatalogSyncPage from './pages/CatalogSyncPage';
import JewelryValuationReport from './pages/reports/JewelryValuationReport';
import CycleCountPage from './pages/CycleCountPage';
import StockCountPage from './pages/StockCountPage';
import PrintJobHistory from './pages/PrintJobHistory';
import PrintTemplateDesigner from './pages/PrintTemplateDesigner';

// New Reports Structure
import ReportsLayout from './pages/reports';
import ReportsCenter from './pages/reports/ReportsCenter';
import SalesReport from './pages/reports/SalesReport';
import InventoryReportPage from './pages/reports/InventoryReportPage';
import PaymentReportPage from './pages/reports/PaymentReportPage';
import UserActivityReportPage from './pages/reports/UserActivityReportPage';
import CustomerValueReportPage from './pages/reports/CustomerValueReportPage';
import ChargeAccountReportPage from './pages/reports/ChargeAccountReportPage';
import TaxCollectedReport from './pages/reports/TaxCollectedReport';
import SalesReturnsReport from './pages/reports/SalesReturnsReport';
import EmployeePerformanceReport from './pages/reports/EmployeePerformanceReport';
import CategorySalesReport from './pages/reports/CategorySalesReport';

const AppRoutes: React.FC = () => {
  return (
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

      {/* Add other routes, like a 404 page, here */}
      {/* <Route path="*" element={<NotFoundPage />} /> */}
    </Routes>
  );
};

export default AppRoutes;
