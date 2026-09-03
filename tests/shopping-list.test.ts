import { describe, expect, it } from 'vitest';
import {
  buildShoppingList,
  shoppingListTotal,
  shoppingListKey,
  type PurchasePack,
} from '@/lib/shopping-list';
import type { ForecastRow } from '@/lib/forecast';

const row = (over: Partial<ForecastRow>): ForecastRow => ({
  ingredientId: 'flour',
  name: 'Flour',
  baseUnit: 'g',
  requiredBase: 5000,
  availableBase: 1000,
  shortageBase: 4000,
  estimatedCost: 200,
  enough: false,
  ...over,
});

describe('shopping list', () => {
  it('keeps only items with something to buy', () => {
    const items = buildShoppingList(
      [
        row({}),
        row({ ingredientId: 'sugar', name: 'Sugar', shortageBase: 0, enough: true, estimatedCost: 0 }),
      ],
      {}
    );
    expect(items).toHaveLength(1);
    expect(items[0].toBuyBase).toBe(4000);
    expect(items[0].packs).toBeNull();
  });

  it('suggests whole packs, rounded up, when purchase unit matches base unit', () => {
    const packs: Record<string, PurchasePack> = {
      flour: { purchaseQuantity: 1000, purchaseUnit: 'g' }, // 1kg bags
      eggs: { purchaseQuantity: 30, purchaseUnit: 'pcs' },
    };
    const items = buildShoppingList(
      [
        row({}),
        row({ ingredientId: 'eggs', name: 'Eggs', baseUnit: 'pcs', shortageBase: 35, estimatedCost: 70 }),
        row({
          ingredientId: 'milk',
          name: 'Milk',
          baseUnit: 'ml',
          shortageBase: 500,
          estimatedCost: 40,
        }),
      ],
      { ...packs, milk: { purchaseQuantity: 1, purchaseUnit: 'l' } } // unit mismatch → no packs
    );
    expect(items.find((i) => i.ingredientId === 'flour')?.packs).toBe(4); // 4000g / 1kg
    expect(items.find((i) => i.ingredientId === 'eggs')?.packs).toBe(2); // 35 / 30
    expect(items.find((i) => i.ingredientId === 'milk')?.packs).toBeNull();
  });

  it('totals cost and counts', () => {
    const rows = [
      row({}),
      row({ ingredientId: 'butter', name: 'Butter', shortageBase: 250, estimatedCost: 150 }),
      row({ ingredientId: 'salt', name: 'Salt', shortageBase: 0, enough: true, estimatedCost: 0 }),
    ];
    const t = shoppingListTotal(rows);
    expect(t.items).toBe(2);
    expect(t.totalCost).toBe(350);
    expect(t.enoughCount).toBe(1);
  });

  it('builds a stable list key that changes with quantities', () => {
    const a = buildShoppingList([row({})], {});
    const b = buildShoppingList([row({ shortageBase: 4500, estimatedCost: 225 })], {});
    expect(shoppingListKey(a)).toBe(shoppingListKey(a));
    expect(shoppingListKey(a)).not.toBe(shoppingListKey(b));
  });
});