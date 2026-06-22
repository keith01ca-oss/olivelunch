import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getOrResolveOrgId } from '@/lib/auth';

type Context = { params: { id: string } };

// DELETE /api/admin/menus/[id]
export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const orgId = await getOrResolveOrgId();
    if (!orgId) return NextResponse.json({ error: 'Organization context missing' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('menus')
      .delete()
      .eq('id', params.id)
      .eq('org_id', orgId); // Safety check

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
