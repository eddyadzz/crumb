import { getTenantContext } from '@/lib/tenant';
import { getCustomerInsights } from '@/lib/queries';
import { formatMVR } from '@/lib/costing';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Repeat, Trophy, Sparkles, MoonStar, Phone, Mail, CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const { tenantId } = await getTenantContext();
  const { summary, customers } = await getCustomerInsights(tenantId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Customer Insights"
        description="Who buys, who comes back, and who you haven't heard from"
      />

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Insights build themselves here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a named customer to an order and Crumb starts tracking who buys,
              who comes back, and who has gone quiet — no extra work.
            </p>
            <a
              href="/orders?new=1"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              Add your first order
            </a>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Customers"
              value={String(summary.customers)}
              sub={`${summary.avgOrdersPerCustomer.toFixed(1)} orders each`}
            />
            <StatCard
              icon={<Repeat className="h-5 w-5" />}
              label="Repeat customers"
              value={String(summary.repeatCustomers)}
              sub={`${summary.repeatRatePct.toFixed(0)}% come back`}
              tone="success"
            />
            <StatCard
              icon={<Sparkles className="h-5 w-5" />}
              label="Order revenue"
              value={formatMVR(summary.totalRevenue)}
              sub="excluding cancelled"
            />
            <StatCard
              icon={<Sparkles className="h-5 w-5" />}
              label="Avg order value"
              value={formatMVR(summary.avgOrderValue)}
            />
          </div>

          <div className="space-y-2">
            {customers.map((c) => (
              <Card key={c.customerId}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{c.name}</p>
                      <CustomerBadge badge={c.badge} />
                    </div>
                    <p className="flex items-center gap-3 text-xs text-muted-foreground">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </span>
                      )}
                      {!c.phone && !c.email && <span className="flex items-center gap-1"><CircleHelp className="h-3 w-3" /> no contact info</span>}
                      {c.cancelledCount > 0 && ` · ${c.cancelledCount} cancelled`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-base font-bold">{formatMVR(c.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.orderCount} order{c.orderCount > 1 ? 's' : ''} ·{' '}
                      {c.daysSinceLastOrder === 0
                        ? 'today'
                        : c.daysSinceLastOrder < 60
                          ? `${c.daysSinceLastOrder}d ago`
                          : `${Math.floor(c.daysSinceLastOrder / 30)}mo ago`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'success';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <p className="text-xs">{label}</p>
        </div>
        <p className={cn('mt-1 font-display text-xl font-bold', tone === 'success' && 'text-success')}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function CustomerBadge({ badge }: { badge: 'top' | 'loyal' | 'new' | 'dormant' | null }) {
  if (!badge) return null;
  if (badge === 'top')
    return (
      <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary">
        <Trophy className="mr-1 h-3 w-3" />
        Top customer
      </Badge>
    );
  if (badge === 'loyal')
    return (
      <Badge variant="secondary" className="shrink-0 bg-success/10 text-success">
        <Repeat className="mr-1 h-3 w-3" />
        Loyal
      </Badge>
    );
  if (badge === 'new')
    return (
      <Badge variant="secondary" className="shrink-0 border border-primary/30 text-primary">
        <Sparkles className="mr-1 h-3 w-3" />
        New
      </Badge>
    );
  return (
    <Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground">
      <MoonStar className="mr-1 h-3 w-3" />
      Quiet lately
    </Badge>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}