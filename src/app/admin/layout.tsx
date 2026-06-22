import { getResolvedParent } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, UtensilsCrossed, ShoppingBag, Users, Truck, CalendarX, ChefHat, Settings, BookOpen } from 'lucide-react';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authContext = await getResolvedParent();
  if ('error' in authContext) redirect('/sign-in');

  // Admin Role Guard
  const allowedIds = (process.env.ADMIN_CLERK_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  const isSuperAdmin = allowedIds.length > 0 && allowedIds.includes(authContext.clerkUserId);

  if (!isSuperAdmin) {
    redirect('/dashboard');
  }

  const navItems = [
    { name: 'Overview', href: '/admin', icon: LayoutDashboard },
    { name: 'Menu Planner', href: '/admin/planner', icon: CalendarX },
    { name: 'Kitchen Prep', href: '/admin/kitchen', icon: ChefHat },
    { name: 'Dishes', href: '/admin/dishes', icon: UtensilsCrossed },
    { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
    { name: 'Parents', href: '/admin/parents', icon: Users },
    { name: 'Delivery', href: '/admin/delivery', icon: Truck },
    { name: 'Blocked Dates', href: '/admin/blocked-dates', icon: CalendarX },
    { name: 'Reports', href: '/admin/reports', icon: BookOpen },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside className="w-60 min-h-screen bg-card border-r flex flex-col shrink-0 print:hidden">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">A</div>
            <div>
              <p className="font-bold text-sm">Admin Panel</p>
              <p className="text-xs text-muted-foreground">Olive Lunch</p>
            </div>
          </div>
        </div>
        <nav className="p-4 flex flex-col gap-1 flex-1">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 print:p-0 overflow-auto animate-fade-in-up">
        {children}
      </main>
    </div>
  );
}
