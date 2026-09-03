'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Play,
  CheckCircle2,
  X,
  Plus,
  Minus,
  AlertTriangle,
  ArrowLeft,
  ChefHat,
  LogOut,
  CloudUpload,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InstallButton } from '@/components/install-button';
import { cn } from '@/lib/utils';
import { computeVariance, totalVariance } from '@/lib/production-variance';
import {
  startProductionOrder,
  completeProductionOrder,
  type ProductionActualInput,
} from '@/lib/actions/production';
import {
  getOutboxSnapshot,
  writeOutbox,
  newOpId,
  markSynced,
  lastSyncedAt,
  relativeSyncLabel,
  type OutboxOp,
} from '@/lib/sync-outbox';
import { useOutboxSync } from '@/components/use-outbox-sync';

export interface FloorIngredientVM {
  ingredientId: string;
  name: string;
  baseUnit: string;
  plannedBase: number;
  availableBase: number;
}

export interface FloorOrderVM {
  id: string;
  status: 'PLANNED' | 'IN_PROGRESS';
  createdAt: string;
  items: {
    id: string;
    recipeName: string;
    batchCount: number;
    ingredients: FloorIngredientVM[];
  }[];
}

/** Step size for the actual-usage steppers, per base unit. */
function stepFor(unit: string): number {
  return unit === 'pcs' ? 1 : 5;
}

export function FloorClient({
  tenantName,
  orders,
}: {
  tenantName: string;
  orders: FloorOrderVM[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<FloorOrderVM | null>(null);
  const [justCompleted, setJustCompleted] = useState<{ label: string; variance: number; queued?: boolean } | null>(null);
  const [clock, setClock] = useState<string | null>(null);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);

  const { outbox, pending: syncing } = useOutboxSync({
    onUploaded: (op) => setJustCompleted({ label: op.label, variance: op.variance ?? 0 }),
  });
  const busy = pending || syncing;

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
      const at = lastSyncedAt();
      setSyncLabel(at === null ? null : relativeSyncLabel(at));
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const enqueue = (op: Omit<OutboxOp, 'id' | 'createdAt'>) => {
    writeOutbox([...getOutboxSnapshot(), { ...op, id: newOpId(), createdAt: new Date().toISOString() }]);
  };

  const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS');
  const queue = orders.filter((o) => o.status === 'PLANNED');
  const queuedOrderIds = new Set(outbox.map((op) => op.orderId));

  const start = (order: FloorOrderVM) => {
    setError(null);
    if (!navigator.onLine) {
      enqueue({ type: 'start', orderId: order.id, label: orderLabel(order) });
      setJustCompleted({ label: orderLabel(order), variance: 0, queued: true });
      return;
    }
    startTransition(async () => {
      try {
        await startProductionOrder(order.id);
        markSynced();
        router.refresh();
      } catch (e) {
        if (!navigator.onLine || e instanceof TypeError) {
          enqueue({ type: 'start', orderId: order.id, label: orderLabel(order) });
          setJustCompleted({ label: orderLabel(order), variance: 0, queued: true });
        } else {
          setError(e instanceof Error ? e.message : 'Could not start the batch');
        }
      }
    });
  };

  const finishComplete = (order: FloorOrderVM, actuals: ProductionActualInput[], variance: number) => {
    setError(null);
    const queueIt = () => {
      enqueue({ type: 'complete', orderId: order.id, label: orderLabel(order), actuals, variance });
      setJustCompleted({ label: orderLabel(order), variance, queued: true });
      setCompleting(null);
    };
    if (!navigator.onLine) {
      queueIt();
      return;
    }
    startTransition(async () => {
      try {
        await completeProductionOrder(order.id, actuals);
        setCompleting(null);
        setJustCompleted({ label: orderLabel(order), variance });
        markSynced();
        router.refresh();
      } catch (e) {
        if (!navigator.onLine || e instanceof TypeError) {
          queueIt();
        } else {
          setError(e instanceof Error ? e.message : 'Could not complete the batch');
        }
      }
    });
  };

  if (completing) {
    return (
      <CompleteFlow
        order={completing}
        pending={pending}
        onBack={() => setCompleting(null)}
        onConfirm={(actuals, variance) => finishComplete(completing, actuals, variance)}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ChefHat className="h-6 w-6 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{tenantName}</p>
              <p className="text-xs text-muted-foreground">
                {clock ?? '\u00a0'}
                {syncLabel && ` · synced ${syncLabel}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <InstallButton variant="outline" />
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/produce">
                <LogOut className="h-4 w-4" />
                Exit
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 p-4 pb-16">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-auto shrink-0" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {outbox.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-warning">
              <CloudUpload className="h-5 w-5 shrink-0" />
              {outbox.length} queued change{outbox.length > 1 ? 's' : ''} — syncing when online
            </div>
            <ul className="mt-2 space-y-1">
              {outbox.map((op) => (
                <li key={op.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {op.type === 'start' ? 'Start' : 'Complete'} · {op.label}
                  </span>
                  <span className="shrink-0">
                    {new Date(op.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {justCompleted && (
          <button
            type="button"
            onClick={() => setJustCompleted(null)}
            className={cn(
              'w-full rounded-2xl border p-5 text-left',
              justCompleted.queued
                ? 'border-warning/40 bg-warning/10'
                : 'border-success/40 bg-success/10'
            )}
          >
            <div className="flex items-center gap-3">
              {justCompleted.queued ? (
                <WifiOff className="h-8 w-8 text-warning" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-success" />
              )}
              <div>
                <p className={cn('text-base font-bold', justCompleted.queued ? 'text-warning' : 'text-success')}>
                  {justCompleted.queued ? 'Queued — you are offline' : 'Batch completed'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {justCompleted.label}
                  {!justCompleted.queued &&
                    justCompleted.variance !== 0 &&
                    ` · ${justCompleted.variance > 0 ? '+' : ''}${justCompleted.variance.toFixed(1)} vs plan`}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Tap to dismiss</p>
          </button>
        )}

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            In Progress ({inProgress.length})
          </h2>
          {inProgress.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing running. Start a batch from the queue below.
            </p>
          )}
          {inProgress.map((order) => (
            <OrderCard key={order.id} order={order} queued={queuedOrderIds.has(order.id)}>
              <Button
                size="lg"
                className="h-16 w-full text-lg font-bold"
                disabled={busy || queuedOrderIds.has(order.id)}
                onClick={() => setCompleting(order)}
              >
                <CheckCircle2 className="h-6 w-6" />
                {queuedOrderIds.has(order.id) ? 'Queued' : 'Complete Batch'}
              </Button>
            </OrderCard>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Queue ({queue.length})
          </h2>
          {queue.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Queue is empty. Plan production from the app.
            </p>
          )}
          {queue.map((order) => (
            <OrderCard key={order.id} order={order} queued={queuedOrderIds.has(order.id)}>
              <Button
                size="lg"
                variant="secondary"
                className="h-16 w-full text-lg font-bold"
                disabled={busy || queuedOrderIds.has(order.id)}
                onClick={() => start(order)}
              >
                <Play className="h-6 w-6" />
                {queuedOrderIds.has(order.id) ? 'Queued' : 'Start Batch'}
              </Button>
            </OrderCard>
          ))}
        </section>
      </main>
    </div>
  );
}

function orderLabel(order: FloorOrderVM): string {
  return order.items.map((i) => `${i.recipeName} ×${i.batchCount}`).join(', ');
}

function OrderCard({
  order,
  queued,
  children,
}: {
  order: FloorOrderVM;
  queued?: boolean;
  children: React.ReactNode;
}) {
  const shortAny = order.items.some((i) =>
    i.ingredients.some((ing) => ing.availableBase < ing.plannedBase)
  );
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-lg font-bold leading-snug">{orderLabel(order)}</p>
        {queued ? (
          <Badge variant="secondary" className="shrink-0 bg-warning/15 text-warning">
            <CloudUpload className="mr-1 h-3 w-3" />
            Queued
          </Badge>
        ) : shortAny ? (
          <Badge variant="secondary" className="shrink-0 bg-warning/15 text-warning">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Low stock
          </Badge>
        ) : null}
      </div>
      <div className="mb-4 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="rounded-xl bg-muted/60 p-3">
            <p className="mb-1.5 text-sm font-semibold">{item.recipeName}</p>
            <ul className="space-y-1">
              {item.ingredients.map((ing) => (
                <li key={ing.ingredientId} className="flex items-baseline justify-between gap-2 text-base">
                  <span className="truncate">{ing.name}</span>
                  <span className={cn('shrink-0 font-bold', ing.availableBase < ing.plannedBase && 'text-warning')}>
                    {ing.plannedBase % 1 === 0 ? ing.plannedBase : ing.plannedBase.toFixed(1)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{ing.baseUnit}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

/* ================= COMPLETE FLOW (full screen) ================= */

function CompleteFlow({
  order,
  pending,
  onBack,
  onConfirm,
}: {
  order: FloorOrderVM;
  pending: boolean;
  onBack: () => void;
  onConfirm: (actuals: ProductionActualInput[], variance: number) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const key = (itemId: string, ingredientId: string) => `${itemId}:${ingredientId}`;

  const rows = order.items.flatMap((item) =>
    item.ingredients.map((ing) => ({
      item,
      ing,
      k: key(item.id, ing.ingredientId),
      planned: ing.plannedBase,
      actual: drafts[key(item.id, ing.ingredientId)] ?? ing.plannedBase,
    }))
  );

  const variance = totalVariance(
    computeVariance(rows.map((r) => ({ ingredientName: r.ing.name, plannedBase: r.planned, actualBase: r.actual })))
  );
  const anyAdjusted = rows.some((r) => Math.abs(r.actual - r.planned) > 1e-9);

  const setActual = (k: string, value: number) => setDrafts((d) => ({ ...d, [k]: Math.max(0, value) }));

  const confirm = () => {
    const actuals: ProductionActualInput[] = rows
      .filter((r) => Math.abs(r.actual - r.planned) > 1e-9)
      .map((r) => ({ productionItemId: r.item.id, ingredientId: r.ing.ingredientId, actualBase: r.actual }));
    onConfirm(actuals, variance.diffTotal);
  };

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">Confirm usage</p>
            <p className="truncate text-xs text-muted-foreground">{orderLabel(order)}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4 pb-8">
        <p className="px-1 text-sm text-muted-foreground">
          Tap + / − to record what you actually used. Leave a row alone to record the planned amount.
        </p>

        {order.items.map((item) => (
          <div key={item.id} className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-base font-bold">
              {item.recipeName} <span className="text-muted-foreground">×{item.batchCount}</span>
            </p>
            {item.ingredients.map((ing) => {
              const k = key(item.id, ing.ingredientId);
              const actual = drafts[k] ?? ing.plannedBase;
              const short = ing.availableBase < actual;
              return (
                <div key={ing.ingredientId} className="rounded-xl bg-muted/60 p-3">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="truncate text-base font-semibold">{ing.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      planned {ing.plannedBase % 1 === 0 ? ing.plannedBase : ing.plannedBase.toFixed(1)} {ing.baseUnit}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-14 w-14 shrink-0"
                      disabled={pending}
                      onClick={() => setActual(k, actual - stepFor(ing.baseUnit))}
                      aria-label={`Less ${ing.name}`}
                    >
                      <Minus className="h-6 w-6" />
                    </Button>
                    <div className={cn('min-w-0 flex-1 text-center', short && 'text-warning')}>
                      <p className="font-display text-2xl font-bold leading-none">
                        {actual % 1 === 0 ? actual : actual.toFixed(1)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ing.baseUnit}
                        {short && ' · short'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-14 w-14 shrink-0"
                      disabled={pending}
                      onClick={() => setActual(k, actual + stepFor(ing.baseUnit))}
                      aria-label={`More ${ing.name}`}
                    >
                      <Plus className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total vs plan</span>
            <span
              className={cn(
                'font-display text-lg font-bold',
                variance.diffTotal > 0 ? 'text-destructive' : variance.diffTotal < 0 ? 'text-success' : ''
              )}
            >
              {variance.diffTotal >= 0 ? '+' : ''}
              {variance.diffTotal.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {anyAdjusted
              ? `${rows.filter((r) => Math.abs(r.actual - r.planned) > 1e-9).length} ingredient(s) adjusted — mixed units, so the total is indicative.`
              : 'Recording exactly the planned amounts.'}
          </p>
        </div>

        <Button size="lg" className="h-16 w-full text-lg font-bold" disabled={pending} onClick={confirm}>
          <CheckCircle2 className="h-6 w-6" />
          {pending ? 'Completing…' : 'Confirm Complete'}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onBack} disabled={pending}>
          Cancel
        </Button>
      </main>
    </div>
  );
}