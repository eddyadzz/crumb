'use client';

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Square,
  Printer,
  RotateCcw,
  ShoppingCart,
  PackageCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatBaseQuantity, formatMVR } from '@/lib/costing';
import type { ShoppingListVM } from '@/lib/queries';
import type { ShoppingListItem } from '@/lib/shopping-list';

const CHECKED_KEY = 'crumb-shopping-checked';
const CHECKED_EVENT = 'crumb-shopping-checked';
const EMPTY_CHECKED: ReadonlySet<string> = new Set();

type StoredChecks = { key: string; checked: string[] };

let snapRaw = '';
let snapKey = '';
let snapSet: ReadonlySet<string> = EMPTY_CHECKED;

/** useSyncExternalStore snapshot: ticks restore only for an unchanged list. */
function getCheckedSnapshot(listKey: string): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(CHECKED_KEY) ?? '';
    if (raw !== snapRaw || listKey !== snapKey) {
      snapRaw = raw;
      snapKey = listKey;
      const stored: StoredChecks | null = raw ? JSON.parse(raw) : null;
      snapSet = stored && stored.key === listKey ? new Set(stored.checked) : EMPTY_CHECKED;
    }
    return snapSet;
  } catch {
    return EMPTY_CHECKED;
  }
}

function subscribeChecked(notify: () => void) {
  const handler = () => notify();
  window.addEventListener('storage', handler);
  window.addEventListener(CHECKED_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CHECKED_EVENT, handler);
  };
}

export function ShoppingListClient({ vm }: { vm: ShoppingListVM }) {
  const getSnapshot = useCallback(() => getCheckedSnapshot(vm.listKey), [vm.listKey]);
  const checked = useSyncExternalStore(subscribeChecked, getSnapshot, () => EMPTY_CHECKED);

  const toggle = (ingredientId: string) => {
    const next = new Set(getCheckedSnapshot(vm.listKey));
    if (next.has(ingredientId)) next.delete(ingredientId);
    else next.add(ingredientId);
    try {
      localStorage.setItem(
        CHECKED_KEY,
        JSON.stringify({ key: vm.listKey, checked: [...next] } satisfies StoredChecks)
      );
    } catch {
      // private mode — ticks still work for this visit
    }
    window.dispatchEvent(new Event(CHECKED_EVENT));
  };

  const reset = () => {
    try {
      localStorage.removeItem(CHECKED_KEY);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(CHECKED_EVENT));
  };

  const doneCount = vm.items.filter((i) => checked.has(i.ingredientId)).length;
  const remainingCost = vm.items
    .filter((i) => !checked.has(i.ingredientId))
    .reduce((s, i) => s + i.estimatedCost, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Shopping List"
        description={
          vm.orderCount > 0
            ? `Everything you need to buy for ${vm.orderCount} upcoming order${vm.orderCount > 1 ? 's' : ''}`
            : 'What upcoming orders need you to buy'
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={reset} disabled={doneCount === 0}>
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset ticks</span>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/shopping-list/print">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Print</span>
              </Link>
            </Button>
          </div>
        }
      />

      {vm.orderCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No upcoming orders</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The list fills itself from confirmed customer orders and your current stock.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Items to buy</p>
                <p className="mt-1 font-display text-2xl font-bold">{vm.items.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Ticked off</p>
                <p className="mt-1 font-display text-2xl font-bold text-success">
                  {doneCount}/{vm.items.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  {doneCount > 0 ? 'Still to buy' : 'Estimated cost'}
                </p>
                <p className="mt-1 font-display text-2xl font-bold">{formatMVR(remainingCost)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            {vm.items.map((item) => (
              <ShoppingRow
                key={item.ingredientId}
                item={item}
                checked={checked.has(item.ingredientId)}
                onToggle={() => toggle(item.ingredientId)}
              />
            ))}
            {vm.items.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center">
                  <PackageCheck className="mx-auto mb-2 h-8 w-8 text-success" />
                  <p className="text-sm font-medium text-success">You have everything in stock</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Current ingredients cover all upcoming orders.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Total estimated cost</p>
                <p className="text-xs text-muted-foreground">
                  {vm.total.enoughCount > 0 && `${vm.total.enoughCount} item(s) already in stock`}
                  {vm.nextDelivery &&
                    ` · next delivery ${new Date(vm.nextDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </p>
              </div>
              <p className="font-display text-xl font-bold">{formatMVR(vm.total.totalCost)}</p>
            </CardContent>
          </Card>

          {vm.inStock.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Already in stock
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {vm.inStock.map((s) => (
                    <Badge key={s.name} variant="secondary" className="bg-muted text-muted-foreground">
                      {s.name} · {formatBaseQuantity(s.requiredBase, s.baseUnit)} needed
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ShoppingRow({
  item,
  checked,
  onToggle,
}: {
  item: ShoppingListItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
        checked ? 'border-success/30 bg-success/5' : 'border-border bg-card hover:bg-muted/40'
      )}
    >
      {checked ? (
        <CheckSquare className="h-6 w-6 shrink-0 text-success" />
      ) : (
        <Square className="h-6 w-6 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-base font-bold',
            checked && 'text-muted-foreground line-through'
          )}
        >
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground">
          buy {formatBaseQuantity(item.toBuyBase, item.baseUnit)}
          {item.packs !== null && item.packSize !== null
            ? ` · ${item.packs} × ${formatBaseQuantity(item.packSize, item.packUnit ?? item.baseUnit)} pack${item.packs > 1 ? 's' : ''}`
            : ''}
          {` · have ${formatBaseQuantity(item.availableBase, item.baseUnit)}`}
        </p>
      </div>
      <span className={cn('shrink-0 font-display text-sm font-bold', checked && 'text-muted-foreground line-through')}>
        {formatMVR(item.estimatedCost)}
      </span>
    </button>
  );
}