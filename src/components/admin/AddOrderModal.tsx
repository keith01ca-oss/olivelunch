'use client';

import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { createOrderAdmin } from '@/app/admin/orders/actions';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface AddOrderModalProps {
  orgId: string;
  dishes: any[];
  childrenList: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddOrderModal({ orgId, dishes, childrenList, onClose, onSuccess }: AddOrderModalProps) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [childSearch, setChildSearch] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  
  const [selectedItems, setSelectedItems] = useState<{ dishId: string, quantity: number, is_large: boolean }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredChildren = useMemo(() => {
    if (!childSearch) return childrenList.slice(0, 50); // limit to 50 for performance if empty
    const lower = childSearch.toLowerCase();
    return childrenList.filter(c => 
      c.name.toLowerCase().includes(lower) || 
      c.parents?.name?.toLowerCase().includes(lower) ||
      c.schools?.name?.toLowerCase().includes(lower)
    ).slice(0, 50);
  }, [childrenList, childSearch]);

  const selectedChild = childrenList.find(c => c.id === selectedChildId);
  const isVip = selectedChild?.parents?.is_vip || false;

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { dishId: '', quantity: 1, is_large: false }]);
  };

  const handleRemoveItem = (index: number) => {
    const next = [...selectedItems];
    next.splice(index, 1);
    setSelectedItems(next);
  };

  const updateItem = (index: number, field: 'dishId' | 'quantity' | 'is_large', value: any) => {
    const next = [...selectedItems];
    // When dish changes, reset is_large
    if (field === 'dishId') {
      next[index] = { ...next[index], dishId: value, is_large: false };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setSelectedItems(next);
  };

  const totals = useMemo(() => {
    let gross = 0;
    let total = 0;
    
    selectedItems.forEach(item => {
      if (!item.dishId) return;
      const dish = dishes.find(d => d.id === item.dishId);
      if (!dish) return;
      
      const isLarge = item.is_large && dish.has_large;
      const price = isLarge
        ? (isVip ? (dish.large_price_vip ?? dish.price_vip) : (dish.large_price_regular ?? dish.price_regular))
        : (isVip ? dish.price_vip : dish.price_regular);
      gross += price * item.quantity;
      total += price * item.quantity;
    });

    return { gross, total };
  }, [selectedItems, dishes, isVip]);

  const handleSubmit = async () => {
    if (!selectedChild) {
      toast.error('Please select a student');
      return;
    }
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }
    const validItems = selectedItems.filter(i => i.dishId && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadItems = validItems.map(item => {
        const dish = dishes.find(d => d.id === item.dishId)!;
        const isLarge = item.is_large && dish.has_large;
        const unitPrice = isLarge
          ? (isVip ? (dish.large_price_vip ?? dish.price_vip) : (dish.large_price_regular ?? dish.price_regular))
          : (isVip ? dish.price_vip : dish.price_regular);
        return {
          dish_id: dish.id,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: unitPrice * item.quantity,
          is_large: isLarge
        };
      });

      const res = await createOrderAdmin({
        org_id: orgId,
        parent_id: selectedChild.parent_id,
        child_id: selectedChild.id,
        order_date: selectedDate,
        gross_amount: totals.gross,
        total_amount: totals.total,
        items: payloadItems
      });

      if (res.error) throw new Error(res.error);
      
      toast.success('Order created successfully!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-xl font-extrabold">Add New Order</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create a paid order directly on behalf of a parent.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Order Date</label>
              <input 
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full h-11 rounded-xl border px-3 text-sm focus:ring-2 focus:ring-primary outline-none bg-background shadow-sm"
              />
            </div>
            
            <div className="space-y-1.5 relative">
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Student / Child</label>
              {!selectedChild ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    placeholder="Search by student or parent name..."
                    value={childSearch}
                    onChange={e => setChildSearch(e.target.value)}
                    className="w-full h-11 pl-9 pr-3 rounded-xl border border-primary/50 px-3 text-sm focus:ring-2 focus:ring-primary outline-none bg-primary/5 shadow-sm"
                  />
                  {childSearch && (
                    <div className="absolute top-12 left-0 right-0 bg-card border rounded-xl shadow-xl max-h-60 overflow-y-auto z-10">
                      {filteredChildren.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">No students found</div>
                      ) : (
                        filteredChildren.map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => { setSelectedChildId(c.id); setChildSearch(''); }}
                            className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                          >
                            <p className="font-bold text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.schools?.name} • Parent: {c.parents?.name}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between h-11 px-3 border border-primary bg-primary/5 rounded-xl shadow-sm">
                  <div>
                    <p className="font-bold text-sm leading-tight text-primary">{selectedChild.name}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase leading-tight">Parent: {selectedChild.parents?.name} {isVip && <span className="text-amber-500">(VIP)</span>}</p>
                  </div>
                  <button onClick={() => setSelectedChildId('')} className="text-muted-foreground hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Order Items</h3>
              <button 
                onClick={handleAddItem}
                className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90"
              >
                <Plus className="w-3.5 h-3.5" /> Add Dish
              </button>
            </div>

            {selectedItems.length === 0 ? (
              <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
                <p className="font-medium text-sm">No items added to this order yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedItems.map((item, index) => {
                  const dish = dishes.find(d => d.id === item.dishId);
                  const unitPrice = dish ? (isVip ? dish.price_vip : dish.price_regular) : 0;
                  const itemTotal = unitPrice * item.quantity;

                  return (
                    <div key={index} className="flex flex-col gap-3 bg-muted/20 p-3 rounded-xl border">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <select
                          value={item.dishId}
                          onChange={e => updateItem(index, 'dishId', e.target.value)}
                          className="flex-1 h-10 w-full sm:w-auto rounded-lg border px-3 text-sm focus:ring-1 focus:ring-primary bg-background shadow-sm font-medium"
                        >
                          <option value="">Select a dish...</option>
                          {dishes.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name} (${(isVip ? d.price_vip : d.price_regular).toFixed(2)})
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-muted-foreground">Qty:</label>
                            <input 
                              type="number" min="1" max="99"
                              value={item.quantity}
                              onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-16 h-10 text-center rounded-lg border focus:ring-1 focus:ring-primary shadow-sm"
                            />
                          </div>

                          <div className="w-20 text-right font-black text-primary text-base">
                            ${(() => {
                              const isLarge = item.is_large && dish?.has_large;
                              const price = isLarge
                                ? (isVip ? (dish?.large_price_vip ?? dish?.price_vip ?? 0) : (dish?.large_price_regular ?? dish?.price_regular ?? 0))
                                : (isVip ? (dish?.price_vip ?? 0) : (dish?.price_regular ?? 0));
                              return (price * item.quantity).toFixed(2);
                            })()}
                          </div>

                          <button 
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Large toggle — only shown when the dish has a large option */}
                      {dish?.has_large && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-semibold">Size:</span>
                          <div className="flex bg-muted p-0.5 rounded-lg text-xs font-bold">
                            <button
                              onClick={() => updateItem(index, 'is_large', false)}
                              className={`px-3 py-1 rounded transition-all ${
                                !item.is_large ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Regular — ${(isVip ? dish.price_vip : dish.price_regular).toFixed(2)}
                            </button>
                            <button
                              onClick={() => updateItem(index, 'is_large', true)}
                              className={`px-3 py-1 rounded transition-all ${
                                item.is_large ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {dish.large_name || 'Large'} — ${(isVip ? (dish.large_price_vip ?? dish.price_vip) : (dish.large_price_regular ?? dish.price_regular)).toFixed(2)}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between rounded-b-2xl">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Total Amount</p>
            <p className="text-2xl font-black text-primary">${totals.total.toFixed(2)}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 font-bold text-sm hover:bg-muted rounded-xl transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-xl shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
