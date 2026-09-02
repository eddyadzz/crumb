import { describe, expect, it } from 'vitest';
import {
  lowStockNotice,
  productionDueNotice,
  ordersDueNotice,
  prefersEmail,
  nonDuplicateDrafts,
  type TenantNotifPrefs,
} from '@/lib/notifications-core';

const ALL_ON: TenantNotifPrefs = {
  notifLowStockEmail: true,
  notifOrdersEmail: true,
  notifProductionEmail: true,
  notifBillingEmail: true,
  notifTrialEmail: true,
};

const ALL_OFF: TenantNotifPrefs = {
  notifLowStockEmail: false,
  notifOrdersEmail: false,
  notifProductionEmail: false,
  notifBillingEmail: false,
  notifTrialEmail: false,
};

describe('prefersEmail', () => {
  it('respects each per-tenant toggle', () => {
    expect(prefersEmail(ALL_OFF, 'LOW_STOCK')).toBe(false);
    expect(prefersEmail(ALL_ON, 'LOW_STOCK')).toBe(true);
    expect(prefersEmail(ALL_OFF, 'CUSTOMER_ORDER')).toBe(false);
    expect(prefersEmail(ALL_OFF, 'PRODUCTION')).toBe(false);
    expect(prefersEmail(ALL_OFF, 'TRIAL')).toBe(false);
    expect(prefersEmail(ALL_OFF, 'UPGRADE_REQUEST')).toBe(false);
    expect(prefersEmail(ALL_OFF, 'BILLING')).toBe(false);
  });

  it('maps aliases to the right toggle', () => {
    const onlyOrders = { ...ALL_OFF, notifOrdersEmail: true };
    expect(prefersEmail(onlyOrders, 'CUSTOMER_ORDER')).toBe(true);
    expect(prefersEmail(onlyOrders, 'LOW_STOCK')).toBe(false);
  });

  it('defaults SYSTEM email to on regardless of toggles', () => {
    expect(prefersEmail(ALL_OFF, 'SYSTEM')).toBe(true);
  });
});

describe('draft generators', () => {
  it('low stock is a WARNING with a link to ingredients', () => {
    const d = lowStockNotice(3);
    expect(d.type).toBe('LOW_STOCK');
    expect(d.severity).toBe('WARNING');
    expect(d.link).toBe('/ingredients');
    expect(d.title).toContain('3');
  });

  it('low stock pluralizes correctly', () => {
    expect(lowStockNotice(1).title).toBe('1 ingredient running low');
    expect(lowStockNotice(2).title).toBe('2 ingredients running low');
  });

  it('production due is INFO linking to the schedule', () => {
    const d = productionDueNotice(2);
    expect(d.severity).toBe('INFO');
    expect(d.link).toBe('/schedule');
    expect(d.title).toContain('2');
  });

  it('orders due builds today/tomorrow copy', () => {
    expect(ordersDueNotice(1, false).title).toContain('due today');
    expect(ordersDueNotice(5, true).title).toContain('5 customer orders due tomorrow');
    // Large tomorrow count escalates to a warning so it surfaces.
    expect(ordersDueNotice(6, true).severity).toBe('WARNING');
    expect(ordersDueNotice(2, true).severity).toBe('INFO');
  });
});

describe('nonDuplicateDrafts', () => {
  const today = new Date('2026-09-03T08:00:00Z');
  const counts = {
    lowStock: 2,
    production: 3,
    ordersToday: 1,
    ordersTomorrow: 4,
    dayKey: '2026-09-03',
  };

  it('creates notices for each new source and emails per prefs', () => {
    const { drafts, emailLines } = nonDuplicateDrafts([], '2026-09-03', counts, ALL_ON);
    expect(drafts.map((d) => d.type)).toEqual(['LOW_STOCK', 'PRODUCTION', 'CUSTOMER_ORDER', 'CUSTOMER_ORDER']);
    // Orders email only pushes the today line (ordersToday present); tomorrow is deferred.
    expect(emailLines).toHaveLength(3); // low stock + production + orders today
  });

  it('emails the orders line only when no orders are due today', () => {
    const c = { ...counts, ordersToday: 0 };
    const { drafts, emailLines } = nonDuplicateDrafts([], '2026-09-03', c, ALL_ON);
    expect(drafts).toHaveLength(3);
    expect(emailLines).toHaveLength(3);
  });

  it('dedups a source already delivered today', () => {
    const existing = [
      { type: 'LOW_STOCK' as const, createdAt: today },
      { type: 'PRODUCTION' as const, createdAt: today },
    ];
    const { drafts } = nonDuplicateDrafts(existing, '2026-09-03', counts, ALL_OFF);
    expect(drafts.map((d) => d.type)).toEqual(['CUSTOMER_ORDER', 'CUSTOMER_ORDER']);
  });

  it('does not dedup a source delivered on a previous day', () => {
    const old = new Date('2026-09-02T08:00:00Z');
    const { drafts } = nonDuplicateDrafts(
      [{ type: 'LOW_STOCK' as const, createdAt: old }],
      '2026-09-03',
      counts,
      ALL_OFF
    );
    expect(drafts.map((d) => d.type)).toContain('LOW_STOCK');
  });

  it('produces nothing when prefs disable email', () => {
    const { drafts, emailLines } = nonDuplicateDrafts([], '2026-09-03', { ...counts, ordersToday: 0 }, ALL_OFF);
    expect(drafts).toHaveLength(3);
    expect(emailLines).toHaveLength(0);
  });
});