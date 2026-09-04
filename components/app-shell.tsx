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
  Wrench,
  Sparkles,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  Bell,
  Activity,
  Tag,
  ListChecks,
  Users,
  RefreshCcw,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trialDaysLeft } from '@/lib/trial';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationsBell } from '@/components/notifications-bell';
import { SyncStatusPill } from '@/components/sync-status-pill';
import { ModeToggle, useUiMode } from '@/components/mode-toggle';
import { useState } from 'react';

// Bottom bar = the daily loop. Everything else is workflow-ordered in More.
const mainNav = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/produce', label: 'Produce', icon: Factory },
  { href: '/sell', label: 'Sell', icon: ShoppingCart },
  { href: '/recipes', label: 'Recipes', icon: ChefHat },
];

// Ordered by how a bakery works: plan -> buy -> make -> price -> customers -> report.
const moreNav = [
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/forecast', label: 'Forecast', icon: CalendarRange },
  { href: '/shopping-list', label: 'Shopping List', icon: ListChecks },
  { href: '/floor', label: 'Floor Mode', icon: Play },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/ingredients', label: 'Ingredients', icon: Carrot },
  { href: '/pricing', label: 'Pricing', icon: Tag },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/tools', label: 'Kitchen Tools', icon: Wrench },
  { href: '/sync', label: 'Sync Center', icon: RefreshCcw },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const allNav = [...mainNav, ...moreNav];

const byHref = (href: string) => allNav.find((i) => i.href === href)!;

/** Simple mode keeps the daily baking loop front and centre and hides the
 * power-tool surfaces (Activity, SaaS extras). */
const simpleMain = [
  byHref('/'),
  byHref('/orders'),
  byHref('/produce'),
  byHref('/sell'),
  byHref('/recipes'),
];
const simpleMore = [
  byHref('/schedule'),
  byHref('/forecast'),
  byHref('/shopping-list'),
  byHref('/floor'),
  byHref('/products'),
  byHref('/ingredients'),
  byHref('/pricing'),
  byHref('/customers'),
  byHref('/reports'),
  byHref('/notifications'),
  byHref('/tools'),
  byHref('/sync'),
  byHref('/settings'),
];

export type AccountSummary = {
  tenantName: string;
  planName: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
};

export function AppShell({
  children,
  account,
}: {
  children: React.ReactNode;
  account: AccountSummary;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const uiMode = useUiMode();
  const mainItems = uiMode === 'simple' ? simpleMain : mainNav;
  const moreItems = uiMode === 'simple' ? simpleMore : moreNav;
  const sidebarItems = [...mainItems, ...moreItems];

  const onTrial = account.subscriptionStatus === 'TRIAL';
  const daysLeft = onTrial ? trialDaysLeft(account.trialEndsAt) : null;
  const trialExpired = onTrial && daysLeft !== null && daysLeft === 0;
  const planLine = onTrial
    ? trialExpired
      ? `${account.planName} Plan · trial ended`
      : `${account.planName} Plan · trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
    : `${account.planName} Plan`;

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
          {sidebarItems.map((item) => {
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
          <div className="flex items-center justify-between gap-2">
            <div className="rounded-xl bg-accent/50 p-3">
              <p className="text-xs font-semibold text-accent-foreground">
                {planLine}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {account.tenantName}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <SyncStatusPill />
              <NotificationsBell />
            </div>
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
          <div className="flex items-center gap-1">
            <SyncStatusPill />
            <NotificationsBell />
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-72 flex-col p-0">
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
                {moreItems.map((item) => {
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
              <div className="mt-auto border-t border-border p-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Interface mode</p>
                <ModeToggle />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Simple keeps the daily baking loop up front. Advanced shows everything.
                </p>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </header>

        {/* Trial notice */}
        {onTrial && daysLeft !== null && daysLeft > 0 && (
          <div className="flex items-center justify-center gap-2 border-b border-amber-200/70 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-800">
            <Sparkles className="h-3.5 w-3.5" />
            Free trial — {daysLeft} day{daysLeft === 1 ? '' : 's'} left
          </div>
        )}
        {trialExpired && (
          <div className="flex items-center justify-center gap-2 border-b border-orange-300/70 bg-orange-50 px-4 py-1.5 text-xs font-medium text-orange-800">
            <Sparkles className="h-3.5 w-3.5" />
            Your free trial has ended — editing is paused. Contact BoliFlow to
            reactivate.
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t border-border bg-card/95 backdrop-blur-lg lg:hidden">
          {mainItems.map((item) => {
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
