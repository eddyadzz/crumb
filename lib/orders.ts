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

/** DateKey is a local, calendar-day `YYYY-MM-DD` identifier (no UTC shift). */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Group customer orders into a schedule keyed by their delivery date.
 * Orders without a delivery date are bucketed under `null`, which the UI can
 * surface separately as "unscheduled". Returns days in ascending order.
 */
export function groupOrdersByDay<T>(
  orders: Array<T & { deliveryDate: Date | string | null }>
): Array<{ key: string | null; orders: Array<T & { deliveryDate: Date | string | null }> }> {
  const map = new Map<string | null, Array<T & { deliveryDate: Date | string | null }>>();
  for (const order of orders) {
    const key = order.deliveryDate ? dateKey(new Date(order.deliveryDate)) : null;
    const bucket = map.get(key) ?? [];
    bucket.push(order);
    map.set(key, bucket);
  }
  const dated = [...map.entries()]
    .filter(([key]) => key !== null)
    .sort(([a], [b]) => (a! < b! ? -1 : a! > b! ? 1 : 0));
  const unscheduled = map.get(null);
  const days = dated.map(([key, list]) => ({ key, orders: list }));
  if (unscheduled) days.push({ key: null, orders: unscheduled });
  return days;
}

/** Return the day keys within a schedule window starting at `start` (inclusive). */
export function windowDayKeys(start: Date, days: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(dateKey(d));
  }
  return keys;
}

/**
 * Return a Sunday-aligned calendar grid for the month containing `anchor`
 * (rows of 7, enough to cover the month, empty cells left/right are null).
 */
export function monthGridKeys(anchor: Date): { grid: Array<string | null>; monthKey: string } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lead = start.getDay(); // 0 = Sunday
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const keys = windowDayKeys(start, daysInMonth);
  const grid: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...keys,
  ];
  while (grid.length % 7 !== 0) grid.push(null);
  return { grid, monthKey: dateKey(start) };
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