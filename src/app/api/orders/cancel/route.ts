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
  const { data: orderData, error } = await supabaseAdmin
    .from('orders')
    .select('id, parent_id, status, order_date, total_amount, gross_amount, credit_used')
    .eq('id', order_id)
    .eq('parent_id', parentId || '')
    .single();

  const order = orderData as any;

  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Only allow cancellation of paid or pending orders
  if (!['paid', 'pending'].includes(order.status)) {
    return NextResponse.json({ error: 'Order cannot be cancelled' }, { status: 400 });
  }

  // Must be cancelled at least 3 calendar days before the meal date (e.g. cancel June 29 order on/before June 26)
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const orderDateUtc = new Date(order.order_date + 'T00:00:00Z');
  const todayDateUtc = new Date(todayStr + 'T00:00:00Z');
  const diffTime = orderDateUtc.getTime() - todayDateUtc.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 3) {
    return NextResponse.json({ error: 'Orders can only be cancelled up to 3 days before the meal date (e.g., June 29 orders must be cancelled on or before June 26)' }, { status: 400 });
  }

  // Mark as cancelled
  const { error: cancelError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled' } as any)
    .eq('id', order_id);

  if (cancelError) return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });

  // For paid orders: refund the full gross_amount as credit
  if (order.status === 'paid') {
    const refundAmount = Number(order.gross_amount);
    const { error: creditError } = await supabaseAdmin.from('credits').insert({
      parent_id: parentId || '',
      amount: refundAmount,
      source: 'refund',  // must match DB enum: 'referral'|'coupon'|'refund'|'manual'|'season_proration'|'order_usage'
      order_id: order.id,
    } as any);
    if (creditError) {
      console.error('Failed to insert refund credit:', creditError);
      return NextResponse.json({ error: 'Order cancelled but credit refund failed. Please contact support.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, refund_amount: refundAmount });
  }

  // For pending orders: just cancelled, no refund needed (nothing was charged)
  return NextResponse.json({ success: true, refund_amount: 0 });
}
