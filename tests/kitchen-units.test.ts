import { describe, expect, it } from 'vitest';
import {
  KITCHEN_UNITS,
  convertKitchenUnits,
  volumeToWeight,
  weightToVolume,
  INGREDIENT_DENSITIES,
  fahrenheitToCelsius,
  celsiusToFahrenheit,
  inchesToCm,
  cmToInches,
  OVEN_SETTINGS,
} from '@/lib/costing';

describe('convertKitchenUnits', () => {
  it('converts within mass with precise avoirdupois factors', () => {
    expect(convertKitchenUnits(1, 'kg', 'g')).toBe(1000);
    expect(convertKitchenUnits(1, 'lb', 'g')).toBeCloseTo(453.6);
    expect(convertKitchenUnits(2, 'oz', 'g')).toBeCloseTo(56.7);
    expect(convertKitchenUnits(500, 'g', 'kg')).toBe(0.5);
  });

  it('converts within volume, including bakers measures', () => {
    expect(convertKitchenUnits(1, 'cup', 'ml')).toBe(240);
    expect(convertKitchenUnits(2, 'tbsp', 'ml')).toBe(30);
    expect(convertKitchenUnits(1, 'tsp', 'ml')).toBe(5);
    expect(convertKitchenUnits(0.5, 'l', 'ml')).toBe(500);
    expect(convertKitchenUnits(240, 'ml', 'cup')).toBe(1);
  });

  it('converts the larger volume units from the reference table', () => {
    expect(convertKitchenUnits(1, 'fl_oz', 'ml')).toBe(30);
    expect(convertKitchenUnits(1, 'jigger', 'ml')).toBe(45);
    expect(convertKitchenUnits(1, 'gill', 'ml')).toBe(120);
    expect(convertKitchenUnits(1, 'pint', 'cup')).toBe(2);
    expect(convertKitchenUnits(1, 'quart', 'pint')).toBe(2);
    expect(convertKitchenUnits(1, 'gallon', 'quart')).toBe(4);
    expect(convertKitchenUnits(1, 'pint', 'ml')).toBe(480);
    expect(convertKitchenUnits(1, 'quart', 'ml')).toBe(960);
    expect(convertKitchenUnits(1, 'gallon', 'ml')).toBe(3840);
  });

  it('converts tiny measures', () => {
    expect(convertKitchenUnits(1, 'pinch', 'tsp')).toBe(0.125);
    expect(convertKitchenUnits(1, 'pinch', 'ml')).toBe(0.625);
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

describe('temperature', () => {
  it('converts F to C and back', () => {
    expect(fahrenheitToCelsius(350)).toBeCloseTo(176.67, 1);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100);
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(celsiusToFahrenheit(180)).toBeCloseTo(356);
    expect(celsiusToFahrenheit(100)).toBe(212);
    // round-trip
    expect(celsiusToFahrenheit(fahrenheitToCelsius(350))).toBeCloseTo(350);
  });

  it('exposes the standard oven settings', () => {
    const moderate = OVEN_SETTINGS.find((o) => o.label === 'Moderate');
    expect(moderate?.f).toBe(350);
    expect(moderate?.c).toBe(175);
    expect(moderate?.gas).toBe('4');
    expect(OVEN_SETTINGS.length).toBeGreaterThanOrEqual(7);
  });
});

describe('length', () => {
  it('converts inch and cm', () => {
    expect(inchesToCm(1)).toBe(2.54);
    expect(cmToInches(2.54)).toBe(1);
    expect(inchesToCm(10)).toBeCloseTo(25.4);
  });
});

describe('ingredient density (weight ↔ volume)', () => {
  it('uses grams-per-cup from the reference table', () => {
    expect(volumeToWeight(240, 'granulated_sugar')).toBe(200);
    expect(volumeToWeight(240, 'all_purpose_flour')).toBe(125);
    expect(volumeToWeight(240, 'butter')).toBe(227);
    // 1 cup flour → grams
    expect(volumeToWeight(236.6, 'all_purpose_flour')).toBeCloseTo(123.2, 0);
  });

  it('converts back volume from weight', () => {
    expect(weightToVolume(200, 'granulated_sugar')).toBe(240);
    expect(weightToVolume(100, 'all_purpose_flour')).toBeCloseTo(192, 0);
  });

  it('converts kitchen units before applying density (tbsp honey → grams)', () => {
    const ml = convertKitchenUnits(2, 'tbsp', 'ml');
    expect(ml).toBe(30);
    expect(volumeToWeight(ml!, 'honey')).toBeCloseTo(40, 0);
  });

  it('returns null for unknown ingredients and covers the common set', () => {
    expect(volumeToWeight(240, 'moon_dust')).toBeNull();
    const codes = INGREDIENT_DENSITIES.map((d) => d.code);
    for (const code of ['water', 'all_purpose_flour', 'granulated_sugar', 'brown_sugar', 'butter', 'honey', 'cocoa_powder', 'rolled_oats']) {
      expect(codes).toContain(code);
    }
  });
});

describe('KITCHEN_UNITS', () => {
  it('covers the practical bakers set', () => {
    const units = KITCHEN_UNITS.map((u) => u.unit);
    for (const u of ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'cl', 'dl', 'tsp', 'tbsp', 'cup', 'fl_oz', 'pint', 'quart', 'gallon', 'jigger', 'gill', 'pinch', 'dash', 'pcs', 'cm', 'in']) {
      expect(units).toContain(u);
    }
  });
});
