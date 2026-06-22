'use client';

import { useState } from 'react';
import { X, Undo2, AlertCircle } from 'lucide-react';
import { removeOrderItemAndIssueCredit } from '@/app/admin/orders/actions';

interface EditOrderModalProps {
  order: any;
  onClose: () => void;
}

export default function EditOrderModal({ order, onClose }: EditOrderModalProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      
      // Close modal to force a refresh of the order row
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to remove item');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold">Edit Order Items</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Order ID: {order.id.substring(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex gap-3 text-amber-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold mb-1">Store Credit Refunds Only</p>
              <p>Removing an item will automatically deposit the exact cash value into the parent's Store Credit balance for future use. You cannot add new items here; parents must place new orders themselves.</p>
            </div>
          </div>

          <h3 className="font-semibold mb-3">Order Items</h3>
          
          {order.order_items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border rounded-xl border-dashed">No items remaining in this order.</p>
          ) : (
            <div className="space-y-3">
              {order.order_items.map((item: any) => {
                const isProcessing = processingId === item.id;
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-xl bg-background">
                    <div>
                      <p className="font-bold text-sm">{item.quantity}x {item.dishes?.name || 'Unknown Dish'}</p>
                      <p className="text-xs text-muted-foreground">Unit: ${(Number(item.unit_price)).toFixed(2)} | Total: ${(Number(item.total_price)).toFixed(2)}</p>
                    </div>
                    
                    <button
                      onClick={() => handleRemove(item.id, item.dishes?.name || 'Unknown', item.quantity, Number(item.unit_price))}
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

        <div className="px-6 py-4 border-t bg-muted/30 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
