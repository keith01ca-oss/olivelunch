import { NextRequest, NextResponse } from 'next/server';
import { syncBCHolidays } from '@/lib/holidays';

export async function GET(req: NextRequest) {
  // 1. Authorization check
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Call holiday sync
  const res = await syncBCHolidays();
  
  if (res.error) {
    console.error('syncBCHolidays cron error:', res.error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Public holidays synced successfully'
  });
}
