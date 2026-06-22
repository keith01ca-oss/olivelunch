import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getResolvedParent } from '@/lib/auth';

type Context = { params: { id: string } };

export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const authContext = await getResolvedParent();
    if ('error' in authContext) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const allowedIds = (process.env.ADMIN_CLERK_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    if (allowedIds.length > 0 && !allowedIds.includes(authContext.clerkUserId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, settings } = body;

    if (!name && !slug && !settings) {
      return NextResponse.json({ error: 'No data provided to update' }, { status: 400 });
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (slug) updates.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (settings !== undefined) updates.settings = settings;

    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'This slug is already taken.' }, { status: 400 });
      throw error;
    }

    return NextResponse.json({ org });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
