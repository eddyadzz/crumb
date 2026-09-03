/**
 * Pure shopping-list math (Phase I-F): turn forecast shortage rows into a
 * practical shopping list — what to buy, in which packs, at what estimated
 * cost. No server/DB/React imports.
 */

import type { ForecastRow } from '@/lib/forecast';

export interface PurchasePack {
  purchaseQuantity: number;
  purchaseUnit: string;
}

export interface ShoppingListItem {
  ingredientId: string;
  name: string;
  baseUnit: string;
  /** Amount to buy in base units (shortage, never negative). */
  toBuyBase: number;
  /**
   * Suggested packs to buy (rounded up) when the ingredient's purchase unit
   * matches its base unit; null when the pack size is unusable.
   */
  packs: number | null;
  packSize: number | null;
  packUnit: string | null;
  estimatedCost: number;
  requiredBase: number;
  availableBase: number;
}

/**
 * Convert forecast rows into shopping items. Rows with nothing to buy are
 * skipped — the caller renders them separately as "already in stock".
 */
export function buildShoppingList(
  rows: ForecastRow[],
  packs: Record<string, PurchasePack>
): ShoppingListItem[] {
  return rows
    .filter((r) => !r.enough && r.shortageBase > 0)
    .map((r) => {
      const pack = packs[r.ingredientId];
      const packSize =
        pack && pack.purchaseUnit === r.baseUnit && pack.purchaseQuantity > 0
          ? pack.purchaseQuantity
          : null;
      return {
        ingredientId: r.ingredientId,
        name: r.name,
        baseUnit: r.baseUnit,
        toBuyBase: r.shortageBase,
        packs: packSize !== null ? Math.ceil(r.shortageBase / packSize) : null,
        packSize,
        packUnit: pack?.purchaseUnit ?? null,
        estimatedCost: r.estimatedCost,
        requiredBase: r.requiredBase,
        availableBase: r.availableBase,
      };
    });
}

export interface ShoppingListTotal {
  items: number;
  totalCost: number;
  /** Items already covered by stock (nothing to buy). */
  enoughCount: number;
}

/** Total cost + counts across the list. */
export function shoppingListTotal(rows: ForecastRow[]): ShoppingListTotal {
  return {
    items: rows.filter((r) => !r.enough).length,
    totalCost: rows.reduce((s, r) => s + r.estimatedCost, 0),
    enoughCount: rows.filter((r) => r.enough).length,
  };
}

/**
 * Stable key describing the shape of a list. Checked-off state is stored
 * under this key so a changed list (new orders, new shortages) resets ticks
 * instead of silently mis-ticking different quantities.
 */
export function shoppingListKey(items: ShoppingListItem[]): string {
  return items
    .map((i) => `${i.ingredientId}:${Math.round(i.toBuyBase)}`)
    .sort()
    .join('|');
}