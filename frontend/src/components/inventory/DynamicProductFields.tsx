import React, { useEffect, useState } from 'react';
import { Gem } from 'lucide-react';
import { getProductFieldSchema, IndustryField } from '@/services/industryService';
import SectionHeader from '@/components/ui/SectionHeader';

interface DynamicProductFieldsProps {
  /** Current attribute values keyed by field_key. */
  value: Record<string, any>;
  /** Called with the full updated attributes object. */
  onChange: (attributes: Record<string, any>) => void;
}

// Fields that benefit from a full-width row (textareas, long text, etc.)
const FULL_WIDTH_TYPES = new Set<string>(['textarea']);

/**
 * Purity options filtered by the selected metal type.
 * The DB stores the full union list; the frontend narrows it dynamically.
 */
const PURITY_BY_METAL: Record<string, string[]> = {
  Gold:            ['24K (999)', '23K (958)', '22K (916)', '21K (875)', '20K (833)', '18K (750)', '14K (585)', '10K (417)', '9K (375)'],
  Silver:          ['999 Fine Silver', '925 Sterling Silver', '900 Coin Silver', '800 Silver'],
  Platinum:        ['Pt 950', 'Pt 900', 'Pt 850'],
  Palladium:       ['Pd 950', 'Pd 500'],
  Titanium:        [],
  'Stainless Steel': [],
  Brass:           [],
};

/** Metals for which metal_colour is relevant */
const METALS_WITH_COLOUR = new Set(['Gold']);

/** Metals for which purity is not applicable (hide the field) */
const METALS_WITHOUT_PURITY = new Set(['Titanium', 'Stainless Steel', 'Brass']);

/**
 * Renders the industry-specific product fields resolved for the current tenant.
 * Values are stored in a single `attributes` object keyed by field_key and are
 * saved to products.attributes (JSON) on the backend. If the tenant's industry
 * has no extra fields, this component renders nothing.
 */
const DynamicProductFields: React.FC<DynamicProductFieldsProps> = ({ value, onChange }) => {
  const [fields, setFields] = useState<IndustryField[]>([]);
  const [industry, setIndustry] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProductFieldSchema('product')
      .then((schema) => {
        if (!active) return;
        setFields(schema.fields || []);
        setIndustry(schema.industry || '');
      })
      .catch(() => { if (active) setFields([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const setField = (key: string, v: any) => {
    if (key === 'metal_type') {
      // Clear purity and metal_colour when metal changes to avoid stale values
      onChange({ ...value, [key]: v, purity: '', metal_colour: '' });
    } else {
      onChange({ ...value, [key]: v });
    }
  };

  if (loading || fields.length === 0) return null;

  const sectionTitle = industry
    ? industry.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Details'
    : 'Additional Details';

  return (
    <div>
      <SectionHeader icon={Gem} title={sectionTitle} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {fields.map((f) => {
          const selectedMetal: string = value['metal_type'] ?? '';

          // metal_colour: only show for gold
          if (f.fieldKey === 'metal_colour' && !METALS_WITH_COLOUR.has(selectedMetal)) {
            return null;
          }

          // purity: hide for metals that don't have purity grades
          if (f.fieldKey === 'purity' && selectedMetal && METALS_WITHOUT_PURITY.has(selectedMetal)) {
            return null;
          }

          // Build a possibly-filtered version of the field
          let resolvedField = f;
          if (f.fieldKey === 'purity' && selectedMetal && PURITY_BY_METAL[selectedMetal]) {
            resolvedField = { ...f, options: PURITY_BY_METAL[selectedMetal] };
          }

          const isFullWidth = FULL_WIDTH_TYPES.has(f.dataType) || f.fieldKey.includes('description') || f.fieldKey.includes('note');
          return (
            <div
              key={f.fieldKey}
              className={`flex flex-col ${isFullWidth ? 'col-span-2' : 'col-span-1'}`}
            >
              <label className={labelCls}>
                {f.label}{f.unit ? ` (${f.unit})` : ''}
                {f.isRequired && <span className="text-red-500 normal-case font-normal ml-0.5">*</span>}
              </label>
              {renderInput(resolvedField, value[f.fieldKey], setField)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Matches ProductFormModal.tsx's shared style tokens exactly so this section
// looks identical to every other section in the Add/Edit Product modal
// (uppercase tracking-wide labels, same input padding/ring/border).
const labelCls =
  'block text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-1.5 uppercase tracking-wide';
const inputCls =
  'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background-input text-text placeholder-text-secondary transition-colors duration-150 text-sm';

function renderInput(
  f: IndustryField,
  val: any,
  setField: (k: string, v: any) => void,
) {
  switch (f.dataType) {
    case 'select':
      return (
        <select
          className={inputCls}
          value={val ?? ''}
          onChange={(e) => setField(f.fieldKey, e.target.value)}
        >
          <option value="">— select —</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'boolean':
      return (
        <div className="flex items-center h-10">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            checked={!!val}
            onChange={(e) => setField(f.fieldKey, e.target.checked)}
          />
        </div>
      );
    case 'number':
    case 'decimal':
      return (
        <input
          type="number"
          step={f.dataType === 'decimal' ? '0.001' : '1'}
          className={inputCls}
          value={val ?? ''}
          placeholder="0"
          onChange={(e) => setField(f.fieldKey, e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className={inputCls}
          value={val ?? ''}
          onChange={(e) => setField(f.fieldKey, e.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          className={inputCls}
          rows={3}
          value={val ?? ''}
          onChange={(e) => setField(f.fieldKey, e.target.value)}
        />
      );
    default:
      return (
        <input
          type="text"
          className={inputCls}
          value={val ?? ''}
          placeholder={f.label}
          onChange={(e) => setField(f.fieldKey, e.target.value)}
        />
      );
  }
}

export default DynamicProductFields;
