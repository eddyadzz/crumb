import Link from 'next/link';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Factory,
  ChevronRight,
  ArrowUpRight,
  Carrot,
  ChefHat,
  ShoppingCart,
  ClipboardList,
  Activity,
  Gauge,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/prisma';
import { formatMVR, formatBaseQuantity } from '@/lib/costing';
import { recipeCostPerServing, getEfficiencyMetrics } from '@/lib/queries';
import { aggregateBatches, forecastRequirements, forecastSummary } from '@/lib/forecast';
import { listRecentActivity } from '@/lib/actions/activity';
import { getTenantContext } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { tenantId } = await getTenantContext();
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [sales, products, lowStock, productionOrders, recipes, customerOrders, forecastOrders, recentActivity, efficiency] = await Promise.all([
    prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: startOfToday } },
      include: {
        items: {
          include: { product: { include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.findMany({
      where: { tenantId },
      include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } },
    }),
    prisma.ingredient.findMany({
      where: {
        tenantId,
        availableQuantity: { lte: prisma.ingredient.fields.reorderLevel },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.productionOrder.findMany({
      where: { tenantId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      include: {
        items: { include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.recipe.findMany({
      where: { tenantId },
      include: {
        recipeIngredients: { include: { ingredient: true } },
        products: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.customerOrder.findMany({
      where: {
        tenantId,
        status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY'] },
        deliveryDate: { not: null },
      },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.customerOrder.findMany({
      where: {
        tenantId,
        status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY'] },
        deliveryDate: { gte: startOfToday, lte: new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
      include: {
        items: {
          include: {
            product: { include: { recipe: { select: { id: true, name: true, servingsProduced: true } } } },
          },
        },
      },
    }),
    listRecentActivity(5),
    getEfficiencyMetrics(tenantId),
  ]);

  // Sales with cost
  const salesWithCost = sales.map((sale) => ({
    ...sale,
    cost: sale.items.reduce((sum, item) => {
      const perServing = item.product?.recipe ? recipeCostPerServing(item.product.recipe) : 0;
      return sum + perServing * item.quantity;
    }, 0),
  }));

  const todaysRevenue = salesWithCost.reduce((sum, s) => sum + s.totalAmount, 0);
  const todaysCost = salesWithCost.reduce((sum, s) => sum + s.cost, 0);
  const todaysProfit = todaysRevenue - todaysCost;
  const readyProducts = products.reduce((sum, p) => sum + p.availableQuantity, 0);
  const recentSales = sales.slice(0, 4);

  const recentSalesVM = recentSales.map((sale) => ({
    id: sale.id,
    itemsLabel: sale.items.map((item) => `${item.quantity}× ${item.product.name}`).join(', '),
    time: sale.createdAt.toISOString(),
    totalAmount: sale.totalAmount,
  }));

  const upcomingVM = productionOrders.map((order) => ({
    id: order.id,
    status: order.status,
    items: order.items.map((item) => ({
      id: item.id,
      batchCount: item.batchCount,
      recipeName: item.recipe.name,
    })),
  }));

  const lowStockVM = lowStock.map((i) => ({
    id: i.id,
    name: i.name,
    availableQuantity: i.availableQuantity,
    baseUnit: i.baseUnit,
  }));

  const upcomingOrders = customerOrders
    .sort((a, b) =>
      (a.deliveryDate?.getTime() ?? Infinity) - (b.deliveryDate?.getTime() ?? Infinity)
    )
    .slice(0, 5)
    .map((o) => ({
      id: o.id,
      status: o.status,
      customerName: o.customer?.name ?? null,
      deliveryDate: o.deliveryDate!.toISOString(),
      deliveryTime: o.deliveryTime,
      itemsLabel: o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(', '),
    }));

  const todaysOrders = customerOrders
    .filter((o) => {
      if (!o.deliveryDate) return false;
      const d = o.deliveryDate;
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    })
    .sort((a, b) => {
      if (a.deliveryTime && b.deliveryTime) return a.deliveryTime.localeCompare(b.deliveryTime);
      return a.deliveryTime ? -1 : b.deliveryTime ? 1 : 0;
    })
    .map((o) => ({
      id: o.id,
      status: o.status,
      customerName: o.customer?.name ?? null,
      deliveryTime: o.deliveryTime,
      itemsLabel: o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(', '),
    }));

  const forecastBatches = forecastOrders.flatMap((o) =>
    aggregateBatches(
      o.items.map((i) => ({
        quantity: i.quantity,
        productType: i.product.type,
        servingsProduced: i.product.recipe.servingsProduced,
        recipeId: i.product.recipe.id,
        recipeName: i.product.recipe.name,
      }))
    )
  );
  const forecastRows = forecastRequirements(
    recipes.map((r) => ({
      id: r.id,
      ingredients: r.recipeIngredients.map((ri) => ({
        quantity: ri.quantity,
        unit: ri.unit,
        ingredient: ri.ingredient,
      })),
    })),
    forecastBatches
  );
  const forecastSummaryData = forecastSummary(forecastRows, forecastOrders.length);

  const recipesVM = recipes.map((recipe) => {
    const perServing = recipeCostPerServing(recipe);
    const product = recipe.products[0];
    const price = product?.sellingPrice ?? 0;
    const profit = price - perServing;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return {
      id: recipe.id,
      name: recipe.name,
      perServing,
      price,
      profit,
      margin,
      hasProduct: !!product,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Dashboard"
        description="Your business at a glance"
        action={
          <Button asChild className="gap-2">
            <Link href="/sell">
              <ShoppingCart className="h-4 w-4" />
              Start Selling
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Today's Revenue" value={formatMVR(todaysRevenue)} icon={<TrendingUp className="h-5 w-5" />} variant="primary" />
        <StatCard label="Today's Profit" value={formatMVR(todaysProfit)} icon={<ArrowUpRight className="h-5 w-5" />} variant="success" />
        <StatCard label="Products Ready" value={String(readyProducts)} icon={<Package className="h-5 w-5" />} />
        <StatCard
          label="Low Stock Items"
          value={String(lowStockVM.length)}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={lowStockVM.length > 0 ? 'warning' : 'default'}
        />
        {efficiency.hasData ? (
          <StatCard
            label="Efficiency Score"
            value={`${efficiency.score.toFixed(1)}%`}
            icon={<Gauge className="h-5 w-5" />}
            variant={
              efficiency.band === 'Excellent' || efficiency.band === 'Good'
                ? 'success'
                : efficiency.band === 'Fair'
                  ? 'warning'
                  : 'destructive'
            }
            trend={{ value: efficiency.band, positive: efficiency.score >= 90 }}
          />
        ) : (
          <StatCard
            label="Efficiency Score"
            value="—"
            icon={<Gauge className="h-5 w-5" />}
            trend={{ value: 'complete a batch', positive: true }}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Sales</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/reports">
                View all
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
            <CardTitle className="text-base">Upcoming Production</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/produce">
                View all
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingVM.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No upcoming production</p>
            )}
            {upcomingVM.map((order) => (
              <div key={order.id} className="rounded-xl border border-border p-3 transition-colors hover:bg-muted/50">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {order.items.length} recipe
                    {order.items.length > 1 ? 's' : ''}
                  </p>
                  <Badge
                    variant={order.status === 'IN_PROGRESS' ? 'default' : 'secondary'}
                    className={order.status === 'IN_PROGRESS' ? 'bg-primary/10 text-primary' : ''}
                  >
                    {order.status === 'IN_PROGRESS' ? 'In Progress' : 'Planned'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {order.items.map((item) => (
                    <span key={item.id} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {item.batchCount}× {item.recipeName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

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

      {todaysOrders.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              Today&apos;s Work Queue
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/schedule">
                Open Schedule
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaysOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.itemsLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.customerName ?? 'Walk-in'}
                    {o.deliveryTime ? ` · deliver at ${o.deliveryTime}` : ''}
                  </p>
                </div>
                <Badge
                  variant={o.status === 'READY' ? 'default' : 'secondary'}
                  className={o.status === 'READY' ? 'bg-success/10 text-success' : ''}
                >
                  {o.status === 'READY' ? 'Ready' : o.status === 'IN_PRODUCTION' ? 'In Production' : 'Confirmed'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {forecastSummaryData.ingredientsShort > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Forecast Shortages
              <span className="text-sm font-normal text-warning">· next 7 days</span>
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/forecast">
                Open Forecast
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {forecastSummaryData.ingredientsShort} ingredient
              {forecastSummaryData.ingredientsShort > 1 ? 's' : ''} short across{' '}
              {forecastSummaryData.orderCount} order
              {forecastSummaryData.orderCount === 1 ? '' : 's'}. Estimated purchase cost:{' '}
              <span className="font-semibold text-foreground">{formatMVR(forecastSummaryData.estimatedCost)}</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {forecastRows
                .filter((r) => !r.enough)
                .slice(0, 6)
                .map((r) => (
                  <div key={r.ingredientId} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      short {formatBaseQuantity(r.shortageBase, r.baseUnit)}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingOrders.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              Upcoming Customer Orders
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/orders">
                View all
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.itemsLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.customerName ?? 'Walk-in'} · {new Date(o.deliveryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {o.deliveryTime ? ` at ${o.deliveryTime}` : ''}
                  </p>
                </div>
                <Badge
                  variant={o.status === 'READY' ? 'default' : 'secondary'}
                  className={o.status === 'READY' ? 'bg-success/10 text-success' : ''}
                >
                  {o.status === 'READY' ? 'Ready' : o.status === 'IN_PRODUCTION' ? 'In Production' : 'Confirmed'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {lowStockVM.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <CardTitle className="text-base">Low Stock Alert</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ingredients">
                Manage
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockVM.map((ing) => (
                <div key={ing.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <Carrot className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{ing.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ing.availableQuantity}
                    {ing.baseUnit} left
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/orders?new=1" icon={<ClipboardList className="h-5 w-5" />} label="New Order" />
        <QuickAction href="/sell" icon={<ShoppingCart className="h-5 w-5" />} label="Sell" />
        <QuickAction href="/produce" icon={<Factory className="h-5 w-5" />} label="Plan Production" />
        <QuickAction href="/recipes" icon={<ChefHat className="h-5 w-5" />} label="New Recipe" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recipe Profitability</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/recipes">
              View all
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recipesVM.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{recipe.name}</p>
                <p className="text-xs text-muted-foreground">
                  Cost: {formatMVR(recipe.perServing)}/serving
                  {recipe.hasProduct && ` · Price: ${formatMVR(recipe.price)}`}
                </p>
              </div>
              {recipe.hasProduct && (
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-success">{formatMVR(recipe.profit)}</p>
                  <p className="text-xs text-muted-foreground">{recipe.margin.toFixed(0)}% margin</p>
                </div>
              )}
            </Link>
          ))}
          {recipesVM.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No recipes yet</p>
          )}
        </CardContent>
      </Card>
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
