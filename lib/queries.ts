import 'server-only';
import { prisma } from '@/lib/prisma';
import { convertToBase, costPerBaseUnit, formatBaseQuantity } from '@/lib/costing';
import { pricingSummary, type PricingSummary } from '@/lib/pricing';
import {
  aggregateBatches,
  forecastRequirements,
  type ForecastRow,
} from '@/lib/forecast';
import {
  buildShoppingList,
  shoppingListKey,
  shoppingListTotal,
  type ShoppingListItem,
  type ShoppingListTotal,
  type PurchasePack,
} from '@/lib/shopping-list';
import {
  computeOrderProfit,
  summarizeShortages,
  type OrderProfitBand,
  type OrderProfitLine,
} from '@/lib/order-profit';
import { actualCostFactor } from '@/lib/pricing';
import {
  customerStats,
  rankCustomers,
  insightsSummary,
  customerBadge,
  type CustomerOrderFact,
  type CustomerBadge,
  type InsightsSummary,
} from '@/lib/customer-insights';
import {
  computeCostedVariance,
  batchCostSummary,
  computeMarginImpact,
  buildVarianceTrend,
  buildWasteTrend,
  efficiencyScore,
  efficiencyBand,
  annualizeWasteLoss,
  type CostedRow,
  type EfficiencyBand,
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

/** Cost per base unit for a batch snapshot: prefer the cost frozen at
 * completion time; fall back to the ingredient's current cost for legacy
 * rows captured before snapshots existed. */
function snapshotCostPerBase(
  ia: { costPerBase: number | null },
  ingredient: { purchaseQuantity: number; purchaseUnit: string; purchaseCost: number },
): number {
  return ia.costPerBase ?? costPerBaseOf(ingredient);
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
        const costPerBase = snapshotCostPerBase(ia, ia.ingredient);
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
        const cp = snapshotCostPerBase(ia, ia.ingredient);
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

/** Selling price per recipe (first product wins) + servings per recipe. */
async function recipeRevenueMaps(tenantId: string) {
  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { recipeId: true, sellingPrice: true },
  });
  const priceByRecipe = new Map<string, number>();
  for (const p of products) {
    if (!priceByRecipe.has(p.recipeId)) priceByRecipe.set(p.recipeId, p.sellingPrice);
  }
  const recipes = await prisma.recipe.findMany({
    where: { tenantId },
    select: { id: true, servingsProduced: true },
  });
  const servingsByRecipe = new Map(recipes.map((r) => [r.id, r.servingsProduced]));
  return { priceByRecipe, servingsByRecipe };
}

function estimatedBatchRevenue(
  b: { recipeId: string; batchCount: number },
  priceByRecipe: Map<string, number>,
  servingsByRecipe: Map<string, number>
): number {
  return b.batchCount * (servingsByRecipe.get(b.recipeId) ?? 0) * (priceByRecipe.get(b.recipeId) ?? 0);
}

/** Daily planned-vs-actual cost + margin impact over a rolling window. */
export async function getVarianceTrend(tenantId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const batches = (await getCostVarianceData(tenantId)).filter(
    (b) => b.createdAt >= since
  );
  const { priceByRecipe, servingsByRecipe } = await recipeRevenueMaps(tenantId);
  return buildVarianceTrend(
    batches.map((b) => ({
      createdAt: b.createdAt,
      plannedCost: batchCostSummary(b.rows).plannedCost,
      actualCost: batchCostSummary(b.rows).actualCost,
      revenue: estimatedBatchRevenue(b, priceByRecipe, servingsByRecipe),
    })),
    days
  );
}

/** Daily waste % (produced vs spoiled/gifted/staff/sampled) over a rolling window. */
export async function getWasteTrend(tenantId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const movements = await prisma.productMovement.findMany({
    where: { product: { tenantId }, createdAt: { gte: since } },
    select: { createdAt: true, type: true, quantity: true },
  });
  return buildWasteTrend(movements, days);
}

/** Top-level margin-impact summary across every recorded batch. */
export async function getCostVarianceSummary(tenantId: string): Promise<CostVarianceSummaryVM> {
  const batches = await getCostVarianceData(tenantId);
  const plannedCost = batches.reduce((s, b) => s + batchCostSummary(b.rows).plannedCost, 0);
  const actualCost = batches.reduce((s, b) => s + batchCostSummary(b.rows).actualCost, 0);
  const costVariance = actualCost - plannedCost;

  const { priceByRecipe, servingsByRecipe } = await recipeRevenueMaps(tenantId);
  const estimatedRevenue = batches.reduce(
    (s, b) => s + estimatedBatchRevenue(b, priceByRecipe, servingsByRecipe),
    0
  );
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

/* ================= PRODUCTION EFFICIENCY METRICS (Phase I-B Sprint 3) ================= */

export interface RecipeEfficiencyVM {
  recipeId: string;
  recipeName: string;
  batches: number;
  plannedCost: number;
  actualCost: number;
  overrunPct: number;
  wastePct: number;
  score: number;
  band: EfficiencyBand;
}

export interface EfficiencyMetricsVM {
  hasData: boolean;
  score: number;
  band: EfficiencyBand;
  avgOverrunPct: number;
  avgWastePct: number;
  wasteCostInWindow: number;
  annualWasteLoss: number;
  best: { name: string; score: number } | null;
  worst: { name: string; score: number } | null;
  recipes: RecipeEfficiencyVM[];
}

/**
 * Management health numbers over a rolling window: efficiency score, average
 * batch overrun, average waste %, annualised waste loss, and a per-recipe
 * efficiency table. Computed only — no new tables.
 */
export async function getEfficiencyMetrics(tenantId: string, days = 30): Promise<EfficiencyMetricsVM> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [batches, movements] = await Promise.all([
    getCostVarianceData(tenantId),
    prisma.productMovement.findMany({
      where: {
        product: { tenantId },
        createdAt: { gte: since },
      },
      include: {
        product: {
          select: {
            recipeId: true,
            recipe: { include: { recipeIngredients: { include: { ingredient: true } } } },
          },
        },
      },
    }),
  ]);

  // Batch overrun per recipe (windowed).
  const byRecipe = new Map<string, { recipeName: string; batches: number; plannedCost: number; actualCost: number }>();
  for (const b of batches) {
    if (b.createdAt < since) continue;
    const s = batchCostSummary(b.rows);
    const e = byRecipe.get(b.recipeId) ?? {
      recipeName: b.recipeName,
      batches: 0,
      plannedCost: 0,
      actualCost: 0,
    };
    e.batches += 1;
    e.plannedCost += s.plannedCost;
    e.actualCost += s.actualCost;
    byRecipe.set(b.recipeId, e);
  }

  // Waste per recipe (windowed), costed at recipe cost per unit.
  const wasteByRecipe = new Map<string, { produced: number; wasted: number; cost: number }>();
  for (const m of movements) {
    const e = wasteByRecipe.get(m.product.recipeId) ?? { produced: 0, wasted: 0, cost: 0 };
    if (m.type === 'PRODUCED') {
      e.produced += m.quantity;
    } else if (m.type === 'SPOILED' || m.type === 'GIFTED' || m.type === 'STAFF' || m.type === 'SAMPLE') {
      e.wasted += m.quantity;
      e.cost += recipeCostPerServing(m.product.recipe) * m.quantity;
    }
    wasteByRecipe.set(m.product.recipeId, e);
  }

  const recipes: RecipeEfficiencyVM[] = [];
  const allRecipeNames = new Map(
    (await prisma.recipe.findMany({ where: { tenantId }, select: { id: true, name: true } })).map((r) => [r.id, r.name])
  );
  for (const [recipeId, e] of byRecipe) {
    const overrunPct = e.plannedCost === 0 ? 0 : ((e.actualCost - e.plannedCost) / e.plannedCost) * 100;
    const w = wasteByRecipe.get(recipeId);
    const wastePct = w && w.produced > 0 ? (w.wasted / w.produced) * 100 : 0;
    const score = efficiencyScore(wastePct, overrunPct);
    recipes.push({
      recipeId,
      recipeName: e.recipeName,
      batches: e.batches,
      plannedCost: e.plannedCost,
      actualCost: e.actualCost,
      overrunPct,
      wastePct,
      score,
      band: efficiencyBand(score),
    });
  }
  // Also surface recipes that only have waste data (produced but never batched
  // in-window is impossible for variance, but movement-only recipes still waste).
  for (const [recipeId, w] of wasteByRecipe) {
    if (byRecipe.has(recipeId) || w.produced === 0) continue;
    const wastePct = (w.wasted / w.produced) * 100;
    const score = efficiencyScore(wastePct, 0);
    recipes.push({
      recipeId,
      recipeName: allRecipeNames.get(recipeId) ?? recipeId,
      batches: 0,
      plannedCost: 0,
      actualCost: 0,
      overrunPct: 0,
      wastePct,
      score,
      band: efficiencyBand(score),
    });
  }
  recipes.sort((a, b) => b.score - a.score || a.recipeName.localeCompare(b.recipeName));

  const totalPlanned = recipes.reduce((s, r) => s + r.plannedCost, 0);
  const totalActual = recipes.reduce((s, r) => s + r.actualCost, 0);
  const totalProduced = [...wasteByRecipe.values()].reduce((s, w) => s + w.produced, 0);
  const totalWasted = [...wasteByRecipe.values()].reduce((s, w) => s + w.wasted, 0);
  const wasteCostInWindow = [...wasteByRecipe.values()].reduce((s, w) => s + w.cost, 0);

  const avgOverrunPct = totalPlanned === 0 ? 0 : ((totalActual - totalPlanned) / totalPlanned) * 100;
  const avgWastePct = totalProduced === 0 ? 0 : (totalWasted / totalProduced) * 100;
  const hasData = recipes.length > 0;
  const score = hasData ? efficiencyScore(avgWastePct, avgOverrunPct) : 0;

  return {
    hasData,
    score,
    band: efficiencyBand(score),
    avgOverrunPct,
    avgWastePct,
    wasteCostInWindow,
    annualWasteLoss: annualizeWasteLoss(wasteCostInWindow, days),
    best: recipes.length > 0 ? { name: recipes[0].recipeName, score: recipes[0].score } : null,
    worst:
      recipes.length > 1
        ? { name: recipes[recipes.length - 1].recipeName, score: recipes[recipes.length - 1].score }
        : null,
    recipes,
  };
}
/* ================= PRICING ASSISTANT (Phase I-E) ================= */

export interface RecipePricingVM extends PricingSummary {
  recipeId: string;
  recipeName: string;
  /** MVR of profit lost per unit vs the 30%-margin shelf price. */
  shortfallPerUnit: number | null;
}

/**
 * Per-recipe pricing guidance: planned cost scaled to actual usage cost
 * (from recorded batch variance), current selling price, and the suggested
 * margin ladder. Read-only — never mutates prices.
 */
export async function getPricingAssistant(tenantId: string): Promise<RecipePricingVM[]> {
  const [recipes, recipeVariance] = await Promise.all([
    prisma.recipe.findMany({
      where: { tenantId },
      include: {
        recipeIngredients: { include: { ingredient: true } },
        products: true,
      },
      orderBy: { name: 'asc' },
    }),
    getRecipeVariance(tenantId),
  ]);

  const varianceByRecipe = new Map(recipeVariance.map((r) => [r.recipeId, r.varianceCostPct]));

  const rows: RecipePricingVM[] = recipes.map((recipe) => {
    const plannedCost = recipeCostPerServing(recipe);
    const varianceCostPct = varianceByRecipe.get(recipe.id) ?? null;
    const currentPrice = recipe.products[0]?.sellingPrice ?? null;
    const summary = pricingSummary({ plannedCost, varianceCostPct, currentPrice });
    const firstRung = summary.ladder[0];
    const shortfallPerUnit =
      currentPrice !== null && firstRung && currentPrice < firstRung.shelf
        ? firstRung.shelf - currentPrice
        : null;
    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      ...summary,
      shortfallPerUnit,
    };
  });

  // Underpriced recipes first, then unpriced, then healthy ones.
  const rank: Record<string, number> = { 'below-target': 0, unpriced: 1, 'no-cost': 2, 'on-target': 3 };
  return rows.sort(
    (a, b) => rank[a.verdict] - rank[b.verdict] || (a.marginAtCurrent ?? 0) - (b.marginAtCurrent ?? 0)
  );
}

/* ================= PENDING ORDER PROFIT PREVIEW (Phase K) ================= */

export interface OrderProfitLineVM {
  productName: string;
  quantity: number;
  selling: number;
  cost: number;
  profit: number;
}

export interface OrderProfitPreviewVM {
  lines: {
    productName: string;
    quantity: number;
    selling: number;
    cost: number;
    profit: number;
  }[];
  selling: number;
  cost: number;
  profit: number;
  marginPct: number;
  band: OrderProfitBand;
  /** Historical usage overrun baked into the estimate, e.g. +15%. */
  varianceFactorPct: number | null;
  shortages: { name: string; need: string; have: string; estimatedCost: number }[];
  extraPurchaseCost: number;
}

/**
 * "Should I accept this order?" for every PENDING order at once:
 * per-line selling/cost/profit at the recipe's *actual* usage cost
 * (planned × historical variance factor), plus the stock shortfall and the
 * estimated extra purchase cost this order would require.
 */
export async function getOrderProfitPreviews(
  tenantId: string,
): Promise<Record<string, OrderProfitPreviewVM>> {
  const orders = await prisma.customerOrder.findMany({
    where: { tenantId, status: 'PENDING' },
    include: {
      customer: { select: { name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              type: true,
              recipe: {
                include: {
                  recipeIngredients: { include: { ingredient: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (orders.length === 0) return {};

  const [recipes, recipeVariance] = await Promise.all([
    prisma.recipe.findMany({
      where: { tenantId },
      include: { recipeIngredients: { include: { ingredient: true } } },
      orderBy: { name: 'asc' },
    }),
    getRecipeVariance(tenantId),
  ]);

  const varianceByRecipe = new Map(
    recipeVariance.map((r) => [r.recipeId, r.varianceCostPct]),
  );

  const forecastRecipes = recipes.map((r) => ({
    id: r.id,
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
  }));

  const result: Record<string, OrderProfitPreviewVM> = {};

  for (const order of orders) {
    const profitLines = order.items.map((i) => {
      const factor = actualCostFactor(varianceByRecipe.get(i.product.recipe.id) ?? null);
      const planned = recipeCostPerServing(i.product.recipe);
      return {
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        costPerUnit: planned * factor,
        varianceFactorPct: varianceByRecipe.get(i.product.recipe.id) ?? null,
      };
    });

    const profit = computeOrderProfit(
      profitLines.map(({ productName, quantity, unitPrice, costPerUnit }) => ({
        productName,
        quantity,
        unitPrice,
        costPerUnit,
      })),
    );

    const batches = aggregateBatches(
      order.items.map((i) => ({
        quantity: i.quantity,
        productType: i.product.type,
        servingsProduced: i.product.recipe.servingsProduced,
        recipeId: i.product.recipe.id,
        recipeName: i.product.recipe.name,
      })),
    );
    const shortageRows: (ForecastRow & { recipeId?: string })[] = forecastRequirements(
      forecastRecipes,
      batches,
    );
    const shortages = summarizeShortages(shortageRows, formatBaseQuantity);

    result[order.id] = {
      lines: profit.lines,
      selling: profit.selling,
      cost: profit.cost,
      profit: profit.profit,
      marginPct: profit.marginPct,
      band: profit.band,
      varianceFactorPct:
        profitLines.reduce<number | null>((acc, l) => l.varianceFactorPct ?? null, null),
      shortages: shortages.items,
      extraPurchaseCost: shortages.estimatedCost,
    };
  }

  return result;
}

/* ================= SHOPPING LIST (Phase I-F) ================= */

export interface ShoppingListVM {
  listKey: string;
  items: ShoppingListItem[];
  /** Ingredients already covered by stock — shown as context, not chores. */
  inStock: { name: string; requiredBase: number; baseUnit: string }[];
  total: ShoppingListTotal;
  orderCount: number;
  nextDelivery: string | null;
}

/**
 * The actionable shopping list for upcoming customer orders: forecast
 * requirements minus stock, with pack suggestions and estimated costs.
 */
export async function getShoppingList(tenantId: string): Promise<ShoppingListVM> {
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
      include: { recipeIngredients: { include: { ingredient: true } } },
    }),
  ]);

  const batches = aggregateBatches(
    orders.flatMap((o) =>
      o.items.map((i) => ({
        quantity: i.quantity,
        productType: i.product.type,
        servingsProduced: i.product.recipe.servingsProduced,
        recipeId: i.product.recipe.id,
        recipeName: i.product.recipe.name,
      }))
    )
  );

  const forecastRecipes = recipes.map((r) => ({
    id: r.id,
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
  }));

  const rows = forecastRequirements(forecastRecipes, batches);
  const packs: Record<string, PurchasePack> = {};
  for (const r of forecastRecipes) {
    for (const ri of r.ingredients) {
      packs[ri.ingredient.id] = {
        purchaseQuantity: ri.ingredient.purchaseQuantity,
        purchaseUnit: ri.ingredient.purchaseUnit,
      };
    }
  }

  const items = buildShoppingList(rows, packs);
  return {
    listKey: shoppingListKey(items),
    items,
    inStock: rows
      .filter((r) => r.enough)
      .map((r) => ({ name: r.name, requiredBase: r.requiredBase, baseUnit: r.baseUnit })),
    total: shoppingListTotal(rows),
    orderCount: orders.length,
    nextDelivery: orders[0]?.deliveryDate?.toISOString() ?? null,
  };
}

/* ================= CUSTOMER INSIGHTS (Phase I-G) ================= */

export interface CustomerInsightVM {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  orderCount: number;
  cancelledCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  lastOrderAt: string;
  daysSinceLastOrder: number;
  badge: CustomerBadge;
}

/**
 * Ranked customer book with loyalty health: revenue, repeat rate, and a
 * single human label per customer (top / loyal / new / dormant).
 */
export async function getCustomerInsights(tenantId: string): Promise<{
  summary: InsightsSummary;
  customers: CustomerInsightVM[];
}> {
  const customers = await prisma.customer.findMany({
    where: { tenantId },
    include: {
      orders: { select: { customerId: true, totalAmount: true, createdAt: true, status: true } },
    },
    orderBy: { name: 'asc' },
  });

  const facts: CustomerOrderFact[] = customers.flatMap((c) =>
    c.orders.map((o) => ({
      customerId: c.id,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      status: o.status,
    }))
  );
  const stats = customerStats(facts);
  const summary = insightsSummary(stats);
  const ranked = rankCustomers(stats);

  return {
    summary,
    customers: ranked.map((s, i) => {
      const c = customers.find((x) => x.id === s.customerId)!;
      return {
        customerId: s.customerId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        orderCount: s.orderCount,
        cancelledCount: s.cancelledCount,
        totalRevenue: s.totalRevenue,
        avgOrderValue: s.avgOrderValue,
        lastOrderAt: s.lastOrderAt,
        daysSinceLastOrder: s.daysSinceLastOrder,
        badge: customerBadge(s, i),
      };
    }),
  };
}

/* ================= SETUP PROGRESS (Phase J) ================= */

export interface SetupProgressVM {
  ingredients: number;
  recipes: number;
  pricedProducts: number;
  customerOrders: number;
  completedBatches: number;
  sales: number;
  /** Only offer sample data on a completely fresh account. */
  fresh: boolean;
}

/** Day-1 adoption checklist: what exists vs what the owner still needs to do. */
export async function getSetupProgress(tenantId: string): Promise<SetupProgressVM> {
  const [ingredients, recipes, pricedProducts, customerOrders, completedBatches, sales] =
    await Promise.all([
      prisma.ingredient.count({ where: { tenantId } }),
      prisma.recipe.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId, sellingPrice: { gt: 0 } } }),
      prisma.customerOrder.count({ where: { tenantId, status: { not: 'CANCELLED' } } }),
      prisma.productionOrder.count({ where: { tenantId, status: 'COMPLETED' } }),
      prisma.sale.count({ where: { tenantId } }),
    ]);
  return {
    ingredients,
    recipes,
    pricedProducts,
    customerOrders,
    completedBatches,
    sales,
    fresh: ingredients === 0 && recipes === 0,
  };
}
