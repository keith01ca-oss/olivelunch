import { NextRequest, NextResponse } from 'next/server';
import { getResolvedParent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const authContext = await getResolvedParent();
  if ('error' in authContext) return NextResponse.json(authContext, { status: authContext.status });

  const { parentId } = authContext;
  const { order_id } = await req.json();

  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  // Fetch the order
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, parent_id, status, order_date, total_amount, gross_amount, credit_used')
    .eq('id', order_id)
    .eq('parent_id', parentId)
    .single();

  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Only allow cancellation of paid or pending orders
  if (!['paid', 'pending'].includes(order.status)) {
    return NextResponse.json({ error: 'Order cannot be cancelled' }, { status: 400 });
  }

  // Must be at least 2 days in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const orderDate = new Date(order.order_date + 'T12:00:00');
  const twoDaysAhead = new Date(today);
  twoDaysAhead.setDate(twoDaysAhead.getDate() + 2);

  if (orderDate < twoDaysAhead) {
    return NextResponse.json({ error: 'Orders can only be cancelled at least 2 days before the meal date' }, { status: 400 });
  }

  // Mark as cancelled
  const { error: cancelError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order_id);

  if (cancelError) return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });

  // For paid orders: refund the full gross_amount as credit
  if (order.status === 'paid') {
    const refundAmount = Number(order.gross_amount);
    const { error: creditError } = await supabaseAdmin.from('credits').insert({
      parent_id: parentId,
      amount: refundAmount,
      source: 'refund',  // must match DB enum: 'referral'|'coupon'|'refund'|'manual'|'season_proration'|'order_usage'
      order_id: order.id,
    });
    if (creditError) {
      console.error('Failed to insert refund credit:', creditError);
      return NextResponse.json({ error: 'Order cancelled but credit refund failed. Please contact support.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, refund_amount: refundAmount });
  }

  // For pending orders: just cancelled, no refund needed (nothing was charged)
  return NextResponse.json({ success: true, refund_amount: 0 });
}
