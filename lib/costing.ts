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

/* ================= Kitchen conversion layer ================= */

export interface KitchenUnitDef {
  unit: string;
  dimension: 'mass' | 'volume' | 'count';
  /** Amount of the dimension's base unit (g / ml / pcs) in one of this unit. */
  toBase: number;
  label: string;
}

/**
 * Practical kitchen units a home baker actually thinks in. Base units are
 * grams (mass), millilitres (volume), pieces (count) — the same bases Crumb
 * stores ingredients in.
 */
export const KITCHEN_UNITS: KitchenUnitDef[] = [
  { unit: 'g', dimension: 'mass', toBase: 1, label: 'gram (g)' },
  { unit: 'kg', dimension: 'mass', toBase: 1000, label: 'kilogram (kg)' },
  { unit: 'oz', dimension: 'mass', toBase: 28, label: 'ounce (oz)' },
  { unit: 'lb', dimension: 'mass', toBase: 454, label: 'pound (lb)' },
  { unit: 'ml', dimension: 'volume', toBase: 1, label: 'millilitre (ml)' },
  { unit: 'l', dimension: 'volume', toBase: 1000, label: 'litre (l)' },
  { unit: 'tsp', dimension: 'volume', toBase: 5, label: 'teaspoon (tsp)' },
  { unit: 'tbsp', dimension: 'volume', toBase: 15, label: 'tablespoon (tbsp)' },
  { unit: 'cup', dimension: 'volume', toBase: 240, label: 'cup (240 ml)' },
  { unit: 'pcs', dimension: 'count', toBase: 1, label: 'piece (pcs)' },
];

/** Convert between kitchen units. Returns null when dimensions differ
 * (e.g. grams → cups) — there is no universal density. Pure. */
export function convertKitchenUnits(
  amount: number,
  from: string,
  to: string,
): number | null {
  const fromDef = KITCHEN_UNITS.find((u) => u.unit === from);
  const toDef = KITCHEN_UNITS.find((u) => u.unit === to);
  if (!fromDef || !toDef || fromDef.dimension !== toDef.dimension) return null;
  return (amount * fromDef.toBase) / toDef.toBase;
}
