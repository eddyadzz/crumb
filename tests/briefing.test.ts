import { describe, expect, it } from 'vitest';
import {
  mergeOrderLines,
  buildBriefing,
  briefingNotificationCopy,
  briefingText,
  type BriefingInput,
} from '@/lib/briefing';

const forDate = new Date(2026, 8, 4); // Sep 4 2026 (a Friday)

const base: BriefingInput = {
  forDate,
  orders: [
    {
      totalAmount: 1000,
      items: [
        { productId: 'p1', productName: 'Birthday Cake', quantity: 2 },
        { productId: 'p2', productName: 'Cupcakes', quantity: 3 },
      ],
    },
    {
      totalAmount: 2250,
      items: [{ productId: 'p1', productName: 'Birthday Cake', quantity: 1 }],
    },
  ],
  batches: [
    { recipeId: 'r1', recipeName: 'Chocolate Cake', batchCount: 3 },
    { recipeId: 'r2', recipeName: 'Cookies', batchCount: 1 },
  ],
  shortageRows: [
    { name: 'Butter', shortageBase: 500, baseUnit: 'g', enough: false },
    { name: 'Cream Cheese', shortageBase: 1000, baseUnit: 'g', enough: false },
    { name: 'Flour', shortageBase: 0, baseUnit: 'g', enough: true },
  ],
};

describe('morning briefing', () => {
  it('merges the same product across orders into one line', () => {
    expect(mergeOrderLines(base.orders)).toEqual([
      { label: 'Birthday Cake ×3' },
      { label: 'Cupcakes ×3' },
    ]);
  });

  it('builds the full briefing: date, batches, shortages, revenue', () => {
    const b = buildBriefing(base);
    expect(b.dateLabel).toBe('Friday, Sep 4');
    expect(b.ordersCount).toBe(2);
    expect(b.batchesNeeded).toBe(4);
    expect(b.batchLines).toEqual([
      { label: '3× Chocolate Cake' },
      { label: '1× Cookies' },
    ]);
    expect(b.shortages).toEqual([
      { label: 'Butter (500 g)' },
      { label: 'Cream Cheese (1.00 kg)' },
    ]);
    expect(b.expectedRevenue).toBe(3250);
    expect(b.hasContent).toBe(true);
  });

  it('is empty when nothing is due', () => {
    const b = buildBriefing({ ...base, orders: [], batches: [] });
    expect(b.hasContent).toBe(false);
    expect(b.expectedRevenue).toBe(0);
    expect(b.batchesNeeded).toBe(0);
  });

  it('caps shortages at four lines', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => ({
      name: n,
      shortageBase: 10,
      baseUnit: 'g',
      enough: false,
    }));
    expect(buildBriefing({ ...base, shortageRows: rows }).shortages).toHaveLength(4);
  });

  it('writes compact notification copy', () => {
    const { title, message } = briefingNotificationCopy(buildBriefing(base));
    expect(title).toBe('2 orders due Friday, Sep 4');
    expect(message).toContain('Birthday Cake ×3');
    expect(message).toContain('4 batches to plan');
    expect(message).toContain('2 ingredient shortages');
    expect(message).toContain('3250 MVR');
  });

  it('renders a readable plain-text briefing', () => {
    const text = briefingText(buildBriefing(base), "Aishah's Café");
    expect(text).toContain("Morning briefing for Aishah's Café — due Friday, Sep 4:");
    expect(text).toContain('• Birthday Cake ×3');
    expect(text).toContain('Need production: 4 batches');
    expect(text).toContain('- Butter (500 g)');
    expect(text).toContain('Expected revenue: 3250 MVR');
  });
});