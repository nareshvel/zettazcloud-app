import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface PrintPreviewModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ 
  title, 
  isOpen, 
  onClose, 
  content 
}) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this website to print.');
      return;
    }

    // Transfer styles and content to new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            /* General print fidelity */
            html, body { height: 100%; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            /* Default page for receipts: 80mm width, auto height */
            @page { size: 80mm auto; margin: 0; }
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
              .receipt { width: 80mm; }
            }
            /* Screen preview helpers */
            .receipt { width: 80mm; margin: 0 auto; background: white; color: #111827; }
            .receipt-inner { padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.4; }
            .rc-center { text-align: center; }
            .rc-muted { color: #6b7280; }
            .rc-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
            .rc-sep { border-top: 1px dashed #d1d5db; margin: 6px 0; }
            .rc-strong { font-weight: 700; }
            .rc-title { font-size: 14px; font-weight: 700; }
            .rc-sm { font-size: 11px; }
            table.rc-table { width: 100%; border-collapse: collapse; }
            table.rc-table th, table.rc-table td { padding: 4px 0; }
            table.rc-table th { text-align: left; font-weight: 600; font-size: 11px; color: #374151; }
            table.rc-table td.rc-num { text-align: right; white-space: nowrap; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Give the browser time to process the document
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Close window after print (optional)
      printWindow.onafterprint = () => printWindow.close();
    }, 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
        <DialogHeader className="border-b pb-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Preview document for printing. Use the print button to print or save as PDF.
          </DialogDescription>
        </DialogHeader>
        <div 
          className="flex-1 overflow-auto mt-4 border rounded-md p-4"
          dangerouslySetInnerHTML={{ __html: content }}
        />
        
        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button 
            onClick={handlePrint}
            className="flex gap-1 items-center"
          >
            <Printer size={16} />
            <span>Print</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPreviewModal;
