'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarRange,
  ShoppingCart,
  Factory,
  AlertTriangle,
  CheckCircle2,
  PackageSearch,
  ListChecks,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatBaseQuantity, formatMVR } from '@/lib/costing';
import {
  forecastRequirements,
  forecastSummary,
  type BatchPlan,
  type ForecastRow,
} from '@/lib/forecast';

type OrderForecast = {
  id: string;
  deliveryDate: string;
  batches: BatchPlan[];
};

type IngredientMeta = {
  id: string;
  name: string;
  availableQuantity: number;
  baseUnit: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseCost: number;
};
type RecipeRoster = {
  id: string;
  name: string;
  ingredients: Array<{
    quantity: number;
    unit: string;
    ingredient: IngredientMeta;
  }>;
};

type Window = 7 | 14 | 30;

const WINDOWS: { value: Window; label: string }[] = [
  { value: 7, label: 'Next 7 Days' },
  { value: 14, label: 'Next 14 Days' },
  { value: 30, label: 'Next 30 Days' },
];

export function ForecastClient({
  orders,
  recipes,
}: {
  orders: OrderForecast[];
  recipes: RecipeRoster[];
}) {
  const router = useRouter();
  const [windowDays, setWindowDays] = useState<Window>(7);

  const windowEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + windowDays);
    return d;
  }, [windowDays]);

  const inWindowOrders = useMemo(
    () =>
      orders.filter((o) => {
        const date = new Date(o.deliveryDate);
        return date >= new Date() && date < windowEnd;
      }),
    [orders, windowEnd]
  );

  const combinedBatches = useMemo(() => {
    const inBatches = inWindowOrders.flatMap((o) => o.batches);
    const map = new Map<string, BatchPlan>();
    for (const b of inBatches) {
      const existing = map.get(b.recipeId);
      if (existing) existing.batchCount += b.batchCount;
      else map.set(b.recipeId, { ...b });
    }
    return [...map.values()].sort((a, b) => a.recipeName.localeCompare(b.recipeName));
  }, [inWindowOrders]);

  const rows: ForecastRow[] = useMemo(
    () => forecastRequirements(recipes, combinedBatches),
    [recipes, combinedBatches]
  );
  const summary = useMemo(() => forecastSummary(rows, inWindowOrders.length), [rows, inWindowOrders.length]);

  const shortages = rows.filter((r) => !r.enough);
  const shoppingItems = shortages.map((r) => r);

  const level = (r: ForecastRow): 'ok' | 'low' | 'short' => {
    if (r.enough) return 'ok';
    if (r.availableBase >= r.requiredBase * 0.5) return 'low';
    return 'short';
  };
  const levelMeta = {
    ok: { label: 'Enough', cls: 'text-success border-success/30 bg-success/5' },
    low: { label: 'Low', cls: 'text-warning border-warning/30 bg-warning/5' },
    short: { label: 'Shortage', cls: 'text-destructive border-destructive/30 bg-destructive/5' },
  };

  const planShortfallBatches = () => {
    if (combinedBatches.length === 0) return;
    const qs = combinedBatches.map((b) => `${b.recipeId}:${b.batchCount}`).join(',');
    router.push(`/produce?recipes=${qs}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Ingredient Forecast"
        description="Will you have enough for the orders you've accepted?"
        action={
          <div className="flex rounded-lg border border-border p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => setWindowDays(w.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                  windowDays === w.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Orders Included</p>
            <p className="font-display text-2xl font-bold">{summary.orderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <PackageSearch className="h-3 w-3" /> Ingredients Required
            </p>
            <p className="font-display text-2xl font-bold">{summary.ingredientsRequired}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" /> Ingredients Short
            </p>
            <p className={cn('font-display text-2xl font-bold', summary.ingredientsShort > 0 ? 'text-destructive' : 'text-success')}>
              {summary.ingredientsShort}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Estimated Purchase Cost</p>
            <p className="font-display text-2xl font-bold">{formatMVR(summary.estimatedCost)}</p>
          </CardContent>
        </Card>
      </div>

      {inWindowOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <CalendarRange className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No orders due in the next {windowDays} days
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {shortages.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              {shortages.length === 0 ? 'All stock sufficient' : `${shortages.length} ingredient${shortages.length > 1 ? 's' : ''} short`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((r) => {
              const lv = level(r);
              const meta = levelMeta[lv];
              return (
                <div key={r.ingredientId} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Need {formatBaseQuantity(r.requiredBase, r.baseUnit)} · Have{' '}
                      {formatBaseQuantity(r.availableBase, r.baseUnit)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={cn('bg-transparent', meta.cls)}>
                      {meta.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {shoppingItems.length > 0 && (
        <Card className="border-primary/30 bg-accent/20">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Forecast Shopping List
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href="/shopping-list">
                  <ListChecks className="h-4 w-4" />
                  <span className="hidden sm:inline">Open shopping list</span>
                  <span className="sm:hidden">List</span>
                </Link>
              </Button>
              <Button size="sm" className="gap-1.5" onClick={planShortfallBatches}>
                <Factory className="h-4 w-4" />
                <span className="hidden sm:inline">Plan Production</span>
                <span className="sm:hidden">Plan</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {shoppingItems.map((r) => (
              <div key={r.ingredientId} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <span className="text-sm font-medium">{r.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Need {formatBaseQuantity(r.shortageBase, r.baseUnit)}
                  </span>
                  <span className="text-xs font-semibold">{formatMVR(r.estimatedCost)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <p className="text-sm font-medium">
                Estimated total: <span className="font-bold text-primary">{formatMVR(summary.estimatedCost)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {combinedBatches.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Production Plan Preview</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push(`/produce?recipes=${combinedBatches.map((b) => `${b.recipeId}:${b.batchCount}`).join(',')}`)}>
              Open in Produce
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {combinedBatches.map((b) => (
              <span key={b.recipeId} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                {b.batchCount}× {b.recipeName}
              </span>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}