import { adminGetUsageOverview, adminListFeedback } from '@/lib/actions/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MOOD_ROWS = [
  { emoji: '🙂', label: 'Easy' },
  { emoji: '😐', label: 'Confusing' },
  { emoji: '☹', label: 'Frustrating' },
] as const;
import { MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Beta Usage — Crumb Admin',
};

const EVENT_LABELS: Record<string, string> = {
  order_created: 'Orders created',
  recipe_created: 'Recipes created',
  floor_session_started: 'Floor sessions',
  shopping_list_generated: 'Shopping lists generated',
  portal_order_received: 'Portal orders',
  status_page_viewed: 'Status page views',
  production_started: 'Production started',
  production_completed: 'Production completed',
  offline_sync_completed: 'Offline syncs',
};

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function BetaUsagePage() {
  const [overview, feedback] = await Promise.all([
    adminGetUsageOverview(),
    adminListFeedback(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Beta Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Product instrumentation from UsageEvent — {fmt(overview.totalTenants)} tenants total
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Active tenants (7d)" value={fmt(overview.activeTenants7)} />
        <SummaryCard label="Active tenants (30d)" value={fmt(overview.activeTenants30)} />
        <SummaryCard label="Total tenants" value={fmt(overview.totalTenants)} />
        <SummaryCard
          label="Events (30d)"
          value={fmt(overview.eventRows.reduce((s, r) => s + r.last30, 0))}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Events by type
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Event</th>
                <th className="px-4 py-2 text-right font-medium">7d</th>
                <th className="px-4 py-2 text-right font-medium">30d</th>
                <th className="px-4 py-2 text-right font-medium">All time</th>
              </tr>
            </thead>
            <tbody>
              {overview.eventRows.map((r) => (
                <tr key={r.eventType} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">{EVENT_LABELS[r.eventType] ?? r.eventType}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.last7)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.last30)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.allTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Most visited pages (30d)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {overview.routeRows.map((r) => (
              <div key={r.route} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{r.route}</span>
                <span className="tabular-nums font-semibold">{fmt(r.events)}</span>
              </div>
            ))}
            {overview.routeRows.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No events yet</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Mood breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {MOOD_ROWS.map((m) => {
              const moodFeedback = feedback.filter((f) => f.message.startsWith(m.emoji));
              const totalMoods = feedback.filter((f) => MOOD_ROWS.some((k) => f.message.startsWith(k.emoji))).length;
              const share = totalMoods > 0 ? Math.round((moodFeedback.length / totalMoods) * 100) : 0;
              return moodFeedback.length > 0 ? (
                <div key={m.label} className="flex items-center justify-between text-sm">
                  <span>
                    {m.emoji} {m.label}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {moodFeedback.length} ({share}%)
                  </span>
                </div>
              ) : null;
            })}
            {feedback.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                No feedback yet — bakers get a mood prompt on the Dashboard, Sync Center, and Settings.
              </p>
            )}
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              {feedback.filter((f) => !MOOD_ROWS.some((k) => f.message.startsWith(k.emoji))).length} written comment(s) below
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tenants (by 30d events)
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Tenant</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Events (30d)</th>
                <th className="px-4 py-2 text-right font-medium" title="Distinct days with events in the last 30 days">Days (30d)</th>
                <th className="px-4 py-2 text-right font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {overview.tenantRows.map((t) => (
                <tr key={t.tenantId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{t.tenantName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{t.status.toLowerCase()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(t.events30)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(t.activeDays30)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {fmtDate(t.lastActivityAt)}
                  </td>
                </tr>
              ))}
              {overview.tenantRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No tenants yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Baker feedback
        </h2>
        <div className="space-y-2">
          {feedback.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{f.tenantName}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.contactName ?? '—'}
                    {f.contactEmail ? ` · ${f.contactEmail}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {fmtDate(f.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
            </div>
          ))}
          {feedback.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-5 w-5" />
              No feedback yet — it appears here the moment a baker sends one from Settings.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
