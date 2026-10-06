import React from 'react';
import { useCart } from '../../contexts/CartContext';
import { HeldOrder } from '@/types';
import { X, RotateCcw, Trash2 } from 'lucide-react';

interface HeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HeldOrdersModal: React.FC<HeldOrdersModalProps> = ({ isOpen, onClose }) => {
  const { heldOrders, restoreHeldOrder, deleteHeldOrder } = useCart();

  if (!isOpen) return null;

  const handleRestore = (orderId: string) => {
    if (!orderId) {
      console.error('[HeldOrdersModal DEBUG] orderId is undefined or null in handleRestore. Cannot restore.');
      return;
    }
    restoreHeldOrder(orderId);
    onClose(); // Close modal after restoring
  };

  const handleDelete = (orderId: string) => {
    // Optional: Add a confirmation step here if desired
    deleteHeldOrder(orderId);
    // toast.info('Held order deleted.'); // Toast is already in CartContext
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-card p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col z-50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Held Orders</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-200 dark:bg-muted"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {heldOrders.length === 0 ? (
          <p className="text-gray-600 dark:text-muted-foreground text-center py-8">No orders are currently on hold.</p>
        ) : (
          <div className="overflow-y-auto flex-grow">
            <ul className="space-y-3">
              {heldOrders.map((order: HeldOrder) => (
                <li key={order.id} className="p-4 border rounded-md bg-gray-50 dark:bg-muted/50 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg">{order.name || `Order ID: ${order.id.substring(0, 8)}`}</h3>
                      <p className="text-sm text-gray-500 dark:text-muted-foreground">
                        Held at: {order.heldAt ? `${new Date(order.heldAt).toLocaleTimeString()} on ${new Date(order.heldAt).toLocaleDateString()}` : (order.timestamp ? new Date(order.timestamp).toLocaleString() : 'Unknown')}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-muted-foreground">
                        Items: {order.items.length} | Total: ${order.totalAmount?.toFixed(2) || '0.00'}
                      </p>
                      {order.customer && (
                        <p className="text-sm text-gray-500 dark:text-muted-foreground">
                          Customer: {order.customer.firstName} {order.customer.lastName || ''}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2 flex-shrink-0 ml-4">
                      <button 
                        onClick={() => {
                          handleRestore(order.id);
                        }}
                        className="flex items-center px-3 py-1.5 text-sm border border-green-500 text-green-600 rounded-md hover:bg-green-50 transition-colors"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore
                      </button>
                      <button 
                        onClick={() => handleDelete(order.id)}
                        className="flex items-center px-3 py-1.5 text-sm border border-red-500 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="mt-6 text-right">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-border rounded-md hover:bg-gray-100 dark:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HeldOrdersModal;
