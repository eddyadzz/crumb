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
  dimension: 'mass' | 'volume' | 'count' | 'length';
  /** Amount of the dimension's base unit (g / ml / pcs) in one of this unit. */
  toBase: number;
  label: string;
}

/**
 * Practical kitchen units a home baker actually thinks in. Base units are
 * grams (mass), millilitres (volume), pieces (count) — the same bases Crumb
 * stores ingredients in.
 */
// Imperial volume units are rounded onto the 240 ml-cup basis so the
// identities bakers rely on hold exactly: 3 tsp = 1 tbsp, 16 tbsp = 1 cup,
// 2 cups = 1 pint, 2 pints = 1 quart, 4 quarts = 1 gallon.
export const KITCHEN_UNITS: KitchenUnitDef[] = [
  // --- mass (base: grams) ---
  { unit: 'g', dimension: 'mass', toBase: 1, label: 'gram (g)' },
  { unit: 'kg', dimension: 'mass', toBase: 1000, label: 'kilogram (kg)' },
  { unit: 'oz', dimension: 'mass', toBase: 28.35, label: 'ounce (oz)' },
  { unit: 'lb', dimension: 'mass', toBase: 453.6, label: 'pound (lb)' },
  // --- volume (base: millilitres) ---
  { unit: 'ml', dimension: 'volume', toBase: 1, label: 'millilitre (ml)' },
  { unit: 'cl', dimension: 'volume', toBase: 10, label: 'centilitre (cl)' },
  { unit: 'dl', dimension: 'volume', toBase: 100, label: 'decilitre (dl)' },
  { unit: 'l', dimension: 'volume', toBase: 1000, label: 'litre (l)' },
  { unit: 'pinch', dimension: 'volume', toBase: 0.625, label: 'pinch (1/8 tsp)' },
  { unit: 'dash', dimension: 'volume', toBase: 0.3125, label: 'dash (1/16 tsp)' },
  { unit: 'tsp', dimension: 'volume', toBase: 5, label: 'teaspoon (tsp)' },
  { unit: 'tbsp', dimension: 'volume', toBase: 15, label: 'tablespoon (tbsp)' },
  { unit: 'fl_oz', dimension: 'volume', toBase: 30, label: 'fluid ounce (fl oz)' },
  { unit: 'jigger', dimension: 'volume', toBase: 45, label: 'jigger (1.5 fl oz)' },
  { unit: 'gill', dimension: 'volume', toBase: 120, label: 'gill (4 fl oz)' },
  { unit: 'cup', dimension: 'volume', toBase: 240, label: 'cup (240 ml)' },
  { unit: 'pint', dimension: 'volume', toBase: 480, label: 'pint (2 cups)' },
  { unit: 'quart', dimension: 'volume', toBase: 960, label: 'quart (4 cups)' },
  { unit: 'gallon', dimension: 'volume', toBase: 3840, label: 'gallon (16 cups)' },
  // --- count (base: pieces) ---
  { unit: 'pcs', dimension: 'count', toBase: 1, label: 'piece (pcs)' },
  // --- length (base: centimetres) ---
  { unit: 'cm', dimension: 'length', toBase: 1, label: 'centimetre (cm)' },
  { unit: 'in', dimension: 'length', toBase: 2.54, label: 'inch (in)' },
];

/** Convert between kitchen units. Returns null when dimensions differ
 * (e.g. grams → cups) unless an ingredient density bridges them — see
 * `convertWithIngredient`. Pure. */
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

/* ================= Temperature ================= */

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export interface OvenSetting {
  label: string;
  f: number;
  c: number;
  gas: string;
}

/** Standard oven reference — a recipe saying "180°C" or "350°F" lands here. */
export const OVEN_SETTINGS: OvenSetting[] = [
  { label: 'Very low', f: 250, c: 120, gas: '½' },
  { label: 'Low', f: 300, c: 150, gas: '2' },
  { label: 'Moderate', f: 350, c: 175, gas: '4' },
  { label: 'Moderately hot', f: 375, c: 190, gas: '5' },
  { label: 'Hot', f: 400, c: 200, gas: '6' },
  { label: 'Very hot', f: 450, c: 230, gas: '8' },
  { label: 'Broil / grill', f: 500, c: 260, gas: '10' },
];

/** Length: inch ↔ cm. */
export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

/* ================= Ingredient density (weight ↔ volume) ================= */

export interface IngredientDensity {
  code: string;
  label: string;
  /** Grams in one 240 ml cup — the standard nutrition-label reference. */
  gramsPerCup: number;
}

/**
 * Approximate densities for common baking ingredients, used to bridge mass
 * and volume. Volume→weight for flour depends on packing, so these are
 * approximations — a scale is always more accurate.
 */
export const INGREDIENT_DENSITIES: IngredientDensity[] = [
  { code: 'water', label: 'Water / milk', gramsPerCup: 240 },
  { code: 'vegetable_oil', label: 'Vegetable oil', gramsPerCup: 216 },
  { code: 'butter', label: 'Butter', gramsPerCup: 227 },
  { code: 'honey', label: 'Honey / golden syrup', gramsPerCup: 320 },
  { code: 'granulated_sugar', label: 'Granulated sugar', gramsPerCup: 200 },
  { code: 'brown_sugar', label: 'Brown sugar (packed)', gramsPerCup: 220 },
  { code: 'powdered_sugar', label: 'Powdered sugar', gramsPerCup: 120 },
  { code: 'all_purpose_flour', label: 'All-purpose flour', gramsPerCup: 125 },
  { code: 'bread_flour', label: 'Bread flour', gramsPerCup: 130 },
  { code: 'whole_wheat_flour', label: 'Whole wheat flour', gramsPerCup: 120 },
  { code: 'cocoa_powder', label: 'Cocoa powder', gramsPerCup: 100 },
  { code: 'rolled_oats', label: 'Rolled oats', gramsPerCup: 95 },
  { code: 'shredded_coconut', label: 'Shredded coconut', gramsPerCup: 85 },
  { code: 'chocolate_chips', label: 'Chocolate chips', gramsPerCup: 170 },
  { code: 'rice', label: 'Rice (uncooked)', gramsPerCup: 185 },
];

const CUP_REF_ML = 240;

function densityFor(code: string): IngredientDensity | null {
  return INGREDIENT_DENSITIES.find((d) => d.code === code) ?? null;
}

/** Volume (ml) → weight (g) for a known ingredient. Null for unknown ones. */
export function volumeToWeight(volumeMl: number, densityCode: string): number | null {
  const d = densityFor(densityCode);
  if (!d) return null;
  return (volumeMl / CUP_REF_ML) * d.gramsPerCup;
}

/** Weight (g) → volume (ml) for a known ingredient. Null for unknown ones. */
export function weightToVolume(weightG: number, densityCode: string): number | null {
  const d = densityFor(densityCode);
  if (!d) return null;
  return (weightG / d.gramsPerCup) * CUP_REF_ML;
}
