import { describe, expect, it } from 'vitest';
import { UsageEventType } from '@/lib/usage-events';
import type { UsageEventTypeValue } from '@/lib/usage-events';

describe('usage event type constants', () => {
  it('exposes the highest-value product events', () => {
    expect(UsageEventType.ORDER_CREATED).toBe('order_created');
    expect(UsageEventType.RECIPE_CREATED).toBe('recipe_created');
    expect(UsageEventType.FORECAST_VIEWED).toBe('forecast_viewed');
    expect(UsageEventType.SHOPPING_LIST_GENERATED).toBe('shopping_list_generated');
    expect(UsageEventType.PRODUCTION_STARTED).toBe('production_started');
    expect(UsageEventType.PRODUCTION_COMPLETED).toBe('production_completed');
    expect(UsageEventType.PRICE_CALCULATED).toBe('price_calculated');
    expect(UsageEventType.PORTAL_ORDER_RECEIVED).toBe('portal_order_received');
    expect(UsageEventType.STATUS_PAGE_VIEWED).toBe('status_page_viewed');
    expect(UsageEventType.OFFLINE_SYNC_COMPLETED).toBe('offline_sync_completed');
  });

  it('keeps every value a distinct snake_case string', () => {
    const values = Object.values(UsageEventType) as UsageEventTypeValue[];
    expect(values.length).toBe(Object.keys(UsageEventType).length);
    for (const v of values) {
      expect(v).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});
