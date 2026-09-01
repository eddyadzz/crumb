import 'server-only';
import { prisma } from '@/lib/prisma';
import { convertToBase, costPerBaseUnit } from '@/lib/costing';

export async function getIngredients(tenantId: string) {
  return prisma.ingredient.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });
}

export async function getIngredientById(tenantId: string, id: string) {
  return prisma.ingredient.findUnique({ where: { id, tenantId } });
}

export async function getIngredientMovements(tenantId: string, ingredientId: string) {
  return prisma.ingredientMovement.findMany({
    where: { ingredientId, ingredient: { tenantId } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getIngredientsWithCost(tenantId: string) {
  const ings = await getIngredients(tenantId);
  return ings.map((i) => ({
    ...i,
    costPerBaseUnit: costPerBaseUnit(i),
  }));
}

export async function getRecipes(tenantId: string) {
  return prisma.recipe.findMany({
    where: { tenantId },
    include: {
      recipeIngredients: { include: { ingredient: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getRecipeById(tenantId: string, id: string) {
  return prisma.recipe.findUnique({
    where: { id, tenantId },
    include: {
      recipeIngredients: { include: { ingredient: true } },
      products: true,
    },
  });
}

export async function getProducts(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId },
    include: { recipe: true },
    orderBy: { name: 'asc' },
  });
}

export async function getProductionOrders(tenantId: string) {
  return prisma.productionOrder.findMany({
    where: { tenantId },
    include: { items: { include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLowStockIngredients(tenantId: string) {
  const ings = await prisma.ingredient.findMany({
    where: {
      tenantId,
      availableQuantity: { lte: prisma.ingredient.fields.reorderLevel },
    },
    orderBy: { name: 'asc' },
  });
  return ings;
}

// Calculate recipe ingredient cost for a recipe loaded with recipeIngredients.ingredient
export function recipeTotalIngredientCost(recipe: {
  recipeIngredients: Array<{
    quantity: number;
    unit: string;
    ingredient: { purchaseQuantity: number; purchaseUnit: string; purchaseCost: number };
  }>;
}): number {
  return recipe.recipeIngredients.reduce((sum, ri) => {
    const ingredient = ri.ingredient;
    return (
      sum +
      convertToBase(ri.quantity, ri.unit) *
        costPerBaseUnit({
          purchaseQuantity: ingredient.purchaseQuantity,
          purchaseUnit: ingredient.purchaseUnit,
          purchaseCost: ingredient.purchaseCost,
        })
    );
  }, 0);
}

export function recipeTotalCost(recipe: {
  recipeIngredients: Array<{
    quantity: number;
    unit: string;
    ingredient: { purchaseQuantity: number; purchaseUnit: string; purchaseCost: number };
  }>;
  packagingCost: number;
  utilityCost: number;
  laborCost: number;
}): number {
  return (
    recipeTotalIngredientCost(recipe) +
    recipe.packagingCost +
    recipe.utilityCost +
    recipe.laborCost
  );
}

export function recipeCostPerServing(recipe: {
  recipeIngredients: Array<{
    quantity: number;
    unit: string;
    ingredient: { purchaseQuantity: number; purchaseUnit: string; purchaseCost: number };
  }>;
  packagingCost: number;
  utilityCost: number;
  laborCost: number;
  servingsProduced: number;
}): number {
  return recipeTotalCost(recipe) / recipe.servingsProduced;
}

export async function getSalesData(tenantId: string) {
  const sales = await prisma.sale.findMany({
    where: { tenantId },
    include: {
      items: { include: { product: { include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return sales.map((s) => ({
    id: s.id,
    totalAmount: s.totalAmount,
    createdAt: s.createdAt.toISOString(),
    items: s.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      productName: i.product.name,
      productId: i.productId,
      costPerUnit: recipeCostPerServing(i.product.recipe),
    })),
  }));
}

export async function getProductOutcomeSummary(tenantId: string) {
  const movements = await prisma.productMovement.findMany({
    where: { product: { tenantId } },
  });
  const summary: Record<string, number> = {};
  for (const m of movements) {
    summary[m.type] = (summary[m.type] ?? 0) + m.quantity;
  }
  return summary;
}

export async function getProductProfitability(tenantId: string) {
  const products = await prisma.product.findMany({
    where: { tenantId },
    include: { recipe: { include: { recipeIngredients: { include: { ingredient: true } } } } },
    orderBy: { name: 'asc' },
  });
  return products.map((p) => {
    const cost = recipeCostPerServing(p.recipe);
    const profit = p.sellingPrice - cost;
    const margin = p.sellingPrice > 0 ? (profit / p.sellingPrice) * 100 : 0;
    return {
      id: p.id,
      name: p.name,
      cost,
      sellingPrice: p.sellingPrice,
      profit,
      margin,
    };
  });
}