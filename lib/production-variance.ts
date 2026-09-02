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