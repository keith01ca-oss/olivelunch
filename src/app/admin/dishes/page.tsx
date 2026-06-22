import { supabaseAdmin } from '@/lib/supabase';
import DishesClient from '@/components/admin/DishesClient';
import { getOrResolveOrgId } from '@/lib/auth';

export default async function AdminDishesPage() {
  const orgId = await getOrResolveOrgId();

  const { data: dishes } = await supabaseAdmin
    .from('dishes')
    .select('*')
    .is('deleted_at', null)
    .eq('org_id', orgId)
    .order('category')
    .order('sort_order', { ascending: true });

  const { data: org } = await supabaseAdmin.from('organizations').select('settings').eq('id', orgId).single();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Manage Dishes & Recipes</h1>
          <p className="text-muted-foreground mt-1">Add, edit, and manage your menu items, recipes, and costs.</p>
        </div>
      </div>
      <DishesClient initialDishes={dishes || []} orgSettings={org?.settings} />
    </div>
  );
}
