import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRoute, getOrResolveOrgId } from '@/lib/auth';
import { parseAvery5160Pdf } from '@/lib/pdf-label-parser';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authErr = await verifyAdminRoute();
  if (authErr) {
    return NextResponse.json({ error: authErr.error }, { status: authErr.status });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the PDF
    const result = await parseAvery5160Pdf(buffer);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to parse PDF' }, { status: 422 });
    }

    // Also fetch registered schools from database to assist user in mapping
    const orgId = await getOrResolveOrgId();
    const { data: schools } = await supabaseAdmin
      .from('schools')
      .select('id, name')
      .eq('is_active', true)
      .eq('org_id', orgId)
      .order('name');

    return NextResponse.json({
      ...result,
      registeredSchools: (schools || []).map(s => s.name),
      fileName: file.name,
    });
  } catch (err: any) {
    console.error('Labels parse error:', err);
    return NextResponse.json({ error: err.message || 'Server error parsing labels' }, { status: 500 });
  }
}
