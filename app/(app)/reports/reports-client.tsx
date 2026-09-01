'use client';

import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export function ReportsClient({ stats, salesTrendData, todaysTransactions, profitability, wasteData, wasteTotals }: ReportsVM) {
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
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No product movements recorded yet
                </p>
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
      </Tabs>
    </div>
  );
}
