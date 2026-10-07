import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Eye, EyeOff, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import {
  getProductFieldSchema,
  getTenantFieldOverrides,
  saveTenantFieldOverride,
  deleteTenantFieldOverride,
  IndustryField,
  TenantFieldOverride,
  FieldDataType,
} from '../../services/industryService';

interface MergedField extends IndustryField {
  isEnabled: boolean;
  isCustom: boolean;
  dirty?: boolean;
}

const DATA_TYPES: FieldDataType[] = ['text', 'number', 'decimal', 'date', 'select', 'boolean', 'textarea'];

const inputCls = 'block w-full px-3 py-1.5 bg-white dark:bg-background border border-gray-200 dark:border-border rounded-lg text-sm text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-muted-foreground mb-1';

const IndustryFieldSettings: React.FC = () => {
  const { user } = useAuth();
  // Write paths are PUT/DELETE /industry/overrides → settings.edit.
  const canEdit = hasPermission(user, 'settings.edit');
  const [fields, setFields] = useState<MergedField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newField, setNewField] = useState<Partial<TenantFieldOverride & { appliesTo: string }>>({
    fieldKey: '', label: '', dataType: 'text', isEnabled: true, isRequired: false,
    showOnReceipt: false, isCustom: true, appliesTo: 'product',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [schema, overrides] = await Promise.all([
        getProductFieldSchema('product'),
        getTenantFieldOverrides('product'),
      ]);

      const overrideMap = new Map(overrides.map(o => [o.fieldKey, o]));

      const merged: MergedField[] = schema.fields.map(f => {
        const ov = overrideMap.get(f.fieldKey);
        return {
          ...f,
          label: ov?.label ?? f.label,
          isEnabled: ov ? ov.isEnabled : true,
          isRequired: ov?.isRequired ?? f.isRequired,
          showOnReceipt: ov?.showOnReceipt ?? f.showOnReceipt ?? false,
          isCustom: false,
        };
      });

      // Add custom fields that don't exist in schema defaults
      overrides
        .filter(o => o.isCustom && !schema.fields.find(f => f.fieldKey === o.fieldKey))
        .forEach(o => merged.push({
          fieldKey: o.fieldKey,
          label: o.label ?? o.fieldKey,
          dataType: o.dataType ?? 'text',
          isRequired: o.isRequired ?? false,
          showOnReceipt: o.showOnReceipt ?? false,
          isSearchable: false,
          sortOrder: o.sortOrder ?? 999,
          isEnabled: o.isEnabled,
          isCustom: true,
        }));

      merged.sort((a, b) => a.sortOrder - b.sortOrder);
      setFields(merged);
    } catch {
      toast.error('Failed to load field configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateField = (fieldKey: string, patch: Partial<MergedField>) => {
    if (!canEdit) return;
    setFields(prev => prev.map(f => f.fieldKey === fieldKey ? { ...f, ...patch, dirty: true } : f));
  };

  const saveField = async (field: MergedField) => {
    if (!canEdit) return;
    setSaving(s => ({ ...s, [field.fieldKey]: true }));
    try {
      await saveTenantFieldOverride({
        fieldKey: field.fieldKey,
        label: field.label,
        isEnabled: field.isEnabled,
        isRequired: field.isRequired,
        showOnReceipt: field.showOnReceipt,
        sortOrder: field.sortOrder,
        isCustom: field.isCustom,
        dataType: field.dataType,
        appliesTo: 'product',
      });
      setFields(prev => prev.map(f => f.fieldKey === field.fieldKey ? { ...f, dirty: false } : f));
      toast.success(`"${field.label}" saved.`);
    } catch {
      toast.error('Failed to save field.');
    } finally {
      setSaving(s => ({ ...s, [field.fieldKey]: false }));
    }
  };

  const deleteField = async (field: MergedField) => {
    if (!canEdit) return;
    if (!field.isCustom) return;
    if (!confirm(`Delete custom field "${field.label}"?`)) return;
    try {
      await deleteTenantFieldOverride(field.fieldKey);
      setFields(prev => prev.filter(f => f.fieldKey !== field.fieldKey));
      toast.success('Custom field deleted.');
    } catch {
      toast.error('Failed to delete field.');
    }
  };

  const addCustomField = async () => {
    if (!canEdit) return;
    if (!newField.fieldKey?.trim() || !newField.label?.trim()) {
      toast.error('Field key and label are required.');
      return;
    }
    if (fields.find(f => f.fieldKey === newField.fieldKey)) {
      toast.error('A field with that key already exists.');
      return;
    }
    setSaving(s => ({ ...s, __new__: true }));
    try {
      await saveTenantFieldOverride({ ...newField, isCustom: true, isEnabled: true } as any);
      await load();
      setShowAddForm(false);
      setNewField({ fieldKey: '', label: '', dataType: 'text', isEnabled: true, isRequired: false, showOnReceipt: false, isCustom: true, appliesTo: 'product' });
      toast.success('Custom field added.');
    } catch {
      toast.error('Failed to add custom field.');
    } finally {
      setSaving(s => ({ ...s, __new__: false }));
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-8 flex items-center justify-center shadow-sm">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Industry Product Fields</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">
            Show, hide, relabel, or add custom fields for your product forms and receipts.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          disabled={!canEdit}
          title={!canEdit ? 'View-only access' : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Custom Field
        </button>
      </div>

      {/* Add custom field form */}
      {showAddForm && (
        <div className="px-5 py-4 bg-primary/5 dark:bg-primary/10 border-b border-gray-100 dark:border-border">
          <p className="text-xs font-semibold text-gray-700 dark:text-foreground mb-3">New Custom Field</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Field Key (unique, no spaces)</label>
              <input
                className={inputCls}
                placeholder="e.g. certificate_no"
                value={newField.fieldKey}
                onChange={e => setNewField(p => ({ ...p, fieldKey: e.target.value.replace(/\s/g, '_').toLowerCase() }))}
              />
            </div>
            <div>
              <label className={labelCls}>Label</label>
              <input className={inputCls} placeholder="e.g. Certificate No." value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Data Type</label>
              <select className={inputCls} value={newField.dataType} onChange={e => setNewField(p => ({ ...p, dataType: e.target.value as FieldDataType }))}>
                {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-4 pb-0.5">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground cursor-pointer">
                <input type="checkbox" checked={newField.isRequired} onChange={e => setNewField(p => ({ ...p, isRequired: e.target.checked }))} className="rounded" />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground cursor-pointer">
                <input type="checkbox" checked={newField.showOnReceipt} onChange={e => setNewField(p => ({ ...p, showOnReceipt: e.target.checked }))} className="rounded" />
                Show on receipt
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addCustomField} disabled={saving.__new__ || !canEdit} className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving.__new__ ? 'Adding…' : 'Add Field'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 border border-gray-300 dark:border-border text-gray-600 dark:text-muted-foreground text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-muted/60 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Field list */}
      <div className="divide-y divide-gray-100 dark:divide-border">
        {fields.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 dark:text-muted-foreground text-center">No fields defined for this industry.</p>
        ) : (
          fields.map(field => (
            <div key={field.fieldKey} className={`px-5 py-3 ${!field.isEnabled ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <GripVertical className="h-4 w-4 text-gray-300 dark:text-muted-foreground mt-2 shrink-0" />

                {/* Toggle enabled */}
                <button
                  onClick={() => updateField(field.fieldKey, { isEnabled: !field.isEnabled })}
                  disabled={!canEdit}
                  className="mt-1.5 shrink-0 text-gray-400 dark:text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={field.isEnabled ? 'Hide field' : 'Show field'}
                >
                  {field.isEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Label */}
                  <div>
                    <label className={labelCls}>Label</label>
                    <input
                      className={inputCls}
                      value={field.label}
                      onChange={e => updateField(field.fieldKey, { label: e.target.value })}
                      disabled={!canEdit}
                    />
                  </div>
                  {/* Field key (read-only) */}
                  <div>
                    <label className={labelCls}>Field Key</label>
                    <input className={`${inputCls} opacity-60`} value={field.fieldKey} readOnly />
                  </div>
                  {/* Data type */}
                  <div>
                    <label className={labelCls}>Type</label>
                    <select
                      className={inputCls}
                      value={field.dataType}
                      disabled={!field.isCustom || !canEdit}
                      onChange={e => updateField(field.fieldKey, { dataType: e.target.value as FieldDataType })}
                    >
                      {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col gap-1.5 shrink-0 mt-1">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-muted-foreground cursor-pointer">
                    <input type="checkbox" className="rounded" checked={field.isRequired} disabled={!canEdit} onChange={e => updateField(field.fieldKey, { isRequired: e.target.checked })} />
                    Required
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-muted-foreground cursor-pointer">
                    <input type="checkbox" className="rounded" checked={field.showOnReceipt ?? false} disabled={!canEdit} onChange={e => updateField(field.fieldKey, { showOnReceipt: e.target.checked })} />
                    Receipt
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 mt-1 shrink-0">
                  {field.dirty && (
                    <button
                      onClick={() => saveField(field)}
                      disabled={saving[field.fieldKey] || !canEdit}
                      className="p-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Save changes"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {field.isCustom && (
                    <button
                      onClick={() => deleteField(field)}
                      disabled={!canEdit}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete custom field"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {field.isCustom && (
                <span className="ml-7 mt-1 inline-block text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">custom</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default IndustryFieldSettings;
