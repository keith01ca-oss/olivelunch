import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getOrResolveOrgId } from '@/lib/auth';

// GET /api/admin/kitchen?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const orgId = await getOrResolveOrgId();

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  try {
    // Fetch all paid orders for the specified date
    let query = supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_date,
        order_items (
          dish_id,
          quantity,
          delivery_area
        ),
        children (
          name,
          division,
          delivery_location,
          lunch_time,
          schools (
            name,
            school_routes(stop_order, routes(route_number))
          )
        )
      `)
      .eq('order_date', date)
      .eq('status', 'paid')
      .eq('org_id', orgId);
    const { data: orders, error } = await query;

    if (error) throw error;

    return NextResponse.json({ orders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
