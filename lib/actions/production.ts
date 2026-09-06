'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenantWritable } from '@/lib/tenant';
import { convertToBase, costPerBaseUnit } from '@/lib/costing';
import { blockForShortage } from '@/lib/stock';
import { recordActivity } from '@/lib/activity';
import { fireWebhook } from '@/lib/webhooks';
import { recordUsage } from '@/lib/usage';
import { UsageEventType } from '@/lib/usage-events';

export interface CreateProductionOrderInput {
  items: { recipeId: string; batchCount: number }[];
}

/** Per-production-item actual ingredient usage, in base units, keyed by
 * ingredientId. Omitting an ingredient means the actual equals the planned
 * amount (the batch was completed exactly to plan). */
export interface ProductionActualInput {
  productionItemId: string;
  ingredientId: string;
  actualBase: number;
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
  await recordActivity({
    tenantId,
    type: 'PRODUCTION_CREATED',
    title: 'Production batch planned',
    entityType: 'ProductionOrder',
    entityId: order.id,
  });
  await fireWebhook(tenantId, 'production.created', {
    id: order.id,
    items: order.items.map((i) => ({ recipeId: i.recipeId, batchCount: i.batchCount })),
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
  await recordActivity({
    tenantId,
    type: 'PRODUCTION_CREATED',
    title: 'Production started',
    entityType: 'ProductionOrder',
    entityId: orderId,
  });
  await recordUsage({
    tenantId,
    eventType: UsageEventType.PRODUCTION_STARTED,
    route: '/produce',
    metadata: { productionOrderId: orderId },
  });
  revalidatePath('/produce');
  return true;
}

export async function completeProductionOrder(
  orderId: string,
  actuals?: ProductionActualInput[]
): Promise<boolean> {
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
  if (order.status !== 'IN_PROGRESS') {
    throw new Error('Only an in-progress production order can be completed');
  }

  // Normalise actual usage: default to planned when not provided.
  const actualMap = new Map<string, number>();
  for (const a of actuals ?? []) actualMap.set(`${a.productionItemId}:${a.ingredientId}`, a.actualBase);

  // Stock policy: with BLOCK, refuse to complete when any ingredient is short
  // (based on the actual amounts we intend to deduct).
  const [tenant] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { stockPolicy: true } }),
  ]);
  const requirements = order.items.flatMap((item) =>
    item.recipe.recipeIngredients.map((ri) => {
      const plannedBase = convertToBase(ri.quantity, ri.unit) * item.batchCount;
      const actualBase = actualMap.get(`${item.id}:${ri.ingredientId}`) ?? plannedBase;
      return {
        requiredBase: Math.max(plannedBase, actualBase),
        availableBase: ri.ingredient.availableQuantity,
      };
    })
  );
  const { blocked, shortages } = blockForShortage(
    tenant?.stockPolicy ?? 'WARN',
    requirements
  );
  if (blocked) {
    throw new Error(
      `Cannot complete production — ${shortages} ingredient(s) are below required stock (stock policy is set to Block).`
    );
  }

  // Deduct ingredients (actual amounts) & snapshot planned-vs-actual variance;
  // log PRODUCTION movements.
  const lowStock: { id: string; name: string; availableQuantity: number; reorderLevel: number }[] = [];
  for (const item of order.items) {
    for (const ri of item.recipe.recipeIngredients) {
      const plannedBase = convertToBase(ri.quantity, ri.unit) * item.batchCount;
      const actualBase = actualMap.get(`${item.id}:${ri.ingredientId}`) ?? plannedBase;
      const ingredient = ri.ingredient;
      const newQty = Math.max(0, ingredient.availableQuantity - actualBase);
      await prisma.ingredient.update({
        where: { id: ingredient.id, tenantId },
        data: { availableQuantity: newQty },
      });
      await prisma.ingredientMovement.create({
        data: {
          ingredientId: ingredient.id,
          type: 'PRODUCTION',
          quantity: -actualBase,
          notes: `Used for ${item.recipe.name} (${item.batchCount} batch)`,
        },
      });
      await prisma.productionItemIngredient.create({
        data: {
          productionItemId: item.id,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          plannedQuantity: plannedBase,
          actualQuantity: actualBase,
          costPerBase: costPerBaseUnit({
            purchaseQuantity: ingredient.purchaseQuantity,
            purchaseUnit: ingredient.purchaseUnit,
            purchaseCost: ingredient.purchaseCost,
          }),
        },
      });
      if (newQty <= ingredient.reorderLevel) {
        lowStock.push({ id: ingredient.id, name: ingredient.name, availableQuantity: newQty, reorderLevel: ingredient.reorderLevel });
      }
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

  await prisma.notification.create({
    data: {
      tenantId,
      type: 'PRODUCTION',
      severity: 'SUCCESS',
      title: 'Production batch completed',
      message: [
        ...new Set(order.items.map((i) => i.recipe.name)),
      ].join(', ') || 'A production batch was completed',
      link: '/produce',
    },
  });

  await recordActivity({
    tenantId,
    type: 'PRODUCTION_COMPLETED',
    title: 'Completed production batch',
    description: [...new Set(order.items.map((i) => `${i.batchCount}× ${i.recipe.name}`))].join(', '),
    entityType: 'ProductionOrder',
    entityId: orderId,
  });

  await fireWebhook(tenantId, 'production.completed', {
    id: orderId,
    items: order.items.map((i) => ({ recipeName: i.recipe.name, batchCount: i.batchCount })),
  });

  if (lowStock.length > 0) {
    const unique = lowStock.filter(
      (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
    );
    for (const ing of unique) {
      await fireWebhook(tenantId, 'inventory.low_stock', {
        ingredientId: ing.id,
        ingredientName: ing.name,
        availableQuantity: ing.availableQuantity,
        reorderLevel: ing.reorderLevel,
      });
    }
  }

  await recordUsage({
    tenantId,
    eventType: UsageEventType.PRODUCTION_COMPLETED,
    route: '/produce',
    metadata: { productionOrderId: orderId },
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
  await recordActivity({
    tenantId,
    type: 'PRODUCTION_CANCELLED',
    title: 'Production batch cancelled',
    entityType: 'ProductionOrder',
    entityId: orderId,
  });
  revalidatePath('/produce');
  return true;
}