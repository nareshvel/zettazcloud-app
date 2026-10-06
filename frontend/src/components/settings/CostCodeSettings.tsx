import React, { useEffect, useState } from 'react';
import {
  getCostCodeSettings, saveCostCodeSettings, previewCostCode, CostCodeSettings as CCSettings,
} from '@/services/industryService';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const DEFAULT_MAP: Record<string, string> = {
  '1': 'A', '2': 'N', '3': 'C', '4': 'D', '5': 'E', '6': 'F', '7': 'G', '8': 'H', '9': 'I', '0': 'O',
};

const inputCls = 'block w-full px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg text-sm text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-muted-foreground mb-1.5';

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <input
      className="w-full px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg text-sm text-center uppercase font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:opacity-60"
      maxLength={1}
      value={value || ''}
      onChange={(e) => onChange(e.target.value.slice(0, 1))}
      disabled={disabled}
    />
  </div>
);

const CostCodeSettings: React.FC = () => {
  const { user } = useAuth();
  // Save path is PUT /industry/cost-code → settings.edit.
  const canEdit = hasPermission(user, 'settings.edit');
  const [cfg, setCfg] = useState<CCSettings>({
    enabled: false, prefix: 'X', suffix: 'Y', decimalChar: '.', repeatChar: '', digitMap: DEFAULT_MAP,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [sample, setSample] = useState('1250.50');
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    getCostCodeSettings()
      .then((s) => setCfg({ ...s, digitMap: { ...DEFAULT_MAP, ...(s.digitMap || {}) } }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<CCSettings>) => setCfg((c) => ({ ...c, ...patch }));
  const setDigit = (d: string, v: string) =>
    setCfg((c) => ({ ...c, digitMap: { ...c.digitMap, [d]: v.toUpperCase().slice(0, 1) } }));

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true); setMessage(null);
    try {
      await saveCostCodeSettings(cfg);
      setMessage({ text: 'Settings saved successfully.', ok: true });
    } catch (e: any) {
      setMessage({ text: e?.message || 'Failed to save — check for duplicate letters.', ok: false });
    } finally { setSaving(false); }
  };

  const handlePreview = async () => {
    try {
      const r = await previewCostCode(Number(sample));
      setPreview(r.code);
    } catch (e: any) { setPreview(e?.message || 'error'); }
  };

  if (loading) return <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border p-8 text-center text-sm text-gray-400 dark:text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Cost Code Cipher</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">
            Print an encoded cost price on tags — readable by staff, not customers.
            Digits map to letters wrapped in marker characters (e.g. <code className="font-mono bg-gray-100 dark:bg-muted px-1 rounded">X…Y</code>).
          </p>
        </div>
        <div className="px-5 py-4">
          <label className={`flex items-center gap-3 group ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
            <div className={`relative w-10 h-5 rounded-full transition-colors ${cfg.enabled ? 'bg-primary' : 'bg-gray-200'}`}
              onClick={() => { if (canEdit) update({ enabled: !cfg.enabled }); }}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white dark:bg-card rounded-full shadow transition-transform ${cfg.enabled ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-foreground group-hover:text-gray-900 dark:text-foreground">
              {cfg.enabled ? 'Enabled — cost codes will print on tags' : 'Disabled — no cost code on tags'}
            </span>
          </label>
        </div>
      </div>

      {/* Marker characters */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Marker Characters</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Surround the cipher with unique characters that are not used as digit substitutes.</p>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Prefix" value={cfg.prefix} onChange={(v) => update({ prefix: v })} disabled={!canEdit} />
          <Field label="Suffix" value={cfg.suffix} onChange={(v) => update({ suffix: v })} disabled={!canEdit} />
          <Field label="Decimal char" value={cfg.decimalChar} onChange={(v) => update({ decimalChar: v })} disabled={!canEdit} />
          <Field label="Repeat char" value={cfg.repeatChar} onChange={(v) => update({ repeatChar: v })} disabled={!canEdit} />
        </div>
      </div>

      {/* Digit map */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Digit → Letter Map</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Each digit 0–9 maps to a unique letter. All 10 must be different.</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
            {DIGITS.map((d) => (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-gray-400 dark:text-muted-foreground">{d}</span>
                <input
                  className="w-10 h-10 border border-gray-200 dark:border-border rounded-lg text-sm text-center uppercase font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:opacity-60"
                  maxLength={1}
                  value={cfg.digitMap[d] || ''}
                  onChange={(e) => setDigit(d, e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-border">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground">Preview</h3>
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">Test how a price looks with the current settings.</p>
        </div>
        <div className="p-5 flex items-center gap-3 flex-wrap">
          <input
            className={`${inputCls} w-40`}
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            placeholder="e.g. 1250.50"
          />
          <button
            onClick={handlePreview}
            className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-muted hover:bg-gray-200 dark:bg-muted text-gray-700 dark:text-foreground rounded-lg transition-colors"
          >
            Generate
          </button>
          {preview && (
            <span className="px-3 py-2 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-lg text-sm font-mono font-semibold text-gray-800 dark:text-foreground">{preview}</span>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        {!canEdit
          ? <p className="text-xs text-gray-500 dark:text-muted-foreground">View-only access — ask a manager to make changes.</p>
          : message && (
            <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-600'}`}>{message.text}</p>
          )}
        <button
          onClick={handleSave}
          disabled={saving || !canEdit}
          className="ml-auto px-5 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default CostCodeSettings;
