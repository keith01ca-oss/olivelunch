import { supabaseAdmin } from '@/lib/supabase';
import OrdersClient from '@/components/admin/OrdersClient';

import { getOrResolveOrgId } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { date?: string; status?: string };
}) {
  const dateFilter = searchParams.date || '';
  const statusFilter = searchParams.status || '';
  const orgId = await getOrResolveOrgId();

  let query = supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_date,
      status,
      gross_amount,
      total_amount,
      created_at,
      children ( 
        id, 
        name, 
        division,
        schools (
          id,
          name,
          school_routes (
            stop_order,
            routes (
              id,
              route_number
            )
          )
        )
      ),
      parents ( id, name, email ),
      order_items (
        id,
        quantity,
        unit_price,
        total_price,
        is_large,
        dishes ( id, name, category, has_large, large_name )
      )
    `)
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (dateFilter) query = query.eq('order_date', dateFilter);
  if (statusFilter) query = query.eq('status', statusFilter);

  const [
    { data: orders, error },
    { data: dishes },
    { data: children }
  ] = await Promise.all([
    query,
    supabaseAdmin.from('dishes').select('id, name, category, price_regular, price_vip, has_large, large_name, large_price_regular, large_price_vip').eq('is_active', true).is('deleted_at', null).eq('org_id', orgId),
    supabaseAdmin.from('children').select('id, name, division, parent_id, schools(name), parents!inner(name, is_vip, org_id)').eq('parents.org_id', orgId)
  ]);

  if (error) console.error('Orders fetch error:', error);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">View and manage all lunch orders.</p>
      </div>
      <OrdersClient 
        initialOrders={(orders || []) as any} 
        orgId={orgId}
        dishes={dishes || []}
        childrenList={children || []}
      />
    </div>
  );
}
