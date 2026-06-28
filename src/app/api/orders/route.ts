import { NextRequest, NextResponse } from 'next/server';
import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

interface OrderItemRequest {
  dish_id: string;
  quantity: number;
  delivery_area: 'classroom' | 'office' | 'pickup';
  is_large?: boolean;
}

interface OrderRequest {
  child_id: string;
  order_date: string;
  items: OrderItemRequest[];
}

export async function POST(req: NextRequest) {
  const orgId = await getOrResolveOrgId();
  if (!orgId) return NextResponse.json({ error: 'Organization context missing. Please refresh.' }, { status: 400 });

  const authContext = await getResolvedParent();
  if ('error' in authContext) return NextResponse.json(authContext, { status: authContext.status });

  const { parentId } = authContext;
  
  if (!parentId) {
    return NextResponse.json({ error: 'Parent record not found' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const orders: OrderRequest[] = body.orders;
    const couponCode: string | undefined = body.coupon_code;

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No orders provided' }, { status: 400 });
    }

    // 1. Delete any pending orders that match the incoming child/date first,
    // so they do not lock credits we want to reuse in this new checkout.
    for (const order of orders) {
      const { data: existingOrders } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .eq('child_id', order.child_id)
        .eq('order_date', order.order_date)
        .neq('status', 'cancelled');
        
      if (existingOrders && existingOrders.length > 0) {
        const pendingIds = existingOrders.filter(o => o.status === 'pending').map(o => o.id);
        if (pendingIds.length > 0) {
           await supabaseAdmin.from('orders').delete().in('id', pendingIds);
        }
      }
    }

    // 2. Fetch parent VIP status & existing credit balance
    const { data: parent } = await supabaseAdmin.from('parents').select('is_vip').eq('id', parentId).single();
    const isVip = parent?.is_vip || false;

    const { data: creditRows } = await supabaseAdmin.from('credits').select('amount').eq('parent_id', parentId);
    const totalCredit = creditRows ? creditRows.reduce((sum, row) => sum + Number(row.amount), 0) : 0;

    // Deduct credit used by other pending orders
    const { data: otherPending } = await supabaseAdmin
      .from('orders')
      .select('credit_used')
      .eq('parent_id', parentId)
      .eq('status', 'pending');
    const lockedCredit = otherPending ? otherPending.reduce((sum, o) => sum + Number(o.credit_used || 0), 0) : 0;

    let creditBalance = Math.max(0, totalCredit - lockedCredit);

    // 3. Validate Coupon
    let couponDiscount = 0;
    let couponId: string | null = null;
    let validCoupon = null;

    if (couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .single();
        
      if (coupon) {
        const today = new Date().toISOString().split('T')[0];
        if (today >= coupon.start_date && today <= coupon.end_date) {
          if (!coupon.usage_limit || coupon.used_count < coupon.usage_limit) {
            validCoupon = coupon;
            couponId = coupon.id;
          }
        }
      }
    }

    // Prepare line items for Stripe and database inserts
    let totalGrossAmount = 0;
    const dbOrdersToInsert: any[] = [];
    const dbOrderItemsToInsert: any[] = [];
    
    // We need to fetch all dish prices to validate client request
    const dishIds = orders.flatMap(o => o.items.map(i => i.dish_id));
    const { data: dishes } = await supabaseAdmin.from('dishes').select('*').in('id', dishIds);
    if (!dishes) throw new Error('Failed to load dishes');
    
    const dishMap = new Map(dishes.map(d => [d.id, d]));

    // Fetch blocked dates and ranges for backend validation
    const uniqueDates = Array.from(new Set(orders.map(o => o.order_date)));
    const [blockedRes, rangesRes] = await Promise.all([
      supabaseAdmin.from('blocked_dates').select('date').in('date', uniqueDates),
      supabaseAdmin.from('pro_d_ranges').select('start_date, end_date')
    ]);
    const blockedDatesSet = new Set(blockedRes.data?.map(d => d.date) || []);
    const proDRanges = rangesRes.data || [];

    // Check cutoff time (1:00 PM prior day)
    const now = new Date();
    // Assuming local timezone logic here, or strictly server time
    const currentHour = now.getHours();
    const todayStr = now.toISOString().split('T')[0];

    // Max advance window: 60 days. Prevents VIP members from locking in
    // VIP prices far into the future and then cancelling their subscription.
    const MAX_ADVANCE_DAYS = 60;
    const maxOrderDate = new Date(now);
    maxOrderDate.setDate(maxOrderDate.getDate() + MAX_ADVANCE_DAYS);
    const maxOrderDateStr = maxOrderDate.toISOString().split('T')[0];

    for (const order of orders) {
      const orderDateStr = order.order_date;
      
      // 1. Validate Weekend
      // 'YYYY-MM-DD' parsed as UTC midnight
      const orderDate = new Date(orderDateStr);
      const dayOfWeek = orderDate.getUTCDay(); 
      if (dayOfWeek === 0 || dayOfWeek === 6) {
         return NextResponse.json({ error: `Cannot order on weekends (${orderDateStr}).` }, { status: 400 });
      }

      // 2. Validate Blocked Dates (Holidays)
      if (blockedDatesSet.has(orderDateStr)) {
         return NextResponse.json({ error: `Orders are closed on this date (${orderDateStr}).` }, { status: 400 });
      }

      // 3. Validate Pro-D Ranges
      for (const r of proDRanges) {
         if (orderDateStr >= r.start_date && orderDateStr <= r.end_date) {
            return NextResponse.json({ error: `Orders are closed for a holiday range covering ${orderDateStr}.` }, { status: 400 });
         }
      }

      // 4. Validate date cutoff
      const yesterday = new Date(orderDateStr);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (todayStr > yesterdayStr || (todayStr === yesterdayStr && currentHour >= 13)) {
         return NextResponse.json({ error: `Cutoff passed for order date ${orderDateStr}` }, { status: 400 });
      }

      let orderGross = 0;

      for (const item of order.items) {
        const dish = dishMap.get(item.dish_id);
        if (!dish) return NextResponse.json({ error: 'Invalid dish' }, { status: 400 });

        // VIP Limit Rule
        if (isVip && item.quantity > 5) {
           return NextResponse.json({ error: `VIP max 5 units per dish per child. Exceeded for ${dish.name}.` }, { status: 400 });
        }

        const isItemLarge = !!item.is_large && !!dish.has_large;
        const unitPrice = isItemLarge
          ? (isVip ? Number(dish.large_price_vip ?? dish.price_vip) : Number(dish.large_price_regular ?? dish.price_regular))
          : (isVip ? Number(dish.price_vip) : Number(dish.price_regular));

        const itemTotal = unitPrice * item.quantity;
        orderGross += itemTotal;
        totalGrossAmount += itemTotal;

        dbOrderItemsToInsert.push({
          temp_order_ref: order.child_id + order.order_date, // Temp reference to link after order creation
          dish_id: item.dish_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: itemTotal,
          delivery_area: item.delivery_area,
          is_large: isItemLarge
        });
      }

      dbOrdersToInsert.push({
        temp_ref: order.child_id + order.order_date,
        parent_id: parentId,
        child_id: order.child_id,
        order_date: order.order_date,
        gross_amount: orderGross,
        status: 'pending' // pending until stripe checkout completes
      });
    }

    // Apply Coupon
    if (validCoupon) {
      if (validCoupon.type === 'fixed') {
        couponDiscount = Number(validCoupon.amount);
      } else {
        couponDiscount = totalGrossAmount * (Number(validCoupon.amount) / 100);
      }
    }

    const afterCoupon = Math.max(0, totalGrossAmount - couponDiscount);
    
    // Apply Credit
    const creditToUse = Math.min(creditBalance, afterCoupon);
    const finalAmount = Math.max(0, afterCoupon - creditToUse);

    // Spread the credit and discount proportionately across the orders
    // For simplicity in the DB, we can just assign the total credit to the first order, 
    // but a better way is to distribute it. Here we do a simple distribution.
    let remainingCreditToDistribute = creditToUse;
    
    const finalizedOrders = dbOrdersToInsert.map((o, idx) => {
      const orderFraction = o.gross_amount / totalGrossAmount;
      // Assign proportionate credit, handle rounding on the last item
      const orderCredit = idx === dbOrdersToInsert.length - 1 
        ? remainingCreditToDistribute 
        : Number((creditToUse * orderFraction).toFixed(2));
      
      remainingCreditToDistribute -= orderCredit;

      return {
        org_id: orgId,
        parent_id: o.parent_id,
        child_id: o.child_id,
        order_date: o.order_date,
        gross_amount: o.gross_amount,
        credit_used: orderCredit,
        total_amount: o.gross_amount - orderCredit, // coupon is technically a total discount, we simplify here
        coupon_id: couponId,
        status: 'pending' as const
      };
    });

    // Insert Orders
    const { data: insertedOrders, error: ordersErr } = await supabaseAdmin
      .from('orders')
      .insert(finalizedOrders)
      .select('id, child_id, order_date');

    if (ordersErr || !insertedOrders) {
      console.error('Failed to insert orders supabase error:', ordersErr);
      throw new Error('Failed to insert orders');
    }

    // Map temp_ref to actual order IDs for items
    const orderItemsFinal = dbOrderItemsToInsert.map(item => {
      const parentOrder = insertedOrders.find(o => (o.child_id + o.order_date) === item.temp_order_ref);
      return {
        order_id: parentOrder!.id,
        dish_id: item.dish_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        delivery_area: item.delivery_area || 'classroom',
        is_large: item.is_large ?? false
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(orderItemsFinal);
    if (itemsErr) {
      console.error('Failed to insert order items:', itemsErr);
      throw new Error('Failed to insert order items');
    }

    // If final amount is 0, we can just mark it paid without Stripe!
    if (finalAmount === 0) {
      await supabaseAdmin.from('orders').update({ status: 'paid' }).in('id', insertedOrders.map(o => o.id));
      
      if (creditToUse > 0) {
        await supabaseAdmin.from('credits').insert({
          parent_id: parentId,
          amount: -creditToUse,
          source: 'order_usage',
          order_id: insertedOrders[0].id // link to first order for simplicity
        });
      }

      if (couponId) {
        try {
          await supabaseAdmin.rpc('increment_coupon_usage' as any, { p_coupon_id: couponId });
        } catch (e) {
          console.warn('Failed to increment coupon usage:', e);
        }
      }

      return NextResponse.json({ success: true, stripe_url: null });
    }

    // 2. IS THIS A NORMAL PAID ORDER?
    // Create Stripe Checkout Session FIRST to get the ID
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: 'Olive Lunch Order',
              description: `Meals for ${orders.length} children`,
            },
            unit_amount: Math.round(finalAmount * 100), // in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/dashboard?canceled=true`,
      metadata: {
        parentId,
        creditToUse: creditToUse.toString(),
        isBulkOrder: 'true',
        ...(couponId ? { couponId } : {})
      }
    });

    // Update orders with the session ID so the webhook can find them
    await supabaseAdmin
      .from('orders')
      .update({ stripe_session_id: session.id })
      .in('id', insertedOrders.map(o => o.id));

    return NextResponse.json({ success: true, stripe_url: session.url });

  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
