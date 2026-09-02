import { convertToBase, costPerBaseUnit, type CostInputs } from '@/lib/costing';

/** A batch-level plan entry aggregated across a set of orders. */
export interface BatchPlan {
  recipeId: string;
  recipeName: string;
  batchCount: number;
}

/**
 * Aggregate a set of customer order lines into the batch counts needed to
 * fulfil them, grouped by recipe. Reuses the same WHOLE/PORTION yield math
 * that drives production planning (`planFromOrderLines`).
 */
export function aggregateBatches(
  orderLines: Array<{
    quantity: number;
    productType: 'WHOLE' | 'PORTION';
    servingsProduced: number;
    recipeId: string;
    recipeName: string;
  }>
): BatchPlan[] {
  const map = new Map<string, BatchPlan>();
  for (const line of orderLines) {
    if (line.quantity <= 0) continue;
    const batches =
      line.productType === 'WHOLE'
        ? Math.ceil(line.quantity / Math.max(1, line.servingsProduced))
        : line.quantity;
    const existing = map.get(line.recipeId);
    if (existing) existing.batchCount += batches;
    else map.set(line.recipeId, { recipeId: line.recipeId, recipeName: line.recipeName, batchCount: batches });
  }
  return [...map.values()];
}

export interface ForecastRecipeIngredient {
  quantity: number;
  unit: string;
  ingredient: {
    id: string;
    name: string;
    availableQuantity: number;
    baseUnit: string;
  } & CostInputs;
}

/** A recipe reduced to the fields the forecast needs. */
export interface ForecastRecipe {
  id: string;
  ingredients: ForecastRecipeIngredient[];
}

export interface ForecastRow {
  ingredientId: string;
  name: string;
  baseUnit: string;
  requiredBase: number;
  availableBase: number;
  shortageBase: number;
  /** Estimated cost of the shortfall (shortageBase × cost/unit). */
  estimatedCost: number;
  /** true when there is nothing to buy. */
  enough: boolean;
}

/**
 * Roll a set of recipe batch requirements up into per-ingredient forecast rows
 * (need, have, short, est. purchase cost). Shortages are clipped at zero.
 */
export function forecastRequirements(
  recipes: ForecastRecipe[],
  batches: BatchPlan[]
): ForecastRow[] {
  const map = new Map<
    string,
    { id: string; name: string; baseUnit: string; requiredBase: number; availableBase: number; costPerBase: number }
  >();
  for (const plan of batches) {
    const recipe = recipes.find((r) => r.id === plan.recipeId);
    if (!recipe) continue;
    for (const ri of recipe.ingredients) {
      const needed = convertToBase(ri.quantity, ri.unit) * plan.batchCount;
      const costPerBase = costPerBaseUnit(ri.ingredient);
      const existing = map.get(ri.ingredient.id);
      if (existing) {
        existing.requiredBase += needed;
      } else {
        map.set(ri.ingredient.id, {
          id: ri.ingredient.id,
          name: ri.ingredient.name,
          baseUnit: ri.ingredient.baseUnit,
          requiredBase: needed,
          availableBase: ri.ingredient.availableQuantity,
          costPerBase,
        });
      }
    }
  }
  return [...map.values()]
    .map((r) => {
      const shortageBase = Math.max(0, r.requiredBase - r.availableBase);
      return {
        ingredientId: r.id,
        name: r.name,
        baseUnit: r.baseUnit,
        requiredBase: r.requiredBase,
        availableBase: r.availableBase,
        shortageBase,
        estimatedCost: shortageBase * r.costPerBase,
        enough: shortageBase === 0,
      };
    })
    .sort((a, b) => (a.enough === b.enough ? b.shortageBase - a.shortageBase : a.enough ? 1 : -1));
}

export interface ForecastSummary {
  orderCount: number;
  ingredientsRequired: number;
  ingredientsShort: number;
  estimatedCost: number;
}

export function forecastSummary(rows: ForecastRow[], orderCount: number): ForecastSummary {
  return {
    orderCount,
    ingredientsRequired: rows.length,
    ingredientsShort: rows.filter((r) => !r.enough).length,
    estimatedCost: rows.reduce((sum, r) => sum + r.estimatedCost, 0),
  };
}