import type {
  Ingredient,
  Recipe,
  ProductionOrder,
  Product,
  Sale,
  IngredientMovement,
  ProductMovement,
  Unit,
} from './types';
import { convertToBase } from './types';

export const ingredients: Ingredient[] = [
  {
    id: 'ing-1',
    name: 'Butter',
    baseUnit: 'g',
    purchaseQuantity: 1000,
    purchaseUnit: 'g',
    purchaseCost: 50,
    availableQuantity: 820,
    reorderLevel: 200,
    notes: 'Unsalted, stored in fridge',
    createdAt: '2025-08-01T08:00:00Z',
    updatedAt: '2025-08-29T10:00:00Z',
  },
  {
    id: 'ing-2',
    name: 'Sugar',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    purchaseCost: 35,
    availableQuantity: 1450,
    reorderLevel: 500,
    createdAt: '2025-08-01T08:00:00Z',
    updatedAt: '2025-08-28T14:00:00Z',
  },
  {
    id: 'ing-3',
    name: 'Cream Cheese',
    baseUnit: 'g',
    purchaseQuantity: 500,
    purchaseUnit: 'g',
    purchaseCost: 120,
    availableQuantity: 480,
    reorderLevel: 250,
    createdAt: '2025-08-02T08:00:00Z',
    updatedAt: '2025-08-29T10:00:00Z',
  },
  {
    id: 'ing-4',
    name: 'Flour',
    baseUnit: 'g',
    purchaseQuantity: 1,
    purchaseUnit: 'kg',
    purchaseCost: 28,
    availableQuantity: 180,
    reorderLevel: 500,
    notes: 'All-purpose',
    createdAt: '2025-08-01T08:00:00Z',
    updatedAt: '2025-08-30T09:00:00Z',
  },
  {
    id: 'ing-5',
    name: 'Eggs',
    baseUnit: 'pcs',
    purchaseQuantity: 30,
    purchaseUnit: 'pcs',
    purchaseCost: 45,
    availableQuantity: 18,
    reorderLevel: 6,
    createdAt: '2025-08-01T08:00:00Z',
    updatedAt: '2025-08-30T09:00:00Z',
  },
  {
    id: 'ing-6',
    name: 'Cocoa Powder',
    baseUnit: 'g',
    purchaseQuantity: 250,
    purchaseUnit: 'g',
    purchaseCost: 60,
    availableQuantity: 220,
    reorderLevel: 100,
    createdAt: '2025-08-03T08:00:00Z',
    updatedAt: '2025-08-28T14:00:00Z',
  },
  {
    id: 'ing-7',
    name: 'Vanilla Extract',
    baseUnit: 'ml',
    purchaseQuantity: 100,
    purchaseUnit: 'ml',
    purchaseCost: 80,
    availableQuantity: 75,
    reorderLevel: 30,
    createdAt: '2025-08-03T08:00:00Z',
    updatedAt: '2025-08-28T14:00:00Z',
  },
  {
    id: 'ing-8',
    name: 'Milk',
    baseUnit: 'ml',
    purchaseQuantity: 1,
    purchaseUnit: 'l',
    purchaseCost: 18,
    availableQuantity: 350,
    reorderLevel: 500,
    createdAt: '2025-08-04T08:00:00Z',
    updatedAt: '2025-08-30T09:00:00Z',
  },
];

export const recipes: Recipe[] = [
  {
    id: 'rec-1',
    name: 'Classic Cheese Cake',
    description: 'New York style baked cheesecake with graham crust',
    preparationTime: 90,
    instructions:
      '1. Preheat oven to 175°C.\n2. Mix graham crumbs with melted butter, press into pan.\n3. Beat cream cheese with sugar until smooth.\n4. Add eggs one at a time, then vanilla.\n5. Pour filling over crust.\n6. Bake 55 minutes, turn off oven, let cool inside 1 hour.\n7. Chill 4+ hours before serving.',
    servingsProduced: 10,
    status: 'active',
    packagingCost: 20,
    utilityCost: 15,
    laborCost: 30,
    recipeIngredients: [
      { id: 'ri-1', ingredientId: 'ing-1', quantity: 100, unit: 'g' },
      { id: 'ri-2', ingredientId: 'ing-2', quantity: 200, unit: 'g' },
      { id: 'ri-3', ingredientId: 'ing-3', quantity: 500, unit: 'g' },
      { id: 'ri-4', ingredientId: 'ing-5', quantity: 3, unit: 'pcs' },
      { id: 'ri-5', ingredientId: 'ing-7', quantity: 10, unit: 'ml' },
    ],
    createdAt: '2025-08-05T08:00:00Z',
    updatedAt: '2025-08-20T08:00:00Z',
  },
  {
    id: 'rec-2',
    name: 'Fudge Brownie',
    description: 'Dense, fudgy chocolate brownies',
    preparationTime: 45,
    instructions:
      '1. Preheat oven to 180°C.\n2. Melt butter and cocoa together.\n3. Beat in sugar, then eggs.\n4. Fold in flour.\n5. Pour into lined tray.\n6. Bake 25 minutes until set but still soft.',
    servingsProduced: 12,
    status: 'active',
    packagingCost: 10,
    utilityCost: 8,
    laborCost: 15,
    recipeIngredients: [
      { id: 'ri-6', ingredientId: 'ing-1', quantity: 150, unit: 'g' },
      { id: 'ri-7', ingredientId: 'ing-6', quantity: 80, unit: 'g' },
      { id: 'ri-8', ingredientId: 'ing-2', quantity: 250, unit: 'g' },
      { id: 'ri-9', ingredientId: 'ing-4', quantity: 100, unit: 'g' },
      { id: 'ri-10', ingredientId: 'ing-5', quantity: 4, unit: 'pcs' },
    ],
    createdAt: '2025-08-06T08:00:00Z',
    updatedAt: '2025-08-22T08:00:00Z',
  },
  {
    id: 'rec-3',
    name: 'Banana Bread',
    description: 'Moist banana bread loaf',
    preparationTime: 60,
    instructions:
      '1. Preheat oven to 175°C.\n2. Mash ripe bananas.\n3. Cream butter and sugar.\n4. Beat in eggs and bananas.\n5. Fold in flour and vanilla.\n6. Pour into loaf pan.\n7. Bake 50-55 minutes.',
    servingsProduced: 8,
    status: 'active',
    packagingCost: 12,
    utilityCost: 10,
    laborCost: 20,
    recipeIngredients: [
      { id: 'ri-11', ingredientId: 'ing-1', quantity: 80, unit: 'g' },
      { id: 'ri-12', ingredientId: 'ing-2', quantity: 150, unit: 'g' },
      { id: 'ri-13', ingredientId: 'ing-4', quantity: 200, unit: 'g' },
      { id: 'ri-14', ingredientId: 'ing-5', quantity: 2, unit: 'pcs' },
      { id: 'ri-15', ingredientId: 'ing-7', quantity: 5, unit: 'ml' },
    ],
    createdAt: '2025-08-07T08:00:00Z',
    updatedAt: '2025-08-18T08:00:00Z',
  },
];

export const productionOrders: ProductionOrder[] = [
  {
    id: 'po-1',
    status: 'completed',
    items: [{ id: 'pi-1', recipeId: 'rec-1', batchCount: 2 }],
    createdAt: '2025-08-28T07:00:00Z',
    completedAt: '2025-08-28T09:30:00Z',
  },
  {
    id: 'po-2',
    status: 'in_progress',
    items: [
      { id: 'pi-2', recipeId: 'rec-2', batchCount: 3 },
      { id: 'pi-3', recipeId: 'rec-3', batchCount: 1 },
    ],
    createdAt: '2025-08-30T06:00:00Z',
  },
  {
    id: 'po-3',
    status: 'planned',
    items: [{ id: 'pi-4', recipeId: 'rec-1', batchCount: 1 }],
    createdAt: '2025-08-31T05:00:00Z',
  },
];

export const products: Product[] = [
  {
    id: 'prod-1',
    recipeId: 'rec-1',
    name: 'Cheese Cake Slice',
    sellingPrice: 8,
    availableQuantity: 10,
    type: 'portion',
  },
  {
    id: 'prod-2',
    recipeId: 'rec-1',
    name: 'Whole Cheese Cake',
    sellingPrice: 75,
    availableQuantity: 1,
    type: 'whole',
  },
  {
    id: 'prod-3',
    recipeId: 'rec-2',
    name: 'Fudge Brownie',
    sellingPrice: 5,
    availableQuantity: 36,
    type: 'portion',
  },
  {
    id: 'prod-4',
    recipeId: 'rec-3',
    name: 'Banana Bread Slice',
    sellingPrice: 6,
    availableQuantity: 8,
    type: 'portion',
  },
];

export const sales: Sale[] = [
  {
    id: 'sale-1',
    totalAmount: 16,
    items: [{ id: 'si-1', productId: 'prod-1', quantity: 2, unitPrice: 8 }],
    createdAt: '2025-08-31T08:30:00Z',
  },
  {
    id: 'sale-2',
    totalAmount: 15,
    items: [{ id: 'si-2', productId: 'prod-3', quantity: 3, unitPrice: 5 }],
    createdAt: '2025-08-31T10:15:00Z',
  },
  {
    id: 'sale-3',
    totalAmount: 75,
    items: [{ id: 'si-3', productId: 'prod-2', quantity: 1, unitPrice: 75 }],
    createdAt: '2025-08-31T11:45:00Z',
  },
  {
    id: 'sale-4',
    totalAmount: 12,
    items: [{ id: 'si-4', productId: 'prod-4', quantity: 2, unitPrice: 6 }],
    createdAt: '2025-08-31T13:20:00Z',
  },
  {
    id: 'sale-5',
    totalAmount: 20,
    items: [{ id: 'si-5', productId: 'prod-3', quantity: 4, unitPrice: 5 }],
    createdAt: '2025-08-30T09:00:00Z',
  },
  {
    id: 'sale-6',
    totalAmount: 24,
    items: [{ id: 'si-6', productId: 'prod-1', quantity: 3, unitPrice: 8 }],
    createdAt: '2025-08-30T14:30:00Z',
  },
];

export const ingredientMovements: IngredientMovement[] = [
  { id: 'im-1', ingredientId: 'ing-1', type: 'purchase', quantity: 1000, notes: 'Initial stock', createdAt: '2025-08-01T08:00:00Z' },
  { id: 'im-2', ingredientId: 'ing-1', type: 'production', quantity: -200, notes: 'Cheese Cake batch', createdAt: '2025-08-28T07:30:00Z' },
  { id: 'im-3', ingredientId: 'ing-4', type: 'adjustment', quantity: -20, notes: 'Spillage', createdAt: '2025-08-29T10:00:00Z' },
];

export const productMovements: ProductMovement[] = [
  { id: 'pm-1', productId: 'prod-1', type: 'produced', quantity: 20, createdAt: '2025-08-28T09:30:00Z' },
  { id: 'pm-2', productId: 'prod-1', type: 'sold', quantity: 5, createdAt: '2025-08-29T10:00:00Z' },
  { id: 'pm-3', productId: 'prod-1', type: 'gifted', quantity: 2, createdAt: '2025-08-29T12:00:00Z' },
  { id: 'pm-4', productId: 'prod-1', type: 'spoiled', quantity: 3, createdAt: '2025-08-30T08:00:00Z' },
  { id: 'pm-5', productId: 'prod-3', type: 'produced', quantity: 36, createdAt: '2025-08-30T06:00:00Z' },
];

// --- Helper functions ---

export function ingredientCostPerBaseUnit(ing: Ingredient): number {
  const baseQty = convertToBase(ing.purchaseQuantity, ing.purchaseUnit);
  return ing.purchaseCost / baseQty;
}

export function recipeIngredientCost(
  recipe: Recipe,
  ingredient: Ingredient
): number {
  const ri = recipe.recipeIngredients.find(
    (r) => r.ingredientId === ingredient.id
  );
  if (!ri) return 0;
  const baseQty = convertToBase(ri.quantity, ri.unit);
  return baseQty * ingredientCostPerBaseUnit(ingredient);
}

export function recipeTotalIngredientCost(recipe: Recipe): number {
  return recipe.recipeIngredients.reduce((sum, ri) => {
    const ing = ingredients.find((i) => i.id === ri.ingredientId);
    if (!ing) return sum;
    return sum + recipeIngredientCost(recipe, ing);
  }, 0);
}

export function recipeTotalCost(recipe: Recipe): number {
  return (
    recipeTotalIngredientCost(recipe) +
    recipe.packagingCost +
    recipe.utilityCost +
    recipe.laborCost
  );
}

export function recipeCostPerServing(recipe: Recipe): number {
  return recipeTotalCost(recipe) / recipe.servingsProduced;
}

export function getIngredient(id: string): Ingredient | undefined {
  return ingredients.find((i) => i.id === id);
}

export function getRecipe(id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function formatMVR(amount: number): string {
  return `${amount.toFixed(2)} MVR`;
}

export function getLowStockIngredients(): Ingredient[] {
  return ingredients.filter((i) => i.availableQuantity <= i.reorderLevel);
}

export function getTodaysSales(): Sale[] {
  const today = '2025-08-31';
  return sales.filter((s) => s.createdAt.startsWith(today));
}

export function getTodaysRevenue(): number {
  return getTodaysSales().reduce((sum, s) => sum + s.totalAmount, 0);
}

export function getTodayProductionOrders(): ProductionOrder[] {
  const today = '2025-08-31';
  return productionOrders.filter((p) => p.createdAt.startsWith(today));
}

export function getUpcomingProduction(): ProductionOrder[] {
  return productionOrders.filter(
    (p) => p.status === 'planned' || p.status === 'in_progress'
  );
}
