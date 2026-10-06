import React, { useState, useEffect } from 'react';
import { X, Scale } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/LocalizationContext';
import { calculateWeightPrice } from '@/services/jewelryOpsService';
import { JewelryLinePricing } from '@/types/index';

interface JewelryPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}

const inputCls = "w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background-input text-text placeholder-text-secondary text-sm";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-muted-foreground mb-1";

// Cart-side counterpart to ProductFormModal's "Jewelry Details" section — the
// cashier confirms/adjusts the actual weighed piece here at checkout, prefilled
// from the product's saved defaults, then calls the same
// POST /api/metal-rates/calculate the standalone rate calculator uses.
const JewelryPricingModal: React.FC<JewelryPricingModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
}) => {
  const { items, setJewelryPricing } = useCart();
  const { formatCurrency } = useCurrency();
  const cartItem = items.find(item => item.product.id === productId);
  const product = cartItem?.product as any;

  const [metal, setMetal] = useState('Gold');
  const [purity, setPurity] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [wastagePct, setWastagePct] = useState('');
  const [makingChargeType, setMakingChargeType] = useState('');
  const [makingChargeValue, setMakingChargeValue] = useState('');
  const [stoneValue, setStoneValue] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !product) return;
    const existing = cartItem?.jewelryPricing as JewelryLinePricing | null | undefined;
    setMetal(product.metal || 'Gold');
    setPurity(existing?.purity ?? product.purity ?? '');
    setNetWeight(String(existing?.netWeight ?? product.defaultNetWeight ?? ''));
    setGrossWeight(String(existing?.grossWeight ?? product.defaultGrossWeight ?? ''));
    setWastagePct(String(existing?.wastagePct ?? product.defaultWastagePct ?? ''));
    setMakingChargeType(existing?.makingChargeType ?? product.defaultMakingChargeType ?? '');
    setMakingChargeValue(String(existing?.makingChargeValue ?? product.defaultMakingChargeValue ?? ''));
    setStoneValue(String(existing?.stoneValue ?? ''));
    setPreview(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, productId]);

  if (!isOpen || !cartItem) return null;

  const num = (v: string) => (v === '' ? null : Number(v));

  const handleCalculate = async () => {
    if (!netWeight) {
      setError('Net weight is required');
      return;
    }
    setIsCalculating(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        net_weight: num(netWeight),
        wastage_pct: num(wastagePct),
        making_charge_type: makingChargeType || null,
        making_charge_value: num(makingChargeValue),
        stone_value: num(stoneValue),
        metal: metal || undefined,
        purity_label: purity || undefined,
      };
      const result = await calculateWeightPrice(payload);
      setPreview(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to calculate — check the metal rate is published for this purity');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    const pricing: JewelryLinePricing = {
      purity: purity || null,
      grossWeight: num(grossWeight),
      netWeight: num(netWeight),
      ratePerGram: preview.ratePerGram ?? preview.rate_per_gram ?? null,
      wastagePct: num(wastagePct),
      makingChargeType: (makingChargeType || null) as any,
      makingChargeValue: num(makingChargeValue),
      stoneValue: num(stoneValue),
      metalValue: preview.metalValue ?? preview.metal_value ?? 0,
      wastageValue: preview.wastageValue ?? preview.wastage_value ?? 0,
      makingCharge: preview.makingCharge ?? preview.making_charge ?? 0,
      lineTotal: preview.lineTotal ?? preview.line_total ?? 0,
      hsnCode: product?.hsnCode ?? null,
      snapshot: preview.snapshot,
    };
    setJewelryPricing(productId, pricing);
    onClose();
  };

  const handleClear = () => {
    setJewelryPricing(productId, null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-foreground flex items-center gap-2">
            <Scale size={20} /> Weight & Purity: {productName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 dark:bg-muted"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Metal</label>
              <select className={inputCls} value={metal} onChange={e => setMetal(e.target.value)}>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Platinum">Platinum</option>
                <option value="Palladium">Palladium</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Purity</label>
              <input className={inputCls} value={purity} onChange={e => setPurity(e.target.value)} placeholder="e.g. 22K" />
            </div>
            <div>
              <label className={labelCls}>Gross Weight (g)</label>
              <input type="number" step="0.001" className={inputCls} value={grossWeight} onChange={e => setGrossWeight(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Net Weight (g) *</label>
              <input type="number" step="0.001" className={inputCls} value={netWeight} onChange={e => setNetWeight(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Wastage %</label>
              <input type="number" step="0.01" className={inputCls} value={wastagePct} onChange={e => setWastagePct(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Making Charge Type</label>
              <select className={inputCls} value={makingChargeType} onChange={e => setMakingChargeType(e.target.value)}>
                <option value="">None</option>
                <option value="per_gram">Per Gram</option>
                <option value="percentage">Percentage</option>
                <option value="flat">Flat</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Making Charge Value</label>
              <input type="number" step="0.01" className={inputCls} value={makingChargeValue} onChange={e => setMakingChargeValue(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Stone Value (optional)</label>
              <input type="number" step="0.01" className={inputCls} value={stoneValue} onChange={e => setStoneValue(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="w-full py-2 px-4 bg-gray-100 dark:bg-muted text-gray-800 dark:text-foreground rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            {isCalculating ? 'Calculating…' : 'Calculate'}
          </button>

          {preview && (
            <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-3.5 border border-border/60 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Metal Value</span><span>{formatCurrency(preview.metalValue ?? preview.metal_value ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Wastage</span><span>{formatCurrency(preview.wastageValue ?? preview.wastage_value ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Making Charge</span><span>{formatCurrency(preview.makingCharge ?? preview.making_charge ?? 0)}</span></div>
              {(num(stoneValue) ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Stone Value</span><span>{formatCurrency(num(stoneValue) || 0)}</span></div>
              )}
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Line Total</span>
                <span>{formatCurrency(preview.lineTotal ?? preview.line_total ?? 0)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-2">
          {cartItem.jewelryPricing && (
            <button
              onClick={handleClear}
              className="flex-1 py-2 px-4 border border-border rounded-md hover:bg-gray-50 dark:hover:bg-muted text-sm"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleApply}
            disabled={!preview}
            className="flex-1 py-2 px-4 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default JewelryPricingModal;
