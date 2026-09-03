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