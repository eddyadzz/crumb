import Link from 'next/link';
import {
  Activity,
  ClipboardList,
  Factory,
  ShoppingCart,
  Briefcase,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { listActivity, type ActivityRow } from '@/lib/actions/activity';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const events = await listActivity(200);
  const groups = groupByDay(events);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Activity"
        description="What's been happening in your workspace"
        action={
          <Button asChild className="gap-2">
            <Link href="/sell">
              <ShoppingCart className="h-4 w-4" />
              Start Selling
            </Link>
          </Button>
        }
      />

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Activity className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm">
              No activity yet. Create an order, sell a product, or run production
              and it&apos;ll show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h2>
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {group.events.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                      <ActivityIcon type={e.type} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{e.title}</p>
                        {e.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {e.description}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatTime(e.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const cls = 'mt-0.5 h-4 w-4 shrink-0';
  switch (type) {
    case 'ORDER_CREATED':
    case 'ORDER_CONFIRMED':
    case 'ORDER_CANCELLED':
      return <ClipboardList className={`${cls} text-primary`} />;
    case 'PRODUCTION_CREATED':
    case 'PRODUCTION_COMPLETED':
    case 'PRODUCTION_CANCELLED':
      return <Factory className={`${cls} text-amber-600`} />;
    case 'SALE_COMPLETED':
      return <ShoppingCart className={`${cls} text-emerald-600`} />;
    case 'UPGRADE_REQUESTED':
    case 'UPGRADE_APPROVED':
    case 'UPGRADE_REJECTED':
      return <Briefcase className={`${cls} text-sky-600`} />;
    default:
      return <Activity className={`${cls} text-muted-foreground`} />;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupByDay(events: ActivityRow[]): Array<{ label: string; events: ActivityRow[] }> {
  const days: Record<string, ActivityRow[]> = {};
  const now = new Date();
  for (const e of events) {
    const d = new Date(e.createdAt);
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const label =
      isToday
        ? 'Today'
        : dateKey(start) === dateKey(
            new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
          )
          ? 'Yesterday'
          : start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    (days[label] ??= []).push(e);
  }
  return Object.entries(days).map(([label, events]) => ({ label, events }));
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}