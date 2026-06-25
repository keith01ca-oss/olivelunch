import { getResolvedParent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import OrdersClient from './OrdersClient';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' as any });

export default async function ParentOrdersPage({
  searchParams,
}: {
  searchParams: { success?: string; session_id?: string; canceled?: string };
}) {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const { parentId } = authContext;

  // ── Stripe return: verify session & mark orders paid immediately ──────────
  // This is a fallback in case the webhook hasn't fired yet (local dev, timing, etc.)
  if (searchParams.success === 'true' && searchParams.session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(searchParams.session_id);
      if (session.payment_status === 'paid') {
        // Fetch pending orders tagged with this session that still haven't been marked paid
        const { data: pendingOrders } = await supabaseAdmin
          .from('orders')
          .select('id, parent_id, total_amount')
          .eq('stripe_session_id', searchParams.session_id)
          .eq('status', 'pending');

        if (pendingOrders && pendingOrders.length > 0) {
          // Mark them paid
          await supabaseAdmin
            .from('orders')
            .update({ status: 'paid' })
            .eq('stripe_session_id', searchParams.session_id)
            .eq('status', 'pending');

          // Apply credit if specified in session metadata
          const creditToUse = Number(session.metadata?.creditToUse || '0');
          if (creditToUse > 0) {
            // Check if credit was already deducted by webhook (avoid double-deducting)
            const { count } = await supabaseAdmin
              .from('credits')
              .select('*', { count: 'exact', head: true })
              .eq('parent_id', parentId || '')
              .eq('source', 'order_usage')
              .eq('order_id', pendingOrders[0].id);

            if (!count || count === 0) {
              await supabaseAdmin.from('credits').insert({
                parent_id: parentId || '',
                amount: -creditToUse,
                source: 'order_usage',
                order_id: pendingOrders[0].id,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not verify Stripe session on return:', e);
    }
  }

  // ── Auto-expire past pending orders on every page load ───────────────────
  const today = new Date().toISOString().split('T')[0];
  await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('parent_id', parentId || '')
    .eq('status', 'pending')
    .lte('order_date', today);

  // ── Fetch credit balance ─────────────────────────────────────────────────
  const { data: creditRows } = await supabaseAdmin
    .from('credits')
    .select('amount')
    .eq('parent_id', parentId || '');
  const rawCredit = creditRows ? creditRows.reduce((sum, c) => sum + Number(c.amount), 0) : 0;

  // Fetch pending credits locked in orders
  const { data: pendingOrders } = await supabaseAdmin
    .from('orders')
    .select('credit_used')
    .eq('parent_id', parentId || '')
    .eq('status', 'pending');
  const lockedCredit = pendingOrders ? pendingOrders.reduce((sum, o) => sum + Number(o.credit_used || 0), 0) : 0;

  const creditBalance = Math.max(0, rawCredit - lockedCredit);

  // ── Fetch all orders ─────────────────────────────────────────────────────
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_date,
      status,
      gross_amount,
      total_amount,
      created_at,
      children ( id, name, division ),
      order_items (
        id,
        quantity,
        unit_price,
        total_price,
        dishes ( id, name, category )
      )
    `)
    .eq('parent_id', parentId || '')
    .order('order_date', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">My Orders</h1>
        <p className="text-muted-foreground mt-1">
          View and manage your lunch orders. Cancel paid orders up to 2 days before the meal date for full store credit.
        </p>
        {searchParams.success === 'true' && (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl">
            ✅ Payment successful! Your orders have been confirmed.
          </div>
        )}
        {searchParams.canceled === 'true' && (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-4 py-2.5 rounded-xl">
            ⚠️ Payment was cancelled — your orders are still pending.
          </div>
        )}
      </div>
      <OrdersClient orders={(orders as any) || []} creditBalance={creditBalance} />
    </div>
  );
}
