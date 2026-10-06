import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Copy, FileText, Check, Search } from 'lucide-react';
import { PrintTemplate } from '@/services/printService';
import { DEFAULT_PAPER_SIZE_FOR_TYPE, PAPER_SIZE_LABELS } from '@/types/printTemplate';
import {
  TEMPLATE_PRESETS, presetsByVertical, findPreset,
  VERTICAL_LABELS, SALES_MODE_LABELS, type TemplatePreset,
} from '@/utils/templatePresets';
import { cn } from '@/lib/utils';

const TEMPLATE_TYPE_OPTIONS = [
  { value: 'receipt', label: 'Receipt' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'jewelry_invoice', label: 'Jewelry Invoice' },
  { value: 'jewelry_certificate', label: 'Jewelry Certificate' },
  { value: 'return', label: 'Refund / Credit Note' },
  { value: 'repair_ticket', label: 'Repair Ticket' },
  { value: 'old_gold_voucher', label: 'Old Gold Voucher' },
  { value: 'memo_slip', label: 'Consignment Memo' },
  { value: 'layaway_agreement', label: 'Layaway Agreement' },
  { value: 'layaway_receipt', label: 'Layaway Payment Receipt' },
  { value: 'savings_enrollment', label: 'Savings Passbook' },
  { value: 'order_acknowledgement', label: 'Order Acknowledgement' },
  { value: 'label', label: 'Label' },
  { value: 'document', label: 'Document (A4/Letter)' },
];

export interface NewTemplateResult {
  name: string;
  templateType: string;
  /** 'blank' | an existing template id to duplicate | 'preset:<presetId>' */
  startFrom: 'blank' | string;
  /** Set when a preset was chosen, so the caller can apply its overrides. */
  preset?: TemplatePreset;
}

interface NewTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTemplates: PrintTemplate[];
  onSubmit: (result: NewTemplateResult) => void;
}

type Mode = 'preset' | 'blank' | 'duplicate';

const NewTemplateDialog: React.FC<NewTemplateDialogProps> = ({
  open, onOpenChange, existingTemplates, onSubmit,
}) => {
  const [mode, setMode] = useState<Mode>('preset');
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState('receipt');
  const [duplicateFrom, setDuplicateFrom] = useState<string>('');
  const [presetId, setPresetId] = useState<string>('');
  const [search, setSearch] = useState('');

  const reset = () => {
    setMode('preset');
    setName('');
    setTemplateType('receipt');
    setDuplicateFrom('');
    setPresetId('');
    setSearch('');
  };

  const resetAndClose = () => { reset(); onOpenChange(false); };

  const selectedPreset = presetId ? findPreset(presetId) : undefined;

  /**
   * Picking a preset pre-fills the name. Users can still edit it, but a
   * sensible default removes a step from the common case.
   */
  const choosePreset = (preset: TemplatePreset) => {
    setPresetId(preset.id);
    if (!name.trim()) setName(preset.name);
  };

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return presetsByVertical();
    return presetsByVertical()
      .map((g) => ({
        ...g,
        presets: g.presets.filter((p) =>
          p.name.toLowerCase().includes(q)
          || p.description.toLowerCase().includes(q)
          || p.highlights.some((h) => h.toLowerCase().includes(q))
          || VERTICAL_LABELS[g.vertical].toLowerCase().includes(q)),
      }))
      .filter((g) => g.presets.length > 0);
  }, [search]);

  const duplicateCandidates = existingTemplates.filter((t) => t.templateType === templateType);

  const canSubmit = Boolean(
    name.trim()
    && (mode !== 'preset' || presetId)
    && (mode !== 'duplicate' || duplicateFrom),
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (mode === 'preset' && selectedPreset) {
      onSubmit({
        name: name.trim(),
        templateType: selectedPreset.templateType,
        startFrom: 'blank',
        preset: selectedPreset,
      });
    } else if (mode === 'duplicate') {
      onSubmit({ name: name.trim(), templateType, startFrom: duplicateFrom });
    } else {
      onSubmit({ name: name.trim(), templateType, startFrom: 'blank' });
    }
    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetAndClose(); else onOpenChange(next); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Print Template</DialogTitle>
          <DialogDescription>
            Start from a preset built for your business type, or from scratch.
          </DialogDescription>
        </DialogHeader>

        {/* Mode selector */}
        <div className="flex gap-1.5 shrink-0">
          {([
            ['preset', 'From a preset', FileText],
            ['blank', 'Blank', FileText],
            ['duplicate', 'Duplicate existing', Copy],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                mode === value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-secondary/40',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-1">
          {/* ── Preset gallery ─────────────────────────────────────────── */}
          {mode === 'preset' && (
            <>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search presets…"
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {groups.map((group) => (
                <div key={group.vertical} className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {VERTICAL_LABELS[group.vertical]}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {group.presets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => choosePreset(p)}
                        className={cn(
                          'text-left rounded-lg border p-3 transition-colors',
                          presetId === p.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30 hover:bg-secondary/40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium">{p.name}</span>
                          {presetId === p.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>

                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {PAPER_SIZE_LABELS[p.paperSize]}
                          </Badge>
                          {p.salesMode !== 'domestic' && (
                            <Badge className="text-[10px] h-4 px-1 bg-amber-500/10 text-amber-700 border-amber-200 hover:bg-amber-500/10">
                              {SALES_MODE_LABELS[p.salesMode]}
                            </Badge>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-snug mt-1.5">
                          {p.description}
                        </p>

                        {/* What this preset gives you that a blank one does not. */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.highlights.map((h) => (
                            <span
                              key={h}
                              className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {groups.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No presets match &ldquo;{search}&rdquo;
                </p>
              )}
            </>
          )}

          {/* ── Blank / duplicate ──────────────────────────────────────── */}
          {mode !== 'preset' && (
            <div className="space-y-1.5">
              <Label htmlFor="template-type">Document Type</Label>
              <Select
                value={templateType}
                onValueChange={(v) => { setTemplateType(v); setDuplicateFrom(''); }}
              >
                <SelectTrigger id="template-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Preview paper size: {PAPER_SIZE_LABELS[DEFAULT_PAPER_SIZE_FOR_TYPE[templateType] || 'a4']}
              </p>
            </div>
          )}

          {mode === 'duplicate' && (
            <div className="space-y-1.5">
              <Label htmlFor="duplicate-from">Copy from</Label>
              <Select value={duplicateFrom} onValueChange={setDuplicateFrom}>
                <SelectTrigger id="duplicate-from">
                  <SelectValue placeholder="Choose a template to copy" />
                </SelectTrigger>
                <SelectContent>
                  {duplicateCandidates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {duplicateCandidates.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No existing {TEMPLATE_TYPE_OPTIONS.find((o) => o.value === templateType)?.label} templates to copy.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Name — always last, so a preset can pre-fill it */}
        <div className="space-y-1.5 shrink-0 border-t pt-3">
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Front Counter Receipt"
          />
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>Create Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewTemplateDialog;
