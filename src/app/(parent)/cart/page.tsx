import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import CartClient from '@/components/parent/CartClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CartPage() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const orgId = await getOrResolveOrgId();

  // Fetch children
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('*')
    .eq('parent_id', authContext.parentId || '')
    .is('deleted_at', null);

  // Fetch active dishes
  const { data: dishes } = await supabaseAdmin
    .from('dishes')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .eq('org_id', orgId);

  // Fetch parent details for credits and VIP status
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('is_vip, id')
    .eq('id', authContext.parentId || '')
    .single();

  // Fetch parent's total credit balance
  const { data: credits } = await supabaseAdmin
    .from('credits')
    .select('amount')
    .eq('parent_id', authContext.parentId || '');

  const totalCredit = (credits || []).reduce((sum, c) => sum + Number(c.amount), 0);

  // Fetch existing orders to check for duplicate order warnings on same dates
  const { data: existingOrders } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      child_id,
      order_date,
      status,
      order_items ( id, quantity, dishes ( id, name ) )
    `)
    .eq('parent_id', authContext.parentId || '')
    .eq('status', 'paid');

  return (
    <div className="w-full">
      <CartClient
        childrenList={children || []}
        dishes={dishes || []}
        isVip={parent?.is_vip || false}
        totalCredit={totalCredit}
        existingOrders={existingOrders || []}
      />
    </div>
  );
}
