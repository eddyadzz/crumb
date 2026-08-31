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
import {
  getTodaysRevenue,
  getTodaysSales,
  getLowStockIngredients,
  getUpcomingProduction,
  products,
  recipes,
  getRecipe,
  formatMVR,
  recipeCostPerServing,
  recipeTotalCost,
} from '@/lib/data';

export default function DashboardPage() {
  const todaysRevenue = getTodaysRevenue();
  const todaysSales = getTodaysSales();
  const lowStock = getLowStockIngredients();
  const upcoming = getUpcomingProduction();
  const readyProducts = products.reduce(
    (sum, p) => sum + p.availableQuantity,
    0
  );

  const recentSales = [...todaysSales].reverse().slice(0, 4);

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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Today's Revenue"
          value={formatMVR(todaysRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={{ value: '12% vs yesterday', positive: true }}
          variant="primary"
        />
        <StatCard
          label="Today's Profit"
          value={formatMVR(48.5)}
          icon={<ArrowUpRight className="h-5 w-5" />}
          trend={{ value: '8% margin growth', positive: true }}
          variant="success"
        />
        <StatCard
          label="Products Ready"
          value={String(readyProducts)}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          label="Low Stock Items"
          value={String(lowStock.length)}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={lowStock.length > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
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
            {recentSales.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No sales today yet
              </p>
            )}
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {sale.items
                      .map((item) => {
                        const product = products.find(
                          (p) => p.id === item.productId
                        );
                        return `${item.quantity}× ${product?.name ?? 'Product'}`;
                      })
                      .join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sale.createdAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <p className="shrink-0 font-display text-sm font-bold">
                  {formatMVR(sale.totalAmount)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming Production */}
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
            {upcoming.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No upcoming production
              </p>
            )}
            {upcoming.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {order.items.length} recipe
                    {order.items.length > 1 ? 's' : ''}
                  </p>
                  <Badge
                    variant={
                      order.status === 'in_progress' ? 'default' : 'secondary'
                    }
                    className={
                      order.status === 'in_progress'
                        ? 'bg-primary/10 text-primary'
                        : ''
                    }
                  >
                    {order.status === 'in_progress'
                      ? 'In Progress'
                      : 'Planned'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {order.items.map((item) => {
                    const recipe = getRecipe(item.recipeId);
                    return (
                      <span
                        key={item.id}
                        className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                      >
                        {item.batchCount}× {recipe?.name ?? 'Recipe'}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
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
              {lowStock.map((ing) => (
                <div
                  key={ing.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
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

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction
          href="/ingredients"
          icon={<Carrot className="h-5 w-5" />}
          label="Add Ingredient"
        />
        <QuickAction
          href="/recipes"
          icon={<ChefHat className="h-5 w-5" />}
          label="New Recipe"
        />
        <QuickAction
          href="/produce"
          icon={<Factory className="h-5 w-5" />}
          label="Plan Production"
        />
        <QuickAction
          href="/sell"
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Sell"
        />
      </div>

      {/* Top recipes */}
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
          {recipes.map((recipe) => {
            const cost = recipeTotalCost(recipe);
            const perServing = recipeCostPerServing(recipe);
            const product = products.find((p) => p.recipeId === recipe.id);
            const price = product?.sellingPrice ?? 0;
            const profit = price - perServing;
            const margin = price > 0 ? (profit / price) * 100 : 0;

            return (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{recipe.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Cost: {formatMVR(perServing)}/serving
                    {product && ` · Price: ${formatMVR(price)}`}
                  </p>
                </div>
                {product && (
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-success">
                      {formatMVR(profit)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {margin.toFixed(0)}% margin
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
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
