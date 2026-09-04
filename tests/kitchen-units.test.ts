import { describe, expect, it } from 'vitest';
import { KITCHEN_UNITS, convertKitchenUnits } from '@/lib/costing';

describe('convertKitchenUnits', () => {
  it('converts within mass', () => {
    expect(convertKitchenUnits(1, 'kg', 'g')).toBe(1000);
    expect(convertKitchenUnits(1, 'lb', 'g')).toBe(454);
    expect(convertKitchenUnits(2, 'oz', 'g')).toBe(56);
    expect(convertKitchenUnits(500, 'g', 'kg')).toBe(0.5);
  });

  it('converts within volume, including bakers measures', () => {
    expect(convertKitchenUnits(1, 'cup', 'ml')).toBe(240);
    expect(convertKitchenUnits(2, 'tbsp', 'ml')).toBe(30);
    expect(convertKitchenUnits(1, 'tsp', 'ml')).toBe(5);
    expect(convertKitchenUnits(0.5, 'l', 'ml')).toBe(500);
    expect(convertKitchenUnits(240, 'ml', 'cup')).toBe(1);
  });

  it('keeps count identity', () => {
    expect(convertKitchenUnits(3, 'pcs', 'pcs')).toBe(3);
  });

  it('returns null across dimensions (no universal density)', () => {
    expect(convertKitchenUnits(1, 'g', 'ml')).toBeNull();
    expect(convertKitchenUnits(1, 'cup', 'g')).toBeNull();
    expect(convertKitchenUnits(2, 'eggs', 'pcs')).toBeNull();
  });
});

describe('KITCHEN_UNITS', () => {
  it('covers the practical bakers set', () => {
    const units = KITCHEN_UNITS.map((u) => u.unit);
    for (const u of ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pcs']) {
      expect(units).toContain(u);
    }
  });
});
