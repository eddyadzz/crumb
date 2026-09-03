import { describe, expect, it } from 'vitest';
import { validatePortalOrder } from '@/lib/portal';

const minDate = new Date(2026, 8, 4); // Sep 4 2026
const base = {
  name: 'Aisha',
  phone: '+960 777-1234',
  productId: 'prod1',
  quantity: 2,
  deliveryDate: '2026-09-06',
  company: '',
};

describe('portal order validation', () => {
  it('accepts a clean submission', () => {
    const r = validatePortalOrder({ ...base, message: '  Less sugar please  ' }, { minDate });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('Aisha');
      expect(r.value.quantity).toBe(2);
      expect(r.value.message).toBe('Less sugar please');
      expect(r.value.deliveryDate.getFullYear()).toBe(2026);
    }
  });

  it('rejects honeypot fills', () => {
    const r = validatePortalOrder({ ...base, company: 'spammy bot' }, { minDate });
    expect(r.ok).toBe(false);
  });

  it('validates name, phone, product, quantity', () => {
    expect(validatePortalOrder({ ...base, name: ' ' }, { minDate }).ok).toBe(false);
    expect(validatePortalOrder({ ...base, phone: 'abc' }, { minDate }).ok).toBe(false);
    expect(validatePortalOrder({ ...base, productId: '' }, { minDate }).ok).toBe(false);
    expect(validatePortalOrder({ ...base, quantity: 0 }, { minDate }).ok).toBe(false);
    expect(validatePortalOrder({ ...base, quantity: 2.5 }, { minDate }).ok).toBe(false);
    expect(validatePortalOrder({ ...base, quantity: 501 }, { minDate }).ok).toBe(false);
  });

  it('rejects past and far-future delivery dates', () => {
    expect(validatePortalOrder({ ...base, deliveryDate: '2026-09-03' }, { minDate }).ok).toBe(false);
    expect(validatePortalOrder({ ...base, deliveryDate: '2027-09-06' }, { minDate }).ok).toBe(false);
    expect(validatePortalOrder({ ...base, deliveryDate: 'not-a-date' }, { minDate }).ok).toBe(false);
    // today itself is fine
    expect(validatePortalOrder({ ...base, deliveryDate: '2026-09-04' }, { minDate }).ok).toBe(true);
  });

  it('treats non-string junk as empty and fails cleanly', () => {
    const r = validatePortalOrder(
      { name: 42, phone: null, productId: {}, quantity: 'x', deliveryDate: [] },
      { minDate }
    );
    expect(r.ok).toBe(false);
  });
});