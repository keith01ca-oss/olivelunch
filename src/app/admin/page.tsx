import { supabaseAdmin } from '@/lib/supabase';
import { UtensilsCrossed, ShoppingBag, Users } from 'lucide-react';
import { getOrResolveOrgId } from '@/lib/auth';

export default async function AdminPage() {
  const orgId = await getOrResolveOrgId();

  // Build org-aware queries
  const dishQ = supabaseAdmin.from('dishes').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
  const orderQ = supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
  const parentQ = supabaseAdmin.from('parents').select('*', { count: 'exact', head: true }).eq('org_id', orgId);
  const recentQ = supabaseAdmin.from('orders').select('*, children(name), parents(name)').eq('status', 'paid').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5);

  const [{ count: dishCount }, { count: orderCount }, { count: parentCount }, { data: recentOrders }] = await Promise.all([
    dishQ, orderQ, parentQ, recentQ
  ]);

  const stats = [
    { label: 'Total Dishes', value: dishCount || 0, icon: UtensilsCrossed, color: 'text-primary bg-primary/10' },
    { label: 'Total Orders', value: orderCount || 0, icon: ShoppingBag, color: 'text-blue-600 bg-blue-100' },
    { label: 'Registered Parents', value: parentCount || 0, icon: Users, color: 'text-purple-600 bg-purple-100' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Olive Lunch Admin Overview</h1>
        <p className="text-muted-foreground mt-1">Central control center for Olive Lunch kitchen operations.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card border rounded-2xl p-6 shadow-sm">
              <div className={`inline-flex p-3 rounded-xl ${stat.color} mb-4`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-3xl font-extrabold">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold">Recent Paid Orders</h2>
        </div>
        {!recentOrders || recentOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No paid orders yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-6 py-3 font-semibold">Parent</th>
                <th className="px-6 py-3 font-semibold">Child</th>
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Amount</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentOrders.map((order: any) => (
                <tr key={order.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4">{order.parents?.name || 'Unknown'}</td>
                  <td className="px-6 py-4">{order.children?.name || 'Unknown'}</td>
                  <td className="px-6 py-4">{order.order_date}</td>
                  <td className="px-6 py-4 font-bold">${Number(order.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold capitalize">
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
