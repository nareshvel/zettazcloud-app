/**
 * LabelPrinterSettings
 * Settings card for the label / tag printer.
 * Supports Zebra ZPL, TSC/Godex network, and browser (PDF) options.
 * Includes label-size presets by category and a live SVG preview.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO — Label / Tag Printer (dedicated work sprint needed)
 * ─────────────────────────────────────────────────────────────────────────────
 * This component covers the basic configuration but needs a full, dedicated
 * work sprint before it is production-ready.  Key areas to tackle:
 *
 * 1. LABEL TEMPLATES PER INDUSTRY
 *    - Jewellery: loop/barbell tag, ring sleeve, necklace card, pouch sticker
 *    - General retail: barcode sticker, shelf edge, price gun roll
 *    - Apparel: hang tag (portrait), woven label equivalent
 *    - Electronics / Parts: small poly bag label, component tape label
 *    - Each template should define: field layout, font sizes, barcode position,
 *      logo placement, and which data fields to print.
 *
 * 2. VISUAL LABEL DESIGNER
 *    - Drag-and-drop field placement on the SVG canvas (barcode, text, logo)
 *    - Per-field font size, alignment, bold toggle
 *    - Live WYSIWYG preview with real product data (loaded from a sample piece)
 *
 * 3. ZPL / TSPL TEMPLATE GENERATION
 *    - Auto-generate correct ZPL II / TSPL-EZ commands from the visual layout
 *    - Support for different print densities (203 dpi / 300 dpi)
 *    - Test-print a live label from the settings page
 *
 * 4. MEDIA / PAPER PROFILES
 *    - Gap sensing vs. black mark vs. continuous
 *    - Print speed & darkness settings per printer model
 *    - Calibration step launcher
 *
 * 5. MULTI-LABEL SUPPORT
 *    - Some jobs need two label sizes (e.g. main tag + small barcode sticker)
 *    - Store up to 3 active label profiles per store
 *
 * 6. LOGO / BRANDING ON LABELS
 *    - Upload a monochrome logo for thermal printing (1-bit BMP → ZPL ^GF)
 *    - Position above barcode or top-right corner
 *
 * Until this sprint is done, the current implementation serves as a functional
 * placeholder — printer type + network address + basic size selection work,
 * but template customisation and ZPL generation are not yet implemented.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { Tag, Printer, Wifi, Globe, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLabelSettings, saveLabelSettings, testLabelPrinter, type LabelSettings } from '@/services/labelService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';

// ─── Printer type options ────────────────────────────────────────────────────
const PRINTER_TYPES = [
  { value: 'none',         label: 'Disabled',          icon: Printer, desc: 'No label printer configured' },
  { value: 'zebra_zpl',   label: 'Zebra (ZPL II)',     icon: Wifi,    desc: 'Network Zebra printer — ZPL over TCP port 9100' },
  { value: 'tsc_network', label: 'TSC / Godex (TSPL)', icon: Wifi,    desc: 'Network TSC or Godex printer — TSPL-EZ over TCP port 9100' },
  { value: 'browser',     label: 'Browser / PDF',       icon: Globe,   desc: 'Opens the browser print dialog — works with any printer' },
] as const;

// ─── Label size presets ──────────────────────────────────────────────────────
// Organised by retail use-case so staff can pick the right label quickly.
// Sizes are in mm (width × height).
const LABEL_PRESETS = [
  // Jewellery tags — small looped / barbell tags
  { id: 'j_micro',   cat: 'Jewellery',  name: 'Micro Tag',     w: 25,  h: 15,  note: 'Earrings & small stones' },
  { id: 'j_sm',      cat: 'Jewellery',  name: 'Loop Tag S',    w: 38,  h: 20,  note: 'Standard swing tag' },
  { id: 'j_md',      cat: 'Jewellery',  name: 'Loop Tag M',    w: 50,  h: 25,  note: 'Rings & bangles' },
  { id: 'j_long',    cat: 'Jewellery',  name: 'Long Tag',      w: 76,  h: 25,  note: 'Necklaces & chains' },
  // Product labels — barcode stickers for general retail
  { id: 'p_sm',      cat: 'Product',    name: 'Sticker S',     w: 50,  h: 30,  note: 'Small product sticker' },
  { id: 'p_barcode', cat: 'Product',    name: 'Barcode Label', w: 58,  h: 40,  note: 'Standard barcode label' },
  { id: 'p_wide',    cat: 'Product',    name: 'Wide Label',    w: 80,  h: 50,  note: 'Wide product / box label' },
  // Shelf & display labels
  { id: 's_sm',      cat: 'Shelf',      name: 'Shelf Tag S',   w: 70,  h: 40,  note: 'Tray / shelf label' },
  { id: 's_md',      cat: 'Shelf',      name: 'Shelf Tag M',   w: 100, h: 50,  note: 'Wide display shelf label' },
  { id: 's_box',     cat: 'Shelf',      name: 'Box Label',     w: 100, h: 75,  note: 'Storage box / packing label' },
  // Custom — user enters own dimensions
  { id: 'custom',    cat: 'Custom',     name: 'Custom',        w: null, h: null, note: 'Enter your own dimensions' },
] as const;

type PresetId = typeof LABEL_PRESETS[number]['id'];
type Category = 'Jewellery' | 'Product' | 'Shelf' | 'Custom';
const CATEGORIES: Category[] = ['Jewellery', 'Product', 'Shelf', 'Custom'];

// ─── SVG label preview ───────────────────────────────────────────────────────
const PREVIEW_W = 220; // px canvas width
const PREVIEW_H = 130; // px canvas height

function LabelPreview({ widthMm, heightMm }: { widthMm: number; heightMm: number }) {
  const w = Math.max(1, widthMm || 50);
  const h = Math.max(1, heightMm || 25);
  const scale = Math.min(PREVIEW_W / w, PREVIEW_H / h) * 0.82;
  const pw = w * scale;
  const ph = h * scale;
  const ox = (PREVIEW_W - pw) / 2;
  const oy = (PREVIEW_H - ph) / 2;

  // Simulated barcode bars — 20 bars across 60% of label width
  const barcodeX = ox + pw * 0.08;
  const barcodeW = pw * 0.60;
  const barcodeH = Math.min(ph * 0.30, 22);
  const barcodeY = oy + ph * 0.10;
  const barCount = 20;
  const barW = barcodeW / (barCount * 1.8);

  // Text rows below barcode
  const textX = ox + pw * 0.08;
  const textW = pw * 0.84;
  const row1Y = barcodeY + barcodeH + ph * 0.09;
  const row2Y = row1Y + Math.min(ph * 0.13, 9);
  const row3Y = row2Y + Math.min(ph * 0.13, 9);
  const fs = Math.max(4, Math.min(7, ph * 0.09));

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={PREVIEW_W}
        height={PREVIEW_H}
        viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
        className="rounded-lg bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border"
      >
        {/* Label body */}
        <rect x={ox} y={oy} width={pw} height={ph} rx={2} fill="white" stroke="#d1d5db" strokeWidth={1} />

        {/* Barcode bars */}
        {Array.from({ length: barCount }).map((_, i) => {
          const x = barcodeX + i * (barcodeW / barCount);
          const w = barW * (i % 3 === 0 ? 1.6 : 1);
          const h2 = i % 5 === 0 ? barcodeH : barcodeH * 0.85;
          return <rect key={i} x={x} y={barcodeY} width={w} height={h2} fill="#1f2937" />;
        })}

        {/* Barcode number stub */}
        <text x={barcodeX + barcodeW / 2} y={barcodeY + barcodeH + ph * 0.055} textAnchor="middle" fontSize={Math.max(3.5, fs - 1)} fill="#6b7280" fontFamily="monospace">
          1234567890
        </text>

        {/* Product name */}
        <rect x={textX} y={row1Y - fs + 1} width={textW} height={fs + 1} rx={1} fill="#f3f4f6" />
        <text x={textX + 2} y={row1Y} fontSize={fs} fill="#374151" fontWeight="600" fontFamily="sans-serif">
          Gold Ring 22K
        </text>

        {/* Purity · Weight */}
        <text x={textX + 2} y={row2Y} fontSize={Math.max(3, fs - 1)} fill="#6b7280" fontFamily="sans-serif">
          Purity: 22K  |  Wt: 5.20g
        </text>

        {/* Price */}
        <text x={textX + 2} y={row3Y} fontSize={Math.max(3, fs - 0.5)} fill="#111827" fontWeight="700" fontFamily="sans-serif">
          ₹ 32,500
        </text>
      </svg>
      <p className="text-xs text-gray-400 dark:text-muted-foreground">{w} × {h} mm</p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function LabelPrinterSettings({ storeId }: { storeId?: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  // Save path is PUT /labels/settings → settings.printer.
  const canEdit = hasPermission(user, 'settings.printer');
  const [cfg, setCfg] = useState<LabelSettings>({
    label_printer_type: 'none',
    label_printer_address: '',
    label_paper_width_mm: 50,
    label_paper_height_mm: 25,
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [activeCat, setActiveCat] = useState<Category>('Jewellery');
  // Track which preset is selected (null = manually edited custom)
  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>('j_md');
  // Custom dimension inputs (only used when preset === 'custom')
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');

  useEffect(() => {
    getLabelSettings(storeId)
      .then(s => {
        // API may return undefined/null/string for numeric fields — coerce defensively
        const safe = {
          ...s,
          label_paper_width_mm:  Number(s.label_paper_width_mm)  || 50,
          label_paper_height_mm: Number(s.label_paper_height_mm) || 25,
        };
        setCfg(safe);
        // Try to match loaded dimensions to a preset
        const match = LABEL_PRESETS.find(p => p.w === safe.label_paper_width_mm && p.h === safe.label_paper_height_mm);
        if (match) {
          setSelectedPreset(match.id as PresetId);
          setActiveCat(match.cat as Category);
        } else {
          setSelectedPreset('custom');
          setActiveCat('Custom');
          setCustomW(String(safe.label_paper_width_mm));
          setCustomH(String(safe.label_paper_height_mm));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await saveLabelSettings({ ...cfg, store_id: storeId });
      toast({ title: 'Label printer settings saved' });
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await testLabelPrinter(storeId);
      toast({ title: 'Test label sent!' });
    } catch (e: any) {
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    } finally { setTesting(false); }
  };

  const pickPreset = (preset: typeof LABEL_PRESETS[number]) => {
    if (!canEdit) return;
    setSelectedPreset(preset.id as PresetId);
    if (preset.w !== null && preset.h !== null) {
      setCfg(c => ({ ...c, label_paper_width_mm: preset.w!, label_paper_height_mm: preset.h! }));
    } else {
      // custom — leave current values, let user edit
      setCustomW(String(cfg.label_paper_width_mm));
      setCustomH(String(cfg.label_paper_height_mm));
    }
  };

  const applyCustom = () => {
    const w = parseInt(customW, 10);
    const h = parseInt(customH, 10);
    if (w > 0 && h > 0) {
      setCfg(c => ({ ...c, label_paper_width_mm: w, label_paper_height_mm: h }));
    }
  };

  const needsAddress = cfg.label_printer_type === 'zebra_zpl' || cfg.label_printer_type === 'tsc_network';
  const selectedType = PRINTER_TYPES.find(p => p.value === cfg.label_printer_type);

  if (loading) return <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-8 text-center text-sm text-gray-400 dark:text-muted-foreground">Loading…</div>;

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Label / Tag Printer</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Configure a dedicated label printer for product tags and barcodes.</p>
      </div>

      <div className="p-5 space-y-5">
        {/* ── Printer type pills ─────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">Printer type</label>
          <div className="flex flex-wrap gap-2">
            {PRINTER_TYPES.map(pt => {
              const Icon = pt.icon;
              const selected = cfg.label_printer_type === pt.value;
              return (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => { if (canEdit) setCfg(c => ({ ...c, label_printer_type: pt.value as LabelSettings['label_printer_type'] })); }}
                  disabled={!canEdit}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                    ${selected
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-gray-200 dark:border-border text-gray-600 dark:text-muted-foreground hover:border-primary/40 hover:bg-gray-50'}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-primary' : 'text-gray-400'}`} />
                  {pt.label}
                </button>
              );
            })}
          </div>
          {selectedType && (
            <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">{selectedType.desc}</p>
          )}
        </div>

        {/* ── Network address (narrower) + Label size + Preview ───── */}
        {cfg.label_printer_type !== 'none' && (
          <div className={`grid gap-5 items-start ${needsAddress ? 'grid-cols-1 lg:grid-cols-[200px_1fr_auto]' : 'grid-cols-1 md:grid-cols-[1fr_auto]'}`}>

            {/* IP address — fixed narrow column */}
            {needsAddress && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">Printer IP address</label>
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={cfg.label_printer_address || ''}
                  onChange={e => setCfg(c => ({ ...c, label_printer_address: e.target.value }))}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:opacity-60"
                />
                <p className="mt-1.5 text-xs text-gray-400 dark:text-muted-foreground">IP:port, default 9100</p>
              </div>
            )}

            {/* Label size — category tabs + preset cards */}
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">Label size</label>

              {/* Category tabs */}
              <div className="flex gap-1 mb-3 border-b border-gray-100 dark:border-border">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCat(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 -mb-px transition-colors
                      ${activeCat === cat
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 dark:text-muted-foreground hover:text-gray-800'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Preset cards for active category */}
              <div className="grid grid-cols-2 gap-2">
                {LABEL_PRESETS.filter(p => p.cat === activeCat).map(preset => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => pickPreset(preset)}
                      disabled={!canEdit}
                      className={`text-left rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                        ${isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-gray-200 dark:border-border hover:border-primary/40 hover:bg-gray-50'}`}
                    >
                      <div className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-800'}`}>
                        {preset.name}
                        {preset.w !== null && (
                          <span className="ml-1.5 font-mono text-xs font-normal text-gray-400 dark:text-muted-foreground">{preset.w}×{preset.h}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{preset.note}</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom dimension inputs */}
              {selectedPreset === 'custom' && (
                <div className="mt-3 flex items-end gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-muted-foreground mb-1">Width (mm)</label>
                    <input
                      type="number" min={10} max={200} value={customW}
                      onChange={e => setCustomW(e.target.value)}
                      onBlur={applyCustom}
                      disabled={!canEdit}
                      className="w-20 px-2.5 py-1.5 border border-gray-200 dark:border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                    />
                  </div>
                  <span className="text-gray-400 dark:text-muted-foreground pb-1.5">×</span>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-muted-foreground mb-1">Height (mm)</label>
                    <input
                      type="number" min={10} max={200} value={customH}
                      onChange={e => setCustomH(e.target.value)}
                      onBlur={applyCustom}
                      disabled={!canEdit}
                      className="w-20 px-2.5 py-1.5 border border-gray-200 dark:border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                    />
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={applyCustom} disabled={!canEdit} className="mb-0.5">Apply</Button>
                </div>
              )}

              <p className="text-xs text-gray-400 dark:text-muted-foreground mt-3">
                Label prints: barcode · product name · purity · weight · selling price
              </p>
            </div>

            {/* Live SVG preview */}
            <div className="shrink-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">Preview</label>
              <LabelPreview
                widthMm={cfg.label_paper_width_mm}
                heightMm={cfg.label_paper_height_mm}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 bg-gray-50 dark:bg-muted/50 border-t border-gray-100 dark:border-border flex items-center gap-2">
        {!canEdit && (
          <p className="text-xs text-gray-500 dark:text-muted-foreground mr-auto">View-only access — ask a manager to make changes.</p>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {cfg.label_printer_type !== 'none' && (
            <Button variant="outline" onClick={handleTest} disabled={testing} className="text-sm">
              <TestTube className="mr-1.5 h-4 w-4" />
              {testing ? 'Sending…' : 'Print test label'}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !canEdit} className="text-sm">
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
