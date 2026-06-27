'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { getResolvedParent } from '@/lib/auth';

async function verifyAdmin() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) throw new Error('Unauthorized');
  
  const allowedIds = (process.env.ADMIN_CLERK_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  const isSuperAdmin = allowedIds.length > 0 && allowedIds.includes(authContext.clerkUserId);
  if (!isSuperAdmin) {
    throw new Error('Forbidden');
  }
  return authContext;
}

export async function getReportData(startDate: string, endDate: string) {
  await verifyAdmin();

  // Query paid orders in date range
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_date,
      status,
      gross_amount,
      credit_used,
      total_amount,
      created_at,
      children ( id, name, division, schools ( name ) ),
      order_items (
        id,
        quantity,
        unit_price,
        total_price,
        is_large,
        dishes ( id, name, category, ingredients )
      )
    `)
    .gte('order_date', startDate)
    .lte('order_date', endDate)
    .eq('status', 'paid');

  if (error) {
    console.error('getReportData error:', error);
    throw new Error('Failed to fetch report data');
  }

  return { orders: (orders as any) || [] };
}

export async function getOutstandingCredits() {
  await verifyAdmin();

  // Get total credits by parent
  const { data: creditSums, error: creditError } = await supabaseAdmin
    .from('credits')
    .select('parent_id, amount');

  if (creditError) {
    console.error('getOutstandingCredits error:', creditError);
    throw new Error('Failed to fetch credits');
  }

  // Aggregate credits in JS
  const creditMap = new Map<string, number>();
  for (const c of creditSums || []) {
    const parentId = c.parent_id;
    const amount = Number(c.amount) || 0;
    creditMap.set(parentId, (creditMap.get(parentId) || 0) + amount);
  }

  // Fetch parents details
  const { data: parents, error: parentsError } = await supabaseAdmin
    .from('parents')
    .select('id, name, email');

  if (parentsError) {
    console.error('getOutstandingCredits parents error:', parentsError);
    throw new Error('Failed to fetch parents');
  }

  const result = parents
    .map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      balance: Math.round((creditMap.get(p.id) || 0) * 100) / 100
    }))
    .filter(p => p.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  return result;
}
