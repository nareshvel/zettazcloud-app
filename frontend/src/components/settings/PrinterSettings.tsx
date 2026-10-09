import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useI18n } from '../../hooks/useI18n';
import { isLocalAgentAvailable, getLocalAgentPrinters, printReceipt } from '../../services/printerService';
import { fetchPrintTemplates, fetchFixture, type PrintTemplate } from '../../services/printService';
import {
  getPrintDocumentSettings,
  savePrintDocumentSettings,
  type PrintDocumentSetting,
  type PrintDocumentType,
  type SaleDocumentType,
  type PrintDeliveryMode,
} from '../../services/printDocumentSettingsService';
import { buildPrintableHtml } from '../../utils/printTemplateRenderer';
import { buildRegisterReportHtml, sampleRegisterReport, REGISTER_REPORT_CSS } from '../../utils/registerReportHtml';
import { useCurrency, useDateFormatting } from '../../contexts/LocalizationContext';
import { FileText, Receipt, CheckCircle2, AlertTriangle, ChevronDown, Printer, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

/*
 * Print Module Phase 1 redesign.
 *
 * Replaces the old single flat form (one receipt printer, one "use my print
 * templates" flag nobody could reach — see
 * docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md) with one section per
 * document family: Sales Receipt & Refunds, and Invoices. Each is configured
 * independently — a store can browser-print receipts and direct-print
 * invoices to a different device, or use different templates for each.
 *
 * Labels & Tags are deliberately NOT a third section here — that's
 * LabelPrinterSettings.tsx, already rendered alongside this component by the
 * wrapper at the bottom of this file, and stays its own untouched system
 * until a later phase (see plan doc §1).
 */

type DocSettingsByType = Record<PrintDocumentType, PrintDocumentSetting>;

const emptySetting = (storeId: string, documentType: PrintDocumentType): PrintDocumentSetting => ({
  id: null,
  storeId,
  documentType,
  deliveryMode: 'browser',
  printerName: null,
  paperWidth: documentType === 'invoice' ? 210 : 80,
  mediaSize: documentType === 'invoice' ? 'a4' : '80mm',
  templateId: null,
  copies: 1,
  // receipt + register_close work out of the box (built-in report body needs
  // no template); invoice printing stays opt-in.
  enabled: documentType !== 'invoice',
  autoPrint: false,
});

const PrinterSettings: React.FC = () => {
  const { store } = useStore();
  const { user } = useAuth();
  const { t } = useI18n();
  const { formatCurrency } = useCurrency();
  const { formatDateTime } = useDateFormatting();

  // Save path is PUT /print-document-settings → settings.printer.
  const canEdit = hasPermission(user, 'settings.printer');
  const tSettings = (key: string, fallback: string) => t(key, { ns: 'settings', defaultValue: fallback });

  const [docSettings, setDocSettings] = useState<DocSettingsByType>({
    receipt: emptySetting('', 'receipt'),
    invoice: emptySetting('', 'invoice'),
    register_close: emptySetting('', 'register_close'),
  });
  const [saleFormat, setSaleFormat] = useState<SaleDocumentType>('receipt');
  const [templatesByType, setTemplatesByType] = useState<Record<PrintDocumentType, PrintTemplate[]>>({ receipt: [], invoice: [], register_close: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAdditional, setShowAdditional] = useState(false);
  const [agentAvailable, setAgentAvailable] = useState<boolean | null>(null);
  const [agentPrinters, setAgentPrinters] = useState<{ name: string; isDefault?: boolean }[]>([]);
  const [testingRoute, setTestingRoute] = useState<PrintDocumentType | null>(null);

  const loadAll = useCallback(async (storeId: string) => {
    setIsLoading(true);
    try {
      const [docs, receiptTemplates, invoiceTemplates, jewelryInvoiceTemplates] = await Promise.all([
        getPrintDocumentSettings(storeId),
        fetchPrintTemplates({ templateType: 'receipt', storeId }),
        fetchPrintTemplates({ templateType: 'invoice', storeId }),
        // Jewelry tenants publish under this type instead of plain `invoice` —
        // see retailProfileService.js's INDUSTRY_TEMPLATES. Merged into the
        // same picker so a jewelry store isn't left with an empty dropdown.
        fetchPrintTemplates({ templateType: 'jewelry_invoice', storeId }).catch(() => []),
      ]);

      const receipt = docs.settings.find((s) => s.documentType === 'receipt') || emptySetting(storeId, 'receipt');
      const invoice = docs.settings.find((s) => s.documentType === 'invoice') || emptySetting(storeId, 'invoice');
      const registerClose = docs.settings.find((s) => s.documentType === 'register_close') || emptySetting(storeId, 'register_close');
      const byType: DocSettingsByType = {
        receipt: { ...receipt, mediaSize: receipt.mediaSize || (`${receipt.paperWidth || 80}mm` as PrintDocumentSetting['mediaSize']) },
        invoice: { ...invoice, mediaSize: invoice.mediaSize || 'a4' },
        register_close: { ...registerClose, mediaSize: registerClose.mediaSize || '80mm' },
      };
      setDocSettings(byType);
      setSaleFormat(docs.defaultSaleDocumentType);
      setSavedSnapshot(JSON.stringify({ saleFormat: docs.defaultSaleDocumentType, docSettings: byType }));
      setTemplatesByType({
        receipt: (receiptTemplates || []).filter((tpl) => tpl.isPublished),
        invoice: [...(invoiceTemplates || []), ...(jewelryInvoiceTemplates || [])].filter((tpl) => tpl.isPublished),
      });
    } catch (error) {
      toast.error(tSettings('printer.load_error', 'Failed to load printer settings.'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (store?.id) loadAll(store.id);
  }, [store?.id, loadAll]);

  // Reset workstation-specific agent state when no route uses the Local Agent.
  useEffect(() => {
    const usesLocalAgent = docSettings.receipt.deliveryMode === 'local_agent' || docSettings.invoice.deliveryMode === 'local_agent' || docSettings.register_close.deliveryMode === 'local_agent';
    if (!usesLocalAgent) {
      setAgentAvailable(null);
      setAgentPrinters([]);
    }
  }, [docSettings.receipt.deliveryMode, docSettings.invoice.deliveryMode, docSettings.register_close.deliveryMode]);

  const detectLocalAgent = async () => {
    setAgentAvailable(null);
    const ok = await isLocalAgentAvailable();
    setAgentAvailable(ok);
    if (!ok) {
      setAgentPrinters([]);
      return;
    }
    try {
      setAgentPrinters(await getLocalAgentPrinters());
    } catch {
      setAgentPrinters([]);
    }
  };

  const updateField = <K extends keyof PrintDocumentSetting>(
    documentType: PrintDocumentType, field: K, value: PrintDocumentSetting[K],
  ) => {
    if (!canEdit) return;
    setDocSettings((prev) => ({ ...prev, [documentType]: { ...prev[documentType], [field]: value } }));
  };

  const selectSaleFormat = (type: PrintDocumentType) => {
    if (!canEdit) return;
    setSaleFormat(type);
    setDocSettings((prev) => ({ ...prev, [type]: { ...prev[type], enabled: true } }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`${type}.enabled`];
      return next;
    });
  };

  const currentSnapshot = JSON.stringify({ saleFormat, docSettings });
  const isDirty = savedSnapshot !== '' && currentSnapshot !== savedSnapshot;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!store?.id) return;
    setIsSaving(true);
    setFieldErrors({});
    try {
      const saved = await savePrintDocumentSettings(store.id, {
        defaultSaleDocumentType: saleFormat,
        settings: docSettings,
      });
      const nextSettings = {
        receipt: saved.settings.find((s) => s.documentType === 'receipt') || docSettings.receipt,
        invoice: saved.settings.find((s) => s.documentType === 'invoice') || docSettings.invoice,
        register_close: saved.settings.find((s) => s.documentType === 'register_close') || docSettings.register_close,
      };
      setDocSettings(nextSettings);
      setSaleFormat(saved.defaultSaleDocumentType);
      setSavedSnapshot(JSON.stringify({ saleFormat: saved.defaultSaleDocumentType, docSettings: nextSettings }));
      toast.success(tSettings('printer.save_success', 'Printer settings saved.'));
    } catch (error: any) {
      setFieldErrors(error?.errors || error?.data?.errors || {});
      toast.error(error?.message || tSettings('printer.save_error', 'Failed to save printer settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = async (documentType: PrintDocumentType) => {
    const setting = docSettings[documentType];
    if (documentType === 'register_close') {
      // No template — print a sample Z-report through the configured route.
      setTestingRoute(documentType);
      try {
        const html = buildRegisterReportHtml(sampleRegisterReport(store?.name || 'Store'), formatCurrency, formatDateTime);
        await printReceipt(html, REGISTER_REPORT_CSS, {
          store_id: store?.id || '',
          enabled: true,
          auto_print: true,
          print_mode: setting.deliveryMode === 'local_agent' ? 'local-agent' : setting.deliveryMode,
          printer_name: setting.printerName || undefined,
          paper_width: setting.paperWidth,
        }, undefined, store?.id, true, setting.copies || 1);
        toast.success('Sample register report sent.');
      } catch (error: any) {
        toast.error(error?.message || 'Failed to test the register report route.');
      } finally {
        setTestingRoute(null);
      }
      return;
    }
    const template = templatesByType[documentType].find((item) => item.id === setting.templateId);
    if (!template) {
      setFieldErrors((prev) => ({ ...prev, [`${documentType}.templateId`]: 'Select a published template before testing.' }));
      return;
    }
    setTestingRoute(documentType);
    try {
      const fixture = await fetchFixture(
        documentType === 'invoice' ? (template.templateType === 'jewelry_invoice' ? 'jewelry_invoice' : 'invoice') : 'receipt',
        documentType === 'invoice' ? (template.templateType === 'jewelry_invoice' ? 'domestic' : 'electronics') : 'retail',
      );
      const paperSize = documentType === 'invoice' ? 'a4' : (setting.mediaSize === '58mm' ? '58mm' : '80mm');
      const html = buildPrintableHtml(template.blocks || [], fixture, paperSize, store?.logoUrl || null);
      await printReceipt(html, '', {
        store_id: store?.id || '',
        enabled: true,
        auto_print: true,
        print_mode: setting.deliveryMode === 'local_agent' ? 'local-agent' : setting.deliveryMode,
        printer_name: setting.printerName || undefined,
        paper_width: setting.paperWidth,
      }, {
        structuredData: {
          items: (fixture?.items || []).map((item: any) => ({
            name: item.name || item.description || 'Item',
            qty: Number(item.qty || item.quantity || 1),
            price: Number(item.unitPrice || item.price || item.amount || 0),
            lineTotal: Number(item.lineTotal || item.amount || item.price || 0),
          })),
          totals: [
            { label: 'Subtotal', value: String(Number(fixture?.subtotal || 0)) },
            { label: 'Tax', value: String(Number(fixture?.taxAmount ?? fixture?.tax ?? 0)) },
            { label: 'Total', value: String(Number(fixture?.total || 0)) },
          ],
          receiptNumber: fixture?.receiptNumber || fixture?.invoiceNumber || 'TEST-PRINT',
          date: fixture?.date || new Date().toLocaleString(),
          cashierName: fixture?.cashierName || 'Test Cashier',
          customerName: fixture?.customer?.name || fixture?.customerName || 'Test Customer',
          paymentMethod: fixture?.payment?.method || 'Test Payment',
        },
      }, store?.id, true, 1);
      toast.success(`${documentType === 'receipt' ? 'Receipt' : 'Invoice'} test sent using ${template.name}.`);
    } catch (error: any) {
      toast.error(error?.message || `Failed to test ${documentType} route.`);
    } finally {
      setTestingRoute(null);
    }
  };

  const discardChanges = () => {
    if (!savedSnapshot) return;
    const saved = JSON.parse(savedSnapshot);
    setSaleFormat(saved.saleFormat);
    setDocSettings(saved.docSettings);
    setFieldErrors({});
  };

  const fieldCls = 'w-full px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:bg-gray-50 dark:bg-muted/50 disabled:opacity-60';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5';
  const toggleCls = 'w-10 h-5 bg-gray-200 dark:bg-muted rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/30 peer-checked:bg-primary after:content-[\'\'] after:absolute after:top-0.5 after:left-0.5 after:bg-white dark:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-disabled:opacity-50 after:shadow-sm';

  if (isLoading) {
    return <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-8 text-center text-sm text-gray-400 dark:text-muted-foreground">Loading printer settings…</div>;
  }

  const renderDeliverySection = (documentType: PrintDocumentType) => {
    const s = docSettings[documentType];
    const isReceipt = documentType === 'receipt';
    const isRegisterClose = documentType === 'register_close';
    const isThermal = isReceipt || isRegisterClose;
    const templates = templatesByType[documentType];
    const usesLocalAgent = s.deliveryMode === 'local_agent';
    const needsPrinterName = s.deliveryMode === 'direct' || s.deliveryMode === 'local_agent';

    return (
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">
            {isReceipt
              ? tSettings('printer.receipt_title', 'Sales Receipt & Refunds')
              : isRegisterClose
                ? tSettings('printer.register_close_title', 'Register Close Report (Z)')
                : tSettings('printer.invoice_title', 'Invoices')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">
            {isReceipt
              ? tSettings('printer.receipt_desc', 'Thermal receipt printer, used for sales and refund slips.')
              : isRegisterClose
                ? tSettings('printer.register_close_desc', 'Where the X/Z shift report prints after a register close. Uses the built-in report layout.')
                : tSettings('printer.invoice_desc', 'A4/Letter document printer, used for invoices.')}
          </p>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-foreground">{tSettings('printer.enabled', 'Available for printing')}</p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{documentType === saleFormat ? 'Required because this is the default checkout document.' : isRegisterClose ? 'Allow the register report to print through this route.' : 'Allow this alternate document to be generated manually.'}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input type="checkbox" checked={s.enabled} onChange={(e) => updateField(documentType, 'enabled', e.target.checked)} disabled={documentType === saleFormat || !canEdit} className="sr-only peer" />
                <div className={toggleCls}></div>
              </label>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-border bg-gray-50 dark:bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-foreground">{tSettings('printer.auto_print', 'Auto Print')}</p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{tSettings('printer.auto_print_desc', 'Off opens a preview; on starts the configured delivery automatically.')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input type="checkbox" checked={s.autoPrint} onChange={(e) => updateField(documentType, 'autoPrint', e.target.checked)} disabled={!s.enabled || !canEdit} className="sr-only peer" />
                <div className={toggleCls}></div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>{tSettings('printer.delivery_mode', 'Print Via')}</label>
              <select
                value={s.deliveryMode}
                onChange={(e) => updateField(documentType, 'deliveryMode', e.target.value as PrintDeliveryMode)}
                disabled={!s.enabled || !canEdit}
                className={fieldCls}
              >
                <option value="browser">{tSettings('printer.mode_browser', 'Browser Print')}</option>
                {isThermal && <option value="direct">{tSettings('printer.mode_direct', 'Network ESC/POS printer (TCP)')}</option>}
                <option value="local_agent">{tSettings('printer.mode_local_agent', 'Zettaz Print Agent (Silent)')}</option>
              </select>
              {usesLocalAgent && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`text-xs ${agentAvailable === true ? 'text-green-700' : agentAvailable === false ? 'text-amber-700' : 'text-gray-500'}`}>
                    {agentAvailable === null && 'Agent status not checked.'}
                    {agentAvailable === true && tSettings('printer.agent_available', 'Local Agent detected on this device.')}
                    {agentAvailable === false && tSettings('printer.agent_unavailable', 'Local Agent not detected. Install the Zettaz Print Agent to enable silent printing.')}
                  </span>
                  <button type="button" onClick={detectLocalAgent} className="text-xs font-medium text-primary hover:underline">Detect agent</button>
                </div>
              )}
            </div>

            {needsPrinterName && (
              <div>
                <label className={labelCls}>{s.deliveryMode === 'direct' ? 'Network address (host:port)' : tSettings('printer.printer_name', 'System printer')}</label>
                {usesLocalAgent && agentAvailable && agentPrinters.length > 0 ? (
                  <select
                    value={s.printerName || ''}
                    onChange={(e) => updateField(documentType, 'printerName', e.target.value || null)}
                    disabled={!s.enabled || !canEdit}
                    className={fieldCls}
                  >
                    <option value="">{tSettings('printer.default_printer', 'Default Printer')}</option>
                    {agentPrinters.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={s.printerName || ''}
                    onChange={(e) => updateField(documentType, 'printerName', e.target.value || null)}
                    disabled={!s.enabled || !canEdit}
                    placeholder={s.deliveryMode === 'direct' ? '127.0.0.1:9100' : tSettings('printer.printer_name_placeholder', 'Enter system printer name')}
                    className={fieldCls}
                  />
                )}
              </div>
            )}

            {isThermal ? (
              <div>
                <label className={labelCls}>{tSettings('printer.paper_width', 'Paper Width (mm)')}</label>
                <select
                  value={s.mediaSize}
                  onChange={(e) => {
                    const mediaSize = e.target.value as PrintDocumentSetting['mediaSize'];
                    updateField(documentType, 'mediaSize', mediaSize);
                    updateField(documentType, 'paperWidth', Number(mediaSize.replace('mm', '')));
                  }}
                  disabled={!s.enabled || !canEdit}
                  className={fieldCls}
                >
                  <option value="58mm">58 mm</option>
                  <option value="80mm">80 mm</option>
                  <option value="110mm">110 mm</option>
                </select>
              </div>
            ) : (
              <div>
                <label className={labelCls}>{tSettings('printer.paper_size', 'Page Size')}</label>
                <select
                  value={s.mediaSize}
                  onChange={(e) => {
                    const mediaSize = e.target.value as PrintDocumentSetting['mediaSize'];
                    updateField(documentType, 'mediaSize', mediaSize);
                    updateField(documentType, 'paperWidth', mediaSize === 'letter' ? 216 : 210);
                  }}
                  disabled={!s.enabled || !canEdit}
                  className={fieldCls}
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">Letter (8.5 × 11 in)</option>
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>{tSettings('printer.copies', 'Copies')}</label>
              <input
                type="number"
                min={1}
                max={10}
                value={s.copies}
                onChange={(e) => updateField(documentType, 'copies', Math.max(1, Number(e.target.value) || 1))}
                disabled={!s.enabled || s.deliveryMode === 'browser' || !canEdit}
                className={fieldCls}
              />
              {s.deliveryMode === 'browser' && (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-muted-foreground">
                  {tSettings('printer.copies_browser_hint', "Browser printing can't preset copies — use the browser's print dialog instead.")}
                </p>
              )}
            </div>
          </div>

          {isRegisterClose ? (
            <div>
              <label className={labelCls}>{tSettings('printer.template', 'Template')}</label>
              <p className="text-xs text-gray-500 dark:text-muted-foreground">
                {tSettings('printer.register_close_layout', 'Built-in shift-report layout — session totals, tender mix, paid in/out, and variance. No template to publish.')}
              </p>
              <button
                type="button"
                disabled={testingRoute !== null || !s.enabled}
                onClick={() => handleTestPrint(documentType)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-border px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-muted disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                {testingRoute === documentType ? 'Testing…' : 'Test report route'}
              </button>
            </div>
          ) : (
          <div>
            <label className={labelCls}>{tSettings('printer.template', 'Template')}</label>
            <select
              value={s.templateId || ''}
              onChange={(e) => updateField(documentType, 'templateId', e.target.value || null)}
              disabled={!s.enabled || !canEdit}
              className={fieldCls}
            >
              <option value="">{tSettings('printer.select_template', 'Select a published template')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} · {tpl.templateType === 'jewelry_invoice' ? 'Jewelry invoice' : tpl.templateType === 'invoice' ? 'General invoice' : 'Receipt'}{tpl.isDefault ? ' · Default' : ''}
                </option>
              ))}
            </select>
            {fieldErrors[`${documentType}.templateId`] && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{fieldErrors[`${documentType}.templateId`]}</p>
            )}
            {templates.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-700">
                {tSettings(
                  'printer.no_templates',
                  'No published template for this document type yet — publish one in Print Templates before enabling this section.',
                )}
              </p>
            )}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-muted-foreground">
              {tSettings(
                'printer.template_hint',
                'To change header, footer, logo, or layout, edit the template itself in Print Templates.',
              )}
            </p>
            <button
              type="button"
              disabled={testingRoute !== null || !s.enabled || !s.templateId}
              onClick={() => handleTestPrint(documentType)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-border px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-muted disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {testingRoute === documentType ? 'Testing…' : `Test ${documentType === 'receipt' ? 'receipt' : 'invoice'} route`}
            </button>
          </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Store-level choice: what does a completed sale print as? */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100 dark:border-border">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-foreground">{tSettings('printer.sale_format_title', 'Default document after checkout')}</h3>
            <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">
              {tSettings('printer.sale_format_desc', 'Choose the primary customer document created when a sale is completed at this store.')}
            </p>
          </div>
          <Link
            to="/print-agent"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Agent
          </Link>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="Default document after checkout">
          {(['receipt', 'invoice'] as PrintDocumentType[]).map((type) => {
            const selected = saleFormat === type;
            const Icon = type === 'receipt' ? Receipt : FileText;
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectSaleFormat(type)}
                disabled={!canEdit}
                className={`relative flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/50'
                }`}
              >
                <span className={`rounded-lg p-2 ${selected ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground'}`}><Icon className="h-5 w-5" /></span>
                <span>
                  <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-foreground">
                    {type === 'receipt' ? 'Receipt' : 'Invoice'}
                    {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-gray-500 dark:text-muted-foreground">
                    {type === 'receipt'
                      ? 'Compact thermal document for walk-in counter sales.'
                      : 'Formal A4 or Letter document for business, regulated, or high-value sales.'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mx-5 mb-5 rounded-lg bg-gray-50 dark:bg-muted/50 px-3 py-2 text-xs text-gray-600 dark:text-muted-foreground">
          Refunds use a dedicated <strong>Refund / Credit Note</strong> template through the receipt delivery route during this compatibility phase.
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Effective checkout workflow</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-foreground">
          <span className="font-semibold">{saleFormat === 'receipt' ? 'Receipt' : 'Invoice'}</span>
          <span>→</span>
          <span>{templatesByType[saleFormat].find((t) => t.id === docSettings[saleFormat].templateId)?.name || 'Template not selected'}</span>
          <span>→</span>
          <span>{docSettings[saleFormat].mediaSize}</span>
          <span>→</span>
          <span>{docSettings[saleFormat].deliveryMode === 'browser' ? 'Browser print dialog' : docSettings[saleFormat].deliveryMode === 'local_agent' ? 'Zettaz Print Agent' : 'Advanced direct printer'}</span>
          {docSettings[saleFormat].deliveryMode !== 'browser' && <><span>→</span><span>{docSettings[saleFormat].printerName || 'Printer not selected'}</span></>}
          <span className={`ml-auto rounded-full px-2 py-1 text-xs font-medium ${docSettings[saleFormat].templateId ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {docSettings[saleFormat].templateId ? 'Ready' : 'Needs attention'}
          </span>
        </div>
      </div>

      {renderDeliverySection(saleFormat)}

      <div className="rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card overflow-hidden">
        <button type="button" onClick={() => setShowAdditional((value) => !value)} className="w-full flex items-center justify-between px-5 py-4 text-left">
          <span><span className="block text-sm font-semibold">Additional document formats</span><span className="block text-xs text-muted-foreground mt-0.5">Configure the alternate sales document for manual or future checkout use.</span></span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showAdditional ? 'rotate-180' : ''}`} />
        </button>
        {showAdditional && <div className="border-t p-4">{renderDeliverySection(saleFormat === 'receipt' ? 'invoice' : 'receipt')}</div>}
      </div>

      {renderDeliverySection('register_close')}

      {/* Store logo note */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <span className="font-medium">Store logo:</span> Upload your logo in <span className="font-medium">General Settings</span> to use it on receipts and invoices.
        </p>
      </div>

      {Object.keys(fieldErrors).length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" />Printer settings need attention</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-red-700 space-y-1">
            {Object.values(fieldErrors).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
          </ul>
        </div>
      )}

      <div className="sticky bottom-3 z-10 bg-white/95 dark:bg-card/95 backdrop-blur rounded-xl border border-gray-200 dark:border-border px-5 py-4 flex justify-between items-center gap-3 flex-wrap shadow-lg">
        <div>
          <p className="text-sm font-medium">{!canEdit ? 'View-only access — ask a manager to make changes.' : isDirty ? 'Unsaved printer-setting changes' : 'Printer settings are up to date'}</p>
          <p className="text-xs text-muted-foreground">Route tests use the current form values and send one copy.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={discardChanges} disabled={!isDirty || isSaving} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50">
            <RotateCcw className="h-4 w-4" /> Discard
          </button>
          <button type="submit" disabled={isSaving || !isDirty || !canEdit} title={!canEdit ? 'View-only access' : undefined} className="px-5 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? tSettings('buttons.saving', 'Saving…') : tSettings('buttons.save_changes', 'Save Changes')}
          </button>
        </div>
      </div>
    </form>
  );
};

import LabelPrinterSettings from './LabelPrinterSettings';

// Wrapper that renders receipt/invoice printer settings + label printer settings.
// Labels & Tags stay their own untouched system (see file header comment).
const PrinterSettingsWithLabel: React.FC = () => {
  return (
    <div className="space-y-5">
      <PrinterSettings />
      <LabelPrinterSettings />
    </div>
  );
};

export { PrinterSettings };
export default PrinterSettingsWithLabel;
