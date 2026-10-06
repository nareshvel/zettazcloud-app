import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import {
  fetchPrintTemplates, savePrintTemplate, publishPrintTemplate, deletePrintTemplate,
  duplicatePrintTemplate, rollbackPrintTemplate, fetchTemplateVersions, fetchFixture,
  resetTemplateToDefaults,
  PrintTemplate, PrintTemplateVersion,
} from '@/services/printService';
import {
  Plus, Save, Eye, EyeOff, History, Check, Copy, Trash2, RotateCcw, FileSearch,
  Type, Image, Table, Barcode, FileText, LayoutTemplate, Loader2, Search,
  ChevronDown, ChevronRight, Layers, Palette, GripVertical, MoreHorizontal,
  PenLine, AlertCircle, CheckCircle2, Star, Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import TemplateCanvas from '@/components/print-templates/TemplateCanvas';
import BlockPropertiesPanel from '@/components/print-templates/BlockPropertiesPanel';
import NewTemplateDialog, { NewTemplateResult } from '@/components/print-templates/NewTemplateDialog';
import {
  TemplateBlock, BLOCK_TYPE_META, BLOCK_CATEGORY_LABELS, PaperSize, PAPER_SIZE_LABELS,
  DEFAULT_PAPER_SIZE_FOR_TYPE, createLocalId, isBlockAvailable,
} from '@/types/printTemplate';
import { buildPrintableHtml, printHtmlDocument } from '@/utils/printTemplateRenderer';
import { getMissingTemplates, provisionTemplates, type TemplatePlanEntry } from '@/services/retailProfileService';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  receipt: 'Receipt',
  invoice: 'Invoice',
  jewelry_invoice: 'Jewelry Invoice',
  jewelry_certificate: 'Jewelry Certificate',
  return: 'Refund / Credit Note',
  label: 'Label',
  document: 'Document',
  repair_ticket: 'Repair Ticket',
  old_gold_voucher: 'Old Gold Voucher',
  memo_slip: 'Consignment Memo',
  layaway_agreement: 'Layaway Agreement',
  layaway_receipt: 'Layaway Payment Receipt',
  savings_enrollment: 'Savings Passbook',
  order_acknowledgement: 'Order Acknowledgement',
};

/**
 * Preview fixture for a template.
 *
 * A template called "Standard Jewelry Invoice" previewed as "DUTY-FREE INVOICE"
 * because jewelry_invoice was hardwired to the duty-free fixture. Duty-free is a
 * SALES MODE, not a document type — a domestic jeweller must preview a domestic
 * invoice.
 *
 * The mode now comes from the template's own blocks: a template carrying a
 * visible `dutyFree` block is a duty-free template and previews accordingly.
 * Everything else previews domestic.
 */
const FIXTURE_FOR = (
  templateType: string,
  paperSize: PaperSize,
  blocks: TemplateBlock[] = [],
): [string, string] => {
  const isDutyFree = blocks.some((b) => b.type === 'dutyFree' && b.visible);

  if (templateType === 'jewelry_invoice' || templateType === 'jewelry_certificate') {
    return ['jewelry_invoice', isDutyFree ? 'duty_free' : 'domestic'];
  }
  // A refund previews against refund data — otherwise the designer shows a
  // SALES RECEIPT while the template is titled REFUND, which is the confusion
  // this document type exists to avoid.
  if (templateType === 'return') return ['return', 'retail'];
  if (templateType === 'repair_ticket') return ['repair_ticket', 'domestic'];
  if (templateType === 'old_gold_voucher') return ['old_gold_voucher', 'domestic'];
  if (templateType === 'memo_slip') return ['memo_slip', 'domestic'];
  if (templateType === 'layaway_agreement') return ['layaway_agreement', 'domestic'];
  if (templateType === 'layaway_receipt') return ['layaway_receipt', 'domestic'];
  if (templateType === 'savings_enrollment') return ['savings_enrollment', 'domestic'];
  if (templateType === 'order_acknowledgement') return ['order_acknowledgement', 'domestic'];
  if (templateType === 'label')
    return ['label', paperSize === 'label' ? '50x25_jewelry_tag' : '40x20_jewelry_tag'];
  if (templateType === 'document' || templateType === 'invoice')
    return ['invoice', isDutyFree ? 'retail' : 'electronics'];
  return ['receipt', isDutyFree ? 'duty_free' : 'retail'];
};

const BLOCK_ICONS: Record<string, React.ReactNode> = {
  text:    <Type    className="h-3.5 w-3.5 shrink-0" />,
  header:  <Type    className="h-3.5 w-3.5 shrink-0" />,
  logo:    <Image   className="h-3.5 w-3.5 shrink-0" />,
  table:   <Table   className="h-3.5 w-3.5 shrink-0" />,
  barcode: <Barcode className="h-3.5 w-3.5 shrink-0" />,
};
const blockIcon = (type: string) =>
  BLOCK_ICONS[type] || <FileText className="h-3.5 w-3.5 shrink-0" />;

type PendingAction =
  | { type: 'switchTemplate'; template: PrintTemplate }
  | { type: 'delete' }
  | { type: 'rollback'; version: number }
  | { type: 'resetDefaults' }
  | null;

type LeftTab = 'palette' | 'layers';

// Panel width bounds (px)
const LEFT_MIN = 200;
const LEFT_MAX = 380;
const RIGHT_MIN = 240;
const RIGHT_MAX = 420;

// ─── Resize hook ──────────────────────────────────────────────────────────────

function useResizablePanel(
  initial: number,
  min: number,
  max: number,
  side: 'left' | 'right',
) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(initial);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = side === 'left'
        ? ev.clientX - startX.current
        : startX.current - ev.clientX;
      setWidth(Math.min(max, Math.max(min, startW.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, min, max, side]);

  return { width, onMouseDown };
}

// ─── Component ────────────────────────────────────────────────────────────────

const PrintTemplateDesigner: React.FC = () => {
  const { toast } = useToast();
  const { store } = useStore();

  // ── Template state
  const [templates, setTemplates]           = useState<PrintTemplate[]>([]);
  // Documents the store's retail profile calls for but that do not exist yet.
  const [missingTemplates, setMissingTemplates] = useState<TemplatePlanEntry[]>([]);
  const [provisioning, setProvisioning]     = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplate | null>(null);
  const [blocks, setBlocks]                 = useState<TemplateBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [versions, setVersions]             = useState<PrintTemplateVersion[]>([]);
  const [showVersions, setShowVersions]     = useState(false);
  const [paperSize, setPaperSize]           = useState<PaperSize>('80mm');
  const [fixtureData, setFixtureData]       = useState<any>(null);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [dirty, setDirty]                   = useState(false);

  // ── UI state
  const [newDialogOpen, setNewDialogOpen]         = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [paletteSearch, setPaletteSearch]         = useState('');
  const [pendingAction, setPendingAction]         = useState<PendingAction>(null);
  const [leftTab, setLeftTab]                     = useState<LeftTab>('palette');
  const [templateListOpen, setTemplateListOpen]   = useState(true);

  // ── Resizable panels
  const leftPanel  = useResizablePanel(256, LEFT_MIN,  LEFT_MAX,  'left');
  const rightPanel = useResizablePanel(288, RIGHT_MIN, RIGHT_MAX, 'right');

  // ── Layer DnD state
  const layerDragIdx  = useRef<number | null>(null);
  const [layerDropIdx, setLayerDropIdx] = useState<number | null>(null);

  // ─── Load ────────────────────────────────────────────────────────────────

  const loadTemplates = async (selectId?: string) => {
    try {
      setLoading(true);
      const list = await fetchPrintTemplates({ storeId: store?.id });
      setTemplates(list);
      const toSelect = selectId ? list.find((t) => t.id === selectId) : list[0];
      applyTemplateSelection(toSelect || null);
    } catch {
      toast({ title: 'Error', description: 'Failed to load templates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }

    /*
     * Which documents the profile calls for but the store does not have.
     *
     * Deliberately AFTER the list has been shown and outside the try above: a
     * failure here must not stop the designer loading. Missing-template advice
     * is helpful, not essential, and a store with a broken retail profile still
     * needs to edit the templates it already has.
     */
    try {
      const { missing } = await getMissingTemplates();
      setMissingTemplates(missing || []);
    } catch {
      setMissingTemplates([]);
    }
  };

  /** Create the documents the profile calls for. Additive — never overwrites. */
  const handleProvisionMissing = async () => {
    setProvisioning(true);
    try {
      const result = await provisionTemplates();
      const created = result.created?.length || 0;
      toast({
        title: created ? 'Templates created' : 'Nothing to create',
        description: created
          ? result.created.map((t) => t.name).join(', ')
          : 'This store already has every document its profile calls for.',
      });
      await loadTemplates();
    } catch (error) {
      toast({
        title: 'Could not create templates',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProvisioning(false);
    }
  };

  useEffect(() => {
    if (store?.id) loadTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  const applyTemplateSelection = (template: PrintTemplate | null) => {
    setSelectedTemplate(template);
    setBlocks((template?.blocks || []) as TemplateBlock[]);
    setSelectedBlockId(null);
    setDirty(false);
    setShowVersions(false);
    if (template) {
      setPaperSize(DEFAULT_PAPER_SIZE_FOR_TYPE[template.templateType] || 'a4');
      fetchTemplateVersions(template.id).then(setVersions).catch(() => setVersions([]));
    } else {
      setVersions([]);
    }
  };

  const requestSelectTemplate = (template: PrintTemplate) => {
    if (template.id === selectedTemplate?.id) return;
    if (dirty) { setPendingAction({ type: 'switchTemplate', template }); return; }
    applyTemplateSelection(template);
  };

  // Depends on the duty-free block's presence as well as the template type, so
  // adding or hiding that block switches the preview to match.
  const isDutyFreeTemplate = useMemo(
    () => blocks.some((b) => b.type === 'dutyFree' && b.visible),
    [blocks],
  );

  // The fixture's storeName/storeAddress/storePhone/storeEmail/storeTaxId
  // are fictional sample identities (see printFixtures.js's header comment)
  // chosen per document TYPE/vertical, not per real tenant — that's
  // deliberate, so a template can be previewed with realistic content even
  // for a vertical this store doesn't sell in. But the Logo block above
  // always renders this store's own REAL configured logo (storeLogoUrl,
  // from Settings → General — see TemplateCanvas.tsx), never a fixture
  // logo. Left unmerged, that produces a preview showing the tenant's real
  // logo directly above a completely fictional business name/address/phone
  // — confusing, and reads like the wrong store's data even though nothing
  // is actually broken. Overlay this store's own real identity fields onto
  // the fixture so the preview is internally consistent (real logo + real
  // name/address/contact info), while leaving every fixture field that
  // isn't a store-identity field — tax label/rate, sample items, sample
  // customer, totals — untouched, since those exist specifically to
  // demonstrate the selected document type/vertical/jurisdiction, not this
  // store's own transactions.
  const withRealStoreIdentity = (fixture: any) => {
    if (!fixture || !store) return fixture;
    return {
      ...fixture,
      storeName: store.name || fixture.storeName,
      storeAddress: store.address || fixture.storeAddress,
      storePhone: store.phone || fixture.storePhone,
      storeTel: store.phone || fixture.storeTel,
      storeEmail: store.email || fixture.storeEmail,
      storeTaxId: (store as any)?.tax_id || (store as any)?.taxId || fixture.storeTaxId,
    };
  };

  useEffect(() => {
    if (!selectedTemplate) { setFixtureData(null); return; }
    const [type, name] = FIXTURE_FOR(selectedTemplate.templateType, paperSize, blocks);
    fetchFixture(type, name).then((f) => setFixtureData(withRealStoreIdentity(f))).catch(() => setFixtureData(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?.templateType, paperSize, isDutyFreeTemplate, store?.id]);

  // ─── CRUD ────────────────────────────────────────────────────────────────

  const handleCreateTemplate = async (result: NewTemplateResult) => {
    try {
      let created: PrintTemplate;
      if (result.startFrom !== 'blank') {
        const source = templates.find((t) => t.id === result.startFrom);
        if (!source) throw new Error('Source template not found');
        created = await duplicatePrintTemplate(source, result.name);
      } else {
        created = await savePrintTemplate({ name: result.name, templateType: result.templateType, storeId: store?.id });

        // A preset may carry overrides that apply to the whole template rather
        // than a single block — gift mode being the case that exists today. The
        // backend seeds the block set from templateType; this layers the
        // preset's own configuration on top.
        if (result.preset?.overrides) {
          const overrides = result.preset.overrides as Record<string, unknown>;
          const patched = ((created.blocks || []) as TemplateBlock[]).map((b) => ({
            ...b,
            config: { ...(b.config || {}), ...overrides },
          }));
          created = await savePrintTemplate({ ...created, blocks: patched });
        }
      }
      await loadTemplates(created.id);
      toast({
        title: 'Template created',
        description: result.preset
          ? `"${created.name}" created from the ${result.preset.name} preset.`
          : `"${created.name}" is ready to design.`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to create template', variant: 'destructive' });
    }
  };

  const handleDuplicateSubmit = async (name: string) => {
    if (!selectedTemplate) return;
    try {
      const created = await duplicatePrintTemplate({ ...selectedTemplate, blocks }, name);
      await loadTemplates(created.id);
      toast({ title: 'Template duplicated', description: `Created "${created.name}".` });
    } catch {
      toast({ title: 'Error', description: 'Failed to duplicate template', variant: 'destructive' });
    }
  };

  const performDelete = async () => {
    if (!selectedTemplate) return;
    try {
      await deletePrintTemplate(selectedTemplate.id);
      toast({ title: 'Template deleted', description: `"${selectedTemplate.name}" was removed.` });
      await loadTemplates();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete template', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    try {
      setSaving(true);
      const updated = await savePrintTemplate({ ...selectedTemplate, blocks });
      setSelectedTemplate(updated);
      setTemplates(templates.map((t) => (t.id === updated.id ? updated : t)));
      setDirty(false);
      toast({ title: 'Draft saved', description: 'Your changes have been saved.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedTemplate) return;
    try {
      if (dirty) await handleSave();
      const published = await publishPrintTemplate(selectedTemplate.id);
      setSelectedTemplate(published);
      setTemplates(templates.map((t) => (t.id === published.id ? published : t)));
      const list = await fetchTemplateVersions(selectedTemplate.id);
      setVersions(list);
      toast({ title: 'Template published', description: 'This is now the default for its document type.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to publish template', variant: 'destructive' });
    }
  };

  /**
   * Adopt the current default block set.
   *
   * A template created before an improvement keeps its original blocks forever —
   * which is why an older jewelry invoice still shows a single flat tax line
   * instead of the multi-rate summary. This pulls the latest defaults in.
   * Versioned server-side, so it is reversible from Version History.
   */
  const performResetDefaults = async () => {
    if (!selectedTemplate) return;
    try {
      const updated = await resetTemplateToDefaults(selectedTemplate.id);
      setSelectedTemplate(updated);
      setBlocks((updated.blocks || []) as TemplateBlock[]);
      setTemplates(templates.map((t) => (t.id === updated.id ? updated : t)));
      const list = await fetchTemplateVersions(selectedTemplate.id);
      setVersions(list);
      setDirty(false);
      toast({
        title: 'Template refreshed',
        description: 'Updated to the latest blocks. Undo from Version History if needed.',
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to refresh template', variant: 'destructive' });
    }
  };

  const performRollback = async (version: number) => {
    if (!selectedTemplate) return;
    try {
      const rolledBack = await rollbackPrintTemplate(selectedTemplate.id, version);
      setSelectedTemplate(rolledBack);
      setBlocks((rolledBack.blocks || []) as TemplateBlock[]);
      setTemplates(templates.map((t) => (t.id === rolledBack.id ? rolledBack : t)));
      const list = await fetchTemplateVersions(selectedTemplate.id);
      setVersions(list);
      setDirty(false);
      toast({ title: 'Rolled back', description: `Reverted to version ${version}.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to rollback template', variant: 'destructive' });
    }
  };

  // ─── Block mutations ─────────────────────────────────────────────────────

  const updateBlocks = (next: TemplateBlock[]) => { setBlocks(next); setDirty(true); };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    sorted.forEach((b, i) => { b.order = i + 1; });
    updateBlocks(sorted);
  };

  const addBlock = (type: string) => {
    const newBlock: TemplateBlock = {
      id: createLocalId(type),
      type,
      visible: true,
      order: blocks.length + 1,
      label: BLOCK_TYPE_META[type]?.label || type,
      config: {},
    };
    updateBlocks([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setLeftTab('layers');
  };

  const updateBlock = (updatedBlock: TemplateBlock) =>
    updateBlocks(blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)));

  const removeBlock = (blockId: string) => {
    updateBlocks(blocks.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const toggleBlockVisibility = (blockId: string) =>
    updateBlocks(blocks.map((b) => (b.id === blockId ? { ...b, visible: !b.visible } : b)));

  const moveBlockInLayer = (blockId: string, direction: 'up' | 'down') => {
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((b) => b.id === blockId);
    if (direction === 'up' && idx > 0) handleReorder(idx, idx - 1);
    else if (direction === 'down' && idx < sorted.length - 1) handleReorder(idx, idx + 1);
  };

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedBlockId) || null,
    [blocks, selectedBlockId],
  );

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks],
  );

  const storeLogoUrl = useMemo(() => normalizeImageUrl(store?.logoUrl), [store?.logoUrl]);

  const handlePrintPreview = () => {
    if (!selectedTemplate) return;
    try {
      const html = buildPrintableHtml(blocks, fixtureData, paperSize, storeLogoUrl);
      printHtmlDocument(html);
    } catch {
      toast({ title: 'Error', description: 'Failed to open print preview', variant: 'destructive' });
    }
  };

  const groupedPalette = useMemo(() => {
    const query = paletteSearch.trim().toLowerCase();
    const groups: Record<string, string[]> = {};
    Object.keys(BLOCK_TYPE_META).forEach((type) => {
      // Some blocks render correctly but are held back from the palette —
      // pharmacy pending regulatory review, reprint superseded by print counts.
      if (!isBlockAvailable(type)) return;
      const meta = BLOCK_TYPE_META[type];
      if (query && !meta.label.toLowerCase().includes(query) && !meta.description.toLowerCase().includes(query)) return;
      if (!groups[meta.category]) groups[meta.category] = [];
      groups[meta.category].push(type);
    });
    return groups;
  }, [paletteSearch]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading templates…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">

      {/* ── Top Action Bar ─────────────────────────────────────────────────── */}
      <div className="h-14 border-b bg-card flex items-center px-4 gap-3 shrink-0 z-10">

        <div className="flex items-center gap-2 text-muted-foreground/60 shrink-0">
          <LayoutTemplate className="h-4 w-4" />
          <span className="text-xs font-medium text-muted-foreground">Print Templates</span>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {selectedTemplate ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-semibold text-sm truncate">{selectedTemplate.name}</span>
            <Badge variant="outline" className="text-[10px] shrink-0 h-5">
              {TEMPLATE_TYPE_LABELS[selectedTemplate.templateType] || selectedTemplate.templateType}
            </Badge>
            <Badge variant="outline" className="text-[10px] shrink-0 h-5">
              v{selectedTemplate.version}
            </Badge>
            {selectedTemplate.isPublished && (
              <Badge className="text-[10px] shrink-0 h-5 bg-emerald-500/10 text-emerald-700 border-emerald-200 hover:bg-emerald-500/10">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Published
              </Badge>
            )}
            {selectedTemplate.isDefault && (
              <Badge className="text-[10px] shrink-0 h-5 bg-amber-500/10 text-amber-700 border-amber-200 hover:bg-amber-500/10">
                <Star className="h-2.5 w-2.5 mr-1" /> Default
              </Badge>
            )}
            {dirty && (
              <Badge className="text-[10px] shrink-0 h-5 bg-orange-500/10 text-orange-700 border-orange-200 hover:bg-orange-500/10">
                <AlertCircle className="h-2.5 w-2.5 mr-1" /> Unsaved
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground flex-1">No template selected</span>
        )}

        {selectedTemplate && (
          <div className="shrink-0">
            <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PaperSize)}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAPER_SIZE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="h-5 w-px bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedTemplate && (
            <>
              <Button variant="outline" size="sm" onClick={handlePrintPreview} className="h-8 gap-1.5">
                <FileSearch className="h-3.5 w-3.5" /> Preview
              </Button>

              {/* Not yet published → single Publish action */}
              {!selectedTemplate.isPublished && (
                <Button size="sm" onClick={handlePublish} disabled={saving} className="h-8 gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Publish
                </Button>
              )}

              {/* Already published → Save changes when dirty */}
              {selectedTemplate.isPublished && dirty && (
                <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              )}

              {/* Already published, nothing changed → subtle saved indicator */}
              {selectedTemplate.isPublished && !dirty && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Saved
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setDuplicateDialogOpen(true)}>
                    <Copy className="h-4 w-4 mr-2" /> Duplicate template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowVersions((v) => !v)}>
                    <History className="h-4 w-4 mr-2" /> Version history
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPendingAction({ type: 'resetDefaults' })}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Refresh to latest blocks
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    onClick={() => setPendingAction({ type: 'delete' })}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Button size="sm" onClick={() => setNewDialogOpen(true)} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
      </div>

      {/* ── Version History Panel ──────────────────────────────────────────── */}
      {showVersions && selectedTemplate && (
        <div className="border-b bg-card px-4 py-3 space-y-2 shrink-0 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Version History
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowVersions(false)} className="h-6 text-xs">
              Close
            </Button>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No published versions yet.</p>
          ) : (
            <div className="divide-y">
              {versions.map((version) => (
                <div key={version.id} className="flex items-center justify-between py-2 first:pt-0">
                  <div>
                    <div className="text-xs font-medium">Version {version.version}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString()} — {version.changeDescription}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={version.version === selectedTemplate.version}
                    onClick={() => setPendingAction({ type: 'rollback', version: version.version })}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Rollback
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main Workspace ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar (resizable) ─────────────────────────────────────── */}
        <div
          className="border-r bg-card flex flex-col shrink-0 overflow-hidden"
          style={{ width: leftPanel.width }}
        >
          {/* Template picker */}
          <div className="border-b shrink-0">
            <button
              onClick={() => setTemplateListOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              <span>Templates ({templates.length})</span>
              {templateListOpen
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {templateListOpen && (
              <div className="divide-y max-h-52 overflow-y-auto border-t">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => requestSelectTemplate(template)}
                    className={cn(
                      'w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors',
                      selectedTemplate?.id === template.id && 'bg-primary/5 border-l-2 border-primary',
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-xs truncate flex-1">{template.name}</span>
                      {template.isPublished && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                      {template.isDefault   && <Star         className="h-3 w-3 text-amber-500 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {TEMPLATE_TYPE_LABELS[template.templateType] || template.templateType}
                    </div>
                  </button>
                ))}
                {templates.length === 0 && (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">No templates yet.</div>
                )}
              </div>
            )}

            {/*
              Documents this store's profile calls for but does not have.

              Provisioning runs at signup and when the business type or
              duty-free setting changes — but NOT when the document set itself
              grows. A store that existed before a new document type was added
              would simply never get it, with nothing on screen to suggest
              anything was missing. That is exactly how the Refund / Credit Note
              went unnoticed after it was added to the plan.
            */}
            {missingTemplates.length > 0 && (
              <div className="px-3 py-2.5 border-t bg-amber-50 dark:bg-amber-950/30">
                <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                  {missingTemplates.length === 1
                    ? '1 document is missing for this store'
                    : `${missingTemplates.length} documents are missing for this store`}
                </p>
                <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-200/70">
                  {missingTemplates.map((t) => t.name).join(', ')}
                </p>
                <button
                  onClick={handleProvisionMissing}
                  disabled={provisioning}
                  className="mt-2 w-full rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-[11px] font-medium py-1.5 transition-colors"
                >
                  {provisioning ? 'Creating…' : 'Create them'}
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b shrink-0">
            {(['palette', 'layers'] as LeftTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                  leftTab === tab
                    ? 'text-primary border-b-2 border-primary bg-primary/3'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
                )}
              >
                {tab === 'palette'
                  ? <><Palette className="h-3.5 w-3.5" /> Palette</>
                  : <><Layers  className="h-3.5 w-3.5" /> Layers</>}
              </button>
            ))}
          </div>

          {/* Tab content — flex-1 so it fills remaining sidebar height */}
          <div className="flex-1 overflow-y-auto">

            {/* PALETTE */}
            {leftTab === 'palette' && (
              <div className="p-3 space-y-3">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                    placeholder="Search blocks…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                {!selectedTemplate && (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    Select a template to add blocks.
                  </p>
                )}
                {Object.entries(groupedPalette).map(([category, types]) => (
                  <div key={category}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5 px-0.5">
                      {BLOCK_CATEGORY_LABELS[category as keyof typeof BLOCK_CATEGORY_LABELS]}
                    </div>
                    <div className="space-y-0.5">
                      {types.map((type) => {
                        const meta = BLOCK_TYPE_META[type];
                        return (
                          <button
                            key={type}
                            disabled={!selectedTemplate}
                            onClick={() => addBlock(type)}
                            className={cn(
                              'w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors border border-transparent',
                              selectedTemplate
                                ? 'hover:bg-secondary hover:border-border cursor-pointer'
                                : 'opacity-40 cursor-not-allowed',
                            )}
                          >
                            <span className="mt-0.5 text-muted-foreground">{blockIcon(type)}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-medium leading-tight">{meta.label}</div>
                              <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                                {meta.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {Object.keys(groupedPalette).length === 0 && paletteSearch && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No blocks match "{paletteSearch}"
                  </p>
                )}
              </div>
            )}

            {/* LAYERS — drag-and-drop reorder */}
            {leftTab === 'layers' && (
              <div
                className="p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (layerDragIdx.current !== null && layerDropIdx !== null && layerDragIdx.current !== layerDropIdx) {
                    handleReorder(layerDragIdx.current, layerDropIdx);
                  }
                  layerDragIdx.current = null;
                  setLayerDropIdx(null);
                }}
              >
                {sortedBlocks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No blocks yet. Add blocks from the Palette tab.
                  </p>
                )}
                {sortedBlocks.map((block, idx) => (
                  <div key={block.id}>
                    {/* Drop indicator above this row */}
                    {layerDropIdx === idx && layerDragIdx.current !== idx && (
                      <div className="h-0.5 bg-primary rounded mx-1 mb-0.5" />
                    )}
                    <div
                      draggable
                      onDragStart={(e) => {
                        layerDragIdx.current = idx;
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (layerDropIdx !== idx) setLayerDropIdx(idx);
                      }}
                      onDragEnd={() => {
                        layerDragIdx.current = null;
                        setLayerDropIdx(null);
                      }}
                      onClick={() => setSelectedBlockId(block.id)}
                      className={cn(
                        'group flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing transition-colors select-none mb-0.5',
                        selectedBlockId === block.id
                          ? 'bg-primary/8 border border-primary/20'
                          : 'hover:bg-secondary/60 border border-transparent',
                        !block.visible && 'opacity-50',
                        layerDragIdx.current === idx && 'opacity-40 ring-1 ring-primary/30',
                      )}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
                      <span className="text-muted-foreground shrink-0">{blockIcon(block.type)}</span>
                      <span className="flex-1 text-xs truncate font-medium">
                        {block.label || BLOCK_TYPE_META[block.type]?.label || block.type}
                      </span>
                      {/* Hover actions */}
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleBlockVisibility(block.id); }}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                          title={block.visible ? 'Hide block' : 'Show block'}
                        >
                          {block.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
                          title="Delete block"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {/* Drop indicator below last row */}
                    {idx === sortedBlocks.length - 1 && layerDropIdx === sortedBlocks.length && (
                      <div className="h-0.5 bg-primary rounded mx-1 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Left resize handle ───────────────────────────────────────────── */}
        <div
          onMouseDown={leftPanel.onMouseDown}
          className="w-1 cursor-col-resize bg-border hover:bg-primary/40 transition-colors shrink-0 select-none"
          title="Drag to resize panel"
        />

        {/* ── Canvas Stage (fills all remaining space) ─────────────────────── */}
        <div
          className="flex-1 overflow-auto bg-muted/40 flex flex-col items-center"
          onClick={() => setSelectedBlockId(null)}
        >
          {!selectedTemplate ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
              <LayoutTemplate className="h-12 w-12 text-muted-foreground/25" />
              <div>
                <p className="font-medium text-sm">No template selected</p>
                <p className="text-xs mt-1 max-w-xs">
                  Pick a template from the sidebar, or create a new one to start designing.
                </p>
              </div>
              <Button size="sm" onClick={() => setNewDialogOpen(true)} className="mt-2 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Template
              </Button>
            </div>
          ) : (
            /* Paper card — centered horizontally, starts at top, natural height */
            <div className="py-8 px-6 flex justify-center items-start min-h-full w-full">
              <div className="shadow-xl ring-1 ring-black/8 bg-white rounded-sm overflow-hidden">
                <TemplateCanvas
                  paperSize={paperSize}
                  blocks={blocks}
                  fixtureData={fixtureData}
                  storeLogoUrl={storeLogoUrl}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onReorder={handleReorder}
                  onToggleVisibility={toggleBlockVisibility}
                  onDeleteBlock={removeBlock}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Right resize handle ──────────────────────────────────────────── */}
        <div
          onMouseDown={rightPanel.onMouseDown}
          className="w-1 cursor-col-resize bg-border hover:bg-primary/40 transition-colors shrink-0 select-none"
          title="Drag to resize panel"
        />

        {/* ── Right Panel: Properties (resizable) ─────────────────────────── */}
        <div
          className="border-l bg-card overflow-y-auto shrink-0"
          style={{ width: rightPanel.width }}
        >
          {!selectedBlock ? (
            /* Template info + hints when nothing selected */
            <div className="p-4 space-y-4">
              {selectedTemplate ? (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                      Template Info
                    </p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium text-right max-w-[60%] truncate">{selectedTemplate.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">
                          {TEMPLATE_TYPE_LABELS[selectedTemplate.templateType] || selectedTemplate.templateType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-medium">v{selectedTemplate.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className={cn(
                          'font-medium',
                          selectedTemplate.isPublished ? 'text-emerald-600' : 'text-amber-600',
                        )}>
                          {selectedTemplate.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Blocks</span>
                        <span className="font-medium">
                          {blocks.length} total, {blocks.filter((b) => b.visible).length} visible
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paper</span>
                        <span className="font-medium">{PAPER_SIZE_LABELS[paperSize]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Usage hints */}
                  <div className="border-t pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      How to use
                    </p>
                    <div className="space-y-2">
                      {[
                        ['Click a block on the canvas', 'to select and edit its properties here.'],
                        ['Drag blocks on the canvas', 'to reorder them vertically.'],
                        ['Add blocks from Palette tab', 'then arrange them in the Layers tab.'],
                        ['Preview uses real sample data', 'Print Preview opens as PDF for exact output.'],
                      ].map(([title, desc]) => (
                        <div key={title} className="flex gap-2">
                          <Info className="h-3 w-3 text-muted-foreground/50 mt-0.5 shrink-0" />
                          <div className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground/70">{title}</span> — {desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="border-t pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Quick Actions
                    </p>
                    <div className="space-y-1.5">
                      <Button
                        variant="outline" size="sm"
                        className="w-full justify-start text-xs h-8 gap-2"
                        onClick={handlePrintPreview}
                      >
                        <FileSearch className="h-3.5 w-3.5" /> Open Print Preview
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="w-full justify-start text-xs h-8 gap-2"
                        onClick={handleSave}
                        disabled={!dirty || saving}
                      >
                        <Save className="h-3.5 w-3.5" /> Save Draft
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="w-full justify-start text-xs h-8 gap-2"
                        onClick={() => setDuplicateDialogOpen(true)}
                      >
                        <Copy className="h-3.5 w-3.5" /> Duplicate Template
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className="w-full justify-start text-xs h-8 gap-2"
                        onClick={() => setShowVersions((v) => !v)}
                      >
                        <History className="h-3.5 w-3.5" /> Version History
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <PenLine className="h-6 w-6 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Select a template from the left sidebar to get started.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Block selected — properties */
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                <span className="text-muted-foreground">{blockIcon(selectedBlock.type)}</span>
                <span className="text-xs font-semibold flex-1">
                  {selectedBlock.label || BLOCK_TYPE_META[selectedBlock.type]?.label || selectedBlock.type}
                </span>
                <Badge variant="secondary" className="text-[10px] h-4 shrink-0">
                  {BLOCK_TYPE_META[selectedBlock.type]?.category}
                </Badge>
              </div>
              <BlockPropertiesPanel
                block={selectedBlock}
                onChange={updateBlock}
                onDelete={removeBlock}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <NewTemplateDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        existingTemplates={templates}
        onSubmit={handleCreateTemplate}
      />
      <PromptDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        title="Duplicate template"
        description="Create a copy of this template with your current unsaved edits included."
        label="New template name"
        defaultValue={selectedTemplate ? `${selectedTemplate.name} Copy` : ''}
        confirmLabel="Duplicate"
        onSubmit={handleDuplicateSubmit}
      />
      <ConfirmDialog
        open={pendingAction?.type === 'delete'}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title="Delete this template?"
        description={`"${selectedTemplate?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => { performDelete(); setPendingAction(null); }}
      />
      <ConfirmDialog
        open={pendingAction?.type === 'rollback'}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title={`Rollback to version ${pendingAction?.type === 'rollback' ? pendingAction.version : ''}?`}
        description="Your current draft changes will be replaced with this version's content."
        confirmLabel="Rollback"
        variant="destructive"
        onConfirm={() => {
          if (pendingAction?.type === 'rollback') performRollback(pendingAction.version);
          setPendingAction(null);
        }}
      />
      <ConfirmDialog
        open={pendingAction?.type === 'resetDefaults'}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title="Refresh to the latest blocks?"
        description={
          'This template will adopt the current default layout for its type, picking up '
          + 'improvements added since it was created. Your current version is saved first, '
          + 'so you can undo from Version History.'
        }
        confirmLabel="Refresh"
        onConfirm={() => { performResetDefaults(); setPendingAction(null); }}
      />

      <ConfirmDialog
        open={pendingAction?.type === 'switchTemplate'}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title="Discard unsaved changes?"
        description="You have unsaved changes on this template. Switching templates will discard them."
        confirmLabel="Discard & Switch"
        variant="destructive"
        onConfirm={() => {
          if (pendingAction?.type === 'switchTemplate') applyTemplateSelection(pendingAction.template);
          setPendingAction(null);
        }}
      />
    </div>
  );
};

export default PrintTemplateDesigner;
