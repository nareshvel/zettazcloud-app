import React, { useState, useEffect } from 'react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PurchaseOrder } from '@/types';
import * as purchaseOrderService from '@/services/purchaseOrderService';

// Extended interface for PO items with draft GRN information
// Supports both snake_case (from direct backend) and camelCase (from API conversion)
interface EnhancedPurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantityOrdered: number;
  quantityReceived: number;
  costPrice: number;
  // Snake case from direct backend access
  available_quantity?: number;
  quantity_in_draft_grns?: number;
  is_in_draft_grns?: boolean;
  actual_available_quantity?: number;
  // Camel case from API conversion
  availableQuantity?: number;
  quantityInDraftGrns?: number;
  isInDraftGrns?: boolean;
  actualAvailableQuantity?: number;
}

interface SupplierOption {
  id: string;
  supplierName: string;
}

interface SelectPoItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: SupplierOption | null | undefined;
  purchaseOrders: PurchaseOrder[]; 
  onConfirmItems: (selectedItems: GrnItemData[]) => void; 
  existingGrnItems?: GrnItemData[]; // New prop for items already on GRN
}

export interface GrnItemData {
  purchase_order_item_id?: string; // Link to PO item if applicable
  purchase_order_id?: string;     // Parent PO ID for linking
  product_id: string;
  product_name?: string; // Added for display on GRN
  product_sku?: string; // Added for display on GRN
  quantity_received: number;
  unit_cost_price: number;
  tax_rate?: number; // Made optional, as it might be set at GRN level
  po_number?: string;
  quantity_pending?: number; // Remaining qty on PO line after this GRN item
}

interface ItemSelection {
  [key: string]: {
    isSelected: boolean;
    quantityToReceive: number;
    product_id: string;
    unit_cost_price: number;
    product_name: string;
    product_sku: string;
    po_number: string;
    purchase_order_item_id: string;
    maxReceivableQty: number;
    originalQuantityPending: number;
  }
}

const SelectPoItemsModal: React.FC<SelectPoItemsModalProps> = ({
  isOpen,
  onClose,
  supplier,
  purchaseOrders,
  onConfirmItems,
  existingGrnItems,
}) => {
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [currentPoItems, setCurrentPoItems] = useState<EnhancedPurchaseOrderItem[]>([]);
  const [itemSelectionState, setItemSelectionState] = useState<ItemSelection>({});

  // Log purchaseOrders prop when it changes (or on initial render with supplier)
  useEffect(() => {
    console.log("[SelectPoItemsModal] Received purchaseOrders prop:", purchaseOrders);
  }, [purchaseOrders]);

  // Effect to initialize or update itemSelectionState when selectedPo or its items change,
  // or when existingGrnItems change (e.g., user confirms items and modal re-evaluates)
  useEffect(() => {
    console.log('[SelectPoItemsModal] Initializing/updating itemSelectionState. Selected PO:', selectedPo, 'Items from PO:', currentPoItems, 'Existing GRN Items:', existingGrnItems);
    if (!selectedPo) { // Simplified condition: if no PO selected, clear state
      setItemSelectionState({});
      return;
    }

    const newSelectionState: ItemSelection = {};
    currentPoItems.forEach(item => {
      const poItemId = item.id; // This is the purchase_order_item_id
      const existingGrnItem = existingGrnItems?.find(
        grnItem => grnItem.purchase_order_item_id === poItemId
      );

      // Use the enhanced data from backend
      const quantityAlreadyReceivedOnPreviousGrns = item.quantityReceived || 0; // Already on *other* GRNs
      const quantityOrdered = item.quantityOrdered;
      const quantityInDraftGrns = item.quantity_in_draft_grns || 0;
      const isInDraftGrns = Boolean(item.is_in_draft_grns);
      
      // Use available_quantity directly from backend when available
      const quantityPending = item.available_quantity !== undefined ? 
        parseFloat(String(item.available_quantity)) : 
        Math.max(0, quantityOrdered - quantityAlreadyReceivedOnPreviousGrns);
      
      console.log(`[SelectPoItemsModal] Item ${item.productName}: ordered=${quantityOrdered}, received=${quantityAlreadyReceivedOnPreviousGrns}, pending=${quantityPending}, in draft GRNs=${quantityInDraftGrns}, is in draft=${isInDraftGrns}`);

      if (existingGrnItem) {
        // Item is already on the current GRN being built
        newSelectionState[poItemId] = {
          isSelected: true,
          quantityToReceive: existingGrnItem.quantity_received, // Use quantity from current GRN
          product_id: item.productId,
          unit_cost_price: item.costPrice, // or existingGrnItem.unit_cost_price if it can change
          product_name: item.productName || '',
          product_sku: item.productSku || '',
          po_number: selectedPo.purchaseOrderNumber || '', // Handle potential undefined
          purchase_order_item_id: poItemId,
          maxReceivableQty: quantityPending + existingGrnItem.quantity_received, // Max is what's pending + what's already on this GRN
          originalQuantityPending: quantityPending
        };
      } else {
        // Item is not on the current GRN being built
        newSelectionState[poItemId] = {
          isSelected: false,
          quantityToReceive: 0, // Default to 0 if not on GRN, or Math.min(sensibleDefault, quantityPending) ?
          product_id: item.productId,
          unit_cost_price: item.costPrice,
          product_name: item.productName || '',
          product_sku: item.productSku || '',
          po_number: selectedPo.purchaseOrderNumber || '', // Handle potential undefined
          purchase_order_item_id: poItemId,
          maxReceivableQty: quantityPending, // Max is what's pending from PO
          originalQuantityPending: quantityPending
        };
      }
    });
    setItemSelectionState(newSelectionState);
    console.log('[SelectPoItemsModal] New itemSelectionState:', newSelectionState);
  }, [selectedPo, existingGrnItems, currentPoItems]); // Removed itemsFromSelectedPo from dependencies, selectedPo.items is implicitly handled by selectedPo

  const handleConfirm = () => {
    if (!selectedPo) return;
    const confirmedGrnItems: GrnItemData[] = []; 
    Object.keys(itemSelectionState).forEach(itemId => {
      const state = itemSelectionState[itemId];
      const qtyToReceive = state.quantityToReceive;

      if (state.isSelected && qtyToReceive > 0) {
        const itemDetails = currentPoItems.find(poItem => poItem.id === itemId); // Find original item details from selectedPo.items
        if (itemDetails) {
          confirmedGrnItems.push({
            product_id: state.product_id,
            product_name: state.product_name,
            product_sku: state.product_sku,
            quantity_received: qtyToReceive,
            unit_cost_price: state.unit_cost_price,
            tax_rate: 0, // Default to 0, as tax_rate is not on PurchaseOrderItem and applied at GRN level
            purchase_order_item_id: state.purchase_order_item_id,
            po_number: state.po_number,
            quantity_pending: state.originalQuantityPending - qtyToReceive, // Update pending based on what's received now
          });
        }
      }
    });
    onConfirmItems(confirmedGrnItems);
    onClose();
  };

  const handlePoChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const poId = e.target.value;
    // Find the PO in our data structure
    const po = purchaseOrders.find(po => po.id === poId);
    if (po) {
      setSelectedPo(po);
      
      try {
        // Fetch detailed PO with items from API
        console.log('[SelectPoItemsModal] Fetching PO items for PO:', poId);
        const detailedPo = await purchaseOrderService.getPurchaseOrderById(poId);
        console.log('[SelectPoItemsModal] Fetched PO items:', detailedPo.items?.length || 0);
        
        // Update the item list - cast to EnhancedPurchaseOrderItem to support new fields
        setCurrentPoItems(detailedPo.items as EnhancedPurchaseOrderItem[] || []);
      } catch (error) {
        console.error('[SelectPoItemsModal] Error fetching PO items:', error);
        setCurrentPoItems([]);
      }
    } else {
      setSelectedPo(null);
      setCurrentPoItems([]);
    }
  };

  const handleCheckboxChange = (itemId: string, checked: boolean) => {
    setItemSelectionState(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], isSelected: checked }
    }));
  };

  // Early return if the modal shouldn't be open or no supplier is provided
  if (!isOpen || !supplier) {
    return null;
  }

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={`Select Items from Purchase Orders for ${supplier.supplierName}`}
      size="6xl" 
      footerContent={
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Add Selected Items to GRN</Button>
        </div>
      }
    >
      <div className="p-4 min-h-[60vh] flex space-x-4"> 
        {/* Left Panel: Purchase Orders List */}
        <div className="w-1/3 border-r pr-4 custom-scrollbar overflow-y-auto">
          <h3 className="text-md font-semibold mb-2">Purchase Orders for {supplier.supplierName}</h3>
          {(() => {
            // Ensure unique POs by ID before rendering
            const uniquePurchaseOrders = Array.from(new Map(purchaseOrders.map(po => [po.id, po])).values());

            if (uniquePurchaseOrders.length === 0) {
              return <p className="text-sm text-gray-500 dark:text-muted-foreground">No open purchase orders found.</p>;
            }
            return (
              <div className="mt-2 space-y-3">
                {purchaseOrders.map(po => {
                  const hasDraftItems = po.items?.some((item: any) => 
                    item.is_in_draft_grns || parseFloat(String(item.quantity_in_draft_grns || 0)) > 0
                  );
                  const formattedDate = new Date(po.order_date || Date.now()).toLocaleDateString();
                  const isSelected = selectedPo?.id === po.id;
                  
                  // Calculate stats for this PO
                  // Use itemCount from backend response (camelCase after conversion) instead of po.items.length
                  const totalItems = (po as any).itemCount || po.items?.length || 0;
                  const itemsInDraft = po.items?.filter((item: any) => 
                    item.is_in_draft_grns || parseFloat(String(item.quantity_in_draft_grns || 0)) > 0
                  ).length || 0;
                  
                  return (
                    <div 
                      key={po.id}
                      onClick={() => handlePoChange({ target: { value: po.id } } as any)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 
                        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 dark:border-border hover:border-blue-300'}
                        ${hasDraftItems ? 'border-l-4 border-l-yellow-400' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">{po.purchase_order_number}</div>
                        <div className="text-xs text-gray-500 dark:text-muted-foreground">{formattedDate}</div>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-muted-foreground mb-2 truncate">
                        {totalItems} items - {po.supplier_name}
                      </div>
                      
                      {hasDraftItems && (
                        <div className="flex items-center mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            {itemsInDraft} {itemsInDraft === 1 ? 'item' : 'items'} in draft GRNs
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Right Panel: Items from Selected PO */}
        <div className="w-2/3 pl-4">
          {selectedPo ? (
            <div className="flex flex-col h-full">
              <h3 className="text-md font-semibold mb-2 shrink-0">Items for PO: {selectedPo.purchaseOrderNumber}</h3>
              {currentPoItems.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-muted-foreground flex-grow flex items-center justify-center">No items found in this PO.</p>
              ) : (
                <div className="overflow-y-auto custom-scrollbar flex-grow">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          {/* TODO: Select All Checkbox */}
                        </TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">In Draft GRNs</TableHead>
                        <TableHead className="w-[120px] text-right">Qty to Receive</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentPoItems.map((item) => {
                        const stateForItem = itemSelectionState[item.id] || { isSelected: false, quantityToReceive: 0, originalQuantityPending: 0, maxReceivableQty: 0, product_id: '', unit_cost_price: 0, product_name: '', product_sku: '', po_number: '', purchase_order_item_id: '' };
                        
                        // Use enhanced data from backend - using camelCase as API converts snake_case to camelCase
                        const quantityAlreadyReceived = item.quantityReceived || 0;
                        // Use camelCase properties from API conversion (or fallback to snake_case for compatibility)
                        const quantityInDraftGrns = parseFloat(String(item.quantityInDraftGrns || item.quantity_in_draft_grns || 0));
                        const isInDraftGrns = Boolean(item.isInDraftGrns || item.is_in_draft_grns);
                        
                        // Use availableQuantity from backend if available, otherwise calculate
                        const poItemQuantityPending = item.availableQuantity !== undefined ? 
                          parseFloat(String(item.availableQuantity)) : 
                          item.available_quantity !== undefined ?
                          parseFloat(String(item.available_quantity)) :
                          (item.quantityOrdered || 0) - quantityAlreadyReceived;
                        
                        // Row background: yellow for draft GRNs, blue for selected, grey for unavailable
                        const rowClass = poItemQuantityPending <= 0 ? 'opacity-50 cursor-not-allowed' : 
                                        (stateForItem.isSelected ? 'bg-indigo-50' : 
                                        (isInDraftGrns ? 'bg-yellow-50' : ''));

                        return (
                          <TableRow key={item.id} className={rowClass}>
                            <TableCell>
                              {poItemQuantityPending > 0 && (
                                <Checkbox
                                  checked={stateForItem.isSelected}
                                  onCheckedChange={(checked: boolean) => { 
                                    handleCheckboxChange(item.id, checked);
                                  }}
                                  aria-label={`Select item ${item.productName}`}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.productName}</div>
                              {item.productSku && <div className="text-xs text-gray-500 dark:text-muted-foreground">SKU: {item.productSku}</div>}
                              {isInDraftGrns && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    In Draft GRN
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{item.quantityOrdered || 0}</TableCell>
                            <TableCell className="text-right">{quantityAlreadyReceived}</TableCell>
                            <TableCell className="text-right">{poItemQuantityPending > 0 ? poItemQuantityPending : 0}</TableCell>
                            <TableCell className="text-right">
                              {quantityInDraftGrns > 0 ? (
                                <span className="font-medium text-yellow-600">{quantityInDraftGrns}</span>
                              ) : (
                                '0'
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {poItemQuantityPending > 0 && (
                                <Input
                                  type="number"
                                  value={stateForItem.quantityToReceive.toString()}
                                  onChange={(e) => {
                                    const rawValue = e.target.value;
                                    let newVal = parseInt(rawValue, 10);

                                    if (isNaN(newVal)) {
                                      newVal = 0; // Default to 0 if parsing fails or input is empty
                                    } else if (newVal < 0) {
                                      newVal = 0; // Ensure it's not negative (though min attribute should handle this)
                                    } else if (newVal > stateForItem.maxReceivableQty) {
                                      newVal = stateForItem.maxReceivableQty; // Ensure it doesn't exceed max
                                    }

                                    setItemSelectionState(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], quantityToReceive: newVal }
                                    }));
                                  }}
                                  className={`w-full text-right`}
                                  min="0"
                                  max={stateForItem.maxReceivableQty}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-muted-foreground">Select a Purchase Order from the list to view items.</p>
            </div>
          )}
        </div>
      </div>
    </ModalBase>
  );
};

export default SelectPoItemsModal;
