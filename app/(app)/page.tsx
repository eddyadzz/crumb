import Link from 'next/link';
import {
  TrendingUp,
  AlertTriangle,
  Factory,
  ChevronRight,
  Carrot,
  ShoppingCart,
  ClipboardList,
  Activity,
  Gauge,
  CalendarDays,
  PackageCheck,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { SetupChecklist } from '@/components/setup-checklist';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/prisma';
import { formatMVR, formatBaseQuantity } from '@/lib/costing';
import { recipeCostPerServing, getSetupProgress, getEfficiencyMetrics, getBatchVariance } from '@/lib/queries';
import { aggregateBatches } from '@/lib/forecast';
import { listRecentActivity } from '@/lib/actions/activity';
import { getTenantContext } from '@/lib/tenant';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { tenantId } = await getTenantContext();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDayAfterTomorrow = new Date(startOfTomorrow);
  startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    todaysOrders,
    tomorrowsOrders,
    readyCount,
    activeProduction,
    monthSales,
    monthOrderCount,
    orderGroups,
    lowStock,
    batchVariance,
    recentActivity,
    setupProgress,
    efficiency,
  ] = await Promise.all([
    // Orders due today (the work queue).
    prisma.customerOrder.findMany({
      where: { tenantId, status: { not: 'CANCELLED' }, deliveryDate: { gte: startOfToday, lt: startOfTomorrow } },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true, type: true, recipeId: true, recipe: { select: { servingsProduced: true } } } } } },
      },
      orderBy: [{ deliveryTime: 'asc' }, { createdAt: 'asc' }],
    }),
    // Orders due tomorrow (for the queue preview + batch planning).
    prisma.customerOrder.findMany({
      where: { tenantId, status: { not: 'CANCELLED' }, deliveryDate: { gte: startOfTomorrow, lt: startOfDayAfterTomorrow } },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true, type: true, recipeId: true, recipe: { select: { servingsProduced: true } } } } } },
      },
      orderBy: [{ deliveryTime: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.customerOrder.count({ where: { tenantId, status: 'READY' } }),
    prisma.productionOrder.findMany({
      where: { tenantId, status: 'IN_PROGRESS' },
      include: { items: { include: { recipe: { select: { name: true } } } } },
      take: 3,
    }),
    // Month-to-date sales, for the revenue snapshot + recent sales.
    prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: startOfMonth } },
      include: {
        items: { include: { product: { include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customerOrder.count({ where: { tenantId, status: { not: 'CANCELLED' }, createdAt: { gte: startOfMonth } } }),
    prisma.customerOrder.groupBy({
      by: ['customerId'],
      where: { tenantId, status: { not: 'CANCELLED' }, customerId: { not: null } },
      _count: { _all: true },
    }),
    prisma.ingredient.findMany({
      where: { tenantId, availableQuantity: { lte: prisma.ingredient.fields.reorderLevel } },
      orderBy: { name: 'asc' },
      take: 3,
    }),
    getBatchVariance(tenantId),
    listRecentActivity(5),
    getSetupProgress(tenantId),
    getEfficiencyMetrics(tenantId),
  ]);

  const expectedRevenue = todaysOrders.reduce((s, o) => s + o.totalAmount, 0);

  // Batches still needed to fulfil confirmed orders due today + tomorrow —
  // confirmed means accepted but production has not started yet.
  const batchPlan = aggregateBatches(
    [...todaysOrders, ...tomorrowsOrders]
      .filter((o) => o.status === 'CONFIRMED')
      .flatMap((o) =>
        o.items.map((i) => ({
          quantity: i.quantity,
          productType: i.product.type,
          servingsProduced: i.product.recipe.servingsProduced,
          recipeId: i.product.recipeId,
          recipeName: i.product.name,
        }))
      )
  );
  const batchesNeededTotal = batchPlan.reduce((s, b) => s + b.batchCount, 0);

  const monthRevenue = monthSales.reduce((s, sale) => s + sale.totalAmount, 0);
  const monthProfit = monthSales.reduce(
    (sum, sale) =>
      sum +
      sale.totalAmount -
      sale.items.reduce((s, item) => {
        const perServing = item.product?.recipe ? recipeCostPerServing(item.product.recipe) : 0;
        return s + perServing * item.quantity;
      }, 0),
    0
  );
  const repeatCustomers = orderGroups.filter((g) => g._count._all > 1).length;

  const overBudgetBatches = batchVariance
    .filter((b) => b.costVariance > 0 && b.createdAt >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
    .sort((a, b) => b.costVariance - a.costVariance)
    .slice(0, 2);

  const alerts: { icon: 'stock' | 'plan' | 'budget'; text: string; href: string; linkLabel: string }[] = [];
  for (const ing of lowStock) {
    alerts.push({
      icon: 'stock',
      text: `${ing.name} low — ${formatBaseQuantity(ing.availableQuantity, ing.baseUnit)} left`,
      href: '/ingredients',
      linkLabel: 'Restock',
    });
  }
  const unplannedCount = todaysOrders.filter((o) => o.status === 'CONFIRMED').length +
    tomorrowsOrders.filter((o) => o.status === 'CONFIRMED').length;
  if (unplannedCount > 0) {
    alerts.push({
      icon: 'plan',
      text: `${unplannedCount} order${unplannedCount > 1 ? 's' : ''} due within 24h not yet in production`,
      href: '/schedule',
      linkLabel: 'Plan',
    });
  }
  for (const b of overBudgetBatches) {
    alerts.push({
      icon: 'budget',
      text: `${b.recipeName} ran ${formatMVR(b.costVariance)} over plan`,
      href: '/reports',
      linkLabel: 'Variance',
    });
  }

  const recentSalesVM = monthSales
    .filter((s) => s.createdAt >= startOfToday)
    .slice(0, 4)
    .map((sale) => ({
      id: sale.id,
      itemsLabel: sale.items.map((item) => `${item.quantity}× ${item.product.name}`).join(', '),
      time: sale.createdAt.toISOString(),
      totalAmount: sale.totalAmount,
    }));

  const queueRows = [
    ...todaysOrders.map((o) => ({ ...o, dueLabel: 'Today', isToday: true })),
    ...tomorrowsOrders.map((o) => ({ ...o, dueLabel: 'Tomorrow', isToday: false })),
  ];
  const statusLabel: Record<string, string> = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    IN_PRODUCTION: 'In Production',
    READY: 'Ready',
    DELIVERED: 'Delivered',
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Dashboard"
        description="Your command center for today"
      />

      <SetupChecklist progress={setupProgress} />

      {/* Today's Focus */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Today's Orders"
          value={String(todaysOrders.length)}
          icon={<ClipboardList className="h-5 w-5" />}
          variant="primary"
          trend={{ value: `${formatMVR(expectedRevenue)} expected`, positive: true }}
        />
        <StatCard
          label="Need Production"
          value={`${batchesNeededTotal} batch${batchesNeededTotal === 1 ? '' : 'es'}`}
          icon={<Factory className="h-5 w-5" />}
          variant={batchesNeededTotal > 0 ? 'warning' : 'default'}
          trend={{ value: 'from confirmed orders', positive: true }}
        />
        <StatCard
          label="Ready for Pickup"
          value={String(readyCount)}
          icon={<PackageCheck className="h-5 w-5" />}
          variant={readyCount > 0 ? 'success' : 'default'}
        />
        <StatCard
          label="Expected Revenue"
          value={formatMVR(expectedRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={{ value: 'due today', positive: true }}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        <QuickAction href="/orders?new=1" icon={<ClipboardList className="h-5 w-5" />} label="Add Order" />
        <QuickAction href="/schedule" icon={<CalendarDays className="h-5 w-5" />} label="Schedule" />
        <QuickAction href="/floor" icon={<Factory className="h-5 w-5" />} label="Floor Mode" />
        <QuickAction href="/forecast" icon={<Carrot className="h-5 w-5" />} label="Forecast" />
      </div>

      {/* Attention Needed */}
      <Card className={cn(alerts.length > 0 ? 'border-warning/30 bg-warning/5' : 'border-success/30 bg-success/5')}>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {alerts.length > 0 ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <PackageCheck className="h-5 w-5 text-success" />
            )}
            {alerts.length > 0 ? 'Attention Needed' : 'All Clear'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Stock is healthy, orders are planned, and batches are on budget.
            </p>
          ) : (
            alerts.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {a.icon === 'stock' && <Carrot className="h-4 w-4 shrink-0 text-warning" />}
                  {a.icon === 'plan' && <CalendarDays className="h-4 w-4 shrink-0 text-warning" />}
                  {a.icon === 'budget' && <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />}
                  <p className="truncate text-sm">{a.text}</p>
                </div>
                <Button variant="ghost" size="sm" asChild className="shrink-0">
                  <Link href={a.href}>
                    {a.linkLabel}
                    <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Today's Production Queue */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Factory className="h-5 w-5 text-muted-foreground" />
            Production Queue
          </CardTitle>
          {activeProduction.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/floor">
                Batch in progress — open Floor Mode
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {activeProduction.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="min-w-0 truncate text-sm font-medium">
                {p.items.map((i) => `${i.batchCount}× ${i.recipe.name}`).join(', ')}
              </p>
              <Badge className="bg-primary/10 text-primary">In Progress</Badge>
            </div>
          ))}
          {queueRows.length === 0 && activeProduction.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing due today or tomorrow — enjoy the quiet.
            </p>
          )}
          {queueRows.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(', ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {o.customer?.name ?? 'Walk-in'}
                  {o.deliveryTime ? ` · due ${o.deliveryTime}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{o.dueLabel}</span>
                <Badge
                  variant={o.status === 'READY' ? 'default' : 'secondary'}
                  className={o.status === 'READY' ? 'bg-success/10 text-success' : ''}
                >
                  {statusLabel[o.status] ?? o.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Revenue Snapshot — small, below operations */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            This Month
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/reports">
              Reports
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MiniStat label="Revenue" value={formatMVR(monthRevenue)} tone="default" />
            <MiniStat label="Profit" value={formatMVR(monthProfit)} tone={monthProfit >= 0 ? 'success' : 'destructive'} />
            <MiniStat label="Orders" value={String(monthOrderCount)} tone="default" />
            <MiniStat label="Repeat customers" value={String(repeatCustomers)} tone="default" />
            <MiniStat
              label="Efficiency (30d)"
              value={efficiency.hasData ? `${efficiency.score.toFixed(0)}%` : '—'}
              tone={efficiency.band === 'Fair' ? 'warning' : efficiency.band === 'Needs Attention' ? 'destructive' : 'success'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Sales + Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              Today&apos;s Sales
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sell">
                Record sale
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSalesVM.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No sales today yet</p>
            )}
            {recentSalesVM.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sale.itemsLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sale.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <p className="shrink-0 font-display text-sm font-bold">{formatMVR(sale.totalAmount)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/activity">
                View all
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No activity yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentActivity.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{e.title}</p>
                      {e.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {e.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'default' | 'success' | 'warning' | 'destructive' }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-display text-base font-bold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-all hover:border-primary/30 hover:bg-accent/30 active:scale-[0.97]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}