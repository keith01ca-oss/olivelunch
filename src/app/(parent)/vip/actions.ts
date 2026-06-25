'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10' as any,
});

export async function getVipCancellationSummary(parentId: string) {
  if (!parentId) return { error: 'Parent ID is required' };

  try {
    // 1. Fetch parent details
    const { data: parent, error: parentErr } = await supabaseAdmin
      .from('parents')
      .select('stripe_customer_id, stripe_subscription_id, is_vip')
      .eq('id', parentId)
      .single();

    if (parentErr || !parent) {
      return { error: 'Parent not found' };
    }

    if (!parent.is_vip) {
      return { error: 'You are not a VIP member' };
    }

    // 2. Fetch current Stripe subscription details to get period end date
    let subscriptionEnd: Date | null = null;
    let subscriptionId = parent.stripe_subscription_id;

    if (parent.stripe_customer_id) {
      // If we don't have subscriptionId stored, find it from stripe
      if (!subscriptionId) {
        const subscriptions = await stripe.subscriptions.list({
          customer: parent.stripe_customer_id,
          status: 'active',
          limit: 1,
        });
        if (subscriptions.data.length > 0) {
          subscriptionId = subscriptions.data[0].id;
        }
      }

      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        subscriptionEnd = new Date(sub.current_period_end * 1000);
      }
    }

    if (!subscriptionEnd) {
      // Fallback: 30 days from now
      subscriptionEnd = new Date();
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 3. Find all future paid orders (order_date >= today, status = 'paid')
    const { data: orders, error: ordersErr } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_date,
        gross_amount,
        total_amount,
        order_items (
          id,
          dish_id,
          quantity,
          unit_price,
          total_price,
          is_large,
          dishes (
            name,
            price_regular,
            price_vip,
            large_price_regular,
            large_price_vip,
            has_large
          )
        )
      `)
      .eq('parent_id', parentId)
      .eq('status', 'paid')
      .gte('order_date', todayStr);

    if (ordersErr) {
      console.error('Error fetching orders:', ordersErr);
      return { error: 'Failed to fetch future orders' };
    }

    // 4. Calculate calculations
    let totalFutureVipMeals = 0;
    let priceDifference = 0;
    let mealsAfterPeriodEnd = 0;
    let refundValueAfterPeriodEnd = 0;

    const subscriptionEndStr = subscriptionEnd.toISOString().split('T')[0];

    for (const order of (orders || [])) {
      const isAfterPeriod = order.order_date > subscriptionEndStr;
      
      for (const item of (order.order_items || [])) {
        const dish = (item as any).dishes;
        if (!dish) continue;

        totalFutureVipMeals += item.quantity;
        
        // Calculate regular price for this item
        const isItemLarge = !!item.is_large && !!dish.has_large;
        const regPrice = isItemLarge
          ? Number(dish.large_price_regular ?? dish.price_regular)
          : Number(dish.price_regular);
        const diffPerUnit = Math.max(0, regPrice - Number(item.unit_price));
        const totalDiff = diffPerUnit * item.quantity;
        
        priceDifference += totalDiff;

        if (isAfterPeriod) {
          mealsAfterPeriodEnd += item.quantity;
          refundValueAfterPeriodEnd += (Number(item.unit_price) * item.quantity);
        }
      }
    }

    return {
      success: true,
      subscriptionEnd,
      totalFutureVipMeals,
      priceDifference: Math.round(priceDifference * 100) / 100,
      mealsAfterPeriodEnd,
      refundValueAfterPeriodEnd: Math.round(refundValueAfterPeriodEnd * 100) / 100,
      subscriptionId,
    };
  } catch (err: any) {
    console.error('Summary error:', err);
    return { error: err.message || 'Failed to get summary' };
  }
}

export async function processVipCancellation(
  parentId: string,
  option: 'pay_difference' | 'cancel_meals',
  subscriptionId: string | null,
  origin?: string
) {
  if (!parentId) return { error: 'Parent ID is required' };

  try {
    // Fetch parent
    const { data: parent, error: parentErr } = await supabaseAdmin
      .from('parents')
      .select('stripe_customer_id, stripe_subscription_id, email, name')
      .eq('id', parentId)
      .single();

    if (parentErr || !parent) {
      return { error: 'Parent details not found' };
    }

    // Get summary to know values
    const summary = await getVipCancellationSummary(parentId);
    if ('error' in summary) {
      return { error: summary.error };
    }

    const subId = subscriptionId || parent.stripe_subscription_id;
    
    // Retrieve subscription to get exact period end date if subId exists
    let periodEnd: Date;
    if (subId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        periodEnd = new Date(sub.current_period_end * 1000);
      } catch (e) {
        console.warn('Failed to retrieve stripe subscription:', e);
        periodEnd = summary.subscriptionEnd ? new Date(summary.subscriptionEnd) : new Date();
      }
    } else {
      periodEnd = summary.subscriptionEnd ? new Date(summary.subscriptionEnd) : new Date();
    }
    
    const periodEndStr = periodEnd.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    if (option === 'cancel_meals') {
      // 1. Cancel Stripe subscription at period end
      if (subId) {
        try {
          await stripe.subscriptions.update(subId, {
            cancel_at_period_end: true,
          });
        } catch (e) {
          console.warn('Failed to update stripe subscription:', e);
        }
      }

      // 2. Fetch all orders after period end
      const { data: ordersToCancel } = await supabaseAdmin
        .from('orders')
        .select('id, total_amount')
        .eq('parent_id', parentId)
        .eq('status', 'paid')
        .gt('order_date', periodEndStr);

      let totalRefundCredits = 0;
      if (ordersToCancel && ordersToCancel.length > 0) {
        const orderIds = ordersToCancel.map(o => o.id);
        totalRefundCredits = ordersToCancel.reduce((sum, o) => sum + Number(o.total_amount), 0);

        // Update orders to cancelled
        await supabaseAdmin
          .from('orders')
          .update({ status: 'cancelled' })
          .in('id', orderIds);

        // Refund total amount to parent store credits
        if (totalRefundCredits > 0) {
          await supabaseAdmin.from('credits').insert({
            parent_id: parentId,
            amount: totalRefundCredits,
            source: 'refund',
            order_id: orderIds[0], // link to first cancelled order
          });
        }
      }

      // 3. Update parent record to cancel at period end
      await supabaseAdmin
        .from('parents')
        .update({
          vip_cancel_at: periodEnd.toISOString(),
          vip_cancel_at_period_end: true,
        })
        .eq('id', parentId);

      revalidatePath('/settings');
      revalidatePath('/dashboard');

      return {
        success: true,
        message: `Successfully cancelled! Your VIP status remains active until ${periodEnd.toLocaleDateString()}. ${
          ordersToCancel && ordersToCancel.length > 0 
            ? `Cancelled ${ordersToCancel.length} future order(s) scheduled after that date, and refunded $${totalRefundCredits.toFixed(2)} back to your store credit.`
            : ''
        }`,
      };
    } else if (option === 'pay_difference') {
      // 1. Query all future orders (from today onwards)
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select(`
          id,
          gross_amount,
          total_amount,
          credit_used,
          order_items (
            id,
            quantity,
            is_large,
            dishes (
              price_regular,
              price_vip,
              large_price_regular,
              large_price_vip,
              has_large
            )
          )
        `)
        .eq('parent_id', parentId)
        .eq('status', 'paid')
        .gte('order_date', todayStr);

      let differenceToCharge = 0;
      const orderIdsToRevert: string[] = [];

      if (orders && orders.length > 0) {
        for (const order of orders) {
          let orderNewGross = 0;
          
          for (const item of (order.order_items || [])) {
            const dish = (item as any).dishes;
            if (!dish) continue;

            const isLarge = !!item.is_large && !!dish.has_large;
            const regPrice = isLarge
              ? Number(dish.large_price_regular ?? dish.price_regular)
              : Number(dish.price_regular);

            orderNewGross += regPrice * item.quantity;
          }

          const priceDiff = Math.max(0, orderNewGross - Number(order.gross_amount));
          differenceToCharge += priceDiff;
          if (priceDiff > 0) orderIdsToRevert.push(order.id);
        }
      }

      // 2. We skip automatic off-session charge and always use a Checkout session
      // to let the user review and pay the difference securely.
      const chargeSuccessful = false;

      // 3. If there is a price difference, create a Stripe Checkout session.
      if (differenceToCharge > 0 && !chargeSuccessful) {
        const appUrl = origin || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'cad',
                product_data: {
                  name: 'VIP Cancellation — Price Difference',
                  description: `Covers the difference between VIP and regular pricing for your ${orders?.length || 0} future meal(s).`,
                },
                unit_amount: Math.round(differenceToCharge * 100),
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${appUrl}/settings?vip_diff_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/settings?vip_diff_cancel=true`,
          metadata: {
            action: 'vip_cancel_difference',
            parentId: parentId,
            ...(subId ? { subId } : {})
          }
        });

        // Return URL — do NOT call revalidatePath here or Next.js will refresh the page
        return {
          success: true,
          checkoutUrl: session.url,
          message: 'Please complete your payment to finalize your VIP cancellation.',
        };
      }

      // 4. Auto-charge succeeded (or no difference) — finalize cancellation now
      // Cancel Stripe subscription
      if (subId) {
        try { await stripe.subscriptions.cancel(subId); } catch (e) {
          console.warn('Failed to cancel stripe subscription:', e);
        }
      }

      // Revert order item prices
      if (orders && orders.length > 0) {
        for (const order of orders) {
          let orderNewGross = 0;
          for (const item of (order.order_items || [])) {
            const dish = (item as any).dishes;
            if (!dish) continue;
            const isLarge = !!item.is_large && !!dish.has_large;
            const regPrice = isLarge
              ? Number(dish.large_price_regular ?? dish.price_regular)
              : Number(dish.price_regular);
            orderNewGross += regPrice * item.quantity;
            await supabaseAdmin.from('order_items').update({
              unit_price: regPrice,
              total_price: regPrice * item.quantity,
            }).eq('id', item.id);
          }
          await supabaseAdmin.from('orders').update({
            gross_amount: orderNewGross,
            total_amount: orderNewGross - Number(order.credit_used),
          }).eq('id', order.id);
        }
      }

      // Strip VIP
      await supabaseAdmin
        .from('parents')
        .update({
          is_vip: false,
          stripe_subscription_id: null,
          vip_cancel_at: null,
          vip_cancel_at_period_end: false,
        })
        .eq('id', parentId);

      revalidatePath('/settings');
      revalidatePath('/dashboard');

      return {
        success: true,
        message: differenceToCharge > 0
          ? `VIP cancelled. A difference of $${differenceToCharge.toFixed(2)} was charged to your card on file. Your orders have been updated to regular pricing.`
          : 'VIP cancelled. Your future orders remain at regular pricing.',
      };
    }

    return { error: 'Invalid option selected' };
  } catch (err: any) {
    console.error('Cancellation error:', err);
    return { error: err.message || 'Failed to process cancellation' };
  }
}
