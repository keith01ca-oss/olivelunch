import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getOrResolveOrgId } from '@/lib/auth';

// POST /api/admin/dishes - Create a new dish
export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrResolveOrgId();
    if (!orgId) return NextResponse.json({ error: 'Organization context missing' }, { status: 400 });

    const body = await req.json();
    const { name, category, price_regular, price_vip, is_active, sort_order, recipe_url, ingredients, instructions, overhead_costs, prep_time_minutes, cook_time_minutes, pack_time_seconds } = body;

    if (!name || !category || price_regular == null || price_vip == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: dish, error } = await supabaseAdmin
      .from('dishes')
      .insert({ 
        org_id: orgId, 
        name, 
        category, 
        price_regular, 
        price_vip, 
        is_active: is_active ?? true, 
        sort_order: sort_order ?? 0, 
        recipe_url, 
        ingredients: ingredients || [],
        instructions: instructions || null,
        overhead_costs: overhead_costs || [],
        prep_time_minutes: prep_time_minutes || 0,
        cook_time_minutes: cook_time_minutes || 0,
        pack_time_seconds: pack_time_seconds || 0
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ dish });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
