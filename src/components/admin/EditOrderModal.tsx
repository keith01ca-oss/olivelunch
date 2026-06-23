'use client';

import { useState, useMemo } from 'react';
import { X, Undo2, AlertCircle, Plus, Loader2, Trash2 } from 'lucide-react';
import { removeOrderItemAndIssueCredit, addItemToOrderAdmin } from '@/app/admin/orders/actions';

interface EditOrderModalProps {
  order: any;
  dishes?: any[];
  onClose: () => void;
}

export default function EditOrderModal({ order, dishes = [], onClose }: EditOrderModalProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [addDishId, setAddDishId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addIsLarge, setAddIsLarge] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const isVip = order.parents?.is_vip || false;

  const selectedDish = useMemo(() => dishes.find(d => d.id === addDishId), [addDishId, dishes]);

  const handleRemove = async (itemId: string, dishName: string, quantity: number, unitPrice: number) => {
    const refundAmount = (quantity * unitPrice).toFixed(2);
    if (!confirm(`Are you sure you want to remove ${quantity}x ${dishName}?\n\nThis will issue a $${refundAmount} store credit to the parent.`)) {
      return;
    }

    setProcessingId(itemId);
    try {
      const res = await removeOrderItemAndIssueCredit(order.id, itemId, quantity);
      if (res.error) throw new Error(res.error);
      alert(`Success! Removed item and issued $${res.refundAmount?.toFixed(2)} in Store Credit.`);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to remove item');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddDish = async () => {
    if (!addDishId || addQty < 1) return;
    const dish = dishes.find(d => d.id === addDishId);
    if (!dish) return;

    const isLarge = addIsLarge && dish.has_large;
    const unitPrice = isLarge
      ? (isVip ? (dish.large_price_vip ?? dish.price_vip) : (dish.large_price_regular ?? dish.price_regular))
      : (isVip ? dish.price_vip : dish.price_regular);

    setIsAdding(true);
    try {
      const res = await addItemToOrderAdmin(order.id, {
        dish_id: dish.id,
        quantity: addQty,
        unit_price: unitPrice,
        total_price: unitPrice * addQty,
        is_large: isLarge,
      });
      if (res.error) throw new Error(res.error);
      alert(`Added ${addQty}x ${isLarge && dish.large_name ? dish.large_name : dish.name} to the order.`);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to add item');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold">Edit Order Items</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Order ID: {order.id.substring(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Existing items — remove/refund */}
          <div>
            <h3 className="font-semibold mb-3">Current Order Items</h3>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 flex gap-3 text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs">Removing an item issues a Store Credit refund to the parent.</p>
            </div>

            {order.order_items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 border rounded-xl border-dashed">No items remaining.</p>
            ) : (
              <div className="space-y-2">
                {order.order_items.map((item: any) => {
                  const displayName = (item.is_large && item.dishes?.large_name) ? item.dishes.large_name : (item.dishes?.name || 'Unknown');
                  const isProcessing = processingId === item.id;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-xl bg-background">
                      <div>
                        <p className="font-bold text-sm">
                          {item.quantity}x {displayName}
                          {item.is_large && <span className="ml-1.5 text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">Large</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">Unit: ${Number(item.unit_price).toFixed(2)} · Total: ${Number(item.total_price).toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => handleRemove(item.id, displayName, item.quantity, Number(item.unit_price))}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        {isProcessing ? 'Processing...' : 'Refund & Remove'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add new dish to existing order */}
          {dishes.length > 0 && (
            <div className="border-t pt-5">
              <h3 className="font-semibold mb-3">Add Dish to Order</h3>
              <div className="space-y-3">
                <select
                  value={addDishId}
                  onChange={e => { setAddDishId(e.target.value); setAddIsLarge(false); }}
                  className="w-full h-10 rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary bg-background outline-none"
                >
                  <option value="">Select a dish...</option>
                  {dishes.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} (${(isVip ? d.price_vip : d.price_regular).toFixed(2)})
                    </option>
                  ))}
                </select>

                {selectedDish?.has_large && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-semibold">Size:</span>
                    <div className="flex bg-muted p-0.5 rounded-lg text-xs font-bold">
                      <button
                        onClick={() => setAddIsLarge(false)}
                        className={`px-3 py-1 rounded transition-all ${!addIsLarge ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Regular — ${(isVip ? selectedDish.price_vip : selectedDish.price_regular).toFixed(2)}
                      </button>
                      <button
                        onClick={() => setAddIsLarge(true)}
                        className={`px-3 py-1 rounded transition-all ${addIsLarge ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {selectedDish.large_name || 'Large'} — ${(isVip ? (selectedDish.large_price_vip ?? selectedDish.price_vip) : (selectedDish.large_price_regular ?? selectedDish.price_regular)).toFixed(2)}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-muted-foreground">Qty:</label>
                    <input
                      type="number" min="1" max="99"
                      value={addQty}
                      onChange={e => setAddQty(parseInt(e.target.value) || 1)}
                      className="w-16 h-10 text-center rounded-lg border focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddDish}
                    disabled={!addDishId || isAdding}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add to Order
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-muted/30 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
