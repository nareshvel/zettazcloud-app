import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReceiptForReturn } from '@/services/receiptService';
import { useStore } from '@/contexts/StoreContext';
import { getPrinterSettings } from '@/services/printerService';
import { toast } from 'react-hot-toast';

const PrintReturnPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { store } = useStore();

  useEffect(() => {
    const printReturn = async () => {
      if (!id) {
        navigate(-1);
        return;
      }
      
      try {
        console.log('Printing return receipt for ID:', id);
        
        // Get printer settings and store info
        const settings = store?.id ? await getPrinterSettings(store.id) : undefined;
        const storeInfo = {
          id: store?.id || '',
          tenantId: store?.tenantId || '',
          name: store?.name || 'Zettaz Store',
          address: store?.address || '',
          phone: store?.phone || '',
          email: store?.email || '',
          currencyCode: store?.currencyCode || 'USD',
        };
        
        // Get receipt HTML and CSS
        const receipt = await getReceiptForReturn(id, settings || undefined, storeInfo);
        
        if (!receipt.html || receipt.html.trim() === '') {
          console.warn('Empty receipt HTML received');
          toast.error('Unable to generate receipt for printing');
          navigate('/sales-returns');
          return;
        }
        
        // Print directly using browser print - simple approach
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast.error('Could not open print window. Please check popup blocker settings.');
          navigate('/sales-returns');
          return;
        }

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Return Receipt</title>
              <style>${receipt.css}</style>
            </head>
            <body>
              ${receipt.html}
              <script>
                window.onload = function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                  // Fallback close after 2 seconds if onafterprint doesn't fire
                  setTimeout(function() {
                    window.close();
                  }, 2000);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        
        // Wait a moment for print window to fully load, then navigate back
        setTimeout(() => {
          navigate('/sales-returns');
        }, 500);
        
      } catch (error) {
        console.error('Failed to print return receipt:', error);
        toast.error('Unable to print receipt');
        navigate('/sales-returns');
      }
    };
    
    printReturn();
  }, [id, store?.id, navigate]);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Preparing Receipt for Print...</h2>
        <p>Opening print dialog...</p>
      </div>
    </div>
  );
};

export default PrintReturnPage;
