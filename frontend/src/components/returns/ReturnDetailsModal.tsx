import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Printer, Package, User, FileText } from 'lucide-react';
import { SalesReturn } from '../../services/salesReturnService';
import { formatCurrency } from '../../utils/locale/currencyUtils';
import { formatDate } from '../../utils/locale/dateUtils';

interface ReturnDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnData: SalesReturn;
  onComplete?: () => void;
  onCancel?: () => void;
}

const ReturnDetailsModal: React.FC<ReturnDetailsModalProps> = ({
  isOpen,
  onClose,
  returnData,
  onComplete,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleComplete = async () => {
    if (onComplete) {
      setLoading(true);
      try {
        await onComplete();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancel = async () => {
    if (onCancel) {
      setLoading(true);
      try {
        await onCancel();
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrint = () => {
    // TODO: Implement print functionality
    console.log('Print return receipt');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 dark:bg-muted text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'new':
        return 'bg-green-100 text-green-800';
      case 'used':
        return 'bg-blue-100 text-blue-800';
      case 'damaged':
        return 'bg-orange-100 text-orange-800';
      case 'defective':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 dark:bg-muted text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-text-primary">
              Return Details
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(returnData.status)}`}>
              {returnData.status.charAt(0).toUpperCase() + returnData.status.slice(1)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-text-secondary hover:text-primary transition-colors"
              title="Print Receipt"
            >
              <Printer size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-text-secondary hover:text-primary transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Return Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Return Details */}
            <div className="bg-gray-50 dark:bg-muted/50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                <FileText size={20} />
                Return Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Return Number:</span>
                  <span className="font-medium">{returnData.return_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Return Date:</span>
                  <span>{formatDate(returnData.return_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Original Receipt:</span>
                  <span>{returnData.original_receipt_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Original Sale Date:</span>
                  <span>{returnData.original_sale_date ? formatDate(returnData.original_sale_date) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Processed By:</span>
                  <span>{returnData.processed_by_name || 'Unknown'}</span>
                </div>
              </div>
            </div>

            {/* Customer & Payment */}
            <div className="bg-gray-50 dark:bg-muted/50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                <User size={20} />
                Customer & Refund
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Customer:</span>
                  <span>{returnData.customer_name || 'Walk-in Customer'}</span>
                </div>
                {returnData.customer_email && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Email:</span>
                    <span>{returnData.customer_email}</span>
                  </div>
                )}
                {returnData.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Phone:</span>
                    <span>{returnData.customer_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-secondary">Refund Method:</span>
                  <span className="capitalize">{returnData.refund_method.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Return Reason:</span>
                  <span className="capitalize">{returnData.return_reason.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Return Reason Notes */}
          {returnData.return_reason_notes && (
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h4 className="font-medium text-text-primary mb-2">Additional Notes</h4>
              <p className="text-text-secondary">{returnData.return_reason_notes}</p>
            </div>
          )}

          {/* Return Items */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
              <Package size={20} />
              Returned Items
            </h3>
            
            {returnData.items && returnData.items.length > 0 ? (
              <div className="space-y-3">
                {returnData.items.map((item, index) => (
                  <div key={index} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-text-primary">{item.product_name}</h4>
                        <p className="text-sm text-text-secondary">SKU: {item.product_sku}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-medium">
                          {formatCurrency(item.total_amount)}
                        </div>
                        <div className="text-sm text-text-secondary">
                          {item.quantity_returned} × {formatCurrency(item.unit_price)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConditionColor(item.return_condition)}`}>
                          {item.return_condition.charAt(0).toUpperCase() + item.return_condition.slice(1)}
                        </span>
                        {item.restockable ? (
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            Restockable
                          </span>
                        ) : (
                          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                            Not Restockable
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-text-secondary">
                        Original Qty: {item.original_quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <Package size={48} className="mx-auto mb-4 opacity-50" />
                <p>No items found for this return</p>
              </div>
            )}
          </div>

          {/* Return Summary */}
          <div className="bg-primary-light p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-text-primary">Total Return Amount:</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(returnData.total_return_amount)}
              </span>
            </div>
            {returnData.items && (
              <div className="flex justify-between items-center mt-2 text-sm text-text-secondary">
                <span>Total Items: {returnData.items.length}</span>
                <span>
                  Total Quantity: {returnData.items.reduce((sum, item) => sum + item.quantity_returned, 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        {returnData.status === 'pending' && (onComplete || onCancel) && (
          <div className="flex items-center justify-between p-6 border-t bg-gray-50 dark:bg-muted/50">
            <div className="text-sm text-text-secondary">
              This return is pending and can be completed or cancelled.
            </div>
            
            <div className="flex items-center gap-3">
              {onCancel && (
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <XCircle size={16} />
                  Cancel Return
                </button>
              )}
              {onComplete && (
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  {loading ? 'Processing...' : 'Complete Return'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completed/Cancelled Status */}
        {returnData.status !== 'pending' && (
          <div className="p-6 border-t bg-gray-50 dark:bg-muted/50">
            <div className="flex items-center justify-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                returnData.status === 'completed' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {returnData.status === 'completed' ? (
                  <CheckCircle size={16} />
                ) : (
                  <XCircle size={16} />
                )}
                <span className="font-medium">
                  Return {returnData.status === 'completed' ? 'Completed' : 'Cancelled'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnDetailsModal;
