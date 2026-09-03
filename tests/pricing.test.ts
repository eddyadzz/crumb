import { describe, expect, it } from 'vitest';
import {
  priceForMargin,
  shelfPrice,
  marginOf,
  profitOf,
  actualCostFactor,
  suggestPriceLadder,
  pricingVerdict,
  pricingSummary,
} from '@/lib/pricing';

describe('pricing math', () => {
  it('inverts margin-on-price: cost 185 at 30% margin needs ~264', () => {
    expect(priceForMargin(185, 30)).toBeCloseTo(264.2857, 3);
    expect(priceForMargin(185, 50)).toBeCloseTo(370, 6);
    // profit is margin% of the price, not of the cost
    const price = priceForMargin(100, 40);
    expect(((price - 100) / price) * 100).toBeCloseTo(40);
  });

  it('guards degenerate inputs', () => {
    expect(priceForMargin(0, 30)).toBe(0);
    expect(priceForMargin(-5, 30)).toBe(0);
    expect(priceForMargin(100, 100)).toBeCloseTo(10000); // margin clamped to 99
    expect(priceForMargin(100, 120)).toBeCloseTo(10000);
    expect(priceForMargin(100, -10)).toBeCloseTo(100); // clamped to 0% margin
  });

  it('rounds up to practical shelf prices', () => {
    expect(shelfPrice(264.2857)).toBe(265);
    expect(shelfPrice(370)).toBe(370);
    expect(shelfPrice(371)).toBe(375);
    expect(shelfPrice(0)).toBe(0);
  });

  it('computes margin and profit on price', () => {
    expect(marginOf(250, 185)).toBeCloseTo(26);
    expect(marginOf(0, 50)).toBe(0);
    expect(marginOf(100, 120)).toBeCloseTo(-20); // selling below cost
    expect(profitOf(250, 185)).toBeCloseTo(65);
  });

  it('scales planned cost into actual cost via usage variance', () => {
    expect(actualCostFactor(null)).toBe(1);
    expect(actualCostFactor(0)).toBe(1);
    expect(actualCostFactor(12.8)).toBeCloseTo(1.128);
    expect(actualCostFactor(-10)).toBeCloseTo(0.9);
  });

  it('builds a three-rung ladder with profits on shelf prices', () => {
    const ladder = suggestPriceLadder(185);
    expect(ladder.map((r) => r.marginPct)).toEqual([30, 40, 50]);
    expect(ladder[0].shelf).toBe(265);
    expect(ladder[1].shelf).toBe(310); // 185/0.6 = 308.33 → 310
    expect(ladder[2].shelf).toBe(370);
    expect(ladder.every((r) => r.profit === r.shelf - 185)).toBe(true);
    expect(ladder.find((r) => r.recommended)?.marginPct).toBe(40);
  });

  it('verdicts: unpriced, below target, on target', () => {
    expect(pricingVerdict(null, 185)).toBe('unpriced');
    expect(pricingVerdict(250, 185)).toBe('below-target'); // 26% < 30%
    expect(pricingVerdict(265, 185)).toBe('on-target'); // 30.2%
    expect(pricingVerdict(250, 0)).toBe('no-cost');
  });

  it('pricingSummary combines planned cost, usage variance and current price', () => {
    const s = pricingSummary({ plannedCost: 100, varianceCostPct: 20, currentPrice: 150 });
    expect(s.actualCost).toBeCloseTo(120);
    expect(s.hasUsageData).toBe(true);
    expect(s.profitAtCurrent).toBeCloseTo(30);
    expect(s.marginAtCurrent).toBeCloseTo(20);
    expect(s.verdict).toBe('below-target');
    expect(s.ladder[0].shelf).toBe(175); // 120/0.7 = 171.4 → 175
  });

  it('pricingSummary without usage data falls back to planned cost', () => {
    const s = pricingSummary({ plannedCost: 100, varianceCostPct: null, currentPrice: null });
    expect(s.actualCost).toBe(100);
    expect(s.hasUsageData).toBe(false);
    expect(s.verdict).toBe('unpriced');
  });
});