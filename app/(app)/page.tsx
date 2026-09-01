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
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/prisma';
import { formatMVR } from '@/lib/costing';
import { recipeCostPerServing } from '@/lib/queries';
import { getTenantContext } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { tenantId } = await getTenantContext();
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [sales, products, lowStock, productionOrders, recipes] = await Promise.all([
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Today's Revenue" value={formatMVR(todaysRevenue)} icon={<TrendingUp className="h-5 w-5" />} variant="primary" />
        <StatCard label="Today's Profit" value={formatMVR(todaysProfit)} icon={<ArrowUpRight className="h-5 w-5" />} variant="success" />
        <StatCard label="Products Ready" value={String(readyProducts)} icon={<Package className="h-5 w-5" />} />
        <StatCard
          label="Low Stock Items"
          value={String(lowStockVM.length)}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={lowStockVM.length > 0 ? 'warning' : 'default'}
        />
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
        <QuickAction href="/ingredients" icon={<Carrot className="h-5 w-5" />} label="Add Ingredient" />
        <QuickAction href="/recipes" icon={<ChefHat className="h-5 w-5" />} label="New Recipe" />
        <QuickAction href="/produce" icon={<Factory className="h-5 w-5" />} label="Plan Production" />
        <QuickAction href="/sell" icon={<ShoppingCart className="h-5 w-5" />} label="Sell" />
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
