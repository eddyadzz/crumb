import {
  Building2,
  Activity,
  CreditCard,
  Clock,
  Users,
  Mail,
  Bell,
  Briefcase,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  saasGetOverview,
  saasGetSubscriptionQueue,
  saasGetEmailHealth,
  saasGetRecentActivity,
} from '@/lib/actions/saas';

export const dynamic = 'force-dynamic';

export default async function SaasPage() {
  const [overview, queue, emailHealth, activity] = await Promise.all([
    saasGetOverview(),
    saasGetSubscriptionQueue(),
    saasGetEmailHealth(),
    saasGetRecentActivity(),
  ]);

  const formatMVR = (n: number) =>
    `MVR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const statusVariant = (status: string, active?: boolean) =>
    status === 'SUCCESS'
      ? 'default'
      : status === 'FAILED'
        ? 'destructive'
        : status === 'RUNNING'
          ? 'secondary'
          : active
            ? 'default'
            : 'secondary';

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Operations"
        description="Platform health — tenants, subscriptions and email delivery"
        action={
          <span className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">
            <Briefcase className="h-4 w-4" />
            SaaS Dashboard
          </span>
        }
      />

      {/* Tenant overview */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        <Stat label="Total Tenants" value={String(overview.totalTenants)} icon={<Building2 className="h-5 w-5" />} variant="primary" />
        <Stat label="Active" value={String(overview.activeTenants)} icon={<Activity className="h-5 w-5" />} variant="success" />
        <Stat label="Trials" value={String(overview.trialTenants)} icon={<CreditCard className="h-5 w-5" />} />
        <Stat label="Expired Trials" value={String(overview.expiredTrials)} icon={<Clock className="h-5 w-5" />} variant="warning" />
        <Stat label="Paying" value={String(overview.payingTenants)} icon={<Users className="h-5 w-5" />} />
        <Stat label="MRR" value={formatMVR(overview.mrr)} icon={<Briefcase className="h-5 w-5" />} />
      </div>

      {/* Subscription queue */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Subscription Queue</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{queue.pending.length} pending</Badge>
            <Badge className="bg-emerald-100 text-emerald-700">{queue.approvedToday} approved today</Badge>
            <Badge className="bg-rose-100 text-rose-700">{queue.rejectedToday} rejected today</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Proof</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No pending upgrade requests
                  </TableCell>
                </TableRow>
              )}
              {queue.pending.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.tenantName}</TableCell>
                  <TableCell>
                    <Badge variant={r.planCode === 'free' ? 'secondary' : 'default'}>
                      {r.planName}
                    </Badge>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.billingInterval === 'YEARLY' ? 'Yearly' : 'Monthly'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{r.paymentMethodName}</TableCell>
                  <TableCell className="text-xs">{r.referenceNumber}</TableCell>
                  <TableCell>
                    {r.hasProof ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Email health */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-muted-foreground" />
              Email Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bell className="h-3.5 w-3.5" /> Generated (24h)
                </div>
                <p className="mt-1 text-xl font-semibold">
                  {emailHealth.notificationsGenerated24h}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Digest emails (24h)
                </div>
                <p className="mt-1 text-xl font-semibold">
                  {emailHealth.digestEmailsSent24h}
                </p>
              </div>
            </div>
            {emailHealth.lastRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cron runs recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailHealth.lastRuns.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.job}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(r.startedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-right text-xs text-muted-foreground">
                        {r.message ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Trace the full pipeline per tenant on failure: run → generated →
              emailed.
            </p>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {activity.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No activity yet
                </li>
              )}
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <ActivityIcon kind={a.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDateTime(a.at)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  variant,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning';
}) {
  const color =
    variant === 'success'
      ? 'text-emerald-600'
      : variant === 'warning'
        ? 'text-amber-600'
        : 'text-primary';
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={`mb-2 flex items-center gap-2 ${color}`}>{icon}</div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  const cls = 'mt-0.5 h-4 w-4 shrink-0';
  switch (kind) {
    case 'tenant':
      return <Building2 className={`${cls} text-primary`} />;
    case 'upgrade':
      return <Briefcase className={`${cls} text-emerald-600`} />;
    case 'trial':
      return <Clock className={`${cls} text-amber-600`} />;
    default:
      return <Activity className={`${cls} text-muted-foreground`} />;
  }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}