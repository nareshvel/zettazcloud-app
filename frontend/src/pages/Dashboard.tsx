import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowDownRight, ArrowUpRight, AlertTriangle, Calendar as CalendarIcon, Package as PackageIcon,
  CreditCard, Eye, Loader2, Printer, Trash2, LayoutDashboard
} from 'lucide-react';
import { subDays, startOfDay, endOfDay, startOfMonth, startOfYear } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import toast from 'react-hot-toast';
import ReceiptModal from '../components/Receipt/ReceiptModal';
import { useReceipt } from '../hooks/useReceipt';
import QuickStartButton from '../components/onboarding/QuickStartButton';
import PageHeader from '@/components/common/PageHeader';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import StatusBadge from '@/components/common/StatusBadge';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useInventory } from '../contexts/InventoryContext';
import { useCurrency, useDateFormatting } from '../contexts/LocalizationContext';
import { getSalesSummary, getSalesChartData } from '../services/salesService';
import { getNowInTimezone, toApiDateString } from '../utils/timezone';
import { getCategorySalesSummary } from '../services/api';
import { getProducts } from '../services/inventoryService';
import { getStoreData } from '../services/api';
import { getSalesTransactions, getTransactionDetails } from '../services/reportsService';
import { deleteSale, getSaleDeletionPreview } from '@/services/saleDeletionService';
// Dynamic imports for discountService functions
import { SalesSummary, Product, Store, TransactionDetail, CategorySalesSummaryItem } from '@/types';
import {
  AreaChart, BarChart, Area, Bar, Cell, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer,
  Pie, PieChart
} from 'recharts';


// Simple skeleton helper for the dashboard widgets
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-muted ${className || ''}`} />
);

// Rendered inside a widget when the user lacks the permission its data
// comes from — a clean state instead of a 403 console error and an
// infinite skeleton/empty chart.
const WidgetNoAccess = () => (
  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
    You don't have permission to view this.
  </div>
);

// Shared Recharts tooltip config for all four Dashboard charts. `allowEscapeViewBox` keeps the
// tooltip box clamped inside the chart's own bounding box instead of growing past it on narrow
// (mobile) viewports, `isAnimationActive={false}` avoids an open tooltip lingering mid-animation
// on touch, and `wrapperStyle` keeps it above sibling content without letting it capture clicks
// meant for the rest of the page.
const CHART_TOOLTIP_PROPS = {
  contentStyle: { borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

const getPaymentMethodMeta = (method?: string | null) => {
  const key = (method || 'other').toLowerCase().replace(/\s+/g, '_');
  const mappings: Record<string, { color: string; label: string }> = {
    card: { color: '#4361EE', label: 'Card' },
    credit_card: { color: '#2563EB', label: 'Credit Card' },
    debit_card: { color: '#0891B2', label: 'Debit Card' },
    cash: { color: '#06D6A0', label: 'Cash' },
    upi: { color: '#9B5DE5', label: 'UPI' },
    phone: { color: '#7C3AED', label: 'Phone' },
    phonepe: { color: '#7C3AED', label: 'PhonePe' },
    gpay: { color: '#7C3AED', label: 'Google Pay' },
    google_pay: { color: '#7C3AED', label: 'Google Pay' },
    charge: { color: '#F15025', label: 'Charge' },
    credit: { color: '#F15025', label: 'Credit' },
    account: { color: '#F15025', label: 'Account' },
    gift_card: { color: '#FEE440', label: 'Gift Card' },
    store_credit: { color: '#00BBF9', label: 'Store Credit' },
    check: { color: '#F15BB5', label: 'Check' },
    cheque: { color: '#F15BB5', label: 'Cheque' },
    other: { color: '#8AC926', label: 'Other' },
  };
  return mappings[key] || { color: '#6B7280', label: method || 'Unknown' };
};

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const {
    fetchInventoryData,
    isInventoryLoaded,
    isLoading: isInventoryLoading,
    error: inventoryError,
  } = useInventory();
  const { formatCurrency, currencySymbol } = useCurrency();
  const { formatDate, formatDateTime, timezone } = useDateFormatting();

  // Per-widget permission gates — the dashboard page itself only requires
  // dashboard.view (which lets a user reach this route), while each widget's
  // data is sourced from endpoints with their own permission requirements:
  //   sales summary        → /sales/summary            → sales.view
  //   revenue/category     → /reports/sales/*          → reports.view
  //   transactions/payment → /reports/sales/*          → reports.view
  //   inventory widgets    → /products                 → products.view
  //   delete-sale action   → /sale-deletion/*          → sales.delete
  const canViewSales = hasPermission(user, 'sales.view');
  const canViewReports = hasPermission(user, 'reports.view');
  const canViewProducts = hasPermission(user, 'products.view');
  const canDeleteSales = hasPermission(user, 'sales.delete');

  const displayName = user?.name || 'User';

  // Handle delete sale
  const handleDeleteSale = async (transaction: any) => {
    setDeleteTransaction(transaction);
    setDeleteReason('');
    setDeletionPreview(null);
    setShowDeleteModal(true);
    
    try {
      const preview = await getSaleDeletionPreview(transaction.id);
      setDeletionPreview(preview.data);
    } catch (error: any) {
      toast.error('Failed to load deletion preview: ' + error.message);
    }
  };

  // Confirm delete sale
  const confirmDeleteSale = async () => {
    if (!deleteTransaction || !deleteReason.trim() || deleteReason.trim().length < 10) {
      toast.error('Please provide a deletion reason (minimum 10 characters)');
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteSale(deleteTransaction.id, deleteReason.trim());
      
      if (result.status === 'success') {
        toast.success('Sale deleted successfully');
        setShowDeleteModal(false);
        setDeleteTransaction(null);
        setDeleteReason('');
        
        // Refresh transactions list
        window.location.reload();
      }
    } catch (error: any) {
      toast.error('Failed to delete sale: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle print receipt printing functionality
  const { 
    isReceiptModalOpen, 
    receiptContent, 
    currentSale, 
    autoPrint,
    showReceiptForSale,
    closeReceiptModal 
  } = useReceipt();
  
  const { t: tDashboard } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');

  // Dashboard data state with loading indicators
  const [isLoading, setIsLoading] = useState({
    sales: true,
    inventory: true,
    categorySales: false,
    transactions: true
  });

  // Global date range for charts and transaction list
  type DateRangeOption = 'today' | '7d' | '30d' | 'month' | 'year';
  const [dateRange, setDateRange] = useState<DateRangeOption>('7d');

  const dateRangeMeta = useMemo(() => {
    const today = getNowInTimezone(timezone);
    let startDate = today;
    let endDate = today;
    let label = 'Last 7 days';

    switch (dateRange) {
      case 'today':
        startDate = startOfDay(today);
        endDate = endOfDay(today);
        label = 'Today';
        break;
      case '7d':
        startDate = subDays(today, 6);
        endDate = today;
        label = 'Last 7 days';
        break;
      case '30d':
        startDate = subDays(today, 29);
        endDate = today;
        label = 'Last 30 days';
        break;
      case 'month':
        startDate = startOfMonth(today);
        endDate = today;
        label = 'This month';
        break;
      case 'year':
        startDate = startOfYear(today);
        endDate = today;
        label = 'This year';
        break;
    }

    return {
      startDate: toApiDateString(startDate, timezone),
      endDate: toApiDateString(endDate, timezone),
      start: startDate,
      end: endDate,
      label,
    };
  }, [dateRange, timezone]);

  // State for modal and transactions
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [transactionDetail, setTransactionDetail] = useState<TransactionDetail | null>(null);
  
  // State for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTransaction, setDeleteTransaction] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletionPreview, setDeletionPreview] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingTransactionDetail, setIsLoadingTransactionDetail] = useState(false);
  
  // Handle transaction click to show details in modal
  const handleTransactionClick = async (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
    setIsLoadingTransactionDetail(true);
    setTransactionDetail(null);
    
    try {
      // Fetch detailed transaction information including line items
      const response = await getTransactionDetails(transaction.id);
      if (response.status === 'success' && response.data) {
        let td: any = response.data;

        try {
          // Fetch active offers for enrichment
          const { getAllActiveOffers } = await import('../services/discountService');
          const offers = await getAllActiveOffers();

          // Build cart items from transaction items and known products
          const cartItems = (td.items || []).map((it: any) => {
            const pid = it.productId != null ? String(it.productId) : undefined;
            const catId = it.categoryId != null ? String(it.categoryId) : undefined;
            // Find product from inventory cache
            const matched = products.find(p => (p.id != null && String(p.id) === pid)) as any;
            // Fallback product if not found
            const product: any = matched || {
              id: pid || it.id || `${it.name}`,
              name: it.name,
              price: Number(it.price) || 0,
              categoryId: catId,
            };
            return {
              product,
              quantity: Number(it.quantity) || 1,
              appliedDiscounts: [],
              originalPrice: Number(product.price) || Number(it.price) || 0,
              finalPrice: Number(product.price) || Number(it.price) || 0,
              unitPrice: Number(product.price) || Number(it.price) || 0,
            };
          });

          // Apply item-wise discounts using active offers
          const { applyItemWiseDiscounts } = await import('../services/discountService');
          const enrichResult = applyItemWiseDiscounts(cartItems as any, offers);
          
          // Prevent duplicate discounts: subtract backend-applied discount from calculated promotions
          const backendDiscount = td.discount || td.discount_amount || 0;
          const netPromotionsDiscount = Math.max(0, (enrichResult.totalDiscount || 0) - backendDiscount);

          // Aggregate applied offers for display chips
          const appliedOffers = Array.from(
            new Map(
              enrichResult.updatedItems
                .flatMap((ci: any) => ci.appliedDiscounts || [])
                .filter((d: any) => (d?.discountAmount ?? 0) > 0)
                .map((d: any) => [d.offerId, { id: d.offerId, name: d.offerName }])
            ).values()
          );

          // Attach per-item discounts for rendering beneath items (index-based merge)
          const enrichedItems = (td.items || []).map((it: any, idx: number) => {
            const ci = enrichResult.updatedItems?.[idx];
            return {
              ...it,
              appliedDiscounts: ci?.appliedDiscounts || [],
            };
          });

          // Compose enriched transaction detail without breaking existing fields
          td = {
            ...td,
            promotionsTotal: Math.round(netPromotionsDiscount * 100) / 100,
            appliedOffers,
            items: enrichedItems,
          };
          console.log('[RECEIPT] Final td:', { promotionsTotal: td.promotionsTotal, discount: td.discount });
        } catch (enrichErr) {
          // Log but do not break modal rendering
          console.warn('Dashboard enrichment failed; showing raw transaction:', enrichErr);
        }

        setTransactionDetail(td);
      } else {
        console.error('Error fetching transaction details:', response.error);
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
    } finally {
      setIsLoadingTransactionDetail(false);
    }
  };

  // Handle receipt print button click
  const handlePrintReceipt = async (transaction: any) => {
    try {
      if (!transaction) {
        toast.error('No transaction data available');
        return;
      }

      // Ensure print uses exact sale completion receipt with itemized lines by letting the
      // receipt hook fetch full sale details using just the ID.
      await showReceiptForSale({ id: transaction.id || transaction.sale_id });
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Failed to print receipt: ' + ((error as Error).message || 'Unknown error'));
    }
  };
  
    const [salesData, setSalesData] = useState<any[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [storeData, setStoreData] = useState<Store | null>(null);
    const [inventoryStatusData, setInventoryStatusData] = useState<{ name: string; value: number; color: string; }[]>([]);
      const [categorySalesData, setCategorySalesData] = useState<{ name: string; value: number; color: string; }[]>([]);
    const [paymentMethodsData, setPaymentMethodsData] = useState<{ name: string; value: number; color: string; }[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const TRANSACTIONS_PER_PAGE = 10;

  // Reset transaction pagination when date range changes
  useEffect(() => {
    setTransactionPage(1);
  }, [dateRange]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categorySalesActual, setCategorySalesActual] = useState<CategorySalesSummaryItem[]>([]);

  // Fetch store data
  useEffect(() => {
    const fetchStoreData = async () => {
      if (user?.tenantId) {
        try {
          const store = await getStoreData(user.tenantId);
          setStoreData(store);
        } catch (error) {
          console.error('Error fetching store data:', error);
        }
      }
    };
    
    fetchStoreData();
  }, [user]);


  // Transform actual category sales data for the chart
  useEffect(() => {
    if (categorySalesActual && categorySalesActual.length > 0) {
      const categoryColors = [
        '#54a0ff', '#1dd1a1', '#ff6b6b', '#feca57', '#5f27cd', '#48dbfb', 
        '#ff9f43', '#10ac84', '#ee5253', '#2e86de', '#01a3a4', '#8395a7'
      ];
      const transformedData = categorySalesActual.map((item, index) => ({
        name: item.categoryName,
        value: item.totalRevenue, // Actual revenue from backend
        color: categoryColors[index % categoryColors.length]
      }));
      setCategorySalesData(transformedData);
    } else {
      // If no actual data, ensure the chart doesn't break or show stale data
      setCategorySalesData([]); 
    }
  }, [categorySalesActual, setCategorySalesData]);

  // Load real data from APIs
  useEffect(() => {
    const loadSalesData = async () => {
      setIsLoading(prev => ({ ...prev, sales: true }));
      try {
        // Summary KPIs come from /sales/summary (sales.view)
        if (canViewSales) {
          const summary = await getSalesSummary();
          if (summary) {
            setSalesSummary(summary);
          }
        }

        // Revenue chart + category breakdown come from /reports/sales/*
        // (reports.view) — skip entirely for users without it.
        if (!canViewReports) {
          setSalesData([]);
          setCategorySalesActual([]);
          return;
        }

        // Fetch sales chart data for the selected date range
        const chartData = await getSalesChartData({
          startDate: dateRangeMeta.startDate,
          endDate: dateRangeMeta.endDate,
        });

        // Build a map of dates in the selected range, initialized to zero revenue
        const dateMap = new Map<string, { date: string; revenue: number }>();
        const rangeStart = new Date(dateRangeMeta.start);
        const rangeEnd = new Date(dateRangeMeta.end);
        for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = formatDate(d, 'MMM d');
          dateMap.set(dateStr, { date: dateStr, revenue: 0 });
        }

        // Populate the map with actual data from the API
        if (chartData && Array.isArray(chartData)) {
          chartData.forEach(item => {
            const dateObj = new Date(item.date + 'T00:00:00');
            const dateStr = formatDate(dateObj, 'MMM d');
            if (dateMap.has(dateStr)) {
              dateMap.set(dateStr, {
                date: dateStr,
                revenue: item.totalSales || 0
              });
            }
          });
        }

        // Convert map to array and set the state
        const formattedChartData = Array.from(dateMap.values());
        setSalesData(formattedChartData);

        // Fetch category sales summary
        setIsLoading(prev => ({ ...prev, categorySales: true }));
        try {
          const catSummary = await getCategorySalesSummary();
          if (catSummary) { // Ensure catSummary is not undefined
            setCategorySalesActual(catSummary);
          }
        } catch (catError) {
          console.error('Error loading category sales summary:', catError);
          toast.error('Failed to load category sales data.');
        } finally {
          setIsLoading(prev => ({ ...prev, categorySales: false }));
        }
      } catch (error) {
        console.error('Error loading sales data:', error);
      } finally {
        setIsLoading(prev => ({ ...prev, sales: false }));
      }
    };

    const loadInventoryData = async () => {
      setIsLoading(prev => ({ ...prev, inventory: true }));
      if (!canViewProducts || !user || !user.tenantId || !user.storeId) {
        if (canViewProducts) {
          console.warn("Tenant ID or Store ID not found, cannot load inventory data for dashboard metrics.");
        }
        setProducts([]);
        setInventoryStatusData([
          { name: tDashboard('inventoryStatus.lowStock'), value: 0, color: '#ff6b6b' },
          { name: tDashboard('inventoryStatus.mediumStock'), value: 0, color: '#feca57' },
          { name: tDashboard('inventoryStatus.highStock'), value: 0, color: '#1dd1a1' },
        ]);
        setIsLoading(prev => ({ ...prev, inventory: false }));
        return;
      }

      try {
        // Fetch products data for the specific tenant AND store
        const allProducts = await getProducts({ 
          tenant_id: user.tenantId,
          store_id: user.storeId 
        });
        
        if (allProducts && allProducts.length > 0) {
          setProducts(allProducts);
          const lowStock = allProducts.filter(p => p.stockQuantity < (p.lowStockThreshold ?? 5)).length;
          const mediumStock = allProducts.filter(p => 
            p.stockQuantity >= (p.lowStockThreshold ?? 5) && 
            p.stockQuantity <= (p.lowStockThreshold ? p.lowStockThreshold * 2 : 10)
          ).length;
          const highStock = allProducts.filter(p => 
            p.stockQuantity > (p.lowStockThreshold ? p.lowStockThreshold * 2 : 10)
          ).length;
          
          setInventoryStatusData([
            { name: tDashboard('inventoryStatus.lowStock'), value: lowStock, color: '#ff6b6b' },
            { name: tDashboard('inventoryStatus.mediumStock'), value: mediumStock, color: '#feca57' },
            { name: tDashboard('inventoryStatus.highStock'), value: highStock, color: '#1dd1a1' },
          ]);
        } else {
          // Handle case where no products are returned (e.g., new tenant or empty inventory)
          setProducts([]);
          setInventoryStatusData([
            { name: tDashboard('inventoryStatus.lowStock'), value: 0, color: '#ff6b6b' },
            { name: tDashboard('inventoryStatus.mediumStock'), value: 0, color: '#feca57' },
            { name: tDashboard('inventoryStatus.highStock'), value: 0, color: '#1dd1a1' },
          ]);
        }
      } catch (error) {
        console.error('Error loading inventory data:', error);
        toast.error(tDashboard('errors.loadInventoryFailed'));
        setProducts([]);
        setInventoryStatusData([
          { name: tDashboard('inventoryStatus.lowStock'), value: 0, color: '#ff6b6b' },
          { name: tDashboard('inventoryStatus.mediumStock'), value: 0, color: '#feca57' },
          { name: tDashboard('inventoryStatus.highStock'), value: 0, color: '#1dd1a1' },
        ]);
      } finally {
        setIsLoading(prev => ({ ...prev, inventory: false }));
      }
    };

    const loadTransactionsData = async () => {
      // Transactions table, payment-methods pie and top performers all
      // derive from /reports/sales/transactions (reports.view).
      if (!canViewReports) {
        setRecentTransactions([]);
        setPaymentMethodsData([]);
        setIsLoading(prev => ({ ...prev, transactions: false }));
        return;
      }
      setIsLoading(prev => ({ ...prev, transactions: true }));
      try {
        const filters = {
          startDate: dateRangeMeta.startDate,
          endDate: dateRangeMeta.endDate,
          limit: 50,
        };

        // Fetch recent transactions
        const transactionsResult = await getSalesTransactions(filters);
        if (transactionsResult.status === 'success' && transactionsResult.data) {
          // Process transactions for the table
          const formattedTransactions = transactionsResult.data.slice(0, 10).map(tx => {
            const paymentMeta = getPaymentMethodMeta(tx.paymentMethod);
            
            return {
              id: tx.id,
              // Don't display the full ID in the UI
              displayId: tx.id ? `#${tx.id.substring(0, 8)}...` : 'N/A',
              // Convert UTC to store timezone - use formatDateTime for proper timezone conversion
              time: formatDateTime(tx.transactionDate).split(' ').slice(1).join(' '), // Extract time portion
              type: 'sale',
              items: tx.totalItems || 0,
              amount: tx.totalAmount,
              paymentMethod: paymentMeta.label,
              paymentMethodRaw: tx.paymentMethod,
              paymentMethodColor: paymentMeta.color,
              customer: tx.customerName || 'Walk-in Customer',
              cashierName: tx.cashierName || '—',
              // Convert UTC to store timezone with full format
              datetime: formatDateTime(tx.transactionDate),
              status: 'completed'
            };
          });
          
          setRecentTransactions(formattedTransactions);

          // Enrich displayed Amount to include Promotions (offers) and manual discount
          // We only process the shown rows to keep it light.
          try {
            const { getAllActiveOffers } = await import('../services/discountService');
            const offers = await getAllActiveOffers();
            const enriched = await Promise.all(
              formattedTransactions.map(async (row) => {
                try {
                  const detailResp = await getTransactionDetails(row.id);
                  if (detailResp.status !== 'success' || !detailResp.data) return row;
                  const td: any = detailResp.data;
                  // Build cartItems for discount engine
                  const cartItems = (td.items || []).map((it: any) => {
                    const pid = it.productId != null ? String(it.productId) : undefined;
                    const catId = it.categoryId != null ? String(it.categoryId) : undefined;
                    const product: any = {
                      id: pid || it.id || `${it.name}`,
                      name: it.name,
                      price: Number(it.price) || 0,
                      categoryId: catId,
                    };
                    return {
                      product,
                      quantity: Number(it.quantity) || 1,
                      appliedDiscounts: [],
                      originalPrice: Number(product.price) || 0,
                      finalPrice: Number(product.price) || 0,
                      unitPrice: Number(product.price) || 0,
                    };
                  });
                  const { applyItemWiseDiscounts } = await import('../services/discountService');
                  const enrichResult = applyItemWiseDiscounts(cartItems as any, offers);
                  const promotions = Math.round((enrichResult.totalDiscount || 0) * 100) / 100;
                  const subtotal = Number(td?.subtotal ?? td?.subtotalAmount ?? 0);
                  const tax = Number(td?.tax ?? td?.taxAmount ?? 0);
                  const manual = Number(td?.discount ?? td?.discountAmount ?? 0);
                  const net = subtotal - promotions - manual + tax;
                  return { ...row, amount: net };
                } catch {
                  return row; // keep original on failure
                }
              })
            );
            setRecentTransactions(enriched);
          } catch (e) {
            console.warn('Failed to enrich row amounts with promotions:', e);
          }

          // Calculate payment methods distribution
          const paymentMethodsMap: Record<string, {name: string, value: number, color: string}> = {};
          transactionsResult.data.forEach(tx => {
            const meta = getPaymentMethodMeta(tx.paymentMethod);
            if (!paymentMethodsMap[meta.label]) {
              paymentMethodsMap[meta.label] = {
                name: meta.label,
                value: 0,
                color: meta.color,
              };
            }
            paymentMethodsMap[meta.label].value += tx.totalAmount || 0;
          });

          setPaymentMethodsData(Object.values(paymentMethodsMap));
        }
      } catch (error) {
        console.error('Error loading transactions data:', error);
      } finally {
        setIsLoading(prev => ({ ...prev, transactions: false }));
      }
    };

    // Load all data only when timezone is available
    if (!timezone) {
      console.log('[Dashboard] Waiting for timezone to load...');
      return;
    }
    
    loadSalesData();
    loadInventoryData();
    loadTransactionsData();
  }, [timezone, dateRangeMeta, canViewSales, canViewReports, canViewProducts]); // Re-load when timezone or date range changes

  // Stats - use real data from salesSummary with accurate fallback values
  const revenueThisYear = salesSummary?.totalRevenue || 0; // Use totalRevenue from API (yearly)
  // Use actual data for yesterday's sales if available, otherwise use the same fallback as displayed
  const yesterdaySales = salesSummary?.yesterdaySales || (revenueThisYear / 1.111); // Placeholder for comparison
  const salesGrowth = revenueThisYear && yesterdaySales ? ((revenueThisYear - yesterdaySales) / yesterdaySales * 100).toFixed(1) : '0.0';
  
  // Total Products count from inventory
  const totalProducts = products?.length || 0;
  
  // Calculate growth only if we have actual products data
  let productsGrowth = '0.0';
  if (totalProducts > 0) {
    // For demo purposes, simulate a small growth - in production this would come from historical data
    const lastWeekProducts = Math.max(1, Math.floor(totalProducts * 0.95)); // Simulate ~5% growth
    productsGrowth = ((totalProducts - lastWeekProducts) / lastWeekProducts * 100).toFixed(1);
  }
  
  // Low stock items count - items with stock below threshold
  const lowStockItems = products?.filter((item: Product) => 
    item.stockQuantity !== undefined && 
    item.stockQuantity <= (item.lowStockThreshold || 5)
  )?.length || 0;
  
  // Calculate change only if we have actual low stock data
  let lowStockChange = '0.0';
  if (lowStockItems > 0) {
    // For demo purposes - in production this would come from historical data
    const previousLowStockItems = Math.max(1, Math.floor(lowStockItems * 1.25)); // Simulate ~20% reduction
    lowStockChange = ((lowStockItems - previousLowStockItems) / previousLowStockItems * 100).toFixed(1);
  }
  
  // Use data from API or fallback to displayed value
  const monthlyRevenue = salesSummary?.totalRevenueThisMonth || 0;
  const lastMonthRevenue = salesSummary?.lastMonthTotalSales || (monthlyRevenue / 1.087); // Placeholder for comparison
  const monthlyGrowth = monthlyRevenue && lastMonthRevenue ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1) : '0.0';

  useEffect(() => {
    // Skip the shared inventory fetch entirely when the user lacks
    // products.view — it would 403 and poison the inventoryError gate below.
    if (isAuthenticated && canViewProducts && !isInventoryLoaded && !isInventoryLoading) {
      fetchInventoryData();
    }
  }, [isAuthenticated, canViewProducts, isInventoryLoaded, isInventoryLoading, fetchInventoryData]);

  const topPerformers = useMemo(() => {
    const map = new Map<string, { name: string; sales: number; transactions: number }>();
    recentTransactions.forEach(tx => {
      const name = tx.cashierName || 'Unknown';
      const current = map.get(name) || { name, sales: 0, transactions: 0 };
      current.sales += Number(tx.amount) || 0;
      current.transactions += 1;
      map.set(name, current);
    });
    return Array.from(map.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }, [recentTransactions]);

  const paginatedTransactions = useMemo(() => {
    const start = (transactionPage - 1) * TRANSACTIONS_PER_PAGE;
    return recentTransactions.slice(start, start + TRANSACTIONS_PER_PAGE);
  }, [recentTransactions, transactionPage]);

  const transactionTotalPages = Math.ceil(recentTransactions.length / TRANSACTIONS_PER_PAGE) || 1;

  // dashboard.view gates the page itself — a user without it gets a clean
  // access-denied screen rather than a dashboard of empty widgets. Only
  // evaluated once `user` is loaded so an auth re-validation's transient
  // null doesn't flash the denial.
  if (user && !hasPermission(user, 'dashboard.view')) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,4rem))]">
        <LayoutDashboard className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-lg font-semibold">You don't have access to the dashboard.</p>
        <p className="text-sm text-muted-foreground mt-1">Ask your administrator to grant the dashboard.view permission.</p>
      </div>
    );
  }

  // Wait for timezone to load before rendering
  if (!timezone) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,4rem))]">
        <p className="text-lg font-semibold">Loading timezone settings...</p>
      </div>
    );
  }

  // isInventoryLoaded never becomes true for a user without products.view
  // (we skip the fetch) — don't block the whole page on it.
  const inventoryReady = !canViewProducts || isInventoryLoaded;

  if (isInventoryLoading && !inventoryReady) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,4rem))]">
        <p className="text-lg font-semibold">Loading...</p>
        {/* Spinner can be added here */}
      </div>
    );
  }

  if (inventoryError) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,4rem))]">
        <p className="text-lg font-semibold text-red-600">{tCommon('app.error')}:</p>
        <p className="text-red-500 mb-4">{inventoryError}</p>
        <button 
          onClick={() => fetchInventoryData()} 
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-opacity-50"
        >
          {tCommon('actions.retry')}
        </button>
      </div>
    );
  }

  if (!inventoryReady) {
    // This state might be brief or not shown if loading is quick
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,4rem))]">
        <p className="text-lg font-semibold">Loading...</p>
      </div>
    );
  }

  // If inventory is loaded, render the dashboard content
  const transactionColumns: ColumnDefinition<any>[] = [
    { Header: 'Customer', accessor: 'customer' },
    { Header: 'Date & Time', accessor: 'datetime' },
    { Header: 'Items', accessor: 'items', className: 'text-right' },
    {
      Header: 'Payment Method',
      accessor: 'paymentMethod',
      Cell: (tx: any) => (
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tx.paymentMethodColor }} />
          <span className="capitalize">{tx.paymentMethod}</span>
        </div>
      ),
    },
    {
      Header: 'Amount',
      accessor: 'amount',
      className: 'text-right',
      Cell: (tx: any) => <span className="font-medium">{formatCurrency(tx.amount)}</span>,
    },
    {
      Header: 'Status',
      accessor: 'status',
      Cell: (tx: any) => <StatusBadge status={tx.status} />,
    },
    {
      Header: 'Actions',
      accessor: 'id',
      Cell: (tx: any) => (
        <div className="flex items-center gap-0.5 -my-2">
          <button
            className="p-2 -m-1 rounded-md text-primary hover:text-primary/80 hover:bg-muted"
            onClick={() => handleTransactionClick(tx)}
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            className="p-2 -m-1 rounded-md text-green-600 hover:text-green-700 hover:bg-muted"
            onClick={() => handlePrintReceipt(tx)}
            title="Print Receipt"
          >
            <Printer className="h-4 w-4" />
          </button>
          {canDeleteSales && (
            <button
              className="p-2 -m-1 rounded-md text-red-600 hover:text-red-700 hover:bg-muted"
              onClick={() => handleDeleteSale(tx)}
              title="Delete Sale"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Semantic tokens (success/warning/primary from tailwind.config.js), not raw palette
  // classes — per FRONTEND_STANDARDS.md's golden rule 1, and matching the convention
  // already used elsewhere (SignupPage.tsx, ProductsPage.tsx, CustomersPage.tsx).
  const kpiItems = [
    { label: 'Revenue This Year', value: formatCurrency(revenueThisYear), icon: CreditCard, color: 'text-primary', change: salesGrowth, changeLabel: 'from yesterday', positiveIsGood: true },
    { label: 'Total Products', value: totalProducts, icon: PackageIcon, color: 'text-success-600', change: productsGrowth, changeLabel: 'from last week', positiveIsGood: true },
    { label: 'Low Stock Items', value: lowStockItems, icon: AlertTriangle, color: 'text-warning-600', change: lowStockChange, changeLabel: 'from last week', positiveIsGood: false },
    { label: 'Revenue This Month', value: formatCurrency(monthlyRevenue), icon: CalendarIcon, color: 'text-chart-4', change: monthlyGrowth, changeLabel: 'from last month', positiveIsGood: true },
  ];

  return (
    <>
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={LayoutDashboard}
        title={tDashboard('title', { defaultValue: 'Dashboard' })}
        subtitle={`${tDashboard('welcome', { defaultValue: 'Welcome back' })}, ${displayName}`}
        actions={
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="year">This year</SelectItem>
              </SelectContent>
            </Select>
            <QuickStartButton />
          </div>
        }
      />

      {/* KPI strip */}
      {isLoading.sales || isLoading.inventory ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-2.5 sm:p-3.5">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {kpiItems.map((item) => {
            const Icon = item.icon;
            const changeNum = parseFloat(item.change);
            const isPositive = changeNum >= 0;
            const isGood = item.positiveIsGood ? isPositive : !isPositive;
            const changeColor = isGood ? 'text-green-600' : 'text-red-600';
            const Arrow = isPositive ? ArrowUpRight : ArrowDownRight;
            return (
              <div key={item.label} className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-2.5 sm:p-3.5">
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${item.color}`} />
                <div className="min-w-0">
                  {/* Fluid font size (clamp) so long currency strings shrink to fit a 2-up
                      mobile card instead of truncating with an ellipsis; `title` is still a
                      fallback for anything that still can't fit. */}
                  <p
                    className="text-[clamp(0.95rem,4vw,1.5rem)] lg:text-2xl font-bold text-foreground leading-none truncate"
                    title={String(item.value)}
                  >
                    {item.value}
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">{item.label}</p>
                  <div className={`text-[11px] sm:text-xs ${changeColor} flex items-center mt-1`}>
                    <Arrow className="h-3 w-3 mr-1 shrink-0" />
                    <span className="truncate">{isPositive ? '+' : ''}{item.change}% {item.changeLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Charts and insights section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue Chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-card-foreground">Revenue Overview</h2>
            <div className="text-sm text-muted-foreground">{dateRangeMeta.label}</div>
          </div>
          <div className="h-80">
            {isLoading.sales ? (
              <div className="h-full w-full rounded-lg bg-muted/50 animate-pulse" />
            ) : !canViewReports ? (
              <WidgetNoAccess />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => `${currencySymbol}${value}`} tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    formatter={(value) => [`${currencySymbol}${value}`, 'Revenue']}
                    labelFormatter={(label) => `Date: ${label}`}
                    {...CHART_TOOLTIP_PROPS}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                    activeDot={{ r: 9, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--background))' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Sales and Inventory Status */}
        <div className="grid grid-cols-1 gap-5">
          {/* Categories Performance */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-card-foreground">Sales by Category</h2>
              <div className="text-sm text-muted-foreground">This month</div>
            </div>
            <div className="h-36">
              {isLoading.sales ? (
                <div className="h-full w-full rounded-lg bg-muted/50 animate-pulse" />
              ) : !canViewReports ? (
                <WidgetNoAccess />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categorySalesData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `${currencySymbol}${value/1000}k`} tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      formatter={(value) => [`${currencySymbol}${value}`, 'Revenue']}
                      {...CHART_TOOLTIP_PROPS}
                    />
                    <Bar dataKey="value" barSize={20}>
                      {categorySalesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Inventory Status */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-card-foreground">Inventory Status</h2>
              <div className="flex items-center text-sm text-muted-foreground">
                <PackageIcon className="h-4 w-4 mr-1" />
                <span>{inventoryStatusData.reduce((acc, item) => acc + item.value, 0)} Products</span>
              </div>
            </div>
            {isLoading.inventory ? (
              <div className="h-36 w-full rounded-lg bg-muted/50 animate-pulse" />
            ) : !canViewProducts ? (
              <div className="h-36"><WidgetNoAccess /></div>
            ) : (
            <div className="flex">
              <div className="h-36 w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                      label={({percent}) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {inventoryStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name) => [`${value} products`, name]}
                      {...CHART_TOOLTIP_PROPS}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-1/2 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Low Stock</span>
                    <span className="text-sm font-medium text-foreground">{inventoryStatusData[0]?.value || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-red-400 h-1.5 rounded-full" style={{width: `${inventoryStatusData[0]?.value ? (inventoryStatusData[0].value / (inventoryStatusData.reduce((acc, item) => acc + item.value, 0) || 1) * 100) : 0}%`}}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Medium Stock</span>
                    <span className="text-sm font-medium text-foreground">{inventoryStatusData[1]?.value || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-yellow-400 h-1.5 rounded-full" style={{width: `${inventoryStatusData[1]?.value ? (inventoryStatusData[1].value / (inventoryStatusData.reduce((acc, item) => acc + item.value, 0) || 1) * 100) : 0}%`}}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">High Stock</span>
                    <span className="text-sm font-medium text-foreground">{inventoryStatusData[2]?.value || 0}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-green-400 h-1.5 rounded-full" style={{width: `${inventoryStatusData[2]?.value ? (inventoryStatusData[2].value / (inventoryStatusData.reduce((acc, item) => acc + item.value, 0) || 1) * 100) : 0}%`}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Payment Methods + Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-card-foreground">Payment Methods</h2>
            <div className="text-sm text-muted-foreground">{dateRangeMeta.label}</div>
          </div>
          <div className="h-56 flex flex-col lg:flex-row items-center gap-6">
            <div className="relative h-48 w-full lg:h-full lg:w-1/2">
              {isLoading.transactions ? (
                <div className="h-full w-full rounded-full bg-muted/50 animate-pulse mx-auto max-w-[12rem]" />
              ) : !canViewReports ? (
                <WidgetNoAccess />
              ) : paymentMethodsData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                  No payment data
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      >
                        {paymentMethodsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value, name) => [`${currencySymbol}${Number(value).toFixed(2)}`, name]}
                        {...CHART_TOOLTIP_PROPS}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
                    <span className="text-sm font-bold text-foreground">
                      {formatCurrency(paymentMethodsData.reduce((sum, m) => sum + m.value, 0))}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="w-full lg:w-1/2 space-y-2 overflow-y-auto max-h-48 pr-1">
              {paymentMethodsData.map((method, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: method.color }}></span>
                    <span className="text-muted-foreground truncate">{method.name}</span>
                  </div>
                  <span className="font-medium text-foreground ml-2 whitespace-nowrap">{formatCurrency(method.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-card-foreground">Top Performers</h2>
            <div className="text-sm text-muted-foreground">{dateRangeMeta.label}</div>
          </div>
          {isLoading.transactions ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : !canViewReports ? (
            <div className="py-8"><WidgetNoAccess /></div>
          ) : topPerformers.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No sales data for the selected period.
            </div>
          ) : (
            <div className="space-y-4">
              {topPerformers.map((performer, index) => {
                const maxSales = topPerformers[0].sales || 1;
                const progress = Math.min(100, Math.round((performer.sales / maxSales) * 100));
                return (
                  <div key={performer.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="font-medium text-foreground">{performer.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-foreground">{formatCurrency(performer.sales)}</span>
                        <span className="text-xs text-muted-foreground ml-1">({performer.transactions} sales)</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-card-foreground">Recent Transactions</h2>
          <button className="text-sm text-primary hover:text-primary/80 hover:underline">
            View All Transactions
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <ReusableTable
            columns={transactionColumns}
            data={paginatedTransactions}
            isLoading={isLoading.transactions}
            noDataMessage={canViewReports ? 'No recent transactions found.' : "You don't have permission to view this."}
            currentPage={transactionPage}
            totalPages={transactionTotalPages}
            onPageChange={setTransactionPage}
            itemsPerPage={TRANSACTIONS_PER_PAGE}
            totalItems={recentTransactions.length}
          />
        </div>
      </div>
    </div>
    
    {/* Delete Sale Confirmation Modal */}
    {showDeleteModal && deleteTransaction && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-card rounded-lg shadow-xl max-w-2xl w-full mx-auto overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
            <h3 className="text-lg font-medium text-red-900 dark:text-red-100">Delete Sale Confirmation</h3>
            <button 
              onClick={() => setShowDeleteModal(false)}
              className="text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:text-foreground focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-6">
            {/* Sale Information */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-muted/50 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-foreground mb-2">Sale Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-muted-foreground">Sale ID:</span>
                  <span className="ml-2 font-mono">{deleteTransaction.id}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-muted-foreground">Amount:</span>
                  <span className="ml-2 font-medium">{formatCurrency(deleteTransaction.amount)}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-muted-foreground">Customer:</span>
                  <span className="ml-2">{deleteTransaction.customer}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-muted-foreground">Date:</span>
                  <span className="ml-2">{deleteTransaction.datetime}</span>
                </div>
              </div>
            </div>

            {/* Deletion Preview */}
            {!deletionPreview ? (
              <div className="mb-6 p-8 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-lg flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-gray-600 dark:text-muted-foreground">Loading inventory impact...</p>
              </div>
            ) : (
              <div className="mb-6">
                {!deletionPreview.validation.canDelete ? (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                    <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">Cannot Delete Sale</h4>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      {deletionPreview.validation.reasons.map((reason: string, index: number) => (
                        <li key={index}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    {deletionPreview.validation.warnings.length > 0 && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg mb-4">
                        <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Warnings</h4>
                        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                          {deletionPreview.validation.warnings.map((warning: string, index: number) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {deletionPreview.inventoryImpact.length > 0 && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Inventory Impact</h4>
                        <div className="text-sm text-primary">
                          <p className="mb-2">The following inventory will be restored:</p>
                          <ul className="space-y-1">
                            {deletionPreview.inventoryImpact.map((item: any, index: number) => (
                              <li key={index}>
                                • {item.productName}: +{item.quantityToRestore} units 
                                ({item.currentStock} → {item.newStock})
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Deletion Reason */}
            {deletionPreview?.validation.canDelete && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                  Reason for Deletion *
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                  placeholder="Please provide a detailed reason for deleting this sale (minimum 10 characters)..."
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 dark:text-muted-foreground mt-1">
                  {deleteReason.length}/500 characters (minimum 10 required)
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-foreground bg-gray-100 dark:bg-muted rounded-md hover:bg-gray-200 dark:hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={isDeleting}
              >
                Cancel
              </button>
              {deletionPreview?.validation.canDelete && (
                <button
                  onClick={confirmDeleteSale}
                  disabled={isDeleting || deleteReason.trim().length < 10}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isDeleting ? 'Deleting...' : 'Delete Sale'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    
    {/* Transaction Details Modal */}
    {showModal && selectedTransaction && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-card rounded-lg shadow-xl max-w-md w-full mx-auto overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-medium text-gray-900 dark:text-foreground">Receipt Details</h3>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:text-foreground focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="p-6 font-mono">
            {/* Store Header */}
            <div className="text-center mb-4">
              <h4 className="text-xl font-bold">{storeData?.name || user?.store?.name || 'ZettaZ Store'}</h4>
              <p className="text-sm text-gray-600 dark:text-muted-foreground">{storeData?.address || user?.store?.address || '123 Main Street, City 12345'}</p>
              {(storeData?.phone || user?.store?.phone) && (
                <p className="text-sm text-gray-600 dark:text-muted-foreground">Tel: {storeData?.phone || user?.store?.phone}</p>
              )}
              {(storeData?.email || user?.store?.email) && (
                <p className="text-sm text-gray-600 dark:text-muted-foreground">{storeData?.email || user?.store?.email}</p>
              )}
            </div>
            
            {/* Receipt Details */}
            <div className="border-t border-b border-dashed border-gray-300 dark:border-border py-2 mb-2">
              <p className="text-sm">Date: {transactionDetail?.localDate || transactionDetail?.local_date || transactionDetail?.date || transactionDetail?.transactionDate || selectedTransaction.datetime}</p>
              <p className="text-sm">Cashier: {transactionDetail?.cashier || transactionDetail?.cashierName || user?.name || 'Staff'}</p>
              <p className="text-sm">Customer: {transactionDetail?.customerName || selectedTransaction.customer || 'Guest'}</p>
              {transactionDetail?.receiptNumber && (
                <p className="text-sm">Receipt #: {transactionDetail.receiptNumber}</p>
              )}
            </div>
            
            {/* Items Header */}
            <div className="border-b border-gray-300 dark:border-border py-2 grid grid-cols-12 gap-1 text-xs font-bold">
              <div className="col-span-8">ITEM</div>
              <div className="col-span-4 text-right">AMOUNT</div>
            </div>
            
            {/* Items - Parse the items data or use placeholder */}
            <div className="py-2 border-b border-gray-300 dark:border-border text-sm">
              {isLoadingTransactionDetail ? (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-600 dark:text-muted-foreground">Loading transaction items...</p>
                </div>
              ) : transactionDetail && transactionDetail.items && transactionDetail.items.length > 0 ? (
                // Display actual transaction items from API with enriched discount lines
                transactionDetail.items.map((item: any, index: number) => (
                  <div key={index} className="py-1 text-xs">
                    <div className="grid grid-cols-12 gap-1">
                      <div className="col-span-8">{item.name} @ {formatCurrency(item.price)} x{item.quantity}</div>
                      <div className="col-span-4 text-right">{formatCurrency(item.total)}</div>
                    </div>
                    {Array.isArray(item.appliedDiscounts) && item.appliedDiscounts.length > 0 && (
                      <div className="mt-0.5 ml-2">
                        {item.appliedDiscounts.map((d: any, di: number) => (
                          <div key={di} className="grid grid-cols-12 gap-1 text-[11px] text-green-700">
                            <div className="col-span-8 truncate">- {d.offerName}</div>
                            <div className="col-span-4 text-right">- {formatCurrency(d.discountAmount || 0)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : typeof selectedTransaction.items === 'string' ? (
                <div className="grid grid-cols-12 gap-1 py-1 text-xs">
                  <div className="col-span-8">{selectedTransaction.items} @ {formatCurrency(selectedTransaction.amount)} x1</div>
                  <div className="col-span-4 text-right">{formatCurrency(selectedTransaction.amount)}</div>
                </div>
              ) : Array.isArray(selectedTransaction.items) ? (
                // If we have actual itemized data as an array
                selectedTransaction.items.map((item: any, index: number) => (
                  <div key={index} className="grid grid-cols-12 gap-1 py-1 text-xs">
                    <div className="col-span-8">{item.name} @ {formatCurrency(item.price)} x{item.quantity}</div>
                    <div className="col-span-4 text-right">{formatCurrency(item.quantity * item.price)}</div>
                  </div>
                ))
              ) : (
                // Fallback when items structure is unknown
                <div className="grid grid-cols-12 gap-1 py-1 text-xs">
                  <div className="col-span-8">{selectedTransaction.product || selectedTransaction.description || 'Item'} @ {formatCurrency(selectedTransaction.amount)} x1</div>
                  <div className="col-span-4 text-right">{formatCurrency(selectedTransaction.amount)}</div>
                </div>
              )}
            </div>
            
            {/* Offers Applied (if any) */}
            {(() => {
              const td: any = transactionDetail as any;
              const offersList: any[] = td?.appliedOffers || td?.offers || td?.promotions || [];
              return offersList.length > 0 ? (
                <div className="pt-2 border-b border-gray-300 dark:border-border text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-800 dark:text-foreground">Offers Applied</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {offersList.map((offer: any, idx: number) => (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {offer?.name || offer?.title || offer?.offerName || 'Offer'}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Totals */}
            <div className="pt-2 border-b border-dashed border-gray-300 dark:border-border text-xs">
              {(() => {
                const td: any = transactionDetail as any;
                const subtotal = Number(td?.subtotal ?? td?.subtotalAmount ?? selectedTransaction.amount ?? 0);
                const tax = Number(td?.tax ?? td?.taxAmount ?? selectedTransaction.tax ?? 0);
                const total = Number(td?.total ?? td?.totalAmount ?? selectedTransaction.amount ?? 0);
                const promosTotal = Number(td?.promotionsTotal ?? td?.promotionAmount ?? 0);
                const backendManual = Number(td?.discount ?? td?.discountAmount ?? 0);

                // Derive manual discount excluding promotions if backend value is missing/zero
                let manualDiscount = backendManual;
                if (!manualDiscount || manualDiscount <= 0) {
                  const diff = (subtotal + tax) - total; // total reductions applied
                  manualDiscount = Math.max(0, diff - (promosTotal || 0));
                }

                return (
                  <>
                    <div className="flex justify-between py-1">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>

                    {promosTotal > 0 && (
                      <div className="flex justify-between py-1 text-green-600">
                        <span>Promotions</span>
                        <span>-{formatCurrency(promosTotal)}</span>
                      </div>
                    )}

                    {manualDiscount > 0 && (
                      <div className="flex justify-between py-1 text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(manualDiscount)}</span>
                      </div>
                    )}

                    {tax > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Tax</span>
                        <span>{formatCurrency(tax)}</span>
                      </div>
                    )}

                    <div className="flex justify-between py-1 font-bold">
                      <span>TOTAL</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* Payment Information */}
            <div className="pt-2 text-xs">
              <div className="flex justify-between py-1">
                <span>Payment Method</span>
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{
                    backgroundColor: selectedTransaction.paymentMethodColor || (
                      (transactionDetail?.payment_method_display || transactionDetail?.paymentMethod || '').toLowerCase().includes('cash') ? '#22c55e' : 
                      (transactionDetail?.payment_method_display || transactionDetail?.paymentMethod || '').toLowerCase().includes('card') ? '#3b82f6' : 
                      '#6366f1'
                    )
                  }}></div>
                  <span>{transactionDetail?.payment_method_display || transactionDetail?.paymentMethod || selectedTransaction.paymentMethod || 'Cash'}</span>
                </div>
              </div>
              {transactionDetail?.paymentDetails?.tenderAmount ? (
                <div className="flex justify-between py-1">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(transactionDetail.paymentDetails.tenderAmount)}</span>
                </div>
              ) : (
                <div className="flex justify-between py-1">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(transactionDetail?.total || transactionDetail?.totalAmount || selectedTransaction.amount)}</span>
                </div>
              )}
              {((transactionDetail?.paymentDetails?.changeAmount ?? 0) > 0 || selectedTransaction.change) && (
                <div className="flex justify-between py-1">
                  <span>Change</span>
                  <span>{formatCurrency(
                    transactionDetail?.paymentDetails?.changeAmount || 
                    selectedTransaction.change || 
                    (selectedTransaction.amountPaid ? selectedTransaction.amountPaid - selectedTransaction.amount : 0)
                  )}</span>
                </div>
              )}
            </div>
            
            {/* Status */}
            <div className="mt-4 text-center">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                selectedTransaction.status === 'completed' 
                  ? 'bg-green-100 text-green-800' 
                  : selectedTransaction.status === 'pending' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-1 h-1 mr-1 rounded-full ${
                  selectedTransaction.status === 'completed' 
                    ? 'bg-green-500' 
                    : selectedTransaction.status === 'pending' 
                      ? 'bg-yellow-500' 
                      : 'bg-red-500'
                }`}></div>
                {selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
              </span>
            </div>
            
            {/* QR Code */}
            <div className="mt-4 flex justify-center">
              <QRCodeSVG 
                value={`Receipt #${selectedTransaction.id}`} 
                size={80}
              />
            </div>
            
            {/* Thank you message */}
            <div className="mt-3 text-center border-t border-dashed border-gray-300 dark:border-border pt-3">
              <p className="text-sm">Thank you for your purchase!</p>
              <p className="text-xs text-gray-600 dark:text-muted-foreground mt-1">Returns accepted only for selected items</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 dark:bg-muted/50">
            <button
              onClick={() => handlePrintReceipt(selectedTransaction)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary/90 focus:outline-none flex items-center"
            >
              <Printer className="h-4 w-4 mr-2" /> Print Receipt
            </button>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-foreground bg-white dark:bg-card border border-gray-300 dark:border-border rounded-md shadow-sm hover:bg-gray-50 dark:bg-muted/50 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
      {/* Receipt Modal for printing */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={closeReceiptModal}
        sale={currentSale}
        receiptContent={receiptContent}
        autoPrint={autoPrint}
      />
    </>
  );
};

export default Dashboard;
