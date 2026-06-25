import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

// Called by Vercel Cron on June 30 at 11 PM UTC (before July 1 midnight Pacific)
// Schedule: 0 23 30 6 * (see vercel.json)
export async function GET(req: NextRequest) {
  // Vercel cron passes the CRON_SECRET as Authorization: Bearer <secret>
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id, stripe_subscription_id')
    .eq('is_vip', true)
    .eq('vip_paused', false)
    .not('stripe_subscription_id', 'is', null);

  if (error) {
    console.error('VIP pause cron: DB error', error);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  let paused = 0;
  let failed = 0;

  for (const parent of parents || []) {
    try {
      await stripe.subscriptions.update(parent.stripe_subscription_id!, {
        pause_collection: { behavior: 'void' },
      });
      await supabaseAdmin
        .from('parents')
        .update({ vip_paused: true })
        .eq('id', parent.id);
      paused++;
    } catch (err) {
      console.error(`VIP pause cron: failed for parent ${parent.id}`, err);
      failed++;
    }
  }

  console.log(`VIP summer pause complete: ${paused} paused, ${failed} failed`);
  return NextResponse.json({ success: true, paused, failed });
}
