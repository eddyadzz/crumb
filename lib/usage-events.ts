/**
 * Product instrumentation event types.
 *
 * Keep these as the single source of truth — call sites must reference the
 * constants rather than typing free-form strings, so queries stay reliable.
 */
export const UsageEventType = {
  ORDER_CREATED: 'order_created',
  RECIPE_CREATED: 'recipe_created',
  FORECAST_VIEWED: 'forecast_viewed',
  SHOPPING_LIST_GENERATED: 'shopping_list_generated',
  PRODUCTION_STARTED: 'production_started',
  PRODUCTION_COMPLETED: 'production_completed',
  PRICE_CALCULATED: 'price_calculated',
  PORTAL_ORDER_RECEIVED: 'portal_order_received',
  STATUS_PAGE_VIEWED: 'status_page_viewed',
  OFFLINE_SYNC_COMPLETED: 'offline_sync_completed',
} as const;

export type UsageEventTypeValue = (typeof UsageEventType)[keyof typeof UsageEventType];
