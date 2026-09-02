import { describe, expect, it } from 'vitest';
import {
  computeVariance,
  totalVariance,
  describeVariance,
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