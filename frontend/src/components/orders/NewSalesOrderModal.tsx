import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Loader2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CustomerSearchSelect, { CustomerHit } from '@/components/customers/CustomerSearchSelect';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { ordersService, OrderItem } from '@/services/ordersService';

interface DraftLine {
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface NewSalesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

const emptyLine = (): DraftLine => ({ productName: '', quantity: 1, unitPrice: 0 });

// Focused quick-action flow: "New Sales Order" opens straight to a minimal
// form (customer + free-form line items + notes) rather than the full order
// list. No product catalog picker yet — line items are typed in directly,
// matching the "keep it reasonably minimal but real" scope for Phase 1 of
// this feature. Glass modal styling matches ReturnProcessingModal.tsx.
const NewSalesOrderModal: React.FC<NewSalesOrderModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { formatCurrency } = useLocaleFormat();
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0),
    [lines]
  );
  const total = subtotal; // tax left at 0 for this minimal flow — no jurisdiction context here

  if (!isOpen) return null;

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    const validLines = lines.filter((l) => l.productName.trim() && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      toast.error('Add at least one item with a name and quantity.');
      return;
    }

    setSaving(true);
    try {
      const items: OrderItem[] = validLines.map((l) => ({
        productId: '',
        productName: l.productName.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice) || 0,
        totalPrice: (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      }));

      const result = await ordersService.createOrder({
        customer_id: customer?.id || null,
        items,
        subtotal,
        tax: 0,
        total,
        notes: notes.trim() || undefined,
      });

      toast.success(`Sales order ${result.orderNumber || ''} created.`);
      onSuccess(result.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to create sales order: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/40 bg-card/95 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">New Sales Order</h2>
              <p className="text-xs text-muted-foreground">Capture a customer order to fulfil later.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Customer (optional)
            </label>
            <CustomerSearchSelect selected={customer} onSelect={setCustomer} placeholder="Search by name or phone…" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Items
              </label>
              <button
                onClick={addLine}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={line.productName}
                    onChange={(e) => updateLine(idx, { productName: e.target.value })}
                    placeholder="Item name"
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                    placeholder="Qty"
                    className="w-20 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                    placeholder="Unit price"
                    className="w-28 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-rose-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Any special instructions…"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/40 bg-primary/5 p-3.5">
            <span className="text-sm font-medium text-foreground">Order total</span>
            <span className="text-lg font-bold text-foreground">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="gap-1.5 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Order
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewSalesOrderModal;
