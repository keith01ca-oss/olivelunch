import { NextRequest, NextResponse } from 'next/server';
import { getResolvedParent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

export async function POST(req: NextRequest) {
  const authContext = await getResolvedParent();
  if ('error' in authContext) return NextResponse.json(authContext, { status: authContext.status });

  const { parentId } = authContext;
  // order_ids: array of pending order IDs to pay for
  const { order_ids } = await req.json();

  if (!order_ids || order_ids.length === 0) {
    return NextResponse.json({ error: 'No order IDs provided' }, { status: 400 });
  }

  // Fetch all the pending orders — verify they belong to this parent and are truly pending
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, parent_id, status, order_date, gross_amount, credit_used, total_amount')
    .in('id', order_ids)
    .eq('parent_id', parentId || '')
    .eq('status', 'pending');

  if (error || !orders || orders.length === 0) {
    return NextResponse.json({ error: 'No valid pending orders found' }, { status: 404 });
  }

  // Auto-expire orders whose date has already passed (today or earlier)
  const today = new Date().toISOString().split('T')[0];
  const validOrders = orders.filter(o => o.order_date > today);
  const expiredIds = orders.filter(o => o.order_date <= today).map(o => o.id);

  if (expiredIds.length > 0) {
    await supabaseAdmin.from('orders').update({ status: 'cancelled' }).in('id', expiredIds);
  }

  if (validOrders.length === 0) {
    return NextResponse.json({ error: 'All selected orders have expired' }, { status: 400 });
  }

  // Fetch parent credit balance
  const { data: creditRows } = await supabaseAdmin
    .from('credits')
    .select('amount')
    .eq('parent_id', parentId || '');
  const creditBalance = creditRows ? creditRows.reduce((sum, r) => sum + Number(r.amount), 0) : 0;

  // The total value of the orders being paid is the sum of their gross_amounts
  const totalGross = validOrders.reduce((sum, o) => sum + Number(o.gross_amount), 0);

  // Apply credit if available
  const creditToUse = Math.min(creditBalance, totalGross);
  const finalAmount = Math.max(0, totalGross - creditToUse);

  // If fully covered by credit, mark paid immediately
  if (finalAmount === 0) {
    let remainingCreditToDistribute = creditToUse;
    for (let idx = 0; idx < validOrders.length; idx++) {
      const o = validOrders[idx];
      const orderFraction = o.gross_amount / totalGross;
      const orderCredit = idx === validOrders.length - 1
        ? remainingCreditToDistribute
        : Number((creditToUse * orderFraction).toFixed(2));
      
      remainingCreditToDistribute -= orderCredit;
      const newTotalAmount = o.gross_amount - orderCredit;

      await supabaseAdmin
        .from('orders')
        .update({
          status: 'paid',
          credit_used: orderCredit,
          total_amount: newTotalAmount
        })
        .eq('id', o.id);
    }

    if (creditToUse > 0) {
      await supabaseAdmin.from('credits').insert({
        parent_id: parentId || '',
        amount: -creditToUse,
        source: 'order_usage',
        order_id: validOrders[0].id,
      });
    }
    return NextResponse.json({ success: true, stripe_url: null });
  }

  // Create Stripe checkout for the pending orders
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'cad',
          product_data: {
            name: 'Olive Lunch — Pending Orders',
            description: `Payment for ${validOrders.length} meal order(s)`,
          },
          unit_amount: Math.round(finalAmount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${req.headers.get('origin')}/orders?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.get('origin')}/orders?canceled=true`,
    metadata: {
      parentId: parentId || '',
      creditToUse: creditToUse.toString(),
      isBulkOrder: 'true',
    },
  });

  // Tag all valid pending orders with the new session ID and update their credit/total_amount values
  let remainingCreditToDistribute = creditToUse;
  for (let idx = 0; idx < validOrders.length; idx++) {
    const o = validOrders[idx];
    const orderFraction = o.gross_amount / totalGross;
    const orderCredit = idx === validOrders.length - 1
      ? remainingCreditToDistribute
      : Number((creditToUse * orderFraction).toFixed(2));
    
    remainingCreditToDistribute -= orderCredit;
    const newTotalAmount = o.gross_amount - orderCredit;

    await supabaseAdmin
      .from('orders')
      .update({
        stripe_session_id: session.id,
        credit_used: orderCredit,
        total_amount: newTotalAmount
      })
      .eq('id', o.id);
  }

  return NextResponse.json({ success: true, stripe_url: session.url });
}
