import { describe, expect, it } from 'vitest';
import {
  withActor,
  ACTIVITY_TYPE_LABEL,
  defaultTitle,
} from '@/lib/activity-core';

describe('activity-core', () => {
  it('exposes a label and default title for every activity type', () => {
    expect(ACTIVITY_TYPE_LABEL.ORDER_CREATED).toBe('Order created');
    expect(ACTIVITY_TYPE_LABEL.SALE_COMPLETED).toBe('Sale completed');
    expect(ACTIVITY_TYPE_LABEL.UPGRADE_REJECTED).toBe('Upgrade rejected');
    expect(defaultTitle('SYSTEM')).toBe('System');
    expect(defaultTitle('PRODUCTION_COMPLETED')).toBe('Production completed');
  });

  it('withActor prefixes the actor name onto a title', () => {
    expect(withActor({ actorName: 'Ahmed', type: 'ORDER_CREATED', title: 'created Order #102' })).toBe(
      'Ahmed created Order #102'
    );
  });

  it('withActor leaves the title unchanged when there is no actor', () => {
    expect(withActor({ actorName: null, type: 'SYSTEM', title: 'Backup ran' })).toBe('Backup ran');
    expect(withActor({ actorName: undefined, type: 'SALE_COMPLETED', title: 'Sale completed' })).toBe(
      'Sale completed'
    );
  });

  it('every recordable type has a non-empty label', () => {
    const types = [
      'ORDER_CREATED',
      'ORDER_CONFIRMED',
      'ORDER_CANCELLED',
      'PRODUCTION_CREATED',
      'PRODUCTION_COMPLETED',
      'PRODUCTION_CANCELLED',
      'SALE_COMPLETED',
      'UPGRADE_REQUESTED',
      'UPGRADE_APPROVED',
      'UPGRADE_REJECTED',
      'USER_INVITED',
      'USER_REMOVED',
      'SYSTEM',
    ] as const;
    for (const t of types) {
      expect(ACTIVITY_TYPE_LABEL[t].trim().length).toBeGreaterThan(0);
    }
  });
});