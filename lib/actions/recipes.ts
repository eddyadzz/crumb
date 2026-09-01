'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenantWritable } from '@/lib/tenant';

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