import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

// Called by Vercel Cron on September 1 at 8 AM UTC (1 AM Pacific)
// Schedule: 0 8 1 9 * (see vercel.json)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id, stripe_subscription_id')
    .eq('is_vip', true)
    .eq('vip_paused', true)
    .not('stripe_subscription_id', 'is', null);

  if (error) {
    console.error('VIP resume cron: DB error', error);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  let resumed = 0;
  let failed = 0;

  for (const parent of parents || []) {
    try {
      // Setting pause_collection to '' removes the pause
      await stripe.subscriptions.update(parent.stripe_subscription_id!, {
        pause_collection: '' as any,
      });
      await supabaseAdmin
        .from('parents')
        .update({ vip_paused: false })
        .eq('id', parent.id);
      resumed++;
    } catch (err) {
      console.error(`VIP resume cron: failed for parent ${parent.id}`, err);
      failed++;
    }
  }

  console.log(`VIP summer resume complete: ${resumed} resumed, ${failed} failed`);
  return NextResponse.json({ success: true, resumed, failed });
}
