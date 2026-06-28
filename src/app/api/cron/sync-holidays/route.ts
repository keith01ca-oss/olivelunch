import { NextRequest, NextResponse } from 'next/server';
import { syncBCHolidays } from '@/lib/holidays';

export async function GET(req: NextRequest) {
  // 1. Authorization check
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('sync-holidays cron: Unauthorized attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Call holiday sync
  try {
    const res = await syncBCHolidays();
    
    if (res && res.error) {
      console.error('syncBCHolidays cron error:', res.error);
      return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }

    console.log('sync-holidays cron: Public holidays synced successfully');
    return NextResponse.json({
      success: true,
      message: 'Public holidays synced successfully'
    });
  } catch (err) {
    console.error('syncBCHolidays cron unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error during sync' }, { status: 500 });
  }
}
