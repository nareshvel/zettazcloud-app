import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Corrected path
import { X, Printer } from 'lucide-react';
import { printReceipt, PrinterSettings } from '../../services/printerService';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptContent: {
    html: string;
    css: string;
  };
  autoPrint?: boolean;
  // Sale object is kept in the interface for compatibility but not used in this component
  sale?: any;
  printerSettings?: PrinterSettings; // Added to accept printer settings
  title?: string; // Optional modal title
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ 
  isOpen, 
  onClose, 
  receiptContent,
  autoPrint = false,
  printerSettings, // Destructure printerSettings from props
  title = 'Receipt Details',
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const { user } = useAuth(); // Get user from AuthContext

  // Handle auto-print when modal opens
  useEffect(() => {
    if (isOpen && autoPrint && receiptContent?.html) {
      // Slight delay can improve reliability of programmatic print in some browsers
      const t = setTimeout(() => {
        console.log('[ReceiptModal] Auto-print triggered');
        handlePrint();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [isOpen, autoPrint, receiptContent]);

  // Handle print action
  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      
      // Use the imported printReceipt function from printerService
      // This will handle both network and browser printing based on settings
      console.log('Printing receipt from modal');
      const storeIdentifier = user?.store?.id || user?.storeId; // Access storeId from user.store.id or user.storeId
      if (!storeIdentifier) {
        console.warn('ReceiptModal: storeId is not available from user. Printer settings might not be store-specific.');
        
      }
      // Ensure null is converted to undefined for the printReceipt function's parameter type
      await printReceipt(receiptContent.html, receiptContent.css, printerSettings, undefined, storeIdentifier || undefined);
      console.log('Print job completed');
    } catch (error) {
      console.error('Error printing receipt:', error);
      // Fall back to browser printing if anything fails
      openBrowserPrint(receiptContent.html, receiptContent.css);
    } finally {
      setIsPrinting(false);
    }
  };
  
  // Browser print helper function
  const openBrowserPrint = (html: string, css: string): void => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Could not open print window. Please check your popup blocker settings.');
    }

    // Write the receipt HTML and CSS to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt</title>
          <style>${css}</style>
        </head>
        <body>
          ${html}
          <script>
            // Auto print when loaded
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Download functionality removed (unused)

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Receipt content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div 
            className="receipt-container bg-white"
            style={{ fontFamily: 'monospace', fontSize: '14px' }}
          >
            {/* Inject receipt CSS for accurate preview */}
            <style>{receiptContent.css}</style>
            {/* Formatted receipt content */}
            <div dangerouslySetInnerHTML={{ __html: receiptContent.html }} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-4 py-2 flex items-center text-white bg-primary rounded-md shadow-sm hover:bg-primary/90 disabled:bg-primary/60"
          >
            <Printer size={18} className="mr-2" />
            {isPrinting ? 'Printing...' : 'Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
