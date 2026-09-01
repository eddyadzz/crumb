import { getSalesData, getProductOutcomeSummary, getProductProfitability } from '@/lib/queries';
import { getTenantContext } from '@/lib/tenant';
import { ReportsClient } from './reports-client';

export const dynamic = 'force-dynamic';

function dayKey(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default async function ReportsPage() {
  const { tenantId } = await getTenantContext();
  const [sales, outcomeSummary, profitability] = await Promise.all([
    getSalesData(tenantId),
    getProductOutcomeSummary(tenantId),
    getProductProfitability(tenantId),
  ]);

  const today = new Date();

  // 7-day trend (label + revenue + cost)
  const trendMap = new Map<string, { revenue: number; cost: number; label: string }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    trendMap.set(dayKey(d), { revenue: 0, cost: 0, label });
  }
  for (const sale of sales) {
    const saleDate = new Date(sale.createdAt);
    const key = dayKey(saleDate);
    const entry = trendMap.get(key);
    if (!entry) continue;
    entry.revenue += sale.totalAmount;
    for (const item of sale.items) {
      entry.cost += item.costPerUnit * item.quantity;
    }
  }
  const salesTrendData = [...trendMap.values()].map((e) => ({
    day: e.label,
    revenue: Math.round(e.revenue * 100) / 100,
    cost: Math.round(e.cost * 100) / 100,
  }));

  const todaysSales = sales.filter((s) => isSameDay(new Date(s.createdAt), today));
  const todaysRevenue = todaysSales.reduce((s, sale) => s + sale.totalAmount, 0);
  const totalUnitsSold = todaysSales.reduce(
    (sum, sale) => sum + sale.items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const todaysCost = todaysSales.reduce(
    (sum, sale) =>
      sum + sale.items.reduce((s, i) => s + i.costPerUnit * i.quantity, 0),
    0
  );
  const grossProfit = todaysRevenue - todaysCost;
  const margin = todaysRevenue > 0 ? (grossProfit / todaysRevenue) * 100 : 0;

  const produced = outcomeSummary['PRODUCED'] ?? 0;
  const sold = outcomeSummary['SOLD'] ?? 0;
  const spoiled = outcomeSummary['SPOILED'] ?? 0;
  const gifted = outcomeSummary['GIFTED'] ?? 0;
  const totalOutcomes = produced + sold + spoiled + gifted;
  const wastePct = produced > 0 ? ((spoiled / produced) * 100).toFixed(0) : '0';

  const wasteData = [
    { name: 'Sold', value: sold, fill: 'hsl(var(--chart-2))' },
    { name: 'Spoiled', value: spoiled, fill: 'hsl(var(--chart-4))' },
    { name: 'Gifted', value: gifted, fill: 'hsl(var(--chart-3))' },
  ];

  return (
    <ReportsClient
      stats={{
        revenue: todaysRevenue,
        grossProfit,
        margin,
        unitsSold: totalUnitsSold,
        transactions: todaysSales.length,
      }}
      salesTrendData={salesTrendData}
      todaysTransactions={todaysSales.map((s) => ({
        id: s.id,
        itemsLabel: s.items.map((i) => `${i.quantity}× ${i.productName}`).join(', '),
        time: new Date(s.createdAt).toISOString(),
        totalAmount: s.totalAmount,
      }))}
      profitability={profitability}
      wasteData={wasteData}
      wasteTotals={{ produced, sold, spoiled, gifted, total: totalOutcomes, wastePct }}
    />
  );
}
