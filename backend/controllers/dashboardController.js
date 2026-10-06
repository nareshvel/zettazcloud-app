/**
 * Dashboard Controller - Optimized for Performance
 * Combines multiple API calls into single batched requests
 */

const { query } = require('../config/db');
const { getSalesSummary, getSalesChartData } = require('../services/salesService');
const { getCategorySalesSummary } = require('../services/api');
const { getProducts } = require('../services/inventoryService');
const { getSalesTransactions } = require('../services/reportsService');

/**
 * Get all dashboard data in a single optimized request
 * Reduces 6+ API calls to 1 batched call
 */
const getDashboardData = async (req, res) => {
  try {
    const { tenant_id, store_id } = req.user;
    
    if (!tenant_id || !store_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Tenant ID and Store ID are required'
      });
    }

    // Define date ranges for various queries
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Remove transaction date filtering for recent transactions

    // Execute all queries in parallel for maximum performance
    const [
      salesSummary,
      salesChartData,
      categorySalesData,
      productsData,
      transactionsData,
      storeData
    ] = await Promise.all([
      // Sales summary (last 30 days)
      getSalesSummary(tenant_id, store_id, 30).catch(err => {
        console.error('Error fetching sales summary:', err);
        return {
          total_sales: 0,
          total_revenue: 0,
          avg_order_value: 0,
          unique_customers: 0
        };
      }),
      
      // Sales chart data (last 7 days)
      getSalesChartData(tenant_id, store_id, '7').catch(err => {
        console.error('Error fetching sales chart data:', err);
        return [];
      }),
      
      // Category sales summary (last 30 days)
      getCategorySalesSummary(tenant_id, store_id, '30').catch(err => {
        console.error('Error fetching category sales:', err);
        return [];
      }),
      
      // Products data for inventory metrics
      getProducts(tenant_id, store_id, { limit: 200, offset: 0 }).catch(err => {
        console.error('Error fetching products:', err);
        return [];
      }),
      
      // Recent transactions (no date filter, just get the 10 most recent)
      getSalesTransactions(tenant_id, store_id, {
        limit: 10
      }).catch(err => {
        console.error('Error fetching transactions:', err);
        return { status: 'success', data: [] };
      }),
      
      // Store data
      getStoreDataOptimized(tenant_id).catch(err => {
        console.error('Error fetching store data:', err);
        return null;
      })
    ]);


    // Process sales chart data
    const processedSalesData = processSalesChartData(salesChartData, today);
    
    // Process inventory metrics
    // Map DB fields to the shape expected by processInventoryMetrics
    const productsForMetrics = Array.isArray(productsData)
      ? productsData.map(p => ({
          stockQuantity: p.stock_quantity ?? p.stockQuantity,
          lowStockThreshold: p.min_stock_level ?? p.lowStockThreshold
        }))
      : [];
    const inventoryMetrics = processInventoryMetrics(productsForMetrics);
    
    // Process transactions data
    const processedTransactions = processTransactionsData(transactionsData);
    
    // Process payment methods distribution
    const paymentMethodsData = processPaymentMethodsData(transactionsData);

    // Return all dashboard data in single response
    res.json({
      status: 'success',
      data: {
        salesSummary: salesSummary || {
          total_sales: 0,
          total_revenue: 0,
          avg_order_value: 0,
          unique_customers: 0
        },
        salesChartData: processedSalesData,
        categorySalesData: categorySalesData || [],
        inventoryMetrics,
        recentTransactions: processedTransactions,
        paymentMethodsData,
        storeData,
        metadata: {
          generatedAt: new Date().toISOString(),
          dataRanges: {
            salesChart: { startDate: startDateStr, endDate },
            transactions: { 
              startDate: 'no-filter', 
              endDate: 'no-filter' 
            }
          }
        }
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Optimized store data fetching
 */
const getStoreDataOptimized = async (tenantId) => {
  try {
    const [stores] = await query(
      'SELECT * FROM stores WHERE tenant_id = ? AND is_active = 1 LIMIT 1',
      [tenantId]
    );
    return stores.length > 0 ? stores[0] : null;
  } catch (error) {
    console.error('Error fetching store data:', error);
    return null;
  }
};

/**
 * Process sales chart data for last 7 days
 */
const processSalesChartData = (chartData, today) => {
  // If no chart data, return empty array
  if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
    return [];
  }

  // Process the actual sales data and format dates
  return chartData.map(item => {
    const dateObj = new Date(item.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      date: dateStr,
      revenue: parseFloat(item.revenue) || 0
    };
  });
};

/**
 * Process inventory metrics from products data
 */
const processInventoryMetrics = (products) => {
  if (!products || !Array.isArray(products)) {
    return {
      totalProducts: 0,
      lowStockItems: 0,
      inventoryStatusData: [
        { name: 'Low Stock', value: 0, color: '#ff6b6b' },
        { name: 'Medium Stock', value: 0, color: '#feca57' },
        { name: 'High Stock', value: 0, color: '#1dd1a1' }
      ]
    };
  }

  const totalProducts = products.length;
  const lowStock = products.filter(p => p.stockQuantity < (p.lowStockThreshold ?? 5)).length;
  const mediumStock = products.filter(p => 
    p.stockQuantity >= (p.lowStockThreshold ?? 5) && 
    p.stockQuantity <= (p.lowStockThreshold ? p.lowStockThreshold * 2 : 10)
  ).length;
  const highStock = products.filter(p => 
    p.stockQuantity > (p.lowStockThreshold ? p.lowStockThreshold * 2 : 10)
  ).length;

  return {
    totalProducts,
    lowStockItems: lowStock,
    inventoryStatusData: [
      { name: 'Low Stock', value: lowStock, color: '#ff6b6b' },
      { name: 'Medium Stock', value: mediumStock, color: '#feca57' },
      { name: 'High Stock', value: highStock, color: '#1dd1a1' }
    ]
  };
};

/**
 * Process transactions data for recent transactions display
 */
const processTransactionsData = (transactionsResult) => {
  console.log('processTransactionsData input:', JSON.stringify(transactionsResult, null, 2));
  if (!transactionsResult || transactionsResult.status !== 'success' || !transactionsResult.data) {
    console.log('Invalid transactions data structure');
    return [];
  }

  return transactionsResult.data.slice(0, 10).map(tx => {
    const paymentMethodColor = {
      'card': '#4361EE',
      'cash': '#06D6A0',
      'phone': '#9B5DE5',
      'charge': '#F15025',
      'gift card': '#FEE440',
      'store credit': '#00BBF9',
      'check': '#F15BB5',
      'other': '#8AC926'
    }[tx.paymentMethod?.toLowerCase() || ''] || '#4361EE';
    
    return {
      id: tx.id,
      saleNumber: tx.saleNumber || tx.sale_number,
      displayId: tx.id ? `#${tx.id.substring(0, 8)}...` : 'N/A',
      time: new Date(tx.transactionDate || tx.created_at).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }),
      type: 'sale',
      items: tx.totalItems || tx.total_items || 0,
      totalAmount: tx.totalAmount || tx.total,
      paymentMethod: tx.paymentMethod || tx.payment_method,
      paymentMethodColor: paymentMethodColor,
      customer: tx.customerName || tx.customer_name || 'Walk-in Customer',
      transactionDate: tx.transactionDate || tx.created_at,
      datetime: new Date(tx.transactionDate || tx.created_at).toLocaleString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }),
      status: 'completed'
    };
  });
};

/**
 * Process payment methods distribution
 */
const processPaymentMethodsData = (transactionsResult) => {
  if (!transactionsResult || transactionsResult.status !== 'success' || !transactionsResult.data) {
    return [];
  }

  const paymentMethodsMap = {};
  transactionsResult.data.forEach(tx => {
    const method = tx.paymentMethod || 'Other';
    if (!paymentMethodsMap[method]) {
      paymentMethodsMap[method] = { 
        name: method, 
        value: 0,
        color: {
          'Card': '#4361EE',
          'Cash': '#06D6A0',
          'Phone': '#9B5DE5',
          'Charge': '#F15025',
          'Gift Card': '#FEE440',
          'Store Credit': '#00BBF9',
          'Check': '#F15BB5',
          'Other': '#8AC926'
        }[method] || '#4361EE'
      };
    }
    paymentMethodsMap[method].value += tx.totalAmount || 0;
  });

  return Object.values(paymentMethodsMap);
};

module.exports = {
  getDashboardData
};
