import 'server-only';
import { prisma } from '@/lib/prisma';
import { convertToBase, costPerBaseUnit } from '@/lib/costing';
import {
  computeCostedVariance,
  batchCostSummary,
  computeMarginImpact,
  type CostedRow,
} from '@/lib/production-variance';

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

/* ================= COST VARIANCE REPORTING (Phase I-B) ================= */

/** Spread an ingredient's current purchase cost into MVR per base unit. */
function costPerBaseOf(ingredient: {
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseCost: number;
}): number {
  return costPerBaseUnit(ingredient);
}

/**
 * Load every completed production order's planned-vs-actual usage, costing each
 * snapshot at the ingredient's current purchase cost, and return the per-batch
 * costed rows grouped by production item.
 *
 * Used by both the batch/recipe variance report and the dashboard KPI.
 */
export async function getCostVarianceData(tenantId: string) {
  const orders = await prisma.productionOrder.findMany({
    where: { tenantId, status: 'COMPLETED' },
    include: {
      items: {
        include: {
          recipe: { select: { id: true, name: true, products: true } },
          ingredientActuals: { include: { ingredient: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const batches: {
    productionOrderId: string;
    batchId: string;
    recipeId: string;
    recipeName: string;
    productName: string;
    batchCount: number;
    createdAt: Date;
    rows: (CostedRow & { ingredientId: string })[];
  }[] = [];

  for (const order of orders) {
    for (const item of order.items) {
      const rows = item.ingredientActuals.map((ia) => {
        const costPerBase = costPerBaseOf(ia.ingredient);
        return computeCostedVariance([
          {
            ingredientName: ia.ingredientName,
            plannedBase: ia.plannedQuantity,
            actualBase: ia.actualQuantity,
            costPerBase,
          },
        ])[0] as CostedRow & { ingredientId: string };
      }).map((r, i) => ({ ...r, ingredientId: item.ingredientActuals[i].ingredientId }));
      batches.push({
        productionOrderId: order.id,
        batchId: item.id,
        recipeId: item.recipe.id,
        recipeName: item.recipe.name,
        productName: item.recipe.products[0]?.name ?? item.recipe.name,
        batchCount: item.batchCount,
        createdAt: order.createdAt,
        rows,
      });
    }
  }
  return batches;
}

/** The dashboard "Cost Variance (30 Days)" KPI: signed % over the last 30 days. */
export async function getCostVarianceKPI(tenantId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const orders = await prisma.productionOrder.findMany({
    where: { tenantId, status: 'COMPLETED', createdAt: { gte: since } },
    include: {
      items: { include: { ingredientActuals: { include: { ingredient: true } } } },
    },
  });

  let sumPlanned = 0;
  let sumActual = 0;
  for (const order of orders) {
    for (const item of order.items) {
      for (const ia of item.ingredientActuals) {
        const cp = costPerBaseOf(ia.ingredient);
        sumPlanned += ia.plannedQuantity * cp;
        sumActual += ia.actualQuantity * cp;
      }
    }
  }
  const overUnder = sumActual - sumPlanned;
  const varianceCostPct = sumPlanned > 0 ? (overUnder / sumPlanned) * 100 : 0;
  return {
    plannedCost: sumPlanned,
    actualCost: sumActual,
    costVariance: overUnder,
    varianceCostPct,
    hasData: sumPlanned > 0,
  };
}

export interface BatchVarianceVM {
  id: string;
  orderId: string;
  orderLabel: string;
  recipeId: string;
  recipeName: string;
  productName: string;
  batchCount: number;
  createdAt: Date;
  plannedCost: number;
  actualCost: number;
  costVariance: number;
  varianceCostPct: number;
  ingredients: (CostedRow & { ingredientId: string })[];
}

export async function getBatchVariance(tenantId: string): Promise<BatchVarianceVM[]> {
  const batches = await getCostVarianceData(tenantId);
  return batches.map((b) => {
    const s = batchCostSummary(b.rows);
    return {
      id: b.batchId,
      orderId: b.productionOrderId,
      orderLabel: `#${b.productionOrderId.slice(-6).toUpperCase()}`,
      recipeId: b.recipeId,
      recipeName: b.recipeName,
      productName: b.productName,
      batchCount: b.batchCount,
      createdAt: b.createdAt,
      plannedCost: s.plannedCost,
      actualCost: s.actualCost,
      costVariance: s.costVariance,
      varianceCostPct: s.varianceCostPct,
      ingredients: b.rows,
    };
  });
}

export interface RecipeVarianceVM {
  recipeId: string;
  recipeName: string;
  productName: string;
  batches: number;
  plannedCost: number;
  actualCost: number;
  costVariance: number;
  varianceCostPct: number;
  wastePct: number;
}

/** Aggregate all batches per recipe and correlate with production waste. */
export async function getRecipeVariance(tenantId: string): Promise<RecipeVarianceVM[]> {
  const batches = await getCostVarianceData(tenantId);
  const map = new Map<string, RecipeVarianceVM>();
  for (const b of batches) {
    const s = batchCostSummary(b.rows);
    const e = map.get(b.recipeId) ?? {
      recipeId: b.recipeId,
      recipeName: b.recipeName,
      productName: b.productName,
      batches: 0,
      plannedCost: 0,
      actualCost: 0,
      costVariance: 0,
      varianceCostPct: 0,
      wastePct: 0,
    };
    e.batches += 1;
    e.plannedCost += s.plannedCost;
    e.actualCost += s.actualCost;
    e.costVariance += s.costVariance;
    map.set(b.recipeId, e);
  }
  for (const e of map.values()) {
    e.varianceCostPct = e.plannedCost === 0 ? 0 : (e.costVariance / e.plannedCost) * 100;
  }

  // Waste correlation: per recipe, production waste (SPOILED+GIFTED+STAFF)
  // relative to PRODUCED, rolled up from the product the recipe feeds.
  const waste = await prisma.productMovement.findMany({
    where: { product: { tenantId } },
    include: { product: { select: { recipeId: true, name: true } } },
  });
  const produced = new Map<string, number>();
  const wasted = new Map<string, number>();
  const recipeToRecipeName = new Map<string, string>();
  for (const m of waste) {
    recipeToRecipeName.set(m.product.recipeId, m.product.name);
    produced.set(m.product.recipeId, (produced.get(m.product.recipeId) ?? 0) + (m.type === 'PRODUCED' ? m.quantity : 0));
    if (m.type === 'SPOILED' || m.type === 'GIFTED' || m.type === 'STAFF' || m.type === 'SAMPLE') {
      wasted.set(m.product.recipeId, (wasted.get(m.product.recipeId) ?? 0) + m.quantity);
    }
  }
  for (const e of map.values()) {
    const p = produced.get(e.recipeId) ?? 0;
    const w = wasted.get(e.recipeId) ?? 0;
    e.wastePct = p > 0 ? (w / p) * 100 : 0;
  }
  return [...map.values()];
}

export interface CostVarianceSummaryVM {
  batches: number;
  plannedCost: number;
  actualCost: number;
  costVariance: number;
  varianceCostPct: number;
  /** Revenue estimate based on the batch output value. */
  estimatedRevenue: number;
  expectedProfit: number;
  actualProfit: number;
  /** Negative = profit that disappeared. */
  marginImpact: number;
}

/** Top-level margin-impact summary across every recorded batch. */
export async function getCostVarianceSummary(tenantId: string): Promise<CostVarianceSummaryVM> {
  const batches = await getCostVarianceData(tenantId);
  const plannedCost = batches.reduce((s, b) => s + batchCostSummary(b.rows).plannedCost, 0);
  const actualCost = batches.reduce((s, b) => s + batchCostSummary(b.rows).actualCost, 0);
  const costVariance = actualCost - plannedCost;

  // Estimate the selling value of what each batch produced, so we can express
  // the margin impact in MVR (not just ingredient cost).
  const recipePrices = await prisma.product.findMany({
    where: { tenantId },
    select: { recipeId: true, sellingPrice: true },
  });
  const priceByRecipe = new Map<string, number>();
  for (const p of recipePrices) {
    if (!priceByRecipe.has(p.recipeId)) priceByRecipe.set(p.recipeId, p.sellingPrice);
  }
  const recipes = await prisma.recipe.findMany({
    where: { tenantId },
    select: { id: true, servingsProduced: true },
  });
  const servingsByRecipe = new Map(recipes.map((r) => [r.id, r.servingsProduced]));
  let estimatedRevenue = 0;
  for (const b of batches) {
    const servings = servingsByRecipe.get(b.recipeId) ?? 0;
    const units = b.batchCount * servings;
    estimatedRevenue += units * (priceByRecipe.get(b.recipeId) ?? 0);
  }
  const mi = computeMarginImpact(estimatedRevenue, plannedCost, actualCost);

  return {
    batches: batches.length,
    plannedCost,
    actualCost,
    costVariance,
    varianceCostPct: plannedCost === 0 ? 0 : (costVariance / plannedCost) * 100,
    estimatedRevenue,
    expectedProfit: mi.expectedProfit,
    actualProfit: mi.actualProfit,
    marginImpact: mi.impact,
  };
}