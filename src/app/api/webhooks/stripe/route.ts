import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { sendOrderConfirmationEmail, sendVipActivationEmail, sendVipCancellationEmail, sendReferralRewardEmail } from '@/lib/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any, // fallback to standard
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper to calculate proration credit
function calculateProrationCredit(joinDate: Date): number {
  const FULL_PRICE = 89.99;
  const TOTAL_MONTHS = 10; // Sept to June
  const month = joinDate.getMonth(); // 0=Jan, 8=Sept

  let monthsMissed = 0;
  if (month >= 8) {
    monthsMissed = month - 8;
  } else if (month <= 5) {
    monthsMissed = 4 + month;
  }

  if (monthsMissed > TOTAL_MONTHS) monthsMissed = TOTAL_MONTHS;
  if (monthsMissed === 0) return 0;

  const creditPerMonth = FULL_PRICE / TOTAL_MONTHS;
  return Math.round(monthsMissed * creditPerMonth * 100) / 100;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Handle VIP difference payment — finalize cancellation after payment confirmed
        if (session.metadata?.action === 'vip_cancel_difference') {
          const parentId = session.metadata.parentId;
          const subId = session.metadata.subId;
          if (parentId) {
            // 1. Fetch paid future orders (from today onwards) and revert their prices to regular
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
            const { data: futureOrders } = await supabaseAdmin
              .from('orders')
              .select(`
                id, gross_amount, credit_used,
                order_items ( id, quantity, is_large,
                  dishes ( price_regular, price_vip, large_price_regular, large_price_vip, has_large )
                )
              `)
              .eq('parent_id', parentId)
              .eq('status', 'paid')
              .gte('order_date', todayStr);

            if (futureOrders && futureOrders.length > 0) {
              for (const order of futureOrders) {
                let newGross = 0;
                for (const item of (order.order_items || [])) {
                  const dish = (item as any).dishes;
                  if (!dish) continue;
                  const isLarge = !!item.is_large && !!dish.has_large;
                  const regPrice = isLarge
                    ? Number(dish.large_price_regular ?? dish.price_regular)
                    : Number(dish.price_regular);
                  newGross += regPrice * item.quantity;
                  await supabaseAdmin.from('order_items').update({
                    unit_price: regPrice,
                    total_price: regPrice * item.quantity,
                  }).eq('id', item.id);
                }
                await supabaseAdmin.from('orders').update({
                  status: 'paid',
                  gross_amount: newGross,
                  total_amount: newGross - Number(order.credit_used),
                }).eq('id', order.id);
              }
            }

            // 2. Cancel the Stripe subscription
            if (subId) {
              try { await stripe.subscriptions.cancel(subId); } catch (e) {
                console.warn('Webhook: failed to cancel stripe subscription:', e);
              }
            }

            // 3. Strip VIP from parent
            await supabaseAdmin.from('parents').update({
              is_vip: false,
              stripe_subscription_id: null,
              vip_cancel_at: null,
              vip_cancel_at_period_end: false,
            }).eq('id', parentId);
          }
          break;
        }

        // 1. IS THIS A VIP SUBSCRIPTION?
        if (session.mode === 'subscription') {
          const clerkUserId = session.client_reference_id; // we will pass this during checkout creation
          const customerId = session.customer as string;

          if (!clerkUserId) {
            console.error('Missing client_reference_id for VIP checkout');
            break;
          }

          // Get parent
          const { data: parent } = await supabaseAdmin
            .from('parents')
            .select('*')
            .eq('id', clerkUserId)
            .single();

          if (!parent) break;

          // Update parent to VIP and save stripe customer ID & subscription ID
          const subscriptionId = session.subscription as string;
          await supabaseAdmin
            .from('parents')
            .update({ 
              is_vip: true, 
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              vip_cancel_at: null,
              vip_cancel_at_period_end: false
            })
            .eq('id', parent.id);

          // Calculate Proration
          const prorationCredit = calculateProrationCredit(new Date());
          if (prorationCredit > 0) {
            // Ensure no existing proration credit
            const { count } = await supabaseAdmin
              .from('credits')
              .select('*', { count: 'exact', head: true })
              .eq('parent_id', parent.id)
              .eq('source', 'season_proration');

            if (count === 0) {
              await supabaseAdmin.from('credits').insert({
                parent_id: parent.id,
                amount: prorationCredit,
                source: 'season_proration'
              });
            }
          }

          await sendVipActivationEmail(parent.email, parent.name, prorationCredit);

          // Referral credit: give referrer $5 when a referred user joins VIP
          if (parent.referred_by) {
            await supabaseAdmin.from('credits').insert({
              parent_id: parent.referred_by,
              amount: 5.00,
              source: 'referral',
            });

            const { data: referrer } = await supabaseAdmin
              .from('parents')
              .select('name, email')
              .eq('id', parent.referred_by)
              .single();

            if (referrer?.email) {
              await sendReferralRewardEmail(referrer.email, referrer.name, parent.name);
            }

            // Clear referred_by so they can only trigger a referral credit once
            await supabaseAdmin
              .from('parents')
              .update({ referred_by: null })
              .eq('id', parent.id);
          }
        }
        
        // 2. IS THIS A NORMAL ORDER?
        else if (session.mode === 'payment') {
          // Instead of looking for orderIds in metadata (which can hit character limits),
          // we now lookup orders that were tagged with this session ID during creation.
          const { data: orders, error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ status: 'paid' })
            .eq('stripe_session_id', session.id)
            .select('id, parent_id, total_amount');

          if (updateError) {
            console.error('Failed to update orders for session:', session.id, updateError);
            break;
          }

          if (orders && orders.length > 0) {
            const parentId = orders[0].parent_id;
            const totalCharged = orders.reduce((sum, o) => sum + o.total_amount, 0);
            
            const creditToUse = Number(session.metadata?.creditToUse || '0');
            const couponId = session.metadata?.couponId;

            if (creditToUse > 0) {
               await supabaseAdmin.from('credits').insert({
                 parent_id: parentId,
                 amount: -creditToUse,
                 source: 'order_usage',
                 order_id: orders[0].id // link to first order for tracking
               });
            }

            if (couponId) {
               // Fallback increment since we can't easily do it atomically without RPC here
               const { data: coupon } = await supabaseAdmin.from('coupons').select('used_count').eq('id', couponId).single();
               if (coupon) {
                 await supabaseAdmin.from('coupons').update({ used_count: coupon.used_count + 1 }).eq('id', couponId);
               }
            }

            const { data: parent } = await supabaseAdmin
              .from('parents')
              .select('*')
              .eq('id', parentId)
              .single();

            if (parent) {
              await sendOrderConfirmationEmail(parent.email, parent.name, totalCharged);
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: parent } = await supabaseAdmin
          .from('parents')
          .select('*')
          .eq('stripe_customer_id', customerId)
          .single();

        if (parent) {
          await supabaseAdmin
            .from('parents')
            .update({ 
              is_vip: false,
              stripe_subscription_id: null,
              vip_cancel_at: null,
              vip_cancel_at_period_end: false
            })
            .eq('id', parent.id);

          await sendVipCancellationEmail(parent.email, parent.name);
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: 'Internal Webhook Error' }, { status: 500 });
  }
}
