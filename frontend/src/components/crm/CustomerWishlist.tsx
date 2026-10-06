/**
 * CustomerWishlist
 * Wishlist tab shown inside a customer detail / modal.
 * Props: customerId
 */

import { useState, useEffect } from 'react';
import { Heart, Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWishlist, addToWishlist, removeFromWishlist, type WishlistItem } from '@/services/crmService';
import { useToast } from '@/hooks/use-toast';
import { fetchApi } from '@/services/api';

interface Props { customerId: string; }

export default function CustomerWishlist({ customerId }: Props) {
  const { toast } = useToast();
  const [items, setItems]       = useState<WishlistItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; selling_price: number | null }[]>([]);
  const [selProduct, setSelProduct] = useState('');
  const [notes, setNotes]       = useState('');

  const load = () => {
    setLoading(true);
    getWishlist(customerId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [customerId]);

  useEffect(() => {
    if (showAdd && products.length === 0) {
      fetchApi<any>('/products?limit=200')
        .then(r => setProducts(((r && r.data) ? r.data : (r || [])).map((p: any) => ({ id: p.id, name: p.name, selling_price: p.selling_price }))))
        .catch(() => {});
    }
  }, [showAdd]);

  const handleAdd = async () => {
    if (!selProduct) return;
    setAdding(true);
    try {
      await addToWishlist(customerId, selProduct, undefined, notes || undefined);
      toast({ title: 'Added to wishlist' });
      setShowAdd(false); setSelProduct(''); setNotes('');
      load();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.response?.data?.message || e.message, variant: 'destructive' });
    } finally { setAdding(false); }
  };

  const handleRemove = async (itemId: string) => {
    try {
      await removeFromWishlist(customerId, itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast({ title: 'Removed from wishlist' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Heart className="h-4 w-4 text-rose-500" />
          Wishlist ({items.length})
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> Add product
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <select
            value={selProduct}
            onChange={e => setSelProduct(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select product…</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!selProduct || adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No wishlist items yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border bg-background p-3 gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{item.product_name}</div>
                {item.purity && <div className="text-xs text-muted-foreground">{item.purity}</div>}
                {item.notes && <div className="text-xs text-muted-foreground italic">{item.notes}</div>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {(item.piece_price ?? item.selling_price) != null && (
                  <span className="text-sm font-medium">
                    {Number(item.piece_price ?? item.selling_price).toLocaleString()}
                  </span>
                )}
                <button
                  onClick={() => handleRemove(item.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
