/**
 * Pure morning-briefing math (Phase J-7): turn tomorrow's confirmed orders
 * into the daily reminder a baker actually wants — what's due, how many
 * batches to plan, what to buy, and the expected revenue. No server/DB/React
 * imports.
 */

import { formatBaseQuantity } from '@/lib/costing';
import type { BatchPlan } from '@/lib/forecast';

export interface BriefingOrderItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface BriefingInput {
  /** The day the orders are due (usually tomorrow). */
  forDate: Date;
  /** Confirmed orders due that day. */
  orders: Array<{
    items: BriefingOrderItem[];
    totalAmount: number;
  }>;
  /** Batch plan aggregated for those orders (same math as planning). */
  batches: BatchPlan[];
  /** Forecast rows for the window; shortages are surfaced. */
  shortageRows: Array<{ name: string; shortageBase: number; baseUnit: string; enough: boolean }>;
}

export interface BriefingLine {
  label: string;
}

export interface Briefing {
  dateLabel: string;
  ordersCount: number;
  /** Merged product lines across orders, e.g. "Birthday Cake ×2". */
  orderLines: BriefingLine[];
  batchesNeeded: number;
  batchLines: BriefingLine[];
  /** Capped shortage lines, e.g. "Butter (500g)". */
  shortages: BriefingLine[];
  expectedRevenue: number;
  hasContent: boolean;
}

/** Merge order items into "Product ×N" lines, keyed by product id. */
export function mergeOrderLines(
  orders: BriefingInput['orders']
): BriefingLine[] {
  const map = new Map<string, { name: string; qty: number }>();
  for (const o of orders) {
    for (const item of o.items) {
      if (item.quantity <= 0) continue;
      const e = map.get(item.productId);
      if (e) e.qty += item.quantity;
      else map.set(item.productId, { name: item.productName, qty: item.quantity });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
    .map((e) => ({ label: `${e.name} ×${e.qty}` }));
}

export function buildBriefing(input: BriefingInput): Briefing {
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(input.forDate);

  const shortages = input.shortageRows
    .filter((r) => !r.enough && r.shortageBase > 0)
    .slice(0, 4)
    .map((r) => ({ label: `${r.name} (${formatBaseQuantity(r.shortageBase, r.baseUnit)})` }));

  return {
    dateLabel,
    ordersCount: input.orders.length,
    orderLines: mergeOrderLines(input.orders),
    batchesNeeded: input.batches.reduce((s, b) => s + b.batchCount, 0),
    batchLines: input.batches
      .slice()
      .sort((a, b) => b.batchCount - a.batchCount)
      .map((b) => ({ label: `${b.batchCount}× ${b.recipeName}` })),
    shortages,
    expectedRevenue: input.orders.reduce((s, o) => s + o.totalAmount, 0),
    hasContent: input.orders.length > 0,
  };
}

/** In-app notification copy: a compact title + message. */
export function briefingNotificationCopy(b: Briefing): { title: string; message: string } {
  const title = `${b.ordersCount} order${b.ordersCount === 1 ? '' : 's'} due ${b.dateLabel}`;
  const parts = [
    b.orderLines.slice(0, 3).map((l) => l.label).join(', ') +
      (b.orderLines.length > 3 ? ` +${b.orderLines.length - 3} more` : ''),
    `${b.batchesNeeded} batch${b.batchesNeeded === 1 ? '' : 'es'} to plan`,
    b.shortages.length > 0
      ? `${b.shortages.length} ingredient shortage${b.shortages.length === 1 ? '' : 's'}`
      : null,
    `Expected revenue ${Math.round(b.expectedRevenue)} MVR`,
  ].filter(Boolean);
  return { title, message: parts.join(' · ') };
}

/** Plain-text morning briefing (email body / chat). */
export function briefingText(b: Briefing, tenantName: string): string {
  const lines: string[] = [`Morning briefing for ${tenantName} — due ${b.dateLabel}:`, ''];
  for (const l of b.orderLines) lines.push(`• ${l.label}`);
  lines.push('');
  lines.push(`Need production: ${b.batchesNeeded} batch${b.batchesNeeded === 1 ? '' : 'es'}`);
  for (const l of b.batchLines) lines.push(`  - ${l.label}`);
  if (b.shortages.length > 0) {
    lines.push('');
    lines.push('Ingredient shortages:');
    for (const l of b.shortages) lines.push(`  - ${l.label}`);
  }
  lines.push('');
  lines.push(`Expected revenue: ${Math.round(b.expectedRevenue)} MVR`);
  return lines.join('\n');
}