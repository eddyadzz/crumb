import { describe, expect, it } from 'vitest';
import {
  customerStats,
  rankCustomers,
  insightsSummary,
  customerBadge,
  type CustomerOrderFact,
} from '@/lib/customer-insights';

const now = new Date(2026, 8, 4); // Sep 4 2026

const fact = (over: Partial<CustomerOrderFact>): CustomerOrderFact => ({
  customerId: 'c1',
  totalAmount: 100,
  createdAt: new Date(2026, 7, 1), // Aug 1
  status: 'DELIVERED',
  ...over,
});

describe('customer insights', () => {
  it('aggregates revenue, counts, and recency per customer', () => {
    const stats = customerStats([
      fact({}),
      fact({ totalAmount: 250, createdAt: new Date(2026, 7, 20) }),
      fact({ customerId: 'c2', totalAmount: 90, createdAt: new Date(2026, 8, 1) }),
    ], now);
    const c1 = stats.find((s) => s.customerId === 'c1')!;
    const c2 = stats.find((s) => s.customerId === 'c2')!;
    expect(c1.orderCount).toBe(2);
    expect(c1.totalRevenue).toBe(350);
    expect(c1.avgOrderValue).toBe(175);
    expect(c1.isRepeat).toBe(true);
    expect(c1.daysSinceLastOrder).toBe(15); // Aug 20 → Sep 4
    expect(c2.isRepeat).toBe(false);
  });

  it('excludes cancelled orders from revenue but tracks them', () => {
    const stats = customerStats([
      fact({}),
      fact({ status: 'CANCELLED', totalAmount: 999 }),
    ], now);
    const c1 = stats[0];
    expect(c1.orderCount).toBe(1);
    expect(c1.cancelledCount).toBe(1);
    expect(c1.totalRevenue).toBe(100);
  });

  it('drops customers whose only orders were cancelled', () => {
    const stats = customerStats([fact({ status: 'CANCELLED' })], now);
    expect(stats).toHaveLength(0);
  });

  it('ranks by revenue with tie-break on order count', () => {
    const stats = customerStats([
      fact({ customerId: 'a', totalAmount: 100, createdAt: new Date(2026, 7, 1) }),
      fact({ customerId: 'b', totalAmount: 300 }),
      fact({ customerId: 'c', totalAmount: 100, createdAt: new Date(2026, 7, 2) }),
    ], now);
    expect(rankCustomers(stats).map((s) => s.customerId)).toEqual(['b', 'c', 'a']);
    expect(rankCustomers(stats, 1)).toHaveLength(1);
  });

  it('summarises repeat rate and averages', () => {
    const summary = insightsSummary(
      customerStats([
        fact({}),
        fact({ createdAt: new Date(2026, 7, 15), totalAmount: 200 }),
        fact({ customerId: 'c2' }),
      ], now)
    );
    expect(summary.customers).toBe(2);
    expect(summary.repeatCustomers).toBe(1);
    expect(summary.repeatRatePct).toBeCloseTo(50);
    expect(summary.totalRevenue).toBe(400);
    expect(summary.avgOrderValue).toBeCloseTo(400 / 3);
    expect(summary.avgOrdersPerCustomer).toBeCloseTo(1.5);
  });

  it('labels top, loyal, new, and dormant customers', () => {
    const stats = customerStats([
      fact({ customerId: 'top', totalAmount: 900 }),
      fact({ customerId: 'loyal', totalAmount: 400 }),
      fact({ customerId: 'loyal', createdAt: new Date(2026, 7, 10) }),
      fact({ customerId: 'loyal', createdAt: new Date(2026, 7, 20), totalAmount: 150 }),
      fact({ customerId: 'new', totalAmount: 100, createdAt: new Date(2026, 7, 30) }),
      fact({ customerId: 'dormant', totalAmount: 100, createdAt: new Date(2026, 2, 1) }),
    ], now);
    const byId = (id: string) => stats.find((s) => s.customerId === id)!;
    expect(customerBadge(byId('top'), 0, now)).toBe('top');
    expect(customerBadge(byId('loyal'), 1, now)).toBe('loyal'); // 3 orders
    expect(customerBadge(byId('new'), 2, now)).toBe('new'); // first order 5 days ago
    expect(customerBadge(byId('dormant'), 3, now)).toBe('dormant'); // 187 days quiet
  });

  it('handles an empty book', () => {
    const summary = insightsSummary([]);
    expect(summary.customers).toBe(0);
    expect(summary.repeatRatePct).toBe(0);
    expect(summary.totalRevenue).toBe(0);
  });
});
