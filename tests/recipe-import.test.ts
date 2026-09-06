import { describe, expect, it } from 'vitest';
import { matchIngredientName, parseRecipeText } from '@/lib/recipe-import';

describe('parseRecipeText — quantity-first lines', () => {
  it('parses weight, count, volume, and comma decimals', () => {
    const r = parseRecipeText(['500g flour', '2 eggs', '1 1/2 cups sugar', '0,5 l milk'].join('\n'));
    expect(r.ingredients).toEqual([
      { raw: '500g flour', name: 'flour', quantity: 500, unit: 'g' },
      { raw: '2 eggs', name: 'eggs', quantity: 2, unit: 'pcs' },
      { raw: '1 1/2 cups sugar', name: 'sugar', quantity: 360, unit: 'ml' },
      { raw: '0,5 l milk', name: 'milk', quantity: 0.5, unit: 'l' },
    ]);
  });

  it('converts tbsp/tsp/oz/lb to ml/g', () => {
    const r = parseRecipeText('2 tbsp butter\n1 tsp vanilla\n8 oz chocolate\n1 lb sugar');
    expect(r.ingredients.map((i) => [i.quantity, i.unit])).toEqual([
      [30, 'ml'],
      [5, 'ml'],
      [226.8, 'g'],
      [453.6, 'g'],
    ]);
  });
});

describe('parseRecipeText — name-first lines', () => {
  it('parses "Name - amount unit", "Name: amount unit", and "Name amount unit"', () => {
    const r = parseRecipeText(['Flour - 500g', 'Sugar: 250g', 'Butter 125g'].join('\n'));
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['Flour', 500, 'g'],
      ['Sugar', 250, 'g'],
      ['Butter', 125, 'g'],
    ]);
  });
});

describe('parseRecipeText — yield lines', () => {
  it('captures "Yield: 12 slices", "Makes 24", "Serves 10", "12 servings"', () => {
    expect(parseRecipeText('Yield: 12 slices').yieldCount).toBe(12);
    expect(parseRecipeText('Makes 24').yieldCount).toBe(24);
    expect(parseRecipeText('Serves 10').yieldCount).toBe(10);
    expect(parseRecipeText('12 servings').yieldCount).toBe(12);
  });

  it('keeps the first yield only', () => {
    expect(parseRecipeText('Yield: 12\nMakes 30').yieldCount).toBe(12);
  });
});

describe('parseRecipeText — structure', () => {
  it('skips section headers and keeps sub-section names in instructions', () => {
    const r = parseRecipeText(
      ['Chocolate Cake', '', 'Ingredients', '500g flour', '', 'For the frosting:', 'Melt chocolate slowly.'].join('\n')
    );
    expect(r.name).toBe('Chocolate Cake');
    expect(r.ingredients).toHaveLength(1);
    expect(r.instructions).toContain('For the frosting:');
    expect(r.instructions).toContain('Melt chocolate slowly.');
  });

  it('treats "salt to taste" as qty 1 pcs named salt', () => {
    expect(parseRecipeText('salt to taste').ingredients).toEqual([
      { raw: 'salt to taste', name: 'salt', quantity: 1, unit: 'pcs' },
    ]);
  });

  it('does not treat a plain instruction sentence as an ingredient', () => {
    const r = parseRecipeText('Mix everything gently for five minutes.');
    expect(r.ingredients).toEqual([]);
    expect(r.instructions).toBe('Mix everything gently for five minutes.');
  });
});
