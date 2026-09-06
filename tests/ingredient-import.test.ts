import { describe, expect, it } from 'vitest';
import {
  INGREDIENT_SAMPLE,
  normalizePack,
  parseBulkIngredients,
} from '@/lib/ingredient-import';
import { UNIT_OPTIONS } from '@/lib/costing';

describe('parseBulkIngredients — line shapes', () => {
  it('parses comma, dash, and tab separated lines', () => {
    const r = parseBulkIngredients('Flour, 2kg, 85\nEggs - 30pcs - 55\nButter\t500g\t60');
    expect(r).toHaveLength(3);
    expect(r.every((i) => i.valid)).toBe(true);
    expect(r[0]).toMatchObject({ name: 'Flour', packQuantity: 2, packUnit: 'kg', cost: 85 });
    expect(r[1]).toMatchObject({ name: 'Eggs', packQuantity: 30, packUnit: 'pcs', cost: 55 });
    expect(r[2]).toMatchObject({ name: 'Butter', packQuantity: 500, packUnit: 'g', cost: 60 });
  });

  it('keeps names containing commas (last two cells are pack and cost)', () => {
    const r = parseBulkIngredients('Sugar, powdered, 1kg, 45');
    expect(r[0]).toMatchObject({ name: 'Sugar, powdered', packQuantity: 1, packUnit: 'kg', cost: 45 });
  });

  it('skips a header row and reads the optional reorder column', () => {
    const r = parseBulkIngredients('Name, Size, Cost, Reorder\nFlour, 2kg, 85, 1kg');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'Flour', cost: 85, reorderLevel: 1000 });
  });
});

describe('parseBulkIngredients — normalization', () => {
  it('normalizes everything to the smallest base units', () => {
    const r = parseBulkIngredients('Flour, 2kg, 85\nMilk, 1l, 25\nWater, 500ml, 5');
    expect(r.map((i) => [i.storageUnit, i.storageQuantity])).toEqual([
      ['g', 2000],
      ['ml', 1000],
      ['ml', 500],
    ]);
  });

  it('converts practical units into storage units', () => {
    const r = parseBulkIngredients('Honey, 1cup, 45\nVanilla, 2tbsp, 25\nColoring, 1tsp, 15\nChocolate, 8oz, 120\nAlmond Flour, 2lb, 180');
    expect(r.map((i) => [i.storageUnit, i.storageQuantity])).toEqual([
      ['ml', 240],   // 1 cup → 240 ml
      ['ml', 30],    // 2 tbsp
      ['ml', 5],     // 1 tsp
      ['g', 226.8],  // 8 oz × 28.35
      ['g', 907.2],  // 2 lb × 453.6
    ]);
  });

  it('every unit in every sample line normalizes into a storage unit', () => {
    const r = parseBulkIngredients(INGREDIENT_SAMPLE);
    expect(r.length).toBeGreaterThanOrEqual(10);
    for (const line of r) {
      expect(line.valid, `${line.raw}: ${line.error}`).toBe(true);
      expect(UNIT_OPTIONS).toContain(line.storageUnit);
    }
    const units = new Set(r.map((i) => i.packUnit));
    for (const u of ['g', 'kg', 'ml', 'l', 'pcs', 'cup', 'tbsp', 'tsp', 'oz', 'lb']) {
      expect(units, `sample should cover ${u}`).toContain(u);
    }
    const storage = new Set(r.map((i) => i.storageUnit));
    for (const u of ['g', 'ml', 'pcs']) {
      expect(storage, `all storage in ${u}`).toContain(u);
    }
  });

  it('computes cost per base unit for the preview', () => {
    const r = parseBulkIngredients('Flour, 2kg, 85');
    expect(r[0].costPerBase).toBeCloseTo(0.0425); // 85 / 2000 g
  });
});

describe('parseBulkIngredients — validation', () => {
  it('rejects lines with missing fields, bad units, and bad costs', () => {
    const r = parseBulkIngredients(
      ['OnlyName', 'Flour, 2kg', 'Flour, 2kg, 0', 'Flour, 2zoom, 85', 'Flour, 0kg, 85', ', 2kg, 85'].join('\n')
    );
    expect(r.every((i) => !i.valid)).toBe(true);
    expect(r[0].error).toMatch(/at least/);
    expect(r[2].error).toMatch(/positive/);
    expect(r[3].error).toMatch(/Unknown unit/);
  });

  it('accepts comma decimal costs with non-comma separators', () => {
    const r = parseBulkIngredients('Flour - 2kg - 85,50');
    expect(r[0].valid).toBe(true);
    expect(r[0].cost).toBe(85.5);
  });

  it('reads the reorder column with a unit suffix (normalized to base)', () => {
    const r = parseBulkIngredients('Flour, 2kg, 85, 1kg');
    expect(r[0].valid).toBe(true);
    expect(r[0]).toMatchObject({ name: 'Flour', cost: 85, reorderLevel: 1000 });
  });
});

describe('normalizePack', () => {
  it('returns null for unknown units', () => {
    expect(normalizePack(1, 'zoom')).toBeNull();
  });

  it('maps synonyms to base storage units', () => {
    expect(normalizePack(2, 'kilogram')).toEqual({ quantity: 2000, unit: 'g' });
    expect(normalizePack(30, 'pieces')).toEqual({ quantity: 30, unit: 'pcs' });
    expect(normalizePack(1, 'liter')).toEqual({ quantity: 1000, unit: 'ml' });
  });
});
