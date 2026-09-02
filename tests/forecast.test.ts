import { describe, expect, it } from 'vitest';
import {
  aggregateBatches,
  forecastRequirements,
  forecastSummary,
  type ForecastRow,
} from '@/lib/forecast';

const ING = (id: string, name: string, opts: { available?: number; cost?: number; unit?: string } = {}) => ({
  id,
  name,
  availableQuantity: opts.available ?? 1000,
  baseUnit: 'g',
  purchaseQuantity: 1000,
  purchaseUnit: 'g',
  purchaseCost: opts.cost ?? 10,
  ...(opts.unit ? { purchaseUnit: opts.unit } : {}),
});

const line = (over: { productType?: 'WHOLE' | 'PORTION'; quantity?: number; servingsProduced?: number; recipeId?: string; recipeName?: string }) => ({
  quantity: over.quantity ?? 1,
  productType: over.productType ?? 'PORTION',
  servingsProduced: over.servingsProduced ?? 1,
  recipeId: over.recipeId ?? 'r1',
  recipeName: over.recipeName ?? 'Bread',
});

describe('aggregateBatches', () => {
  it('PORTION: batches equal quantity', () => {
    const out = aggregateBatches([line({ productType: 'PORTION', quantity: 4 })]);
    expect(out).toEqual([{ recipeId: 'r1', recipeName: 'Bread', batchCount: 4 }]);
  });

  it('WHOLE: batches = ceil(quantity / servingsProduced)', () => {
    const out = aggregateBatches([line({ productType: 'WHOLE', quantity: 7, servingsProduced: 6 })]);
    expect(out[0].batchCount).toBe(2);
  });

  it('groups the same recipe across order lines by summing batches', () => {
    const out = aggregateBatches([
      line({ recipeId: 'r1', quantity: 2 }),
      line({ recipeId: 'r1', quantity: 3 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].batchCount).toBe(5);
  });

  it('ignores zero/negative quantities', () => {
    expect(aggregateBatches([line({ quantity: 0 })])).toHaveLength(0);
  });
});

describe('forecastRequirements', () => {
  const recipe = (id: string, ingredient: ReturnType<typeof ING>, perBatch: number) => ({
    id,
    ingredients: [{ quantity: perBatch, unit: 'g', ingredient }],
  });
  const flour = ING('f', 'Flour', { available: 3000, cost: 20 });
  const sugar = ING('s', 'Sugar', { available: 500, cost: 30 });

  it('rolls need up and computes shortage + est cost', () => {
    const rows = forecastRequirements(
      [recipe('r1', flour, 1000), recipe('r2', sugar, 200)],
      [
        { recipeId: 'r1', recipeName: 'Bread', batchCount: 2 }, // need 2000g flour
        { recipeId: 'r2', recipeName: 'Dessert', batchCount: 3 }, // need 600g sugar
      ]
    );
    const flourRow = rows.find((r) => r.ingredientId === 'f')!;
    const sugarRow = rows.find((r) => r.ingredientId === 's')!;
    // flour: available 3000 >= 2000 -> no shortage, cost 0
    expect(flourRow.requiredBase).toBe(2000);
    expect(flourRow.availableBase).toBe(3000);
    expect(flourRow.shortageBase).toBe(0);
    expect(flourRow.enough).toBe(true);
    expect(flourRow.estimatedCost).toBe(0);
    // sugar: available 500 < 600 -> shortage 100g @ 0.03/g (30 MVR per 1000g) = 3
    expect(sugarRow.requiredBase).toBe(600);
    expect(sugarRow.shortageBase).toBe(100);
    expect(sugarRow.enough).toBe(false);
    expect(sugarRow.estimatedCost).toBe(3);
  });

  it('sorts shortages first, then by descending shortage', () => {
    const rows = forecastRequirements(
      [
        recipe('r1', ING('big', 'Big', { available: 10 }), 100),
        recipe('r2', ING('small', 'Small', { available: 90 }), 100),
        recipe('r3', ING('ok', 'Ok', { available: 500 }), 100),
      ],
      [
        { recipeId: 'r1', recipeName: 'A', batchCount: 1 },
        { recipeId: 'r2', recipeName: 'B', batchCount: 1 },
        { recipeId: 'r3', recipeName: 'C', batchCount: 1 },
      ]
    );
    // Big short 90, Small short 10, Ok not short -> Big, Small, Ok
    expect(rows.map((r) => r.ingredientId)).toEqual(['big', 'small', 'ok']);
  });
});

describe('forecastSummary', () => {
  it('counts required/short rows and sums est cost', () => {
    const rows = [
      { ingredientId: 'a', shortageBase: 4, estimatedCost: 40, enough: false },
      { ingredientId: 'b', shortageBase: 0, estimatedCost: 0, enough: true },
    ] as unknown as ForecastRow[];
    const summary = forecastSummary(rows, 12);
    expect(summary.orderCount).toBe(12);
    expect(summary.ingredientsRequired).toBe(2);
    expect(summary.ingredientsShort).toBe(1);
    expect(summary.estimatedCost).toBe(40);
  });
});