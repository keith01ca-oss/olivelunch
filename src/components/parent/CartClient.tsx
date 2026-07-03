'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Calendar, CreditCard, ChevronRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface Dish {
  id: string;
  name: string;
  category: 'main' | 'side' | 'drink' | 'snack';
  price_regular: number;
  price_vip: number;
  is_active: boolean;
  has_large?: boolean;
  large_name?: string;
  large_price_regular?: number;
  large_price_vip?: number;
}

interface Child {
  id: string;
  name: string;
  division: string;
}

interface CartItemDetail {
  dishId: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  isLarge: boolean;
}

interface CartGroup {
  childId: string;
  childName: string;
  division: string;
  dates: Record<string, CartItemDetail[]>;
}

interface Props {
  childrenList: Child[];
  dishes: Dish[];
  isVip: boolean;
  totalCredit: number;
  existingOrders: any[];
}

export default function CartClient({ childrenList, dishes, isVip, totalCredit, existingOrders }: Props) {
  const router = useRouter();
  const [carts, setCarts] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [sizeMode, setSizeMode] = useState<'reg' | 'large'>('reg');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load carts and size mode from localStorage on mount
  useEffect(() => {
    const loadedCarts: Record<string, Record<string, Record<string, number>>> = {};
    childrenList.forEach((child) => {
      try {
        const saved = localStorage.getItem(`olive_cart_${child.id}`);
        if (saved) {
          loadedCarts[child.id] = JSON.parse(saved);
        }
      } catch (e) {
        console.error(`Failed to load cart for child ${child.id}`, e);
      }
    });
    setCarts(loadedCarts);

    try {
      const savedSize = localStorage.getItem('olive_size_mode');
      if (savedSize === 'large' || savedSize === 'reg') {
        setSizeMode(savedSize);
      }
    } catch (e) {
      console.error('Failed to load size mode', e);
    }
    setIsLoaded(true);
  }, [childrenList]);

  // Compute Cart structure grouped by child and date
  const cartGroups = useMemo((): CartGroup[] => {
    if (!isLoaded) return [];

    const groups: CartGroup[] = [];
    childrenList.forEach((child) => {
      const childCart = carts[child.id] || {};
      const datesWithItems: Record<string, CartItemDetail[]> = {};

      Object.keys(childCart).forEach((dateKey) => {
        const items = childCart[dateKey] || {};
        const details: CartItemDetail[] = [];

        Object.keys(items).forEach((dishId) => {
          const qty = items[dishId];
          if (qty <= 0) return;

          const dish = dishes.find((d) => d.id === dishId);
          if (!dish) return;

          const isLarge = sizeMode === 'large' && !!dish.has_large;
          const name = isLarge && dish.large_name ? dish.large_name : dish.name;
          const price = isLarge
            ? (isVip ? (dish.large_price_vip ?? dish.price_vip) : (dish.large_price_regular ?? dish.price_regular))
            : (isVip ? dish.price_vip : dish.price_regular);

          details.push({
            dishId,
            name,
            category: dish.category,
            quantity: qty,
            price,
            isLarge,
          });
        });

        if (details.length > 0) {
          datesWithItems[dateKey] = details;
        }
      });

      if (Object.keys(datesWithItems).length > 0) {
        groups.push({
          childId: child.id,
          childName: child.name,
          division: child.division,
          dates: datesWithItems,
        });
      }
    });

    return groups;
  }, [carts, childrenList, dishes, isVip, sizeMode, isLoaded]);

  // Calculations
  const { totalItems, totalDays, subtotal } = useMemo(() => {
    let items = 0;
    let days = 0;
    let priceSum = 0;

    cartGroups.forEach((group) => {
      Object.keys(group.dates).forEach((dateKey) => {
        days++;
        const details = group.dates[dateKey];
        details.forEach((item) => {
          items += item.quantity;
          priceSum += item.price * item.quantity;
        });
      });
    });

    return { totalItems: items, totalDays: days, subtotal: priceSum };
  }, [cartGroups]);

  const creditToUse = Math.min(subtotal, totalCredit);
  const finalTotal = Math.max(0, subtotal - creditToUse);

  // Actions
  const handleRemoveDay = (childId: string, dateKey: string) => {
    setCarts((prev) => {
      const childCart = { ...(prev[childId] || {}) };
      delete childCart[dateKey];

      const updated = { ...prev, [childId]: childCart };
      try {
        localStorage.setItem(`olive_cart_${childId}`, JSON.stringify(childCart));
        window.dispatchEvent(new Event('cart-updated'));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const handleClearCart = () => {
    if (!confirm('Are you sure you want to clear your shopping cart?')) return;
    childrenList.forEach((child) => {
      try {
        localStorage.removeItem(`olive_cart_${child.id}`);
      } catch (e) {
        console.error(e);
      }
    });
    setCarts({});
    window.dispatchEvent(new Event('cart-updated'));
  };

  const handleCheckout = async () => {
    if (totalItems === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const ordersArray: any[] = [];
      cartGroups.forEach((group) => {
        Object.keys(group.dates).forEach((date) => {
          ordersArray.push({
            child_id: group.childId,
            order_date: date,
            items: group.dates[date].map((item) => ({
              dish_id: item.dishId,
              quantity: item.quantity,
              is_large: item.isLarge,
            })),
          });
        });
      });

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: ordersArray }),
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      // Clear local storage for all active child carts
      childrenList.forEach((child) => {
        try {
          localStorage.removeItem(`olive_cart_${child.id}`);
        } catch (e) {}
      });
      window.dispatchEvent(new Event('cart-updated'));

      if (data.client_secret) {
        router.push(`/checkout?client_secret=${data.client_secret}`);
      } else if (data.success) {
        router.push('/dashboard?success=true');
      }
    } catch (err) {
      alert('Something went wrong. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-muted-foreground font-medium animate-pulse">Loading Cart...</p>
      </div>
    );
  }

  if (cartGroups.length === 0) {
    return (
      <div className="max-w-md mx-auto my-12 text-center p-8 bg-card border rounded-2xl shadow-sm animate-fade-in-up">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Your Cart is Empty</h2>
        <p className="text-muted-foreground mb-6">Select healthy and delicious meals for your children from the menu calendar.</p>
        <button
          onClick={() => router.push('/menu')}
          className="w-full bg-primary text-primary-foreground font-bold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-6 px-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Shopping Cart</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and pay for your children's lunches.</p>
        </div>
        <button
          onClick={handleClearCart}
          className="text-sm font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-6">
          {cartGroups.map((group) => (
            <div key={group.childId} className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                  {group.childName}
                  <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {group.division}
                  </span>
                </h2>
                <span className="text-xs font-bold text-muted-foreground">
                  {Object.keys(group.dates).length} day(s) selected
                </span>
              </div>

              <div className="space-y-4">
                {Object.keys(group.dates).map((dateKey) => {
                  const dateStr = format(new Date(dateKey + 'T00:00:00'), 'EEEE, MMM d, yyyy');
                  const details = group.dates[dateKey];
                  const hasDuplicate = existingOrders.some(
                    (o) => o.child_id === group.childId && o.order_date === dateKey
                  );

                  return (
                    <div key={dateKey} className="border-b last:border-b-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                          {dateStr}
                        </div>
                        <button
                          onClick={() => handleRemoveDay(group.childId, dateKey)}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded hover:bg-muted"
                          title="Remove this day"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {hasDuplicate && (
                        <div className="mb-2 bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg text-xs flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          Already ordered lunch for this child on this day. This will be an additional order.
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {details.map((item) => (
                          <div key={item.dishId} className="flex justify-between items-center text-sm pl-6">
                            <span className="text-muted-foreground">
                              <span className="font-bold text-foreground">{item.quantity}x</span> {item.name}
                              {item.isLarge && (
                                <span className="ml-1.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded">
                                  Lg
                                </span>
                              )}
                            </span>
                            <span className="font-bold text-foreground">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={() => router.push('/menu')}
            className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Keep Adding Meals
          </button>
        </div>

        {/* Checkout / Summary Panel */}
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4 sticky top-20">
            <h2 className="text-xl font-bold text-foreground">Order Summary</h2>

            <div className="space-y-3 border-b pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Days</span>
                <span className="font-bold text-foreground">{totalDays} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Items</span>
                <span className="font-bold text-foreground">{totalItems} items</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold text-foreground">${subtotal.toFixed(2)}</span>
              </div>
              {totalCredit > 0 && (
                <div className="flex justify-between text-sm text-green-700 font-semibold bg-green-50/50 p-2 rounded border border-green-100">
                  <span className="flex items-center gap-1">Store Credit Applied</span>
                  <span>-${creditToUse.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-lg font-black tracking-tight">
              <span>Final Total</span>
              <span className="text-primary">${finalTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full bg-primary text-primary-foreground font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/95 transition-all shadow-md disabled:opacity-50"
            >
              {isCheckingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" /> Proceed to Payment
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>

            {totalCredit > 0 && (
              <p className="text-[10px] text-muted-foreground text-center">
                Remaining Credit Balance after checkout: ${(totalCredit - creditToUse).toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
