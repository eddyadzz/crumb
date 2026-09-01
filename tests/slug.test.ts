import { describe, expect, it } from 'vitest';
import { slugify } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Sweet Crumbs Bakery')).toBe('sweet-crumbs-bakery');
  });

  it('collapses runs of separators and strips surrounding ones', () => {
    expect(slugify('Urban  Bakes   & Co')).toBe('urban-bakes-co');
    expect(slugify('  leading and trailing  ')).toBe('leading-and-trailing');
    expect(slugify('-already-dashed-')).toBe('already-dashed');
  });

  it('drops non-ASCII and non-alphanumeric characters', () => {
    expect(slugify('Café Crumb')).toBe('caf-crumb');
    expect(slugify('Foo.bar_baz!')).toBe('foo-bar-baz');
  });

  it('falls back to "business" for empty or symbol-only input', () => {
    expect(slugify('')).toBe('business');
    expect(slugify('###')).toBe('business');
  });
});