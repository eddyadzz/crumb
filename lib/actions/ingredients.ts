'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenant, requireTenantWritable } from '@/lib/tenant';

export async function getMovementsForIngredient(ingredientId: string) {
  const { tenantId } = await requireTenant();
  return prisma.ingredientMovement.findMany({
    where: { ingredientId, ingredient: { tenantId } },
    orderBy: { createdAt: 'desc' },
  });
}

export interface CreateIngredientInput {
  name: string;
  baseUnit: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseCost: number;
  reorderLevel: number;
  notes?: string;
}

export async function createIngredient(input: CreateIngredientInput) {
  const { tenantId } = await requireTenantWritable();
  const ingredient = await prisma.ingredient.create({
    data: {
      tenantId,
      name: input.name,
      baseUnit: input.baseUnit,
      purchaseQuantity: input.purchaseQuantity,
      purchaseUnit: input.purchaseUnit,
      purchaseCost: input.purchaseCost,
      availableQuantity: input.purchaseQuantity,
      reorderLevel: input.reorderLevel,
      notes: input.notes || null,
    },
  });

  await prisma.ingredientMovement.create({
    data: {
      ingredientId: ingredient.id,
      type: 'PURCHASE',
      quantity: input.purchaseQuantity,
      notes: 'Initial stock',
    },
  });

  revalidatePath('/ingredients');
  revalidatePath('/');
  return ingredient;
}

export interface AdjustStockInput {
  ingredientId: string;
  type: 'add' | 'remove';
  quantity: number;
  notes?: string;
}

export async function adjustStock(input: AdjustStockInput) {
  const { tenantId } = await requireTenantWritable();
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: input.ingredientId, tenantId },
  });
  if (!ingredient) throw new Error('Ingredient not found');

  const signedQuantity =
    input.type === 'add' ? input.quantity : -input.quantity;
  const newQuantity = Math.max(0, ingredient.availableQuantity + signedQuantity);

  await prisma.ingredient.update({
    where: { id: input.ingredientId },
    data: { availableQuantity: newQuantity },
  });

  await prisma.ingredientMovement.create({
    data: {
      ingredientId: input.ingredientId,
      type: 'ADJUSTMENT',
      quantity: signedQuantity,
      notes: input.notes || (input.type === 'add' ? 'Stock added' : 'Stock removed'),
    },
  });

  revalidatePath('/ingredients');
  revalidatePath('/');
  return { newQuantity };
}
export interface UpdateIngredientCostInput {
  ingredientId: string;
  purchaseCost: number;
  purchaseQuantity: number;
  purchaseUnit: string;
}

/**
 * Update an ingredient's current cost basis (pack size + price).
 * Future costing/pricing/variance use the new cost; stock is untouched.
 */
export async function updateIngredientCost(input: UpdateIngredientCostInput) {
  const { tenantId } = await requireTenantWritable();
  if (!Number.isFinite(input.purchaseCost) || input.purchaseCost < 0) {
    throw new Error('Cost must be zero or more');
  }
  if (!Number.isFinite(input.purchaseQuantity) || input.purchaseQuantity <= 0) {
    throw new Error('Pack size must be greater than zero');
  }
  if (!input.purchaseUnit.trim()) throw new Error('Pack unit is required');

  const ingredient = await prisma.ingredient.findUnique({
    where: { id: input.ingredientId, tenantId },
  });
  if (!ingredient) throw new Error('Ingredient not found');

  await prisma.ingredient.update({
    where: { id: input.ingredientId },
    data: {
      purchaseCost: input.purchaseCost,
      purchaseQuantity: input.purchaseQuantity,
      purchaseUnit: input.purchaseUnit.trim(),
    },
  });

  revalidatePath('/ingredients');
  revalidatePath('/');
  revalidatePath('/pricing');
  return { costPerBaseUnit: input.purchaseCost / input.purchaseQuantity };
}
