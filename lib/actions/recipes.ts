'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenantWritable } from '@/lib/tenant';
import {
  validateRecipeUrl,
  extractRecipeJsonLd,
  parseRecipeJsonLd,
  matchIngredientName,
  type MatchableIngredient,
  type ParsedRecipe,
} from '@/lib/recipe-import';
import { recordUsage } from '@/lib/usage';
import { UsageEventType } from '@/lib/usage-events';

export interface CreateRecipeInput {
  name: string;
  description?: string;
  preparationTime: number;
  servingsProduced: number;
  instructions: string;
  packagingCost: number;
  utilityCost: number;
  laborCost: number;
}

export async function createRecipe(input: CreateRecipeInput) {
  const { tenantId } = await requireTenantWritable();
  const recipe = await prisma.recipe.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description || null,
      preparationTime: input.preparationTime,
      servingsProduced: input.servingsProduced,
      instructions: input.instructions,
      packagingCost: input.packagingCost,
      utilityCost: input.utilityCost,
      laborCost: input.laborCost,
    },
  });
  await recordUsage({
    tenantId,
    eventType: UsageEventType.RECIPE_CREATED,
    route: '/recipes',
    metadata: { recipeId: recipe.id },
  });
  revalidatePath('/recipes');
  revalidatePath('/');
  return recipe;
}

export async function addRecipeIngredient(input: {
  recipeId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
}) {
  const { tenantId } = await requireTenantWritable();
  const recipe = await prisma.recipe.findFirst({
    where: { id: input.recipeId, tenantId },
    select: { id: true },
  });
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: input.ingredientId, tenantId },
    select: { id: true },
  });
  if (!recipe || !ingredient) throw new Error('Recipe or ingredient not found');

  await prisma.recipeIngredient.create({
    data: {
      recipeId: input.recipeId,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      unit: input.unit,
    },
  });
  revalidatePath(`/recipes/${input.recipeId}`);
  revalidatePath('/recipes');
  return true;
}

export async function removeRecipeIngredient(recipeIngredientId: string) {
  const { tenantId } = await requireTenantWritable();
  const ri = await prisma.recipeIngredient.findFirst({
    where: { id: recipeIngredientId, recipe: { tenantId } },
  });
  if (!ri) throw new Error('Recipe ingredient not found');
  await prisma.recipeIngredient.delete({ where: { id: recipeIngredientId } });
  revalidatePath(`/recipes/${ri.recipeId}`);
  revalidatePath('/recipes');
  return true;
}

export async function updateRecipeCosts(input: {
  recipeId: string;
  packagingCost: number;
  utilityCost: number;
  laborCost: number;
}) {
  const { tenantId } = await requireTenantWritable();
  await prisma.recipe.update({
    where: { id: input.recipeId, tenantId },
    data: {
      packagingCost: input.packagingCost,
      utilityCost: input.utilityCost,
      laborCost: input.laborCost,
    },
  });
  revalidatePath(`/recipes/${input.recipeId}`);
  revalidatePath('/recipes');
  return true;
}
export interface FetchedRecipeVM {
  name: string | null;
  servingsProduced: number | null;
  ingredients: { name: string; quantity: number; unit: string }[];
  instructions: string;
  sourceUrl: string;
}

/**
 * Fetch a recipe page and extract a draft recipe — never saves anything.
 * Tries schema.org JSON-LD first (most recipe sites carry it), then falls back
 * to parsing the visible text. Run through the paste importer review.
 */
export async function fetchRecipeFromUrl(
  rawUrl: string,
): Promise<{ ok: true; recipe: FetchedRecipeVM } | { ok: false; error: string }> {
  await requireTenantWritable();

  const url = validateRecipeUrl(rawUrl);
  if (!url) return { ok: false, error: 'That URL doesn\u2019t look like a recipe page' };

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrumbRecipeBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
  } catch {
    return { ok: false, error: "Couldn't reach that site — try pasting the recipe instead" };
  }
  if (!res.ok) {
    return { ok: false, error: `That site returned ${res.status} — try pasting the recipe instead` };
  }

  const text = await res.text();
  const blocks = extractRecipeJsonLd(text);
  const draft =
    blocks
      .map((node) => parseRecipeJsonLd(node as Record<string, unknown>))
      .find((r): r is ParsedRecipe => r !== null && r.ingredients.length > 0) ?? null;

  if (!draft) {
    return {
      ok: false,
      error: "Couldn't read a recipe on that page — try pasting the ingredients instead",
    };
  }

  return {
    ok: true,
    recipe: {
      name: draft.name,
      servingsProduced: draft.yieldCount,
      ingredients: draft.ingredients,
      instructions: draft.instructions,
      sourceUrl: url,
    },
  };
}

export interface DraftInput {
  name: string;
  servingsProduced: number;
  instructions: string;
  ingredients: { name: string; quantity: number; unit: string }[];
}

export interface CreateFromDraftResult {
  recipeId: string;
  matchedCount: number;
  createdCount: number;
}

/**
 * Create a recipe from a reviewed import draft. Existing tenant ingredients
 * are matched by fuzzy name; anything new becomes a placeholder ingredient at
 * zero cost so the baker can fill prices in after.
 */
export async function createRecipeFromDraft(
  draft: DraftInput,
): Promise<CreateFromDraftResult> {
  const { tenantId } = await requireTenantWritable();

  const existing = await prisma.ingredient.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });

  const matchable: MatchableIngredient[] = existing.map((i) => ({
    id: i.id,
    name: i.name,
  }));
  const plan: { ingredientId: string; quantity: number; unit: string; raw: string }[] = [];
  const newNames: string[] = [];

  for (const line of draft.ingredients) {
    const matched = matchIngredientName(line.name, matchable);
    if (matched) {
      plan.push({ ingredientId: matched.id, quantity: line.quantity, unit: line.unit, raw: line.name });
    } else {
      newNames.push(line.name);
    }
  }

  const recipe = await prisma.recipe.create({
    data: {
      tenantId,
      name: draft.name,
      preparationTime: 0,
      servingsProduced: draft.servingsProduced > 0 ? draft.servingsProduced : 1,
      instructions: draft.instructions,
    },
  });

  if (newNames.length > 0) {
    const created = await prisma.ingredient.createMany({
      data: newNames.map((name) => ({
        tenantId,
        name,
        baseUnit: 'g',
        purchaseQuantity: 1,
        purchaseUnit: 'g',
        purchaseCost: 0,
        availableQuantity: 0,
        reorderLevel: 0,
      })),
    });
    const fresh = await prisma.ingredient.findMany({
      where: { tenantId, name: { in: newNames } },
      select: { id: true, name: true },
    });
    for (const line of draft.ingredients) {
      const hit = fresh.find((i) => i.name === line.name);
      if (hit)
        plan.push({ ingredientId: hit.id, quantity: line.quantity, unit: line.unit, raw: line.name });
    }
    void created;
  }

  if (plan.length > 0) {
    await prisma.recipeIngredient.createMany({
      data: plan.map((p) => ({
        recipeId: recipe.id,
        ingredientId: p.ingredientId,
        quantity: p.quantity,
        unit: p.unit,
      })),
    });
  }

  await recordUsage({
    tenantId,
    eventType: UsageEventType.RECIPE_CREATED,
    route: '/recipes',
    metadata: { recipeId: recipe.id, imported: true },
  });

  revalidatePath('/recipes');
  revalidatePath('/ingredients');
  revalidatePath('/');
  return {
    recipeId: recipe.id,
    matchedCount: plan.length - newNames.length,
    createdCount: newNames.length,
  };
}
