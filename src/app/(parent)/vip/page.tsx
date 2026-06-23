import { getResolvedParent, getOrResolveOrgId } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { Star, CheckCircle2, Sparkles, TrendingDown } from 'lucide-react';

export default async function VIPPage() {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  const orgId = await getOrResolveOrgId();

  // Fetch sample dishes for the comparison table
  const { data: sampleDishes } = await supabaseAdmin
    .from('dishes')
    .select('name, price_regular, price_vip')
    .eq('is_active', true)
    .eq('org_id', orgId)
    .eq('category', 'main')
    .limit(4);

  return (
    <div className="max-w-7xl mx-auto mt-8 mb-20 px-4 sm:px-6">
      <div className="text-center mb-16 animate-fade-in-up">
        <div className="inline-flex items-center justify-center p-4 bg-accent/10 rounded-full mb-6 ring-4 ring-accent/20 relative">
          <Star className="w-10 h-10 text-accent fill-accent animate-pulse" />
          <Sparkles className="w-5 h-5 text-accent absolute -top-1 -right-1" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-6xl mb-4">
          Upgrade to <span className="text-accent underline decoration-4 underline-offset-8">Olive Lunch VIP</span>
        </h1>
        <p className="mt-6 text-xl text-slate-700 max-w-2xl mx-auto font-medium leading-relaxed">
          Lock in our lowest prices forever. Get exclusive discounts on every single meal, priority support, and special surprises for your children.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-stretch">
        {/* Benefits Column */}
        <div className="bg-white border-2 border-slate-200 rounded-[2rem] p-8 sm:p-10 shadow-xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Star className="w-64 h-64 text-accent fill-accent -mt-20 -mr-20" />
          </div>
          
          <h3 className="text-3xl font-black mb-8 text-slate-900 flex items-center gap-3">
            Your VIP Benefits
          </h3>
          
          <ul className="space-y-6 relative z-10 flex-grow">
            {[
              { title: "Save up to 50% on every order", desc: "Meals for just $4.99 (reg $7.95)." },
              { title: "Discounted Sides & Drinks", desc: "Enjoy flat discounts on all add-ons to complete their lunch." },
              { title: "Sick day protection", desc: "If your child is absent, text us by 8:30 AM that morning. We will issue a 100% full credit back." },
              { title: "Priority Customer Support", desc: "Jump to the front of the line if you ever need help or adjustments." },
              { title: "No commitments, cancel anytime", desc: "Manage your subscription instantly from your dashboard." }
            ].map((benefit, i) => (
              <li key={i} className="flex items-start gap-4">
                <div className="bg-primary/10 p-2 rounded-full mt-1 shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{benefit.title}</h4>
                  <p className="text-slate-600 font-medium mt-1 leading-snug">{benefit.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing Column */}
        <div className="bg-white border-2 border-slate-200 rounded-[2rem] p-8 sm:p-10 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-accent via-primary to-accent"></div>
          
          <div>
            <div className="inline-flex items-center gap-2 bg-accent/10 px-4 py-2 rounded-full mb-8">
              <TrendingDown className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold text-accent uppercase tracking-widest">Pays for itself fast</span>
            </div>
            
            <form action="/api/vip" method="POST" className="space-y-6">
              
              {/* Yearly Plan Selection */}
              <label className="flex items-center justify-between p-4 border-2 border-primary bg-primary/5 rounded-2xl cursor-pointer hover:bg-primary/10 transition-colors relative">
                <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                  10% OFF
                </div>
                <div className="flex items-center gap-3">
                  <input type="radio" name="plan" value="yearly" defaultChecked className="w-5 h-5 text-primary focus:ring-primary" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Yearly Plan</h4>
                    <p className="text-slate-500 text-sm font-medium">Billed annually</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900">$89.99</span>
                  <span className="text-slate-500 text-sm">/yr</span>
                </div>
              </label>

              {/* Monthly Plan Selection */}
              <label className="flex items-center justify-between p-4 border-2 border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <input type="radio" name="plan" value="monthly" className="w-5 h-5 text-primary focus:ring-primary" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Monthly Plan</h4>
                    <p className="text-slate-500 text-sm font-medium">Cancel anytime</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900">$9.99</span>
                  <span className="text-slate-500 text-sm">/mo</span>
                </div>
              </label>

              <button 
                type="submit"
                className="w-full mt-6 bg-accent text-slate-900 font-black text-xl py-5 rounded-2xl shadow-lg hover:bg-yellow-400 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Become a VIP Today
                <Star className="w-5 h-5 fill-slate-900" />
              </button>
            </form>
            
            <p className="text-center text-xs text-slate-500 mt-6 font-medium">
              Secure, encrypted payment powered by Stripe.<br/>You will be redirected to checkout.
            </p>
          </div>
        </div>

        {/* Examples Column */}
        {sampleDishes && sampleDishes.length > 0 && (
          <div className="bg-white border-2 border-slate-200 rounded-[2rem] p-8 sm:p-10 shadow-xl relative overflow-hidden flex flex-col">
            <h3 className="text-2xl font-black mb-8 text-slate-900 uppercase tracking-tight">
              Real Savings Examples
            </h3>
            <div className="grid gap-4">
              {sampleDishes.map((dish) => {
                const reg = Number(dish.price_regular);
                const vip = Number(dish.price_vip);
                const pct = Math.round((1 - vip / reg) * 100);
                return (
                  <div key={dish.name} className="flex flex-col gap-2 p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-primary/20 transition-colors">
                    <span className="font-bold text-slate-900 text-lg leading-tight">{dish.name}</span>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-400 line-through font-bold">${reg.toFixed(2)}</span>
                        <span className="font-black text-primary text-xl">${vip.toFixed(2)}</span>
                      </div>
                      <span className="bg-primary/10 text-primary text-xs font-black px-3 py-1.5 rounded-full uppercase">
                        Save {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/20 text-center">
              <p className="text-xs font-bold text-slate-700">
                VIP discounts apply automatically to every child in your account!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
