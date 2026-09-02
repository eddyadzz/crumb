/**
 * Pure notification logic — no server/DB/React imports so it is unit-testable.
 * Given per-run counts and already-delivered notifications, decide which
 * in-app notices (and email lines) should be created for a tenant.
 */
import type { NotificationSeverity, NotificationType } from '@prisma/client';

export interface NotificationDraft {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message?: string;
  link?: string;
}

export interface TenantNotifPrefs {
  notifLowStockEmail: boolean;
  notifOrdersEmail: boolean;
  notifProductionEmail: boolean;
  notifBillingEmail: boolean;
  notifTrialEmail: boolean;
}

/** True when the tenant opted into email for this notification type. */
export function prefersEmail(tenant: TenantNotifPrefs, type: NotificationType): boolean {
  switch (type) {
    case 'LOW_STOCK':
      return tenant.notifLowStockEmail;
    case 'CUSTOMER_ORDER':
      return tenant.notifOrdersEmail;
    case 'PRODUCTION':
      return tenant.notifProductionEmail;
    case 'BILLING':
    case 'UPGRADE_REQUEST':
      return tenant.notifBillingEmail;
    case 'TRIAL':
      return tenant.notifTrialEmail;
    default:
      return true;
  }
}

/** One low-stock summary notice per run (aggregated by the caller). */
export function lowStockNotice(lowCount: number): NotificationDraft {
  return {
    type: 'LOW_STOCK',
    severity: 'WARNING',
    title: `${lowCount} ingredient${lowCount > 1 ? 's' : ''} running low`,
    message: `Reorder before your next production run.`,
    link: '/ingredients',
  };
}

export function productionDueNotice(batchCount: number): NotificationDraft {
  return {
    type: 'PRODUCTION',
    severity: 'INFO',
    title: `${batchCount} production batch${batchCount > 1 ? 'es' : ''} due today`,
    message: 'Open the schedule to plan your day.',
    link: '/schedule',
  };
}

export function ordersDueNotice(orderCount: number, tomorrow: boolean): NotificationDraft {
  return {
    type: 'CUSTOMER_ORDER',
    severity: orderCount > 3 ? 'WARNING' : 'INFO',
    title: `${orderCount} customer order${orderCount > 1 ? 's' : ''} due ${tomorrow ? 'tomorrow' : 'today'}`,
    message: 'Review and prepare for delivery.',
    link: '/orders',
  };
}

export interface NotificationCounts {
  lowStock: number;
  production: number;
  ordersToday: number;
  ordersTomorrow: number;
  dayKey: string;
}

export interface DigestLine {
  severity: NotificationSeverity;
  text: string;
}

export interface DraftResult {
  drafts: NotificationDraft[];
  emailLines: DigestLine[];
}

/**
 * Decide which daily notices are new for a tenant (not already delivered for
 * the same calendar day) and which are eligible for email, given prefs.
 */
export function nonDuplicateDrafts(
  existing: Array<{ type: NotificationType; createdAt: Date }>,
  todayKey: string,
  counts: NotificationCounts,
  tenant: TenantNotifPrefs
): DraftResult {
  const drafts: NotificationDraft[] = [];
  const emailLines: DigestLine[] = [];

  const seenToday = (type: NotificationType) =>
    existing.some(
      (n) => n.type === type && n.createdAt.toISOString().slice(0, 10) === todayKey
    );

  if (!seenToday('LOW_STOCK') && counts.lowStock > 0) {
    const d = lowStockNotice(counts.lowStock);
    drafts.push(d);
    if (prefersEmail(tenant, 'LOW_STOCK')) emailLines.push({ severity: d.severity, text: `${d.title} — ${d.message}` });
  }
  if (!seenToday('PRODUCTION') && counts.production > 0) {
    const d = productionDueNotice(counts.production);
    drafts.push(d);
    if (prefersEmail(tenant, 'PRODUCTION')) emailLines.push({ severity: d.severity, text: `${d.title} — ${d.message}` });
  }
  if (!seenToday('CUSTOMER_ORDER') && counts.ordersToday > 0) {
    const d = ordersDueNotice(counts.ordersToday, false);
    drafts.push(d);
    if (prefersEmail(tenant, 'CUSTOMER_ORDER')) emailLines.push({ severity: d.severity, text: `${d.title} — ${d.message}` });
  }
  if (!seenToday('CUSTOMER_ORDER') && counts.ordersTomorrow > 0) {
    // Orders today + tomorrow share a type; only email the tomorrow line so we
    // don't double-upsell. A notice is created for each distinct day.
    const d = ordersDueNotice(counts.ordersTomorrow, true);
    drafts.push(d);
    if (!counts.ordersToday && prefersEmail(tenant, 'CUSTOMER_ORDER'))
      emailLines.push({ severity: d.severity, text: `${d.title} — ${d.message}` });
  }

  return { drafts, emailLines };
}