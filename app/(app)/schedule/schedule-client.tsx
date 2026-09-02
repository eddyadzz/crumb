'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Factory,
  Loader2,
  Phone,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import type { OrderStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { groupOrdersByDay, windowDayKeys, monthGridKeys } from '@/lib/orders';
import { buildPlanFromOrders } from '@/lib/actions/orders';

type OrderVM = {
  id: string;
  status: OrderStatus;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  deliveryDate: string | null;
  deliveryTime: string | null;
  notes: string | null;
  createdAt: string;
  items: { id: string; productName: string; quantity: number; unitPrice: number }[];
};

const STATUS_META: Record<OrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  PENDING: { label: 'Pending', variant: 'secondary' },
  CONFIRMED: { label: 'Confirmed', variant: 'default' },
  IN_PRODUCTION: { label: 'In Production', variant: 'default' },
  READY: { label: 'Ready', variant: 'default' },
  DELIVERED: { label: 'Delivered', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

type View = 'day' | 'week' | 'month';

export function ScheduleClient({
  orders,
  hasActiveProduction,
}: {
  orders: OrderVM[];
  hasActiveProduction: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>('day');
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [planningId, setPlanningId] = useState<string | null>(null);

  const days = useMemo(
    () => groupOrdersByDay(orders),
    [orders]
  );
  const byKey = useMemo(() => new Map(days.map((d) => [d.key, d.orders])), [days]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'CANCELLED'),
    [orders]
  );

  const windowKeys = windowDayKeys(anchor, view === 'month' ? 35 : view === 'week' ? 7 : 1);

  const planForDay = async (key: string) => {
    const ids = (byKey.get(key) ?? [])
      .filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION' || o.status === 'READY')
      .map((o) => o.id);
    if (ids.length === 0) return;
    setPlanningId(key);
    try {
      const plan = await buildPlanFromOrders(ids);
      const qs = plan.recipeItems.map((r) => `${r.recipeId}:${r.batchCount}`).join(',');
      router.push(`/produce?recipes=${qs}`);
    } finally {
      setPlanningId(null);
    }
  };

  const step = () => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + (view === 'month' ? 30 : view === 'week' ? 7 : 1));
    setAnchor(d);
  };
  const back = () => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - (view === 'month' ? 30 : view === 'week' ? 7 : 1));
    setAnchor(d);
  };
  const today = () => {
    const now = new Date();
    setAnchor(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  const rangeLabel =
    view === 'month'
      ? anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${windowKeys[0]} – ${windowKeys[windowKeys.length - 1]}`
        : anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const monthGrid = useMemo(() => monthGridKeys(anchor), [anchor]);
  const todayKey = windowDayKeys(new Date(), 1)[0];

  const OrderCard = ({ o }: { o: OrderVM }) => {
    const meta = STATUS_META[o.status];
    return (
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold">
            {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
          </p>
          <Badge variant={meta.variant} className="shrink-0">
            {meta.label}
          </Badge>
        </div>
        {o.customerName && (
          <p className="truncate text-xs text-muted-foreground">
            {o.customerName}
            {o.customerPhone && (
              <span className="ml-1.5 inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {o.customerPhone}
              </span>
            )}
          </p>
        )}
        {o.deliveryTime && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {o.deliveryTime}
          </p>
        )}
        {o.notes && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{o.notes}</p>
        )}
      </div>
    );
  };

  const dayCell = (key: string | null) => {
    if (key === null) {
      return <div key="empty" className="min-h-[120px] rounded-xl border border-dashed border-border bg-muted/30" />;
    }
    const list = byKey.get(key) ?? [];
    const count = list.length;
    const isToday = key === todayKey;
    return (
      <div
        key={key}
        className={cn(
          'flex min-h-[120px] flex-col gap-1.5 rounded-xl border p-2',
          isToday ? 'border-primary bg-primary/5' : 'border-border'
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            {new Date(key + 'T00:00:00').toLocaleDateString('en-US', view === 'day' ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric' })}
          </p>
          {count > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">{count}</span>}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {list.slice(0, view === 'month' ? 2 : undefined).map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
          {view === 'month' && count > 2 && (
            <p className="text-xs text-muted-foreground">+{count - 2} more</p>
          )}
          {count > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={planningId === key}
              onClick={() => planForDay(key)}
            >
              {planningId === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />}
              Plan
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Schedule"
        description="What you need to make, day by day"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {(['day', 'week', 'month'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={back}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={today} className="text-xs">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={step}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {rangeLabel}
        </p>
        {hasActiveProduction && (
          <Button variant="ghost" size="sm" asChild>
            <a href="/produce">Go to live production →</a>
          </Button>
        )}
      </div>

      {view === 'month' ? (
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <p key={d} className="text-center text-xs font-semibold text-muted-foreground">{d}</p>
          ))}
          {monthGrid.grid.map((key, i) => {
            if (key === null) {
              return <div key={`pad-${i}`} className="min-h-[120px] rounded-xl border border-dashed border-border bg-muted/20" />;
            }
            return dayCell(key);
          })}
        </div>
      ) : (
        <div className={cn('grid gap-2', view === 'week' ? 'grid-cols-7' : 'grid-cols-1')}>
          {windowKeys.map((key) => dayCell(key))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Unscheduled orders</p>
        {(() => {
          const unscheduled = activeOrders.filter((o) => !o.deliveryDate);
          if (unscheduled.length === 0) {
            return <p className="py-4 text-center text-sm text-muted-foreground">No unscheduled orders</p>;
          }
          return (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unscheduled.map((o) => (
                <OrderCard key={o.id} o={o} />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}