'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenantWritable } from '@/lib/tenant';
import { convertToBase } from '@/lib/costing';

export interface CreateProductionOrderInput {
  items: { recipeId: string; batchCount: number }[];
}

export async function createProductionOrder(input: CreateProductionOrderInput) {
  const { tenantId } = await requireTenantWritable();

  const recipeIds = [...new Set(input.items.map((i) => i.recipeId))];
  const owned = await prisma.recipe.findMany({
    where: { id: { in: recipeIds }, tenantId },
    select: { id: true },
  });
  if (owned.length !== recipeIds.length) {
    throw new Error('One or more recipes not found');
  }

  const order = await prisma.productionOrder.create({
    data: {
      tenantId,
      status: 'PLANNED',
      items: {
        create: input.items.map((i) => ({
          recipeId: i.recipeId,
          batchCount: i.batchCount,
        })),
      },
    },
    include: { items: true },
  });
  revalidatePath('/produce');
  revalidatePath('/products');
  revalidatePath('/');
  return order;
}

export async function startProductionOrder(orderId: string) {
  const { tenantId } = await requireTenantWritable();
  await prisma.productionOrder.update({
    where: { id: orderId, tenantId },
    data: { status: 'IN_PROGRESS' },
  });
  revalidatePath('/produce');
  return true;
}

export async function completeProductionOrder(orderId: string) {
  const { tenantId } = await requireTenantWritable();
  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId, tenantId },
    include: {
      items: {
        include: {
          recipe: {
            include: {
              recipeIngredients: { include: { ingredient: true } },
              products: true,
            },
          },
        },
      },
    },
  });
  if (!order) throw new Error('Order not found');

  // Deduct ingredients & log PRODUCTION movements
  for (const item of order.items) {
    for (const ri of item.recipe.recipeIngredients) {
      const neededBase = convertToBase(ri.quantity, ri.unit) * item.batchCount;
      const ingredient = ri.ingredient;
      const newQty = Math.max(0, ingredient.availableQuantity - neededBase);
      await prisma.ingredient.update({
        where: { id: ingredient.id, tenantId },
        data: { availableQuantity: newQty },
      });
      await prisma.ingredientMovement.create({
        data: {
          ingredientId: ingredient.id,
          type: 'PRODUCTION',
          quantity: -neededBase,
          notes: `Used for ${item.recipe.name} (${item.batchCount} batch)`,
        },
      });
    }

    // Increase product stock
    for (const prod of item.recipe.products) {
      const produced = prod.type === 'WHOLE' ? item.recipe.servingsProduced * item.batchCount : item.batchCount;
      await prisma.product.update({
        where: { id: prod.id, tenantId },
        data: { availableQuantity: prod.availableQuantity + produced },
      });
      await prisma.productMovement.create({
        data: { productId: prod.id, type: 'PRODUCED', quantity: produced },
      });
    }
  }

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  revalidatePath('/produce');
  revalidatePath('/products');
  revalidatePath('/ingredients');
  revalidatePath('/');
  return true;
}

export async function cancelProductionOrder(orderId: string) {
  const { tenantId } = await requireTenantWritable();
  await prisma.productionOrder.update({
    where: { id: orderId, tenantId },
    data: { status: 'CANCELLED' },
  });
  revalidatePath('/produce');
  return true;
}