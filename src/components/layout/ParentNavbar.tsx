'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Home, Calendar, ShoppingBag, Settings, ShieldCheck } from 'lucide-react';

const navItems = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Menu', href: '/menu', icon: Calendar },
  { name: 'Orders', href: '/orders', icon: ShoppingBag },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const adminNavItem = { name: 'Admin', href: '/admin', icon: ShieldCheck };

export function ParentNavbar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {/* Top Navbar (Desktop) & Header (Mobile) */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shadow-sm">
              O
            </div>
            <span className="text-xl font-semibold tracking-tight text-primary">Olive Lunch</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href={adminNavItem.href}
                className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary ${
                  pathname.startsWith('/admin') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {adminNavItem.name}
              </Link>
            )}
            <div className="ml-4 flex items-center gap-4">
              <UserButton />
            </div>
          </nav>

          {/* Mobile User Button */}
          <div className="flex md:hidden items-center gap-4">
            <UserButton />
          </div>
        </div>
      </header>

      {/* Bottom Tab Bar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 z-50 w-full border-t bg-background/90 backdrop-blur-md pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'fill-primary/20' : ''}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
