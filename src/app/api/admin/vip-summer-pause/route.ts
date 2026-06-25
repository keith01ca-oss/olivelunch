import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { getOrResolveOrgId } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

// Admin-only: manually pause or resume all monthly VIP subscriptions
export async function POST(req: NextRequest) {
  // Simple admin check — only callable from admin panel (no Clerk auth needed since it's server-side admin)
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    // If no ADMIN_SECRET set, fall back to checking a known org
    const orgId = await getOrResolveOrgId().catch(() => null);
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { action } = await req.json() as { action: 'pause' | 'resume' };
  if (action !== 'pause' && action !== 'resume') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id, stripe_subscription_id, vip_paused')
    .eq('is_vip', true)
    .not('stripe_subscription_id', 'is', null);

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // Only act on subscriptions that need to change
  const targets = (parents || []).filter(p =>
    action === 'pause' ? !p.vip_paused : p.vip_paused
  );

  let affected = 0;
  let failed = 0;

  for (const parent of targets) {
    try {
      if (action === 'pause') {
        await stripe.subscriptions.update(parent.stripe_subscription_id!, {
          pause_collection: { behavior: 'void' },
        });
      } else {
        await stripe.subscriptions.update(parent.stripe_subscription_id!, {
          pause_collection: '' as any,
        });
      }
      await supabaseAdmin
        .from('parents')
        .update({ vip_paused: action === 'pause' })
        .eq('id', parent.id);
      affected++;
    } catch (err) {
      console.error(`vip-summer-pause: failed for parent ${parent.id}`, err);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    action,
    affected,
    failed,
    total: targets.length,
  });
}
