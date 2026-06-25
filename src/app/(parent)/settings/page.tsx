import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import SettingsClient from '@/components/parent/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function UserSettingsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const { parentId } = authContext;
  const orgId = await getOrResolveOrgId();

  // --- Fallback sync: if redirected from Stripe success page after paying VIP difference ---
  let shouldRedirect = false;
  if (searchParams?.vip_diff_success === 'true' && searchParams?.session_id) {
    const sessionId = searchParams.session_id as string;
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as any });
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid' && session.metadata?.action === 'vip_cancel_difference') {
        const subId = session.metadata.subId;
        
        // 1. Fetch paid future orders and revert their prices to regular
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
        const { data: futureOrders } = await supabaseAdmin
          .from('orders')
          .select(`
            id, gross_amount, credit_used,
            order_items ( id, quantity, is_large,
              dishes ( price_regular, price_vip, large_price_regular, large_price_vip, has_large )
            )
          `)
          .eq('parent_id', parentId || '')
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
              gross_amount: newGross,
              total_amount: newGross - Number(order.credit_used),
            }).eq('id', order.id);
          }
        }

        // 2. Cancel the Stripe subscription
        if (subId) {
          try {
            await stripe.subscriptions.cancel(subId);
          } catch (e) {
            console.warn('Sync fallback: failed to cancel stripe subscription:', e);
          }
        }

        // 3. Strip VIP from parent
        await supabaseAdmin.from('parents').update({
          is_vip: false,
          stripe_subscription_id: null,
          vip_cancel_at: null,
          vip_cancel_at_period_end: false,
        }).eq('id', parentId || '');

        shouldRedirect = true;
      }
    } catch (e) {
      console.error('Failed to sync VIP cancellation status from session', e);
    }
  }

  if (shouldRedirect) {
    redirect('/settings');
  }

  // Fetch Parent Data
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('id, name, email, is_vip, referral_code')
    .eq('id', parentId || '')
    .single();

  // Fetch Children
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id, name, division, school_id, delivery_location, lunch_time, schools(name)')
    .eq('parent_id', parentId || '')
    .is('deleted_at', null);

  // Fetch Schools for the add/edit child form
  const { data: schools } = await supabaseAdmin
    .from('schools')
    .select('id, name, is_active')
    .eq('org_id', orgId)
    .order('name');

  // Fetch Credits History
  const { data: credits } = await supabaseAdmin
    .from('credits')
    .select('id, amount, source, created_at')
    .eq('parent_id', parentId || '')
    .order('created_at', { ascending: false });

  // Fetch Org Contact Info
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single();

  return (
    <SettingsClient
      parent={parent}
      childrenList={children || []}
      schools={schools || []}
      credits={credits || []}
      orgId={orgId!}
      contactPhone={org?.settings?.contact_phone || ''}
      contactEmail={org?.settings?.contact_email || ''}
      contactWhatsapp={org?.settings?.contact_whatsapp || ''}
    />
  );
}
