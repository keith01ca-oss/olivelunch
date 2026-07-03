import { supabaseAdmin } from '@/lib/supabase';
import ParentsClient from '@/components/admin/ParentsClient';
import { getOrResolveOrgId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminParentsPage() {
  const orgId = await getOrResolveOrgId();

  // Fetch parents who have placed orders in this org — this scopes the list to the current org
  const { data: orgOrderParentIds } = await supabaseAdmin
    .from('orders')
    .select('parent_id')
    .eq('org_id', orgId);
  const parentIdSet = new Set((orgOrderParentIds || []).map((o: any) => o.parent_id));

  // Fetch all parents with children count, credit balance, and order count
  let parentsQuery = supabaseAdmin
    .from('parents')
    .select(`
      id,
      name,
      email,
      phone,
      is_vip,
      referral_code,
      created_at,
      children ( id ),
      credits ( amount ),
      orders ( id, status, org_id )
    `)
    .order('created_at', { ascending: false });

  const { data: parents } = await parentsQuery;

  // Filter client-side to only show parents who belong to this org
  const filteredParents = (parents || []).filter(p => parentIdSet.has(p.id));

  const enriched = filteredParents.map(p => ({
    ...p,
    childrenCount: p.children?.length || 0,
    creditBalance: (p.credits || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0),
    totalOrders: ((p.orders || []) as any[]).filter((o: any) => o.org_id === orgId).length,
    paidOrders: ((p.orders || []) as any[]).filter((o: any) => o.org_id === orgId && o.status === 'paid').length,
  }));

  return <ParentsClient parents={enriched} />;
}
