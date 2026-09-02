import type { OrderStatus } from '@prisma/client';

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY',
  'DELIVERED',
  'CANCELLED',
];

/** Legal, monotonic forward transitions (CANCELLED is terminal). */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function orderTotal(lines: { quantity: number; unitPrice: number }[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

export interface OrderLineToPlan {
  productId: string;
  quantity: number;
  recipeId: string;
  recipeName: string;
  servingsProduced: number;
  productType: string;
}

/**
 * Roll customer units up into a production plan (recipe + batchCount).
 *
 * Batch yields from `completeProductionOrder`:
 *   WHOLE product   -> servingsProduced units per batch
 *   PORTION product -> batchCount units per batch
 * So to cover `quantity` ordered:
 *   WHOLE   -> ceil(quantity / servingsProduced) batches
 *   PORTION -> quantity batches
 */
export function planFromOrderLines(lines: OrderLineToPlan[]): {
  recipeItems: Array<{ recipeId: string; recipeName: string; batchCount: number }>;
} {
  const map = new Map<string, { recipeId: string; recipeName: string; batchCount: number }>();
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const batches =
      line.productType === 'WHOLE'
        ? Math.ceil(line.quantity / Math.max(1, line.servingsProduced))
        : line.quantity;
    const existing = map.get(line.recipeId);
    if (existing) {
      existing.batchCount += batches;
    } else {
      map.set(line.recipeId, {
        recipeId: line.recipeId,
        recipeName: line.recipeName,
        batchCount: batches,
      });
    }
  }
  return { recipeItems: [...map.values()] };
}