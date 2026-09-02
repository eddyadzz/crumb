import { convertToBase } from '@/lib/costing';

export type StockRequirement =
  | { kind: 'ingredient'; id: string; name: string; baseUnit: string; requiredBase: number; availableBase: number }
  | { kind: 'product'; id: string; name: string; required: number; available: number };

/** Compute per-line shortage (>=0 when sufficient, margin when not). */
export function shortage(req: { requiredBase: number; availableBase: number }): number {
  return Math.max(0, req.requiredBase - req.availableBase);
}

/**
 * Given a production plan (list of recipes and batch counts), roll up the
 * total base-unit requirement per ingredient. Returns rows with the shortage.
 */
export function rollupRecipeRequirements(
  recipes: Array<{
    id: string;
    name: string;
    ingredients: Array<{
      ingredientId: string;
      name: string;
      unit: string;
      requiredPerBatch: number;
      availableQuantity: number;
      baseUnit: string;
    }>;
  }>,
  planItems: Array<{ recipeId: string; batchCount: number }>
): Array<{
  ingredientId: string;
  name: string;
  baseUnit: string;
  requiredBase: number;
  availableBase: number;
}> {
  const map = new Map<
    string,
    { ingredientId: string; name: string; baseUnit: string; requiredBase: number; availableBase: number }
  >();
  planItems.forEach((item) => {
    const recipe = recipes.find((r) => r.id === item.recipeId);
    if (!recipe) return;
    recipe.ingredients.forEach((ri) => {
      const baseQty = convertToBase(ri.requiredPerBatch, ri.unit) * item.batchCount;
      const existing = map.get(ri.ingredientId);
      if (existing) {
        existing.requiredBase += baseQty;
      } else {
        map.set(ri.ingredientId, {
          ingredientId: ri.ingredientId,
          name: ri.name,
          baseUnit: ri.baseUnit,
          requiredBase: baseQty,
          availableBase: ri.availableQuantity,
        });
      }
    });
  });
  return [...map.values()];
}

export function blockForShortage(
  policy: 'WARN' | 'BLOCK',
  requirements: Array<{ requiredBase: number; availableBase: number }>
): { blocked: boolean; shortages: number } {
  const shortRows = requirements.filter((r) => shortage(r) > 0);
  if (policy !== 'BLOCK') return { blocked: false, shortages: shortRows.length };
  return { blocked: shortRows.length > 0, shortages: shortRows.length };
}