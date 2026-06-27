'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  CheckCircle, Clock, XCircle, RefreshCcw, ShoppingBag,
  ChevronDown, ChevronUp, CreditCard, Trash2, AlertCircle
} from 'lucide-react';

const STATUS_CONFIG = {
  paid:      { label: 'Paid',      color: 'bg-green-100 text-green-700 border border-green-200', icon: CheckCircle },
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700 border border-green-200', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 border border-red-200', icon: XCircle },
  refunded:  { label: 'Refunded',  color: 'bg-blue-100 text-blue-700 border border-blue-200', icon: RefreshCcw },
  expired:   { label: 'Expired',   color: 'bg-gray-100 text-gray-500 border border-gray-200', icon: AlertCircle },
};

type Order = {
  id: string;
  order_date: string;
  status: string;
  gross_amount: number;
  credit_used: number;
  total_amount: number;
  created_at: string;
  children: { id: string; name: string; division: string } | null;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    dishes: { id: string; name: string; category: string } | null;
  }[];
};

type MonthGroup = {
  key: string;       // e.g. "June 2026"
  year: number;
  month: number;     // 0-indexed
  orders: Order[];
};

function getMonthGroups(orders: Order[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const order of orders) {
    const d = new Date(order.order_date + 'T12:00:00');
    const key = format(d, 'MMMM yyyy');
    if (!map.has(key)) {
      map.set(key, { key, year: d.getFullYear(), month: d.getMonth(), orders: [] });
    }
    map.get(key)!.orders.push(order);
  }
  return Array.from(map.values());
}

function sortMonths(groups: MonthGroup[], currentYear: number, currentMonth: number): MonthGroup[] {
  return [...groups].sort((a, b) => {
    const aIsCurrent = a.year === currentYear && a.month === currentMonth;
    const bIsCurrent = b.year === currentYear && b.month === currentMonth;
    if (aIsCurrent) return -1;
    if (bIsCurrent) return 1;
    // Most recent first for the rest
    const aDate = a.year * 100 + a.month;
    const bDate = b.year * 100 + b.month;
    return bDate - aDate;
  });
}

export default function OrdersClient({ orders: initialOrders, creditBalance, lockedCredit = 0 }: { orders: Order[]; creditBalance: number; lockedCredit?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const today = now.toISOString().split('T')[0];

  // Derive available years
  const allYears = Array.from(
    new Set(initialOrders.map(o => new Date(o.order_date + 'T12:00:00').getFullYear()))
  ).sort((a, b) => b - a);

  if (!allYears.includes(currentYear)) allYears.unshift(currentYear);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set([format(now, 'MMMM yyyy')]));
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!mounted) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filter by selected year
  const yearOrders = initialOrders.filter(
    o => new Date(o.order_date + 'T12:00:00').getFullYear() === selectedYear
  );

  const allGroups = getMonthGroups(yearOrders);
  const sortedGroups = sortMonths(allGroups, currentYear, currentMonth);

  // Stats for selected year
  const paidOrders = yearOrders.filter(o => o.status === 'paid');
  const pendingOrders = yearOrders.filter(o => o.status === 'pending' && o.order_date > today);
  const totalSpent = paidOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const pendingTotal = pendingOrders.reduce((s, o) => s + Number(o.total_amount), 0);

  function toggleMonth(key: string) {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handlePayPending(orderIds: string[]) {
    if (orderIds.length === 0) return;
    setLoadingAction('pay-' + orderIds[0]);
    try {
      const res = await fetch('/api/orders/pay-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: orderIds }),
      });
      const data = await res.json();
      if (data.stripe_url) {
        window.location.href = data.stripe_url;
      } else if (data.success) {
        startTransition(() => router.refresh());
      } else {
        alert(data.error || 'Failed to start payment');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleCancel(orderId: string, isPaid: boolean) {
    const msg = isPaid
      ? 'Cancel this order? The full amount will be refunded as store credit.'
      : 'Cancel this pending order?';
    if (!confirm(msg)) return;

    setLoadingAction('cancel-' + orderId);
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.refund_amount > 0) {
          alert(`Order cancelled. $${data.refund_amount.toFixed(2)} credit added to your account.`);
        }
        startTransition(() => router.refresh());
      } else {
        alert(data.error || 'Failed to cancel order');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  }

  function canCancel(order: Order): boolean {
    if (!['paid', 'pending'].includes(order.status)) return false;
    const orderDate = new Date(order.order_date + 'T12:00:00');
    const twoDaysAhead = new Date(now);
    twoDaysAhead.setDate(twoDaysAhead.getDate() + 2);
    twoDaysAhead.setHours(0, 0, 0, 0);
    return orderDate >= twoDaysAhead;
  }

  function isExpiredPending(order: Order): boolean {
    return order.status === 'pending' && order.order_date <= today;
  }

  if (initialOrders.length === 0) {
    return (
      <div className="bg-card border rounded-2xl p-16 text-center shadow-sm">
        <ShoppingBag className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No orders yet</h2>
        <p className="text-muted-foreground mb-6">Start ordering lunch for your child!</p>
        <a href="/menu" className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors">
          Order Lunch →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Orders</p>
          <p className="text-2xl font-extrabold mt-1">{yearOrders.length}</p>
        </div>
        <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Confirmed</p>
          <p className="text-2xl font-extrabold mt-1 text-green-600">{paidOrders.length}</p>
        </div>
        <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending Due</p>
          <p className="text-2xl font-extrabold mt-1 text-yellow-600">${pendingTotal.toFixed(2)}</p>
        </div>
        <div className={`bg-card border rounded-2xl px-4 py-3 shadow-sm ${creditBalance > 0 ? 'border-green-300 bg-green-50' : ''}`}>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Account Credit</p>
          <p className={`text-2xl font-extrabold mt-1 ${creditBalance > 0 ? 'text-green-600' : ''}`}>${creditBalance.toFixed(2)}</p>
          {lockedCredit > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
              (${lockedCredit.toFixed(2)} reserved for pending)
            </p>
          )}
          {creditBalance > 0 && <p className="text-xs text-green-600 font-medium mt-0.5">Auto-applied at checkout</p>}
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Year:</span>
        {allYears.map(yr => (
          <button
            key={yr}
            onClick={() => setSelectedYear(yr)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              selectedYear === yr
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            {yr}
          </button>
        ))}
      </div>

      {/* Month Groups */}
      {sortedGroups.length === 0 ? (
        <div className="bg-card border rounded-2xl p-10 text-center text-muted-foreground">
          No orders in {selectedYear}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(group => {
            const isExpanded = expandedMonths.has(group.key);
            const isCurrentMonth = group.year === currentYear && group.month === currentMonth;
            const monthPending = group.orders.filter(o => o.status === 'pending' && o.order_date > today);
            const monthPendingIds = monthPending.map(o => o.id);
            const monthPendingGross = monthPending.reduce((s, o) => s + Number(o.gross_amount), 0);
            const monthPendingCreditUsed = monthPending.reduce((s, o) => s + Number(o.credit_used || 0), 0);
            const monthPendingTotal = monthPending.reduce((s, o) => s + Number(o.total_amount), 0);
            const isPayLoading = loadingAction === 'pay-' + (monthPendingIds[0] ?? '');


            return (
              <div key={group.key} className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                {/* Month Header */}
                <div className={`flex items-center justify-between px-5 py-4 ${isCurrentMonth ? 'bg-primary/5 border-b border-primary/10' : 'bg-muted/20 border-b'}`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleMonth(group.key)}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      }
                      <h3 className="text-lg font-extrabold tracking-tight">
                        {group.key}
                        {isCurrentMonth && (
                          <span className="ml-2 text-xs font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full align-middle">
                            Current
                          </span>
                        )}
                      </h3>
                    </button>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {group.orders.length} order{group.orders.length !== 1 ? 's' : ''}
                    </span>
                    {monthPending.length > 0 && (
                      <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full">
                        {monthPending.length} pending
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {monthPending.length > 0 && (
                      <div className="flex flex-col items-end gap-0.5">
                        {monthPendingCreditUsed > 0 && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            ${monthPendingGross.toFixed(2)} - <span className="text-green-600">${monthPendingCreditUsed.toFixed(2)} credit</span>
                          </span>
                        )}
                        <button
                          onClick={() => handlePayPending(monthPendingIds)}
                          disabled={isPayLoading || isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold transition-colors disabled:opacity-60 shadow"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          {isPayLoading ? 'Processing…' : `Pay $${monthPendingTotal.toFixed(2)}`}
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => toggleMonth(group.key)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Orders List */}
                {isExpanded && (
                  <div className="divide-y">
                    {group.orders
                      .sort((a, b) => a.order_date.localeCompare(b.order_date))
                      .map(order => {
                        const expired = isExpiredPending(order);
                        const effectiveStatus = expired ? 'expired' : order.status;
                        const cfg = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                        const Icon = cfg.icon;
                        const showCancel = canCancel(order);
                        const isCancelLoading = loadingAction === 'cancel-' + order.id;

                        return (
                          <div key={order.id} className={`px-5 py-4 ${expired ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-bold">{order.children?.name}</span>
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                    {order.children?.division}
                                  </span>
                                  <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.color}`}>
                                    <Icon className="w-3 h-3" />
                                    {cfg.label}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Lunch for{' '}
                                  <strong>
                                    {format(new Date(order.order_date + 'T12:00:00'), 'EEEE, MMM d')}
                                  </strong>
                                  {' · '}Ordered {format(new Date(order.created_at), 'MMM d, yyyy')}
                                </p>

                                {/* Items */}
                                <div className="mt-2 space-y-1">
                                  {order.order_items.map(item => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm">
                                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                        {item.quantity}
                                      </span>
                                      <span className="flex-1 text-muted-foreground">{item.dishes?.name || 'Unknown dish'}</span>
                                      <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 bg-muted rounded-full">
                                        {item.dishes?.category}
                                      </span>
                                      <span className="font-semibold text-xs">${Number(item.total_price).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Right: amount + actions */}
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <p className="text-lg font-extrabold">${Number(order.total_amount).toFixed(2)}</p>

                                <div className="flex items-center gap-1.5">
                                  {/* Pay this individual pending order */}
                                  {order.status === 'pending' && !expired && (
                                    <button
                                      onClick={() => handlePayPending([order.id])}
                                      disabled={!!loadingAction || isPending}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                                    >
                                      <CreditCard className="w-3 h-3" />
                                      Pay
                                    </button>
                                  )}

                                  {/* Cancel */}
                                  {showCancel && (
                                    <button
                                      onClick={() => handleCancel(order.id, order.status === 'paid')}
                                      disabled={isCancelLoading || isPending}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-colors disabled:opacity-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      {isCancelLoading ? '…' : 'Cancel'}
                                    </button>
                                  )}
                                </div>

                                {order.status === 'paid' && showCancel && (
                                  <p className="text-xs text-muted-foreground text-right">
                                    Cancel = store credit
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
