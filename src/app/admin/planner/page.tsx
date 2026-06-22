import { supabaseAdmin } from '@/lib/supabase';
import PlannerClient from '@/components/admin/PlannerClient';
import { getOrResolveOrgId } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPlannerPage() {
  const orgId = await getOrResolveOrgId();

  // Fetch active dishes
  const { data: dishes } = await supabaseAdmin
    .from('dishes')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .eq('org_id', orgId)
    .order('category')
    .order('sort_order', { ascending: true });
  
  // Fetch blocked dates to display them on the calendar
  const { data: blockedDates } = await supabaseAdmin
    .from('blocked_dates')
    .select('*')
    .eq('org_id', orgId);

  // Fetch Org Settings
  const { data: orgData } = await supabaseAdmin.from('organizations').select('id, settings').eq('id', orgId).single();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Menu Planner</h1>
        <p className="text-muted-foreground mt-1">Drag and drop dishes onto the calendar to schedule your daily menus.</p>
      </div>

      <PlannerClient 
        initialDishes={dishes || []} 
        blockedDates={blockedDates || []}
        org={orgData}
      />
    </div>
  );
}
