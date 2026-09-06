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

export interface BulkImportItem {
  name: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseCost: number;
  reorderLevel: number;
  /** Base-unit quantity + unit from the client-side parse (g / ml / pcs). */
  baseUnit: string;
  baseQuantity: number;
}

export interface BulkImportSummary {
  created: number;
  updated: number;
}

/**
 * Bulk-import ingredients from the paste parser. Matching is by exact
 * case-insensitive name: new names are created (with an initial PURCHASE
 * movement), known names have their cost, pack, and reorder level updated —
 * stock is left untouched. Base fields are normalized to g / ml / pcs.
 */
export async function bulkImportIngredients(
  items: BulkImportItem[],
): Promise<BulkImportSummary> {
  const { tenantId } = await requireTenantWritable();
  const summary: BulkImportSummary = { created: 0, updated: 0 };

  for (const item of items) {
    const name = item.name.trim();
    const baseUnit = item.baseUnit.trim();
    if (!name || !['g', 'ml', 'pcs'].includes(baseUnit)) continue;
    if (!Number.isFinite(item.purchaseCost) || item.purchaseCost <= 0) continue;
    if (!Number.isFinite(item.baseQuantity) || item.baseQuantity <= 0) continue;
    if (!Number.isFinite(item.purchaseQuantity) || item.purchaseQuantity <= 0) continue;
    if (!item.purchaseUnit.trim()) continue;

    const existing = await prisma.ingredient.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existing) {
      await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          purchaseCost: item.purchaseCost,
          purchaseQuantity: item.purchaseQuantity,
          purchaseUnit: item.purchaseUnit.trim(),
          reorderLevel: Math.max(0, item.reorderLevel),
        },
      });
      summary.updated += 1;
      continue;
    }

    const created = await prisma.ingredient.create({
      data: {
        tenantId,
        name,
        baseUnit,
        purchaseQuantity: item.purchaseQuantity,
        purchaseUnit: item.purchaseUnit.trim(),
        purchaseCost: item.purchaseCost,
        availableQuantity: item.baseQuantity,
        reorderLevel: Math.max(0, item.reorderLevel),
        notes: 'Bulk import',
      },
    });
    await prisma.ingredientMovement.create({
      data: {
        ingredientId: created.id,
        type: 'PURCHASE',
        quantity: item.baseQuantity,
        notes: 'Initial stock (bulk import)',
      },
    });
    summary.created += 1;
  }

  revalidatePath('/ingredients');
  revalidatePath('/');
  return summary;
}
