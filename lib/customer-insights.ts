/**
 * Pure customer-insights math (Phase I-G): rank customers by revenue, detect
 * repeat buyers, and summarise loyalty health. No server/DB/React imports.
 */

export interface CustomerOrderFact {
  customerId: string;
  totalAmount: number;
  createdAt: Date | string;
  /** CANCELLED orders are tracked but excluded from revenue/counts. */
  status: string;
}

export interface CustomerStat {
  customerId: string;
  /** Non-cancelled orders. */
  orderCount: number;
  cancelledCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  firstOrderAt: string;
  lastOrderAt: string;
  /** Whole days since the customer's last non-cancelled order. */
  daysSinceLastOrder: number;
  /** More than one non-cancelled order. */
  isRepeat: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function asTime(value: Date | string): number {
  return new Date(value).getTime();
}

/** Aggregate order facts into per-customer stats. */
export function customerStats(
  facts: CustomerOrderFact[],
  now: Date = new Date()
): CustomerStat[] {
  const map = new Map<
    string,
    { orders: number; cancelled: number; revenue: number; first: number; last: number }
  >();
  for (const f of facts) {
    const e = map.get(f.customerId) ?? {
      orders: 0,
      cancelled: 0,
      revenue: 0,
      first: Infinity,
      last: -Infinity,
    };
    const t = asTime(f.createdAt);
    if (f.status === 'CANCELLED') {
      e.cancelled += 1;
    } else {
      e.orders += 1;
      e.revenue += f.totalAmount;
      e.first = Math.min(e.first, t);
      e.last = Math.max(e.last, t);
    }
    map.set(f.customerId, e);
  }
  return [...map.entries()]
    .filter(([, e]) => e.orders > 0) // cancelled-only "customers" have no insight yet
    .map(([customerId, e]) => ({
      customerId,
      orderCount: e.orders,
      cancelledCount: e.cancelled,
      totalRevenue: e.revenue,
      avgOrderValue: e.orders > 0 ? e.revenue / e.orders : 0,
      firstOrderAt: new Date(e.first).toISOString(),
      lastOrderAt: new Date(e.last).toISOString(),
      daysSinceLastOrder: Math.max(0, Math.floor((now.getTime() - e.last) / DAY_MS)),
      isRepeat: e.orders > 1,
    }));
}

/** Stats sorted by revenue, ties broken by most recent order. */
export function rankCustomers(stats: CustomerStat[], limit?: number): CustomerStat[] {
  const ranked = [...stats].sort(
    (a, b) =>
      b.totalRevenue - a.totalRevenue ||
      new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
  );
  return limit === undefined ? ranked : ranked.slice(0, limit);
}

export interface InsightsSummary {
  customers: number;
  repeatCustomers: number;
  /** repeatCustomers / customers; 0 with no customers. */
  repeatRatePct: number;
  totalRevenue: number;
  avgOrderValue: number;
  avgOrdersPerCustomer: number;
}

/** Business-level loyalty health across all customers. */
export function insightsSummary(stats: CustomerStat[]): InsightsSummary {
  const customers = stats.length;
  const repeatCustomers = stats.filter((s) => s.isRepeat).length;
  const totalRevenue = stats.reduce((s, c) => s + c.totalRevenue, 0);
  const orderCount = stats.reduce((s, c) => s + c.orderCount, 0);
  return {
    customers,
    repeatCustomers,
    repeatRatePct: customers === 0 ? 0 : (repeatCustomers / customers) * 100,
    totalRevenue,
    avgOrderValue: orderCount === 0 ? 0 : totalRevenue / orderCount,
    avgOrdersPerCustomer: customers === 0 ? 0 : orderCount / customers,
  };
}

export type CustomerBadge = 'top' | 'loyal' | 'new' | 'dormant' | null;

/**
 * One human label per customer: top spender, loyal (3+ orders), new (first
 * order within 30 days), or dormant (no order in 60+ days). Priority:
 * top > loyal > new > dormant.
 */
export function customerBadge(stat: CustomerStat, rank: number, now: Date = new Date()): CustomerBadge {
  if (rank === 0) return 'top';
  const thirtyDaysAgo = now.getTime() - 30 * DAY_MS;
  const sixtyDaysAgo = now.getTime() - 60 * DAY_MS;
  if (stat.orderCount >= 3) return 'loyal';
  if (asTime(stat.firstOrderAt) >= thirtyDaysAgo) return 'new';
  if (asTime(stat.lastOrderAt) < sixtyDaysAgo) return 'dormant';
  return null;
}