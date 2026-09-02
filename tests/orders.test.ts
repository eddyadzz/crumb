import { describe, expect, it } from 'vitest';
import {
  canTransition,
  orderTotal,
  planFromOrderLines,
  type OrderLineToPlan,
} from '@/lib/orders';
import { shortage, rollupRecipeRequirements, blockForShortage } from '@/lib/stock';
import type { OrderStatus } from '@prisma/client';

describe('orderTotal', () => {
  it('sums quantity * unitPrice across lines', () => {
    expect(
      orderTotal([
        { quantity: 2, unitPrice: 120 },
        { quantity: 1, unitPrice: 300 },
      ])
    ).toBe(540);
  });

  it('returns 0 for an empty set of lines', () => {
    expect(orderTotal([])).toBe(0);
  });
});

describe('canTransition', () => {
  const forward: Array<[OrderStatus, OrderStatus]> = [
    ['PENDING', 'CONFIRMED'],
    ['CONFIRMED', 'IN_PRODUCTION'],
    ['IN_PRODUCTION', 'READY'],
    ['READY', 'DELIVERED'],
  ];
  it.each(forward)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  const back: Array<[OrderStatus, OrderStatus]> = [
    ['CONFIRMED', 'PENDING'],
    ['DELIVERED', 'READY'],
    ['IN_PRODUCTION', 'CONFIRMED'],
  ];
  it.each(back)('rejects backwards move %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('allows cancellation from active states', () => {
    expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PRODUCTION', 'CANCELLED')).toBe(true);
  });

  it('treats DELIVERED and CANCELLED as terminal', () => {
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'DELIVERED')).toBe(false);
  });
});

describe('planFromOrderLines', () => {
  const line = (over: Partial<OrderLineToPlan> = {}): OrderLineToPlan => ({
    productId: 'prodA',
    quantity: 1,
    recipeId: 'recA',
    recipeName: 'Sourdough Loaf',
    servingsProduced: 1,
    productType: 'PORTION',
    ...over,
  });

  it('PORTION product -> batches equal quantity', () => {
    const { recipeItems } = planFromOrderLines([line({ quantity: 4 })]);
    expect(recipeItems).toEqual([
      { recipeId: 'recA', recipeName: 'Sourdough Loaf', batchCount: 4 },
    ]);
  });

  it('WHOLE product -> ceil(quantity / servingsProduced) batches', () => {
    const { recipeItems } = planFromOrderLines([
      line({ productType: 'WHOLE', servingsProduced: 6, quantity: 12 }),
    ]);
    expect(recipeItems[0].batchCount).toBe(2);
  });

  it('rounds up a partial WHOLE batch', () => {
    const { recipeItems } = planFromOrderLines([
      line({ productType: 'WHOLE', servingsProduced: 6, quantity: 7 }),
    ]);
    expect(recipeItems[0].batchCount).toBe(2);
  });

  it('groups multiple lines for the same recipe by summing batches', () => {
    const { recipeItems } = planFromOrderLines([
      line({ quantity: 2 }),
      line({ quantity: 3 }),
    ]);
    expect(recipeItems).toHaveLength(1);
    expect(recipeItems[0].batchCount).toBe(5);
  });

  it('ignores non-positive quantities', () => {
    const { recipeItems } = planFromOrderLines([line({ quantity: 0 })]);
    expect(recipeItems).toHaveLength(0);
  });
});

describe('stock shortage + policy', () => {
  it('shortage is zero when stock is sufficient', () => {
    expect(shortage({ requiredBase: 50, availableBase: 100 })).toBe(0);
  });

  it('shortage is the deficit when stock is insufficient', () => {
    expect(shortage({ requiredBase: 100, availableBase: 40 })).toBe(60);
  });

  it('rolls up required base quantities across recipes and batches', () => {
    const reqs = rollupRecipeRequirements(
      [
        {
          id: 'recA',
          name: 'Bread',
          ingredients: [
            {
              ingredientId: 'flour',
              name: 'Flour',
              unit: 'kg',
              requiredPerBatch: 1,
              availableQuantity: 5000,
              baseUnit: 'g',
            },
          ],
        },
        {
          id: 'recB',
          name: 'Cake',
          ingredients: [
            {
              ingredientId: 'flour',
              name: 'Flour',
              unit: 'kg',
              requiredPerBatch: 2,
              availableQuantity: 5000,
              baseUnit: 'g',
            },
          ],
        },
      ],
      [
        { recipeId: 'recA', batchCount: 1 },
        { recipeId: 'recB', batchCount: 1 },
      ]
    );
    expect(reqs).toHaveLength(1);
    expect(reqs[0].requiredBase).toBe(3000);
    expect(reqs[0].availableBase).toBe(5000);
  });

  it('WARN policy never blocks even when short', () => {
    const result = blockForShortage('WARN', [{ requiredBase: 10, availableBase: 2 }]);
    expect(result.blocked).toBe(false);
    expect(result.shortages).toBe(1);
  });

  it('BLOCK policy blocks when any ingredient is short', () => {
    const result = blockForShortage('BLOCK', [
      { requiredBase: 10, availableBase: 20 },
      { requiredBase: 5, availableBase: 1 },
    ]);
    expect(result.blocked).toBe(true);
    expect(result.shortages).toBe(1);
  });

  it('BLOCK policy allows when fully stocked', () => {
    const result = blockForShortage('BLOCK', [{ requiredBase: 10, availableBase: 20 }]);
    expect(result.blocked).toBe(false);
    expect(result.shortages).toBe(0);
  });
});