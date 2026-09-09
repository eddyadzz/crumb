import Link from 'next/link';
import { getTenantContext } from '@/lib/tenant';
import { recordUsage } from '@/lib/usage';
import { UsageEventType } from '@/lib/usage-events';
import { getPricingAssistant } from '@/lib/queries';
import { formatMVR } from '@/lib/costing';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Tag, TrendingUp, CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const { tenantId } = await getTenantContext();
  await recordUsage({
    tenantId,
    eventType: UsageEventType.PRICE_CALCULATED,
    route: '/pricing',
  });
  const recipes = await getPricingAssistant(tenantId);

  const belowTarget = recipes.filter((r) => r.verdict === 'below-target');
  const unpriced = recipes.filter((r) => r.verdict === 'unpriced');

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Pricing Assistant"
        description="Know what to charge — based on what your recipes actually cost you"
      />

      {recipes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Pricing suggestions build themselves</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Once your first recipe has ingredients and costs, Crumb prices it —
              and flags anything selling for less than it should.
            </p>
            <Link
              href="/recipes"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              Go to recipes
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <StatPill
              label="Below 30% target"
              value={String(belowTarget.length)}
              tone={belowTarget.length > 0 ? 'warning' : 'good'}
            />
            <StatPill
              label="Not priced yet"
              value={String(unpriced.length)}
              tone={unpriced.length > 0 ? 'muted' : 'good'}
            />
            <StatPill
              label="On target"
              value={String(recipes.filter((r) => r.verdict === 'on-target').length)}
              tone="good"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {recipes.map((r) => (
              <PricingCard key={r.recipeId} recipe={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: 'good' | 'warning' | 'muted' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 font-display text-2xl font-bold',
            tone === 'warning' && 'text-warning',
            tone === 'good' && 'text-success',
            tone === 'muted' && 'text-muted-foreground'
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function PricingCard({ recipe }: { recipe: Awaited<ReturnType<typeof getPricingAssistant>>[number] }) {
  const { verdict } = recipe;
  return (
    <Card className={cn(verdict === 'below-target' && 'border-warning/40')}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-bold leading-snug">{recipe.recipeName}</p>
          {verdict === 'below-target' && (
            <Badge variant="secondary" className="shrink-0 bg-warning/15 text-warning">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Below target
            </Badge>
          )}
          {verdict === 'unpriced' && (
            <Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground">
              <CircleHelp className="mr-1 h-3 w-3" />
              Not priced
            </Badge>
          )}
          {verdict === 'on-target' && (
            <Badge variant="secondary" className="shrink-0 bg-success/10 text-success">
              <TrendingUp className="mr-1 h-3 w-3" />
              On target
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Planned cost / unit</p>
            <p className="font-display text-lg font-bold">{formatMVR(recipe.plannedCost)}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">
              Actual cost / unit{' '}
              {recipe.hasUsageData && (
                <span className="text-[10px] uppercase tracking-wide text-primary">from batches</span>
              )}
            </p>
            <p className="font-display text-lg font-bold">{formatMVR(recipe.actualCost)}</p>
          </div>
        </div>

        {recipe.currentPrice !== null ? (
          <div className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Current selling price</p>
              <p className="font-display text-lg font-bold">{formatMVR(recipe.currentPrice)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">You keep</p>
              <p
                className={cn(
                  'font-display text-lg font-bold',
                  (recipe.profitAtCurrent ?? 0) <= 0 ? 'text-destructive' : 'text-success'
                )}
              >
                {formatMVR(recipe.profitAtCurrent ?? 0)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({(recipe.marginAtCurrent ?? 0).toFixed(0)}%)
                </span>
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            No product linked yet — add one on the recipe page to track a selling price.
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested prices (per unit)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {recipe.ladder.map((rung) => (
              <div
                key={rung.marginPct}
                className={cn(
                  'rounded-xl border p-3 text-center',
                  rung.recommended ? 'border-primary/50 bg-primary/5' : 'border-border'
                )}
              >
                <p className="text-[11px] font-medium text-muted-foreground">
                  {rung.recommended ? 'Recommended · ' : ''}
                  {rung.marginPct}% margin
                </p>
                <p className="mt-0.5 font-display text-xl font-bold">{rung.shelf}</p>
                <p className="text-[11px] text-muted-foreground">
                  keeps {formatMVR(rung.profit)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {recipe.shortfallPerUnit !== null && recipe.shortfallPerUnit > 0 && (
          <p className="rounded-xl bg-warning/10 p-3 text-xs text-warning">
            At the current price you keep {formatMVR(recipe.shortfallPerUnit)} less per unit than the
            30% shelf price suggests.
          </p>
        )}
      </CardContent>
    </Card>
  );
}