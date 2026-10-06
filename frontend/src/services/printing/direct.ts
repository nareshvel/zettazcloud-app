import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { API_BASE_URL } from '../../config';
import { logger } from '../../utils/logger';

export interface PrinterSettingsLike {
  printer_name?: string;
  paper_width: number;
}

export interface ReceiptDataLike {
  saleId: string;
  discountAmount?: number;
  discountType?: string;
  discountValue?: number;
}

export const printReceiptToNetworkPrinter = async (
  html: string,
  css: string,
  printerSettings: PrinterSettingsLike,
  receiptData?: string | ReceiptDataLike
): Promise<boolean> => {
  try {
    if (!printerSettings.printer_name) {
      throw new Error('Printer name is not specified in settings');
    }

    const fullHtml = `<style>${css}</style>${html}`;

    let paperWidth: string = '80mm';
    if (printerSettings.paper_width === 58) {
      paperWidth = '58mm';
    }

    logger.log('Sending to printer:', printerSettings.printer_name);
    logger.log('Using paper width:', paperWidth);

    const response = await fetchWithAuth(`${API_BASE_URL.replace(/\/api$/, '')}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printerSettings.printer_name,
        content: fullHtml,
        paperWidth,
        ...(typeof receiptData === 'string'
          ? { saleId: receiptData }
          : receiptData ? {
              saleId: receiptData.saleId,
              discountAmount: receiptData.discountAmount,
              discountType: receiptData.discountType,
              discountValue: receiptData.discountValue,
            } : {}),
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to send print job to printer';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
        if (response.status === 0) errorMessage = 'Network error or CORS issue';
      }
      logger.error(`Printer API error (${response.status}): ${errorMessage}`);
      throw new Error(`Printer API error: ${errorMessage}`);
    }

    try {
      const responseBody = await response.text();
      if (responseBody) {
        const data = JSON.parse(responseBody);
        if (data && data.success === false) {
          logger.error(`Printer error (backend success:false): ${data.message || 'Unknown printer issue'}`);
          throw new Error(data.message || 'Unknown printer issue from backend');
        }
      }
    } catch (e: any) {
      logger.warn('Could not parse JSON from successful print response:', e.message);
    }

    return true;
  } catch (error: any) {
    console.error('Error printing to network printer:', error);
    const errorMessageString = typeof error.message === 'string' ? error.message : 'Connection error';
    throw new Error(`Network print failed: ${errorMessageString}`);
  }
};

export async function testPrinterConnection(printerAddress: string) {
  if (!printerAddress) {
    throw new Error('Printer address is not specified');
  }

  const [ip, port = '9100'] = printerAddress.split(':');

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/print/test/${ip}?port=${port}`, { method: 'GET' });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Printer connection test failed');
    }

    return true;
  } catch (error: any) {
    console.error('Printer connection test failed:', error);
    throw new Error(`Printer not available: ${error.message || 'Connection test failed'}`);
  }
}
