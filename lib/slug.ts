/** Pure slug helper — stays free of server/DB imports so it can be unit-tested
 * and reused by both the onboarding action and the admin portal. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'business';
}