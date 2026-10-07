import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCurrentRates, getRateHistory, publishRate, getPricingSettings, savePricingSettings,
  calculateWeightPrice, fetchMarketRates, fetchAndPublishMarketRates,
  MetalRate, PricingSettings, MarketRatePreview,
} from '@/services/jewelryOpsService';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Gem, Plus, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus,
  Settings, Calculator, History, X, Check, AlertTriangle, Scale,
  Globe, Key, Zap, Eye,
} from 'lucide-react';

/* ─── helpers ────────────────────────────────────────────────────────────── */
const inputCls = 'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background text-foreground placeholder:text-muted-foreground transition-colors text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';

const toIsoDate = (d: any): string => {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return '';
};

const METAL_COLORS: Record<string, string> = {
  Gold:     '#f59e0b',
  Silver:   '#94a3b8',
  Platinum: '#818cf8',
  Palladium:'#34d399',
};

const QUICK_PURITIES = [
  { metal: 'Gold',     purityLabel: '24K', purityPct: 99.9 },
  { metal: 'Gold',     purityLabel: '22K', purityPct: 91.6 },
  { metal: 'Gold',     purityLabel: '18K', purityPct: 75.0 },
  { metal: 'Gold',     purityLabel: '14K', purityPct: 58.5 },
  { metal: 'Silver',   purityLabel: '999', purityPct: 99.9 },
  { metal: 'Silver',   purityLabel: '925', purityPct: 92.5 },
  { metal: 'Platinum', purityLabel: '950', purityPct: 95.0 },
];

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
const MetalRatesPage: React.FC = () => {
  const { formatCurrency, formatDate, formatWeight, weightUnitLabel } = useLocaleFormat();
  const { store } = useStore();
  const { user } = useAuth();
  // Rate publishing + pricing settings write via settings.edit.
  const canEdit = hasPermission(user, 'settings.edit');
  const { toast } = useToast();
  const fmtC = (n: any) => n != null ? formatCurrency(Number(n)) : '—';
  const fmtD = (d: any) => { const s = toIsoDate(d); return s ? formatDate(s) : '—'; };

  const [rates, setRates]       = useState<MetalRate[]>([]);
  const [history, setHistory]   = useState<MetalRate[]>([]);
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showPublish, setShowPublish]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCalc, setShowCalc]         = useState(false);
  const [showFetch, setShowFetch]       = useState(false);

  const [histMetal, setHistMetal]   = useState('');
  const [histPurity, setHistPurity] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [c, h, s] = await Promise.all([getCurrentRates(), getRateHistory(), getPricingSettings()]);
      setRates(c || []); setHistory(h || []); setSettings(s);
    } catch (e: any) { setLoadError(e?.message ?? 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Filtered history */
  const filteredHistory = useMemo(() =>
    history.filter(r =>
      (!histMetal  || r.metal === histMetal) &&
      (!histPurity || r.purityLabel === histPurity)
    ), [history, histMetal, histPurity]
  );

  /* Unique metals / purities from history */
  const metals   = useMemo(() => [...new Set(history.map(r => r.metal))].sort(), [history]);
  const purities = useMemo(() => [...new Set(history.filter(r => !histMetal || r.metal === histMetal).map(r => r.purityLabel))].sort(), [history, histMetal]);

  /* For each current rate, find the previous rate to show trend */
  const prevRateMap = useMemo(() => {
    const m: Record<string, number | null> = {};
    rates.forEach(r => {
      const prev = history.find(h => h.metal === r.metal && h.purityLabel === r.purityLabel && h.effectiveTo != null);
      m[`${r.metal}|${r.purityLabel}`] = prev ? Number(prev.ratePerGram) : null;
    });
    return m;
  }, [rates, history]);

  /* Group current rates by metal */
  const ratesByMetal = useMemo(() => {
    const g: Record<string, MetalRate[]> = {};
    rates.forEach(r => { (g[r.metal] = g[r.metal] || []).push(r); });
    return g;
  }, [rates]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        icon={Gem}
        title="Metal Rates"
        subtitle="Publish daily rates and price items by weight."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setShowCalc(p => !p)}>
              <Calculator className="h-4 w-4 mr-1" /> Calculator
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowFetch(p => !p)}>
              <Globe className="h-4 w-4 mr-1" /> Market Rates
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(p => !p)}>
              <Settings className="h-4 w-4 mr-1" /> Settings
            </Button>
            <Button onClick={() => setShowPublish(true)} disabled={!canEdit} title={!canEdit ? 'View-only access' : undefined}>
              <Plus className="h-4 w-4 mr-1" /> Publish Rate
            </Button>
          </div>
        }
      />

      {/* Error */}
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive flex-1">{loadError}</span>
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {/* Market rate fetch panel */}
      {showFetch && (
        <MarketFetchPanel
          settings={settings}
          currencyCode={store?.currencyCode || 'USD'}
          onClose={() => setShowFetch(false)}
          onPublished={() => { setShowFetch(false); load(); }}
        />
      )}

      {/* Price Calculator panel */}
      {showCalc && <PriceCalculator rates={rates} settings={settings} onClose={() => setShowCalc(false)} />}

      {/* Settings panel */}
      {showSettings && settings && (
        <SettingsPanel
          settings={settings}
          onSaved={(s) => { setSettings(s); setShowSettings(false); toast({ title: 'Settings saved' }); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Weight pricing banner */}
      {settings && !Number(settings.weightPricingEnabled) && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Scale className="h-4 w-4 shrink-0" />
            Weight-based pricing is <strong>off</strong>. Products use the purchase → cost → selling markup flow.
          </div>
          <button onClick={() => setShowSettings(true)} className="text-xs font-medium text-amber-700 dark:text-amber-400 underline shrink-0">
            Enable in Settings
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading rates…
        </div>
      ) : (
        <>
          {/* Current rates — grouped by metal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" /> Live Rates
            </h3>
            {Object.keys(ratesByMetal).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <Gem className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No rates published yet.</p>
                <Button className="mt-4" size="sm" onClick={() => setShowPublish(true)} disabled={!canEdit}>
                  <Plus className="h-4 w-4 mr-1" /> Publish First Rate
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(ratesByMetal).map(([metal, metalRates]) => {
                  const color = METAL_COLORS[metal] || '#6b7280';
                  return (
                    <div key={metal} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: color }} />
                        <h4 className="text-sm font-bold text-foreground">{metal}</h4>
                        <span className="text-xs text-muted-foreground">{metalRates.length} purity{metalRates.length !== 1 ? 'ies' : ''}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
                        {metalRates.map(r => {
                          const key = `${r.metal}|${r.purityLabel}`;
                          const prev = prevRateMap[key];
                          const curr = Number(r.ratePerGram);
                          const diff = prev != null ? curr - prev : null;
                          const pct  = diff != null && prev ? ((diff / prev) * 100).toFixed(2) : null;
                          return (
                            <div key={r.id} className="bg-card p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="text-sm font-bold text-foreground">{r.purityLabel}</p>
                                  {r.purityPct != null && <p className="text-xs text-muted-foreground">{r.purityPct}%</p>}
                                </div>
                                {diff != null && (
                                  <div className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                                    diff > 0 ? 'bg-green-100 text-green-700 dark:bg-green-950/40' :
                                    diff < 0 ? 'bg-red-100 text-red-700 dark:bg-red-950/40' :
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                    {pct}%
                                  </div>
                                )}
                              </div>
                              <p className="text-xl font-bold text-foreground">{fmtC(r.ratePerGram)}<span className="text-xs font-normal text-muted-foreground">/{weightUnitLabel}</span></p>
                              {r.buyRatePerGram != null && (
                                <p className="text-xs text-muted-foreground mt-1">Buy: {fmtC(r.buyRatePerGram)}/{weightUnitLabel}</p>
                              )}
                              {diff != null && prev != null && (
                                <p className={`text-xs mt-1 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {diff >= 0 ? '+' : ''}{fmtC(diff)} vs prev
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">From {fmtD(r.effectiveFrom)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rate history */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" /> Rate History
              </h3>
              <div className="flex gap-2">
                <select value={histMetal} onChange={e => { setHistMetal(e.target.value); setHistPurity(''); }}
                  className="border border-border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">All metals</option>
                  {metals.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={histPurity} onChange={e => setHistPurity(e.target.value)}
                  className="border border-border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="">All purities</option>
                  {purities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {(histMetal || histPurity) && (
                  <button onClick={() => { setHistMetal(''); setHistPurity(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['Metal', 'Purity', 'Sell/g', 'Buy/g', 'From', 'To'].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${h.includes('/') ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredHistory.map(r => {
                      const isCurrent = r.effectiveTo == null;
                      return (
                        <tr key={r.id} className={`transition-colors ${isCurrent ? 'bg-green-50/50 dark:bg-green-950/10' : 'hover:bg-muted/20'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ background: METAL_COLORS[r.metal] || '#6b7280' }} />
                              <span className="font-medium text-foreground">{r.metal}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground">{r.purityLabel}</td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">{fmtC(r.ratePerGram)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{r.buyRatePerGram != null ? fmtC(r.buyRatePerGram) : '—'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtD(r.effectiveFrom)}</td>
                          <td className="px-4 py-3 text-xs">
                            {isCurrent
                              ? <span className="text-green-600 font-semibold flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />current</span>
                              : <span className="text-muted-foreground">{fmtD(r.effectiveTo)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                  {filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showPublish && (
        <PublishRateModal
          currentRates={rates}
          onClose={() => setShowPublish(false)}
          onSaved={() => { setShowPublish(false); load(); }}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   SETTINGS PANEL
══════════════════════════════════════════════════════════════════════════════ */
const SettingsPanel: React.FC<{
  settings: PricingSettings;
  onSaved: (s: PricingSettings) => void;
  onClose: () => void;
}> = ({ settings, onSaved, onClose }) => {
  const [f, setF]     = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'settings.edit');

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await savePricingSettings({
        weight_pricing_enabled:          f.weightPricingEnabled ? 1 : 0,
        default_making_charge_type:      f.defaultMakingChargeType,
        default_making_charge_value:     Number(f.defaultMakingChargeValue),
        default_wastage_pct:             Number(f.defaultWastagePct),
        market_rate_api_key:             f.marketRateApiKey || null,
        market_rate_local_premium_pct:   Number(f.marketRateLocalPremiumPct ?? 0),
        market_rate_auto_publish:        f.marketRateAutoPublish ? 1 : 0,
        market_rate_fetch_time:          f.marketRateFetchTime || '10:00',
        weight_unit:                     f.weightUnit || 'g',
      });
      onSaved(f);
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Settings className="h-4 w-4" />Pricing Settings</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {/* Weight pricing toggle */}
      <label className="flex items-start gap-3 cursor-pointer">
        <div className="relative mt-0.5">
          <input type="checkbox" className="sr-only peer"
            checked={!!Number(f.weightPricingEnabled)}
            disabled={!canEdit}
            onChange={e => setF(p => ({ ...p, weightPricingEnabled: e.target.checked ? 1 : 0 }))} />
          <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-primary transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Enable weight-based pricing</p>
          <p className="text-xs text-muted-foreground mt-0.5">Price line items from net weight × rate + making charges. Off = standard markup pricing.</p>
        </div>
      </label>

      {/* Defaults */}
      <div>
        <p className={labelCls}>Pricing defaults</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Making charge type</label>
            <select className={inputCls} value={f.defaultMakingChargeType} disabled={!canEdit}
              onChange={e => setF(p => ({ ...p, defaultMakingChargeType: e.target.value as any }))}>
              <option value="per_gram">Per gram</option>
              <option value="percentage">Percentage</option>
              <option value="flat">Flat</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Making charge value</label>
            <input type="number" min="0" step="0.01" className={inputCls}
              value={f.defaultMakingChargeValue} disabled={!canEdit}
              onChange={e => setF(p => ({ ...p, defaultMakingChargeValue: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={labelCls}>Wastage %</label>
            <input type="number" min="0" max="20" step="0.001" className={inputCls}
              value={f.defaultWastagePct} disabled={!canEdit}
              onChange={e => setF(p => ({ ...p, defaultWastagePct: Number(e.target.value) }))} />
          </div>
        </div>
      </div>

      {/* Weight unit */}
      <div>
        <label className={labelCls}>Weight unit (display)</label>
        <div className="flex flex-wrap gap-2">
          {(['g', 'oz', 'tola', 'baht', 'kg'] as const).map(u => (
            <button key={u} type="button"
              onClick={() => setF(p => ({ ...p, weightUnit: u }))}
              disabled={!canEdit}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                f.weightUnit === u
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}>
              {u === 'g' ? 'Gram (g)' : u === 'oz' ? 'Troy oz' : u === 'tola' ? 'Tola' : u === 'baht' ? 'Baht' : 'Kilogram (kg)'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">All DB values stored in grams; this controls the display unit across pages.</p>
      </div>

      {/* Market rate automation */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Market Rate Automation (goldapi.io)</p>

        <div>
          <label className={labelCls}>API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              className={inputCls + ' pr-20'}
              placeholder="goldapi.io API key"
              value={f.marketRateApiKey || ''}
              disabled={!canEdit}
              onChange={e => setF(p => ({ ...p, marketRateApiKey: e.target.value }))}
            />
            <button type="button" onClick={() => setShowApiKey(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-medium">
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Get a free key at <span className="font-medium">goldapi.io</span>. Rates auto-convert to your org's currency.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Local premium %</label>
            <input type="number" min="0" max="50" step="0.1" className={inputCls}
              value={f.marketRateLocalPremiumPct ?? 0} disabled={!canEdit}
              onChange={e => setF(p => ({ ...p, marketRateLocalPremiumPct: Number(e.target.value) }))} />
            <p className="text-xs text-muted-foreground mt-1">Added on top of spot (import duty, local margin). India ≈15–18%, USA ≈2–5%.</p>
          </div>
          <div>
            <label className={labelCls}>Auto-fetch time (24h)</label>
            <input type="time" className={inputCls}
              value={f.marketRateFetchTime || '10:00'} disabled={!canEdit}
              onChange={e => setF(p => ({ ...p, marketRateFetchTime: e.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">Scheduled daily fetch (requires auto-publish on).</p>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only peer"
              checked={!!Number(f.marketRateAutoPublish)}
              disabled={!canEdit}
              onChange={e => setF(p => ({ ...p, marketRateAutoPublish: e.target.checked ? 1 : 0 }))} />
            <div className="w-9 h-5 bg-muted rounded-full peer-checked:bg-primary transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Auto-publish fetched rates</p>
            <p className="text-xs text-muted-foreground">Automatically publish daily market rates at the scheduled time.</p>
          </div>
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={saving || !canEdit} title={!canEdit ? 'View-only access' : undefined}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Save</>}
        </Button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   PRICE CALCULATOR
══════════════════════════════════════════════════════════════════════════════ */
const PriceCalculator: React.FC<{
  rates: MetalRate[];
  settings: PricingSettings | null;
  onClose: () => void;
}> = ({ rates, settings, onClose }) => {
  const { formatCurrency } = useLocaleFormat();
  const fmtC = (n: any) => n != null ? formatCurrency(Number(n)) : '—';

  const [metal, setMetal]               = useState(rates[0]?.metal || 'Gold');
  const [purity, setPurity]             = useState(rates[0]?.purityLabel || '22K');
  const [netWeight, setNetWeight]       = useState('10');
  const [makingType, setMakingType]     = useState(settings?.defaultMakingChargeType || 'per_gram');
  const [makingValue, setMakingValue]   = useState(String(settings?.defaultMakingChargeValue || 0));
  const [wastagePct, setWastagePct]     = useState(String(settings?.defaultWastagePct || 0));
  const [stoneValue, setStoneValue]     = useState('0');
  const [result, setResult]             = useState<any>(null);
  const [calculating, setCalculating]   = useState(false);
  const [calcError, setCalcError]       = useState<string | null>(null);

  const metalOptions = [...new Set(rates.map(r => r.metal))];
  const purityOptions = rates.filter(r => r.metal === metal).map(r => r.purityLabel);
  const currentRate   = rates.find(r => r.metal === metal && r.purityLabel === purity);

  const calculate = async () => {
    setCalculating(true); setCalcError(null);
    try {
      const r = await calculateWeightPrice({
        metal, purity_label: purity,
        net_weight:          Number(netWeight),
        making_charge_type:  makingType,
        making_charge_value: Number(makingValue),
        wastage_pct:         Number(wastagePct),
        stone_value:         Number(stoneValue),
      });
      setResult(r);
    } catch (e: any) { setCalcError(e?.message); }
    finally { setCalculating(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Calculator className="h-4 w-4" />Price Calculator</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Metal</label>
          <select className={inputCls} value={metal} onChange={e => { setMetal(e.target.value); setResult(null); }}>
            {metalOptions.map(m => <option key={m} value={m}>{m}</option>)}
            {metalOptions.length === 0 && <option value="Gold">Gold</option>}
          </select>
        </div>
        <div>
          <label className={labelCls}>Purity</label>
          <select className={inputCls} value={purity} onChange={e => { setPurity(e.target.value); setResult(null); }}>
            {purityOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Net weight (g)</label>
          <input type="number" min="0" step="0.001" className={inputCls} value={netWeight}
            onChange={e => { setNetWeight(e.target.value); setResult(null); }} />
        </div>
        <div>
          <label className={labelCls}>Stone value</label>
          <input type="number" min="0" className={inputCls} value={stoneValue}
            onChange={e => { setStoneValue(e.target.value); setResult(null); }} />
        </div>
        <div>
          <label className={labelCls}>Making charge type</label>
          <select className={inputCls} value={makingType} onChange={e => { setMakingType(e.target.value as any); setResult(null); }}>
            <option value="per_gram">Per gram</option>
            <option value="percentage">Percentage</option>
            <option value="flat">Flat</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Making charge value</label>
          <input type="number" min="0" className={inputCls} value={makingValue}
            onChange={e => { setMakingValue(e.target.value); setResult(null); }} />
        </div>
        <div>
          <label className={labelCls}>Wastage %</label>
          <input type="number" min="0" max="20" step="0.001" className={inputCls} value={wastagePct}
            onChange={e => { setWastagePct(e.target.value); setResult(null); }} />
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={calculate} disabled={calculating || !currentRate}>
            {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calculate'}
          </Button>
        </div>
      </div>

      {currentRate && (
        <p className="text-xs text-muted-foreground">
          Using rate: <span className="font-semibold text-foreground">{fmtC(currentRate.ratePerGram)}/g</span> for {metal} {purity}
        </p>
      )}
      {!currentRate && rates.length > 0 && (
        <p className="text-xs text-amber-600">No current rate published for {metal} {purity}. Publish one first.</p>
      )}
      {calcError && <p className="text-xs text-destructive">{calcError}</p>}

      {result && (
        <div className="bg-muted/40 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Breakdown</p>
          {[
            { label: 'Metal value',   value: result.metalValue },
            { label: 'Wastage',       value: result.wastageValue },
            { label: 'Making charge', value: result.makingCharge },
            { label: 'Stone value',   value: result.stoneValue },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-foreground">{fmtC(value)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between text-base font-bold text-foreground">
            <span>Line total</span>
            <span className="text-primary">{fmtC(result.lineTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLISH RATE MODAL
══════════════════════════════════════════════════════════════════════════════ */
const PublishRateModal: React.FC<{
  currentRates: MetalRate[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ currentRates, onClose, onSaved }) => {
  const { formatCurrency } = useLocaleFormat();
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'settings.edit');

  const [metal, setMetal]           = useState('Gold');
  const [purityLabel, setPurity]    = useState('22K');
  const [purityPct, setPurityPct]   = useState<string>('91.6');
  const [ratePerGram, setRate]      = useState('');
  const [buyRate, setBuyRate]       = useState('');
  const [saving, setSaving]         = useState(false);

  const applyPreset = (p: typeof QUICK_PURITIES[0]) => {
    setMetal(p.metal); setPurity(p.purityLabel); setPurityPct(String(p.purityPct));
    // pre-fill with existing current rate if any
    const existing = currentRates.find(r => r.metal === p.metal && r.purityLabel === p.purityLabel);
    if (existing) { setRate(String(existing.ratePerGram)); setBuyRate(existing.buyRatePerGram != null ? String(existing.buyRatePerGram) : ''); }
  };

  const existing = currentRates.find(r => r.metal === metal && r.purityLabel === purityLabel);

  const save = async () => {
    if (!canEdit) return;
    if (!metal || !purityLabel || !ratePerGram) {
      toast({ title: 'Metal, purity and sell rate are required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await publishRate({
        metal, purity_label: purityLabel, purity_pct: purityPct ? Number(purityPct) : null,
        rate_per_gram: Number(ratePerGram),
        buy_rate_per_gram: buyRate ? Number(buyRate) : null,
      });
      toast({ title: `Rate published: ${metal} ${purityLabel} @ ${formatCurrency(Number(ratePerGram))}/g` });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Failed to publish', description: e?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Gem className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Publish Metal Rate</h2>
              <p className="text-xs text-muted-foreground">Closes the previous rate for this metal + purity</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Quick presets */}
          <div>
            <p className={labelCls}>Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PURITIES.map(p => (
                <button key={`${p.metal}${p.purityLabel}`} onClick={() => applyPreset(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    metal === p.metal && purityLabel === p.purityLabel
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}>
                  {p.metal} {p.purityLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Current rate info */}
          {existing && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              Current rate for {metal} {purityLabel}: <strong>{formatCurrency(Number(existing.ratePerGram))}/g</strong>. Publishing will close it.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Metal *</label>
              <input className={inputCls} list="metal-list" value={metal} onChange={e => setMetal(e.target.value)} />
              <datalist id="metal-list"><option value="Gold" /><option value="Silver" /><option value="Platinum" /><option value="Palladium" /></datalist>
            </div>
            <div>
              <label className={labelCls}>Purity label *</label>
              <input className={inputCls} list="purity-list" value={purityLabel} onChange={e => setPurity(e.target.value)} />
              <datalist id="purity-list">
                {QUICK_PURITIES.filter(p => p.metal === metal).map(p => <option key={p.purityLabel} value={p.purityLabel} />)}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Purity %</label>
              <input type="number" min="0" max="100" step="0.001" className={inputCls} value={purityPct}
                onChange={e => setPurityPct(e.target.value)} />
            </div>
            <div />
            <div>
              <label className={labelCls}>Sell rate / gram *</label>
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="e.g. 6500"
                value={ratePerGram} onChange={e => setRate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Buy rate / gram</label>
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="e.g. 6200"
                value={buyRate} onChange={e => setBuyRate(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Used for old gold buy-back pricing</p>
            </div>
          </div>

          {/* Live preview */}
          {ratePerGram && Number(ratePerGram) > 0 && (
            <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1">
              <p className="font-semibold text-muted-foreground uppercase tracking-wide">Quick reference</p>
              {[1, 5, 10, 20].map(g => (
                <div key={g} className="flex justify-between">
                  <span className="text-muted-foreground">{g}g {metal} {purityLabel}</span>
                  <span className="font-semibold text-foreground">{formatCurrency(g * Number(ratePerGram))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={saving || !ratePerGram || !canEdit}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Publishing…</> : 'Publish Rate'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   MARKET FETCH PANEL
══════════════════════════════════════════════════════════════════════════════ */
const METAL_OPTIONS = ['Gold', 'Silver', 'Platinum', 'Palladium'] as const;

const MarketFetchPanel: React.FC<{
  settings: PricingSettings | null;
  currencyCode: string;
  onClose: () => void;
  onPublished: () => void;
}> = ({ settings, currencyCode, onClose, onPublished }) => {
  const { formatCurrency, weightUnitLabel } = useLocaleFormat();
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'settings.edit');
  const fmtC = (n: any) => n != null ? formatCurrency(Number(n)) : '—';

  const [selectedMetals, setSelectedMetals] = useState<string[]>(['Gold', 'Silver', 'Platinum']);
  const [preview, setPreview]       = useState<MarketRatePreview[] | null>(null);
  const [errors, setErrors]         = useState<{ metal: string; error: string }[]>([]);
  const [fetchedAt, setFetchedAt]   = useState<string | null>(null);
  const [fetching, setFetching]     = useState(false);
  const [publishing, setPublishing] = useState(false);

  const hasKey = !!settings?.marketRateApiKey;

  const toggleMetal = (m: string) =>
    setSelectedMetals(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  const doFetch = async () => {
    if (!hasKey) { toast({ title: 'No API key configured', description: 'Add a goldapi.io key in Settings first.', variant: 'destructive' }); return; }
    setFetching(true); setPreview(null); setErrors([]);
    try {
      const r = await fetchMarketRates(selectedMetals);
      setPreview(r.rates);
      setErrors(r.errors || []);
      setFetchedAt(r.fetchedAt);
    } catch (e: any) {
      toast({ title: 'Fetch failed', description: e?.message, variant: 'destructive' });
    } finally { setFetching(false); }
  };

  const doPublish = async () => {
    if (!canEdit) return;
    if (!preview?.length) return;
    setPublishing(true);
    try {
      const r = await fetchAndPublishMarketRates(selectedMetals);
      toast({ title: `Published ${r.published} rate${r.published !== 1 ? 's' : ''}`, description: 'Live rates updated.' });
      onPublished();
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e?.message, variant: 'destructive' });
    } finally { setPublishing(false); }
  };

  /* Group preview rows by metal */
  const previewByMetal = useMemo(() => {
    if (!preview) return {};
    const g: Record<string, MarketRatePreview[]> = {};
    preview.forEach(r => { (g[r.metal] = g[r.metal] || []).push(r); });
    return g;
  }, [preview]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Live Market Rates
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {/* API key status */}
      <div className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm ${
        hasKey
          ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400'
          : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400'
      }`}>
        <Key className="h-4 w-4 shrink-0" />
        {hasKey
          ? <span>goldapi.io key configured · Currency: <strong>{currencyCode}</strong> · Unit: <strong>{weightUnitLabel}</strong></span>
          : <span>No API key. Add one in <strong>Settings → Market Rate Automation</strong>.</span>}
      </div>

      {/* Metal selector */}
      <div>
        <p className={labelCls}>Select metals to fetch</p>
        <div className="flex flex-wrap gap-2">
          {METAL_OPTIONS.map(m => (
            <button key={m} type="button"
              onClick={() => toggleMetal(m)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-1.5 ${
                selectedMetals.includes(m)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: METAL_COLORS[m] || '#6b7280' }} />
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={doFetch} disabled={fetching || !selectedMetals.length}>
          {fetching ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Fetching…</> : <><Eye className="h-4 w-4 mr-1.5" />Fetch Preview</>}
        </Button>
        {preview && preview.length > 0 && (
          <Button variant="outline" onClick={doPublish} disabled={publishing || !canEdit} title={!canEdit ? 'View-only access' : undefined}>
            {publishing ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Publishing…</> : <><Zap className="h-4 w-4 mr-1.5" />Publish All ({preview.length})</>}
          </Button>
        )}
      </div>

      {/* Fetch errors */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map(e => (
            <div key={e.metal} className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 px-3 py-2 rounded-lg border border-destructive/20">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span><strong>{e.metal}:</strong> {e.error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="space-y-3">
          {fetchedAt && (
            <p className="text-xs text-muted-foreground">
              Fetched at {new Date(fetchedAt).toLocaleTimeString()} · Spot + {settings?.marketRateLocalPremiumPct ?? 0}% local premium
            </p>
          )}
          {Object.entries(previewByMetal).map(([metal, rows]) => (
            <div key={metal} className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: METAL_COLORS[metal] || '#6b7280' }} />
                <span className="text-xs font-bold text-foreground">{metal}</span>
                <span className="text-xs text-muted-foreground ml-auto">Spot: {fmtC(rows[0]?.spotPerTroyOz)}/troy oz</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Purity</th>
                      <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">Sell /{weightUnitLabel}</th>
                      <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">Buy /{weightUnitLabel}</th>
                      <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">Sell /g</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map(r => (
                      <tr key={r.purityLabel} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-foreground">
                          {r.purityLabel} <span className="font-normal text-muted-foreground">({r.purityPct}%)</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-foreground font-semibold">{fmtC(r.ratePerUnit)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{r.buyRatePerUnit != null ? fmtC(r.buyRatePerUnit) : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtC(r.ratePerGram)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Rates stored in grams in DB. Display unit ({weightUnitLabel}) is for reference only.
          </p>
        </div>
      )}

      {preview && preview.length === 0 && !fetching && (
        <p className="text-sm text-muted-foreground text-center py-4">No rates returned. Check your API key and selected metals.</p>
      )}
    </div>
  );
};

export default MetalRatesPage;
