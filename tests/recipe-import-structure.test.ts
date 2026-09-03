import { describe, expect, it } from 'vitest';
import { parseRecipeText } from '@/lib/recipe-import';

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
