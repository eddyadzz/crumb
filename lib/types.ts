export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';

export const UNIT_OPTIONS: Unit[] = ['g', 'kg', 'ml', 'l', 'pcs'];

export const UNIT_CONVERSIONS: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  pcs: 1,
};

export const UNIT_BASE: Record<Unit, Unit> = {
  g: 'g',
  kg: 'g',
  ml: 'ml',
  l: 'ml',
  pcs: 'pcs',
};

export function convertToBase(quantity: number, unit: Unit): number {
  return quantity * UNIT_CONVERSIONS[unit];
}

export function formatBaseQuantity(base: number, unit: Unit): string {
  if (unit === 'g' || unit === 'ml') {
    if (base >= 1000) {
      return `${(base / 1000).toFixed(2)} ${unit === 'g' ? 'kg' : 'l'}`;
    }
    return `${base.toFixed(0)} ${unit}`;
  }
  return `${base.toFixed(0)} ${unit}`;
}

export interface Ingredient {
  id: string;
  name: string;
  baseUnit: Unit;
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchaseCost: number;
  availableQuantity: number;
  reorderLevel: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: Unit;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  preparationTime: number;
  instructions: string;
  servingsProduced: number;
  status: 'active' | 'draft';
  packagingCost: number;
  utilityCost: number;
  laborCost: number;
  recipeIngredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export type ProductionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface ProductionItem {
  id: string;
  recipeId: string;
  batchCount: number;
}

export interface ProductionOrder {
  id: string;
  status: ProductionStatus;
  items: ProductionItem[];
  createdAt: string;
  completedAt?: string;
}

export interface Product {
  id: string;
  recipeId: string;
  name: string;
  sellingPrice: number;
  availableQuantity: number;
  type: 'whole' | 'portion';
}

export type ProductMovementType = 'produced' | 'sold' | 'gifted' | 'spoiled' | 'sample' | 'staff';

export interface ProductMovement {
  id: string;
  productId: string;
  type: ProductMovementType;
  quantity: number;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  totalAmount: number;
  items: SaleItem[];
  createdAt: string;
}

export interface IngredientMovement {
  id: string;
  ingredientId: string;
  type: 'purchase' | 'production' | 'adjustment';
  quantity: number;
  notes?: string;
  createdAt: string;
}
