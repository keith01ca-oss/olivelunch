import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import MenuOrderClient from '@/components/menu/MenuOrderClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MenuPage({ searchParams }: { searchParams: { child?: string } }) {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const orgId = await getOrResolveOrgId();

  // Fetch Org Settings
  let showWeekends = false;
  const { data: orgData } = await supabaseAdmin.from('organizations').select('settings').eq('id', orgId).single();
  if (orgData?.settings?.show_weekends) {
    showWeekends = true;
  }

  // Fetch parent to check VIP
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('is_vip')
    .eq('id', authContext.parentId)
    .single();

  // Fetch children
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('*')
    .eq('parent_id', authContext.parentId)
    .is('deleted_at', null);

  if (!children || children.length === 0) {
    redirect('/children/new');
  }

  // Fetch active dishes
  const { data: dishes } = await supabaseAdmin
    .from('dishes')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .eq('org_id', orgId)
    .order('category')
    .order('sort_order', { ascending: true });

  // Fetch blocked dates, pro-d dates & warnings
  const { data: blockedDates } = await supabaseAdmin
    .from('blocked_dates')
    .select('*')
    .eq('org_id', orgId);
  const { data: prodDates } = await supabaseAdmin.from('pro_d_ranges').select('*');
  const { data: dateWarnings } = await supabaseAdmin.from('date_warnings').select('*');

  // Fetch scheduled menus — only future dates to avoid hitting the 1000-row default limit
  const todayStr = new Date().toISOString().slice(0, 10);
  const farFutureStr = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: scheduledMenus } = await supabaseAdmin
    .from('menus')
    .select('date, dish_id')
    .eq('org_id', orgId)
    .gte('date', todayStr)
    .lte('date', farFutureStr)
    .limit(10000);

  // Fetch existing orders to show what is already ordered
  const { data: existingOrders } = await supabaseAdmin
    .from('orders')
    .select(`
      id, 
      child_id, 
      order_date, 
      status,
      order_items ( id, quantity, dishes ( id, name, category ) )
    `)
    .eq('parent_id', authContext.parentId)
    .eq('status', 'paid');

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Order Lunch</h1>
        <p className="text-muted-foreground mt-1">Select dates and meals for your child.</p>
      </div>

      <MenuOrderClient 
        childrenList={children || []} 
        dishes={dishes || []} 
        blockedDates={blockedDates || []}
        prodDates={prodDates || []}
        dateWarnings={dateWarnings || []}
        isVip={parent?.is_vip || false}
        initialChildId={searchParams.child}
        existingOrders={existingOrders || []}
        scheduledMenus={scheduledMenus || []}
        showWeekends={showWeekends}
      />
    </div>
  );
}
