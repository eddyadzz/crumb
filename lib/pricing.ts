/**
 * Pure pricing math for the Pricing & Profit Assistant (Phase I-E).
 * No server/DB/React imports — shared by the pricing page and unit tests.
 *
 * Margin here is always margin-on-price: profit / selling price. The inverse
 * (price for a target margin) is cost / (1 - margin), e.g. MVR 185 of cost at
 * a 30% margin needs a MVR 264 price so that profit (79) is 30% of 264.
 */

export const TARGET_MARGINS = [30, 40, 50] as const;
/** Prices are rounded up to this step so shelf prices stay practical. */
export const SHELF_STEP = 5;

/** Selling price needed so that `cost` leaves `marginPct` of the price. */
export function priceForMargin(cost: number, marginPct: number): number {
  if (cost <= 0) return 0;
  const m = Math.min(Math.max(marginPct, 0), 99) / 100;
  return cost / (1 - m);
}

/** Round a price up to a practical shelf price (default: nearest 5 MVR). */
export function shelfPrice(price: number, step = SHELF_STEP): number {
  if (price <= 0) return 0;
  return Math.ceil(price / step) * step;
}

/** Margin on price at a given selling price; negative when selling below cost. */
export function marginOf(price: number, cost: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

/** Profit per unit at a selling price. */
export function profitOf(price: number, cost: number): number {
  return price - cost;
}

/**
 * Scale planned cost into an actual cost using the recipe's recorded usage
 * variance (+12.8% overrun → factor 1.128). No batches yet → factor 1.
 */
export function actualCostFactor(varianceCostPct: number | null): number {
  if (varianceCostPct === null) return 1;
  return Math.max(0, 1 + varianceCostPct / 100);
}

export interface PriceRung {
  marginPct: number;
  /** Exact price for the target margin. */
  price: number;
  /** Practical shelf price (rounded up). */
  shelf: number;
  /** Profit per unit at the shelf price. */
  profit: number;
  /** True for the recommended rung (40% target). */
  recommended: boolean;
}

/** The suggested price ladder for a cost. */
export function suggestPriceLadder(
  cost: number,
  margins: readonly number[] = TARGET_MARGINS,
  step = SHELF_STEP
): PriceRung[] {
  return margins.map((m) => {
    const price = priceForMargin(cost, m);
    const shelf = shelfPrice(price, step);
    return {
      marginPct: m,
      price,
      shelf,
      profit: profitOf(shelf, cost),
      recommended: m === 40,
    };
  });
}

export type PricingVerdict = 'below-target' | 'on-target' | 'unpriced' | 'no-cost';

/** How the current price compares to the 30% floor. */
export function pricingVerdict(currentPrice: number | null, actualCost: number): PricingVerdict {
  if (currentPrice === null) return 'unpriced';
  if (actualCost <= 0) return 'no-cost';
  return marginOf(currentPrice, actualCost) < 30 ? 'below-target' : 'on-target';
}

export interface PricingSummary {
  plannedCost: number;
  /** Planned cost scaled by recorded usage variance. */
  actualCost: number;
  hasUsageData: boolean;
  currentPrice: number | null;
  profitAtCurrent: number | null;
  marginAtCurrent: number | null;
  verdict: PricingVerdict;
  ladder: PriceRung[];
}

/** Everything the pricing card needs, from pure inputs. */
export function pricingSummary(input: {
  plannedCost: number;
  varianceCostPct: number | null;
  currentPrice: number | null;
}): PricingSummary {
  const factor = actualCostFactor(input.varianceCostPct);
  const actualCost = input.plannedCost * factor;
  const hasUsageData = input.varianceCostPct !== null;
  const currentPrice = input.currentPrice;
  const marginAtCurrent =
    currentPrice !== null && currentPrice > 0 ? marginOf(currentPrice, actualCost) : null;
  return {
    plannedCost: input.plannedCost,
    actualCost,
    hasUsageData,
    currentPrice,
    profitAtCurrent: currentPrice !== null ? profitOf(currentPrice, actualCost) : null,
    marginAtCurrent,
    verdict: pricingVerdict(currentPrice, actualCost),
    ladder: suggestPriceLadder(actualCost),
  };
}