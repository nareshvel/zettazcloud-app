import React, { useRef } from 'react';
import { PurchaseOrder, PurchaseOrderItem } from '@/types'; 
import { Button } from '@/components/ui/button'; 
import { Printer } from 'lucide-react'; 
import { useFormattingBridge } from '@/utils/formatBridge';
import { useAuth } from '@/contexts/AuthContext';
import ModalBase from '@/components/ui/ModalBase'; 

interface ViewPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder | null; 
}

const ViewPurchaseOrderModal: React.FC<ViewPurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  purchaseOrder,
}) => {
  const { user } = useAuth();
  const { formatCurrency } = useFormattingBridge();
  const modalContentRef = useRef<HTMLDivElement>(null); 

  const handlePrint = () => {
    const nodeToPrint = modalContentRef.current;
    if (!nodeToPrint) return;

    const printContents = nodeToPrint.innerHTML;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('title', 'Print Frame'); // For accessibility
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      console.error('Could not access iframe document for printing.');
      return;
    }

    iframeDoc.open();
    iframeDoc.write('<html><head><title>Print Purchase Order</title>');

    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
    stylesheets.forEach(styleSheet => {
      iframeDoc.write(styleSheet.outerHTML);
    });
    
    iframeDoc.write(`
      <style>
        @media print {
          body {
            margin: 20px !important; 
            color: #000 !important; 
            background-color: #fff !important;
          }
          .print-content-area {
            width: 100% !important;
            box-shadow: none !important; /* Remove any shadows for print */
            border: none !important; /* Remove any borders for print */
          }
          /* Ensure all elements within print-content-area are visible */
          .print-content-area, .print-content-area * {
            visibility: visible !important; 
          }
        }
      </style>
    `);

    iframeDoc.write('</head><body>');
    iframeDoc.write(`<div class="print-content-area">${printContents}</div>`); // Wrap content for consistent styling
    iframeDoc.write('</body></html>');
    iframeDoc.close();

    iframe.onload = function() {
      const iframeWin = iframe.contentWindow;
      if (iframeWin) {
        // Use requestAnimationFrame to ensure rendering before print
        iframeWin.requestAnimationFrame(() => {
          try {
            iframeWin.focus(); 
            iframeWin.print(); 
          } catch (error) {
            console.error('Error during printing:', error);
          } finally {
            // Delayed cleanup to allow print dialog to process
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000); // Increased delay slightly
          }
        });
      } else {
        console.error('Iframe contentWindow is not available for printing.');
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }
    };
  };

  if (!purchaseOrder) return null; 

  const storeName = user?.store?.name || 'Your Business Name';

  const footerButtons = (
    <>
      <Button 
        variant="outline" 
        onClick={handlePrint} 
      >
        <Printer size={18} className="mr-2" /> Print
      </Button>
      <Button 
        variant="ghost" 
        onClick={onClose} 
      >
        Close
      </Button>
    </>
  );

  return (
    <ModalBase 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Purchase Order Details" 
      footerContent={footerButtons}
      size="3xl" 
    >
      <div ref={modalContentRef} className="print-content-area">
        <div style={{ textAlign: 'center', marginBottom: '24px', padding: '10px' }} className="pdf-store-header print:block hidden">
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#000000' }}>{storeName}</h1>
        </div>

        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-text-secondary">
              PO Number: <span className="font-medium text-text-DEFAULT">{purchaseOrder.purchase_order_number}</span>
            </p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-medium px-2 py-1 inline-block rounded 
              ${purchaseOrder.status === 'ORDERED' ? 'bg-primary/10 text-primary' :
                purchaseOrder.status === 'RECEIVED' ? 'bg-success-light text-success-text' :
                purchaseOrder.status === 'CANCELLED' ? 'bg-danger-light text-danger-text' :
                'bg-muted text-muted-foreground'}`}>
              Status: {purchaseOrder.status}
            </p>
            <p className="text-xs text-text-secondary mt-1">Order Date: {new Date(purchaseOrder.order_date).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6 pb-6 border-b border-border-DEFAULT">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Supplier</p>
            <p className="text-base text-text-DEFAULT font-medium">{purchaseOrder.supplier_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Expected Delivery</p>
            <p className="text-base text-text-DEFAULT">{purchaseOrder.expected_delivery_date ? new Date(purchaseOrder.expected_delivery_date).toLocaleDateString() : 'N/A'}</p>
          </div>
          {purchaseOrder.notes && (
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
              <p className="text-sm text-text-secondary italic bg-muted/50 p-2 rounded">{purchaseOrder.notes}</p>
            </div>
          )}
        </div>

        <div className="mt-6 mb-4">
          <h4 className="text-xl font-semibold text-gray-800 dark:text-foreground mb-4">Order Items</h4>
        </div>

        {purchaseOrder.items && purchaseOrder.items.length > 0 ? (
          <div className="overflow-x-auto rounded border border-border-DEFAULT mb-6">
            <table className="min-w-full divide-y divide-border-DEFAULT">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost Price</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Line Total</th>
                </tr>
              </thead>
              <tbody className="bg-background-modal divide-y divide-border-DEFAULT">
                {purchaseOrder.items.map((item: PurchaseOrderItem, index: number) => ( 
                  <tr key={item.id || `item-${index}-${item.product_id}`}> 
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-DEFAULT">{item.product_name || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-DEFAULT text-right">{item.quantity_ordered}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-DEFAULT text-right">{formatCurrency(item.cost_price)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-DEFAULT text-right">{formatCurrency(item.quantity_ordered * item.cost_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-secondary italic mb-6">No items in this purchase order.</p>
        )}

        <div className="flex justify-end mb-6">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="text-text-DEFAULT font-medium">{formatCurrency(purchaseOrder.items?.reduce((sum: number, item: PurchaseOrderItem) => sum + (item.quantity_ordered * item.cost_price), 0) || 0)}</span> 
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-border-DEFAULT">
              <span className="text-text-DEFAULT">Grand Total:</span>
              <span className="text-text-DEFAULT">{formatCurrency(purchaseOrder.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};

export default ViewPurchaseOrderModal;
