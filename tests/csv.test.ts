import { describe, expect, it } from 'vitest';
import { toCsvString } from '@/lib/csv';

describe('toCsvString', () => {
  it('serialises header and rows with CRLF endings and a BOM', () => {
    const csv = toCsvString(['Name', 'Cost'], [['Flour', 42.5]]);
    expect(csv).toBe('\uFEFFName,Cost\r\nFlour,42.5\r\n');
  });

  it('quotes cells containing separators, quotes, or newlines', () => {
    const csv = toCsvString(
      ['A'],
      [['has,comma'], ['has"quote'], ['line\nbreak'], ['plain']],
    );
    expect(csv).toContain('"has,comma"');
    expect(csv).toContain('"has""quote"');
    expect(csv).toContain('"line\nbreak"');
  });

  it('renders null and undefined as empty cells', () => {
    const csv = toCsvString(['A', 'B'], [[null, undefined]]);
    expect(csv).toBe('\uFEFFA,B\r\n,\r\n');
  });

  it('leaves clean numbers and text untouched', () => {
    const csv = toCsvString(['Qty', 'Note'], [[12, 'almond flour']]);
    expect(csv).toBe('\uFEFFQty,Note\r\n12,almond flour\r\n');
  });
});
