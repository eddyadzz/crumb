import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { UsageEventTypeValue } from '@/lib/usage-events';

export interface RecordUsageInput {
  tenantId: string;
  userId?: string | null;
  eventType: UsageEventTypeValue;
  route?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Single entry point for product instrumentation.
 * Best-effort append: a failure here must never fail the action it describes.
 */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  try {
    await prisma.usageEvent.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        eventType: input.eventType,
        route: input.route ?? null,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch (err) {
    console.error('[crumb:usage] record failed', err);
  }
}

export interface UsageSummaryRow {
  route: string;
  events: number;
  tenants: number;
}

export interface TenantUsageRow {
  tenantId: string;
  events: number;
  activeDays: number;
  lastEventAt: Date | null;
}

export interface UsageSummary {
  since: Date | null;
  topRoutes: UsageSummaryRow[];
  tenants: TenantUsageRow[];
  totalEvents: number;
}

interface TenantUsageSqlRow {
  tenantId: string;
  events: bigint;
  active_days: bigint;
  last_event: Date | null;
}

/** Distinct active days per tenant: COUNT(DISTINCT DATE(createdAt)) — the
 * "did this baker come back tomorrow?" metric. Raw SQL because Prisma
 * groupBy cannot count distinct date truncations. */
export async function getTenantUsageRows(
  opts: { tenantId?: string; since?: Date | null } = {},
): Promise<TenantUsageRow[]> {
  const since = opts.since ?? null;
  const rows = await prisma.$queryRaw<TenantUsageSqlRow[]>`
    SELECT "tenantId",
           COUNT(*)::int AS events,
           COUNT(DISTINCT DATE("createdAt"))::int AS active_days,
           MAX("createdAt") AS last_event
    FROM "UsageEvent"
    WHERE 1 = 1
      ${opts.tenantId ? Prisma.sql`AND "tenantId" = ${opts.tenantId}` : Prisma.empty}
      ${since ? Prisma.sql`AND "createdAt" >= ${since}` : Prisma.empty}
    GROUP BY "tenantId"
    ORDER BY active_days DESC`;

  return rows.map((r) => ({
    tenantId: r.tenantId,
    events: Number(r.events),
    activeDays: Number(r.active_days),
    lastEventAt: r.last_event ?? null,
  }));
}

/**
 * Minimal reporting query: routes used most, distinct active days per tenant.
 * Kept as one raw-SQL pass so no aggregation tables are needed yet.
 */
export async function getUsageSummary(
  tenantId: string,
  opts: { since?: Date } = {},
): Promise<UsageSummary> {
  const since = opts.since ?? null;
  const where = since ? { tenantId, createdAt: { gte: since } } : { tenantId };

  const byRoute = await prisma.usageEvent.groupBy({
    by: ['route'],
    where,
    _count: { _all: true },
    orderBy: { _count: { route: 'desc' } },
    take: 20,
  });

  const rows: UsageSummaryRow[] = byRoute
    .filter((r) => r.route)
    .map((r) => ({ route: r.route as string, events: r._count._all, tenants: 1 }));

  const total = await prisma.usageEvent.count({ where });
  const tenantRows = await getTenantUsageRows({ tenantId, since });

  return {
    since,
    topRoutes: rows,
    tenants: tenantRows,
    totalEvents: total,
  };
}
