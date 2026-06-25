'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, isBefore, startOfToday, addDays, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { ShoppingCart, Minus, Plus, Shuffle, Zap, Monitor, Smartphone, Trash2, Calendar, LayoutGrid } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

interface Props {
  childrenList: any[];
  dishes: Dish[];
  blockedDates: any[];
  prodDates: any[];
  dateWarnings: any[];
  isVip: boolean;
  initialChildId?: string;
  existingOrders?: any[];
  scheduledMenus?: any[];
  showWeekends?: boolean;
}

// Format: { 'YYYY-MM-DD': { dishId: number } }
type Cart = Record<string, Record<string, number>>;

// Compute available months: current month + next 11 months (12 total, rolling)
function getAvailableMonths() {
  const months: Date[] = [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    months.push(addMonths(start, i));
  }
  return months;
}

export default function MenuOrderClient({ childrenList, dishes, blockedDates, prodDates, dateWarnings, isVip, initialChildId, existingOrders = [], scheduledMenus = [], showWeekends = false }: Props) {
  const router = useRouter();

  const availableMonths = useMemo(() => getAvailableMonths(), []);

  const [selectedChildId, setSelectedChildId] = useState<string>(initialChildId || childrenList[0]?.id || '');
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(availableMonths[0]);
  const [sizeMode, setSizeMode] = useState<'reg' | 'large'>('reg');

  // Load size mode
  useEffect(() => {
    try {
      const saved = localStorage.getItem('olive_size_mode');
      if (saved === 'large' || saved === 'reg') {
        setSizeMode(saved);
      }
    } catch (e) { console.error('Failed to load size mode', e); }
  }, []);

  const changeSizeMode = (mode: 'reg' | 'large') => {
    setSizeMode(mode);
    try {
      localStorage.setItem('olive_size_mode', mode);
    } catch (e) { console.error('Failed to save size mode', e); }
  };
  
  const [cart, setCart] = useState<Cart>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<'planner' | 'desktop' | 'mobile'>('desktop');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectedPlannerDishes, setSelectedPlannerDishes] = useState<string[]>([]);
  const [draggedDishId, setDraggedDishId] = useState<string | null>(null);

  // Device detection for default view
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      setViewMode('mobile');
    } else {
      // Default to planner or desktop on computer? User said "planner view before desktop view" 
      // and "default use desktop view on computer". 
      // Wait, "add a button for planner view before desktop view... default use desktop view on computer"
      setViewMode('desktop');
    }
  }, []);

  // Load Cart
  useEffect(() => {
    if (!selectedChildId) return;
    try {
      const saved = localStorage.getItem(`olive_cart_${selectedChildId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean up cart on load: remove days that were PAID for, so the cart
        // doesn't show stale items after a successful checkout.
        // NOTE: existingOrders only contains 'paid' orders (pending/cancelled Stripe
        // sessions are NOT included), so cancelled checkouts won't wipe the cart.
        const childOrders = existingOrders.filter(o => o.child_id === selectedChildId);
        let hasChanges = false;
        childOrders.forEach(order => {
          if (parsed[order.order_date]) {
            delete parsed[order.order_date];
            hasChanges = true;
          }
        });
        setCart(parsed);
        if (hasChanges) localStorage.setItem(`olive_cart_${selectedChildId}`, JSON.stringify(parsed));
      }
      else setCart({});
    } catch (e) { console.error('Failed to load cart', e); }
    setIsLoaded(true);
  }, [selectedChildId, existingOrders]);

  // Save Cart
  useEffect(() => {
    if (!isLoaded || !selectedChildId) return;
    localStorage.setItem(`olive_cart_${selectedChildId}`, JSON.stringify(cart));
  }, [cart, isLoaded, selectedChildId]);

  // Accordion-aware toggle: expanding a day collapses empty siblings in the same week

  const today = startOfToday();
  const cutoffTimePassed = new Date().getHours() >= 13;
  const minSelectableDate = cutoffTimePassed ? addDays(today, 2) : addDays(today, 1);

  const isDateDisabled = (date: Date) => {
    const day = getDay(date);
    if (!showWeekends && (day === 0 || day === 6)) return true;
    if (isBefore(date, minSelectableDate)) return true;
    const dateKey = format(date, 'yyyy-MM-dd');
    if (blockedDates.some((b: any) => b.date === dateKey)) return true;
    return false;
  };

  const toggleExpanded = (dateKey: string, weekDays?: Date[]) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
        // Collapse all other days in the same week to keep only one day open
        if (weekDays) {
          weekDays.forEach(d => {
            const dk = format(d, 'yyyy-MM-dd');
            if (dk !== dateKey && next.has(dk)) {
              next.delete(dk);
            }
          });
        }
      }
      return next;
    });
  };

  // Auto-expand the first available day when switching months in mobile view
  useEffect(() => {
    if (viewMode !== 'mobile') return;
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const firstAvailable = allDays.find(d => !isDateDisabled(d));
    if (firstAvailable) {
      setExpandedDays(new Set([format(firstAvailable, 'yyyy-MM-dd')]));
    } else {
      setExpandedDays(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthDate, viewMode]);

  // Expand / Collapse all for mobile
  const allMobileKeys = useMemo(() => {
    if (viewMode !== 'mobile') return [];
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);
    return eachDayOfInterval({ start: monthStart, end: monthEnd })
      .filter(d => !isDateDisabled(d))
      .map(d => format(d, 'yyyy-MM-dd'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthDate, viewMode]);

  const isAllExpanded = allMobileKeys.length > 0 && allMobileKeys.every(k => expandedDays.has(k));

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedDays(new Set());
    } else {
      setExpandedDays(new Set(allMobileKeys));
    }
  };



  const weeksInMonth = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);
    const weeks: Date[][] = [];

    let current = startOfWeek(monthStart, { weekStartsOn: 1 });
    while (current.getTime() <= monthEnd.getTime()) {
      const weekDays: Date[] = [];
      const daysInWeek = showWeekends ? 7 : 5;
      for (let i = 0; i < daysInWeek; i++) {
        const day = addDays(current, i);
        if (day.getTime() >= monthStart.getTime() && day.getTime() <= monthEnd.getTime()) {
          weekDays.push(day);
        }
      }
      if (weekDays.length > 0) weeks.push(weekDays);
      current = addDays(current, 7);
    }
    return weeks;
  }, [currentMonthDate]);

  const updateQty = (dateKey: string, dishId: string, delta: number) => {
    setCart(prev => {
      const dayCart = { ...(prev[dateKey] || {}) };
      const cur = dayCart[dishId] || 0;
      const next = Math.max(0, cur + delta);
      if (next === 0) delete dayCart[dishId];
      else dayCart[dishId] = next;
      if (Object.keys(dayCart).length === 0) {
        const updated = { ...prev };
        delete updated[dateKey];
        return updated;
      }
      return { ...prev, [dateKey]: dayCart };
    });
  };

  const getScheduledDishesForCategory = (dateKey: string, category: string) => {
    const scheduled = scheduledMenus.filter(m => m.date === dateKey);
    const categoryDishes = dishes.filter(d => d.category === category);
    
    return scheduled
      .map(s => categoryDishes.find(d => d.id === s.dish_id))
      .filter(Boolean) as Dish[];
  };

  // Get unique dishes scheduled for the current month (for sidebar)
  const plannerMonthDishes = useMemo(() => {
    const monthStr = format(currentMonthDate, 'yyyy-MM');
    const scheduledThisMonth = scheduledMenus.filter(m => m.date.startsWith(monthStr));
    const seenIds = new Set<string>();
    const result: Dish[] = [];
    scheduledThisMonth.forEach(s => {
      if (!seenIds.has(s.dish_id)) {
        const dish = dishes.find(d => d.id === s.dish_id);
        if (dish) { seenIds.add(s.dish_id); result.push(dish); }
      }
    });
    return result;
  }, [scheduledMenus, dishes, currentMonthDate]);

  const plannerCategories: Array<'main' | 'side' | 'snack' | 'drink'> = ['main', 'side', 'snack', 'drink'];

  const togglePlannerDish = (dishId: string) => {
    setSelectedPlannerDishes(prev =>
      prev.includes(dishId) ? prev.filter(id => id !== dishId) : [...prev, dishId]
    );
  };

  const handleAddSelectedToMonth = () => {
    if (selectedPlannerDishes.length === 0) return;
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    setCart(prev => {
      const updated = { ...prev };
      allDays.forEach(day => {
        if (isDateDisabled(day)) return;
        const dateKey = format(day, 'yyyy-MM-dd');
        // Only add to days where admin has scheduled any content
        const hasScheduled = scheduledMenus.some(m => m.date === dateKey);
        if (!hasScheduled) return;
        const dayCart = { ...(updated[dateKey] || {}) };
        // Add ALL selected dishes to every valid day (qty 1, or increment if already in cart)
        selectedPlannerDishes.forEach(dishId => {
          dayCart[dishId] = (dayCart[dishId] || 0) + 1;
        });
        updated[dateKey] = dayCart;
      });
      return updated;
    });
    setSelectedPlannerDishes([]);
  };

  const handleDropOnDay = (dateKey: string, dishId: string) => {
    if (!dishId) return;
    // Only allow drop if admin scheduled this dish for this date
    const isScheduledForDay = scheduledMenus.some(m => m.date === dateKey && m.dish_id === dishId);
    if (!isScheduledForDay) return;
    setCart(prev => {
      const dayCart = { ...(prev[dateKey] || {}) };
      dayCart[dishId] = (dayCart[dishId] || 0) + 1;
      return { ...prev, [dateKey]: dayCart };
    });
  };

  const toggleDay = (date: Date) => {
    if (isDateDisabled(date)) return;
    const dateKey = format(date, 'yyyy-MM-dd');
    
    setCart(prev => {
      if (prev[dateKey]) {
        const updated = { ...prev };
        delete updated[dateKey];
        return updated;
      }
      return prev;
    });
  };

  const orderWeek = (days: Date[]) => {
    setCart(prev => {
      const updated = { ...prev };
      const usedIds = new Set<string>();
      
      days.forEach(day => {
        if (!isDateDisabled(day)) {
          const key = format(day, 'yyyy-MM-dd');
          const dayMains = getScheduledDishesForCategory(key, 'main');
          const daySides = getScheduledDishesForCategory(key, 'side');
          const daySnacks = getScheduledDishesForCategory(key, 'snack');
          let allOptions = [...dayMains, ...daySides, ...daySnacks];
          
          if (allOptions.length > 0 && !updated[key]) {
            // Prefer dishes not yet used this week
            const unused = allOptions.filter(d => !usedIds.has(d.id));
            const pool = unused.length > 0 ? unused : allOptions; // fallback if all used
            const randomDish = pool[Math.floor(Math.random() * pool.length)];
            updated[key] = { [randomDish.id]: 1 };
            usedIds.add(randomDish.id);
          }
        }
      });
      return updated;
    });
  };

  const autoFillMonth = () => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(currentMonthDate);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    setCart(prev => {
      const updated = { ...prev };
      // Process week-by-week to avoid repeats within a week
      // Group days into calendar weeks (Mon–Fri)
      let currentWeekUsed = new Set<string>();
      let lastWeekStart = -1;

      allDays.forEach(day => {
        if (!isDateDisabled(day)) {
          // Detect week change (Monday resets the used-set)
          const dow = getDay(day); // 0=Sun, 1=Mon
          const weekOfYear = Math.floor((
            (day.getTime() - monthStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
          ));
          if (weekOfYear !== lastWeekStart) {
            currentWeekUsed = new Set<string>();
            lastWeekStart = weekOfYear;
          }

          const key = format(day, 'yyyy-MM-dd');
          const dayMains = getScheduledDishesForCategory(key, 'main');
          const daySides = getScheduledDishesForCategory(key, 'side');
          const daySnacks = getScheduledDishesForCategory(key, 'snack');
          const allOptions = [...dayMains, ...daySides, ...daySnacks];
          
          if (allOptions.length > 0 && !updated[key]) {
            const unused = allOptions.filter(d => !currentWeekUsed.has(d.id));
            const pool = unused.length > 0 ? unused : allOptions;
            const randomDish = pool[Math.floor(Math.random() * pool.length)];
            updated[key] = { [randomDish.id]: 1 };
            currentWeekUsed.add(randomDish.id);
          }
        }
      });
      return updated;
    });
  };

  const copyToNextMonth = () => {
    const nextMonth = addMonths(currentMonthDate, 1);
    
    const currentMonthStart = startOfMonth(currentMonthDate);
    const currentMonthEnd = endOfMonth(currentMonthDate);
    const currentDays = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd });
    const nextMonthStart = startOfMonth(nextMonth);
    const nextMonthEnd = endOfMonth(nextMonth);
    const nextDays = eachDayOfInterval({ start: nextMonthStart, end: nextMonthEnd });
    
    setCart(prev => {
      // Build a map keyed by "dayOfWeek-occurrenceIndex"
      // e.g., "1-0" = 1st Monday, "1-1" = 2nd Monday, "2-0" = 1st Tuesday, etc.
      const occurrenceMap: Record<string, Record<string, number>> = {};
      const dowCount: Record<number, number> = {};
      
      currentDays.forEach(day => {
        const dow = getDay(day);
        if (dowCount[dow] === undefined) dowCount[dow] = 0;
        else dowCount[dow]++;
        const dateKey = format(day, 'yyyy-MM-dd');
        if (prev[dateKey]) {
          occurrenceMap[`${dow}-${dowCount[dow]}`] = { ...prev[dateKey] };
        }
      });

      // For each dow, find the max occurrence index we have data for
      const maxOccurrence: Record<number, number> = {};
      Object.keys(occurrenceMap).forEach(key => {
        const [dowStr, occStr] = key.split('-');
        const dow = parseInt(dowStr);
        const occ = parseInt(occStr);
        if (maxOccurrence[dow] === undefined || occ > maxOccurrence[dow]) {
          maxOccurrence[dow] = occ;
        }
      });

      const updated = { ...prev };
      const nextDowCount: Record<number, number> = {};
      
      nextDays.forEach(day => {
        const dow = getDay(day);
        if (nextDowCount[dow] === undefined) nextDowCount[dow] = 0;
        else nextDowCount[dow]++;
        
        const isWeekend = dow === 0 || dow === 6;
        const dateStr = format(day, 'yyyy-MM-dd');
        const isBlocked = blockedDates.some((b: any) => b.date === dateStr);
        if ((!showWeekends && isWeekend) || isBlocked) return;
        
        const occurrence = nextDowCount[dow];
        // Clamp: if next month has a 5th Monday but source only had 4, reuse last
        const lookupOcc = maxOccurrence[dow] !== undefined
          ? Math.min(occurrence, maxOccurrence[dow])
          : occurrence;
        
        const sourceItems = occurrenceMap[`${dow}-${lookupOcc}`];
        if (sourceItems) {
          updated[dateStr] = { ...sourceItems };
        }
      });
      return updated;
    });
    
    setCurrentMonthDate(nextMonth);
  };

  // Totals
  let totalItems = 0;
  let totalDays = 0;
  let totalPrice = 0;
  Object.keys(cart).forEach(dateKey => {
    totalDays++;
    Object.keys(cart[dateKey]).forEach(dishId => {
      const qty = cart[dateKey][dishId];
      const dish = dishes.find(d => d.id === dishId);
      if (dish) {
        const isDishLarge = sizeMode === 'large' && dish.has_large;
        const price = isDishLarge 
          ? (isVip ? (dish.large_price_vip ?? dish.price_vip) : (dish.large_price_regular ?? dish.price_regular))
          : (isVip ? dish.price_vip : dish.price_regular);
        totalPrice += price * qty;
        totalItems += qty;
      }
    });
  });

  const handleCheckout = async () => {
    if (totalItems === 0 || isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const ordersArray = Object.keys(cart).map(date => ({
        child_id: selectedChildId,
        order_date: date,
        items: Object.keys(cart[date]).map(dishId => {
          const dish = dishes.find(d => d.id === dishId);
          return {
            dish_id: dishId,
            quantity: cart[date][dishId],
            is_large: sizeMode === 'large' && !!dish?.has_large
          };
        })
      }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: ordersArray })
      });
      const data = await res.json();

      if (data.error) { alert(data.error); return; }
      if (data.stripe_url) {
        // Clear cart from localStorage BEFORE leaving (so it's gone when we return)
        try { localStorage.removeItem(`olive_cart_${selectedChildId}`); } catch (e) {}
        setCart({});
        window.location.href = data.stripe_url;
      } else if (data.success) {
        // Zero-cost order (paid via credit) — clear cart and go to dashboard
        try { localStorage.removeItem(`olive_cart_${selectedChildId}`); } catch (e) {}
        setCart({});
        router.push('/dashboard?success=true');
      }
    } catch (err) {
      alert("Something went wrong. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const DayCard = ({ day, weekDays }: { day: Date; weekDays?: Date[] }) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const isDisabled = isDateDisabled(day);
    const isSelected = !!cart[dateKey];
    const dayCart = cart[dateKey] || {};
    const isMobile = viewMode === 'mobile';
    const isExpanded = !isMobile || expandedDays.has(dateKey);

    // Find a blocked reason for this specific date
    const blockedInfo = blockedDates.find((b: any) => b.date === dateKey);
    const prodInfo = prodDates.find((p: any) => dateKey >= p.start_date && dateKey <= p.end_date);
    const blockReason = blockedInfo?.reason || prodInfo?.message || null;

    // Find a non-blocking warning for this date
    const warningInfo = dateWarnings.find((w: any) => w.date === dateKey);

    // Summary line for mobile collapsed state
    const selectedItemCount = Object.values(dayCart).reduce((a, b) => a + b, 0);
    // Existing Order lookup (may have multiple orders for the same day)
    const dayOrders = existingOrders.filter(o => o.child_id === selectedChildId && o.order_date === dateKey);
    const hasExisting = dayOrders.length > 0;

    return (
      <div className={`rounded-xl border-2 transition-all flex flex-col ${
        isDisabled ? 'opacity-40 bg-muted/30 border-border cursor-not-allowed' :
        isSelected ? 'border-primary bg-primary/5 shadow-sm' : 
        hasExisting ? 'border-green-400 bg-green-50/30' : 'border-border bg-card hover:border-primary/40'
      }`}>
        {/* Day Header - always visible */}
        <div
          className={`flex items-center justify-between p-3 rounded-t-xl font-bold text-base cursor-pointer ${
            isSelected ? 'bg-primary/10' : hasExisting ? 'bg-green-100/50' : ''
          } ${isMobile ? 'rounded-b-xl' : ''} ${isMobile && isExpanded ? 'rounded-b-none border-b' : ''}`}
          onClick={() => {
            if (isDisabled) return;
            if (isMobile) {
              toggleExpanded(dateKey, weekDays);
            } else {
              toggleDay(day);
            }
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-foreground shrink-0">{format(day, 'd EEE')}</span>
            {(() => {
              const dayMains = getScheduledDishesForCategory(dateKey, 'main');
              const daySides = getScheduledDishesForCategory(dateKey, 'side');
              const daySnacks = getScheduledDishesForCategory(dateKey, 'snack');
              const dayDrinks = getScheduledDishesForCategory(dateKey, 'drink');
              const currentDayDishes = [...dayMains, ...daySides, ...daySnacks, ...dayDrinks];
              const hasAnySizeOption = currentDayDishes.some(d => d.has_large);
              
              if (!hasAnySizeOption) return null;

              return (
                <div className="flex bg-muted p-0.5 rounded-lg text-[10px] font-bold shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => changeSizeMode('reg')}
                    className={`px-1.5 py-0.5 rounded transition-all ${sizeMode === 'reg' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Regular
                  </button>
                  <button
                    onClick={() => changeSizeMode('large')}
                    className={`px-1.5 py-0.5 rounded transition-all ${sizeMode === 'large' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Large {isVip ? '(+$1.00)' : '(+$1.50)'}
                  </button>
                </div>
              );
            })()}
            {/* Mobile collapsed summary */}
            {isMobile && !isExpanded && isSelected && (() => {
              const allInCart = Object.keys(dayCart)
                .map(id => dishes.find(d => d.id === id))
                .filter(Boolean);
              const firstDish = allInCart[0];
              if (!firstDish) return null;

              const isDishLarge = sizeMode === 'large' && firstDish.has_large;
              const firstName = isDishLarge && firstDish.large_name ? firstDish.large_name : firstDish.name;
              const price = isDishLarge
                ? (isVip ? (firstDish.large_price_vip ?? firstDish.price_vip) : (firstDish.large_price_regular ?? firstDish.price_regular))
                : (isVip ? firstDish.price_vip : firstDish.price_regular);

              return (
                <span className="text-xs font-semibold text-primary flex-1 leading-tight py-1">
                  ✓ {firstName} <span className="text-[10px] text-muted-foreground">${Number(price).toFixed(2)}</span>
                  {selectedItemCount > 1 ? ` +${selectedItemCount - 1}` : ''}
                </span>
              );
            })()}
            {isMobile && !isExpanded && !isSelected && hasExisting && (
              <span className="text-xs text-green-700 font-bold truncate flex-1 min-w-0">✓ Already ordered</span>
            )}
            {isMobile && !isExpanded && !isSelected && !hasExisting && blockReason && (
              <span className="text-xs text-red-600 font-bold truncate flex-1 min-w-0">🚫 {blockReason}</span>
            )}
            {isMobile && !isExpanded && !isSelected && !hasExisting && !blockReason && warningInfo && (
              <span className="text-xs text-amber-700 font-bold truncate flex-1 min-w-0">⚠️ {warningInfo.message}</span>
            )}
            {isMobile && !isExpanded && !isSelected && !isDisabled && !hasExisting && !blockReason && !warningInfo && (
              <span className="text-xs text-muted-foreground">Tap to order</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isMobile && (
              <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
            )}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                if (isDisabled) return;
                toggleDay(day);
                // On mobile, also expand the card when checking
                if (isMobile && !isExpanded) toggleExpanded(dateKey, weekDays);
              }}
              disabled={isDisabled}
              className="w-5 h-5 accent-primary cursor-pointer"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>

        {isExpanded && (
        <div className={`p-3 space-y-3 flex-1 flex flex-col ${isDisabled && !blockReason ? 'pointer-events-none opacity-50' : ''}`}>
            
            {/* Blocked Date Notice */}
            {blockReason && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                <span className="text-base shrink-0">🚫</span>
                <div>
                  <p className="font-bold">No Ordering Available</p>
                  <p className="text-xs mt-0.5">{blockReason}</p>
                </div>
              </div>
            )}

            {/* Date Warning Banner (amber, ordering still allowed) */}
            {!blockReason && warningInfo && (
              <div className="bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded-lg text-sm flex items-start gap-2">
                <span className="text-base shrink-0">⚠️</span>
                <div>
                  <p className="font-bold">Notice</p>
                  <p className="text-xs mt-0.5">{warningInfo.message}</p>
                </div>
              </div>
            )}

            {/* Existing Order Warning */}
            {hasExisting && (
              <div className="bg-green-100 border border-green-200 text-green-800 p-2 rounded-lg text-xs">
                <p className="font-bold mb-1">Already ordered:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {dayOrders.flatMap((o: any) => o.order_items).map((item: any) => (
                    <li key={item.id}>{item.quantity}x {item.dishes?.name}</li>
                  ))}
                </ul>
                {isSelected && (
                  <p className="mt-2 text-amber-700 font-bold bg-amber-100 p-1 rounded">⚠️ You are adding an ADDITIONAL order for this day.</p>
                )}
              </div>
            )}

            {/* All Dishes (Uncategorized) */}
            {!blockReason && (() => {
              // Combine all categories into one flat list
              const currentDayDishes = [
                ...getScheduledDishesForCategory(dateKey, 'main'),
                ...getScheduledDishesForCategory(dateKey, 'side'),
                ...getScheduledDishesForCategory(dateKey, 'snack'),
                ...getScheduledDishesForCategory(dateKey, 'drink')
              ];
              if (currentDayDishes.length === 0) return null;
              
              return (
                <div className="space-y-1.5 pt-2">
                  {currentDayDishes.map(item => {
                    const qty = dayCart[item.id] || 0;
                    const isDishLarge = sizeMode === 'large' && item.has_large;
                    const displayName = isDishLarge && item.large_name ? item.large_name : item.name;
                    const price = isDishLarge
                      ? (isVip ? (item.large_price_vip ?? item.price_vip) : (item.large_price_regular ?? item.price_regular))
                      : (isVip ? item.price_vip : item.price_regular);

                    return (
                      <div key={item.id} className="flex items-center gap-2 py-0.5">
                        <button onClick={() => updateQty(dateKey, item.id, -1)} className="w-6 h-6 rounded bg-secondary flex items-center justify-center hover:bg-primary/20 shrink-0 transition-colors">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-foreground shrink-0">
                          {qty > 0 ? qty : ''}
                        </span>
                        <button onClick={() => updateQty(dateKey, item.id, 1)} className="w-6 h-6 rounded bg-secondary flex items-center justify-center hover:bg-primary/20 shrink-0 transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm text-foreground">{displayName} <span className="text-xs font-semibold text-muted-foreground">${Number(price).toFixed(2)}</span></span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${viewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'} transition-all duration-300`}>
      
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Child Selector */}
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm font-medium shadow-sm focus:ring-1 focus:ring-primary"
          >
            {childrenList.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.division})</option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('planner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'planner' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Planner View
          </button>
          <button
            onClick={() => setViewMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'desktop' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Desktop View
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'mobile' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Mobile View
          </button>
        </div>
      </div>

      {/* Month Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {availableMonths.map(month => (
          <button
            key={month.toISOString()}
            onClick={() => setCurrentMonthDate(month)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              month.getMonth() === currentMonthDate.getMonth() && month.getFullYear() === currentMonthDate.getFullYear()
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card border-border text-foreground hover:border-primary/50'
            }`}
          >
            {format(month, 'MMM')}
          </button>
        ))}
      </div>

      {/* Month Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight">
            {format(currentMonthDate, 'MMMM yyyy')}
          </h2>
          <div className="flex bg-muted p-0.5 rounded-lg text-xs font-bold shrink-0">
            <button
              onClick={() => changeSizeMode('reg')}
              className={`px-3 py-1 rounded transition-all ${sizeMode === 'reg' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Regular
            </button>
            <button
              onClick={() => changeSizeMode('large')}
              className={`px-3 py-1 rounded transition-all ${sizeMode === 'large' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Large {isVip ? '(+$1.00)' : '(+$1.50)'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={autoFillMonth}
            className="flex items-center gap-1.5 text-xs font-semibold border border-border bg-card rounded-lg px-3 py-1.5 hover:border-primary hover:text-primary transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" /> Random fill month
          </button>
          <button
            onClick={copyToNextMonth}
            className="flex items-center gap-1.5 text-xs font-semibold border border-border bg-card rounded-lg px-3 py-1.5 hover:border-primary hover:text-primary transition-colors shadow-sm"
          >
            <Shuffle className="w-3.5 h-3.5" /> Copy to next month
          </button>
        </div>
      </div>

      {/* Weeks & Calendar */}
      <div className="space-y-6 pb-12">
        {viewMode === 'planner' ? (
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Planner Sidebar */}
            <div className="w-full lg:w-64 shrink-0 space-y-3">
              {/* Bulk add panel */}
              {selectedPlannerDishes.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 animate-pulse-once">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Bulk Add</span>
                    <button onClick={() => setSelectedPlannerDishes([])} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                  </div>
                  <p className="text-sm font-bold mb-1">{selectedPlannerDishes.length} selected</p>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {selectedPlannerDishes.map(id => dishes.find(d => d.id === id)?.name).filter(Boolean).join(', ')}
                  </p>
                  <button
                    onClick={handleAddSelectedToMonth}
                    className="w-full bg-primary text-primary-foreground font-bold py-2 px-3 rounded-xl text-sm hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    + Add to Entire Month
                  </button>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">Only adds to days where admin scheduled this dish.</p>
                </div>
              )}

              {/* Dishes list */}
              <div className="bg-card border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">Available Dishes</h3>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">Click or drag to calendar</p>

                {/* Remove All/Selected for Month */}
                {(() => {
                  const monthStr = format(currentMonthDate, 'yyyy-MM');
                  const monthCartDays = Object.keys(cart).filter(k => k.startsWith(monthStr));
                  if (monthCartDays.length === 0) return null;
                  
                  const isFiltered = selectedPlannerDishes.length > 0;

                  return (
                    <button
                      onClick={() => {
                        const monthStr2 = format(currentMonthDate, 'yyyy-MM');
                        setCart(prev => {
                          const updated = { ...prev };
                          Object.keys(updated).forEach(k => { 
                            if (k.startsWith(monthStr2)) {
                              if (isFiltered) {
                                // Only remove selected dishes from this day's cart
                                const dayCart = { ...updated[k] };
                                selectedPlannerDishes.forEach(id => delete dayCart[id]);
                                if (Object.keys(dayCart).length === 0) delete updated[k];
                                else updated[k] = dayCart;
                              } else {
                                // Remove entire day
                                delete updated[k];
                              }
                            }
                          });
                          return updated;
                        });
                        if (isFiltered) setSelectedPlannerDishes([]);
                      }}
                      className={`w-full mb-3 flex items-center justify-center gap-1.5 text-xs font-bold border rounded-xl py-2 px-3 transition-colors ${
                        isFiltered 
                        ? 'text-red-700 border-red-300 bg-red-100 hover:bg-red-200' 
                        : 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 
                      {isFiltered ? `Remove Selected for ${format(currentMonthDate, 'MMM')}` : `Remove All for ${format(currentMonthDate, 'MMM')}`}
                    </button>
                  );
                })()}

                {plannerMonthDishes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No dishes scheduled for this month.</p>
                ) : (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    {plannerCategories.map(cat => {
                      const catDishes = plannerMonthDishes.filter(d => d.category === cat);
                      if (catDishes.length === 0) return null;
                      return (
                        <div key={cat}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">{cat}</p>
                          <div className="space-y-1.5">
                            {catDishes.map(dish => {
                              const isSelected = selectedPlannerDishes.includes(dish.id);
                              const isDishLarge = sizeMode === 'large' && dish.has_large;
                              const displayName = isDishLarge && dish.large_name ? dish.large_name : dish.name;
                              const price = isDishLarge
                                ? (isVip ? (dish.large_price_vip ?? dish.price_vip) : (dish.large_price_regular ?? dish.price_regular))
                                : (isVip ? dish.price_vip : dish.price_regular);

                              return (
                                <div
                                  key={dish.id}
                                  draggable
                                  onDragStart={() => setDraggedDishId(dish.id)}
                                  onDragEnd={() => setDraggedDishId(null)}
                                  onClick={() => togglePlannerDish(dish.id)}
                                  className={`flex items-center gap-2 border rounded-xl p-2.5 cursor-pointer transition-all select-none ${
                                    isSelected
                                      ? 'bg-primary/10 border-primary ring-1 ring-primary'
                                      : 'bg-background hover:border-primary/50 hover:shadow-sm'
                                  }`}
                                >
                                  <div className="cursor-grab text-muted-foreground">⠿</div>
                                  <div className="flex-1">
                                    <p className={`text-sm font-bold ${isSelected ? 'text-primary' : ''}`}>{displayName} <span className="text-xs font-semibold text-muted-foreground">${Number(price).toFixed(2)}</span></p>
                                  </div>
                                  {isSelected && <span className="text-primary text-base">✓</span>}
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
            </div>

            {/* Planner Calendar */}
            <div className="flex-1 bg-card border rounded-2xl overflow-hidden shadow-sm min-w-0">
              {/* Days Header */}
              <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} border-b bg-muted/20`}>
                {(showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).map(day => (
                  <div key={day} className="py-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'}`}>
                {weeksInMonth.map((week, wi) => (
                  <div key={wi} className="contents">
                    {/* Fill empty start slots */}
                    {wi === 0 && week[0] && (getDay(week[0]) === 0 ? 6 : getDay(week[0]) - 1) > 0 &&
                      Array.from({ length: getDay(week[0]) === 0 ? 6 : getDay(week[0]) - 1 }).map((_, i) => (
                        <div key={`fill-${i}`} className="border-b border-r bg-muted/5 min-h-[110px]" />
                      ))
                    }

                    {week.map(day => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const isDisabled = isDateDisabled(day);
                      const dayCart = cart[dateKey] || {};
                      const cartEntries = Object.entries(dayCart);
                      const hasScheduled = scheduledMenus.some(m => m.date === dateKey);
                      const existingOrder = existingOrders.find(o => o.child_id === selectedChildId && o.order_date === dateKey);
                      // Blocked date detection (same as DayCard)
                      const blockedInfo = blockedDates.find((b: any) => b.date === dateKey);
                      const prodInfo = prodDates.find((p: any) => dateKey >= p.start_date && dateKey <= p.end_date);
                      const blockReason = blockedInfo?.reason || prodInfo?.message || null;
                      const isBlocked = !!blockReason;

                      return (
                        <div
                          key={dateKey}
                          className={`border-b border-r p-1.5 min-h-[110px] transition-all relative ${
                            isBlocked ? 'bg-red-50/60 opacity-60 cursor-not-allowed' :
                            isDisabled ? 'bg-muted/10 opacity-40 cursor-not-allowed' :
                            draggedDishId && hasScheduled ? 'hover:bg-primary/5 hover:ring-2 hover:ring-primary hover:ring-inset cursor-copy' :
                            existingOrder ? 'bg-green-50/30' :
                            cartEntries.length > 0 ? 'bg-primary/5' : ''
                          }`}
                          onDragOver={e => { if (!isDisabled && !isBlocked && hasScheduled) e.preventDefault(); }}
                          onDrop={e => {
                            e.preventDefault();
                            if (!isDisabled && !isBlocked && draggedDishId) handleDropOnDay(dateKey, draggedDishId);
                          }}
                        >
                          {/* Date number */}
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] font-bold ${
                              isBlocked ? 'text-red-500' :
                              isDisabled ? 'text-muted-foreground' :
                              cartEntries.length > 0 ? 'text-primary' : 'text-muted-foreground'
                            }`}>{format(day, 'd')}</span>
                            {existingOrder && !isBlocked && <span className="text-[9px] font-bold text-green-700 bg-green-100 rounded px-1">Ordered</span>}
                          </div>

                          {/* Blocked reason */}
                          {isBlocked && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px]">🚫</span>
                              <span className="text-[10px] font-semibold text-red-600 truncate">{blockReason}</span>
                            </div>
                          )}

                          {/* Cart items in this day */}
                          {!isBlocked && (
                            <div className="space-y-0.5">
                              {cartEntries.map(([dishId, qty]) => {
                                const dish = dishes.find(d => d.id === dishId);
                                if (!dish) return null;
                                const isDishLarge = sizeMode === 'large' && dish.has_large;
                                const displayName = isDishLarge && dish.large_name ? dish.large_name : dish.name;
                                const price = isDishLarge
                                  ? (isVip ? (dish.large_price_vip ?? dish.price_vip) : (dish.large_price_regular ?? dish.price_regular))
                                  : (isVip ? dish.price_vip : dish.price_regular);
                                
                                return (
                                  <div key={dishId} className="flex items-start gap-1 group">
                                    <span className={`text-[10px] leading-tight flex-1 font-medium rounded px-1 py-0.5 ${
                                      dish.category === 'main' ? 'bg-primary/10 text-primary' :
                                      dish.category === 'side' ? 'bg-amber-100 text-amber-800' :
                                      dish.category === 'drink' ? 'bg-blue-100 text-blue-800' :
                                      'bg-purple-100 text-purple-800'
                                    }`}>
                                      {qty > 1 && <span className="font-bold">{qty}×</span>} {displayName} <span className="text-[9px] opacity-75 ml-0.5">${Number(price).toFixed(2)}</span>
                                    </span>
                                    <button
                                      onClick={() => updateQty(dateKey, dishId, -1)}
                                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs leading-none shrink-0 transition-opacity"
                                    >×</button>
                                  </div>
                                );
                              })}

                              {/* Already ordered items */}
                              {existingOrder && existingOrder.order_items?.map((item: any) => {
                                const dish = item.dishes;
                                if (!dish) return null;
                                return (
                                  <div key={item.id} className="flex items-start gap-1">
                                    <span className={`text-[10px] leading-tight flex-1 font-medium rounded px-1 py-0.5 opacity-80 ${
                                      dish.category === 'main' ? 'bg-green-100 text-green-800' :
                                      dish.category === 'side' ? 'bg-amber-50 text-amber-700' :
                                      dish.category === 'drink' ? 'bg-blue-50 text-blue-700' :
                                      'bg-purple-50 text-purple-700'
                                    }`}>
                                      {item.quantity > 1 && <span className="font-bold">{item.quantity}×</span>} {dish.name}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Drop hint */}
                          {!isDisabled && !isBlocked && hasScheduled && cartEntries.length === 0 && !existingOrder && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                              <Plus className="w-5 h-5 text-primary/30" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          weeksInMonth.map((week, wi) => {
            const weekStart = week[0];
            const weekEnd = week[week.length - 1];
            return (
              <div key={wi} className="rounded-2xl border bg-card/60 overflow-hidden">
                {/* Week Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-muted/60 border-b">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">
                      Week {wi + 1}: {format(weekStart, 'MMM d')} - {format(weekEnd, 'd')}
                    </h3>
                    {viewMode === 'mobile' && (
                      <button
                        onClick={toggleExpandAll}
                        className="text-[10px] font-semibold border border-border bg-card rounded-full px-2 py-0.5 hover:border-primary hover:text-primary transition-colors"
                      >
                        {isAllExpanded ? 'Collapse all' : 'Expand all'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => orderWeek(week)}
                      className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1 rounded-full hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      Random this week
                    </button>
                  </div>
                </div>

                {/* Day Cards */}
                <div className={`flex gap-2 p-3 ${viewMode === 'mobile' ? 'flex-col' : 'flex-row'}`}>
                  {/* Fill missing days if week doesn't start on Mon */}
                  {viewMode === 'desktop' && week[0] && (getDay(week[0]) === 0 ? 6 : getDay(week[0]) - 1) > 0 &&
                    Array.from({ length: getDay(week[0]) === 0 ? 6 : getDay(week[0]) - 1 }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex-1 min-w-0 rounded-xl border-2 border-dashed border-border/40 opacity-30 h-20" />
                    ))
                  }
                  {week.map(day => (
                    <div key={day.toISOString()} className={viewMode === 'desktop' ? 'flex-1 min-w-0' : 'w-full'}>
                      <DayCard day={day} weekDays={week} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Month Tabs */}
      <div className="flex flex-wrap gap-2 mb-32 border-t pt-8">
        {availableMonths.map(month => (
          <button
            key={month.toISOString()}
            onClick={() => {
              setCurrentMonthDate(month);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              month.getMonth() === currentMonthDate.getMonth() && month.getFullYear() === currentMonthDate.getFullYear()
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card border-border text-foreground hover:border-primary/50'
            }`}
          >
            {format(month, 'MMM')}
          </button>
        ))}
      </div>

      {/* Sticky Bottom Cart */}
      <div className="fixed bottom-[4.5rem] md:bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="container max-w-5xl mx-auto px-4 pb-4 pointer-events-none">
          <div className={`bg-foreground text-background rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transition-all duration-300 ${totalItems === 0 ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary p-2 rounded-xl">
                  <ShoppingCart className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-bold text-lg">{totalDays} day{totalDays !== 1 ? 's' : ''} selected</p>
                  <p className="text-sm opacity-70">{totalItems} total item{totalItems !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  onClick={() => setCart({})}
                  className="text-sm font-semibold flex items-center gap-1.5 opacity-70 hover:opacity-100 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4 hidden sm:block" /> Clear
                </button>
                <div className="w-px h-6 bg-background/20 hidden sm:block"></div>
                <p className="text-xl font-extrabold">${totalPrice.toFixed(2)}</p>
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-lg"
                >
                  {isCheckingOut ? 'Redirecting...' : 'Add to Cart →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
