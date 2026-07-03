'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Home, Calendar, ShoppingBag, Settings, ShieldCheck, ShoppingCart } from 'lucide-react';

const navItems = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Menu', href: '/menu', icon: Calendar },
  { name: 'My Orders', href: '/orders', icon: ShoppingBag },
  { name: 'Cart', href: '/cart', icon: ShoppingCart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const adminNavItem = { name: 'Admin', href: '/admin', icon: ShieldCheck };

export function ParentNavbar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const updateCartCount = () => {
      let count = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('olive_cart_')) {
            const saved = localStorage.getItem(key);
            if (saved) {
              const parsed = JSON.parse(saved);
              Object.values(parsed).forEach((dayCart: any) => {
                Object.values(dayCart).forEach((qty: any) => {
                  count += Number(qty) || 0;
                });
              });
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
      setCartCount(count);
    };

    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    window.addEventListener('storage', updateCartCount);

    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);

  return (
    <>
      {/* Top Navbar (Desktop) & Header (Mobile) */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between px-4">
          <a href="https://www.olivelunch.com" target="_blank" rel="noopener noreferrer" className="flex items-center hover:opacity-90 transition-opacity">
            <img src="/logo.jpg" alt="Olive Lunch" className="h-10 w-auto" />
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative text-sm font-medium transition-colors hover:text-primary flex items-center gap-1 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                  {item.name === 'Cart' && cartCount > 0 && (
                    <span className="absolute -top-2.5 -right-3 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-background animate-pulse">
                      {cartCount}
                    </span>
                  )}
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
                className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'fill-primary/20' : ''}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
                {item.name === 'Cart' && cartCount > 0 && (
                  <span className="absolute top-1 right-[25%] flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-background">
                    {cartCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
