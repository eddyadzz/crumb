import { describe, expect, it } from 'vitest';
import {
  computeVariance,
  totalVariance,
  describeVariance,
  computeCostedVariance,
  batchCostSummary,
  batchesToLines,
  aggregateRecipeVariance,
  computeMarginImpact,
  buildVarianceTrend,
  buildWasteTrend,
  worstRecipes,
  efficiencyScore,
  efficiencyBand,
  annualizeWasteLoss,
} from '@/lib/production-variance';

describe('production-variance', () => {
  it('records on-target rows when actual equals planned', () => {
    const rows = computeVariance([
      { ingredientName: 'Flour', plannedBase: 500, actualBase: 500 },
    ]);
    expect(rows[0].diffBase).toBe(0);
    expect(rows[0].variancePct).toBe(0);
  });

  it('computes +% overage', () => {
    const rows = computeVariance([
      { ingredientName: 'Flour', plannedBase: 500, actualBase: 550 },
    ]);
    expect(rows[0].diffBase).toBe(50);
    expect(rows[0].variancePct).toBeCloseTo(10);
  });

  it('computes -% underuse', () => {
    const rows = computeVariance([
      { ingredientName: 'Sugar', plannedBase: 200, actualBase: 180 },
    ]);
    expect(rows[0].diffBase).toBe(-20);
    expect(rows[0].variancePct).toBeCloseTo(-10);
  });

  it('handles zero planned gracefully (no divide by zero)', () => {
    const rows = computeVariance([
      { ingredientName: 'Water', plannedBase: 0, actualBase: 10 },
    ]);
    expect(rows[0].variancePct).toBe(0);
  });

  it('totals variance across multiple ingredients', () => {
    const rows = computeVariance([
      { ingredientName: 'Flour', plannedBase: 500, actualBase: 550 },
      { ingredientName: 'Sugar', plannedBase: 200, actualBase: 180 },
      { ingredientName: 'Butter', plannedBase: 300, actualBase: 300 },
    ]);
    const totals = totalVariance(rows);
    expect(totals.plannedTotal).toBe(1000);
    expect(totals.actualTotal).toBe(1030);
    expect(totals.diffTotal).toBe(30);
    expect(totals.variancePct).toBeCloseTo(3);
  });

  it('handles empty rows for totals', () => {
    const totals = totalVariance([]);
    expect(totals.plannedTotal).toBe(0);
    expect(totals.actualTotal).toBe(0);
    expect(totals.variancePct).toBe(0);
  });

  it('describeVariance gives human copy', () => {
    expect(describeVariance(0, 'kg')).toBe('On target');
    expect(describeVariance(0.5, 'kg')).toBe('0.5kg over planned');
    expect(describeVariance(-0.25, 'kg')).toBe('0.3kg under planned');
  });
});

describe('cost variance', () => {
  it('costs each row at the ingredient cost per base', () => {
    const rows = computeCostedVariance([
      { ingredientName: 'Butter', plannedBase: 100, actualBase: 120, costPerBase: 0.1 },
    ]);
    expect(rows[0].plannedCost).toBeCloseTo(10);
    expect(rows[0].actualCost).toBeCloseTo(12);
    expect(rows[0].costVariance).toBeCloseTo(2);
    expect(rows[0].variancePct).toBeCloseTo(20);
  });

  it('summarises planned vs actual cost for a batch', () => {
    const rows = computeCostedVariance([
      { ingredientName: 'Butter', plannedBase: 100, actualBase: 120, costPerBase: 0.1 },
      { ingredientName: 'Sugar', plannedBase: 200, actualBase: 190, costPerBase: 0.05 },
    ]);
    const s = batchCostSummary(rows);
    expect(s.plannedCost).toBeCloseTo(20);
    expect(s.actualCost).toBeCloseTo(21.5);
    expect(s.costVariance).toBeCloseTo(1.5);
    expect(s.varianceCostPct).toBeCloseTo(7.5);
  });

  it('builds per-batch lines from multiple batches', () => {
    const line = (recipeName: string, plannedCost: number, actualCost: number) => ({
      orderId: 'o1',
      orderLabel: '#ABC123',
      recipeName,
      batchCount: 1,
      rows: computeCostedVariance([
        { ingredientName: 'Flour', plannedBase: plannedCost, actualBase: actualCost, costPerBase: 1 },
      ]),
    });
    const lines = batchesToLines([line('Cheese Cake', 40, 48), line('Brownie', 10, 9)]);
    expect(lines).toHaveLength(2);
    expect(lines[0].costVariance).toBeCloseTo(8);
    expect(lines[0].varianceCostPct).toBeCloseTo(20);
  });

  it('aggregates identical recipe batches', () => {
    const mk = (actualCost: number) => ({
      orderId: 'o',
      orderLabel: '#X',
      recipeName: 'Cheese Cake',
      batchCount: 1,
      rows: computeCostedVariance([
        { ingredientName: 'Flour', plannedBase: 40, actualBase: actualCost, costPerBase: 1 },
      ]),
    });
    const agg = aggregateRecipeVariance(batchesToLines([mk(44), mk(48)]));
    expect(agg[0].batchCount).toBe(2);
    expect(agg[0].plannedCost).toBeCloseTo(80);
    expect(agg[0].actualCost).toBeCloseTo(92);
    expect(agg[0].costVariance).toBeCloseTo(12);
    expect(agg[0].varianceCostPct).toBeCloseTo(15);
  });

  it('computes margin impact', () => {
    const mi = computeMarginImpact(100, 40, 48.5);
    expect(mi.expectedProfit).toBeCloseTo(60);
    expect(mi.actualProfit).toBeCloseTo(51.5);
    expect(mi.impact).toBeCloseTo(-8.5);
  });
});

describe('variance trends', () => {
  const now = new Date(2026, 8, 4); // Sep 4 2026, local

  it('zero-fills the window and buckets batches by day', () => {
    const trend = buildVarianceTrend(
      [
        { createdAt: new Date(2026, 8, 3), plannedCost: 40, actualCost: 48, revenue: 100 },
        { createdAt: new Date(2026, 8, 3), plannedCost: 10, actualCost: 9, revenue: 30 },
        { createdAt: new Date(2026, 7, 1), plannedCost: 999, actualCost: 999, revenue: 0 }, // outside window
      ],
      5,
      now
    );
    expect(trend).toHaveLength(5);
    expect(trend[0].day).toBe('Aug 31');
    expect(trend[4].day).toBe('Sep 4');
    const sep3 = trend[3];
    expect(sep3.plannedCost).toBeCloseTo(50);
    expect(sep3.actualCost).toBeCloseTo(57);
    expect(sep3.costVariance).toBeCloseTo(7);
    expect(sep3.marginImpact).toBeCloseTo(-7);
    expect(trend[0].costVariance).toBe(0);
  });

  it('accepts ISO strings for createdAt', () => {
    const trend = buildVarianceTrend(
      [{ createdAt: '2026-09-04T10:00:00.000Z', plannedCost: 10, actualCost: 12, revenue: 40 }],
      1,
      now
    );
    // Local day bucketing — the ISO instant is Sep 4 in +05:00 (Maldives).
    const total = trend.reduce((s, p) => s + p.costVariance, 0);
    expect(total).toBeCloseTo(2);
  });

  it('builds waste trend with % per day', () => {
    const trend = buildWasteTrend(
      [
        { createdAt: new Date(2026, 8, 3), type: 'PRODUCED', quantity: 20 },
        { createdAt: new Date(2026, 8, 3), type: 'SPOILED', quantity: 3 },
        { createdAt: new Date(2026, 8, 3), type: 'GIFTED', quantity: 1 },
        { createdAt: new Date(2026, 8, 3), type: 'SOLD', quantity: 12 },
        { createdAt: new Date(2026, 8, 4), type: 'PRODUCED', quantity: 0 },
      ],
      2,
      now
    );
    expect(trend[0].produced).toBe(20);
    expect(trend[0].wasted).toBe(4);
    expect(trend[0].wastePct).toBeCloseTo(20);
    expect(trend[1].wastePct).toBe(0);
  });

  it('ranks worst recipes first and caps at limit', () => {
    const ranked = worstRecipes(
      [
        { recipeId: 'a', recipeName: 'Croissant', batches: 3, costVariance: 84, plannedCost: 1000, varianceCostPct: 8.4 },
        { recipeId: 'b', recipeName: 'Donut', batches: 2, costVariance: 96, plannedCost: 2000, varianceCostPct: 4.8 },
        { recipeId: 'c', recipeName: 'Chocolate Cake', batches: 4, costVariance: 122, plannedCost: 2000, varianceCostPct: 6.1 },
        { recipeId: 'd', recipeName: 'Bread', batches: 0, costVariance: 999, plannedCost: 0, varianceCostPct: 999 },
      ],
      2
    );
    expect(ranked.map((r) => r.recipeName)).toEqual(['Croissant', 'Chocolate Cake']);
  });
});

describe('production efficiency', () => {
  it('scores 100 minus waste minus overrun', () => {
    expect(efficiencyScore(3.2, 1.8)).toBeCloseTo(95.0);
    expect(efficiencyScore(0, 0)).toBe(100);
  });

  it('clamps the score to 0..100', () => {
    expect(efficiencyScore(120, 0)).toBe(0);
    expect(efficiencyScore(0, 150)).toBe(0);
    expect(efficiencyScore(-5, -10)).toBe(100);
  });

  it('bands scores at 95/90/80', () => {
    expect(efficiencyBand(95)).toBe('Excellent');
    expect(efficiencyBand(94.9)).toBe('Good');
    expect(efficiencyBand(90)).toBe('Good');
    expect(efficiencyBand(89.9)).toBe('Fair');
    expect(efficiencyBand(80)).toBe('Fair');
    expect(efficiencyBand(79.9)).toBe('Needs Attention');
    expect(efficiencyBand(0)).toBe('Needs Attention');
  });

  it('annualizes a 30-day waste cost by 12 months', () => {
    expect(annualizeWasteLoss(7200, 30)).toBeCloseTo(86400);
    expect(annualizeWasteLoss(600, 15)).toBeCloseTo(14400);
    expect(annualizeWasteLoss(500, 0)).toBe(0);
  });
});