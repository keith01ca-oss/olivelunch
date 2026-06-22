import { supabaseAdmin } from '@/lib/supabase';
import ParentsClient from '@/components/admin/ParentsClient';

export const dynamic = 'force-dynamic';

export default async function AdminParentsPage() {
  // Fetch all parents with children count, credit balance, and order count
  const { data: parents } = await supabaseAdmin
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
      orders ( id, status )
    `)
    .order('created_at', { ascending: false });

  const enriched = (parents || []).map(p => ({
    ...p,
    childrenCount: p.children?.length || 0,
    creditBalance: (p.credits || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0),
    totalOrders: (p.orders || []).length,
    paidOrders: (p.orders || []).filter((o: any) => o.status === 'paid').length,
  }));

  return <ParentsClient parents={enriched} />;
}
