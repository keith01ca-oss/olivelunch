import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type Context = { params: { id: string } };

// PUT /api/admin/dishes/[id] - Update a dish
export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const body = await req.json();
    const { name, category, price_regular, price_vip, is_active, sort_order, recipe_url, ingredients, instructions, overhead_costs, prep_time_minutes, cook_time_minutes, pack_time_seconds } = body;

    const { data: dish, error } = await supabaseAdmin
      .from('dishes')
      .update({ 
        name, 
        category, 
        price_regular, 
        price_vip, 
        is_active, 
        sort_order, 
        recipe_url, 
        ingredients: ingredients || [],
        instructions: instructions || null,
        overhead_costs: overhead_costs || [],
        prep_time_minutes: prep_time_minutes || 0,
        cook_time_minutes: cook_time_minutes || 0,
        pack_time_seconds: pack_time_seconds || 0
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ dish });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/dishes/[id] - Soft delete a dish
export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const { error } = await supabaseAdmin
      .from('dishes')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
