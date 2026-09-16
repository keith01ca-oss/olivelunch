import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRoute, getOrResolveOrgId } from '@/lib/auth';
import { sendDailyOrderSummaryEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authErr = await verifyAdminRoute();
  if (authErr) {
    return NextResponse.json({ error: authErr.error }, { status: authErr.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orgId = await getOrResolveOrgId();
    const { date, force = false } = body;

    const result = await sendDailyOrderSummaryEmail({
      targetDate: date || undefined,
      orgId,
      force: Boolean(force)
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Test daily summary error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
