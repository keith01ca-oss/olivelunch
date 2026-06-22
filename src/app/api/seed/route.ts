import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    // Only block if dishes already seeded (unless force=1 is passed)
    const { data: existingDishes } = await supabaseAdmin.from('dishes').select('id').limit(1);
    if (!force && existingDishes && existingDishes.length > 0) {
      return NextResponse.json({ message: 'Dishes already seeded! Visit /api/seed?force=1 to re-seed.' });
    }

    // Clear existing dishes if forcing
    if (force) {
      await supabaseAdmin.from('dishes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Insert Schools (only if none exist)
    const { data: existingSchools } = await supabaseAdmin.from('schools').select('id').limit(1);
    let schools: any[] = existingSchools || [];

    if (schools.length === 0) {
      const { data: newSchools, error: schoolErr } = await supabaseAdmin
        .from('schools')
        .insert([
          { name: 'Olive Elementary School' },
          { name: 'Maple Secondary School' },
        ])
        .select();
      if (schoolErr) throw schoolErr;
      schools = newSchools || [];

      // Insert a Route and link schools
      const { data: route, error: routeErr } = await supabaseAdmin
        .from('routes')
        .insert({ route_number: 'Route A' })
        .select()
        .single();
      if (routeErr) throw routeErr;

      await supabaseAdmin.from('school_routes').insert([
        { school_id: schools[0].id, route_id: route.id },
        { school_id: schools[1].id, route_id: route.id },
      ]);
    }

    // Insert Dishes
    const { error: dishErr } = await supabaseAdmin.from('dishes').insert([
      // Main
      { name: 'Signature of the Day', category: 'main', price_regular: 7.50, price_vip: 6.50, is_active: true },
      // Sides
      { name: 'Garden Salad',         category: 'side',  price_regular: 2.00, price_vip: 1.50, is_active: true },
      { name: 'Fruit Cup',            category: 'side',  price_regular: 2.00, price_vip: 1.50, is_active: true },
      { name: 'Yogurt',               category: 'side',  price_regular: 1.50, price_vip: 1.25, is_active: true },
      { name: 'Roasted Vegetables',   category: 'side',  price_regular: 2.00, price_vip: 1.50, is_active: true },
      { name: 'Soup of the Day',      category: 'side',  price_regular: 2.50, price_vip: 2.00, is_active: true },
      // Snacks
      { name: 'Cookies',              category: 'snack', price_regular: 1.50, price_vip: 1.25, is_active: true },
      // Drinks
      { name: 'Apple Juice',          category: 'drink', price_regular: 2.00, price_vip: 1.75, is_active: true },
      { name: 'Milk',                 category: 'drink', price_regular: 1.50, price_vip: 1.25, is_active: true },
      { name: 'Water',                category: 'drink', price_regular: 1.00, price_vip: 1.00, is_active: true },
    ]);

    if (dishErr) throw dishErr;

    return NextResponse.json({ message: 'Successfully seeded dishes! Refresh the Menu page to see them.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
