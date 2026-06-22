import { getResolvedParent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { CheckCircle, Clock, XCircle, RefreshCcw, ShoppingBag } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_CONFIG = {
  paid:      { label: 'Paid',      color: 'bg-green-100 text-green-700 border border-green-200', icon: CheckCircle },
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700 border border-yellow-200', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 border border-red-200', icon: XCircle },
  refunded:  { label: 'Refunded',  color: 'bg-blue-100 text-blue-700 border border-blue-200', icon: RefreshCcw },
};

export default async function ParentOrdersPage() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_date,
      status,
      gross_amount,
      total_amount,
      created_at,
      children ( id, name, division ),
      order_items (
        id,
        quantity,
        unit_price,
        total_price,
        dishes ( id, name, category )
      )
    `)
    .eq('parent_id', authContext.parentId)
    .order('order_date', { ascending: false });

  const paidOrders = orders?.filter(o => o.status === 'paid') || [];
  const pendingOrders = orders?.filter(o => o.status === 'pending') || [];
  const totalSpent = paidOrders.reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">My Orders</h1>
        <p className="text-muted-foreground mt-1">View all your lunch orders and their status.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Orders</p>
          <p className="text-2xl font-extrabold mt-1">{orders?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Confirmed</p>
          <p className="text-2xl font-extrabold mt-1 text-green-600">{paidOrders.length}</p>
        </div>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="bg-card border rounded-2xl p-16 text-center shadow-sm">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No orders yet</h2>
          <p className="text-muted-foreground mb-6">Start ordering lunch for your child!</p>
          <Link href="/menu" className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors">
            Order Lunch →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const cfg = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div key={order.id} className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                {/* Order Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{order.children?.name}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{order.children?.division}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Lunch for <strong>{order.order_date}</strong> · Ordered {format(new Date(order.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-extrabold">${Number(order.total_amount).toFixed(2)}</p>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-6 py-4 space-y-2">
                  {order.order_items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 text-sm">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">{item.quantity}</span>
                      <span className="flex-1 font-medium">{item.dishes?.name || 'Unknown dish'}</span>
                      <span className="text-xs text-muted-foreground capitalize px-2 py-0.5 bg-muted rounded-full">{item.dishes?.category}</span>
                      <span className="font-semibold text-sm">${Number(item.total_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
