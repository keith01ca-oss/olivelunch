import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseISO, endOfMonth, format } from 'date-fns';
import { getOrResolveOrgId } from '@/lib/auth';

// GET /api/admin/menus?month=YYYY-MM
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // e.g. 2024-10
  const orgId = await getOrResolveOrgId();

  if (!orgId) return NextResponse.json({ error: 'Organization context missing' }, { status: 400 });

  let query = supabaseAdmin
    .from('menus')
    .select('*, dishes(name, category, price_regular)')
    .eq('org_id', orgId);

  if (month) {
    // Filter by date range for the month
    try {
      const startDate = `${month}-01`;
      const endDate = format(endOfMonth(parseISO(startDate)), 'yyyy-MM-dd');
      query = query.gte('date', startDate).lte('date', endDate);
    } catch (e) {
      // ignore invalid month formats
    }
  }

  const { data: menus, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ menus });
}

// POST /api/admin/menus
// Body: { date: '2024-10-15', dish_id: '...' }
export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrResolveOrgId();
    if (!orgId) return NextResponse.json({ error: 'Organization context missing' }, { status: 400 });

    const body = await req.json();
    
    // Bulk Insert Mode
    if (Array.isArray(body.items)) {
      if (body.items.length === 0) return NextResponse.json({ menus: [] });
      
      const inserts = body.items.map((item: any) => ({
        org_id: orgId,
        date: item.date,
        dish_id: item.dish_id
      }));

      const { data: menus, error } = await supabaseAdmin
        .from('menus')
        .insert(inserts)
        .select('*, dishes(name, category, price_regular)');

      if (error) throw error;
      return NextResponse.json({ menus });
    }

    // Single Insert Mode
    const { date, dish_id } = body;

    if (!date || !dish_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: menu, error } = await supabaseAdmin
      .from('menus')
      .insert({ org_id: orgId, date, dish_id })
      .select('*, dishes(name, category, price_regular)')
      .single();

    if (error) throw error;
    return NextResponse.json({ menu });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/menus?month=YYYY-MM&dish_ids=id1,id2
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const dishIdsParam = searchParams.get('dish_ids');
  const orgId = await getOrResolveOrgId();

  if (!orgId) return NextResponse.json({ error: 'Organization context missing' }, { status: 400 });
  if (!month) return NextResponse.json({ error: 'Month parameter missing' }, { status: 400 });

  try {
    const startDate = `${month}-01`;
    const endDate = format(endOfMonth(parseISO(startDate)), 'yyyy-MM-dd');

    let query = supabaseAdmin
      .from('menus')
      .delete()
      .eq('org_id', orgId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (dishIdsParam) {
      const dishIds = dishIdsParam.split(',');
      query = query.in('dish_id', dishIds);
    }

    const { error } = await query;

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
