'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Factory,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ShoppingCart,
  ChefHat,
  Minus,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { formatMVR } from '@/lib/costing';
import { convertToBase, UNIT_BASE } from '@/lib/costing';
import {
  createProductionOrder,
  startProductionOrder,
  completeProductionOrder,
  cancelProductionOrder,
} from '@/lib/actions/production';
import { cn } from '@/lib/utils';

type RecipeVM = {
  id: string;
  name: string;
  servingsProduced: number;
  totalCost: number;
  ingredients: {
    ingredientId: string;
    name: string;
    baseUnit: string;
    availableQuantity: number;
    requiredPerBatch: number;
    unit: string;
  }[];
};

type OrderVM = {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  items: { id: string; recipeId: string; recipeName: string; batchCount: number }[];
};

interface PlanItem {
  recipeId: string;
  batchCount: number;
}

/** Read ?recipes=recipeId:batch,recipeId:batch from the URL to prefill the plan
 * (used when "Plan Production" is launched from a customer order). */
function initPlanFromQuery(recipes: RecipeVM[]): PlanItem[] {
  if (typeof window === 'undefined') return [];
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('recipes');
  if (!raw) return [];
  const knownIds = new Set(recipes.map((r) => r.id));
  return raw
    .split(',')
    .map((chunk) => {
      const [recipeId, batchStr] = chunk.split(':');
      const batchCount = parseInt(batchStr || '1', 10) || 1;
      return knownIds.has(recipeId) ? { recipeId, batchCount } : null;
    })
    .filter((x) => x !== null) as PlanItem[];
}

export function ProduceClient({
  recipes,
  orders: initialOrders,
}: {
  recipes: RecipeVM[];
  orders: OrderVM[];
}) {
  const router = useRouter();
  const [planItems, setPlanItems] = useState<PlanItem[]>(initPlanFromQuery(recipes));
  const [planOpen, setPlanOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const addToPlan = (recipeId: string) => {
    setPlanItems((prev) => {
      const existing = prev.find((p) => p.recipeId === recipeId);
      if (existing) {
        return prev.map((p) =>
          p.recipeId === recipeId ? { ...p, batchCount: p.batchCount + 1 } : p
        );
      }
      return [...prev, { recipeId, batchCount: 1 }];
    });
  };

  const updateBatch = (recipeId: string, delta: number) => {
    setPlanItems((prev) =>
      prev
        .map((p) =>
          p.recipeId === recipeId
            ? { ...p, batchCount: Math.max(0, p.batchCount + delta) }
            : p
        )
        .filter((p) => p.batchCount > 0)
    );
  };

  const removeFromPlan = (recipeId: string) => {
    setPlanItems((prev) => prev.filter((p) => p.recipeId !== recipeId));
  };

  const getRecipe = (id: string) => recipes.find((r) => r.id === id);

  const requirements = useMemo(() => {
    const map = new Map<
      string,
      { name: string; baseUnit: string; required: number; available: number }
    >();
    planItems.forEach((item) => {
      const recipe = recipes.find((r) => r.id === item.recipeId);
      if (!recipe) return;
      recipe.ingredients.forEach((ri) => {
        const baseQty = convertToBase(ri.requiredPerBatch, ri.unit) * item.batchCount;
        const existing = map.get(ri.ingredientId);
        if (existing) {
          existing.required += baseQty;
        } else {
          map.set(ri.ingredientId, {
            name: ri.name,
            baseUnit: UNIT_BASE[ri.unit as keyof typeof UNIT_BASE] || ri.baseUnit,
            required: baseQty,
            available: ri.availableQuantity,
          });
        }
      });
    });
    return [...map.values()];
  }, [planItems, recipes]);

  const insufficient = requirements.filter((r) => r.required > r.available);
  const shoppingList = insufficient.map((r) => ({
    ...r,
    shortage: r.required - r.available,
  }));

  const submitPlan = () => {
    if (planItems.length === 0) return;
    startTransition(async () => {
      await createProductionOrder({ items: planItems });
      setPlanItems([]);
      setPlanOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Produce"
        description="Plan production and track orders"
        action={
          <Button className="gap-2" onClick={() => setPlanOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Production Plan</span>
            <span className="sm:hidden">Plan</span>
          </Button>
        }
      />

      <Tabs defaultValue="orders">
        <TabsList className="w-full">
          <TabsTrigger value="orders" className="flex-1">
            Production Orders
          </TabsTrigger>
          <TabsTrigger value="plan" className="flex-1">
            Active Plan
            {planItems.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                {planItems.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-3">
          {initialOrders.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No production orders yet
              </CardContent>
            </Card>
          )}
          {initialOrders.map((order) => (
            <ProductionOrderCard
              key={order.id}
              order={order}
              onStart={() => startProductionOrder(order.id).then(() => router.refresh())}
              onComplete={() => completeProductionOrder(order.id).then(() => router.refresh())}
              onCancel={() => cancelProductionOrder(order.id).then(() => router.refresh())}
            />
          ))}
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          {planItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Factory className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No items in your plan yet</p>
                <Button variant="outline" onClick={() => setPlanOpen(true)}>
                  Add Recipes to Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                {planItems.map((item) => {
                  const recipe = getRecipe(item.recipeId);
                  if (!recipe) return null;
                  const cost = recipe.totalCost * item.batchCount;
                  return (
                    <Card key={item.recipeId}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <ChefHat className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{recipe.name}</p>
                            <p className="text-xs text-muted-foreground">{formatMVR(cost)} total</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateBatch(item.recipeId, -1)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-display text-lg font-bold">{item.batchCount}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateBatch(item.recipeId, 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromPlan(item.recipeId)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className={cn(insufficient.length > 0 ? 'border-destructive/30' : 'border-success/30')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {insufficient.length > 0 ? (
                      <>
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Insufficient Stock
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        Stock Available
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {requirements.map((r) => {
                    const ok = r.available >= r.required;
                    return (
                      <div key={r.name} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{r.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn('font-medium', ok ? 'text-success' : 'text-destructive')}>
                            {r.required.toFixed(0)}
                            {r.baseUnit}
                          </span>
                          <span className="text-muted-foreground">
                            / {r.available.toFixed(0)}
                            {r.baseUnit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {shoppingList.length > 0 && (
                <Card className="border-primary/30 bg-accent/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      Shopping List
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {shoppingList.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                      >
                        <span className="text-sm font-medium">{item.name}</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Need {item.shortage.toFixed(0)}
                          {item.baseUnit}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Button className="w-full gap-2" size="lg" onClick={submitPlan} disabled={pending}>
                <Factory className="h-4 w-4" />
                {pending ? 'Creating...' : 'Create Production Order'}
              </Button>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add to Production Plan</DialogTitle>
            <DialogDescription>
              Select recipes and batch counts for your production run
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {recipes.map((recipe) => {
              const inPlan = planItems.find((p) => p.recipeId === recipe.id);
              return (
                <div key={recipe.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <ChefHat className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{recipe.name}</p>
                      <p className="text-xs text-muted-foreground">{recipe.servingsProduced} servings/batch</p>
                    </div>
                  </div>
                  {inPlan ? (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateBatch(recipe.id, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 text-center font-bold">{inPlan.batchCount}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateBatch(recipe.id, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => addToPlan(recipe.id)}>
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setPlanOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductionOrderCard({
  order,
  onStart,
  onComplete,
  onCancel,
}: {
  order: OrderVM;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string; badge: string }> = {
    PLANNED: {
      label: 'Planned',
      icon: <Clock className="h-4 w-4" />,
      className: 'text-muted-foreground',
      badge: 'bg-muted text-muted-foreground',
    },
    IN_PROGRESS: {
      label: 'In Progress',
      icon: <Factory className="h-4 w-4" />,
      className: 'text-primary',
      badge: 'bg-primary/10 text-primary',
    },
    COMPLETED: {
      label: 'Completed',
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: 'text-success',
      badge: 'bg-success/10 text-success',
    },
    CANCELLED: {
      label: 'Cancelled',
      icon: <XCircle className="h-4 w-4" />,
      className: 'text-destructive',
      badge: 'bg-destructive/10 text-destructive',
    },
  };

  const config = statusConfig[order.status] ?? statusConfig.PLANNED;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={config.className}>{config.icon}</span>
            <span className="text-sm font-medium">Order #{order.id.slice(-4).toUpperCase()}</span>
          </div>
          <Badge variant="secondary" className={config.badge}>
            {config.label}
          </Badge>
        </div>
        <Separator />
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="font-medium">{item.recipeName}</span>
              <span className="text-muted-foreground">
                {item.batchCount} batch{item.batchCount > 1 ? 'es' : ''}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
          <div className="flex items-center gap-2">
            {order.status === 'PLANNED' && (
              <>
                <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
                <Button size="sm" className="h-8 gap-1" onClick={onStart}>
                  <Factory className="h-3.5 w-3.5" />
                  Start
                </Button>
              </>
            )}
            {order.status === 'IN_PROGRESS' && (
              <>
                <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
                <Button size="sm" className="h-8 gap-1" onClick={onComplete}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Complete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
