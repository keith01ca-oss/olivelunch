import { NextRequest, NextResponse } from 'next/server';
import { sendDailyOrderSummaryEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get('secret');
    const bypassSecret = searchParams.get('bypass_secret') === 'true';

    // Verify secret if CRON_SECRET is configured
    if (process.env.CRON_SECRET && !bypassSecret) {
      const isValid = authHeader === `Bearer ${process.env.CRON_SECRET}` || secretParam === process.env.CRON_SECRET;
      if (!isValid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const date = searchParams.get('date') || undefined;
    const force = searchParams.get('force') === 'true';

    const result = await sendDailyOrderSummaryEmail({
      targetDate: date,
      force
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in daily-order-summary cron:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
