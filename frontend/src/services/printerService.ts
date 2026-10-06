// Import utilities
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { API_BASE_URL } from '../config';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

// Constants for receipt generation
export const DEFAULT_PAPER_WIDTH = 80; // mm

// Types for receipt printing feature
export interface PrinterSettings {
  id?: string;
  tenant_id?: string;
  store_id: string;
  enabled: boolean;
  auto_print: boolean;
  print_mode: 'browser' | 'direct' | 'server' | 'local-agent';
  printer_name?: string;
  paper_width: number;
  template_id?: string;
  header?: string;
  footer?: string;
  logo_url?: string;
  usePrintTemplates?: boolean;
}

// Ensure API URLs always include a single '/api' prefix regardless of env config
const buildApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const base = API_BASE_URL || '';
  const baseEndsWithApi = /\/api\/?$/.test(base);
  const endpointStartsWithApi = endpoint.startsWith('/api');
  if (baseEndsWithApi) return `${base}${endpoint}`;
  const apiPrefix = endpointStartsWithApi ? '' : '/api';
  return `${base}${apiPrefix}${endpoint}`;
};

// Extract tenant_id from JWT (stored in localStorage as 'auth_token')
const getTenantIdFromToken = (): string | undefined => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return undefined;
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.tenant_id || payload?.tenantId || undefined;
  } catch {
    return undefined;
  }
};

// Query printers from Local Agent
export interface LocalAgentPrinter {
  id?: string;
  name: string;
  isDefault?: boolean;
}

export const resolveLocalAgentPrinterId = (configured: string | undefined, printers: LocalAgentPrinter[]): string => {
  const value = configured?.trim();
  if (value) {
    const match = printers.find((printer) => printer.id === value || printer.name === value);
    if (!match) throw new Error(`Configured system printer "${value}" is not available in the Local Agent`);
    return match.id || match.name;
  }
  const selected = printers.find((printer) => printer.isDefault);
  return selected?.id || selected?.name || '';
};

export const shouldUseLocalAgent = (printMode: string): boolean => printMode === 'local-agent';

export const buildNetworkAgentJob = (address: string, payloadBase64: string, paperWidth: string) => ({
  id: crypto.randomUUID(),
  clientId: 'zettaz-cloud',
  destination: 'tcp',
  printerId: '',
  address,
  contentType: 'escpos',
  payloadBase64,
  copies: 1,
  mediaSize: paperWidth,
});

export const getLocalAgentPrinters = async (port: number = LOCAL_AGENT_DEFAULT_PORT): Promise<LocalAgentPrinter[]> => {
  const tryPorts = [port, ...LOCAL_AGENT_PORTS.filter(p => p !== port)];
  const { res } = await tryAgentFetch('/v1/printers', { headers: localAgentHeaders(), credentials: 'omit' }, tryPorts);
  if (!res.ok) throw new Error(`Failed to fetch printers from Local Agent (${res.status})`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data?.printers) ? data.printers : Array.isArray(data) ? data : [];
    return list.map((p: any) => ({ id: p.id ? String(p.id) : undefined, name: String(p.name || p), isDefault: !!(p.isDefault || p.default) }));
  }
  const txt = await res.text();
  return txt.split('\n').filter(Boolean).map(n => ({ name: n }));
};

// Test print via Local Agent
export const testLocalAgent = async (_printer?: string, port: number = LOCAL_AGENT_DEFAULT_PORT): Promise<boolean> => {
  const tryPorts = [port, ...LOCAL_AGENT_PORTS.filter(p => p !== port)];
  const { res } = await tryAgentFetch('/v1/printers', {
    method: 'GET',
    headers: localAgentHeaders(),
    credentials: 'omit',
  }, tryPorts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j?.message || msg; } catch {}
    throw new Error(`Local Agent test failed: ${msg}`);
  }
  return true;
};

// Local Agent helpers
const LOCAL_AGENT_DEFAULT_PORT = 9419;
const LOCAL_AGENT_FALLBACK_PORT = 9420;
const LOCAL_AGENT_PORTS = [LOCAL_AGENT_DEFAULT_PORT, LOCAL_AGENT_FALLBACK_PORT];
const localAgentHeaders = (json = false): HeadersInit => {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('zettaz-print-agent-token');
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
};
const buildLocalAgentUrl = (endpoint: string, port: number = LOCAL_AGENT_DEFAULT_PORT): string => {
  const base = `http://127.0.0.1:${port}`;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${normalized}`;
};

// Try multiple ports in sequence until one responds
const tryAgentFetch = async (
  endpoint: string,
  init?: RequestInit,
  ports: number[] = LOCAL_AGENT_PORTS
): Promise<{ res: Response; port: number }> => {
  let lastErr: any = null;
  for (const p of ports) {
    try {
      const res = await fetch(buildLocalAgentUrl(endpoint, p), init);
      return { res, port: p };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Local Agent not reachable on any known port');
};

// Fast health probe to detect if Local Agent is available
export const isLocalAgentAvailable = async (port: number = LOCAL_AGENT_DEFAULT_PORT, timeoutMs = 400): Promise<boolean> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Try preferred port first, then fallback
    const tryPorts = [port, ...LOCAL_AGENT_PORTS.filter(p => p !== port)];
    const { res } = await tryAgentFetch('/health', { signal: controller.signal, credentials: 'omit' }, tryPorts);
    clearTimeout(t);
    if (!res.ok) return false;
    // Expect JSON { status: 'ok' } or text 'ok'
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await res.json().catch(() => null);
      return !!j && (j.status === 'ok' || j.ok === true);
    } else {
      const txt = await res.text().catch(() => '');
      return /^ok/i.test(txt);
    }
  } catch {
    clearTimeout(t);
    return false;
  }
};

const htmlToPdfBase64 = async (html: string, css: string, paperWidth: number): Promise<string> => {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const isPage = paperWidth >= 200;
  // Page-format documents (Invoice) are ALWAYS generated by
  // buildPrintableHtml() using paperSize: 'a4' — PAPER_SIZE_PHYSICAL in
  // types/printTemplate.ts has no 'letter' entry at all, so the Designer
  // content is physically laid out for a 210mm x 297mm page no matter what
  // paper_width a store's Printer Settings row happens to store (which can
  // be 215.9/216 for "Letter"). Sizing this render frame/PDF from that
  // unrelated number instead of the true 210x297mm the content was designed
  // for is what caused the printed page to not match the template. Always
  // use real A4 dimensions for page jobs; only thermal (receipt/refund)
  // jobs still take their width from the store's configured paper_width.
  const widthMm = isPage ? 210 : Math.max(58, paperWidth);
  const heightMm = isPage ? 297 : undefined; // thermal height computed from content below
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.width = `${widthMm}mm`;
  iframe.style.height = isPage ? '297mm' : '400mm';
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Unable to create PDF render frame');
    doc.open();
    // `html` (built by printReceipt below) is ALREADY a complete
    // <!DOCTYPE html><html><head><style>...</style></head><body>...</body></html>
    // document — it carries the real margin-safe CSS (the 18mm/16mm inset
    // that keeps page-format content off the paper's physical edge). Writing
    // it directly here used to be wrapped in a SECOND synthetic
    // <html><head><style>${css}</style></head><body>${html}</body></html>,
    // nesting one complete document inside another document's <body>. That
    // malformed markup put the caller's real <head><style> (with the margin
    // fix) inside the OUTER <body> instead of a real <head> — browsers are
    // lenient enough to still apply most such rules most of the time, but
    // this is exactly the kind of "usually works" leniency that produced the
    // left-clipped invoice bug this comment is here to prevent recurring.
    // Only fall back to wrapping when the caller hands over a bare fragment
    // (no caller currently does, but this keeps the function's contract
    // honest for `css` rather than silently dropping it).
    const isFullDocument = /<html[\s>]/i.test(html);
    doc.write(isFullDocument
      ? html
      : `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${html}</body></html>`);
    doc.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const canvas = await html2canvas(doc.body, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const finalHeightMm = isPage ? (heightMm as number) : Math.max(25, widthMm * canvas.height / canvas.width);
    const pdf = new jsPDF({ unit: 'mm', format: [widthMm, finalHeightMm], orientation: 'portrait', compress: true });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, finalHeightMm);
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  } finally {
    iframe.remove();
  }
};

export const rgbaToEscposRasterBase64 = (rgba: Uint8ClampedArray, width: number, height: number): string => {
  const widthBytes = Math.ceil(width / 8);
  const rasterOffset = 10;
  const rasterLength = widthBytes * height;
  const full = new Uint8Array(rasterOffset + rasterLength + 6);
  full.set([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, height & 0xff, height >> 8]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = rgba[offset + 3] / 255;
      const luminance = (0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]) * alpha + 255 * (1 - alpha);
      if (luminance < 180) full[rasterOffset + y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  full.set([0x1b, 0x64, 0x05, 0x1d, 0x56, 0x00], rasterOffset + rasterLength);
  let binary = '';
  for (let i = 0; i < full.length; i += 0x8000) binary += String.fromCharCode(...full.subarray(i, i + 0x8000));
  return btoa(binary);
};

const htmlToEscposRasterBase64 = async (html: string, paperWidth: number): Promise<string> => {
  const { default: html2canvas } = await import('html2canvas');
  const width = paperWidth === 58 ? 384 : 576;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.width = `${paperWidth}mm`;
  iframe.style.height = '1px';
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Unable to create ESC/POS render frame');
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const source = await html2canvas(doc.documentElement, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const height = Math.max(1, Math.ceil(source.height * width / source.width));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create ESC/POS raster canvas');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    return rgbaToEscposRasterBase64(context.getImageData(0, 0, width, height).data, width, height);
  } finally {
    iframe.remove();
  }
};

const printViaLocalAgent = async (
  html: string,
  css: string,
  printerSettings: PrinterSettings
): Promise<boolean> => {
  // paper_width >= 200 means this job is going to a page-format (system/Canon)
  // printer via a print_templates Invoice/jewelry_invoice document — NOT a
  // thermal roll. The override block below used to apply unconditionally,
  // forcing monospace font + `color/background !important` + a hardcoded
  // 58/80mm @page size onto every local-agent job, which silently stripped
  // the Designer template's actual fonts, colors and layout for Invoice
  // prints and produced a garbled, receipt-shaped printout on real page
  // printers. Only thermal (receipt/refund) jobs should get these overrides;
  // page-format jobs must render with nothing but the template's own css.
  const isThermalJob = printerSettings.paper_width < 200;

  // `!important` on every margin/padding/box-sizing declaration below is
  // deliberate, not decoration. `html` (built by buildPrintableHtml, for
  // every print-templates document type) is ALREADY a complete
  // <!DOCTYPE html><html><head><style>...</style></head><body>...</body></html>
  // document in its own right — its own <style> resets `html, body { margin:
  // 0; padding: 0; }`. When that whole document used to get nested inside a
  // SECOND synthetic <html><body>${html}</body></html> wrapper below, the
  // parser flattens both documents' content into one real <body> — but the
  // template's OWN <style> tag ends up LATER in document order than this
  // function's override <style>. Same selector (`body`), same specificity,
  // later source order wins: the template's `padding: 0` silently cancelled
  // out the page-format branch's `padding: 18mm 16mm` safe-margin fix below,
  // producing a full-bleed rasterised page that the printer's own physical
  // unprintable margin then hard-clipped — this is what was cutting the left
  // edge off every checkout-printed invoice while the Designer's own preview
  // (real browser print, never touches this function) printed fine. Fixed
  // structurally by injecting into the document's REAL head instead of
  // double-wrapping (see isFullDocument below); `!important` is kept as a
  // second, independent line of defence so a future reordering can't
  // reintroduce the same class of bug silently.
  const thermalOverrides = isThermalJob ? `
    /* Additional styles for local agent thermal (receipt/refund) printing */
    @page {
      size: ${printerSettings.paper_width === 58 ? '58mm' : '80mm'} auto;
      margin: 0 !important;
    }
    body {
      margin: 0 !important;
      padding: 2px 0 !important;
      font-family: 'Courier New', monospace !important;
      color: #000 !important;
      background: #fff !important;
      line-height: 1.2;
      width: 100%;
      box-sizing: border-box !important;
    }
    * {
      color: #000 !important;
      background: transparent !important;
      box-sizing: border-box !important;
    }
    .receipt {
      width: 100%;
      page-break-inside: avoid;
    }
    .receipt-header, .receipt-info, .receipt-items, .receipt-totals, .receipt-footer {
      page-break-inside: avoid;
    }
    .receipt-footer, .receipt-footer p, .thank-you {
      color: #000 !important;
      font-weight: bold !important;
    }
  ` : `
    /* Page-format (Invoice) job: keep the template's own fonts/colors/
       borders exactly as designed. The Designer (buildPrintableHtml) always
       renders Invoice content for a 210mm x 297mm A4 page with an
       "@page { margin: 18mm 16mm }" rule (see PAPER_SIZE_PHYSICAL.a4 in
       types/printTemplate.ts) — that margin is what keeps text off the
       paper's physical edges. @page margins are ONLY honoured by a real
       browser print/print-to-PDF engine; html2canvas (what this local-agent
       path uses to rasterise the page) ignores @page entirely and the
       template's own CSS resets body margin/padding to 0, so without this
       the rendered page had text running edge-to-edge with no safe margin.
       Most printers cannot physically print to the true edge of the sheet,
       so a 0-margin page like that gets shifted/clipped by the print
       driver to fit its guaranteed printable area — this is what was
       cutting off the left side of every printed invoice line. Re-apply the
       exact same 18mm/16mm inset here as real body padding so the
       html2canvas render has the same safe margin the Designer intended. */
    @page {
      size: A4;
      margin: 0 !important;
    }
    body {
      margin: 0 !important;
      padding: 18mm 16mm !important;
      box-sizing: border-box !important;
    }
  `;

  // `html` is always a complete document in practice — every print-templates
  // caller (buildPrintableHtml) and every legacy hand-rolled service
  // (repairPrintService.ts, oldGoldPrintService.ts, memoPrintService.ts,
  // layawayPrintService.ts) builds its own full <!DOCTYPE html> document.
  // Injecting our overrides into that document's REAL <head> — rather than
  // wrapping the whole thing inside a second synthetic document's <body>, as
  // this used to do — is what makes the `!important` guarantees above
  // actually reach a single, real stylesheet cascade instead of a
  // structurally invalid nested one. A bare HTML fragment (no caller
  // currently passes one) still falls back to the old wrap-in-a-new-document
  // behaviour so the function's contract holds either way.
  const isFullDocument = /<html[\s>]/i.test(html);
  const fullHtmlContent = isFullDocument
    ? (/<\/head>/i.test(html)
      ? html.replace(/<\/head>/i, `<style>${css}\n${thermalOverrides}</style></head>`)
      : html.replace(/<body[\s>]/i, (m) => `<head><style>${css}\n${thermalOverrides}</style></head>${m}`))
    : `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${isThermalJob ? 'Receipt' : 'Invoice'}</title>
  <style>
    ${css}
    ${thermalOverrides}
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

  const payloadBase64 = await htmlToPdfBase64(fullHtmlContent, '', printerSettings.paper_width);
  const printers = await getLocalAgentPrinters();
  const printerId = resolveLocalAgentPrinterId(printerSettings.printer_name, printers);
  const payload = {
    id: crypto.randomUUID(),
    clientId: 'zettaz-cloud',
    destination: 'system',
    printerId,
    contentType: 'pdf',
    payloadBase64,
    copies: 1,
    // The PDF itself is now always built at true A4 (210x297mm) for any
    // page-format job (see htmlToPdfBase64) — Invoice content has no Letter
    // layout to be sized for. Tell the agent/print driver the PDF really is
    // A4 so it scales cleanly onto whatever paper is loaded (a normal,
    // non-destructive operation printer drivers do every day) instead of us
    // asserting "letter" for a page that is actually A4 internally, which
    // was part of what produced a mismatched, clipped printout.
    mediaSize: isThermalJob ? `${printerSettings.paper_width}mm` : 'a4',
  };

  const { res, port } = await tryAgentFetch('/v1/jobs', {
    method: 'POST',
    headers: localAgentHeaders(true),
    body: JSON.stringify(payload),
    credentials: 'omit',
  });
  
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = await res.json();
      message = j?.message || j?.error || message;
      console.error('[Local Agent] Error response:', j);
    } catch {}
    throw new Error(`Local Agent print failed: ${message}`);
  }
  
  let status: any = null;
  try { status = await res.json(); } catch { /* ignore */ }
  for (let attempt = 0; status?.state === 'queued' || status?.state === 'processing'; attempt += 1) {
    if (attempt >= 40) throw new Error('Local Agent print timed out while waiting for completion');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const result = await fetch(buildLocalAgentUrl(`/v1/jobs/${payload.id}`, port), {
      headers: localAgentHeaders(), credentials: 'omit', cache: 'no-store',
    });
    if (!result.ok) throw new Error(`Unable to read Local Agent job status (${result.status})`);
    status = await result.json();
  }
  if (status?.state === 'failed' || status?.state === 'cancelled') {
    throw new Error(status.error || `Local Agent job ${status.state}`);
  }
  return true;
};

// Get printer settings for a specific store
export const getPrinterSettings = async (storeId: string): Promise<PrinterSettings | null> => {
  // logger.debug(`[printerService] getPrinterSettings CALLED with storeId: ${storeId}`);
  
  try {
    const tenantId = getTenantIdFromToken();
    const response = await fetchWithAuth(buildApiUrl(`/settings/printer/${storeId}`), {
      headers: tenantId ? { 'x-tenant-id': tenantId } : undefined,
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        // This warning is useful, so keeping it.
        console.warn(`[printerService] No printer settings found for store ${storeId}. This may be expected if not configured.`);
        return null;
      }
      // Log and throw for other errors
      console.error(`[printerService] Error fetching printer settings for store ${storeId}: ${response.status} ${response.statusText}`);
      throw new Error(`Error fetching printer settings: ${response.statusText}`);
    }
    // Some backends may return 204 No Content on missing settings
    if (response.status === 204) {
      console.warn(`[printerService] No Content (204) for printer settings store ${storeId}. Returning defaults.`);
      return {
        store_id: storeId,
        enabled: true,
        auto_print: false,
        print_mode: 'browser',
        paper_width: 58,
      } as PrinterSettings;
    }

    // Safely parse JSON and accept multiple shapes: {data}, {settings}, or direct object
    const apiResponse = await response.json().catch(() => null as any);
    const rawSettings = apiResponse?.data ?? apiResponse?.settings ?? apiResponse ?? null;

    if (!rawSettings || (typeof rawSettings === 'object' && Object.keys(rawSettings).length === 0)) {
      console.warn(`[printerService] Printer settings data is null/empty after successful fetch for store ${storeId}. Returning defaults.`);
      return {
        store_id: storeId,
        enabled: true,
        auto_print: false,
        print_mode: 'browser',
        paper_width: 58,
      } as PrinterSettings;
    }

    // Helper to coerce boolean-ish values (0/1, '0'/'1', true/false)
    const toBool = (v: any) => v === true || v === 1 || v === '1' || v === 'true';

    // Normalize print_mode to UI-expected values
    const normalizeMode = (v: any): 'browser' | 'direct' | 'server' | 'local-agent' => {
      const s = String(v || 'browser').trim().toLowerCase();
      if (s === 'local-agent' || s === 'local_agent' || s === 'local agent') return 'local-agent';
      if (s === 'direct') return 'direct';
      if (s === 'server') return 'server';
      return 'browser';
    };

    const settings: PrinterSettings = {
      id: rawSettings.id,
      tenant_id: rawSettings.tenant_id,
      store_id: rawSettings.store_id,
      enabled: toBool(rawSettings.enabled),
      auto_print: toBool(rawSettings.auto_print),
      print_mode: normalizeMode(rawSettings.print_mode),
      printer_name: rawSettings.printer_name,
      paper_width: Number(rawSettings.paper_width) || 58,
      template_id: rawSettings.template_id,
      header: rawSettings.header,
      footer: rawSettings.footer,
      logo_url: rawSettings.logo_url,
      // Was silently dropped here — receiptService.ts's `usePrintTemplates` check
      // always saw `undefined` even when a tenant had switched this on and the
      // backend had persisted it correctly, so the Print Template Designer could
      // never actually be reached from POS checkout. See
      // docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md §2.
      usePrintTemplates: toBool(rawSettings.use_print_templates),
    };

    return settings;

  } catch (error: unknown) {
    console.error('[printerService] Exception in getPrinterSettings:', error);
    throw error; 
  }
};

// Update printer settings for a specific store
export const updatePrinterSettings = async (storeId: string, settings: Partial<PrinterSettings>): Promise<PrinterSettings | null> => {
  logger.log('Updating printer settings for store:', storeId);
  
  try {
    const tenantId = getTenantIdFromToken();
    const response = await fetchWithAuth(buildApiUrl(`/settings/printer/${storeId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
      body: JSON.stringify(settings),
    });
    
    if (!response.ok) {
      throw new Error(`Error updating printer settings: ${response.statusText}`);
    }
    
    await response.json();
    
    return await getPrinterSettings(storeId);
  } catch (error: unknown) {
    logger.error('Error updating printer settings:', error);
    throw error;
  }
};

// Test printer settings with sample data
export const testPrintSettings = async (storeId: string): Promise<{ success: boolean; template: string; receiptData: any }> => {
  logger.log('Testing printer settings for store:', storeId);
  
  try {
    const tenantId = getTenantIdFromToken();
    const response = await fetchWithAuth(buildApiUrl(`/settings/printer/${storeId}/test`), {
      method: 'POST'
    , headers: tenantId ? { 'x-tenant-id': tenantId } : undefined });
    
    if (!response.ok) {
      throw new Error(`Error testing printer settings: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data;
  } catch (error: unknown) {
    logger.error('Error testing printer settings:', error);
    
    return {
      success: false,
      template: '<html><body><h1>Test Receipt</h1><p>Error connecting to print server</p></body></html>',
      receiptData: {
        storeName: 'Test Store',
        receiptNumber: 'TEST-' + Date.now().toString().slice(-6),
        date: new Date().toLocaleString(),
        items: [{ name: 'Test Item', price: 10.00, quantity: 1, total: 10.00 }],
        subtotal: 10.00,
        tax: 1.00,
        total: 11.00,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

// REMOVED 2026-08-25 (Print Module Phase 1): getReceiptTemplates,
// getReceiptTemplate, createReceiptTemplate, updateReceiptTemplate,
// deleteReceiptTemplate, and the `ReceiptTemplate` interface. They called a
// `receipt_templates` backend table nothing ever wrote rows into — the real
// template store is `print_templates`, already served by
// `fetchPrintTemplates()` in `printService.ts` (used by the Print Template
// Designer and `templateReceiptService.ts`). Use that instead, filtered to
// `{ templateType: 'receipt' }`.

// Function to print receipt to browser window
const printReceiptInBrowser = async (html: string, css: string): Promise<boolean> => {
  // Use a hidden iframe to avoid popup blockers for programmatic prints
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Unable to access print frame document.');
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt</title>
        <style>${css}</style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  doc.close();

  await new Promise<void>((resolve) => setTimeout(resolve, 50)); // allow layout

  const win = iframe.contentWindow as Window;
  try {
    win.focus();
    win.print();
  } finally {
    // Clean up the iframe after a short delay to allow print dialog to open
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }
  return true;
};

// Type for receipt data
interface ReceiptData {
  saleId?: string;
  discountAmount?: number;
  discountType?: string;
  discountValue?: number;
  structuredData?: {
    items?: Array<{ name: string; qty: number; price: number; lineTotal?: number }>;
    totals?: Array<{ label: string; value: string }>;
    receiptNumber?: string;
    date?: string;
    cashierName?: string;
    customerName?: string;
    paymentMethod?: string;
  };
}

// Function to handle printing
export const printReceipt = async (
  html: string,
  css: string,
  explicitPrinterSettings?: PrinterSettings | null,
  receiptData?: string | ReceiptData,
  storeId?: string,
  disableFallback: boolean = false,
  // Print Module Phase 1: number of physical copies to send. Only meaningful
  // for local-agent and direct (network/Windows) printing — a browser print
  // dialog's own copies field is user-controlled and there is no reliable way
  // to preset it, so a value >1 here has no effect in browser mode (the
  // Printer Settings UI tells the user this).
  copies: number = 1,
): Promise<boolean> => {
  let currentSettings: PrinterSettings | null = explicitPrinterSettings === undefined ? null : explicitPrinterSettings;
  let usedStoreIdForSettings = false; 

  if (currentSettings === null && storeId) { // Check for null, as undefined is now handled 
    try {
      logger.log(`No explicit printer settings provided. Fetching settings for storeId: ${storeId}`);
      toast.loading('Fetching printer settings...', { id: 'printer-settings-toast' });
      currentSettings = await getPrinterSettings(storeId);
      usedStoreIdForSettings = true; 
      toast.dismiss('printer-settings-toast'); 
      logger.log('Fetched printer settings:', currentSettings);
    } catch (error) {
      logger.error(`Failed to fetch printer settings for storeId ${storeId}:`, error);
      toast.error('Failed to load printer settings. Defaulting to browser print.', { id: 'printer-settings-toast' });
      currentSettings = null; 
    }
  } else if (explicitPrinterSettings) {
    logger.log('Using explicitly provided printer settings:', explicitPrinterSettings);
  } else {
    logger.log('No printer settings provided and no storeId available. Defaulting to browser print.');
  }

  const printMode = (currentSettings?.print_mode || 'browser').toString().toLowerCase();
  const printerEnabled = currentSettings?.enabled || false;
  // Success/failure toasts used to always say "Receipt sent...", even when
  // the store's default_sale_document_type is 'invoice' and paper_width is a
  // page format (letter/A4, >=200mm) rather than a thermal roll — misleading
  // the cashier about what actually printed. paper_width is the same signal
  // printViaLocalAgent uses to decide thermal vs page-format CSS, so reuse it
  // here for a document label instead of introducing a second source of truth.
  const documentLabel = (currentSettings?.paper_width ?? 0) >= 200 ? 'Invoice' : 'Receipt';

  logger.log('Effective print mode:', printMode);
  logger.log('Printer effectively enabled:', printerEnabled);
  if (currentSettings?.printer_name) {
    logger.log('Printer name from settings:', currentSettings.printer_name);
  }
  if(usedStoreIdForSettings && currentSettings) {
    logger.log(`Settings fetched using store ID: ${storeId}, resulting mode: ${printMode}, enabled: ${printerEnabled}`);
  }

  // Use the Local Agent only when explicitly selected
  if (printerEnabled && currentSettings) {
    if (shouldUseLocalAgent(printMode)) {
      const agentDetected = await isLocalAgentAvailable();
      if (agentDetected) {
        logger.log(`Attempting local-agent print via Zettaz Print Agent (${copies} ${copies === 1 ? 'copy' : 'copies'})`);
        try {
          for (let i = 0; i < Math.max(1, copies); i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await printViaLocalAgent(html, css, currentSettings);
          }
          toast.success(
            `${documentLabel} sent${currentSettings.printer_name ? ` to ${currentSettings.printer_name}` : ''}${copies > 1 ? ` (${copies} copies)` : ''}.`,
            { id: 'print-toast' },
          );
          logger.log('Local-agent print successful.');
          return true;
        } catch (error: any) {
          logger.error('Local-agent printing failed:', error);
          if (disableFallback) {
            toast.error(`Local print failed: ${error?.message || 'Unknown error'}`, { id: 'print-toast' });
            return false;
          }
          // Fall through to try other modes
        }
      }
    }
  }

  if (printerEnabled && printMode === 'direct' && currentSettings && currentSettings.printer_name) { 
    logger.log(`Attempting direct print to: ${currentSettings.printer_name} (${copies} ${copies === 1 ? 'copy' : 'copies'})`);
    try {
      for (let i = 0; i < Math.max(1, copies); i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await printReceiptToNetworkPrinter(html, css, currentSettings);
      }
      // If printReceiptToNetworkPrinter succeeds, it returns true; if it fails, it throws an error.
      toast.success(`${documentLabel} sent to ${currentSettings.printer_name}${copies > 1 ? ` (${copies} copies)` : ''}.`, { id: 'print-toast' });
      logger.log('Direct print successful.');
      return true;
    } catch (error: any) { // Catch specific error type if known, else 'any'
      logger.error('Direct printing failed:', error);
      // toast.dismiss('print-toast'); // Not strictly needed if subsequent toasts use the same ID.
      const printerName = currentSettings?.printer_name || 'the network printer';
      const errorMessage = (error && typeof error.message === 'string') ? error.message : "Please check printer connection or server logs.";

      if (disableFallback) {
        toast.error(`Direct print to ${printerName} failed: ${errorMessage}`, { id: 'print-toast' });
        return false; 
      } else {
        const userWantsBrowserPrint = window.confirm(
          `Direct print to ${printerName} failed: ${errorMessage}\n\nWould you like to try printing with your browser instead?`
        );
        if (userWantsBrowserPrint) {
          toast('Preparing browser print...', { id: 'print-toast', icon: 'ℹ️' });
          return printReceiptInBrowser(html, css);
        } else {
          toast('Print cancelled by user.', { id: 'print-toast', icon: 'ℹ️' });
          return false; 
        }
      }
    }
  } else if (printerEnabled && printMode === 'server') {
      logger.warn('Server-side printing is configured but not yet implemented. Falling back to browser print.');
      toast('⚠️ Server print not ready. Using browser print instead.', { id: 'print-toast' });
      logger.log('Falling back to browser print for server mode.');
      return printReceiptInBrowser(html, css);
  } else {
    if (printMode !== 'browser') {
      logger.log(`Print mode is '${printMode}' but printer is not enabled or printer name is missing (or settings could not be loaded). Defaulting to browser print.`);
      toast('Printer not configured for direct/server print. Using browser print.', { id: 'print-toast' });
    } else {
      logger.log('Using browser print. Triggering print via iframe.');
      toast.dismiss('print-toast');
      toast('Preparing browser print…', { id: 'print-toast' });
    }
    const ok = await printReceiptInBrowser(html, css);
    toast.dismiss('print-toast');
    return ok;
  }
};

// Function to print receipt to a network printer (direct mode)
const printReceiptToNetworkPrinter = async (html: string, css: string, printerSettings: PrinterSettings): Promise<boolean> => {
  try {
    if (!printerSettings.printer_name) {
      throw new Error('Printer name is not specified in settings');
    }

    // 'direct' mode still relays through the Zettaz Print Agent's /v1/jobs
    // endpoint (destination: 'tcp') — it is NOT a browser-to-printer socket.
    // Unlike the local-agent (system printer) branch, this path used to skip
    // the agent health check and go straight to tryAgentFetch, so when the
    // agent wasn't running/reachable the fetch just threw a generic connection
    // error and, at POS checkout (disableFallback: true), that error was
    // swallowed into one easy-to-miss toast with nothing printed and no
    // indication why. Check first and fail with an explicit message.
    const agentDetected = await isLocalAgentAvailable();
    if (!agentDetected) {
      throw new Error('Zettaz Print Agent is not running or not reachable on this device. Network/ESC-POS printing requires the agent to be running, even for network printers.');
    }

    // Combine HTML and CSS for the print job
    const fullHtml = `<style>${css}</style>${html}`;

    // Convert paper_width (number in mm) to the format expected by backend (string: '58mm' or '80mm')
    let paperWidth: string = '80mm'; // Default to 80mm
    if (printerSettings.paper_width === 58) {
      paperWidth = '58mm';
    }
    
    logger.log('Sending to printer:', printerSettings.printer_name);
    logger.log('Using paper width:', paperWidth);

    const payloadBase64 = await htmlToEscposRasterBase64(fullHtml, printerSettings.paper_width);
    const job = buildNetworkAgentJob(printerSettings.printer_name, payloadBase64, paperWidth);
    const { res, port } = await tryAgentFetch('/v1/jobs', {
      method: 'POST',
      headers: localAgentHeaders(true),
      body: JSON.stringify(job),
      credentials: 'omit',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(error?.message || `Local Agent returned HTTP ${res.status}`);
    }
    let status = await res.json();
    for (let attempt = 0; status?.state === 'queued' || status?.state === 'processing'; attempt += 1) {
      if (attempt >= 40) throw new Error('Local Agent network print timed out');
      await new Promise((resolve) => setTimeout(resolve, 250));
      const result = await fetch(buildLocalAgentUrl(`/v1/jobs/${job.id}`, port), {
        headers: localAgentHeaders(), credentials: 'omit', cache: 'no-store',
      });
      if (!result.ok) throw new Error(`Unable to read Local Agent job status (${result.status})`);
      status = await result.json();
    }
    if (status?.state !== 'completed') {
      throw new Error(status?.error || `Local Agent network print ${status?.state || 'failed'}`);
    }
    
    return true; // Indicate success to the caller

  } catch (error: any) { // This catch block now only handles true network errors or errors explicitly thrown above
    console.error('Error printing to network printer:', error);
    // Ensure the error message passed to toast is a string.
    const errorMessageString = typeof error.message === 'string' ? error.message : 'Connection error';
    // toast.error(`Printing failed: ${errorMessageString}`); // Removed toast
    // Log the error, but the user-facing message will be handled by the caller (printReceipt)
    // Re-throw the original error or a new one with a clear message.
    throw new Error(`Network print failed: ${errorMessageString}`); 
  }
};

// Helper function to test printer connection before sending a print job
export async function testPrinterConnection(printerAddress: string) {
  if (!printerAddress) {
    throw new Error('Printer address is not specified');
  }
  
  const [ip, port = '9100'] = printerAddress.split(':');
  
  try {
    // Test printer connection before attempting to print
    const response = await fetchWithAuth(`${API_BASE_URL}/print/test/${ip}?port=${port}`, {
      method: 'GET'
    });
    
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

// ... (rest of the code remains the same)
