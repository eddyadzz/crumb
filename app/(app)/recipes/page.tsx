import { prisma } from '@/lib/prisma';
import { recipeTotalCost, recipeCostPerServing } from '@/lib/queries';
import { getTenantContext } from '@/lib/tenant';
import { RecipesClient } from './recipes-client';

export const dynamic = 'force-dynamic';

export default async function RecipesPage() {
  const { tenantId } = await getTenantContext();
  const [recipes, products] = await Promise.all([
    prisma.recipe.findMany({
      where: { tenantId },
      include: {
        recipeIngredients: { include: { ingredient: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({ where: { tenantId } }),
  ]);

  const vm = recipes.map((r) => {
    const totalCost = recipeTotalCost(r);
    const perServing = recipeCostPerServing(r);
    const product = products.find((p) => p.recipeId === r.id);
    const profit = product ? product.sellingPrice - perServing : null;
    const margin =
      product && product.sellingPrice > 0
        ? (profit! / product.sellingPrice) * 100
        : null;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      preparationTime: r.preparationTime,
      servingsProduced: r.servingsProduced,
      totalCost,
      perServing,
      profit,
      margin,
      ingredientCount: r.recipeIngredients.length,
      hasProduct: !!product,
    };
  });

  return <RecipesClient recipes={vm} />;
}
