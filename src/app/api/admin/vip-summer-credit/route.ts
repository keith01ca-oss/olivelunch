import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { getOrResolveOrgId } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

export async function POST(req: NextRequest) {
  // Simple admin authorization check
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    const orgId = await getOrResolveOrgId().catch(() => null);
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Get all active VIP parents
  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id, stripe_subscription_id, name, email')
    .eq('is_vip', true)
    .not('stripe_subscription_id', 'is', null);

  if (error) {
    console.error('VIP summer credit admin POST: DB error', error);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  let affected = 0;
  let skipped = 0;
  let failed = 0;
  const processedParents: string[] = [];
  const errors: string[] = [];

  for (const parent of parents || []) {
    try {
      // Fetch subscription from Stripe
      const sub = await stripe.subscriptions.retrieve(parent.stripe_subscription_id!);
      
      const isMonthly = sub.status === 'active' && sub.items.data[0]?.plan?.interval === 'month';
      if (!isMonthly) {
        skipped++;
        continue;
      }

      // Check if they already received the summer credit ($9.99 manual credit) this month
      const { data: existingCredit, error: checkError } = await supabaseAdmin
        .from('credits')
        .select('id')
        .eq('parent_id', parent.id)
        .eq('amount', 9.99)
        .eq('source', 'manual')
        .gte('created_at', startOfMonth.toISOString())
        .limit(1);

      if (checkError) {
        console.error(`VIP summer credit admin POST: DB check failed for parent ${parent.id}`, checkError);
        errors.push(`${parent.id}: DB check failed`);
        failed++;
        continue;
      }

      if (existingCredit && existingCredit.length > 0) {
        skipped++;
        continue;
      }

      // Insert the $9.99 credit row
      const { error: insertError } = await supabaseAdmin
        .from('credits')
        .insert({
          parent_id: parent.id,
          amount: 9.99,
          source: 'manual',
          order_id: null,
        });

      if (insertError) {
        console.error(`VIP summer credit admin POST: Insert failed for parent ${parent.id}`, insertError);
        errors.push(`${parent.id}: Insert failed`);
        failed++;
        continue;
      }

      // Send email notification if Resend API key is available
      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Olive Lunch <hello@olivelunch.com>',
            to: parent.email,
            subject: 'Your Summer VIP Credit is here! ☀️',
            html: `<p>Hi ${parent.name},</p>
                   <p>As a monthly VIP member, we have added a <strong>$9.99 store credit</strong> to your account for the summer break! ☀️</p>
                   <p>This credit has been automatically applied to your account balance and will offset your upcoming orders. Thank you for being a valued VIP member!</p>
                   <p>Best regards,<br/>The Olive Lunch Team</p>`,
          });
        } catch (emailErr) {
          console.error(`VIP summer credit admin POST: Failed to send email to ${parent.email}`, emailErr);
        }
      }

      processedParents.push(`${parent.name} (${parent.email})`);
      affected++;
    } catch (err: any) {
      console.error(`VIP summer credit admin POST: failed for parent ${parent.id}`, err);
      errors.push(`${parent.id}: ${err?.message || 'Unknown error'}`);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    affected,
    skipped,
    failed,
    processed: processedParents,
    errors,
  });
}
