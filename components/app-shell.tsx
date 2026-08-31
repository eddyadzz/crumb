'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ChefHat,
  Factory,
  ShoppingCart,
  Package,
  BarChart3,
  Carrot,
  MoreHorizontal,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

const mainNav = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/recipes', label: 'Recipes', icon: ChefHat },
  { href: '/produce', label: 'Produce', icon: Factory },
  { href: '/sell', label: 'Sell', icon: ShoppingCart },
];

const moreNav = [
  { href: '/ingredients', label: 'Ingredients', icon: Carrot },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const allNav = [...mainNav, ...moreNav];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Carrot className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none tracking-tight">
              Crumb
            </p>
            <p className="text-[11px] text-muted-foreground">by BoliFlow</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {allNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <div className="rounded-xl bg-accent/50 p-3">
            <p className="text-xs font-semibold text-accent-foreground">
              Free Plan
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              MVP — all features unlocked
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Carrot className="h-4.5 w-4.5" />
            </div>
            <span className="font-display text-base font-bold tracking-tight">
              Crumb
            </span>
          </Link>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Carrot className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-base font-bold leading-none">
                    Crumb
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    by BoliFlow
                  </p>
                </div>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {allNav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t border-border bg-card/95 backdrop-blur-lg lg:hidden">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 no-tap-highlight transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground no-tap-highlight">
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px] font-medium">More</span>
              </button>
            </SheetTrigger>
          </Sheet>
        </nav>
      </div>
    </div>
  );
}
