/**
 * Pure order-profit math: "Should I accept this order?" at decision time.
 * A line's cost is the recipe's planned per-unit cost × the recipe's historical
 * variance factor (actual usage runs hotter than plan — pricing assistant uses
 * the same basis). Shortage summaries come from forecast rows. Pure — tests.
 */

import type { ForecastRow } from '@/lib/forecast';

export type OrderProfitBand = 'healthy' | 'low' | 'very_low' | 'unknown';

export interface OrderProfitInputLine {
  productName: string;
  quantity: number;
  unitPrice: number;
  /** Estimated cost per unit: planned cost × variance factor. */
  costPerUnit: number;
}

export interface OrderProfitLine {
  productName: string;
  quantity: number;
  selling: number;
  cost: number;
  profit: number;
}

export interface OrderProfit {
  lines: OrderProfitLine[];
  selling: number;
  cost: number;
  profit: number;
  marginPct: number;
  band: OrderProfitBand;
}

/** Healthy ≥ 40% · Low 20–40% · Very low < 20% (of selling price). */
export function orderProfitBand(marginPct: number): OrderProfitBand {
  if (marginPct >= 40) return 'healthy';
  if (marginPct >= 20) return 'low';
  return 'very_low';
}

export function computeOrderProfit(lines: OrderProfitInputLine[]): OrderProfit {
  const out: OrderProfitLine[] = [];
  let selling = 0;
  let cost = 0;
  for (const l of lines) {
    const lineSelling = l.quantity * l.unitPrice;
    const lineCost = l.quantity * l.costPerUnit;
    const lineProfit = lineSelling - lineCost;
    out.push({
      productName: l.productName,
      quantity: l.quantity,
      selling: lineSelling,
      cost: lineCost,
      profit: lineProfit,
    });
    selling += lineSelling;
    cost += lineCost;
  }
  const profit = selling - cost;
  const marginPct = selling > 0 ? (profit / selling) * 100 : 0;
  const hasEstimate = cost > 0;
  return {
    lines: out,
    selling,
    cost,
    profit,
    marginPct,
    band: hasEstimate ? orderProfitBand(marginPct) : 'unknown',
  };
}

export interface OrderShortageItem {
  name: string;
  need: string;
  have: string;
  estimatedCost: number;
}

export interface OrderShortageSummary {
  count: number;
  estimatedCost: number;
  items: OrderShortageItem[];
}

/** Turn forecast rows for one order into the stock-warden summary. */
export function summarizeShortages(
  rows: ForecastRow[],
  formatQuantity: (base: number, unit: string) => string,
): OrderShortageSummary {
  const items: OrderShortageItem[] = [];
  let estimatedCost = 0;
  for (const r of rows) {
    if (r.enough || r.shortageBase <= 0) continue;
    items.push({
      name: r.name,
      need: formatQuantity(r.requiredBase, r.baseUnit),
      have: formatQuantity(r.availableBase, r.baseUnit),
      estimatedCost: r.estimatedCost,
    });
    estimatedCost += r.estimatedCost;
  }
  return { count: items.length, estimatedCost, items };
}
