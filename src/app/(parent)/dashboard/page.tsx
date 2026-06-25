import { getResolvedParent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PlusCircle, Star } from 'lucide-react';
import ReferralCard from '@/components/parent/ReferralCard';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const authContext = await getResolvedParent();
  
  if ('error' in authContext) {
    redirect('/sign-in');
  }

  const { parentId } = authContext;
  const { getOrResolveOrgId } = await import('@/lib/auth');
  const orgId = await getOrResolveOrgId();

  // Fetch Parent Data
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('name, is_vip, referral_code')
    .eq('id', parentId || '')
    .single();

  // Optimistic VIP state from Stripe redirect & Verification
  let isVip = parent?.is_vip || false;
  
  if (searchParams?.vip_success === 'true' && searchParams?.session_id && !parent?.is_vip) {
    const sessionId = searchParams.session_id as string;
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as any });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid' && session.mode === 'subscription') {
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        
        // Update database directly just in case webhook didn't arrive yet
        await supabaseAdmin
          .from('parents')
          .update({ 
            is_vip: true, 
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            vip_cancel_at: null,
            vip_cancel_at_period_end: false
          })
          .eq('id', parentId || '');
          
        isVip = true;
      }
    } catch (e) {
      console.error('Failed to sync VIP status from session', e);
    }
  }

  // Sync normal meal orders if webhook is delayed
  if (searchParams?.success === 'true' && searchParams?.session_id) {
    const sessionId = searchParams.session_id as string;
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as any });
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid' && session.mode === 'payment') {
        const { data: orders } = await supabaseAdmin
          .from('orders')
          .update({ status: 'paid' })
          .eq('stripe_session_id', session.id)
          .eq('status', 'pending')
          .select('id, parent_id, total_amount');
          
        if (orders && orders.length > 0) {
          const creditToUse = Number(session.metadata?.creditToUse || '0');
          const couponId = session.metadata?.couponId;

          if (creditToUse > 0) {
            // Check if credit was already deducted (by webhook) to avoid double counting
            const { data: existingCredit } = await supabaseAdmin.from('credits').select('id').eq('order_id', orders[0].id);
            if (!existingCredit || existingCredit.length === 0) {
              await supabaseAdmin.from('credits').insert({
                parent_id: parentId || '',
                amount: -creditToUse,
                source: 'order_usage',
                order_id: orders[0].id
              });
            }
          }
          if (couponId) {
            // Increment coupon usage. We use RPC if possible or ignore as webhook will catch it
            try {
              await supabaseAdmin.rpc('increment_coupon_usage' as any, { p_coupon_id: couponId });
            } catch (e) {
              console.warn('Failed to increment coupon usage:', e);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to sync order status from session', e);
    }
  }

  // Fetch Children
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('*, schools(name)')
    .eq('parent_id', parentId)
    .is('deleted_at', null);

  // Fetch Credits
  const { data: credits } = await supabaseAdmin
    .from('credits')
    .select('amount')
    .eq('parent_id', parentId);

  const rawCredit = credits ? credits.reduce((sum, c) => sum + Number(c.amount), 0) : 0;

  // Fetch pending credits locked in orders
  const { data: pendingOrders } = await supabaseAdmin
    .from('orders')
    .select('credit_used')
    .eq('parent_id', parentId)
    .eq('status', 'pending');
  const lockedCredit = pendingOrders ? pendingOrders.reduce((sum, o) => sum + Number(o.credit_used || 0), 0) : 0;

  const totalCredit = Math.max(0, rawCredit - lockedCredit);

  // Fetch Dashboard Messages
  const { data: dashboardMessages } = await supabaseAdmin
    .from('dashboard_messages')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      {searchParams?.success === 'true' && (
        <div className="p-5 rounded-2xl border-2 bg-emerald-50 border-emerald-200 text-emerald-950 shadow-md animate-in fade-in slide-in-from-top-4 duration-300 flex items-start gap-4">
          <div className="text-3xl">🥳</div>
          <div className="flex-1">
            <h4 className="font-extrabold text-lg text-emerald-900">Order Placed Successfully!</h4>
            <p className="text-sm font-semibold mt-1">
              {searchParams?.session_id 
                ? 'Your payment was processed and your lunch order is now active.'
                : 'Your order was paid 100% using your available account credit.'}
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Welcome back, {parent?.name}</h1>
          <p className="text-slate-700 text-lg font-medium mt-1">Manage your children's lunch orders.</p>
        </div>
        
        {isVip ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-5 py-2.5 text-base font-bold text-primary ring-2 ring-inset ring-primary/30">
            <Star className="h-5 w-5 fill-primary" />
            VIP Member Active
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <Link href="/vip" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-black text-accent-foreground shadow-md hover:bg-accent/90 transition-all transform hover:scale-105">
              <Star className="h-5 w-5" />
              Upgrade to VIP
            </Link>
          </div>
        )}
      </header>

      {/* Dashboard Messages System Alert Box */}
      {dashboardMessages && dashboardMessages.length > 0 && (
        <div className="space-y-3">
          {dashboardMessages.map((msg) => {
            const bgClass = msg.type === 'warning' 
              ? 'bg-amber-50 border-amber-200 text-amber-900' 
              : msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-blue-50 border-blue-200 text-blue-900';
            
            const accentText = msg.type === 'warning'
              ? 'text-amber-800'
              : msg.type === 'success'
              ? 'text-emerald-800'
              : 'text-blue-800';

            return (
              <div key={msg.id} className={`p-5 rounded-2xl border-2 ${bgClass} shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 flex items-start gap-3`}>
                <div className="text-lg">📢</div>
                <div className="flex-1">
                  <p className="text-sm font-bold leading-relaxed">{msg.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats/Overview Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border-2 bg-card p-6 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Account Credit</h3>
            <p className="mt-2 text-4xl font-black text-foreground">${totalCredit.toFixed(2)}</p>
            {lockedCredit > 0 && (
              <p className="text-xs text-muted-foreground mt-1 font-semibold">
                (${lockedCredit.toFixed(2)} reserved for pending orders)
              </p>
            )}
          </div>
          {totalCredit > 0 && <p className="text-sm font-bold text-primary mt-2">Automatically applied at checkout</p>}
        </div>
        
        <ReferralCard code={parent?.referral_code || null} />

        {isVip ? (
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 shadow-md flex flex-col justify-center items-center text-center relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 p-2 opacity-5">
              <Star className="h-40 w-40 text-primary fill-primary" />
            </div>
            <div className="relative">
              <div className="text-4xl mb-3">⭐</div>
              <h3 className="text-2xl font-black text-slate-900 leading-tight mb-2">You're now a VIP Member!</h3>
              <p className="text-base font-bold text-slate-700 leading-relaxed max-w-[280px] mx-auto">
                Welcome to the family! Your savings start with your very next order.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-6 shadow-sm bg-accent/5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Star className="h-20 w-20 text-accent fill-accent -mr-6 -mt-6" />
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-accent fill-accent" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">VIP Benefit</h3>
              </div>
              <p className="text-2xl font-black text-foreground leading-tight">Join VIP & save up to 50% on every meal!</p>
              <p className="text-sm text-slate-800 mt-3 font-medium leading-relaxed">
                Get favorites like our 4pc Chicken Strips for just $4 (was $6.95)—that’s <strong className="text-primary font-bold">42% off!</strong>
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-accent/30 flex items-center justify-between relative">
              <div className="text-xs font-bold text-slate-700 leading-tight">
                Save on every single order.
              </div>
              <Link href="/vip" className="rounded-full bg-accent px-5 py-2.5 text-sm font-black text-accent-foreground hover:bg-accent/90 transition-all shadow-md">
                Upgrade Now
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border-2 bg-card shadow-md overflow-hidden">
        <div className="border-b-2 p-6 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-2xl font-black text-foreground">Your Children</h2>
          <Link href="/children/new" className="inline-flex items-center gap-1.5 text-base font-bold text-primary hover:text-primary/80 transition-colors">
            <PlusCircle className="h-5 w-5" />
            Add Child
          </Link>
        </div>
        <div className="p-0">
          {!children || children.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>You haven't added any children yet.</p>
              <Link href="/children/new" className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Add your first child
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {children.map((child) => (
                <li key={child.id} className="p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{child.name}</h3>
                    <p className="text-base font-semibold text-slate-700 mt-1">
                      {/* Note: In a real app we'd strongly type this or map the relation */}
                      {(child.schools as any)?.name} • Div {child.division}
                    </p>
                  </div>
                  <Link href={`/menu?child=${child.id}`} className="rounded-xl bg-secondary px-6 py-3 text-base font-bold text-secondary-foreground hover:bg-secondary/80 transition-all">
                    Order Lunch
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
