'use client';

import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  BarChart3,
  Scale,
  ChevronDown,
  Recycle,
  Gauge,
  Trophy,
  Percent,
  CalendarClock,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';
import { formatMVR } from '@/lib/costing';
import { worstRecipes } from '@/lib/production-variance';

type ReportsVM = {
  stats: {
    revenue: number;
    grossProfit: number;
    margin: number;
    unitsSold: number;
    transactions: number;
  };
  salesTrendData: { day: string; revenue: number; cost: number }[];
  todaysTransactions: { id: string; itemsLabel: string; time: string; totalAmount: number }[];
  profitability: {
    id: string;
    name: string;
    cost: number;
    sellingPrice: number;
    profit: number;
    margin: number;
  }[];
  wasteData: { name: string; value: number; fill: string }[];
  wasteTotals: {
    produced: number;
    sold: number;
    spoiled: number;
    gifted: number;
    total: number;
    wastePct: string;
  };
  costVariance: {
    batchVariance: {
      id: string;
      orderId: string;
      orderLabel: string;
      recipeId: string;
      recipeName: string;
      productName: string;
      batchCount: number;
      createdAt: string;
      plannedCost: number;
      actualCost: number;
      costVariance: number;
      varianceCostPct: number;
      ingredients: {
        ingredientId: string;
        ingredientName: string;
        plannedBase: number;
        actualBase: number;
        diffBase: number;
        variancePct: number;
        costPerBase: number;
        plannedCost: number;
        actualCost: number;
        costVariance: number;
      }[];
    }[];
    recipeVariance: {
      recipeId: string;
      recipeName: string;
      productName: string;
      batches: number;
      plannedCost: number;
      actualCost: number;
      costVariance: number;
      varianceCostPct: number;
      wastePct: number;
    }[];
    summary: {
      batches: number;
      plannedCost: number;
      actualCost: number;
      costVariance: number;
      varianceCostPct: number;
      estimatedRevenue: number;
      expectedProfit: number;
      actualProfit: number;
      marginImpact: number;
    };
    varianceTrend: {
      day: string;
      plannedCost: number;
      actualCost: number;
      costVariance: number;
      marginImpact: number;
    }[];
    wasteTrend: {
      day: string;
      produced: number;
      wasted: number;
      wastePct: number;
    }[];
    efficiency: {
      hasData: boolean;
      score: number;
      band: string;
      avgOverrunPct: number;
      avgWastePct: number;
      wasteCostInWindow: number;
      annualWasteLoss: number;
      best: { name: string; score: number } | null;
      worst: { name: string; score: number } | null;
      recipes: {
        recipeId: string;
        recipeName: string;
        batches: number;
        overrunPct: number;
        wastePct: number;
        score: number;
        band: string;
      }[];
    };
  };
};

const revenueConfig: ChartConfig = {
  revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
  cost: { label: 'Cost', color: 'hsl(var(--chart-4))' },
};

const wasteConfig: ChartConfig = {
  sold: { label: 'Sold', color: 'hsl(var(--chart-2))' },
  spoiled: { label: 'Spoiled', color: 'hsl(var(--chart-4))' },
  gifted: { label: 'Gifted', color: 'hsl(var(--chart-3))' },
};

const varianceTrendConfig: ChartConfig = {
  costVariance: { label: 'Cost variance' },
};

const wasteTrendConfig: ChartConfig = {
  wastePct: { label: 'Waste %' },
};

function bandVariant(band: string): 'success' | 'warning' | 'destructive' | 'default' {
  if (band === 'Excellent' || band === 'Good') return 'success';
  if (band === 'Fair') return 'warning';
  return 'destructive';
}

export function ReportsClient({ stats, salesTrendData, todaysTransactions, profitability, wasteData, wasteTotals, costVariance }: ReportsVM) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Reports" description="Track sales, profit, and waste" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Today's Revenue" value={formatMVR(stats.revenue)} icon={<DollarSign className="h-5 w-5" />} variant="primary" />
        <StatCard
          label="Gross Profit"
          value={formatMVR(stats.grossProfit)}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="success"
          trend={{ value: `${stats.margin.toFixed(0)}% margin`, positive: true }}
        />
        <StatCard label="Units Sold" value={String(stats.unitsSold)} icon={<Package className="h-5 w-5" />} />
        <StatCard label="Transactions" value={String(stats.transactions)} icon={<BarChart3 className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="w-full">
          <TabsTrigger value="sales" className="flex-1">Sales</TabsTrigger>
          <TabsTrigger value="profit" className="flex-1">Profit</TabsTrigger>
          <TabsTrigger value="waste" className="flex-1">Waste</TabsTrigger>
          <TabsTrigger value="variance" className="flex-1">Cost Variance</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueConfig} className="h-[250px] w-full">
                <LineChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s Transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todaysTransactions.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{sale.itemsLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-bold">{formatMVR(sale.totalAmount)}</span>
                </div>
              ))}
              {todaysTransactions.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No sales today</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue vs Cost (7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueConfig} className="h-[250px] w-full">
                <BarChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="cost" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product Profitability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profitability.map((product) => (
                <div key={product.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{product.name}</p>
                    <Badge
                      variant="secondary"
                      className={
                        product.margin >= 50
                          ? 'bg-success/10 text-success'
                          : product.margin >= 25
                            ? 'bg-warning/10 text-warning'
                            : 'bg-destructive/10 text-destructive'
                      }
                    >
                      {product.margin.toFixed(0)}% margin
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Cost</p>
                      <p className="font-medium">{formatMVR(product.cost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p className="font-medium">{formatMVR(product.sellingPrice)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Profit</p>
                      <p className="font-bold text-success">{formatMVR(product.profit)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {profitability.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No products yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waste" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product Outcomes</CardTitle>
            </CardHeader>
            <CardContent>
              {wasteTotals.total === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold">Outcomes appear as you move product</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Log Produced, Sold, Spoiled, Gifted, or Staff use from the Products
                    screen — Crumb turns the history into this waste picture.
                  </p>
                </div>
              ) : (
                <>
                  <ChartContainer config={wasteConfig} className="mx-auto h-[250px]">
                    <RechartsPie>
                      <Pie
                        data={wasteData.filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                        paddingAngle={3}
                      >
                        {wasteData.filter((d) => d.value > 0).map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </RechartsPie>
                  </ChartContainer>
                  <div className="mt-4 flex justify-center gap-4">
                    {wasteData.filter((d) => d.value > 0).map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.fill }} />
                        <span className="text-sm">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Waste Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Produced</p>
                  <p className="font-display text-2xl font-bold">{wasteTotals.produced}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Sold</p>
                  <p className="font-display text-2xl font-bold text-success">{wasteTotals.sold}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Spoiled</p>
                  <p className="font-display text-2xl font-bold text-destructive">{wasteTotals.spoiled}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Gifted</p>
                  <p className="font-display text-2xl font-bold">{wasteTotals.gifted}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-destructive/5 p-3">
                <span className="text-sm font-medium text-destructive">Waste Percentage</span>
                <span className="font-display text-xl font-bold text-destructive">
                  {wasteTotals.wastePct}%
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <CostVarianceTab costVariance={costVariance} />
      </Tabs>
    </div>
  );
}

function CostVarianceTab({ costVariance }: { costVariance: ReportsVM['costVariance'] }) {
  const { summary, batchVariance, recipeVariance, varianceTrend, wasteTrend, efficiency } = costVariance;
  const [expanded, setExpanded] = useState<string | null>(null);

  const varianceBadge = (pct: number, label: string) => (
    <Badge
      variant="secondary"
      className={
        pct <= 0
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive'
      }
    >
      {pct >= 0 ? '+' : ''}
      {pct.toFixed(1)}% {label}
    </Badge>
  );

  if (summary.batches === 0) {
    return (
      <TabsContent value="variance" className="space-y-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No completed batches yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Complete a production batch in the Floor and Crumb will report
              planned vs actual ingredient cost and where profit went.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="variance" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Planned Cost"
          value={formatMVR(summary.plannedCost)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Actual Cost"
          value={formatMVR(summary.actualCost)}
          icon={<BarChart3 className="h-5 w-5" />}
          variant={summary.actualCost > summary.plannedCost ? 'destructive' : 'success'}
        />
        <StatCard
          label="Cost Variance"
          value={`${summary.costVariance >= 0 ? '+' : ''}${formatMVR(summary.costVariance)}`}
          icon={<Scale className="h-5 w-5" />}
          variant={summary.costVariance > 0 ? 'destructive' : 'success'}
          trend={{ value: `${Math.abs(summary.varianceCostPct).toFixed(1)}%`, positive: summary.varianceCostPct <= 0 }}
        />
        <StatCard
          label="Margin Impact"
          value={`${summary.marginImpact >= 0 ? '+' : ''}${formatMVR(summary.marginImpact)}`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant={summary.marginImpact >= 0 ? 'success' : 'destructive'}
          trend={{
            value: summary.marginImpact >= 0 ? 'better than expected' : 'profit lost',
            positive: summary.marginImpact >= 0,
          }}
        />
      </div>

      <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">How to read these:</span>{' '}
        <span className="font-medium text-foreground">Cost Variance</span> = how much actual
        ingredient usage cost differed from plan.{' '}
        <span className="font-medium text-foreground">Margin Impact</span> = estimated profit
        lost to waste and overruns.{' '}
        <span className="font-medium text-foreground">Efficiency</span> (see below) = 100 minus
        waste% minus overrun% — higher is better.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planned vs Actual Cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated output value</span>
                <span className="font-medium">{formatMVR(summary.estimatedRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected profit</span>
                <span className="font-medium text-success">{formatMVR(summary.expectedProfit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual profit</span>
                <span className="font-medium">{formatMVR(summary.actualProfit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Margin Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Had every batch run exactly to plan you would have kept{' '}
              <span className="font-medium text-success">{formatMVR(summary.expectedProfit)}</span>.
            </p>
            <p className="text-muted-foreground">
              Recorded usage left you with{' '}
              <span className="font-medium">{formatMVR(summary.actualProfit)}</span>.
            </p>
            <p
              className={cn(
                'font-display text-lg font-bold',
                summary.marginImpact >= 0 ? 'text-success' : 'text-destructive'
              )}
            >
              {summary.marginImpact >= 0 ? '+' : ''}
              {formatMVR(summary.marginImpact)} {summary.marginImpact >= 0 ? 'gained' : 'lost'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Variance Trend (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={varianceTrendConfig} className="h-[220px] w-full">
              <BarChart data={varianceTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} interval={6} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="costVariance" radius={[4, 4, 0, 0]}>
                  {varianceTrend.map((e, i) => (
                    <Cell key={i} fill={e.costVariance > 0 ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-2))'} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Red bars = over planned cost, green = under. Margin impact mirrors this daily.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waste % Trend (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={wasteTrendConfig} className="h-[220px] w-full">
              <LineChart data={wasteTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} interval={6} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} unit="%" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="wastePct" stroke="hsl(var(--chart-4))" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              Spoiled, gifted, staff, and samples as a share of what was produced.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipe Variance Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {worstRecipes(recipeVariance, 5).map((r, i) => (
            <div key={r.recipeId} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                    i === 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.recipeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.batches} batch{r.batches > 1 ? 'es' : ''} · {formatMVR(r.costVariance)} over
                  </p>
                </div>
              </div>
              <span className={cn('shrink-0 font-display text-sm font-bold', r.varianceCostPct > 0 ? 'text-destructive' : 'text-success')}>
                {r.varianceCostPct >= 0 ? '+' : ''}
                {r.varianceCostPct.toFixed(1)}%
              </span>
            </div>
          ))}
          {worstRecipes(recipeVariance, 5).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No recipe overruns recorded</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-5 w-5 text-primary" />
            Production Efficiency (30 Days)
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Based on recorded waste and ingredient overruns. Higher is better.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {efficiency.hasData ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="Efficiency Score"
                  value={`${efficiency.score.toFixed(1)}%`}
                  icon={<Gauge className="h-5 w-5" />}
                  variant={bandVariant(efficiency.band)}
                  trend={{ value: efficiency.band, positive: efficiency.score >= 90 }}
                />
                <StatCard
                  label="Avg Batch Overrun"
                  value={`${efficiency.avgOverrunPct >= 0 ? '+' : ''}${efficiency.avgOverrunPct.toFixed(1)}%`}
                  icon={<Percent className="h-5 w-5" />}
                  variant={efficiency.avgOverrunPct > 5 ? 'destructive' : 'default'}
                />
                <StatCard
                  label="Avg Waste %"
                  value={`${efficiency.avgWastePct.toFixed(1)}%`}
                  icon={<Recycle className="h-5 w-5" />}
                  variant={efficiency.avgWastePct > 10 ? 'warning' : 'default'}
                />
                <StatCard
                  label="Est. Annual Waste Loss"
                  value={formatMVR(efficiency.annualWasteLoss)}
                  icon={<CalendarClock className="h-5 w-5" />}
                  variant="destructive"
                  trend={{ value: `${formatMVR(efficiency.wasteCostInWindow)} in 30d`, positive: false }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {efficiency.best && (
                  <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
                    <Trophy className="h-6 w-6 shrink-0 text-success" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best Performer</p>
                      <p className="truncate text-sm font-semibold">{efficiency.best.name}</p>
                    </div>
                    <span className="ml-auto shrink-0 font-display text-xl font-bold text-success">
                      {efficiency.best.score.toFixed(1)}%
                    </span>
                  </div>
                )}
                {efficiency.worst && (
                  <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs Attention</p>
                      <p className="truncate text-sm font-semibold">{efficiency.worst.name}</p>
                    </div>
                    <span className="ml-auto shrink-0 font-display text-xl font-bold text-destructive">
                      {efficiency.worst.score.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Recipe</th>
                      <th className="px-3 py-2 text-right font-medium">Batches</th>
                      <th className="px-3 py-2 text-right font-medium">Score</th>
                      <th className="px-3 py-2 text-right font-medium">Waste %</th>
                      <th className="px-3 py-2 text-right font-medium">Overrun %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {efficiency.recipes.map((r) => (
                      <tr key={r.recipeId} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 font-medium">{r.recipeName}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{r.batches}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge
                            variant="secondary"
                            className={cn(
                              r.band === 'Excellent' && 'bg-success/10 text-success',
                              r.band === 'Good' && 'bg-success/10 text-success',
                              r.band === 'Fair' && 'bg-warning/10 text-warning',
                              r.band === 'Needs Attention' && 'bg-destructive/10 text-destructive'
                            )}
                          >
                            {r.score.toFixed(0)} · {r.band}
                          </Badge>
                        </td>
                        <td className={cn('px-3 py-2 text-right', r.wastePct > 10 ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                          {r.wastePct.toFixed(1)}
                        </td>
                        <td className={cn('px-3 py-2 text-right', r.overrunPct > 5 ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                          {r.overrunPct >= 0 ? '+' : ''}
                          {r.overrunPct.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No batches or product movements in the last 30 days yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipe Variance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recipeVariance.map((r) => (
            <div key={r.recipeId} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.recipeName}</p>
                  <p className="text-xs text-muted-foreground">{r.batches} batch{r.batches > 1 ? 'es' : ''}</p>
                </div>
                {varianceBadge(r.varianceCostPct, 'cost')}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Planned</p>
                  <p className="font-medium">{formatMVR(r.plannedCost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actual</p>
                  <p className="font-medium">{formatMVR(r.actualCost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Variance</p>
                  <p className={cn('font-bold', r.costVariance > 0 ? 'text-destructive' : 'text-success')}>
                    {r.costVariance >= 0 ? '+' : ''}
                    {formatMVR(r.costVariance)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Waste</p>
                  <p className={cn('font-bold', r.wastePct > 10 ? 'text-destructive' : 'text-muted-foreground')}>
                    {r.wastePct.toFixed(1)}%
                  </p>
                </div>
              </div>
              {r.wastePct > 10 && r.varianceCostPct > 0 && (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
                  <Recycle className="h-3.5 w-3.5" />
                  High waste ({r.wastePct.toFixed(0)}%) compounds an over-budget recipe — look at both together.
                </p>
              )}
            </div>
          ))}
          {recipeVariance.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No recipe data yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batch Variance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {batchVariance.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {b.recipeName} — {b.orderLabel} · {b.batchCount}×
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={cn('text-sm font-bold', b.costVariance > 0 ? 'text-destructive' : 'text-success')}>
                    {b.costVariance >= 0 ? '+' : ''}
                    {formatMVR(b.costVariance)}
                  </span>
                  <ChevronDown
                    className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded === b.id && 'rotate-180')}
                  />
                </div>
              </button>
              {expanded === b.id && (
                <div className="border-t border-border bg-muted/30 p-3">
                  <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Planned</p>
                      <p className="font-medium">{formatMVR(b.plannedCost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actual</p>
                      <p className="font-medium">{formatMVR(b.actualCost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Variance</p>
                      <p className={cn('font-bold', b.costVariance > 0 ? 'text-destructive' : 'text-success')}>
                        {b.varianceCostPct >= 0 ? '+' : ''}
                        {b.varianceCostPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="pb-1 text-left font-medium">Ingredient</th>
                        <th className="pb-1 text-right font-medium">Planned</th>
                        <th className="pb-1 text-right font-medium">Actual</th>
                        <th className="pb-1 text-right font-medium">Variance</th>
                        <th className="pb-1 text-right font-medium">Cost Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.ingredients.map((ing) => (
                        <tr key={ing.ingredientId} className="border-t border-border/60">
                          <td className="py-1.5">{ing.ingredientName}</td>
                          <td className="py-1.5 text-right">{ing.plannedBase.toFixed(1)}</td>
                          <td className="py-1.5 text-right">{ing.actualBase.toFixed(1)}</td>
                          <td className={cn('py-1.5 text-right font-medium', ing.variancePct > 0 ? 'text-destructive' : 'text-success')}>
                            {ing.diffBase >= 0 ? '+' : ''}
                            {ing.diffBase.toFixed(1)}
                          </td>
                          <td className={cn('py-1.5 text-right font-medium', ing.costVariance > 0 ? 'text-destructive' : 'text-success')}>
                            {ing.costVariance >= 0 ? '+' : ''}
                            {formatMVR(ing.costVariance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {batchVariance.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No batch data yet</p>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
