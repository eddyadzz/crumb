import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { aggregateBatches, type BatchPlan } from '@/lib/forecast';
import { ForecastClient } from './forecast-client';

export const dynamic = 'force-dynamic';

interface OrderForecast {
  id: string;
  deliveryDate: string;
  batches: BatchPlan[];
}

export default async function ForecastPage() {
  const { tenantId } = await getTenantContext();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [orders, recipes] = await Promise.all([
    prisma.customerOrder.findMany({
      where: {
        tenantId,
        status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY'] },
        deliveryDate: { gte: startOfToday },
      },
      orderBy: { deliveryDate: 'asc' },
      include: {
        items: {
          include: {
            product: {
              include: { recipe: { select: { id: true, name: true, servingsProduced: true } } },
            },
          },
        },
      },
    }),
    prisma.recipe.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        recipeIngredients: { include: { ingredient: true } },
      },
    }),
  ]);

  const orderForecasts: OrderForecast[] = orders.map((o) => ({
    id: o.id,
    deliveryDate: (o.deliveryDate ?? startOfToday).toISOString(),
    batches: aggregateBatches(
      o.items.map((i) => ({
        quantity: i.quantity,
        productType: i.product.type,
        servingsProduced: i.product.recipe.servingsProduced,
        recipeId: i.product.recipe.id,
        recipeName: i.product.recipe.name,
      }))
    ),
  }));

  return (
    <ForecastClient
      orders={orderForecasts}
      recipes={recipes.map((r) => ({
        id: r.id,
        name: r.name,
        ingredients: r.recipeIngredients.map((ri) => ({
          quantity: ri.quantity,
          unit: ri.unit,
          ingredient: {
            id: ri.ingredient.id,
            name: ri.ingredient.name,
            availableQuantity: ri.ingredient.availableQuantity,
            baseUnit: ri.ingredient.baseUnit,
            purchaseQuantity: ri.ingredient.purchaseQuantity,
            purchaseUnit: ri.ingredient.purchaseUnit,
            purchaseCost: ri.ingredient.purchaseCost,
          },
        })),
      }))}
    />
  );
}