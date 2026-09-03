/**
 * Pure production-floor math: batch requirements, actuals, and planned-vs-actual
 * variance. No server/DB/React imports so it is unit-testable and shared by the
 * complete-batch sheet, print views, and the cost-variance report (Phase I-B).
 */

export interface VarianceRowInput {
  ingredientName: string;
  plannedBase: number; // planned usage in base unit
  actualBase: number; // actual usage in base unit
}

export interface VarianceRow {
  ingredientName: string;
  plannedBase: number;
  actualBase: number;
  diffBase: number;
  /** Signed %: (actual - planned) / planned. 0 when planned is 0. */
  variancePct: number;
}

/** Compute planned-vs-actual variance rows for a set of ingredients. */
export function computeVariance(rows: VarianceRowInput[]): VarianceRow[] {
  return rows.map((r) => {
    const diffBase = r.actualBase - r.plannedBase;
    const variancePct =
      r.plannedBase === 0 ? 0 : (diffBase / r.plannedBase) * 100;
    return {
      ingredientName: r.ingredientName,
      plannedBase: r.plannedBase,
      actualBase: r.actualBase,
      diffBase,
      variancePct,
    };
  });
}

export interface Totals {
  plannedTotal: number;
  actualTotal: number;
  diffTotal: number;
  /** Signed % over the whole batch; 0 when planned total is 0. */
  variancePct: number;
}

/** Aggregate variance across all ingredients of a production item/batch. */
export function totalVariance(rows: VarianceRow[]): Totals {
  const plannedTotal = rows.reduce((s, r) => s + r.plannedBase, 0);
  const actualTotal = rows.reduce((s, r) => s + r.actualBase, 0);
  const diffTotal = actualTotal - plannedTotal;
  return {
    plannedTotal,
    actualTotal,
    diffTotal,
    variancePct: plannedTotal === 0 ? 0 : (diffTotal / plannedTotal) * 100,
  };
}

/**
 * A "degree" for a single plan/actual delta, e.g. "0.9 kg over planned". The
 * unit label is passed through; printing is up to the caller.
 */
export function describeVariance(diffBase: number, unit: string): string {
  if (Math.abs(diffBase) < 1e-9) return 'On target';
  const dir = diffBase > 0 ? 'over' : 'under';
  return `${Math.abs(diffBase).toFixed(1)}${unit} ${dir} planned`;
}

/* ================= COST VARIANCE (Phase I-B) ================= */

export interface CostedRowInput {
  ingredientName: string;
  plannedBase: number;
  actualBase: number;
  /**
   * MVR per base unit of the ingredient. Snapshot quantity is costed at the
   * ingredient's then-current purchase cost — the best single price available.
   */
  costPerBase: number;
}

export interface CostedRow {
  ingredientName: string;
  plannedBase: number;
  actualBase: number;
  diffBase: number;
  variancePct: number;
  costPerBase: number;
  /** MVR cost of the planned amount. */
  plannedCost: number;
  /** MVR cost of the actual amount. */
  actualCost: number;
  /** MVR over/under: actualCost - plannedCost (positive = over budget). */
  costVariance: number;
}

/**
 * Cost each variance row. Quantity variance (via computeVariance) plus cost
 * variance in MVR. Pure — unit-testable.
 */
export function computeCostedVariance(rows: CostedRowInput[]): CostedRow[] {
  return rows.map((r) => {
    const plannedCost = r.plannedBase * r.costPerBase;
    const actualCost = r.actualBase * r.costPerBase;
    return {
      ingredientName: r.ingredientName,
      plannedBase: r.plannedBase,
      actualBase: r.actualBase,
      diffBase: r.actualBase - r.plannedBase,
      variancePct: r.plannedBase === 0 ? 0 : ((r.actualBase - r.plannedBase) / r.plannedBase) * 100,
      costPerBase: r.costPerBase,
      plannedCost,
      actualCost,
      costVariance: actualCost - plannedCost,
    };
  });
}

export interface BatchCostSummary {
  plannedCost: number;
  actualCost: number;
  costVariance: number;
  /** Signed %: costVariance / plannedCost; 0 when planned cost is 0. */
  varianceCostPct: number;
}

/** Total planned vs actual cost for a set of costed rows (a batch). */
export function batchCostSummary(rows: CostedRow[]): BatchCostSummary {
  const plannedCost = rows.reduce((s, r) => s + r.plannedCost, 0);
  const actualCost = rows.reduce((s, r) => s + r.actualCost, 0);
  const costVariance = actualCost - plannedCost;
  return {
    plannedCost,
    actualCost,
    costVariance,
    varianceCostPct: plannedCost === 0 ? 0 : (costVariance / plannedCost) * 100,
  };
}

/** One batch's cost line (used for the batch variance report). */
export interface BatchCostLine {
  productionOrderId: string;
  orderLabel: string;
  recipeName: string;
  batchCount: number;
  plannedCost: number;
  actualCost: number;
  costVariance: number;
  varianceCostPct: number;
}

/** Aggregate many strips of costed rows — one per production item/batch — into
 * lines. Pure: the caller supplies the raw rows per batch. */
export function batchesToLines(
  batches: { orderId: string; orderLabel: string; recipeName: string; batchCount: number; rows: CostedRow[] }[]
): BatchCostLine[] {
  return batches.map((b) => {
    const s = batchCostSummary(b.rows);
    return {
      productionOrderId: b.orderId,
      orderLabel: b.orderLabel,
      recipeName: b.recipeName,
      batchCount: b.batchCount,
      ...s,
    };
  });
}

/** Recipe-level aggregation across every batch line. */
export interface RecipeVarianceAggregate {
  recipeName: string;
  batchCount: number;
  plannedCost: number;
  actualCost: number;
  costVariance: number;
  varianceCostPct: number;
}

export function aggregateRecipeVariance(lines: BatchCostLine[]): RecipeVarianceAggregate[] {
  const map = new Map<string, RecipeVarianceAggregate>();
  for (const l of lines) {
    const e = map.get(l.recipeName) ?? {
      recipeName: l.recipeName,
      batchCount: 0,
      plannedCost: 0,
      actualCost: 0,
      costVariance: 0,
      varianceCostPct: 0,
    };
    e.batchCount += 1;
    e.plannedCost += l.plannedCost;
    e.actualCost += l.actualCost;
    e.costVariance += l.costVariance;
    map.set(l.recipeName, e);
  }
  return [...map.values()].map((e) => ({
    ...e,
    varianceCostPct: e.plannedCost === 0 ? 0 : (e.costVariance / e.plannedCost) * 100,
  }));
}

/** Margin impact: how much the realized profit differs from the plan. */
export interface MarginImpact {
  /** Expected profit had the batch run exactly to plan. */
  expectedProfit: number;
  /** Profit after accounting for the actual ingredient cost. */
  actualProfit: number;
  /** actualProfit - expectedProfit (negative = profit disappeared). */
  impact: number;
}

export function computeMarginImpact(revenue: number, plannedCost: number, actualCost: number): MarginImpact {
  const expectedProfit = revenue - plannedCost;
  const actualProfit = revenue - actualCost;
  return { expectedProfit, actualProfit, impact: actualProfit - expectedProfit };
}

/* ================= TREND BUCKETING (Phase I-B Sprint 2) ================= */

export interface TrendBatchInput {
  createdAt: Date | string;
  plannedCost: number;
  actualCost: number;
  /** Estimated selling value of the batch output, for margin impact. */
  revenue: number;
}

export interface VarianceTrendPoint {
  /** Day label, e.g. "Sep 1". */
  day: string;
  plannedCost: number;
  actualCost: number;
  costVariance: number;
  /** Negative = profit lost that day (mirror of cost variance). */
  marginImpact: number;
}

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Zero-filled daily buckets of planned vs actual cost over a rolling window.
 * Batches outside the window are skipped. Pure — `now` is injectable for tests.
 */
export function buildVarianceTrend(
  batches: TrendBatchInput[],
  days: number,
  now: Date = new Date()
): VarianceTrendPoint[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const buckets = new Map<string, VarianceTrendPoint>();
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKeyLocal(d);
    keys.push(key);
    buckets.set(key, {
      day: dayLabel(d),
      plannedCost: 0,
      actualCost: 0,
      costVariance: 0,
      marginImpact: 0,
    });
  }
  for (const b of batches) {
    const e = buckets.get(dayKeyLocal(new Date(b.createdAt)));
    if (!e) continue;
    e.plannedCost += b.plannedCost;
    e.actualCost += b.actualCost;
    e.costVariance += b.actualCost - b.plannedCost;
    e.marginImpact += (b.revenue - b.actualCost) - (b.revenue - b.plannedCost);
  }
  return keys.map((k) => buckets.get(k)!);
}

export interface WasteMovementInput {
  createdAt: Date | string;
  type: string;
  quantity: number;
}

export interface WasteTrendPoint {
  day: string;
  produced: number;
  wasted: number;
  /** wasted / produced * 100; 0 when nothing was produced that day. */
  wastePct: number;
}

const WASTE_TYPES = new Set(['SPOILED', 'GIFTED', 'STAFF', 'SAMPLE']);

/** Daily waste % over a rolling window (produced vs spoiled/gifted/staff/sampled). */
export function buildWasteTrend(
  movements: WasteMovementInput[],
  days: number,
  now: Date = new Date()
): WasteTrendPoint[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const buckets = new Map<string, { day: string; produced: number; wasted: number }>();
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKeyLocal(d);
    keys.push(key);
    buckets.set(key, { day: dayLabel(d), produced: 0, wasted: 0 });
  }
  for (const m of movements) {
    const e = buckets.get(dayKeyLocal(new Date(m.createdAt)));
    if (!e) continue;
    if (m.type === 'PRODUCED') e.produced += m.quantity;
    else if (WASTE_TYPES.has(m.type)) e.wasted += m.quantity;
  }
  return keys.map((k) => {
    const e = buckets.get(k)!;
    return { ...e, wastePct: e.produced > 0 ? (e.wasted / e.produced) * 100 : 0 };
  });
}

/** Rank recipes by cost-variance %, worst first, limited to `limit`. */
export function worstRecipes(
  recipes: { recipeId: string; recipeName: string; batches: number; costVariance: number; plannedCost: number; varianceCostPct: number }[],
  limit = 5
) {
  return [...recipes]
    .filter((r) => r.batches > 0)
    .sort((a, b) => b.varianceCostPct - a.varianceCostPct || b.costVariance - a.costVariance)
    .slice(0, limit);
}

/* ================= PRODUCTION EFFICIENCY (Phase I-B Sprint 3) ================= */

/**
 * Single "health number": 100 - waste% - cost overrun%, clamped to 0..100.
 * Waste and overrun are both percentages of their own base (produced units and
 * planned cost respectively), which keeps the score easy to explain.
 */
export function efficiencyScore(wastePct: number, overrunPct: number): number {
  return Math.max(0, Math.min(100, 100 - wastePct - overrunPct));
}

export type EfficiencyBand = 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';

/** 95+ Excellent, 90-95 Good, 80-90 Fair, <80 Needs Attention. */
export function efficiencyBand(score: number): EfficiencyBand {
  if (score >= 95) return 'Excellent';
  if (score >= 90) return 'Good';
  if (score >= 80) return 'Fair';
  return 'Needs Attention';
}

/** Extrapolate a recent-window waste cost to a year (a 30d window × 12 months). */
export function annualizeWasteLoss(wasteCostInWindow: number, windowDays = 30): number {
  if (windowDays <= 0) return 0;
  return wasteCostInWindow * (360 / windowDays);
}