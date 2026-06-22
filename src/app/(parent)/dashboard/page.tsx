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

  // Fetch Parent Data
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('name, is_vip, referral_code')
    .eq('id', parentId)
    .single();

  // Optimistic VIP state from Stripe redirect
  const isVipSuccess = searchParams?.vip_success === 'true';
  const isVip = parent?.is_vip || isVipSuccess;

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

  const totalCredit = credits ? credits.reduce((sum, c) => sum + Number(c.amount), 0) : 0;

  return (
    <div className="space-y-6">
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

      {/* Stats/Overview Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border-2 bg-card p-6 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-wide">Account Credit</h3>
            <p className="mt-2 text-4xl font-black text-foreground">${totalCredit.toFixed(2)}</p>
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
              <p className="text-2xl font-black text-foreground leading-tight">Join VIP for just $6 (reg $7.5) signature meals</p>
              <p className="text-sm text-slate-800 mt-3 font-medium leading-relaxed">
                Save on every order, like Chicken Nuggets from $3 to $2 and Wagyu Beef Gyoza from $4.50 to $3 — <strong className="text-primary font-bold">up to 33% off!</strong>
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-accent/30 flex items-center justify-between relative">
              <div className="text-xs font-bold text-slate-700 leading-tight">
                Get VIP pricing on <br/> every single item.
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
