import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, MoreHorizontal, Trash2, Package, Loader2,
  SlidersHorizontal, Boxes, TrendingUp, DollarSign, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/services/axiosConfig';
import { getCategories } from '@/services/api';
import { updateProduct, deleteProduct } from '@/services/productService';
import { setBreadcrumbLabel } from '@/utils/breadcrumbLabels';
import { normalizeImageUrl } from '@/utils/imageUtils';
import ProductFormModal from '@/components/inventory/ProductFormModal';
import StockAdjustmentModal from '@/components/modals/StockAdjustmentModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MetricCard from '@/components/MetricCard';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import { useIndustry } from '@/hooks/useIndustry';
import type { Product, Category } from '@/types';

// ── Types matching the /api/products/:id/360 payload (snake_case) ────────────

interface Product360 {
  kpis: {
    units_sold: number;
    revenue: number;
    sale_count: number;
    last_sold_at: string | null;
    open_po_qty: number;
    on_memo_qty: number;
  };
  piece_counts: Record<string, number>;
  sales: any[];
  returns: any[];
  receipts: any[];
  po_items: any[];
  memos: any[];
  layaways: any[];
  adjustments: any[];
  inventory_logs: any[];
  pieces: any[];
}

// ── Small presentation helpers (mirrors CustomerDetailsPage) ────────────────

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  sold: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
  hold: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  ordered: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  partially_received: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  partially_returned: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  cancelled: 'bg-gray-200 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400',
  in_stock: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  low_stock: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  out_of_stock: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
};

const StatusChip: React.FC<{ status?: string | null }> = ({ status }) => {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const cls = STATUS_STYLES[status] || 'bg-muted text-muted-foreground';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

interface MiniTableProps {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}

const MiniTable: React.FC<MiniTableProps> = ({ headers, rows, empty }) => {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/40">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${i === headers.length - 1 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              {cells.map((c, j) => (
                <td key={j} className={`px-4 py-3 text-sm whitespace-nowrap ${j === headers.length - 1 ? 'text-right font-medium' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div>
    <dt className="text-xs text-muted-foreground uppercase tracking-wider">{label}</dt>
    <dd className="mt-0.5 text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</dd>
  </div>
);

// ── Page ────────────────────────────────────────────────────────────────────

const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatDateTime } = useDateFormatting();
  const { industry } = useIndustry();

  const [product, setProduct] = useState<any>(null);
  const [view360, setView360] = useState<Product360 | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [prodRes, viewRes, cats] = await Promise.all([
        axiosInstance.get(`/api/products/${id}`),
        axiosInstance.get(`/api/products/${id}/360`),
        getCategories('active').catch(() => [] as Category[]),
      ]);
      const prod = prodRes.data?.data?.product;
      if (!prod?.id) throw new Error('Product not found');
      setProduct(prod);
      setView360(viewRes.data?.data ?? null);
      setCategories(Array.isArray(cats) ? cats : []);
      if (prod.name) setBreadcrumbLabel(`/products/${id}`, prod.name);
    } catch (error) {
      console.error('Error loading product details:', error);
      toast.error('Failed to load product details');
      navigate('/products');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => setBreadcrumbLabel(`/products/${id}`, null), [id]);

  // Update-only variant of ProductsPage.handleSaveProduct — same FormData
  // mapping (FormData isn't auto snake_cased by the api client).
  const handleSaveProduct = async (productData: Partial<Product>, imageFile: File | null) => {
    if (!product?.id) return;
    try {
      const formData = new FormData();
      const fieldMappings: Record<string, string> = {
        categoryId: 'category_id',
        lowStockThreshold: 'low_stock_threshold',
        isActive: 'is_active',
        taxClassId: 'tax_class_id',
      };
      const pd: any = { ...productData };
      if (pd.attributes && typeof pd.attributes === 'object') {
        formData.append('attributes', JSON.stringify(pd.attributes));
      }
      delete pd.attributes;
      delete pd.stockQuantity; // stock changes go through Adjust Stock only
      if (pd.purchasePrice !== undefined && pd.purchasePrice !== null && pd.purchasePrice !== '') {
        formData.append('purchase_price', String(pd.purchasePrice));
        delete pd.costPrice;
      }
      delete pd.purchasePrice;
      if (pd.handlingCostPct !== undefined && pd.handlingCostPct !== null && pd.handlingCostPct !== '') {
        formData.append('handling_cost_pct', String(pd.handlingCostPct));
      }
      delete pd.handlingCostPct;
      if (pd.markupPct !== undefined && pd.markupPct !== null && pd.markupPct !== '') {
        formData.append('markup_pct', String(pd.markupPct));
      }
      delete pd.markupPct;

      Object.entries(pd).forEach(([key, value]) => {
        const backendKey = fieldMappings[key] || key;
        if (key === 'taxClassId') {
          formData.append('tax_class_id', value === null || value === '' ? 'null' : String(value));
        } else if (value !== undefined && value !== null) {
          formData.append(backendKey, String(value));
        }
      });
      if (imageFile) formData.append('image', imageFile, imageFile.name);

      await updateProduct(product.id, formData);
      toast.success('Product updated successfully');
      setIsEditModalOpen(false);
      load();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    }
  };

  const confirmDeleteProduct = async () => {
    if (!product?.id) return;
    try {
      await deleteProduct(product.id);
      toast.success('Product deleted successfully');
      navigate('/products');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    } finally {
      setShowDeleteConfirm(false);
      setShowMoreOptions(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium text-foreground">Product not found</h2>
        <button className="mt-4 text-primary hover:underline inline-flex items-center" onClick={() => navigate('/products')}>
          <ArrowLeft size={16} className="mr-1" /> Back to Products
        </button>
      </div>
    );
  }

  const k = view360?.kpis;
  const n = (a?: any[]) => a?.length ?? 0;
  const money = (v?: number | string | null) => formatCurrency(parseFloat(String(v)) || 0);

  const stockQty = parseInt(product.stockQuantity ?? product.stock_quantity ?? 0, 10) || 0;
  const isSerialized = Boolean(product.is_serialized ?? product.isSerialized);
  const unitCost = parseFloat(product.weightedAverageCost ?? product.weighted_average_cost ?? product.purchasePrice ?? product.purchase_price ?? product.costPrice ?? product.cost_price ?? 0) || 0;
  const price = parseFloat(product.price) || 0;
  const marginPct = price > 0 && unitCost > 0 ? ((price - unitCost) / price) * 100 : null;
  const isLowStock = product.lowStockThreshold != null && stockQty <= product.lowStockThreshold;
  const stockStatus = isSerialized
    ? (view360?.piece_counts?.available ?? 0) > 0 ? 'in_stock' : 'out_of_stock'
    : stockQty === 0 ? 'out_of_stock' : isLowStock ? 'low_stock' : 'in_stock';

  const isJewelry = industry === 'jewelry';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'sales', label: `Sales (${k?.sale_count ?? 0})` },
    { id: 'purchases', label: `Purchases (${n(view360?.receipts) + n(view360?.po_items)})` },
    { id: 'movement', label: `Stock Movement (${n(view360?.adjustments) + n(view360?.inventory_logs)})` },
    ...(isSerialized ? [{ id: 'pieces', label: `Pieces (${n(view360?.pieces)})` }] : []),
    ...(n(view360?.returns) ? [{ id: 'returns', label: `Returns (${n(view360?.returns)})` }] : []),
    ...(isJewelry || n(view360?.memos) ? [{ id: 'memos', label: `Memos (${n(view360?.memos)})` }] : []),
    ...(isJewelry || n(view360?.layaways) ? [{ id: 'layaways', label: `Layaways (${n(view360?.layaways)})` }] : []),
  ];

  const movements = [
    ...(view360?.adjustments ?? []).map((a) => ({
      at: a.adjustment_date || a.created_at,
      kind: (a.adjustment_type || 'adjustment').toLowerCase(),
      qty: a.quantity_adjusted,
      before: a.stock_before_adjustment,
      after: a.stock_after_adjustment,
      ref: a.reason_code || '—',
      notes: a.notes,
    })),
    ...(view360?.inventory_logs ?? []).map((l) => ({
      at: l.created_at,
      kind: (l.reference_type || 'log').toLowerCase(),
      qty: l.quantity_change,
      before: l.current_stock_before_change,
      after: l.current_stock_after_change,
      ref: l.reference_id ? `${l.reference_type} ${String(l.reference_id).slice(0, 8)}` : (l.reason || '—'),
      notes: l.reason,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50);

  return (
    <div className="p-4 md:p-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/products')}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Back to products"
          >
            <ArrowLeft size={20} />
          </button>
          {product.imageUrl ? (
            <img
              src={normalizeImageUrl(product.imageUrl) ?? undefined}
              alt={product.name}
              className="w-11 h-11 rounded-lg object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-semibold text-foreground truncate">{product.name}</h1>
              <StatusChip status={product.isActive ? 'active' : 'cancelled'} />
              {isSerialized && <StatusChip status="hold" />}
              <StatusChip status={stockStatus} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap mt-0.5">
              {product.sku && <span>SKU {product.sku}</span>}
              {product.barcode && <span>· {product.barcode}</span>}
              {product.categoryName && <span>· {product.categoryName}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdjustOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium"
          >
            <SlidersHorizontal size={16} /> Adjust Stock
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-sm"
          >
            <Pencil size={15} /> Edit
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="More options"
            >
              <MoreHorizontal size={20} />
            </button>
            {showMoreOptions && (
              <div className="absolute right-0 mt-2 w-44 bg-card rounded-lg shadow-lg z-20 border border-border py-1">
                <button
                  onClick={() => { setShowMoreOptions(false); setShowDeleteConfirm(true); }}
                  className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted inline-flex items-center gap-2"
                >
                  <Trash2 size={15} /> Delete product
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title={isSerialized ? 'Pieces Available' : 'In Stock'}
          value={isSerialized ? (view360?.piece_counts?.available ?? 0) : stockQty}
          icon={<Boxes />}
          footerText={
            isSerialized
              ? `${n(view360?.pieces)} piece${n(view360?.pieces) === 1 ? '' : 's'} tracked`
              : isLowStock ? `Low — threshold ${product.lowStockThreshold}` : `Threshold ${product.lowStockThreshold ?? '—'}`
          }
          iconBgClass="bg-blue-100"
          iconClass="text-blue-600"
          footerBgClass={isLowStock && !isSerialized ? 'bg-amber-50' : 'bg-blue-50'}
          footerTextClass={isLowStock && !isSerialized ? 'text-amber-700' : 'text-blue-700'}
        />
        <MetricCard
          title="Units Sold"
          value={k?.units_sold ?? 0}
          icon={<TrendingUp />}
          footerText={`${k?.sale_count ?? 0} sale${k?.sale_count === 1 ? '' : 's'} · ${money(k?.revenue)} revenue`}
          iconBgClass="bg-emerald-100"
          iconClass="text-emerald-600"
          footerBgClass="bg-emerald-50"
          footerTextClass="text-emerald-700"
        />
        <MetricCard
          title="Stock Value"
          value={money(stockQty * unitCost)}
          icon={<DollarSign />}
          footerText={unitCost > 0 ? `Avg cost ${money(unitCost)}${marginPct != null ? ` · margin ${marginPct.toFixed(1)}%` : ''}` : 'No cost on file'}
          iconBgClass="bg-purple-100"
          iconClass="text-purple-600"
          footerBgClass="bg-purple-50"
          footerTextClass="text-purple-700"
        />
        <MetricCard
          title="Last Sold"
          value={k?.last_sold_at ? formatDate(k.last_sold_at) : '—'}
          icon={<Clock />}
          footerText={`${k?.open_po_qty ?? 0} on order · ${k?.on_memo_qty ?? 0} on memo`}
          iconBgClass="bg-amber-100"
          iconClass="text-amber-600"
          footerBgClass="bg-amber-50"
          footerTextClass="text-amber-700"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-4 overflow-x-auto">
        <nav className="flex gap-5 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {activeTab === 'overview' && (
          <div className="divide-y divide-border">
            {/* Pricing */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">PRICING &amp; STOCK</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <DetailRow label="Selling price" value={money(price)} />
                <DetailRow label="Purchase price" value={product.purchasePrice != null ? money(product.purchasePrice) : undefined} />
                <DetailRow label="Cost price" value={product.costPrice != null ? money(product.costPrice) : undefined} />
                <DetailRow label="Weighted avg cost" value={(product.weightedAverageCost ?? product.weighted_average_cost) != null ? money(product.weightedAverageCost ?? product.weighted_average_cost) : undefined} />
                <DetailRow label="Margin" value={marginPct != null ? `${marginPct.toFixed(1)}%` : undefined} />
                <DetailRow label="Markup" value={product.markupPct != null ? `${product.markupPct}%` : undefined} />
                <DetailRow label="Handling cost" value={product.handlingCostPct != null ? `${product.handlingCostPct}%` : undefined} />
                <DetailRow label="Cost code" value={product.costCode ?? product.cost_code} />
                <DetailRow label="In stock" value={isSerialized ? 'Serialized' : String(stockQty)} />
                <DetailRow label="Low-stock threshold" value={product.lowStockThreshold ?? product.low_stock_threshold} />
                <DetailRow label="Total received" value={product.totalQuantityReceived ?? product.total_quantity_received} />
                <DetailRow label="Last received" value={(product.lastReceivedDate ?? product.last_received_date) ? formatDate(product.lastReceivedDate ?? product.last_received_date) : undefined} />
              </div>
            </div>

            {/* Jewelry attributes */}
            {(product.purity || product.hsnCode || product.hsn_code || product.defaultGrossWeight || product.default_gross_weight || product.defaultMakingChargeType || product.default_making_charge_type || isJewelry) && (
              <div className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">JEWELRY ATTRIBUTES</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <DetailRow label="Purity" value={product.purity} />
                  <DetailRow label="HSN code" value={product.hsnCode ?? product.hsn_code} />
                  <DetailRow label="Gross weight" value={(product.defaultGrossWeight ?? product.default_gross_weight) != null ? `${product.defaultGrossWeight ?? product.default_gross_weight} g` : undefined} />
                  <DetailRow label="Net weight" value={(product.defaultNetWeight ?? product.default_net_weight) != null ? `${product.defaultNetWeight ?? product.default_net_weight} g` : undefined} />
                  <DetailRow label="Making charge" value={
                    (product.defaultMakingChargeValue ?? product.default_making_charge_value) != null
                      ? `${product.defaultMakingChargeValue ?? product.default_making_charge_value}${(product.defaultMakingChargeType ?? product.default_making_charge_type) === 'percentage' ? '%' : ''}`
                      : undefined
                  } />
                  <DetailRow label="Wastage" value={(product.defaultWastagePct ?? product.default_wastage_pct) != null ? `${product.defaultWastagePct ?? product.default_wastage_pct}%` : undefined} />
                </div>
              </div>
            )}

            {/* Details */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">DETAILS</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <DetailRow label="SKU" value={product.sku} />
                <DetailRow label="Barcode" value={product.barcode} />
                <DetailRow label="Category" value={product.categoryName} />
                <DetailRow label="Tax class" value={product.taxClassName} />
                <DetailRow label="Unit" value={product.unitOfMeasure ?? product.unit_of_measure} />
                <DetailRow label="Brand" value={product.brand} />
                <DetailRow label="Item discount" value={
                  product.specificDiscountValue != null
                    ? product.specificDiscountType === 'percentage'
                      ? `${product.specificDiscountValue}%`
                      : money(product.specificDiscountValue)
                    : undefined
                } />
                <DetailRow label="Promotion" value={product.promotionalOfferName} />
                <DetailRow label="Created" value={product.createdAt ? formatDate(product.createdAt) : undefined} />
              </div>
              {product.description && (
                <div className="mt-4">
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Description</h4>
                  <p className="text-sm text-foreground whitespace-pre-line">{product.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <MiniTable
            headers={['Document', 'Date', 'Qty', 'Status', 'Line total']}
            empty="No sales recorded for this product yet."
            rows={(view360?.sales ?? []).map((s) => [
              <span className="font-medium">{s.document_number || String(s.id).slice(0, 8)}</span>,
              formatDateTime(s.created_at),
              `${s.quantity} × ${money(s.final_unit_price)}`,
              <StatusChip status={s.sale_status} />,
              money((parseFloat(s.quantity) || 0) * (parseFloat(s.final_unit_price) || 0)),
            ])}
          />
        )}

        {activeTab === 'purchases' && (
          <div className="divide-y divide-border">
            <div>
              <h3 className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goods received</h3>
              <MiniTable
                headers={['GRN', 'Received', 'Qty', 'Status', 'Unit cost']}
                empty="No goods received for this product."
                rows={(view360?.receipts ?? []).map((g) => [
                  <span className="font-medium">{g.grn_number}</span>,
                  g.received_date ? formatDate(g.received_date) : '—',
                  g.quantity_received,
                  <StatusChip status={g.status} />,
                  money(g.unit_cost_price),
                ])}
              />
            </div>
            <div>
              <h3 className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purchase orders</h3>
              <MiniTable
                headers={['PO', 'Ordered', 'Received', 'Status', 'Unit cost']}
                empty="No purchase orders for this product."
                rows={(view360?.po_items ?? []).map((p) => [
                  <span className="font-medium">{p.purchase_order_number}</span>,
                  p.order_date ? formatDate(p.order_date) : '—',
                  `${p.quantity_received ?? 0} / ${p.quantity_ordered}`,
                  <StatusChip status={p.status} />,
                  money(p.cost_price),
                ])}
              />
            </div>
          </div>
        )}

        {activeTab === 'movement' && (
          <MiniTable
            headers={['Date', 'Type', 'Qty', 'Before → After', 'Reason', 'Notes']}
            empty="No stock movement recorded for this product."
            rows={movements.map((m) => [
              m.at ? formatDateTime(m.at) : '—',
              <span className="capitalize">{m.kind}</span>,
              <span className={parseFloat(m.qty) < 0 ? 'text-rose-600' : 'text-emerald-600'}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>,
              `${m.before ?? '—'} → ${m.after ?? '—'}`,
              m.ref,
              <span className="max-w-[220px] truncate inline-block align-middle" title={m.notes || ''}>{m.notes || '—'}</span>,
            ])}
          />
        )}

        {activeTab === 'pieces' && (
          <MiniTable
            headers={['Piece', 'Barcode', 'Gross g', 'Net g', 'Purity', 'Status', 'Sell price']}
            empty="No serialized pieces for this product."
            rows={(view360?.pieces ?? []).map((p) => [
              <span className="font-medium">{p.piece_code}</span>,
              p.barcode || '—',
              p.gross_weight ?? '—',
              p.net_weight ?? '—',
              p.purity || '—',
              <StatusChip status={p.status} />,
              money(p.selling_price),
            ])}
          />
        )}

        {activeTab === 'returns' && (
          <MiniTable
            headers={['Return #', 'Date', 'Qty', 'Status', 'Amount']}
            empty="No returns for this product."
            rows={(view360?.returns ?? []).map((r) => [
              <span className="font-medium">{r.return_number}</span>,
              formatDate(r.return_date || r.created_at),
              r.quantity_returned,
              <StatusChip status={r.status} />,
              money(r.total_amount),
            ])}
          />
        )}

        {activeTab === 'memos' && (
          <MiniTable
            headers={['Memo #', 'Issued', 'Due', 'Qty out', 'Status', 'Unit value']}
            empty="No memo transactions for this product."
            rows={(view360?.memos ?? []).map((m) => [
              <span className="font-medium">{m.memo_no}</span>,
              m.issue_date ? formatDate(m.issue_date) : '—',
              m.due_date ? formatDate(m.due_date) : '—',
              `${m.quantity - (m.returned_quantity ?? 0)} / ${m.quantity}`,
              <StatusChip status={m.status} />,
              money(m.unit_value),
            ])}
          />
        )}

        {activeTab === 'layaways' && (
          <MiniTable
            headers={['Plan', 'Created', 'Due', 'Qty', 'Status', 'Unit price']}
            empty="No layaway plans include this product."
            rows={(view360?.layaways ?? []).map((l) => [
              <span className="font-medium">{l.plan_no}</span>,
              l.created_at ? formatDate(l.created_at) : '—',
              l.due_date ? formatDate(l.due_date) : '—',
              l.quantity,
              <StatusChip status={l.status} />,
              money(l.unit_price),
            ])}
          />
        )}
      </div>

      {/* Modals */}
      {isEditModalOpen && (
        <ProductFormModal
          isOpen={isEditModalOpen}
          product={product}
          categories={categories}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(productData, imageFile) => handleSaveProduct(productData, imageFile)}
          onRefreshCategories={() => {
            getCategories('active').then((cats) => setCategories(Array.isArray(cats) ? cats : [])).catch(() => {});
          }}
        />
      )}

      {isAdjustOpen && (
        <StockAdjustmentModal
          isOpen={isAdjustOpen}
          onClose={() => setIsAdjustOpen(false)}
          productToAdjust={product}
          onAdjustmentSuccess={() => { setIsAdjustOpen(false); load(); }}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }}
        title="Delete product?"
        description={`Are you sure you want to delete ${product.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteProduct}
      />
    </div>
  );
};

export default ProductDetailsPage;
