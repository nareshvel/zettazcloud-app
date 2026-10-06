import React from 'react';
import { TemplateField, createLocalId } from '@/types/printTemplate';
import { ACCESSOR_GROUPS } from '@/utils/itemTableModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel,
} from '@/components/ui/select';
import { GripVertical, Plus, X } from 'lucide-react';

export type FieldEditorMode = 'label-only' | 'label-value' | 'label-accessor';

interface DynamicFieldEditorProps {
  mode: FieldEditorMode;
  fields: TemplateField[];
  onChange: (fields: TemplateField[]) => void;
  addButtonLabel?: string;
  labelPlaceholder?: string;
  valuePlaceholder?: string;
  emptyMessage?: string;
}

/**
 * Notion/Airtable-style field manager: add, rename, delete and drag-reorder
 * an arbitrary list of fields. Used for footer lines, table columns, custom
 * key/value blocks, and extensible jewelry sections (attributes, gemstones,
 * compliance) — this is the primary "add / update / delete any field" surface.
 */
const DynamicFieldEditor: React.FC<DynamicFieldEditorProps> = ({
  mode,
  fields,
  onChange,
  addButtonLabel = 'Add field',
  labelPlaceholder = 'Label',
  valuePlaceholder = 'Value',
  emptyMessage = 'No fields yet.',
}) => {
  const dragIndex = React.useRef<number | null>(null);

  const handleAdd = () => {
    const newField: TemplateField = {
      id: createLocalId('field'),
      label: '',
      ...(mode === 'label-value' ? { value: '' } : {}),
      ...(mode === 'label-accessor' ? { accessor: ACCESSOR_GROUPS[0].options[0].value } : {}),
    };
    onChange([...fields, newField]);
  };

  const handleUpdate = (id: string, patch: Partial<TemplateField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleRemove = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const next = [...fields];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">{emptyMessage}</p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          draggable
          onDragStart={() => { dragIndex.current = index; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragIndex.current !== null && dragIndex.current !== index) {
              handleReorder(dragIndex.current, index);
            }
            dragIndex.current = null;
          }}
          className="flex items-center gap-1.5 group"
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab shrink-0" />

          <Input
            value={field.label}
            onChange={(e) => handleUpdate(field.id, { label: e.target.value })}
            placeholder={labelPlaceholder}
            className="h-8 text-xs flex-1"
          />

          {mode === 'label-value' && (
            <Input
              value={field.value || ''}
              onChange={(e) => handleUpdate(field.id, { value: e.target.value })}
              placeholder={valuePlaceholder}
              className="h-8 text-xs flex-1"
            />
          )}

          {mode === 'label-accessor' && (
            <Select value={field.accessor} onValueChange={(value) => handleUpdate(field.id, { accessor: value })}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {/* Grouped by vertical — a flat list of 40+ accessors is
                    unusable, and grouping shows which fields belong together. */}
                {ACCESSOR_GROUPS.map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {group.group}
                    </SelectLabel>
                    {group.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleRemove(field.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full mt-1">
        <Plus className="h-3.5 w-3.5 mr-1.5" /> {addButtonLabel}
      </Button>
    </div>
  );
};

export default DynamicFieldEditor;
