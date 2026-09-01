import { describe, expect, it } from 'vitest';
import {
  convertToBase,
  formatBaseQuantity,
  formatMVR,
  costPerBaseUnit,
  recipeIngredientCost,
} from '@/lib/costing';

describe('convertToBase', () => {
  it('is the identity for base units', () => {
    expect(convertToBase(500, 'g')).toBe(500);
    expect(convertToBase(250, 'ml')).toBe(250);
    expect(convertToBase(3, 'pcs')).toBe(3);
  });

  it('scales metric magnitudes to their base unit', () => {
    expect(convertToBase(1, 'kg')).toBe(1000);
    expect(convertToBase(0.5, 'kg')).toBe(500);
    expect(convertToBase(2, 'l')).toBe(2000);
  });

  it('falls back to identity for unknown units', () => {
    expect(convertToBase(10, 'cups')).toBe(10);
    expect(convertToBase(10, '')).toBe(10);
  });
});

describe('formatBaseQuantity', () => {
  it('formats grams and millilitres, upgrading large magnitudes', () => {
    expect(formatBaseQuantity(1000, 'g')).toBe('1.00 kg');
    expect(formatBaseQuantity(2500, 'ml')).toBe('2.50 l');
    expect(formatBaseQuantity(500, 'g')).toBe('500 g');
    expect(formatBaseQuantity(750, 'ml')).toBe('750 ml');
  });

  it('uses the raw unit for piece counts', () => {
    expect(formatBaseQuantity(12, 'pcs')).toBe('12 pcs');
  });
});

describe('formatMVR', () => {
  it('renders two decimals with the currency label', () => {
    expect(formatMVR(199)).toBe('199.00 MVR');
    expect(formatMVR(0.5)).toBe('0.50 MVR');
  });
});

describe('costPerBaseUnit', () => {
  it('computes cost per base unit', () => {
    // 500g for 90 MVR -> 0.18 MVR per gram
    expect(costPerBaseUnit({ purchaseQuantity: 500, purchaseUnit: 'g', purchaseCost: 90 })).toBeCloseTo(0.18);
    // 1kg for 100 MVR -> 0.10 MVR per gram
    expect(costPerBaseUnit({ purchaseQuantity: 1, purchaseUnit: 'kg', purchaseCost: 100 })).toBeCloseTo(0.1);
  });

  it('returns 0 for a zero quantity', () => {
    expect(costPerBaseUnit({ purchaseQuantity: 0, purchaseUnit: 'g', purchaseCost: 90 })).toBe(0);
  });
});

describe('recipeIngredientCost', () => {
  it('returns 0 when the ingredient is missing', () => {
    expect(recipeIngredientCost({ quantity: 100, unit: 'g' })).toBe(0);
  });

  it('scales unit cost by the recipe quantity, converting units', () => {
    // ingredient: 500g @ 90 MVR (0.18/g); recipe uses 0.25 kg -> 45 MVR
    const item = {
      quantity: 0.25,
      unit: 'kg',
      ingredient: { purchaseQuantity: 500, purchaseUnit: 'g', purchaseCost: 90 },
    };
    expect(recipeIngredientCost(item)).toBeCloseTo(45);
  });
});