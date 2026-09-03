import { describe, expect, it } from 'vitest';
import { orderTimeline } from '@/lib/orders';
import { newOrderPublicToken, isValidOrderPublicToken } from '@/lib/public-token';

describe('order status timeline', () => {
  it('shows only receipt for pending orders', () => {
    const steps = orderTimeline('PENDING');
    expect(steps[0]).toEqual({ key: 'PENDING', label: 'Order Received', done: true });
    expect(steps.filter((s) => s.done)).toHaveLength(1);
    expect(steps.map((s) => s.label)).toEqual([
      'Order Received',
      'Order Confirmed',
      'In Production',
      'Ready for Pickup',
      'Delivered',
    ]);
  });

  it('marks steps progressively as the order advances', () => {
    expect(orderTimeline('CONFIRMED').filter((s) => s.done).map((s) => s.key)).toEqual(['PENDING', 'CONFIRMED']);
    expect(orderTimeline('IN_PRODUCTION').filter((s) => s.done)).toHaveLength(3);
    expect(orderTimeline('READY').filter((s) => s.done)).toHaveLength(4);
    expect(orderTimeline('DELIVERED').every((s) => s.done)).toBe(true);
  });
});

describe('order public tokens', () => {
  it('generates unguessable ord_ tokens in a fixed format', () => {
    const t = newOrderPublicToken();
    expect(isValidOrderPublicToken(t)).toBe(true);
    expect(t).toMatch(/^ord_[0-9a-f]{12}$/);
  });

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newOrderPublicToken()));
    expect(tokens.size).toBe(200);
  });

  it('rejects malformed or sequential ids', () => {
    expect(isValidOrderPublicToken('1042')).toBe(false);
    expect(isValidOrderPublicToken('ord_XXXX')).toBe(false);
    expect(isValidOrderPublicToken('ord_8W2QK7D3ZZZZZ')).toBe(false); // wrong alphabet
    expect(isValidOrderPublicToken('')).toBe(false);
  });
});