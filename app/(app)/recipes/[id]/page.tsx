import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { recipeTotalCost, recipeCostPerServing, recipeTotalIngredientCost } from '@/lib/queries';
import { getTenantContext } from '@/lib/tenant';
import { RecipeDetailClient } from './recipe-detail-client';

export const dynamic = 'force-dynamic';

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await getTenantContext();
  const recipe = await prisma.recipe.findUnique({
    where: { id, tenantId },
    include: {
      recipeIngredients: { include: { ingredient: true } },
    },
  });

  if (!recipe) notFound();

  const [ingredients, linkedProducts] = await Promise.all([
    prisma.ingredient.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { recipeId: recipe.id, tenantId } }),
  ]);

  const ingredientCost = recipeTotalIngredientCost(recipe);
  const totalCost = recipeTotalCost(recipe);
  const perServing = recipeCostPerServing(recipe);

  const recipeVM = {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    status: recipe.status,
    instructions: recipe.instructions,
    preparationTime: recipe.preparationTime,
    servingsProduced: recipe.servingsProduced,
    packagingCost: recipe.packagingCost,
    utilityCost: recipe.utilityCost,
    laborCost: recipe.laborCost,
  };

  const recipeIngredientsVM = recipe.recipeIngredients.map((ri) => ({
    id: ri.id,
    quantity: ri.quantity,
    unit: ri.unit,
    ingredient: {
      id: ri.ingredient.id,
      name: ri.ingredient.name,
      purchaseQuantity: ri.ingredient.purchaseQuantity,
      purchaseUnit: ri.ingredient.purchaseUnit,
      purchaseCost: ri.ingredient.purchaseCost,
    },
    cost: recipeTotalIngredientCost({
      recipeIngredients: [
        {
          quantity: ri.quantity,
          unit: ri.unit,
          ingredient: ri.ingredient,
        },
      ],
    }) as number,
  }));

  return (
    <RecipeDetailClient
      recipe={recipeVM}
      ingredients={ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        baseUnit: i.baseUnit,
      }))}
      recipeIngredients={recipeIngredientsVM}
      linkedProducts={linkedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        availableQuantity: p.availableQuantity,
        sellingPrice: p.sellingPrice,
      }))}
      totals={{ ingredientCost, totalCost, perServing }}
    />
  );
}
