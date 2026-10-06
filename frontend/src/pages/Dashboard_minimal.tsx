import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Receipt, X } from 'lucide-react';

interface TransactionItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  description?: string;
}

interface PaymentDetails {
  method: string;
  amount: number;
  change?: number;
  amountPaid?: number;
  cardLast4?: string;
  transactionId?: string;
}

const Dashboard = () => {
  const { user, isAuthenticated, checkAuthStatus } = useAuth();
  
  // State for modals
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<{
    id: string;
    date: string;
    amount: number;
    items: TransactionItem[];
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    paymentDetails: PaymentDetails;
    status: string;
    receiptNumber: string;
    cashier: string;
    customer: string;
  } | null>(null);
  
  const [isLoadingTransactionDetail, setIsLoadingTransactionDetail] = useState(false);

  // Format currency helper with null/undefined check
  const formatCurrency = (value: number | string | null | undefined): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };
  
  // Handle transaction click
  const handleTransactionClick = (transaction: {
    id?: string;
    date?: string;
    amount?: number;
    items?: Array<{
      name: string;
      price: number;
      quantity: number;
      total?: number;
    }>;
    product?: string;
    paymentDetails?: Partial<PaymentDetails>;
  }) => {
    if (!transaction) return;
    
    const processedTransaction = {
      id: transaction.id || `txn-${Date.now()}`,
      date: transaction.date || new Date().toISOString(),
      amount: transaction.amount || 0,
      items: Array.isArray(transaction.items) 
        ? transaction.items.map(item => ({
            name: item.name || 'Item',
            price: item.price || 0,
            quantity: item.quantity || 1,
            total: item.total || (item.price || 0) * (item.quantity || 1)
          }))
        : [{
            name: transaction.product || 'Item',
            price: transaction.amount || 0,
            quantity: 1,
            total: transaction.amount || 0
          }],
      subtotal: transaction.amount || 0,
      tax: 0,
      total: transaction.amount || 0,
      paymentMethod: 'Credit Card',
      paymentDetails: {
        method: 'Credit Card',
        amount: transaction.amount || 0,
        change: 0,
        amountPaid: transaction.amount || 0,
        ...transaction.paymentDetails
      },
      status: 'completed',
      receiptNumber: `RCPT-${Math.floor(100000 + Math.random() * 900000)}`,
      cashier: user?.name || 'Staff',
      customer: 'Walk-in Customer'
    };
    
    setSelectedTransaction(processedTransaction);
    setShowModal(true);
    
    if ((!transaction.items || !transaction.paymentDetails) && transaction.id) {
      fetchTransactionDetails(transaction.id);
    }
  };
  
  // Fetch transaction details
  const fetchTransactionDetails = async (transactionId: string) => {
    setIsLoadingTransactionDetail(true);
    
    try {
      // Mock transaction details for now
      const mockDetails = {
        items: [
          { name: 'Product A', quantity: 2, price: 15.99, total: 31.98 },
          { name: 'Product B', quantity: 1, price: 25.50, total: 25.50 }
        ],
        paymentDetails: {
          method: 'Credit Card',
          amount: 57.48,
          cardLast4: '1234',
          transactionId: 'TXN123456'
        }
      };
      
      setSelectedTransaction(prev => prev ? {
        ...prev,
        items: mockDetails.items,
        paymentDetails: { ...prev.paymentDetails, ...mockDetails.paymentDetails }
      } : null);
      
    } catch (error) {
      console.error('Error fetching transaction details:', error);
    } finally {
      setIsLoadingTransactionDetail(false);
    }
  };
  
  // Handle print receipt
  const handlePrintReceipt = (transaction: any) => {
    if (!transaction) return;
    
    const receiptContent = `
      <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2>Receipt</h2>
          <p>Receipt #: ${transaction.receiptNumber}</p>
          <p>Date: ${new Date(transaction.date).toLocaleDateString()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3>Items:</h3>
          ${transaction.items.map((item: any) => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>${item.name} x${item.quantity}</span>
              <span>${formatCurrency(item.total)}</span>
            </div>
          `).join('')}
        </div>
        
        <div style="border-top: 1px solid #000; padding-top: 10px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>${formatCurrency(transaction.subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Tax:</span>
            <span>${formatCurrency(transaction.tax)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Total:</span>
            <span>${formatCurrency(transaction.total)}</span>
          </div>
        </div>
        
        <div style="text-align: center;">
          <p>Thank you for your business!</p>
        </div>
      </div>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Receipt</title></head>
          <body onload="window.print(); window.close();">
            ${receiptContent}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };
  
  // Check authentication status on component mount
  useEffect(() => {
    if (!isAuthenticated) {
      checkAuthStatus();
    }
  }, [isAuthenticated, checkAuthStatus]);
  
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground">Dashboard</h1>
        <p className="text-gray-600 dark:text-muted-foreground">Welcome back, {user?.name || 'User'}</p>
      </div>
      
      {/* Dashboard content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-card p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">Total Sales</h3>
          <p className="text-3xl font-bold text-green-600">$0.00</p>
        </div>
        
        <div className="bg-white dark:bg-card p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">Transactions</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
        </div>
        
        <div className="bg-white dark:bg-card p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">Products</h3>
          <p className="text-3xl font-bold text-purple-600">0</p>
        </div>
        
        <div className="bg-white dark:bg-card p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">Revenue</h3>
          <p className="text-3xl font-bold text-orange-600">$0.00</p>
        </div>
      </div>
      
      {/* Transaction Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Transaction Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p><strong>Transaction ID:</strong> {selectedTransaction.id}</p>
                <p><strong>Date:</strong> {new Date(selectedTransaction.date).toLocaleString()}</p>
                <p><strong>Status:</strong> {selectedTransaction.status}</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Items:</h3>
                {selectedTransaction.items.map((item, index) => (
                  <div key={index} className="flex justify-between py-1">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-bold">{formatCurrency(selectedTransaction.total)}</span>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => handlePrintReceipt(selectedTransaction)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Receipt className="h-4 w-4" />
                  Print Receipt
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 dark:text-foreground rounded hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
