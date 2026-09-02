import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { ProduceClient } from './produce-client';

export const dynamic = 'force-dynamic';

export default async function ProducePage() {
  const { tenantId } = await getTenantContext();
  const [recipes, orders] = await Promise.all([
    prisma.recipe.findMany({
      where: { tenantId },
      include: {
        recipeIngredients: { include: { ingredient: true } },
        products: { select: { id: true, name: true, type: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.productionOrder.findMany({
      where: { tenantId },
      include: {
        items: {
          include: {
            recipe: {
              include: { recipeIngredients: { include: { ingredient: true } } },
            },
            ingredientActuals: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const recipesVM = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    instructions: r.instructions,
    preparationTime: r.preparationTime,
    servingsProduced: r.servingsProduced,
    totalCost: r.packagingCost + r.utilityCost + r.laborCost,
    products: r.products.map((p) => ({ id: p.id, name: p.name, type: p.type })),
    ingredients: r.recipeIngredients.map((ri) => ({
      ingredientId: ri.ingredientId,
      name: ri.ingredient.name,
      baseUnit: ri.ingredient.baseUnit,
      availableQuantity: ri.ingredient.availableQuantity,
      requiredPerBatch: ri.quantity,
      unit: ri.unit,
    })),
  }));

  const ordersVM = orders.map((o) => ({
    id: o.id,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    completedAt: o.completedAt?.toISOString() ?? null,
    items: o.items.map((item) => ({
      id: item.id,
      recipeId: item.recipeId,
      recipeName: item.recipe.name,
      batchCount: item.batchCount,
      ingredientActuals: item.ingredientActuals.map((ia) => ({
        ingredientId: ia.ingredientId,
        ingredientName: ia.ingredientName,
        plannedBase: ia.plannedQuantity,
        actualBase: ia.actualQuantity,
      })),
    })),
  }));

  return <ProduceClient recipes={recipesVM} orders={ordersVM} />;
}
