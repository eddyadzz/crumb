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
  Play,
  Printer,
  ChevronDown,
  ChevronRight,
  Scale,
  Check,
  ListChecks,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
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
  type ProductionActualInput,
} from '@/lib/actions/production';
import { computeVariance, totalVariance } from '@/lib/production-variance';
import { cn } from '@/lib/utils';

type IngredientVM = {
  ingredientId: string;
  name: string;
  baseUnit: string;
  availableQuantity: number;
  requiredPerBatch: number;
  unit: string;
};

type RecipeVM = {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  preparationTime: number;
  servingsProduced: number;
  totalCost: number;
  products: { id: string; name: string; type: string }[];
  ingredients: IngredientVM[];
};

type ItemActualVM = {
  ingredientId: string;
  ingredientName: string;
  plannedBase: number;
  actualBase: number;
};

type OrderVM = {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  items: {
    id: string;
    recipeId: string;
    recipeName: string;
    batchCount: number;
    ingredientActuals: ItemActualVM[];
  }[];
};

interface PlanItem {
  recipeId: string;
  batchCount: number;
}

type FloorFilter = 'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

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
  const [floorFilter, setFloorFilter] = useState<FloorFilter>('ALL');
  const [completing, setCompleting] = useState<OrderVM | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<OrderVM | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

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

  const doStart = async (orderId: string) => {
    setBusyOrder(orderId);
    await startProductionOrder(orderId);
    setBusyOrder(null);
    router.refresh();
  };

  const doCancel = async (orderId: string) => {
    setBusyOrder(orderId);
    await cancelProductionOrder(orderId);
    setBusyOrder(null);
    setConfirmCancel(null);
    router.refresh();
  };

  const filtered = useMemo(() => {
    if (floorFilter === 'ALL') return initialOrders;
    return initialOrders.filter((o) => o.status === floorFilter);
  }, [initialOrders, floorFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Production Floor"
        description="Touch-first queue for daily kitchen runs"
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/floor">
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">Floor Mode</span>
              </Link>
            </Button>
            <Button className="gap-2" onClick={() => setPlanOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Production Plan</span>
              <span className="sm:hidden">Plan</span>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="floor">
        <TabsList className="w-full">
          <TabsTrigger value="floor" className="flex-1">
            Floor
          </TabsTrigger>
          <TabsTrigger value="recipes" className="flex-1">
            Recipes
          </TabsTrigger>
          <TabsTrigger value="plan" className="flex-1">
            Plan
            {planItems.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                {planItems.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ============ FLOOR ============ */}
        <TabsContent value="floor" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['ALL', 'All'],
                ['PLANNED', 'Planned'],
                ['IN_PROGRESS', 'In Progress'],
                ['COMPLETED', 'Done'],
              ] as [FloorFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFloorFilter(key)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                  floorFilter === key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                No {floorFilter === 'ALL' ? '' : floorFilter.toLowerCase() + ' '}production
                orders yet.
              </CardContent>
            </Card>
          ) : (
            filtered.map((order) => (
              <FloorOrderCard
                key={order.id}
                order={order}
                getRecipe={getRecipe}
                busy={busyOrder === order.id}
                onStart={() => doStart(order.id)}
                onComplete={() => setCompleting(order)}
                onCancel={() => setConfirmCancel(order)}
                onPrint={() => router.push(`/produce/print/${order.id}`)}
              />
            ))
          )}
        </TabsContent>

        {/* ============ RECIPES ============ */}
        <TabsContent value="recipes" className="space-y-3">
          {recipes.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                No recipes yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((recipe) => (
                <KitchenRecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ PLAN ============ */}
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
                          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => updateBatch(item.recipeId, -1)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-display text-lg font-bold">{item.batchCount}</span>
                          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => updateBatch(item.recipeId, 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => removeFromPlan(item.recipeId)}>
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

      {/* Add-to-plan dialog */}
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
                      <p className="text-xs text-muted-foreground">{recipe.servingsProduced} servings/batch · {recipe.preparationTime}m</p>
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

      {/* Complete batch sheet */}
      {completing && (
        <CompleteBatchSheet
          order={completing}
          getRecipe={getRecipe}
          open={true}
          onOpenChange={(v) => { if (!v) setCompleting(null); }}
          onConfirmed={async (actuals) => {
            setBusyOrder(completing.id);
            await completeProductionOrder(completing.id, actuals);
            setBusyOrder(null);
            setCompleting(null);
            router.refresh();
          }}
          busy={busyOrder === completing.id}
        />
      )}

      {/* Cancel confirm dialog */}
      <Dialog open={!!confirmCancel} onOpenChange={(v) => { if (!v) setConfirmCancel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel production order?</DialogTitle>
            <DialogDescription className="space-y-1">
              {confirmCancel?.items.map((i) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span>{i.recipeName}</span>
                  <span>{i.batchCount} batch{i.batchCount > 1 ? 'es' : ''}</span>
                </div>
              ))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>Keep it</Button>
            <Button
              variant="destructive"
              disabled={!!busyOrder}
              onClick={() => confirmCancel && doCancel(confirmCancel.id)}
            >
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================= FLOOR ORDER CARD ================= */

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  PLANNED: {
    label: 'Planned',
    icon: <Clock className="h-5 w-5" />,
    badge: 'bg-muted text-muted-foreground',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: <Factory className="h-5 w-5 text-primary" />,
    badge: 'bg-primary/10 text-primary',
  },
  COMPLETED: {
    label: 'Completed',
    icon: <CheckCircle2 className="h-5 w-5 text-success" />,
    badge: 'bg-success/10 text-success',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: <XCircle className="h-5 w-5 text-destructive" />,
    badge: 'bg-destructive/10 text-destructive',
  },
};

function FloorOrderCard({
  order,
  getRecipe,
  busy,
  onStart,
  onComplete,
  onCancel,
  onPrint,
}: {
  order: OrderVM;
  getRecipe: (id: string) => RecipeVM | undefined;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onPrint: () => void;
}) {
  const meta = STATUS_META[order.status] ?? STATUS_META.PLANNED;

  const totalYield = useMemo(() => {
    return order.items.reduce((sum, item) => {
      const recipe = getRecipe(item.recipeId);
      if (!recipe) return sum;
      return sum + recipe.servingsProduced * item.batchCount;
    }, 0);
  }, [order, getRecipe]);

  return (
    <Card className={cn(order.status === 'IN_PROGRESS' && 'border-primary/40')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={order.status === 'COMPLETED' ? 'text-success' : 'text-muted-foreground'}>
              {meta.icon}
            </span>
            <span className="text-base font-semibold">Order #{order.id.slice(-4).toUpperCase()}</span>
            <Badge variant="secondary" className={meta.badge}>
              {meta.label}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={onPrint}>
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          {order.items.map((item) => {
            const recipe = getRecipe(item.recipeId);
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{item.recipeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.batchCount} batch{item.batchCount > 1 ? 'es' : ''}
                    {recipe ? ` · ${recipe.servingsProduced * item.batchCount} servings` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-display text-xl font-bold text-primary">
                  {item.batchCount}×
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Yield ≈ {totalYield} servings
          </span>
          <span>
            {new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>

        {order.status === 'PLANNED' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 gap-2" disabled={busy} onClick={onCancel}>
              <XCircle className="h-5 w-5" /> Cancel
            </Button>
            <Button className="h-12 gap-2" disabled={busy} onClick={onStart}>
              <Play className="h-5 w-5" /> Start Batch
            </Button>
          </div>
        )}

        {order.status === 'IN_PROGRESS' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 gap-2" disabled={busy} onClick={onCancel}>
              <XCircle className="h-5 w-5" /> Cancel
            </Button>
            <Button className="h-12 gap-2" disabled={busy} onClick={onComplete}>
              <CheckCircle2 className="h-5 w-5" /> Complete
            </Button>
          </div>
        )}

        {order.status === 'COMPLETED' && order.completedAt && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-success" />
              Completed {new Date(order.completedAt).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {order.items.flatMap((i) => i.ingredientActuals).length} actuals recorded
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================= COMPLETE BATCH SHEET ================= */

function CompleteBatchSheet({
  order,
  getRecipe,
  open,
  onOpenChange,
  onConfirmed,
  busy,
}: {
  order: OrderVM;
  getRecipe: (id: string) => RecipeVM | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmed: (actuals: ProductionActualInput[]) => void;
  busy: boolean;
}) {
  // Build the planned ingredient list with base-unit planned amounts per item.
  const plannedRows = useMemo(() => {
    const rows: {
      productionItemId: string;
      ingredientId: string;
      name: string;
      baseUnit: string;
      plannedBase: number;
      available: number;
    }[] = [];
    for (const item of order.items) {
      const recipe = getRecipe(item.recipeId);
      if (!recipe) continue;
      for (const ri of recipe.ingredients) {
        rows.push({
          productionItemId: item.id,
          ingredientId: ri.ingredientId,
          name: ri.name,
          baseUnit: UNIT_BASE[ri.unit as keyof typeof UNIT_BASE] || ri.baseUnit,
          plannedBase: convertToBase(ri.requiredPerBatch, ri.unit) * item.batchCount,
          available: ri.availableQuantity,
        });
      }
    }
    return rows;
  }, [order, getRecipe]);

  const [drafts, setDrafts] = useState<Record<string, number>>({});

  // Reset drafts whenever the sheet opens for a different order.
  const [openKey, setOpenKey] = useState<string>('');
  if (open && openKey !== order.id) {
    setOpenKey(order.id);
    setDrafts({});
  }

  const actualOf = (key: string) => drafts[key] ?? plannedRows.find((r) => `${r.productionItemId}:${r.ingredientId}` === key)?.plannedBase ?? 0;

  const completeDrafts = plannedRows.map((r) => ({
    key: `${r.productionItemId}:${r.ingredientId}`,
    ...r,
    actualBase: actualOf(`${r.productionItemId}:${r.ingredientId}`),
  }));

  const variance = computeVariance(
    completeDrafts.map((r) => ({
      ingredientName: r.name,
      plannedBase: r.plannedBase,
      actualBase: r.actualBase,
    }))
  );

  const totals = totalVariance(variance);
  const anyAdjusted = completeDrafts.some((r) => Math.abs(r.actualBase - r.plannedBase) > 1e-9);

  const submit = () => {
    const actuals: ProductionActualInput[] = completeDrafts
      .filter((r) => Math.abs(r.actualBase - r.plannedBase) > 1e-9)
      .map((r) => ({ productionItemId: r.productionItemId, ingredientId: r.ingredientId, actualBase: r.actualBase }));
    onConfirmed(actuals);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl sm:max-w-2xl sm:mx-auto sm:rounded-2xl sm:my-4">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-left">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Complete Order #{order.id.slice(-4).toUpperCase()}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Adjust each ingredient to the amount you actually used. Left alone,
            the planned amount is recorded.
          </p>
        </SheetHeader>

        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3">
              <p className="mb-2 font-semibold">
                {item.recipeName} · {item.batchCount}×
              </p>
                <div className="space-y-2">
                  {completeDrafts
                    .filter((r) => r.productionItemId === item.id)
                    .map((r) => {
                      const short = r.available < r.actualBase;
                      return (
                        <div key={r.key} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{r.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              planned {r.plannedBase.toFixed(1)}{r.baseUnit} · stock {r.available.toFixed(1)}
                              {short && <span className="text-destructive"> · short</span>}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => setDrafts((d) => ({ ...d, [r.key]: Math.max(0, actualOf(r.key) - 1) }))}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-14 text-center text-sm font-bold">
                              {actualOf(r.key).toFixed(1)}
                              <span className="text-[10px] text-muted-foreground">{r.baseUnit}</span>
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => setDrafts((d) => ({ ...d, [r.key]: actualOf(r.key) + 1 }))}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>

        <Card className="mt-3">
          <CardContent className="space-y-1.5 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Planned total</span>
              <span className="font-medium">{totals.plannedTotal.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Actual total</span>
              <span className="font-medium">{totals.actualTotal.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="font-medium">Variance</span>
              <span
                className={cn(
                  'font-semibold',
                  Math.abs(totals.variancePct) < 1e-9
                    ? 'text-success'
                    : totals.variancePct > 0
                      ? 'text-amber-600'
                      : 'text-sky-600'
                )}
              >
                {Math.abs(totals.variancePct) < 1e-9
                  ? 'On target'
                  : `${totals.variancePct > 0 ? '+' : ''}${totals.variancePct.toFixed(1)}%`}
              </span>
            </div>
          </CardContent>
        </Card>

        <SheetFooter className="mt-4 gap-2 sm:flex-row">
          <Button variant="outline" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button className="h-12 flex-1 gap-2" onClick={submit} disabled={busy}>
            <CheckCircle2 className="h-5 w-5" />
            {busy ? 'Recording...' : anyAdjusted ? 'Record actuals & finish' : 'Finish batch'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ================= KITCHEN RECIPE CARD ================= */

function KitchenRecipeCard({ recipe }: { recipe: RecipeVM }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col">
      <CardContent className="flex-1 space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <ChefHat className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold leading-tight">{recipe.name}</p>
              <p className="text-xs text-muted-foreground">
                {recipe.servingsProduced} servings · {recipe.preparationTime}m
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          {recipe.ingredients.map((ri) => {
            const base =
              UNIT_BASE[ri.unit as keyof typeof UNIT_BASE] || ri.baseUnit;
            return (
              <div key={ri.ingredientId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ri.name}</span>
                <span className="font-medium">
                  {convertToBase(ri.requiredPerBatch, ri.unit).toFixed(1)}
                  {base}
                </span>
              </div>
            );
          })}
          {recipe.products.length > 0 && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              Yields: {recipe.products.map((p) => p.name).join(', ')}
            </p>
          )}
        </div>

        {recipe.description && (
          <p className="text-xs text-muted-foreground">{recipe.description}</p>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-primary"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {open ? 'Hide instructions' : 'Show instructions'}
        </button>

        {open && (
          <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {recipe.instructions}
          </p>
        )}
      </CardContent>
    </Card>
  );
}