import { supabaseAdmin } from '@/lib/supabase';
import KitchenClient from '@/components/admin/KitchenClient';
import { getOrResolveOrgId } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KitchenPrepPage({ searchParams }: { searchParams: { date?: string, tab?: string } }) {
  const orgId = await getOrResolveOrgId();

  // Fetch active dishes for mapping
  const { data: dishes } = await supabaseAdmin
    .from('dishes')
    .select('id, name, category, recipe_url, ingredients, prep_time_minutes, cook_time_minutes, pack_time_seconds')
    .eq('is_active', true)
    .is('deleted_at', null)
    .eq('org_id', orgId);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-3xl font-extrabold tracking-tight">Kitchen Prep</h1>
        <p className="text-muted-foreground mt-1">Calculate daily meal and ingredient totals.</p>
      </div>
      
      <KitchenClient initialDishes={dishes || []} initialDate={searchParams.date} initialTab={searchParams.tab as any} />
    </div>
  );
}
