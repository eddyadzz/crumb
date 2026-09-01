import { prisma } from '@/lib/prisma';
import { recipeCostPerServing } from '@/lib/queries';
import { getTenantContext } from '@/lib/tenant';
import { ProductsClient } from './products-client';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const { tenantId } = await getTenantContext();
  const [products, recipes] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId },
      include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.recipe.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
  ]);

  const vm = products.map((p) => {
    const perServing = recipeCostPerServing(p.recipe);
    const profit = p.sellingPrice - perServing;
    const margin = p.sellingPrice > 0 ? (profit / p.sellingPrice) * 100 : 0;
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      availableQuantity: p.availableQuantity,
      sellingPrice: p.sellingPrice,
      recipeId: p.recipeId,
      recipeName: p.recipe.name,
      cost: perServing,
      profit,
      margin,
    };
  });

  const recipesVM = recipes.map((r) => ({ id: r.id, name: r.name, servingsProduced: r.servingsProduced }));

  return <ProductsClient products={vm} recipes={recipesVM} />;
}
