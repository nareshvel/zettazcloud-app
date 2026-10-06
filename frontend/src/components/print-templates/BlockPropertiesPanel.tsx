import React from 'react';
import {
  TemplateBlock, TemplateField, BLOCK_TYPE_META,
  LogoLayout, BarcodeSource,
} from '@/types/printTemplate';
import {
  TABLE_PRESET_FIELDS, ACCESSOR_GROUPS, type TablePresetKey,
} from '@/utils/itemTableModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trash2, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff } from 'lucide-react';
import DynamicFieldEditor from './DynamicFieldEditor';
import { cn } from '@/lib/utils';

interface BlockPropertiesPanelProps {
  block: TemplateBlock | null;
  onChange: (block: TemplateBlock) => void;
  onDelete: (blockId: string) => void;
}

// ─── Alignment ────────────────────────────────────────────────────────────────
const ALIGN_OPTIONS: Array<{ value: 'left' | 'center' | 'right'; icon: React.ReactNode }> = [
  { value: 'left',   icon: <AlignLeft   className="h-4 w-4" /> },
  { value: 'center', icon: <AlignCenter className="h-4 w-4" /> },
  { value: 'right',  icon: <AlignRight  className="h-4 w-4" /> },
];

// ─── Block type sets ──────────────────────────────────────────────────────────
const TEXT_LIKE_TYPES   = new Set(['text', 'header', 'terms']);
const HAS_ALIGN_TYPES   = new Set(['logo', 'text', 'header', 'customer', 'address', 'terms',
  'attributes', 'purity', 'compliance', 'footer', 'price', 'custom', 'tax', 'taxSummary', 'totals', 'payment', 'dutyFree', 'taxRefund', 'reprintNotice', 'savings', 'loyalty', 'changeDue', 'returnPolicy', 'rxDetails', 'batchExpiry', 'serialCapture', 'warranty', 'fiscal']);
const HAS_FONT_SIZE_TYPES = new Set(['text', 'header', 'customer', 'address', 'table', 'terms',
  'attributes', 'purity', 'gemstones', 'tax', 'taxSummary', 'totals', 'payment', 'compliance', 'footer', 'price', 'custom', 'dutyFree', 'taxRefund', 'reprintNotice', 'savings', 'loyalty', 'changeDue', 'returnPolicy', 'rxDetails', 'batchExpiry', 'serialCapture', 'warranty', 'fiscal']);
const HAS_BOLD_TYPES    = new Set(['text', 'header', 'customer', 'terms', 'footer', 'price', 'custom']);
const HAS_FIELDS_TYPES  = new Set(['attributes', 'purity', 'gemstones', 'compliance']);

// ─── Logo layout presets ──────────────────────────────────────────────────────
const LOGO_LAYOUTS: Array<{ value: LogoLayout; label: string; desc: string }> = [
  { value: 'logo_only',         label: 'Logo only',          desc: 'Image only, no text' },
  { value: 'logo_name',         label: 'Logo + Name',        desc: 'Image beside store name' },
  { value: 'logo_name_contact', label: 'Logo + Name + Info', desc: 'Image + name + address / phone / email' },
  { value: 'name_only',         label: 'Name only',          desc: 'Store name as styled header' },
  { value: 'name_contact',      label: 'Name + Contact',     desc: 'Name + full contact block, no image' },
];

const LOGO_CONTACT_FIELD_OPTIONS: Array<{ value: 'address' | 'phone' | 'email' | 'taxId'; label: string }> = [
  { value: 'address', label: 'Address' },
  { value: 'phone',   label: 'Phone'   },
  { value: 'email',   label: 'Email'   },
  { value: 'taxId',   label: 'Tax ID'  },
];

const LOGO_HEIGHT_PRESETS = [
  { label: 'S',  mm: 10 },
  { label: 'M',  mm: 16 },
  { label: 'L',  mm: 24 },
  { label: 'XL', mm: 32 },
];

// ─── Table presets ─────────────────────────────────────────────────────────────
const TABLE_PRESETS: Array<{ value: TablePresetKey; label: string; desc: string }> = [
  { value: 'general',     label: 'General Retail',   desc: 'Item · Qty · Unit Price · Total' },
  { value: 'grocery',     label: 'Grocery',          desc: 'Item · PLU · Qty · Amount (+ weight sub-line)' },
  { value: 'pharmacy',    label: 'Pharmacy',         desc: 'Drug · Strength · Qty · Days · Amount' },
  { value: 'electronics', label: 'Electronics',      desc: 'Item · Model · Serial · Qty · Amount' },
  { value: 'apparel',     label: 'Apparel',          desc: 'Item · SKU · Size · Colour · Qty · Amount' },
  { value: 'souvenir',    label: 'Souvenir & Gifts', desc: 'Item · SKU · Item Type · Qty · Amount' },
  { value: 'jewelry',     label: 'Jewelry',          desc: 'Item · Purity · Gross/Net Wt · Making · Amount' },
  { value: 'dutyFree',    label: 'Duty-Free',        desc: 'Item · Qty · Unit Price · Amount (tax-free)' },
  { value: 'service',     label: 'Service / Repair', desc: 'Description · Hours · Rate · Amount' },
  { value: 'restaurant',  label: 'Restaurant',       desc: 'Item · Qty · Price · Amount' },
  { value: 'custom',      label: 'Custom',           desc: 'Build your own columns' },
];

// ─── Barcode source options ────────────────────────────────────────────────────
const BARCODE_SOURCES: Array<{ value: BarcodeSource; label: string }> = [
  { value: 'receiptNo',   label: 'Receipt Number' },
  { value: 'invoiceNo',   label: 'Invoice Number' },
  { value: 'orderNo',     label: 'Order / Doc Number' },
  { value: 'customerId',  label: 'Customer ID' },
  { value: 'productSku',  label: 'Product SKU' },
  { value: 'pieceId',     label: 'Piece / Serial ID' },
  { value: 'custom',      label: 'Custom text / value' },
];

// ─── Store & customer field options ───────────────────────────────────────────
const STORE_FIELD_OPTIONS: Array<{ value: 'name' | 'address' | 'phone' | 'email' | 'taxId'; label: string }> = [
  { value: 'name',    label: 'Name'    },
  { value: 'address', label: 'Address' },
  { value: 'phone',   label: 'Phone'   },
  { value: 'email',   label: 'Email'   },
  { value: 'taxId',   label: 'Tax ID'  },
];

const CUSTOMER_FIELD_OPTIONS: Array<{ value: 'name' | 'address' | 'city' | 'phone' | 'email' | 'taxId' | 'passport'; label: string }> = [
  { value: 'name',     label: 'Name'           },
  { value: 'address',  label: 'Street Address' },
  { value: 'city',     label: 'City / State'   },
  { value: 'phone',    label: 'Phone'           },
  { value: 'email',    label: 'Email'           },
  { value: 'taxId',    label: 'Tax ID'          },
  { value: 'passport', label: 'Passport'        },
];

const HEADER_FIELD_OPTIONS: Array<{ value: 'invoiceNumber' | 'date' | 'dueDate' | 'cashier'; label: string }> = [
  { value: 'invoiceNumber', label: 'Doc #'    },
  { value: 'date',          label: 'Date'     },
  { value: 'dueDate',       label: 'Due Date' },
  { value: 'cashier',       label: 'Employee'  },
];

const DUTY_FREE_FIELD_OPTIONS: Array<{
  value: 'travellerId' | 'travelMethod' | 'destination' | 'departureDate'; label: string;
}> = [
  { value: 'travellerId',   label: 'Traveller ID' },
  { value: 'travelMethod',  label: 'Travel Method' },
  { value: 'destination',   label: 'Destination'   },
  { value: 'departureDate', label: 'Departure'     },
];

const TRAVELLER_ID_TYPE_OPTIONS: Array<{
  value: 'passport' | 'national_id' | 'seaman_book' | 'other'; label: string;
}> = [
  { value: 'passport',     label: 'Passport'       },
  { value: 'national_id',  label: 'National ID'    },
  { value: 'seaman_book',  label: "Seaman's Book"  },
  { value: 'other',        label: 'Other'          },
];

const TRAVEL_METHOD_TYPE_OPTIONS: Array<{
  value: 'flight' | 'vessel' | 'other'; label: string;
}> = [
  { value: 'flight', label: 'Flight' },
  { value: 'vessel', label: 'Vessel / Voyage' },
  { value: 'other',  label: 'Other' },
];

const ADDRESS_TYPE_OPTIONS: Array<{ value: 'billing' | 'shipping' | 'both'; label: string }> = [
  { value: 'billing',  label: 'Billing only'  },
  { value: 'shipping', label: 'Shipping only' },
  { value: 'both',     label: 'Both'          },
];

// ─── ToggleChip: small pill-shaped toggle button ──────────────────────────────
const ToggleChip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors',
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
    )}
  >
    {children}
  </button>
);

// ─── SectionLabel ─────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pt-1">
    {children}
  </p>
);

// ─── Main component ───────────────────────────────────────────────────────────

const BlockPropertiesPanel: React.FC<BlockPropertiesPanelProps> = ({ block, onChange, onDelete }) => {
  if (!block) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Select a block on the canvas to edit its properties.
      </div>
    );
  }

  const meta     = BLOCK_TYPE_META[block.type];
  const cfg      = block.config || {};
  const fields   = cfg.fields || [];

  const update       = (patch: Partial<TemplateBlock>) => onChange({ ...block, ...patch });
  const updateConfig = (patch: Record<string, unknown>) => onChange({ ...block, config: { ...cfg, ...patch } });
  const updateFields = (nextFields: TemplateField[]) => updateConfig({ fields: nextFields });

  // ── Table preset application ─────────────────────────────────────────────
  const applyTablePreset = (preset: TablePresetKey) => {
    updateConfig({
      tablePreset: preset,
      fields: preset === 'custom' ? fields : TABLE_PRESET_FIELDS[preset].map((f) => ({ ...f })),
    });
  };

  // ── Toggle helpers ───────────────────────────────────────────────────────
  const toggleLogoContactField = (field: 'address' | 'phone' | 'email' | 'taxId') => {
    const current = cfg.logoContactFields || ['address', 'phone', 'email'];
    const next = current.includes(field)
      ? current.filter((v) => v !== field)
      : [...current, field];
    updateConfig({ logoContactFields: next });
  };

  const toggleField = <T extends string>(key: string, val: T, defaults: T[]) => {
    const current = (cfg[key] as T[]) || defaults;
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    updateConfig({ [key]: next });
  };

  // Templates saved before duty-free traveller fields were generalized still
  // store the old 'passport'/'flight' keys (templateProvisioningService never
  // rewrites existing rows). Normalize for display, and re-save under the new
  // names the moment the user touches a chip — self-healing, no migration needed.
  const DUTY_FREE_LEGACY_ALIASES: Record<string, string> = { passport: 'travellerId', flight: 'travelMethod' };
  const normalizedDutyFreeFields = (cfg.dutyFreeFields as string[] | undefined)?.map(
    (f) => DUTY_FREE_LEGACY_ALIASES[f] || f,
  );
  const toggleDutyFreeField = (val: string) => {
    const current = normalizedDutyFreeFields || DUTY_FREE_FIELD_OPTIONS.map((o) => o.value);
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    updateConfig({ dutyFreeFields: next });
  };

  const logoLayout = (cfg.logoLayout || 'logo_only') as LogoLayout;
  const showLogoImage = logoLayout === 'logo_only' || logoLayout === 'logo_name' || logoLayout === 'logo_name_contact';
  const showContactFields = logoLayout === 'logo_name_contact' || logoLayout === 'name_contact';

  return (
    <div className="space-y-4 text-sm">

      {/* ── Label ── */}
      <div className="space-y-1.5">
        <SectionLabel>Block label</SectionLabel>
        <Input
          value={block.label || ''}
          onChange={(e) => update({ label: e.target.value })}
          placeholder={meta?.label || block.type}
          className="h-8 text-xs"
        />
      </div>

      {/* ── Visibility ── */}
      <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
        <span className="text-xs font-medium">Visible</span>
        <Switch
          checked={block.visible}
          onCheckedChange={(v) => update({ visible: v })}
        />
      </div>

      {/* ── Alignment ── */}
      {HAS_ALIGN_TYPES.has(block.type) && (
        <div className="space-y-1.5">
          <SectionLabel>Alignment</SectionLabel>
          <div className="flex gap-1">
            {ALIGN_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={cfg.align === opt.value || (!cfg.align && opt.value === 'left') ? 'default' : 'outline'}
                size="sm"
                className="h-8 flex-1"
                onClick={() => updateConfig({ align: opt.value })}
              >
                {opt.icon}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ── Font size ── */}
      {HAS_FONT_SIZE_TYPES.has(block.type) && (
        <div className="space-y-1.5">
          <SectionLabel>Font size</SectionLabel>
          <Select value={cfg.fontSize || 'sm'} onValueChange={(v) => updateConfig({ fontSize: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['fine', 'xs', 'sm', 'base', 'lg', 'xl', 'title'].map((s) => (
                <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Bold ── */}
      {HAS_BOLD_TYPES.has(block.type) && (
        <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
          <span className="text-xs font-medium">Bold text</span>
          <Button
            variant={cfg.bold ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateConfig({ bold: !cfg.bold })}
            className="h-7 w-8 font-bold"
          >
            B
          </Button>
        </div>
      )}

      {/* ── Block spacing ── */}
      <div className="space-y-1.5">
        <SectionLabel>Spacing</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Top (px)</Label>
            <Input
              type="number" min={0} max={80}
              value={cfg.paddingTop ?? ''}
              onChange={(e) => updateConfig({ paddingTop: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="0"
              className="h-8 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Bottom (px)</Label>
            <Input
              type="number" min={0} max={80}
              value={cfg.paddingBottom ?? ''}
              onChange={(e) => updateConfig({ paddingBottom: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="0"
              className="h-8 text-xs mt-1"
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          LOGO BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'logo' && (
        <>
          {/* Layout preset */}
          <div className="space-y-2">
            <SectionLabel>Layout</SectionLabel>
            <div className="space-y-1">
              {LOGO_LAYOUTS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateConfig({ logoLayout: preset.value })}
                  className={cn(
                    'w-full flex items-start gap-2.5 rounded-lg px-3 py-2 text-left border transition-colors',
                    logoLayout === preset.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/30 hover:bg-secondary/40',
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{preset.label}</div>
                    <div className="text-[11px] text-muted-foreground">{preset.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Contact fields to display (when layout includes contact info) */}
          {showContactFields && (
            <div className="space-y-1.5">
              <SectionLabel>Contact fields to show</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {LOGO_CONTACT_FIELD_OPTIONS.map((opt) => (
                  <ToggleChip
                    key={opt.value}
                    active={(cfg.logoContactFields || ['address', 'phone', 'email']).includes(opt.value)}
                    onClick={() => toggleLogoContactField(opt.value)}
                  >
                    {opt.label}
                  </ToggleChip>
                ))}
              </div>
            </div>
          )}

          {/* Custom image URL (only when layout shows an image) */}
          {showLogoImage && (
            <div className="space-y-1.5">
              <SectionLabel>Override image URL</SectionLabel>
              <Input
                value={cfg.imageUrl || ''}
                onChange={(e) => updateConfig({ imageUrl: e.target.value })}
                placeholder="Leave blank — uses store logo from Settings"
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Logo height (only relevant when image is shown) */}
          {showLogoImage && (
            <div className="space-y-1.5">
              <SectionLabel>Image height</SectionLabel>
              <div className="grid grid-cols-4 gap-1 mb-1.5">
                {LOGO_HEIGHT_PRESETS.map((preset) => (
                  <Button
                    key={preset.mm}
                    type="button"
                    variant={cfg.logoHeight === preset.mm ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-0"
                    onClick={() => updateConfig({ logoHeight: preset.mm })}
                  >
                    {preset.label}<span className="text-[10px] ml-0.5 opacity-70">{preset.mm}mm</span>
                  </Button>
                ))}
              </div>
              <Input
                type="number" min={4} max={100}
                value={cfg.logoHeight ?? ''}
                onChange={(e) => updateConfig({ logoHeight: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Custom mm"
                className="h-8 text-xs"
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════
          TEXT / HEADER / TERMS BLOCKS
      ════════════════════════════════════════════ */}
      {TEXT_LIKE_TYPES.has(block.type) && (
        <div className="space-y-1.5">
          <SectionLabel>Content</SectionLabel>
          <Textarea
            rows={2}
            value={cfg.content || ''}
            onChange={(e) => updateConfig({ content: e.target.value })}
            placeholder={
              block.type === 'header' ? 'TAX INVOICE / RECEIPT'
              : block.type === 'text' ? 'Custom text (leave blank to show store fields below)'
              : 'Leave blank to use live data value'
            }
            className="text-xs resize-none"
          />
        </div>
      )}

      {/* ── Header metadata fields ── */}
      {block.type === 'header' && (
        <div className="space-y-1.5">
          <SectionLabel>Document metadata</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {HEADER_FIELD_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                active={(cfg.headerFields || HEADER_FIELD_OPTIONS.map((o) => o.value)).includes(opt.value)}
                onClick={() => toggleField('headerFields', opt.value, HEADER_FIELD_OPTIONS.map((o) => o.value))}
              >
                {opt.label}
              </ToggleChip>
            ))}
          </div>
        </div>
      )}

      {/* ── Customer block fields ── */}
      {block.type === 'customer' && (
        <div className="space-y-1.5">
          <SectionLabel>Customer fields</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {CUSTOMER_FIELD_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                active={(cfg.customerFields || CUSTOMER_FIELD_OPTIONS.map((o) => o.value)).includes(opt.value)}
                onClick={() => toggleField('customerFields', opt.value, CUSTOMER_FIELD_OPTIONS.map((o) => o.value))}
              >
                {opt.label}
              </ToggleChip>
            ))}
          </div>
        </div>
      )}

      {/* ── Text block store fields ── */}
      {block.type === 'text' && (
        <div className="space-y-1.5">
          <SectionLabel>Store fields (when content is blank)</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {STORE_FIELD_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                active={(cfg.storeFields || STORE_FIELD_OPTIONS.map((o) => o.value)).includes(opt.value)}
                onClick={() => toggleField('storeFields', opt.value, STORE_FIELD_OPTIONS.map((o) => o.value))}
              >
                {opt.label}
              </ToggleChip>
            ))}
          </div>
        </div>
      )}

      {/* ── Address block ── */}
      {block.type === 'address' && (
        <div className="space-y-1.5">
          <SectionLabel>Address to display</SectionLabel>
          <Select
            value={cfg.addressType || 'billing'}
            onValueChange={(v) => updateConfig({ addressType: v })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ADDRESS_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ════════════════════════════════════════════
          TABLE BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'table' && (
        <>
          {/* Business type preset */}
          <div className="space-y-2">
            <SectionLabel>Business type preset</SectionLabel>
            <div className="space-y-1">
              {TABLE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyTablePreset(preset.value)}
                  className={cn(
                    'w-full flex items-start gap-2 rounded-lg px-3 py-2 text-left border transition-colors',
                    (cfg.tablePreset || 'general') === preset.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/30 hover:bg-secondary/40',
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{preset.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{preset.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Table display options */}
          <div className="space-y-2">
            <SectionLabel>Display options</SectionLabel>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <span className="text-xs">Show header row</span>
                <Switch
                  checked={cfg.tableShowHeader !== false}
                  onCheckedChange={(v) => updateConfig({ tableShowHeader: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <span className="text-xs">Zebra striping</span>
                <Switch
                  checked={!!cfg.tableZebra}
                  onCheckedChange={(v) => updateConfig({ tableZebra: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <span className="text-xs">Compact rows</span>
                <Switch
                  checked={!!cfg.tableCompact}
                  onCheckedChange={(v) => updateConfig({ tableCompact: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs">Weight sub-line</div>
                  <div className="text-[11px] text-muted-foreground">
                    Shows &ldquo;1.24 kg @ $3.99/kg&rdquo; under weighed items
                  </div>
                </div>
                <Switch
                  checked={cfg.weighedItemMode !== false}
                  onCheckedChange={(v) => updateConfig({ weighedItemMode: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs">Tax flag column</div>
                  <div className="text-[11px] text-muted-foreground">
                    Marks each line taxable / exempt, with a legend
                  </div>
                </div>
                <Switch
                  checked={!!cfg.tableTaxFlagColumn}
                  onCheckedChange={(v) => updateConfig({ tableTaxFlagColumn: v })}
                />
              </div>
            </div>
          </div>

          {/* Column editor */}
          <div className="space-y-1.5">
            <SectionLabel>Columns</SectionLabel>
            <DynamicFieldEditor
              mode="label-accessor"
              fields={fields}
              onChange={updateFields}
              addButtonLabel="Add column"
              labelPlaceholder="Column header"
              emptyMessage="Using default columns: Item, Qty, Price."
            />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          ATTRIBUTES / PURITY / GEMSTONES / COMPLIANCE BLOCKS
      ════════════════════════════════════════════ */}
      {HAS_FIELDS_TYPES.has(block.type) && (
        <div className="space-y-1.5">
          <SectionLabel>Fields</SectionLabel>
          <DynamicFieldEditor
            mode="label-value"
            fields={fields}
            onChange={updateFields}
            addButtonLabel="Add field"
            labelPlaceholder="Label"
            valuePlaceholder="Value (or leave blank for live data)"
            emptyMessage="Using default fields for this section."
          />
        </div>
      )}

      {/* ════════════════════════════════════════════
          FOOTER BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'footer' && (
        <div className="space-y-1.5">
          <SectionLabel>Footer lines</SectionLabel>
          <DynamicFieldEditor
            mode="label-only"
            fields={fields}
            onChange={updateFields}
            addButtonLabel="Add line"
            labelPlaceholder="Thank you for your purchase!"
            emptyMessage="No custom lines — using default footer."
          />
        </div>
      )}

      {/* ════════════════════════════════════════════
          CUSTOM FIELDS BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'custom' && (
        <div className="space-y-1.5">
          <SectionLabel>Custom fields</SectionLabel>
          <DynamicFieldEditor
            mode="label-value"
            fields={fields}
            onChange={updateFields}
            addButtonLabel="Add field"
            labelPlaceholder="Label (e.g. Order Ref)"
            valuePlaceholder="Value"
            emptyMessage="No fields yet — add any label/value pair."
          />
        </div>
      )}

      {/* ════════════════════════════════════════════
          TAX SUMMARY BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'taxSummary' && (
        <>
          <div className="rounded-lg border bg-secondary/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Rates, labels and wording come from this store&apos;s jurisdiction
              profile — the same source the tax engine uses. Nothing here is
              country-specific, so one template works everywhere.
            </p>
          </div>

          <div className="space-y-2">
            <SectionLabel>What to show</SectionLabel>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs">Taxable amount</div>
                  <div className="text-[11px] text-muted-foreground">Show what each rate applied to</div>
                </div>
                <Switch
                  checked={cfg.showTaxableAmount !== false}
                  onCheckedChange={(v) => updateConfig({ showTaxableAmount: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs">Exempt lines</div>
                  <div className="text-[11px] text-muted-foreground">
                    Needed where food or prescriptions are exempt
                  </div>
                </div>
                <Switch
                  checked={cfg.showExemptLines !== false}
                  onCheckedChange={(v) => updateConfig({ showExemptLines: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs">Combined total</div>
                  <div className="text-[11px] text-muted-foreground">Sum beneath the per-rate lines</div>
                </div>
                <Switch
                  checked={cfg.showTaxTotal !== false}
                  onCheckedChange={(v) => updateConfig({ showTaxTotal: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs">Reverse-charge notice</div>
                  <div className="text-[11px] text-muted-foreground">
                    Prescribed wording — required where it applies
                  </div>
                </div>
                <Switch
                  checked={cfg.showReverseChargeNotice !== false}
                  onCheckedChange={(v) => updateConfig({ showReverseChargeNotice: v })}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          SAVINGS BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'savings' && (
        <>
          <div className="space-y-1.5">
            <SectionLabel>Heading</SectionLabel>
            <Input
              value={cfg.savingsLabel || ''}
              onChange={(e) => updateConfig({ savingsLabel: e.target.value })}
              placeholder="YOU SAVED"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs">Coupon breakdown</div>
              <div className="text-[11px] text-muted-foreground">List each discount above the total</div>
            </div>
            <Switch
              checked={cfg.showCouponLines !== false}
              onCheckedChange={(v) => updateConfig({ showCouponLines: v })}
            />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          LOYALTY BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'loyalty' && (
        <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs">Points balance</div>
            <div className="text-[11px] text-muted-foreground">Show running total, not just points earned</div>
          </div>
          <Switch
            checked={cfg.showPointsBalance !== false}
            onCheckedChange={(v) => updateConfig({ showPointsBalance: v })}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════
          CHANGE DUE BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'changeDue' && (
        <div className="rounded-lg border bg-secondary/30 px-3 py-2">
          <p className="text-[11px] text-muted-foreground leading-snug">
            Only renders on cash payments — card and digital sales have no tender
            or change. Where the jurisdiction has withdrawn small coins (AU, CA),
            any rounding adjustment is shown as its own line rather than silently
            changing the total.
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════
          RETURN POLICY BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'returnPolicy' && (
        <>
          <div className="space-y-2">
            <SectionLabel>What to show</SectionLabel>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <span className="text-xs">Return window</span>
              <Switch
                checked={cfg.showReturnWindow !== false}
                onCheckedChange={(v) => updateConfig({ showReturnWindow: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <span className="text-xs">Restocking fee</span>
              <Switch
                checked={cfg.showRestockingFee !== false}
                onCheckedChange={(v) => updateConfig({ showRestockingFee: v })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <SectionLabel>Fallback terms</SectionLabel>
            <Textarea
              rows={3}
              value={cfg.returnPolicyText || ''}
              onChange={(e) => updateConfig({ returnPolicyText: e.target.value })}
              placeholder="Used when the sale carries no policy of its own"
              className="text-xs resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Wording that makes exchange the default and refund the extra step
              tends to reduce refunds without frustrating customers.
            </p>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          PRESCRIPTION DETAILS BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'rxDetails' && (
        <>
          <div className="rounded-lg border bg-secondary/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Refills remaining is shown even at zero — &ldquo;0 remaining&rdquo;
              tells the patient to contact their prescriber, whereas an absent
              line is ambiguous.
            </p>
          </div>
          <div className="space-y-2">
            <SectionLabel>What to show</SectionLabel>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <span className="text-xs">Prescriber</span>
              <Switch
                checked={cfg.showPrescriber !== false}
                onCheckedChange={(v) => updateConfig({ showPrescriber: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <span className="text-xs">Refills remaining</span>
              <Switch
                checked={cfg.showRefills !== false}
                onCheckedChange={(v) => updateConfig({ showRefills: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs">Pharmacist sign-off</div>
                <div className="text-[11px] text-muted-foreground">Who verified the dispense</div>
              </div>
              <Switch
                checked={cfg.showPharmacistSignoff !== false}
                onCheckedChange={(v) => updateConfig({ showPharmacistSignoff: v })}
              />
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          BATCH / LOT / EXPIRY BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'batchExpiry' && (
        <>
          <div className="rounded-lg border bg-amber-500/5 border-amber-200 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              The identifier label comes from the jurisdiction profile — NDC in
              the US, DIN in Canada, PZN in Germany. Beyond-use date takes
              precedence over manufacturer expiry: it is the date the patient
              acts on.
            </p>
          </div>
          <div className="space-y-2">
            <SectionLabel>What to show</SectionLabel>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <span className="text-xs">Drug identifier</span>
              <Switch
                checked={cfg.showDrugIdentifier !== false}
                onCheckedChange={(v) => updateConfig({ showDrugIdentifier: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <span className="text-xs">Lot number</span>
              <Switch
                checked={cfg.showLotNumber !== false}
                onCheckedChange={(v) => updateConfig({ showLotNumber: v })}
              />
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          SERIAL / IMEI BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'serialCapture' && (
        <>
          <div className="rounded-lg border bg-secondary/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Warranty claims require the original receipt with matching serial
              numbers, and warranty lookup is done by serial or IMEI. A receipt
              without them is of limited use when something fails.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
            <span className="text-xs">Show IMEI</span>
            <Switch
              checked={cfg.showImei !== false}
              onCheckedChange={(v) => updateConfig({ showImei: v })}
            />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          WARRANTY BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'warranty' && (
        <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
          <div className="min-w-0">
            <div className="text-xs">Expiry date</div>
            <div className="text-[11px] text-muted-foreground">Show the end date, not just the term</div>
          </div>
          <Switch
            checked={cfg.showWarrantyExpiry !== false}
            onCheckedChange={(v) => updateConfig({ showWarrantyExpiry: v })}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════
          FISCAL SIGNATURE BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'fiscal' && (
        <>
          <div className="rounded-lg border bg-amber-500/5 border-amber-200 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Around 30 countries require a cryptographic signature and QR code on
              every receipt. The signature is produced by a <strong>certified
              backend integration</strong> — it cannot be generated here, and this
              block only lays out what the backend supplies.
            </p>
          </div>
          <div className="rounded-lg border bg-secondary/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              The block is hidden automatically for stores in jurisdictions that
              do not mandate it. Where it IS mandated but no signature arrives,
              a conspicuous warning prints instead of silence.
            </p>
          </div>

          <div className="space-y-2">
            <SectionLabel>What to show</SectionLabel>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <span className="text-xs">Fiscal QR code</span>
              <Switch
                checked={cfg.showFiscalQr !== false}
                onCheckedChange={(v) => updateConfig({ showFiscalQr: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <span className="text-xs">Signature text</span>
              <Switch
                checked={cfg.showFiscalSignature !== false}
                onCheckedChange={(v) => updateConfig({ showFiscalSignature: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs">Device / software ID</div>
                <div className="text-[11px] text-muted-foreground">Required in some schemes</div>
              </div>
              <Switch
                checked={cfg.showFiscalDeviceInfo !== false}
                onCheckedChange={(v) => updateConfig({ showFiscalDeviceInfo: v })}
              />
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          DUTY-FREE / EXPORT BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'dutyFree' && (
        <>
          <div className="rounded-lg border bg-amber-500/5 border-amber-200 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Duty-free proof of sale requires the purchaser&apos;s name to match
              their travel document. A reprint notice is automatically suppressed
              on these documents — a receipt marked as a copy is not valid at customs.
              The legal export declaration text prints from the Compliance block,
              since it varies tenant to tenant and country to country.
            </p>
          </div>

          <div className="space-y-1.5">
            <SectionLabel>Traveller details</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {DUTY_FREE_FIELD_OPTIONS.map((opt) => (
                <ToggleChip
                  key={opt.value}
                  active={(normalizedDutyFreeFields || DUTY_FREE_FIELD_OPTIONS.map((o) => o.value))
                    .includes(opt.value)}
                  onClick={() => toggleDutyFreeField(opt.value)}
                >
                  {opt.label}
                </ToggleChip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <SectionLabel>Traveller ID type</SectionLabel>
            <Select
              value={cfg.travellerIdType || 'passport'}
              onValueChange={(v) => updateConfig({ travellerIdType: v })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRAVELLER_ID_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cfg.travellerIdType === 'other' && (
              <Input
                value={cfg.travellerIdLabel || ''}
                onChange={(e) => updateConfig({ travellerIdLabel: e.target.value })}
                placeholder="Custom label, e.g. Boarding Pass"
                className="h-8 text-xs"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <SectionLabel>Travel method</SectionLabel>
            <Select
              value={cfg.travelMethodType || 'flight'}
              onValueChange={(v) => updateConfig({ travelMethodType: v })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRAVEL_METHOD_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cfg.travelMethodType === 'other' && (
              <Input
                value={cfg.travelMethodLabel || ''}
                onChange={(e) => updateConfig({ travelMethodLabel: e.target.value })}
                placeholder="Custom label, e.g. Coach"
                className="h-8 text-xs"
              />
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          TAX REFUND BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'taxRefund' && (
        <>
          <div className="rounded-lg border bg-secondary/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              For tax-free shopping, where the traveller pays tax and reclaims it
              on export. The retailer must state the goods, price, admin charge
              and refund due — distinct from duty-free, where no tax is charged.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs">Refund breakdown</div>
              <div className="text-[11px] text-muted-foreground">Admin charge and refund due</div>
            </div>
            <Switch
              checked={cfg.showRefundBreakdown !== false}
              onCheckedChange={(v) => updateConfig({ showRefundBreakdown: v })}
            />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          REPRINT NOTICE BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'reprintNotice' && (
        <>
          <div className="rounded-lg border bg-secondary/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Marks a re-issued copy so it cannot be used twice for a return.
              Automatically hidden on duty-free and export documents.
            </p>
          </div>
          <div className="space-y-1.5">
            <SectionLabel>Notice text</SectionLabel>
            <Input
              value={cfg.reprintText || ''}
              onChange={(e) => updateConfig({ reprintText: e.target.value })}
              placeholder="DUPLICATE — NOT A VALID PROOF OF PURCHASE"
              className="h-8 text-xs"
            />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          BARCODE / QR BLOCK
      ════════════════════════════════════════════ */}
      {block.type === 'barcode' && (
        <>
          <div className="space-y-1.5">
            <SectionLabel>Symbology</SectionLabel>
            <Select value={cfg.symbology || 'code128'} onValueChange={(v) => updateConfig({ symbology: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="code128" className="text-xs">Code 128 (barcode)</SelectItem>
                <SelectItem value="qr"      className="text-xs">QR Code</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <SectionLabel>Encode</SectionLabel>
            <Select
              value={cfg.barcodeSource || 'receiptNo'}
              onValueChange={(v) => updateConfig({ barcodeSource: v })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BARCODE_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cfg.barcodeSource === 'custom' && (
              <Input
                value={cfg.barcodeCustomValue || ''}
                onChange={(e) => updateConfig({ barcodeCustomValue: e.target.value })}
                placeholder="Custom text to encode"
                className="h-8 text-xs"
              />
            )}
          </div>
        </>
      )}

      {/* ── Delete ── */}
      <div className="pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 gap-1.5 text-xs"
          onClick={() => onDelete(block.id)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove block
        </Button>
      </div>
    </div>
  );
};

export default BlockPropertiesPanel;
