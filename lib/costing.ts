export const UNIT_OPTIONS = ['g', 'kg', 'ml', 'l', 'pcs'] as const;
export type Unit = (typeof UNIT_OPTIONS)[number];

const UNIT_CONVERSIONS: Record<Unit, number> = {
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

export function convertToBase(quantity: number, unit: string): number {
  return quantity * (UNIT_CONVERSIONS[unit as Unit] ?? 1);
}

export function formatBaseQuantity(base: number, unit: string): string {
  if (unit === 'g' || unit === 'ml') {
    if (base >= 1000) {
      return `${(base / 1000).toFixed(2)} ${unit === 'g' ? 'kg' : 'l'}`;
    }
    return `${base.toFixed(0)} ${unit}`;
  }
  return `${base.toFixed(0)} ${unit}`;
}

export function formatMVR(amount: number): string {
  return `${amount.toFixed(2)} MVR`;
}

export interface CostInputs {
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseCost: number;
}

export function costPerBaseUnit(inputs: CostInputs): number {
  const baseQty = convertToBase(inputs.purchaseQuantity, inputs.purchaseUnit);
  if (baseQty === 0) return 0;
  return inputs.purchaseCost / baseQty;
}

export interface RecipeCostItem {
  quantity: number;
  unit: string;
  ingredient?: CostInputs;
}

export function recipeIngredientCost(item: RecipeCostItem): number {
  if (!item.ingredient) return 0;
  const baseQty = convertToBase(item.quantity, item.unit);
  return baseQty * costPerBaseUnit(item.ingredient);
}
