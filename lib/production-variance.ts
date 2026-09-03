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