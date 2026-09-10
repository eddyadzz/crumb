import { describe, expect, it } from 'vitest';
import {
  computeOrderProfit,
  orderProfitBand,
  summarizeShortages,
} from '@/lib/order-profit';
import { formatBaseQuantity } from '@/lib/costing';

describe('orderProfitBand', () => {
  it('bands at 40% and 20% of selling price', () => {
    expect(orderProfitBand(60)).toBe('healthy');
    expect(orderProfitBand(40)).toBe('healthy');
    expect(orderProfitBand(39.9)).toBe('low');
    expect(orderProfitBand(20)).toBe('low');
    expect(orderProfitBand(19.9)).toBe('very_low');
  });
});

describe('computeOrderProfit', () => {
  const lines = [
    { productName: 'Chocolate Cake', quantity: 1, unitPrice: 350, costPerUnit: 140 },
    { productName: 'Cupcakes', quantity: 12, unitPrice: 10, costPerUnit: 5.8333 },
  ];

  it('totals selling, cost, and profit per line and overall', () => {
    const p = computeOrderProfit(lines);
    expect(p.selling).toBeCloseTo(470);
    expect(p.cost).toBeCloseTo(140 + 70);
    expect(p.profit).toBeCloseTo(260);
    expect(p.lines[0]).toMatchObject({ selling: 350, cost: 140, profit: 210 });
  });

  it('margin measured on selling price', () => {
    const p = computeOrderProfit(lines);
    // 260 / 470 ≈ 55.3% — healthy
    expect(p.band).toBe('healthy');
    const risky = computeOrderProfit([
      { productName: 'Bread', quantity: 10, unitPrice: 50, costPerUnit: 45 },
    ]);
    // margin = 10%
    expect(risky.band).toBe('very_low');
    expect(risky.profit).toBeCloseTo(50);
  });

  it('flags unknown when nothing can cost the order', () => {
    const p = computeOrderProfit([
      { productName: 'Mystery Cake', quantity: 1, unitPrice: 200, costPerUnit: 0 },
    ]);
    expect(p.band).toBe('unknown');
  });
});

describe('summarizeShortages', () => {
  it('summarizes need/have and purchase cost', () => {
    const rows = [
      { ingredientId: 'flour', name: 'Flour', baseUnit: 'g', requiredBase: 2100, availableBase: 1400, shortageBase: 700, estimatedCost: 60, enough: false },
      { ingredientId: 'butter', name: 'Butter', baseUnit: 'g', requiredBase: 500, availableBase: 220, shortageBase: 280, estimatedCost: 25, enough: false },
      { ingredientId: 'sugar', name: 'Sugar', baseUnit: 'g', requiredBase: 500, availableBase: 900, shortageBase: 0, estimatedCost: 0, enough: true },
    ];
    const s = summarizeShortages(rows, formatBaseQuantity);
    expect(s.count).toBe(2);
    expect(s.estimatedCost).toBeCloseTo(85);
    expect(s.items[0]).toEqual({ name: 'Flour', need: '2.10 kg', have: '1.40 kg', estimatedCost: 60 });
  });

  it('is empty when everything is covered', () => {
    const s = summarizeShortages([], formatBaseQuantity);
    expect(s.count).toBe(0);
    expect(s.estimatedCost).toBe(0);
  });
});
