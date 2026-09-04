import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { convertToBase } from '@/lib/costing';
import { recordUsage } from '@/lib/usage';
import { UsageEventType } from '@/lib/usage-events';
import { FloorClient, type FloorOrderVM } from './floor-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Floor Mode — Crumb',
};

/** Dedicated touch-first production screen, rendered without the app shell. */
export default async function FloorPage() {
  const { tenantId, tenant, userId } = await getTenantContext();
  await recordUsage({
    tenantId,
    userId,
    eventType: UsageEventType.FLOOR_SESSION_STARTED,
    route: '/floor',
  });

  const orders = await prisma.productionOrder.findMany({
    where: { tenantId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
    include: {
      items: {
        include: {
          recipe: {
            include: { recipeIngredients: { include: { ingredient: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const vm: FloorOrderVM[] = orders.map((o) => ({
    id: o.id,
    status: o.status as FloorOrderVM['status'],
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      recipeName: i.recipe.name,
      batchCount: i.batchCount,
      ingredients: i.recipe.recipeIngredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        name: ri.ingredient.name,
        baseUnit: ri.ingredient.baseUnit,
        plannedBase: convertToBase(ri.quantity, ri.unit) * i.batchCount,
        availableBase: ri.ingredient.availableQuantity,
      })),
    })),
  }));

  return (
    <FloorClient
      tenantName={tenant.name}
      orders={vm}
    />
  );
}